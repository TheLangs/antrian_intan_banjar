import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const errorState = document.getElementById('error-state');
  const ticketCard = document.getElementById('ticket-card');

  // UI Elements
  const elNomor = document.getElementById('t-nomor');
  const elStatusBadge = document.getElementById('badge-status');
  const elSisa = document.getElementById('t-sisa');
  const elLoket = document.getElementById('t-loket');
  const connStatus = document.getElementById('conn-status');

  // Blocks
  const waitInfo = document.getElementById('wait-info');
  const callInfo = document.getElementById('call-info');
  const doneMask = document.getElementById('done-mask');

  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (!token) {
    showError();
    return;
  }

  let currentTicketId = null;

  // Initial Fetch
  await fetchTicketData();

  // Setup Realtime Subscription
  setupRealtime();

  async function fetchTicketData() {
    try {
      const { data, error } = await supabase
        .from('antrian')
        .select(
          `
                    id_antrian, 
                    nomor_antrian, 
                    kode_antrian, 
                    status, 
                    id_loket, 
                    loket(nama_loket)
                `,
        )
        .eq('access_token', token)
        .single();

      if (error || !data) {
        showError();
        return;
      }

      currentTicketId = data.id_antrian;
      renderTicket(data);

      if (data.status === 'menunggu') {
        updateQueueAhead(currentTicketId);
        updateServingStatus();
      }

      setConnectionStatus('connected');
    } catch (err) {
      console.error('Fetch err:', err);
      showError();
    }
  }

  function renderTicket(data) {
    ticketCard.classList.remove('hidden');
    errorState.classList.add('hidden');

    elNomor.textContent = `${data.kode_antrian}-${String(data.nomor_antrian).padStart(3, '0')}`;

    // Render Status Mode
    switch (data.status) {
      case 'menunggu':
        elStatusBadge.className = 'inline-flex items-center px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200';
        elStatusBadge.textContent = 'Status: Menunggu';

        callInfo.classList.add('hidden');
        callInfo.classList.remove('flex', 'scale-100', 'opacity-100');
        callInfo.classList.add('scale-95', 'opacity-0');
        doneMask.classList.add('hidden');
        doneMask.classList.remove('flex');
        break;

      case 'dipanggil':
        elStatusBadge.className = 'inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200';
        elStatusBadge.textContent = 'Giliran Anda!';

        elLoket.textContent = data.loket?.nama_loket || `Loket ${data.id_loket || '-'}`;

        // timeout to allow browser layout calc if previously hidden
        callInfo.classList.remove('hidden');
        callInfo.classList.add('flex');
        setTimeout(() => {
          callInfo.classList.remove('scale-95', 'opacity-0');
          callInfo.classList.add('scale-100', 'opacity-100');
        }, 50);

        // hide wait info blocks
        if (waitInfo) waitInfo.classList.add('hidden');
        document.getElementById('guide-info')?.classList.add('hidden');

        // play local haptic feedback if available
        try {
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        } catch (e) {}

        doneMask.classList.add('hidden');
        break;

      case 'selesai':
      case 'terlewat':
      case 'batal':
        const dmIconBg = document.getElementById('dm-icon-bg');
        const dmIcon = document.getElementById('dm-icon');
        const dmTitle = document.getElementById('dm-title');
        const dmDesc = document.getElementById('dm-desc');
        const dmBtn = document.getElementById('dm-btn');

        doneMask.classList.remove('hidden');
        doneMask.classList.add('flex');

        // Hide call-info and wait-info in case of direct state transition
        callInfo.classList.add('hidden');
        if (waitInfo) waitInfo.classList.add('hidden');
        document.getElementById('guide-info')?.classList.add('hidden');

        if (data.status === 'terlewat' || data.status === 'batal') {
          dmIconBg.className = 'w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 shadow-sm';
          dmIcon.textContent = 'warning';
          dmTitle.className = 'text-2xl font-bold text-red-700 mb-2';
          dmTitle.textContent = data.status === 'terlewat' ? 'Antrean Terlewat' : 'Antrean Dibatalkan';
          dmDesc.className = 'text-sm font-medium text-red-600/80 mb-8 max-w-[250px] mx-auto';
          dmDesc.textContent =
            data.status === 'terlewat' ? 'Nomor Anda telah terlewat. Mohon tunggu di area pendaftaran. Jika kondisi sudah siap, silakan konfirmasi ke petugas untuk dipanggil kembali.' : 'Nomor antrean Anda telah dibatalkan.';
          dmBtn.className = 'bg-red-600 text-white hover:bg-red-700 text-sm font-bold px-8 py-3 rounded-full transition-colors shadow-sm';
        } else {
          // Default to selesai (success mode)
          dmIconBg.className = 'w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-sm';
          dmIcon.textContent = 'check_circle';
          dmTitle.className = 'text-2xl font-bold text-emerald-700 mb-2';
          dmTitle.textContent = 'Antrean Selesai';
          dmDesc.className = 'text-sm font-medium text-slate-500 mb-8 max-w-[250px] mx-auto';
          dmDesc.textContent = 'Pelayanan telah selesai. Terima kasih atas kunjungan Anda.';
          dmBtn.className = 'bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-bold px-8 py-3 rounded-full transition-colors shadow-sm';
        }
        break;
    }
  }

  async function updateQueueAhead(myId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    try {
      const { count, error } = await supabase.from('antrian').select('*', { count: 'exact', head: true }).eq('status', 'menunggu').lt('id_antrian', myId).gte('waktu_ambil', todayStart.toISOString());

      if (!error && count !== null) {
        elSisa.textContent = count.toString();

        const elEstimasi = document.getElementById('t-estimasi');
        if (elEstimasi) {
          const proxyMins = count * 3; // Estimated 3 mins per person
          elEstimasi.innerHTML = `~ ${proxyMins} <span class="text-base text-slate-500">Min</span>`;
        }
      }
    } catch (e) {
      console.log(e);
    }
  }

  async function updateServingStatus() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    try {
      const { data, error } = await supabase
        .from('antrian')
        .select('kode_antrian, nomor_antrian, id_loket, loket(nama_loket)')
        .eq('status', 'dipanggil')
        .gte('waktu_ambil', todayStart.toISOString())
        .order('waktu_panggil', { ascending: false });

      const panel = document.getElementById('currently-serving-panel');
      const list = document.getElementById('serving-list');

      if (error || !data || data.length === 0) {
        if (panel) panel.classList.add('hidden');
        return;
      }

      if (panel) panel.classList.remove('hidden');
      if (list) {
        list.innerHTML = data
          .map(
            (q, idx) => `
          <div class="flex items-center justify-between p-3 rounded-xl ${idx === 0 ? 'bg-slate-50 border border-slate-200' : 'border border-slate-100'}">
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-full ${idx === 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'} flex items-center justify-center font-bold text-lg">
                ${q.id_loket || '-'}
              </div>
              <div>
                <span class="block text-xs font-semibold text-slate-500 uppercase tracking-wider">${q.loket?.nama_loket || 'Loket'}</span>
                <span class="block text-xl font-bold text-slate-800">${q.kode_antrian}-${String(q.nomor_antrian).padStart(3, '0')}</span>
              </div>
            </div>
            ${idx === 0 ? '<span class="material-symbols-outlined text-amber-500 animate-pulse">volume_up</span>' : ''}
          </div>
        `,
          )
          .join('');
      }
    } catch (e) {
      console.log(e);
    }
  }

  function setupRealtime() {
    const channel = supabase.channel('mobile-ticket-tracker');

    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'antrian',
        },
        (payload) => {
          // Did OUR ticket update?
          if (payload.new.access_token === token) {
            // refetch to get joined loket data cleanly
            fetchTicketData();
          } else if (payload.new.status !== 'menunggu') {
            // Someone else got called (or finished etc).
            if (currentTicketId && callInfo.classList.contains('hidden')) {
              updateQueueAhead(currentTicketId);
              updateServingStatus();
            }
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
        }
      });
  }

  function setConnectionStatus(status) {
    if (status === 'connected') {
      connStatus.className = 'inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 transition-colors shadow-sm tracking-wide uppercase';
      connStatus.innerHTML = `<span class="relative flex h-2 w-2 mr-1"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span> LIVE STATUS`;
    } else {
      connStatus.className = 'inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 transition-colors shadow-sm tracking-wide uppercase';
      connStatus.innerHTML = `<span class="relative flex h-2 w-2 mr-1"><span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span> TERPUTUS`;
    }
  }

  function showError() {
    errorState.classList.remove('hidden');
    ticketCard.classList.add('hidden');
    setConnectionStatus('disconnected');
  }
});
