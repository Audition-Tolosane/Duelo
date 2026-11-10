// ============================================================================
// DUELO — SUITE LOT 1 : Social / joueurs
// Conversations, Chat (interactif), Followers, Players, Player-profile,
// Recherche (interactif), Notifications
// ============================================================================
const TS = () => window.DUELO_TOKENS;
function FrameS({ children }) {
  return <div style={{ position: 'absolute', inset: 0, color: '#fff' }}>{children}</div>;
}

// En-tête de page interne (avec retour)
function PageHead({ title, sub, right }) {
  const t = TS();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
      </div>
      <div style={{ flex: 1 }}>
        {sub && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 2, textTransform: 'uppercase' }}>{sub}</div>}
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 24, letterSpacing: -0.8 }}>{title}</div>
      </div>
      {right}
    </div>
  );
}

const CONVOS = [
  { n: 'Maya Chen', c: '#B366FF', l: 'M', msg: 'GG pour le dernier duel 🔥', time: '2min', unread: 2, online: true },
  { n: 'Théo Moreau', c: '#FFB547', l: 'T', msg: 'Tu rejoues ce soir ?', time: '1h', unread: 0, online: true },
  { n: 'Inès P.', c: '#32E7A3', l: 'I', msg: 'Trop fort en géo toi 😤', time: '3h', unread: 0, online: false },
  { n: 'NovaPlay', c: '#00E5FF', l: 'N', msg: 'Tu m\'as envoyé un défi ?', time: '1j', unread: 0, online: false },
  { n: 'Phoenix', c: '#FF6B2C', l: 'P', msg: 'Revanche demain 💪', time: '2j', unread: 0, online: false },
];

