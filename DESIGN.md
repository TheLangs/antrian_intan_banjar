# DESIGN SYSTEM & UI/UX GUIDELINES (DESIGN.md)
## Identitas Visual: PT Air Minum Intan Banjar (Perseroda)

---

### 1. FILOSOFI & KARAKTER DESAIN
- **Karakter Utama**: Korporat BUMD/Pelayanan Publik yang Andal, Bersih (*Clean*), Segar (*Aqua/Water Vibe*), dan Berorientasi Kemudahan (*User-Centric*).
- **Prinsip Anti-AI Slop**:
  - Hindari efek *glassmorphism* berlebihan, *neon glow*, atau gradien ungu/pink generik.
  - Gunakan tata letak (*layout*) berstruktur tegas, kartu informasi dengan kontras tinggi (*high readability*), serta tipografi sans-serif modern yang mudah dibaca oleh semua kalangan usia.

---

### 2. PALET WARNA RESMI (TAILWIND CSS CONFIG)

Palet warna diturunkan langsung dari tema utilitas air bersih dan identitas korporat Intan Banjar:

| Kategori | Hex Code | Nama Tailwind | Deskripsi & Penggunaan |
| :--- | :--- | :--- | :--- |
| **Primary (Brand)** | `#0B5C9E` | `blue-800` / `brand-primary` | Warna dominan navbar, tombol aksi utama, dan kartu loket aktif. |
| **Primary Light** | `#0088CC` | `sky-600` / `brand-accent` | Aksen tombol aktif, *badge status*, dan tautan navigasi. |
| **Secondary (Water)** | `#EBF5FB` | `sky-50` / `brand-surface` | Latar belakang kartu, *highlight* baris tabel, dan *badge container*. |
| **Dark Base (Text)** | `#1E293B` | `slate-800` | Teks utama, judul, dan nomor antrean (kontras maksimal). |
| **Background** | `#F8FAFC` | `slate-50` | Latar belakang seluruh halaman (*neutral light*). |
| **Success / Done** | `#059669` | `emerald-600` | Status antrean "Selesai", konfirmasi berhasil. |
| **Warning / Calling** | `#D97706` | `amber-600` | Status antrean "Dipanggil" (menarik perhatian pelanggan). |
| **Danger / Skipped** | `#DC2626` | `red-600` | Tombol lewati, status antrean "Terlewat". |

---

### 3. TIPOGRAFI
- **Font Utama**: `Inter`, `Plus Jakarta Sans`, atau fallback sistem `ui-sans-serif, system-ui`.
- **Hierarki & Ukuran**:
  - **Display TV (Nomor Loket)**: `text-7xl` sampai `text-9xl` (`font-black`, `tracking-tight`).
  - **Header Halaman**: `text-2xl` sampai `text-3xl` (`font-bold`, `text-slate-800`).
  - **Body / Label**: `text-sm` sampai `text-base` (`font-medium`, `text-slate-600`).
  - **Tiket Mobile (Nomor Anda)**: `text-5xl` (`font-extrabold`, `text-blue-800`).

---

### 4. PEDOMAN KOMPONEN UI PER MODUL

#### A. Kios Antrean Pelanggan (`index.html`)
- **Header**: Logo Intan Banjar di kiri atas, nama instansi: *"PT Air Minum Intan Banjar (Perseroda)"*, sub-judul: *"Sistem Pelayanan Antrean Kasir"*.
- **2 Tombol Pilihan Utama**:
  - Kartu Pilihan 1: **Cetak Tiket Fisik** (Ikon Printer, warna dasar putih dengan `border-2 border-blue-800`).
  - Kartu Pilihan 2: **Tiket Digital (Scan QR)** (Ikon QR Code, latar belakang `bg-blue-800` dengan teks putih).
- **Sentuhan Visual**: Sudut membulat proporsional (`rounded-2xl`), bayangan halus (`shadow-sm hover:shadow-md`).

#### B. Display Layar Ruang Tunggu (`display.html`)
- **Format**: Mode layar penuh (*fullscreen*) rasio 16:9.
- **Top Header**: Logo + Jam *real-time* digital presisi + Tanggal Masehi.
- **3 Grid Loket Utama**:
  - Setiap loket berupa kartu besar dengan *header badge* warna biru gelap (`Loket 1`, `Loket 2`, `Loket 3`).
  - Nomor yang sedang dilayani tampil sangat besar di tengah kartu.
  - Nama kasir bertugas tampil di bagian bawah kartu dengan teks abu-abu lembut.
  - *Efek Animasi*: Loket yang baru saja memanggil antrean akan mendapatkan efek ring animasi berkedip (`ring-4 ring-amber-400 animate-pulse`).
