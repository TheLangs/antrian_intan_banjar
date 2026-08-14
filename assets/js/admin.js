import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  // Auth Check
  const adminId = localStorage.getItem('ib_admin_id');
  if (!adminId) {
    window.location.href = 'admin_login.html';
    return;
  }
  document.getElementById('admin-name').textContent = localStorage.getItem('ib_admin_name') || 'Admin';

  // UI elements
  const inpStart = document.getElementById('date-start');
  const inpEnd = document.getElementById('date-end');
  const btnFilter = document.getElementById('btn-filter');
  const btnExport = document.getElementById('btn-export');
  const btnLogout = document.getElementById('btn-logout');

  const kpiTotal = document.getElementById('kpi-total');
  const kpiSelesai = document.getElementById('kpi-selesai');
  const kpiTerlewat = document.getElementById('kpi-terlewat');
  const kpiAvgWait = document.getElementById('kpi-avg-wait');

  const tableBody = document.getElementById('table-body');
  const tableEmpty = document.getElementById('table-empty');
  const loader = document.getElementById('loader');

  let currentReportData = [];

  // Set default dates (Today)
  const today = new Date();
  // Offset local timezone for ISO format
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  inpStart.value = localToday;
  inpEnd.value = localToday;

  // Events
  btnFilter.addEventListener('click', fetchData);
  btnLogout.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'admin_login.html';
  });
  btnExport.addEventListener('click', generatePDF);

  // Initial Load
  fetchData();

  async function fetchData() {
    loader.classList.remove('hidden');
    tableEmpty.classList.add('hidden');
    tableBody.innerHTML = '';

    try {
      // Append times to date range for full day coverage (ISO)
      const startD = new Date(inpStart.value + 'T00:00:00').toISOString();
      const endD = new Date(inpEnd.value + 'T23:59:59').toISOString();

      const { data, error } = await supabase.from('antrian').select('*, loket(nama_loket)').gte('waktu_ambil', startD).lte('waktu_ambil', endD).order('id_antrian', { ascending: true });

      if (error) throw error;

      currentReportData = data || [];
      processAndRender(currentReportData);
    } catch (err) {
      console.error(err);
      alert('Gagal memuat data laporan.');
    } finally {
      loader.classList.add('hidden');
    }
  }

  function processAndRender(data) {
    if (data.length === 0) {
      tableEmpty.classList.remove('hidden');
      kpiTotal.textContent = '0';
      kpiSelesai.textContent = '0';
      kpiTerlewat.textContent = '0';
      kpiAvgWait.textContent = '0m 0s';
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
      tableBody.appendChild(tr);
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
});
