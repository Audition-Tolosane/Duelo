// ========== Phone frame ==========
function Phone({ children, label, variant }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 390, height: 780, borderRadius: 52,
        background: '#0A0A1A', padding: 11, position: 'relative',
        boxShadow: '0 40px 80px rgba(0,0,0,0.15), 0 2px 0 rgba(255,255,255,0.05) inset, 0 0 0 2px rgba(0,0,0,0.08)',
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: 42,
          overflow: 'hidden', position: 'relative', background: '#050510',
        }}>
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            width: 110, height: 28, background: '#000', borderRadius: 20, zIndex: 100,
          }}/>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 44,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0 30px', zIndex: 90, color: '#fff', fontFamily: 'Space Grotesk',
            fontSize: 13, fontWeight: 700,
          }}>
            <div>9:41</div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', opacity: 0.9 }}>
              <svg width="16" height="10" viewBox="0 0 16 10" fill="none"><path d="M1 9l2-2 2 2 2-4 2 4 2-6 2 6 2-8" stroke="#fff" strokeWidth="1.5" fill="none"/></svg>
              <div style={{ fontSize: 10 }}>5G</div>
              <div style={{ width: 22, height: 10, border: '1px solid #fff', borderRadius: 3, padding: 1, position: 'relative' }}>
                <div style={{ width: '75%', height: '100%', background: '#fff', borderRadius: 1 }}/>
              </div>
            </div>
          </div>
          <div style={{ width: '100%', height: '100%' }}>{children}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
          color: 'rgba(0,0,0,0.5)', letterSpacing: 2, textTransform: 'uppercase',
        }}>{variant}</div>
        <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 15, color: 'rgba(0,0,0,0.7)' }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// ========== Cosmic backgrounds ==========
function CosmicBg({ intensity = 1, variant = 'A' }) {
  const T = window.DUELO_TOKENS;
  if (variant === 'A') {
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `
          radial-gradient(ellipse 70% 50% at 20% 10%, ${T.violet}${Math.round(40*intensity).toString(16).padStart(2,'0')}, transparent 60%),
          radial-gradient(ellipse 70% 50% at 80% 90%, ${T.cyan}${Math.round(30*intensity).toString(16).padStart(2,'0')}, transparent 60%),
          linear-gradient(180deg, #050510 0%, #0A0A1A 100%)
        ` }}/>
        <Stars count={30} opacity={0.6 * intensity}/>
      </div>
    );
  }
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: `
        linear-gradient(135deg, ${T.violet}${Math.round(60*intensity).toString(16).padStart(2,'0')} 0%, ${T.cyan}${Math.round(40*intensity).toString(16).padStart(2,'0')} 100%),
        #050510
      ` }}/>
      <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.02) 20px, rgba(255,255,255,0.02) 21px)` }}/>
      <Stars count={50} opacity={0.7 * intensity}/>
    </div>
  );
}

function Stars({ count = 30, opacity = 0.6 }) {
  const stars = React.useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: (i * 37) % 100,
    y: (i * 67) % 100,
    s: ((i * 13) % 3) + 1,
    o: 0.3 + ((i * 7) % 70) / 100,
  })), [count]);
  return (
    <>
      {stars.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
          width: s.s, height: s.s, borderRadius: '50%', background: '#fff',
          opacity: s.o * opacity,
          boxShadow: s.s > 2 ? `0 0 ${s.s * 2}px #fff` : 'none',
        }}/>
      ))}
    </>
  );
}

