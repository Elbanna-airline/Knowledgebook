import { authed, save, checkEnv } from './_lib.js';
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
    const env = checkEnv();
    if (env) return res.status(500).json({ error: env });
    if (!authed(req)) return res.status(401).json({ error: 'كلمة السر غير صحيحة' });
    const name = String(req.query.name || 'image').replace(/\.\w+$/, '').replace(/[^\w\-]/g, '_').slice(0, 50) || 'image';
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    if (!buf.length) return res.status(400).json({ error: 'الصورة فاضية' });
    const blob = await save(`uploads/${name}.jpg`, buf, 'image/jpeg', true);
    return res.status(200).json({ url: '/api/file?p=' + encodeURIComponent(blob.pathname) });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
