#!/usr/bin/env node
/**
 * Garde-fou du design system SKILKI — migration progressive (« cliquet »).
 *
 *   npm run design:check      → échoue si un fichier AJOUTE de la dette (par rapport à la référence)
 *   npm run design:baseline   → enregistre l'état actuel comme nouvelle référence (après une migration)
 *
 * Mesures par fichier (app/, components/, hors components/ui et admin) :
 *   hex       couleurs #rrggbb codées en dur        rgba      rgba(...) codés en dur
 *   fontSize  tailles de police numériques           heavy     fontWeight '800' / '900' (faux gras)
 *   gradient  <LinearGradient> hors design system    iconLib   imports d'autres familles d'icônes
 *   emoji     emoji dans le code (icônes d'interface)
 *   legacy    jetons de l'ancien système Duelo (COLORS., TYPE., RADIUS., SPACING. — cyan / violet…)
 *
 * Règle stricte (0 toléré) : components/ui/** et tout NOUVEAU fichier d'écran.
 * Un fichier existant peut descendre, jamais monter.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = path.join(ROOT, 'scripts', 'design-baseline.json');
const DIRS = ['app', 'components'];
const SKIP = [/^components[\\/]admin/, /^app[\\/]admin\.tsx$/, /^components[\\/]ui[\\/]/];
const STRICT = [/^components[\\/]ui[\\/]/];

const RULES = {
  hex: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g,
  rgba: /rgba?\(/g,
  fontSize: /fontSize\s*:\s*\d/g,
  heavy: /fontWeight\s*:\s*['"](800|900)['"]/g,
  gradient: /<LinearGradient\b/g,
  iconLib: /from\s+['"]@expo\/vector-icons['"]|from\s+['"]react-native-vector-icons/g,
  emoji: /\p{Extended_Pictographic}/gu,
  legacy: /(?<![\w.])(COLORS|TYPE|RADIUS|SPACING|CATEGORY_COLORS)\.\w/g,
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function measure(file) {
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  const res = {};
  for (const [k, re] of Object.entries(RULES)) {
    const n = (src.match(re) || []).length;
    if (n) res[k] = n;
  }
  return res;
}

const files = DIRS.flatMap((d) => walk(path.join(ROOT, d))).map((f) => path.relative(ROOT, f));
const current = {};
const strictViolations = [];
for (const rel of files) {
  const m = measure(path.join(ROOT, rel));
  if (STRICT.some((r) => r.test(rel))) {
    const bad = Object.entries(m).filter(([k]) => k !== 'rgba' && k !== 'gradient');
    if (bad.length) strictViolations.push(`${rel}: ${bad.map(([k, v]) => `${k}=${v}`).join(', ')}`);
    continue;
  }
  if (SKIP.some((r) => r.test(rel))) continue;
  if (Object.keys(m).length) current[rel.replace(/\\/g, '/')] = m;
}

const totals = {};
for (const m of Object.values(current)) for (const [k, v] of Object.entries(m)) totals[k] = (totals[k] || 0) + v;

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, JSON.stringify({ totals, files: current }, null, 1) + '\n');
  console.log('Référence enregistrée :', totals);
  process.exit(0);
}

if (!fs.existsSync(BASELINE)) {
  console.error('Pas de référence : lancer `npm run design:baseline`.');
  process.exit(1);
}
const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const regressions = [];
for (const [file, m] of Object.entries(current)) {
  const b = base.files[file];
  for (const [k, v] of Object.entries(m)) {
    const before = b ? b[k] || 0 : 0;
    if (v > before) regressions.push(`${file}: ${k} ${before} → ${v}${b ? '' : ' (nouveau fichier : utiliser components/ui + theme/tokens)'}`);
  }
}

console.log('Dette design restante :', totals);
const delta = Object.fromEntries(Object.keys({ ...totals, ...base.totals }).map((k) => [k, (totals[k] || 0) - (base.totals[k] || 0)]));
console.log('Évolution depuis la référence :', delta);

if (strictViolations.length || regressions.length) {
  if (strictViolations.length) console.error('\n✗ Kit components/ui (zéro toléré) :\n  ' + strictViolations.join('\n  '));
  if (regressions.length) console.error('\n✗ Dette ajoutée :\n  ' + regressions.join('\n  '));
  console.error('\nUtiliser COLOR / TYPO / GRADIENTS (theme/tokens.ts), <Txt>, <Icon> (Lucide) et les composants components/ui.');
  process.exit(1);
}
console.log('✓ Aucune dette design ajoutée.');
