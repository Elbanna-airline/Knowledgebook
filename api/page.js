import { authed, save, read, checkEnv } from './_lib.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const slug = String(req.query.slug || '').replace(/[^a-z0-9-]/g, '');
    if (!slug) return res.status(400).json({ error: 'slug مفقود' });
    const path = `pages/${slug}.json`;
    if (req.method === 'GET') {
      if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(200).json({ html: null });
      const r = await read(path);
      return res.status(200).json(r ? await r.json() : { html: null });
    }
    const env = checkEnv();
    if (env) return res.status(500).json({ error: env });
    if (!authed(req)) return res.status(401).json({ error: 'كلمة السر غير صحيحة' });
    if (req.method === 'POST') return res.status(200).json({ ok: true });
    if (req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const html = body && body.html;
      if (typeof html !== 'string') return res.status(400).json({ error: 'المحتوى فاضي' });
      if (html.length > 3000000) return res.status(413).json({ error: 'الصفحة كبيرة قوي' });
      await save(path, JSON.stringify({ html, updated: new Date().toISOString() }), 'application/json', false);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
