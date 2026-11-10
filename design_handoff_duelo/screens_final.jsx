// ============================================================================
// DUELO — KIT FINAL (variations choisies + modifications demandées)
// ============================================================================
const TF = () => window.DUELO_TOKENS;
function FrameF({ children }) {
  return <div style={{ position: 'absolute', inset: 0, color: '#fff' }}>{children}</div>;
}

const CATS_F = [
  { n: 'Géographie', i: '🌍', c: '#00E5FF', stat: '62 duels' },
  { n: 'Histoire', i: '⚱', c: '#FFB547', stat: '48 duels' },
  { n: 'Sciences', i: '⚛', c: '#32E7A3', stat: '27 duels' },
  { n: 'Sport', i: '⚽', c: '#FF6B2C', stat: '54 duels' },
  { n: 'Musique', i: '♪', c: '#FF3D5E', stat: '73 duels' },
];

const LBF = [
  { rank: 1, n: 'StellarKing', lv: 48, xp: 18420, c: '#FFB547', l: 'S', isYou: false },
  { rank: 2, n: 'Maya_99', lv: 46, xp: 17210, c: '#B366FF', l: 'M', isYou: false },
  { rank: 3, n: 'NovaPlay', lv: 44, xp: 16100, c: '#32E7A3', l: 'N', isYou: false },
  { rank: 4, n: 'Phoenix', lv: 40, xp: 14890, c: '#FF6B2C', l: 'P', isYou: false },
  { rank: 5, n: 'Orion', lv: 38, xp: 13420, c: '#FF3D5E', l: 'O', isYou: false },
  { rank: 12, n: 'Toi', lv: 12, xp: 2840, c: '#00E5FF', l: 'L', isYou: true },
];

// Round timer (repris de la VAR A) — réutilisé sur le Quiz final
function RoundTimer({ seconds = 7, total = 10, urgent = false }) {
  const t = TF();
  const col = urgent ? t.red : t.cyan;
  const R = 38, C = 2 * Math.PI * R;
  const off = C * (1 - seconds / total);
  return (
    <div style={{ position: 'relative', width: 86, height: 86 }}>
      <svg width="86" height="86" viewBox="0 0 86 86" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx="43" cy="43" r={R} stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="none"/>
        <circle cx="43" cy="43" r={R} stroke={col} strokeWidth="4" fill="none" strokeDasharray={C} strokeDashoffset={off} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${col})` }}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'Space Grotesk', fontSize: 32, fontWeight: 900, color: col, letterSpacing: -1, lineHeight: 1 }}>{seconds}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: t.dim3, letterSpacing: 1, marginTop: 2 }}>SEC</div>
      </div>
    </div>
  );
}

// 01 · ONBOARDING (VAR B)
function F_Onboarding() {
  const t = TF();
  return (
    <FrameF>
      <CosmicBg variant="B"/>
      <div style={{ position: 'absolute', inset: 0, padding: '60px 24px 32px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ width: 20, height: 3, borderRadius: 2, background: t.cyan }}/>
            <div style={{ width: 20, height: 3, borderRadius: 2, background: t.dim3 }}/>
            <div style={{ width: 20, height: 3, borderRadius: 2, background: t.dim3 }}/>
          </div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, color: t.dim2 }}>Passer</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
            <div style={{ width: 180, height: 180, borderRadius: '50%', background: `conic-gradient(from 0deg, ${t.cyan}, ${t.violet}, ${t.gold}, ${t.cyan})`, padding: 4, position: 'relative', animation: 'pulse 4s ease-in-out infinite' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: t.abyss, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SwordMark size={110}/>
              </div>
            </div>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ position: 'absolute', top: '50%', left: '50%', width: 4, height: 4, borderRadius: 2, background: t.gold, transform: `rotate(${i*90}deg) translateY(-110px)`, boxShadow: `0 0 8px ${t.gold}` }}/>
            ))}
          </div>
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 40, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1, textAlign: 'center', textTransform: 'uppercase' }}>
              Prêt<br/>à <span style={{ background: `linear-gradient(135deg, ${t.cyan}, ${t.violet})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>duel</span>er ?
            </div>
            <div style={{ fontFamily: 'Inter', fontSize: 14, color: t.dim2, textAlign: 'center', maxWidth: 280, margin: '14px auto 0', lineHeight: 1.55 }}>
              1v1. 10 questions. Le plus rapide gagne. Les meilleurs deviennent légende.
            </div>
          </div>
        </div>
        <PrimaryBtn variant="B">Go →</PrimaryBtn>
      </div>
    </FrameF>
  );
}

