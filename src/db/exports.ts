import type { SQLiteDatabase } from 'expo-sqlite';

import { formatCents, getCalls, type PhoneCall } from '@/db/calls';

export type CallExport = {
  id: number;
  /** ISO 8601 timestamp of when the export was made */
  createdAt: string;
  callCount: number;
  /** Who made the export (name or e-mail from the Exports tab, or the device name); may be empty */
  exportedBy: string;
  /** File name chosen when the export was made, e.g. moler-calls-ana-at-example.com-2026-10-12-14-35.xml */
  fileName: string;
};

type CallExportRow = {
  id: number;
  created_at: string;
  call_count: number;
  exported_by: string;
  file_name: string;
};

const EXPORT_COLUMNS = 'id, created_at, call_count, exported_by, file_name';

function fromRow(row: CallExportRow): CallExport {
  return {
    id: row.id,
    createdAt: row.created_at,
    callCount: row.call_count,
    exportedBy: row.exported_by,
    fileName: row.file_name,
  };
}

/** Exports, newest first */
export async function getExports(db: SQLiteDatabase): Promise<CallExport[]> {
  const rows = await db.getAllAsync<CallExportRow>(
    `SELECT ${EXPORT_COLUMNS} FROM exports ORDER BY id DESC`
  );
  return rows.map(fromRow);
}

export async function getExport(db: SQLiteDatabase, id: number): Promise<CallExport | null> {
  const row = await db.getFirstAsync<CallExportRow>(
    `SELECT ${EXPORT_COLUMNS} FROM exports WHERE id = ?`,
    id
  );
  return row && fromRow(row);
}

/** The XML document exactly as it was produced when the export was made */
export async function getExportXml(db: SQLiteDatabase, id: number): Promise<string | null> {
  const row = await db.getFirstAsync<{ xml: string }>('SELECT xml FROM exports WHERE id = ?', id);
  return row?.xml ?? null;
}

export async function countUnexportedCalls(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM calls WHERE export_id IS NULL'
  );
  return row?.count ?? 0;
}

/**
 * Puts every call that hasn't been exported yet into a new export and marks those calls as exported.
 * Returns null when there is nothing new to export.
 */
export async function createExport(db: SQLiteDatabase, exportedBy: string): Promise<CallExport | null> {
  let created: CallExport | null = null;
  await db.withTransactionAsync(async () => {
    const calls = await getCalls(db, { exportId: null });
    if (calls.length === 0) return;

    const now = new Date();
    const createdAt = now.toISOString();
    const fileName = buildFileName(exportedBy, now);
    const { lastInsertRowId: id } = await db.runAsync(
      "INSERT INTO exports (created_at, call_count, exported_by, file_name, xml) VALUES (?, ?, ?, ?, '')",
      createdAt,
      calls.length,
      exportedBy,
      fileName
    );
    const callExport = { id, createdAt, callCount: calls.length, exportedBy, fileName };
    await db.runAsync('UPDATE exports SET xml = ? WHERE id = ?', buildExportXml(callExport, calls), id);
    // Mark exactly the calls that went into the document, not ones added meanwhile
    await db.runAsync(
      `UPDATE calls SET export_id = ? WHERE id IN (${calls.map(() => '?').join(', ')})`,
      id,
      ...calls.map((call) => call.id)
    );
    created = callExport;
  });
  return created;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function element(name: string, value: string | number | boolean | null) {
  const text = value === null ? '' : escapeXml(String(value));
  return text === '' ? `    <${name}/>` : `    <${name}>${text}</${name}>`;
}

/** Builds the export document; the audio of voice messages stays in the app, only its length is listed */
export function buildExportXml(callExport: CallExport, calls: PhoneCall[]) {
  const callElements = calls.map((call) =>
    [
      `  <call id="${call.id}">`,
      element('calledAt', call.calledAt),
      element('phone', call.phone),
      element('name', call.name),
      element('address', call.address),
      element('comment', call.comment),
      element('price', call.priceCents === null ? null : formatCents(call.priceCents)),
      element('callType', call.callType),
      element('durationSeconds', call.durationSeconds),
      element('location', call.location),
      element('numberLabel', call.numberLabel),
      element('countryIso', call.countryIso),
      element('isVideo', call.isVideo),
      element('voiceMessageMs', call.hasVoice ? call.voiceDurationMs : null),
      element('transcript', call.transcript),
      '  </call>',
    ].join('\n')
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<calls export="${callExport.id}" exportedAt="${callExport.createdAt}" exportedBy="${escapeXml(callExport.exportedBy)}" count="${callExport.callCount}">`,
    ...callElements,
    '</calls>',
    '',
  ].join('\n');
}

/** Serbian letters that don't reduce to plain ASCII by dropping accents, Cyrillic included */
const SERBIAN_TO_ASCII: Record<string, string> = {
  Đ: 'Dj', đ: 'dj', Ђ: 'Dj', ђ: 'dj', Љ: 'Lj', љ: 'lj', Њ: 'Nj', њ: 'nj', Џ: 'Dz', џ: 'dz',
  Ћ: 'C', ћ: 'c', Ч: 'C', ч: 'c', Ш: 'S', ш: 's', Ж: 'Z', ж: 'z', Ј: 'J', ј: 'j',
  А: 'A', а: 'a', Б: 'B', б: 'b', В: 'V', в: 'v', Г: 'G', г: 'g', Д: 'D', д: 'd',
  Е: 'E', е: 'e', З: 'Z', з: 'z', И: 'I', и: 'i', К: 'K', к: 'k', Л: 'L', л: 'l',
  М: 'M', м: 'm', Н: 'N', н: 'n', О: 'O', о: 'o', П: 'P', п: 'p', Р: 'R', р: 'r',
  С: 'S', с: 's', Т: 'T', т: 't', У: 'U', у: 'u', Ф: 'F', ф: 'f', Х: 'H', х: 'h',
  Ц: 'C', ц: 'c',
};

/** Keeps letters, digits, "." and "-"; an e-mail's "@" becomes "-at-", anything else "-" */
function fileNamePart(value: string) {
  return Array.from(value, (char) => SERBIAN_TO_ASCII[char] ?? char)
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Only letters, digits, "." and "-": Google Drive failed to upload names with "@" or "_"
    .replace(/@/g, '-at-')
    .replace(/[^A-Za-z0-9.-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
}

/** moler-calls-{name or e-mail}-{local date and time}.xml, e.g. moler-calls-ana-at-example.com-2026-10-12-14-35.xml */
export function buildFileName(exportedBy: string, date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `-${pad(date.getHours())}-${pad(date.getMinutes())}`;
  const who = fileNamePart(exportedBy);
  return who ? `moler-calls-${who}-${stamp}.xml` : `moler-calls-${stamp}.xml`;
}
