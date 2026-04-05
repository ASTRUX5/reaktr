import { useState, useEffect } from 'react';
import { Card, Btn, PageTitle, Badge, EmptyState, Modal, Input, RSelect, colors } from '../components/Layout.jsx';
import { api } from '../lib/api.js';
const {G,P,V} = colors;

const STEP_TYPES = [
  {value:'text',          label:'Text Message',    color:'#60A5FA', icon:'💬'},
  {value:'buttons',       label:'Buttons',          color:V,         icon:'🔘'},
  {value:'quick_replies', label:'Quick Replies',    color:G,         icon:'⚡'},
  {value:'follow_gate',   label:'Follow Gate',      color:G,         icon:'🔐'},
  {value:'url_button',    label:'URL Button',       color:'#FBBF24', icon:'🔗'},
  {value:'lead_capture',  label:'Lead Capture',     color:P,         icon:'📧'},
  {value:'delay',         label:'Delay',            color:'#64748b', icon:'⏱'},
];

const TEMPLATES = [
  { name:'🎁 Free Guide (Follow Gate)',
    steps:[
      {id:'s1',type:'text',       text:'Hey! Thanks for stopping by 👋',delay_ms:0},
      {id:'s2',type:'follow_gate',text:'Follow us to unlock your free guide! 👇',next_step:'s3'},
      {id:'s3',type:'url_button', text:"You're verified! Here's your free guide 🎉",button_label:'📖 Get Free Guide',url:'https://yourguide.com'},
    ]},
  { name:'📧 Lead Capture Flow',
    steps:[
      {id:'s1',type:'text',        text:"Hey! I've got something special for you 🎁",delay_ms:0},
      {id:'s2',type:'lead_capture',text:'Drop your email and I\'ll send it over! 📩',field:'email',next_step:'s3',skip_step:'s3'},
      {id:'s3',type:'url_button',  text:'Here you go!',button_label:'🚀 Access Now',url:'https://yourlink.com'},
    ]},
  { name:'✅ Simple DM Reply',
    steps:[
      {id:'s1',type:'text',      text:'Thanks for commenting! 👇',delay_ms:0},
      {id:'s2',type:'url_button',text:"Here's the link!",button_label:'👉 Open Link',url:'https://yourlink.com'},
    ]},
];

const BLANK_FLOW = {name:'',account_id:'',description:'',steps:[],active:true};
const genId = () => 's'+Math.random().toString(36).slice(2,7);

const MATCH_OPTS = [
  {value:'email',label:'Email'},{value:'phone',label:'Phone'},{value:'name',label:'Name'},
];