// 02 · ACCUEIL (VAR B + "trouve un adversaire en ~8s")
function F_Accueil() {
  const t = TF();
  return (
    <FrameF>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300, background: `linear-gradient(180deg, ${t.violet}40, transparent)` }}/>
      <Stars count={15} opacity={0.4}/>
      <div style={{ position: 'absolute', inset: 0, padding: '50px 16px 100px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Avatar size={44} color={t.cyan} letter="L" ring ringColor={t.gold}/>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14 }}>LÉO</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.gold, fontWeight: 700 }}>Lv 12 · 2 840 XP</div>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
              <div style={{ width: '62%', height: '100%', background: `linear-gradient(90deg, ${t.cyan}, ${t.gold})`, boxShadow: `0 0 8px ${t.gold}` }}/>
            </div>
          </div>
        </div>
        <div style={{ padding: 24, borderRadius: 24, marginBottom: 20, textAlign: 'center', background: `linear-gradient(135deg, ${t.cyan}, ${t.violet})`, boxShadow: `0 16px 40px ${t.violet}60`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -10, opacity: 0.2 }}><SwordMark size={140} color="#fff"/></div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 12, letterSpacing: 2, color: '#000', textTransform: 'uppercase', opacity: 0.7 }}>Quick match</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 42, letterSpacing: -2, color: '#000', marginTop: 4, lineHeight: 1 }}>DUEL !</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, color: '#000', opacity: 0.65, marginTop: 6 }}>Trouve un adversaire en ~8s</div>
          <div style={{ marginTop: 14, background: '#000', color: '#fff', padding: '12px 20px', borderRadius: 14, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, display: 'inline-block' }}>◆ Trouver un adversaire</div>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 16, marginBottom: 18, background: `linear-gradient(135deg, ${t.fire}30, ${t.gold}20)`, border: `1px solid ${t.fire}40` }}>
          <div style={{ fontSize: 32, lineHeight: 1 }}>🔥</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13 }}>7 jours de streak</div>
            <div style={{ fontFamily: 'Inter', fontSize: 11, color: t.dim2 }}>Joue aujourd'hui pour maintenir</div>
          </div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, color: t.fire }}>+25</div>
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, color: t.dim2 }}>TES DUELS (3)</div>
        {[
          { n: 'Maya Chen', c: t.violet, l: 'M', s: 'YOUR TURN', r: '2–1', bg: t.cyan },
          { n: 'Théo Moreau', c: t.gold, l: 'T', s: 'WAITING', r: '0–0', bg: null },
          { n: 'Inès P.', c: t.mint, l: 'I', s: 'YOUR TURN', r: '1–2', bg: t.cyan },
        ].map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8, borderRadius: 14, background: d.bg ? d.bg + '15' : 'rgba(255,255,255,0.04)', border: `2px solid ${d.bg ? d.bg : 'rgba(255,255,255,0.04)'}` }}>
            <Avatar size={44} color={d.c} letter={d.l}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14 }}>{d.n}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: d.bg || t.dim3, letterSpacing: 1, marginTop: 2 }}>{d.s}</div>
            </div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 18 }}>{d.r}</div>
          </div>
        ))}
      </div>
      <NavBar active="home" variant="B"/>
    </FrameF>
  );
}

