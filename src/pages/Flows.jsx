import { useState, useEffect } from 'react';
import { Card, Btn, PageTitle, Badge, EmptyState, Modal, FullScreen, Input, RSelect, Textarea, SectionLabel, colors } from '../components/Layout.jsx';
import { IcFlow, IcPlus, IcTrash, IcPause, IcPlay, IcArrowUp, IcArrowDown, IcLink, IcMail, IcTrigger, IcClock, IcCheck, IcKey } from '../components/Icons.jsx';
import { api } from '../lib/api.js';
const {G,P,V} = colors;

const STEP_TYPES = [
  {value:'text',          label:'Text Message',  color:'#60A5FA', Icon:IcTrigger},
  {value:'buttons',       label:'Buttons',        color:V,         Icon:IcKey},
  {value:'quick_replies', label:'Quick Replies',  color:G,         Icon:IcCheck},
  {value:'follow_gate',   label:'Follow Gate',    color:G,         Icon:IcCheck},
  {value:'url_button',    label:'URL Button',     color:'#FBBF24', Icon:IcLink},
  {value:'lead_capture',  label:'Lead Capture',   color:P,         Icon:IcMail},
  {value:'delay',         label:'Delay / Wait',   color:'#64748b', Icon:IcClock},
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
      {id:'s2',type:'lead_capture',text:"Drop your email and I'll send it over!",field:'email',next_step:'s3',skip_step:'s3'},
      {id:'s3',type:'url_button',  text:"Here you go!",button_label:'Access Now',url:'https://yourlink.com'},
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
  const [modal,    setModal]    = useState(null); // null | 'templates' | 'builder'
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
    setFlow({...BLANK_FLOW, account_id:accounts[0]?._id?.$oid||'', ...(tpl?{name:tpl.name,steps:JSON.parse(JSON.stringify(tpl.steps))}:{})});
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
    const steps=[...flow.steps]; const t=idx+dir;
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
  const stepIds = flow.steps.map(s=>({value:s.id,label:`${s.type} — ${s.text?.slice(0,18)||'(empty)'}`}));
  const typeInfo = t => STEP_TYPES.find(x=>x.value===t)||{color:'#64748b',Icon:IcTrigger};
  const cur = selStep!==null ? flow.steps[selStep] : null;

  return (
    <div className="fade-up">
      <PageTitle
        title="Flows"
        subtitle="Flow Builder"
        right={<Btn small onClick={()=>setModal('templates')} icon={<IcPlus size={13} color="#000"/>}>New</Btn>}
      />
      <div style={{padding:'0 14px'}}>
        {flows.length===0
          ? <EmptyState Icon={IcFlow} text="No flows yet — create one to define your DM conversations"/>
          : flows.map((f,i)=>(
            <Card key={f._id?.$oid||i} style={{marginBottom:10, padding:'14px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6}}>
                <div style={{fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#fff', flex:1, paddingRight:8}}>
                  {f.name}
                </div>
                <Badge label={f.active?'Active':'Paused'} color={f.active?G:P}/>
              </div>
              <div style={{fontSize:12, color:'rgba(255,255,255,0.35)', marginBottom:10}}>
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

      {/* Templates — full screen modal */}
      {modal==='templates' && (
        <Modal title="New Flow" onClose={()=>setModal(null)}>
          <div style={{fontSize:13, color:'rgba(255,255,255,0.4)', marginBottom:16}}>
            Start with a template or build from scratch
          </div>
          {TEMPLATES.map((t,i)=>(
            <button key={i} onClick={()=>openNew(t)} style={{
              display:'block', width:'100%', textAlign:'left',
              background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)',
              borderRadius:15, padding:'15px', marginBottom:10, cursor:'pointer',
            }}>
              <div style={{fontWeight:700, fontSize:15, color:'#fff', marginBottom:4}}>{t.name}</div>
              <div style={{fontSize:12, color:'rgba(255,255,255,0.38)'}}>{t.steps.length} steps pre-configured</div>
            </button>
          ))}
          <button onClick={()=>openNew()} style={{
            display:'block', width:'100%', textAlign:'left',
            background:'transparent', border:'1px dashed rgba(255,255,255,0.14)',
            borderRadius:15, padding:'15px', cursor:'pointer',
            color:'rgba(255,255,255,0.4)', fontSize:14,
          }}>Start from scratch →</button>
        </Modal>
      )}

      {/* Flow Builder — full screen via FullScreen component */}
      {modal==='builder' && (
        <FullScreen
          title="Flow Builder"
          onBack={()=>setModal(null)}
          topRight={<Btn small onClick={save} disabled={saving}>{saving?'Saving...':'Save'}</Btn>}
        >
          <div style={{padding:'16px 16px 48px'}}>
            <Input label="FLOW NAME" value={flow.name} onChange={v=>setFlow(f=>({...f,name:v}))} placeholder="e.g. Free Guide Flow"/>
            <RSelect label="ACCOUNT" value={flow.account_id} onChange={v=>setFlow(f=>({...f,account_id:v}))} options={accountOpts}/>

            {err && (
              <div style={{color:P, fontSize:12, marginBottom:12, padding:'9px 12px', background:`${P}10`, borderRadius:10}}>{err}</div>
            )}

            <SectionLabel>STEPS ({flow.steps.length})</SectionLabel>

            {flow.steps.length===0 && (
              <div style={{textAlign:'center', padding:'20px', color:'rgba(255,255,255,0.2)', fontSize:13, marginBottom:12}}>
                Add steps below to build your flow
              </div>
            )}

            {flow.steps.map((s,i)=>{
              const info = typeInfo(s.type);
              const isSel = selStep===i;
              return (
                <div key={s.id}>
                  <button onClick={()=>setSelStep(isSel?null:i)} style={{
                    width:'100%', textAlign:'left',
                    background: isSel ? `${info.color}10` : 'rgba(255,255,255,0.04)',
                    border:`1px solid ${isSel?info.color+'38':'rgba(255,255,255,0.08)'}`,
                    borderRadius:13, padding:'11px 13px', marginBottom:6, cursor:'pointer',
                  }}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <info.Icon size={15} color={info.color}/>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:11, color:info.color, fontWeight:700, marginBottom:1, letterSpacing:0.4}}>
                          {s.type.replace(/_/g,' ').toUpperCase()}
                        </div>
                        <div style={{fontSize:12, color:'rgba(255,255,255,0.42)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {s.text||'(no text yet)'}
                        </div>
                      </div>
                      <span style={{color:'rgba(255,255,255,0.22)', fontSize:11}}>{isSel?'▲':'▼'}</span>
                    </div>
                  </button>

                  {isSel && (
                    <div style={{
                      background:`${info.color}07`, border:`1px solid ${info.color}28`,
                      borderRadius:13, padding:'13px', marginBottom:10, marginTop:-2,
                    }}>
                      <div style={{display:'flex', gap:6, marginBottom:11}}>
                        <Btn small variant="ghost" onClick={()=>moveStep(i,-1)} icon={<IcArrowUp size={12} color="rgba(255,255,255,0.5)"/>}/>
                        <Btn small variant="ghost" onClick={()=>moveStep(i,1)} icon={<IcArrowDown size={12} color="rgba(255,255,255,0.5)"/>}/>
                        <Btn small variant="danger" onClick={()=>delStep(i)} icon={<IcTrash size={12} color={P}/>}>Remove</Btn>
                      </div>
                      {s.type!=='delay' && (
                        <Textarea label="MESSAGE TEXT" value={s.text} onChange={v=>updStep(i,{text:v})}
                          placeholder="Use {{username}}, {{comment}}, {{keyword}}" rows={3}/>
                      )}
                      {s.type==='url_button' && (<>
                        <Input label="BUTTON LABEL" value={s.button_label} onChange={v=>updStep(i,{button_label:v})} placeholder="Get Your Guide"/>
                        <Input label="DESTINATION URL" value={s.url} onChange={v=>updStep(i,{url:v})} placeholder="https://yourguide.com" mono/>
                      </>)}
                      {s.type==='follow_gate' && (
                        <RSelect label="NEXT STEP (after follow verified)" value={s.next_step||''}
                          onChange={v=>updStep(i,{next_step:v})}
                          options={[{value:'',label:'End flow'},...stepIds.filter(x=>x.value!==s.id)]}/>
                      )}
                      {s.type==='lead_capture' && (<>
                        <RSelect label="CAPTURE FIELD" value={s.field||'email'} onChange={v=>updStep(i,{field:v})} options={LEAD_FIELDS}/>
                        <RSelect label="NEXT STEP" value={s.next_step||''} onChange={v=>updStep(i,{next_step:v})}
                          options={[{value:'',label:'End flow'},...stepIds.filter(x=>x.value!==s.id)]}/>
                      </>)}
                      {s.type==='delay' && (
                        <Input label="WAIT (milliseconds)" value={s.ms||2000} onChange={v=>updStep(i,{ms:parseInt(v)||2000})} placeholder="2000" mono/>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <SectionLabel>ADD STEP</SectionLabel>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, paddingBottom:16}}>
              {STEP_TYPES.map(t=>(
                <button key={t.value} onClick={()=>addStep(t.value)} style={{
                  background:`${t.color}0e`, border:`1px solid ${t.color}25`,
                  borderRadius:13, padding:'12px 8px', cursor:'pointer',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                }}>
                  <t.Icon size={18} color={t.color}/>
                  <span style={{color:t.color, fontSize:11, fontWeight:700, fontFamily:'DM Sans,sans-serif', textAlign:'center'}}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </FullScreen>
      )}
    </div>
  );
}
