# Rojak Design - Full Stack (Frontend + Backend)

Platform percetakan sablon/DTF: login OTP WhatsApp, studio mockup, hapus background, redraw (vektor), afdruk halftone 1-bit, pecah warna CMYK (zip TIFF), invoice PDF, watermark preview, checkout transfer/QRIS, validasi admin + auto-unlock, afiliasi + payout, dashboard admin (logo, harga, rekening, QRIS, statistik).

## Jalankan
```bash
cp .env.example .env     # isi JWT_SECRET dan ADMIN_MASTER_KEY
npm install
npm start                # http://localhost:3000
```
Tanpa `WA_API_URL`, OTP tampil di popup/console (mode dev saja). Di produksi isi `WA_API_URL` dan `NODE_ENV=production`.

## Mengisi API key (tanpa SDK)
Semua panggilan API eksternal ada di folder `api/` (pakai `fetch` biasa): `claude.js`, `whatsapp.js`, `image.js`, `video.js`, dipanggil lewat `api/index.js`.
1. Salin `api/keys.example.js` menjadi `api/keys.local.js`, lalu isi key-nya.
2. Atau isi di `.env` / Secrets hosting (lebih diutamakan). Urutan baca: env, lalu `keys.local.js`.
3. Mau ganti provider? Edit isi `fetch` di file provider terkait, bagian lain tidak perlu diubah.
**Jangan** isi key di file yang ikut di-commit ke GitHub. `keys.local.js` dan `.env` sudah di-gitignore.

## Deploy
Butuh server Node.js 18+ (VPS, Railway, Render, Fly.io). **GitHub Pages tidak bisa** karena ada backend. Pasang HTTPS lalu jalankan `npm start` (pakai pm2/systemd, simpan folder `data/` di disk persisten).

## APK
Setelah live di HTTPS, buka pwabuilder.com, masukkan URL, pilih Android. Ikon APK otomatis mengikuti logo yang diunggah admin (`/manifest.webmanifest` -> `/api/icon/512.png`), diambil saat proses build.

## Kontrak provider eksternal (opsional)
- `IMAGE_API_URL`: POST `{prompt}` -> `{image_base64}` (text-to-image)
- `VIDEO_API_URL`: POST `{jobId,type,assetId,meta}`; hasil dikirim admin lewat panel job (atau bangun webhook sendiri)
Claude API (`ANTHROPIC_API_KEY`) dipakai di server untuk merapikan prompt. Claude tidak membuat gambar, jadi text-to-image butuh provider lain.

## Status fitur
Jalan: semua di atas. **Belum ada engine-nya**: Face Swap/Character Cloning dan render video promosi (hanya antrean job + adapter), text-to-image (adapter), redraw berwarna (saat ini 1 warna via potrace), EPS/PDF layered (saat ini TIFF per channel dalam zip).

## Keamanan
- Jangan commit `.env` (sudah di .gitignore). API key hanya di server.
- Kunci master admin dicek di server (`ADMIN_MASTER_KEY`), bukan hardcode di kode.
- Belum ada pengujian beban/pentest. Review sebelum produksi.
