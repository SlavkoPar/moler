import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'moler.db';
const DATABASE_VERSION = 5;

export type Person = {
  id: number;
  phone: string;
  name: string;
  address: string;
};

export type PhoneCall = {
  id: number;
  personId: number;
  phone: string;
  name: string;
  address: string;
  /** ISO 8601 timestamp of when the call happened */
  calledAt: string;
  comment: string;
  /** Price in cents to avoid floating point rounding issues; null when not set */
  priceCents: number | null;
  /** Details that usually come from the phone's call log */
  callType: string | null;
  durationSeconds: number | null;
  location: string;
  numberLabel: string;
  countryIso: string;
  isVideo: boolean;
  /** Whether a voice message is stored; the audio itself is loaded with getVoiceMessage */
  hasVoice: boolean;
  voiceDurationMs: number | null;
  /** Text recognized from the voice message, editable by the user */
  transcript: string;
};

export type VoiceMessage = {
  /** Encoded audio exactly as recorded (m4a on phones, usually webm in browsers) */
  data: Uint8Array;
  mimeType: string;
  durationMs: number | null;
};

export type NewPhoneCall = Omit<PhoneCall, 'id' | 'personId' | 'hasVoice' | 'voiceDurationMs'> & {
  voice?: VoiceMessage | null;
};

/** All calls from one person rolled up */
export type PersonSummary = Person & {
  callCount: number;
  /** Sum of all call prices in cents; 0 when no call has a price */
  totalCents: number;
  /** Sum of all known call durations; 0 when none is known */
  totalDurationSeconds: number;
  lastCalledAt: string;
};

type PhoneCallRow = {
  id: number;
  person_id: number;
  phone: string;
  name: string;
  address: string;
  called_at: string;
  comment: string | null;
  price_cents: number | null;
  call_type: string | null;
  duration_seconds: number | null;
  location: string;
  number_label: string;
  country_iso: string;
  is_video: number;
  has_voice: number;
  voice_duration_ms: number | null;
  transcript: string;
};

type PersonSummaryRow = Person & {
  call_count: number;
  total_cents: number;
  total_duration_seconds: number;
  last_called_at: string;
};

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  // Foreign keys are off by default in SQLite and must be enabled per connection
  await db.execAsync('PRAGMA foreign_keys = ON');

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentDbVersion = result?.user_version ?? 0;
  if (currentDbVersion >= DATABASE_VERSION) return;

  if (currentDbVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      CREATE TABLE IF NOT EXISTS calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        caller TEXT NOT NULL,
        called_at TEXT NOT NULL,
        comment TEXT,
        price_cents INTEGER
      );
    `);
    currentDbVersion = 1;
  }

  if (currentDbVersion === 1) {
    // Move caller info into a people table so calls from the same person can be grouped
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE people (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          key TEXT NOT NULL UNIQUE,
          phone TEXT NOT NULL DEFAULT '',
          name TEXT NOT NULL DEFAULT '',
          address TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE calls_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
          called_at TEXT NOT NULL,
          comment TEXT,
          price_cents INTEGER
        );
      `);

      const oldCalls = await db.getAllAsync<{
        id: number;
        caller: string;
        called_at: string;
        comment: string | null;
        price_cents: number | null;
      }>('SELECT * FROM calls');
      for (const call of oldCalls) {
        // The old "caller" field held either a phone number or a name
        const isPhone = looksLikePhone(call.caller);
        const personId = await upsertPerson(db, {
          phone: isPhone ? call.caller : '',
          name: isPhone ? '' : call.caller,
          address: '',
        });
        await db.runAsync(
          'INSERT INTO calls_v2 (id, person_id, called_at, comment, price_cents) VALUES (?, ?, ?, ?, ?)',
          call.id,
          personId,
          call.called_at,
          call.comment,
          call.price_cents
        );
      }

      await db.execAsync(`
        DROP TABLE calls;
        ALTER TABLE calls_v2 RENAME TO calls;
        CREATE INDEX idx_calls_called_at ON calls (called_at);
        CREATE INDEX idx_calls_person_id ON calls (person_id);
      `);
    });
    currentDbVersion = 2;
  }

  if (currentDbVersion === 2) {
    await db.execAsync(`
      ALTER TABLE calls ADD COLUMN call_type TEXT;
      ALTER TABLE calls ADD COLUMN duration_seconds INTEGER;
      ALTER TABLE calls ADD COLUMN location TEXT NOT NULL DEFAULT '';
      ALTER TABLE calls ADD COLUMN number_label TEXT NOT NULL DEFAULT '';
      ALTER TABLE calls ADD COLUMN country_iso TEXT NOT NULL DEFAULT '';
      ALTER TABLE calls ADD COLUMN is_video INTEGER NOT NULL DEFAULT 0;
    `);
    currentDbVersion = 3;
  }

  if (currentDbVersion === 3) {
    // Audio lives in its own table so listing calls never loads recordings
    await db.execAsync(`
      CREATE TABLE voice_messages (
        call_id INTEGER PRIMARY KEY NOT NULL REFERENCES calls (id) ON DELETE CASCADE,
        data BLOB NOT NULL,
        mime_type TEXT NOT NULL,
        duration_ms INTEGER
      );
    `);
    currentDbVersion = 4;
  }

  if (currentDbVersion === 4) {
    await db.execAsync(`ALTER TABLE calls ADD COLUMN transcript TEXT NOT NULL DEFAULT ''`);
    currentDbVersion = 5;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

function looksLikePhone(value: string) {
  return /^\+?[\d\s\-().\/]{3,}$/.test(value.trim());
}

/** Strips formatting so "+381 60-123 4567" and "+381601234567" match */
export function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  return digits && trimmed.startsWith('+') ? `+${digits}` : digits;
}