// 03 · MATCHMAKING (VAR B)
function F_Matchmaking() {
  const t = TF();
  return (
    <FrameF>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${t.cyan}40, ${t.abyss} 40%, ${t.abyss} 60%, ${t.violet}40)` }}/>
      <Stars count={25} opacity={0.6}/>
      <div style={{ position: 'absolute', inset: 0, padding: '44px 20px 32px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 11, letterSpacing: 3, textAlign: 'center', color: t.gold, textTransform: 'uppercase', marginBottom: 6 }}>◆ Duel trouvé ◆</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 26, textAlign: 'center', letterSpacing: -0.5, lineHeight: 1 }}>GÉOGRAPHIE · LV 12</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
          <div style={{ padding: 20, borderRadius: 20, background: `linear-gradient(90deg, ${t.cyan}40, ${t.cyan}00)`, border: `2px solid ${t.cyan}`, display: 'flex', alignItems: 'center', gap: 16, boxShadow: `0 8px 30px ${t.cyan}40` }}>
            <Avatar size={70} color={t.cyan} letter="L"/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 20, letterSpacing: -0.5 }}>TOI</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.cyan, fontWeight: 700, letterSpacing: 1 }}>LV 12 · 2 840 XP</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <div style={{ padding: '2px 6px', background: t.mint + '30', borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.mint, fontWeight: 700 }}>78% WR</div>
                <div style={{ padding: '2px 6px', background: t.fire + '30', borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.fire, fontWeight: 700 }}>🔥 7</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${t.gold})` }}/>
            <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 42, fontWeight: 500, color: t.gold }}>VS</div>
            <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${t.gold}, transparent)` }}/>
          </div>
          <div style={{ padding: 20, borderRadius: 20, background: `linear-gradient(270deg, ${t.violet}40, ${t.violet}00)`, border: `2px solid ${t.violet}`, display: 'flex', alignItems: 'center', gap: 16, flexDirection: 'row-reverse', boxShadow: `0 8px 30px ${t.violet}40` }}>
            <Avatar size={70} color={t.violet} letter="M"/>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 20, letterSpacing: -0.5 }}>MAYA_99</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.violet, fontWeight: 700, letterSpacing: 1 }}>LV 14 · 3 102 XP</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                <div style={{ padding: '2px 6px', background: t.fire + '30', borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.fire, fontWeight: 700 }}>🔥 12</div>
                <div style={{ padding: '2px 6px', background: t.mint + '30', borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.mint, fontWeight: 700 }}>82% WR</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 72, color: t.gold, letterSpacing: -4, lineHeight: 1, textShadow: `0 0 40px ${t.gold}80` }}>3</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.dim3, letterSpacing: 2, textTransform: 'uppercase' }}>Le duel commence</div>
        </div>
      </div>
    </FrameF>
  );
}

// 04 · QUIZ (VAR B + timer rond de A à la place de la barre)
function F_Quiz() {
  const t = TF();
  return (
    <FrameF>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${t.cyan}20, ${t.abyss} 30%, ${t.abyss} 70%, ${t.violet}20)` }}/>
      <Stars count={20} opacity={0.5}/>
      <div style={{ position: 'absolute', inset: 0, padding: '50px 16px 20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, padding: '10px 12px', borderRadius: 12, background: `${t.cyan}15`, border: `1px solid ${t.cyan}60`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar size={30} color={t.cyan} letter="L"/>
            <div style={{ flex: 1 }}><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.cyan, letterSpacing: 1 }}>TOI</div><div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, color: '#fff', lineHeight: 1 }}>2</div></div>
          </div>
          <div style={{ flex: 1, padding: '10px 12px', borderRadius: 12, background: `${t.violet}15`, border: `1px solid ${t.violet}60`, display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row-reverse' }}>
            <Avatar size={30} color={t.violet} letter="M"/>
            <div style={{ flex: 1, textAlign: 'right' }}><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.violet, letterSpacing: 1 }}>MAYA</div><div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, color: '#fff', lineHeight: 1 }}>1</div></div>
          </div>
        </div>
        {/* timer rond (repris de VAR A) + dots */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <RoundTimer seconds={7} total={10}/>
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} style={{ width: 20, height: 5, borderRadius: 3, background: i < 2 ? t.mint : i === 2 ? t.gold : 'rgba(255,255,255,0.12)', boxShadow: i === 2 ? `0 0 6px ${t.gold}` : 'none' }}/>
            ))}
          </div>
        </div>
        <div style={{ padding: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, marginBottom: 14 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 10, fontWeight: 900, letterSpacing: 2, color: t.gold, textTransform: 'uppercase', marginBottom: 8 }}>◆ Géographie · Q3</div>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900, letterSpacing: -1, lineHeight: 1.05, textWrap: 'balance' }}>Quelle est la capitale de la Mongolie ?</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[{ a: 'A', x: 'Astana', c: t.cyan }, { a: 'B', x: 'Oulan-Bator', c: t.mint, ok: true }, { a: 'C', x: 'Bichkek', c: t.violet }, { a: 'D', x: 'Douchanbé', c: t.gold }].map(o => (
            <div key={o.a} style={{ padding: '18px 12px', borderRadius: 16, textAlign: 'center', background: o.ok ? `linear-gradient(135deg, ${o.c}, ${o.c}80)` : `${o.c}20`, border: `2px solid ${o.ok ? o.c : o.c + '50'}`, boxShadow: o.ok ? `0 8px 24px ${o.c}60` : 'none', minHeight: 90, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 11, color: o.ok ? t.abyss : o.c, letterSpacing: 1 }}>{o.a}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15, color: o.ok ? t.abyss : '#fff' }}>{o.x}</div>
            </div>
          ))}
        </div>
      </div>
    </FrameF>
  );
}

