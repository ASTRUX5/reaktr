import { useState, useEffect } from 'react';
import { PageHeader, Btn, Modal, Input, Select, Table } from '../components/Layout.jsx';
import { api } from '../lib/api.js';

// ── Step type definitions ─────────────────────────────────────
const STEP_TYPES = [
  { value: 'text',          label: 'Text Message',    color: '#60A5FA', icon: '💬' },
  { value: 'buttons',       label: 'Button Template', color: '#A78BFA', icon: '🔘' },
  { value: 'quick_replies', label: 'Quick Replies',   color: '#00FFD1', icon: '⚡' },
  { value: 'follow_gate',   label: 'Follow Gate',     color: '#34D399', icon: '🔐' },
  { value: 'url_button',    label: 'URL Button',      color: '#FBBF24', icon: '🔗' },
  { value: 'lead_capture',  label: 'Lead Capture',    color: '#FF6B6B', icon: '📧' },
  { value: 'delay',         label: 'Delay',           color: '#334155', icon: '⏱' },
];

// ── Built-in templates ────────────────────────────────────────
const TEMPLATES = [
  {
    name: '🎁 Free Guide Flow (Follow Gate)',
    steps: [
      { id: 's1', type: 'text',        text: 'Hey! Thanks for stopping by 👋', delay_ms: 0 },
      { id: 's2', type: 'follow_gate', text: "To unlock your free guide, you need to follow us first! 👇", next_step: 's3' },
      { id: 's3', type: 'url_button',  text: "You're verified! Here's your free guide 🎉", button_label: '📖 Get Free Guide', url: 'https://yourguide.com', delay_ms: 500 },
    ],
  },
  {
    name: '📧 Lead Capture Flow',
    steps: [
      { id: 's1', type: 'text',         text: "Hey! I've got something special for you 🎁", delay_ms: 0 },
      { id: 's2', type: 'lead_capture', text: 'Drop your email below and I\'ll send it right over! 📩', field: 'email', next_step: 's3', skip_step: 's3', delay_ms: 800 },
      { id: 's3', type: 'url_button',   text: "Here you go! Click below to access your resource 👇", button_label: '🚀 Access Now', url: 'https://yourlink.com' },
    ],
  },
  {
    name: '✅ Simple DM Reply',
    steps: [
      { id: 's1', type: 'text',       text: 'Thanks for commenting! Check this out 👇', delay_ms: 0 },
      { id: 's2', type: 'url_button', text: "Here's the link you asked for!", button_label: '👉 Open Link', url: 'https://yourlink.com' },
    ],
  },
];

const BLANK_FLOW = { name: '', account_id: '', description: '', steps: [], active: true };

function genId() { return 's' + Math.random().toString(36).slice(2, 7); }

