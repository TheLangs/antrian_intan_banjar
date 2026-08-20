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
  const inpEnd = document.getElementById('ov-date-end');
  const btnFilter = document.getElementById('btn-filter') || document.createElement('button'); // Fallback if no filter button
  const btnExport = document.querySelector('[data-export="overview"]') || document.createElement('button');
  const btnLogout = document.getElementById('btn-logout') || document.querySelector('[id="btn-logout"]');

  const kpiTotal = document.getElementById('ov-total');
  const kpiSelesai = document.getElementById('ov-selesai');
  const kpiAvgWait = document.getElementById('ov-avg-wait');
  const kpiAvgSvc = document.getElementById('ov-avg-svc');

  const tableBody = document.getElementById('table-body') || document.getElementById('hs-tbody');
  const tableEmpty = document.getElementById('table-empty') || document.getElementById('hs-empty');
  const loader = document.getElementById('loader');

  let currentReportData = [];

  // Set default dates (Today) on initialization
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  document.querySelectorAll('.tab-date-start').forEach((el) => (el.value = localToday));
  document.querySelectorAll('.tab-date-end').forEach((el) => (el.value = localToday));

  // Events
  document.querySelectorAll('.btn-apply-filter').forEach((btn) => btn.addEventListener('click', fetchData));

  ['ks-search', 'ks-nama'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        if (typeof renderKasirAnalytics === 'function' && currentReportData) renderKasirAnalytics(currentReportData);
      });
      el.addEventListener('change', () => {
        if (typeof renderKasirAnalytics === 'function' && currentReportData) renderKasirAnalytics(currentReportData);
      });
    }
  });

  ['hs-search', 'hs-status', 'hs-loket'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        if (currentReportData) processAndRender(currentReportData);
      });
      el.addEventListener('change', () => {
        if (currentReportData) processAndRender(currentReportData);
      });
    }
  });

  // Bind all export buttons that have PDF/CSV exports
  document.querySelectorAll('[data-export]').forEach((btn) => {
    btn.addEventListener('click', generatePDF);
  });

  if (btnLogout)
    btnLogout.addEventListener('click', () => {
      localStorage.clear();
      window.location.href = 'admin_login.html';
    });
  if (btnExport) btnExport.addEventListener('click', generatePDF);

  // Sidebar Tabs Logic
  const navItems = document.querySelectorAll('.nav-item[data-tab]');
  const tabContents = document.querySelectorAll('.tab-content');
  navItems.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      navItems.forEach((n) => n.classList.remove('active', 'text-slate-800'));
      tabContents.forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
      const tabName = btn.getAttribute('data-tab');
      const targetId = 'tab-' + tabName;
      document.getElementById(targetId)?.classList.add('active');
    });
  });

  // Initial Load & Live Background Polling (Every 20 Seconds)
  fetchSettings();
  fetchData();
  setInterval(fetchDataSilent, 20000);

  // Live Header Clock Logic
  function updateHeaderTime() {
    const timeEl = document.getElementById('header-datetime');
    if (!timeEl) return;
    const now = new Date();
    const dateOpts = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    const timeOpts = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const ds = now.toLocaleDateString('id-ID', dateOpts);
    const ts = now.toLocaleTimeString('id-ID', timeOpts).replace(/\./g, ':');
    timeEl.textContent = `${ds} — ${ts} WITA`;
  }
  updateHeaderTime();
  setInterval(updateHeaderTime, 1000);

  function checkSessionAuth() {
    // Failsafe in case localStorage was cleared mid-session
    const adminId = localStorage.getItem('ib_admin_id');
    if (!adminId) {
      window.location.href = 'admin_login.html';
      return false;
    }
    return true;
  }

  function showOfflineBadge() {
    let badge = document.getElementById('offline-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'offline-badge';
      badge.className = 'fixed top-4 right-4 bg-red-100 text-red-600 px-4 py-2 rounded-full shadow-lg font-bold text-sm z-[9999] flex items-center gap-2 transition-all';
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Offline Mode';
      document.body.appendChild(badge);
    }
  }

  function hideOfflineBadge() {
    const badge = document.getElementById('offline-badge');
    if (badge) badge.remove();
  }

  async function fetchDataSilent() {
    const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
    if (activeTab !== 'overview' && activeTab !== 'session-manager' && activeTab !== 'display-control') return;
    try {
      const today = new Date();
      let startD = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();
      let endD = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();
      const [resAntrian, resLoket] = await Promise.all([
        supabase.from('antrian').select('*, loket(nama_loket)').gte('waktu_ambil', startD).lte('waktu_ambil', endD).order('id_antrian', { ascending: true }),
        supabase.from('loket').select('*'),
      ]);
      if (resAntrian.error) throw resAntrian.error;
      hideOfflineBadge();
      processAndRenderLiveOverview(resAntrian.data || [], resLoket.data || []);
    } catch (err) {
      console.warn('Silent Live Polling failed:', err.message);
      showOfflineBadge();
    }
  }

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
      let startD = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();
      let endD = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

      const activeTabContent = document.querySelector('.tab-content.active');
      const tabStart = activeTabContent ? activeTabContent.querySelector('.tab-date-start') : null;
      const tabEnd = activeTabContent ? activeTabContent.querySelector('.tab-date-end') : null;

      if (tabStart && tabStart.value) {
        const p = tabStart.value.split('-');
        startD = new Date(p[0], p[1] - 1, p[2], 0, 0, 0).toISOString();
      }
      if (tabEnd && tabEnd.value) {
        const p = tabEnd.value.split('-');
        endD = new Date(p[0], p[1] - 1, p[2], 23, 59, 59, 999).toISOString();
      } else {
        if (tabStart && tabStart.value) {
          const p = tabStart.value.split('-');
          endD = new Date(p[0], p[1] - 1, p[2], 23, 59, 59, 999).toISOString();
        }
      }

      const [resAntrian, resLoket] = await Promise.all([
        supabase.from('antrian').select('*, loket(nama_loket)').gte('waktu_ambil', startD).lte('waktu_ambil', endD).order('id_antrian', { ascending: true }),
        supabase.from('loket').select('*'),
      ]);

      if (resAntrian.error) throw resAntrian.error;
      hideOfflineBadge();

      currentReportData = resAntrian.data || [];
      processAndRenderLiveOverview(currentReportData, resLoket.data || []);
      processAndRenderAnalytics(currentReportData);
    } catch (err) {
      console.error('Fetch Data Error:', err);
      showOfflineBadge();
    } finally {
      if (loader) loader.classList.add('hidden');
    }
  }

  function populateFilterDropdowns(data) {
    const ksNama = document.getElementById('ks-nama');
    if (ksNama) {
      const curVal = ksNama.value;
      const petugas = [...new Set(data.map((x) => x.nama_petugas).filter(Boolean))].sort();
      ksNama.innerHTML = '<option value="ALL">Semua Kasir</option>' + petugas.map((p) => `<option value="${p}">${p}</option>`).join('');
      ksNama.value = curVal || 'ALL';
      if (ksNama.selectedIndex < 0) ksNama.value = 'ALL';
    }
    const hsLoket = document.getElementById('hs-loket');
    if (hsLoket) {
      const curVal = hsLoket.value;
      const loket = [...new Set(data.map((x) => x.loket?.nama_loket).filter(Boolean))].sort();
      hsLoket.innerHTML = '<option value="ALL">Semua Loket</option>' + loket.map((l) => `<option value="${l}">${l}</option>`).join('');
      hsLoket.value = curVal || 'ALL';
      if (hsLoket.selectedIndex < 0) hsLoket.value = 'ALL';
    }
  }

  function processAndRenderLiveOverview(data, loketData = []) {
    let cntTotal = data.length;
    let cntSelesai = 0,
      cntTerlewat = 0,
      totalWaitTimeSec = 0,
      waitCount = 0,
      totalSvcTimeSec = 0,
      svcCount = 0;
    data.forEach((item) => {
      if (item.status === 'selesai') cntSelesai++;
      if (item.status === 'terlewat' || item.status === 'batal') cntTerlewat++;
      if (item.waktu_ambil && item.waktu_panggil) {
        let tW = (new Date(item.waktu_panggil) - new Date(item.waktu_ambil)) / 1000;
        if (tW > 0) {
          totalWaitTimeSec += tW;
          waitCount++;
        }
      }
      if (item.waktu_panggil && item.waktu_selesai && item.status === 'selesai') {
        let tS = (new Date(item.waktu_selesai) - new Date(item.waktu_panggil)) / 1000;
        if (tS > 0) {
          totalSvcTimeSec += tS;
          svcCount++;
        }
      }
    });

    if (kpiTotal) kpiTotal.textContent = String(cntTotal);
    if (kpiSelesai) kpiSelesai.textContent = String(cntSelesai);
    if (kpiAvgWait) kpiAvgWait.textContent = waitCount > 0 ? formatSec(totalWaitTimeSec / waitCount) : '0m 0s';
    if (kpiAvgSvc) kpiAvgSvc.textContent = svcCount > 0 ? formatSec(totalSvcTimeSec / svcCount) : '0m 0s';

    const kpiSuccessPct = document.getElementById('ov-success-pct');
    if (kpiSuccessPct) {
      if (cntTotal === 0) kpiSuccessPct.textContent = '0%';
      else {
        const pct = Math.round((cntSelesai / cntTotal) * 100);
        kpiSuccessPct.textContent = `${pct}%`;
      }
    }
    const kpiSelesaiCount = document.getElementById('ov-selesai');
    const kpiTerlewatCount = document.getElementById('ov-terlewat');
    if (kpiSelesaiCount) kpiSelesaiCount.textContent = cntSelesai;
    if (kpiTerlewatCount) kpiTerlewatCount.textContent = cntTerlewat;

    if (typeof renderLoketCards === 'function') renderLoketCards('ov-loket-cards', data, loketData);
    if (typeof renderSessionManager === 'function') renderSessionManager(loketData);
    if (typeof renderAuditTrail === 'function') renderAuditTrail(data);
    if (typeof renderOverviewTrafficBars === 'function') renderOverviewTrafficBars(data);
    if (typeof renderRecentEvents === 'function') renderRecentEvents('ov-recent-events', data);
  }

  function processAndRenderAnalytics(data) {
    populateFilterDropdowns(data);
    if (data.length === 0) {
      if (tableBody) tableBody.innerHTML = '';
      if (tableEmpty) tableEmpty.classList.remove('hidden');
      if (typeof renderKasirAnalytics === 'function') renderKasirAnalytics(data);
      if (typeof renderTrafficAnalytics === 'function') renderTrafficAnalytics(data);
      if (typeof renderDigitalAnalytics === 'function') renderDigitalAnalytics(data);
      return;
    }

    const searchTerm = (document.getElementById('hs-search')?.value || '').toLowerCase();
    const statusTerm = (document.getElementById('hs-status')?.value || 'ALL').toLowerCase();
    const loketTerm = document.getElementById('hs-loket')?.value || 'ALL';

    let filteredData = data.filter((item) => {
      let matchSearch = true;
      if (searchTerm) {
        const ticket = `${item.kode_antrian}-${String(item.nomor_antrian).padStart(3, '0')}`.toLowerCase();
        const loket = (item.loket?.nama_loket || '').toLowerCase();
        const petugas = (item.nama_petugas || '').toLowerCase();
        matchSearch = ticket.includes(searchTerm) || loket.includes(searchTerm) || petugas.includes(searchTerm);
      }
      let matchStatus = true;
      if (statusTerm !== 'all') matchStatus = (item.status || '').toLowerCase() === statusTerm;
      let matchLoket = true;
      if (loketTerm !== 'ALL') matchLoket = item.loket?.nama_loket === loketTerm;
      return matchSearch && matchStatus && matchLoket;
    });

    filteredData.reverse();

    window.filteredHistoryData = filteredData;
    if (tableBody) tableBody.innerHTML = '';
    if (tableEmpty) tableEmpty.classList.add('hidden');

    let renderIdx = 0;
    filteredData.forEach((item) => {
      let waitTimeStr = '-';
      if (item.waktu_ambil && item.waktu_panggil) {
        let s = (new Date(item.waktu_panggil) - new Date(item.waktu_ambil)) / 1000;
        if (s > 0) waitTimeStr = formatSec(s);
      }
      let svcTimeStr = '-';
      if (item.waktu_panggil && item.waktu_selesai && item.status === 'selesai') {
        let s = (new Date(item.waktu_selesai) - new Date(item.waktu_panggil)) / 1000;
        if (s > 0) svcTimeStr = formatSec(s);
      }

      let tr = document.createElement('tr');
      tr.className = (renderIdx % 2 === 0 ? 'bg-white ' : 'bg-slate-50/50 ') + 'hover:bg-blue-50/50 transition-colors border-b border-slate-100/70 border-dashed text-xs text-slate-600 font-medium whitespace-nowrap';
      const noLengkap = `${item.kode_antrian}-${String(item.nomor_antrian).padStart(3, '0')}`;
      const waDateObj = item.waktu_ambil ? new Date(item.waktu_ambil) : null;
      const waDateStr = waDateObj ? waDateObj.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: '2-digit' }) : '-';
      const wa = waDateObj ? waDateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':') : '-';
      const wp = item.waktu_panggil ? new Date(item.waktu_panggil).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':') : '-';
      const ws = item.waktu_selesai ? new Date(item.waktu_selesai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':') : '-';

      let b = 'bg-slate-100 text-slate-500';
      if (item.status === 'selesai') b = 'bg-emerald-100 text-emerald-700';
      if (item.status === 'panggil') b = 'bg-blue-100 text-blue-700';
      if (item.status === 'terlewat') b = 'bg-amber-100 text-amber-700';
      if (item.status === 'batal') b = 'bg-red-100 text-red-700';

      tr.innerHTML = `<td class="py-3.5 px-5 font-bold flex items-center gap-2"><div class="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path></svg></div>${noLengkap}</td>
<td class="py-3.5 px-5 font-semibold text-slate-700">${waDateStr}</td>
<td class="py-3.5 px-5"><span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">${item.metode_tiket || 'OFFLINE'}</span></td>
<td class="py-3.5 px-5 font-semibold text-slate-700">${item.loket?.nama_loket || '-'} <span class="text-xs text-slate-400 font-normal ml-1">| ${item.nama_petugas || '-'}</span></td>
<td class="py-3.5 px-5 text-center font-semibold text-slate-600">${wa}</td>
<td class="py-3.5 px-5 text-center font-semibold text-slate-600">${wp}</td>
<td class="py-3.5 px-5 text-center font-semibold text-slate-600">${ws}</td>
<td class="py-3.5 px-5 text-center font-medium">${waitTimeStr}</td>
<td class="py-3.5 px-5 text-center font-medium text-slate-700">${svcTimeStr}</td>
<td class="py-3.5 px-5 text-right"><span class="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${b}">${item.status}</span></td>`;
      tableBody.appendChild(tr);
      renderIdx++;
    });

    if (typeof renderKasirAnalytics === 'function') renderKasirAnalytics(data);
    if (typeof renderTrafficAnalytics === 'function') renderTrafficAnalytics(data);
    if (typeof renderDigitalAnalytics === 'function') renderDigitalAnalytics(data);
  }

  function formatSec(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
  }

  function generatePDF(e) {
    if (currentReportData.length === 0) {
      alert('Tidak ada data untuk diekspor!');
      return;
    }

    const clickedBtn = e && e.currentTarget ? e.currentTarget : btnExport;
    const exportType = clickedBtn.getAttribute('data-export') || 'overview';

    let dataToExport = currentReportData;
    if (exportType === 'history' || exportType === 'overview') dataToExport = window.filteredHistoryData || currentReportData;
    if (exportType === 'kasir') dataToExport = window.filteredKasirData || currentReportData;

    // Check if it's the history CSV export
    if (exportType === 'history') {
      try {
        let scsv = 'ID,Nomor,Tanggal,Platform,Status,Loket,Petugas,Ambil,Panggil,Selesai\n';
        dataToExport.forEach((item) => {
          const noLengkap = `${item.kode_antrian}-${String(item.nomor_antrian).padStart(3, '0')}`;
          const tgl = item.waktu_ambil ? new Date(item.waktu_ambil).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: '2-digit' }) : '';
          scsv += `"${item.id_antrian}","${noLengkap}","${tgl}","${item.metode_tiket || ''}","${item.status || ''}","${item.loket?.nama_loket || ''}","${item.nama_petugas || ''}","${item.waktu_ambil || ''}","${item.waktu_panggil || ''}","${item.waktu_selesai || ''}"\n`;
        });
        const blob = new Blob([scsv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Antrian_Data_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        alert('Gagal mengekspor CSV: ' + err.message);
      }
      return;
    }

    const originalHtml = clickedBtn.innerHTML;
    clickedBtn.disabled = true;
    clickedBtn.innerHTML = '<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span> Memproses...';

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape');

      // Styles & Branding Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(11, 92, 158); // #0B5C9E (Brand Primary)
      doc.text('PT AIR MINUM INTAN BANJAR (PERSERODA)', 14, 20);

      const titles = {
        overview: 'Laporan Eksekutif Performa Sistem Analitik Antrean',
        kasir: 'Laporan Kinerja Kasir & Operator',
        traffic: 'Laporan Beban & Analisis Jam Sibuk',
        digital: 'Laporan Penetrasi & Metode Pengambilan Tiket',
      };

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text(titles[exportType] || titles['overview'], 14, 28);

      const activeTabContent = document.querySelector('.tab-content.active');
      const tabStart = activeTabContent ? activeTabContent.querySelector('.tab-date-start') : null;
      const tabEnd = activeTabContent ? activeTabContent.querySelector('.tab-date-end') : null;

      const realStart = tabStart && tabStart.value ? tabStart.value : new Date().toISOString().split('T')[0];
      const realEnd = tabEnd && tabEnd.value ? tabEnd.value : new Date().toISOString().split('T')[0];
      doc.setFontSize(10);
      doc.text(`Periode Cetak: ${new Date().toLocaleDateString('id-ID')} | Tanggal Data: ${new Date(realStart).toLocaleDateString('id-ID')} s/d ${new Date(realEnd).toLocaleDateString('id-ID')}`, 14, 34);

      // --- Executive KPI Summary Section for ALL modes ---
      doc.setFillColor(241, 245, 249); // slate-100 banner
      doc.rect(14, 40, 269, 20, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);

      let sSelesai = 0,
        sTerlewat = 0,
        sSumW = 0,
        sCntW = 0;
      dataToExport.forEach((d) => {
        if (d.status === 'selesai') sSelesai++;
        if (d.status === 'terlewat') sTerlewat++;
        if (d.waktu_panggil) {
          let w = (new Date(d.waktu_panggil) - new Date(d.waktu_ambil)) / 1000;
          if (w > 0) {
            sSumW += w;
            sCntW++;
          }
        }
      });
      let sWait = sCntW > 0 ? formatSec(sSumW / sCntW) : '0m 0s';
      let sTtl = dataToExport.length;

      doc.text(`TOTAL TIKET: ${sTtl}`, 20, 52);
      doc.text(`SELESAI: ${sSelesai} (${sTtl > 0 ? Math.round((sSelesai / sTtl) * 100) : 0}%)`, 80, 52);
      doc.text(`TERLEWAT: ${sTerlewat}`, 150, 52);
      doc.text(`RATA-RATA WAKTU TUNGGU: ${sWait}`, 210, 52);

      let tableColumn = [];
      let tableRows = [];
      let cStyles = {};

      if (exportType === 'kasir') {
        tableColumn = ['Kasir / Petugas', 'Total Diambil', 'Sukses Dilayani', 'Terlewat', 'Wt. Tunggu (Rata-rata)', 'Wt. Layan (Rata-rata)'];
        let dict = {};
        dataToExport.forEach((d) => {
          let petugas = d.nama_petugas || 'Tanpa Petugas';
          let loket = d.loket?.nama_loket || 'Tanpa Loket';
          let nm = petugas + ' (' + loket + ')';

          if (!dict[nm]) dict[nm] = { nm, t: 0, s: 0, ter: 0, tw: 0, cw: 0, ts: 0, cs: 0 };
          dict[nm].t++;
          if (d.status === 'selesai') dict[nm].s++;
          if (d.status === 'terlewat') dict[nm].ter++;
          if (d.waktu_panggil) {
            const w = (new Date(d.waktu_panggil) - new Date(d.waktu_ambil)) / 1000;
            if (w > 0) {
              dict[nm].tw += w;
              dict[nm].cw++;
            }
          }
          if (d.waktu_selesai && d.waktu_panggil) {
            const s = (new Date(d.waktu_selesai) - new Date(d.waktu_panggil)) / 1000;
            if (s > 0) {
              dict[nm].ts += s;
              dict[nm].cs++;
            }
          }
        });
        Object.values(dict)
          .sort((a, b) => b.t - a.t)
          .forEach((x) => {
            tableRows.push([x.nm, x.t, x.s, x.ter, x.cw > 0 ? formatSec(x.tw / x.cw) : '-', x.cs > 0 ? formatSec(x.ts / x.cs) : '-']);
          });
        cStyles = { 0: { fontStyle: 'bold' }, 1: { halign: 'center' }, 2: { halign: 'center' } };
      } else if (exportType === 'traffic') {
        tableColumn = ['Jam/Waktu (WIT)', 'Volume Masuk', 'Sukses Dilayani', 'Rata-rata Wt. Tunggu'];
        let dict = {};
        dataToExport.forEach((d) => {
          let h = new Date(d.waktu_ambil).getHours();
          if (isNaN(h)) return;
          let label = `${String(h).padStart(2, '0')}:00 - ${String(h + 1).padStart(2, '0')}:00`;
          if (!dict[h]) dict[h] = { label, t: 0, s: 0, tw: 0, cw: 0 };
          dict[h].t++;
          if (d.status === 'selesai') dict[h].s++;
          if (d.waktu_panggil) {
            const w = (new Date(d.waktu_panggil) - new Date(d.waktu_ambil)) / 1000;
            if (w > 0) {
              dict[h].tw += w;
              dict[h].cw++;
            }
          }
        });
        let keys = Object.keys(dict)
          .map(Number)
          .sort((a, b) => a - b);
        keys.forEach((k) => {
          let x = dict[k];
          tableRows.push([x.label, x.t, x.s, x.cw > 0 ? formatSec(x.tw / x.cw) : '-']);
        });
        cStyles = { 0: { fontStyle: 'bold' }, 1: { halign: 'center' }, 2: { halign: 'center' } };
      } else if (exportType === 'digital') {
        tableColumn = ['Saluran Tiket', 'Total Pengambilan', 'Persentase', 'Rata-rata Wt. Tunggu'];
        let dict = {};
        dataToExport.forEach((d) => {
          let isScanned = d.metode_tiket === 'qrcode' || d.metode_tiket === 'scan';
          let nm = isScanned ? 'ONLINE APP / QR CODE' : 'OFFLINE KIOSK / MENDATANGI';

          if (!dict[nm]) dict[nm] = { nm, t: 0, tw: 0, cw: 0 };
          dict[nm].t++;
          if (d.waktu_panggil) {
            const w = (new Date(d.waktu_panggil) - new Date(d.waktu_ambil)) / 1000;
            if (w > 0) {
              dict[nm].tw += w;
              dict[nm].cw++;
            }
          }
        });
        Object.values(dict)
          .sort((a, b) => b.t - a.t)
          .forEach((x) => {
            tableRows.push([x.nm, x.t, Math.round((x.t / sTtl) * 100) + '%', x.cw > 0 ? formatSec(x.tw / x.cw) : '-']);
          });
        cStyles = { 0: { fontStyle: 'bold' }, 1: { halign: 'center' }, 2: { halign: 'center' } };
      } else {
        // default Overview
        tableColumn = ['ID', 'Nomor', 'Platform', 'Status', 'Loket', 'Petugas', 'Pukul Ambil', 'Pukul Panggil', 'Pukul Selesai', 'Wt. Tunggu', 'Wt. Layan'];
        dataToExport.forEach((item) => {
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

          tableRows.push([
            item.id_antrian,
            noLengkap,
            (item.metode_tiket || '').toUpperCase(),
            (item.status || '').toUpperCase(),
            item.loket?.nama_loket || '-',
            item.petugas || '-',
            item.waktu_ambil ? new Date(item.waktu_ambil).toLocaleTimeString('id-ID').replace(/\./g, ':') : '-',
            item.waktu_panggil ? new Date(item.waktu_panggil).toLocaleTimeString('id-ID').replace(/\./g, ':') : '-',
            item.waktu_selesai ? new Date(item.waktu_selesai).toLocaleTimeString('id-ID').replace(/\./g, ':') : '-',
            waitTimeStr,
            svcTimeStr,
          ]);
        });
        cStyles = {
          0: { halign: 'center', cellWidth: 15 },
          1: { fontStyle: 'bold', halign: 'center', cellWidth: 18 },
          2: { halign: 'center' },
          3: { halign: 'center' },
        };
      }

      // === NATIVE PDF VECTOR CHARTS ===
      let yOffset = 65; // default table start Y

      if (exportType === 'traffic' && tableRows.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Visualisasi Kepadatan Antrean per Jam', 14, 68);

        let chartX = 14;
        let chartY = 75;
        let chartW = 250;
        let chartH = 40;
        let trafficValues = tableRows.map((r) => r[1]);
        let maxV = Math.max(...trafficValues, 1);

        // Data Axes
        doc.setDrawColor(200, 200, 200);
        doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH); // X Axis

        let barSpacing = 4;
        let barW = chartW / trafficValues.length - barSpacing;

        doc.setFont('helvetica', 'normal');
        tableRows.forEach((r, i) => {
          let h = (r[1] / maxV) * chartH;
          let bx = chartX + i * (barW + barSpacing);
          let by = chartY + chartH - h;

          doc.setFillColor(11, 92, 158); // Brand Primary
          if (h > 0) doc.rect(bx, by, barW, h, 'F');

          doc.setFontSize(7);
          doc.setTextColor(100);
          // Value Above Bar
          if (r[1] > 0) doc.text(String(r[1]), bx + barW / 2 - 1, by - 2, { align: 'center' });
          // Label Below
          let hourLabel = String(r[0]).substring(0, 5); // '09:00'
          doc.text(hourLabel, bx + barW / 2 - 1, chartY + chartH + 4, { align: 'center' });
        });

        yOffset = 135; // Push table down
      } else if (exportType === 'digital' && tableRows.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Komparasi Proporsi Saluran Pengambilan Tiket', 14, 68);

        let chartY = 78;
        let maxRowW = 150;
        doc.setFont('helvetica', 'normal');

        tableRows.forEach((r, i) => {
          let val = r[1];
          let w = sTtl > 0 ? (val / sTtl) * maxRowW : 0;
          let cy = chartY + i * 14;

          doc.setFontSize(8);
          doc.setTextColor(30);
          doc.text(r[0], 14, cy + 5);

          // Color coding based on platform
          if (r[0].includes('ONLINE API') || r[0].includes('APP'))
            doc.setFillColor(34, 197, 94); // Green
          else doc.setFillColor(245, 158, 11); // Amber

          doc.rect(50, cy, w, 8, 'F');

          doc.setFont('helvetica', 'bold');
          doc.text(`${val} Tiket (${r[2]})`, 50 + w + 3, cy + 6);
          doc.setFont('helvetica', 'normal');
        });

        yOffset = chartY + tableRows.length * 14 + 10;
      } else if (exportType === 'kasir' && tableRows.length > 0) {
        yOffset = 65; // keep high up for tabular density
      }

      // Trigger AutoTable Plugin
      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: yOffset,
        theme: 'striped',
        headStyles: { fillColor: [11, 92, 158] },
        styles: { fontSize: 8 },
        columnStyles: cStyles,
      });

      // Doc Stamp
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Digenerate oleh sistem pada: ${new Date().toLocaleString('id-ID')}`, 14, doc.internal.pageSize.getHeight() - 10);

      // Save
      doc.save(`Laporan_${exportType.toUpperCase()}_Intan_Banjar_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Gagal merender PDF: ' + e.message);
    } finally {
      // Reset Btn
      clickedBtn.disabled = false;
      clickedBtn.innerHTML = originalHtml;
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

  window.forceReleaseSession = async function (id_loket) {
    if (!confirm(`Tindakan ini akan meng-kick sesi Kasir di Loket ${id_loket} secara paksa! Lanjutkan?`)) return;
    try {
      const { error } = await supabase.from('loket').update({ session_token: null, last_seen: null }).eq('id_loket', id_loket);
      if (error) throw error;
      alert(`Sesi Loket ${id_loket} berhasil dilepas secara paksa.`);
      fetchDataSilent();
    } catch (err) {
      alert('Gagal melepas sesi: ' + err.message);
    }
  };

  function renderSessionManager(loketData = []) {
    const container = document.getElementById('sm-grid-container');
    if (!container) return;

    if (loketData.length === 0) {
      container.innerHTML = `<div class="col-span-full p-8 text-center text-slate-500 font-semibold bg-white rounded-3xl border border-slate-100 shadow-sm">Belum ada data Loket di Tabel.</div>`;
      return;
    }

    let html = '';
    [...loketData]
      .sort((a, b) => a.id_loket - b.id_loket)
      .forEach((l) => {
        const isOnline = !!l.session_token;

        html += `
        <div class="bg-white rounded-3xl border ${isOnline ? 'border-amber-200 shadow-md ring-1 ring-amber-100' : 'border-slate-100 shadow-sm'} p-6 flex flex-col justify-between transition-all">
          <div>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-black text-slate-800">${l.nama_loket || 'LOKET ' + l.id_loket}</h3>
              ${
                isOnline
                  ? `<span class="bg-amber-100 text-amber-700 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> TERKUNCI / AKTIF</span>`
                  : `<span class="bg-slate-100 text-slate-500 font-bold px-3 py-1 rounded-full text-xs">KOSONG</span>`
              }
            </div>
            
            <div class="space-y-3 mb-6">
              <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-slate-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                <div class="text-sm">
                  <p class="font-bold text-slate-700">Client Token (Web Lock)</p>
                  <p class="text-xs text-slate-500 font-mono mt-0.5 break-all">${l.session_token || 'Tidak Ada Sesi Aktif'}</p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-slate-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <div class="text-sm">
                  <p class="font-bold text-slate-700">Login Terakhir</p>
                  <p class="text-xs text-slate-500 mt-0.5">${l.login_time ? new Date(l.login_time).toLocaleString('id-ID') : 'Belum Pernah'}</p>
                </div>
              </div>
            </div>
          </div>
          
          <button 
            onclick="forceReleaseSession(${l.id_loket})"
            class="${isOnline ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200' : 'bg-slate-50 text-slate-400 cursor-not-allowed border border-transparent'} 
                   w-full font-bold py-2.5 rounded-xl text-sm transition-all focus:outline-none flex items-center justify-center gap-2"
            ${!isOnline ? 'disabled' : ''}>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            FORCE RELEASE SESSION
          </button>
        </div>
      `;
      });

    container.innerHTML = html;
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

  function renderOverviewTrafficBars(data) {
    const miniBars = document.getElementById('ov-mini-bars');
    if (!miniBars) return;

    let hours = [8, 9, 10, 11, 12, 13, 14, 15];
    let tMap = {};
    hours.forEach((h) => {
      tMap[h] = 0;
    });
    let maxVol = 0;

    data.forEach((x) => {
      let h = new Date(x.waktu_ambil).getHours();
      if (h < 8) h = 8;
      if (h > 15) h = 15;

      if (tMap[h] !== undefined) {
        tMap[h]++;
        if (tMap[h] > maxVol) maxVol = tMap[h];
      }
    });

    miniBars.innerHTML = '';

    hours.forEach((h) => {
      let vol = tMap[h];
      let pct = maxVol > 0 ? (vol / maxVol) * 100 : 0;
      let barCss = pct > 0 ? 'from-accent to-blue-400 shadow-sm hover:shadow-md' : 'from-slate-100 to-slate-50 shadow-none border border-slate-100 border-b-0';

      let barHtml = `
          <div class="relative flex flex-col justify-end w-full h-full group pb-1">
            <div class="w-full bg-gradient-to-t ${barCss} hover:brightness-110 transition-all duration-300 rounded-t-lg relative z-10" style="height: ${pct > 0 ? pct : 10}%; min-height: 6px;">
              <div class="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap">
                ${vol} Tiket
                <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
              </div>
              ${pct > 0 ? '<div class="absolute inset-x-0 top-0 h-1 bg-white/30 rounded-t-lg"></div>' : ''}
            </div>
          </div>
       `;
      miniBars.innerHTML += barHtml;
    });
  }

  function renderKasirAnalytics(data) {
    const tbody = document.getElementById('ks-tbody');
    const emptyMsg = document.getElementById('ks-empty');
    if (!tbody || !emptyMsg) return;

    // --- APPLY FILTERS ---
    const searchTerm = (document.getElementById('ks-search')?.value || '').toLowerCase();
    const namaTerm = document.getElementById('ks-nama')?.value || 'ALL';

    let filteredData = data.filter((x) => {
      let matchName = true;
      if (namaTerm !== 'ALL') {
        matchName = x.nama_petugas === namaTerm;
      }
      let matchSearch = true;
      if (searchTerm) {
        matchSearch = (x.nama_petugas || '').toLowerCase().includes(searchTerm) || (x.loket?.nama_loket || '').toLowerCase().includes(searchTerm);
      }
      return matchName && matchSearch;
    });

    tbody.innerHTML = '';
    let ksMap = {};

    filteredData.forEach((x) => {
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

  function renderAuditTrail(logs) {
    const tbody = document.getElementById('audit-tbody');
    if (!tbody) return;

    // Flatten logs into events
    let events = [];
    logs.forEach((item) => {
      const ticketStr = `${item.kode_antrian}-${String(item.nomor_antrian).padStart(3, '0')}`;
      const actor = item.nama_petugas || 'Anonim (Loket ' + item.id_loket + ')';

      if (item.waktu_panggil) {
        events.push({
          time: new Date(item.waktu_panggil),
          ticket: ticketStr,
          actor: actor,
          action: 'Panggilan Antrean',
          color: 'text-amber-600',
          bg: 'bg-amber-100',
        });
      }
      if (item.waktu_selesai && (item.status === 'selesai' || item.status === 'terlewat' || item.status === 'batal')) {
        let label = 'Diselesaikan';
        let actColor = 'text-emerald-700';
        let actBg = 'bg-emerald-100';

        if (item.status === 'terlewat') {
          label = 'Ditandai Terlewat';
          actColor = 'text-red-700';
          actBg = 'bg-red-100';
        } else if (item.status === 'batal') {
          label = 'Dibatalkan';
          actColor = 'text-slate-600';
          actBg = 'bg-slate-200';
        }

        events.push({
          time: new Date(item.waktu_selesai),
          ticket: ticketStr,
          actor: actor,
          action: label,
          color: actColor,
          bg: actBg,
        });
      }
    });

    events.sort((a, b) => b.time - a.time);

    tbody.innerHTML = '';
    if (events.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-10 text-slate-500">Belum ada aktivitas tercatat pada rentang waktu ini.</td></tr>`;
      return;
    }

    events.slice(0, 100).forEach((ev) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition-colors';
      tr.innerHTML = `
        <td class="px-6 py-4 text-xs font-mono text-slate-500">${ev.time.toLocaleTimeString('id-ID').replace(/\./g, ':')}</td>
        <td class="px-6 py-4 font-bold text-slate-700">${ev.ticket}</td>
        <td class="px-6 py-4 text-xs text-slate-600">${ev.actor}</td>
        <td class="px-6 py-4">
           <span class="${ev.bg} ${ev.color} px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase">${ev.action}</span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderTrafficAnalytics(data) {
    const barsContainer = document.getElementById('tf-bars');
    const tbody = document.getElementById('tf-tbody');
    if (!barsContainer || !tbody) return;

    let hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    let tMap = {};
    hours.forEach((h) => {
      tMap[h] = { msk: 0, sel: 0, ter: 0, sumW: 0, cntW: 0 };
    });

    let maxVol = 0;

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
        if (tMap[h].msk > maxVol) maxVol = tMap[h].msk;
      }
    });

    barsContainer.innerHTML = '';
    tbody.innerHTML = '';

    hours.forEach((h) => {
      let d = tMap[h];
      // Bar chart
      let pct = maxVol > 0 ? (d.msk / maxVol) * 100 : 0;

      let barHtml = `
          <div class="relative flex flex-col justify-end w-full h-full group pb-1">
            <div class="w-full bg-gradient-to-t ${pct > 0 ? 'from-accent to-blue-400' : 'from-slate-100 to-slate-50'} shadow-sm hover:brightness-110 hover:shadow-md transition-all duration-300 rounded-t-lg relative z-10" style="height: ${pct}%; min-height: ${pct > 0 ? '6px' : '0'}">
              <div class="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap">
                ${d.msk} Tiket
                <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
              </div>
              ${pct > 0 ? '<div class="absolute inset-x-0 top-0 h-1 bg-white/30 rounded-t-lg"></div>' : ''}
            </div>
          </div>
       `;
      barsContainer.innerHTML += barHtml;

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
  }

  function renderDigitalAnalytics(data) {
    if (!document.getElementById('dg-qr-pct')) return;

    let cntCetak = 0;
    let cntQr = 0;

    let hrMap = {};

    data.forEach((x) => {
      const mt = (x.metode_tiket || '').toLowerCase();
      if (mt === 'qrcode' || mt === 'scan' || mt === 'qr') cntQr++;
      else cntCetak++; // physical button etc

      let h = new Date(x.waktu_ambil).getHours();
      if (!hrMap[h]) hrMap[h] = { cetak: 0, qr: 0 };

      if (mt === 'qrcode' || mt === 'scan' || mt === 'qr') hrMap[h].qr++;
      else hrMap[h].cetak++;
    });

    let total = cntCetak + cntQr;
    let pctQr = total > 0 ? Math.round((cntQr / total) * 100) : 0;
    let pctCetak = total > 0 ? Math.round((cntCetak / total) * 100) : 0;

    let qrPctLabel = document.getElementById('dg-qr-pct');
    if (qrPctLabel) qrPctLabel.textContent = pctQr + '%';
    let ring = document.getElementById('dg-ring-qr');
    if (ring) {
      ring.setAttribute('stroke-dasharray', `${pctQr} 100`);
    }

    let cetakVal = document.getElementById('dg-cetak-val');
    if (cetakVal) cetakVal.textContent = cntCetak;

    let cetakPct = document.getElementById('dg-cetak-pct');
    if (cetakPct) cetakPct.textContent = pctCetak + '% dari total';

    let qrVal = document.getElementById('dg-qr-val');
    if (qrVal) qrVal.textContent = cntQr;

    let qrPct2 = document.getElementById('dg-qr-pct2');
    if (qrPct2) qrPct2.textContent = pctQr + '% dari total';
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

  // --- APP SETTINGS LOGIC ---
  async function fetchSettings() {
    try {
      const { data, error } = await supabase.from('app_settings').select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        data.forEach((setting) => {
          if (setting.key_name === 'marquee_text') {
            const marqInput = document.getElementById('input-marq');
            if (marqInput) marqInput.value = setting.val_text;
          }
          if (setting.key_name === 'video_mode') {
            const vm = document.getElementById('input-video-mode');
            if (vm) {
              vm.value = setting.val_text;
              if (setting.val_text === 'local') {
                document.getElementById('wrapper-vid-yt')?.classList.add('hidden');
                document.getElementById('wrapper-vid-local')?.classList.remove('hidden');
              }
            }
          }
          if (setting.key_name === 'video_url') {
            const vidInput = document.getElementById('input-vid');
            if (vidInput) vidInput.value = setting.val_text;
          }
          if (setting.key_name === 'video_custom_url') {
            const vs = document.getElementById('select-vid-storage');
            if (vs) vs.value = setting.val_text;
          }
          if (setting.key_name === 'audio_mode') {
            const modeInput = document.getElementById('input-audio-mode');
            if (modeInput) {
              modeInput.value = setting.val_text;
              if (setting.val_text === 'url') {
                document.getElementById('wrapper-audio-tts')?.classList.add('hidden');
                document.getElementById('wrapper-audio-url')?.classList.remove('hidden');
              }
            }
          }
          if (setting.key_name === 'audio_tts_template') {
            const tts = document.getElementById('input-tts-template');
            if (tts) tts.value = setting.val_text;
          }
          if (setting.key_name === 'audio_custom_url') {
            const aStorage = document.getElementById('select-audio-storage');
            if (aStorage) {
              // we set this dynamically later after storage fetch, but keep track
              aStorage.dataset.initialValue = setting.val_text;
            }
          }
        });
      }
    } catch (e) {
      console.error('Error fetching settings:', e);
    }

    // Fetch Admins for Settings Table
    fetchAdmins();
  }

  async function fetchAdmins() {
    try {
      const { data, error } = await supabase.from('admin').select('id_admin, username, nama_lengkap');
      if (error) throw error;

      const tbody = document.getElementById('ad-tbody');
      if (tbody && data) {
        let h = '';
        data.forEach((adm) => {
          const initial = adm.nama_lengkap ? adm.nama_lengkap.charAt(0).toUpperCase() : 'A';
          h += `
            <tr class="hover:bg-blue-50/30 transition-colors">
              <td class="px-5 py-4 font-bold text-slate-800 flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-[#0B5C9E]/10 text-[#0B5C9E] font-bold flex items-center justify-center text-xs">${initial}</div>
                ${adm.nama_lengkap}
              </td>
              <td class="px-5 py-4 text-xs text-slate-500">${adm.username}</td>
              <td class="px-5 py-4 text-right">
                <button class="text-slate-400 cursor-not-allowed font-bold px-2 py-1 mx-1 rounded text-xs transition-colors" disabled>Restricted</button>
              </td>
            </tr>
          `;
        });
        tbody.innerHTML = h;
      }
    } catch (e) {
      console.error(e);
    }
  }

  // --- MEDIA STORAGE UPLOAD & FETCH ---
  async function fetchStorageMedia(bucket, typeFilter, selectElemId) {
    const sel = document.getElementById(selectElemId);
    if (!sel) return;
    try {
      const { data, error } = await supabase.storage.from(bucket).list('', { limit: 100 });
      if (error) throw error;
      if (data) {
        const filtered = data.filter((f) => f.metadata && f.metadata.mimetype && f.metadata.mimetype.includes(typeFilter));
        const { data: pubData } = supabase.storage.from(bucket).getPublicUrl('');
        const baseUrl = pubData.publicUrl;

        let h = `<option value="">-- Pilih File dari Storage --</option>`;
        filtered.forEach((f) => {
          const fileUrl = baseUrl + f.name;
          h += `<option value="${fileUrl}">${f.name}</option>`;
        });
        sel.innerHTML = h;

        // map init value if set from fetchSettings
        if (sel.dataset.initialValue) {
          sel.value = sel.dataset.initialValue;
          sel.dataset.initialValue = ''; // clear
        }
      }
    } catch (e) {
      console.warn('Error fetching storage:', e);
    }
  }

  async function uploadMedia(fileInputId, bucket, btnId) {
    const input = document.getElementById(fileInputId);
    const btn = document.getElementById(btnId);
    if (!input || !input.files || input.files.length === 0) return alert('Pilih file terlebih dahulu.');

    const file = input.files[0];
    const prevT = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;

    try {
      // create safe name
      const ext = file.name.split('.').pop();
      const safeName = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`;

      const { data, error } = await supabase.storage.from(bucket).upload(safeName, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      alert('File berhasil diunggah!');

      // refresh lists
      if (file.type.includes('video')) fetchStorageMedia('media', 'video', 'select-vid-storage');
      if (file.type.includes('audio')) fetchStorageMedia('media', 'audio', 'select-audio-storage');

      input.value = ''; // reset
    } catch (e) {
      alert('Gagal unggah: ' + e.message);
    } finally {
      btn.textContent = prevT;
      btn.disabled = false;
    }
  }

  // Bind Upload Buttons
  document.getElementById('btn-upload-vid')?.addEventListener('click', () => uploadMedia('upload-vid', 'media', 'btn-upload-vid'));
  document.getElementById('btn-upload-audio')?.addEventListener('click', () => uploadMedia('upload-audio', 'media', 'btn-upload-audio'));

  // Bind Mode Toggles
  const ivm = document.getElementById('input-video-mode');
  if (ivm) {
    ivm.addEventListener('change', () => {
      const mode = ivm.value;
      if (mode === 'youtube') {
        document.getElementById('wrapper-vid-yt')?.classList.remove('hidden');
        document.getElementById('wrapper-vid-local')?.classList.add('hidden');
      } else {
        document.getElementById('wrapper-vid-yt')?.classList.add('hidden');
        document.getElementById('wrapper-vid-local')?.classList.remove('hidden');
      }
    });
  }

  const iam = document.getElementById('input-audio-mode');
  if (iam) {
    iam.addEventListener('change', () => {
      const mode = iam.value;
      if (mode === 'url') {
        document.getElementById('wrapper-audio-tts')?.classList.add('hidden');
        document.getElementById('wrapper-audio-url')?.classList.remove('hidden');
      } else {
        document.getElementById('wrapper-audio-tts')?.classList.remove('hidden');
        document.getElementById('wrapper-audio-url')?.classList.add('hidden');
      }
    });
  }

  const btnSaveMarq = document.getElementById('btn-save-marq');
  if (btnSaveMarq) {
    btnSaveMarq.addEventListener('click', async () => {
      const newVal = document.getElementById('input-marq').value.trim();

      if (!newVal) return alert('Teks pengumuman tidak boleh kosong!');

      const prevText = btnSaveMarq.textContent;
      btnSaveMarq.textContent = 'Menyimpan...';
      btnSaveMarq.disabled = true;

      try {
        const { error } = await supabase.from('app_settings').upsert({ key_name: 'marquee_text', val_text: newVal }, { onConflict: 'key_name' });
        if (error) throw error;
        alert('Teks Berjalan berhasil diperbarui!');
      } catch (e) {
        alert('Gagal menyimpan teks: ' + e.message);
      } finally {
        btnSaveMarq.textContent = prevText;
        btnSaveMarq.disabled = false;
      }
    });
  }

  const btnSaveVideo = document.getElementById('btn-save-video');
  if (btnSaveVideo) {
    btnSaveVideo.addEventListener('click', async () => {
      const vMode = document.getElementById('input-video-mode').value;
      const vYt = document.getElementById('input-vid') ? document.getElementById('input-vid').value.trim() : '';
      const vCust = document.getElementById('select-vid-storage') ? document.getElementById('select-vid-storage').value : '';

      const prevText = btnSaveVideo.textContent;
      btnSaveVideo.textContent = 'Menyimpan...';
      btnSaveVideo.disabled = true;

      try {
        const promises = [
          supabase.from('app_settings').upsert({ key_name: 'video_mode', val_text: vMode }, { onConflict: 'key_name' }),
          supabase.from('app_settings').upsert({ key_name: 'video_url', val_text: vYt }, { onConflict: 'key_name' }),
          supabase.from('app_settings').upsert({ key_name: 'video_custom_url', val_text: vCust }, { onConflict: 'key_name' }),
        ];

        const results = await Promise.all(promises);
        results.forEach((r) => {
          if (r.error) throw r.error;
        });

        alert('Pengaturan Layar Video berhasil diperbarui!');
      } catch (e) {
        alert('Gagal menyimpan pengaturan video: ' + e.message);
      } finally {
        btnSaveVideo.textContent = prevText;
        btnSaveVideo.disabled = false;
      }
    });
  }

  // --- AUDIO CONFIGURATOR LOGIC ---
  const inpAudioMode = document.getElementById('input-audio-mode');
  const wrapperAudioUrl = document.getElementById('wrapper-audio-url');
  if (inpAudioMode && wrapperAudioUrl) {
    inpAudioMode.addEventListener('change', () => {
      if (inpAudioMode.value === 'url') {
        wrapperAudioUrl.classList.remove('hidden');
      } else {
        wrapperAudioUrl.classList.add('hidden');
      }
    });
  }
  const btnSaveAudio = document.getElementById('btn-save-audio');
  if (btnSaveAudio) {
    btnSaveAudio.addEventListener('click', async () => {
      const moVal = document.getElementById('input-audio-mode').value;
      const ttsVal = document.getElementById('input-tts-template') ? document.getElementById('input-tts-template').value.trim() : '';
      const urVal = document.getElementById('select-audio-storage') ? document.getElementById('select-audio-storage').value : '';

      if (moVal === 'url' && !urVal) {
        return alert('Pastikan Anda telah memilih File Suara Custom jika mode Putar Audio diaktifkan!');
      }

      const prevText = btnSaveAudio.textContent;
      btnSaveAudio.textContent = 'Menyimpan...';
      btnSaveAudio.disabled = true;

      try {
        const promises = [
          supabase.from('app_settings').update({ val_text: moVal }).eq('key_name', 'audio_mode'),
          supabase.from('app_settings').update({ val_text: ttsVal }).eq('key_name', 'audio_tts_template'),
          supabase.from('app_settings').update({ val_text: urVal }).eq('key_name', 'audio_custom_url'),
        ];

        const results = await Promise.all(promises);
        results.forEach((r) => {
          if (r.error) throw r.error;
        });

        alert('Pengaturan Profil Suara Panggilan berhasil diterapkan!');
      } catch (e) {
        alert('Gagal menyimpan profil suara: ' + e.message);
      } finally {
        btnSaveAudio.textContent = prevText;
        btnSaveAudio.disabled = false;
      }
    });
  }

  // Call initialization for storage selections
  fetchStorageMedia('media', 'video', 'select-vid-storage');
  fetchStorageMedia('media', 'audio', 'select-audio-storage');
});