// 05 · RESULTS (VAR B + détail des points en plus du total)
function F_Results() {
  const t = TF();
  return (
    <FrameF>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 30%, ${t.gold}60 0%, ${t.fire}30 30%, ${t.abyss} 70%)` }}/>
      {Array.from({ length: 24 }, (_, i) => {
        const colors = [t.cyan, t.violet, t.gold, t.fire, t.mint];
        return <div key={i} style={{ position: 'absolute', left: `${(i * 37) % 100}%`, top: `${(i * 17) % 50}%`, width: 8, height: 12, background: colors[i % 5], transform: `rotate(${(i * 47) % 360}deg)`, opacity: 0.7, borderRadius: 2 }}/>;
      })}
      <Stars count={30} opacity={0.7}/>
      <div style={{ position: 'absolute', inset: 0, padding: '52px 18px 24px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', background: t.gold, color: t.abyss, fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 10, letterSpacing: 3, borderRadius: 20, textTransform: 'uppercase' }}>◆ Flawless</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 64, letterSpacing: -3, lineHeight: 0.9, marginTop: 10, color: '#fff', textShadow: `0 0 40px ${t.gold}` }}>VICTOIRE</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
          <div style={{ flex: 1, padding: 14, borderRadius: 20, background: `linear-gradient(135deg, ${t.cyan}50, ${t.cyan}10)`, border: `2px solid ${t.cyan}`, textAlign: 'center' }}>
            <Avatar size={42} color={t.cyan} letter="L"/>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 38, color: '#fff', letterSpacing: -2, lineHeight: 1, marginTop: 8 }}>7</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.cyan, letterSpacing: 1, fontWeight: 700 }}>WINNER</div>
          </div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 20, color: t.gold }}>VS</div>
          <div style={{ flex: 1, padding: 14, borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.08)', textAlign: 'center', opacity: 0.6 }}>
            <Avatar size={42} color={t.violet} letter="M"/>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 38, color: '#fff', letterSpacing: -2, lineHeight: 1, marginTop: 8 }}>4</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim2, letterSpacing: 1, fontWeight: 700 }}>LOST</div>
          </div>
        </div>
        {/* Détail des points (repris de VAR A) + total */}
        <div style={{ marginTop: 14, padding: 16, background: 'rgba(0,0,0,0.35)', border: `1px solid ${t.gold}40`, borderRadius: 16 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>XP gagnés</div>
          {[['Base', '+50'], ['Victoire', '+30'], ['Précision', '+24', t.mint], ['Série ×7', '+20', t.fire]].map(([l, v, c], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 3 ? `1px solid rgba(255,255,255,0.06)` : 'none' }}>
              <span style={{ fontFamily: 'Inter', fontSize: 13, color: c || t.dim2 }}>{l}</span>
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14, color: c || '#fff' }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4, borderTop: `1px solid ${t.gold}50` }}>
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 14, color: '#fff', letterSpacing: 0.5 }}>TOTAL</span>
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, color: t.gold }}>+124 XP</span>
          </div>
        </div>
        {/* Barre niveau */}
        <div style={{ marginTop: 12, padding: 14, background: 'rgba(0,0,0,0.4)', borderRadius: 14, border: `1px solid rgba(255,255,255,0.08)` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 11 }}>
            <div style={{ color: t.gold }}>LV 12</div><div style={{ color: t.dim2 }}>2 840 / 3 000 XP</div><div style={{ color: t.dim2 }}>LV 13</div>
          </div>
          <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ width: '94%', height: '100%', background: `linear-gradient(90deg, ${t.cyan}, ${t.gold})`, boxShadow: `0 0 10px ${t.gold}` }}/>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <div style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.06)', borderRadius: 14, textAlign: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, border: '1px solid rgba(255,255,255,0.1)' }}>Accueil</div>
          <div style={{ flex: 2 }}><PrimaryBtn variant="B" style={{ padding: 14 }}>◆ Revanche</PrimaryBtn></div>
        </div>
      </div>
    </FrameF>
  );
}

// 06 · THEMES (VAR B vedette + grille 2 colonnes pour le reste)
function F_Themes() {
  const t = TF();
  return (
    <FrameF>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <Stars count={15} opacity={0.3}/>
      <div style={{ position: 'absolute', inset: 0, padding: '56px 16px 100px', overflowY: 'auto' }}>
        <div style={{ padding: '0 4px 14px' }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 11, letterSpacing: 2.5, color: t.gold, textTransform: 'uppercase' }}>◆ Arène</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 30, letterSpacing: -1.2, marginTop: 4, textTransform: 'uppercase', lineHeight: 0.95 }}>Choisis ton<br/>champ de bataille</div>
        </div>
        {/* Vedette (de VAR B) */}
        <div style={{ padding: 20, borderRadius: 20, marginBottom: 12, background: `linear-gradient(135deg, ${t.violet}, ${t.cyan})`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -10, fontSize: 140, opacity: 0.15 }}>🎬</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#000', letterSpacing: 2, fontWeight: 700 }}>◆ POPULAIRE</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 36, color: '#000', letterSpacing: -1.5, lineHeight: 1, marginTop: 6 }}>CINÉMA</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, color: '#000', opacity: 0.7, marginTop: 4 }}>91 joueurs en live · ta meilleure catégorie</div>
          <div style={{ display: 'inline-block', padding: '8px 14px', background: '#000', color: '#fff', borderRadius: 10, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12, marginTop: 12 }}>DUEL →</div>
        </div>
        {/* Reste : grille 2 colonnes (de VAR A) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {CATS_F.map(th => (
            <div key={th.n} style={{ padding: 16, borderRadius: 18, aspectRatio: '1 / 1.05', background: `linear-gradient(180deg, ${th.c}25, ${th.c}08)`, border: `1px solid ${th.c}40`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 34, lineHeight: 1 }}>{th.i}</div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15, letterSpacing: -0.3 }}>{th.n}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: th.c, letterSpacing: 1, marginTop: 2 }}>{th.stat}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <NavBar active="play" variant="B"/>
    </FrameF>
  );
}

// 07 · LEADERBOARD (VAR B + podium de A)
function F_Leaderboard() {
  const t = TF();
  return (
    <FrameF>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 260, background: `linear-gradient(180deg, ${t.gold}30, transparent)` }}/>
      <Stars count={20} opacity={0.5}/>
      <div style={{ position: 'absolute', inset: 0, padding: '50px 14px 100px', overflowY: 'auto' }}>
        <div style={{ padding: '0 8px' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.gold, letterSpacing: 2.5, fontWeight: 700, textTransform: 'uppercase' }}>◆ SAISON 4 · 12J LEFT</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 34, letterSpacing: -1.5, marginTop: 4, lineHeight: 0.95, textTransform: 'uppercase' }}>Top Duelers</div>
        </div>
        <div style={{ display: 'flex', gap: 6, margin: '16px 0' }}>
          {['MONDE', 'AMIS', 'PAYS'].map((tab, i) => (
            <div key={tab} style={{ flex: 1, padding: '10px', borderRadius: 10, background: i === 0 ? `linear-gradient(135deg, ${t.cyan}, ${t.violet})` : 'rgba(255,255,255,0.05)', color: i === 0 ? '#000' : t.dim2, fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 11, letterSpacing: 1, textAlign: 'center' }}>{tab}</div>
          ))}
        </div>
        {/* Podium (de VAR A) */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 18, justifyContent: 'center' }}>
          {[{ p: LBF[1], h: 90, place: 2, c: '#C0C0C0' }, { p: LBF[0], h: 120, place: 1, c: t.gold }, { p: LBF[2], h: 70, place: 3, c: '#CD7F32' }].map(x => (
            <div key={x.place} style={{ flex: 1, textAlign: 'center' }}>
              <Avatar size={x.place === 1 ? 52 : 44} color={x.p.c} letter={x.p.l} ring={x.place === 1} ringColor={t.gold}/>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 11, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.p.n}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, marginTop: 2 }}>{x.p.xp.toLocaleString()}</div>
              <div style={{ marginTop: 8, height: x.h, borderRadius: '10px 10px 0 0', background: `linear-gradient(180deg, ${x.c}40, ${x.c}10)`, border: `1px solid ${x.c}60`, borderBottom: 'none', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10, fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 26, color: x.c }}>{x.place}</div>
            </div>
          ))}
        </div>
        {/* Liste (style VAR B) */}
        {LBF.slice(3).map(p => (
          <div key={p.rank} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 6, borderRadius: 12, background: p.isYou ? `linear-gradient(90deg, ${t.cyan}25, ${t.cyan}05)` : 'rgba(255,255,255,0.04)', border: `${p.isYou ? '2' : '1'}px solid ${p.isYou ? t.cyan : 'rgba(255,255,255,0.05)'}` }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: p.isYou ? t.cyan : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 12, color: p.isYou ? '#000' : t.dim2 }}>{p.rank}</div>
            <Avatar size={36} color={p.c} letter={p.l}/>
            <div style={{ flex: 1 }}><div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14 }}>{p.n} {p.isYou && '·TOI'}</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3 }}>LV {p.lv}</div></div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 14, color: t.gold }}>{p.xp.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <NavBar active="rank" variant="B"/>
    </FrameF>
  );
}

// 08 · PROFIL (VAR A en typo display Space Grotesk, cohérent avec les B)
function F_Profil() {
  const t = TF();
  return (
    <FrameF>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 220, background: `linear-gradient(180deg, ${t.cyan}25, transparent)` }}/>
      <Stars count={12} opacity={0.3}/>
      <div style={{ position: 'absolute', inset: 0, padding: '60px 20px 100px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ padding: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 10, fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 700 }}>⚙</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <Avatar size={96} color={t.cyan} letter="L" ring ringColor={t.gold}/>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.gold, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>◆ NIVEAU 12 · ÉRUDIT</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 30, letterSpacing: -0.5, textTransform: 'uppercase' }}>LÉO</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.dim3, letterSpacing: 1 }}>@leo_quiz · inscrit en 2024</div>
        </div>
        <div style={{ marginTop: 20, padding: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.dim2, letterSpacing: 1 }}>
            <div>2 840 / 3 000 XP</div><div style={{ color: t.gold }}>LV 13 dans 160</div>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ width: '94%', height: '100%', background: `linear-gradient(90deg, ${t.cyan}, ${t.gold})`, boxShadow: `0 0 8px ${t.gold}` }}/>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
          {[{ l: 'DUELS', v: '248', c: t.cyan }, { l: 'VICTOIRES', v: '189', c: t.mint }, { l: 'RATIO', v: '76%', c: t.gold }].map(s => (
            <div key={s.l} style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 12, textAlign: 'center', border: `1px solid ${s.c}25` }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 26, color: s.c, letterSpacing: -1 }}>{s.v}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: t.dim3, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 11, letterSpacing: 2, color: t.dim2, marginTop: 20, marginBottom: 10, textTransform: 'uppercase' }}>◆ Trophées récents</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {[{ i: '🔥', n: 'Streak 7', c: t.fire }, { i: '⚡', n: 'Fast hand', c: t.gold }, { i: '🎯', n: '100% round', c: t.mint }, { i: '👑', n: 'Top 15', c: t.violet }].map(tr => (
            <div key={tr.n} style={{ flexShrink: 0, width: 80, padding: 10, borderRadius: 12, background: `${tr.c}15`, border: `1px solid ${tr.c}30`, textAlign: 'center' }}>
              <div style={{ fontSize: 24 }}>{tr.i}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 9, fontWeight: 800, color: tr.c, marginTop: 4 }}>{tr.n}</div>
            </div>
          ))}
        </div>
      </div>
      <NavBar active="profile" variant="A"/>
    </FrameF>
  );
}

// 09 · SHOP (VAR B)
function F_Shop() {
  const t = TF();
  return (
    <FrameF>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', inset: 0, padding: '50px 14px 100px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 6px' }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.gold, letterSpacing: 2, fontWeight: 700 }}>◆ SHOP</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 32, letterSpacing: -1.5, lineHeight: 1, marginTop: 2, textTransform: 'uppercase' }}>Boosts &amp; skins</div>
          </div>
          <div style={{ padding: '10px 14px', background: `linear-gradient(135deg, ${t.gold}, ${t.fire})`, borderRadius: 12, color: '#000' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 1, fontWeight: 700, opacity: 0.7 }}>PIÈCES</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 18, lineHeight: 1 }}>1 240</div>
          </div>
        </div>
        <div style={{ marginTop: 14, padding: 18, borderRadius: 20, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${t.fire}, ${t.red})` }}>
          <div style={{ position: 'absolute', top: 10, right: 10, background: '#000', color: t.gold, padding: '4px 8px', borderRadius: 6, fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 10, letterSpacing: 1 }}>-30%</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#000', letterSpacing: 2, fontWeight: 700, opacity: 0.7 }}>◆ FLASH · 2H LEFT</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 30, letterSpacing: -1, marginTop: 4, color: '#000' }}>MEGA PACK</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, color: '#000', opacity: 0.7 }}>5 boosts · 3 skins · 1 trophée</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#000', color: '#fff', padding: '10px 14px', borderRadius: 12, fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 13, marginTop: 12 }}>ACHETER · 950</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          {[{ n: 'Double XP', i: '⚡', c: t.mint, p: 120 }, { n: 'Time Boost', i: '⏱', c: t.cyan, p: 80 }, { n: '2nd Chance', i: '✦', c: t.gold, p: 200 }, { n: 'Skin Néon', i: '◆', c: t.violet, p: 350 }].map(it => (
            <div key={it.n} style={{ padding: 14, borderRadius: 16, background: `linear-gradient(180deg, ${it.c}25, ${it.c}05)`, border: `1.5px solid ${it.c}50` }}>
              <div style={{ fontSize: 28 }}>{it.i}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 14, marginTop: 8 }}>{it.n}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, padding: '6px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 8, justifyContent: 'center' }}>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12, color: t.gold }}>◉ {it.p}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <NavBar active="home" variant="B"/>
    </FrameF>
  );
}

Object.assign(window, { F_Onboarding, F_Accueil, F_Matchmaking, F_Quiz, F_Results, F_Themes, F_Leaderboard, F_Profil, F_Shop, RoundTimer });
