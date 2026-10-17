import { authed } from './_lib.js';
// Follows a TikTok short link (vm.tiktok.com/xxx, tiktok.com/t/xxx) and returns the full video URL.
const ok = (h) => /(^|\.)tiktok\.com$/.test(h);
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!authed(req)) return res.status(401).json({ error: 'كلمة السر غير صحيحة' });
    let u;
    try { u = new URL(String(req.query.u || '')); } catch (e) { return res.status(400).json({ error: 'bad url' }); }
    if (u.protocol !== 'https:' || !ok(u.hostname)) return res.status(400).json({ error: 'only tiktok links' });
    for (let i = 0; i < 6 && /\/video\/\d+/.test(u.href) === false; i++) {
      const r = await fetch(u.href, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' } });
      const loc = r.headers.get('location');
      if (!loc) break;
      const n = new URL(loc, u.href);
      if (n.protocol !== 'https:' || !ok(n.hostname)) break;
      u = n;
    }
    return res.status(200).json({ url: u.href });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
