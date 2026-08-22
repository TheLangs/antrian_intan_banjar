# Sistem Informasi Manajemen Antrian Hybrid (SIMAH)

**Sistem Informasi Manajemen Antrian Hybrid (SIMAH)** adalah solusi antrian modern terintegrasi yang menggabungkan metode fisik (*Cetak Kertas*) dan metode digital (*QR Code Mobile Tracking*). Sistem ini dirancang untuk memberikan transparansi antrian, mengurangi penumpukan fisik di ruang tunggu, serta mempercepat alur pelayanan petugas loket secara *real-time*.

---

## 🚀 Konsep "Hybrid"

Sistem antrian konvensional seringkali memaksa pelanggan untuk duduk diam di ruang tunggu hanya untuk mendengarkan panggilan suara. SIMAH memecahkan masalah ini dengan pendekatan **Hybrid**:

1. **Jalur Fisik (Konvensional)**: Pelanggan yang tidak membawa smartphone atau lebih menyukai cara manual dapat mencetak nomor antrian fisik melalui printer thermal di Kiosk.
2. **Jalur Digital (Modern)**: Pelanggan dapat memindai QR Code di layar Kiosk untuk membuka tiket digital di smartphone mereka tanpa perlu mengunduh/menginstal aplikasi. Tiket digital ini menampilkan:
   - Sisa antrian di depan secara langsung (*real-time*).
   - Estimasi waktu tunggu.
   - Fitur getar otomatis (*vibration alert*) dan lonceng notifikasi saat nomor pelanggan dipanggil petugas.

---

## 🌟 Modul & Komponen Sistem

### 1. Kiosk Ambil Tiket Mandiri (`index.html`)
* Antarmuka ramah pengguna (*touchscreen friendly*) untuk pengunjung mengambil nomor antrian.
* Pilihan cetak tiket fisik atau scan QR Code instan.
* Terkoneksi langsung ke database PostgreSQL dengan penguncian nomor atomik (*Atomic Sequence Locking*) untuk mencegah duplikasi nomor.

### 2. Tiket Pelacak Digital Mobile (`ticket.html`)
* Halaman *Progressive Web Interface* yang diakses melalui URL unik bertoken (`?token=xxx`).
* Real-time listener: Status tiket berubah otomatis (Menunggu ➔ Dipanggil ➔ Selesai / Terlewat) tanpa perlu refresh browser.
* Pemicu getar perangkat keras (*Vibration API*) dan suara chime lokal saat nomor pelanggan dipanggil ke loket.

### 3. Layar Display Ruang Tunggu (`display.html`)
* Tampilan TV ruang tunggu dengan resolusi adaptif (HD hingga 4K).
* Menampilkan nomor antrian aktif di setiap loket dengan kartu loket responsif.
* Sidebar **Antrian Menunggu** (FIFO) untuk memperlihatkan urutan antrian berikutnya yang siap dipanggil.
* Pemutar media informasi terintegrasi (YouTube Playlist / Video Lokal) dan teks pengumuman berjalan (*Running Text Marquee*).
* Sistem pemanggilan suara otomatis (*Text-to-Speech* Bahasa Indonesia) dan lonceng chime.

### 4. Terminal Petugas / Kasir Loket (`counter.html` & `counter_login.html`)
* Dashboard operasional petugas loket dengan proteksi sesi login.
* Tombol aksi pelayanan:
  - **Panggil Antrian Berikutnya**: Mengambil antrian terdepan secara aman (*FOR UPDATE SKIP LOCKED*).
  - **Panggil Ulang (Recall)**: Mengirimkan sinyal siaran (*broadcast*) ke TV display dan HP pelanggan jika pelanggan belum menghadap.
  - **Selesai**: Menandai pelayanan selesai dan mencatat durasi waktu pelayanan.
  - **Lewati (Tidak Hadir)**: Memindahkan tiket ke daftar antrian terlewat.
* Sidebar ganda realtime: Daftar antrian yang sedang menunggu dan daftar antrian yang terlewat (bisa dipanggil kembali kapan saja).
* Tombol segarkan data instan di header operator.

### 5. Dashboard Admin Analitik (`admin.html` & `admin_login.html`)
* Dashboard analisis performa loket dan data analitik antrian harian & bulanan.
* Manajemen master loket, akun petugas, dan status operasional.
* Pengaturan konten display TV (Running text marquee, mode audio TTS, mode video).
* Fitur ekspor laporan eksekutif berformat PDF resmi (*client-side export*) lengkap dengan metrik KPI, rata-rata waktu tunggu, dan waktu layanan.

---

## 🏗️ Arsitektur Teknologi

* **Frontend**: HTML5 Semantic, Tailwind CSS, Vanilla JavaScript Modern (ES Modules).
* **Backend as a Service (BaaS)**: Supabase PostgreSQL 17.
* **Protokol Realtime**: WebSocket Supabase Realtime (Postgres Changes & Broadcast Channels).
* **Zona Waktu**: Terstandarisasi WITA (`Asia/Makassar` / UTC+8) di tingkat basis data dan client.
* **Keamanan & Integritas**: 
  - Stored Procedures / RPC Functions dengan transaksi atomik untuk eliminasi *race conditions*.
  - Token-based access control untuk tiket digital pengunjung dan sesi loket.

---

## 📁 Struktur Direktori

```text
├── index.html              # Kiosk Ambil Tiket
├── ticket.html             # Pelacak Tiket Mobile Digital
├── display.html            # Display TV Ruang Tunggu
├── counter.html            # Terminal Kasir / Loket
├── counter_login.html      # Login Petugas Loket
├── admin.html              # Dashboard Analitik & Pengaturan Admin
├── admin_login.html        # Login Administrator
│
├── assets/
│   ├── css/
│   │   └── custom.css      # Styling pendukung
│   ├── js/
│   │   ├── supabaseClient.js # Konfigurasi Client Supabase
│   │   ├── kiosk.js        # Logika Kiosk
│   │   ├── ticket.js       # Logika Tiket Mobile
│   │   ├── display.js      # Logika Display TV
│   │   ├── counter.js      # Logika Operator Kasir
│   │   └── admin.js        # Logika Admin & Ekspor PDF
│   └── images/             # Aset gambar & logo sistem
│
├── design-system/
│   └── antrian-intan-banjar/
│       └── MASTER.md       # Panduan Desain & Standar UI/UX (SSOT)
│
└── docs/
    ├── schema.sql          # Skema Database PostgreSQL, RPC & Trigger
    ├── DIAGRAM_SYSTEM.md   # Diagram Konteks, DFD & Use Case
    └── PRD_Sistem_Antrian_Supabase.md # Product Requirement Document
```

---

## ⚙️ Cara Menjalankan Sistem

1. Clone repositori ini ke komputer Anda.
2. Buat proyek baru di [Supabase](https://supabase.com).
3. Jalankan script SQL di [docs/schema.sql](docs/schema.sql) pada Supabase SQL Editor.
4. Salin `SUPABASE_URL` dan `SUPABASE_ANON_KEY` ke file [assets/js/supabaseClient.js](assets/js/supabaseClient.js).
5. Jalankan web server lokal (misal menggunakan ekstensi *Live Server* di VS Code atau Python `python -m http.server 8000`), lalu buka `index.html`.