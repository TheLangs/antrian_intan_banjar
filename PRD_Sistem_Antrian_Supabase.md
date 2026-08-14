# Product Requirement Document (PRD)
## Sistem Informasi Manajemen Antrean Hybrid (3 Loket Kasir)
### Architecture: HTML5, Tailwind CSS, Vanilla JS, Supabase (PostgreSQL + Realtime), GitHub Pages

---

### 1. RINGKASAN EKSEKUTIF
Sistem Informasi Manajemen Antrean Hybrid adalah aplikasi web static-hosted client-side yang terintegrasi secara langsung dengan **Supabase** (BaaS - Backend as a Service). Dirancang untuk mengelola antrean 3 loket kasir secara simultan dengan sinkronisasi data instan milidetik menggunakan **Supabase Realtime WebSockets**. Sistem mendukung pendaftaran tiket fisik (thermal) / tiket digital QR, operasional kasir FIFO tanpa password yang diamankan dengan session locking, layar monitor ruang tunggu TV 16:9, dan dashboard analitik eksekutif dengan export PDF client-side.

---

### 2. ARSITEKTUR TEKNOLOGI & INFRASTRUKTUR
- **Frontend / Client**: HTML5, Tailwind CSS (via CDN), Vanilla JavaScript (ES6 Modules).
- **Backend & Database**: Supabase (PostgreSQL 15+, Supabase Realtime, PostgREST, Database RPC Functions).
- **Client SDK**: `@supabase/supabase-js` (via unpkg/jsdelivr CDN).
- **Hosting Target**: GitHub Pages (Static Hosting, HTTPS default, Zero-Server Maintenance).
- **PDF Generation**: Client-side `jspdf` & `jspdf-autotable` via CDN.
- **Audio Notification**: Web Audio API / HTML5 Audio & Web Speech Synthesis API.

---

### 3. SKEMA DATABASE POSTGRESQL FINAL & RPC FUNCTIONS (SUPABASE SQL EDITOR)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABEL LOKET
CREATE TABLE IF NOT EXISTS public.loket (
    id_loket SMALLINT PRIMARY KEY,
    nomor_loket SMALLINT NOT NULL UNIQUE,
    nama_loket VARCHAR(50) NOT NULL,
    status_aktif VARCHAR(20) DEFAULT 'aktif' CHECK (status_aktif IN ('aktif', 'nonaktif')),
    session_token VARCHAR(64) NULL,
    nama_petugas VARCHAR(100) NULL,
    last_seen TIMESTAMPTZ NULL
);

-- Seed Data Loket
INSERT INTO public.loket (id_loket, nomor_loket, nama_loket)
VALUES 
    (1, 1, 'Loket 1'),
    (2, 2, 'Loket 2'),
    (3, 3, 'Loket 3')
ON CONFLICT (id_loket) DO NOTHING;

-- 2. TABEL ADMIN
CREATE TABLE IF NOT EXISTS public.admin (
    id_admin UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nama_lengkap VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL ANTRIAN
CREATE TABLE IF NOT EXISTS public.antrian (
    id_antrian BIGSERIAL PRIMARY KEY,
    nomor_antrian INT NOT NULL,
    kode_antrian VARCHAR(10) NOT NULL DEFAULT 'A',
    metode_tiket VARCHAR(20) NOT NULL CHECK (metode_tiket IN ('cetak', 'qr')),
    access_token VARCHAR(64) NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'dipanggil', 'selesai', 'terlewat', 'batal')),
    id_loket SMALLINT NULL REFERENCES public.loket(id_loket) ON DELETE SET NULL,
    nama_petugas VARCHAR(100) NULL,
    waktu_ambil TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    waktu_panggil TIMESTAMPTZ NULL,
    waktu_selesai TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for Antrian and Loket
ALTER PUBLICATION supabase_realtime ADD TABLE public.antrian;
ALTER PUBLICATION supabase_realtime ADD TABLE public.loket;

-- Indexes for high-performance querying
CREATE INDEX IF NOT EXISTS idx_antrian_status_waktu ON public.antrian (status, waktu_ambil);
CREATE INDEX IF NOT EXISTS idx_antrian_token ON public.antrian (access_token);
CREATE INDEX IF NOT EXISTS idx_antrian_laporan ON public.antrian (waktu_ambil, status);

