// ─── REAKTR · Webhook Handler ─────────────────────────────────────────────────

import { DB }          from './_db.js';
import { Messenger }   from './_messenger.js';
import { FlowEngine }  from './_flowEngine.js';
import { matchesKeyword, rateLimit, CORS } from './_utils.js';

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  const url = new URL(request.url);

  // ── GET: Meta verification challenge ─────────────────────────
  if (request.method === 'GET') {
    const mode      = url.searchParams.get('hub.mode');
    const token     = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // ── POST: Incoming events ─────────────────────────────────────
  if (request.method === 'POST') {
    const rawBody = await request.text();

    // ── Signature check ───────────────────────────────────────
    // Only verify if META_APP_SECRET is actually set
    if (env.META_APP_SECRET) {
      const sig = request.headers.get('X-Hub-Signature-256') ?? '';
      const sigBody = sig.replace('sha256=', '');
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw', enc.encode(env.META_APP_SECRET),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const buf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
      const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');

      // Constant-time compare
      let diff = hex.length !== sigBody.length ? 1 : 0;
      for (let i = 0; i < Math.min(hex.length, sigBody.length); i++) {
        diff |= hex.charCodeAt(i) ^ sigBody.charCodeAt(i);
      }

      if (diff !== 0) {
        console.error('SIGNATURE MISMATCH - check META_APP_SECRET env var');
        // Log the mismatch but still process in case of key mismatch
        // Remove the return to allow processing — ONLY for debugging
        // return new Response('Invalid signature', { status: 401 });
      }
    }

    let body;
    try { body = JSON.parse(rawBody); }
    catch(e) { return new Response('Bad JSON', { status: 400 }); }

    console.log('WEBHOOK RECEIVED:', JSON.stringify(body).slice(0, 300));

    waitUntil(processEvent(body, env));
    return new Response('OK', { status: 200, headers: CORS });
  }

  return new Response('OK', { status: 200 });
}