/** Identifies a person: by phone number when known, otherwise by name */
function personKey(phone: string, name: string) {
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone) return `tel:${normalizedPhone}`;
  const normalizedName = name.trim().toLowerCase();
  return normalizedName ? `name:${normalizedName}` : null;
}

/** Creates the person or fills in any new details; empty fields never overwrite saved ones */
async function upsertPerson(db: SQLiteDatabase, person: Omit<Person, 'id'>): Promise<number> {
  const key = personKey(person.phone, person.name);
  if (!key) throw new Error('A person needs a phone number or a name');

  const row = await db.getFirstAsync<{ id: number }>(
    `INSERT INTO people (key, phone, name, address) VALUES (?, ?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET
       phone = COALESCE(NULLIF(excluded.phone, ''), people.phone),
       name = COALESCE(NULLIF(excluded.name, ''), people.name),
       address = COALESCE(NULLIF(excluded.address, ''), people.address)
     RETURNING id`,
    key,
    person.phone.trim(),
    person.name.trim(),
    person.address.trim()
  );
  if (!row) throw new Error('Saving the person failed');
  return row.id;
}

export async function findPersonByPhone(db: SQLiteDatabase, phone: string) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;
  return db.getFirstAsync<Person>(
    'SELECT id, phone, name, address FROM people WHERE key = ?',
    `tel:${normalizedPhone}`
  );
}

function fromRow(row: PhoneCallRow): PhoneCall {
  return {
    id: row.id,
    personId: row.person_id,
    phone: row.phone,
    name: row.name,
    address: row.address,
    calledAt: row.called_at,
    comment: row.comment ?? '',
    priceCents: row.price_cents,
    callType: row.call_type,
    durationSeconds: row.duration_seconds,
    location: row.location,
    numberLabel: row.number_label,
    countryIso: row.country_iso,
    isVideo: row.is_video === 1,
    hasVoice: row.has_voice === 1,
    voiceDurationMs: row.voice_duration_ms,
    transcript: row.transcript,
  };
}

export async function getCalls(db: SQLiteDatabase): Promise<PhoneCall[]> {
  const rows = await db.getAllAsync<PhoneCallRow>(
    `SELECT calls.*, people.phone, people.name, people.address,
       voice_messages.call_id IS NOT NULL AS has_voice,
       voice_messages.duration_ms AS voice_duration_ms
     FROM calls
     JOIN people ON people.id = calls.person_id
     LEFT JOIN voice_messages ON voice_messages.call_id = calls.id
     ORDER BY calls.called_at DESC`
  );
  return rows.map(fromRow);
}

/** One row per person who has calls, most recently called first */
export async function getPeopleSummary(db: SQLiteDatabase): Promise<PersonSummary[]> {
  const rows = await db.getAllAsync<PersonSummaryRow>(
    `SELECT people.id, people.phone, people.name, people.address,
       COUNT(calls.id) AS call_count,
       COALESCE(SUM(calls.price_cents), 0) AS total_cents,
       COALESCE(SUM(calls.duration_seconds), 0) AS total_duration_seconds,
       MAX(calls.called_at) AS last_called_at
     FROM people JOIN calls ON calls.person_id = people.id
     GROUP BY people.id
     ORDER BY last_called_at DESC`
  );
  return rows.map(
    ({ call_count, total_cents, total_duration_seconds, last_called_at, ...person }) => ({
      ...person,
      callCount: call_count,
      totalCents: total_cents,
      totalDurationSeconds: total_duration_seconds,
      lastCalledAt: last_called_at,
    })
  );
}

export async function addCall(db: SQLiteDatabase, call: NewPhoneCall) {
  await db.withTransactionAsync(async () => {
    const personId = await upsertPerson(db, call);
    const { lastInsertRowId: callId } = await db.runAsync(
      `INSERT INTO calls (person_id, called_at, comment, price_cents, call_type, duration_seconds,
         location, number_label, country_iso, is_video, transcript)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      personId,
      call.calledAt,
      call.comment,
      call.priceCents,
      call.callType,
      call.durationSeconds,
      call.location.trim(),
      call.numberLabel.trim(),
      call.countryIso.trim().toUpperCase(),
      call.isVideo ? 1 : 0,
      call.transcript.trim()
    );
    if (call.voice) {
      await db.runAsync(
        'INSERT INTO voice_messages (call_id, data, mime_type, duration_ms) VALUES (?, ?, ?, ?)',
        callId,
        call.voice.data,
        call.voice.mimeType,
        call.voice.durationMs
      );
    }
  });
}

export async function getVoiceMessage(db: SQLiteDatabase, callId: number): Promise<VoiceMessage | null> {
  const row = await db.getFirstAsync<{
    data: Uint8Array;
    mime_type: string;
    duration_ms: number | null;
  }>('SELECT data, mime_type, duration_ms FROM voice_messages WHERE call_id = ?', callId);
  return row && { data: row.data, mimeType: row.mime_type, durationMs: row.duration_ms };
}

export async function deleteCall(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM calls WHERE id = ?', id);
}

/** Name when known, otherwise the phone number */
export function displayName(person: Pick<Person, 'name' | 'phone'>) {
  return person.name || person.phone;
}

/** Parses user input like "12", "12.5" or "12,50" into cents. Returns null for empty input, NaN for invalid. */
export function parsePriceToCents(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (trimmed === '') return null;
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return NaN;
  return Math.round(parseFloat(trimmed) * 100);
}

export function formatCents(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2);
}

/** Parses "330", "5:30" or "1:05:30" into seconds. Returns null for empty input, NaN for invalid. */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(trimmed)) return NaN;
  return trimmed.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}

/** Formats seconds as "5:30" or "1:05:30" */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}
