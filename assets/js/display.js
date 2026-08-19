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

  const displayGrid = document.getElementById('display-grid');
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
        // We use min-w and flex-1 to allow flexible wrap scaling if there are many lokets
        card.className = 'flex-1 min-w-[300px] max-w-[450px] bg-white rounded-[2rem] shadow-xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300 transform h-[450px] xl:h-[600px] min-h-[400px]';
        card.id = `card-loket-${id}`;
        card.innerHTML = `
          <div class="bg-blue-800 text-white text-center py-6 transition-colors duration-300">
            <h2 class="text-3xl xl:text-4xl font-extrabold tracking-wide">${loket.nama_loket.toUpperCase()}</h2>
          </div>
          <div class="flex-grow flex flex-col items-center justify-center p-6 xl:p-10 bg-slate-50/50">
            <p class="text-xl xl:text-2xl text-slate-500 font-semibold mb-4 xl:mb-6 tracking-widest uppercase">Nomor Antrean</p>
            <div class="text-[100px] xl:text-[140px] font-black text-slate-800 leading-none tracking-tighter" id="disp-no-${id}">---</div>
          </div>
          <div class="bg-slate-100 py-4 xl:py-5 px-6 xl:px-8 border-t border-slate-200 flex items-center justify-between">
            <span class="text-slate-500 font-medium text-lg xl:text-xl">Petugas:</span>
            <span class="text-slate-800 font-bold text-lg xl:text-xl" id="disp-nama-${id}">-</span>
          </div>
        `;
        displayGrid.appendChild(card);

        // Map elements
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

  // Allow Audio Interaction
  initAudioOverlay.addEventListener('click', () => {
    audioContextAllowed = true;
    initAudioOverlay.classList.add('hidden');

    // optional: request full screen
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch((e) => console.log(e));
    }

    // Initialize voices on interaction
    window.speechSynthesis.getVoices();
  });

  setInterval(updateTime, 1000);
  updateTime();

  // Initial DOM and Fetch
  initDisplayGrid();
  fetchSettings();

  // Realtime Listener
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

      // clear defaults
      Object.keys(counters).forEach((id) => updateCounterUI(id, '---', '-'));

      if (data && data.length > 0) {
        // map loket to UI
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
          if (setting.key_name === 'audio_mode') {
            globalAudioMode = setting.val_text;
          }
          if (setting.key_name === 'audio_custom_url') {
            globalAudioCustomUrl = setting.val_text;
          }
        });
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

    // Tailwind highlight classes
    card.classList.add('ring-8', 'ring-amber-500', 'animate-pulse', 'scale-105', 'z-50');
    card.querySelector('.bg-blue-800').classList.replace('bg-blue-800', 'bg-amber-500');

    setTimeout(() => {
      card.classList.remove('ring-8', 'ring-amber-500', 'animate-pulse', 'scale-105', 'z-50');
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

        const text = `Nomor antrean, ${spokenNomor}, silakan menuju, Loket ${idLoket}`;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        utterance.rate = 0.85;
        utterance.pitch = 1;

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

  function setupRealtime() {
    supabase
      .channel('public-antrian-display')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'antrian',
        },
        (payload) => {
          const newData = payload.new;
          if (newData.status === 'dipanggil') {
            // Update exact UI
            const noLengkap = `${newData.kode_antrian}-${String(newData.nomor_antrian).padStart(3, '0')}`;
            updateCounterUI(newData.id_loket, noLengkap, newData.nama_petugas);

            // Trigger sound & visual
            playCallingAnnouncement(newData.id_loket, noLengkap);
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
          if (payload.new.key_name === 'marquee_text') {
            const marqUI = document.getElementById('tv-marquee');
            if (marqUI) marqUI.textContent = payload.new.val_text;
          }
          if (payload.new.key_name === 'audio_mode') {
            globalAudioMode = payload.new.val_text;
          }
          if (payload.new.key_name === 'audio_custom_url') {
            globalAudioCustomUrl = payload.new.val_text;
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
      })
      .subscribe();
  }
});