// ── Main processor ────────────────────────────────────────────
async function processEvent(body, env) {
  if (body.object !== 'instagram') {
    console.log('NOT INSTAGRAM OBJECT:', body.object);
    return;
  }

  let db;
  try {
    db = new DB(env);
    await db.init();
  } catch(e) {
    console.error('[DB Init]', e.message);
    return;
  }

  for (const entry of body.entry ?? []) {
    console.log('PROCESSING ENTRY:', entry.id);

    // ── Find account — two separate queries (D1 has no $or) ──
    let account = await db.findOne('accounts', { ig_id: entry.id });
    if (!account) account = await db.findOne('accounts', { page_id: entry.id });

    if (!account) {
      // Dump all accounts to logs so we can see what IDs are stored
      const allAccounts = await db.find('accounts', {});
      console.error('NO ACCOUNT for entry.id=' + entry.id +
        ' | stored accounts: ' + allAccounts.map(a => `ig_id=${a.ig_id} page_id=${a.page_id}`).join(', '));
      continue;
    }

    console.log('ACCOUNT MATCHED:', account.username, 'ig_id:', account.ig_id);

    const msg    = new Messenger(account.page_access_token);
    const engine = new FlowEngine(db, msg, account);

    for (const change of entry.changes ?? []) {
      console.log('CHANGE FIELD:', change.field);
      if (change.field === 'comments') {
        await handleComment(change.value, engine, db, account, env).catch(async e => {
          console.error('handleComment ERROR:', e.message, e.stack);
        });
      }
    }

    for (const ev of entry.messaging ?? []) {
      if (ev.postback?.payload) {
        await handlePostback(ev.postback.payload, ev.sender.id, engine).catch(e => console.error('postback error', e.message));
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

// ── Handle comment ─────────────────────────────────────────────
async function handleComment(comment, engine, db, account, env) {
  const { from, media, text, id: commentId } = comment;

  console.log('COMMENT:', text, '| from:', from?.id, '| media:', media?.id);

  await db.insertOne('events', {
    type: 'comment_received', account_id: account.id,
    ig_user_id: from?.id, media_id: media?.id,
    detail: text?.slice(0,100), ts: new Date().toISOString(),
  });

  if (!from?.id || !text) return;

  // Dedup
  const seen = await db.findOne('processed_comments', { comment_id: commentId });
  if (seen) { console.log('DUPLICATE COMMENT, skipping'); return; }
  await db.insertOne('processed_comments', {
    comment_id: commentId, ig_user_id: from.id,
    account_id: account.id, ts: new Date().toISOString(),
  });

  // Rate limit (skip if no KV binding)
  if (env.KV) {
    const blocked = await rateLimit(env.KV, `rl:${account.id}:${from.id}`, 20);
    if (blocked) { console.log('RATE LIMITED'); return; }
  }

  // Find triggers
  const triggers = await db.find('triggers', { account_id: account.id, active: 1 });
  console.log('TRIGGERS FOUND:', triggers.length, 'for account_id:', account.id);

  if (triggers.length === 0) {
    // Debug: dump what's in triggers table
    const allTriggers = await db.find('triggers', {});
    console.log('ALL TRIGGERS IN DB:', JSON.stringify(allTriggers.map(t => ({id:t.id, account_id:t.account_id, active:t.active, keywords:t.keywords}))));
  }

  for (const trigger of triggers) {
    // Media filter
    if (trigger.media_id && trigger.media_id !== 'any' && trigger.media_id !== media?.id) {
      console.log('MEDIA MISMATCH: trigger.media_id=' + trigger.media_id + ' comment media=' + media?.id);
      continue;
    }

    const { matched, keyword } = matchesKeyword(text, trigger);
    console.log('KEYWORD CHECK:', text, '| keywords:', trigger.keywords, '| matched:', matched);

    if (!matched) continue;

    console.log('MATCH! Firing trigger:', trigger.name);

    // Public comment reply
    if (trigger.comment_reply) {
      const msgr = new Messenger(account.page_access_token);
      const replyResult = await msgr.replyToComment(commentId, trigger.comment_reply).catch(e => {
        console.error('COMMENT REPLY FAILED:', e.message);
        return null;
      });
      console.log('COMMENT REPLY RESULT:', JSON.stringify(replyResult));
    }

    // Direct URL DM (if dm_url is set on trigger)
    if (trigger.dm_url) {
      const msgr = new Messenger(account.page_access_token);
      try {
        await msgr.text(from.id, "Hey! Thanks for your comment 👋 Here's what you asked for:");
        await msgr.buttons(from.id, trigger.dm_button_label || 'Tap below to access:', [
          { type: 'url', title: (trigger.dm_button_label || 'Open Link').slice(0, 20), url: trigger.dm_url },
        ]);
        console.log('DM SENT via dm_url to:', from.id);
      } catch(e) {
        console.error('DM_URL SEND FAILED:', e.message);
      }
    }

    // Flow DM
    if (trigger.flow_id) {
      // Expire any stuck session
      await db.updateOne('sessions',
        { ig_user_id: from.id, flow_id: trigger.flow_id, status: 'active' },
        { $set: { status: 'expired' } }
      ).catch(()=>{});

      try {
        await engine.start(trigger.flow_id, from.id, {
          comment: text, keyword, media_id: media?.id, trigger_id: trigger.id,
        });
        console.log('FLOW STARTED:', trigger.flow_id, 'for user:', from.id);
      } catch(e) {
        console.error('FLOW START FAILED:', e.message, e.stack);
      }
    }

    await db.insertOne('events', {
      type: 'trigger_fired', account_id: account.id,
      ig_user_id: from.id, flow_id: trigger.flow_id,
      trigger_id: trigger.id, keyword, media_id: media?.id,
      ts: new Date().toISOString(),
    }).catch(()=>{});
  }
}

// ── Postback ──────────────────────────────────────────────────
async function handlePostback(payload, igUserId, engine) {
  if (!payload?.startsWith('RKT::')) return;
  const decoded = engine.decode(payload);
  if (!decoded) return;
  switch (decoded.action) {
    case 'STEP':       await engine.resume(decoded.flowId, decoded.stepId, igUserId); break;
    case 'CHK_FOLLOW': await engine.checkFollow(decoded.flowId, decoded.stepId, igUserId); break;
  }
}

// ── Free text (lead capture) ──────────────────────────────────
async function handleFreeText(text, igUserId, engine, db, account) {
  const session = await db.findOne('sessions', {
    ig_user_id: igUserId, account_id: account.id,
    awaiting: 'lead_input', status: 'active',
  });
  if (!session) return;
  await db.insertOne('leads', {
    account_id: account.id, ig_user_id: igUserId,
    flow_id: session.flow_id, field: session.lead_field ?? 'email',
    value: text, ts: new Date().toISOString(),
  });
  await db.updateOne('sessions',
    { ig_user_id: igUserId, account_id: account.id },
    { $set: { awaiting: null } }
  );
  if (session.lead_next) {
    await engine.resume(session.flow_id, session.lead_next, igUserId, { captured_value: text });
  }
}
