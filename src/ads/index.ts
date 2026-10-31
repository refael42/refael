import { STORE_BUILD } from '../config';
import { demoAds } from './demo';
import { nativeAds } from './native';
import type { AdProvider } from './types';

// The ads the game uses: the real network when there is one; otherwise the test ad, except in
// a store build (the stores turn down placeholder ads: there the ad buttons are simply hidden).

let provider: AdProvider | null | undefined;

export function getAds(): AdProvider | null {
  if (provider === undefined) {
    provider = nativeAds() ?? (STORE_BUILD ? null : demoAds());
    provider?.load();
  }
  return provider;
}

/** Shows a rewarded ad; true when it was watched to the end. */
export async function watchAd(): Promise<boolean> {
  const ads = getAds();
  if (!ads) return false;
  const result = await ads.show();
  ads.load();
  return result === 'rewarded';
}
