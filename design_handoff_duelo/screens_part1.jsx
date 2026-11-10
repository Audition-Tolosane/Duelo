// ============================================================================
// DUELO SCREENS — PART 1 : Onboarding, Accueil, Matchmaking
// VAR A = Editorial · clean · serif moments · glass
// VAR B = Arcade · bold · gamified · solid gradients
// ============================================================================
const T = () => window.DUELO_TOKENS;

function Frame({ children, style = {} }) {
  return <div style={{ position: 'absolute', inset: 0, color: '#fff', ...style }}>{children}</div>;
}

// 01 · ONBOARDING
function Onboarding_A() {
  const t = T();
  return (
    <Frame>
      <CosmicBg variant="A"/>
      <div style={{ position: 'absolute', inset: 0, padding: '80px 32px 32px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 28 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', inset: -40, borderRadius: '50%', background: `radial-gradient(circle, ${t.cyan}30, transparent 70%)` }}/>
            <SwordMark size={100}/>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Eyebrow color={t.gold}>◆ Bienvenue</Eyebrow>
            <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 48, fontWeight: 400, letterSpacing: -1.5, lineHeight: 0.95, marginTop: 14, textWrap: 'balance' }}>
              Affronte des amis<br/>dans des <span style={{ color: t.cyan }}>duels</span><br/>de culture.
            </div>
          </div>
          <div style={{ fontFamily: 'Inter', fontSize: 14, color: t.dim2, textAlign: 'center', maxWidth: 280, lineHeight: 1.55 }}>
            Quiz en 1v1, timer de 10 secondes, le plus rapide et précis remporte la manche.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PrimaryBtn variant="A">Commencer →</PrimaryBtn>
          <div style={{ textAlign: 'center', fontFamily: 'Inter', fontSize: 12, color: t.dim3 }}>J'ai déjà un compte</div>
        </div>
      </div>
    </Frame>
  );
}

function Onboarding_B() {
  const t = T();
  return (
    <Frame>
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
            <div style={{
              width: 180, height: 180, borderRadius: '50%',
              background: `conic-gradient(from 0deg, ${t.cyan}, ${t.violet}, ${t.gold}, ${t.cyan})`,
              padding: 4, position: 'relative', animation: 'pulse 4s ease-in-out infinite',
            }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: t.abyss, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SwordMark size={110}/>
              </div>
            </div>
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                position: 'absolute', top: '50%', left: '50%',
                width: 4, height: 4, borderRadius: 2, background: t.gold,
                transform: `rotate(${i*90}deg) translateY(-110px)`, boxShadow: `0 0 8px ${t.gold}`,
              }}/>
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
    </Frame>
  );
}

// 02 · ACCUEIL
function Accueil_A() {
  const t = T();
  return (
    <Frame>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${t.abyss} 0%, ${t.abyss} 40%, ${t.night} 100%)` }}/>
      <Stars count={20} opacity={0.5}/>
      <div style={{ position: 'absolute', inset: 0, padding: '56px 20px 100px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar size={38} color={t.cyan} letter="L"/>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 1.5, textTransform: 'uppercase' }}>Bonjour</div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 700 }}>Léo</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'rgba(255,181,71,0.12)', borderRadius: 12, border: `1px solid ${t.gold}40` }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: t.gold }}/>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12, color: t.gold }}>2 840</div>
          </div>
        </div>

        <div style={{
          padding: '24px 20px', borderRadius: 22, marginBottom: 22,
          background: `linear-gradient(135deg, ${t.violet}30, ${t.cyan}20)`,
          border: '1px solid rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -20, opacity: 0.3 }}><SwordMark size={140}/></div>
          <Eyebrow color={t.cyan}>◆ Quick match</Eyebrow>
          <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 30, fontWeight: 400, letterSpacing: -1, lineHeight: 1, marginTop: 8, textWrap: 'balance' }}>
            Un duel t'attend.
          </div>
          <div style={{ fontFamily: 'Inter', fontSize: 12, color: t.dim2, marginTop: 6, marginBottom: 16 }}>Trouve un adversaire en ~8s</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, padding: '12px 14px', background: '#fff', color: t.abyss, borderRadius: 12, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, textAlign: 'center' }}>Jouer →</div>
            <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.08)', borderRadius: 12, fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, border: '1px solid rgba(255,255,255,0.1)' }}>Ami</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>Tes duels</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.dim3, letterSpacing: 1, textTransform: 'uppercase' }}>3 actifs</div>
        </div>
        {[
          { n: 'Maya', c: t.violet, l: 'M', s: 'À ton tour', r: '2–1', u: true },
          { n: 'Théo', c: t.gold, l: 'T', s: 'En attente', r: '0–0', u: false },
          { n: 'Inès', c: t.mint, l: 'I', s: 'À ton tour', r: '1–2', u: true },
        ].map((d, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8, borderRadius: 14,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${d.u ? t.cyan + '40' : 'rgba(255,255,255,0.06)'}`,
          }}>
            <Avatar size={40} color={d.c} letter={d.l}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14 }}>{d.n}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                {d.u && <div style={{ width: 6, height: 6, borderRadius: 3, background: t.cyan, boxShadow: `0 0 6px ${t.cyan}` }}/>}
                <div style={{ fontFamily: 'Inter', fontSize: 11, color: d.u ? t.cyan : t.dim3 }}>{d.s}</div>
              </div>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: d.u ? '#fff' : t.dim2 }}>{d.r}</div>
          </div>
        ))}
      </div>
      <NavBar active="home" variant="A"/>
    </Frame>
  );
}

