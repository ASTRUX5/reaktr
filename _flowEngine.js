// ─── REAKTR · Flow Execution Engine ──────────────────────────────────────────
// Executes conversation flows step by step. Handles all step types:
// text, buttons, quick_replies, follow_gate, url_button, lead_capture, delay

export class FlowEngine {
  constructor(db, messenger, account) {
    this.db      = db;
    this.msg     = messenger;
    this.account = account;
  }

  // ── Payload codec ─────────────────────────────────────────────
  encode(action, flowId, stepId = '') {
    return `RKT::${action}::${flowId}::${stepId}`;
  }

  decode(payload) {
    if (!payload?.startsWith('RKT::')) return null;
    const [, action, flowId, stepId] = payload.split('::');
    return { action, flowId, stepId };
  }

  // ── Text interpolation ────────────────────────────────────────
  tpl(text, ctx) {
    return String(text || '')
      .replace(/\{\{username\}\}/g,   ctx.username    || 'there')
      .replace(/\{\{first_name\}\}/g, ctx.first_name  || 'there')
      .replace(/\{\{comment\}\}/g,    ctx.comment     || '')
      .replace(/\{\{keyword\}\}/g,    ctx.keyword     || '')
      .replace(/\{\{reel\}\}/g,       ctx.media_id    || '');
  }

  // ── Start a flow (called when a trigger fires) ────────────────
  async start(flowId, igUserId, triggerCtx = {}) {
    const flow = await this._loadFlow(flowId);
    if (!flow) return;

    // Dedup — don't restart if already in this flow
    const active = await this.db.findOne('sessions', {
      ig_user_id : igUserId,
      flow_id    : flowId,
      status     : 'active',
    });
    if (active) return;

    // New session
    await this.db.insertOne('sessions', {
      ig_user_id : igUserId,
      account_id : this.account._id,
      flow_id    : flowId,
      step_id    : flow.steps[0]?.id ?? null,
      context    : triggerCtx,
      status     : 'active',
      started_at : new Date().toISOString(),
    });

    await this._log('flow_started', { flowId, igUserId });

    if (flow.steps[0]) {
      await this._execStep(flow, flow.steps[0], igUserId, triggerCtx);
    }
  }

  // ── Resume flow from a postback ───────────────────────────────
  async resume(flowId, stepId, igUserId, extra = {}) {
    const flow = await this._loadFlow(flowId);
    if (!flow) return;

    const step = flow.steps.find(s => s.id === stepId);
    if (!step) return;

    const session = await this.db.findOne('sessions', {
      ig_user_id: igUserId, flow_id: flowId,
    });
    const ctx = { ...(session?.context ?? {}), ...extra };

    await this._execStep(flow, step, igUserId, ctx);
  }

  // ── Check follow and continue ─────────────────────────────────
  async checkFollow(flowId, nextStepId, igUserId) {
    const following = await this.msg.isFollower(igUserId, this.account.ig_id);
    if (following) {
      await this._log('follow_verified', { flowId, igUserId });
      await this.resume(flowId, nextStepId, igUserId, { verified_follower: true });
    } else {
      await this.msg.buttons(igUserId,
        "Hmm, we couldn't verify your follow yet.\nMake sure you've followed us, then tap check again! 👇",
        [
          { type: 'postback', title: "✅ Check Again", payload: this.encode('CHK_FOLLOW', flowId, nextStepId) },
          { type: 'url',      title: "👉 Follow Now",  url: `https://instagram.com/${this.account.username}` },
        ]
      );
    }
  }

  // ── Execute a single step ─────────────────────────────────────
  async _execStep(flow, step, igUserId, ctx) {
    // Optional step-level delay
    if (step.delay_ms > 0) {
      await new Promise(r => setTimeout(r, step.delay_ms));
    }

    const text = this.tpl(step.text, ctx);

    switch (step.type) {

      case 'text':
        await this.msg.text(igUserId, text);
        break;

      case 'buttons': {
        const btns = (step.buttons ?? []).map(b => {
          if (b.type === 'url') return b;
          return {
            type   : 'postback',
            title  : b.title,
            payload: this.encode('STEP', flow._id, b.next_step),
          };
        });
        await this.msg.buttons(igUserId, text, btns);
        break;
      }

      case 'quick_replies': {
        const replies = (step.replies ?? []).map(r => ({
          title  : r.title,
          payload: this.encode('STEP', flow._id, r.next_step),
        }));
        await this.msg.quickReplies(igUserId, text, replies);
        break;
      }

      case 'follow_gate':
        await this.msg.buttons(igUserId, text, [
          { type: 'postback', title: "✅ I'm Following",  payload: this.encode('CHK_FOLLOW', flow._id, step.next_step) },
          { type: 'url',      title: '👉 Visit Profile',  url: `https://instagram.com/${this.account.username}` },
        ]);
        break;

      case 'url_button':
        await this.msg.buttons(igUserId, text, [
          { type: 'url', title: step.button_label ?? 'Click Here ➜', url: step.url },
        ]);
        break;

      case 'lead_capture':
        await this.msg.quickReplies(igUserId, text, [
          { title: 'Skip ➜', payload: this.encode('STEP', flow._id, step.skip_step) },
        ]);
        // Flag session as waiting for user text input
        await this.db.updateOne('sessions',
          { ig_user_id: igUserId, flow_id: flow._id },
          { $set: { awaiting: 'lead_input', lead_next: step.next_step, lead_field: step.field ?? 'email' } }
        );
        break;

      case 'delay':
        // Pure delay step — auto-advance after ms
        await new Promise(r => setTimeout(r, step.ms ?? 2000));
        break;

      default:
        console.warn(`[FlowEngine] Unknown step type: ${step.type}`);
    }

    // Update session cursor
    await this.db.updateOne('sessions',
      { ig_user_id: igUserId, flow_id: flow._id },
      { $set: { step_id: step.id, last_active: new Date().toISOString() } }
    );

    await this._log('step_executed', {
      flowId    : flow._id,
      stepId    : step.id,
      stepType  : step.type,
      igUserId,
    });

    // Auto-advance for non-interactive steps
    const interactive = ['buttons', 'quick_replies', 'follow_gate', 'lead_capture'];
    if (step.next_step && !interactive.includes(step.type)) {
      const next = flow.steps.find(s => s.id === step.next_step);
      if (next) {
        setTimeout(() => this._execStep(flow, next, igUserId, ctx), 400);
      }
    }
  }

  // ── Internals ─────────────────────────────────────────────────
  async _loadFlow(flowId) {
    try {
      const flow = await this.db.findOne('flows', { _id: this.db.oid(flowId) });
      if (!flow?.active) return null;
      return flow;
    } catch {
      return null;
    }
  }

  async _log(type, data) {
    await this.db.insertOne('events', {
      type,
      account_id: this.account._id,
      ts        : new Date().toISOString(),
      ...data,
    });
  }
}
