import { useState, useEffect } from 'react';
import { PageHeader, Stat } from '../components/Layout.jsx';
import { api } from '../lib/api.js';

const EVENT_COLOR = {
  trigger_fired  : '#00FFD1',
  step_executed  : '#A78BFA',
  lead_captured  : '#FBBF24',
  follow_verified: '#34D399',
  flow_started   : '#60A5FA',
  broadcast_sent : '#FF6B6B',
};

export default function Analytics() {
  const [data,    setData]    = useState(null);
  const [account, setAccount] = useState('');
  const [accounts,setAccounts]= useState([]);
  const [loading, setLoading] = useState(true);

  const load = async (acId) => {
    setLoading(true);
    const [d, a] = await Promise.all([api.getAnalytics(acId), api.getAccounts()]);
    setData(d); setAccounts(a); setLoading(false);
  };

  useEffect(() => { load(''); }, []);

  // Build simple bar chart from events by type
  const eventBreakdown = () => {
    if (!data?.recentEvents) return [];
    const counts = {};
    for (const e of data.recentEvents) {
      counts[e.type] = (counts[e.type] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  };

  // Build timeline (last 24h by hour)
  const timeline = () => {
    if (!data?.recentEvents) return [];
    const hours = {};
    for (const e of data.recentEvents) {
      const h = new Date(e.ts).getHours();
      hours[h] = (hours[h] ?? 0) + 1;
    }
    return Array.from({length: 24}, (_, i) => ({ h: i, count: hours[i] ?? 0 }));
  };

  const tl   = timeline();
  const maxTl = Math.max(1, ...tl.map(x => x.count));
  const bd    = eventBreakdown();
  const maxBd = Math.max(1, ...bd.map(x => x[1]));

  return (
    <div>
      <PageHeader title="Analytics" subtitle="REAKTR · ANALYTICS" />

      <div style={{ padding: '28px 36px' }}>

        {/* Account filter */}
        <div style={{ marginBottom: 24, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 9, letterSpacing: '3px', color: '#334155' }}>FILTER BY:</span>
          <button onClick={() => { setAccount(''); load(''); }} style={{
            background: !account ? '#00FFD1' : '#0f0f14',
            color: !account ? '#000' : '#64748b',
            border: 'none', padding: '6px 14px', cursor: 'pointer',
            fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: '2px',
          }}>ALL ACCOUNTS</button>
          {accounts.map(a => (
            <button key={a._id?.$oid} onClick={() => { setAccount(a._id?.$oid); load(a._id?.$oid); }} style={{
              background: account === a._id?.$oid ? '#00FFD1' : '#0f0f14',
              color: account === a._id?.$oid ? '#000' : '#64748b',
              border: 'none', padding: '6px 14px', cursor: 'pointer',
              fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: '2px',
            }}>@{a.username}</button>
          ))}
        </div>

        {loading
          ? <div style={{ color: '#334155', fontSize: 11, letterSpacing: '2px' }}>LOADING...</div>
          : (<>
            {/* Stats grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))',
              gap: 1, background: '#0f0f14', marginBottom: 32,
            }}>
              <Stat label="TRIGGERS FIRED"  value={data?.triggersTotal}  accent="#00FFD1" />
              <Stat label="DMs SENT"        value={data?.dmsSent}        accent="#A78BFA" />
              <Stat label="LEADS CAPTURED"  value={data?.leadsTotal}     accent="#FBBF24" />
              <Stat label="FOLLOW VERIFIED" value={data?.followVerified} accent="#34D399" />
              <Stat label="TOTAL SESSIONS"  value={data?.sessions}       accent="#60A5FA" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>

              {/* Activity timeline */}
              <div style={{ background: '#0a0a0f', padding: 24 }}>
                <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 20 }}>
                  ACTIVITY (LAST 50 EVENTS · BY HOUR)
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
                  {tl.map(({ h, count }) => (
                    <div key={h} style={{
                      flex: 1, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 4,
                    }}>
                      <div style={{
                        width: '100%',
                        height: `${(count / maxTl) * 72}px`,
                        background: count > 0 ? '#00FFD1' : '#0f0f14',
                        minHeight: count > 0 ? 4 : 0,
                        transition: 'height 0.3s',
                      }} title={`${h}:00 — ${count} events`} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9, color: '#1e293b' }}>
                  <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
                </div>
              </div>

              {/* Event breakdown */}
              <div style={{ background: '#0a0a0f', padding: 24 }}>
                <div style={{ fontSize: 9, letterSpacing: '3px', color: '#334155', marginBottom: 20 }}>
                  EVENT BREAKDOWN
                </div>
                {bd.length === 0
                  ? <div style={{ color: '#1e293b', fontSize: 11 }}>No events yet</div>
                  : bd.map(([type, count]) => (
                  <div key={type} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: EVENT_COLOR[type] ?? '#334155' }}>
                        {type.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: 10, color: '#64748b' }}>{count}</span>
                    </div>
                    <div style={{ height: 3, background: '#0f0f14' }}>
                      <div style={{
                        height: '100%', width: `${(count/maxBd)*100}%`,
                        background: EVENT_COLOR[type] ?? '#334155',
                        transition: 'width 0.4s',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent events log */}
            <div style={{ background: '#0a0a0f' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #0f0f14', fontSize: 9, letterSpacing: '3px', color: '#334155' }}>
                RECENT EVENTS LOG
              </div>
              {(data?.recentEvents ?? []).slice(0, 30).map((e, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '10px 24px', borderBottom: '1px solid #0a0a0f',
                  fontSize: 11,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: EVENT_COLOR[e.type] ?? '#334155',
                  }} />
                  <span style={{ color: EVENT_COLOR[e.type] ?? '#334155', minWidth: 160 }}>
                    {e.type?.replace(/_/g, ' ')}
                  </span>
                  <span style={{ color: '#475569', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    user: {e.ig_user_id ?? '—'}
                    {e.keyword ? ` · keyword: "${e.keyword}"` : ''}
                  </span>
                  <span style={{ color: '#334155', fontSize: 9, flexShrink: 0 }}>
                    {e.ts ? new Date(e.ts).toLocaleString() : ''}
                  </span>
                </div>
              ))}
              {!data?.recentEvents?.length && (
                <div style={{ padding: '32px 24px', color: '#1e293b', fontSize: 11 }}>
                  No events yet. Set up a trigger to start tracking.
                </div>
              )}
            </div>
          </>)
        }
      </div>
    </div>
  );
}
