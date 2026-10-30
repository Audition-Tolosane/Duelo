import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Rewarded ads (AdMob). The native module only exists in a development/store
// build — not in Expo Go nor on web — so it's loaded lazily and every entry
// point degrades gracefully when it's missing.
//
// EXPO_PUBLIC_ADS_TEST=1 (set in eas.json) forces Google's test ad units.
// Before the store release: real AdMob app IDs in app.json, real rewarded
// unit IDs below (EXPO_PUBLIC_ADMOB_REWARDED_IOS / _ANDROID), ADS_TEST=0.

type AdsModule = typeof import('react-native-google-mobile-ads');

let ads: AdsModule | null = null;
if (Platform.OS !== 'web') {
  try {
    ads = require('react-native-google-mobile-ads');
  } catch {
    ads = null;
  }
}

const TEST_MODE = process.env.EXPO_PUBLIC_ADS_TEST !== '0';

let initPromise: Promise<void> | null = null;

/** Ask GDPR consent (UMP form, EEA/UK only) then start the SDK. Safe to call many times. */
export function initAds(): Promise<void> {
  if (!ads) return Promise.resolve();
  if (!initPromise) {
    const mod = ads;
    initPromise = (async () => {
      try {
        await mod.AdsConsent.gatherConsent();
      } catch (e) {
        console.warn('[ads] consent error', e);
      }
      try {
        // Under 15 (set by the consent screen): non-personalised ads and the
        // under-age-of-consent tag on every request.
        if ((await AsyncStorage.getItem('duelo_ads_npa')) === '1') {
          await mod.default().setRequestConfiguration({ tagForUnderAgeOfConsent: true });
        }
        await mod.default().initialize();
      } catch (e) {
        console.warn('[ads] init error', e);
      }
    })();
  }
  return initPromise;
}

/** True when the "manage privacy choices" entry must be offered in settings. */
export async function privacyOptionsRequired(): Promise<boolean> {
  if (!ads) return false;
  try {
    const info = await ads.AdsConsent.getConsentInfo();
    return info.privacyOptionsRequirementStatus === ads.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  } catch {
    return false;
  }
}

export async function showPrivacyOptions(): Promise<void> {
  if (!ads) return;
  try {
    await ads.AdsConsent.showPrivacyOptionsForm();
  } catch (e) {
    console.warn('[ads] privacy form error', e);
  }
}

function rewardedUnitId(mod: AdsModule): string {
  if (TEST_MODE) return mod.TestIds.REWARDED;
  return (Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS
    : process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID) || mod.TestIds.REWARDED;
}

/**
 * Load and show a rewarded ad. Resolves true only if the user watched it to
 * the end (EARNED_REWARD), false on no fill / error / early close.
 * Without the native module (Expo Go), resolves true in __DEV__ so flows stay
 * testable, false otherwise.
 */
export async function showRewardedAd(): Promise<boolean> {
  if (!ads) return __DEV__;
  const mod = ads;
  await initAds();

  try {
    const info = await mod.AdsConsent.getConsentInfo();
    if (!info.canRequestAds) return false;
  } catch {
    // consent module unavailable — let the request decide
  }

  const npa = (await AsyncStorage.getItem('duelo_ads_npa')) === '1';

  return new Promise<boolean>((resolve) => {
    const ad = mod.RewardedAd.createForAdRequest(rewardedUnitId(mod), { requestNonPersonalizedAdsOnly: npa });
    let earned = false;
    let done = false;
    const unsubs: (() => void)[] = [];
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      unsubs.forEach((u) => u());
      resolve(ok);
    };
    // No fill within 15 s → give up rather than leave the user waiting.
    const timeout = setTimeout(() => finish(false), 15000);

    unsubs.push(ad.addAdEventListener(mod.RewardedAdEventType.LOADED, () => {
      clearTimeout(timeout);
      ad.show().catch(() => finish(false));
    }));
    unsubs.push(ad.addAdEventListener(mod.RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
    }));
    unsubs.push(ad.addAdEventListener(mod.AdEventType.CLOSED, () => finish(earned)));
    unsubs.push(ad.addAdEventListener(mod.AdEventType.ERROR, (e) => {
      console.warn('[ads] rewarded error', e);
      finish(false);
    }));
    ad.load();
  });
}
