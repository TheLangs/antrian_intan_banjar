# WORKFLOW & EXECUTION STEPS (WORKFLOW.md)
## Target Stack: Supabase (BaaS) + GitHub Pages (Static Hosting)

---

### TAHAPAN EKSEKUSI OLEH AI AGENT (ANTIGRAVITY)

#### FASE 1: STRUKTUR PROYEK & KONEKSI SUPABASE
- [ ] Buat skrip `schema.sql` lengkap dengan definisi 3 tabel (`loket`, `antrian`, `admin`), realtime publications, dan RPC functions.
- [ ] Buat file konfigurasi `assets/js/supabaseClient.js` dengan import CDN `@supabase/supabase-js`.

#### FASE 2: IMPLEMENTASI FRONTEND KIOSK & TIKET MOBILE
- [ ] Buat `index.html` dan `assets/js/kiosk.js` sesuai styling `DESIGN.md` (Pilihan Cetak Fisik & Scan QR via library QRCode CDN).
- [ ] Buat `ticket.html` dan `assets/js/ticket.js` yang terhubung ke Supabase Realtime Channel untuk pembaruan status live tiket di smartphone.

#### FASE 3: OPERASIONAL KASIR & LOCK GUARD
- [ ] Buat `counter_login.html` untuk pemilihan loket dengan validasi `last_seen` dan `session_token`.
- [ ] Buat `counter.html` dan `assets/js/counter.js` yang mengimplementasikan RPC `call_next_queue`, tombol Selesai, Lewati, Recall, dan heartbeat sender.

#### FASE 4: LAYAR DISPLAY RUANG TUNGGU TV
- [ ] Buat `display.html` dan `assets/js/display.js` (Rasio 16:9 fullscreen, 3 card loket, Supabase Realtime Listener, Sound Bell & Text-to-Speech).

#### FASE 5: ADMIN DASHBOARD & EXPORT PDF CLIENT-SIDE
- [ ] Buat `admin_login.html` dan `admin.html`.
- [ ] Buat `assets/js/admin.js` yang menarik data analitik dari Supabase dan menghasilkan 1 file PDF Laporan Eksekutif Terpadu menggunakan `jsPDF` dan `jspdf-autotable`.
