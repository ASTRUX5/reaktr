// ─── REAKTR · functions/webhook.js (MINIMAL - Syntax Verified) ───────────────

import { DB }          from './_db.js';
import { Messenger }   from './_messenger.js';
import { FlowEngine }  from './_flowEngine.js';
import { verifySignature, matchesKeyword, CORS } from './_utils.js';

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  const url = new URL(request.url);

  // 🔐 GET: Meta verification
  if (request.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403, headers: { 'Content-Type': 'text/plain' } });
  }

  // 📩 POST: Webhook events
  if (request.method === 'POST') {
    // Clone to preserve body stream
    const rawBody = await request.clone().text();
    const sig = request.headers.get('X-Hub-Signature-256') ?? '';

    console.log('[WEBHOOK] POST received');

    // 🔐 TEMP: Skip signature check for debugging (set to true to re-enable)
    const SKIP_SIGNATURE = true;
    
    if (!SKIP_SIGNATURE && env.ENVIRONMENT !== 'development' && env.META_APP_SECRET) {
      try {
        const valid = await verifySignature(rawBody, sig, env.META_APP_SECRET);
        if (!valid) {
          return new Response('Invalid signature', { status: 401 });
        }
      } catch (e) {
        console.error('[WEBHOOK] Signature check error:', e.message);
        return new Response('Signature error', { status: 500 });
      }
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {      console.error('[WEBHOOK] JSON parse error:', e.message);
      return new Response('Invalid JSON', { status: 400 });
    }

    console.log('[WEBHOOK] Object:', body.object);

    // Process async (don't block response)
    waitUntil(processEvent(body, env).catch(err => {
      console.error('[WEBHOOK] processEvent error:', err.message);
    }));

    return new Response('OK', { status: 200, headers: { ...CORS, 'Content-Type': 'text/plain' } });
  }

  return new Response('Method Not Allowed', { status: 405 });
}

// ── Main event processor ─────────────────────────────────────
async function processEvent(body, env) {
  if (body.object !== 'instagram') return;

  let db;
  try {
    db = new DB(env);
    await db.init();
  } catch (e) {
    console.error('[DB] Init failed:', e.message);
    return;
  }

  for (const entry of body.entry ?? []) {
    console.log('[ENTRY] ID:', entry.id);

    // Find account
    let account = await db.findOne('accounts', {
      $or: [
        { ig_id: entry.id },
        { page_id: entry.id },
        { instagram_id: entry.id }
      ]
    });

    if (!account) {
      console.error('[ACCOUNT] Not found:', entry.id);
      continue;
    }

    console.log('[ACCOUNT] Found:', account.username);

    // Get access token with fallback    const accessToken = account.page_access_token || env.META_PAGE_TOKEN;
    if (!accessToken) {
      console.error('[TOKEN] Missing for account:', account.username);
      continue;
    }

    const msg = new Messenger(accessToken);
    const engine = new FlowEngine(db, msg, account);

    // Handle comments
    for (const change of entry.changes ?? []) {
      if (change.field === 'comments') {
        await handleComment(change.value, engine, db, account, env).catch(e => {
          console.error('[COMMENT] Error:', e.message);
        });
      }
    }

    // Handle messages
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
  }
}

// ── Handle comment ───────────────────────────────────────────
async function handleComment(comment, engine, db, account, env) {
  const { from, media, text, id: commentId } = comment;

  console.log('[COMMENT] From:', from?.id, 'Text:', text?.slice(0, 30));

  // Log event
  try {
    await db.insertOne('events', {
      type: 'comment_received',
      account_id: account.id,
      ig_user_id: from?.id,
      media_id: media?.id,
      detail: text?.slice(0, 100),
      ts: new Date().toISOString(),
    });
  } catch (e) { console.error('[DB] Event insert failed:', e.message); }
  if (!from?.id || !text) return;

  // Dedupe check
  const seen = await db.findOne('processed_comments', { comment_id: commentId });
  if (seen) return;

  try {
    await db.insertOne('processed_comments', {
      comment_id: commentId,
      ig_user_id: from.id,
      account_id: account.id,
      ts: new Date().toISOString(),
    });
  } catch (e) { console.error('[DB] Dedupe insert failed:', e.message); }

  // Skip rateLimit (no KV binding)
  // const blocked = await rateLimit(env.KV, ...); if (blocked) return;

  // Find triggers
  const triggers = await db.find('triggers', { account_id: account.id, active: 1 });
  console.log('[TRIGGER] Found:', triggers.length);

  for (const trigger of triggers) {
    // Media filter
    if (trigger.media_id && trigger.media_id !== 'any' && trigger.media_id !== media?.id) continue;

    // Keyword match
    const { matched } = matchesKeyword(text, trigger);
    if (!matched) continue;

    console.log('[TRIGGER] Matched:', trigger.id);

    // 1️⃣ Reply to comment
    if (trigger.comment_reply) {
      try {
        const msgr = new Messenger(account.page_access_token || env.META_PAGE_TOKEN);
        await msgr.replyToComment(commentId, trigger.comment_reply);
        console.log('[REPLY] Sent');
      } catch (e) { console.error('[REPLY] Failed:', e.message); }
    }

    // 2️⃣ Send DM ✅ Properly split lines
    if (trigger.dm_url) {
      try {
        const msgr = new Messenger(account.page_access_token || env.META_PAGE_TOKEN);
        
        // First DM: Text
        await msgr.text(from.id, `Hey @${from.username || 'there'}! Thanks for your comment 💬`);
                // Second DM: Button
        await msgr.buttons(from.id, trigger.dm_button_label || 'Open Link', [
          { type: 'url', title: trigger.dm_button_label || 'Open', url: trigger.dm_url },
        ]);
        
        console.log('[DM] Sent initial + button');
      } catch (e) { console.error('[DM] Failed:', e.message); }
    }

    // 3️⃣ Start flow
    if (trigger.flow_id) {
      try {
        await db.updateOne('sessions',
          { ig_user_id: from.id, flow_id: trigger.flow_id, status: 'active' },
          { $set: { status: 'expired' } }
        );
        await engine.start(trigger.flow_id, from.id, {
          comment: text,
          media_id: media?.id,
          trigger_id: trigger.id,
        });
        console.log('[FLOW] Started:', trigger.flow_id);
      } catch (e) { console.error('[FLOW] Failed:', e.message); }
    }
  }
}

// ── Postback handler ─────────────────────────────────────────
async function handlePostback(payload, igUserId, engine) {
  if (!payload?.startsWith('RKT::')) return;
  const decoded = engine.decode(payload);
  if (!decoded) return;

  if (decoded.action === 'STEP') {
    await engine.resume(decoded.flowId, decoded.stepId, igUserId);
  } else if (decoded.action === 'CHK_FOLLOW') {
    await engine.checkFollow(decoded.flowId, decoded.stepId, igUserId);
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
  try {
    await db.insertOne('leads', {
      account_id: account.id,
      ig_user_id: igUserId,
      flow_id: session.flow_id,
      field: session.lead_field ?? 'email',
      value: text,
      ts: new Date().toISOString(),
    });
  } catch (e) { console.error('[DB] Lead insert failed:', e.message); }

  await db.updateOne('sessions',
    { ig_user_id: igUserId, account_id: account.id },
    { $set: { awaiting: null } }
  );

  if (session.lead_next) {
    await engine.resume(session.flow_id, session.lead_next, igUserId, { captured_value: text });
  }
}
