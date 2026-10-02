export const CALL_TYPES = [
  'incoming',
  'outgoing',
  'missed',
  'rejected',
  'blocked',
  'voicemail',
  'other',
] as const;

export type CallType = (typeof CALL_TYPES)[number];

export type LastCall = {
  /** Empty for private or hidden numbers */
  number: string;
  /** Contact name Android cached for this number, if any */
  name: string | null;
  /** Milliseconds since the epoch */
  date: number;
  type: CallType;
  durationSeconds: number;
  /** Place Android derives from the number, e.g. "Belgrade, Serbia" */
  geocodedLocation: string | null;
  /** How the number is labelled in contacts, e.g. "Mobile"; null when it isn't a contact */
  numberLabel: string | null;
  /** Country the call was made or received in, e.g. "RS" */
  countryIso: string | null;
  isVideo: boolean;
};
