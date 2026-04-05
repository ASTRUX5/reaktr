// ─── REAKTR · Webhook Handler ─────────────────────────────────────────────────

import { DB }          from './_db.js';
import { Messenger }   from './_messenger.js';
import { FlowEngine }  from './_flowEngine.js';
import { verifySignature, matchesKeyword, rateLimit, CORS } from './_utils.js';

// ── GET — Meta webhook verification ──────────────────────────
export async function onRequestGet({ request, env }) {
  const url       = new URL(request.url);
  const mode      = url.searchParams.get('hub.mode');
  const token     = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// ── POST — Incoming Meta events ───────────────────────────────
export async function onRequestPost({ request, env, waitUntil }) {
  const rawBody = await request.text();
  const sig     = request.headers.get('X-Hub-Signature-256') ?? '';

  if (env.ENVIRONMENT !== 'development') {
    const valid = await verifySignature(rawBody, sig, env.META_APP_SECRET);
    if (!valid) return new Response('Invalid signature', { status: 401 });
  }

  const body = JSON.parse(rawBody);
  waitUntil(processEvent(body, env));
  return new Response('OK', { status: 200, headers: CORS });
}

// ── Main processor ────────────────────────────────────────────
async function processEvent(body, env) {
  if (body.object !== 'instagram') return;

  let db;
  try {
    db = new DB(env);
    await db.init();
  } catch(e) {
    console.error('[DB Init]', e.message);
    return;
  }

  for (const entry of body.entry ?? []) {
    // ── Find account — try ig_id first, then page_id ──────────
    let account = await db.findOne('accounts', { ig_id: entry.id });
    if (!account) account = await db.findOne('accounts', { page_id: entry.id });
    if (!account) {
      // Log raw entry.id for debugging
      await db.insertOne('events', {
        type:'webhook_no_account', detail: `entry.id=${entry.id}`,
        ts: new Date().toISOString(),
      }).catch(()=>{});
      continue;
    }

    const msg    = new Messenger(account.page_access_token);
    const engine = new FlowEngine(db, msg, account);

    // ── Comment events ─────────────────────────────────────────
    for (const change of entry.changes ?? []) {
      if (change.field === 'comments') {
        await handleComment(change.value, engine, db, account, env).catch(async e => {
          await db.insertOne('events', {
            type:'error', detail:`handleComment: ${e.message}`,
            account_id: account.id, ts: new Date().toISOString(),
          }).catch(()=>{});
        });
      }
    }

    // ── Message events (postbacks, quick replies, free text) ───
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

// ── Handle comment ─────────────────────────────────────────────
async function handleComment(comment, engine, db, account, env) {
  const { from, media, text, id: commentId } = comment;

  // Log everything received for debugging
  await db.insertOne('events', {
    type      : 'comment_received',
    account_id: account.id,
    ig_user_id: from?.id,
    media_id  : media?.id,
    detail    : text?.slice(0,100),
    ts        : new Date().toISOString(),
  });

  if (!from?.id || !text) return;

  // Duplicate filter
  const seen = await db.findOne('processed_comments', { comment_id: commentId });
  if (seen) return;
  await db.insertOne('processed_comments', {
    comment_id: commentId,
    ig_user_id: from.id,
    account_id: account.id,
    ts        : new Date().toISOString(),
  });

  // Rate limit
  const blocked = await rateLimit(env.KV, `rl:${account.id}:${from.id}`, 20);
  if (blocked) return;

  // Find active triggers for this account
  const triggers = await db.find('triggers', { account_id: account.id, active: 1 });

  await db.insertOne('events', {
    type:'triggers_checked', account_id:account.id,
    detail:`found ${triggers.length} triggers for account ${account.id}`,
    ts: new Date().toISOString(),
  });

  for (const trigger of triggers) {
    // Media filter
    if (trigger.media_id && trigger.media_id !== 'any' && trigger.media_id !== media?.id) continue;

    const { matched, keyword } = matchesKeyword(text, trigger);

    await db.insertOne('events', {
      type:'keyword_check', account_id:account.id,
      detail:`comment="${text}" keywords=${JSON.stringify(trigger.keywords)} matched=${matched}`,
      ts: new Date().toISOString(),
    });

    if (!matched) continue;

    // Public comment reply
    if (trigger.comment_reply) {
      const msgr = new Messenger(account.page_access_token);
      await msgr.replyToComment(commentId, trigger.comment_reply).catch(e => {
        console.error('[Comment Reply Error]', e.message);
      });
    }

    // ── Option A: trigger has a direct dm_url — send link button directly ──
    if (trigger.dm_url) {
      const msgr = new Messenger(account.page_access_token);
      try {
        await msgr.text(from.id, `Hey! Thanks for your comment. Here's what you asked for:`);
        await msgr.buttons(from.id, trigger.dm_button_label || 'Click below to access:', [
          { type: 'url', title: (trigger.dm_button_label || 'Open Link').slice(0,20), url: trigger.dm_url },
        ]);
        await db.insertOne('events', {
          type:'dm_sent', account_id:account.id, ig_user_id:from.id,
          trigger_id:trigger.id, detail:`dm_url direct send`, ts:new Date().toISOString(),
        });
      } catch(e) {
        await db.insertOne('events', {
          type:'dm_error', account_id:account.id, ig_user_id:from.id,
          detail:`dm_url send failed: ${e.message}`, ts:new Date().toISOString(),
        });
      }
    }

    // ── Option B: trigger has a flow — run the flow ─────────────
    if (trigger.flow_id) {
      // Clear any stuck active session so it can restart
      await db.updateOne('sessions',
        { ig_user_id: from.id, flow_id: trigger.flow_id, status:'active' },
        { $set: { status:'expired' } }
      );

      try {
        await engine.start(trigger.flow_id, from.id, {
          comment   : text,
          keyword,
          media_id  : media?.id,
          trigger_id: trigger.id,
        });
        await db.insertOne('events', {
          type:'trigger_fired', account_id:account.id, ig_user_id:from.id,
          flow_id:trigger.flow_id, trigger_id:trigger.id, keyword,
          media_id:media?.id, ts:new Date().toISOString(),
        });
      } catch(e) {
        await db.insertOne('events', {
          type:'flow_error', account_id:account.id, ig_user_id:from.id,
          detail:`flow start failed: ${e.message}`, ts:new Date().toISOString(),
        });
      }
    }
  }
}

// ── Handle postback ────────────────────────────────────────────
async function handlePostback(payload, igUserId, engine) {
  if (!payload?.startsWith('RKT::')) return;
  const decoded = engine.decode(payload);
  if (!decoded) return;
  switch (decoded.action) {
    case 'STEP':      await engine.resume(decoded.flowId, decoded.stepId, igUserId); break;
    case 'CHK_FOLLOW':await engine.checkFollow(decoded.flowId, decoded.stepId, igUserId); break;
  }
}

// ── Handle free text (lead capture) ───────────────────────────
async function handleFreeText(text, igUserId, engine, db, account) {
  const session = await db.findOne('sessions', {
    ig_user_id: igUserId,
    account_id: account.id,
    awaiting  : 'lead_input',
    status    : 'active',
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
  await db.insertOne('events', {
    type:'lead_captured', account_id:account.id, ig_user_id:igUserId,
    field:session.lead_field??'email', ts:new Date().toISOString(),
  });
  if (session.lead_next) {
    await engine.resume(session.flow_id, session.lead_next, igUserId, { captured_value: text });
  }
}
