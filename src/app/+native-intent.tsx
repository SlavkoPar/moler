/**
 * The Calls screen is the app's start screen ("/"). Links from before that change, like
 * moler://calls?caller=+381601234567 sent by MacroDroid after a call, are sent there with their query.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const match = path.match(/^(?:[a-z][\w+.-]*:\/\/)?\/?calls\/?(\?.*)?$/i);
    return match ? `/${match[1] ?? ''}` : path;
  } catch {
    // Never crash while handling an incoming link
    return path;
  }
}
