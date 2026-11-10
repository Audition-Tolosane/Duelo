// ============================================================================
// DUELO — ÉTATS MANQUANTS
// Résultats : Défaite, Égalité · États vides · Erreurs
// ============================================================================
const TE = () => window.DUELO_TOKENS;
function FrameE({ children }) {
  return <div style={{ position: 'absolute', inset: 0, color: '#fff' }}>{children}</div>;
}

// ── RÉSULTATS · DÉFAITE ──
function E_Defeat() {
  const t = TE();
  return (
    <FrameE>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 25%, ${t.violet}40 0%, #1a1030 35%, ${t.abyss} 75%)` }}/>
      <Stars count={18} opacity={0.4}/>
      <div style={{ position: 'absolute', inset: 0, padding: '52px 18px 24px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', background: 'rgba(255,255,255,0.1)', color: t.dim1, fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 10, letterSpacing: 3, borderRadius: 20, textTransform: 'uppercase', border: '1px solid rgba(255,255,255,0.15)' }}>◆ Défaite</div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 60, letterSpacing: -3, lineHeight: 0.9, marginTop: 10, color: t.dim1 }}>PRESQUE…</div>
          <div style={{ fontFamily: 'Inter', fontSize: 13, color: t.dim2, marginTop: 8 }}>Maya l'emporte cette fois. La revanche t'attend.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22 }}>
          <div style={{ flex: 1, padding: 14, borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.08)', textAlign: 'center', opacity: 0.65 }}>
            <Avatar size={42} color={t.cyan} letter="L"/>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 38, color: '#fff', letterSpacing: -2, lineHeight: 1, marginTop: 8 }}>4</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim2, letterSpacing: 1, fontWeight: 700 }}>TOI</div>
          </div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 20, color: t.dim3 }}>VS</div>
          <div style={{ flex: 1, padding: 14, borderRadius: 20, background: `linear-gradient(135deg, ${t.violet}50, ${t.violet}10)`, border: `2px solid ${t.violet}`, textAlign: 'center' }}>
            <Avatar size={42} color={t.violet} letter="M"/>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 38, color: '#fff', letterSpacing: -2, lineHeight: 1, marginTop: 8 }}>7</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.violet, letterSpacing: 1, fontWeight: 700 }}>WINNER</div>
          </div>
        </div>
        {/* XP de consolation (réduit) */}
        <div style={{ marginTop: 14, padding: 16, background: 'rgba(0,0,0,0.35)', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 16 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.dim3, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>XP gagnés</div>
          {[['Participation', '+20'], ['Bonnes réponses (4)', '+16', t.mint]].map(([l, v, c], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span style={{ fontFamily: 'Inter', fontSize: 13, color: c || t.dim2 }}>{l}</span>
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14, color: c || '#fff' }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 14, color: '#fff' }}>TOTAL</span>
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, color: t.dim1 }}>+36 XP</span>
          </div>
        </div>
        {/* Encouragement streak */}
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: `${t.fire}15`, border: `1px solid ${t.fire}30`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 20 }}>🔥</div>
          <div style={{ fontFamily: 'Inter', fontSize: 12, color: t.dim1, flex: 1 }}>Ta série de 7 jours est intacte — rejoue pour la garder !</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <div style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.06)', borderRadius: 14, textAlign: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, border: '1px solid rgba(255,255,255,0.1)' }}>Accueil</div>
          <div style={{ flex: 2 }}><PrimaryBtn variant="B" style={{ padding: 14 }}>◆ Prendre ma revanche</PrimaryBtn></div>
        </div>
      </div>
    </FrameE>
  );
}

