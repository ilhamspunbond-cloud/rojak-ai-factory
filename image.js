// Text-to-image. Ganti isi fetch sesuai provider Anda. Harus mengembalikan Buffer gambar.
import { cfg, fail } from './config.js';

export async function textToImage(prompt) {
  const url = cfg('IMAGE_API_URL');
  if (!url) throw fail('IMAGE_API_URL belum diisi (provider text-to-image)', 501);
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg('IMAGE_API_TOKEN')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const j = await r.json();
  if (!r.ok || !j.image_base64) throw fail('Provider gambar gagal');
  return Buffer.from(j.image_base64, 'base64');
}
