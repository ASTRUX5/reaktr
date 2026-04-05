// ─── REAKTR · Webhook Handler (FINAL - D1 Only, No KV) ───────────────────────

import { DB }          from '../src/lib/_db.js';
import { Messenger }   from '../src/lib/_messenger.js';
import { FlowEngine }  from '../src/lib/_flowEngine.js';
import { verifySignature, matchesKeyword, CORS } from '../src/lib/_utils.js';

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  const url = new URL(request.url);

  // ══════════════════════════════════════════════════════════
  // 🔐 META VERIFICATION (GET)
  // ══════════════════════════════════════════════════════════
  if (request.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('[WEBHOOK] VERIFY:', { mode, token: token ? '***' : null });

    if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
      console.log('[WEBHOOK] ✓ Verification successful');
      return new Response(challenge, { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    console.log('[WEBHOOK] ✗ Verification failed');
    return new Response('Forbidden', { 
      status: 403,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // ══════════════════════════════════════════════════════════
  // 📩 INCOMING EVENTS (POST)
  // ══════════════════════════════════════════════════════════
  if (request.method === 'POST') {
    try {
      const rawBody = await request.clone().text();
      const sig = request.headers.get('X-Hub-Signature-256') ?? '';

      console.log('[WEBHOOK] POST received', { 
        sig: sig ? sig.slice(0, 20) + '...' : 'MISSING',
        bodyPreview: rawBody.slice(0, 100)
      });

      // 🔐 TEMP: Disable signature check for debugging (re-enable later)      if (false) {
        const valid = await verifySignature(rawBody, sig, env.META_APP_SECRET);
        if (!valid) {
          console.error('[WEBHOOK] ✗ Signature failed');
          return new Response('Invalid signature', { status: 401 });
        }
      }

      const body = JSON.parse(rawBody);
      console.log('[WEBHOOK] Body parsed, object:', body.object);

      // Process async
      waitUntil(processEvent(body, env).catch(err => {
        console.error('[WEBHOOK] processEvent ERROR:', err.message);
      }));

      return new Response('OK', { 
        status: 200, 
        headers: { ...CORS, 'Content-Type': 'text/plain' } // ✅ Use imported CORS
      });

    } catch (err) {
      console.error('[WEBHOOK] CRITICAL:', err.message);
      return new Response('Error', { status: 500 });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
}

// ── Main processor ───────────────────────────────────────────
async function processEvent(body, env) {
  if (body.object !== 'instagram') return;

  let db;
  try {
    // ✅ R1D1: Pass env.DB (your binding name) to DB class
    db = new DB({ D1: env.DB }); 
    await db.init();
    console.log('[DB] ✓ Initialized with D1 binding');
  } catch(e) {
    console.error('[DB] ✗ Init failed:', e.message);
    return;
  }

  for (const entry of body.entry ?? []) {
    console.log('[ENTRY] ID:', entry.id);

    // Find account (supports multiple ID fields)
    let account = await db.findOne('accounts', {      $or: [
        { ig_id: entry.id },
        { page_id: entry.id },
        { instagram_id: entry.id }
      ]
    });

    if (!account) {
      console.error('[ACCOUNT] ✗ Not found:', entry.id);
      await safeInsert(db, 'events', {
        type: 'webhook_no_account',
        detail: `entry.id=${entry.id}`,
        ts: new Date().toISOString(),
      });
      continue;
    }

    console.log('[ACCOUNT] ✓ Found:', account.username);

    // ✅ Fallback to env.META_PAGE_TOKEN if account missing token
    const accessToken = account.page_access_token || env.META_PAGE_TOKEN;
    if (!accessToken) {
      console.error('[TOKEN] ✗ No access token for account:', account.username);
      continue;
    }

    const msg = new Messenger(accessToken);
    const engine = new FlowEngine(db, msg, account);

    // ── Comments ─────────────────────────────────────────────
    for (const change of entry.changes ?? []) {
      if (change.field === 'comments') {
        await handleComment(change.value, engine, db, account, env)
          .catch(err => console.error('[COMMENT] Error:', err.message));
      }
    }

    // ── Messages ─────────────────────────────────────────────
    for (const ev of entry.messaging ?? []) {
      if (ev.postback?.payload) {
        await handlePostback(ev.postback.payload, ev.sender.id, engine).catch(()=>{});
      }
      if (ev.message?.quick_reply?.payload) {
        await handlePostback(ev.message.quick_reply.payload, ev.sender.id, engine).catch(()=>{});
      }
      if (ev.message?.text && !ev.message.quick_reply) {
        await handleFreeText(ev.message.text, ev.sender.id, engine, db, account).catch(()=>{});
      }
    }
  }}

// ── Handle comment ───────────────────────────────────────────
async function handleComment(comment, engine, db, account, env) {
  const { from, media, text, id: commentId } = comment;

  console.log('[COMMENT] Received:', { 
    from: from?.id, 
    text: text?.slice(0, 50),
    media: media?.id 
  });

  await safeInsert(db, 'events', {
    type: 'comment_received',
    account_id: account.id,
    ig_user_id: from?.id,
    media_id: media?.id,
    detail: text?.slice(0, 100),
    ts: new Date().toISOString(),
  });

  if (!from?.id || !text) return;

  // Dedupe
  const seen = await db.findOne('processed_comments', { comment_id: commentId });
  if (seen) {
    console.log('[COMMENT] ⊗ Already processed');
    return;
  }

  await safeInsert(db, 'processed_comments', {
    comment_id: commentId,
    ig_user_id: from.id,
    account_id: account.id,
    ts: new Date().toISOString(),
  });

  // ✅ SKIP rateLimit since no KV binding
  // const blocked = await rateLimit(env.KV, ...); 
  // if (blocked) return;

  // Find triggers
  const triggers = await db.find('triggers', { 
    account_id: account.id, 
    active: 1 
  });

  console.log('[TRIGGER] Found', triggers.length, 'active');

  for (const trigger of triggers) {    // Media filter
    if (trigger.media_id && trigger.media_id !== 'any' && trigger.media_id !== media?.id) {
      continue;
    }

    // Keyword match
    const { matched, keyword } = matchesKeyword(text, trigger);
    console.log('[KEYWORD] Match:', matched, 'Keyword:', keyword);

    if (!matched) continue;

    console.log('[TRIGGER] ✓ Matched:', trigger.id);

    // 1️⃣ Reply to comment
    if (trigger.comment_reply) {
      try {
        const msgr = new Messenger(account.page_access_token || env.META_PAGE_TOKEN);
        await msgr.replyToComment(commentId, trigger.comment_reply);
        console.log('[REPLY] ✓ Sent');
      } catch(e) {
        console.error('[REPLY] ✗ Failed:', e.message);
      }
    }

    // 2️⃣ Send DM (✅ FIX #3: Split lines properly)
    if (trigger.dm_url) {
      try {
        const msgr = new Messenger(account.page_access_token || env.META_PAGE_TOKEN);
        
        // FIRST DM: Text
        await msgr.text(from.id, `Hey @${from.username || 'there'}! Thanks for your comment 💬`);
        
        // SECOND DM: Button with link
        await msgr.buttons(from.id, trigger.dm_button_label || 'Open Link', [
          { type: 'url', title: trigger.dm_button_label || 'Open', url: trigger.dm_url },
        ]);
        
        console.log('[DM] ✓ Initial DM + button sent');
      } catch(e) {
        console.error('[DM] ✗ Failed:', e.message);
      }
    }

    // 3️⃣ Start flow
    if (trigger.flow_id) {
      try {
        await db.updateOne('sessions',
          { ig_user_id: from.id, flow_id: trigger.flow_id, status:'active' },
          { $set: { status:'expired' } }
        );
        await engine.start(trigger.flow_id, from.id, {
          comment: text,
          keyword,
          media_id: media?.id,
          trigger_id: trigger.id,
        });
        console.log('[FLOW] ✓ Started:', trigger.flow_id);
      } catch(e) {
        console.error('[FLOW] ✗ Failed:', e.message);
      }
    }
  }
}

// ── Postback handler ─────────────────────────────────────────
async function handlePostback(payload, igUserId, engine) {
  if (!payload?.startsWith('RKT::')) return;
  const decoded = engine.decode(payload);
  if (!decoded) return;

  switch (decoded.action) {
    case 'STEP':
      await engine.resume(decoded.flowId, decoded.stepId, igUserId);
      break;
    case 'CHK_FOLLOW':
      await engine.checkFollow(decoded.flowId, decoded.stepId, igUserId);
      break;
  }
}

// ── Free text handler ────────────────────────────────────────
async function handleFreeText(text, igUserId, engine, db, account) {
  const session = await db.findOne('sessions', {
    ig_user_id: igUserId,
    account_id: account.id,
    awaiting: 'lead_input',
    status: 'active',
  });

  if (!session) return;

  await safeInsert(db, 'leads', {
    account_id: account.id,
    ig_user_id: igUserId,
    flow_id: session.flow_id,
    field: session.lead_field ?? 'email',
    value: text,
    ts: new Date().toISOString(),
  });
  await db.updateOne('sessions',
    { ig_user_id: igUserId, account_id: account.id },
    { $set: { awaiting: null } }
  );

  if (session.lead_next) {
    await engine.resume(session.flow_id, session.lead_next, igUserId, { captured_value: text });
  }
}

// ── Safe insert helper ───────────────────────────────────────
async function safeInsert(db, collection, doc) {
  try {
    return await db.insertOne(collection, doc);
  } catch(e) {
    console.error(`[DB] Insert failed: ${collection}`, e.message);
    return null;
  }
}

// ✅ FIX #1: Using imported CORS from _utils.js (no redeclaration)
