import { useState, useEffect } from 'react';
import { PageHeader, Btn, Table, Modal, Input } from '../components/Layout.jsx';
import { api } from '../lib/api.js';

export default function Leads() {
  const [leads,    setLeads]    = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [account,  setAccount]  = useState('');
  const [bModal,   setBModal]   = useState(false);
  const [bForm,    setBForm]    = useState({ message: '', button_label: '', button_url: '', segment: 'all' });
  const [bStatus,  setBStatus]  = useState('');

  const load = async (acId) => {
    const [l, a] = await Promise.all([api.getLeads(acId), api.getAccounts()]);
    setLeads(l); setAccounts(a);
  };

  useEffect(() => { load(''); }, []);

  const exportCSV = () => {
    const header = 'ig_user_id,field,value,flow_id,timestamp\n';
    const rows = leads.map(l =>
      `${l.ig_user_id},${l.field},${l.value?.replace(/,/g,'')},${l.flow_id},${l.ts}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'reaktr_leads.csv'; a.click();
  };

  const sendBroadcast = async () => {
    if (!bForm.message)  return setBStatus('Message is required');
    if (!account)        return setBStatus('Select an account first');
    setBStatus('Sending...');
    try {
      const buttons = bForm.button_url
        ? [{ type: 'url', title: bForm.button_label || 'Click Here', url: bForm.button_url }]
        : [];
      const res = await api.broadcast({
        account_id: account,
        message   : bForm.message,
        buttons,
        segment   : bForm.segment,
      });
      setBStatus(`✓ Sent to ${res.sent} / ${res.total} users`);
    } catch (e) {
      setBStatus(`✗ ${e.message}`);
    }
  };

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="REAKTR · LEAD CAPTURE"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="secondary" onClick={exportCSV}>EXPORT CSV</Btn>
            <Btn onClick={() => setBModal(true)}>↗ BROADCAST</Btn>
          </div>
        }
      />

      <div style={{ padding: '28px 36px' }}>

        {/* Account filter */}
        <div style={{ marginBottom: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { setAccount(''); load(''); }} style={{
            background: !account ? '#00FFD1' : '#0f0f14',
            color: !account ? '#000' : '#64748b',
            border: 'none', padding: '6px 14px', cursor: 'pointer',
            fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: '2px',
          }}>ALL</button>
          {accounts.map(a => (
            <button key={a._id?.$oid} onClick={() => { setAccount(a._id?.$oid); load(a._id?.$oid); }} style={{
              background: account === a._id?.$oid ? '#00FFD1' : '#0f0f14',
              color: account === a._id?.$oid ? '#000' : '#64748b',
              border: 'none', padding: '6px 14px', cursor: 'pointer',
              fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: '2px',
            }}>@{a.username}</button>
          ))}
        </div>

        <div style={{ marginBottom: 12, fontSize: 11, color: '#334155' }}>
          {leads.length} leads captured
        </div>

        <div style={{ background: '#0a0a0f' }}>
          <Table
            columns={[
              { key: 'ig_user_id', label: 'IG USER ID', mono: true },
              { key: 'field',      label: 'FIELD',
                render: v => <span style={{ color: '#FBBF24', fontFamily:"'Courier New',monospace", fontSize: 11 }}>{v}</span>
              },
              { key: 'value',      label: 'VALUE',
                render: v => <span style={{ color: '#e2e8f0' }}>{v}</span>
              },
              { key: 'ts', label: 'CAPTURED AT',
                render: v => v ? new Date(v).toLocaleString() : '—',
              },
            ]}
            rows={leads}
          />
        </div>

        {!leads.length && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#1e293b', fontSize: 13 }}>
            No leads captured yet.<br/>
            <span style={{ color: '#334155', fontSize: 11 }}>
              Add a Lead Capture step to a flow to start collecting emails.
            </span>
          </div>
        )}
      </div>

      {bModal && (
        <Modal title="Broadcast Message" onClose={() => { setBModal(false); setBStatus(''); }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>
            Send a DM to all users who have interacted with your flows.
            Only users who previously messaged your page can receive broadcasts.
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 6 }}>ACCOUNT</div>
            <select value={account} onChange={e => setAccount(e.target.value)} style={{
              width: '100%', background: '#0a0a0f', border: '1px solid #1e293b',
              color: '#e2e8f0', padding: '10px 14px', fontSize: 13, outline: 'none',
              fontFamily: "'Courier New', monospace",
            }}>
              <option value="">— Select account —</option>
              {accounts.map(a => <option key={a._id?.$oid} value={a._id?.$oid}>@{a.username}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 6 }}>SEGMENT</div>
            <select value={bForm.segment} onChange={e => setBForm(f=>({...f,segment:e.target.value}))} style={{
              width: '100%', background: '#0a0a0f', border: '1px solid #1e293b',
              color: '#e2e8f0', padding: '10px 14px', fontSize: 13, outline: 'none',
              fontFamily: "'Courier New', monospace",
            }}>
              <option value="all">All users (everyone in sessions)</option>
              <option value="leads">Leads only (users who submitted email/phone)</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 6 }}>MESSAGE</div>
            <textarea
              value={bForm.message}
              onChange={e => setBForm(f=>({...f,message:e.target.value}))}
              placeholder="Hey! We've got something special for you... 🎁"
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

          <Input label="BUTTON LABEL (optional)" value={bForm.button_label}
            onChange={v => setBForm(f=>({...f,button_label:v}))} placeholder="🚀 Check It Out" />
          <Input label="BUTTON URL (optional)" value={bForm.button_url} mono
            onChange={v => setBForm(f=>({...f,button_url:v}))} placeholder="https://yourlink.com" />

          {bStatus && (
            <div style={{
              padding: '10px 14px', marginBottom: 12,
              background: bStatus.startsWith('✓') ? '#00FFD111' : bStatus === 'Sending...' ? '#0f0f14' : '#FF6B6B11',
              color: bStatus.startsWith('✓') ? '#00FFD1' : bStatus === 'Sending...' ? '#64748b' : '#FF6B6B',
              fontSize: 11,
            }}>{bStatus}</div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => { setBModal(false); setBStatus(''); }}>CANCEL</Btn>
            <Btn onClick={sendBroadcast} disabled={bStatus === 'Sending...'}>
              {bStatus === 'Sending...' ? 'SENDING...' : '↗ SEND BROADCAST'}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
