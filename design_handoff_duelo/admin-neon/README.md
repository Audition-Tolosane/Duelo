# Intégration du redesign Neon dans `admin.tsx`

Le dossier `admin/` (maquette HTML) était la **référence visuelle**. Voici comment porter le
skin **Neon** dans l'app React Native **sans toucher à ta logique** (auth, parsing CSV, fetch,
upload avatars, états). On remplace uniquement la couche présentation.

## 1. Copier les 2 fichiers

```
design_handoff_duelo/admin-neon/theme/adminTheme.ts   →  frontend/theme/adminTheme.ts
design_handoff_duelo/admin-neon/components/AdminUI.tsx →  frontend/components/admin/AdminUI.tsx
```

Ils réutilisent tes `COLORS` / `FONTS` / `RADIUS` existants — aucun doublon de tokens.

## 2. Importer dans `admin.tsx`

```tsx
import {
  AdminShell, TopBar, AdminCard, SectionHead, NeonButton,
  StatCard, BarRow, ReportCard, NeonGrid, useWide,
} from '../components/admin/AdminUI';
import { NEON } from '../theme/adminTheme';
```

## 3. Remplacer le layout racine (responsive desktop)

Aujourd'hui tu as une tab-bar horizontale. `AdminShell` gère les deux : **sidebar verticale
en desktop** (`largeur ≥ 900`), tab-bar en mobile — automatiquement.

```tsx
// return principal de AdminScreen (une fois authentifié)
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
      <TopBar
        title={TABS[activeTab]}
        subtitle={SUBTITLES[activeTab]}
      />
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

Ajoute la constante des sous-titres près de `TABS` :

```tsx
const SUBTITLES = [
  'Importer et vérifier les questions',
  'Super-catégories, clusters et thèmes',
  'Popularité des thèmes et volume de parties',
  'Modérer les questions signalées',
  'Gérer les avatars disponibles',
];
```

## 4. Réécrire chaque `renderXxxTab()` avec les briques Neon

Ta **donnée et tes handlers ne changent pas** — tu remplaces juste le JSX. Exemple complet
avec l'onglet Stats (avant → après) :

### Avant (extrait actuel)
```tsx
<View style={styles.card}>
  <SectionHeader icon="chart-bar" title="Parties par theme" />
  ...
  {matchStats.map((stat, i) => { /* barres à la main */ })}
</View>
```

### Après (Neon)
```tsx
const renderStatsTab = () => (
  <AdminCard>
    <SectionHead icon="chart-bar" title="Parties par thème" desc="Classement par popularité" />
    {loadingMatchStats ? (
      <ActivityIndicator color="#B366FF" style={{ marginVertical: 12 }} />
    ) : (
      <>
        {/* bandeau total */}
        <StatCard num={totalMatches.toLocaleString('fr-FR')} label="Total des parties" icon="gamepad-variant-outline" color={NEON.cyan} />
        {matchStats.map((stat, i) => {
          const pct = totalMatches > 0 ? (stat.match_count / matchStats[0].match_count * 100) : 0;
          const share = totalMatches > 0 ? (stat.match_count / totalMatches * 100) : 0;
          return (
            <BarRow
              key={stat.theme_id}
              rank={i + 1}
              name={stat.theme_name}
              count={stat.match_count.toLocaleString('fr-FR')}
              pct={pct}
              sub={`${stat.theme_id} · ${share.toFixed(1)}% des parties`}
              top={i < 3}
            />
          );
        })}
      </>
    )}
  </AdminCard>
);
```

### Signalements (mapping direct)
```tsx
{reports.map((r) => (
  <ReportCard
    key={r.id}
    status={r.status as any}
    date={new Date(r.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
    question={r.question_text}
    meta={[
      { icon: 'account-outline', label: 'Joueur', value: r.user_pseudo },
      { icon: 'palette-outline',  label: 'Thème',  value: r.category },
      { icon: 'flag-outline',     label: 'Raison', value: REASON_LABELS[r.reason_type] || r.reason_type },
    ]}
    desc={r.description || undefined}
    actions={
      <>
        {r.status !== 'reviewed' && <NeonButton variant="ghost" icon="eye-outline" label="Examiné" onPress={() => updateReport(r.id, 'reviewed')} />}
        {r.status !== 'resolved' && <NeonButton variant="accent" icon="check" label="Résolu" onPress={() => updateReport(r.id, 'resolved')} />}
      </>
    }
  />
))}
```

### Boutons
Partout où tu avais un `TouchableOpacity` stylé, utilise `NeonButton` :
```tsx
<NeonButton variant="accent" icon="upload" label={`Importer ${parsedRows.length} questions`} block onPress={handleImport} />
<NeonButton variant="warn"   icon="upload" label="Uploader CSV thèmes" onPress={pickThemesCSV} />
```

Variantes : `primary` (cyan→violet, glow), `accent` (mint), `warn` (fire), `danger` (rouge), `ghost`.

## 5. Nettoyer

- Le **switcher 3-skins** de la maquette ne va pas en prod : Neon est figé, rien à ajouter.
- Tu peux supprimer au fur et à mesure les entrées de `styles` remplacées par les composants
  (`matchStatRow`, `reportCard`, etc.), mais garde-les tant que tous les onglets ne sont pas portés.
- Sur mobile, `AdminShell` retombe sur la tab-bar : ton usage téléphone reste identique.

## Ordre conseillé
1. Copier les 2 fichiers.
2. Remplacer le layout racine (§3) → tu vois déjà la sidebar + le fond néon.
3. Porter les onglets un par un (Stats et Signalements sont les plus rapides).
4. Tester `npx expo start --web` en large fenêtre, puis en mobile.

Les composants sont autonomes et typés : si un onglet n'est pas encore porté, il s'affiche
tel quel dans le nouveau shell — tu migres sans jamais casser l'admin.
