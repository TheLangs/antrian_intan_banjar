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
        elStatusBadge.className = 'px-4 py-1.5 rounded-full text-sm font-bold bg-slate-100 text-slate-600';
        elStatusBadge.textContent = 'Dalam Antrean';

        callInfo.classList.remove('translate-y-0');
        callInfo.classList.add('translate-y-full');
        doneMask.classList.add('hidden');
        break;

      case 'dipanggil':
        elStatusBadge.className = 'px-4 py-1.5 rounded-full text-sm font-bold bg-amber-100 text-amber-700';
        elStatusBadge.textContent = 'Giliran Anda!';

        elLoket.textContent = data.loket?.nama_loket || `Loket ${data.id_loket || '-'}`;

        // timeout to allow browser layout calc if previously hidden
        setTimeout(() => {
          callInfo.classList.remove('translate-y-full');
          callInfo.classList.add('translate-y-0');
        }, 50);

        // play local haptic feedback if available
        try {
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        } catch (e) {}

        doneMask.classList.add('hidden');
        break;

      case 'selesai':
      case 'terlewat':
      case 'batal':
        doneMask.classList.remove('hidden');
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
            // Someone else got called (or finished etc). If we are waiting, update counter.
            if (currentTicketId && callInfo.classList.contains('translate-y-full')) {
              updateQueueAhead(currentTicketId);
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
