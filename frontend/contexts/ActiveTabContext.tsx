import { createContext, useContext } from 'react';

// Nom de l'onglet affiché ('accueil', 'play'…). Le pager garde les onglets voisins montés :
// un écran s'en sert pour suspendre ce qui tourne en continu quand on ne le voit pas.
export const ActiveTabContext = createContext<string | null>(null);

export function useActiveTab() {
  return useContext(ActiveTabContext);
}
