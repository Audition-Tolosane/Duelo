import { Alert, Platform } from 'react-native';
import { t } from './i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authFetch } from './api';
import { setAdToken } from './adToken';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

/** Code à usage unique demandé au serveur avant la pub ; Google le lui renvoie une fois la pub vue. */
async function startAdSession(): Promise<string | null> {
  try {
    const res = await authFetch(`${API_URL}/api/ads/start`, { method: 'POST' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.nonce === 'string' ? data.nonce : null;
  } catch {
    return null;
  }
}

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
    if (!info.canRequestAds) { notifyUnavailable(); return false; }
  } catch {
    // consent module unavailable — let the request decide
  }

  const npa = (await AsyncStorage.getItem('duelo_ads_npa')) === '1';
  const [nonce, userId] = await Promise.all([startAdSession(), AsyncStorage.getItem('duelo_user_id')]);
  setAdToken(null);

  return new Promise<boolean>((resolve) => {
    const ad = mod.RewardedAd.createForAdRequest(rewardedUnitId(mod), {
      requestNonPersonalizedAdsOnly: npa,
      // Google confirme la pub vue directement au serveur, avec ce code (récompense vérifiée)
      ...(nonce ? { serverSideVerificationOptions: { userId: userId || '', customData: nonce } } : {}),
    });
    let earned = false;
    let shown = false;
    let done = false;
    const unsubs: (() => void)[] = [];
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      unsubs.forEach((u) => u());
      // Aucune vidéo n'a pu s'afficher : on le dit, sinon le bouton semble ne rien faire.
      // (Vidéo fermée avant la fin : pas de message, c'est le choix du joueur.)
      if (!ok && !shown) notifyUnavailable();
      if (ok && nonce) setAdToken(nonce);
      resolve(ok);
    };
    // No fill within 15 s → give up rather than leave the user waiting.
    const timeout = setTimeout(() => finish(false), 15000);

    unsubs.push(ad.addAdEventListener(mod.RewardedAdEventType.LOADED, () => {
      clearTimeout(timeout);
      ad.show().then(() => { shown = true; }).catch(() => finish(false));
    }));
    unsubs.push(ad.addAdEventListener(mod.AdEventType.OPENED, () => { shown = true; }));
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

// Alerte native plutôt que Dialog : les boutons de pub vivent parfois dans une feuille modale,
// au-dessus de laquelle un Dialog global ne s'affiche pas sur iOS. Les pubs n'existent pas sur
// le web, où Alert à boutons ne marche pas.
function notifyUnavailable() {
  Alert.alert(t('ads.unavailable_title'), t('ads.unavailable_body'), [{ text: t('common.ok') }]);
}
