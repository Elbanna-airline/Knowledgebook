import { put, list } from '@vercel/blob';
const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN;
export const authed = (req) => !!process.env.ADMIN_PASSWORD && req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;

// Works whether the Blob store is Public or Private.
export async function save(pathname, body, contentType, random) {
  const opts = { contentType, addRandomSuffix: !!random, allowOverwrite: !random, cacheControlMaxAge: 0 };
  try { return await put(pathname, body, { ...opts, access: 'public' }); }
  catch (e) {
    if (/private/i.test(String(e.message))) return await put(pathname, body, { ...opts, access: 'private' });
    throw e;
  }
}
export async function read(pathname) {
  const { blobs } = await list({ prefix: pathname });
  const b = blobs.find((x) => x.pathname === pathname) || blobs[0];
  if (!b) return null;
  const r = await fetch(b.url + (b.url.includes('?') ? '&' : '?') + 't=' + Date.now(), { headers: { Authorization: 'Bearer ' + TOKEN() } });
  if (!r.ok) throw new Error('blob read ' + r.status);
  return r;
}
export function checkEnv() {
  if (!TOKEN()) return 'BLOB_READ_WRITE_TOKEN مش موجود: اربط مخزن Blob بالمشروع ثم Redeploy';
  if (!process.env.ADMIN_PASSWORD) return 'ADMIN_PASSWORD مش موجود في Environment Variables ثم Redeploy';
  return null;
}