// ========== Swords logo mark ==========
function SwordMark({ size = 40, color = null }) {
  const T = window.DUELO_TOKENS;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <defs>
        <linearGradient id={`sg${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color || T.cyan}/>
          <stop offset="1" stopColor={color || T.violet}/>
        </linearGradient>
      </defs>
      <path d="M8 8 L20 20 L18 22 L6 10 Z" fill={`url(#sg${size})`}/>
      <path d="M32 8 L20 20 L22 22 L34 10 Z" fill={`url(#sg${size})`}/>
      <path d="M14 26 L20 20 L26 26 L22 30 L20 30 L18 30 Z" fill={`url(#sg${size})`} opacity="0.8"/>
      <circle cx="20" cy="20" r="3" fill={color || T.gold}/>
    </svg>
  );
}

// ========== Nav bar ==========
function NavBar({ active = 'home', variant = 'A' }) {
  const T = window.DUELO_TOKENS;
  const items = [
    { k: 'home', label: 'Duels', icon: 'M3 10l7-7 7 7v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z' },
    { k: 'play', label: 'Jouer', icon: 'M4 4l12 6-12 6V4z' },
    { k: 'rank', label: 'Classement', icon: 'M3 3h4v14H3zM9 7h4v10H9zM15 11h4v6h-4z' },
    { k: 'profile', label: 'Profil', icon: 'M10 10a4 4 0 100-8 4 4 0 000 8zM2 18a8 8 0 0116 0H2z' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
      background: variant === 'A'
        ? 'linear-gradient(180deg, transparent, rgba(5,5,16,0.95) 30%)'
        : `linear-gradient(180deg, transparent, ${T.abyss})`,
      display: 'flex', alignItems: 'flex-end', padding: '0 16px 22px',
      zIndex: 50,
    }}>
      <div style={{
        flex: 1, display: 'flex', justifyContent: 'space-around',
        background: variant === 'A' ? 'rgba(255,255,255,0.06)' : T.panel,
        border: `1px solid ${variant === 'A' ? 'rgba(255,255,255,0.08)' : T.cyan + '30'}`,
        backdropFilter: 'blur(20px)', borderRadius: 24, padding: '10px 8px',
      }}>
        {items.map(it => {
          const on = active === it.k;
          return (
            <div key={it.k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 10px', borderRadius: 14, background: on && variant === 'B' ? T.cyan + '20' : 'transparent' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill={on ? T.cyan : T.dim3}>
                <path d={it.icon}/>
              </svg>
              <div style={{
                fontFamily: 'Space Grotesk', fontSize: 9, fontWeight: 700,
                color: on ? T.cyan : T.dim3, letterSpacing: 0.5, textTransform: 'uppercase',
              }}>{it.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ========== Avatar ==========
function Avatar({ size = 40, color, letter, ring = false, ringColor }) {
  const T = window.DUELO_TOKENS;
  const c = color || T.cyan;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${c}, ${c}90)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontFamily: 'Space Grotesk', fontWeight: 800,
      fontSize: size * 0.4, letterSpacing: -0.5,
      boxShadow: ring ? `0 0 0 3px ${ringColor || c}, 0 0 0 5px ${T.abyss}` : `0 4px 12px ${c}40`,
      flexShrink: 0,
    }}>
      {letter}
    </div>
  );
}

// ========== Eyebrow ==========
function Eyebrow({ children, color }) {
  return (
    <div style={{
      fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
      color: color || 'rgba(255,255,255,0.5)', letterSpacing: 2.5,
      textTransform: 'uppercase', fontWeight: 500,
    }}>{children}</div>
  );
}

// ========== Button ==========
function PrimaryBtn({ children, variant = 'A', onClick, style = {} }) {
  const T = window.DUELO_TOKENS;
  if (variant === 'A') {
    return (
      <div onClick={onClick} style={{
        background: '#fff', color: T.abyss, padding: '16px 28px', borderRadius: 16,
        fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15,
        textAlign: 'center', cursor: 'pointer', letterSpacing: -0.2,
        ...style,
      }}>{children}</div>
    );
  }
  return (
    <div onClick={onClick} style={{
      background: `linear-gradient(135deg, ${T.cyan}, ${T.violet})`,
      color: '#000', padding: '18px 28px', borderRadius: 18,
      fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 15,
      textAlign: 'center', cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
      boxShadow: `0 12px 40px ${T.cyan}50, 0 0 0 1px rgba(255,255,255,0.1) inset`,
      ...style,
    }}>{children}</div>
  );
}

Object.assign(window, { Phone, CosmicBg, Stars, SwordMark, NavBar, Avatar, Eyebrow, PrimaryBtn });
