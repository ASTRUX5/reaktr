// ─── REAKTR · Webhook Handler (/webhook) ─────────────────────────────────────
// Handles GET  /webhook → Meta verification challenge
// Handles POST /webhook → Incoming comment & message events

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

// ── POST — Incoming events ────────────────────────────────────
export async function onRequestPost({ request, env, waitUntil }) {
  // Read body as text first (needed for signature check)
  const rawBody  = await request.text();
  const sig      = request.headers.get('X-Hub-Signature-256') ?? '';

  // Verify Meta signature (skip in dev)
  if (env.ENVIRONMENT !== 'development') {
    const valid = await verifySignature(rawBody, sig, env.META_APP_SECRET);
    if (!valid) return new Response('Invalid signature', { status: 401 });
  }

  const body = JSON.parse(rawBody);

  // Respond 200 to Meta immediately, process async
  waitUntil(processEvent(body, env));
  return new Response('OK', { status: 200, headers: CORS });
}

// ── Main event processor ──────────────────────────────────────
async function processEvent(body, env) {
  if (body.object !== 'instagram') return;

  const db = new DB(env);

  for (const entry of body.entry ?? []) {
    // Look up the connected account by Instagram Business Account ID
    const account = await db.findOne('accounts', { ig_id: entry.id });
    if (!account) continue;

    const msg    = new Messenger(account.page_access_token);
    const engine = new FlowEngine(db, msg, account);

    // ── Comment events (trigger DMs) ──────────────────────────
    for (const change of entry.changes ?? []) {
      if (change.field === 'comments') {
        await handleComment(change.value, engine, db, account, env);
      }
    }

    // ── Message events (postback & text replies) ───────────────
    for (const ev of entry.messaging ?? []) {
      if (ev.postback)               await handlePostback(ev.postback.payload, ev.sender.id, engine);
      if (ev.message?.quick_reply)   await handlePostback(ev.message.quick_reply.payload, ev.sender.id, engine);
      if (ev.message?.text && !ev.message.quick_reply) {
        await handleFreeText(ev.message.text, ev.sender.id, engine, db, account);
      }
    }
  }
}

// ── Handle incoming comment ────────────────────────────────────
async function handleComment(comment, engine, db, account, env) {
  const { from, media, text, id: commentId } = comment;
  if (!from?.id || !text) return;

  // Duplicate filter
  const seen = await db.findOne('processed_comments', { comment_id: commentId });
  if (seen) return;
  await db.insertOne('processed_comments', {
    comment_id: commentId,
    ig_user_id: from.id,
    account_id: account._id,
  });

  // Rate limit per user (prevent abuse)
  const blocked = await rateLimit(env.KV, `rl:${account._id}:${from.id}`, 20);
  if (blocked) return;

  // Find matching triggers
  const triggers = await db.find('triggers', {
    account_id: account._id,
    active    : true,
  });

  for (const trigger of triggers) {
    // Media filter — trigger can be 'any' or specific media_id
    if (trigger.media_id && trigger.media_id !== 'any' && trigger.media_id !== media?.id) continue;

    const { matched, keyword } = matchesKeyword(text, trigger);
    if (!matched) continue;

    // Optional: reply to comment publicly
    if (trigger.comment_reply) {
      const msg = new Messenger(account.page_access_token);
      await msg.replyToComment(commentId, trigger.comment_reply).catch(() => {});
    }

    // Fire the flow
    await engine.start(trigger.flow_id, from.id, {
      comment    : text,
      keyword,
      media_id   : media?.id,
      trigger_id : trigger._id,
    });

    await db.insertOne('events', {
      type      : 'trigger_fired',
      account_id: account._id,
      trigger_id: trigger._id,
      flow_id   : trigger.flow_id,
      ig_user_id: from.id,
      keyword,
      media_id  : media?.id,
      ts        : new Date().toISOString(),
    });
  }
}

// ── Handle postback (button click) ────────────────────────────
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

// ── Handle free text (lead capture input) ─────────────────────
async function handleFreeText(text, igUserId, engine, db, account) {
  // Check if user is awaiting lead input
  const session = await db.findOne('sessions', {
    ig_user_id: igUserId,
    account_id: account._id,
    awaiting  : 'lead_input',
    status    : 'active',
  });

  if (!session) return;

  // Store the captured lead
  await db.insertOne('leads', {
    account_id: account._id,
    ig_user_id: igUserId,
    flow_id   : session.flow_id,
    field     : session.lead_field ?? 'email',
    value     : text,
    ts        : new Date().toISOString(),
  });

  // Clear awaiting state
  await db.updateOne('sessions',
    { ig_user_id: igUserId, account_id: account._id },
    { $set: { awaiting: null } }
  );

  await db.insertOne('events', {
    type      : 'lead_captured',
    account_id: account._id,
    ig_user_id: igUserId,
    field     : session.lead_field ?? 'email',
    ts        : new Date().toISOString(),
  });

  // Continue flow to next step
  if (session.lead_next) {
    await engine.resume(session.flow_id, session.lead_next, igUserId, {
      captured_value: text,
    });
  }
}
