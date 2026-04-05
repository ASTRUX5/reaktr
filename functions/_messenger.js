// ─── REAKTR · Meta Graph API Messenger ────────────────────────────────────────
// Handles all DM sending: text, button templates, quick replies, typing states

const GRAPH = 'https://graph.facebook.com/v25.0';

export class Messenger {
  constructor(pageAccessToken) {
    this.token = pageAccessToken;
  }

  // ── Low-level send ────────────────────────────────────────────
  async _send(recipientId, message) {
    const res = await fetch(`${GRAPH}/me/messages?access_token=${this.token}`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        recipient     : { id: recipientId },
        message,
        messaging_type: 'RESPONSE',
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`Meta API: ${data.error.message} (code ${data.error.code})`);
    return data;
  }

  async _action(recipientId, action) {
    await fetch(`${GRAPH}/me/messages?access_token=${this.token}`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ recipient: { id: recipientId }, sender_action: action }),
    }).catch(() => {});   // non-critical, swallow errors
  }

  // ── Sender actions ────────────────────────────────────────────
  typingOn (id) { return this._action(id, 'typing_on');  }
  typingOff(id) { return this._action(id, 'typing_off'); }
  markSeen (id) { return this._action(id, 'mark_seen');  }

  // ── Human-like delay (randomised) ────────────────────────────
  delay(min = 700, max = 1500) {
    return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
  }

  // ── Pre-send ritual (mark seen + simulate typing) ─────────────
  async prelude(id, ms = 1000) {
    await this.markSeen(id);
    await this.typingOn(id);
    await this.delay(ms, ms + 600);
    await this.typingOff(id);
  }

  // ── Message types ─────────────────────────────────────────────
  async text(id, text) {
    await this.prelude(id);
    return this._send(id, { text: String(text).slice(0, 2000) });
  }

  async buttons(id, text, buttons) {
    await this.prelude(id, 900);
    const btns = buttons.slice(0, 3).map(b => this._btn(b));
    return this._send(id, {
      attachment: {
        type   : 'template',
        payload: {
          template_type: 'button',
          text         : String(text).slice(0, 640),
          buttons      : btns,
        },
      },
    });
  }

  async quickReplies(id, text, replies) {
    await this.prelude(id, 800);
    return this._send(id, {
      text,
      quick_replies: replies.slice(0, 13).map(r => ({
        content_type: 'text',
        title       : String(r.title).slice(0, 20),
        payload     : r.payload,
      })),
    });
  }

  // generic template - carousel of cards
  async generic(id, elements) {
    await this.prelude(id, 1000);
    return this._send(id, {
      attachment: {
        type   : 'template',
        payload: {
          template_type: 'generic',
          elements     : elements.slice(0, 10).map(e => ({
            title    : e.title,
            subtitle : e.subtitle,
            image_url: e.image_url,
            buttons  : e.buttons?.slice(0, 3).map(b => this._btn(b)),
          })),
        },
      },
    });
  }

  // ── Normalise button object ───────────────────────────────────
  _btn(b) {
    if (b.type === 'url' || b.type === 'web_url') {
      return { type: 'web_url', url: b.url, title: String(b.title).slice(0, 20) };
    }
    return { type: 'postback', title: String(b.title).slice(0, 20), payload: b.payload };
  }

  // ── Reply to a comment (public reply, not DM) ─────────────────
  async replyToComment(commentId, message) {
    const res = await fetch(`${GRAPH}/${commentId}/replies?access_token=${this.token}`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ message }),
    });
    return res.json();
  }

  // ── Check if user follows the IG Business Account ─────────────
  async isFollower(igUserId, igBusinessId) {
    try {
      const res = await fetch(
        `${GRAPH}/${igBusinessId}/followers` +
        `?user_id=${igUserId}&access_token=${this.token}`
      );
      const data = await res.json();
      return !!(data.data?.length > 0);
    } catch {
      return false; // default: assume not following
    }
  }

  // ── Long-lived token refresh ──────────────────────────────────
  static async refreshToken(shortToken, appId, appSecret) {
    const res = await fetch(
      `${GRAPH}/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&fb_exchange_token=${shortToken}`
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.access_token;
  }

  // ── Get IG Business Account from Page token ───────────────────
  static async getIGAccount(pageId, pageToken) {
    const res = await fetch(
      `${GRAPH}/${pageId}?fields=instagram_business_account{id,username,name,profile_picture_url}&access_token=${pageToken}`
    );
    return res.json();
  }
}
