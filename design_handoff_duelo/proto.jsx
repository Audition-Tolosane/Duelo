// ============================================================================
// INTERACTIVE PROTOTYPE — Quiz → Results with animations
// ============================================================================
const TP = () => window.DUELO_TOKENS;

function InteractiveProto() {
  const [phase, setPhase] = React.useState('quiz'); // quiz | feedback | transition | results
  const [picked, setPicked] = React.useState(null);
  const [timer, setTimer] = React.useState(10);
  const [score, setScore] = React.useState({ you: 2, opp: 1 });
  const [scorePopping, setScorePopping] = React.useState(false);
  const [xpCount, setXpCount] = React.useState(0);
  const CORRECT = 'B';

  React.useEffect(() => {
    if (phase !== 'quiz') return;
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer, phase]);

  const onPick = (letter) => {
    if (phase !== 'quiz') return;
    setPicked(letter);
    setPhase('feedback');
    if (letter === CORRECT) {
      setScorePopping(true);
      setTimeout(() => setScore(s => ({ ...s, you: s.you + 1 })), 300);
      setTimeout(() => setScorePopping(false), 900);
    }
    setTimeout(() => setPhase('transition'), 1400);
    setTimeout(() => setPhase('results'), 2400);
  };

  React.useEffect(() => {
    if (phase !== 'results') return;
    let start = 0;
    const target = 124;
    const step = () => {
      start += 4;
      if (start >= target) { setXpCount(target); return; }
      setXpCount(start);
      requestAnimationFrame(step);
    };
    const id = setTimeout(step, 300);
    return () => clearTimeout(id);
  }, [phase]);

  const reset = () => {
    setPhase('quiz'); setPicked(null); setTimer(10);
    setScore({ you: 2, opp: 1 }); setXpCount(0);
  };

  return (
    <Phone label="Quiz → Victoire · cliquable" variant="PROTOTYPE LIVE">
      {phase !== 'results' && phase !== 'transition' && (
        <ProtoQuiz phase={phase} picked={picked} timer={timer} score={score} scorePopping={scorePopping} onPick={onPick} correct={CORRECT}/>
      )}
      {phase === 'transition' && <ProtoTransition/>}
      {phase === 'results' && <ProtoResults xpCount={xpCount} onReset={reset}/>}
    </Phone>
  );
}

