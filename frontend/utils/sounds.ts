import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

type SoundKey = 'correct' | 'wrong' | 'tick' | 'victory' | 'defeat';

const SOUND_FILES: Record<SoundKey, any> = {
  correct: require('../assets/sounds/correct.wav'),
  wrong:   require('../assets/sounds/wrong.wav'),
  tick:    require('../assets/sounds/tick.wav'),
  victory: require('../assets/sounds/victory.wav'),
  defeat:  require('../assets/sounds/defeat.wav'),
};

const _cache: Partial<Record<SoundKey, AudioPlayer>> = {};
let _enabled = true;
let _loaded = false;

export async function preloadSounds(): Promise<void> {
  if (_loaded) return;
  _loaded = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
    (Object.keys(SOUND_FILES) as SoundKey[]).forEach((key) => {
      _cache[key] = createAudioPlayer(SOUND_FILES[key]);
    });
  } catch {
    // Sounds are non-critical — fail silently
  }
}

export async function playSound(key: SoundKey): Promise<void> {
  if (!_enabled) return;
  try {
    const player = _cache[key];
    if (!player) return;
    await player.seekTo(0);
    player.play();
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
  (Object.keys(_cache) as SoundKey[]).forEach((key) => {
    try {
      _cache[key]?.remove();
    } catch {
      // Non-critical
    }
    delete _cache[key];
  });
  _loaded = false;
}
