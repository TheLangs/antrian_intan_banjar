---
name: queue-system-supabase-builder
description: Skill guidelines, architectural boundaries, and deterministic client-side implementation rules for building the Supabase + GitHub Pages Queue Management System.
---

# Skills & Implementation Directives: Supabase + GitHub Pages Builder

## 1. Skill Profile & Technology Constraints
- **Role**: Senior Frontend & Serverless Architect.
- **Client Stack**: Pure HTML5, Tailwind CSS (via CDN), Vanilla JavaScript (Modern ES6 Modules / Async-Await).
- **Backend as a Service**: Supabase (PostgreSQL, Supabase Realtime, Supabase JS SDK v2 via CDN).
- **PDF Engine**: Client-side `jspdf` & `jspdf-autotable`.
- **Target Deployment**: Static Site Hosting (GitHub Pages / Vercel).
- **STRICT PROHIBITION**: 
  - DILARANG menggunakan PHP (`.php`), Apache, MySQL, atau backend runtime berbasis Node/Express server.
  - DILARANG membuat polling berulang setInterval untuk data utama; WAJIB gunakan Supabase Realtime WebSockets (`supabase.channel()`).

---

## 2. Mandatory Coding Guidelines & Standards

### A. Centralized Supabase Client Config (`assets/js/supabaseClient.js`)
Seluruh halaman wajib mengimpor satu client Supabase terpusat:
```javascript
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

### B. Realtime Subscription Pattern
Gunakan channel subscription untuk mendengarkan mutasi data secara instan:
```javascript
supabase
  .channel('public:antrian')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'antrian' }, (payload) => {
    console.log('Realtime update received:', payload);
    refreshQueueDisplay(payload);
  })
  .subscribe();
```

### C. Concurrency Guarding via Supabase RPC
Jangan melakukan kalkulasi `MAX(nomor_antrian)` di JavaScript browser untuk menghindari duplikasi nomor saat tombol ditekan bersamaan. WAJIB panggil PostgreSQL Function:
```javascript
const { data, error } = await supabase.rpc('generate_queue_number', {
  p_metode: 'qr',
  p_access_token: crypto.randomUUID()
});
```

### D. Zero-Redundancy Single Executive PDF Report (`assets/js/admin.js`)
Laporan analitik dihasilkan langsung di browser dengan jsPDF:
```javascript
import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf/+esm';
import 'https://cdn.jsdelivr.net/npm/jspdf-autotable';

// Menghitung selisih waktu langsung dari timestamp data Supabase
const waktuTungguDetik = (new Date(item.waktu_panggil) - new Date(item.waktu_ambil)) / 1000;
```
