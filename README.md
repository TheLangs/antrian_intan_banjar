# Sistem Antrian Intan Banjar (SIMAH)

Sistem Informasi Manajemen Antrian Hybrid terintegrasi untuk **PT Air Minum Intan Banjar (Perseroda)**. Dibangun menggunakan teknologi Frontend modern (HTML5, Tailwind CSS, Vanilla JavaScript ES Modules) dengan backend terpusat **Supabase (PostgreSQL Realtime & Atomic RPC)**.

---

## 🌟 Modul & Halaman Utama

1. **Kios Registrasi Tiket (`index.html`)**
   - Pengambilan nomor antrian mandiri untuk pengunjung.
   - Pilihan metode: Cetak tiket fisik atau Scan QR Code untuk tiket digital di HP.

2. **Pantau Tiket Digital Smartphone (`ticket.html`)**
   - Halaman pelacak antrian realtime untuk smartphone pelanggan.
   - Menampilkan sisa antrian di depan, status panggilan, fitur getar (vibration alert), dan notifikasi suara.

3. **Display Monitor TV Ruang Tunggu (`display.html`)**
   - Tampilan visual untuk layar TV ruang tunggu.
   - Menampilkan nomor antrian aktif di masing-masing loket, daftar antrian yang sedang menunggu (FIFO), pemutar media (YouTube/Video pengumuman), running text pengumuman, dan text-to-speech (suara panggilan wanita Indonesia).

4. **Terminal Kasir / Loket Operasional (`counter.html` & `counter_login.html`)**
   - Dashboard kasir untuk memanggil antrian berikutnya, panggil ulang (recall broadcast), menyelesaikan layanan, dan mengelola antrian terlewat.
   - Sidebar antrian menunggu dan antrian terlewat realtime.

5. **Admin Analytics Dashboard (`admin.html` & `admin_login.html`)**
   - Single Page Application (SPA) multi-tab untuk administrator.
   - Statistik antrian harian & bulanan, manajemen loket & petugas, pengaturan running text/video/audio TV, serta ekspor laporan eksekutif PDF client-side.

---

## 📁 Struktur Direktori Penting

```text
├── index.html              # Halaman Kiosk Ambil Tiket
├── ticket.html             # Halaman Pelacak Tiket Mobile
├── display.html            # Halaman Display TV Ruang Tunggu
├── counter.html            # Dashboard Kasir / Operator Loket
├── counter_login.html      # Login Petugas Loket
├── admin.html              # Dashboard Analitik & Pengaturan Admin
├── admin_login.html        # Login Administrator
│
├── assets/
│   ├── css/
│   │   └── custom.css      # Styling kustom tambahan
│   ├── js/
│   │   ├── supabaseClient.js # Konfigurasi & koneksi Supabase
│   │   ├── kiosk.js        # Logika Kiosk
│   │   ├── ticket.js       # Logika Tiket Mobile
│   │   ├── display.js      # Logika Display TV
│   │   ├── counter.js      # Logika Terminal Kasir
│   │   └── admin.js        # Logika Admin Dashboard & Ekspor PDF
│   └── images/
│       └── logo-intan-banjar.png # Logo Resmi PT Air Minum Intan Banjar
│
├── design-system/
│   └── antrian-intan-banjar/
│       └── MASTER.md       # Single Source of Truth (SSOT) Desain & Standar UI/UX
│
└── docs/
    ├── schema.sql          # Skema Database PostgreSQL, RPC & Trigger
    ├── DIAGRAM_SYSTEM.md   # Diagram Konteks, DFD & Arsitektur
    └── PRD_Sistem_Antrian_Supabase.md # Product Requirement Document
```

---

## 🚀 Teknologi yang Digunakan

- **Frontend:** HTML5, Tailwind CSS, Vanilla JavaScript (ES Modules).
- **Backend as a Service (BaaS):** Supabase (PostgreSQL 17).
- **Timezone:** WITA (`Asia/Makassar` / UTC+8).
- **Realtime:** Supabase Realtime Channel & Broadcast.
- **Reporting & Utilities:** jsPDF & autoTable, QRCode.js.

---

## 📄 Lisensi & Hak Cipta

© 2026 PT Air Minum Intan Banjar (Perseroda). All rights reserved.