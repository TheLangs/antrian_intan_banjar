import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  // Auth Check
  const adminId = localStorage.getItem('ib_admin_id');
  if (!adminId) {
    window.location.href = 'admin_login.html';
    return;
  }
  const adminNameEl = document.getElementById('admin-name');
  if (adminNameEl) {
    adminNameEl.textContent = localStorage.getItem('ib_admin_name') || 'Admin';
  }

  // UI elements
  const inpStart = document.getElementById('ov-date');
  const inpEnd = document.getElementById('ov-date'); // Bento uses single date for overview
  const btnFilter = document.getElementById('btn-filter') || document.createElement('button'); // Fallback if no filter button
  const btnExport = document.querySelector('[data-export="overview"]') || document.createElement('button');
  const btnLogout = document.getElementById('btn-logout') || document.querySelector('[id="btn-logout"]');

  const kpiTotal = document.getElementById('ov-total');
  const kpiSelesai = document.getElementById('ov-selesai');
  const kpiTerlewat = document.getElementById('ov-terlewat');
  const kpiAvgWait = document.getElementById('ov-avg-wait');

  const tableBody = document.getElementById('table-body') || document.getElementById('hs-tbody');
  const tableEmpty = document.getElementById('table-empty') || document.getElementById('hs-empty');
  const loader = document.getElementById('loader');

  let currentReportData = [];

  // Set default dates (Today)
  const today = new Date();
  // Offset local timezone for ISO format
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  if (inpStart) inpStart.value = localToday;
  if (inpEnd) inpEnd.value = localToday;

  // Events
  if (btnFilter) btnFilter.addEventListener('click', fetchData);
  if (btnLogout)
    btnLogout.addEventListener('click', () => {
      localStorage.clear();
      window.location.href = 'admin_login.html';
    });
  if (btnExport) btnExport.addEventListener('click', generatePDF);
  if (inpStart) inpStart.addEventListener('change', fetchData);

  // Sidebar Tabs Logic
  const navItems = document.querySelectorAll('.nav-item[data-tab]');
  const tabContents = document.querySelectorAll('.tab-content');
  navItems.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      navItems.forEach((n) => n.classList.remove('active', 'text-slate-800'));
      tabContents.forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
      const targetId = 'tab-' + btn.getAttribute('data-tab');
      document.getElementById(targetId)?.classList.add('active');
    });
  });

  // Initial Load
  fetchData();

  async function fetchData() {
    if (loader) loader.classList.remove('hidden');
    if (tableEmpty) {
      tableEmpty.classList.add('hidden');
    }
    if (tableBody) {
      tableBody.innerHTML = '';
    }

    try {
      const today = new Date();
      let startD = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0] + 'T00:00:00.000Z';
      let endD = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0] + 'T23:59:59.999Z';

      if (inpStart && inpStart.value) {
        startD = new Date(inpStart.value + 'T00:00:00').toISOString();
        endD = new Date(inpStart.value + 'T23:59:59').toISOString();
      }

      const [resAntrian, resLoket] = await Promise.all([
        supabase.from('antrian').select('*, loket(nama_loket)').gte('waktu_ambil', startD).lte('waktu_ambil', endD).order('id_antrian', { ascending: true }),
        supabase.from('loket').select('*'),
      ]);

      if (resAntrian.error) throw resAntrian.error;

      currentReportData = resAntrian.data || [];
      processAndRender(currentReportData, resLoket.data || []);
    } catch (err) {
      console.error(err);
      alert('Gagal memuat data laporan.');
    } finally {
      if (loader) loader.classList.add('hidden');
    }
  }

  function processAndRender(data, loketData = []) {
    if (data.length === 0) {
      if (tableEmpty) tableEmpty.classList.remove('hidden');
      kpiTotal.textContent = '0';
      kpiSelesai.textContent = '0';
      kpiTerlewat.textContent = '0';
      kpiAvgWait.textContent = '0m 0s';
      if (typeof renderLoketCards === 'function') renderLoketCards('ov-loket-cards', data, loketData);
      return;
    }

    let cntTotal = data.length;
    let cntSelesai = 0;
    let cntTerlewat = 0;
    let totalWaitTimeSec = 0;
    let waitCount = 0;

    data.forEach((item) => {
      if (item.status === 'selesai') cntSelesai++;
      if (item.status === 'terlewat' || item.status === 'batal') cntTerlewat++;

      // Wait Time Calc (Manual logic based off timestamps instead of complex DB TimestampDiff)
      let waitTimeStr = '-';
      let svcTimeStr = '-';

      if (item.waktu_panggil) {
        const w = (new Date(item.waktu_panggil) - new Date(item.waktu_ambil)) / 1000;
        if (w > 0) {
          totalWaitTimeSec += w;
          waitCount++;
          waitTimeStr = formatSec(w);
        }
      }

      if (item.waktu_panggil && item.waktu_selesai) {
        const s = (new Date(item.waktu_selesai) - new Date(item.waktu_panggil)) / 1000;
        if (s > 0) svcTimeStr = formatSec(s);
      }

      // Render Row
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition-colors';

      let statusBadge = '';
      if (item.status === 'selesai') statusBadge = '<span class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">Selesai</span>';
      else if (item.status === 'terlewat') statusBadge = '<span class="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">Terlewat</span>';
      else if (item.status === 'dipanggil') statusBadge = '<span class="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">Dipanggil</span>';
      else statusBadge = '<span class="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">Menunggu</span>';

      const noLengkap = `${item.kode_antrian}-${String(item.nomor_antrian).padStart(3, '0')}`;

      tr.innerHTML = `
                <td class="px-6 py-4 font-bold text-slate-800">${noLengkap}</td>
                <td class="px-6 py-4 uppercase text-xs font-bold text-slate-500">${item.metode_tiket}</td>
                <td class="px-6 py-4">${item.loket?.nama_loket || '-'}</td>
                <td class="px-6 py-4">${item.nama_petugas || '-'}</td>
                <td class="px-6 py-4 text-xs font-mono text-slate-500">${new Date(item.waktu_ambil).toLocaleTimeString('id-ID')}</td>
                <td class="px-6 py-4 text-amber-600">${waitTimeStr}</td>
                <td class="px-6 py-4 text-emerald-600">${svcTimeStr}</td>
                <td class="px-6 py-4">${statusBadge}</td>
            `;
      if (tableBody) tableBody.appendChild(tr);
    });

    // Update KPIs
    kpiTotal.textContent = cntTotal;
    kpiSelesai.textContent = cntSelesai;
    kpiTerlewat.textContent = cntTerlewat;

    if (waitCount > 0) {
      kpiAvgWait.textContent = formatSec(totalWaitTimeSec / waitCount);
    } else {
      kpiAvgWait.textContent = '0m 0s';
    }

    // Extra Data Hooks for Bento
    const kpiSuccessPct = document.getElementById('ov-success-pct');
    if (kpiSuccessPct) kpiSuccessPct.textContent = Math.round((cntSelesai / (cntTotal || 1)) * 100) + '%';

    if (typeof renderLoketCards === 'function') renderLoketCards('ov-loket-cards', data, loketData);
    if (typeof renderRecentEvents === 'function') renderRecentEvents('ov-recent-events', data);

    // Call new analytics renderers
    if (typeof renderKasirAnalytics === 'function') renderKasirAnalytics(data);
    if (typeof renderTrafficAnalytics === 'function') renderTrafficAnalytics(data);
    if (typeof renderDigitalAnalytics === 'function') renderDigitalAnalytics(data);
  }

  function formatSec(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
  }

  function generatePDF() {
    if (currentReportData.length === 0) {
      alert('Tidak ada data untuk diekspor!');
      return;
    }

    btnExport.disabled = true;
    btnExport.innerHTML = '<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span> Memproses...';

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape');

      // Styles & Branding Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(11, 92, 158); // #0B5C9E (Brand Primary)
      doc.text('PT AIR MINUM INTAN BANJAR (PERSERODA)', 14, 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text('Laporan Eksekutif Performa Sistem Analitik Antrean.', 14, 28);

      doc.setFontSize(10);
      doc.text(`Periode: ${new Date(inpStart.value).toLocaleDateString('id-ID')} s/d ${new Date(inpEnd.value).toLocaleDateString('id-ID')}`, 14, 34);

      // Prep Table Data
      const tableColumn = ['ID', 'Nomor', 'Platform', 'Status', 'Loket', 'Petugas', 'Pukul Ambil', 'Pukul Panggil', 'Pukul Selesai', 'Wt. Tunggu', 'Wt. Layan'];
      const tableRows = [];

      currentReportData.forEach((item) => {
        let waitTimeStr = '-';
        let svcTimeStr = '-';

        if (item.waktu_panggil) {
          const w = (new Date(item.waktu_panggil) - new Date(item.waktu_ambil)) / 1000;
          if (w > 0) waitTimeStr = formatSec(w);
        }

        if (item.waktu_selesai && item.waktu_panggil) {
          const s = (new Date(item.waktu_selesai) - new Date(item.waktu_panggil)) / 1000;
          if (s > 0) svcTimeStr = formatSec(s);
        }

        const noLengkap = `${item.kode_antrian}-${String(item.nomor_antrian).padStart(3, '0')}`;

        const row = [
          item.id_antrian,
          noLengkap,
          (item.metode_tiket || '').toUpperCase(),
          (item.status || '').toUpperCase(),
          item.loket?.nama_loket || '-',
          item.nama_petugas || '-',
          item.waktu_ambil ? new Date(item.waktu_ambil).toLocaleTimeString('id-ID') : '-',
          item.waktu_panggil ? new Date(item.waktu_panggil).toLocaleTimeString('id-ID') : '-',
          item.waktu_selesai ? new Date(item.waktu_selesai).toLocaleTimeString('id-ID') : '-',
          waitTimeStr,
          svcTimeStr,
        ];
        tableRows.push(row);
      });

      // Trigger AutoTable Plugin
      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        theme: 'striped',
        headStyles: { fillColor: [11, 92, 158] },
        styles: { fontSize: 8 },
      });

      // Summary at the bottom
      const finalY = doc.lastAutoTable.finalY || 40;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Total Ringkasan:', 14, finalY + 12);
      doc.setFont('helvetica', 'normal');
      doc.text(`- Seluruh Antrean: ${kpiTotal.textContent}`, 14, finalY + 18);
      doc.text(`- Sukses Dilayani: ${kpiSelesai.textContent}`, 14, finalY + 24);
      doc.text(`- Terlewat/Batal: ${kpiTerlewat.textContent}`, 14, finalY + 30);
      doc.text(`- Rata-rata Menunggu: ${kpiAvgWait.textContent}`, 14, finalY + 36);

      // Doc Stamp
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Digenerate oleh sistem pada: ${new Date().toLocaleString('id-ID')}`, 14, doc.internal.pageSize.getHeight() - 10);

      // Save
      doc.save(`Laporan_Antrean_Intan_Banjar_${inpStart.value}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Gagal merender PDF');
    } finally {
      // Reset Btn
      btnExport.disabled = false;
      btnExport.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Export PDF`;
    }
  }

  /* LOKET CARDS & EVENTS */
  function renderLoketCards(containerId, data, loketData = []) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = '';

    let ls = {
      'Loket 1': { n: 'Loket 1', pet: 'Offline / Kosong', cnt: 0, currentTicket: '-', status: 'Offline', ts: 0 },
      'Loket 2': { n: 'Loket 2', pet: 'Offline / Kosong', cnt: 0, currentTicket: '-', status: 'Offline', ts: 0 },
      'Loket 3': { n: 'Loket 3', pet: 'Offline / Kosong', cnt: 0, currentTicket: '-', status: 'Offline', ts: 0 },
    };

    // Pre-fill with live active session data
    loketData.forEach((l) => {
      let nm = l.nama_loket || 'Loket ' + l.id_loket;
      if (ls[nm]) {
        // Track true session state
        ls[nm].isOnline = !!l.session_token;
      }
    });

    data.forEach((x) => {
      if (!x.id_loket) return;
      let nm = x.loket?.nama_loket || 'Loket ' + x.id_loket;
      if (!ls[nm]) {
        ls[nm] = { n: nm, pet: 'Offline / Kosong', cnt: 0, currentTicket: '-', status: 'Offline', ts: 0, isOnline: false };
      }
      if (['panggil', 'selesai', 'terlewat'].includes(x.status)) ls[nm].cnt++;

      let time = new Date(x.waktu_panggil || x.waktu_ambil).getTime();
      if (x.status === 'panggil' && (!ls[nm].ts || time > ls[nm].ts)) {
        ls[nm].currentTicket = x.kode_antrian + '-' + String(x.nomor_antrian).padStart(3, '0');
        ls[nm].pet = x.nama_petugas || 'Petugas';
        ls[nm].status = 'Melayani';
        ls[nm].ts = time;
      } else if (x.status === 'selesai' && (!ls[nm].ts || time > ls[nm].ts)) {
        ls[nm].pet = x.nama_petugas || 'Petugas';
        if (ls[nm].status !== 'Melayani') ls[nm].status = 'Standby';
        ls[nm].ts = time;
      }
    });

    // Cleanup statuses based on true session state
    Object.values(ls).forEach((s) => {
      if (!s.isOnline) {
        s.status = 'Offline';
        s.pet = 'Offline / Kosong';
        s.currentTicket = '-';
      } else if (s.status === 'Offline') {
        // Online, but hasn't done any transactions yet today
        s.status = 'Standby';
        s.pet = '(Menunggu Antrean)';
      }
    });

    let arr = Object.values(ls).sort((a, b) => a.n.localeCompare(b.n));

    arr.forEach((s) => {
      let isServing = s.status === 'Melayani';
      let isStandby = s.status === 'Standby';
      let isOffline = s.status === 'Offline';

      let dotColor = isServing ? 'bg-emerald-500 animate-pulse' : isStandby ? 'bg-amber-400' : 'bg-slate-300';
      let badgeBg = isServing ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isStandby ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200';
      let topBorder = isServing
        ? '<div class="absolute top-0 left-0 w-full h-[4px] bg-emerald-500"></div>'
        : isStandby
          ? '<div class="absolute top-0 left-0 w-full h-[4px] bg-amber-400"></div>'
          : '<div class="absolute top-0 left-0 w-full h-[4px] bg-slate-300"></div>';
      let opacityClass = isOffline ? 'opacity-70' : 'opacity-100';

      c.innerHTML += `<div class="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200 relative overflow-hidden flex flex-col justify-between ${opacityClass} transition-all">
      ${topBorder}
      <div class="flex justify-between items-start mb-4 mt-1">
        <div>
          <h3 class="text-[16px] font-bold text-slate-800 flex items-center gap-2">
            ${s.n}
            <span class="relative flex h-2.5 w-2.5">
              ${isServing ? '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>' : ''}
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}"></span>
            </span>
          </h3>
          <p class="text-[11px] text-slate-500 mt-1 font-medium italic">${s.pet}</p>
        </div>
        <div class="px-2.5 py-1 ${badgeBg} rounded-full border">
          <span class="text-[10px] font-bold uppercase tracking-wider">${s.status}</span>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
        <div>
           <p class="text-[11px] text-slate-400 font-semibold mb-1">Berjalan</p>
           <p class="text-[26px] font-bold ${isServing ? 'text-emerald-600' : 'text-slate-400'} tracking-tight leading-none">${s.currentTicket}</p>
        </div>
        <div class="text-right">
           <p class="text-[11px] text-slate-400 font-semibold mb-1">Total Layan</p>
           <p class="text-[22px] font-bold text-slate-700 tracking-tight leading-none">${s.cnt}</p>
        </div>
      </div>
    </div>`;
    });
  }

  function renderRecentEvents(containerId, data) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = '';
    let sorted = [...data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

    if (!sorted.length) {
      c.innerHTML = '<tr><td colspan="3" class="py-4 text-center text-xs text-slate-500">Belum ada aktivitas.</td></tr>';
      return;
    }

    sorted.forEach((x) => {
      let b = x.status === 'selesai' ? 'bg-emerald-50 text-emerald-600' : x.status === 'panggil' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500';
      let t = x.kode_antrian + '-' + String(x.nomor_antrian).padStart(3, '0');
      c.innerHTML += `<tr class="hover:bg-slate-50/50 transition-colors">
      <td class="py-3 px-6 border-b border-slate-100">
        <span class="font-bold text-slate-800 text-[13px]">${t}</span>
      </td>
      <td class="py-3 px-6 border-b border-slate-100 text-[11px] font-medium text-slate-500">
        ${x.loket?.nama_loket || 'Loket'} - ${x.nama_petugas || 'Petugas'}
      </td>
      <td class="py-3 px-6 border-b border-slate-100">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${b}">${x.status}</span>
      </td>
    </tr>`;
    });
  }

  /* -------------------------------------------------------------
     ANALYTICS & KPI RENDERERS 
     ------------------------------------------------------------- */

  let trafficChart = null;
  let digitalChart = null;

  function renderKasirAnalytics(data) {
    const tbody = document.getElementById('ks-tbody');
    const emptyMsg = document.getElementById('ks-empty');
    if (!tbody || !emptyMsg) return;

    tbody.innerHTML = '';
    let ksMap = {};

    data.forEach((x) => {
      if (!x.nama_petugas) return;
      let key = x.nama_petugas + '_' + (x.loket?.nama_loket || 'Unknown');
      if (!ksMap[key]) {
        ksMap[key] = {
          petugas: x.nama_petugas,
          loket: x.loket?.nama_loket || '-',
          total: 0,
          selesai: 0,
          terlewat: 0,
          sumWait: 0,
          cntWait: 0,
          sumSvc: 0,
          cntSvc: 0,
        };
      }

      let k = ksMap[key];
      if (['selesai', 'panggil', 'terlewat'].includes(x.status)) k.total++;
      if (x.status === 'selesai') k.selesai++;
      if (x.status === 'terlewat') k.terlewat++;

      if (x.waktu_panggil) {
        let w = (new Date(x.waktu_panggil) - new Date(x.waktu_ambil)) / 1000;
        if (w > 0) {
          k.sumWait += w;
          k.cntWait++;
        }
      }
      if (x.waktu_selesai && x.waktu_panggil) {
        let s = (new Date(x.waktu_selesai) - new Date(x.waktu_panggil)) / 1000;
        if (s > 0) {
          k.sumSvc += s;
          k.cntSvc++;
        }
      }
    });

    let arr = Object.values(ksMap).sort((a, b) => b.total - a.total);
    if (!arr.length) {
      emptyMsg.classList.remove('hidden');
      return;
    }
    emptyMsg.classList.add('hidden');

    arr.forEach((k) => {
      let avgWait = k.cntWait > 0 ? formatSec(k.sumWait / k.cntWait) : '-';
      let avgSvc = k.cntSvc > 0 ? formatSec(k.sumSvc / k.cntSvc) : '-';
      tbody.innerHTML += `
         <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-5 py-4 font-bold text-slate-800">${k.petugas}</td>
            <td class="px-5 py-4 text-slate-500 font-medium">${k.loket}</td>
            <td class="px-5 py-4 text-center text-lg font-bold text-primary">${k.total}</td>
            <td class="px-5 py-4 text-center font-bold text-emerald-600">${k.selesai}</td>
            <td class="px-5 py-4 text-center font-bold text-red-500">${k.terlewat}</td>
            <td class="px-5 py-4 text-center text-amber-600 font-mono text-xs">${avgWait}</td>
            <td class="px-5 py-4 text-center text-slate-500 font-mono text-xs">${avgSvc}</td>
         </tr>
       `;
    });
  }

  function renderTrafficAnalytics(data) {
    const barsContainer = document.getElementById('tf-apex-chart');
    const tbody = document.getElementById('tf-tbody');
    if (!barsContainer || !tbody) return;

    let hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    let tMap = {};
    hours.forEach((h) => {
      tMap[h] = { msk: 0, sel: 0, ter: 0, sumW: 0, cntW: 0 };
    });

    data.forEach((x) => {
      let h = new Date(x.waktu_ambil).getHours();
      if (tMap[h]) {
        tMap[h].msk++;
        if (x.status === 'selesai') tMap[h].sel++;
        if (x.status === 'terlewat') tMap[h].ter++;

        if (x.waktu_panggil) {
          let w = (new Date(x.waktu_panggil) - new Date(x.waktu_ambil)) / 1000;
          if (w > 0) {
            tMap[h].sumW += w;
            tMap[h].cntW++;
          }
        }
      }
    });

    tbody.innerHTML = '';

    let jamStrs = [];
    let volData = [];

    hours.forEach((h) => {
      let d = tMap[h];
      jamStrs.push(String(h).padStart(2, '0') + ':00');
      volData.push(d.msk);

      // Table row
      let avgWait = d.cntW > 0 ? formatSec(d.sumW / d.cntW) : '-';
      let jamStr = String(h).padStart(2, '0') + ':00 - ' + String(h + 1).padStart(2, '0') + ':00';
      tbody.innerHTML += `
         <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-4 py-3 font-semibold text-slate-700">${jamStr}</td>
            <td class="px-4 py-3 text-center font-bold text-primary">${d.msk}</td>
            <td class="px-4 py-3 text-center font-bold text-emerald-600">${d.sel}</td>
            <td class="px-4 py-3 text-center font-bold text-red-500">${d.ter}</td>
            <td class="px-4 py-3 text-center text-amber-600 font-mono text-xs">${avgWait}</td>
         </tr>
       `;
    });

    if (barsContainer) {
      if (!trafficChart) {
        const options = {
          series: [{ name: 'Volume Kunjungan', data: volData }],
          chart: { type: 'bar', height: 280, toolbar: { show: false }, fontFamily: 'Inter, sans-serif' },
          plotOptions: { bar: { borderRadius: 6, columnWidth: '55%' } },
          dataLabels: { enabled: false },
          xaxis: { categories: jamStrs, labels: { style: { colors: '#64748b', fontWeight: 600 } }, axisBorder: { show: false }, axisTicks: { show: false } },
          yaxis: { labels: { style: { colors: '#94a3b8' } } },
          colors: ['#0088cc'],
          grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
          tooltip: {
            y: {
              formatter: function (val) {
                return val + ' tiket';
              },
            },
          },
        };
        trafficChart = new ApexCharts(barsContainer, options);
        trafficChart.render();
      } else {
        trafficChart.updateSeries([{ data: volData }]);
      }
    }
  }

  function renderDigitalAnalytics(data) {
    if (!document.getElementById('dg-qr-pct')) return;

    let cntCetak = 0;
    let cntQr = 0;

    let hrMap = {};

    data.forEach((x) => {
      if (x.metode_tiket === 'qrcode' || x.metode_tiket === 'scan') cntQr++;
      else cntCetak++; // physical button etc

      let h = new Date(x.waktu_ambil).getHours();
      if (!hrMap[h]) hrMap[h] = { cetak: 0, qr: 0 };

      if (x.metode_tiket === 'qrcode' || x.metode_tiket === 'scan') hrMap[h].qr++;
      else hrMap[h].cetak++;
    });

    let total = cntCetak + cntQr;
    let pctQr = total > 0 ? Math.round((cntQr / total) * 100) : 0;
    let pctCetak = total > 0 ? Math.round((cntCetak / total) * 100) : 0;

    // Check if the old labels still exist, they might have been removed. If they do, update them.
    let qrPctLabel = document.getElementById('dg-qr-pct');
    if (qrPctLabel) qrPctLabel.textContent = pctQr + '%';

    document.getElementById('dg-cetak-val').textContent = cntCetak;
    document.getElementById('dg-cetak-pct').textContent = pctCetak + '% dari total';

    document.getElementById('dg-qr-val').textContent = cntQr;
    document.getElementById('dg-qr-pct2').textContent = pctQr + '% dari total';

    // Render Apex Donut Chart
    const donutContainer = document.getElementById('dg-apex-donut');
    if (donutContainer) {
      if (!digitalChart) {
        const options = {
          series: [cntQr, cntCetak],
          labels: ['Digital QR', 'Cetak Fisik'],
          chart: { type: 'donut', height: 260, fontFamily: 'Inter, sans-serif' },
          colors: ['#0b5c9e', '#e0f2fe'],
          plotOptions: {
            pie: {
              donut: {
                size: '75%',
                labels: {
                  show: true,
                  name: { show: true, color: '#64748b', fontSize: '11px' },
                  value: { show: true, fontSize: '26px', fontWeight: 900, color: '#1e293b' },
                  total: {
                    show: true,
                    showAlways: true,
                    label: 'Persentase QR',
                    fontSize: '10px',
                    color: '#94a3b8',
                    formatter: function (w) {
                      return pctQr + '%';
                    },
                  },
                },
              },
            },
          },
          dataLabels: { enabled: false },
          legend: { show: false },
          stroke: { width: 0 },
        };
        digitalChart = new ApexCharts(donutContainer, options);
        digitalChart.render();
      } else {
        digitalChart.updateSeries([cntQr, cntCetak]);
        // Update total formatter to reflect current pctQr dynamically via options update
        digitalChart.updateOptions({
          plotOptions: {
            pie: {
              donut: {
                labels: {
                  total: {
                    formatter: function () {
                      return pctQr + '%';
                    },
                  },
                },
              },
            },
          },
        });
      }
    }

    // Hourly
    let dgHourly = document.getElementById('dg-hourly');
    dgHourly.innerHTML = '';

    let sortedHr = Object.keys(hrMap)
      .map(Number)
      .sort((a, b) => a - b);
    if (!sortedHr.length) {
      dgHourly.innerHTML = '<p class="text-xs text-slate-400 p-2">Belum ada data distribusi tiket per jam.</p>';
      return;
    }

    sortedHr.forEach((h) => {
      let hrTotal = hrMap[h].cetak + hrMap[h].qr;
      let hrPctQr = hrTotal > 0 ? Math.round((hrMap[h].qr / hrTotal) * 100) : 0;
      let hrPctCetak = 100 - hrPctQr;

      let jamStr = String(h).padStart(2, '0') + ':00';

      dgHourly.innerHTML += `
         <div class="mb-3">
            <div class="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
              <span>${jamStr} <span class="font-normal">(${hrTotal} tiket)</span></span>
              <span>${hrPctQr}% QR</span>
            </div>
            <div class="w-full h-2 rounded-full overflow-hidden flex">
               <div class="bg-blue-300 h-full transition-all" style="width: ${hrPctCetak}%"></div>
               <div class="bg-primary h-full transition-all" style="width: ${hrPctQr}%"></div>
            </div>
         </div>
       `;
    });
  }
});