// ── RÉSULTATS · ÉGALITÉ ──
function E_Draw() {
  const t = TE();
  return (
    <FrameE>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 28%, ${t.cyan}35 0%, ${t.violet}25 35%, ${t.abyss} 75%)` }}/>
      <Stars count={20} opacity={0.45}/>
      <div style={{ position: 'absolute', inset: 0, padding: '56px 18px 24px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', background: `linear-gradient(135deg, ${t.cyan}, ${t.violet})`, color: '#000', fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 10, letterSpacing: 3, borderRadius: 20, textTransform: 'uppercase' }}>◆ Égalité</div>
          <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontWeight: 400, fontSize: 56, letterSpacing: -2, lineHeight: 0.95, marginTop: 10, color: '#fff' }}>Au coude<br/>à coude.</div>
          <div style={{ fontFamily: 'Inter', fontSize: 13, color: t.dim2, marginTop: 10 }}>Personne ne lâche rien. Il faut une belle&nbsp;!</div>
        </div>
        {/* Symmetric scores */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24 }}>
          <div style={{ flex: 1, padding: 14, borderRadius: 20, background: `linear-gradient(135deg, ${t.cyan}40, ${t.cyan}10)`, border: `2px solid ${t.cyan}`, textAlign: 'center' }}>
            <Avatar size={42} color={t.cyan} letter="L"/>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 40, color: '#fff', letterSpacing: -2, lineHeight: 1, marginTop: 8 }}>5</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.cyan, letterSpacing: 1, fontWeight: 700 }}>TOI</div>
          </div>
          <div style={{ fontFamily: 'Fraunces', fontStyle: 'italic', fontWeight: 500, fontSize: 24, color: t.gold }}>=</div>
          <div style={{ flex: 1, padding: 14, borderRadius: 20, background: `linear-gradient(135deg, ${t.violet}40, ${t.violet}10)`, border: `2px solid ${t.violet}`, textAlign: 'center' }}>
            <Avatar size={42} color={t.violet} letter="M"/>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 40, color: '#fff', letterSpacing: -2, lineHeight: 1, marginTop: 8 }}>5</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.violet, letterSpacing: 1, fontWeight: 700 }}>MAYA</div>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: 16, background: 'rgba(0,0,0,0.35)', border: `1px solid ${t.gold}30`, borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 13, color: t.dim2 }}>XP partagés</span>
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, color: t.gold }}>+60 XP</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <div style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.06)', borderRadius: 14, textAlign: 'center', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, border: '1px solid rgba(255,255,255,0.1)' }}>Accueil</div>
          <div style={{ flex: 2 }}><PrimaryBtn variant="B" style={{ padding: 14 }}>◆ La belle !</PrimaryBtn></div>
        </div>
      </div>
    </FrameE>
  );
}

// ── Composant générique état vide ──
function EmptyState({ icon, title, body, ctaLabel, accent }) {
  const t = TE();
  const c = accent || t.cyan;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 32px', gap: 4 }}>
      <div style={{ position: 'relative', marginBottom: 18 }}>
        <div style={{ position: 'absolute', inset: -24, borderRadius: '50%', background: `radial-gradient(circle, ${c}25, transparent 70%)` }}/>
        <div style={{ width: 96, height: 96, borderRadius: 28, background: 'rgba(255,255,255,0.04)', border: `1px solid ${c}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, position: 'relative' }}>{icon}</div>
      </div>
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 22, letterSpacing: -0.5 }}>{title}</div>
      <div style={{ fontFamily: 'Inter', fontSize: 13, color: t.dim2, lineHeight: 1.5, maxWidth: 260, marginTop: 4 }}>{body}</div>
      {ctaLabel && (
        <div style={{ marginTop: 18, padding: '13px 24px', borderRadius: 14, background: `linear-gradient(135deg, ${t.cyan}, ${t.violet})`, color: '#000', fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 13, letterSpacing: 0.5 }}>{ctaLabel}</div>
      )}
    </div>
  );
}

// ── VIDE · PAS DE DUELS (Accueil) ──
function E_EmptyDuels() {
  const t = TE();
  return (
    <FrameE>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 240, background: `linear-gradient(180deg, ${t.violet}25, transparent)` }}/>
      <Stars count={14} opacity={0.35}/>
      <div style={{ position: 'absolute', inset: 0, padding: '56px 16px 100px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Avatar size={44} color={t.cyan} letter="L" ring ringColor={t.gold}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14 }}>LÉO</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.gold, fontWeight: 700 }}>Lv 12 · 2 840 XP</div>
          </div>
        </div>
        <EmptyState icon="⚔" title="Aucun duel en cours" body="Lance ton premier duel du jour et grimpe au classement. Un adversaire t'attend." ctaLabel="◆ Trouver un adversaire" accent={t.cyan}/>
      </div>
      <NavBar active="home" variant="B"/>
    </FrameE>
  );
}

// ── VIDE · PAS DE MESSAGES ──
function E_EmptyMessages() {
  const t = TE();
  return (
    <FrameE>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, background: `linear-gradient(180deg, ${t.violet}25, transparent)` }}/>
      <Stars count={12} opacity={0.3}/>
      <div style={{ position: 'absolute', inset: 0, padding: '56px 16px 100px', display: 'flex', flexDirection: 'column' }}>
        <PageHead title="Messages" sub="◆ 0 conversation"/>
        <EmptyState icon="💬" title="Pas encore de messages" body="Défie un joueur ou suis quelqu'un pour démarrer une conversation après vos duels." ctaLabel="Trouver des joueurs" accent={t.violet}/>
      </div>
      <NavBar active="home" variant="B"/>
    </FrameE>
  );
}

