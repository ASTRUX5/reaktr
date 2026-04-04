import { useState, useEffect } from 'react';
import { PageHeader, Stat } from '../components/Layout.jsx';
import { api } from '../lib/api.js';

export default function Dashboard() {
  const [stats,    setStats]    = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([api.getAnalytics(), api.getAccounts()])
      .then(([s, a]) => { setStats(s); setAccounts(a); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const ACCENT = ['#00FFD1','#FF6B6B','#A78BFA','#FBBF24','#34D399','#60A5FA'];

  return (
    <div>
      <PageHeader title="Overview" subtitle="REAKTR · DASHBOARD" />

      <div style={{ padding: '28px 36px' }}>

        {/* Stats grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))',
          gap: 1, background: '#0f0f14', marginBottom: 32,
        }}>
          {[
            { label: 'TRIGGERS FIRED',   value: stats?.triggersTotal,  accent: '#00FFD1' },
            { label: 'DMs SENT',         value: stats?.dmsSent,        accent: '#A78BFA' },
            { label: 'LEADS CAPTURED',   value: stats?.leadsTotal,     accent: '#FBBF24' },
            { label: 'FOLLOW VERIFIED',  value: stats?.followVerified, accent: '#34D399' },
            { label: 'ACTIVE SESSIONS',  value: stats?.sessions,       accent: '#FF6B6B' },
            { label: 'ACCOUNTS',         value: accounts.length,       accent: '#60A5FA' },
          ].map(s => <Stat key={s.label} {...s} />)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

          {/* Connected Accounts */}
          <div style={{ background: '#0a0a0f', padding: 24 }}>
            <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 20 }}>
              CONNECTED ACCOUNTS
            </div>
            {loading
              ? <Skeleton />
              : accounts.length === 0
              ? (
                <div style={{ color: '#1e293b', fontSize: 11 }}>
                  No accounts connected.{' '}
                  <a href="#/accounts" style={{ color: '#00FFD1' }}>Connect one →</a>
                </div>
              )
              : accounts.map((a, i) => (
                <div key={a._id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0', borderBottom: '1px solid #0f0f14',
                }}>
                  {a.profile_pic
                    ? <img src={a.profile_pic} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                    : <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: ACCENT[i % ACCENT.length] + '22',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: ACCENT[i % ACCENT.length], fontSize: 13, fontWeight: 900,
                      }}>@</div>
                  }
                  <div>
                    <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 700 }}>
                      @{a.username}
                    </div>
                    <div style={{ fontSize: 9, color: '#334155', letterSpacing: '2px', marginTop: 2 }}>
                      ACTIVE
                    </div>
                  </div>
                </div>
              ))
            }
          </div>

          {/* Recent Events */}
          <div style={{ background: '#0a0a0f', padding: 24 }}>
            <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 20 }}>
              RECENT ACTIVITY
            </div>
            {loading
              ? <Skeleton />
              : (stats?.recentEvents ?? []).slice(0, 10).map((e, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 0', borderBottom: '1px solid #0f0f14',
                  fontSize: 11,
                }}>
                  <span style={{ color: eventColor(e.type) }}>
                    {eventLabel(e.type)}
                  </span>
                  <span style={{ color: '#334155', fontSize: 9 }}>
                    {timeAgo(e.ts)}
                  </span>
                </div>
              ))
            }
            {!loading && !stats?.recentEvents?.length && (
              <div style={{ color: '#1e293b', fontSize: 11 }}>
                No activity yet. Set up a trigger to get started.
              </div>
            )}
          </div>

        </div>

        {/* Quick actions */}
        <div style={{ marginTop: 24, padding: 24, background: '#0a0a0f', borderLeft: '2px solid #00FFD133' }}>
          <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 16 }}>
            QUICK ACTIONS
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: '+ Add Account',  path: '/accounts'  },
              { label: '+ New Flow',     path: '/flows'     },
              { label: '+ New Trigger',  path: '/triggers'  },
              { label: 'View Analytics', path: '/analytics' },
            ].map(a => (
              <button key={a.path} onClick={() => window.location.hash = a.path} style={{
                background: '#0f0f14', border: '1px solid #1e293b',
                color: '#64748b', padding: '8px 16px', cursor: 'pointer',
                fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: '2px',
              }}>{a.label}</button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{
          height: 28, background: '#0f0f14',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
    </div>
  );
}

function eventColor(type) {
  return {
    trigger_fired   : '#00FFD1',
    step_executed   : '#A78BFA',
    lead_captured   : '#FBBF24',
    follow_verified : '#34D399',
    flow_started    : '#60A5FA',
    broadcast_sent  : '#FF6B6B',
  }[type] ?? '#334155';
}

function eventLabel(type) {
  return {
    trigger_fired   : '◎ Trigger fired',
    step_executed   : '⟁ Step executed',
    lead_captured   : '◉ Lead captured',
    follow_verified : '✓ Follow verified',
    flow_started    : '⬡ Flow started',
    broadcast_sent  : '↗ Broadcast sent',
  }[type] ?? type;
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}
