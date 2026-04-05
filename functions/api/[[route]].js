// ─── REAKTR · Dashboard REST API (/api/*) ────────────────────────────────────
// Catch-all Pages Function — handles all /api/** routes

import { DB }        from '../_db.js';
import { Messenger } from '../_messenger.js';
import { ok, created, bad, unauth, notFound, serverErr, cors, authCheck, CORS } from '../_utils.js';

export async function onRequest({ request, env }) {
  const url    = new URL(request.url);
  const method = request.method;
  const path   = url.pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/';

  // Preflight
  if (method === 'OPTIONS') return cors();

  // ── Auth check (all routes except /auth) ─────────────────────
  if (!path.startsWith('/auth')) {
    if (!authCheck(request, env)) return unauth();
  }

  const db = new DB(env);

  try {
    // ══════════════════════════════════════════════════════════
    // AUTH / OAUTH
    // ══════════════════════════════════════════════════════════

    // GET /api/auth/url — build Meta OAuth URL
    if (path === '/auth/url' && method === 'GET') {
      const redirectUri = encodeURIComponent(`${url.origin}/api/auth/callback`);
      const scopes = [
        'instagram_basic',
        'instagram_manage_messages',
        'instagram_manage_comments',
        'instagram_manage_insights',
        'pages_read_engagement',
      ].join(',');
      const oauthUrl =
        `https://www.facebook.com/dialog/oauth?client_id=${env.META_APP_ID}` +
        `&redirect_uri=${redirectUri}&scope=${scopes}&response_type=code`;
      return ok({ url: oauthUrl });
    }

    // GET /api/auth/callback — exchange code for token, save account
    if (path === '/auth/callback' && method === 'GET') {
      const code        = url.searchParams.get('code');
      const redirectUri = `${url.origin}/api/auth/callback`;

      // Exchange code for short-lived user token
      const tokenRes = await fetch(
        `https://graph.facebook.com/v20.0/oauth/access_token` +
        `?client_id=${env.META_APP_ID}` +
        `&client_secret=${env.META_APP_SECRET}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&code=${code}`
      );
      const tokenData = await tokenRes.json();
      if (tokenData.error) throw new Error(tokenData.error.message);

      // Get long-lived token
      const longToken = await Messenger.refreshToken(
        tokenData.access_token, env.META_APP_ID, env.META_APP_SECRET
      );

      // Get user's pages
      const pagesRes  = await fetch(
        `https://graph.facebook.com/v20.0/me/accounts?access_token=${longToken}`
      );
      const pagesData = await pagesRes.json();

      const saved = [];
      for (const page of pagesData.data ?? []) {
        // Get connected IG account
        const igData = await Messenger.getIGAccount(page.id, page.access_token);
        const ig     = igData.instagram_business_account;
        if (!ig) continue;

        // Upsert account
        await db.updateOne('accounts',
          { ig_id: ig.id },
          {
            $set: {
              ig_id             : ig.id,
              username          : ig.username,
              name              : ig.name,
              profile_pic       : ig.profile_picture_url,
              page_id           : page.id,
              page_access_token : page.access_token,
              user_token        : longToken,
              active            : true,
              connected_at      : new Date().toISOString(),
            },
          },
          true  // upsert
        );
        saved.push(ig.username);
      }

      // Redirect to dashboard
      return Response.redirect(`${url.origin}/#/accounts?connected=${saved.join(',')}`, 302);
    }

    // ══════════════════════════════════════════════════════════
    // ACCOUNTS
    // ══════════════════════════════════════════════════════════

    if (path === '/accounts' && method === 'GET') {
      const accounts = await db.find('accounts', {}, { connected_at: -1 });
      // Hide sensitive tokens
      return ok(accounts.map(a => ({
        ...a, page_access_token: undefined, user_token: undefined,
      })));
    }

    if (path.match(/^\/accounts\/[^/]+$/) && method === 'DELETE') {
      const id = path.split('/')[2];
      await db.deleteOne('accounts', { _id: db.oid(id) });
      return ok({ deleted: true });
    }

    // ══════════════════════════════════════════════════════════
    // FLOWS
    // ══════════════════════════════════════════════════════════

    if (path === '/flows' && method === 'GET') {
      const accountId = url.searchParams.get('account_id');
      const filter = accountId ? { account_id: accountId } : {};
      return ok(await db.find('flows', filter, { _ts: -1 }));
    }

    if (path === '/flows' && method === 'POST') {
      const body   = await request.json();
      const result = await db.insertOne('flows', {
        ...body,
        active    : true,
        created_at: new Date().toISOString(),
      });
      return created({ id: result.insertedId });
    }

    if (path.match(/^\/flows\/[^/]+$/) && method === 'GET') {
      const id   = path.split('/')[2];
      const flow = await db.findOne('flows', { _id: db.oid(id) });
      return flow ? ok(flow) : notFound();
    }

    if (path.match(/^\/flows\/[^/]+$/) && method === 'PUT') {
      const id   = path.split('/')[2];
      const body = await request.json();
      await db.updateOne('flows', { _id: db.oid(id) }, { $set: body });
      return ok({ updated: true });
    }

    if (path.match(/^\/flows\/[^/]+$/) && method === 'DELETE') {
      const id = path.split('/')[2];
      await db.deleteOne('flows', { _id: db.oid(id) });
      return ok({ deleted: true });
    }

    // ══════════════════════════════════════════════════════════
    // TRIGGERS
    // ══════════════════════════════════════════════════════════

    if (path === '/triggers' && method === 'GET') {
      const accountId = url.searchParams.get('account_id');
      const filter = accountId ? { account_id: accountId } : {};
      return ok(await db.find('triggers', filter, { _ts: -1 }));
    }

    if (path === '/triggers' && method === 'POST') {
      const body   = await request.json();
      const result = await db.insertOne('triggers', {
        ...body,
        active    : true,
        created_at: new Date().toISOString(),
      });
      return created({ id: result.insertedId });
    }

    if (path.match(/^\/triggers\/[^/]+$/) && method === 'PUT') {
      const id   = path.split('/')[2];
      const body = await request.json();
      await db.updateOne('triggers', { _id: db.oid(id) }, { $set: body });
      return ok({ updated: true });
    }

    if (path.match(/^\/triggers\/[^/]+$/) && method === 'DELETE') {
      const id = path.split('/')[2];
      await db.deleteOne('triggers', { _id: db.oid(id) });
      return ok({ deleted: true });
    }

    // ══════════════════════════════════════════════════════════
    // ANALYTICS
    // ══════════════════════════════════════════════════════════

    if (path === '/analytics' && method === 'GET') {
      const accountId = url.searchParams.get('account_id');
      const filter = accountId ? { account_id: accountId } : {};

      const [
        triggersTotal,
        dmsSent,
        leadsTotal,
        followVerified,
        sessions,
        recentEvents,
        topTriggers,
      ] = await Promise.all([
        db.count('events',   { ...filter, type: 'trigger_fired' }),
        db.count('events',   { ...filter, type: 'step_executed' }),
        db.count('leads',    filter),
        db.count('events',   { ...filter, type: 'follow_verified' }),
        db.count('sessions', filter),
        db.find ('events',   filter, { ts: -1 }, 50),
        db.aggregate('events', [
          { $match: { ...filter, type: 'trigger_fired' } },
          { $group: { _id: '$trigger_id', count: { $sum: 1 } } },
          { $sort : { count: -1 } },
          { $limit: 5 },
        ]),
      ]);

      return ok({
        triggersTotal,
        dmsSent,
        leadsTotal,
        followVerified,
        sessions,
        recentEvents,
        topTriggers,
      });
    }

    // ══════════════════════════════════════════════════════════
    // LEADS
    // ══════════════════════════════════════════════════════════

    if (path === '/leads' && method === 'GET') {
      const accountId = url.searchParams.get('account_id');
      const filter = accountId ? { account_id: accountId } : {};
      return ok(await db.find('leads', filter, { ts: -1 }, 500));
    }

    // ══════════════════════════════════════════════════════════
    // BROADCAST
    // ══════════════════════════════════════════════════════════

    if (path === '/broadcast' && method === 'POST') {
      const { account_id, message, buttons, segment } = await request.json();

      const account = await db.findOne('accounts', { _id: db.oid(account_id) });
      if (!account) return notFound('Account not found');

      // Get unique user IDs from sessions
      const sessionFilter = { account_id: account_id };
      if (segment === 'leads') {
        const leads = await db.find('leads', { account_id: account_id });
        const userIds = [...new Set(leads.map(l => l.ig_user_id))];
        sessionFilter.ig_user_id = { $in: userIds };
      }

      const sessions = await db.find('sessions', sessionFilter);
      const userIds  = [...new Set(sessions.map(s => s.ig_user_id))];

      const msg = new Messenger(account.page_access_token);
      let sent = 0;

      for (const userId of userIds) {
        try {
          if (buttons?.length) {
            await msg.buttons(userId, message, buttons);
          } else {
            await msg.text(userId, message);
          }
          sent++;
          // Humanize: small delay between each broadcast message
          await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
        } catch (e) {
          console.error(`Broadcast failed for ${userId}:`, e.message);
        }
      }

      await db.insertOne('events', {
        type      : 'broadcast_sent',
        account_id: account_id,
        sent_count: sent,
        ts        : new Date().toISOString(),
      });

      return ok({ sent, total: userIds.length });
    }

    return notFound('Route not found');

  } catch (e) {
    console.error('[API Error]', e.message, e.stack);
    return serverErr(e.message);
  }
}