export default function Flows() {
  const [flows,    setFlows]    = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [modal,    setModal]    = useState(null); // null | 'list' | 'builder'
  const [flow,     setFlow]     = useState(BLANK_FLOW);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');
  const [selStep,  setSelStep]  = useState(null); // currently editing step index

  const load = async () => {
    const [f, a] = await Promise.all([api.getFlows(), api.getAccounts()]);
    setFlows(f); setAccounts(a);
  };
  useEffect(() => { load(); }, []);

  const openNew = (template = null) => {
    setFlow({
      ...BLANK_FLOW,
      account_id: accounts[0]?._id?.$oid ?? '',
      ...(template ? { name: template.name, steps: template.steps } : {}),
    });
    setSelStep(null);
    setErr('');
    setModal('builder');
  };

  const addStep = (type) => {
    const step = {
      id: genId(), type,
      text    : '',
      delay_ms: 0,
      ...(type === 'buttons'       ? { buttons: [{ type: 'postback', title: '', next_step: '' }] } : {}),
      ...(type === 'quick_replies' ? { replies: [{ title: '', next_step: '' }] } : {}),
      ...(type === 'url_button'    ? { button_label: 'Click Here', url: '' } : {}),
      ...(type === 'lead_capture'  ? { field: 'email', next_step: '', skip_step: '' } : {}),
      ...(type === 'delay'         ? { ms: 2000 } : {}),
    };
    const steps = [...flow.steps, step];
    setFlow(f => ({ ...f, steps }));
    setSelStep(steps.length - 1);
  };

  const updateStep = (idx, patch) => {
    setFlow(f => ({
      ...f,
      steps: f.steps.map((s, i) => i === idx ? { ...s, ...patch } : s),
    }));
  };

  const deleteStep = (idx) => {
    setFlow(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }));
    setSelStep(null);
  };

  const moveStep = (idx, dir) => {
    const steps = [...flow.steps];
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    [steps[idx], steps[target]] = [steps[target], steps[idx]];
    setFlow(f => ({ ...f, steps }));
    setSelStep(target);
  };

  const save = async () => {
    if (!flow.name)       return setErr('Flow name required');
    if (!flow.account_id) return setErr('Select an account');
    if (!flow.steps.length) return setErr('Add at least one step');
    setSaving(true);
    try {
      await api.createFlow(flow);
      setModal(null);
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!confirm(`Delete flow "${row.name}"?`)) return;
    await api.deleteFlow(row._id.$oid);
    load();
  };

  const toggle = async (row) => {
    await api.updateFlow(row._id.$oid, { active: !row.active });
    load();
  };

  const accountOpts = accounts.map(a => ({ value: a._id?.$oid ?? '', label: `@${a.username}` }));
  const stepIds     = flow.steps.map(s => ({ value: s.id, label: `[${s.id}] ${s.type} — ${s.text?.slice(0,20) || '(no text)'}` }));
  const typeInfo    = t => STEP_TYPES.find(x => x.value === t) ?? { color: '#334155', icon: '?' };
  const curStep     = selStep !== null ? flow.steps[selStep] : null;

  return (
    <div>
      <PageHeader
        title="Flows"
        subtitle="REAKTR · FLOW BUILDER"
        action={<Btn onClick={() => setModal('templates')}>+ NEW FLOW</Btn>}
      />

      <div style={{ padding: '28px 36px' }}>
        <div style={{ background: '#0a0a0f' }}>
          <Table
            columns={[
              { key: 'name', label: 'FLOW NAME' },
              { key: 'description', label: 'DESCRIPTION', render: v => v || '—' },
              { key: 'steps', label: 'STEPS',
                render: v => (
                  <span style={{ color: '#00FFD1', fontFamily: "'Courier New',monospace" }}>
                    {Array.isArray(v) ? v.length : 0} steps
                  </span>
                )
              },
              { key: 'active', label: 'STATUS',
                render: v => (
                  <span style={{
                    fontSize: 9, letterSpacing: '2px', padding: '2px 8px',
                    background: v ? '#00FFD111' : '#1e293b', color: v ? '#00FFD1' : '#334155',
                  }}>{v ? 'ACTIVE' : 'PAUSED'}</span>
                )
              },
            ]}
            rows={flows}
            onDelete={remove}
            onToggle={toggle}
          />
        </div>
        {!flows.length && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#1e293b', fontSize: 13 }}>
            No flows yet.<br/>
            <span style={{ color: '#334155', fontSize: 11 }}>Create a flow to define your DM conversations.</span>
          </div>
        )}
      </div>

      {/* Templates modal */}
      {modal === 'templates' && (
        <Modal title="Start a New Flow" onClose={() => setModal(null)}>
          <div style={{ marginBottom: 20, fontSize: 11, color: '#64748b' }}>
            Choose a template or start from scratch.
          </div>
          {TEMPLATES.map((t, i) => (
            <button key={i} onClick={() => openNew(t)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: '#0f0f14', border: '1px solid #1e293b',
              color: '#e2e8f0', padding: '14px 18px', marginBottom: 8,
              cursor: 'pointer', fontFamily: "'Courier New', monospace", fontSize: 12,
            }}>
              <div style={{ fontWeight: 700 }}>{t.name}</div>
              <div style={{ fontSize: 10, color: '#334155', marginTop: 4 }}>
                {t.steps.length} steps
              </div>
            </button>
          ))}
          <button onClick={() => openNew()} style={{
            display: 'block', width: '100%', textAlign: 'left',
            background: 'transparent', border: '1px dashed #1e293b',
            color: '#334155', padding: '14px 18px', cursor: 'pointer',
            fontFamily: "'Courier New', monospace", fontSize: 12,
          }}>
            ⬡ Start from scratch
          </button>
        </Modal>
      )}

      {/* Flow builder modal */}
      {modal === 'builder' && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', zIndex: 100,
        }}>
          {/* Step list panel */}
          <div style={{
            width: 260, background: '#040406', borderRight: '1px solid #0f0f14',
            display: 'flex', flexDirection: 'column', overflowY: 'auto',
          }}>
            <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid #0f0f14' }}>
              <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 6 }}>FLOW STEPS</div>
              <Input label="" value={flow.name} onChange={v => setFlow(f => ({...f,name:v}))} placeholder="Flow name..." />
              <Select label="" value={flow.account_id}
                onChange={v => setFlow(f=>({...f,account_id:v}))}
                options={[{value:'',label:'Account...'},...accountOpts]} />
            </div>
            <div style={{ flex: 1, padding: 12 }}>
              {flow.steps.map((s, i) => {
                const info = typeInfo(s.type);
                return (
                  <div key={s.id} onClick={() => setSelStep(i)} style={{
                    padding: '10px 12px', marginBottom: 4,
                    background: selStep === i ? `${info.color}11` : '#0a0a0f',
                    borderLeft: `2px solid ${selStep === i ? info.color : 'transparent'}`,
                    cursor: 'pointer',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{info.icon}</span>
                      <span style={{ fontSize: 11, color: info.color }}>{s.type}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 9, color: '#334155' }}>
                        {i + 1}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.text || '(no text)'}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Add step buttons */}
            <div style={{ padding: 12, borderTop: '1px solid #0f0f14' }}>
              <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 8 }}>ADD STEP</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {STEP_TYPES.map(t => (
                  <button key={t.value} onClick={() => addStep(t.value)} style={{
                    background: `${t.color}11`, border: `1px solid ${t.color}33`,
                    color: t.color, padding: '4px 8px', cursor: 'pointer',
                    fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: '1px',
                  }}>{t.icon} {t.label.split(' ')[0]}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Step editor panel */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
            {curStep ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: typeInfo(curStep.type).color }}>
                    {typeInfo(curStep.type).icon} {curStep.type.replace('_', ' ').toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn small variant="secondary" onClick={() => moveStep(selStep, -1)}>↑</Btn>
                    <Btn small variant="secondary" onClick={() => moveStep(selStep,  1)}>↓</Btn>
                    <Btn small variant="danger"    onClick={() => deleteStep(selStep)}>DEL</Btn>
                  </div>
                </div>

                {/* Common: text */}
                {curStep.type !== 'delay' && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 6 }}>MESSAGE TEXT</div>
                    <textarea
                      value={curStep.text}
                      onChange={e => updateStep(selStep, { text: e.target.value })}
                      placeholder="Message text... Use {{username}}, {{comment}}, {{keyword}}"
                      rows={4}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: '#0a0a0f', border: '1px solid #1e293b',
                        color: '#e2e8f0', padding: '10px 14px',
                        fontFamily: "'Courier New', monospace", fontSize: 12,
                        outline: 'none', resize: 'vertical',
                      }}
                    />
                  </div>
                )}

                {/* Delay */}
                {curStep.type === 'delay' && (
                  <Input label="DELAY (ms)" value={curStep.ms}
                    onChange={v => updateStep(selStep, { ms: parseInt(v) || 1000 })}
                    placeholder="2000" mono />
                )}

                {/* Delay before this step */}
                <Input
                  label="DELAY BEFORE THIS STEP (ms, 0 = none)"
                  value={curStep.delay_ms || 0}
                  onChange={v => updateStep(selStep, { delay_ms: parseInt(v) || 0 })}
                  placeholder="800" mono
                />

                {/* URL button */}
                {curStep.type === 'url_button' && (<>
                  <Input label="BUTTON LABEL" value={curStep.button_label} onChange={v => updateStep(selStep,{button_label:v})} placeholder="Get Your Guide →" />
                  <Input label="URL" value={curStep.url} onChange={v => updateStep(selStep,{url:v})} placeholder="https://yourguide.com" mono />
                </>)}

                {/* Buttons */}
                {curStep.type === 'buttons' && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 10 }}>
                      BUTTONS (max 3)
                    </div>
                    {(curStep.buttons ?? []).map((b, bi) => (
                      <div key={bi} style={{ background: '#0f0f14', padding: 14, marginBottom: 8 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <Select label="" value={b.type} onChange={v => {
                            const btns = [...curStep.buttons];
                            btns[bi] = { ...btns[bi], type: v };
                            updateStep(selStep, { buttons: btns });
                          }} options={[
                            { value: 'postback', label: 'Postback (continue flow)' },
                            { value: 'url',      label: 'URL (open link)' },
                          ]} />
                          <Btn small variant="danger" onClick={() => {
                            updateStep(selStep, { buttons: curStep.buttons.filter((_,i)=>i!==bi) });
                          }}>×</Btn>
                        </div>
                        <Input label="" value={b.title} placeholder="Button title (max 20 chars)"
                          onChange={v => { const btns=[...curStep.buttons]; btns[bi]={...btns[bi],title:v}; updateStep(selStep,{buttons:btns}); }} />
                        {b.type === 'url'
                          ? <Input label="" value={b.url} placeholder="https://..." mono
                              onChange={v => { const btns=[...curStep.buttons]; btns[bi]={...btns[bi],url:v}; updateStep(selStep,{buttons:btns}); }} />
                          : <Select label="NEXT STEP" value={b.next_step}
                              onChange={v => { const btns=[...curStep.buttons]; btns[bi]={...btns[bi],next_step:v}; updateStep(selStep,{buttons:btns}); }}
                              options={[{value:'',label:'— End flow —'},...stepIds.filter(s=>s.value!==curStep.id)]} />
                        }
                      </div>
                    ))}
                    {(curStep.buttons?.length ?? 0) < 3 && (
                      <Btn small variant="secondary" onClick={() => updateStep(selStep,{buttons:[...(curStep.buttons??[]),{type:'postback',title:'',next_step:''}]})}>
                        + ADD BUTTON
                      </Btn>
                    )}
                  </div>
                )}

                {/* Follow gate / next step */}
                {(curStep.type === 'follow_gate') && (
                  <Select label="NEXT STEP (when follow verified)"
                    value={curStep.next_step}
                    onChange={v => updateStep(selStep, { next_step: v })}
                    options={[{value:'',label:'— End flow —'},...stepIds.filter(s=>s.value!==curStep.id)]} />
                )}

                {/* Lead capture */}
                {curStep.type === 'lead_capture' && (<>
                  <Select label="CAPTURE FIELD"
                    value={curStep.field}
                    onChange={v => updateStep(selStep, { field: v })}
                    options={[{value:'email',label:'Email'},{value:'phone',label:'Phone'},{value:'name',label:'Name'}]} />
                  <Select label="NEXT STEP (after captured)"
                    value={curStep.next_step}
                    onChange={v => updateStep(selStep, { next_step: v })}
                    options={[{value:'',label:'— End flow —'},...stepIds.filter(s=>s.value!==curStep.id)]} />
                  <Select label="SKIP STEP"
                    value={curStep.skip_step}
                    onChange={v => updateStep(selStep, { skip_step: v })}
                    options={[{value:'',label:'— End flow —'},...stepIds.filter(s=>s.value!==curStep.id)]} />
                </>)}

              </div>
            ) : (
              <div style={{ textAlign: 'center', paddingTop: 80, color: '#1e293b' }}>
                {flow.steps.length === 0
                  ? 'Add your first step using the panel on the left.'
                  : 'Select a step to edit it.'}
              </div>
            )}
          </div>

          {/* Save panel */}
          <div style={{
            width: 220, background: '#040406', borderLeft: '1px solid #0f0f14',
            padding: 24, display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 4 }}>FLOW SUMMARY</div>
            <div style={{ fontSize: 11, color: '#475569' }}>Name: <span style={{ color: '#e2e8f0' }}>{flow.name || '—'}</span></div>
            <div style={{ fontSize: 11, color: '#475569' }}>Steps: <span style={{ color: '#00FFD1' }}>{flow.steps.length}</span></div>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 16 }}>
              Account: <span style={{ color: '#e2e8f0' }}>
                {accounts.find(a=>a._id?.$oid===flow.account_id)?.username ?? '—'}
              </span>
            </div>

            {err && <div style={{ color: '#FF6B6B', fontSize: 10, marginBottom: 8 }}>{err}</div>}

            <Btn onClick={save} disabled={saving}>{saving ? 'SAVING...' : 'SAVE FLOW ✓'}</Btn>
            <Btn variant="secondary" onClick={() => setModal(null)}>CANCEL</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
