import { useState, useEffect } from 'react';
import { PageHeader, Btn, Table } from '../components/Layout.jsx';
import { api } from '../lib/api.js';

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [msg,      setMsg]      = useState('');

  const load = () => api.getAccounts()
    .then(setAccounts).catch(console.error).finally(() => setLoading(false));

  useEffect(() => {
    load();
    // Check for OAuth callback param
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const connected = params.get('connected');
    if (connected) { setMsg(`✓ Connected: @${connected}`); window.location.hash = '/accounts'; }
  }, []);

  const connect = async () => {
    const { url } = await api.getOAuthUrl();
    window.location.href = url;
  };

  const remove = async (row) => {
    if (!confirm(`Disconnect @${row.username}? This will stop all their flows.`)) return;
    await api.deleteAccount(row._id.$oid);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="REAKTR · MULTI-ACCOUNT"
        action={<Btn onClick={connect}>+ CONNECT INSTAGRAM</Btn>}
      />

      <div style={{ padding: '28px 36px' }}>

        {msg && (
          <div style={{
            background: '#00FFD111', border: '1px solid #00FFD133',
            color: '#00FFD1', padding: '12px 16px', marginBottom: 20,
            fontSize: 12, fontFamily: "'Courier New', monospace",
          }}>{msg}</div>
        )}

        {/* How it works */}
        <div style={{
          background: '#0a0a0f', borderLeft: '2px solid #00FFD133',
          padding: '20px 24px', marginBottom: 24,
        }}>
          <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 12 }}>
            HOW TO CONNECT
          </div>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            {[
              '① Click "Connect Instagram" above',
              '② Login with Facebook & authorise REAKTR',
              '③ Select your Instagram Business account',
              '④ Your account is live — set up triggers',
            ].map((s, i) => (
              <div key={i} style={{ fontSize: 12, color: '#64748b', fontFamily: 'Georgia, serif' }}>{s}</div>
            ))}
          </div>
        </div>

        {/* Requirements notice */}
        <div style={{
          background: '#0a0a0f', padding: '16px 24px', marginBottom: 24,
          borderLeft: '2px solid #FBBF2433',
        }}>
          <div style={{ fontSize: 9, letterSpacing: '3px', color: '#FBBF24', marginBottom: 10 }}>
            REQUIREMENTS CHECKLIST
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              'Instagram Business Account',
              'Facebook Page connected to IG',
              'Meta Developer App configured',
            ].map(r => (
              <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
                <span style={{ color: '#34D399' }}>✓</span> {r}
              </div>
            ))}
          </div>
        </div>

        {/* Accounts table */}
        {loading
          ? <div style={{ color: '#334155', fontSize: 11, letterSpacing: '2px', padding: 20 }}>LOADING...</div>
          : (
            <div style={{ background: '#0a0a0f' }}>
              <Table
                columns={[
                  {
                    key: 'username', label: 'ACCOUNT',
                    render: (v, row) => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {row.profile_pic && <img src={row.profile_pic} style={{ width: 28, height: 28, borderRadius: '50%' }} />}
                        <span style={{ color: '#00FFD1', fontFamily: "'Courier New', monospace" }}>@{v}</span>
                      </div>
                    ),
                  },
                  { key: 'name',       label: 'NAME'      },
                  { key: 'ig_id',      label: 'IG ID', mono: true },
                  { key: 'page_id',    label: 'PAGE ID', mono: true },
                  {
                    key: 'connected_at', label: 'CONNECTED',
                    render: v => v ? new Date(v).toLocaleDateString() : '—',
                  },
                  {
                    key: 'active', label: 'STATUS',
                    render: v => (
                      <span style={{
                        fontSize: 9, letterSpacing: '2px', padding: '2px 8px',
                        background: v ? '#00FFD111' : '#FF6B6B11',
                        color: v ? '#00FFD1' : '#FF6B6B',
                      }}>{v ? 'ACTIVE' : 'PAUSED'}</span>
                    ),
                  },
                ]}
                rows={accounts}
                onDelete={remove}
              />
            </div>
          )
        }

        {!loading && accounts.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 0',
            color: '#1e293b', fontSize: 13,
          }}>
            No accounts connected yet.<br />
            <span style={{ color: '#334155', fontSize: 11 }}>
              Click "Connect Instagram" to get started.
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