// 01 · CONVERSATIONS
function S_Conversations() {
  const t = TS();
  return (
    <FrameS>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, background: `linear-gradient(180deg, ${t.violet}25, transparent)` }}/>
      <Stars count={12} opacity={0.3}/>
      <div style={{ position: 'absolute', inset: 0, padding: '56px 16px 100px', overflowY: 'auto' }}>
        <PageHead title="Messages" sub="◆ 5 conversations" right={
          <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${t.cyan}, ${t.violet})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </div>
        }/>
        {CONVOS.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px', borderRadius: 14, marginBottom: 4, background: c.unread ? `${t.cyan}10` : 'transparent' }}>
            <div style={{ position: 'relative' }}>
              <Avatar size={48} color={c.c} letter={c.l}/>
              {c.online && <div style={{ position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, background: t.mint, border: `2px solid ${t.abyss}` }}/>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15 }}>{c.n}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3 }}>{c.time}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                <div style={{ fontFamily: 'Inter', fontSize: 13, color: c.unread ? t.dim1 : t.dim3, fontWeight: c.unread ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{c.msg}</div>
                {c.unread > 0 && <div style={{ minWidth: 18, height: 18, borderRadius: 9, background: t.cyan, color: '#000', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{c.unread}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <NavBar active="home" variant="B"/>
    </FrameS>
  );
}

// 02 · CHAT (interactif)
function S_Chat() {
  const t = TS();
  const [messages, setMessages] = React.useState([
    { me: false, txt: 'GG pour le dernier duel 🔥', time: '14:02' },
    { me: true, txt: 'Merci ! T\'as failli m\'avoir sur la géo', time: '14:03' },
    { me: false, txt: 'La capitale de la Mongolie m\'a tué 😭', time: '14:03' },
    { me: true, txt: 'Oulan-Bator, je la connaissais par chance', time: '14:04' },
  ]);
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef(null);
  const send = () => {
    if (!input.trim()) return;
    setMessages(m => [...m, { me: true, txt: input, time: '14:05' }]);
    setInput('');
    setTimeout(() => {
      setMessages(m => [...m, { me: false, txt: 'Haha bien joué 😏 Revanche ?', time: '14:05' }]);
    }, 900);
  };
  React.useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);
  return (
    <FrameS>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <Stars count={10} opacity={0.25}/>
      {/* Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '50px 16px 12px', background: `linear-gradient(180deg, ${t.violet}25, ${t.abyss})`, zIndex: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
        <div style={{ position: 'relative' }}>
          <Avatar size={40} color="#B366FF" letter="M"/>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: 6, background: t.mint, border: `2px solid ${t.abyss}` }}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16 }}>Maya Chen</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.mint, letterSpacing: 1 }}>● EN LIGNE</div>
        </div>
        <div style={{ padding: '7px 12px', borderRadius: 10, background: `linear-gradient(135deg, ${t.cyan}, ${t.violet})`, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 11, color: '#000' }}>⚔ DÉFIER</div>
      </div>
      {/* Messages */}
      <div ref={scrollRef} style={{ position: 'absolute', top: 110, bottom: 76, left: 0, right: 0, padding: '12px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.me ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: 16, borderBottomRightRadius: m.me ? 4 : 16, borderBottomLeftRadius: m.me ? 16 : 4, background: m.me ? `linear-gradient(135deg, ${t.cyan}, ${t.violet})` : 'rgba(255,255,255,0.06)', border: m.me ? 'none' : '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontFamily: 'Inter', fontSize: 14, color: m.me ? '#000' : '#fff', lineHeight: 1.35 }}>{m.txt}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: m.me ? 'rgba(0,0,0,0.5)' : t.dim3, marginTop: 3, textAlign: 'right' }}>{m.time}</div>
            </div>
          </div>
        ))}
      </div>
      {/* Input */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px 24px', background: t.abyss, display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Message…" style={{ flex: 1, padding: '12px 16px', borderRadius: 22, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontFamily: 'Inter', fontSize: 14, outline: 'none' }}/>
        <div onClick={send} style={{ width: 44, height: 44, borderRadius: 22, background: `linear-gradient(135deg, ${t.cyan}, ${t.violet})`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#000"><path d="M3 20l18-8L3 4v6l12 2-12 2z"/></svg>
        </div>
      </div>
    </FrameS>
  );
}

// 03 · FOLLOWERS
function S_Followers() {
  const t = TS();
  const people = [
    { n: 'Maya Chen', c: '#B366FF', l: 'M', lv: 14, following: true },
    { n: 'Théo Moreau', c: '#FFB547', l: 'T', lv: 11, following: true },
    { n: 'NovaPlay', c: '#00E5FF', l: 'N', lv: 44, following: false },
    { n: 'Inès P.', c: '#32E7A3', l: 'I', lv: 9, following: true },
    { n: 'Phoenix', c: '#FF6B2C', l: 'P', lv: 40, following: false },
    { n: 'Orion', c: '#FF3D5E', l: 'O', lv: 38, following: false },
  ];
  return (
    <FrameS>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <Stars count={12} opacity={0.3}/>
      <div style={{ position: 'absolute', inset: 0, padding: '56px 16px 20px', overflowY: 'auto' }}>
        <PageHead title="Communauté" sub="◆ Léo"/>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, padding: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
          {['Abonnés · 248', 'Abonnements · 132'].map((tab, i) => (
            <div key={tab} style={{ flex: 1, padding: '9px 0', textAlign: 'center', background: i === 0 ? `linear-gradient(135deg, ${t.cyan}, ${t.violet})` : 'transparent', color: i === 0 ? '#000' : t.dim2, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12, borderRadius: 9 }}>{tab}</div>
          ))}
        </div>
        {people.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', marginBottom: 4 }}>
            <Avatar size={46} color={p.c} letter={p.l}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15 }}>{p.n}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.dim3, letterSpacing: 1 }}>NIVEAU {p.lv}</div>
            </div>
            <div style={{ padding: '8px 16px', borderRadius: 12, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12, background: p.following ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${t.cyan}, ${t.violet})`, color: p.following ? t.dim2 : '#000', border: p.following ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              {p.following ? 'Suivi' : '+ Suivre'}
            </div>
          </div>
        ))}
      </div>
      <NavBar active="rank" variant="B"/>
    </FrameS>
  );
}

// 04 · PLAYERS (onglet découverte)
function S_Players() {
  const t = TS();
  const suggested = [
    { n: 'NovaPlay', c: '#00E5FF', l: 'N', lv: 44, wr: '88%', mutual: 3 },
    { n: 'Phoenix', c: '#FF6B2C', l: 'P', lv: 40, wr: '81%', mutual: 1 },
    { n: 'Orion', c: '#FF3D5E', l: 'O', lv: 38, wr: '76%', mutual: 5 },
  ];
  return (
    <FrameS>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 220, background: `linear-gradient(180deg, ${t.cyan}20, transparent)` }}/>
      <Stars count={14} opacity={0.35}/>
      <div style={{ position: 'absolute', inset: 0, padding: '56px 16px 100px', overflowY: 'auto' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.cyan, letterSpacing: 2.5, fontWeight: 700, textTransform: 'uppercase' }}>◆ Joueurs</div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 30, letterSpacing: -1.2, marginTop: 4, marginBottom: 16, textTransform: 'uppercase' }}>Trouve un rival</div>
        {/* Search bar (faux) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 18 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.dim3} strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <span style={{ fontFamily: 'Inter', fontSize: 14, color: t.dim3 }}>Rechercher un pseudo…</span>
        </div>
        {/* Featured rival */}
        <div style={{ padding: 18, borderRadius: 20, marginBottom: 18, background: `linear-gradient(135deg, ${t.violet}40, ${t.cyan}20)`, border: `1px solid ${t.violet}50`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.gold, letterSpacing: 2, fontWeight: 700 }}>◆ RIVAL DU JOUR</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
            <Avatar size={56} color="#00E5FF" letter="N" ring ringColor={t.gold}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 18 }}>NovaPlay</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.dim2, letterSpacing: 1 }}>NIV 44 · 88% WR · même niveau en géo</div>
            </div>
          </div>
          <div style={{ marginTop: 14, padding: '12px', borderRadius: 12, background: '#000', textAlign: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, color: '#fff' }}>⚔ Défier maintenant</div>
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: t.dim2, marginBottom: 10 }}>Suggestions pour toi</div>
        {suggested.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, marginBottom: 6, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Avatar size={44} color={p.c} letter={p.l}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14 }}>{p.n}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 0.5 }}>NIV {p.lv} · {p.wr} · {p.mutual} amis communs</div>
            </div>
            <div style={{ padding: '8px 14px', borderRadius: 12, background: `linear-gradient(135deg, ${t.cyan}, ${t.violet})`, color: '#000', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12 }}>⚔</div>
          </div>
        ))}
      </div>
      <NavBar active="rank" variant="B"/>
    </FrameS>
  );
}

// 05 · PLAYER-PROFILE (profil d'un autre joueur)
function S_PlayerProfile() {
  const t = TS();
  return (
    <FrameS>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280, background: `linear-gradient(180deg, ${t.violet}50 0%, ${t.cyan}25 50%, transparent)` }}/>
      <Stars count={18} opacity={0.5}/>
      <div style={{ position: 'absolute', top: 50, left: 16, zIndex: 10 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
      </div>
      <div style={{ position: 'absolute', inset: 0, padding: '80px 16px 100px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Avatar size={92} color="#B366FF" letter="M" ring ringColor={t.gold}/>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 28, letterSpacing: -0.5, marginTop: 6 }}>Maya Chen 🇫🇷</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.gold, fontWeight: 700, letterSpacing: 2 }}>NIV 14 · MAÎTRE · RANG 8</div>
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <div style={{ flex: 2, padding: '14px', borderRadius: 14, background: `linear-gradient(135deg, ${t.cyan}, ${t.violet})`, color: '#000', textAlign: 'center', fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 14, letterSpacing: 1 }}>⚔ DÉFIER</div>
          <div style={{ flex: 1, padding: '14px', borderRadius: 14, background: 'rgba(255,255,255,0.08)', textAlign: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, border: '1px solid rgba(255,255,255,0.1)' }}>Suivre</div>
          <div style={{ padding: '14px', borderRadius: 14, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
        </div>
        {/* Head to head */}
        <div style={{ marginTop: 18, padding: 16, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: `1px solid ${t.gold}30` }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.gold, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>◆ Face à face</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 30, color: t.cyan }}>4</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3 }}>TOI</div></div>
            <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 20, color: t.dim3 }}>—</div>
            <div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 30, color: t.violet }}>6</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3 }}>MAYA</div></div>
          </div>
        </div>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
          {[{ l: 'DUELS', v: '312', c: t.cyan }, { l: 'WINS', v: '241', c: t.mint }, { l: 'STREAK', v: '12', c: t.fire }].map(s => (
            <div key={s.l} style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 12, textAlign: 'center', border: `1px solid ${s.c}25` }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, color: s.c }}>{s.v}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: t.dim3, letterSpacing: 1.5, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </FrameS>
  );
}

// 06 · SEARCH (interactif)
function S_Search() {
  const t = TS();
  const ALL = [
    { type: 'player', n: 'Maya Chen', c: '#B366FF', l: 'M', meta: 'NIV 14' },
    { type: 'player', n: 'NovaPlay', c: '#00E5FF', l: 'N', meta: 'NIV 44' },
    { type: 'theme', n: 'Cinéma 90s', c: '#B366FF', l: '🎬', meta: '120 quiz' },
    { type: 'theme', n: 'Géo du monde', c: '#00E5FF', l: '🌍', meta: '540 quiz' },
    { type: 'player', n: 'Phoenix', c: '#FF6B2C', l: 'P', meta: 'NIV 40' },
    { type: 'theme', n: 'Histoire de France', c: '#FFB547', l: '⚱', meta: '210 quiz' },
  ];
  const [q, setQ] = React.useState('');
  const filtered = q ? ALL.filter(x => x.n.toLowerCase().includes(q.toLowerCase())) : ALL;
  return (
    <FrameS>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <Stars count={10} opacity={0.25}/>
      <div style={{ position: 'absolute', inset: 0, padding: '50px 16px 20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M15 6l-6 6 6 6"/></svg>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: `1px solid ${t.cyan}50` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.cyan} strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Joueurs, thèmes…" style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontFamily: 'Inter', fontSize: 14, outline: 'none' }}/>
            {q && <div onClick={() => setQ('')} style={{ color: t.dim3, cursor: 'pointer', fontSize: 18 }}>×</div>}
          </div>
        </div>
        {!q && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Recherches populaires</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['Cinéma', 'Maya', 'Géographie', 'Tournoi', 'Sport'].map(tag => (
                <div key={tag} onClick={() => setQ(tag)} style={{ padding: '7px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>{tag}</div>
              ))}
            </div>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {q && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</div>}
          {filtered.map((x, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', marginBottom: 4, borderRadius: 12 }}>
              {x.type === 'player'
                ? <Avatar size={42} color={x.c} letter={x.l}/>
                : <div style={{ width: 42, height: 42, borderRadius: 12, background: `${x.c}25`, border: `1px solid ${x.c}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{x.l}</div>}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14 }}>{x.n}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 1 }}>{x.type === 'player' ? '👤 JOUEUR' : '◆ THÈME'} · {x.meta}</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.dim3} strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg>
            </div>
          ))}
          {q && filtered.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: 40, fontFamily: 'Inter', fontSize: 14, color: t.dim3 }}>Aucun résultat pour « {q} »</div>
          )}
        </div>
      </div>
    </FrameS>
  );
}

