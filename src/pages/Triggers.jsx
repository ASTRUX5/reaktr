import { useState, useEffect } from 'react';
import { Card, Btn, PageTitle, Badge, EmptyState, Modal, Input, RSelect, colors } from '../components/Layout.jsx';
import { IcTrigger, IcPlus, IcTrash, IcPause, IcPlay, IcRefresh, IcReel, IcImage, IcCheck } from '../components/Icons.jsx';
import { api } from '../lib/api.js';
const {G,P,V} = colors;

const MATCH_OPTS = [
  {value:'contains',    label:'Contains keyword (recommended)'},
  {value:'exact',       label:'Exact match only'},
  {value:'starts_with', label:'Starts with keyword'},
  {value:'fuzzy',       label:'Fuzzy — typos allowed'},
];

const BLANK = { name:'', account_id:'', flow_id:'', keywords:'', match_type:'contains', media_id:'any', comment_reply:'', active:true };

export default function Triggers() {
  const [triggers,  setTriggers]  = useState([]);
  const [accounts,  setAccounts]  = useState([]);
  const [flows,     setFlows]     = useState([]);
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState(BLANK);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');
  const [reels,     setReels]     = useState([]);
  const [reelsLoading, setReelsLoading] = useState(false);
  const [step,      setStep]      = useState(1); // 1=pick reel, 2=configure

  const load = async () => {
    const [t,a,f] = await Promise.all([api.getTriggers(), api.getAccounts(), api.getFlows()]);
    setTriggers(t); setAccounts(a); setFlows(f);
  };
  useEffect(()=>{ load(); },[]);

  const fetchReels = async (accountId) => {
    if (!accountId) return;
    setReelsLoading(true);
    setReels([]);
    try {
      const res = await fetch(`/api/reels?account_id=${accountId}`, {
        headers:{ Authorization:`Bearer ${localStorage.getItem('reaktr_secret')||''}` }
      });
      const data = await res.json();
      setReels(data.reels || []);
    } catch(e) {
      console.error(e);
    } finally {
      setReelsLoading(false);
    }
  };

  const openNew = () => {
    const firstAccountId = accounts[0]?._id?.$oid || '';
    setForm({...BLANK, account_id: firstAccountId});
    setStep(1); setErr(''); setReels([]); setModal(true);
    if (firstAccountId) fetchReels(firstAccountId);
  };

  const set = k => v => setForm(f=>({...f,[k]:v}));

  const onAccountChange = (id) => {
    setForm(f=>({...f, account_id:id, media_id:'any'}));
    setReels([]);
    if (id) fetchReels(id);
  };

  const selectReel = (reel) => {
    setForm(f=>({...f, media_id: reel.id}));
    setStep(2);
  };

  const selectAnyReel = () => {
    setForm(f=>({...f, media_id:'any'}));
    setStep(2);
  };

  const save = async () => {
    if (!form.name)       return setErr('Give this trigger a name');
    if (!form.account_id) return setErr('Select an account');
    if (!form.flow_id)    return setErr('Select which flow to fire');
    if (!form.keywords)   return setErr('Enter at least one keyword');
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
    if (!confirm(`Delete trigger "${row.name}"?`)) return;
    await api.deleteTrigger(row._id?.$oid||row.id); load();
  };

  const toggle = async (row) => {
    await api.updateTrigger(row._id?.$oid||row.id, {active:!row.active}); load();
  };

  const accountOpts = [{value:'',label:'Select account'}, ...accounts.map(a=>({value:a._id?.$oid||'',label:`@${a.username}`}))];
  const flowOpts    = [{value:'',label:'Select flow to fire'}, ...flows.filter(f=>!form.account_id||f.account_id===form.account_id).map(f=>({value:f._id?.$oid||'',label:f.name}))];
  const selectedReel = reels.find(r=>r.id===form.media_id);

  return (
    <div className="fade-up">
      <PageTitle
        title="Triggers"
        subtitle="Comment Triggers"
        right={<Btn onClick={openNew} small icon={<IcPlus size={13} color="#000"/>}>New</Btn>}
      />
      <div style={{padding:'0 16px'}}>

        {/* How it works */}
        <Card style={{padding:'14px 16px', marginBottom:14, borderLeft:`3px solid ${V}`}}>
          <div style={{fontSize:12, color:'rgba(255,255,255,0.5)', lineHeight:1.65}}>
            When someone comments a keyword on your reel, REAKTR instantly fires a DM flow to them.
            Choose which reel, set your keyword, pick your flow.
          </div>
        </Card>

        {/* Triggers list */}
        {triggers.length === 0
          ? <EmptyState Icon={IcTrigger} text="No triggers yet — create one to start automating DMs"/>
          : triggers.map((t,i)=>(
            <Card key={t._id?.$oid||i} style={{marginBottom:10, padding:'15px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                <div style={{flex:1, minWidth:0, paddingRight:8}}>
                  <div style={{fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#fff', marginBottom:6}}>
                    {t.name}
                  </div>
                  <div style={{display:'flex', flexWrap:'wrap', gap:4, marginBottom:6}}>
                    {(Array.isArray(t.keywords)?t.keywords:[t.keywords]).map(k=>(
                      <span key={k} style={{
                        background:`${G}15`, color:G, border:`1px solid ${G}30`,
                        borderRadius:7, padding:'2px 10px', fontSize:11, fontWeight:600,
                      }}>{k}</span>
                    ))}
                  </div>
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.3)'}}>
                    {t.media_id==='any' ? 'All reels' : `Reel: ${t.media_id?.slice(0,14)}...`} · {t.match_type}
                  </div>
                </div>
                <Badge label={t.active?'Active':'Paused'} color={t.active?G:P}/>
              </div>
              <div style={{display:'flex', gap:8, marginTop:4}}>
                <Btn small variant={t.active?'ghost':'primary'}
                  icon={t.active ? <IcPause size={12} color="rgba(255,255,255,0.6)"/> : <IcPlay size={12} color="#000"/>}
                  onClick={()=>toggle(t)}>
                  {t.active?'Pause':'Resume'}
                </Btn>
                <Btn small variant="danger" icon={<IcTrash size={12} color={P}/>} onClick={()=>remove(t)}>
                  Delete
                </Btn>
              </div>
            </Card>
          ))
        }
      </div>

      {modal && (
        <Modal title={step===1 ? 'Choose a Reel' : 'Configure Trigger'} onClose={()=>setModal(false)}>

          {/* STEP 1 — Reel selector */}
          {step===1 && (
            <div>
              {/* Account picker */}
              <RSelect label="ACCOUNT" value={form.account_id} onChange={onAccountChange} options={accountOpts}/>

              {form.account_id && (
                <>
                  {/* Any reel option */}
                  <button onClick={selectAnyReel} style={{
                    width:'100%', textAlign:'left',
                    background: form.media_id==='any' ? `${G}15` : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${form.media_id==='any' ? G+'44' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius:14, padding:'13px 14px', marginBottom:10, cursor:'pointer',
                    display:'flex', alignItems:'center', gap:12,
                  }}>
                    <div style={{
                      width:42, height:42, borderRadius:10, flexShrink:0,
                      background:'rgba(255,255,255,0.08)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <IcReel size={20} color="rgba(255,255,255,0.5)"/>
                    </div>
                    <div>
                      <div style={{color:'#fff', fontWeight:700, fontSize:14}}>All Reels</div>
                      <div style={{color:'rgba(255,255,255,0.4)', fontSize:12, marginTop:2}}>Trigger fires on any reel</div>
                    </div>
                    {form.media_id==='any' && <IcCheck size={16} color={G} style={{marginLeft:'auto'}}/>}
                  </button>

                  <div style={{color:'rgba(255,255,255,0.3)', fontSize:10, fontWeight:600, letterSpacing:1.5, marginBottom:8}}>
                    OR CHOOSE A SPECIFIC REEL
                  </div>

                  {/* Refresh button */}
                  <button onClick={()=>fetchReels(form.account_id)} style={{
                    background:'none', border:'none', color:'rgba(255,255,255,0.35)',
                    cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:5,
                    marginBottom:10, padding:0, fontFamily:'DM Sans,sans-serif',
                  }}>
                    <IcRefresh size={13} color="rgba(255,255,255,0.35)"/>
                    {reelsLoading ? 'Loading reels...' : 'Refresh reels'}
                  </button>

                  {/* Reels grid */}
                  {reelsLoading && (
                    <div style={{textAlign:'center', padding:'20px 0', color:'rgba(255,255,255,0.3)', fontSize:13}}>
                      Fetching your latest reels...
                    </div>
                  )}

                  {!reelsLoading && reels.length === 0 && (
                    <div style={{
                      background:'rgba(255,255,255,0.04)', borderRadius:14,
                      padding:'16px', textAlign:'center',
                      color:'rgba(255,255,255,0.3)', fontSize:13,
                    }}>
                      No reels found. Make sure your account is connected and has reels.
                    </div>
                  )}

                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16}}>
                    {reels.map(r=>{
                      const selected = form.media_id === r.id;
                      const thumb = r.thumbnail_url || r.media_url;
                      return (
                        <button key={r.id} onClick={()=>selectReel(r)} style={{
                          background: selected ? `${G}15` : 'rgba(255,255,255,0.05)',
                          border:`1px solid ${selected ? G+'55' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius:12, padding:6, cursor:'pointer', position:'relative',
                          overflow:'hidden',
                        }}>
                          <div style={{
                            width:'100%', paddingTop:'133%', position:'relative',
                            background:'rgba(255,255,255,0.08)', borderRadius:8, overflow:'hidden',
                          }}>
                            {thumb
                              ? <img src={thumb} alt="" style={{
                                  position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover',
                                }}/>
                              : <div style={{
                                  position:'absolute', inset:0, display:'flex',
                                  alignItems:'center', justifyContent:'center',
                                }}>
                                  <IcImage size={20} color="rgba(255,255,255,0.2)"/>
                                </div>
                            }
                            {selected && (
                              <div style={{
                                position:'absolute', inset:0,
                                background:'rgba(49,236,86,0.25)',
                                display:'flex', alignItems:'center', justifyContent:'center',
                              }}>
                                <IcCheck size={22} color={G}/>
                              </div>
                            )}
                          </div>
                          <div style={{
                            fontSize:9, color:'rgba(255,255,255,0.4)',
                            marginTop:5, textAlign:'left', overflow:'hidden',
                            textOverflow:'ellipsis', whiteSpace:'nowrap',
                          }}>
                            {r.timestamp ? new Date(r.timestamp).toLocaleDateString() : r.id?.slice(0,10)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <Btn full onClick={()=>setStep(2)} disabled={!form.media_id}>
                    Continue →
                  </Btn>
                </>
              )}
            </div>
          )}

          {/* STEP 2 — Configure */}
          {step===2 && (
            <div>
              {/* Back + selected reel info */}
              <div style={{
                display:'flex', alignItems:'center', gap:10, marginBottom:16,
                background:'rgba(255,255,255,0.05)', borderRadius:12, padding:'10px 12px',
              }}>
                <button onClick={()=>setStep(1)} style={{
                  background:'none', border:'none', color:'rgba(255,255,255,0.4)',
                  cursor:'pointer', fontSize:12, fontFamily:'DM Sans,sans-serif',
                  display:'flex', alignItems:'center', gap:4,
                }}>← Back</button>
                <div style={{width:1, height:16, background:'rgba(255,255,255,0.1)'}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.4)'}}>Selected reel</div>
                  <div style={{fontSize:12, color:G, fontWeight:600}}>
                    {form.media_id==='any' ? 'All Reels' : (selectedReel?.timestamp ? new Date(selectedReel.timestamp).toLocaleDateString() : form.media_id?.slice(0,16)+'...')}
                  </div>
                </div>
              </div>

              <Input label="TRIGGER NAME" value={form.name} onChange={set('name')} placeholder="e.g. Guide Reel Trigger"/>
              <RSelect label="FIRE THIS FLOW" value={form.flow_id} onChange={set('flow_id')} options={flowOpts}/>
              <Input label="KEYWORDS (comma-separated)" value={form.keywords} onChange={set('keywords')} placeholder="GUIDE, guide, send it, link"/>
              <RSelect label="MATCH TYPE" value={form.match_type} onChange={set('match_type')} options={MATCH_OPTS}/>
              <Input label="PUBLIC COMMENT REPLY (optional)" value={form.comment_reply} onChange={set('comment_reply')} placeholder="Check your DMs!"/>

              {err && <div style={{color:P, fontSize:12, marginBottom:12, padding:'8px 12px', background:`${P}10`, borderRadius:10}}>{err}</div>}

              <div style={{display:'flex', gap:10}}>
                <Btn variant="ghost" onClick={()=>setModal(false)}>Cancel</Btn>
                <Btn onClick={save} disabled={saving} full>{saving?'Saving...':'Create Trigger'}</Btn>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
