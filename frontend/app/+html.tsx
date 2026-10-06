import { ScrollViewStyleReset } from 'expo-router/html';
import { COLOR } from '../theme/tokens';

// Fond de l'espace d'administration (hors design system, écran interne)
const ADMIN_BG = 'black';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          /* SKILKI : fond nuit pétrole opaque. Les écrans peignent leur propre fond
             (plus de transparence forcée : elle laissait voir l'écran du dessous). */
          html, body {
            margin: 0;
            padding: 0;
            background: ${COLOR.bg.primary} !important;
          }
          /* Aperçu web : pas de contour de focus du navigateur dans les champs (comme sur mobile) ;
             le champ actif reste signalé par le curseur jaune. */
          input, textarea { outline: none; }
          [data-testid="admin-bg"], [data-testid="admin-bg"] > div {
            background-color: ${ADMIN_BG} !important;
          }
          #admin-bg,
          #root #admin-bg,
          div#admin-bg {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            z-index: 9999 !important;
            background: ${ADMIN_BG} !important;
            background-color: ${ADMIN_BG} !important;
          }
          #admin-bg > div,
          #root #admin-bg > div {
            background-color: ${ADMIN_BG} !important;
          }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
