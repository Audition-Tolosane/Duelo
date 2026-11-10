// ============================================================================
// SCREENS PART 3 — Leaderboard, Profil, Shop
// ============================================================================
const T3 = () => window.DUELO_TOKENS;
function Frame3({ children, style = {} }) {
  return <div style={{ position: 'absolute', inset: 0, color: '#fff', ...style }}>{children}</div>;
}

const LB_DATA = [
  { rank: 1, n: 'StellarKing', lv: 48, xp: 18420, c: '#FFB547', l: 'S', isYou: false },
  { rank: 2, n: 'Maya_99', lv: 46, xp: 17210, c: '#B366FF', l: 'M', isYou: false },
  { rank: 3, n: 'NovaPlay', lv: 44, xp: 16100, c: '#32E7A3', l: 'N', isYou: false },
  { rank: 4, n: 'Phoenix', lv: 40, xp: 14890, c: '#FF6B2C', l: 'P', isYou: false },
  { rank: 5, n: 'Orion', lv: 38, xp: 13420, c: '#FF3D5E', l: 'O', isYou: false },
  { rank: 12, n: 'Toi', lv: 12, xp: 2840, c: '#00E5FF', l: 'L', isYou: true },
];

// 07 · LEADERBOARD
function Leaderboard_A() {
  const t = T3();
  return (
    <Frame3>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${t.abyss}, ${t.night})` }}/>
      <Stars count={15} opacity={0.3}/>
      <div style={{ position: 'absolute', inset: 0, padding: '60px 20px 100px', overflowY: 'auto' }}>
        <Eyebrow color={t.gold}>◆ Classement</Eyebrow>
        <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 36, fontWeight: 400, letterSpacing: -1.2, lineHeight: 1, marginTop: 6, marginBottom: 18 }}>Top mondial<br/>cette saison.</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {['Monde', 'Amis', 'Pays'].map((tab, i) => (
            <div key={tab} style={{ padding: '6px 12px', borderRadius: 10, background: i === 0 ? '#fff' : 'rgba(255,255,255,0.06)', color: i === 0 ? t.abyss : t.dim2, fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 11 }}>{tab}</div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 20, justifyContent: 'center' }}>
          {[{ p: LB_DATA[1], h: 90, place: 2, c: '#C0C0C0' }, { p: LB_DATA[0], h: 120, place: 1, c: t.gold }, { p: LB_DATA[2], h: 70, place: 3, c: '#CD7F32' }].map(x => (
            <div key={x.place} style={{ flex: 1, textAlign: 'center' }}>
              <Avatar size={44} color={x.p.c} letter={x.p.l}/>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 11, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.p.n}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, marginTop: 2 }}>{x.p.xp.toLocaleString()}</div>
              <div style={{ marginTop: 8, height: x.h, borderRadius: '10px 10px 0 0', background: `linear-gradient(180deg, ${x.c}40, ${x.c}10)`, border: `1px solid ${x.c}60`, borderBottom: 'none', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10, fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 28, fontWeight: 500, color: x.c }}>{x.place}</div>
            </div>
          ))}
        </div>
        {LB_DATA.slice(3).map(p => (
          <div key={p.rank} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, marginBottom: 6, borderRadius: 14, background: p.isYou ? `${t.cyan}15` : 'rgba(255,255,255,0.03)', border: `1px solid ${p.isYou ? t.cyan + '60' : 'rgba(255,255,255,0.05)'}` }}>
            <div style={{ width: 24, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: p.isYou ? t.cyan : t.dim3 }}>{String(p.rank).padStart(2, '0')}</div>
            <Avatar size={34} color={p.c} letter={p.l}/>
            <div style={{ flex: 1 }}><div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: p.isYou ? t.cyan : '#fff' }}>{p.n}</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3 }}>LV {p.lv}</div></div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: t.dim2 }}>{p.xp.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <NavBar active="rank" variant="A"/>
    </Frame3>
  );
}

function Leaderboard_B() {
  const t = T3();
  return (
    <Frame3>
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
        <div style={{ padding: 18, borderRadius: 18, marginBottom: 10, background: `linear-gradient(135deg, ${t.gold}50, ${t.fire}30)`, border: `2px solid ${t.gold}`, boxShadow: `0 12px 40px ${t.gold}40`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -10, right: -10, fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 100, fontWeight: 500, color: 'rgba(0,0,0,0.15)', lineHeight: 1 }}>#1</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
            <Avatar size={60} color={t.gold} letter="S" ring ringColor={t.gold}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 18 }}>StellarKing</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#000', fontWeight: 700, opacity: 0.7, marginTop: 2 }}>LV 48 · 89% WR</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 20, color: '#000', marginTop: 4 }}>18 420 XP</div>
            </div>
            <div style={{ fontSize: 32 }}>👑</div>
          </div>
        </div>
        {LB_DATA.slice(1).map(p => (
          <div key={p.rank} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 6, borderRadius: 12, background: p.isYou ? `linear-gradient(90deg, ${t.cyan}25, ${t.cyan}05)` : 'rgba(255,255,255,0.04)', border: `${p.isYou ? '2' : '1'}px solid ${p.isYou ? t.cyan : 'rgba(255,255,255,0.05)'}` }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: p.isYou ? t.cyan : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 12, color: p.isYou ? '#000' : t.dim2 }}>{p.rank}</div>
            <Avatar size={36} color={p.c} letter={p.l}/>
            <div style={{ flex: 1 }}><div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14 }}>{p.n} {p.isYou && '·TOI'}</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3 }}>LV {p.lv}</div></div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 14, color: t.gold }}>{p.xp.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <NavBar active="rank" variant="B"/>
    </Frame3>
  );
}

// 08 · PROFIL
function Profil_A() {
  const t = T3();
  return (
    <Frame3>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 220, background: `linear-gradient(180deg, ${t.cyan}25, transparent)` }}/>
      <Stars count={12} opacity={0.3}/>
      <div style={{ position: 'absolute', inset: 0, padding: '60px 20px 100px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ padding: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 10, fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 700 }}>⚙</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <Avatar size={96} color={t.cyan} letter="L" ring ringColor={t.gold}/>
          <Eyebrow color={t.cyan}>◆ Niveau 12</Eyebrow>
          <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 34, fontWeight: 400, letterSpacing: -1 }}>Léo</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.dim3, letterSpacing: 1, textTransform: 'uppercase' }}>@leo_quiz · inscrit en 2024</div>
        </div>
        <div style={{ marginTop: 20, padding: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.dim2, letterSpacing: 1 }}>
            <div>2 840 / 3 000 XP</div><div style={{ color: t.gold }}>LV 13 dans 160</div>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ width: '94%', height: '100%', background: `linear-gradient(90deg, ${t.cyan}, ${t.gold})` }}/>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
          {[{ l: 'Duels', v: '248', c: t.cyan }, { l: 'Victoires', v: '189', c: t.mint }, { l: 'Ratio', v: '76%', c: t.gold }].map(s => (
            <div key={s.l} style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 26, fontWeight: 500, color: s.c, letterSpacing: -0.5 }}>{s.v}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14, letterSpacing: -0.2, marginTop: 20, marginBottom: 10 }}>Trophées récents</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {[{ i: '🔥', n: 'Streak 7', c: t.fire }, { i: '⚡', n: 'Fast hand', c: t.gold }, { i: '🎯', n: '100% round', c: t.mint }, { i: '👑', n: 'Top 15', c: t.violet }].map(tr => (
            <div key={tr.n} style={{ flexShrink: 0, width: 80, padding: 10, borderRadius: 12, background: `${tr.c}15`, border: `1px solid ${tr.c}30`, textAlign: 'center' }}>
              <div style={{ fontSize: 24 }}>{tr.i}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 9, fontWeight: 700, color: tr.c, marginTop: 4 }}>{tr.n}</div>
            </div>
          ))}
        </div>
      </div>
      <NavBar active="profile" variant="A"/>
    </Frame3>
  );
}

function Profil_B() {
  const t = T3();
  return (
    <Frame3>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280, background: `linear-gradient(180deg, ${t.cyan}50 0%, ${t.violet}30 50%, transparent)` }}/>
      <Stars count={20} opacity={0.5}/>
      <div style={{ position: 'absolute', inset: 0, padding: '50px 16px 100px', overflowY: 'auto' }}>
        <div style={{ padding: 18, borderRadius: 20, textAlign: 'center', background: 'rgba(0,0,0,0.3)', border: `2px solid ${t.cyan}50`, backdropFilter: 'blur(10px)' }}>
          <Avatar size={86} color={t.cyan} letter="L" ring ringColor={t.gold}/>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 26, letterSpacing: -0.5, marginTop: 10 }}>LÉO</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.gold, fontWeight: 700, letterSpacing: 2, marginTop: 2 }}>LV 12 · RANK 12 MONDE</div>
          <div style={{ marginTop: 14, height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: '94%', height: '100%', background: `linear-gradient(90deg, ${t.cyan}, ${t.gold})`, boxShadow: `0 0 8px ${t.gold}` }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 1 }}>
            <div>2840 XP</div><div>LV 13 · 160 XP</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          {[{ l: 'DUELS', v: '248', c: t.cyan }, { l: 'WINS', v: '189', c: t.mint }, { l: 'WR%', v: '76', c: t.gold, suffix: '%' }, { l: 'STREAK', v: '7', c: t.fire, prefix: '🔥 ' }].map(s => (
            <div key={s.l} style={{ padding: 14, borderRadius: 14, background: `linear-gradient(135deg, ${s.c}30, ${s.c}10)`, border: `1.5px solid ${s.c}50` }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: s.c, letterSpacing: 1.5, fontWeight: 700 }}>{s.l}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 28, letterSpacing: -1, marginTop: 2 }}>{s.prefix || ''}{s.v}{s.suffix || ''}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 11, letterSpacing: 2, color: t.dim2, marginTop: 18, marginBottom: 10 }}>◆ PERFORMANCE PAR CATÉGORIE</div>
        {[{ n: 'Cinéma', v: 92, c: t.violet }, { n: 'Géographie', v: 78, c: t.cyan }, { n: 'Histoire', v: 65, c: t.gold }].map(cat => (
          <div key={cat.n} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontFamily: 'Space Grotesk', fontSize: 12, fontWeight: 700 }}>
              <div>{cat.n}</div><div style={{ color: cat.c }}>{cat.v}%</div>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${cat.v}%`, height: '100%', background: cat.c }}/>
            </div>
          </div>
        ))}
      </div>
      <NavBar active="profile" variant="B"/>
    </Frame3>
  );
}

