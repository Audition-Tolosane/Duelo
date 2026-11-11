import { router, Href } from 'expo-router';

/**
 * Retour à un onglet (Accueil, Jouer…) depuis un écran ouvert par-dessus (résultats, partie,
 * recherche d'adversaire…). On referme d'abord tous ces écrans, puis on va sur l'onglet.
 * Un simple `router.replace('/(tabs)/…')` empilait un 2e jeu d'onglets au-dessus du reste
 * (présentation modale, légèrement décalé vers le bas).
 */
export function goToTab(path: Href) {
  try { if (router.canDismiss()) router.dismissAll(); } catch {}
  router.navigate(path);
}
