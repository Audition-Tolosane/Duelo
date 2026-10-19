import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLanguage } from './i18n';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type PickableTheme = { id: string; name: string };

async function fetchThemes(url: string, key: 'themes' | 'trending'): Promise<PickableTheme[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.[key]) ? data[key] : [];
  } catch {
    return [];
  }
}

// Quick Match unique (Accueil, état vide, onglet Jouer).
// Le matchmaking EXIGE un theme_id (sinon il renvoie vers Jouer) : on tire un thème au hasard
// avant de naviguer. D'abord parmi les thèmes « Pour tout le monde » — l'adversaire tiré au
// sort n'a aucune raison de connaître la série préférée du joueur —, puis parmi les tendances
// personnalisées. Sans rien, on ouvre Explorer plutôt que de lancer une recherche vouée à rebondir.
export async function startQuickMatch(router: { push: (href: any) => void }): Promise<void> {
  let list = await fetchThemes(`${API_URL}/api/themes/everyone?lang=${getLanguage()}`, 'themes');
  if (list.length === 0) {
    const uid = await AsyncStorage.getItem('duelo_user_id');
    list = await fetchThemes(`${API_URL}/api/themes/trending${uid ? `?user_id=${uid}` : ''}`, 'trending');
  }
  if (list.length > 0) {
    const pick = list[Math.floor(Math.random() * list.length)];
    router.push(`/matchmaking?category=${pick.id}&themeName=${encodeURIComponent(pick.name)}`);
    return;
  }
  router.push('/(tabs)/themes');
}
