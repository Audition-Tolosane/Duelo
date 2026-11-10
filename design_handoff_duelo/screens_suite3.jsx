// ============================================================================
// DUELO — SUITE LOT 3 : Réglages
// Notification-settings, Language-settings, Support, Terms
// ============================================================================
const TS3 = () => window.DUELO_TOKENS;
function FrameS3({ children }) {
  return <div style={{ position: 'absolute', inset: 0, color: '#fff' }}>{children}</div>;
}

// Toggle switch
function Toggle({ on }) {
  const t = TS3();
  return (
    <div style={{ width: 44, height: 26, borderRadius: 13, background: on ? `linear-gradient(135deg, ${t.cyan}, ${t.violet})` : 'rgba(255,255,255,0.12)', padding: 3, display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'all 0.2s', flexShrink: 0 }}>
      <div style={{ width: 20, height: 20, borderRadius: 10, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}/>
    </div>
  );
}

function SettingsHead({ title, sub }) {
  const t = TS3();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M15 6l-6 6 6 6"/></svg>
      <div>
        {sub && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 2, textTransform: 'uppercase' }}>{sub}</div>}
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 24, letterSpacing: -0.8 }}>{title}</div>
      </div>
    </div>
  );
}

// 14 · NOTIFICATION-SETTINGS
function S_NotifSettings() {
  const t = TS3();
  const groups = [
    { title: 'Duels', items: [
      { l: 'Nouveau défi reçu', d: 'Quand un joueur te défie', on: true },
      { l: 'À ton tour de jouer', d: 'Rappel sur un duel en cours', on: true },
      { l: 'Résultat de duel', d: 'Quand ton adversaire a fini', on: true },
    ]},
    { title: 'Social', items: [
      { l: 'Nouveau message', d: 'Messages privés', on: true },
      { l: 'Nouvel abonné', d: 'Quelqu\'un te suit', on: false },
    ]},
    { title: 'Progression', items: [
      { l: 'Rappel de streak', d: 'Pour ne pas perdre ta série 🔥', on: true },
      { l: 'Tournois', d: 'Début et fin de tournoi', on: true },
      { l: 'Récompenses quotidiennes', d: 'Cadeau disponible', on: false },
    ]},
  ];
  return (
    <FrameS3>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <Stars count={10} opacity={0.25}/>
      <div style={{ position: 'absolute', inset: 0, padding: '56px 16px 24px', overflowY: 'auto' }}>
        <SettingsHead title="Notifications" sub="◆ Réglages"/>
        {groups.map((g, gi) => (
          <div key={gi} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.cyan, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>{g.title}</div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              {g.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderBottom: i < g.items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14 }}>{it.l}</div>
                    <div style={{ fontFamily: 'Inter', fontSize: 11, color: t.dim3, marginTop: 1 }}>{it.d}</div>
                  </div>
                  <Toggle on={it.on}/>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </FrameS3>
  );
}

// 15 · LANGUAGE-SETTINGS
function S_LanguageSettings() {
  const t = TS3();
  const [sel, setSel] = React.useState('fr');
  const langs = [
    { id: 'fr', flag: '🇫🇷', n: 'Français', native: 'Français' },
    { id: 'en', flag: '🇬🇧', n: 'Anglais', native: 'English' },
    { id: 'es', flag: '🇪🇸', n: 'Espagnol', native: 'Español' },
    { id: 'de', flag: '🇩🇪', n: 'Allemand', native: 'Deutsch' },
    { id: 'it', flag: '🇮🇹', n: 'Italien', native: 'Italiano' },
    { id: 'pt', flag: '🇵🇹', n: 'Portugais', native: 'Português' },
  ];
  return (
    <FrameS3>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <Stars count={10} opacity={0.25}/>
      <div style={{ position: 'absolute', inset: 0, padding: '56px 16px 24px', overflowY: 'auto' }}>
        <SettingsHead title="Langue" sub="◆ Réglages"/>
        <div style={{ fontFamily: 'Inter', fontSize: 13, color: t.dim2, marginBottom: 18, lineHeight: 1.45 }}>Choisis la langue de l'app et des questions.</div>
        {langs.map(lg => (
          <div key={lg.id} onClick={() => setSel(lg.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, marginBottom: 8, borderRadius: 14, background: sel === lg.id ? `${t.cyan}12` : 'rgba(255,255,255,0.03)', border: `${sel === lg.id ? '2' : '1'}px solid ${sel === lg.id ? t.cyan : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer' }}>
            <div style={{ fontSize: 28 }}>{lg.flag}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15 }}>{lg.native}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.dim3, letterSpacing: 0.5 }}>{lg.n}</div>
            </div>
            {sel === lg.id && (
              <div style={{ width: 26, height: 26, borderRadius: 13, background: `linear-gradient(135deg, ${t.cyan}, ${t.violet})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </FrameS3>
  );
}

// 16 · SUPPORT
function S_Support() {
  const t = TS3();
  const faqs = [
    { q: 'Comment fonctionne le matchmaking ?', i: '⚔' },
    { q: 'Comment gagner des pièces ?', i: '🪙' },
    { q: 'Que sont les streaks et les XP ?', i: '🔥' },
    { q: 'Comment créer mon propre thème ?', i: '✦' },
    { q: 'Signaler une question erronée', i: '⚑' },
  ];
  return (
    <FrameS3>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, background: `linear-gradient(180deg, ${t.cyan}20, transparent)` }}/>
      <Stars count={12} opacity={0.3}/>
      <div style={{ position: 'absolute', inset: 0, padding: '56px 16px 24px', overflowY: 'auto' }}>
        <SettingsHead title="Aide & support" sub="◆ On est là"/>
        {/* Contact card */}
        <div style={{ padding: 18, borderRadius: 18, marginBottom: 20, background: `linear-gradient(135deg, ${t.cyan}25, ${t.violet}20)`, border: `1px solid ${t.cyan}40`, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>💬</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15 }}>Contacter l'équipe</div>
            <div style={{ fontFamily: 'Inter', fontSize: 11, color: t.dim2 }}>Réponse sous 24h en moyenne</div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M9 6l6 6-6 6"/></svg>
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Questions fréquentes</div>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          {faqs.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderBottom: i < faqs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{f.i}</div>
              <div style={{ flex: 1, fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14 }}>{f.q}</div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.dim3} strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.dim3, letterSpacing: 1 }}>Duelo v2.4.1 · build 1840</div>
      </div>
    </FrameS3>
  );
}

// 17 · TERMS
function S_Terms() {
  const t = TS3();
  const sections = [
    { n: '01', title: 'Conditions d\'utilisation', body: 'En utilisant Duelo, tu acceptes de jouer de manière loyale et de respecter les autres joueurs dans les duels et les messages.' },
    { n: '02', title: 'Compte & données', body: 'Tes données de jeu (XP, scores, historique) sont stockées de façon sécurisée. Tu peux demander leur suppression à tout moment.' },
    { n: '03', title: 'Achats & pièces', body: 'Les pièces achetées n\'ont aucune valeur monétaire réelle et ne sont pas remboursables, sauf obligation légale.' },
    { n: '04', title: 'Contenu communautaire', body: 'Les thèmes créés par les joueurs sont modérés. Tout contenu offensant peut être retiré sans préavis.' },
  ];
  return (
    <FrameS3>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <Stars count={10} opacity={0.2}/>
      <div style={{ position: 'absolute', inset: 0, padding: '56px 16px 24px', overflowY: 'auto' }}>
        <SettingsHead title="Conditions" sub="◆ Légal"/>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.dim3, letterSpacing: 1, marginBottom: 20 }}>Dernière mise à jour · janvier 2026</div>
        {sections.map((s, i) => (
          <div key={i} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: i < sections.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 16, color: t.cyan }}>{s.n}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>{s.title}</div>
            </div>
            <div style={{ fontFamily: 'Inter', fontSize: 13, color: t.dim2, lineHeight: 1.55, paddingLeft: 26 }}>{s.body}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10, fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, color: t.cyan }}>
          <span>Confidentialité</span>
          <span style={{ color: t.dim3 }}>·</span>
          <span>Mentions légales</span>
        </div>
      </div>
    </FrameS3>
  );
}

Object.assign(window, { S_NotifSettings, S_LanguageSettings, S_Support, S_Terms, Toggle });
