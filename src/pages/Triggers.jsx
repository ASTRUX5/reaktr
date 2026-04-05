import { useState, useEffect } from 'react';
import { Card, Btn, PageTitle, Badge, EmptyState, Modal, Input, RSelect, SectionLabel, colors } from '../components/Layout.jsx';
import { IcTrigger, IcPlus, IcTrash, IcPause, IcPlay, IcRefresh, IcReel, IcImage, IcCheck, IcLink } from '../components/Icons.jsx';
import { api } from '../lib/api.js';
const {G,P,V} = colors;

const MATCH_OPTS = [
  {value:'contains',    label:'Contains keyword (recommended)'},
  {value:'exact',       label:'Exact match only'},
  {value:'starts_with', label:'Starts with keyword'},
  {value:'fuzzy',       label:'Fuzzy — typos allowed'},
];

const BLANK = {
  name:'', account_id:'', flow_id:'', keywords:'',
  match_type:'contains', media_id:'any', comment_reply:'',
  dm_url:'', dm_button_label:'Get Your Free Guide', active:true,
};

export default function Triggers() {
  const [triggers,      setTriggers]      = useState([]);
  const [accounts,      setAccounts]      = useState([]);
  const [flows,         setFlows]         = useState([]);
  const [modal,         setModal]         = useState(false);
  const [form,          setForm]          = useState(BLANK);
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState('');
  const [reels,         setReels]         = useState([]);
  const [reelsLoading,  setReelsLoading]  = useState(false);
  const [step,          setStep]          = useState(1);

  const load = async () => {
    const [t,a,f] = await Promise.all([api.getTriggers(), api.getAccounts(), api.getFlows()]);
    setTriggers(t); setAccounts(a); setFlows(f);
  };
  useEffect(()=>{ load(); },[]);

  const fetchReels = async (accountId) => {
    if (!accountId) return;
    setReelsLoading(true); setReels([]);
    try {
      const res  = await fetch(`/api/reels?account_id=${accountId}`, {
        headers:{ Authorization:`Bearer ${localStorage.getItem('reaktr_secret')||''}` }
      });
      const data = await res.json();
      setReels(data.reels || []);
    } catch(e) { console.error(e); }
    finally { setReelsLoading(false); }
  };

  const openNew = () => {
    const firstId = accounts[0]?._id?.$oid || '';
    setForm({...BLANK, account_id:firstId});
    setStep(1); setErr(''); setReels([]); setModal(true);
    if (firstId) fetchReels(firstId);
  };

  const set = k => v => setForm(f=>({...f,[k]:v}));

  const onAccountChange = id => {
    setForm(f=>({...f, account_id:id, media_id:'any'}));
    setReels([]);
    if (id) fetchReels(id);
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

  const remove = async row => {
    if (!confirm(`Delete trigger "${row.name}"?`)) return;
    await api.deleteTrigger(row._id?.$oid||row.id); load();
  };

  const toggle = async row => {
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
      <div style={{padding:'0 14px'}}>
        <Card style={{padding:'12px 14px', marginBottom:12, borderLeft:`3px solid ${V}`}}>
          <div style={{fontSize:12, color:'rgba(255,255,255,0.5)', lineHeight:1.65}}>
            When someone comments a keyword on your reel, REAKTR instantly fires a DM flow to them.
          </div>
        </Card>

        {triggers.length === 0
          ? <EmptyState Icon={IcTrigger} text="No triggers yet — tap New to create one"/>
          : triggers.map((t,i)=>(
            <Card key={t._id?.$oid||i} style={{marginBottom:10, padding:'14px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:7}}>
                <div style={{flex:1, minWidth:0, paddingRight:8}}>
                  <div style={{fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, color:'#fff', marginBottom:5}}>
                    {t.name}
                  </div>
                  <div style={{display:'flex', flexWrap:'wrap', gap:4, marginBottom:5}}>
                    {(Array.isArray(t.keywords)?t.keywords:[t.keywords]).map(k=>(
                      <span key={k} style={{
                        background:`${G}14`, color:G, border:`1px solid ${G}28`,
                        borderRadius:7, padding:'2px 10px', fontSize:11, fontWeight:600,
                      }}>{k}</span>
                    ))}
                  </div>
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.3)'}}>
                    {t.media_id==='any' ? 'All reels' : `Specific reel`} · {t.match_type}
                    {t.dm_url && ` · Link attached`}
                  </div>
                </div>
                <Badge label={t.active?'Active':'Paused'} color={t.active?G:P}/>
              </div>
              <div style={{display:'flex', gap:8}}>
                <Btn small variant={t.active?'ghost':'primary'}
                  icon={t.active?<IcPause size={12} color="rgba(255,255,255,0.6)"/>:<IcPlay size={12} color="#000"/>}
                  onClick={()=>toggle(t)}>{t.active?'Pause':'Resume'}</Btn>
                <Btn small variant="danger" icon={<IcTrash size={12} color={P}/>} onClick={()=>remove(t)}>Delete</Btn>
              </div>
            </Card>
          ))
        }
      </div>

      {modal && (
        <Modal title={step===1?'Choose a Reel':'Configure Trigger'} onClose={()=>setModal(false)}>

          {/* ── STEP 1: Reel picker ── */}
          {step===1 && (
            <div>
              <RSelect label="ACCOUNT" value={form.account_id} onChange={onAccountChange} options={accountOpts}/>

              {form.account_id && (<>
                {/* Any reel option */}
                <button onClick={()=>{ setForm(f=>({...f,media_id:'any'})); setStep(2); }} style={{
                  width:'100%', textAlign:'left',
                  background: 'rgba(255,255,255,0.05)',
                  border:`1px solid rgba(255,255,255,0.1)`,
                  borderRadius:14, padding:'13px 14px', marginBottom:12, cursor:'pointer',
                  display:'flex', alignItems:'center', gap:12,
                }}>
                  <div style={{
                    width:44, height:44, borderRadius:11, flexShrink:0,
                    background:'rgba(255,255,255,0.07)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <IcReel size={22} color="rgba(255,255,255,0.4)"/>
                  </div>
                  <div>
                    <div style={{color:'#fff', fontWeight:700, fontSize:14}}>All Reels</div>
                    <div style={{color:'rgba(255,255,255,0.4)', fontSize:12, marginTop:2}}>Trigger fires on any reel you post</div>
                  </div>
                </button>

                <SectionLabel>OR PICK A SPECIFIC REEL</SectionLabel>

                <button onClick={()=>fetchReels(form.account_id)} style={{
                  background:'none', border:'none', color:'rgba(255,255,255,0.35)',
                  cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:5,
                  marginBottom:12, padding:0, fontFamily:'DM Sans,sans-serif',
                }}>
                  <IcRefresh size={13} color="rgba(255,255,255,0.35)"/>
                  {reelsLoading ? 'Loading reels...' : 'Load / Refresh reels'}
                </button>

                {reelsLoading && (
                  <div style={{textAlign:'center', padding:'24px 0', color:'rgba(255,255,255,0.3)', fontSize:13}}>
                    Fetching your latest reels...
                  </div>
                )}

                {!reelsLoading && reels.length===0 && (
                  <div style={{
                    background:'rgba(255,255,255,0.04)', borderRadius:14,
                    padding:'16px', textAlign:'center',
                    color:'rgba(255,255,255,0.3)', fontSize:13, marginBottom:16,
                  }}>
                    Tap "Load reels" above to fetch your latest posts.
                  </div>
                )}

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8}}>
                  {reels.map(r=>{
                    const selected = form.media_id===r.id;
                    const thumb = r.thumbnail_url||r.media_url;
                    return (
                      <button key={r.id} onClick={()=>{ setForm(f=>({...f,media_id:r.id})); setStep(2); }} style={{
                        background: selected ? `${G}15` : 'rgba(255,255,255,0.04)',
                        border:`1px solid ${selected ? G+'55':'rgba(255,255,255,0.1)'}`,
                        borderRadius:12, padding:5, cursor:'pointer',
                        position:'relative', overflow:'hidden',
                      }}>
                        <div style={{width:'100%', paddingTop:'133%', position:'relative', borderRadius:8, overflow:'hidden', background:'rgba(255,255,255,0.07)'}}>
                          {thumb
                            ? <img src={thumb} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>
                            : <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                                <IcImage size={18} color="rgba(255,255,255,0.2)"/>
                              </div>
                          }
                          {selected && (
                            <div style={{position:'absolute',inset:0,background:'rgba(49,236,86,0.22)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                              <IcCheck size={22} color={G}/>
                            </div>
                          )}
                        </div>
                        <div style={{fontSize:9,color:'rgba(255,255,255,0.38)',marginTop:4,textAlign:'left',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {r.timestamp ? new Date(r.timestamp).toLocaleDateString() : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>)}
            </div>
          )}

          {/* ── STEP 2: Configure ── */}
          {step===2 && (
            <div>
              {/* Back + selected reel chip */}
              <button onClick={()=>setStep(1)} style={{
                background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:12, padding:'8px 14px', marginBottom:16, cursor:'pointer',
                display:'flex', alignItems:'center', gap:8, width:'100%',
              }}>
                <IcReel size={14} color={G}/>
                <div style={{flex:1, textAlign:'left'}}>
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.38)'}}>Selected reel</div>
                  <div style={{fontSize:13, color:G, fontWeight:600}}>
                    {form.media_id==='any' ? 'All Reels' : (selectedReel?.timestamp ? new Date(selectedReel.timestamp).toLocaleDateString() : 'Specific reel')}
                  </div>
                </div>
                <span style={{fontSize:11, color:'rgba(255,255,255,0.3)'}}>Change →</span>
              </button>

              <Input label="TRIGGER NAME" value={form.name} onChange={set('name')} placeholder="e.g. Free Guide Trigger"/>
              <RSelect label="FIRE THIS FLOW" value={form.flow_id} onChange={set('flow_id')} options={flowOpts}/>
              <Input label="TRIGGER KEYWORDS (comma-separated)" value={form.keywords} onChange={set('keywords')} placeholder="GUIDE, guide, send it, link"/>
              <RSelect label="MATCH TYPE" value={form.match_type} onChange={set('match_type')} options={MATCH_OPTS}/>

              {/* ── DM LINK SECTION ── */}
              <div style={{
                background:`${G}09`, border:`1px solid ${G}25`,
                borderRadius:14, padding:'14px', marginBottom:13,
              }}>
                <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:10}}>
                  <IcLink size={14} color={G}/>
                  <div style={{color:G, fontSize:12, fontWeight:700, letterSpacing:0.5}}>LINK TO SEND IN DM</div>
                </div>
                <Input
                  label="DESTINATION URL (your guide, product page, etc.)"
                  value={form.dm_url}
                  onChange={set('dm_url')}
                  placeholder="https://yourguide.com/free-guide"
                  mono
                />
                <Input
                  label="BUTTON LABEL (what the button says in DM)"
                  value={form.dm_button_label}
                  onChange={set('dm_button_label')}
                  placeholder="Get Your Free Guide"
                />
                <div style={{fontSize:11, color:'rgba(255,255,255,0.35)', lineHeight:1.6}}>
                  When someone comments your keyword, they'll receive a DM with a button that links to this URL.
                  Leave blank if you're using a Flow to handle the message instead.
                </div>
              </div>

              <Input label="PUBLIC COMMENT REPLY (optional)" value={form.comment_reply} onChange={set('comment_reply')} placeholder="Check your DMs!"/>

              {err && (
                <div style={{color:P, fontSize:12, marginBottom:12, padding:'9px 12px', background:`${P}10`, borderRadius:10}}>{err}</div>
              )}

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
