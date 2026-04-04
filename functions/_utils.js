// ─── REAKTR · Shared Utilities ────────────────────────────────────────────────

// ── HMAC-SHA256 signature verify (Meta webhook security) ──────
export async function verifySignature(rawBody, signature, appSecret) {
  if (!signature) return false;
  const sig = signature.replace('sha256=', '');

  const enc    = new TextEncoder();
  const key    = await crypto.subtle.importKey(
    'raw', enc.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const buf    = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const hex    = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Constant-time compare
  if (hex.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

// ── CORS headers ──────────────────────────────────────────────
export const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function cors(status = 204) {
  return new Response(null, { status, headers: CORS });
}

// ── JSON response helpers ─────────────────────────────────────
export function ok(data)      { return res(200, data); }
export function created(data) { return res(201, data); }
export function bad(msg)      { return res(400, { error: msg }); }
export function unauth(msg = 'Unauthorized') { return res(401, { error: msg }); }
export function notFound(msg = 'Not found')  { return res(404, { error: msg }); }
export function serverErr(msg = 'Internal server error') { return res(500, { error: msg }); }

function res(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ── Auth check for dashboard API ─────────────────────────────
export function authCheck(request, env) {
  const header = request.headers.get('Authorization') ?? '';
  const token  = header.replace('Bearer ', '').trim();
  return token === env.DASHBOARD_SECRET;
}

// ── Keyword matcher (exact, contains, fuzzy) ──────────────────
export function matchesKeyword(text, trigger) {
  const t = text.toLowerCase().trim();

  for (const kw of trigger.keywords ?? []) {
    const k = kw.toLowerCase().trim();
    switch (trigger.match_type) {
      case 'exact'      : if (t === k)              return { matched: true, keyword: kw }; break;
      case 'contains'   : if (t.includes(k))        return { matched: true, keyword: kw }; break;
      case 'starts_with': if (t.startsWith(k))      return { matched: true, keyword: kw }; break;
      case 'fuzzy'      : if (levenshtein(t, k) <= 2) return { matched: true, keyword: kw }; break;
      default           : if (t.includes(k))        return { matched: true, keyword: kw };
    }
  }
  return { matched: false };
}

// ── Levenshtein distance ──────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

// ── Rate limit check (simple KV-based) ───────────────────────
export async function rateLimit(kv, key, maxPerHour = 100) {
  if (!kv) return false; // no KV configured, skip
  try {
    const raw   = await kv.get(key);
    const count = raw ? parseInt(raw) : 0;
    if (count >= maxPerHour) return true; // blocked
    await kv.put(key, String(count + 1), { expirationTtl: 3600 });
    return false;
  } catch {
    return false;
  }
}