function ProtoQuiz({ phase, picked, timer, score, scorePopping, onPick, correct }) {
  const t = TP();
  const urgent = timer <= 3;
  return (
    <div style={{ position: 'absolute', inset: 0, color: '#fff' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${t.cyan}20, ${t.abyss} 30%, ${t.abyss} 70%, ${t.violet}20)` }}/>
      <Stars count={20} opacity={0.5}/>
      <div style={{ position: 'absolute', inset: 0, padding: '50px 16px 20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, padding: '10px 12px', borderRadius: 12, background: `${t.cyan}15`, border: `1px solid ${t.cyan}60`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar size={30} color={t.cyan} letter="L"/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.cyan, letterSpacing: 1 }}>TOI</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, lineHeight: 1, animation: scorePopping ? 'scorePop 0.8s ease-out' : 'none', display: 'inline-block' }}>{score.you}</div>
            </div>
          </div>
          <div style={{ flex: 1, padding: '10px 12px', borderRadius: 12, background: `${t.violet}15`, border: `1px solid ${t.violet}60`, display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row-reverse' }}>
            <Avatar size={30} color={t.violet} letter="M"/>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.violet, letterSpacing: 1 }}>MAYA</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, lineHeight: 1 }}>{score.opp}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 3, marginBottom: 16, justifyContent: 'center' }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={{ width: 22, height: 5, borderRadius: 3, background: i < 2 ? t.mint : i === 2 ? t.gold : 'rgba(255,255,255,0.12)', boxShadow: i === 2 ? `0 0 6px ${t.gold}` : 'none' }}/>
          ))}
        </div>
        {/* timer rond (repris de VAR A), passe rouge sous 3s */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <div style={{ position: 'relative', width: 78, height: 78 }}>
            <svg width="78" height="78" viewBox="0 0 78 78" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
              <circle cx="39" cy="39" r="34" stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="none"/>
              <circle cx="39" cy="39" r="34" stroke={urgent ? t.red : t.cyan} strokeWidth="4" fill="none" strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - timer / 10)} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${urgent ? t.red : t.cyan})`, transition: 'stroke-dashoffset 0.9s linear' }}/>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: urgent ? 'pulse 0.6s ease-in-out infinite' : 'none' }}>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 900, color: urgent ? t.red : t.cyan, letterSpacing: -1, lineHeight: 1 }}>{timer}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: t.dim3, letterSpacing: 1, marginTop: 1 }}>SEC</div>
            </div>
          </div>
        </div>
        <div style={{ padding: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, marginBottom: 14 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: t.gold, textTransform: 'uppercase', marginBottom: 6 }}>◆ Géo · Q3</div>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 900, letterSpacing: -0.8, lineHeight: 1.1 }}>Capitale de la Mongolie ?</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[{ a: 'A', x: 'Astana', c: t.cyan }, { a: 'B', x: 'Oulan-Bator', c: t.mint }, { a: 'C', x: 'Bichkek', c: t.violet }, { a: 'D', x: 'Douchanbé', c: t.gold }].map(o => {
            const isPicked = picked === o.a;
            const isCorrect = o.a === correct;
            const showFeedback = phase === 'feedback';
            let bg, border, txtColor = '#fff';
            if (showFeedback && isCorrect) { bg = `linear-gradient(135deg, ${t.mint}, ${t.mint}80)`; border = t.mint; txtColor = t.abyss; }
            else if (showFeedback && isPicked && !isCorrect) { bg = `linear-gradient(135deg, ${t.red}, ${t.red}80)`; border = t.red; txtColor = t.abyss; }
            else { bg = `${o.c}20`; border = `${o.c}50`; }
            return (
              <div key={o.a} onClick={() => onPick(o.a)} style={{
                padding: '16px 12px', borderRadius: 16, textAlign: 'center', background: bg, border: `2px solid ${border}`,
                boxShadow: showFeedback && isCorrect ? `0 8px 24px ${t.mint}60` : 'none',
                minHeight: 84, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
                cursor: 'pointer', transition: 'all 0.3s', transform: showFeedback && isPicked ? 'scale(1.03)' : 'scale(1)',
              }}>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 11, color: txtColor === '#fff' ? o.c : t.abyss, letterSpacing: 1 }}>{o.a}</div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14, color: txtColor }}>{o.x}</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 'auto', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 1, textTransform: 'uppercase', paddingTop: 12 }}>
          {phase === 'quiz' ? '↑ Choisis une réponse' : picked === correct ? '✓ Bonne réponse !' : '✗ Raté…'}
        </div>
      </div>
    </div>
  );
}

