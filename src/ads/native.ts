import type { AdProvider } from './types';

// The real rewarded ads (AdMob through react-native-google-mobile-ads) need that package and a
// native build. It is not installed yet (installing it needs the owner's go-ahead), so a native
// build shows no ads; the web build has its own file (native.web.ts).

export function nativeAds(): AdProvider | null {
  return null;
}
