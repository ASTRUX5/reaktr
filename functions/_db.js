// ─── REAKTR · MongoDB Atlas Data API Client ───────────────────────────────────
// Works in Cloudflare Workers (HTTP-only, no TCP needed)
// Requires: MONGODB_APP_ID, MONGODB_API_KEY env vars set in Cloudflare Pages

export class DB {
  constructor(env) {
    this.appId      = env.MONGODB_APP_ID;
    this.apiKey     = env.MONGODB_API_KEY;
    this.database   = env.MONGODB_DATABASE  || 'reaktr';
    this.dataSource = env.MONGODB_CLUSTER   || 'Cluster0';
  }

  _url(action) {
    return `https://data.mongodb-api.com/app/${this.appId}/endpoint/data/v1/action/${action}`;
  }

  async _req(action, collection, body = {}) {
    const res = await fetch(this._url(action), {
      method : 'POST',
      headers: {
        'Content-Type': 'application/ejson',
        'Accept'      : 'application/ejson',
        'apiKey'      : this.apiKey,
      },
      body: JSON.stringify({
        dataSource: this.dataSource,
        database  : this.database,
        collection,
        ...body,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DB[${action}/${collection}] ${res.status}: ${err}`);
    }
    return res.json();
  }

  // ── CRUD ──────────────────────────────────────────────────────
  async findOne(col, filter)                      { return (await this._req('findOne',   col, { filter })).document; }
  async find   (col, filter = {}, sort = {}, limit = 200) { return (await this._req('find', col, { filter, sort, limit })).documents ?? []; }
  async insertOne(col, doc)                       { return this._req('insertOne', col, { document: { ...doc, _ts: new Date().toISOString() } }); }
  async updateOne(col, filter, update, upsert=false) { return this._req('updateOne', col, { filter, update, upsert }); }
  async updateMany(col, filter, update)           { return this._req('updateMany', col, { filter, update }); }
  async deleteOne(col, filter)                    { return this._req('deleteOne',  col, { filter }); }
  async deleteMany(col, filter)                   { return this._req('deleteMany', col, { filter }); }
  async aggregate(col, pipeline)                  { return (await this._req('aggregate', col, { pipeline })).documents ?? []; }

  async count(col, filter = {}) {
    const r = await this.aggregate(col, [{ $match: filter }, { $count: 'n' }]);
    return r[0]?.n ?? 0;
  }

  // ── Helpers ───────────────────────────────────────────────────
  oid(id) { return { '$oid': id }; }
  now()   { return new Date().toISOString(); }
}
