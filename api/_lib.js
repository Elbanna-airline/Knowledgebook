import { put, list } from '@vercel/blob';
// Finds the Blob token even if the store was connected with a custom prefix (e.g. STORAGE_READ_WRITE_TOKEN).
const TOKEN = () => {
  const raw = process.env.BLOB_READ_WRITE_TOKEN || process.env[Object.keys(process.env).find((k) => /READ_WRITE_TOKEN$/.test(k)) || ''] || '';
  return String(raw).trim().replace(/^['"]+|['"]+$/g, '').trim();
};
export const authed = (req) => !!process.env.ADMIN_PASSWORD && req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;

// Works whether the Blob store is Public or Private.
export async function save(pathname, body, contentType, random) {
  const opts = { token: TOKEN(), contentType, addRandomSuffix: !!random, allowOverwrite: !random, cacheControlMaxAge: 0 };
  try { return await put(pathname, body, { ...opts, access: 'public' }); }
  catch (e) {
    if (/private/i.test(String(e.message))) return await put(pathname, body, { ...opts, access: 'private' });
    throw e;
  }
}
export async function read(pathname) {
  const { blobs } = await list({ prefix: pathname, token: TOKEN() });
  const b = blobs.find((x) => x.pathname === pathname) || blobs[0];
  if (!b) return null;
  const r = await fetch(b.url + (b.url.includes('?') ? '&' : '?') + 't=' + Date.now(), { headers: { Authorization: 'Bearer ' + TOKEN() } });
  if (!r.ok) throw new Error('blob read ' + r.status);
  return r;
}
export function checkEnv() {
  if (!TOKEN()) return 'مفيش توكن Blob في المشروع ده (know-opal): اتأكد إن المخزن متربط بنفس المشروع، وإن في Environment Variables متغير بينتهي بـ READ_WRITE_TOKEN، ثم Redeploy';
  if (!process.env.ADMIN_PASSWORD) return 'ADMIN_PASSWORD مش موجود في Environment Variables ثم Redeploy';
  return null;
}
export const hasToken = () => !!TOKEN();
