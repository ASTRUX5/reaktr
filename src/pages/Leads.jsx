import { useState, useEffect } from 'react';
import { Card, Btn, PageTitle, EmptyState, Modal, Input, RSelect, colors } from '../components/Layout.jsx';
import { api } from '../lib/api.js';
const {G,P,V} = colors;

export default function Leads() {
  const [leads,    setLeads]    = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [account,  setAccount]  = useState('');
  const [bModal,   setBModal]   = useState(false);
  const [bForm,    setBForm]    = useState({message:'',button_label:'',button_url:'',segment:'all'});
  const [bStatus,  setBStatus]  = useState('');

  const load = async (acId) => {
    const [l,a] = await Promise.all([api.getLeads(acId), api.getAccounts()]);
    setLeads(l); setAccounts(a);
  };
  useEffect(()=>{ load(''); },[]);

  const exportCSV = () => {
    const header='ig_user_id,field,value,timestamp\n';
    const rows=leads.map(l=>`${l.ig_user_id},${l.field},${(l.value||'').replace(/,/g,'')},${l.ts}`).join('\n');
    const blob=new Blob([header+rows],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='reaktr_leads.csv'; a.click();
  };

  const sendBroadcast = async () => {
    if(!bForm.message)  return setBStatus('Message is required');
    if(!account)        return setBStatus('Select an account first');
    setBStatus('Sending...');
    try {
      const buttons = bForm.button_url
        ? [{type:'url',title:bForm.button_label||'Click Here',url:bForm.button_url}]
        : [];
      const res = await api.broadcast({account_id:account,message:bForm.message,buttons,segment:bForm.segment});
      setBStatus(`✓ Sent to ${res.sent} / ${res.total} users`);
    } catch(e) { setBStatus('✗ '+e.message); }
  };

  const FIELD_COLOR = {email:G, phone:V, name:'#FBBF24'};

  return (
    <div className="fade-up">
      <PageTitle
        title="Leads"
        subtitle="LEAD CAPTURE"
        right={
          <div style={{display:'flex', gap:8}}>
            <Btn small variant="ghost" onClick={exportCSV}>CSV</Btn>
            <Btn small variant="pink" onClick={()=>setBModal(true)}>Broadcast</Btn>
          </div>
        }
      />
      <div style={{padding:'0 16px'}}>

        {/* Account filter */}
        <div style={{display:'flex', gap:8, marginBottom:16, overflowX:'auto'}}>
          {[{id:'',username:'All'},...accounts].map(a=>{
            const active=account===(a._id?.$oid||'');
            return (
              <button key={a._id?.$oid||'all'} onClick={()=>{setAccount(a._id?.$oid||'');load(a._id?.$oid||'');}} style={{
                background:active?`linear-gradient(135deg,${G},${V})`:'rgba(255,255,255,0.08)',
                border:'none', borderRadius:20, padding:'6px 16px',
                color:active?'#000':'rgba(255,255,255,0.6)',
                fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
              }}>{a.username==='All'?'All':(`@${a.username}`)}</button>
            );
          })}
        </div>

        {/* Stats row */}
        <div style={{
          background:`${G}12`, border:`1px solid ${G}30`, borderRadius:16,
          padding:'14px 16px', marginBottom:16, display:'flex', justifyContent:'space-between',
        }}>
          <div>
            <div style={{fontFamily:'Syne,sans-serif', fontSize:28, fontWeight:800, color:G}}>{leads.length}</div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2}}>Total leads</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily:'Syne,sans-serif', fontSize:28, fontWeight:800, color:V}}>
              {leads.filter(l=>l.field==='email').length}
            </div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2}}>Emails</div>
          </div>
        </div>

        {/* Leads list */}
        {leads.length===0
          ? <EmptyState icon="◉" text="No leads yet. Add a Lead Capture step to a flow."/>
          : (
            <Card>
              {leads.map((l,i)=>(
                <div key={l._id?.$oid||i} style={{
                  padding:'14px 16px',
                  borderBottom:i<leads.length-1?'1px solid rgba(255,255,255,0.05)':'none',
                }}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:14, color:'#fff', fontWeight:600, marginBottom:4}}>{l.value||'—'}</div>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <span style={{
                          background:`${FIELD_COLOR[l.field]||G}18`,
                          color:FIELD_COLOR[l.field]||G,
                          border:`1px solid ${FIELD_COLOR[l.field]||G}33`,
                          borderRadius:6, padding:'1px 8px', fontSize:10, fontWeight:700,
                        }}>{l.field?.toUpperCase()||'DATA'}</span>
                        <span style={{fontSize:11, color:'rgba(255,255,255,0.3)'}}>
                          ID: {l.ig_user_id?.slice(0,10)}...
                        </span>
                      </div>
                    </div>
                    <div style={{fontSize:10, color:'rgba(255,255,255,0.25)', flexShrink:0, marginLeft:8}}>
                      {l.ts ? new Date(l.ts).toLocaleDateString() : '—'}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )
        }
      </div>

      {bModal && (
        <Modal title="Broadcast Message" onClose={()=>{setBModal(false);setBStatus('');}}>
          <div style={{fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:16, lineHeight:1.6}}>
            Send a DM to all users who have interacted with your flows. Only users who previously messaged your page can receive broadcasts.
          </div>

          <div style={{marginBottom:14}}>
            <div style={{color:'rgba(255,255,255,0.4)', fontSize:11, fontWeight:600, marginBottom:6, letterSpacing:1}}>ACCOUNT</div>
            <select value={account} onChange={e=>setAccount(e.target.value)} style={{
              width:'100%', background:'rgba(255,255,255,0.07)',
              border:'1px solid rgba(255,255,255,0.12)', borderRadius:14,
              color:'#fff', padding:'12px 16px', fontSize:14, outline:'none',
              fontFamily:'DM Sans,sans-serif',
            }}>
              <option value="">Select account</option>
              {accounts.map(a=><option key={a._id?.$oid} value={a._id?.$oid}>@{a.username}</option>)}
            </select>
          </div>

          <div style={{marginBottom:14}}>
            <div style={{color:'rgba(255,255,255,0.4)', fontSize:11, fontWeight:600, marginBottom:6, letterSpacing:1}}>SEGMENT</div>
            <select value={bForm.segment} onChange={e=>setBForm(f=>({...f,segment:e.target.value}))} style={{
              width:'100%', background:'rgba(255,255,255,0.07)',
              border:'1px solid rgba(255,255,255,0.12)', borderRadius:14,
              color:'#fff', padding:'12px 16px', fontSize:14, outline:'none',
              fontFamily:'DM Sans,sans-serif',
            }}>
              <option value="all">All users</option>
              <option value="leads">Leads only</option>
            </select>
          </div>

          <div style={{marginBottom:14}}>
            <div style={{color:'rgba(255,255,255,0.4)', fontSize:11, fontWeight:600, marginBottom:6, letterSpacing:1}}>MESSAGE</div>
            <textarea
              value={bForm.message} rows={4}
              onChange={e=>setBForm(f=>({...f,message:e.target.value}))}
              placeholder="Hey! We've got something special for you... 🎁"
              style={{
                width:'100%', background:'rgba(255,255,255,0.07)',
                border:'1px solid rgba(255,255,255,0.12)', borderRadius:14,
                color:'#fff', padding:'12px 16px', fontSize:14, outline:'none',
                resize:'none', fontFamily:'DM Sans,sans-serif',
              }}
            />
          </div>

          <Input label="BUTTON LABEL (optional)" value={bForm.button_label} onChange={v=>setBForm(f=>({...f,button_label:v}))} placeholder="Check It Out 🚀"/>
          <Input label="BUTTON URL (optional)" value={bForm.button_url} onChange={v=>setBForm(f=>({...f,button_url:v}))} placeholder="https://yourlink.com" mono/>

          {bStatus && (
            <div style={{
              padding:'12px 14px', borderRadius:12, marginBottom:14, fontSize:12, fontWeight:600,
              background: bStatus.startsWith('✓')?'rgba(49,236,86,0.12)':bStatus==='Sending...'?'rgba(255,255,255,0.05)':'rgba(239,3,108,0.12)',
              color: bStatus.startsWith('✓')?G:bStatus==='Sending...'?'rgba(255,255,255,0.5)':P,
              border: `1px solid ${bStatus.startsWith('✓')?G+'33':bStatus==='Sending...'?'rgba(255,255,255,0.1)':P+'33'}`,
            }}>{bStatus}</div>
          )}

          <div style={{display:'flex', gap:10}}>
            <Btn variant="ghost" onClick={()=>{setBModal(false);setBStatus('');}}>Cancel</Btn>
            <Btn variant="pink" full onClick={sendBroadcast} disabled={bStatus==='Sending...'}>
              {bStatus==='Sending...'?'Sending...':'↗ Send Broadcast'}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
