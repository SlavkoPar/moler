import { formatDuration, type PhoneCall } from '@/db/calls';

export function formatDateTime(date: Date) {
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Short summary of the call log details, e.g. "Incoming · Mobile · 5:30 · Belgrade" */
export function callDetails(
  call: Pick<PhoneCall, 'callType' | 'isVideo' | 'numberLabel' | 'durationSeconds' | 'location' | 'countryIso'>
) {
  return [
    call.callType ? capitalize(call.callType) : '',
    call.isVideo ? 'Video' : '',
    call.numberLabel,
    call.durationSeconds !== null ? formatDuration(call.durationSeconds) : '',
    call.location,
    call.countryIso,
  ]
    .filter(Boolean)
    .join(' · ');
}
