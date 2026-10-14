import type { SQLiteDatabase } from 'expo-sqlite';

import { parsePriceToCents } from '@/db/calls';

/** Only files exported by moler are imported */
export const EXPORT_FILE_PREFIX = 'moler-calls';

/** A call read from someone's export file */
export type ImportedCall = {
  id: number;
  /** Who made the export (name or e-mail from their Exports tab); empty for very old files */
  exportedBy: string;
  fileName: string;
  /** ISO 8601 timestamp of when the call happened */
  calledAt: string;
  phone: string;
  name: string;
  address: string;
  comment: string;
  priceCents: number | null;
  callType: string | null;
  durationSeconds: number | null;
  location: string;
  numberLabel: string;
  countryIso: string;
  isVideo: boolean;
  /** Length of the voice message, which itself is not part of the export */
  voiceMessageMs: number | null;
  transcript: string;
};

type ParsedCall = Omit<ImportedCall, 'id' | 'exportedBy' | 'fileName'> & { sourceCallId: number | null };

type ParsedExport = {
  exportId: number | null;
  exportedAt: string;
  exportedBy: string;
  calls: ParsedCall[];
};

/** A file picked for import: its name and contents */
export type ExportFile = { name: string; text: string };

/** Days to import or show; null means no limit on that side */
export type DayRange = { from: Date | null; to: Date | null };

export type ImportResult = {
  /** moler export files that were read */
  readFiles: number;
  importedCalls: number;
  /** Calls that were already in the list */
  duplicateCalls: number;
  /** Calls outside the selected days */
  skippedCalls: number;
  /** Files that aren't moler exports */
  failedFiles: string[];
};

/** Start of `from` and end of `to` as ISO timestamps, in the phone's time zone */
function rangeBounds({ from, to }: DayRange) {
  return {
    start: from ? new Date(from.getFullYear(), from.getMonth(), from.getDate()).toISOString() : null,
    end: to ? new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1).toISOString() : null,
  };
}

function isInRange(calledAt: string, { start, end }: ReturnType<typeof rangeBounds>) {
  const time = new Date(calledAt).getTime();
  return (start === null || time >= new Date(start).getTime()) && (end === null || time < new Date(end).getTime());
}

function unescapeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseAttributes(text: string) {
  const attributes: Record<string, string> = {};
  for (const [, key, value] of text.matchAll(/(\w+)="([^"]*)"/g)) {
    attributes[key] = unescapeXml(value);
  }
  return attributes;
}

