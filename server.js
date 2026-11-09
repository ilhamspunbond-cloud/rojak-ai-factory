// ==========================================
// ROJAK AI FACTORY - BACKEND SERVER (Node.js)
// ==========================================

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Supaya bisa baca file HTML kita

// 1. Endpoint Utama untuk Cek Status Server
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// 2. Endpoint API Penghubung ke Claude 3.5 Sonnet (Akan aktif saat API Key dicolok)
app.post('/api/generate-app', async (req, res) => {
    const { prdDescription, userEmail } = req.body;

    if (!prdDescription) {
        return res.status(400).json({ success: false, message: "PRD tidak boleh kosong!" });
    }

    try {
        // Nanti di sini kode koneksi fetch ke Anthropic API Claude 3.5 Sonnet ditaruh
        // const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', { ... });

        console.log(`Menerima PRD dari ${userEmail}: ${prdDescription}`);

        // Respon simulasi sukses sebelum API Key dicolok
        res.json({
            success: true,
            message: "PRD berhasil diproses oleh AI!",
            generatedCode: "<!-- Kode aplikasi hasil generate AI akan tampil di sini -->"
        });

    } catch (error) {
        console.error("Error AI Generation:", error);
        res.status(500).json({ success: false, message: "Gagal memproses AI generator." });
    }
});

// 3. Endpoint PayPal Webhook (Auto-Unlock & Auto-Suspend Member)
app.post('/api/paypal-webhook', (req, res) => {
    const event = req.body;

    // Menangkap event sukses pembayaran dari PayPal
    if (event.event_type === 'PAYMENT.SALE.COMPLETED') {
        const customerEmail = event.resource.payer.email_address;
        console.log(`[PAYPAL SUCCESS] Pembayaran diterima dari: ${customerEmail}`);
        
        // Di sini sistem otomatis ngebuka kunci akses & nambah kuota member
    }

    res.status(200).send('Webhook diterima');
});

// Jalankan Server
app.listen(PORT, () => {
    console.log(`Server Rojak AI Factory berjalan di port ${PORT}`);
});
