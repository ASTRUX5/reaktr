import { useState, useEffect } from 'react';
import { Card, Btn, PageTitle, Badge, EmptyState, Modal, Input, RSelect, colors } from '../components/Layout.jsx';
import { api } from '../lib/api.js';
const {G,P,V} = colors;

const MATCH_OPTS = [
  {value:'contains',    label:'Contains keyword'},
  {value:'exact',       label:'Exact match'},
  {value:'starts_with', label:'Starts with'},
  {value:'fuzzy',       label:'Fuzzy (typos ok)'},
];

const BLANK = { name:'', account_id:'', flow_id:'', keywords:'', match_type:'contains', media_id:'any', comment_reply:'', active:true };

export default function Triggers() {
  const [triggers, setTriggers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [flows,    setFlows]    = useState([]);
  const [modal,    setModal]    = useState(false);
  const [form,     setForm]     = useState(BLANK);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');

  const load = async () => {
    const [t,a,f] = await Promise.all([api.getTriggers(), api.getAccounts(), api.getFlows()]);
    setTriggers(t); setAccounts(a); setFlows(f);
  };
  useEffect(()=>{ load(); },[]);

  const openNew = () => {
    setForm({...BLANK, account_id: accounts[0]?._id?.$oid||''});
    setErr(''); setModal(true);
  };

  const set = k => v => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    if(!form.name)       return setErr('Name required');
    if(!form.account_id) return setErr('Select an account');
    if(!form.flow_id)    return setErr('Select a flow');
    if(!form.keywords)   return setErr('Enter keywords');
    setSaving(true);
    try {
      await api.createTrigger({
        ...form,
        keywords: form.keywords.split(',').map(k=>k.trim()).filter(Boolean),
      });
      setModal(false); load();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (row) => {
    if(!confirm(`Delete "${row.name}"?`)) return;
    await api.deleteTrigger(row._id?.$oid||row.id); load();
  };

  const toggle = async (row) => {
    await api.updateTrigger(row._id?.$oid||row.id, {active:!row.active}); load();
  };

  const accountOpts = [{value:'',label:'Select account'}, ...accounts.map(a=>({value:a._id?.$oid||'',label:`@${a.username}`}))];
  const flowOpts    = [{value:'',label:'Select flow'}, ...flows.filter(f=>!form.account_id||f.account_id===form.account_id).map(f=>({value:f._id?.$oid||'',label:f.name}))];

  return (
    <div className="fade-up">
      <PageTitle
        title="Triggers"
        subtitle="COMMENT TRIGGERS"
        right={<Btn onClick={openNew} small>+ New</Btn>}
      />
      <div style={{padding:'0 16px'}}>

        {/* Info card */}
        <Card style={{padding:'14px 16px', marginBottom:16, borderLeft:`3px solid ${V}`}}>
          <div style={{fontSize:12, color:'rgba(255,255,255,0.55)', lineHeight:1.6}}>
            When someone comments a keyword on your reel, REAKTR fires a DM flow to them instantly.
          </div>
        </Card>

        {/* Triggers list */}
        {triggers.length === 0
          ? <EmptyState icon="◎" text="No triggers yet. Create one to start automating." />
          : triggers.map((t,i)=>(
            <Card key={t._id?.$oid||i} style={{marginBottom:10, padding:'16px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#fff', marginBottom:4}}>
                    {t.name}
                  </div>
                  <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                    {(Array.isArray(t.keywords)?t.keywords:[t.keywords]).map(k=>(
                      <span key={k} style={{
                        background:`${G}18`, color:G, border:`1px solid ${G}33`,
                        borderRadius:8, padding:'2px 10px', fontSize:11, fontWeight:600,
                      }}>{k}</span>
                    ))}
                  </div>
                </div>
                <Badge label={t.active?'ACTIVE':'PAUSED'} color={t.active?G:P}/>
              </div>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.35)', marginBottom:12}}>
                Match: {t.match_type} · Reel: {t.media_id==='any'?'Any reel':t.media_id?.slice(0,12)+'...'}
              </div>
              <div style={{display:'flex', gap:8}}>
                <Btn small variant={t.active?'ghost':'primary'} onClick={()=>toggle(t)}>
                  {t.active?'Pause':'Resume'}
                </Btn>
                <Btn small variant="danger" onClick={()=>remove(t)}>Delete</Btn>
              </div>
            </Card>
          ))
        }
      </div>

      {modal && (
        <Modal title="New Trigger" onClose={()=>setModal(false)}>
          <Input label="TRIGGER NAME" value={form.name} onChange={set('name')} placeholder="e.g. Guide Reel Trigger"/>
          <RSelect label="ACCOUNT" value={form.account_id} onChange={set('account_id')} options={accountOpts}/>
          <RSelect label="FIRE THIS FLOW" value={form.flow_id} onChange={set('flow_id')} options={flowOpts}/>
          <Input label="KEYWORDS (comma-separated)" value={form.keywords} onChange={set('keywords')} placeholder="GUIDE, guide, freebie"/>
          <RSelect label="MATCH TYPE" value={form.match_type} onChange={set('match_type')} options={MATCH_OPTS}/>
          <Input label="REEL MEDIA ID (or 'any')" value={form.media_id} onChange={set('media_id')} placeholder="any" mono/>
          <Input label="PUBLIC COMMENT REPLY (optional)" value={form.comment_reply} onChange={set('comment_reply')} placeholder="Check your DMs! 📩"/>
          {err && <div style={{color:P, fontSize:12, marginBottom:12}}>{err}</div>}
          <div style={{display:'flex', gap:10}}>
            <Btn variant="ghost" onClick={()=>setModal(false)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving} full>{saving?'Saving...':'Create Trigger'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
