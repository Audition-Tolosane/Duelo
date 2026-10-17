// Adversaire dont l'écran de résultats est affiché. L'écran gère alors lui-même la
// proposition de revanche (bouton « Accepter ») : la pop-up globale RematchModal s'efface,
// car elle ne peut pas s'afficher par-dessus une autre fenêtre (récompenses) sur iOS.
let resultsOpponentId: string | null = null;

export function setResultsOpponent(id: string | null) {
  resultsOpponentId = id;
}

export function getResultsOpponent(): string | null {
  return resultsOpponentId;
}
