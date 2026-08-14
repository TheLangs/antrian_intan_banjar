import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  // Clock Setup
  const elClock = document.getElementById('clock');
  const elDate = document.getElementById('date');
  const initAudioOverlay = document.getElementById('init-audio');

  // UI mapping for 3 Loket
  const counters = {
    1: {
      card: document.getElementById('card-loket-1'),
      no: document.getElementById('disp-no-1'),
      nama: document.getElementById('disp-nama-1'),
    },
    2: {
      card: document.getElementById('card-loket-2'),
      no: document.getElementById('disp-no-2'),
      nama: document.getElementById('disp-nama-2'),
    },
    3: {
      card: document.getElementById('card-loket-3'),
      no: document.getElementById('disp-no-3'),
      nama: document.getElementById('disp-nama-3'),
    },
  };

  let audioContextAllowed = false;
  let isSpeaking = false;
  let announcementQueue = [];

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

  // Initial Fetch
  fetchInitialActive();

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
      [1, 2, 3].forEach((id) => updateCounterUI(id, '---', '-'));

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

    // text-to-speech
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
