import { useState, useEffect } from 'react';
import { Card, Btn, PageTitle, Badge, EmptyState, Modal, Input, RSelect, Textarea, colors } from '../components/Layout.jsx';
import { IcFlow, IcPlus, IcTrash, IcPause, IcPlay, IcArrowUp, IcArrowDown, IcLink, IcMail, IcTrigger, IcClock, IcCheck, IcKey } from '../components/Icons.jsx';
import { api } from '../lib/api.js';
const {G,P,V} = colors;

const STEP_TYPES = [
  {value:'text',          label:'Text Message',    color:'#60A5FA', Icon:IcTrigger},
  {value:'buttons',       label:'Button Template', color:V,         Icon:IcKey},
  {value:'quick_replies', label:'Quick Replies',   color:G,         Icon:IcCheck},
  {value:'follow_gate',   label:'Follow Gate',     color:G,         Icon:IcCheck},
  {value:'url_button',    label:'URL Button',      color:'#FBBF24', Icon:IcLink},
  {value:'lead_capture',  label:'Lead Capture',    color:P,         Icon:IcMail},
  {value:'delay',         label:'Delay / Wait',    color:'#64748b', Icon:IcClock},
];

const TEMPLATES = [
  { name:'Free Guide (Follow Gate)',
    steps:[
      {id:'s1',type:'text',       text:'Hey! Thanks for stopping by',delay_ms:0},
      {id:'s2',type:'follow_gate',text:'Follow us to unlock your free guide!',next_step:'s3'},
      {id:'s3',type:'url_button', text:"You're verified! Here's your free guide",button_label:'Get Free Guide',url:'https://yourguide.com'},
    ]},
  { name:'Lead Capture Flow',
    steps:[
      {id:'s1',type:'text',        text:"Hey! I have something special for you",delay_ms:0},
      {id:'s2',type:'lead_capture',text:'Drop your email and I will send it over!',field:'email',next_step:'s3',skip_step:'s3'},
      {id:'s3',type:'url_button',  text:'Here you go!',button_label:'Access Now',url:'https://yourlink.com'},
    ]},
  { name:'Simple DM Reply',
    steps:[
      {id:'s1',type:'text',      text:'Thanks for commenting!',delay_ms:0},
      {id:'s2',type:'url_button',text:"Here's the link!",button_label:'Open Link',url:'https://yourlink.com'},
    ]},
];

