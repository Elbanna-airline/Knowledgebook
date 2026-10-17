import { put } from '@vercel/blob';
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();
    if (!process.env.ADMIN_PASSWORD || req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'unauthorized' });
    const name = String(req.query.name || 'image').replace(/[^\w.\-]/g, '_').slice(0, 60);
    const blob = await put(`uploads/${name.replace(/\.\w+$/, '')}.jpg`, req.body, { access: 'public', contentType: 'image/jpeg', addRandomSuffix: true });
    return res.status(200).json({ url: blob.url });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