// 09 · SHOP
function Shop_A() {
  const t = T3();
  return (
    <Frame3>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${t.abyss}, ${t.night})` }}/>
      <Stars count={12} opacity={0.3}/>
      <div style={{ position: 'absolute', inset: 0, padding: '60px 20px 100px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Eyebrow color={t.gold}>◆ Boutique</Eyebrow>
            <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 32, fontWeight: 400, letterSpacing: -1, marginTop: 4 }}>Ta réserve</div>
          </div>
          <div style={{ padding: '8px 12px', background: `${t.gold}15`, border: `1px solid ${t.gold}40`, borderRadius: 12 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 1 }}>PIÈCES</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: t.gold }}>1 240</div>
          </div>
        </div>
        <div style={{ padding: 20, borderRadius: 20, marginTop: 18, background: `linear-gradient(135deg, ${t.violet}40, ${t.cyan}20)`, border: `1px solid ${t.violet}50`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 120, opacity: 0.2 }}>✦</div>
          <Eyebrow color={t.violet}>◆ Pack du jour</Eyebrow>
          <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 24, fontWeight: 400, letterSpacing: -0.5, marginTop: 6 }}>Pack Stellaire</div>
          <div style={{ fontFamily: 'Inter', fontSize: 11, color: t.dim2, marginTop: 4 }}>3 avatars exclusifs · 500 pièces</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <div style={{ padding: '10px 16px', background: '#fff', color: t.abyss, borderRadius: 12, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12 }}>Obtenir · 450 pièces</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.dim3, textDecoration: 'line-through' }}>620</div>
          </div>
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14, marginTop: 20, marginBottom: 10 }}>Boosts</div>
        {[{ n: 'Double XP', d: '5 prochains duels', c: t.mint, p: 120, i: '⚡' }, { n: 'Time boost', d: '+3s par question', c: t.cyan, p: 80, i: '⏱' }, { n: 'Seconde chance', d: 'Retente une question', c: t.gold, p: 200, i: '✦' }].map(it => (
          <div key={it.n} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 6 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${it.c}20`, border: `1px solid ${it.c}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{it.i}</div>
            <div style={{ flex: 1 }}><div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14 }}>{it.n}</div><div style={{ fontFamily: 'Inter', fontSize: 11, color: t.dim3 }}>{it.d}</div></div>
            <div style={{ padding: '6px 10px', background: `${t.gold}20`, borderRadius: 10, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12, color: t.gold }}>{it.p}</div>
          </div>
        ))}
      </div>
      <NavBar active="home" variant="A"/>
    </Frame3>
  );
}

function Shop_B() {
  const t = T3();
  return (
    <Frame3>
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
    </Frame3>
  );
}

Object.assign(window, { Leaderboard_A, Leaderboard_B, Profil_A, Profil_B, Shop_A, Shop_B });
