// ─── REAKTR · Layout ──────────────────────────────────────────────────────────
import { IcHome, IcTrigger, IcFlow, IcAnalytics, IcLeads, IcAccount, IcSignOut, IcX } from './Icons.jsx';

const G = '#31EC56', P = '#EF036C', V = '#EE72F8';
export const colors = { G, P, V };

const NAV = [
  { path:'/',          Icon:IcHome,      label:'Home'      },
  { path:'/triggers',  Icon:IcTrigger,   label:'Triggers'  },
  { path:'/flows',     Icon:IcFlow,      label:'Flows'     },
  { path:'/analytics', Icon:IcAnalytics, label:'Analytics' },
  { path:'/leads',     Icon:IcLeads,     label:'Leads'     },
  { path:'/accounts',  Icon:IcAccount,   label:'Accounts'  },
];

// Height constants
const HEADER_H = 56;
const NAV_H    = 76;

export default function Layout({ children, route }) {
  const go = p => { window.location.hash = p; };

  return (
    <div style={{display:'flex', flexDirection:'column', minHeight:'100vh', position:'relative', zIndex:1}}>
      {/* Top bar */}
      <header style={{
        height: HEADER_H,
        background:'rgba(7,7,15,0.85)',
        backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
        borderBottom:'1px solid rgba(255,255,255,0.08)',
        padding:'0 20px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        position:'fixed', top:0, left:0, right:0, zIndex:100,
      }}>
        <div style={{
          fontFamily:'Syne, sans-serif', fontSize:20, fontWeight:800,
          background:`linear-gradient(135deg, ${G}, ${V})`,
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          letterSpacing:'-0.5px',
        }}>REAKTR</div>
        <button onClick={()=>{localStorage.clear();window.location.reload();}} style={{
          background:'rgba(239,3,108,0.12)', border:'1px solid rgba(239,3,108,0.25)',
          color:P, borderRadius:10, padding:'6px 12px',
          fontSize:12, fontWeight:600, cursor:'pointer',
          fontFamily:'DM Sans, sans-serif',
          display:'flex', alignItems:'center', gap:5,
        }}>
          <IcSignOut size={13} color={P}/> Sign out
        </button>
      </header>

      {/* Page content — pushed below header, above nav */}
      <main style={{
        flex:1,
        marginTop: HEADER_H,
        paddingBottom: NAV_H + 16,
        overflowX:'hidden',
        minHeight: `calc(100vh - ${HEADER_H}px)`,
      }}>
        {children}
      </main>

      {/* Bottom nav */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:100,
        height: NAV_H,
        background:'rgba(7,7,15,0.92)',
        backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
        borderTop:'1px solid rgba(255,255,255,0.08)',
        borderRadius:'18px 18px 0 0',
        padding:'8px 4px 18px',
        display:'grid', gridTemplateColumns:`repeat(${NAV.length}, 1fr)`,
      }}>
        {NAV.map(({path, Icon, label}) => {
          const active = route === path;
          return (
            <button key={path} onClick={()=>go(path)} style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              background:'none', border:'none', cursor:'pointer', padding:'6px 2px',
            }}>
              <div style={{
                width:34, height:34, borderRadius:11,
                display:'flex', alignItems:'center', justifyContent:'center',
                background: active ? `${G}20` : 'transparent',
                border: active ? `1px solid ${G}40` : '1px solid transparent',
                transition:'all 0.18s',
              }}>
                <Icon size={17} color={active ? G : 'rgba(255,255,255,0.3)'}/>
              </div>
              <span style={{
                fontSize:9, fontWeight:600, letterSpacing:0.3,
                color: active ? G : 'rgba(255,255,255,0.28)',
                fontFamily:'DM Sans, sans-serif',
              }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ── Shared UI components ──────────────────────────────────────────────────────

export function Card({ children, style={}, accent }) {
  return (
    <div style={{
      background:'rgba(255,255,255,0.055)',
      backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
      border:`1px solid ${accent ? accent+'33' : 'rgba(255,255,255,0.09)'}`,
      borderRadius:18,
      boxShadow: accent
        ? `0 4px 28px ${accent}18, inset 0 1px 0 rgba(255,255,255,0.07)`
        : '0 2px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
      overflow:'hidden',
      ...style,
    }}>{children}</div>
  );
}

export function StatCard({ label, value, color, Icon }) {
  return (
    <div style={{
      background:`linear-gradient(135deg, ${color}16, ${color}07)`,
      border:`1px solid ${color}28`,
      borderRadius:18, padding:'16px 14px',
      boxShadow:`0 4px 20px ${color}12`,
    }}>
      <div style={{marginBottom:8}}>
        <Icon size={18} color={color}/>
      </div>
      <div style={{
        fontFamily:'Syne, sans-serif', fontSize:28, fontWeight:800,
        color, lineHeight:1,
      }}>{value ?? '—'}</div>
      <div style={{color:'rgba(255,255,255,0.42)', fontSize:11, marginTop:5, fontWeight:500, letterSpacing:0.3}}>
        {label}
      </div>
    </div>
  );
}

export function Btn({ children, onClick, variant='primary', disabled, full, small, icon }) {
  const s = {
    primary  : { background:`linear-gradient(135deg, ${G}, #0db83a)`,  color:'#000', shadow:`${G}30` },
    pink     : { background:`linear-gradient(135deg, ${P}, #b0024f)`,  color:'#fff', shadow:`${P}30` },
    purple   : { background:`linear-gradient(135deg, ${V}, #c440e0)`,  color:'#fff', shadow:`${V}30` },
    ghost    : { background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.65)', border:'1px solid rgba(255,255,255,0.11)', shadow:'none' },
    danger   : { background:'rgba(239,3,108,0.12)', color:P, border:`1px solid ${P}38`, shadow:'none' },
  }[variant] || {};
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: s.background,
      border: s.border || 'none',
      borderRadius: small ? 11 : 14,
      color: s.color,
      padding: small ? '6px 12px' : (full ? '13px' : '10px 18px'),
      width: full ? '100%' : 'auto',
      fontSize: small ? 12 : 14, fontWeight:700,
      fontFamily:'DM Sans, sans-serif',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      transition:'all 0.18s',
      boxShadow: s.shadow && s.shadow !== 'none' ? `0 3px 16px ${s.shadow}` : 'none',
      display:'inline-flex', alignItems:'center', gap:6, justifyContent:'center',
      whiteSpace:'nowrap',
    }}>
      {icon && icon}
      {children}
    </button>
  );
}

export function Input({ label, value, onChange, placeholder, type='text', mono }) {
  return (
    <div style={{marginBottom:14}}>
      {label && <div style={{color:'rgba(255,255,255,0.45)', fontSize:11, fontWeight:600, marginBottom:5, letterSpacing:0.8}}>{label}</div>}
      <input
        type={type} value={value||''} placeholder={placeholder}
        onChange={e=>onChange(e.target.value)}
        style={{
          width:'100%',
          background:'rgba(255,255,255,0.07)',
          border:'1px solid rgba(255,255,255,0.11)',
          borderRadius:13, color:'#fff',
          padding:'11px 14px', fontSize:14, outline:'none',
          fontFamily: mono ? 'monospace' : 'DM Sans, sans-serif',
        }}
      />
    </div>
  );
}

export function Textarea({ label, value, onChange, placeholder, rows=3 }) {
  return (
    <div style={{marginBottom:14}}>
      {label && <div style={{color:'rgba(255,255,255,0.45)', fontSize:11, fontWeight:600, marginBottom:5, letterSpacing:0.8}}>{label}</div>}
      <textarea
        value={value||''} placeholder={placeholder} rows={rows}
        onChange={e=>onChange(e.target.value)}
        style={{
          width:'100%',
          background:'rgba(255,255,255,0.07)',
          border:'1px solid rgba(255,255,255,0.11)',
          borderRadius:13, color:'#fff',
          padding:'11px 14px', fontSize:14, outline:'none',
          resize:'none', fontFamily:'DM Sans, sans-serif',
        }}
      />
    </div>
  );
}

export function RSelect({ label, value, onChange, options }) {
  return (
    <div style={{marginBottom:14}}>
      {label && <div style={{color:'rgba(255,255,255,0.45)', fontSize:11, fontWeight:600, marginBottom:5, letterSpacing:0.8}}>{label}</div>}
      <select value={value||''} onChange={e=>onChange(e.target.value)} style={{
        width:'100%',
        background:'rgba(14,14,26,0.95)',
        border:'1px solid rgba(255,255,255,0.11)',
        borderRadius:13, color:'#fff',
        padding:'11px 14px', fontSize:14, outline:'none',
        fontFamily:'DM Sans, sans-serif',
        appearance:'none', WebkitAppearance:'none',
        backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat:'no-repeat', backgroundPosition:'right 14px center',
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
      background:'rgba(0,0,0,0.8)',
      backdropFilter:'blur(8px)',
      display:'flex', alignItems:'flex-end', justifyContent:'center',
    }} onClick={onClose}>
      <div style={{
        width:'100%', maxWidth:540,
        background:'#0E0E1A',
        border:'1px solid rgba(255,255,255,0.11)',
        borderRadius:'22px 22px 0 0',
        padding:'20px 20px 36px',
        maxHeight:'88vh', overflowY:'auto',
        animation:'fadeUp 0.22s ease both',
      }} onClick={e=>e.stopPropagation()}>
        <div style={{width:34,height:4,background:'rgba(255,255,255,0.18)',borderRadius:2,margin:'0 auto 18px'}}/>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18}}>
          <div style={{fontFamily:'Syne, sans-serif', fontSize:17, fontWeight:700, color:'#fff'}}>{title}</div>
          <button onClick={onClose} style={{
            background:'rgba(255,255,255,0.07)', border:'none',
            color:'rgba(255,255,255,0.5)', width:30, height:30,
            borderRadius:9, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          }}><IcX size={14} color="rgba(255,255,255,0.5)"/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageTitle({ title, subtitle, right }) {
  return (
    <div style={{
      padding:'18px 18px 14px',
      display:'flex', justifyContent:'space-between', alignItems:'flex-start',
    }}>
      <div>
        {subtitle && <div style={{color:'rgba(255,255,255,0.3)', fontSize:10, fontWeight:600, letterSpacing:2, marginBottom:3, textTransform:'uppercase'}}>{subtitle}</div>}
        <div style={{fontFamily:'Syne, sans-serif', fontSize:22, fontWeight:800, color:'#fff', lineHeight:1.15}}>{title}</div>
      </div>
      {right && <div style={{marginTop:2}}>{right}</div>}
    </div>
  );
}

export function Badge({ label, color }) {
  return (
    <span style={{
      background:`${color}1a`, color, border:`1px solid ${color}38`,
      borderRadius:7, padding:'3px 9px', fontSize:10, fontWeight:700, letterSpacing:0.4,
      whiteSpace:'nowrap',
    }}>{label}</span>
  );
}

export function EmptyState({ Icon, text }) {
  return (
    <div style={{textAlign:'center', padding:'44px 20px'}}>
      {Icon && <div style={{display:'flex',justifyContent:'center',marginBottom:10,opacity:0.2}}>
        <Icon size={36} color="#fff"/>
      </div>}
      <div style={{color:'rgba(255,255,255,0.28)', fontSize:13}}>{text}</div>
    </div>
  );
}
