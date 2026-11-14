// Video promosi / Face Swap. Ganti isi fetch sesuai provider Anda. Return true jika job diterima.
import { cfg } from './config.js';

export async function submitVideoJob(payload) {
  const url = cfg('VIDEO_API_URL');
  if (!url) return false; // job tetap tersimpan, admin bisa isi hasilnya manual di dashboard
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg('VIDEO_API_TOKEN')}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return r.ok;
}
