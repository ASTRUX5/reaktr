// ─── REAKTR · Cloudflare D1 Database ─────────────────────────────────────────

export class DB {
  constructor(env) {
    this.d1 = env.DB;
  }

  async init() {
    await this.d1.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        ig_id TEXT UNIQUE,
        username TEXT,
        name TEXT,
        profile_pic TEXT,
        page_id TEXT,
        page_access_token TEXT,
        user_token TEXT,
        active INTEGER DEFAULT 1,
        connected_at TEXT
      );
      CREATE TABLE IF NOT EXISTS flows (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        name TEXT,
        description TEXT,
        steps TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS triggers (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        flow_id TEXT,
        name TEXT,
        keywords TEXT,
        match_type TEXT DEFAULT 'contains',
        media_id TEXT DEFAULT 'any',
        comment_reply TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        ig_user_id TEXT,
        account_id TEXT,
        flow_id TEXT,
        step_id TEXT,
        context TEXT,
        awaiting TEXT,
        lead_next TEXT,
        lead_field TEXT,
        status TEXT DEFAULT 'active',
        started_at TEXT,
        last_active TEXT
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT,
        account_id TEXT,
        ig_user_id TEXT,
        flow_id TEXT,
        trigger_id TEXT,
        keyword TEXT,
        media_id TEXT,
        field TEXT,
        sent_count INTEGER,
        ts TEXT
      );
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        ig_user_id TEXT,
        flow_id TEXT,
        field TEXT,
        value TEXT,
        ts TEXT
      );
      CREATE TABLE IF NOT EXISTS processed_comments (
        comment_id TEXT PRIMARY KEY,
        ig_user_id TEXT,
        account_id TEXT,
        ts TEXT
      );
    `);
  }

  uid() {
    return crypto.randomUUID();
  }

  now() {
    return new Date().toISOString();
  }

  // ── Parse rows (D1 returns plain objects) ─────────────────────
  _parse(row) {
    if (!row) return null;
    const out = { ...row };
    // Parse JSON fields
    for (const key of ['steps', 'keywords', 'context']) {
      if (typeof out[key] === 'string') {
        try { out[key] = JSON.parse(out[key]); } catch {}
      }
    }
    // Fake _id for frontend compatibility
    out._id = { $oid: out.id };
    return out;
  }

  // ── CRUD ──────────────────────────────────────────────────────
  async findOne(table, filter) {
    const { where, values } = this._buildWhere(filter);
    const row = await this.d1
      .prepare(`SELECT * FROM ${table} WHERE ${where} LIMIT 1`)
      .bind(...values)
      .first();
    return this._parse(row);
  }

  async find(table, filter = {}, sort = {}, limit = 200) {
    const { where, values } = this._buildWhere(filter);
    const sortKey   = Object.keys(sort)[0] ?? 'rowid';
    const sortDir   = Object.values(sort)[0] === -1 ? 'DESC' : 'ASC';
    const { results } = await this.d1
      .prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY ${sortKey} ${sortDir} LIMIT ${limit}`)
      .bind(...values)
      .all();
    return (results ?? []).map(r => this._parse(r));
  }

  async insertOne(table, doc) {
    const id  = this.uid();
    const row = { ...doc, id, _ts: this.now() };
    // Stringify JSON fields
    for (const key of ['steps', 'keywords', 'context']) {
      if (typeof row[key] === 'object') row[key] = JSON.stringify(row[key]);
    }
    delete row._id;
    const keys   = Object.keys(row);
    const placeholders = keys.map(() => '?').join(', ');
    await this.d1
      .prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`)
      .bind(...Object.values(row))
      .run();
    return { insertedId: id };
  }

  async updateOne(table, filter, update, upsert = false) {
    const existing = await this.findOne(table, filter);
    if (!existing && upsert) {
      const newDoc = { ...this._flattenFilter(filter), ...(update.$set ?? {}) };
      return this.insertOne(table, newDoc);
    }
    if (!existing) return;
    const set = update.$set ?? {};
    for (const key of ['steps', 'keywords', 'context']) {
      if (typeof set[key] === 'object') set[key] = JSON.stringify(set[key]);
    }
    const keys   = Object.keys(set);
    if (!keys.length) return;
    const assigns = keys.map(k => `${k} = ?`).join(', ');
    const { where, values } = this._buildWhere(filter);
    await this.d1
      .prepare(`UPDATE ${table} SET ${assigns} WHERE ${where}`)
      .bind(...Object.values(set), ...values)
      .run();
  }

  async deleteOne(table, filter) {
    const { where, values } = this._buildWhere(filter);
    await this.d1
      .prepare(`DELETE FROM ${table} WHERE ${where} LIMIT 1`)
      .bind(...values)
      .run();
  }

  async count(table, filter = {}) {
    const { where, values } = this._buildWhere(filter);
    const row = await this.d1
      .prepare(`SELECT COUNT(*) as n FROM ${table} WHERE ${where}`)
      .bind(...values)
      .first();
    return row?.n ?? 0;
  }

  async aggregate(table, pipeline) {
    // Simple group+count support for analytics
    const match  = pipeline.find(s => s.$match)?.$match ?? {};
    const group  = pipeline.find(s => s.$group)?.$group;
    const limit  = pipeline.find(s => s.$limit)?.$limit ?? 10;

    if (group?._id && group?.count) {
      const field  = group._id.replace('$', '');
      const { where, values } = this._buildWhere(match);
      const { results } = await this.d1
        .prepare(
          `SELECT ${field} as _id, COUNT(*) as count FROM ${table} ` +
          `WHERE ${where} GROUP BY ${field} ORDER BY count DESC LIMIT ${limit}`
        )
        .bind(...values)
        .all();
      return results ?? [];
    }
    return [];
  }

  oid(id) { return { $oid: id }; }

  // ── Internals ─────────────────────────────────────────────────
  _buildWhere(filter) {
    const keys = Object.keys(filter);
    if (!keys.length) return { where: '1=1', values: [] };

    const conditions = [];
    const values = [];
    for (const key of keys) {
      const val = filter[key];
      if (val && typeof val === 'object' && val.$oid) {
        conditions.push(`id = ?`);
        values.push(val.$oid);
      } else if (val && typeof val === 'object' && val.$in) {
        const placeholders = val.$in.map(() => '?').join(',');
        conditions.push(`${key} IN (${placeholders})`);
        values.push(...val.$in);
      } else {
        conditions.push(`${key} = ?`);
        values.push(val);
      }
    }
    return { where: conditions.join(' AND '), values };
  }

  _flattenFilter(filter) {
    const out = {};
    for (const [k, v] of Object.entries(filter)) {
      out[k] = (v && typeof v === 'object' && v.$oid) ? v.$oid : v;
    }
    return out;
  }
}
