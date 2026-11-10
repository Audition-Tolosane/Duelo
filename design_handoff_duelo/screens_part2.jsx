// ============================================================================
// SCREENS PART 2 — Quiz, Results, Themes
// ============================================================================
const T2 = () => window.DUELO_TOKENS;
function Frame2({ children, style = {} }) {
  return <div style={{ position: 'absolute', inset: 0, color: '#fff', ...style }}>{children}</div>;
}

// 04 · QUIZ
function Game_A() {
  const t = T2();
  return (
    <Frame2>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${t.abyss}, ${t.night})` }}/>
      <Stars count={15} opacity={0.4}/>
      <div style={{ position: 'absolute', inset: 0, padding: '50px 20px 24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <Avatar size={32} color={t.cyan} letter="L"/>
            <div><div style={{ fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 700 }}>Toi</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: t.cyan }}>2</div></div>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.dim3, letterSpacing: 1.5 }}>Q 3 / 10</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end', flexDirection: 'row-reverse' }}>
            <Avatar size={32} color={t.violet} letter="M"/>
            <div style={{ textAlign: 'right' }}><div style={{ fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 700 }}>Maya</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: t.violet }}>1</div></div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ position: 'relative', width: 86, height: 86 }}>
            <svg width="86" height="86" viewBox="0 0 86 86" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
              <circle cx="43" cy="43" r="38" stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="none"/>
              <circle cx="43" cy="43" r="38" stroke={t.cyan} strokeWidth="4" fill="none" strokeDasharray="238" strokeDashoffset="80" strokeLinecap="round"/>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 32, fontWeight: 900, color: t.cyan, letterSpacing: -1, lineHeight: 1 }}>7</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: t.dim3, letterSpacing: 1, marginTop: 2 }}>SEC</div>
            </div>
          </div>
        </div>
        <Eyebrow color={t.dim3}>◆ Géographie</Eyebrow>
        <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 28, fontWeight: 400, letterSpacing: -0.8, lineHeight: 1.1, marginTop: 8, marginBottom: 26, textWrap: 'balance' }}>
          Quelle est la capitale de la <span style={{ color: t.cyan }}>Mongolie</span> ?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[{ a: 'A', x: 'Astana', p: false }, { a: 'B', x: 'Oulan-Bator', p: true }, { a: 'C', x: 'Bichkek', p: false }, { a: 'D', x: 'Douchanbé', p: false }].map(o => (
            <div key={o.a} style={{
              padding: '14px 16px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14,
              background: o.p ? `linear-gradient(90deg, ${t.cyan}30, ${t.cyan}10)` : 'rgba(255,255,255,0.05)',
              border: `1px solid ${o.p ? t.cyan : 'rgba(255,255,255,0.08)'}`,
            }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: o.p ? t.cyan : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, color: o.p ? t.abyss : t.dim2 }}>{o.a}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 600 }}>{o.x}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.dim3, letterSpacing: 1, textTransform: 'uppercase' }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: t.violet, animation: 'pulse 1.2s ease-in-out infinite' }}/>
          Maya réfléchit…
        </div>
      </div>
    </Frame2>
  );
}

function Game_B() {
  const t = T2();
  return (
    <Frame2>
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
        <div style={{ display: 'flex', gap: 3, marginBottom: 18, justifyContent: 'center' }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={{ width: 22, height: 5, borderRadius: 3, background: i < 2 ? t.mint : i === 2 ? t.gold : 'rgba(255,255,255,0.12)', boxShadow: i === 2 ? `0 0 6px ${t.gold}` : 'none' }}/>
          ))}
        </div>
        <div style={{ position: 'relative', height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 22 }}>
          <div style={{ width: '30%', height: '100%', background: `linear-gradient(90deg, ${t.fire}, ${t.red})`, boxShadow: `0 0 12px ${t.red}`, animation: 'pulse 0.6s ease-in-out infinite' }}/>
          <div style={{ position: 'absolute', right: 6, top: -14, fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 11, color: t.red }}>3s</div>
        </div>
        <div style={{ padding: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, marginBottom: 14 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 10, fontWeight: 900, letterSpacing: 2, color: t.gold, textTransform: 'uppercase', marginBottom: 8 }}>◆ Géographie · Q3</div>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900, letterSpacing: -1, lineHeight: 1.05, textWrap: 'balance' }}>Quelle est la capitale de la Mongolie ?</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[{ a: 'A', x: 'Astana', c: t.cyan }, { a: 'B', x: 'Oulan-Bator', c: t.mint, ok: true }, { a: 'C', x: 'Bichkek', c: t.violet }, { a: 'D', x: 'Douchanbé', c: t.gold }].map(o => (
            <div key={o.a} style={{
              padding: '18px 12px', borderRadius: 16, textAlign: 'center',
              background: o.ok ? `linear-gradient(135deg, ${o.c}, ${o.c}80)` : `${o.c}20`,
              border: `2px solid ${o.ok ? o.c : o.c + '50'}`, boxShadow: o.ok ? `0 8px 24px ${o.c}60` : 'none',
              minHeight: 90, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
            }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 11, color: o.ok ? t.abyss : o.c, letterSpacing: 1 }}>{o.a}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15, color: o.ok ? t.abyss : '#fff' }}>{o.x}</div>
            </div>
          ))}
        </div>
      </div>
    </Frame2>
  );
}

// 05 · RESULTS
function Results_A() {
  const t = T2();
  return (
    <Frame2>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at top, ${t.gold}30, transparent 60%), linear-gradient(180deg, ${t.abyss}, ${t.night})` }}/>
      <Stars count={25} opacity={0.6}/>
      <div style={{ position: 'absolute', inset: 0, padding: '60px 28px 32px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <Eyebrow color={t.gold}>◆ Victoire</Eyebrow>
          <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 60, fontWeight: 400, letterSpacing: -2, lineHeight: 1, marginTop: 6 }}>Bravo.</div>
          <div style={{ fontFamily: 'Inter', fontSize: 13, color: t.dim2, marginTop: 8, lineHeight: 1.5 }}>Tu as remporté ton duel contre <span style={{ color: t.violet, fontWeight: 600 }}>Maya</span> en 6&nbsp;manches.</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', inset: -30, borderRadius: '50%', background: `radial-gradient(circle, ${t.gold}50, transparent 70%)` }}/>
            <div style={{ width: 130, height: 130, borderRadius: '50%', background: `linear-gradient(135deg, ${t.gold}, #D18A1E)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 6px ${t.gold}20, 0 16px 40px ${t.gold}60`, position: 'relative' }}>
              <SwordMark size={72} color="#fff"/>
            </div>
          </div>
        </div>
        <div style={{ padding: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar size={36} color={t.cyan} letter="L"/><div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14 }}>Toi</div></div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 12, fontWeight: 700, color: t.dim3 }}>VS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row-reverse' }}><Avatar size={36} color={t.violet} letter="M"/><div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14 }}>Maya</div></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 40, color: t.cyan, letterSpacing: -1 }}>7</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.dim3 }}>— ——</div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 40, color: t.violet, letterSpacing: -1 }}>4</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          {[{ l: 'Victoire', v: '+80', c: t.gold }, { l: 'Précision', v: '+24', c: t.mint }, { l: 'Streak ×7', v: '+20', c: t.fire }].map(r => (
            <div key={r.l} style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 12, textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 1, textTransform: 'uppercase' }}>{r.l}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 18, color: r.c, marginTop: 2 }}>{r.v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PrimaryBtn variant="A">Rejouer Maya →</PrimaryBtn>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 13, color: t.dim3, textAlign: 'center' }}>Retour à l'accueil</div>
        </div>
      </div>
    </Frame2>
  );
}