// 07 · NOTIFICATIONS
function S_Notifications() {
  const t = TS();
  const notifs = [
    { icon: '⚔', c: '#00E5FF', txt: 'Maya t\'a défié en Géographie', time: '2min', unread: true, cta: 'Accepter' },
    { icon: '🏆', c: '#FFB547', txt: 'Tu es monté à la 12e place mondiale !', time: '1h', unread: true },
    { icon: '🔥', c: '#FF6B2C', txt: 'Streak de 7 jours atteinte · +25 XP', time: '3h', unread: false },
    { icon: '👤', c: '#B366FF', txt: 'NovaPlay a commencé à te suivre', time: '5h', unread: false, cta: 'Suivre' },
    { icon: '⭐', c: '#32E7A3', txt: 'Nouveau niveau débloqué : Érudit', time: '1j', unread: false },
    { icon: '🎁', c: '#FF3D5E', txt: 'Récompense quotidienne disponible', time: '1j', unread: false },
  ];
  return (
    <FrameS>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180, background: `linear-gradient(180deg, ${t.cyan}20, transparent)` }}/>
      <Stars count={12} opacity={0.3}/>
      <div style={{ position: 'absolute', inset: 0, padding: '56px 16px 20px', overflowY: 'auto' }}>
        <PageHead title="Notifications" sub="◆ 2 non lues" right={
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 11, color: t.cyan }}>Tout lire</div>
        }/>
        {notifs.map((n, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, marginBottom: 6, borderRadius: 14, background: n.unread ? `${t.cyan}10` : 'transparent', border: `1px solid ${n.unread ? t.cyan + '30' : 'transparent'}` }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${n.c}20`, border: `1px solid ${n.c}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{n.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Inter', fontSize: 13, color: n.unread ? '#fff' : t.dim2, fontWeight: n.unread ? 600 : 400, lineHeight: 1.35 }}>{n.txt}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 1, marginTop: 3 }}>{n.time}</div>
            </div>
            {n.cta && <div style={{ padding: '7px 12px', borderRadius: 10, background: `linear-gradient(135deg, ${t.cyan}, ${t.violet})`, color: '#000', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 11, flexShrink: 0 }}>{n.cta}</div>}
          </div>
        ))}
      </div>
      <NavBar active="home" variant="B"/>
    </FrameS>
  );
}

Object.assign(window, { S_Conversations, S_Chat, S_Followers, S_Players, S_PlayerProfile, S_Search, S_Notifications, PageHead });