- **Footer Running Text**: Latar belakang biru tua (`bg-blue-900`) dengan pesan layanan pelanggan Intan Banjar.

#### C. Tiket Mobile Smartphone (`ticket.html`)
- **Tampilan Card Bersih**: Kartu putih dengan aksen garis atas berwarna biru (`border-t-4 border-blue-800`).
- **Indikator Live Status**:
  - Titik hijau berkedip (*pulsing dot*) menandakan koneksi Supabase Realtime *live*.
  - Menampilkan: **Nomor Tiket Anda**, **Estimasi Antrean di Depan**, dan **Loket yang Dituju**.

#### D. Panel Operasional Kasir (`counter.html`)
- **Struktur**: Top Navbar minimalis berwarna putih dengan aksen biru dan informasi nomor loket yang aktif.
- **Kartu Utama Antrean Aktif**: Kotak besar di tengah layar menampilkan nomor yang sedang dilayani dengan font tegas (`text-6xl font-black text-slate-800`).
- **Tombol Aksi Kasir**:
  - `Panggil Berikutnya`: `bg-blue-800 hover:bg-blue-900 text-white font-semibold py-3 px-6 rounded-xl shadow-sm`
  - `Selesai`: `bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-6 rounded-xl`
  - `Lewati`: `bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-xl`
  - `Panggil Ulang (Recall)`: `bg-amber-600 hover:bg-amber-700 text-white py-3 px-6 rounded-xl`
- **Tab Antrean Terlewat & Riwayat**: Panel samping/bawah untuk melihat daftar antrean yang dilewati lengkap dengan tombol *Panggil Kembali*.

#### E. Dashboard Analitik & Laporan Admin (`admin.html`)
- **Layout & Navigasi**: Header admin dengan navigasi cepat, rentang filter tanggal (*Date Range Picker*), dan tombol aksi utama **"Export Laporan Eksekutif (PDF)"** (`bg-blue-800 hover:bg-blue-900 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2`).
- **Grid Ringkasan Metrik KPI (4 Card Ringkas)**:
  1. *Total Antrean*: Card putih (`border-l-4 border-blue-800`), angka besar `text-3xl font-bold text-slate-800`.
  2. *Antrean Selesai*: Card putih (`border-l-4 border-emerald-500`), teks indikator sukses.
  3. *Antrean Terlewat*: Card putih (`border-l-4 border-red-500`), teks indikator lewati.
  4. *Rata-rata Waktu Layanan & Tunggu*: Card putih (`border-l-4 border-amber-500`), menampilkan durasi dalam format menit/detik.
- **Tabel Transaksi Antrean Real-time**:
  - Header tabel: `bg-slate-100 text-slate-700 font-semibold text-xs uppercase tracking-wider py-3 px-4`.
  - Kolom: No. Antrean, Metode (Cetak/QR), Loket, Kasir Bertugas, Waktu Ambil, Waktu Panggil, Waktu Selesai, Status (*Badge Color*), dan Total Durasi.
  - Baris selang-seling halus (`hover:bg-sky-50 transition-colors`).
- **Modal / Preview Ekspor PDF**: Desain dokumen PDF eksekutif terpadu dengan kop surat resmi PT Air Minum Intan Banjar, tabel rekapitulasi, dan tanda tangan pengesahan supervisor.

---

### 5. REKOMENDASI SNIPPET HEADER HTML (TEMPLATE KONSISTEN)

```html
<!-- Standar Header Komponen Intan Banjar -->
<header class="bg-white border-b border-slate-200 shadow-sm py-4 px-6 flex items-center justify-between">
    <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-blue-800 flex items-center justify-center text-white font-bold text-xl shadow-inner">
            IB
        </div>
        <div>
            <h1 class="text-lg font-bold text-slate-800 leading-tight">PT Air Minum Intan Banjar</h1>
            <p class="text-xs text-slate-500 font-medium">Sistem Manajemen Antrean Kasir</p>
        </div>
    </div>
    <div class="text-right">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Sistem Aktif
        </span>
    </div>
</header>
```
