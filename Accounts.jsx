import { useState, useEffect } from 'react';
import { Card, Btn, PageTitle, Badge, EmptyState, Modal, colors } from '../components/Layout.jsx';
import { api } from '../lib/api.js';
const {G,P,V} = colors;

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [msg,      setMsg]      = useState('');

  const load = () => api.getAccounts().then(setAccounts).catch(console.error).finally(()=>setLoading(false));

  useEffect(()=>{
    load();
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const connected = params.get('connected');
    if(connected){ setMsg(`Connected: @${connected}`); window.location.hash='/accounts'; }
  },[]);

  const connect = async () => {
    try { const {url} = await api.getOAuthUrl(); window.location.href = url; }
    catch(e) { alert('Error: '+e.message); }
  };

  const remove = async (row) => {
    if(!confirm(`Disconnect @${row.username}?`)) return;
    await api.deleteAccount(row._id?.$oid || row.id);
    load();
  };

  return (
    <div className="fade-up">
      <PageTitle
        title="Accounts"
        subtitle="MULTI-ACCOUNT"
        right={<Btn onClick={connect} small>+ Connect</Btn>}
      />

      <div style={{padding:'0 16px'}}>
        {msg && (
          <div style={{
            background:'rgba(49,236,86,0.12)', border:'1px solid rgba(49,236,86,0.3)',
            color:G, borderRadius:16, padding:'12px 16px', marginBottom:14, fontSize:13, fontWeight:500,
          }}>✓ {msg}</div>
        )}

        {/* Requirements */}
        <Card style={{marginBottom:14, padding:'16px'}}>
          <div style={{color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:600, letterSpacing:2, marginBottom:12}}>REQUIREMENTS</div>
          {[
            'Instagram Business Account',
            'Facebook Page connected to IG',
            'Meta Developer App configured',
          ].map(r=>(
            <div key={r} style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
              <div style={{width:18, height:18, borderRadius:6, background:`${G}22`, display:'flex', alignItems:'center', justifyContent:'center', color:G, fontSize:11, flexShrink:0}}>✓</div>
              <span style={{fontSize:13, color:'rgba(255,255,255,0.7)'}}>{r}</span>
            </div>
          ))}
        </Card>

        {/* How to connect */}
        <Card style={{marginBottom:16, padding:'16px'}}>
          <div style={{color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:600, letterSpacing:2, marginBottom:12}}>HOW TO CONNECT</div>
          {[
            'Tap "+ Connect" above',
            'Login with Facebook & authorise',
            'Select your Instagram Business account',
            'Your account goes live instantly',
          ].map((s,i)=>(
            <div key={i} style={{display:'flex', gap:10, marginBottom:10, alignItems:'flex-start'}}>
              <div style={{
                width:22, height:22, borderRadius:8, flexShrink:0,
                background:`linear-gradient(135deg, ${G}33, ${V}33)`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, fontWeight:800, color:G, fontFamily:'Syne,sans-serif',
              }}>{i+1}</div>
              <span style={{fontSize:13, color:'rgba(255,255,255,0.7)', paddingTop:2}}>{s}</span>
            </div>
          ))}
        </Card>

        {/* Connect button */}
        <Btn onClick={connect} full>+ Connect Instagram Account</Btn>

        {/* Accounts list */}
        {!loading && accounts.length > 0 && (
          <div style={{marginTop:20}}>
            <div style={{color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:600, letterSpacing:2, marginBottom:10}}>
              CONNECTED ({accounts.length})
            </div>
            <Card>
              {accounts.map((a,i)=>(
                <div key={a._id?.$oid||i} style={{
                  padding:'14px 16px',
                  borderBottom:i<accounts.length-1?'1px solid rgba(255,255,255,0.06)':'none',
                }}>
                  <div style={{display:'flex', alignItems:'center', gap:12}}>
                    {a.profile_pic
                      ? <img src={a.profile_pic} style={{width:44,height:44,borderRadius:'50%',border:`2px solid ${G}44`}} alt=""/>
                      : <div style={{
                          width:44,height:44,borderRadius:'50%',
                          background:`linear-gradient(135deg,${G}33,${V}33)`,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          color:G,fontSize:18,fontWeight:800,
                        }}>@</div>
                    }
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:15,color:'#fff'}}>@{a.username}</div>
                      <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:2}}>
                        {a.name} · ID: {a.ig_id?.slice(0,10)}...
                      </div>
                    </div>
                    <button onClick={()=>remove(a)} style={{
                      background:'rgba(239,3,108,0.12)', border:'1px solid rgba(239,3,108,0.3)',
                      color:P, borderRadius:10, padding:'6px 12px',
                      fontSize:11, fontWeight:600, cursor:'pointer',
                    }}>Remove</button>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {loading && (
          <div style={{textAlign:'center', padding:'40px 0', color:'rgba(255,255,255,0.3)', fontSize:13}}>
            Loading...
          </div>
        )}
      </div>
    </div>
  );
}
