# Rojak Design

Platform PWA percetakan sablon/DTF: mockup desain, afdruk film sablon, invoice, checkout transfer/QRIS, dan dashboard admin.
Ini **frontend prototype** (data tersimpan di localStorage browser).

## Jalankan lokal
```bash
python3 -m http.server 8080
# buka http://localhost:8080
```

## Deploy ke GitHub Pages
1. Push repo ini ke GitHub.
2. Settings > Pages > Source: `main` branch, folder `/ (root)`.
3. Buka `https://USERNAME.github.io/NAMA-REPO/`.

## Logo aplikasi
- **Di dalam app:** login sebagai admin > tab Admin > upload logo (header + favicon).
- **Ikon install/APK:** ganti `icons/icon-192.png` dan `icons/icon-512.png` dengan logo Anda (PNG persegi), lalu build ulang APK.

## Jadi APK
Setelah di-deploy HTTPS: buka https://www.pwabuilder.com, masukkan URL Pages, pilih Android, download paket (APK/AAB).

## Belum ada (perlu backend)
- OTP WhatsApp asli (gateway WA API)
- AI Sample Redraw, hapus background, video promosi, Face Swap
- Pecah warna DTF/afdruk (TIFF/EPS/PDF)
- Database bersama, auth server, afiliasi/payout

## Keamanan
- **Jangan** taruh API key Claude/AI di repo atau frontend. Simpan di environment variable server (`.env` sudah di-gitignore) dan panggil AI lewat endpoint backend.
- Login admin di prototype hanya demo. Ganti dengan autentikasi server sebelum produksi.
