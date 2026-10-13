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

export type ImportResult = {
  importedFiles: number;
  importedCalls: number;
  /** Files that were imported before */
  skippedFiles: number;
  /** Files that aren't moler exports or couldn't be read */
  failedFiles: string[];
};

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

/** Imports moler export files; files imported before are skipped, so a folder can be imported again */
export async function importExportFiles(db: SQLiteDatabase, files: ExportFile[]): Promise<ImportResult> {
  const result: ImportResult = { importedFiles: 0, importedCalls: 0, skippedFiles: 0, failedFiles: [] };
  const importedAt = new Date().toISOString();

  for (const file of files) {
    const parsed = parseExportXml(file.text);
    if (!parsed) {
      result.failedFiles.push(file.name);
      continue;
    }
    await db.withTransactionAsync(async () => {
      const { changes, lastInsertRowId: fileId } = await db.runAsync(
        `INSERT OR IGNORE INTO imported_files (file_name, export_id, exported_at, exported_by, imported_at)
         VALUES (?, ?, ?, ?, ?)`,
        file.name,
        parsed.exportId,
        parsed.exportedAt,
        parsed.exportedBy,
        importedAt
      );
      if (changes === 0) {
        result.skippedFiles += 1;
        return;
      }
      for (const call of parsed.calls) {
        await db.runAsync(
          `INSERT INTO imported_calls (file_id, source_call_id, called_at, phone, name, address, comment,
             price_cents, call_type, duration_seconds, location, number_label, country_iso, is_video,
             voice_message_ms, transcript)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          fileId,
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
      }
      result.importedFiles += 1;
      result.importedCalls += parsed.calls.length;
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

/**
 * Imported calls, oldest first. `from` and `to` are days (any time of day): the list includes
 * calls from the start of `from` to the end of `to`, in the phone's time zone.
 */
export async function getImportedCalls(
  db: SQLiteDatabase,
  { from, to }: { from: Date | null; to: Date | null }
): Promise<ImportedCall[]> {
  const conditions: string[] = [];
  const params: string[] = [];
  if (from) {
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    conditions.push('imported_calls.called_at >= ?');
    params.push(start.toISOString());
  }
  if (to) {
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
    conditions.push('imported_calls.called_at < ?');
    params.push(end.toISOString());
  }
  const rows = await db.getAllAsync<ImportedCallRow>(
    `SELECT imported_calls.*, imported_files.exported_by, imported_files.file_name
     FROM imported_calls
     JOIN imported_files ON imported_files.id = imported_calls.file_id
     ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY imported_calls.called_at ASC, imported_files.exported_by ASC`,
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

export async function countImportedFiles(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM imported_files');
  return row?.count ?? 0;
}
