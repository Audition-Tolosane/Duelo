# Prompt pour Claude Code — intégration du redesign « Neon » de la console admin

> Copie-colle tout ce qui suit dans Claude Code, à la racine du repo `frontend`.
> Place d'abord les 2 fichiers du kit aux emplacements indiqués (voir §0).

---

## 0. Fichiers fournis (à copier avant de lancer)

J'ai préparé un design layer Neon. Copie ces 2 fichiers dans le repo :

- `theme/adminTheme.ts`          ← tokens Neon + helper `glow()` + dégradés
- `components/admin/AdminUI.tsx`  ← composants présentationnels

(Ils réutilisent `theme/tokens.ts` et `theme/fonts.ts` existants — ne pas dupliquer les tokens.)

---

## 1. Contexte

`app/admin.tsx` est une console admin React Native / Expo (5 onglets : Questions, Thèmes,
Stats, Signalements, Avatars). Sa **logique fonctionne et ne doit PAS changer** : auth
(`adminFetch`, header `X-Admin-Key`), parsing CSV (`Papa`), tous les `loadXxx`/`doImport`/
`updateReport`, upload avatars, et **tous les `useState`**. On refait uniquement la **couche
présentation** avec le skin Neon (fond `#04040C`, bordures cyan/violet lumineuses, glow,
grille de fond, barres d'accent en dégradé).

## 2. Objectif

1. Rendre l'écran **responsive** : sidebar verticale en desktop (largeur ≥ 900px), tab-bar
   horizontale conservée en mobile. Le composant `AdminShell` gère déjà les deux cas.
2. Appliquer le skin Neon à tous les onglets via les composants de `components/admin/AdminUI.tsx` :
   `AdminShell, TopBar, AdminCard, SectionHead, NeonButton, StatCard, BarRow, ReportCard,
   NeonGrid, useWide`.

## 3. Contraintes STRICTES

- **Ne touche à aucune fonction de données** (`loadThemesOverview`, `loadMatchStats`,
  `loadReports`, `parseCSV`, `doImport`, `pickCSVFile`, `uploadThemesCSV`, `fetchAvatars`,
  `updateReport`, `handleLogin`, etc.) ni à aucun `useState`.
- Garde `MaterialCommunityIcons` et `expo-linear-gradient` (déjà utilisés).
- Conserve le fallback mobile : sur téléphone, l'UX doit rester équivalente à l'actuelle.
- Aucune nouvelle dépendance npm.
- Le switcher « 3 skins » de la maquette HTML ne va PAS en prod : Neon est figé.
- Migration **onglet par onglet** : le repo doit compiler et l'admin rester utilisable après
  chaque étape (un onglet non encore porté doit s'afficher tel quel dans le nouveau shell).

## 4. Étapes

**Étape A — Layout racine.** Dans le `return` principal (après authentification), remplace le
conteneur + tab-bar actuels par :

```tsx
return (
  <View style={{ flex: 1, backgroundColor: NEON.bg }}>
    <NeonGrid />
    <AdminShell
      tabs={TABS}
      tabIcons={TAB_ICONS}
      active={activeTab}
      onTab={setActiveTab}
      badges={{ Signalements: reportCounts.pending }}
      onLogout={() => setIsAuthenticated(false)}
    >
      <TopBar title={TABS[activeTab]} subtitle={SUBTITLES[activeTab]} />
      <ScrollView
        contentContainerStyle={{ padding: 28, maxWidth: 1080, alignSelf: 'center', width: '100%' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B366FF" />}
      >
        {activeTab === 0 && renderQuestionsTab()}
        {activeTab === 1 && renderThemesTab()}
        {activeTab === 2 && renderStatsTab()}
        {activeTab === 3 && renderReportsTab()}
        {activeTab === 4 && renderAvatarsTab()}
      </ScrollView>
    </AdminShell>
  </View>
);
```

Ajoute près de `TABS` :
```tsx
const SUBTITLES = [
  'Importer et vérifier les questions',
  'Super-catégories, clusters et thèmes',
  'Popularité des thèmes et volume de parties',
  'Modérer les questions signalées',
  'Gérer les avatars disponibles',
];
```
Et les imports :
```tsx
import {
  AdminShell, TopBar, AdminCard, SectionHead, NeonButton,
  StatCard, BarRow, ReportCard, NeonGrid, useWide,
} from '../components/admin/AdminUI';
import { NEON } from '../theme/adminTheme';
```

**Étape B — Onglet Stats** (`renderStatsTab`). Remplace la carte + les barres faites main par
`AdminCard` + `StatCard` (bandeau total) + `BarRow` par thème. `pct` = part relative au 1er du
classement (`match_count / matchStats[0].match_count * 100`) ; `sub` = `theme_id · X% des parties`
(part sur `totalMatches`) ; `top` = `i < 3`.

**Étape C — Onglet Signalements** (`renderReportsTab`). Garde le bloc filtres + `reportCounts`
(en `StatCard`). Pour chaque report, utilise `ReportCard` avec `meta` = joueur / thème / raison
(`REASON_LABELS`), `desc` = `r.description`, et `actions` = `NeonButton` « Examiné » / « Résolu »
qui appellent tes handlers existants.

**Étape D — Onglets Questions, Thèmes, Avatars.** Enveloppe les sections dans `AdminCard` +
`SectionHead`, remplace les boutons par `NeonButton` (variantes : `primary` cyan→violet,
`accent` mint, `warn` fire, `danger` rouge, `ghost`). Pour Thèmes, garde ta logique d'accordéon
(`expandedSC`, `expandedCluster`, `selectedThemes`) — seul le style des lignes change.

**Étape E — Nettoyage.** Supprime les entrées de `styles` devenues inutilisées au fur et à
mesure. Vérifie `npx expo start --web` en grande fenêtre (sidebar) puis en fenêtre étroite / sur
device (tab-bar). L'onglet Questions doit importer un CSV comme avant.

## 5. Critère de réussite

- Desktop : sidebar Duelo à gauche, fond quadrillé néon, cartes à liseré dégradé cyan→violet,
  barres de stats lumineuses, badge rouge sur « Signalements ».
- Mobile : tab-bar en bas/haut comme aujourd'hui, tout reste fonctionnel.
- Aucun changement de comportement réseau/données ; aucune régression sur l'import CSV.
```
