import { useState, useEffect } from 'react';
import { Card, StatCard, PageTitle, Badge, EmptyState, colors } from '../components/Layout.jsx';
import { api } from '../lib/api.js';
const {G,P,V} = colors;

function timeAgo(ts) {
  if(!ts) return '';
  const m = Math.floor((Date.now()-new Date(ts).getTime())/60000);
  if(m<1) return 'just now';
  if(m<60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if(h<24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

const EVT = {
  trigger_fired   :{label:'Trigger fired',   color:G,  icon:'◎'},
  step_executed   :{label:'Step executed',   color:V,  icon:'⟁'},
  lead_captured   :{label:'Lead captured',   color:'#FBBF24', icon:'◉'},
  follow_verified :{label:'Follow verified', color:G,  icon:'✓'},
  flow_started    :{label:'Flow started',    color:'#60A5FA', icon:'⬡'},
  broadcast_sent  :{label:'Broadcast sent',  color:P,  icon:'↗'},
};

export default function Dashboard() {
  const [stats,    setStats]    = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(()=>{
    Promise.all([api.getAnalytics(), api.getAccounts()])
      .then(([s,a])=>{ setStats(s); setAccounts(a); })
      .catch(console.error)
      .finally(()=>setLoading(false));
  },[]);

  return (
    <div className="fade-up" style={{padding:'0 0 8px'}}>
      <PageTitle title="Overview" subtitle="REAKTR" />

      {/* Stats grid */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:'0 16px 16px'}}>
        <StatCard label="Triggers Fired"  value={stats?.triggersTotal}  color={G}          icon="◎" />
        <StatCard label="DMs Sent"        value={stats?.dmsSent}        color={V}          icon="💬" />
        <StatCard label="Leads Captured"  value={stats?.leadsTotal}     color="#FBBF24"    icon="◉" />
        <StatCard label="Follow Verified" value={stats?.followVerified} color={G}          icon="✓" />
        <StatCard label="Sessions"        value={stats?.sessions}       color={P}          icon="⬡" />
        <StatCard label="Accounts"        value={accounts.length}       color={V}          icon="@" />
      </div>

      {/* Connected Accounts */}
      <div style={{padding:'0 16px 16px'}}>
        <div style={{color:'rgba(255,255,255,0.4)', fontSize:11, fontWeight:600, letterSpacing:2, marginBottom:10}}>
          CONNECTED ACCOUNTS
        </div>
        <Card>
          {loading
            ? <Skeleton/>
            : accounts.length === 0
            ? <EmptyState icon="⬡" text="No accounts connected yet" />
            : accounts.map((a,i)=>(
              <div key={a._id?.$oid||i} style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'14px 16px',
                borderBottom: i<accounts.length-1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}>
                {a.profile_pic
                  ? <img src={a.profile_pic} style={{width:40,height:40,borderRadius:'50%',border:`2px solid ${G}44`}} alt=""/>
                  : <div style={{
                      width:40, height:40, borderRadius:'50%',
                      background:`linear-gradient(135deg, ${G}33, ${V}33)`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:G, fontSize:16, fontWeight:800, fontFamily:'Syne,sans-serif',
                    }}>@</div>
                }
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontWeight:700, fontSize:14, color:'#fff', marginBottom:2}}>@{a.username}</div>
                  <Badge label="ACTIVE" color={G}/>
                </div>
              </div>
            ))
          }
        </Card>
      </div>

      {/* Recent activity */}
      <div style={{padding:'0 16px 16px'}}>
        <div style={{color:'rgba(255,255,255,0.4)', fontSize:11, fontWeight:600, letterSpacing:2, marginBottom:10}}>
          RECENT ACTIVITY
        </div>
        <Card>
          {loading
            ? <Skeleton/>
            : (stats?.recentEvents??[]).length === 0
            ? <EmptyState icon="◷" text="No activity yet" />
            : (stats.recentEvents).slice(0,8).map((e,i)=>{
                const info = EVT[e.type] ?? {label:e.type, color:'rgba(255,255,255,0.3)', icon:'·'};
                return (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'12px 16px',
                    borderBottom:i<7?'1px solid rgba(255,255,255,0.05)':'none',
                  }}>
                    <div style={{
                      width:32, height:32, borderRadius:10,
                      background:`${info.color}18`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:14, color:info.color, flexShrink:0,
                    }}>{info.icon}</div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:13, color:'rgba(255,255,255,0.85)', fontWeight:500}}>
                        {info.label}
                      </div>
                      {e.keyword && <div style={{fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:1}}>keyword: {e.keyword}</div>}
                    </div>
                    <div style={{fontSize:10, color:'rgba(255,255,255,0.25)', flexShrink:0}}>
                      {timeAgo(e.ts)}
                    </div>
                  </div>
                );
              })
          }
        </Card>
      </div>

      {/* Quick actions */}
      <div style={{padding:'0 16px'}}>
        <div style={{color:'rgba(255,255,255,0.4)', fontSize:11, fontWeight:600, letterSpacing:2, marginBottom:10}}>
          QUICK ACTIONS
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
          {[
            {label:'+ Add Account', path:'/accounts', color:G},
            {label:'+ New Flow',    path:'/flows',    color:V},
            {label:'+ New Trigger', path:'/triggers', color:P},
            {label:'View Analytics',path:'/analytics',color:'#60A5FA'},
          ].map(a=>(
            <button key={a.path} onClick={()=>window.location.hash=a.path} style={{
              background:`${a.color}12`, border:`1px solid ${a.color}30`,
              borderRadius:16, padding:'14px 10px', cursor:'pointer',
              color:a.color, fontSize:13, fontWeight:700,
              fontFamily:'DM Sans, sans-serif', textAlign:'center',
            }}>{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{padding:'16px'}}>
      {[1,2,3].map(i=>(
        <div key={i} style={{
          height:48, borderRadius:12,
          background:'rgba(255,255,255,0.05)',
          marginBottom:8,
          animation:'pulse 1.5s ease infinite',
        }}/>
      ))}
    </div>
  );
}