const BLANK_FLOW = {name:'',account_id:'',description:'',steps:[],active:true};
const genId = () => 's'+Math.random().toString(36).slice(2,7);
const LEAD_FIELDS = [{value:'email',label:'Email'},{value:'phone',label:'Phone'},{value:'name',label:'Name'}];

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
    setFlow({...BLANK_FLOW, account_id:accounts[0]?._id?.$oid||'', ...(tpl?{name:tpl.name,steps:tpl.steps}:{})});
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
  const moveStep = (idx, dir) => {
    const steps = [...flow.steps];
    const t = idx+dir;
    if(t<0||t>=steps.length) return;
    [steps[idx],steps[t]]=[steps[t],steps[idx]];
    setFlow(f=>({...f,steps})); setSelStep(t);
  };

  const save = async () => {
    if(!flow.name)         return setErr('Flow name required');
    if(!flow.account_id)   return setErr('Select an account');
    if(!flow.steps.length) return setErr('Add at least one step');
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
  const stepIds = flow.steps.map(s=>({value:s.id,label:`${s.type} — ${s.text?.slice(0,20)||'(no text)'}`}));
  const typeInfo = t => STEP_TYPES.find(x=>x.value===t)||{color:'#64748b',Icon:IcTrigger};
  const cur = selStep!==null ? flow.steps[selStep] : null;

  return (
    <div className="fade-up">
      <PageTitle
        title="Flows"
        subtitle="Flow Builder"
        right={<Btn small onClick={()=>setModal('templates')} icon={<IcPlus size={13} color="#000"/>}>New</Btn>}
      />
      <div style={{padding:'0 16px'}}>
        {flows.length===0
          ? <EmptyState Icon={IcFlow} text="No flows yet — create one to define your DM conversations"/>
          : flows.map((f,i)=>(
            <Card key={f._id?.$oid||i} style={{marginBottom:10, padding:'15px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:7}}>
                <div style={{fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#fff', flex:1, paddingRight:8}}>
                  {f.name}
                </div>
                <Badge label={f.active?'Active':'Paused'} color={f.active?G:P}/>
              </div>
              <div style={{fontSize:12, color:'rgba(255,255,255,0.38)', marginBottom:11}}>
                {Array.isArray(f.steps)?f.steps.length:0} steps
                {f.description ? ' · '+f.description : ''}
              </div>
              <div style={{display:'flex', gap:8}}>
                <Btn small variant={f.active?'ghost':'primary'}
                  icon={f.active?<IcPause size={12} color="rgba(255,255,255,0.6)"/>:<IcPlay size={12} color="#000"/>}
                  onClick={()=>toggle(f)}>{f.active?'Pause':'Resume'}</Btn>
                <Btn small variant="danger" icon={<IcTrash size={12} color={P}/>} onClick={()=>remove(f)}>Delete</Btn>
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
              background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)',
              borderRadius:15, padding:'14px 15px', marginBottom:8, cursor:'pointer',
            }}>
              <div style={{fontWeight:700, fontSize:14, color:'#fff', marginBottom:3}}>{t.name}</div>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.38)'}}>{t.steps.length} steps</div>
            </button>
          ))}
          <button onClick={()=>openNew()} style={{
            display:'block', width:'100%', textAlign:'left',
            background:'transparent', border:'1px dashed rgba(255,255,255,0.14)',
            borderRadius:15, padding:'14px 15px', cursor:'pointer',
            color:'rgba(255,255,255,0.38)', fontSize:14,
          }}>Start from scratch</button>
        </Modal>
      )}

      {/* Full-screen flow builder */}
      {modal==='builder' && (
        <div style={{
          position:'fixed', inset:0, background:'#07070F',
          zIndex:150, display:'flex', flexDirection:'column', overflow:'hidden',
        }}>
          {/* Builder header */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'0 16px', height:52,
            background:'rgba(255,255,255,0.04)',
            borderBottom:'1px solid rgba(255,255,255,0.07)',
            flexShrink:0,
          }}>
            <button onClick={()=>setModal(null)} style={{
              background:'none', border:'none', color:'rgba(255,255,255,0.45)',
              fontSize:20, cursor:'pointer', lineHeight:1, padding:'0 4px',
            }}>←</button>
            <div style={{fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:16, color:'#fff'}}>
              Flow Builder
            </div>
            <Btn small onClick={save} disabled={saving}>{saving?'...':'Save'}</Btn>
          </div>

          {/* Scrollable content */}
          <div style={{flex:1, overflowY:'auto', padding:'16px', WebkitOverflowScrolling:'touch'}}>
            <Input label="FLOW NAME" value={flow.name} onChange={v=>setFlow(f=>({...f,name:v}))} placeholder="My Awesome Flow"/>
            <RSelect label="ACCOUNT" value={flow.account_id} onChange={v=>setFlow(f=>({...f,account_id:v}))} options={accountOpts}/>

            {err && <div style={{color:P, fontSize:12, marginBottom:12, padding:'9px 12px', background:`${P}10`, borderRadius:10}}>{err}</div>}

            {/* Steps */}
            <div style={{color:'rgba(255,255,255,0.38)', fontSize:10, fontWeight:600, letterSpacing:2, marginBottom:10}}>
              STEPS ({flow.steps.length})
            </div>

            {flow.steps.map((s,i)=>{
              const info = typeInfo(s.type);
              const isSelected = selStep===i;
              return (
                <div key={s.id}>
                  <button onClick={()=>setSelStep(isSelected?null:i)} style={{
                    width:'100%', textAlign:'left',
                    background: isSelected ? `${info.color}12` : 'rgba(255,255,255,0.04)',
                    border:`1px solid ${isSelected?info.color+'40':'rgba(255,255,255,0.08)'}`,
                    borderRadius:14, padding:'11px 13px', marginBottom:6, cursor:'pointer',
                  }}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <info.Icon size={16} color={info.color}/>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:11, color:info.color, fontWeight:700, marginBottom:2, letterSpacing:0.5}}>
                          {s.type.replace(/_/g,' ').toUpperCase()}
                        </div>
                        <div style={{fontSize:12, color:'rgba(255,255,255,0.45)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {s.text||'(no text yet)'}
                        </div>
                      </div>
                      <span style={{color:'rgba(255,255,255,0.25)', fontSize:12}}>
                        {isSelected?'▲':'▼'}
                      </span>
                    </div>
                  </button>

                  {isSelected && (
                    <div style={{
                      background:`${info.color}08`,
                      border:`1px solid ${info.color}2a`,
                      borderRadius:14, padding:'14px', marginBottom:10, marginTop:-2,
                    }}>
                      {/* Move up/down/delete */}
                      <div style={{display:'flex', gap:6, marginBottom:12}}>
                        <Btn small variant="ghost" onClick={()=>moveStep(i,-1)} icon={<IcArrowUp size={12} color="rgba(255,255,255,0.5)"/>}/>
                        <Btn small variant="ghost" onClick={()=>moveStep(i,1)} icon={<IcArrowDown size={12} color="rgba(255,255,255,0.5)"/>}/>
                        <Btn small variant="danger" onClick={()=>delStep(i)} icon={<IcTrash size={12} color={P}/>}>Remove</Btn>
                      </div>

                      {s.type!=='delay' && (
                        <Textarea
                          label="MESSAGE TEXT"
                          value={s.text}
                          onChange={v=>updStep(i,{text:v})}
                          placeholder="Use {{username}}, {{comment}}, {{keyword}}"
                          rows={3}
                        />
                      )}
                      {s.type==='url_button' && (<>
                        <Input label="BUTTON LABEL" value={s.button_label} onChange={v=>updStep(i,{button_label:v})} placeholder="Get Your Guide"/>
                        <Input label="DESTINATION URL" value={s.url} onChange={v=>updStep(i,{url:v})} placeholder="https://" mono/>
                      </>)}
                      {s.type==='follow_gate' && (
                        <RSelect label="NEXT STEP (after follow verified)"
                          value={s.next_step||''}
                          onChange={v=>updStep(i,{next_step:v})}
                          options={[{value:'',label:'End flow'},...stepIds.filter(x=>x.value!==s.id)]}
                        />
                      )}
                      {s.type==='lead_capture' && (<>
                        <RSelect label="CAPTURE FIELD" value={s.field||'email'} onChange={v=>updStep(i,{field:v})} options={LEAD_FIELDS}/>
                        <RSelect label="NEXT STEP" value={s.next_step||''} onChange={v=>updStep(i,{next_step:v})} options={[{value:'',label:'End flow'},...stepIds.filter(x=>x.value!==s.id)]}/>
                      </>)}
                      {s.type==='delay' && (
                        <Input label="WAIT DURATION (ms)" value={s.ms||2000} onChange={v=>updStep(i,{ms:parseInt(v)||2000})} placeholder="2000" mono/>
                      )}
                      <Input label="DELAY BEFORE THIS STEP (ms)" value={s.delay_ms||0} onChange={v=>updStep(i,{delay_ms:parseInt(v)||0})} placeholder="0" mono/>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add step */}
            <div style={{color:'rgba(255,255,255,0.38)', fontSize:10, fontWeight:600, letterSpacing:2, marginBottom:10, marginTop:8}}>
              ADD STEP
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, paddingBottom:24}}>
              {STEP_TYPES.map(t=>(
                <button key={t.value} onClick={()=>addStep(t.value)} style={{
                  background:`${t.color}10`, border:`1px solid ${t.color}28`,
                  borderRadius:13, padding:'12px 8px', cursor:'pointer',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                }}>
                  <t.Icon size={18} color={t.color}/>
                  <span style={{color:t.color, fontSize:11, fontWeight:700, fontFamily:'DM Sans,sans-serif', textAlign:'center'}}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
