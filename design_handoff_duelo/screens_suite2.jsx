// ============================================================================
// DUELO — SUITE LOT 2 : Jeu / Contenu
// Challenge-waiting, Tournament, Play (onglet), Super-catégorie,
// Category-detail, Create-theme (interactif)
// ============================================================================
const TS2 = () => window.DUELO_TOKENS;
function FrameS2({ children }) {
  return <div style={{ position: 'absolute', inset: 0, color: '#fff' }}>{children}</div>;
}

// 08 · CHALLENGE-WAITING (défi envoyé, en attente)
function S_ChallengeWaiting() {
  const t = TS2();
  return (
    <FrameS2>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${t.violet}30, ${t.abyss} 50%)` }}/>
      <Stars count={20} opacity={0.5}/>
      <div style={{ position: 'absolute', inset: 0, padding: '60px 28px 40px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.gold, letterSpacing: 3, fontWeight: 700, textTransform: 'uppercase' }}>◆ Défi envoyé</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 26, letterSpacing: -0.8, marginTop: 8, textTransform: 'uppercase' }}>En attente…</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
          {/* duel avatars */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <Avatar size={70} color={t.cyan} letter="L"/>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12, color: t.cyan, marginTop: 8 }}>TOI</div>
            </div>
            <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 32, fontWeight: 500, color: t.gold }}>VS</div>
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <Avatar size={70} color="#B366FF" letter="M"/>
                {[0,1].map(i => (
                  <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${t.violet}`, animation: `pingRing ${2.5 + i * 0.5}s ease-out infinite ${i * 0.5}s` }}/>
                ))}
              </div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12, color: t.violet, marginTop: 8 }}>MAYA</div>
            </div>
          </div>
          {/* theme chip */}
          <div style={{ padding: '10px 18px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: `1px solid ${t.cyan}30`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#00E5FF25', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🌍</div>
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13 }}>Géographie</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: t.dim3, letterSpacing: 1 }}>7 QUESTIONS</div>
            </div>
          </div>
          {/* countdown ring */}
          <div style={{ position: 'relative', width: 96, height: 96 }}>
            <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="48" cy="48" r="42" stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="none"/>
              <circle cx="48" cy="48" r="42" stroke={t.gold} strokeWidth="4" fill="none" strokeDasharray={2 * Math.PI * 42} strokeDashoffset={2 * Math.PI * 42 * 0.4} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${t.gold})` }}/>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 30, color: t.gold }}>9</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: t.dim3, letterSpacing: 1 }}>SEC</div>
            </div>
          </div>
          <div style={{ fontFamily: 'Inter', fontSize: 13, color: t.dim2, textAlign: 'center', maxWidth: 240, lineHeight: 1.5 }}>
            Maya a 15s pour accepter ton défi. On te prévient dès qu'elle répond.
          </div>
        </div>
        <div style={{ padding: '14px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', textAlign: 'center', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: t.dim2, border: '1px solid rgba(255,255,255,0.08)' }}>Annuler le défi</div>
      </div>
    </FrameS2>
  );
}

// 09 · TOURNAMENT
function S_Tournament() {
  const t = TS2();
  const entries = [
    { rank: 1, n: 'StellarKing', c: '#FFB547', l: 'S', score: 2840, games: 12 },
    { rank: 2, n: 'Maya_99', c: '#B366FF', l: 'M', score: 2710, games: 11 },
    { rank: 3, n: 'NovaPlay', c: '#32E7A3', l: 'N', score: 2590, games: 12 },
    { rank: 7, n: 'Toi', c: '#00E5FF', l: 'L', score: 1980, games: 8, isYou: true },
  ];
  return (
    <FrameS2>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320, background: `linear-gradient(180deg, ${t.gold}40, ${t.fire}15 50%, transparent)` }}/>
      <Stars count={20} opacity={0.5}/>
      <div style={{ position: 'absolute', inset: 0, padding: '50px 16px 20px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.gold, letterSpacing: 2, fontWeight: 700 }}>◆ TOURNOI HEBDO</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 24, letterSpacing: -0.8 }}>Coupe Cinéma</div>
          </div>
        </div>
        {/* Hero trophy + countdown */}
        <div style={{ padding: 18, borderRadius: 20, marginBottom: 14, background: `linear-gradient(135deg, ${t.gold}40, ${t.fire}25)`, border: `1px solid ${t.gold}60`, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -10, right: 10, fontSize: 80, opacity: 0.2 }}>🏆</div>
          <div style={{ fontSize: 44 }}>🏆</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 20, marginTop: 4 }}>5 000 pièces à gagner</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10 }}>
            {[['12', 'H'], ['34', 'M'], ['08', 'S']].map(([v, u]) => (
              <div key={u} style={{ padding: '6px 10px', borderRadius: 10, background: 'rgba(0,0,0,0.4)' }}>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 18, color: t.gold }}>{v}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: t.dim3 }}>{u}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Your progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[{ l: 'TON RANG', v: '#7', c: t.cyan }, { l: 'SCORE', v: '1980', c: t.gold }, { l: 'PARTIES', v: '8/12', c: t.mint }].map(s => (
            <div key={s.l} style={{ flex: 1, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${s.c}25`, textAlign: 'center' }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 18, color: s.c }}>{s.v}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: t.dim3, letterSpacing: 1, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: t.dim2, marginBottom: 10 }}>Classement</div>
        {entries.map(e => (
          <div key={e.rank} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 6, borderRadius: 12, background: e.isYou ? `linear-gradient(90deg, ${t.cyan}25, ${t.cyan}05)` : 'rgba(255,255,255,0.04)', border: `${e.isYou ? '2' : '1'}px solid ${e.isYou ? t.cyan : 'rgba(255,255,255,0.05)'}` }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: e.rank <= 3 ? (e.rank === 1 ? t.gold : e.rank === 2 ? '#C0C0C0' : '#CD7F32') : 'rgba(255,255,255,0.06)', color: e.rank <= 3 ? '#000' : t.dim2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 12 }}>{e.rank}</div>
            <Avatar size={36} color={e.c} letter={e.l}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14 }}>{e.n} {e.isYou && '·TOI'}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3 }}>{e.games} parties</div>
            </div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 15, color: t.gold }}>{e.score.toLocaleString()}</div>
          </div>
        ))}
        <div style={{ marginTop: 14 }}><PrimaryBtn variant="B">⚔ Jouer une partie</PrimaryBtn></div>
      </div>
    </FrameS2>
  );
}

