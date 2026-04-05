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
    console.log('WEBHOOK VERIFIED');
    return new Response(challenge, { status: 200 });
  }

  console.error('WEBHOOK VERIFY FAILED');
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

  console.log('WEBHOOK BODY:', JSON.stringify(body, null, 2));

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

    console.log('ENTRY ID:', entry.id);

    // 🔥 FIXED ACCOUNT MATCH
    let account = await db.findOne('accounts', {
      $or: [
        { ig_id: entry.id },
        { page_id: entry.id }
      ]
    });

    if (!account) {
      console.error('NO ACCOUNT FOUND FOR:', entry.id);

      await db.insertOne('events', {
        type:'webhook_no_account',
        detail: `entry.id=${entry.id}`,
        ts: new Date().toISOString(),
      }).catch(()=>{});

      continue;
    }

    console.log('ACCOUNT FOUND:', account.username);

    const msg    = new Messenger(account.page_access_token);
    const engine = new FlowEngine(db, msg, account);

    // ── Comment events ─────────────────────────────────────────
    for (const change of entry.changes ?? []) {
      if (change.field === 'comments') {
        await handleComment(change.value, engine, db, account, env).catch(async e => {
          console.error('handleComment ERROR:', e.message);

          await db.insertOne('events', {
            type:'error',
            detail:`handleComment: ${e.message}`,
            account_id: account.id,
            ts: new Date().toISOString(),
          }).catch(()=>{});
        });
      }
    }

    // ── Message events ─────────────────────────────────────────
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

  console.log('COMMENT RECEIVED:', text);

  await db.insertOne('events', {
    type      : 'comment_received',
    account_id: account.id,
    ig_user_id: from?.id,
    media_id  : media?.id,
    detail    : text?.slice(0,100),
    ts        : new Date().toISOString(),
  });

  if (!from?.id || !text) return;

  const seen = await db.findOne('processed_comments', { comment_id: commentId });
  if (seen) return;

  await db.insertOne('processed_comments', {
    comment_id: commentId,
    ig_user_id: from.id,
    account_id: account.id,
    ts        : new Date().toISOString(),
  });

  const blocked = await rateLimit(env.KV, `rl:${account.id}:${from.id}`, 20);
  if (blocked) return;

  const triggers = await db.find('triggers', { account_id: account.id, active: 1 });

  console.log('TRIGGERS FOUND:', triggers.length);

  for (const trigger of triggers) {

    if (trigger.media_id && trigger.media_id !== 'any' && trigger.media_id !== media?.id) continue;

    const { matched, keyword } = matchesKeyword(text, trigger);

    console.log('KEYWORD MATCH:', matched, 'TEXT:', text);

    if (!matched) continue;

    // Comment reply
    if (trigger.comment_reply) {
      const msgr = new Messenger(account.page_access_token);
      await msgr.replyToComment(commentId, trigger.comment_reply).catch(()=>{});
    }

    // Direct DM
    if (trigger.dm_url) {
      const msgr = new Messenger(account.page_access_token);
      await msgr.text(from.id, `Hey! Thanks for your comment.`);
      await msgr.buttons(from.id, trigger.dm_button_label || 'Open:', [
        { type: 'url', title: 'Open Link', url: trigger.dm_url },
      ]);
    }

    // Flow
    if (trigger.flow_id) {
      await db.updateOne('sessions',
        { ig_user_id: from.id, flow_id: trigger.flow_id, status:'active' },
        { $set: { status:'expired' } }
      );

      await engine.start(trigger.flow_id, from.id, {
        comment   : text,
        keyword,
        media_id  : media?.id,
        trigger_id: trigger.id,
      });
    }
  }
}

// ── Postback ────────────────────────────────────────────
async function handlePostback(payload, igUserId, engine) {
  if (!payload?.startsWith('RKT::')) return;
  const decoded = engine.decode(payload);
  if (!decoded) return;

  switch (decoded.action) {
    case 'STEP':       await engine.resume(decoded.flowId, decoded.stepId, igUserId); break;
    case 'CHK_FOLLOW': await engine.checkFollow(decoded.flowId, decoded.stepId, igUserId); break;
  }
}

// ── Free text ───────────────────────────────────────────
async function handleFreeText(text, igUserId, engine, db, account) {
  const session = await db.findOne('sessions', {
    ig_user_id: igUserId,
    account_id: account.id,
    awaiting  : 'lead_input',
    status    : 'active',
  });

  if (!session) return;

  await db.insertOne('leads', {
    account_id: account.id,
    ig_user_id: igUserId,
    flow_id   : session.flow_id,
    field     : session.lead_field ?? 'email',
    value     : text,
    ts        : new Date().toISOString(),
  });

  await db.updateOne('sessions',
    { ig_user_id: igUserId, account_id: account.id },
    { $set: { awaiting: null } }
  );

  if (session.lead_next) {
    await engine.resume(session.flow_id, session.lead_next, igUserId, { captured_value: text });
  }
}