function ProtoTransition() {
  const t = TP();
  return (
    <div style={{ position: 'absolute', inset: 0, background: t.abyss, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', borderRadius: '50%', animation: 'ringExpand 1s ease-out forwards' }}/>
      <div style={{ textAlign: 'center', animation: 'heroIn 0.9s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.gold, letterSpacing: 3, fontWeight: 700 }}>◆ WIN</div>
        <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 56, fontWeight: 400, letterSpacing: -2, color: '#fff', marginTop: 8 }}>Bravo.</div>
      </div>
    </div>
  );
}

function ProtoResults({ xpCount, onReset }) {
  const t = TP();
  return (
    <div style={{ position: 'absolute', inset: 0, color: '#fff', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 30%, ${t.gold}60 0%, ${t.fire}30 30%, ${t.abyss} 70%)`, animation: 'fadeIn 0.5s ease-out' }}/>
      {Array.from({ length: 30 }, (_, i) => {
        const colors = [t.cyan, t.violet, t.gold, t.fire, t.mint];
        const delay = (i * 0.08);
        const duration = 2.5 + (i % 5) * 0.4;
        return <div key={i} style={{ position: 'absolute', left: `${(i * 13) % 100}%`, top: `-5%`, width: 6 + (i % 3) * 2, height: 10 + (i % 3) * 3, background: colors[i % 5], opacity: 0.8, borderRadius: 2, animation: `confetti ${duration}s ease-in ${delay}s infinite` }}/>;
      })}
      <Stars count={20} opacity={0.5}/>
      <div style={{ position: 'absolute', inset: 0, padding: '60px 20px 24px', display: 'flex', flexDirection: 'column', animation: 'fadeSlide 0.6s ease-out' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: '5px 14px', background: t.gold, color: t.abyss, fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 10, letterSpacing: 2.5, borderRadius: 20, textTransform: 'uppercase', animation: 'scaleIn 0.4s ease-out 0.3s both' }}>◆ Victoire</div>
          <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 52, fontWeight: 400, letterSpacing: -2, lineHeight: 0.95, marginTop: 10, color: '#fff' }}>Bravo, Léo.</div>
          <div style={{ fontFamily: 'Inter', fontSize: 12, color: t.dim2, marginTop: 8 }}>Tu as battu <span style={{ color: '#fff', fontWeight: 600 }}>Maya</span></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22, animation: 'fadeSlide 0.6s ease-out 0.2s both' }}>
          <div style={{ flex: 1, padding: 14, borderRadius: 18, background: `linear-gradient(135deg, ${t.cyan}50, ${t.cyan}10)`, border: `2px solid ${t.cyan}`, textAlign: 'center' }}>
            <Avatar size={40} color={t.cyan} letter="L"/>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 36, letterSpacing: -1.5, lineHeight: 1, marginTop: 6 }}>7</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.cyan, letterSpacing: 1, fontWeight: 700 }}>WIN</div>
          </div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 18, color: t.gold }}>VS</div>
          <div style={{ flex: 1, padding: 14, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.08)', textAlign: 'center', opacity: 0.6 }}>
            <Avatar size={40} color={t.violet} letter="M"/>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 36, letterSpacing: -1.5, lineHeight: 1, marginTop: 6 }}>4</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim2, letterSpacing: 1, fontWeight: 700 }}>LOST</div>
          </div>
        </div>
        <div style={{ marginTop: 14, padding: 14, background: 'rgba(0,0,0,0.35)', border: `1px solid ${t.gold}40`, borderRadius: 14, animation: 'fadeSlide 0.6s ease-out 0.4s both' }}>
          {[['Base', '+50'], ['Victoire', '+30'], ['Précision', '+24', t.mint], ['Série ×7', '+20', t.fire]].map(([l, v, c], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 3 ? `1px solid rgba(255,255,255,0.06)` : 'none' }}>
              <span style={{ fontFamily: 'Inter', fontSize: 12, color: c || t.dim2 }}>{l}</span>
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, color: c || '#fff' }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 2, borderTop: `1px solid ${t.gold}50` }}>
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 13, color: '#fff', letterSpacing: 0.5 }}>TOTAL</span>
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 20, color: t.gold }}>+{xpCount} XP</span>
          </div>
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', gap: 8, animation: 'fadeSlide 0.6s ease-out 0.6s both' }}>
          <div onClick={onReset} style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.08)', borderRadius: 14, textAlign: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}>↻ Rejouer</div>
          <div onClick={onReset} style={{ flex: 2, padding: '14px', background: `linear-gradient(135deg, ${t.cyan}, ${t.violet})`, color: '#000', borderRadius: 14, textAlign: 'center', fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', boxShadow: `0 12px 30px ${t.cyan}40` }}>◆ Revanche</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { InteractiveProto });