// 10 · PLAY (onglet — modes de jeu)
function S_Play() {
  const t = TS2();
  return (
    <FrameS2>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280, background: `linear-gradient(180deg, ${t.cyan}25, ${t.violet}15 60%, transparent)` }}/>
      <Stars count={18} opacity={0.45}/>
      <div style={{ position: 'absolute', inset: 0, padding: '56px 16px 100px', overflowY: 'auto' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.cyan, letterSpacing: 2.5, fontWeight: 700, textTransform: 'uppercase' }}>◆ Modes de jeu</div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 32, letterSpacing: -1.2, marginTop: 4, marginBottom: 18, textTransform: 'uppercase' }}>Comment veux-tu<br/>dueler ?</div>
        {/* Quick match — big */}
        <div style={{ padding: 22, borderRadius: 22, marginBottom: 12, background: `linear-gradient(135deg, ${t.cyan}, ${t.violet})`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -10, opacity: 0.2 }}><SwordMark size={130} color="#fff"/></div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#000', letterSpacing: 2, fontWeight: 700, opacity: 0.7 }}>◆ RAPIDE · ~8s</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 32, color: '#000', letterSpacing: -1, lineHeight: 1, marginTop: 4 }}>QUICK MATCH</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, color: '#000', opacity: 0.65, marginTop: 4 }}>Un adversaire de ton niveau, aléatoire</div>
          <div style={{ display: 'inline-block', marginTop: 12, padding: '10px 16px', borderRadius: 12, background: '#000', color: '#fff', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13 }}>Jouer →</div>
        </div>
        {/* Other modes */}
        {[
          { n: 'Défier un ami', d: 'Choisis ton adversaire et le thème', i: '⚔', c: t.violet },
          { n: 'Tournoi', d: 'Coupe Cinéma · 5 000 pièces · 12h restantes', i: '🏆', c: t.gold, badge: 'LIVE' },
          { n: 'Entraînement', d: 'Solo, sans enjeu, pour réviser', i: '🎯', c: t.mint },
        ].map((m, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, marginBottom: 8, borderRadius: 16, background: `${m.c}12`, border: `1px solid ${m.c}35` }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: `${m.c}25`, border: `1px solid ${m.c}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{m.i}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16 }}>{m.n}</div>
                {m.badge && <div style={{ padding: '2px 7px', borderRadius: 6, background: t.fire, fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 8, letterSpacing: 1, color: '#fff' }}>{m.badge}</div>}
              </div>
              <div style={{ fontFamily: 'Inter', fontSize: 11, color: t.dim2, marginTop: 2 }}>{m.d}</div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={m.c} strokeWidth="2.5"><path d="M9 6l6 6-6 6"/></svg>
          </div>
        ))}
      </div>
      <NavBar active="play" variant="B"/>
    </FrameS2>
  );
}

// 11 · SUPER-CATEGORY (univers avec carousel de thèmes)
function S_SuperCategory() {
  const t = TS2();
  const themes = [
    { n: 'Cinéma 90s', lv: 18, prog: 92 },
    { n: 'Blockbusters', lv: 12, prog: 64 },
    { n: 'Films cultes', lv: 8, prog: 40 },
    { n: 'Réalisateurs', lv: 5, prog: 22 },
  ];
  return (
    <FrameS2>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 260, background: `linear-gradient(180deg, #B366FF50, transparent)` }}/>
      <Stars count={16} opacity={0.4}/>
      <div style={{ position: 'absolute', inset: 0, padding: '50px 16px 100px', overflowY: 'auto' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}><path d="M15 6l-6 6 6 6"/></svg>
        {/* Hero */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: `linear-gradient(135deg, #B366FF, #00E5FF)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, boxShadow: `0 8px 24px #B366FF50` }}>🎬</div>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#B366FF', letterSpacing: 2, fontWeight: 700 }}>◆ UNIVERS</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 30, letterSpacing: -1, textTransform: 'uppercase' }}>Cinéma</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.dim3, letterSpacing: 0.5 }}>12 thèmes · 91 joueurs en live</div>
          </div>
        </div>
        {/* Progress global */}
        <div style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12, marginBottom: 6 }}>
            <span>Maîtrise de l'univers</span><span style={{ color: '#B366FF' }}>Niveau 14</span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: '68%', height: '100%', background: `linear-gradient(90deg, #B366FF, #00E5FF)`, boxShadow: `0 0 8px #B366FF` }}/>
          </div>
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: t.dim2, marginBottom: 10 }}>Thèmes · 12</div>
        {themes.map((th, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, marginBottom: 8, borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ position: 'relative', width: 46, height: 46 }}>
              <svg width="46" height="46" viewBox="0 0 46 46" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="23" cy="23" r="20" stroke="rgba(255,255,255,0.1)" strokeWidth="3" fill="none"/>
                <circle cx="23" cy="23" r="20" stroke="#B366FF" strokeWidth="3" fill="none" strokeDasharray={2 * Math.PI * 20} strokeDashoffset={2 * Math.PI * 20 * (1 - th.prog / 100)} strokeLinecap="round"/>
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 12 }}>{th.lv}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15 }}>{th.n}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 1 }}>NIVEAU {th.lv} · {th.prog}%</div>
            </div>
            <div style={{ padding: '8px 14px', borderRadius: 12, background: `linear-gradient(135deg, #B366FF, #00E5FF)`, color: '#000', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12 }}>Jouer</div>
          </div>
        ))}
      </div>
    </FrameS2>
  );
}

