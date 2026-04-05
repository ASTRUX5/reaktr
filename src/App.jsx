import { useState, useEffect } from 'react';
import Layout    from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Flows     from './pages/Flows.jsx';
import Triggers  from './pages/Triggers.jsx';
import Accounts  from './pages/Accounts.jsx';
import Analytics from './pages/Analytics.jsx';
import Leads     from './pages/Leads.jsx';

function useRoute() {
  const [route, setRoute] = useState(window.location.hash.replace('#', '') || '/');
  useEffect(() => {
    const h = () => setRoute(window.location.hash.replace('#', '') || '/');
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return route;
}

function Login({ onLogin }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const attempt = () => {
    if (!val.trim()) return setErr('Enter your secret key');
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem('reaktr_secret', val.trim());
      onLogin();
      setLoading(false);
    }, 500);
  };

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', padding:20, position:'relative', zIndex:1,
    }}>
      <div style={{
        position:'absolute', top:'35%', left:'50%', transform:'translate(-50%,-50%)',
        width:300, height:300,
        background:'radial-gradient(circle, rgba(239,3,108,0.12) 0%, transparent 70%)',
        pointerEvents:'none',
      }}/>
      <div className="fade-up" style={{
        width:'100%', maxWidth:380,
        background:'rgba(255,255,255,0.07)',
        backdropFilter:'blur(30px)', WebkitBackdropFilter:'blur(30px)',
        border:'1px solid rgba(255,255,255,0.12)',
        borderRadius:28, padding:'40px 28px',
        boxShadow:'0 8px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
      }}>
        <div style={{textAlign:'center', marginBottom:36}}>
          <div style={{
            fontFamily:'Syne, sans-serif', fontSize:38, fontWeight:800,
            background:'linear-gradient(135deg, #31EC56, #EE72F8)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            letterSpacing:'-1px',
          }}>REAKTR</div>
          <div style={{color:'rgba(255,255,255,0.4)', fontSize:11, marginTop:4, letterSpacing:3}}>
            DASHBOARD ACCESS
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <input
            type="password" placeholder="Enter secret key"
            value={val}
            onChange={e=>{setVal(e.target.value);setErr('');}}
            onKeyDown={e=>e.key==='Enter'&&attempt()}
            style={{
              width:'100%',
              background:'rgba(255,255,255,0.08)',
              border:`1px solid ${err?'rgba(239,3,108,0.6)':'rgba(255,255,255,0.12)'}`,
              borderRadius:16, color:'#fff', padding:'14px 18px',
              fontSize:15, outline:'none',
              fontFamily:'DM Sans, sans-serif', letterSpacing:2,
            }}
          />
          {err && <div style={{color:'#EF036C', fontSize:12, marginTop:6, paddingLeft:4}}>{err}</div>}
        </div>
        <button onClick={attempt} disabled={loading} style={{
          width:'100%',
          background:loading?'rgba(49,236,86,0.3)':'linear-gradient(135deg, #31EC56, #0db83a)',
          border:'none', borderRadius:16, color:'#000', padding:'14px',
          fontSize:15, fontWeight:700, fontFamily:'Syne, sans-serif',
          cursor:loading?'default':'pointer', letterSpacing:1,
          boxShadow:loading?'none':'0 4px 24px rgba(49,236,86,0.35)',
          transition:'all 0.2s',
        }}>{loading?'···':'Enter →'}</button>
        <p style={{
          color:'rgba(255,255,255,0.25)', fontSize:11,
          textAlign:'center', marginTop:20, lineHeight:1.6,
        }}>
          Set DASHBOARD_SECRET in<br/>Cloudflare environment variables
        </p>
        <div style={{
          display:'flex', justifyContent:'center', gap:24, marginTop:20,
          paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.07)',
        }}>
          <a href="/privacy.html" target="_blank" rel="noreferrer" style={{
            color:'rgba(255,255,255,0.35)', fontSize:12, textDecoration:'none',
          }}>Privacy Policy</a>
          <a href="/terms.html" target="_blank" rel="noreferrer" style={{
            color:'rgba(255,255,255,0.35)', fontSize:12, textDecoration:'none',
          }}>Terms of Service</a>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('reaktr_secret'));
  const route = useRoute();
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  const pages = {
    '/':'/','#/':'/','':'/','#':'/',
  };
  const clean = route.split('?')[0].replace(/^#/,'') || '/';
  const map = {
    '/':         <Dashboard />,
    '/flows':    <Flows />,
    '/triggers': <Triggers />,
    '/accounts': <Accounts />,
    '/analytics':<Analytics />,
    '/leads':    <Leads />,
  };
  return <Layout route={clean}>{map[clean] ?? <Dashboard />}</Layout>;
}
