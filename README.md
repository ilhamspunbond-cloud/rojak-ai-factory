# Rojak Design
Jalankan server: `npm install && ADMIN_MASTER_KEY='Rojak121$' npm start` (butuh Node 18+).
- Customer: `/`  | Admin: `/admin.html` (login pakai master key sebagai OTP)
- Admin > isi API key, harga, rekening, QRIS, upload logo.
- APK: deploy server (Render/Railway/VPS), isi URL di `capacitor.config.json`, push ke GitHub, tab Actions > "Build APK" > download artifact.
- Logo di APK/ikon launcher: ganti `public/icon.png` (512x512) lalu build ulang. Logo di dalam app diatur dari admin.
