import { router } from 'expo-router';

export type NotificationTarget = { screen?: string; params?: Record<string, string> } | null | undefined;

/** Open the screen a notification points to — shared by the in-app list and push taps. */
export function openNotificationTarget(data: NotificationTarget) {
  const screen = data?.screen;
  if (!screen) return;
  const params = data?.params || {};

  if (screen === 'player-profile' && params.id) {
    router.push(`/player-profile?id=${params.id}` as any);
  } else if (screen === 'chat' && (params.userId || params.partnerId)) {
    const id = params.partnerId || params.userId;
    const pseudo = encodeURIComponent(params.partnerPseudo || params.pseudo || '');
    router.push(`/chat?partnerId=${id}&partnerPseudo=${pseudo}` as any);
  } else if (screen === 'category-detail' && params.id) {
    router.push(`/category-detail?id=${params.id}` as any);
  } else if (screen === 'home') {
    // Défi reçu : les défis en attente sont listés sur l'Accueil.
    router.push('/(tabs)/accueil' as any);
  }
}
