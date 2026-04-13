import { Audio } from 'expo-av';

type SoundKey = 'correct' | 'wrong' | 'tick' | 'victory' | 'defeat';

const SOUND_FILES: Record<SoundKey, any> = {
  correct: require('../assets/sounds/correct.wav'),
  wrong:   require('../assets/sounds/wrong.wav'),
  tick:    require('../assets/sounds/tick.wav'),
  victory: require('../assets/sounds/victory.wav'),
  defeat:  require('../assets/sounds/defeat.wav'),
};

const _cache: Partial<Record<SoundKey, Audio.Sound>> = {};
let _enabled = true;
let _loaded = false;

export async function preloadSounds(): Promise<void> {
  if (_loaded) return;
  _loaded = true;
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    await Promise.all(
      (Object.keys(SOUND_FILES) as SoundKey[]).map(async (key) => {
        const { sound } = await Audio.Sound.createAsync(SOUND_FILES[key], { shouldPlay: false });
        _cache[key] = sound;
      })
    );
  } catch {
    // Sounds are non-critical — fail silently
  }
}

export async function playSound(key: SoundKey): Promise<void> {
  if (!_enabled) return;
  try {
    const sound = _cache[key];
    if (!sound) return;
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    // Non-critical
  }
}

export function setSoundEnabled(enabled: boolean): void {
  _enabled = enabled;
}

export function isSoundEnabled(): boolean {
  return _enabled;
}

export async function unloadSounds(): Promise<void> {
  await Promise.all(
    Object.values(_cache).map((s) => s?.unloadAsync().catch(() => {}))
  );
}
