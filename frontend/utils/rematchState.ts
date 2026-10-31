// Adversaire dont l'écran de résultats est affiché. L'écran gère alors lui-même la
// proposition de revanche (même fenêtre, ouverte une fois les récompenses fermées) : la
// pop-up globale RematchModal s'efface, car iOS n'empile pas deux fenêtres.
let resultsOpponentId: string | null = null;

export function setResultsOpponent(id: string | null) {
  resultsOpponentId = id;
}

export function getResultsOpponent(): string | null {
  return resultsOpponentId;
}