function toNumber(value: string | undefined) {
  if (value === undefined || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Reads a file produced by buildExportXml (src/db/exports.ts). It is a small reader for that one
 * format, not a general XML parser. Returns null when the text is not a moler export.
 */
export function parseExportXml(xml: string): ParsedExport | null {
  const root = xml.match(/<calls\b([^>]*)>/);
  if (!root) return null;
  const rootAttributes = parseAttributes(root[1]);
  if (!rootAttributes.exportedAt) return null;

  const calls: ParsedCall[] = [];
  for (const [, callAttributes, body] of xml.matchAll(/<call\b([^>]*)>([\s\S]*?)<\/call>/g)) {
    const fields: Record<string, string> = {};
    for (const [, emptyName, name, value] of body.matchAll(/<(\w+)\s*\/>|<(\w+)>([\s\S]*?)<\/\2>/g)) {
      if (emptyName) fields[emptyName] = '';
      else fields[name] = unescapeXml(value);
    }
    if (!fields.calledAt) continue;
    const price = fields.price ? parsePriceToCents(fields.price) : null;
    calls.push({
      sourceCallId: toNumber(parseAttributes(callAttributes).id),
      calledAt: fields.calledAt,
      phone: fields.phone ?? '',
      name: fields.name ?? '',
      address: fields.address ?? '',
      comment: fields.comment ?? '',
      priceCents: price === null || Number.isNaN(price) ? null : price,
      callType: fields.callType || null,
      durationSeconds: toNumber(fields.durationSeconds),
      location: fields.location ?? '',
      numberLabel: fields.numberLabel ?? '',
      countryIso: fields.countryIso ?? '',
      isVideo: fields.isVideo === 'true',
      voiceMessageMs: toNumber(fields.voiceMessageMs),
      transcript: fields.transcript ?? '',
    });
  }

  return {
    exportId: toNumber(rootAttributes.export),
    exportedAt: rootAttributes.exportedAt,
    exportedBy: rootAttributes.exportedBy ?? '',
    calls,
  };
}

/**
 * Imports the calls of moler export files that fall within `range`. Files aren't remembered, so a
 * folder can be imported again (e.g. for other days); a call already in the list is never added twice.
 */
export async function importExportFiles(
  db: SQLiteDatabase,
  files: ExportFile[],
  range: DayRange
): Promise<ImportResult> {
  const result: ImportResult = { readFiles: 0, importedCalls: 0, duplicateCalls: 0, skippedCalls: 0, failedFiles: [] };
  const bounds = rangeBounds(range);

  for (const file of files) {
    const parsed = parseExportXml(file.text);
    if (!parsed) {
      result.failedFiles.push(file.name);
      continue;
    }
    result.readFiles += 1;
    await db.withTransactionAsync(async () => {
      for (const call of parsed.calls) {
        if (!isInRange(call.calledAt, bounds)) {
          result.skippedCalls += 1;
          continue;
        }
        const { changes } = await db.runAsync(
          `INSERT OR IGNORE INTO imported_calls (exported_by, file_name, source_call_id, called_at, phone, name,
             address, comment, price_cents, call_type, duration_seconds, location, number_label, country_iso,
             is_video, voice_message_ms, transcript)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          parsed.exportedBy,
          file.name,
          call.sourceCallId,
          call.calledAt,
          call.phone,
          call.name,
          call.address,
          call.comment,
          call.priceCents,
          call.callType,
          call.durationSeconds,
          call.location,
          call.numberLabel,
          call.countryIso,
          call.isVideo ? 1 : 0,
          call.voiceMessageMs,
          call.transcript
        );
        if (changes > 0) result.importedCalls += 1;
        else result.duplicateCalls += 1;
      }
    });
  }
  return result;
}

type ImportedCallRow = {
  id: number;
  exported_by: string;
  file_name: string;
  called_at: string;
  phone: string;
  name: string;
  address: string;
  comment: string;
  price_cents: number | null;
  call_type: string | null;
  duration_seconds: number | null;
  location: string;
  number_label: string;
  country_iso: string;
  is_video: number;
  voice_message_ms: number | null;
  transcript: string;
};

/** Imported calls within `range` (whole days, the phone's time zone), oldest first */
export async function getImportedCalls(db: SQLiteDatabase, range: DayRange): Promise<ImportedCall[]> {
  const { start, end } = rangeBounds(range);
  const conditions: string[] = [];
  const params: string[] = [];
  if (start) {
    conditions.push('called_at >= ?');
    params.push(start);
  }
  if (end) {
    conditions.push('called_at < ?');
    params.push(end);
  }
  const rows = await db.getAllAsync<ImportedCallRow>(
    `SELECT * FROM imported_calls
     ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY called_at ASC, exported_by ASC`,
    params
  );
  return rows.map((row) => ({
    id: row.id,
    exportedBy: row.exported_by,
    fileName: row.file_name,
    calledAt: row.called_at,
    phone: row.phone,
    name: row.name,
    address: row.address,
    comment: row.comment,
    priceCents: row.price_cents,
    callType: row.call_type,
    durationSeconds: row.duration_seconds,
    location: row.location,
    numberLabel: row.number_label,
    countryIso: row.country_iso,
    isVideo: row.is_video === 1,
    voiceMessageMs: row.voice_message_ms,
    transcript: row.transcript,
  }));
}

export async function countImportedCalls(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM imported_calls');
  return row?.count ?? 0;
}
