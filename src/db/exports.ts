import type { SQLiteDatabase } from 'expo-sqlite';

import { formatCents, getCalls, type PhoneCall } from '@/db/calls';

export type CallExport = {
  id: number;
  /** ISO 8601 timestamp of when the export was made */
  createdAt: string;
  callCount: number;
};

type CallExportRow = {
  id: number;
  created_at: string;
  call_count: number;
};

function fromRow(row: CallExportRow): CallExport {
  return { id: row.id, createdAt: row.created_at, callCount: row.call_count };
}

/** Exports, newest first */
export async function getExports(db: SQLiteDatabase): Promise<CallExport[]> {
  const rows = await db.getAllAsync<CallExportRow>(
    'SELECT id, created_at, call_count FROM exports ORDER BY id DESC'
  );
  return rows.map(fromRow);
}

export async function getExport(db: SQLiteDatabase, id: number): Promise<CallExport | null> {
  const row = await db.getFirstAsync<CallExportRow>(
    'SELECT id, created_at, call_count FROM exports WHERE id = ?',
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
export async function createExport(db: SQLiteDatabase): Promise<CallExport | null> {
  let created: CallExport | null = null;
  await db.withTransactionAsync(async () => {
    const calls = await getCalls(db, { exportId: null });
    if (calls.length === 0) return;

    const createdAt = new Date().toISOString();
    const { lastInsertRowId: id } = await db.runAsync(
      "INSERT INTO exports (created_at, call_count, xml) VALUES (?, ?, '')",
      createdAt,
      calls.length
    );
    await db.runAsync(
      'UPDATE exports SET xml = ? WHERE id = ?',
      buildExportXml({ id, createdAt, callCount: calls.length }, calls),
      id
    );
    // Mark exactly the calls that went into the document, not ones added meanwhile
    await db.runAsync(
      `UPDATE calls SET export_id = ? WHERE id IN (${calls.map(() => '?').join(', ')})`,
      id,
      ...calls.map((call) => call.id)
    );
    created = { id, createdAt, callCount: calls.length };
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
    `<calls export="${callExport.id}" exportedAt="${callExport.createdAt}" count="${callExport.callCount}">`,
    ...callElements,
    '</calls>',
    '',
  ].join('\n');
}

export function exportFileName(callExport: CallExport) {
  return `moler-calls-${callExport.id}.xml`;
}
