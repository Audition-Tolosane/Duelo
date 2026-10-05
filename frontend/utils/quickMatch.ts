import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Quick Match unique (Accueil, état vide, onglet Jouer).
// Le matchmaking EXIGE un theme_id (sinon il renvoie vers Jouer) : on tire un thème au hasard
// parmi les tendances personnalisées avant de naviguer. Sans tendance, on ouvre Explorer
// plutôt que de lancer une recherche vouée à rebondir.
export async function startQuickMatch(router: { push: (href: any) => void }): Promise<void> {
  try {
    const uid = await AsyncStorage.getItem('duelo_user_id');
    const res = await fetch(`${API_URL}/api/themes/trending${uid ? `?user_id=${uid}` : ''}`);
    const data = await res.json();
    const list: { id: string; name: string }[] = data.trending || [];
    if (list.length > 0) {
      const pick = list[Math.floor(Math.random() * list.length)];
      router.push(`/matchmaking?category=${pick.id}&themeName=${encodeURIComponent(pick.name)}`);
      return;
    }
  } catch {
    // réseau indisponible : on retombe sur Explorer
  }
  router.push('/(tabs)/themes');
}
