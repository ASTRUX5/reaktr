// ─── REAKTR · Layout Component ───────────────────────────────────────────────

const NAV = [
  { path: '/',          label: 'OVERVIEW',   icon: '◈' },
  { path: '/accounts',  label: 'ACCOUNTS',   icon: '⬡' },
  { path: '/triggers',  label: 'TRIGGERS',   icon: '◎' },
  { path: '/flows',     label: 'FLOWS',      icon: '⟁' },
  { path: '/analytics', label: 'ANALYTICS',  icon: '◷' },
  { path: '/leads',     label: 'LEADS',      icon: '◉' },
];

export default function Layout({ children, route }) {
  const nav  = p => { window.location.hash = p; };
  const base = route.split('?')[0];

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: '#060608', fontFamily: "'Courier New', monospace",
      color: '#e2e8f0',
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 200, flexShrink: 0,
        borderRight: '1px solid #0f0f14',
        display: 'flex', flexDirection: 'column',
        background: '#040406',
        position: 'sticky', top: 0, height: '100vh',
      }}>
        {/* Logo */}
        <div style={{ padding: '28px 24px 20px' }}>
          <div style={{
            fontSize: 22, fontWeight: 900, letterSpacing: '-1px',
            background: 'linear-gradient(135deg,#00FFD1,#00A8A8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>REAKTR</div>
          <div style={{ fontSize: 8, letterSpacing: '3px', color: '#1e293b', marginTop: 3 }}>
            AUTO DM PLATFORM
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {NAV.map(item => {
            const active = base === item.path;
            return (
              <button key={item.path} onClick={() => nav(item.path)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 24px',
                background: active ? 'rgba(0,255,209,0.05)' : 'transparent',
                borderLeft: `2px solid ${active ? '#00FFD1' : 'transparent'}`,
                border: 'none', borderRight: 'none', borderTop: 'none', borderBottom: 'none',
                borderLeft: `2px solid ${active ? '#00FFD1' : 'transparent'}`,
                color: active ? '#00FFD1' : '#334155',
                cursor: 'pointer', fontSize: 10, letterSpacing: '2px',
                textAlign: 'left', fontFamily: "'Courier New', monospace",
                transition: 'all 0.1s',
              }}>
                <span style={{ fontSize: 14, opacity: active ? 1 : 0.5 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #0f0f14' }}>
          <div style={{ fontSize: 9, color: '#1e293b', letterSpacing: '2px' }}>v1.0.0 · OPEN SOURCE</div>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{
              marginTop: 10, fontSize: 9, color: '#334155', background: 'none',
              border: 'none', cursor: 'pointer', letterSpacing: '2px',
              fontFamily: "'Courier New', monospace", padding: 0,
            }}>SIGN OUT →</button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowX: 'hidden', minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}

// ── Shared UI primitives ──────────────────────────────────────

export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{
      padding: '32px 36px 24px',
      borderBottom: '1px solid #0f0f14',
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
    }}>
      <div>
        <div style={{ fontSize: 9, letterSpacing: '4px', color: '#334155', marginBottom: 6 }}>
          {subtitle}
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-1px', color: '#f1f5f9' }}>
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, accent = '#00FFD1' }) {
  return (
    <div style={{ background: '#0a0a0f', padding: '20px 24px', borderLeft: `2px solid ${accent}22` }}>
      <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: accent, letterSpacing: '-1px' }}>{value ?? '—'}</div>
    </div>
  );
}

export function Btn({ children, onClick, variant = 'primary', small, disabled }) {
  const styles = {
    primary  : { background: '#00FFD1', color: '#000' },
    secondary: { background: '#0f0f14', color: '#64748b', border: '1px solid #1e293b' },
    danger   : { background: 'transparent', color: '#FF6B6B', border: '1px solid #FF6B6B33' },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[variant],
      padding: small ? '6px 14px' : '9px 20px',
      border: 'none', cursor: disabled ? 'default' : 'pointer',
      fontFamily: "'Courier New', monospace",
      fontSize: small ? 9 : 10, fontWeight: 700, letterSpacing: '2px',
      opacity: disabled ? 0.4 : 1, transition: 'opacity 0.1s',
      ...(styles[variant].border ? { border: styles[variant].border } : {}),
    }}>{children}</button>
  );
}

export function Input({ label, value, onChange, placeholder, type = 'text', mono }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 6 }}>{label}</div>}
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: '#0a0a0f', border: '1px solid #1e293b',
          color: '#e2e8f0', padding: '10px 14px',
          fontFamily: mono ? "'Courier New', monospace" : 'inherit',
          fontSize: 13, outline: 'none',
        }}
      />
    </div>
  );
}

export function Select({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 6 }}>{label}</div>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        width: '100%', background: '#0a0a0f', border: '1px solid #1e293b',
        color: '#e2e8f0', padding: '10px 14px', fontSize: 13, outline: 'none',
        fontFamily: "'Courier New', monospace",
      }}>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div style={{
        background: '#0a0a0f', border: '1px solid #1e293b',
        width: '90%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto',
        padding: 32, position: 'relative',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.5px' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Table({ columns, rows, onDelete, onToggle }) {
  if (!rows?.length) return (
    <div style={{ padding: '40px 36px', color: '#334155', fontSize: 11, letterSpacing: '2px' }}>
      NO DATA YET
    </div>
  );
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} style={{
                padding: '10px 16px', textAlign: 'left',
                fontSize: 9, letterSpacing: '3px', color: '#334155',
                borderBottom: '1px solid #0f0f14', fontWeight: 700,
              }}>{c.label}</th>
            ))}
            {(onDelete || onToggle) && <th style={{ width: 100 }} />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #0a0a0f' }}>
              {columns.map(c => (
                <td key={c.key} style={{
                  padding: '12px 16px', fontSize: 12, color: '#94a3b8',
                  ...(c.mono ? { fontFamily: "'Courier New', monospace", color: '#00FFD1', fontSize: 11 } : {}),
                }}>
                  {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                </td>
              ))}
              {(onDelete || onToggle) && (
                <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {onToggle && (
                      <Btn small variant={row.active ? 'secondary' : 'primary'}
                        onClick={() => onToggle(row)}>
                        {row.active ? 'PAUSE' : 'RESUME'}
                      </Btn>
                    )}
                    {onDelete && (
                      <Btn small variant="danger" onClick={() => onDelete(row)}>DEL</Btn>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