// ── VIDE · RECHERCHE SANS RÉSULTAT ──
function E_EmptySearch() {
  const t = TE();
  return (
    <FrameE>
      <div style={{ position: 'absolute', inset: 0, background: t.abyss }}/>
      <Stars count={10} opacity={0.25}/>
      <div style={{ position: 'absolute', inset: 0, padding: '50px 16px 20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M15 6l-6 6 6 6"/></svg>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: `1px solid ${t.cyan}50` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.cyan} strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
            <span style={{ flex: 1, fontFamily: 'Inter', fontSize: 14, color: '#fff' }}>Zxqwerty</span>
            <div style={{ color: t.dim3, fontSize: 18 }}>×</div>
          </div>
        </div>
        <EmptyState icon="🔍" title="Aucun résultat" body="On n'a trouvé ni joueur ni thème pour « Zxqwerty ». Vérifie l'orthographe ou essaie autre chose." accent={t.gold}/>
      </div>
    </FrameE>
  );
}

// ── ERREUR · CONNEXION PERDUE (plein écran) ──
function E_Offline() {
  const t = TE();
  return (
    <FrameE>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 35%, ${t.red}25 0%, ${t.abyss} 65%)` }}/>
      <Stars count={12} opacity={0.25}/>
      <div style={{ position: 'absolute', inset: 0, padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ position: 'relative', marginBottom: 22 }}>
          <div style={{ position: 'absolute', inset: -28, borderRadius: '50%', background: `radial-gradient(circle, ${t.red}25, transparent 70%)` }}/>
          <div style={{ width: 100, height: 100, borderRadius: 30, background: 'rgba(255,255,255,0.04)', border: `1px solid ${t.red}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={t.red} strokeWidth="2" strokeLinecap="round"><path d="M1 1l22 22M16.7 11.7A6 6 0 0 0 12 9M5 12.5a10 10 0 0 1 4-2.5M8.5 16.5a4 4 0 0 1 5 0M12 20h.01"/></svg>
          </div>
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.red, letterSpacing: 2, fontWeight: 700 }}>◆ HORS LIGNE</div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 24, letterSpacing: -0.5, marginTop: 6 }}>Connexion perdue</div>
        <div style={{ fontFamily: 'Inter', fontSize: 13, color: t.dim2, lineHeight: 1.5, maxWidth: 260, marginTop: 8 }}>Vérifie ta connexion internet. On réessaie automatiquement dès que tu es de retour.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, padding: '10px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: t.gold, animation: 'pulse 1s ease-in-out infinite' }}/>
          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13 }}>Reconnexion…</span>
        </div>
      </div>
    </FrameE>
  );
}

// ── ERREUR · ADVERSAIRE A ABANDONNÉ (en plein duel) ──
function E_OpponentLeft() {
  const t = TE();
  return (
    <FrameE>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${t.cyan}15, ${t.abyss} 40%)` }}/>
      <Stars count={14} opacity={0.35}/>
      <div style={{ position: 'absolute', inset: 0, padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <Avatar size={84} color={t.violet} letter="M"/>
          <div style={{ position: 'absolute', bottom: -4, right: -4, width: 32, height: 32, borderRadius: 16, background: t.abyss, border: `2px solid ${t.red}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.red} strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </div>
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.gold, letterSpacing: 2, fontWeight: 700 }}>◆ DUEL INTERROMPU</div>
        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 24, letterSpacing: -0.5, marginTop: 6 }}>Maya a quitté</div>
        <div style={{ fontFamily: 'Inter', fontSize: 13, color: t.dim2, lineHeight: 1.5, maxWidth: 270, marginTop: 8 }}>Ton adversaire s'est déconnecté. Tu remportes le duel par forfait — l'XP est conservé.</div>
        {/* victory by forfeit chip */}
        <div style={{ marginTop: 16, padding: '10px 18px', borderRadius: 12, background: `${t.mint}15`, border: `1px solid ${t.mint}40`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🏆</span>
          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, color: t.mint }}>Victoire par forfait · +40 XP</span>
        </div>
        <div style={{ width: '100%', maxWidth: 280, marginTop: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PrimaryBtn variant="B">◆ Nouveau duel</PrimaryBtn>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: t.dim3, padding: 8 }}>Retour à l'accueil</div>
        </div>
      </div>
    </FrameE>
  );
}

Object.assign(window, { E_Defeat, E_Draw, E_EmptyDuels, E_EmptyMessages, E_EmptySearch, E_Offline, E_OpponentLeft, EmptyState });
