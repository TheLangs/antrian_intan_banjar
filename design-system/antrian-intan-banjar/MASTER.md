# Design System Master File: PT Air Minum Intan Banjar

> **LOGIC:** This is the Single Source of Truth for all UI/UX guidelines mapping to the finalized, approved **"Classic Admin Dashboard"** style. Avoid arbitrary styling or unauthorized semantic abstractions. Stick to the raw Tailwind
> utility classes described here unless explicitly needed.

---

**Project:** Antrian Intan Banjar **Category:** B2B / Public Service Utility **Mood:** Legal, professional, clean, flat-design with high contrast. **Anti-Pattern Alert:** ❌ No glassmorphism, ❌ No neon gradients, ❌ No AI purple/pink
palettes.

---

## 1. Global Rules & Identity

### A. Color Palette (Raw Tailwind Classes & Variables)

The application relies heavily on Tailwind's default colors structured around a clean blue corporate identity. Do **not** use arbitrary HEX values in HTML.

| Role                 | HEX Reference | Tailwind Class     | Usage / Target UI                                               |
| -------------------- | ------------- | ------------------ | --------------------------------------------------------------- |
| **Primary (Brand)**  | `#0B5C9E`     | `bg-blue-800`      | Sidebar admin, header kartu, tombol aksi utama, logo container. |
| **Primary Hover**    | `#1E3A8A`     | `bg-blue-900`      | State saat hover pada tombol utama.                             |
| **Accent / CTA**     | `#0088CC`     | `bg-sky-600`       | Menu sidebar aktif, tautan teks, highlight status.              |
| **Background Base**  | `#F8FAFC`     | `bg-slate-50`      | Latar belakang seluruh halaman utama.                           |
| **Card / Surface**   | `#FFFFFF`     | `bg-white`         | Latar belakang setiap box, card, atau modal.                    |
| **Card Border**      | `#E2E8F0`     | `border-slate-200` | Garis pinggir semua komponen form, tabel, dan card.             |
| **Text Primary**     | `#1E293B`     | `text-slate-800`   | Teks judul utama, angka kritis, nomor antrean.                  |
| **Text Secondary**   | `#64748B`     | `text-slate-500`   | Sub-judul, placeholder, label waktu.                            |
| **Success / Done**   | `#059669`     | `bg-emerald-600`   | Tombol 'Selesai', badge indikator sukses.                       |
| **Warning / Recall** | `#D97706`     | `bg-amber-600`     | Sorotan kartu kedip, tombol "Panggil Ulang".                    |
| **Danger / Skip**    | `#DC2626`     | `bg-red-600`       | Tombol "Lewati", logout, notifikasi kesalahan.                  |

---

### B. Typography

We utilize modern, highly legible sans-serif typefaces suitable for both dense dashboards and large television displays.

- **Font Stack:** `Inter`, `Plus Jakarta Sans`, atau bawaan Tailwind `system-ui`, `sans-serif`. (Jangan gunakan serif seperti EB Garamond untuk UI ini).
- **Scale:**
  - `text-[5.5rem]` s.d `text-9xl` (`font-black`) : Layar antrean TV, tiket mobile.
  - `text-2xl` s.d `text-3xl` (`font-bold`) : Header Dashboard.
  - `text-xs` s.d `text-sm` (`font-semibold`) : Label tebal kecil (_uppercase tracking-wider_).

---

### C. Component Styles (Admin Aesthetics)

#### 1. Cards (Kotak Konten)

Menggunakan pendekatan datar (_flat_) namun tegas:

```html
<div class="bg-white border border-slate-200 rounded-xl shadow-sm p-5">...</div>
```

#### 2. Buttons

```css
/* Primary Blue */
class="bg-blue-800 hover:bg-blue-900 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors"
/* Secondary White */
class="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold py-2.5 px-4 rounded-xl transition-colors"
```

#### 3. Data Tables

Batas tipis dengan latar kepala tabel abu-abu terang:

```html
<thead class="bg-slate-50 border-b border-slate-200">
  <tr class="text-xs uppercase tracking-wider font-bold text-slate-500">
    ...
  </tr>
</thead>
```

---

## 2. Component Guidelines Per Module

#### A. Kios Antrean Pelanggan (`index.html`)

- **Header**: Logo Intan Banjar + Judul Sistem Pelayanan Kasir.
- **Kartu Opsi**: Sangat kontras. Tombol "Cetak Fisik" menggunakan latar putih dengan bingkai `border-blue-800`. Opsi digital menggunakan `bg-blue-800`.
- **Eksekusi UI**: `rounded-2xl`, tombol raksasa, mudah ditekan lansia.

#### B. Display Layar TV (`display.html`)

- **Format**: Layar penuh dengan `bg-slate-50` bersih.
- **Grid Loket**: Header menggunakan balok tegas warna `bg-blue-800 text-white`. Bagian dalam menampilkan kartu putih luas tanpa gradien (rata, jelas).
- **Notifikasi TV**: Jika antrean dipanggil, jangan gunakan _neon/glow_, melainkan bingkai ring tegas `ring-4 ring-amber-500 animate-pulse` yang menimpa `bg-blue-800` menjadi `bg-amber-500` sementara waktu.

#### C. Dashboard Admin (`admin.html`)

- **Sidebar Khusus**: `bg-blue-900` dengan elemen logo `bg-white p-1.5 rounded-lg`. Latar aktif nav menggunakan `var(--color-accent)` (`#0088cc`).
- **Dashboard Layout**: Latar ruang utama abu paling muda (`bg-slate-50`).
- **Standardisasi Header Halaman**:

```html
<header class="bg-white border-b border-slate-200 shadow-sm py-4 px-6 flex flex-row items-center justify-between">
  <div class="flex items-center gap-3">
    <h1 class="text-xl font-bold text-slate-800 leading-tight">Overview</h1>
  </div>
</header>
```

---

## 3. Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] ❌ No emojis used as icons (use Lucide SVG exclusively).
- [ ] ❌ No layout-shifting hovers or arbitrary color variables outside the Tailwind palete.
- [ ] ❌ NEVER use unreadable contrast; always test text on dark vs light backgrounds.
- [ ] `cursor-pointer` is placed on all interactive target items.
- [ ] Display widgets and layout adapt gracefully without horizontal scrolling on mobile (`overflow-x-hidden`).