export default function Flows() {
  const [flows,    setFlows]    = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [modal,    setModal]    = useState(null);
  const [flow,     setFlow]     = useState(BLANK_FLOW);
  const [selStep,  setSelStep]  = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');

  const load = async () => {
    const [f,a] = await Promise.all([api.getFlows(), api.getAccounts()]);
    setFlows(f); setAccounts(a);
  };
  useEffect(()=>{ load(); },[]);

  const openNew = (tpl=null) => {
    setFlow({
      ...BLANK_FLOW,
      account_id: accounts[0]?._id?.$oid||'',
      ...(tpl?{name:tpl.name,steps:tpl.steps}:{}),
    });
    setSelStep(null); setErr(''); setModal('builder');
  };

  const addStep = type => {
    const step = {
      id:genId(), type, text:'', delay_ms:0,
      ...(type==='buttons'       ? {buttons:[{type:'postback',title:'',next_step:''}]}:{}),
      ...(type==='quick_replies' ? {replies:[{title:'',next_step:''}]}:{}),
      ...(type==='url_button'    ? {button_label:'Click Here',url:''}:{}),
      ...(type==='lead_capture'  ? {field:'email',next_step:'',skip_step:''}:{}),
      ...(type==='delay'         ? {ms:2000}:{}),
    };
    const steps = [...flow.steps, step];
    setFlow(f=>({...f,steps}));
    setSelStep(steps.length-1);
  };

  const updStep = (idx, patch) => setFlow(f=>({...f,steps:f.steps.map((s,i)=>i===idx?{...s,...patch}:s)}));
  const delStep = idx => { setFlow(f=>({...f,steps:f.steps.filter((_,i)=>i!==idx)})); setSelStep(null); };

  const save = async () => {
    if(!flow.name)          return setErr('Flow name required');
    if(!flow.account_id)    return setErr('Select account');
    if(!flow.steps.length)  return setErr('Add at least one step');
    setSaving(true);
    try { await api.createFlow(flow); setModal(null); load(); }
    catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const remove = async row => {
    if(!confirm(`Delete "${row.name}"?`)) return;
    await api.deleteFlow(row._id?.$oid||row.id); load();
  };

  const toggle = async row => {
    await api.updateFlow(row._id?.$oid||row.id, {active:!row.active}); load();
  };

  const accountOpts = [{value:'',label:'Select account'}, ...accounts.map(a=>({value:a._id?.$oid||'',label:`@${a.username}`}))];
  const stepIds = flow.steps.map(s=>({value:s.id, label:`${s.type} — ${s.text?.slice(0,18)||'(no text)'}`}));
  const typeInfo = t => STEP_TYPES.find(x=>x.value===t)||{color:'#64748b',icon:'?'};
  const cur = selStep!==null ? flow.steps[selStep] : null;

  return (
    <div className="fade-up">
      <PageTitle
        title="Flows"
        subtitle="FLOW BUILDER"
        right={<Btn small onClick={()=>setModal('templates')}>+ New</Btn>}
      />
      <div style={{padding:'0 16px'}}>
        {flows.length===0
          ? <EmptyState icon="⟁" text="No flows yet. Create one to define your DM conversations."/>
          : flows.map((f,i)=>(
            <Card key={f._id?.$oid||i} style={{marginBottom:10, padding:'16px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                <div style={{fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#fff', flex:1, minWidth:0, paddingRight:8}}>
                  {f.name}
                </div>
                <Badge label={f.active?'ACTIVE':'PAUSED'} color={f.active?G:P}/>
              </div>
              <div style={{fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:12}}>
                {Array.isArray(f.steps)?f.steps.length:0} steps
                {f.description ? ' · '+f.description : ''}
              </div>
              <div style={{display:'flex', gap:8}}>
                <Btn small variant={f.active?'ghost':'primary'} onClick={()=>toggle(f)}>
                  {f.active?'Pause':'Resume'}
                </Btn>
                <Btn small variant="danger" onClick={()=>remove(f)}>Delete</Btn>
              </div>
            </Card>
          ))
        }
      </div>

      {/* Templates picker */}
      {modal==='templates' && (
        <Modal title="New Flow" onClose={()=>setModal(null)}>
          <div style={{fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:14}}>Choose a template or start blank</div>
          {TEMPLATES.map((t,i)=>(
            <button key={i} onClick={()=>openNew(t)} style={{
              display:'block', width:'100%', textAlign:'left',
              background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)',
              borderRadius:16, padding:'14px 16px', marginBottom:8, cursor:'pointer',
            }}>
              <div style={{fontWeight:700, fontSize:14, color:'#fff', marginBottom:4}}>{t.name}</div>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.4)'}}>{t.steps.length} steps</div>
            </button>
          ))}
          <button onClick={()=>openNew()} style={{
            display:'block', width:'100%', textAlign:'left',
            background:'transparent', border:'1px dashed rgba(255,255,255,0.15)',
            borderRadius:16, padding:'14px 16px', cursor:'pointer',
            color:'rgba(255,255,255,0.4)', fontSize:14,
          }}>⬡ Start from scratch</button>
        </Modal>
      )}

      {/* Full-screen flow builder */}
      {modal==='builder' && (
        <div style={{
          position:'fixed', inset:0, background:'#07070F',
          zIndex:100, display:'flex', flexDirection:'column', overflow:'hidden',
        }}>
          {/* Builder top bar */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'12px 16px',
            background:'rgba(255,255,255,0.05)',
            borderBottom:'1px solid rgba(255,255,255,0.08)',
          }}>
            <button onClick={()=>setModal(null)} style={{
              background:'none', border:'none', color:'rgba(255,255,255,0.5)',
              fontSize:22, cursor:'pointer', lineHeight:1,
            }}>←</button>
            <div style={{fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:16, color:'#fff'}}>
              Flow Builder
            </div>
            <Btn small onClick={save} disabled={saving}>{saving?'...':'Save'}</Btn>
          </div>

          <div style={{flex:1, overflowY:'auto', padding:'16px'}}>
            {/* Flow meta */}
            <Input label="FLOW NAME" value={flow.name} onChange={v=>setFlow(f=>({...f,name:v}))} placeholder="My Awesome Flow"/>
            <RSelect label="ACCOUNT" value={flow.account_id} onChange={v=>setFlow(f=>({...f,account_id:v}))} options={accountOpts}/>

            {err && <div style={{color:P, fontSize:12, marginBottom:12}}>{err}</div>}

            {/* Steps list */}
            <div style={{color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:600, letterSpacing:2, marginBottom:10}}>
              STEPS ({flow.steps.length})
            </div>

            {flow.steps.map((s,i)=>{
              const info = typeInfo(s.type);
              const isSelected = selStep===i;
              return (
                <div key={s.id}>
                  <button onClick={()=>setSelStep(isSelected?null:i)} style={{
                    width:'100%', textAlign:'left',
                    background: isSelected ? `${info.color}15` : 'rgba(255,255,255,0.05)',
                    border:`1px solid ${isSelected ? info.color+'44' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius:16, padding:'12px 14px', marginBottom:8, cursor:'pointer',
                  }}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <span style={{fontSize:18}}>{info.icon}</span>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:12, color:info.color, fontWeight:700, marginBottom:2}}>
                          {s.type.replace(/_/g,' ').toUpperCase()}
                        </div>
                        <div style={{fontSize:12, color:'rgba(255,255,255,0.5)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {s.text||'(no text yet)'}
                        </div>
                      </div>
                      <span style={{color:'rgba(255,255,255,0.3)', fontSize:14}}>{isSelected?'▲':'▼'}</span>
                    </div>
                  </button>

                  {/* Inline step editor */}
                  {isSelected && (
                    <div style={{
                      background:'rgba(255,255,255,0.04)',
                      border:`1px solid ${info.color}33`,
                      borderRadius:16, padding:'16px', marginBottom:12, marginTop:-4,
                    }}>
                      {s.type!=='delay' && (
                        <div style={{marginBottom:12}}>
                          <div style={{color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:600, letterSpacing:1, marginBottom:6}}>MESSAGE TEXT</div>
                          <textarea
                            value={s.text||''}
                            onChange={e=>updStep(i,{text:e.target.value})}
                            placeholder="Use {{username}}, {{comment}}, {{keyword}}"
                            rows={3}
                            style={{
                              width:'100%', background:'rgba(255,255,255,0.07)',
                              border:'1px solid rgba(255,255,255,0.12)',
                              borderRadius:12, color:'#fff', padding:'10px 14px',
                              fontSize:13, outline:'none', resize:'none',
                              fontFamily:'DM Sans, sans-serif',
                            }}
                          />
                        </div>
                      )}
                      {s.type==='url_button' && (<>
                        <Input label="BUTTON LABEL" value={s.button_label} onChange={v=>updStep(i,{button_label:v})} placeholder="Get Your Guide →"/>
                        <Input label="URL" value={s.url} onChange={v=>updStep(i,{url:v})} placeholder="https://" mono/>
                      </>)}
                      {s.type==='follow_gate' && (
                        <RSelect label="NEXT STEP (after follow verified)"
                          value={s.next_step||''}
                          onChange={v=>updStep(i,{next_step:v})}
                          options={[{value:'',label:'— End flow —'},...stepIds.filter(x=>x.value!==s.id)]}
                        />
                      )}
                      {s.type==='lead_capture' && (<>
                        <RSelect label="CAPTURE FIELD" value={s.field||'email'} onChange={v=>updStep(i,{field:v})} options={MATCH_OPTS}/>
                        <RSelect label="NEXT STEP"
                          value={s.next_step||''}
                          onChange={v=>updStep(i,{next_step:v})}
                          options={[{value:'',label:'— End flow —'},...stepIds.filter(x=>x.value!==s.id)]}
                        />
                      </>)}
                      {s.type==='delay' && (
                        <Input label="DELAY (ms)" value={s.ms||2000} onChange={v=>updStep(i,{ms:parseInt(v)||2000})} placeholder="2000" mono/>
                      )}
                      <div style={{marginTop:8}}>
                        <Btn small variant="danger" onClick={()=>delStep(i)}>Delete Step</Btn>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add step */}
            <div style={{color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:600, letterSpacing:2, marginBottom:10, marginTop:8}}>
              ADD STEP
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:24}}>
              {STEP_TYPES.map(t=>(
                <button key={t.value} onClick={()=>addStep(t.value)} style={{
                  background:`${t.color}12`, border:`1px solid ${t.color}30`,
                  borderRadius:14, padding:'12px 8px', cursor:'pointer',
                  color:t.color, fontSize:12, fontWeight:600,
                  fontFamily:'DM Sans,sans-serif', textAlign:'center',
                }}>
                  <div style={{fontSize:18, marginBottom:4}}>{t.icon}</div>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
