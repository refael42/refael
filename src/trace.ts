/**
 * Dev-only breadcrumbs in the Metro terminal. A native crash on a phone closes the app with
 * no error at all; the last "[trace]" line then shows how far it got.
 */
export function trace(message: string): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.log(`[trace] ${message}`);
}
