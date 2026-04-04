import { useState, useEffect } from 'react';
import Layout    from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Flows     from './pages/Flows.jsx';
import Triggers  from './pages/Triggers.jsx';
import Accounts  from './pages/Accounts.jsx';
import Analytics from './pages/Analytics.jsx';
import Leads     from './pages/Leads.jsx';

// ── Simple hash router ────────────────────────────────────────
function useRoute() {
  const [route, setRoute] = useState(window.location.hash.replace('#', '') || '/');
  useEffect(() => {
    const handler = () => setRoute(window.location.hash.replace('#', '') || '/');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return route;
}

// ── Login screen ──────────────────────────────────────────────
function Login({ onLogin }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');

  const attempt = () => {
    if (!val.trim()) return setErr('Enter your dashboard secret key');
    localStorage.setItem('reaktr_secret', val.trim());
    onLogin();
  };

  return (
    <div style={{
      minHeight:'100vh', background:'#060608',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:"'Courier New', monospace",
    }}>
      <div style={{ width: 360, padding: 40 }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: '#00FFD1', letterSpacing: '-2px', marginBottom: 6 }}>REAKTR</div>
        <div style={{ fontSize: 10, letterSpacing: '4px', color: '#334155', marginBottom: 40 }}>DASHBOARD ACCESS</div>
        <input
          type="password"
          placeholder="Dashboard secret key"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#0f0f14', border: '1px solid #1e293b',
            color: '#e2e8f0', padding: '12px 16px',
            fontFamily: "'Courier New', monospace", fontSize: 13,
            outline: 'none', marginBottom: 8,
          }}
        />
        {err && <div style={{ color: '#FF6B6B', fontSize: 11, marginBottom: 8 }}>{err}</div>}
        <button onClick={attempt} style={{
          width: '100%', background: '#00FFD1', color: '#000',
          border: 'none', padding: '12px 0', cursor: 'pointer',
          fontFamily: "'Courier New', monospace", fontWeight: 900,
          fontSize: 11, letterSpacing: '3px',
        }}>ENTER →</button>
        <div style={{ marginTop: 24, fontSize: 10, color: '#1e293b', lineHeight: 1.6 }}>
          Set DASHBOARD_SECRET in Cloudflare Pages environment variables.
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('reaktr_secret'));
  const route = useRoute();

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const pages = {
    '/'          : <Dashboard />,
    '/flows'     : <Flows />,
    '/triggers'  : <Triggers />,
    '/accounts'  : <Accounts />,
    '/analytics' : <Analytics />,
    '/leads'     : <Leads />,
  };

  // Match route (prefix match for sub-routes)
  const Page = pages[route] ?? pages[route.split('?')[0]] ?? <Dashboard />;

  return (
    <Layout route={route}>
      {Page}
    </Layout>
  );
}
