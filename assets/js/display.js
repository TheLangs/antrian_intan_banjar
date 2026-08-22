import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  // Clock Setup
  const elClock = document.getElementById('clock');
  const elDate = document.getElementById('date');
  const initAudioOverlay = document.getElementById('init-audio');
  const btnFullscreen = document.getElementById('btn-fullscreen');

  // Fullscreen Management
  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch((err) => console.error(err));
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      btnFullscreen.classList.add('hidden');
    } else {
      btnFullscreen.classList.remove('hidden');
    }
  });

  const displayGrid = document.getElementById('display-grid-top');
  let counters = {};

  async function initDisplayGrid() {
    try {
      const { data, error } = await supabase.from('loket').select('*').order('id_loket', { ascending: true });
      if (error) throw error;

      displayGrid.innerHTML = '';
      counters = {};

      data.forEach((loket) => {
        const id = loket.id_loket;
        const card = document.createElement('div');
        card.className = 'bg-white rounded-[2rem] shadow-xl border border-slate-200 flex flex-col overflow-hidden h-full relative transform transition-all duration-300';
        card.id = `card-loket-${id}`;
        card.innerHTML = `
          <div class="bg-blue-800 text-white text-center py-4 md:py-5 transition-colors duration-300 z-10 shrink-0 w-full overflow-hidden">
             <h2 class="text-2xl md:text-3xl lg:text-4xl font-bold tracking-widest truncate px-2">${loket.nama_loket.toUpperCase()}</h2>
          </div>
          <div class="flex-grow flex flex-col items-center justify-center bg-white relative pb-6 pt-4 px-2 overflow-hidden">
             <span class="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest mb-1 md:mb-3 truncate w-full text-center">Nomor Antrean</span>
             <div class="text-5xl md:text-6xl lg:text-7xl xl:text-[5.5rem] font-black text-slate-800 leading-none tracking-tight w-full text-center truncate" id="disp-no-${id}">---</div>
          </div>
          <div class="absolute bottom-0 w-full bg-sky-50 py-3 md:py-4 px-4 md:px-8 border-t border-slate-100 flex items-center justify-between overflow-hidden">
             <span class="text-xs md:text-sm font-bold text-slate-500 uppercase flex items-center gap-1 md:gap-2 shrink-0">
               <svg class="w-4 h-4 md:w-5 md:h-5 text-blue-800" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path></svg>
               <span class="hidden md:inline">Petugas</span>
             </span>
             <span class="text-sm md:text-base font-black text-blue-800 uppercase tracking-widest truncate text-right pl-2" id="disp-nama-${id}">-</span>
          </div>
        `;
        displayGrid.appendChild(card);

        counters[id] = {
          card: card,
          no: card.querySelector(`#disp-no-${id}`),
          nama: card.querySelector(`#disp-nama-${id}`),
        };
      });

      // Proceed with initial queue fetch ONLY after DOM grid is built
      fetchInitialActive();
    } catch (e) {
      console.error('Error init display:', e);
    }
  }

  let audioContextAllowed = false;
  let isSpeaking = false;
  let announcementQueue = [];

  let globalAudioMode = 'tts';
  let globalAudioCustomUrl = '';
  let globalAudioTtsTemplate = 'Nomor antrean, {nomor}, silakan menuju, Loket {loket}';

  let globalVideoMode = 'youtube';
  let globalVideoUrl = '';
  let globalVideoCustomUrl = '';

  // Allow Audio Interaction
  initAudioOverlay.addEventListener('click', () => {
    audioContextAllowed = true;
    initAudioOverlay.classList.add('hidden');

    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch((e) => console.log(e));
    }

    if (window.speechSynthesis) window.speechSynthesis.getVoices();
  });

  setInterval(updateTime, 1000);
  updateTime();

  initDisplayGrid();
  fetchSettings();
  fetchWaitingQueue();
  setupRealtime();

  function updateTime() {
    const now = new Date();
    elClock.textContent = now.toLocaleTimeString('id-ID', { hour12: false });
    elDate.textContent = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  async function fetchInitialActive() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    try {
      const { data, error } = await supabase.from('antrian').select('id_loket, nomor_antrian, kode_antrian, nama_petugas').eq('status', 'dipanggil').gte('waktu_ambil', todayStart.toISOString());
      if (error) throw error;
      Object.keys(counters).forEach((id) => updateCounterUI(id, '---', '-'));
      if (data && data.length > 0) {
        data.forEach((item) => {
          if (item.id_loket && counters[item.id_loket]) {
            const noLengkap = `${item.kode_antrian}-${String(item.nomor_antrian).padStart(3, '0')}`;
            updateCounterUI(item.id_loket, noLengkap, item.nama_petugas);
          }
        });
      }
    } catch (e) {
      console.error('Fetch Initial Err:', e);
    }
  }

  function renderMediaContainer() {
    const mc = document.getElementById('media-container');
    if (!mc) return;

    // Smart YouTube ID Extractor
    function extractYouTubeID(url) {
      if (!url) return '';
      const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      return match && match[2].length === 11 ? match[2] : url; // fallback
    }

    if (globalVideoMode === 'youtube' && globalVideoUrl) {
      const safeId = extractYouTubeID(globalVideoUrl);
      mc.innerHTML = `<iframe class="w-full h-full border-0" src="https://www.youtube.com/embed/${safeId}?autoplay=1&mute=1&loop=1&playlist=${safeId}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    } else if (globalVideoMode === 'local' && globalVideoCustomUrl) {
      mc.innerHTML = `<video class="w-full h-full object-cover" autoplay loop muted src="${globalVideoCustomUrl}"></video>`;
    } else {
      mc.innerHTML = `<p class="text-slate-500 font-bold tracking-widest text-xl opacity-50">Menunggu Sinyal Media...</p>`;
    }
  }

  async function fetchSettings() {
    try {
      const { data, error } = await supabase.from('app_settings').select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        data.forEach((setting) => {
          if (setting.key_name === 'marquee_text') {
            const marqUI = document.getElementById('tv-marquee');
            if (marqUI) marqUI.textContent = setting.val_text;
          }
          if (setting.key_name === 'audio_mode') globalAudioMode = setting.val_text;
          if (setting.key_name === 'audio_custom_url') globalAudioCustomUrl = setting.val_text;
          if (setting.key_name === 'audio_tts_template') globalAudioTtsTemplate = setting.val_text;

          if (setting.key_name === 'video_mode') globalVideoMode = setting.val_text;
          if (setting.key_name === 'video_url') globalVideoUrl = setting.val_text;
          if (setting.key_name === 'video_custom_url') globalVideoCustomUrl = setting.val_text;
        });
        renderMediaContainer();
      }
    } catch (e) {
      console.error('Fetch Settings Err:', e);
    }
  }

  function updateCounterUI(idLoket, nomorLengkap, namaPetugas) {
    if (!counters[idLoket]) return;
    counters[idLoket].no.textContent = nomorLengkap;
    counters[idLoket].nama.textContent = namaPetugas || '-';
  }

  function highlightCounter(idLoket) {
    if (!counters[idLoket]) return;

    const card = counters[idLoket].card;

    // Tailwind highlight classes conforming to DESIGN.md
    card.classList.add('ring-4', 'ring-amber-500', 'animate-pulse', 'scale-105', 'z-50');
    card.querySelector('.bg-blue-800').classList.replace('bg-blue-800', 'bg-amber-500');

    setTimeout(() => {
      card.classList.remove('ring-4', 'ring-amber-500', 'animate-pulse', 'scale-105', 'z-50');
      card.querySelector('.bg-amber-500').classList.replace('bg-amber-500', 'bg-blue-800');
    }, 8000);
  }

  async function playCallingAnnouncement(idLoket, nomorLengkap) {
    if (!audioContextAllowed) return;

    announcementQueue.push({ idLoket, nomorLengkap });
    processAnnouncementQueue();
  }

  async function processAnnouncementQueue() {
    if (isSpeaking || announcementQueue.length === 0) return;

    isSpeaking = true;
    const { idLoket, nomorLengkap } = announcementQueue.shift();

    highlightCounter(idLoket);

    // Play Bell Chime (synthetic fallback if missing)
    await tryPlayBell();

    if (globalAudioMode === 'url' && globalAudioCustomUrl) {
      // Stream & Play Custom HTML5 Audio
      const audioObj = new Audio(globalAudioCustomUrl);

      audioObj.onended = () => {
        setTimeout(() => {
          isSpeaking = false;
          processAnnouncementQueue();
        }, 1000);
      };

      audioObj.play().catch((e) => {
        console.error('Gagal memutar audio URL Custom:', e);
        // Lepas kunci dan lanjut jika gagal diunduh
        isSpeaking = false;
        processAnnouncementQueue();
      });
      return; // Batalkan aliran TTS
    }

    // text-to-speech (Default Mode)
    if ('speechSynthesis' in window) {
      setTimeout(() => {
        // Split number to be spelled clearly: A, 0, 0, 5
        let spokenNomor = nomorLengkap.replace('-', ' ').split('').join(' ');

        let text = globalAudioTtsTemplate.replace(/\{nomor\}/g, spokenNomor).replace(/\{loket\}/g, idLoket);
        if (!text) text = `Nomor antrean, ${spokenNomor}, silakan menuju, Loket ${idLoket}`;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        utterance.rate = 0.85;
        utterance.pitch = 1.1; // Sedikit dinaikkan untuk perempuan

        // Cari profil suara perempuan Indonesia
        const voices = window.speechSynthesis.getVoices();
        const fmVoice = voices.find((v) => v.lang.includes('id') && v.name.toLowerCase().includes('female'));
        if (fmVoice) {
          utterance.voice = fmVoice;
        }

        utterance.onend = () => {
          setTimeout(() => {
            isSpeaking = false;
            processAnnouncementQueue();
          }, 1000); // 1-sec pause before next annoucement
        };

        // Fire
        window.speechSynthesis.speak(utterance);
      }, 1200);
    } else {
      // fallback
      setTimeout(() => {
        isSpeaking = false;
        processAnnouncementQueue();
      }, 3000);
    }
  }

  function tryPlayBell() {
    return new Promise((resolve) => {
      try {
        // Audio object playback
        const audio = new Audio('assets/audio/bell.mp3');
        audio
          .play()
          .then(() => {
            setTimeout(resolve, 1500);
          })
          .catch((e) => {
            console.log('Audio file missing or blocked, utilizing synthesized Web Audio API chime as fallback.');
            playSyntheticBeep();
            setTimeout(resolve, 1500);
          });
      } catch (error) {
        resolve();
      }
    });
  }

  // Web Audio Fallback if bell.mp3 not found
  function playSyntheticBeep() {
    const audioCtx = window.AudioContext ? new AudioContext() : window.webkitAudioContext ? new webkitAudioContext() : null;

    if (!audioCtx) return;

    function playNote(freq, startTime, duration) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(1, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration);
    }

    playNote(783.99, audioCtx.currentTime, 0.6); // G5
    playNote(523.25, audioCtx.currentTime + 0.5, 0.8); // C5
  }

  // --- Waiting Queue List Tracker ---
  async function fetchWaitingQueue() {
    const container = document.getElementById('queue-history-list');
    if (!container) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    try {
      const { data, error } = await supabase
        .from('antrian')
        .select('id_antrian, nomor_antrian, kode_antrian, waktu_ambil')
        .eq('status', 'menunggu')
        .gte('waktu_ambil', todayStart.toISOString())
        .order('id_antrian', { ascending: true })
        .limit(10);

      if (error) throw error;

      container.innerHTML = '';
      if (!data || data.length === 0) {
        container.innerHTML = `
          <div class="flex-grow flex flex-col items-center justify-center text-center p-6 text-slate-400 my-auto">
            <div class="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <svg class="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <p class="font-bold text-sm uppercase tracking-wider text-slate-600">Semua Antrean Terlayani</p>
            <p class="text-xs text-slate-400 mt-1">Tidak ada antrean yang menunggu</p>
          </div>
        `;
        return;
      }

      data.forEach((item, index) => {
        const noLengkap = `${item.kode_antrian}-${String(item.nomor_antrian).padStart(3, '0')}`;
        const timeStr = new Date(item.waktu_ambil).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');

        const el = document.createElement('div');
        el.className = 'bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200 border-l-[6px] border-l-blue-600 flex items-center justify-between shrink-0 transition-all duration-300 hover:shadow-md';
        el.innerHTML = `
          <div class="min-w-0 overflow-hidden pr-2">
             <div class="flex items-center gap-2 mb-1">
               <span class="text-[10px] xl:text-[11px] font-bold bg-blue-50 text-blue-800 px-2 py-0.5 rounded uppercase tracking-wider">Antrean #${index + 1}</span>
               <span class="text-[10px] xl:text-[11px] font-semibold text-slate-400 tracking-wide">Ambil: ${timeStr}</span>
             </div>
             <span class="text-2xl xl:text-3xl font-black text-slate-800 leading-none tracking-tight truncate w-full block">${noLengkap}</span>
          </div>
          <div class="text-right flex flex-col items-end shrink-0 pl-1">
             <span class="text-xs xl:text-sm font-bold bg-amber-50 text-amber-700 px-2.5 xl:px-3 py-1 rounded-lg border border-amber-200/60 whitespace-nowrap flex items-center gap-1.5">
               <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
               Menunggu
             </span>
          </div>
        `;
        container.appendChild(el);
      });
    } catch (e) {
      console.error('Fetch Waiting Queue Err:', e);
    }
  }

  function setupRealtime() {
    supabase
      .channel('public-antrian-display')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'antrian',
        },
        (payload) => {
          // Always refresh waiting queue list
          fetchWaitingQueue();

          if (payload.eventType === 'UPDATE' || payload.event === 'UPDATE') {
            const newData = payload.new;
            if (newData && newData.status === 'dipanggil') {
              // Update exact UI
              const noLengkap = `${newData.kode_antrian}-${String(newData.nomor_antrian).padStart(3, '0')}`;
              updateCounterUI(newData.id_loket, noLengkap, newData.nama_petugas);

              // Trigger sound & visual
              playCallingAnnouncement(newData.id_loket, noLengkap);
            }
          }
        },
      )
      .subscribe();

    // Listen to App Settings Updates
    supabase
      .channel('public-settings')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_settings',
        },
        (payload) => {
          let reRenderMedia = false;

          if (payload.new.key_name === 'marquee_text') {
            const marqUI = document.getElementById('tv-marquee');
            if (marqUI) marqUI.textContent = payload.new.val_text;
          }
          if (payload.new.key_name === 'audio_mode') globalAudioMode = payload.new.val_text;
          if (payload.new.key_name === 'audio_custom_url') globalAudioCustomUrl = payload.new.val_text;
          if (payload.new.key_name === 'audio_tts_template') globalAudioTtsTemplate = payload.new.val_text;

          if (payload.new.key_name === 'video_mode') {
            globalVideoMode = payload.new.val_text;
            reRenderMedia = true;
          }
          if (payload.new.key_name === 'video_url') {
            globalVideoUrl = payload.new.val_text;
            reRenderMedia = true;
          }
          if (payload.new.key_name === 'video_custom_url') {
            globalVideoCustomUrl = payload.new.val_text;
            reRenderMedia = true;
          }

          if (reRenderMedia) {
            renderMediaContainer();
          }
        },
      )
      .subscribe();

    // Broadcast Event for exact Recall actions bypassing pure DB trigger
    supabase
      .channel('display-channel')
      .on('broadcast', { event: 'recall' }, (payload) => {
        const { id_loket, nomor_lengkap } = payload.payload;
        playCallingAnnouncement(id_loket, nomor_lengkap);
        // Note: We don't push to History on pure Recalls to avoid spamming the log
      })
      .subscribe();
  }
});
