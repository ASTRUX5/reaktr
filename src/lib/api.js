// ─── REAKTR · API Client ──────────────────────────────────────────────────────
// Talks to /api/* endpoints on the same Cloudflare Pages deployment

const secret = localStorage.getItem('reaktr_secret') || '';

async function req(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('reaktr_secret') || ''}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('reaktr_secret');
    window.location.hash = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // ── Auth ─────────────────────────────────────────────────────
  getOAuthUrl : ()          => req('GET',    '/auth/url'),

  // ── Accounts ─────────────────────────────────────────────────
  getAccounts : ()          => req('GET',    '/accounts'),
  deleteAccount: (id)       => req('DELETE', `/accounts/${id}`),

  // ── Flows ─────────────────────────────────────────────────────
  getFlows    : (acId)      => req('GET',    `/flows${acId ? `?account_id=${acId}` : ''}`),
  getFlow     : (id)        => req('GET',    `/flows/${id}`),
  createFlow  : (data)      => req('POST',   '/flows',       data),
  updateFlow  : (id, data)  => req('PUT',    `/flows/${id}`, data),
  deleteFlow  : (id)        => req('DELETE', `/flows/${id}`),

  // ── Triggers ─────────────────────────────────────────────────
  getTriggers : (acId)      => req('GET',    `/triggers${acId ? `?account_id=${acId}` : ''}`),
  createTrigger: (data)     => req('POST',   '/triggers',         data),
  updateTrigger: (id, data) => req('PUT',    `/triggers/${id}`,   data),
  deleteTrigger: (id)       => req('DELETE', `/triggers/${id}`),

  // ── Analytics ─────────────────────────────────────────────────
  getAnalytics: (acId)      => req('GET',    `/analytics${acId ? `?account_id=${acId}` : ''}`),

  // ── Leads ─────────────────────────────────────────────────────
  getLeads    : (acId)      => req('GET',    `/leads${acId ? `?account_id=${acId}` : ''}`),

  // ── Broadcast ─────────────────────────────────────────────────
  broadcast   : (data)      => req('POST',   '/broadcast', data),
};
