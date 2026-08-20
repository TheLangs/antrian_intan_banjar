import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  const btnPrint = document.getElementById('btn-print');
  const btnQr = document.getElementById('btn-qr');
  const btnDone = document.getElementById('btn-done');
  const actionPanel = document.getElementById('action-panel');
  const successPanel = document.getElementById('success-panel');
  const successTitle = document.getElementById('success-title');
  const successDesc = document.getElementById('success-desc');
  const qrContainer = document.getElementById('qr-container');
  const dispNoAntrean = document.getElementById('disp-no-antrean');
  const printArea = document.getElementById('print-area');
  const printNo = document.getElementById('print-no');
  const printTime = document.getElementById('print-time');
  const loading = document.getElementById('loading');

  btnPrint.addEventListener('click', () => processQueueOption('cetak'));
  btnQr.addEventListener('click', () => processQueueOption('qr'));
  btnDone.addEventListener('click', resetKiosk);

  async function processQueueOption(metode) {
    // Show Loading
    loading.classList.remove('hidden');

    try {
      const token = crypto.randomUUID();
      const { data, error } = await supabase.rpc('generate_queue_number', {
        p_metode: metode,
        p_access_token: token,
      });

      if (error) throw error;
      if (data && data.success) {
        showSuccessState(data, metode);
      }
    } catch (error) {
      console.error('Error generating queue:', error);
      alert('Terjadi kesalahan sistem, silakan coba lagi atau pastikan konfigurasi Supabase sudah benar.');
      loading.classList.add('hidden');
    }
  }

  function showSuccessState(data, metode) {
    loading.classList.add('hidden');
    actionPanel.classList.add('hidden');
    successPanel.classList.remove('hidden');
    successPanel.classList.add('flex');

    dispNoAntrean.textContent = data.nomor_lengkap;

    if (metode === 'cetak') {
      successTitle.textContent = 'Silakan Ambil Tiket';
      successDesc.textContent = 'Tiket antrean fisik Anda sedang dicetak.';
      qrContainer.classList.add('hidden');
      qrContainer.innerHTML = ''; // clear

      // Fetch base URL for tracking
      let pathSegments = window.location.pathname.split('/');
      pathSegments.pop();
      const baseURL = window.location.origin + pathSegments.join('/');
      const trackerUrl = `${baseURL}/ticket.html?token=${data.access_token}`;

      // Prep print area
      printArea.classList.remove('hidden');
      printArea.classList.add('flex');
      printNo.textContent = data.nomor_lengkap;

      const dateOptions = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
      printTime.textContent = new Date().toLocaleDateString('id-ID', dateOptions).replace(/\./g, ':');

      const printQrContainer = document.getElementById('print-qr-target');
      printQrContainer.innerHTML = '';
      new QRCode(printQrContainer, {
        text: trackerUrl,
        width: 100,
        height: 100,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.L,
      });

      // Execute native print
      setTimeout(() => {
        window.print();
        printArea.classList.add('hidden');
        printArea.classList.remove('flex');
      }, 500);
    } else if (metode === 'qr') {
      successTitle.textContent = 'Scan QR Code';
      successDesc.textContent = 'Silakan scan kode ini untuk melacak antrean secara real-time dari HP Anda.';

      qrContainer.classList.remove('hidden');
      qrContainer.innerHTML = '';

      // Generate QR Code. Detect if we have file path or hosted URL
      // Fallback base URL detection for Github Pages
      let pathSegments = window.location.pathname.split('/');
      pathSegments.pop(); // remove index.html
      const baseURL = window.location.origin + pathSegments.join('/');
      const trackerUrl = `${baseURL}/ticket.html?token=${data.access_token}`;

      new QRCode(qrContainer, {
        text: trackerUrl,
        width: 200,
        height: 200,
        colorDark: '#1E293B',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H,
      });
    }
  }

  function resetKiosk() {
    successPanel.classList.add('hidden');
    successPanel.classList.remove('flex');
    actionPanel.classList.remove('hidden');
    dispNoAntrean.textContent = '';
    qrContainer.innerHTML = '';
    printArea.classList.add('hidden');
  }
});