-- 4. RPC FUNCTION: ATOMIC GENERATE QUEUE NUMBER
CREATE OR REPLACE FUNCTION generate_queue_number(p_metode VARCHAR, p_access_token VARCHAR DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today_start TIMESTAMPTZ := date_trunc('day', NOW());
    v_next_no INT;
    v_new_id BIGINT;
    v_result json;
BEGIN
    -- Atomic Lock: Ambil nomor terakhir hari ini
    SELECT COALESCE(MAX(nomor_antrian), 0) + 1
    INTO v_next_no
    FROM public.antrian
    WHERE waktu_ambil >= v_today_start;

    -- Insert nomor baru
    INSERT INTO public.antrian (nomor_antrian, kode_antrian, metode_tiket, access_token, status, waktu_ambil)
    VALUES (v_next_no, 'A', p_metode, p_access_token, 'menunggu', NOW())
    RETURNING id_antrian INTO v_new_id;

    SELECT json_build_object(
        'success', true,
        'id_antrian', v_new_id,
        'nomor_antrian', v_next_no,
        'nomor_lengkap', 'A-' || LPAD(v_next_no::text, 3, '0'),
        'access_token', p_access_token
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- 5. RPC FUNCTION: ATOMIC CALL NEXT FIFO QUEUE
CREATE OR REPLACE FUNCTION call_next_queue(p_id_loket SMALLINT, p_nama_petugas VARCHAR)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today_start TIMESTAMPTZ := date_trunc('day', NOW());
    v_active_id BIGINT;
    v_next_id BIGINT;
    v_queue_data RECORD;
    v_result json;
BEGIN
    -- Cek apakah loket masih memiliki antrean aktif yang belum selesai/dilewati
    SELECT id_antrian INTO v_active_id
    FROM public.antrian
    WHERE id_loket = p_id_loket AND status = 'dipanggil' AND waktu_ambil >= v_today_start
    LIMIT 1;

    IF v_active_id IS NOT NULL THEN
        RETURN json_build_object('success', false, 'message', 'Selesaikan atau lewati antrean saat ini terlebih dahulu.');
    END IF;

    -- Ambil antrean status menunggu urutan pertama (FIFO Atomic Lock)
    SELECT id_antrian, nomor_antrian, kode_antrian
    INTO v_queue_data
    FROM public.antrian
    WHERE status = 'menunggu' AND waktu_ambil >= v_today_start
    ORDER BY id_antrian ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_queue_data.id_antrian IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Tidak ada antrean yang sedang menunggu.');
    END IF;

    -- Update status menjadi dipanggil
    UPDATE public.antrian
    SET status = 'dipanggil',
        id_loket = p_id_loket,
        nama_petugas = p_nama_petugas,
        waktu_panggil = NOW()
    WHERE id_antrian = v_queue_data.id_antrian;

    -- Update info petugas di tabel loket
    UPDATE public.loket
    SET nama_petugas = p_nama_petugas,
        last_seen = NOW()
    WHERE id_loket = p_id_loket;

    RETURN json_build_object(
        'success', true,
        'id_antrian', v_queue_data.id_antrian,
        'nomor_lengkap', v_queue_data.kode_antrian || '-' || LPAD(v_queue_data.nomor_antrian::text, 3, '0')
    );
END;
$$;
```

---

### 4. SPESIFIKASI MODUL & INTERAKSI CLIENT-SIDE

#### 4.1 Modul Kios Registrasi Tiket (`index.html`)
- Dua aksi utama: **Cetak Tiket Fisik** & **Scan QR Code (Tiket Digital)**.
- Menjalankan `supabase.rpc('generate_queue_number', { p_metode, p_access_token })`.
- Cetak Tiket: Trigger browser print template ESC/POS 58mm / 80mm.
- QR Code: Menghasilkan QR code ke URL `ticket.html?token={access_token}`.

#### 4.2 Modul Pantau Tiket Smartphone (`ticket.html`)
- Menggunakan `supabase.channel('public:antrian')` Realtime Subscription.
- Mendengarkan perubahan baris yang memiliki `access_token` sesuai URL.
- Menampilkan update instan: status antrean, estimasi sisa orang di depan, dan notifikasi saat loket memanggil.

#### 4.3 Modul Display Monitor TV Ruang Tunggu (`display.html`)
- Fullscreen 16:9 responsive Tailwind grid layout.
- Realtime Listener: `supabase.channel('display-channel').on('postgres_changes', { event: '*', schema: 'public', table: 'antrian' })`.
- Begitu ada record berubah menjadi `status = 'dipanggil'`, sistem memicu:
  1. Highlight visual ring card loket bersangkutan (`animate-pulse`).
  2. Suara Bel Notifikasi (Audio Ding-Dong).
  3. Suara Web Speech API Bahasa Indonesia: *"Nomor antrean A, 0, 0, 5, silakan menuju Loket 1"*.

#### 4.4 Modul Kasir Operasional (`counter.html`)
- Login Session Lock tanpa password: Cek `loket.last_seen`. Jika `NOW() - last_seen < 30 detik` dan `session_token` berbeda, tolak login.
- Tombol Aksi:
  - **Panggil Berikutnya**: Trigger `call_next_queue(p_id_loket, p_nama_petugas)`.
  - **Selesai**: Update `status = 'selesai'`, `waktu_selesai = NOW()`.
  - **Lewati**: Update `status = 'terlewat'`, `waktu_selesai = NOW()`.
  - **Panggil Ulang (Recall)**: Broadcast event pemanggilan ulang audio ke Display TV.
  - **Panggil Kembali Terlewat**: Update item antrean terlewat spesifik menjadi `status = 'dipanggil'`.
- Heartbeat: Mengirimkan ping `UPDATE loket SET last_seen = NOW()` setiap 10 detik.

#### 4.5 Modul Admin Analitik & Export PDF (`admin.html`)
- Login admin sederhana via kredensial Supabase.
- Widget KPI Real-time: Total antrean, Selesai, Terlewat, Rata-rata waktu tunggu & waktu layanan.
- **Export Single Executive PDF**: Menggunakan `jsPDF` + `jspdf-autotable` yang menghitung metrik durasi langsung dari query PostgreSQL Supabase.
