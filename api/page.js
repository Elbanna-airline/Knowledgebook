import { put, list } from '@vercel/blob';
const ok = (req) => process.env.ADMIN_PASSWORD && req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
export default async function handler(req, res) {
  try {
    const slug = String(req.query.slug || '').replace(/[^a-z0-9-]/g, '');
    if (!slug) return res.status(400).json({ error: 'slug' });
    const path = `pages/${slug}.json`;
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: path });
      const b = blobs.find((x) => x.pathname === path);
      if (!b) return res.status(200).json({ html: null });
      const r = await fetch(b.url + '?t=' + Date.now());
      return res.status(200).json(await r.json());
    }
    if (!ok(req)) return res.status(401).json({ error: 'unauthorized' });
    if (req.method === 'POST') return res.status(200).json({ ok: true }); // password check
    if (req.method === 'PUT') {
      const html = req.body && req.body.html;
      if (typeof html !== 'string' || html.length > 3_000_000) return res.status(400).json({ error: 'bad body' });
      await put(path, JSON.stringify({ html, updated: new Date().toISOString() }), {
        access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0,
      });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
