// Code de la dernière pub récompensée (donné par le serveur avant la pub, confirmé par Google).
// authFetch l'envoie (en-tête X-Ad-Token) pendant quelques minutes : la route qui donne la
// récompense le vérifie. Module à part pour éviter un import circulaire api.ts <-> ads.ts.
const TTL_MS = 3 * 60 * 1000;
let token: string | null = null;
let at = 0;

export function setAdToken(t: string | null) {
  token = t;
  at = Date.now();
}

export function currentAdToken(): string | null {
  return token && Date.now() - at < TTL_MS ? token : null;
}
