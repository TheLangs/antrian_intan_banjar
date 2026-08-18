import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Session check
  const sessionId = localStorage.getItem('ib_session_token');
  const idLoket = localStorage.getItem('ib_id_loket');
  const namaPetugas = localStorage.getItem('ib_nama_petugas');

  if (!sessionId || !idLoket) {
    window.location.href = 'counter_login.html';
    return;
  }

  document.getElementById('header-info').textContent = `Loket ${idLoket} | Petugas: ${namaPetugas}`;

  // UI Elements
  const elActiveNomor = document.getElementById('active-nomor');
  const btnNextMode = document.getElementById('btn-group-next');
  const btnActiveMode = document.getElementById('btn-group-active');

  const btnPanggil = document.getElementById('btn-panggil');
  const btnSelesai = document.getElementById('btn-selesai');
  const btnLewati = document.getElementById('btn-lewati');
  const btnLogout = document.getElementById('btn-logout');
  const btnRefresh = document.getElementById('btn-refresh');

  const cntMenunggu = document.getElementById('cnt-menunggu');
  const listTerlewat = document.getElementById('list-terlewat');
  const loader = document.getElementById('loader');

  let currentActiveId = null;

  // Initialization
  await verifySession();
  await fetchActiveQueue();
  await fetchTerlewat();
  await fetchCountWaiting();
  startHeartbeat();
  setupRealtime();

  // Events
  btnPanggil.addEventListener('click', callNext);
  btnSelesai.addEventListener('click', () => setStatus('selesai'));
  btnLewati.addEventListener('click', () => setStatus('terlewat'));
  btnLogout.addEventListener('click', logout);
  btnRefresh.addEventListener('click', async () => {
    showLoader();
    await fetchActiveQueue();
    await fetchTerlewat();
    await fetchCountWaiting();
    hideLoader();
  });

  function showLoader() {
    loader.classList.remove('hidden');
  }
  function hideLoader() {
    loader.classList.add('hidden');
  }

  async function verifySession() {
    const { data, error } = await supabase.from('loket').select('session_token').eq('id_loket', idLoket).single();

    if (error || !data || data.session_token !== sessionId) {
      alert('Sesi Anda telah berakhir atau loket diambil alih petugas lain.');
      localStorage.clear();
      window.location.href = 'counter_login.html';
    }
  }

  async function fetchActiveQueue() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase.from('antrian').select('*').eq('id_loket', idLoket).eq('status', 'dipanggil').gte('waktu_ambil', todayStart.toISOString()).limit(1).maybeSingle();

    if (!error && data) {
      currentActiveId = data.id_antrian;
      elActiveNomor.textContent = `${data.kode_antrian}-${String(data.nomor_antrian).padStart(3, '0')}`;
      btnNextMode.classList.add('hidden');
      btnActiveMode.classList.remove('hidden');
      btnActiveMode.classList.add('flex');
    } else {
      currentActiveId = null;
      elActiveNomor.textContent = '- - -';
      btnNextMode.classList.remove('hidden');
      btnActiveMode.classList.add('hidden');
      btnActiveMode.classList.remove('flex');
    }
  }

  async function callNext() {
    showLoader();
    try {
      const { data, error } = await supabase.rpc('call_next_queue', {
        p_id_loket: parseInt(idLoket),
        p_nama_petugas: namaPetugas,
      });

      if (error) throw error;
      if (data && data.success) {
        await fetchActiveQueue();
        await fetchCountWaiting();
      } else {
        alert(data?.message || 'Tidak ada antrean yang menunggu.');
      }
    } catch (err) {
      console.error(err);
      alert('Gagal memanggil antrean. Silakan coba lagi.');
    } finally {
      hideLoader();
    }
  }

  async function setStatus(targetStatus) {
    if (!currentActiveId) return;
    showLoader();
    try {
      const { error } = await supabase
        .from('antrian')
        .update({
          status: targetStatus,
          waktu_selesai: new Date().toISOString(),
        })
        .eq('id_antrian', currentActiveId);

      if (error) throw error;
      currentActiveId = null;
      await fetchActiveQueue();
      if (targetStatus === 'terlewat') await fetchTerlewat();
    } catch (err) {
      console.error(err);
      alert('Gagal mengubah status.');
    } finally {
      hideLoader();
    }
  }

  async function fetchTerlewat() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase.from('antrian').select('id_antrian, nomor_antrian, kode_antrian, waktu_ambil').eq('status', 'terlewat').gte('waktu_ambil', todayStart.toISOString()).order('id_antrian', { ascending: false });

    listTerlewat.innerHTML = '';
    if (error || !data || data.length === 0) {
      listTerlewat.innerHTML = '<div class="text-center p-6 text-slate-400 text-sm font-medium">Tidak ada antrean terlewat.</div>';
      return;
    }

    data.forEach((item) => {
      const noLengkap = `${item.kode_antrian}-${String(item.nomor_antrian).padStart(3, '0')}`;
      const timeStr = new Date(item.waktu_ambil).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      const div = document.createElement('div');
      div.className = 'bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm hover:border-blue-200 transition-colors';
      div.innerHTML = `
                <div>
                    <p class="font-bold text-slate-700 text-lg">${noLengkap}</p>
                    <p class="text-[10px] text-slate-400">Waktu Ambil: ${timeStr}</p>
                </div>
                <button class="btn-panggil-terlewat bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold px-3 py-2 rounded-lg transition-colors" data-id="${item.id_antrian}">
                    Panggil Lagi
                </button>
            `;
      listTerlewat.appendChild(div);
    });

    document.querySelectorAll('.btn-panggil-terlewat').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await panggilTerlewat(id);
      });
    });
  }

  async function panggilTerlewat(targetId) {
    if (currentActiveId) {
      alert('Selesaikan atau lewati antrean aktif saat ini terlebih dahulu.');
      return;
    }

    showLoader();
    try {
      const { error } = await supabase
        .from('antrian')
        .update({
          status: 'dipanggil',
          id_loket: parseInt(idLoket),
          nama_petugas: namaPetugas,
          waktu_panggil: new Date().toISOString(),
        })
        .eq('id_antrian', targetId)
        .eq('status', 'terlewat'); // safety guard

      if (error) throw error;
      await fetchActiveQueue();
      await fetchTerlewat();
    } catch (e) {
      alert('Gagal memanggil antrean terlewat.');
    } finally {
      hideLoader();
    }
  }

  async function fetchCountWaiting() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count, error } = await supabase.from('antrian').select('*', { count: 'exact', head: true }).eq('status', 'menunggu').gte('waktu_ambil', todayStart.toISOString());

    if (!error && count !== null) {
      cntMenunggu.textContent = count;
    }
  }

  function startHeartbeat() {
    setInterval(async () => {
      await supabase.from('loket').update({ last_seen: new Date().toISOString() }).eq('id_loket', idLoket).eq('session_token', sessionId);
    }, 10000);
  }

  function setupRealtime() {
    const channel = supabase.channel('counter-tracker');
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'antrian' }, () => {
        fetchCountWaiting();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'antrian' }, () => {
        fetchCountWaiting();
      })
      .subscribe();
  }

  async function logout() {
    showLoader();
    await supabase
      .from('loket')
      .update({
        session_token: null,
        last_seen: new Date().toISOString(),
      })
      .eq('id_loket', idLoket)
      .eq('session_token', sessionId);

    localStorage.clear();
    window.location.href = 'counter_login.html';
  }
});
