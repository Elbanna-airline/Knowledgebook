import { read } from './_lib.js';
export default async function handler(req, res) {
  try {
    const p = String(req.query.p || '');
    if (!/^uploads\/[\w\-]+\.jpg$/.test(p)) return res.status(400).end();
    const r = await read(p);
    if (!r) return res.status(404).end();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    return res.status(500).end();
  }
}