function Accueil_B() {
  const t = T();
  return (
    <Frame>
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

        <div style={{
          padding: 24, borderRadius: 24, marginBottom: 20, textAlign: 'center',
          background: `linear-gradient(135deg, ${t.cyan}, ${t.violet})`,
          boxShadow: `0 16px 40px ${t.violet}60`, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -20, right: -10, opacity: 0.2 }}><SwordMark size={140} color="#fff"/></div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 12, letterSpacing: 2, color: '#000', textTransform: 'uppercase', opacity: 0.7 }}>Quick match</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 42, letterSpacing: -2, color: '#000', marginTop: 4, lineHeight: 1 }}>DUEL !</div>
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
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8, borderRadius: 14,
            background: d.bg ? d.bg + '15' : 'rgba(255,255,255,0.04)', border: `2px solid ${d.bg ? d.bg : 'rgba(255,255,255,0.04)'}`,
          }}>
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
    </Frame>
  );
}

// 03 · MATCHMAKING
function Matchmaking_A() {
  const t = T();
  return (
    <Frame>
      <CosmicBg variant="A"/>
      <div style={{ position: 'absolute', inset: 0, padding: '60px 28px 40px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <Eyebrow color={t.cyan}>◆ Matchmaking</Eyebrow>
          <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 30, fontWeight: 400, letterSpacing: -1, marginTop: 8 }}>
            À la recherche d'un<br/><span style={{ color: t.cyan }}>adversaire digne</span>…
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          {[180, 240, 300].map((s, i) => (
            <div key={i} style={{
              position: 'absolute', width: s, height: s, borderRadius: '50%',
              border: `1px solid ${t.cyan}${i === 0 ? '60' : i === 1 ? '30' : '15'}`,
              animation: `pingRing ${3 + i * 0.5}s ease-out infinite ${i * 0.4}s`,
            }}/>
          ))}
          <div style={{ position: 'relative' }}>
            <Avatar size={90} color={t.cyan} letter="L" ring ringColor={t.cyan}/>
            <div style={{ position: 'absolute', bottom: -24, left: '50%', transform: 'translateX(-50%)', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12, color: t.cyan, whiteSpace: 'nowrap' }}>TOI · 2 840</div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.dim3, letterSpacing: 2, textTransform: 'uppercase' }}>ESTIMATION · 8s</div>
        </div>
        <div style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.06)', borderRadius: 14, textAlign: 'center', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: t.dim2, border: '1px solid rgba(255,255,255,0.08)' }}>Annuler</div>
      </div>
    </Frame>
  );
}

function Matchmaking_B() {
  const t = T();
  return (
    <Frame>
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
    </Frame>
  );
}

Object.assign(window, { Onboarding_A, Onboarding_B, Accueil_A, Accueil_B, Matchmaking_A, Matchmaking_B });
