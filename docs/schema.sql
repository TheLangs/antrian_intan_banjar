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

-- Configure database timezone for Banjarmasin/Banjar (WITA / UTC+8)
ALTER DATABASE postgres SET timezone TO 'Asia/Makassar';
ALTER ROLE anon SET timezone TO 'Asia/Makassar';
ALTER ROLE authenticated SET timezone TO 'Asia/Makassar';
ALTER ROLE service_role SET timezone TO 'Asia/Makassar';
ALTER ROLE postgres SET timezone TO 'Asia/Makassar';

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
    v_today_start TIMESTAMPTZ := (date_trunc('day', NOW() AT TIME ZONE 'Asia/Makassar') AT TIME ZONE 'Asia/Makassar');
    v_next_no INT;
    v_new_id BIGINT;
    v_result json;
BEGIN
    -- Atomic Lock: Ambil nomor terakhir hari ini (WITA)
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
    v_today_start TIMESTAMPTZ := (date_trunc('day', NOW() AT TIME ZONE 'Asia/Makassar') AT TIME ZONE 'Asia/Makassar');
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