// 12 · CATEGORY-DETAIL (détail d'un thème)
function S_CategoryDetail() {
  const t = TS2();
  return (
    <FrameS2>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300, background: `linear-gradient(180deg, #00E5FF45, transparent)` }}/>
      <Stars count={16} opacity={0.4}/>
      <div style={{ position: 'absolute', inset: 0, padding: '50px 16px 24px', overflowY: 'auto' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 18 }}><path d="M15 6l-6 6 6 6"/></svg>
        {/* Hero card */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 88, height: 88, borderRadius: 24, background: `linear-gradient(135deg, #00E5FF, #0090B2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, margin: '0 auto', boxShadow: `0 12px 32px #00E5FF50` }}>🌍</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 28, letterSpacing: -0.8, marginTop: 12, textTransform: 'uppercase' }}>Géographie</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.dim3, letterSpacing: 1, marginTop: 2 }}>540 questions · 62 duels joués</div>
        </div>
        {/* Level card */}
        <div style={{ padding: 16, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: `1px solid ${t.cyan}30`, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.cyan, letterSpacing: 1.5 }}>TON NIVEAU</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22 }}>Niveau 11 · Globe-trotter</div>
            </div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 28, color: t.cyan }}>78%</div>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: '78%', height: '100%', background: `linear-gradient(90deg, ${t.cyan}, ${t.violet})` }}/>
          </div>
        </div>
        {/* Stats row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {[{ l: 'JOUÉS', v: '62' }, { l: 'GAGNÉS', v: '48', c: t.mint }, { l: 'PRÉCISION', v: '84%', c: t.gold }].map(s => (
            <div key={s.l} style={{ flex: 1, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.03)', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 18, color: s.c || '#fff' }}>{s.v}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: t.dim3, letterSpacing: 1, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        {/* Leaders mini */}
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: t.dim2, marginBottom: 10 }}>Meilleurs sur ce thème</div>
        {[{ n: 'NovaPlay', c: '#00E5FF', l: 'N', s: '98%' }, { n: 'Maya_99', c: '#B366FF', l: 'M', s: '94%' }].map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', marginBottom: 6, borderRadius: 12, background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 13, color: t.gold, width: 20 }}>{i + 1}</div>
            <Avatar size={34} color={p.c} letter={p.l}/>
            <div style={{ flex: 1, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14 }}>{p.n}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: t.mint, fontWeight: 700 }}>{p.s}</div>
          </div>
        ))}
        <div style={{ marginTop: 16 }}><PrimaryBtn variant="B">⚔ Lancer un duel · Géo</PrimaryBtn></div>
      </div>
    </FrameS2>
  );
}

