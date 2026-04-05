// ─── REAKTR · Cloudflare D1 Database ─────────────────────────────────────────
// No external DB account needed. D1 is built into Cloudflare Pages.
// Bind your D1 database as variable name "DB" in Pages → Settings → Bindings.

export class DB {
  constructor(env) {
    this.d1 = env.DB;
    if (!this.d1) throw new Error('D1 binding missing. Add a D1 binding named "DB" in Cloudflare Pages → Settings → Bindings.');
  }

  async init() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, ig_id TEXT UNIQUE, username TEXT, name TEXT, profile_pic TEXT, page_id TEXT, page_access_token TEXT, user_token TEXT, active INTEGER DEFAULT 1, connected_at TEXT, _ts TEXT)`,
      `CREATE TABLE IF NOT EXISTS flows (id TEXT PRIMARY KEY, account_id TEXT, name TEXT, description TEXT, steps TEXT, active INTEGER DEFAULT 1, created_at TEXT, _ts TEXT)`,
      `CREATE TABLE IF NOT EXISTS triggers (id TEXT PRIMARY KEY, account_id TEXT, flow_id TEXT, name TEXT, keywords TEXT, match_type TEXT DEFAULT 'contains', media_id TEXT DEFAULT 'any', comment_reply TEXT, active INTEGER DEFAULT 1, created_at TEXT, _ts TEXT)`,
      `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, ig_user_id TEXT, account_id TEXT, flow_id TEXT, step_id TEXT, context TEXT, awaiting TEXT, lead_next TEXT, lead_field TEXT, status TEXT DEFAULT 'active', started_at TEXT, last_active TEXT, _ts TEXT)`,
      `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, type TEXT, account_id TEXT, ig_user_id TEXT, flow_id TEXT, trigger_id TEXT, keyword TEXT, media_id TEXT, field TEXT, sent_count INTEGER, ts TEXT, _ts TEXT)`,
      `CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, account_id TEXT, ig_user_id TEXT, flow_id TEXT, field TEXT, value TEXT, ts TEXT, _ts TEXT)`,
      `CREATE TABLE IF NOT EXISTS processed_comments (comment_id TEXT PRIMARY KEY, ig_user_id TEXT, account_id TEXT, ts TEXT, _ts TEXT)`,
    ];
    for (const sql of tables) {
      await this.d1.prepare(sql).run();
    }
  }

  uid()  { return crypto.randomUUID(); }
  now()  { return new Date().toISOString(); }
  oid(id){ return { $oid: id }; }

  // ── Serialise / deserialise JSON columns ──────────────────────
  _ser(row) {
    if (!row) return row;
    const out = { ...row };
    for (const k of ['steps','keywords','context']) {
      if (out[k] !== undefined && typeof out[k] !== 'string') {
        out[k] = JSON.stringify(out[k]);
      }
    }
    return out;
  }

  _des(row) {
    if (!row) return null;
    const out = { ...row };
    for (const k of ['steps','keywords','context']) {
      if (typeof out[k] === 'string') {
        try { out[k] = JSON.parse(out[k]); } catch {}
      }
    }
    // Expose _id.$oid so existing code works unchanged
    out._id = { $oid: out.id };
    return out;
  }

  // ── WHERE builder ─────────────────────────────────────────────
  _where(filter) {
    const keys = Object.keys(filter);
    if (!keys.length) return { clause: '1=1', vals: [] };
    const parts = [], vals = [];
    for (const k of keys) {
      const v = filter[k];
      if (v && typeof v === 'object' && v.$oid) {
        parts.push('id = ?'); vals.push(v.$oid);
      } else if (v && typeof v === 'object' && v.$in) {
        parts.push(`${k} IN (${v.$in.map(()=>'?').join(',')})`);
        vals.push(...v.$in);
      } else {
        parts.push(`${k} = ?`); vals.push(v);
      }
    }
    return { clause: parts.join(' AND '), vals };
  }

  // ── CRUD ──────────────────────────────────────────────────────
  async findOne(table, filter) {
    const { clause, vals } = this._where(filter);
    const row = await this.d1
      .prepare(`SELECT * FROM ${table} WHERE ${clause} LIMIT 1`)
      .bind(...vals).first();
    return this._des(row);
  }

  async find(table, filter = {}, sort = {}, limit = 200) {
    const { clause, vals } = this._where(filter);
    const sk  = Object.keys(sort)[0]  ?? '_ts';
    const dir = Object.values(sort)[0] === -1 ? 'DESC' : 'ASC';
    const { results } = await this.d1
      .prepare(`SELECT * FROM ${table} WHERE ${clause} ORDER BY ${sk} ${dir} LIMIT ${limit}`)
      .bind(...vals).all();
    return (results ?? []).map(r => this._des(r));
  }

  async insertOne(table, doc) {
    const id  = this.uid();
    const row = this._ser({ ...doc, id, _ts: this.now() });
    delete row._id;
    const cols = Object.keys(row);
    const ph   = cols.map(() => '?').join(', ');
    await this.d1
      .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${ph})`)
      .bind(...Object.values(row)).run();
    return { insertedId: id };
  }

  async updateOne(table, filter, update, upsert = false) {
    const existing = await this.findOne(table, filter);
    if (!existing) {
      if (upsert) {
        const flat = {};
        for (const [k,v] of Object.entries(filter)) flat[k] = (v?.$oid ?? v);
        return this.insertOne(table, { ...flat, ...(update.$set ?? {}) });
      }
      return;
    }
    const set = this._ser({ ...(update.$set ?? {}) });
    const keys = Object.keys(set);
    if (!keys.length) return;
    const assigns = keys.map(k => `${k} = ?`).join(', ');
    const { clause, vals } = this._where(filter);
    await this.d1
      .prepare(`UPDATE ${table} SET ${assigns} WHERE ${clause}`)
      .bind(...Object.values(set), ...vals).run();
  }

  async deleteOne(table, filter) {
    const { clause, vals } = this._where(filter);
    await this.d1
      .prepare(`DELETE FROM ${table} WHERE ${clause} LIMIT 1`)
      .bind(...vals).run();
  }

  async deleteMany(table, filter) {
    const { clause, vals } = this._where(filter);
    await this.d1
      .prepare(`DELETE FROM ${table} WHERE ${clause}`)
      .bind(...vals).run();
  }

  async count(table, filter = {}) {
    const { clause, vals } = this._where(filter);
    const row = await this.d1
      .prepare(`SELECT COUNT(*) as n FROM ${table} WHERE ${clause}`)
      .bind(...vals).first();
    return row?.n ?? 0;
  }

  async aggregate(table, pipeline) {
    const match = pipeline.find(s => s.$match)?.$match ?? {};
    const group = pipeline.find(s => s.$group)?.$group;
    const lim   = pipeline.find(s => s.$limit)?.$limit ?? 10;
    if (group?._id && group?.count) {
      const field = group._id.replace('$','');
      const { clause, vals } = this._where(match);
      const { results } = await this.d1
        .prepare(
          `SELECT ${field} as _id, COUNT(*) as count FROM ${table} ` +
          `WHERE ${clause} GROUP BY ${field} ORDER BY count DESC LIMIT ${lim}`
        ).bind(...vals).all();
      return results ?? [];
    }
    return [];
  }
}
