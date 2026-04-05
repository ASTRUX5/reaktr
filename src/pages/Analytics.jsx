import { useState, useEffect } from 'react';
import { Card, StatCard, PageTitle, EmptyState, colors } from '../components/Layout.jsx';
import { IcTrigger, IcFlow, IcLeads, IcCheck, IcClock, IcAnalytics } from '../components/Icons.jsx';
import { api } from '../lib/api.js';
const {G,P,V} = colors;

const EVT_COLOR = {
  trigger_fired:'#31EC56', step_executed:'#EE72F8',
  lead_captured:'#FBBF24', follow_verified:'#31EC56',
  flow_started:'#60A5FA',  broadcast_sent:'#EF036C',
};

function timeAgo(ts) {
  if(!ts) return '';
  const m=Math.floor((Date.now()-new Date(ts).getTime())/60000);
  if(m<1) return 'just now'; if(m<60) return `${m}m ago`;
  const h=Math.floor(m/60); if(h<24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

export default function Analytics() {
  const [data,     setData]     = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [account,  setAccount]  = useState('');
  const [loading,  setLoading]  = useState(true);

  const load = async (acId) => {
    setLoading(true);
    const [d,a] = await Promise.all([api.getAnalytics(acId), api.getAccounts()]);
    setData(d); setAccounts(a); setLoading(false);
  };
  useEffect(()=>{ load(''); },[]);

  const timeline = () => {
    if(!data?.recentEvents) return [];
    const hours = {};
    for(const e of data.recentEvents) {
      const h = new Date(e.ts).getHours();
      hours[h] = (hours[h]??0)+1;
    }
    return Array.from({length:24},(_,i)=>({h:i,count:hours[i]??0}));
  };

  const breakdown = () => {
    if(!data?.recentEvents) return [];
    const counts={};
    for(const e of data.recentEvents) counts[e.type]=(counts[e.type]??0)+1;
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  };

  const tl=timeline(), maxTl=Math.max(1,...tl.map(x=>x.count));
  const bd=breakdown(), maxBd=Math.max(1,...bd.map(x=>x[1]));

  return (
    <div className="fade-up">
      <PageTitle title="Analytics" subtitle="TRACKING"/>
      <div style={{padding:'0 16px'}}>

        {/* Account filter pills */}
        <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, overflowX:'auto'}}>
          {[{id:'',username:'All'},...accounts].map(a=>{
            const active = account===(a._id?.$oid||a.id||'');
            return (
              <button key={a._id?.$oid||'all'} onClick={()=>{setAccount(a._id?.$oid||'');load(a._id?.$oid||'');}} style={{
                background: active?`linear-gradient(135deg,${G},${V})`:'rgba(255,255,255,0.08)',
                border:'none', borderRadius:20, padding:'6px 16px',
                color: active?'#000':'rgba(255,255,255,0.6)',
                fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
              }}>{a.username==='All'?'All Accounts':`@${a.username}`}</button>
            );
          })}
        </div>

        {loading
          ? <div style={{textAlign:'center',padding:'40px 0',color:'rgba(255,255,255,0.3)'}}>Loading...</div>
          : (<>
            {/* Stats */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16}}>
              <StatCard label="Triggers Fired"  value={data?.triggersTotal}  color={G}       Icon={IcTrigger}/>
              <StatCard label="DMs Sent"        value={data?.dmsSent}        color={V}       Icon={IcFlow}/>
              <StatCard label="Leads Captured"  value={data?.leadsTotal}     color="#FBBF24" Icon={IcLeads}/>
              <StatCard label="Follow Verified" value={data?.followVerified} color={G}       Icon={IcCheck}/>
            </div>

            {/* Activity chart */}
            <Card style={{padding:'16px', marginBottom:14}}>
              <div style={{color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:600, letterSpacing:2, marginBottom:14}}>
                HOURLY ACTIVITY (LAST 50 EVENTS)
              </div>
              <div style={{display:'flex', alignItems:'flex-end', gap:2, height:64, marginBottom:6}}>
                {tl.map(({h,count})=>(
                  <div key={h} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center'}}>
                    <div style={{
                      width:'100%', minHeight: count>0?3:0,
                      height:`${(count/maxTl)*58}px`,
                      background: count>0?`linear-gradient(180deg,${G},${G}88)`:'rgba(255,255,255,0.05)',
                      borderRadius:3,
                    }} title={`${h}:00 — ${count}`}/>
                  </div>
                ))}
              </div>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:9, color:'rgba(255,255,255,0.2)'}}>
                <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
              </div>
            </Card>

            {/* Breakdown */}
            {bd.length>0 && (
              <Card style={{padding:'16px', marginBottom:14}}>
                <div style={{color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:600, letterSpacing:2, marginBottom:14}}>
                  EVENT BREAKDOWN
                </div>
                {bd.map(([type,count])=>(
                  <div key={type} style={{marginBottom:12}}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:5}}>
                      <span style={{fontSize:12, color:EVT_COLOR[type]||'rgba(255,255,255,0.4)', fontWeight:600}}>
                        {type.replace(/_/g,' ')}
                      </span>
                      <span style={{fontSize:12, color:'rgba(255,255,255,0.5)', fontWeight:700}}>{count}</span>
                    </div>
                    <div style={{height:4, background:'rgba(255,255,255,0.06)', borderRadius:2}}>
                      <div style={{
                        height:'100%', width:`${(count/maxBd)*100}%`,
                        background:EVT_COLOR[type]||G, borderRadius:2,
                        transition:'width 0.4s',
                      }}/>
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {/* Event log */}
            <div style={{color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:600, letterSpacing:2, marginBottom:10}}>
              RECENT EVENTS
            </div>
            <Card>
              {(data?.recentEvents??[]).length===0
                ? <EmptyState icon="◷" text="No events yet"/>
                : (data.recentEvents).slice(0,20).map((e,i)=>(
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'11px 16px',
                    borderBottom: i<19?'1px solid rgba(255,255,255,0.05)':'none',
                  }}>
                    <div style={{
                      width:8, height:8, borderRadius:'50%', flexShrink:0,
                      background:EVT_COLOR[e.type]||'rgba(255,255,255,0.3)',
                    }}/>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:12, color:'rgba(255,255,255,0.8)', fontWeight:500}}>
                        {e.type?.replace(/_/g,' ')}
                      </div>
                      {e.keyword && <div style={{fontSize:10, color:'rgba(255,255,255,0.3)'}}>"{e.keyword}"</div>}
                    </div>
                    <div style={{fontSize:10, color:'rgba(255,255,255,0.25)', flexShrink:0}}>{timeAgo(e.ts)}</div>
                  </div>
                ))
              }
            </Card>
          </>)
        }
      </div>
    </div>
  );
}
