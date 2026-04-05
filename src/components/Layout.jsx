// ─── REAKTR · Layout — Mobile-first Claymorphism × Glassmorphism ─────────────

const G = '#31EC56', P = '#EF036C', V = '#EE72F8';

const NAV = [
  { path:'/',          icon:'◈', label:'Home'      },
  { path:'/triggers',  icon:'◎', label:'Triggers'  },
  { path:'/flows',     icon:'⟁', label:'Flows'     },
  { path:'/analytics', icon:'◷', label:'Analytics' },
  { path:'/leads',     icon:'◉', label:'Leads'     },
  { path:'/accounts',  icon:'⬡', label:'Accounts'  },
];

const glass = (extra={}) => ({
  background:'rgba(255,255,255,0.07)',
  backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
  border:'1px solid rgba(255,255,255,0.10)',
  borderRadius:20,
  ...extra,
});

export default function Layout({ children, route }) {
  const go = p => { window.location.hash = p; };

  return (
    <div style={{display:'flex', flexDirection:'column', minHeight:'100vh', position:'relative', zIndex:1}}>
      {/* Top bar */}
      <header style={{
        ...glass({ borderRadius:0, borderTop:'none', borderLeft:'none', borderRight:'none' }),
        padding:'14px 20px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        position:'sticky', top:0, zIndex:50,
      }}>
        <div style={{
          fontFamily:'Syne, sans-serif', fontSize:22, fontWeight:800,
          background:`linear-gradient(135deg, ${G}, ${V})`,
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          letterSpacing:'-0.5px',
        }}>REAKTR</div>
        <button
          onClick={()=>{localStorage.clear();window.location.reload();}}
          style={{
            background:'rgba(239,3,108,0.15)', border:'1px solid rgba(239,3,108,0.3)',
            color:P, borderRadius:12, padding:'6px 14px',
            fontSize:11, fontWeight:600, cursor:'pointer',
            fontFamily:'DM Sans, sans-serif',
          }}>Sign out</button>
      </header>

      {/* Page content */}
      <main style={{flex:1, overflowX:'hidden', paddingBottom:90}}>
        {children}
      </main>

      {/* Bottom nav */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:50,
        ...glass({ borderRadius:'20px 20px 0 0', borderBottom:'none' }),
        padding:'8px 4px 20px',
        display:'grid', gridTemplateColumns:`repeat(${NAV.length}, 1fr)`,
      }}>
        {NAV.map(item => {
          const active = route === item.path;
          return (
            <button key={item.path} onClick={()=>go(item.path)} style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              background:'none', border:'none', cursor:'pointer',
              padding:'8px 2px',
            }}>
              <div style={{
                width:36, height:36, borderRadius:12,
                display:'flex', alignItems:'center', justifyContent:'center',
                background: active ? `linear-gradient(135deg, ${G}22, ${V}22)` : 'transparent',
                border: active ? `1px solid ${G}44` : '1px solid transparent',
                fontSize:16,
                color: active ? G : 'rgba(255,255,255,0.35)',
                transition:'all 0.2s',
              }}>{item.icon}</div>
              <span style={{
                fontSize:9, fontWeight:600, letterSpacing:0.5,
                color: active ? G : 'rgba(255,255,255,0.3)',
                fontFamily:'DM Sans, sans-serif',
              }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ── Design system exports ─────────────────────────────────────────────────────

export const colors = { G, P, V };

export function Card({ children, style={}, glow }) {
  const glowColor = glow === 'green' ? G : glow === 'pink' ? P : glow === 'purple' ? V : null;
  return (
    <div style={{
      background:'rgba(255,255,255,0.06)',
      backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
      border:`1px solid ${glowColor ? glowColor+'33' : 'rgba(255,255,255,0.09)'}`,
      borderRadius:20,
      boxShadow: glowColor
        ? `0 4px 30px ${glowColor}22, inset 0 1px 0 rgba(255,255,255,0.08)`
        : '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
      overflow:'hidden',
      ...style,
    }}>{children}</div>
  );
}

export function StatCard({ label, value, color, icon }) {
  return (
    <div style={{
      background:`linear-gradient(135deg, ${color}18, ${color}08)`,
      border:`1px solid ${color}30`,
      borderRadius:20,
      padding:'18px 16px',
      boxShadow:`0 4px 24px ${color}15`,
    }}>
      <div style={{fontSize:22, marginBottom:6}}>{icon}</div>
      <div style={{
        fontFamily:'Syne, sans-serif', fontSize:26, fontWeight:800,
        color, lineHeight:1,
      }}>{value ?? '—'}</div>
      <div style={{color:'rgba(255,255,255,0.45)', fontSize:11, marginTop:6, fontWeight:500}}>
        {label}
      </div>
    </div>
  );
}

export function Btn({ children, onClick, variant='primary', disabled, full, small }) {
  const styles = {
    primary  : { background:`linear-gradient(135deg, ${G}, #0db83a)`, color:'#000', boxShadow:`0 4px 20px ${G}35` },
    pink     : { background:`linear-gradient(135deg, ${P}, #b0024f)`, color:'#fff', boxShadow:`0 4px 20px ${P}35` },
    purple   : { background:`linear-gradient(135deg, ${V}, #c440e0)`, color:'#fff', boxShadow:`0 4px 20px ${V}35` },
    ghost    : { background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.7)', border:'1px solid rgba(255,255,255,0.12)', boxShadow:'none' },
    danger   : { background:'rgba(239,3,108,0.15)', color:P, border:`1px solid ${P}44`, boxShadow:'none' },
  };
  const s = styles[variant] || styles.primary;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...s,
      border: s.border || 'none',
      borderRadius: small ? 12 : 16,
      padding: small ? '7px 14px' : (full ? '14px' : '11px 20px'),
      width: full ? '100%' : 'auto',
      fontSize: small ? 12 : 14, fontWeight:700,
      fontFamily:'DM Sans, sans-serif',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition:'all 0.2s',
      whiteSpace:'nowrap',
    }}>{children}</button>
  );
}

export function Input({ label, value, onChange, placeholder, type='text', mono }) {
  return (
    <div style={{marginBottom:14}}>
      {label && <div style={{color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:600, marginBottom:6, letterSpacing:1}}>{label}</div>}
      <input
        type={type} value={value||''} placeholder={placeholder}
        onChange={e=>onChange(e.target.value)}
        style={{
          width:'100%',
          background:'rgba(255,255,255,0.07)',
          border:'1px solid rgba(255,255,255,0.12)',
          borderRadius:14, color:'#fff',
          padding:'12px 16px', fontSize:14, outline:'none',
          fontFamily: mono ? 'monospace' : 'DM Sans, sans-serif',
        }}
      />
    </div>
  );
}

export function RSelect({ label, value, onChange, options }) {
  return (
    <div style={{marginBottom:14}}>
      {label && <div style={{color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:600, marginBottom:6, letterSpacing:1}}>{label}</div>}
      <select value={value||''} onChange={e=>onChange(e.target.value)} style={{
        width:'100%',
        background:'rgba(255,255,255,0.07)',
        border:'1px solid rgba(255,255,255,0.12)',
        borderRadius:14, color:'#fff',
        padding:'12px 16px', fontSize:14, outline:'none',
        fontFamily:'DM Sans, sans-serif',
      }}>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:200,
      background:'rgba(0,0,0,0.75)',
      backdropFilter:'blur(6px)',
      display:'flex', alignItems:'flex-end', justifyContent:'center',
      padding:'0',
    }} onClick={onClose}>
      <div style={{
        width:'100%', maxWidth:520,
        background:'#0E0E1A',
        border:'1px solid rgba(255,255,255,0.12)',
        borderRadius:'24px 24px 0 0',
        padding:'24px 20px 36px',
        maxHeight:'90vh', overflowY:'auto',
        animation:'fadeUp 0.25s ease both',
      }} onClick={e=>e.stopPropagation()}>
        {/* Handle */}
        <div style={{width:36, height:4, background:'rgba(255,255,255,0.2)', borderRadius:2, margin:'0 auto 20px'}}/>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
          <div style={{fontFamily:'Syne, sans-serif', fontSize:17, fontWeight:700, color:'#fff'}}>{title}</div>
          <button onClick={onClose} style={{
            background:'rgba(255,255,255,0.08)', border:'none', color:'rgba(255,255,255,0.6)',
            width:30, height:30, borderRadius:10, cursor:'pointer', fontSize:16,
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageTitle({ title, subtitle, right }) {
  return (
    <div style={{
      padding:'20px 20px 16px',
      display:'flex', justifyContent:'space-between', alignItems:'flex-start',
    }}>
      <div>
        {subtitle && <div style={{color:'rgba(255,255,255,0.35)', fontSize:10, fontWeight:600, letterSpacing:2, marginBottom:4}}>{subtitle}</div>}
        <div style={{fontFamily:'Syne, sans-serif', fontSize:24, fontWeight:800, color:'#fff', lineHeight:1.1}}>{title}</div>
      </div>
      {right && <div style={{marginTop:4}}>{right}</div>}
    </div>
  );
}

export function Badge({ label, color }) {
  return (
    <span style={{
      background:`${color}20`, color, border:`1px solid ${color}40`,
      borderRadius:8, padding:'3px 10px', fontSize:10, fontWeight:700, letterSpacing:0.5,
    }}>{label}</span>
  );
}

export function EmptyState({ icon, text }) {
  return (
    <div style={{textAlign:'center', padding:'48px 20px'}}>
      <div style={{fontSize:36, marginBottom:12}}>{icon}</div>
      <div style={{color:'rgba(255,255,255,0.3)', fontSize:13}}>{text}</div>
    </div>
  );
}