function Results_B() {
  const t = T2();
  return (
    <Frame2>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 30%, ${t.gold}60 0%, ${t.fire}30 30%, ${t.abyss} 70%)` }}/>
      {Array.from({ length: 24 }, (_, i) => {
        const colors = [t.cyan, t.violet, t.gold, t.fire, t.mint];
        return <div key={i} style={{ position: 'absolute', left: `${(i * 37) % 100}%`, top: `${(i * 17) % 50}%`, width: 8, height: 12, background: colors[i % 5], transform: `rotate(${(i * 47) % 360}deg)`, opacity: 0.7, borderRadius: 2 }}/>;
      })}
      <Stars count={30} opacity={0.7}/>
      <div style={{ position: 'absolute', inset: 0, padding: '60px 20px 28px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', background: t.gold, color: t.abyss, fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 10, letterSpacing: 3, borderRadius: 20, textTransform: 'uppercase' }}>◆ Flawless</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 72, letterSpacing: -3, lineHeight: 0.9, marginTop: 10, color: '#fff', textShadow: `0 0 40px ${t.gold}` }}>VICTOIRE</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.gold, letterSpacing: 2, marginTop: 4 }}>+124 XP · NIVEAU 12 → 13 ?</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24 }}>
          <div style={{ flex: 1, padding: 16, borderRadius: 20, background: `linear-gradient(135deg, ${t.cyan}50, ${t.cyan}10)`, border: `2px solid ${t.cyan}`, textAlign: 'center' }}>
            <Avatar size={48} color={t.cyan} letter="L"/>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 44, color: '#fff', letterSpacing: -2, lineHeight: 1, marginTop: 8 }}>7</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.cyan, letterSpacing: 1, fontWeight: 700 }}>WINNER</div>
          </div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, color: t.gold }}>VS</div>
          <div style={{ flex: 1, padding: 16, borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.08)', textAlign: 'center', opacity: 0.6 }}>
            <Avatar size={48} color={t.violet} letter="M"/>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 44, color: '#fff', letterSpacing: -2, lineHeight: 1, marginTop: 8 }}>4</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim2, letterSpacing: 1, fontWeight: 700 }}>LOST</div>
          </div>
        </div>
        <div style={{ marginTop: 18, padding: 14, background: 'rgba(0,0,0,0.4)', borderRadius: 14, border: `1px solid ${t.gold}40` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 11 }}>
            <div style={{ color: t.gold }}>LV 12</div><div style={{ color: t.dim2 }}>2 840 / 3 000 XP</div><div style={{ color: t.dim2 }}>LV 13</div>
          </div>
          <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ width: '94%', height: '100%', background: `linear-gradient(90deg, ${t.cyan}, ${t.gold})`, boxShadow: `0 0 10px ${t.gold}` }}/>
          </div>
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, padding: '16px', background: 'rgba(255,255,255,0.06)', borderRadius: 14, textAlign: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, border: '1px solid rgba(255,255,255,0.1)' }}>Accueil</div>
          <div style={{ flex: 2 }}><PrimaryBtn variant="B" style={{ padding: 14 }}>◆ Revanche</PrimaryBtn></div>
        </div>
      </div>
    </Frame2>
  );
}

// 06 · THEMES
const THEMES_DATA = [
  { n: 'Géographie', i: '🌍', c: '#00E5FF', stat: '62 duels' },
  { n: 'Histoire', i: '⚱', c: '#FFB547', stat: '48 duels' },
  { n: 'Cinéma', i: '🎬', c: '#B366FF', stat: '91 duels' },
  { n: 'Sciences', i: '⚛', c: '#32E7A3', stat: '27 duels' },
  { n: 'Sport', i: '⚽', c: '#FF6B2C', stat: '54 duels' },
  { n: 'Musique', i: '♪', c: '#FF3D5E', stat: '73 duels' },
];

function Themes_A() {
  const t = T2();
  return (
    <Frame2>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <Stars count={15} opacity={0.3}/>
      <div style={{ position: 'absolute', inset: 0, padding: '60px 20px 100px', overflowY: 'auto' }}>
        <Eyebrow color={t.dim3}>◆ Catégories</Eyebrow>
        <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 36, fontWeight: 400, letterSpacing: -1.2, lineHeight: 1, marginTop: 6, marginBottom: 24 }}>Choisis ton<br/>terrain de duel.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {THEMES_DATA.map(th => (
            <div key={th.n} style={{ padding: 16, borderRadius: 18, aspectRatio: '1 / 1.1', background: `linear-gradient(180deg, ${th.c}25, ${th.c}08)`, border: `1px solid ${th.c}40`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 36, lineHeight: 1 }}>{th.i}</div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15, letterSpacing: -0.3 }}>{th.n}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: th.c, letterSpacing: 1, marginTop: 2 }}>{th.stat}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <NavBar active="play" variant="A"/>
    </Frame2>
  );
}

function Themes_B() {
  const t = T2();
  return (
    <Frame2>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', inset: 0, padding: '56px 14px 100px', overflowY: 'auto' }}>
        <div style={{ padding: '0 6px 14px' }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 11, letterSpacing: 2.5, color: t.gold, textTransform: 'uppercase' }}>◆ Arène</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 30, letterSpacing: -1.2, marginTop: 4, textTransform: 'uppercase', lineHeight: 0.95 }}>Choisis ton<br/>champ de bataille</div>
        </div>
        <div style={{ padding: 20, borderRadius: 20, marginBottom: 10, background: `linear-gradient(135deg, ${t.violet}, ${t.cyan})`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -10, fontSize: 140, opacity: 0.15 }}>🎬</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#000', letterSpacing: 2, fontWeight: 700 }}>◆ POPULAR</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 36, color: '#000', letterSpacing: -1.5, lineHeight: 1, marginTop: 6 }}>CINÉMA</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, color: '#000', opacity: 0.7, marginTop: 4 }}>91 joueurs en live · ta meilleure catégorie</div>
          <div style={{ display: 'inline-block', padding: '8px 14px', background: '#000', color: '#fff', borderRadius: 10, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12, marginTop: 12 }}>DUEL →</div>
        </div>
        {THEMES_DATA.filter(th => th.n !== 'Cinéma').map(th => (
          <div key={th.n} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', marginBottom: 8, borderRadius: 14, background: `${th.c}15`, border: `1.5px solid ${th.c}40` }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: `${th.c}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, border: `1px solid ${th.c}60` }}>{th.i}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 15, letterSpacing: -0.3, textTransform: 'uppercase' }}>{th.n}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: th.c, letterSpacing: 1, fontWeight: 700 }}>{th.stat}</div>
            </div>
            <div style={{ color: th.c, fontSize: 20, fontWeight: 900 }}>→</div>
          </div>
        ))}
      </div>
      <NavBar active="play" variant="B"/>
    </Frame2>
  );
}

Object.assign(window, { Game_A, Game_B, Results_A, Results_B, Themes_A, Themes_B });
