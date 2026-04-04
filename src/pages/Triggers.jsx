import { useState, useEffect } from 'react';
import { PageHeader, Btn, Table, Modal, Input, Select } from '../components/Layout.jsx';
import { api } from '../lib/api.js';

const MATCH_TYPES = [
  { value: 'contains',    label: 'Contains (e.g. comment has "GUIDE" anywhere)' },
  { value: 'exact',       label: 'Exact match only' },
  { value: 'starts_with', label: 'Starts with keyword' },
  { value: 'fuzzy',       label: 'Fuzzy (typos allowed)' },
];

const BLANK = {
  name          : '',
  account_id    : '',
  flow_id       : '',
  keywords      : '',
  match_type    : 'contains',
  media_id      : 'any',
  comment_reply : '',
  active        : true,
};

export default function Triggers() {
  const [triggers,  setTriggers]  = useState([]);
  const [accounts,  setAccounts]  = useState([]);
  const [flows,     setFlows]     = useState([]);
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState(BLANK);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');

  const load = async () => {
    const [t, a, f] = await Promise.all([api.getTriggers(), api.getAccounts(), api.getFlows()]);
    setTriggers(t); setAccounts(a); setFlows(f);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ ...BLANK, account_id: accounts[0]?._id?.$oid ?? '' });
    setErr('');
    setModal(true);
  };

  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name)       return setErr('Trigger name is required');
    if (!form.account_id) return setErr('Select an account');
    if (!form.flow_id)    return setErr('Select a flow to fire');
    if (!form.keywords)   return setErr('Enter at least one keyword');

    setSaving(true);
    try {
      await api.createTrigger({
        ...form,
        keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
      });
      setModal(false);
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!confirm(`Delete trigger "${row.name}"?`)) return;
    await api.deleteTrigger(row._id.$oid);
    load();
  };

  const toggle = async (row) => {
    await api.updateTrigger(row._id.$oid, { active: !row.active });
    load();
  };

  const accountOpts = accounts.map(a => ({ value: a._id?.$oid ?? '', label: `@${a.username}` }));
  const flowOpts    = flows
    .filter(f => !form.account_id || f.account_id === form.account_id)
    .map(f => ({ value: f._id?.$oid ?? '', label: f.name }));

  return (
    <div>
      <PageHeader
        title="Triggers"
        subtitle="REAKTR · COMMENT TRIGGERS"
        action={<Btn onClick={openNew}>+ NEW TRIGGER</Btn>}
      />

      <div style={{ padding: '28px 36px' }}>

        {/* How triggers work */}
        <div style={{
          background: '#0a0a0f', borderLeft: '2px solid #A78BFA33',
          padding: '18px 24px', marginBottom: 24,
        }}>
          <div style={{ fontSize: 9, letterSpacing: '3px', color: '#A78BFA', marginBottom: 8 }}>
            HOW TRIGGERS WORK
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.7, fontFamily: 'Georgia, serif' }}>
            When someone comments on your reel and their comment matches a keyword, REAKTR instantly
            fires a DM flow to them. You can map different keywords to different flows on different reels.
          </p>
        </div>

        <div style={{ background: '#0a0a0f' }}>
          <Table
            columns={[
              { key: 'name',       label: 'TRIGGER NAME' },
              { key: 'keywords',   label: 'KEYWORDS',
                render: v => (Array.isArray(v) ? v : [v]).map(k => (
                  <span key={k} style={{
                    marginRight: 4, padding: '2px 8px', background: '#A78BFA11',
                    color: '#A78BFA', fontSize: 10, fontFamily: "'Courier New', monospace",
                  }}>{k}</span>
                ))
              },
              { key: 'match_type', label: 'MATCH TYPE', mono: true },
              { key: 'media_id',   label: 'REEL / POST', mono: true,
                render: v => v === 'any' ? <span style={{ color: '#334155' }}>ANY REEL</span> : v
              },
              { key: 'active',     label: 'STATUS',
                render: v => (
                  <span style={{
                    fontSize: 9, letterSpacing: '2px', padding: '2px 8px',
                    background: v ? '#00FFD111' : '#1e293b',
                    color: v ? '#00FFD1' : '#334155',
                  }}>{v ? 'ACTIVE' : 'PAUSED'}</span>
                )
              },
            ]}
            rows={triggers}
            onDelete={remove}
            onToggle={toggle}
          />
        </div>

        {!triggers.length && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#1e293b', fontSize: 13 }}>
            No triggers yet.<br />
            <span style={{ color: '#334155', fontSize: 11 }}>Create a trigger to start automating DMs.</span>
          </div>
        )}
      </div>

      {modal && (
        <Modal title="New Comment Trigger" onClose={() => setModal(false)}>
          <Input label="TRIGGER NAME" value={form.name} onChange={set('name')} placeholder="e.g. Guide Reel Trigger" />

          <Select label="ACCOUNT" value={form.account_id} onChange={set('account_id')}
            options={[{ value: '', label: '— Select account —' }, ...accountOpts]} />

          <Select label="FIRE THIS FLOW" value={form.flow_id} onChange={set('flow_id')}
            options={[{ value: '', label: '— Select flow —' }, ...flowOpts]} />

          <Input
            label="KEYWORDS (comma-separated)"
            value={form.keywords}
            onChange={set('keywords')}
            placeholder="GUIDE, guide, freebie, send it"
          />

          <Select label="MATCH TYPE" value={form.match_type} onChange={set('match_type')}
            options={MATCH_TYPES} />

          <Input
            label="REEL / POST MEDIA ID (leave 'any' for all reels)"
            value={form.media_id}
            onChange={set('media_id')}
            placeholder="any"
            mono
          />

          <Input
            label="PUBLIC COMMENT REPLY (optional)"
            value={form.comment_reply}
            onChange={set('comment_reply')}
            placeholder="Check your DMs! 📩"
          />

          {err && <div style={{ color: '#FF6B6B', fontSize: 11, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setModal(false)}>CANCEL</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'SAVING...' : 'CREATE TRIGGER'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