// 13 · CREATE-THEME (interactif : form → generating → done)
function S_CreateTheme() {
  const t = TS2();
  const [phase, setPhase] = React.useState('form');
  const [name, setName] = React.useState('');
  const [universe, setUniverse] = React.useState('SCREEN');
  const UNIS = [
    { id: 'SCREEN', i: '🎬', c: '#B366FF', label: 'Cinéma' },
    { id: 'SOUND', i: '🎵', c: '#FF6B2C', label: 'Musique' },
    { id: 'ARENA', i: '⚽', c: '#32E7A3', label: 'Sport' },
    { id: 'GLOBE', i: '🌍', c: '#00E5FF', label: 'Géo' },
    { id: 'LAB', i: '🔬', c: '#1565C0', label: 'Sciences' },
    { id: 'LEGENDS', i: '⚱', c: '#FFB547', label: 'Histoire' },
  ];
  const curC = UNIS.find(u => u.id === universe)?.c || t.cyan;
  const generate = () => {
    setPhase('generating');
    setTimeout(() => setPhase('done'), 2600);
  };
  return (
    <FrameS2>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 240, background: `linear-gradient(180deg, ${curC}35, transparent)`, transition: 'background 0.4s' }}/>
      <Stars count={14} opacity={0.35}/>

      {phase === 'form' && (
        <div style={{ position: 'absolute', inset: 0, padding: '50px 16px 24px', overflowY: 'auto' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 14 }}><path d="M15 6l-6 6 6 6"/></svg>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: curC, letterSpacing: 2.5, fontWeight: 700, textTransform: 'uppercase' }}>◆ Studio IA</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 28, letterSpacing: -1, marginTop: 4, marginBottom: 6, textTransform: 'uppercase' }}>Crée ton thème</div>
          <div style={{ fontFamily: 'Inter', fontSize: 13, color: t.dim2, marginBottom: 22, lineHeight: 1.45 }}>Donne un sujet, notre IA génère 20 questions inédites en quelques secondes.</div>

          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12, letterSpacing: 0.5, color: t.dim2, marginBottom: 8, textTransform: 'uppercase' }}>Sujet du thème</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex : Films de Christopher Nolan" style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: `1px solid ${name ? curC : 'rgba(255,255,255,0.1)'}`, color: '#fff', fontFamily: 'Inter', fontSize: 14, outline: 'none', marginBottom: 22, boxSizing: 'border-box' }}/>

          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12, letterSpacing: 0.5, color: t.dim2, marginBottom: 10, textTransform: 'uppercase' }}>Univers</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
            {UNIS.map(u => (
              <div key={u.id} onClick={() => setUniverse(u.id)} style={{ padding: '14px 8px', borderRadius: 14, textAlign: 'center', background: universe === u.id ? `${u.c}25` : 'rgba(255,255,255,0.04)', border: `2px solid ${universe === u.id ? u.c : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', transition: 'all 0.2s' }}>
                <div style={{ fontSize: 24 }}>{u.i}</div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 10, marginTop: 4, color: universe === u.id ? u.c : t.dim2 }}>{u.label}</div>
              </div>
            ))}
          </div>

          <div onClick={generate} style={{ padding: 16, borderRadius: 16, background: name ? `linear-gradient(135deg, ${t.cyan}, ${t.violet})` : 'rgba(255,255,255,0.08)', color: name ? '#000' : t.dim3, textAlign: 'center', fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 15, letterSpacing: 1, textTransform: 'uppercase', cursor: name ? 'pointer' : 'default', boxShadow: name ? `0 12px 30px ${t.cyan}40` : 'none' }}>
            ✦ Générer les questions
          </div>
        </div>
      )}

      {phase === 'generating' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div style={{ width: 120, height: 120, borderRadius: '50%', background: `conic-gradient(from 0deg, ${t.cyan}, ${t.violet}, ${t.gold}, ${t.cyan})`, padding: 5, animation: 'pulse 1.5s ease-in-out infinite' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: t.abyss, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>✦</div>
          </div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, marginTop: 24, textAlign: 'center', letterSpacing: -0.5 }}>L'IA génère ton thème…</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.dim3, letterSpacing: 1, marginTop: 8, textAlign: 'center' }}>« {name || 'Ton thème'} »</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 20 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: t.cyan, animation: `pulse 0.8s ease-in-out infinite ${i * 0.2}s` }}/>)}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div style={{ position: 'absolute', inset: 0, padding: '60px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          {Array.from({ length: 16 }, (_, i) => {
            const cs = [t.cyan, t.violet, t.gold, t.mint];
            return <div key={i} style={{ position: 'absolute', left: `${(i * 23) % 100}%`, top: `${(i * 17) % 40}%`, width: 7, height: 11, background: cs[i % 4], transform: `rotate(${i * 40}deg)`, opacity: 0.7, borderRadius: 2 }}/>;
          })}
          <div style={{ width: 100, height: 100, borderRadius: 28, background: `linear-gradient(135deg, ${curC}, ${t.violet})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50, boxShadow: `0 16px 40px ${curC}50`, animation: 'heroIn 0.7s cubic-bezier(0.2,0.9,0.3,1.2) forwards' }}>
            {UNIS.find(u => u.id === universe)?.i}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.mint, letterSpacing: 2, fontWeight: 700, marginTop: 20 }}>◆ THÈME CRÉÉ</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 26, letterSpacing: -0.8, marginTop: 6 }}>{name || 'Mon thème'}</div>
          <div style={{ fontFamily: 'Inter', fontSize: 13, color: t.dim2, marginTop: 8 }}>20 questions générées et prêtes à jouer</div>
          <div style={{ width: '100%', marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <PrimaryBtn variant="B">⚔ Jouer maintenant</PrimaryBtn>
            <div onClick={() => setPhase('form')} style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: t.dim3, cursor: 'pointer', padding: 8 }}>Créer un autre thème</div>
          </div>
        </div>
      )}
    </FrameS2>
  );
}

Object.assign(window, { S_ChallengeWaiting, S_Tournament, S_Play, S_SuperCategory, S_CategoryDetail, S_CreateTheme });
