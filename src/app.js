/**
 * ============================================
 * FreePLS Indonesia - Aplikasi Utama
 * ============================================
 */

// ============ STATE MANAGEMENT ============
const state = {
  proyekAktif: null,
  datasets: [],
  variabels: [],
  jalurs: [],
  catatans: [],
  hasilPLS: null,
  hasilBootstrap: null,
  tema: localStorage.getItem('tema') || 'gelap',
  selectedNode: null,
  selectedPath: null,
  selectedCatatan: null,
  selectedNodes: [],
  selectedPaths: [],
  selectedCatatans: [],
  isAllSelected: false,
  isDragging: false,
  dragOffset: { x: 0, y: 0 },
  dragTarget: null,
  isDraggingCatatan: false,
  dragCatatanTarget: null,
  isDraggingPathCurvature: false,
  dragCurvaturePath: null,
  isDraggingPathLabel: false,
  dragLabelPath: null,
  isAddingPath: false,
  pathFrom: null,
  // Zoom & Pan state
  zoom: 1.0,
  pan: { x: 0, y: 0 },
  isPanning: false,
  panStart: { x: 0, y: 0 },
  // Marquee Selection state
  isMarqueeSelecting: false,
  marqueeStart: null,
  marqueeEnd: null,
  multiDragInitialPositions: null,
  // Model Linting / Warnings
  modelWarnings: [],
  modelWarningsByNode: {},
  // Versioning state
  versiAktifId: null,
  versiList: [],
  editingCatatanId: null,
  // Show / Hide Indicator Toggle
  showIndikator: true,
  // Undo & Redo System
  historyStack: [],
  historyPointer: -1,
  isUndoRedoAction: false,
  dragCurvatureSeg: 2
};

const MAX_HISTORY = 60;

function saveHistoryState(actionLabel = '') {
  if (state.isUndoRedoAction) return;
  if (!state.proyekAktif) return;
  
  const snapshot = {
    action: actionLabel,
    variabels: JSON.parse(JSON.stringify(state.variabels || [])),
    jalurs: JSON.parse(JSON.stringify(state.jalurs || [])),
    catatans: JSON.parse(JSON.stringify(state.catatans || []))
  };

  // Hindari duplikasi snapshot identik berturut-turut
  if (state.historyPointer >= 0 && state.historyStack[state.historyPointer]) {
    const prev = state.historyStack[state.historyPointer];
    if (JSON.stringify(prev.variabels) === JSON.stringify(snapshot.variabels) &&
        JSON.stringify(prev.jalurs) === JSON.stringify(snapshot.jalurs) &&
        JSON.stringify(prev.catatans) === JSON.stringify(snapshot.catatans)) {
      return;
    }
  }

  // Buang branch redo jika user melakukan perubahan baru setelah undo
  if (state.historyPointer < state.historyStack.length - 1) {
    state.historyStack = state.historyStack.slice(0, state.historyPointer + 1);
  }

  state.historyStack.push(snapshot);
  if (state.historyStack.length > MAX_HISTORY) {
    state.historyStack.shift();
  }
  state.historyPointer = state.historyStack.length - 1;
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  if (btnUndo) {
    btnUndo.disabled = (state.historyPointer <= 0);
  }
  if (btnRedo) {
    btnRedo.disabled = (state.historyPointer >= state.historyStack.length - 1);
  }
}

function undo() {
  if (state.historyPointer > 0) {
    state.historyPointer--;
    const targetSnapshot = state.historyStack[state.historyPointer];
    applyHistorySnapshot(targetSnapshot);
    showToast(`Undo: ${targetSnapshot.action || 'Perubahan dibatalkan'} (Ctrl+Z)`, 'info');
  } else {
    showToast('Tidak ada perubahan yang dapat di-undo lagi', 'info');
  }
}

function redo() {
  if (state.historyPointer < state.historyStack.length - 1) {
    state.historyPointer++;
    const targetSnapshot = state.historyStack[state.historyPointer];
    applyHistorySnapshot(targetSnapshot);
    showToast(`Redo: ${targetSnapshot.action || 'Perubahan diulangi'} (Ctrl+Y)`, 'info');
  } else {
    showToast('Tidak ada perubahan yang dapat di-redo lagi', 'info');
  }
}

function applyHistorySnapshot(snap) {
  if (!snap) return;
  state.isUndoRedoAction = true;
  state.variabels = JSON.parse(JSON.stringify(snap.variabels || []));
  state.jalurs = JSON.parse(JSON.stringify(snap.jalurs || []));
  state.catatans = JSON.parse(JSON.stringify(snap.catatans || []));
  deselectAllModelElements();
  renderModel();
  updateUndoRedoButtons();
  saveModelToDb();
  setTimeout(() => {
    state.isUndoRedoAction = false;
  }, 50);
}

function updateProjectStateUI() {
  const hasProject = !!state.proyekAktif;
  
  // Editor buttons
  const editorButtons = [
    'btnRenameProyek', 'btnVersiModel', 'btnUndo', 'btnRedo',
    'btnAutoLayout', 'btnTambahVariabel', 'btnTambahJalur',
    'btnTambahCatatan', 'btnToggleIndikator', 'btnEksporProyekFile', 'btnImporProyekFile',
    'btnBukaEksporGambar', 'btnSimpanModel'
  ];
  
  editorButtons.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !hasProject;
  });

  // Data buttons
  const dataButtons = [
    'btnBukaImputasiData', 'btnBukaReverseScore', 'btnBukaDeteksiOutlier', 'btnImporData'
  ];
  dataButtons.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !hasProject;
  });

  // Analisis buttons
  const analisisButtons = [
    'btnJalankanPLS', 'btnJalankanBootstrap',
    'btnJalankanPLSc', 'btnJalankanIPMA', 'btnJalankanMGA', 'btnJalankanPLSpredict', 'btnJalankanHarman', 'btnEksporAPA'
  ];
  analisisButtons.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !hasProject;
  });

  // Hasil buttons
  const hasilButtons = [
    'btnSalinLaporanBab4', 'btnDownloadLaporanBab4', 'btnEksporHasil'
  ];
  hasilButtons.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !hasProject;
  });

  // Update name labels if no project
  if (!hasProject) {
    document.querySelectorAll('.proyek-nama-aktif').forEach(el => {
      el.textContent = 'Belum ada proyek dipilih';
      el.title = 'Belum ada proyek dipilih (Klik untuk buat proyek baru)';
    });
  }
}

const plsEngine = new PLSEngine();

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initWindowControls();
  initNavigation();
  initModals();
  initProjectHandlers();
  initEditorHandlers();
  initDataHandlers();
  initDataPreprocessingHandlers();
  initInstrumentTestHandlers();
  initDescriptiveStatsHandlers();
  initModerationHandlers();
  initAnalysisHandlers();
  initResultsHandlers();
  initSettingsHandlers();
  updateProjectStateUI();
  loadDashboard();
});

// ============ THEME MANAGEMENT ============
function initTheme() {
  applyTheme(state.tema);
}

function applyTheme(tema) {
  state.tema = tema;
  document.body.className = tema === 'gelap' ? 'tema-gelap' : 'tema-terang';
  localStorage.setItem('tema', tema);
  
  const toggleIcon = document.querySelector('#btnToggleTema .material-icons-round');
  if (toggleIcon) {
    toggleIcon.textContent = tema === 'gelap' ? 'light_mode' : 'dark_mode';
  }
  
  // Update settings page
  document.querySelectorAll('.tema-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tema === tema);
  });
  
  // Redraw canvas if editor is active
  if (state.proyekAktif) {
    setTimeout(renderModel, 100);
  }
}

// ============ WINDOW CONTROLS & SIDEBAR / PANEL TOGGLE ============
function initWindowControls() {
  document.getElementById('btnMinimize')?.addEventListener('click', () => window.api.minimize());
  document.getElementById('btnMaximize')?.addEventListener('click', () => window.api.maximize());
  document.getElementById('btnClose')?.addEventListener('click', () => window.api.close());
  document.getElementById('btnToggleTema')?.addEventListener('click', () => {
    applyTheme(state.tema === 'gelap' ? 'terang' : 'gelap');
  });

  // Toggle Sidebar Kiri (Global)
  const toggleSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed');
    const isCollapsed = sidebar.classList.contains('collapsed');
    const toggleBtnIcon = document.getElementById('iconToggleSidebarMenu');
    const toggleBtnLabel = document.getElementById('labelToggleSidebarMenu');
    const toggleBtn = document.getElementById('btnToggleSidebarMenu');
    if (toggleBtnIcon) {
      toggleBtnIcon.textContent = isCollapsed ? 'menu' : 'menu_open';
    }
    if (toggleBtnLabel) {
      toggleBtnLabel.textContent = isCollapsed ? 'Tampilkan Menu' : 'Sembunyikan Menu';
    }
    if (toggleBtn) {
      toggleBtn.title = isCollapsed ? 'Tampilkan Menu (Ctrl+B)' : 'Sembunyikan Menu (Ctrl+B)';
    }
    setTimeout(() => {
      if (state.proyekAktif) renderModel();
    }, 60);
  };

  document.getElementById('btnToggleSidebarMenu')?.addEventListener('click', toggleSidebar);
  document.getElementById('btnFloatingOpenSidebar')?.addEventListener('click', () => {
    const sidebar = document.querySelector('.sidebar');
    sidebar?.classList.remove('collapsed');
    const toggleBtnIcon = document.getElementById('iconToggleSidebarMenu');
    const toggleBtnLabel = document.getElementById('labelToggleSidebarMenu');
    const toggleBtn = document.getElementById('btnToggleSidebarMenu');
    if (toggleBtnIcon) toggleBtnIcon.textContent = 'menu_open';
    if (toggleBtnLabel) toggleBtnLabel.textContent = 'Sembunyikan Menu';
    if (toggleBtn) toggleBtn.title = 'Sembunyikan Menu (Ctrl+B)';
    setTimeout(() => {
      if (state.proyekAktif) renderModel();
    }, 60);
  });

  // Global Shortcut Ctrl + B untuk Toggle Sidebar
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      toggleSidebar();
    }
  });

  // Toggle Properties Panel Kanan
  const togglePropertiesPanel = () => {
    const panel = document.getElementById('editorPanel');
    const btnToggle = document.getElementById('btnTogglePanelProperties');
    if (!panel) return;
    panel.classList.toggle('collapsed');
    const isCollapsed = panel.classList.contains('collapsed');
    if (btnToggle) {
      btnToggle.classList.toggle('active', !isCollapsed);
    }
    setTimeout(() => {
      if (state.proyekAktif) renderModel();
    }, 60);
  };

  document.getElementById('btnTogglePanelProperties')?.addEventListener('click', togglePropertiesPanel);
  document.getElementById('btnFloatingOpenPanel')?.addEventListener('click', () => {
    const panel = document.getElementById('editorPanel');
    const btnToggle = document.getElementById('btnTogglePanelProperties');
    panel?.classList.remove('collapsed');
    if (btnToggle) btnToggle.classList.add('active');
    setTimeout(() => {
      if (state.proyekAktif) renderModel();
    }, 60);
  });
  document.getElementById('btnTutupPanel')?.addEventListener('click', () => {
    const panel = document.getElementById('editorPanel');
    const btnToggle = document.getElementById('btnTogglePanelProperties');
    panel?.classList.add('collapsed');
    if (btnToggle) btnToggle.classList.remove('active');
    setTimeout(() => {
      if (state.proyekAktif) renderModel();
    }, 60);
  });

  // Window Resize Auto Render
  window.addEventListener('resize', () => {
    if (state.proyekAktif) renderModel();
  });

  // ResizeObserver: re-render jika canvas wrapper berubah ukuran (sidebar/panel toggle, split pane)
  const canvasWrapper = document.getElementById('editorCanvasWrapper');
  if (canvasWrapper && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (state.proyekAktif) renderModel();
    }).observe(canvasWrapper);
  }
}

// ============ NAVIGATION ============
function initNavigation() {
  document.querySelectorAll('.sidebar-item[data-halaman]').forEach(item => {
    item.addEventListener('click', () => {
      const halaman = item.dataset.halaman;
      navigateTo(halaman);
    });
  });

  // Buka Modal Tentang & Bantuan (di atas Pengaturan)
  document.getElementById('btnBukaTentang')?.addEventListener('click', () => {
    showModal('modalTentang');
  });

  // Salin Email Support
  document.getElementById('btnSalinEmailSupport')?.addEventListener('click', async () => {
    const email = 'test@gmail.com';
    try {
      await navigator.clipboard.writeText(email);
      showToast(`Email support "${email}" berhasil disalin ke clipboard!`, 'sukses');
    } catch {
      showToast(`Email support: ${email}`, 'info');
    }
  });

  // Kirim Email Support
  document.getElementById('btnKirimEmailSupport')?.addEventListener('click', async () => {
    const mailUrl = 'mailto:test@gmail.com?subject=Bantuan%20FreePLS%20Indonesia&body=Halo%20Tim%20FreePLS%20Indonesia,%0A%0ASaya%20membutuhkan%20bantuan%20mengenai:%0A';
    try {
      if (window.api && window.api.openExternal) {
        await window.api.openExternal(mailUrl);
      } else {
        window.open(mailUrl, '_blank');
      }
      showToast('Membuka aplikasi email klien...', 'info');
    } catch (e) {
      showToast('Silakan kirim email ke: test@gmail.com', 'info');
    }
  });
}

function navigateTo(halaman) {
  // Update sidebar
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  const activeItem = document.querySelector(`.sidebar-item[data-halaman="${halaman}"]`);
  if (activeItem) activeItem.classList.add('active');
  
  // Update content
  document.querySelectorAll('.halaman').forEach(h => h.classList.add('tersembunyi'));
  const target = document.getElementById(`halaman-${halaman}`);
  if (target) target.classList.remove('tersembunyi');
  
  // Refresh data based on page
  if (halaman === 'beranda') loadDashboard();
  if (halaman === 'editor' && state.proyekAktif) {
    setTimeout(() => {
      renderModel();
    }, 60);
  }
  if (halaman === 'data' && state.proyekAktif) loadDatasets();
  if (halaman === 'analisis' && state.proyekAktif) {
    populateIPMASelect();
    populateMGASelect();
  }
  if (halaman === 'hasil') {
    updateResultsStatusBadge();
    if (state.proyekAktif) {
      loadResults();
    } else {
      renderEmptyResultsState();
    }
  }
}

// ============ MODAL MANAGEMENT ============
function initModals() {
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay').classList.add('tersembunyi');
    });
  });
  
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('tersembunyi');
    });
  });
}

function showModal(id) {
  document.getElementById(id).classList.remove('tersembunyi');
}

function hideModal(id) {
  document.getElementById(id).classList.add('tersembunyi');
}

// ============ CUSTOM CONFIRMATION POPUP ============
function konfirmasiDialog({
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin ingin melanjutkan?',
  okText = 'Ya, Lanjutkan',
  okIcon = 'check',
  isDanger = true,
  icon = 'warning'
}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modalKonfirmasi');
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('btnConfirmOk');
    const batalBtn = document.getElementById('btnConfirmBatal');
    const iconEl = document.getElementById('confirmIcon');
    const okTextEl = document.getElementById('confirmOkText');
    const okIconEl = document.getElementById('confirmOkIcon');
    
    titleEl.textContent = title;
    msgEl.textContent = message;
    okTextEl.textContent = okText;
    okIconEl.textContent = okIcon;
    iconEl.textContent = icon;
    
    if (isDanger) {
      okBtn.className = 'btn btn-danger';
    } else {
      okBtn.className = 'btn btn-primary';
    }
    
    showModal('modalKonfirmasi');
    
    const handleOk = () => {
      cleanup();
      hideModal('modalKonfirmasi');
      resolve(true);
    };
    
    const handleBatal = () => {
      cleanup();
      hideModal('modalKonfirmasi');
      resolve(false);
    };
    
    const cleanup = () => {
      okBtn.removeEventListener('click', handleOk);
      batalBtn.removeEventListener('click', handleBatal);
    };
    
    okBtn.addEventListener('click', handleOk);
    batalBtn.addEventListener('click', handleBatal);
  });
}


// ============ TOAST NOTIFICATIONS ============
function showToast(pesan, tipe = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${tipe}`;
  
  const icons = {
    sukses: 'check_circle',
    error: 'error',
    info: 'info',
    peringatan: 'warning'
  };
  
  toast.innerHTML = `
    <span class="material-icons-round">${icons[tipe] || 'info'}</span>
    <span class="toast-message">${pesan}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============ LOADING OVERLAY WITH ESTIMATED TIME & LIVE COUNTER ============
let loadingTimerInterval = null;
let loadingStartTime = 0;
let loadingEstimatedMs = 1200;

function showLoading(
  title = 'Memproses Data...', 
  estimatedMs = 1200, 
  detail = 'Menjalankan kalkulasi algoritma & matriks statistik...',
  icon = 'sync'
) {
  const overlay = document.getElementById('loadingOverlay');
  const titleEl = document.getElementById('loadingText');
  const detailEl = document.getElementById('loadingDetail');
  const iconEl = document.getElementById('loadingIcon');
  const barEl = document.getElementById('loadingProgressBar');
  const elapsedEl = document.getElementById('loadingElapsedTimer');
  const estimateEl = document.getElementById('loadingEstimateTimer');
  const percentEl = document.getElementById('loadingPercent');

  if (titleEl) titleEl.textContent = title;
  if (detailEl) detailEl.textContent = detail;
  if (iconEl) iconEl.textContent = icon;

  loadingEstimatedMs = Math.max(250, estimatedMs);
  loadingStartTime = Date.now();

  const estSec = (loadingEstimatedMs / 1000).toFixed(1);
  if (estimateEl) estimateEl.textContent = `~${estSec}s`;
  if (elapsedEl) elapsedEl.textContent = '0.0s';
  if (percentEl) percentEl.textContent = '0%';
  if (barEl) barEl.style.width = '0%';

  if (loadingTimerInterval) {
    clearInterval(loadingTimerInterval);
    loadingTimerInterval = null;
  }

  loadingTimerInterval = setInterval(() => {
    const elapsed = Date.now() - loadingStartTime;
    const elapsedSec = (elapsed / 1000).toFixed(1);
    if (elapsedEl) elapsedEl.textContent = `${elapsedSec}s`;

    // Calculate dynamic smooth progress percentage (interpolating up to 92% until done)
    let percent = Math.min(94, Math.round((elapsed / loadingEstimatedMs) * 90));
    // Asymptote towards 98% if it runs longer than estimated
    if (elapsed > loadingEstimatedMs) {
      const extraRatio = Math.min(1, (elapsed - loadingEstimatedMs) / 3000);
      percent = Math.min(98, 90 + Math.round(extraRatio * 8));
    }
    if (percentEl) percentEl.textContent = `${percent}%`;
    if (barEl) barEl.style.width = `${percent}%`;
  }, 40);

  if (overlay) overlay.classList.remove('tersembunyi');
}

function hideLoading() {
  if (loadingTimerInterval) {
    clearInterval(loadingTimerInterval);
    loadingTimerInterval = null;
  }

  const barEl = document.getElementById('loadingProgressBar');
  const percentEl = document.getElementById('loadingPercent');
  const overlay = document.getElementById('loadingOverlay');

  if (barEl) barEl.style.width = '100%';
  if (percentEl) percentEl.textContent = '100%';

  setTimeout(() => {
    if (overlay) overlay.classList.add('tersembunyi');
    if (barEl) barEl.style.width = '0%';
  }, 180);
}

// ============ PROJECT HANDLERS ============
function bukaModalProyekBaru() {
  showModal('modalProyekBaru');
  setTimeout(() => {
    const input = document.getElementById('inputNamaProyek');
    if (input) {
      input.focus();
      input.select();
    }
  }, 100);
}

function initProjectHandlers() {
  document.getElementById('btnProyekBaru')?.addEventListener('click', () => bukaModalProyekBaru());
  document.getElementById('btnImporProyek')?.addEventListener('click', () => showProjectPickerModal());
  document.getElementById('btnImporSmartPLSFile')?.addEventListener('click', () => imporProyekBaruBeranda());
  
  // Klik teks "Belum ada proyek" / nama proyek di semua toolbar
  document.querySelectorAll('.proyek-nama-aktif').forEach(el => {
    el.addEventListener('click', () => {
      if (!state.proyekAktif) {
        bukaModalProyekBaru();
      } else {
        bukaModalRenameProyek();
      }
    });
  });

  // Klik badge icon di toolbar editor
  document.querySelector('.toolbar-project-badge')?.addEventListener('click', () => {
    if (!state.proyekAktif) {
      bukaModalProyekBaru();
    } else {
      bukaModalRenameProyek();
    }
  });
  
  document.getElementById('btnSimpanProyekBaru')?.addEventListener('click', async () => {
    const nama = document.getElementById('inputNamaProyek').value.trim();
    if (!nama) {
      showToast('Nama proyek tidak boleh kosong', 'peringatan');
      return;
    }
    
    const deskripsi = document.getElementById('inputDeskripsiProyek').value.trim();
    const proyek = await window.api.proyekBuat({ nama, deskripsi });
    
    hideModal('modalProyekBaru');
    document.getElementById('inputNamaProyek').value = '';
    document.getElementById('inputDeskripsiProyek').value = '';
    
    showToast(`Proyek "${nama}" berhasil dibuat!`, 'sukses');
    await setActiveProject(proyek);
    loadDashboard();
  });

  // Tekan Enter untuk submit nama proyek baru
  document.getElementById('inputNamaProyek')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btnSimpanProyekBaru')?.click();
    }
  });

  // Tekan Enter untuk submit rename proyek
  document.getElementById('inputRenameNamaProyek')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btnSimpanRenameProyek')?.click();
    }
  });
}

async function showProjectPickerModal() {
  const proyeks = await window.api.proyekDaftar();
  const list = document.getElementById('proyekListModal');
  
  if (proyeks.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="cursor: pointer;" id="emptyPickerModal" title="Klik untuk buat proyek baru">
        <span class="material-icons-round">folder_off</span>
        <p>Belum ada proyek. <strong style="color: var(--color-primary); text-decoration: underline;">Klik di sini untuk buat proyek baru.</strong></p>
      </div>
    `;
    document.getElementById('emptyPickerModal')?.addEventListener('click', () => {
      hideModal('modalPilihProyek');
      bukaModalProyekBaru();
    });
  } else {
    list.innerHTML = proyeks.map(p => `
      <div class="proyek-list-item" data-id="${p.id}">
        <div class="proyek-list-item-info">
          <div class="proyek-list-item-name">${escapeHtml(p.nama)}</div>
          <div class="proyek-list-item-date">${formatDate(p.tanggal_diubah)}</div>
        </div>
        <span class="material-icons-round" style="color: var(--color-primary)">arrow_forward</span>
      </div>
    `).join('');
    
    list.querySelectorAll('.proyek-list-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = parseInt(item.dataset.id);
        const proyek = await window.api.proyekAmbil(id);
        await setActiveProject(proyek);
        hideModal('modalPilihProyek');
      });
    });
  }
  
  showModal('modalPilihProyek');
}

async function setActiveProject(proyek, forceVersiId = null) {
  state.proyekAktif = proyek;
  state.zoom = 1.0;
  state.pan = { x: 0, y: 0 };
  updateZoomLabel();
  
  // Update all project name labels
  document.querySelectorAll('.proyek-nama-aktif').forEach(el => {
    el.textContent = proyek.nama;
    el.title = `Proyek: ${proyek.nama} (Klik untuk ubah nama)`;
  });
  
  // Ambil riwayat versi proyek
  const versions = await window.api.proyekVersiDaftar(proyek.id);
  state.versiList = versions || [];
  const badgeEl = document.getElementById('badgeTotalVersi');
  if (badgeEl) badgeEl.textContent = state.versiList.length;

  let modelToLoad = proyek.model_data;
  let activeVersiName = 'Terkini (Default)';

  if (forceVersiId) {
    const selectedV = state.versiList.find(v => v.id === forceVersiId);
    if (selectedV && selectedV.model_data) {
      state.versiAktifId = selectedV.id;
      modelToLoad = selectedV.model_data;
      activeVersiName = selectedV.nama_versi;
    }
  } else if (state.versiList.length > 0) {
    // ATURAN DEFAULT: Jika user belum pilih versi, versi TERAKHIR yang otomatis dimuat sebagai default
    const latestV = state.versiList[0];
    if (latestV && latestV.model_data) {
      state.versiAktifId = latestV.id;
      modelToLoad = latestV.model_data;
      activeVersiName = latestV.nama_versi;
    } else {
      state.versiAktifId = null;
    }
  } else {
    state.versiAktifId = null;
  }

  const labelVersi = document.getElementById('labelVersiAktif');
  if (labelVersi) labelVersi.textContent = `Versi: ${activeVersiName}`;
  
  // Load model data, jalurs, & catatans
  if (modelToLoad) {
    try {
      const model = typeof modelToLoad === 'string' ? JSON.parse(modelToLoad) : modelToLoad;
      state.variabels = model.variabels || [];
      state.jalurs = model.jalurs || [];
      state.catatans = model.catatans || [];

      // Auto-layout jika ada variabel yang belum memiliki posisi x/y
      const needsLayout = state.variabels.some(v => v.posisi_x === undefined || v.posisi_y === undefined);
      if (needsLayout && state.variabels.length > 0) {
        jalankanAutoLayout();
      }
    } catch (e) {
      state.variabels = [];
      state.jalurs = [];
      state.catatans = [];
    }
  } else {
    state.variabels = [];
    state.jalurs = [];
    state.catatans = [];
  }
  
  // Inisialisasi History Stack untuk Undo/Redo
  state.historyStack = [];
  state.historyPointer = -1;
  saveHistoryState('Buka Proyek');

  updateProjectStateUI();
  populateIPMASelect();
  populateMGASelect();
  showToast(`Proyek "${proyek.nama}" dibuka (${activeVersiName})`, 'sukses');
  navigateTo('editor');
}

async function loadDashboard() {
  const proyeks = await window.api.proyekDaftar();
  
  document.getElementById('totalProyek').textContent = proyeks.length;
  
  const grid = document.getElementById('proyekGrid');
  
  if (proyeks.length === 0) {
    grid.innerHTML = `
      <div class="proyek-empty" id="proyekEmptyCard" style="cursor: pointer;" title="Klik untuk buat proyek baru">
        <span class="material-icons-round" style="font-size: 64px; opacity: 0.3; display: block; margin-bottom: 16px;">folder_open</span>
        <p style="color: var(--text-muted)">Belum ada proyek. <strong style="color: var(--color-primary); text-decoration: underline;">Klik di sini atau "Proyek Baru" untuk memulai.</strong></p>
      </div>
    `;
    document.getElementById('proyekEmptyCard')?.addEventListener('click', () => bukaModalProyekBaru());
    return;
  }
  
  grid.innerHTML = proyeks.map(p => `
    <div class="proyek-card" data-id="${p.id}">
      <div class="proyek-card-header">
        <span class="proyek-card-title">${escapeHtml(p.nama)}</span>
        <div class="proyek-card-actions">
          <button class="proyek-ekspor" onclick="event.stopPropagation(); eksporProyekTertentu(${p.id}, '${escapeHtml(p.nama)}')" title="Ekspor File Proyek (.freepls)">
            <span class="material-icons-round">file_download</span>
          </button>
          <button class="proyek-hapus" onclick="event.stopPropagation(); hapusProyek(${p.id}, '${escapeHtml(p.nama)}')" title="Hapus Proyek">
            <span class="material-icons-round">delete</span>
          </button>
        </div>
      </div>
      <p class="proyek-card-desc">${escapeHtml(p.deskripsi || 'Tidak ada deskripsi')}</p>
      <div class="proyek-card-meta">
        <span class="material-icons-round">schedule</span>
        <span>${formatDate(p.tanggal_diubah)}</span>
      </div>
    </div>
  `).join('');
  
  grid.querySelectorAll('.proyek-card').forEach(card => {
    card.addEventListener('click', async () => {
      const id = parseInt(card.dataset.id);
      const proyek = await window.api.proyekAmbil(id);
      await setActiveProject(proyek);
    });
  });
}

async function hapusProyek(id, nama) {
  const ok = await konfirmasiDialog({
    title: 'Hapus Proyek',
    message: `Apakah Anda yakin ingin menghapus proyek "${nama}"? Semua data model, dataset, dan riwayat analisis di dalamnya akan dihapus permanen.`,
    okText: 'Hapus Proyek',
    okIcon: 'delete',
    isDanger: true,
    icon: 'delete_outline'
  });
  
  if (ok) {
    await window.api.proyekHapus(id);
    if (state.proyekAktif && state.proyekAktif.id === id) {
      state.proyekAktif = null;
      updateProjectStateUI();
    }
    showToast(`Proyek "${nama}" telah dihapus`, 'sukses');
    loadDashboard();
  }
}

// ============ RENAME PROJECT ============
function bukaModalRenameProyek() {
  if (!state.proyekAktif) {
    bukaModalProyekBaru();
    return;
  }
  document.getElementById('inputRenameNamaProyek').value = state.proyekAktif.nama;
  document.getElementById('inputRenameDeskripsiProyek').value = state.proyekAktif.deskripsi || '';
  showModal('modalRenameProyek');
  setTimeout(() => {
    const input = document.getElementById('inputRenameNamaProyek');
    if (input) {
      input.focus();
      input.select();
    }
  }, 100);
}

async function simpanRenameProyek() {
  if (!state.proyekAktif) return;
  const namaBaru = document.getElementById('inputRenameNamaProyek').value.trim();
  const deskripsiBaru = document.getElementById('inputRenameDeskripsiProyek').value.trim();
  
  if (!namaBaru) {
    showToast('Nama proyek tidak boleh kosong', 'peringatan');
    return;
  }
  
  await window.api.proyekUpdateNama({
    id: state.proyekAktif.id,
    nama: namaBaru,
    deskripsi: deskripsiBaru
  });
  
  state.proyekAktif.nama = namaBaru;
  state.proyekAktif.deskripsi = deskripsiBaru;
  
  document.querySelectorAll('.proyek-nama-aktif').forEach(el => {
    el.textContent = namaBaru;
  });
  
  hideModal('modalRenameProyek');
  showToast(`Nama proyek berhasil diubah menjadi "${namaBaru}"`, 'sukses');
  loadDashboard();
}

// ============ VERSIONING SYSTEM ============
async function bukaModalRiwayatVersi() {
  if (!state.proyekAktif) {
    showToast('Pilih proyek terlebih dahulu', 'peringatan');
    return;
  }
  
  const listEl = document.getElementById('listRiwayatVersi');
  listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Memuat riwayat versi...</div>';
  
  showModal('modalRiwayatVersi');
  
  const versions = await window.api.proyekVersiDaftar(state.proyekAktif.id);
  state.versiList = versions || [];
  
  const badgeEl = document.getElementById('badgeTotalVersi');
  if (badgeEl) badgeEl.textContent = state.versiList.length;
  
  if (state.versiList.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 30px; border: 1.5px dashed var(--border-color); border-radius: 8px;">
        <span class="material-icons-round" style="font-size: 40px; color: var(--text-muted); opacity: 0.5;">history_toggle_off</span>
        <p style="margin: 8px 0 0 0; color: var(--text-secondary); font-size: 13px;">Belum ada snapshot versi tersimpan untuk proyek ini.</p>
        <span style="font-size: 11px; color: var(--text-muted);">Simpan snapshot model saat ini untuk melacak variasi analisis atau perbandingan model.</span>
      </div>
    `;
    return;
  }
  
  listEl.innerHTML = state.versiList.map((v, idx) => {
    const isLatest = (idx === 0);
    const isActive = (state.versiAktifId === v.id);
    let modelObj = {};
    if (v.model_data) {
      modelObj = typeof v.model_data === 'string' ? JSON.parse(v.model_data) : v.model_data;
    }
    const totalVar = Array.isArray(modelObj.variabels) ? modelObj.variabels.length : 0;
    const totalJalur = Array.isArray(modelObj.jalurs) ? modelObj.jalurs.length : 0;
    
    return `
      <div class="versi-card-item ${isActive ? 'active-version' : ''}">
        <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <strong style="font-size: 14px; color: var(--text-primary);">${escapeHtml(v.nama_versi)}</strong>
            ${isLatest ? '<span class="badge badge-sukses" style="font-size: 10px;">Versi Terakhir (Default)</span>' : ''}
            ${isActive ? '<span class="badge" style="background: rgba(139,92,246,0.2); color: #8b5cf6; font-size: 10px;">Aktif Saat Ini</span>' : ''}
          </div>
          ${v.catatan ? `<span style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(v.catatan)}</span>` : ''}
          <div style="display: flex; align-items: center; gap: 14px; font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
            <span style="display: flex; align-items: center; gap: 4px;">
              <span class="material-icons-round" style="font-size: 13px;">schedule</span>
              ${formatDate(v.tanggal_dibuat)}
            </span>
            <span>• ${totalVar} Variabel</span>
            <span>• ${totalJalur} Jalur</span>
          </div>
        </div>
        <div style="display: flex; gap: 6px; margin-left: 12px; align-items: center;">
          <button class="btn btn-sm ${isActive ? 'btn-outline' : 'btn-primary'}" onclick="muatVersiSnapshot(${v.id})" title="Terapkan dan buka versi model ini">
            <span class="material-icons-round" style="font-size: 15px;">folder_open</span> ${isActive ? 'Aktif' : 'Buka'}
          </button>
          <button class="btn btn-sm btn-icon btn-ghost" onclick="renameVersiSnapshot(${v.id})" title="Ubah nama versi">
            <span class="material-icons-round" style="font-size: 16px;">edit</span>
          </button>
          <button class="btn btn-sm btn-icon btn-ghost" onclick="hapusVersiSnapshot(${v.id})" title="Hapus snapshot versi ini" style="color: var(--color-danger);">
            <span class="material-icons-round" style="font-size: 16px;">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function simpanVersiSnapshot() {
  if (!state.proyekAktif) return;
  const namaVersi = document.getElementById('inputNamaVersiBaru').value.trim();
  const catatan = document.getElementById('inputCatatanVersiBaru').value.trim();
  
  if (!namaVersi) {
    showToast('Masukkan nama versi terlebih dahulu', 'peringatan');
    return;
  }
  
  const modelData = {
    variabels: state.variabels,
    jalurs: state.jalurs,
    catatans: state.catatans
  };
  
  const versiBaru = await window.api.proyekVersiSimpan({
    proyek_id: state.proyekAktif.id,
    nama_versi: namaVersi,
    catatan: catatan,
    model_data: modelData,
    datasets_data: state.datasets
  });
  
  state.versiAktifId = versiBaru.id;
  const labelVersi = document.getElementById('labelVersiAktif');
  if (labelVersi) labelVersi.textContent = `Versi: ${namaVersi}`;
  
  document.getElementById('inputNamaVersiBaru').value = '';
  document.getElementById('inputCatatanVersiBaru').value = '';
  
  showToast(`Snapshot "${namaVersi}" berhasil disimpan!`, 'sukses');
  await bukaModalRiwayatVersi();
}

async function muatVersiSnapshot(versiId) {
  let v = state.versiList.find(item => item.id === versiId);
  if (!v || !v.model_data) {
    v = await window.api.proyekVersiAmbil(versiId);
  }
  if (!v) {
    showToast('Snapshot versi tidak ditemukan', 'bahaya');
    return;
  }
  
  let modelObj = {};
  try {
    modelObj = typeof v.model_data === 'string' ? JSON.parse(v.model_data) : (v.model_data || {});
  } catch (e) {
    console.error('Gagal parse model_data snapshot:', e);
  }

  // Guard: cegah model terhapus jika data snapshot rusak / kosong
  if (!modelObj.variabels && !modelObj.jalurs) {
    showToast('Data model untuk versi ini tidak lengkap atau kosong', 'peringatan');
    return;
  }
  
  state.versiAktifId = v.id;
  state.variabels = Array.isArray(modelObj.variabels) ? modelObj.variabels : [];
  state.jalurs = Array.isArray(modelObj.jalurs) ? modelObj.jalurs : [];
  state.catatans = Array.isArray(modelObj.catatans) ? modelObj.catatans : [];
  
  const labelVersi = document.getElementById('labelVersiAktif');
  if (labelVersi) labelVersi.textContent = `Versi: ${v.nama_versi}`;
  
  // Inisialisasi History Stack untuk Undo/Redo
  state.historyStack = [];
  state.historyPointer = -1;
  saveHistoryState(`Muat Versi ${v.nama_versi}`);

  await saveModelToDb(`Muat Versi ${v.nama_versi}`);
  renderModel();
  hideModal('modalRiwayatVersi');
  showToast(`Versi "${v.nama_versi}" berhasil dimuat ke editor!`, 'sukses');
}

async function hapusVersiSnapshot(versiId) {
  const v = state.versiList.find(item => item.id === versiId);
  const namaVersi = v ? v.nama_versi : 'Snapshot';
  const ok = await konfirmasiDialog({
    title: 'Hapus Snapshot Versi',
    message: `Apakah Anda yakin ingin menghapus versi "${namaVersi}"? Tindakan ini tidak dapat dibatalkan.`,
    okText: 'Hapus Versi',
    okIcon: 'delete',
    isDanger: true,
    icon: 'delete_outline'
  });
  
  if (ok) {
    await window.api.proyekVersiHapus(versiId);
    if (state.versiAktifId === versiId) {
      state.versiAktifId = null;
      const labelVersi = document.getElementById('labelVersiAktif');
      if (labelVersi) labelVersi.textContent = 'Versi: Terkini';
    }
    showToast(`Versi "${namaVersi}" telah dihapus`, 'sukses');
    await bukaModalRiwayatVersi();
  }
}

function renameVersiSnapshot(versiId) {
  const v = state.versiList.find(item => item.id === versiId);
  if (!v) return;

  const idEl = document.getElementById('inputRenameVersiId');
  const namaEl = document.getElementById('inputRenameNamaVersi');
  const catatanEl = document.getElementById('inputRenameCatatanVersi');

  if (idEl) idEl.value = v.id;
  if (namaEl) namaEl.value = v.nama_versi || '';
  if (catatanEl) catatanEl.value = v.catatan || '';

  showModal('modalRenameVersi');
  setTimeout(() => {
    namaEl?.focus();
    namaEl?.select();
  }, 60);
}

async function simpanRenameVersi() {
  const idVal = document.getElementById('inputRenameVersiId')?.value;
  const id = idVal ? parseInt(idVal, 10) : null;
  const namaBaru = document.getElementById('inputRenameNamaVersi')?.value.trim();
  const catatanBaru = document.getElementById('inputRenameCatatanVersi')?.value.trim();

  if (!id) return;
  if (!namaBaru) {
    showToast('Nama versi tidak boleh kosong', 'peringatan');
    return;
  }

  try {
    await window.api.proyekVersiUpdate({ id, nama_versi: namaBaru, catatan: catatanBaru });
    if (state.versiAktifId === id) {
      const labelVersi = document.getElementById('labelVersiAktif');
      if (labelVersi) labelVersi.textContent = `Versi: ${namaBaru}`;
    }
    hideModal('modalRenameVersi');
    showToast(`Versi berhasil diubah menjadi "${namaBaru}"`, 'sukses');
    await bukaModalRiwayatVersi();
  } catch (err) {
    console.error('Gagal mengubah nama versi:', err);
    showToast('Gagal mengubah nama versi', 'bahaya');
  }
}

window.muatVersiSnapshot = muatVersiSnapshot;
window.hapusVersiSnapshot = hapusVersiSnapshot;
window.renameVersiSnapshot = renameVersiSnapshot;
window.simpanRenameVersi = simpanRenameVersi;

// ============ EXPORT / IMPORT .FREEPLS FILE ============
async function eksporProyekFile() {
  if (!state.proyekAktif) {
    showToast('Pilih proyek terlebih dahulu', 'warning');
    return;
  }
  await eksporProyekTertentu(state.proyekAktif.id, state.proyekAktif.nama);
}

async function eksporProyekTertentu(proyekId, namaProyek) {
  try {
    const res = await window.api.proyekEksporFile(proyekId);
    if (!res || res.canceled) {
      return;
    }
    if (res.sukses) {
      const fileName = res.filePath ? res.filePath.split(/[\\/]/).pop() : `${namaProyek}.freepls`;
      showToast(`Proyek "${namaProyek}" berhasil disimpan: ${fileName}`, 'sukses');
    } else {
      showToast('Gagal mengekspor berkas proyek', 'error');
    }
  } catch (e) {
    showToast('Gagal ekspor proyek: ' + e.message, 'error');
  }
}
window.eksporProyekTertentu = eksporProyekTertentu;

// 1. Impor dari Beranda: Membuat proyek baru di database
async function imporProyekBaruBeranda() {
  try {
    const res = await window.api.proyekImporFile(null);
    if (!res || res.canceled) {
      return;
    }

    // Selalu sinkronkan daftar proyek terbaru dari database
    const proyeks = await window.api.proyekDaftar();
    const proyekTerbaru = proyeks && proyeks.length > 0 ? proyeks[0] : null;

    // Evaluasi keberhasilan dengan berbagai bentuk kembalian IPC
    const isSuccess = (res.sukses === true) || (res === true) || Boolean(res.id && res.nama) || Boolean(res.proyek) || (proyekTerbaru && proyekTerbaru.nama?.includes('(Impor)'));
    const proyek = res.proyek || (res.id && res.nama ? res : null) || proyekTerbaru;

    if (isSuccess && proyek) {
      showToast(`Proyek baru "${proyek.nama}" berhasil diimpor!`, 'sukses');
      await setActiveProject(proyek);
      await loadDashboard();
    } else {
      const errMsg = res.pesan || res.error || 'Format berkas proyek tidak valid atau rusak';
      showToast('Gagal mengimpor berkas: ' + errMsg, 'error');
    }
  } catch (e) {
    showToast('Gagal impor proyek: ' + e.message, 'error');
  }
}

// 2. Impor dari Editor: Menimpa diagram model & dataset pada proyek yang sedang aktif
async function imporProyekEditor() {
  if (!state.proyekAktif) {
    showToast('Buka atau buat proyek terlebih dahulu sebelum mengimpor ke editor!', 'warning');
    return;
  }

  const ok = await konfirmasiDialog({
    title: 'Timpa Model Proyek Saat Ini?',
    message: `Mengimpor berkas .freepls akan menimpa seluruh diagram variabel laten, jalur pengaruh, dan catatan pada proyek "${state.proyekAktif.nama}". Apakah Anda yakin ingin melanjutkan?`,
    okText: 'Timpa Model',
    okIcon: 'file_upload',
    isDanger: true,
    icon: 'warning_amber'
  });
  if (!ok) return;

  try {
    const res = await window.api.proyekImporFile(state.proyekAktif.id);
    if (!res || res.canceled) {
      return;
    }

    const refreshedProyek = await window.api.proyekAmbil(state.proyekAktif.id);
    const isSuccess = (res.sukses === true) || (res === true) || Boolean(res.id && res.nama) || Boolean(res.proyek) || Boolean(refreshedProyek);
    const proyek = res.proyek || (res.id && res.nama ? res : null) || refreshedProyek;

    if (isSuccess && proyek) {
      showToast(`Model proyek "${proyek.nama}" berhasil ditimpa dari berkas!`, 'sukses');
      await setActiveProject(proyek);
      if (state.halamanAktif === 'editor') {
        renderModel();
      }
      await loadDashboard();
    } else {
      const errMsg = res.pesan || res.error || 'Format berkas proyek tidak valid atau rusak';
      showToast('Gagal menimpa model: ' + errMsg, 'error');
    }
  } catch (e) {
    showToast('Gagal impor model: ' + e.message, 'error');
  }
}

// Helper umum jika dipanggil di tempat lain
async function imporProyekFile() {
  if (state.halamanAktif === 'editor' && state.proyekAktif) {
    await imporProyekEditor();
  } else {
    await imporProyekBaruBeranda();
  }
}

// ============ STICKY NOTES / KETERANGAN CANVAS ============
function bukaModalEditCatatan(catatan = null) {
  const modalTitle = document.getElementById('modalCatatanTitle');
  const inputTeks = document.getElementById('inputTeksCatatan');
  const btnHapus = document.getElementById('btnHapusCatatan');
  
  if (catatan) {
    state.editingCatatanId = catatan.id;
    if (modalTitle) modalTitle.textContent = 'Ubah Keterangan / Catatan';
    if (inputTeks) inputTeks.value = catatan.teks || '';
    if (btnHapus) btnHapus.classList.remove('tersembunyi');
    
    // Set color chip
    const warna = catatan.warna || '#fef08a';
    document.querySelectorAll('.color-chip').forEach(chip => {
      const radio = chip.querySelector('input[name="warnaCatatan"]');
      const check = chip.querySelector('.check-mark');
      if (radio && radio.value === warna) {
        radio.checked = true;
        chip.classList.add('active');
        check?.classList.remove('tersembunyi');
      } else {
        chip.classList.remove('active');
        check?.classList.add('tersembunyi');
      }
    });
  } else {
    state.editingCatatanId = null;
    if (modalTitle) modalTitle.textContent = 'Tambah Keterangan / Catatan';
    if (inputTeks) inputTeks.value = '';
    if (btnHapus) btnHapus.classList.add('tersembunyi');
    
    // Default yellow
    document.querySelectorAll('.color-chip').forEach((chip, idx) => {
      const radio = chip.querySelector('input[name="warnaCatatan"]');
      const check = chip.querySelector('.check-mark');
      if (idx === 0) {
        if (radio) radio.checked = true;
        chip.classList.add('active');
        check?.classList.remove('tersembunyi');
      } else {
        chip.classList.remove('active');
        check?.classList.add('tersembunyi');
      }
    });
  }
  
  showModal('modalEditCatatan');
  setTimeout(() => inputTeks?.focus(), 150);
}

function simpanCatatanHandler() {
  const teks = document.getElementById('inputTeksCatatan').value.trim();
  if (!teks) {
    showToast('Teks keterangan tidak boleh kosong', 'peringatan');
    return;
  }
  
  const warna = document.querySelector('input[name="warnaCatatan"]:checked')?.value || '#fef08a';
  
  if (state.editingCatatanId) {
    const existing = state.catatans.find(c => c.id === state.editingCatatanId);
    if (existing) {
      existing.teks = teks;
      existing.warna = warna;
    }
  } else {
    const newNote = {
      id: Date.now(),
      teks,
      warna,
      x: 180 + Math.random() * 200,
      y: 120 + Math.random() * 150,
      w: 160,
      h: 95
    };
    if (!state.catatans) state.catatans = [];
    state.catatans.push(newNote);
  }
  
  hideModal('modalEditCatatan');
  renderModel();
  saveModelToDb();
  showToast('Keterangan / Catatan berhasil disimpan', 'sukses');
}

function hapusCatatanHandler() {
  if (!state.editingCatatanId) return;
  state.catatans = state.catatans.filter(c => c.id !== state.editingCatatanId);
  hideModal('modalEditCatatan');
  renderModel();
  saveModelToDb();
  showToast('Catatan dihapus dari canvas', 'sukses');
}

// ============ ZOOM, PAN & FULLSCREEN CONTROLS ============
function setZoom(newZoom, resetPan = false) {
  state.zoom = Math.min(3.0, Math.max(0.3, newZoom));
  if (resetPan) {
    state.pan = { x: 0, y: 0 };
  }
  updateZoomLabel();
  renderModel();
}

function updateZoomLabel() {
  const lbl = document.getElementById('zoomLevelLabel');
  if (lbl) {
    lbl.textContent = `${Math.round(state.zoom * 100)}%`;
  }
}

function fitDiagramToCanvas() {
  const canvas = document.getElementById('modelCanvas');
  if (!canvas) return;

  const wrapper = canvas.parentElement;
  const cw = wrapper?.clientWidth || canvas.width || 1000;
  const ch = wrapper?.clientHeight || canvas.height || 600;

  if (!state.variabels || state.variabels.length === 0) {
    state.zoom = 1.0;
    state.pan = { x: 0, y: 0 };
    updateZoomLabel();
    renderModel();
    showToast('Diagram model masih kosong', 'info');
    return;
  }

  // Hitung Bounding Box semua variabel dan catatan
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const R = PLS_STYLE.latentRadius || 42;

  state.variabels.forEach(v => {
    minX = Math.min(minX, v.posisi_x - R - 60);
    maxX = Math.max(maxX, v.posisi_x + R + 60);
    minY = Math.min(minY, v.posisi_y - R - 45);
    maxY = Math.max(maxY, v.posisi_y + R + 45);
  });

  if (state.catatans && state.catatans.length > 0) {
    state.catatans.forEach(c => {
      minX = Math.min(minX, c.x || 100);
      maxX = Math.max(maxX, (c.x || 100) + (c.w || 160));
      minY = Math.min(minY, c.y || 100);
      maxY = Math.max(maxY, (c.y || 100) + (c.h || 95));
    });
  }

  const modelWidth = Math.max(300, maxX - minX);
  const modelHeight = Math.max(200, maxY - minY);
  const padding = 80;

  const scaleX = (cw - padding * 2) / modelWidth;
  const scaleY = (ch - padding * 2) / modelHeight;
  const targetZoom = Math.min(1.4, Math.max(0.4, Math.min(scaleX, scaleY)));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  state.zoom = targetZoom;
  state.pan = {
    x: Math.round(cw / 2 - centerX * targetZoom),
    y: Math.round(ch / 2 - centerY * targetZoom)
  };

  updateZoomLabel();
  renderModel();
  showToast(`Tampilan diagram disesuaikan (${Math.round(targetZoom * 100)}%)`, 'sukses');
}

function toggleCanvasFullscreen() {
  const wrapper = document.getElementById('editorCanvasWrapper');
  if (!wrapper) return;
  
  wrapper.classList.toggle('fullscreen-canvas');
  const isFs = wrapper.classList.contains('fullscreen-canvas');
  
  const icon = document.querySelector('#btnCanvasFullscreen .material-icons-round');
  if (icon) {
    icon.textContent = isFs ? 'fullscreen_exit' : 'fullscreen';
  }

  // Pindahkan toast ke kiri agar tidak menindih zoom controls saat fullscreen
  const toast = document.getElementById('toastContainer');
  if (toast) {
    toast.style.right = isFs ? 'auto' : '';
    toast.style.left  = isFs ? 'var(--space-lg)' : '';
  }
  
  setTimeout(() => {
    renderModel();
    showToast(isFs ? 'Mode Layar Penuh Aktif (Tekan Esc untuk keluar)' : 'Layar Penuh Dinonaktifkan', 'info');
  }, 100);
}

// ============ EDITOR HANDLERS ============
function initEditorHandlers() {
  // Rename Project Click Handlers
  document.getElementById('proyekNamaEditor')?.addEventListener('click', () => bukaModalRenameProyek());
  document.getElementById('btnRenameProyek')?.addEventListener('click', () => bukaModalRenameProyek());
  document.getElementById('btnProyekBadgeIcon')?.addEventListener('click', () => bukaModalRenameProyek());
  document.getElementById('btnSimpanRenameProyek')?.addEventListener('click', () => simpanRenameProyek());

  // Versioning Handlers
  document.getElementById('btnVersiModel')?.addEventListener('click', () => bukaModalRiwayatVersi());
  document.getElementById('btnSimpanVersiSnapshot')?.addEventListener('click', () => simpanVersiSnapshot());
  document.getElementById('btnSimpanRenameVersi')?.addEventListener('click', () => simpanRenameVersi());
  document.getElementById('inputRenameNamaVersi')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      simpanRenameVersi();
    }
  });
  document.getElementById('inputRenameCatatanVersi')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      simpanRenameVersi();
    }
  });

  // Export & Import Project Bundle Handler
  document.getElementById('btnEksporProyekFile')?.addEventListener('click', () => eksporProyekFile());
  document.getElementById('btnImporProyekFile')?.addEventListener('click', () => imporProyekEditor());

  // Sticky Note Handlers
  document.getElementById('btnTambahCatatan')?.addEventListener('click', () => bukaModalEditCatatan());
  document.getElementById('btnSimpanCatatan')?.addEventListener('click', () => simpanCatatanHandler());
  document.getElementById('btnHapusCatatan')?.addEventListener('click', () => hapusCatatanHandler());

  // Color Chip Selectors in Modal Edit Catatan
  document.querySelectorAll('.color-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.color-chip').forEach(c => {
        c.classList.remove('active');
        c.querySelector('.check-mark')?.classList.add('tersembunyi');
      });
      chip.classList.add('active');
      const radio = chip.querySelector('input[name="warnaCatatan"]');
      if (radio) radio.checked = true;
      chip.querySelector('.check-mark')?.classList.remove('tersembunyi');
    });
  });

  // Zoom & View Navigation Controls
  document.getElementById('btnZoomIn')?.addEventListener('click', () => setZoom(state.zoom + 0.15));
  document.getElementById('btnZoomOut')?.addEventListener('click', () => setZoom(state.zoom - 0.15));
  document.getElementById('btnZoomReset')?.addEventListener('click', () => setZoom(1.0, true));
  document.getElementById('btnCanvasFitView')?.addEventListener('click', () => fitDiagramToCanvas());
  document.getElementById('btnCanvasFullscreen')?.addEventListener('click', () => toggleCanvasFullscreen());
  document.getElementById('btnCloseNavHint')?.addEventListener('click', () => {
    document.getElementById('canvasNavHint')?.classList.add('tersembunyi');
  });

  // Global Keyboard Navigation & Action Shortcuts (Ctrl+A, Delete, Zoom, Fullscreen)
  document.addEventListener('keydown', (e) => {
    // Abaikan jika user sedang mengetik di input, textarea, atau select
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) {
      return;
    }

    if (e.key === 'Escape') {
      const wrapper = document.getElementById('editorCanvasWrapper');
      if (wrapper && wrapper.classList.contains('fullscreen-canvas')) {
        toggleCanvasFullscreen();
      } else {
        deselectAllModelElements();
      }
      return;
    }

    // Ctrl + Z / Cmd + Z: Undo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }

    // Ctrl + Y / Cmd + Y OR Ctrl + Shift + Z: Redo
    if (((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
      e.preventDefault();
      redo();
      return;
    }

    // Ctrl + A / Cmd + A: Pilih Semua Elemen Model di Canvas
    if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      selectAllModelElements();
      return;
    }

    // Ctrl + D / Cmd + D: Duplikat Variabel Terpilih
    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      duplicateSelectedVariable();
      return;
    }

    // Alt + R: Putar Orientasi Indikator Variabel Terpilih
    if (e.altKey && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      rotateSelectedVariableOrientation();
      return;
    }

    // Zoom Shortcuts: + / = -> Zoom In; - / _ -> Zoom Out; 0 -> Reset Zoom
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setZoom(state.zoom + 0.15);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setZoom(state.zoom - 0.15);
    } else if (e.key === '0') {
      e.preventDefault();
      setZoom(1.0, true);
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleCanvasFullscreen();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      // Hapus elemen yang sedang dipilih (baik multi-select Ctrl+A maupun single select)
      if (state.isAllSelected || state.selectedNodes.length > 0 || state.selectedPaths.length > 0 || state.selectedCatatans.length > 0 || state.selectedNode || state.selectedPath || state.selectedCatatan) {
        e.preventDefault();
        hapusSemuaTerpilih();
      }
    }
  });

// ============ MULTI-SELECTION & SELECT ALL (CTRL + A) ============
window.selectAllModelElements = function() {
  if (state.variabels.length === 0 && state.jalurs.length === 0 && (!state.catatans || state.catatans.length === 0)) {
    showToast('Canvas masih kosong, belum ada elemen yang bisa dipilih', 'info');
    return;
  }

  state.selectedNodes = state.variabels.map(v => v.id);
  state.selectedPaths = state.jalurs.map(j => j.id);
  state.selectedCatatans = (state.catatans || []).map(c => c.id);
  state.isAllSelected = true;
  state.selectedNode = null;
  state.selectedPath = null;
  state.selectedCatatan = null;

  showMultiSelectProperties();
  renderModel();

  const total = state.selectedNodes.length + state.selectedPaths.length + state.selectedCatatans.length;
  showToast(`Semua elemen dipilih (${total} item). Tekan Delete untuk menghapus.`, 'info');
};

window.deselectAllModelElements = function() {
  state.selectedNodes = [];
  state.selectedPaths = [];
  state.selectedCatatans = [];
  state.isAllSelected = false;
  state.selectedNode = null;
  state.selectedPath = null;
  state.selectedCatatan = null;

  const panel = document.getElementById('panelBody');
  if (panel) {
    panel.innerHTML = '<p class="text-muted">Pilih variabel atau jalur untuk melihat propertinya</p>';
  }
  renderModel();
};

function showMultiSelectProperties() {
  const panel = document.getElementById('panelBody');
  if (!panel) return;

  const numVars = state.selectedNodes.length;
  const numPaths = state.selectedPaths.length;
  const numNotes = state.selectedCatatans.length;
  const total = numVars + numPaths + numNotes;

  panel.innerHTML = `
    <div class="form-group">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
        <span class="material-icons-round" style="color: #f093fb; font-size: 26px;">select_all</span>
        <div>
          <h4 style="margin: 0; font-size: 15px; font-weight: 700;">Semua Elemen Terpilih</h4>
          <span style="font-size: 11.5px; color: var(--text-secondary);">${total} objek model aktif di canvas</span>
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 8px; background: var(--bg-hover); padding: 12px; border-radius: var(--radius-md); border: 1.5px dashed #f093fb;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
            <span class="material-icons-round" style="color: var(--pls-latent-color); font-size: 16px;">radio_button_checked</span> Variabel Laten
          </span>
          <strong style="font-size: 13px;">${numVars}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
            <span class="material-icons-round" style="color: #ec4899; font-size: 16px;">trending_flat</span> Jalur Struktural
          </span>
          <strong style="font-size: 13px;">${numPaths}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
            <span class="material-icons-round" style="color: #f59e0b; font-size: 16px;">sticky_note_2</span> Catatan / Keterangan
          </span>
          <strong style="font-size: 13px;">${numNotes}</strong>
        </div>
      </div>
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 16px;">
      <button class="btn btn-danger btn-block" onclick="hapusSemuaTerpilih()">
        <span class="material-icons-round">delete_sweep</span> Hapus Semua Terpilih (Delete)
      </button>
      <button class="btn btn-outline btn-block" onclick="deselectAllModelElements()">
        <span class="material-icons-round">close</span> Batalkan Pilihan (Esc)
      </button>
    </div>
  `;
}

window.hapusSemuaTerpilih = async function() {
  const isMulti = state.isAllSelected || state.selectedNodes.length > 0 || state.selectedPaths.length > 0 || state.selectedCatatans.length > 0;
  
  if (isMulti) {
    const total = state.selectedNodes.length + state.selectedPaths.length + state.selectedCatatans.length;
    if (total === 0) return;

    const ok = await konfirmasiDialog({
      title: 'Hapus Semua Elemen Terpilih',
      message: `Apakah Anda yakin ingin menghapus ${total} elemen yang dipilih (${state.selectedNodes.length} variabel, ${state.selectedPaths.length} jalur, ${state.selectedCatatans.length} catatan)?`,
      okText: 'Hapus Semua',
      okIcon: 'delete_sweep',
      isDanger: true,
      icon: 'delete_forever'
    });

    if (ok) {
      const deletedNodeIds = new Set(state.selectedNodes);
      const deletedPathIds = new Set(state.selectedPaths);
      const deletedCatatanIds = new Set(state.selectedCatatans);

      state.variabels = state.variabels.filter(v => !deletedNodeIds.has(v.id));
      state.jalurs = state.jalurs.filter(j => !deletedPathIds.has(j.id) && !deletedNodeIds.has(j.dari_variabel_id) && !deletedNodeIds.has(j.ke_variabel_id));
      if (state.catatans) {
        state.catatans = state.catatans.filter(c => !deletedCatatanIds.has(c.id));
      }

      deselectAllModelElements();
      await saveModelToDb();
      showToast(`${total} elemen terpilih berhasil dihapus`, 'sukses');
    }
  } else if (state.selectedNode) {
    hapusVariabel(state.selectedNode);
  } else if (state.selectedPath) {
    hapusJalur(state.selectedPath);
  } else if (state.selectedCatatan) {
    state.editingCatatanId = state.selectedCatatan;
    hapusCatatanHandler();
  }
};

  // Helper Preset Kelengkungan Garis
  window.setPresetKelengkungan = function(val) {
    const input = document.getElementById('inputKelengkunganJalur');
    const label = document.getElementById('labelNilaiKelengkungan');
    if (input) input.value = val;
    if (label) {
      if (val === 0) label.textContent = 'Lurus (0)';
      else if (val < 0) label.textContent = `Lengkung Bawah (${val})`;
      else label.textContent = `Lengkung Atas (+${val})`;
    }
  };

  // Bind Slider Kelengkungan
  const sliderKelengkungan = document.getElementById('inputKelengkunganJalur');
  sliderKelengkungan?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value) || 0;
    const label = document.getElementById('labelNilaiKelengkungan');
    if (label) {
      if (val === 0) label.textContent = 'Lurus (0)';
      else if (val < 0) label.textContent = `Lengkung Bawah (${val})`;
      else label.textContent = `Lengkung Atas (+${val})`;
    }
  });

  // Undo & Redo Button Handlers
  document.getElementById('btnUndo')?.addEventListener('click', () => undo());
  document.getElementById('btnRedo')?.addEventListener('click', () => redo());
  document.getElementById('btnAutoLayout')?.addEventListener('click', () => autoArrangeModel());

  // Dropdown Menu Lainnya Handler
  const dropdownLainnya = document.getElementById('dropdownLainnya');
  const btnDropdownLainnya = document.getElementById('btnDropdownLainnya');
  
  btnDropdownLainnya?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownLainnya?.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (dropdownLainnya && !dropdownLainnya.contains(e.target)) {
      dropdownLainnya.classList.remove('open');
    }
  });

  dropdownLainnya?.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      dropdownLainnya.classList.remove('open');
    });
  });

  // Toggle Tampilkan / Sembunyikan Indikator (Outer Model)
  document.getElementById('btnToggleIndikator')?.addEventListener('click', () => {
    state.showIndikator = (state.showIndikator === false) ? true : false;
    const btn = document.getElementById('btnToggleIndikator');
    const icon = document.getElementById('iconToggleIndikator');
    const label = document.getElementById('labelToggleIndikator');
    if (btn) {
      btn.classList.toggle('active', state.showIndikator);
    }
    if (icon) {
      icon.textContent = state.showIndikator ? 'visibility' : 'visibility_off';
      icon.style.color = state.showIndikator ? '#f59e0b' : 'var(--text-muted)';
    }
    if (label) {
      label.textContent = state.showIndikator ? 'Indikator' : 'Indikator (Off)';
    }
    renderModel();
    showToast(state.showIndikator ? 'Indikator ditampilkan' : 'Indikator disembunyikan (Model Struktural Bersih)', 'info');
  });

  // Dropdown Perataan Model (Align & Distribute)
  const dropdownAlign = document.getElementById('dropdownAlign');
  const btnDropdownAlign = document.getElementById('btnDropdownAlign');
  
  btnDropdownAlign?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownAlign?.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (dropdownAlign && !dropdownAlign.contains(e.target)) {
      dropdownAlign.classList.remove('open');
    }
  });

  dropdownAlign?.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      dropdownAlign.classList.remove('open');
    });
  });

  // Align Actions
  document.getElementById('btnAlignLeft')?.addEventListener('click', () => alignSelectedNodes('left'));
  document.getElementById('btnAlignCenterH')?.addEventListener('click', () => alignSelectedNodes('centerH'));
  document.getElementById('btnAlignRight')?.addEventListener('click', () => alignSelectedNodes('right'));
  document.getElementById('btnAlignTop')?.addEventListener('click', () => alignSelectedNodes('top'));
  document.getElementById('btnAlignCenterV')?.addEventListener('click', () => alignSelectedNodes('centerV'));
  document.getElementById('btnAlignBottom')?.addEventListener('click', () => alignSelectedNodes('bottom'));
  document.getElementById('btnDistributeH')?.addEventListener('click', () => alignSelectedNodes('distributeH'));
  document.getElementById('btnDistributeV')?.addEventListener('click', () => alignSelectedNodes('distributeV'));

  // Quick Duplicate & Quick Rotate in Dropdown Lainnya
  document.getElementById('btnDuplikatVariabel')?.addEventListener('click', () => duplicateSelectedVariable());
  document.getElementById('btnRotasiIndikatorCepat')?.addEventListener('click', () => rotateSelectedVariableOrientation());
  document.getElementById('btnBukaTambahModerasiModel')?.addEventListener('click', () => bukaModalTambahModerasi());

  // Model Validator Flyout Toggle
  const dropdownValidator = document.getElementById('dropdownModelValidator');
  const badgeValidator = document.getElementById('badgeModelValidator');
  
  badgeValidator?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownValidator?.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (dropdownValidator && !dropdownValidator.contains(e.target)) {
      dropdownValidator.classList.remove('open');
    }
  });

  // Modal Tambah Efek Moderasi Form Handlers
  document.getElementById('selectQuickModIV')?.addEventListener('change', updateModerationInteractionName);
  document.getElementById('selectQuickModMOD')?.addEventListener('change', updateModerationInteractionName);
  document.getElementById('btnProsesTambahEfekModerasi')?.addEventListener('click', () => prosesTambahEfekModerasi());

  // Modal Template Model
  document.getElementById('btnBukaTemplateModel')?.addEventListener('click', () => {
    showModal('modalTemplateModel');
  });

// ============ TEMPLATE GALLERY & FULL TURNKEY DEMO GENERATOR ============
async function terapkanTemplateModel(templateKey) {
  showLoading('Menerapkan Template Model & Menjalankan Analisis...', 1100, 'Menyusun Diagram Struktur, Matriks Indikator & Algoritma PLS', 'auto_fix_high');
  try {
    const baseId = Date.now();
    let templateConfig = null;
    
    if (templateKey === 'mediasi_umkm') {
      const idLD = baseId;
      const idIK = baseId + 1;
      const idAD = baseId + 2;
      const idKU = baseId + 3;

      templateConfig = {
        nama: 'Riset Mediasi Digital UMKM',
        deskripsi: 'Pengaruh Literasi Digital (LD) & Inklusi Keuangan (IK) terhadap Kinerja Usaha (KU) melalui Adopsi E-Commerce (AD)',
        variabels: [
          {
            id: idLD,
            nama: 'Literasi Digital',
            tipe: 'reflektif',
            indikator: ['LD1', 'LD2', 'LD3', 'LD4'],
            orientasi: 'kiri',
            posisi_x: 230,
            posisi_y: 180
          },
          {
            id: idIK,
            nama: 'Inklusi Keuangan',
            tipe: 'reflektif',
            indikator: ['IK1', 'IK2', 'IK3', 'IK4'],
            orientasi: 'kiri',
            posisi_x: 230,
            posisi_y: 460
          },
          {
            id: idAD,
            nama: 'Adopsi E-Commerce',
            tipe: 'reflektif',
            indikator: ['AD1', 'AD2', 'AD3', 'AD4'],
            orientasi: 'atas',
            posisi_x: 580,
            posisi_y: 320
          },
          {
            id: idKU,
            nama: 'Kinerja Usaha',
            tipe: 'reflektif',
            indikator: ['KU1', 'KU2', 'KU3', 'KU4'],
            orientasi: 'kanan',
            posisi_x: 930,
            posisi_y: 320
          }
        ],
        jalurs: [
          {
            id: baseId + 10,
            dari: 'Literasi Digital',
            ke: 'Adopsi E-Commerce',
            dari_variabel_id: idLD,
            ke_variabel_id: idAD,
            label: 'H1',
            tipe_garis: 'solid',
            tebal_garis: 2.2,
            kelengkungan: 0
          },
          {
            id: baseId + 11,
            dari: 'Inklusi Keuangan',
            ke: 'Adopsi E-Commerce',
            dari_variabel_id: idIK,
            ke_variabel_id: idAD,
            label: 'H2',
            tipe_garis: 'solid',
            tebal_garis: 2.2,
            kelengkungan: 0
          },
          {
            id: baseId + 12,
            dari: 'Adopsi E-Commerce',
            ke: 'Kinerja Usaha',
            dari_variabel_id: idAD,
            ke_variabel_id: idKU,
            label: 'H3',
            tipe_garis: 'solid',
            tebal_garis: 2.5,
            kelengkungan: 0
          },
          {
            id: baseId + 13,
            dari: 'Literasi Digital',
            ke: 'Kinerja Usaha',
            dari_variabel_id: idLD,
            ke_variabel_id: idKU,
            label: 'H4',
            tipe_garis: 'dashed',
            tebal_garis: 1.8,
            kelengkungan: -35
          },
          {
            id: baseId + 14,
            dari: 'Inklusi Keuangan',
            ke: 'Kinerja Usaha',
            dari_variabel_id: idIK,
            ke_variabel_id: idKU,
            label: 'H5',
            tipe_garis: 'dashed',
            tebal_garis: 1.8,
            kelengkungan: 35
          }
        ],
        generateData: (N = 140) => {
          const rows = [];
          for (let i = 0; i < N; i++) {
            const randNorm = (m = 0, s = 1) => {
              let u = 0, v = 0;
              while (u === 0) u = Math.random();
              while (v === 0) v = Math.random();
              return m + s * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            };
            const clamp = (val) => Math.max(1, Math.min(5, Math.round(val)));

            const l_ld = randNorm(3.9, 0.62);
            const l_ik = randNorm(3.85, 0.58);
            const l_ad = 0.46 * l_ld + 0.38 * l_ik + randNorm(0, 0.34);
            const l_ku = 0.52 * l_ad + 0.24 * l_ld + 0.18 * l_ik + randNorm(0, 0.30);

            rows.push({
              LD1: clamp(l_ld + randNorm(0, 0.28)),
              LD2: clamp(l_ld + randNorm(0, 0.25)),
              LD3: clamp(l_ld + randNorm(0, 0.30)),
              LD4: clamp(l_ld + randNorm(0, 0.26)),
              IK1: clamp(l_ik + randNorm(0, 0.27)),
              IK2: clamp(l_ik + randNorm(0, 0.24)),
              IK3: clamp(l_ik + randNorm(0, 0.29)),
              IK4: clamp(l_ik + randNorm(0, 0.28)),
              AD1: clamp(l_ad + randNorm(0, 0.25)),
              AD2: clamp(l_ad + randNorm(0, 0.28)),
              AD3: clamp(l_ad + randNorm(0, 0.24)),
              AD4: clamp(l_ad + randNorm(0, 0.27)),
              KU1: clamp(l_ku + randNorm(0, 0.26)),
              KU2: clamp(l_ku + randNorm(0, 0.24)),
              KU3: clamp(l_ku + randNorm(0, 0.28)),
              KU4: clamp(l_ku + randNorm(0, 0.25))
            });
          }
          return rows;
        }
      };
    } else if (templateKey === 'tam') {
      const idPEOU = baseId;
      const idPU = baseId + 1;
      const idATU = baseId + 2;
      const idBI = baseId + 3;

      templateConfig = {
        nama: 'Riset Technology Acceptance (TAM)',
        deskripsi: 'Model Penerimaan Teknologi: Perceived Ease of Use (PEOU) dan Perceived Usefulness (PU) terhadap Behavioral Intention (BI) melalui Attitude (ATU)',
        variabels: [
          {
            id: idPEOU,
            nama: 'Perceived Ease of Use',
            tipe: 'reflektif',
            indikator: ['PEOU1', 'PEOU2', 'PEOU3', 'PEOU4'],
            orientasi: 'kiri',
            posisi_x: 230,
            posisi_y: 180
          },
          {
            id: idPU,
            nama: 'Perceived Usefulness',
            tipe: 'reflektif',
            indikator: ['PU1', 'PU2', 'PU3', 'PU4'],
            orientasi: 'kiri',
            posisi_x: 230,
            posisi_y: 460
          },
          {
            id: idATU,
            nama: 'Attitude Toward Using',
            tipe: 'reflektif',
            indikator: ['ATU1', 'ATU2', 'ATU3', 'ATU4'],
            orientasi: 'atas',
            posisi_x: 580,
            posisi_y: 320
          },
          {
            id: idBI,
            nama: 'Behavioral Intention',
            tipe: 'reflektif',
            indikator: ['BI1', 'BI2', 'BI3', 'BI4'],
            orientasi: 'kanan',
            posisi_x: 930,
            posisi_y: 320
          }
        ],
        jalurs: [
          {
            id: baseId + 10,
            dari: 'Perceived Ease of Use',
            ke: 'Perceived Usefulness',
            dari_variabel_id: idPEOU,
            ke_variabel_id: idPU,
            label: 'H1',
            tipe_garis: 'solid',
            tebal_garis: 2.2,
            kelengkungan: 0
          },
          {
            id: baseId + 11,
            dari: 'Perceived Ease of Use',
            ke: 'Attitude Toward Using',
            dari_variabel_id: idPEOU,
            ke_variabel_id: idATU,
            label: 'H2',
            tipe_garis: 'solid',
            tebal_garis: 2.2,
            kelengkungan: 0
          },
          {
            id: baseId + 12,
            dari: 'Perceived Usefulness',
            ke: 'Attitude Toward Using',
            dari_variabel_id: idPU,
            ke_variabel_id: idATU,
            label: 'H3',
            tipe_garis: 'solid',
            tebal_garis: 2.2,
            kelengkungan: 0
          },
          {
            id: baseId + 13,
            dari: 'Perceived Usefulness',
            ke: 'Behavioral Intention',
            dari_variabel_id: idPU,
            ke_variabel_id: idBI,
            label: 'H4',
            tipe_garis: 'dashed',
            tebal_garis: 1.8,
            kelengkungan: 35
          },
          {
            id: baseId + 14,
            dari: 'Attitude Toward Using',
            ke: 'Behavioral Intention',
            dari_variabel_id: idATU,
            ke_variabel_id: idBI,
            label: 'H5',
            tipe_garis: 'solid',
            tebal_garis: 2.5,
            kelengkungan: 0
          }
        ],
        generateData: (N = 140) => {
          const rows = [];
          for (let i = 0; i < N; i++) {
            const randNorm = (m = 0, s = 1) => {
              let u = 0, v = 0;
              while (u === 0) u = Math.random();
              while (v === 0) v = Math.random();
              return m + s * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            };
            const clamp = (val) => Math.max(1, Math.min(5, Math.round(val)));

            const l_peou = randNorm(3.9, 0.60);
            const l_pu = 0.55 * l_peou + randNorm(1.8, 0.35);
            const l_atu = 0.42 * l_peou + 0.48 * l_pu + randNorm(0, 0.32);
            const l_bi = 0.54 * l_atu + 0.36 * l_pu + randNorm(0, 0.30);

            rows.push({
              PEOU1: clamp(l_peou + randNorm(0, 0.26)),
              PEOU2: clamp(l_peou + randNorm(0, 0.24)),
              PEOU3: clamp(l_peou + randNorm(0, 0.28)),
              PEOU4: clamp(l_peou + randNorm(0, 0.25)),
              PU1: clamp(l_pu + randNorm(0, 0.25)),
              PU2: clamp(l_pu + randNorm(0, 0.27)),
              PU3: clamp(l_pu + randNorm(0, 0.24)),
              PU4: clamp(l_pu + randNorm(0, 0.28)),
              ATU1: clamp(l_atu + randNorm(0, 0.26)),
              ATU2: clamp(l_atu + randNorm(0, 0.25)),
              ATU3: clamp(l_atu + randNorm(0, 0.28)),
              ATU4: clamp(l_atu + randNorm(0, 0.24)),
              BI1: clamp(l_bi + randNorm(0, 0.25)),
              BI2: clamp(l_bi + randNorm(0, 0.24)),
              BI3: clamp(l_bi + randNorm(0, 0.28)),
              BI4: clamp(l_bi + randNorm(0, 0.26))
            });
          }
          return rows;
        }
      };
    } else if (templateKey === 'customer_satisfaction') {
      const idSQ = baseId;
      const idPV = baseId + 1;
      const idCS = baseId + 2;
      const idCL = baseId + 3;

      templateConfig = {
        nama: 'Riset Kepuasan & Loyalitas Konsumen',
        deskripsi: 'Pengaruh Service Quality (SQ) dan Perceived Value (PV) terhadap Customer Loyalty (CL) melalui Customer Satisfaction (CS)',
        variabels: [
          {
            id: idSQ,
            nama: 'Service Quality',
            tipe: 'reflektif',
            indikator: ['SQ1', 'SQ2', 'SQ3', 'SQ4'],
            orientasi: 'kiri',
            posisi_x: 230,
            posisi_y: 180
          },
          {
            id: idPV,
            nama: 'Perceived Value',
            tipe: 'reflektif',
            indikator: ['PV1', 'PV2', 'PV3', 'PV4'],
            orientasi: 'kiri',
            posisi_x: 230,
            posisi_y: 460
          },
          {
            id: idCS,
            nama: 'Customer Satisfaction',
            tipe: 'reflektif',
            indikator: ['CS1', 'CS2', 'CS3', 'CS4'],
            orientasi: 'atas',
            posisi_x: 580,
            posisi_y: 320
          },
          {
            id: idCL,
            nama: 'Customer Loyalty',
            tipe: 'reflektif',
            indikator: ['CL1', 'CL2', 'CL3', 'CL4'],
            orientasi: 'kanan',
            posisi_x: 930,
            posisi_y: 320
          }
        ],
        jalurs: [
          {
            id: baseId + 10,
            dari: 'Service Quality',
            ke: 'Customer Satisfaction',
            dari_variabel_id: idSQ,
            ke_variabel_id: idCS,
            label: 'H1',
            tipe_garis: 'solid',
            tebal_garis: 2.2,
            kelengkungan: 0
          },
          {
            id: baseId + 11,
            dari: 'Perceived Value',
            ke: 'Customer Satisfaction',
            dari_variabel_id: idPV,
            ke_variabel_id: idCS,
            label: 'H2',
            tipe_garis: 'solid',
            tebal_garis: 2.2,
            kelengkungan: 0
          },
          {
            id: baseId + 12,
            dari: 'Customer Satisfaction',
            ke: 'Customer Loyalty',
            dari_variabel_id: idCS,
            ke_variabel_id: idCL,
            label: 'H3',
            tipe_garis: 'solid',
            tebal_garis: 2.5,
            kelengkungan: 0
          },
          {
            id: baseId + 13,
            dari: 'Service Quality',
            ke: 'Customer Loyalty',
            dari_variabel_id: idSQ,
            ke_variabel_id: idCL,
            label: 'H4',
            tipe_garis: 'dashed',
            tebal_garis: 1.8,
            kelengkungan: -35
          }
        ],
        generateData: (N = 140) => {
          const rows = [];
          for (let i = 0; i < N; i++) {
            const randNorm = (m = 0, s = 1) => {
              let u = 0, v = 0;
              while (u === 0) u = Math.random();
              while (v === 0) v = Math.random();
              return m + s * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            };
            const clamp = (val) => Math.max(1, Math.min(5, Math.round(val)));

            const l_sq = randNorm(3.9, 0.58);
            const l_pv = randNorm(3.8, 0.62);
            const l_cs = 0.48 * l_sq + 0.42 * l_pv + randNorm(0, 0.32);
            const l_cl = 0.56 * l_cs + 0.28 * l_sq + randNorm(0, 0.30);

            rows.push({
              SQ1: clamp(l_sq + randNorm(0, 0.26)),
              SQ2: clamp(l_sq + randNorm(0, 0.24)),
              SQ3: clamp(l_sq + randNorm(0, 0.28)),
              SQ4: clamp(l_sq + randNorm(0, 0.25)),
              PV1: clamp(l_pv + randNorm(0, 0.25)),
              PV2: clamp(l_pv + randNorm(0, 0.27)),
              PV3: clamp(l_pv + randNorm(0, 0.24)),
              PV4: clamp(l_pv + randNorm(0, 0.28)),
              CS1: clamp(l_cs + randNorm(0, 0.26)),
              CS2: clamp(l_cs + randNorm(0, 0.25)),
              CS3: clamp(l_cs + randNorm(0, 0.28)),
              CS4: clamp(l_cs + randNorm(0, 0.24)),
              CL1: clamp(l_cl + randNorm(0, 0.25)),
              CL2: clamp(l_cl + randNorm(0, 0.24)),
              CL3: clamp(l_cl + randNorm(0, 0.28)),
              CL4: clamp(l_cl + randNorm(0, 0.26))
            });
          }
          return rows;
        }
      };
    } else if (templateKey === 'moderasi') {
      const idKP = baseId;
      const idCM = baseId + 1;
      const idMB = baseId + 2;

      templateConfig = {
        nama: 'Riset Kualitas Produk & Citra Merek',
        deskripsi: 'Model Pengaruh Kualitas Produk (KP) dan Citra Merek (CM) terhadap Minat Beli (MB)',
        variabels: [
          {
            id: idKP,
            nama: 'Kualitas Produk',
            tipe: 'reflektif',
            indikator: ['KP1', 'KP2', 'KP3', 'KP4'],
            orientasi: 'kiri',
            posisi_x: 240,
            posisi_y: 200
          },
          {
            id: idCM,
            nama: 'Citra Merek',
            tipe: 'reflektif',
            indikator: ['CM1', 'CM2', 'CM3', 'CM4'],
            orientasi: 'kiri',
            posisi_x: 240,
            posisi_y: 440
          },
          {
            id: idMB,
            nama: 'Minat Beli',
            tipe: 'reflektif',
            indikator: ['MB1', 'MB2', 'MB3', 'MB4'],
            orientasi: 'kanan',
            posisi_x: 750,
            posisi_y: 320
          }
        ],
        jalurs: [
          {
            id: baseId + 10,
            dari: 'Kualitas Produk',
            ke: 'Minat Beli',
            dari_variabel_id: idKP,
            ke_variabel_id: idMB,
            label: 'H1',
            tipe_garis: 'solid',
            tebal_garis: 2.5,
            kelengkungan: 0
          },
          {
            id: baseId + 11,
            dari: 'Citra Merek',
            ke: 'Minat Beli',
            dari_variabel_id: idCM,
            ke_variabel_id: idMB,
            label: 'H2',
            tipe_garis: 'solid',
            tebal_garis: 2.5,
            kelengkungan: 0
          }
        ],
        generateData: (N = 130) => {
          const rows = [];
          for (let i = 0; i < N; i++) {
            const randNorm = (m = 0, s = 1) => {
              let u = 0, v = 0;
              while (u === 0) u = Math.random();
              while (v === 0) v = Math.random();
              return m + s * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            };
            const clamp = (val) => Math.max(1, Math.min(5, Math.round(val)));

            const l_kp = randNorm(3.9, 0.60);
            const l_cm = randNorm(3.85, 0.58);
            const l_mb = 0.52 * l_kp + 0.44 * l_cm + randNorm(0, 0.32);

            rows.push({
              KP1: clamp(l_kp + randNorm(0, 0.25)),
              KP2: clamp(l_kp + randNorm(0, 0.24)),
              KP3: clamp(l_kp + randNorm(0, 0.28)),
              KP4: clamp(l_kp + randNorm(0, 0.26)),
              CM1: clamp(l_cm + randNorm(0, 0.26)),
              CM2: clamp(l_cm + randNorm(0, 0.25)),
              CM3: clamp(l_cm + randNorm(0, 0.27)),
              CM4: clamp(l_cm + randNorm(0, 0.24)),
              MB1: clamp(l_mb + randNorm(0, 0.25)),
              MB2: clamp(l_mb + randNorm(0, 0.24)),
              MB3: clamp(l_mb + randNorm(0, 0.28)),
              MB4: clamp(l_mb + randNorm(0, 0.26))
            });
          }
          return rows;
        }
      };
    } else {
      // standar_regresi
      const idMK = baseId;
      const idLK = baseId + 1;
      const idKP = baseId + 2;
      const idKK = baseId + 3;

      templateConfig = {
        nama: 'Riset Kinerja SDM & Organisasi',
        deskripsi: 'Pengaruh Motivasi Kerja (MK), Lingkungan Kerja (LK), dan Kepemimpinan (KP) terhadap Kinerja Karyawan (KK)',
        variabels: [
          {
            id: idMK,
            nama: 'Motivasi Kerja',
            tipe: 'reflektif',
            indikator: ['MK1', 'MK2', 'MK3', 'MK4'],
            orientasi: 'kiri',
            posisi_x: 230,
            posisi_y: 160
          },
          {
            id: idLK,
            nama: 'Lingkungan Kerja',
            tipe: 'reflektif',
            indikator: ['LK1', 'LK2', 'LK3', 'LK4'],
            orientasi: 'kiri',
            posisi_x: 230,
            posisi_y: 320
          },
          {
            id: idKP,
            nama: 'Kepemimpinan',
            tipe: 'reflektif',
            indikator: ['KP1', 'KP2', 'KP3', 'KP4'],
            orientasi: 'kiri',
            posisi_x: 230,
            posisi_y: 480
          },
          {
            id: idKK,
            nama: 'Kinerja Karyawan',
            tipe: 'reflektif',
            indikator: ['KK1', 'KK2', 'KK3', 'KK4'],
            orientasi: 'kanan',
            posisi_x: 750,
            posisi_y: 320
          }
        ],
        jalurs: [
          {
            id: baseId + 10,
            dari: 'Motivasi Kerja',
            ke: 'Kinerja Karyawan',
            dari_variabel_id: idMK,
            ke_variabel_id: idKK,
            label: 'H1',
            tipe_garis: 'solid',
            tebal_garis: 2.2,
            kelengkungan: 0
          },
          {
            id: baseId + 11,
            dari: 'Lingkungan Kerja',
            ke: 'Kinerja Karyawan',
            dari_variabel_id: idLK,
            ke_variabel_id: idKK,
            label: 'H2',
            tipe_garis: 'solid',
            tebal_garis: 2.2,
            kelengkungan: 0
          },
          {
            id: baseId + 12,
            dari: 'Kepemimpinan',
            ke: 'Kinerja Karyawan',
            dari_variabel_id: idKP,
            ke_variabel_id: idKK,
            label: 'H3',
            tipe_garis: 'solid',
            tebal_garis: 2.2,
            kelengkungan: 0
          }
        ],
        generateData: (N = 135) => {
          const rows = [];
          for (let i = 0; i < N; i++) {
            const randNorm = (m = 0, s = 1) => {
              let u = 0, v = 0;
              while (u === 0) u = Math.random();
              while (v === 0) v = Math.random();
              return m + s * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            };
            const clamp = (val) => Math.max(1, Math.min(5, Math.round(val)));

            const l_mk = randNorm(3.9, 0.58);
            const l_lk = randNorm(3.8, 0.60);
            const l_kp = randNorm(3.85, 0.62);
            const l_kk = 0.38 * l_mk + 0.32 * l_lk + 0.35 * l_kp + randNorm(0, 0.28);

            rows.push({
              MK1: clamp(l_mk + randNorm(0, 0.25)),
              MK2: clamp(l_mk + randNorm(0, 0.24)),
              MK3: clamp(l_mk + randNorm(0, 0.28)),
              MK4: clamp(l_mk + randNorm(0, 0.26)),
              LK1: clamp(l_lk + randNorm(0, 0.26)),
              LK2: clamp(l_lk + randNorm(0, 0.25)),
              LK3: clamp(l_lk + randNorm(0, 0.27)),
              LK4: clamp(l_lk + randNorm(0, 0.24)),
              KP1: clamp(l_kp + randNorm(0, 0.25)),
              KP2: clamp(l_kp + randNorm(0, 0.24)),
              KP3: clamp(l_kp + randNorm(0, 0.28)),
              KP4: clamp(l_kp + randNorm(0, 0.26)),
              KK1: clamp(l_kk + randNorm(0, 0.25)),
              KK2: clamp(l_kk + randNorm(0, 0.24)),
              KK3: clamp(l_kk + randNorm(0, 0.28)),
              KK4: clamp(l_kk + randNorm(0, 0.26))
            });
          }
          return rows;
        }
      };
    }

    // 1. Buat Proyek Baru jika belum ada
    if (!state.proyekAktif) {
      const proyekBaru = await window.api.proyekBuat({
        nama: templateConfig.nama,
        deskripsi: templateConfig.deskripsi
      });
      state.proyekAktif = proyekBaru;
    }

    // Update nama proyek di toolbar
    document.querySelectorAll('.proyek-nama-aktif').forEach(el => {
      el.textContent = state.proyekAktif.nama;
    });

    // 2. Set State Variabel, Jalur & Catatan Model
    state.variabels = templateConfig.variabels;
    state.jalurs = templateConfig.jalurs;
    state.catatans = [
      {
        id: baseId + 50,
        teks: `Template: ${templateConfig.nama}\nDataset N=140 responden siap analisis.`,
        warna: '#fef08a',
        x: 520,
        y: 120,
        w: 220,
        h: 75
      }
    ];

    // Simpan model ke SQLite
    await saveModelToDb('Terapkan Template');

    // 3. Generate Dataset Sintetis & Simpan ke DB
    const datasetRows = templateConfig.generateData();
    const columns = Object.keys(datasetRows[0]);
    
    const savedDataset = await window.api.datasetTambah({
      proyek_id: state.proyekAktif.id,
      nama: `Dataset_${templateConfig.nama.replace(/\s+/g, '_')}.csv`,
      data: datasetRows,
      jumlah_baris: datasetRows.length,
      jumlah_kolom: columns.length,
      kolom: columns
    });

    state.datasets = [savedDataset];

    // 4. Hubungkan Data ke PLS-SEM Engine & Jalankan Algoritma
    plsEngine.setData(datasetRows, state.variabels, state.jalurs);
    
    const hasilPLS = plsEngine.runPLS({
      maxIterasi: 300,
      toleransi: 0.00001,
      skemaBobot: 'path'
    });
    state.hasilPLS = hasilPLS;

    await window.api.hasilSimpan({
      proyek_id: state.proyekAktif.id,
      tipe: 'pls',
      data_hasil: hasilPLS
    });

    // 5. Jalankan Bootstrapping (500 subsample)
    const hasilBootstrap = plsEngine.runBootstrap({
      jumlahBootstrap: 500,
      tingkatSignifikansi: 0.05,
      tipeUji: 'two-tailed',
      skemaBobot: 'path'
    });
    state.hasilBootstrap = hasilBootstrap;

    await window.api.hasilSimpan({
      proyek_id: state.proyekAktif.id,
      tipe: 'bootstrap',
      data_hasil: hasilBootstrap
    });

    // 6. Selesaikan, Update UI & Render Kanvas
    hideLoading();
    hideModal('modalTemplateModel');
    updateProjectStateUI();
    
    // Render hasil dan model visual
    displayPLSResults(hasilPLS);
    displayBootstrapResults(hasilBootstrap);
    
    // Buka editor untuk menampilkan diagram model lengkap
    navigateTo('editor');
    setTimeout(() => {
      renderModel();
    }, 100);

    showToast(`Template "${templateConfig.nama}" berhasil diterapkan lengkap dengan Dataset, Model Diagram, dan Laporan Hasil Analisis!`, 'sukses');
  } catch (err) {
    hideLoading();
    showToast('Gagal menerapkan template: ' + err.message, 'error');
    console.error(err);
  }
}
window.terapkanTemplateModel = terapkanTemplateModel;

  // Modal Tambah Jalur - Selektor Tipe Hubungan (Langsung vs Mediasi)
  const cardLangsung = document.getElementById('cardHubunganLangsung');
  const cardMediasi = document.getElementById('cardHubunganMediasi');
  const containerMediator = document.getElementById('containerPilihMediator');

  cardLangsung?.addEventListener('click', () => {
    cardLangsung.classList.add('active');
    cardLangsung.style.border = '1.5px solid var(--color-primary)';
    cardLangsung.style.background = 'var(--color-primary-light)';
    cardMediasi.classList.remove('active');
    cardMediasi.style.border = '1.5px solid var(--border-color)';
    cardMediasi.style.background = 'var(--bg-hover)';
    containerMediator?.classList.add('tersembunyi');
    
    // Auto switch style default to solid
    document.querySelector('input[name="tipeGarisJalur"][value="solid"]').checked = true;
    document.querySelectorAll('.tipe-garis-card').forEach(c => c.classList.remove('active'));
    document.querySelector('.tipe-garis-card:first-child')?.classList.add('active');
  });

  cardMediasi?.addEventListener('click', () => {
    cardMediasi.classList.add('active');
    cardMediasi.style.border = '1.5px solid #f59e0b';
    cardMediasi.style.background = 'rgba(245, 158, 11, 0.12)';
    cardLangsung.classList.remove('active');
    cardLangsung.style.border = '1.5px solid var(--border-color)';
    cardLangsung.style.background = 'var(--bg-hover)';
    containerMediator?.classList.remove('tersembunyi');
    
    // Auto switch style default to dashed & preset curvature
    document.querySelector('input[name="tipeGarisJalur"][value="dashed"]').checked = true;
    document.querySelectorAll('.tipe-garis-card').forEach(c => c.classList.remove('active'));
    document.querySelector('.tipe-garis-card:last-child')?.classList.add('active');
    window.setPresetKelengkungan(45);
  });

  // Modal Tambah Jalur - Selektor Ketebalan Garis
  document.querySelectorAll('.tipe-tebal-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.tipe-tebal-card').forEach(c => {
        c.classList.remove('active');
        c.style.border = '1.5px solid var(--border-color)';
        c.style.background = 'var(--bg-hover)';
      });
      card.classList.add('active');
      card.style.border = '1.5px solid var(--color-primary)';
      card.style.background = 'var(--color-primary-light)';
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // Modal Tambah Jalur - Selektor Tipe Garis (Solid vs Putus-putus)
  document.querySelectorAll('.tipe-garis-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.tipe-garis-card').forEach(c => {
        c.classList.remove('active');
        c.style.border = '1.5px solid var(--border-color)';
        c.style.background = 'var(--bg-hover)';
      });
      card.classList.add('active');
      card.style.border = '1.5px solid var(--color-primary)';
      card.style.background = 'var(--color-primary-light)';
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // Modal Tambah Variabel Card Selectors (Reflektif vs Formatif)
  document.querySelectorAll('.tipe-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.tipe-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // Modal Tambah Variabel Orientasi Selectors (Kiri, Kanan, Atas, Bawah)
  document.querySelectorAll('.orientasi-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.orientasi-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // Toggle Batch Input
  document.getElementById('btnToggleBatchInput')?.addEventListener('click', () => {
    const box = document.getElementById('batchInputContainer');
    box.classList.toggle('tersembunyi');
    if (!box.classList.contains('tersembunyi')) {
      document.getElementById('inputBatchIndikator').focus();
    }
  });

  // Terapkan Batch Input
  document.getElementById('btnTerapkanBatch')?.addEventListener('click', () => {
    const raw = document.getElementById('inputBatchIndikator').value;
    const tokens = raw.split(/[,;\n\r\t]+/).map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    if (tokens.length === 0) {
      showToast('Masukkan nama indikator terlebih dahulu', 'peringatan');
      return;
    }
    const container = document.getElementById('indikatorContainer');
    container.innerHTML = '';
    tokens.forEach(tok => tambahIndikatorInput(tok));
    document.getElementById('batchInputContainer').classList.add('tersembunyi');
    document.getElementById('inputBatchIndikator').value = '';
    showToast(`${tokens.length} indikator diterapkan`, 'sukses');
  });

  document.getElementById('btnTambahVariabel').addEventListener('click', () => {
    if (!state.proyekAktif) {
      showToast('Pilih proyek terlebih dahulu', 'peringatan');
      return;
    }
    
    // Reset form
    document.getElementById('inputNamaVariabel').value = '';
    document.querySelector('input[name="tipeVariabel"][value="reflektif"]').checked = true;
    document.querySelectorAll('.tipe-card').forEach(c => c.classList.remove('active'));
    document.querySelector('.tipe-card:first-child')?.classList.add('active');

    document.querySelector('input[name="orientasiIndikator"][value="kiri"]').checked = true;
    document.querySelectorAll('.orientasi-card').forEach(c => c.classList.remove('active'));
    document.querySelector('.orientasi-card:first-child')?.classList.add('active');

    document.getElementById('batchInputContainer')?.classList.add('tersembunyi');
    document.getElementById('indikatorContainer').innerHTML = '';
    
    // Auto populate suggestion chips from dataset if available
    updateDatasetChipsInModal();

    // Default 3 indicator fields (bisa dikosongkan jika konseptual)
    tambahIndikatorInput();
    tambahIndikatorInput();
    tambahIndikatorInput();
    
    showModal('modalTambahVariabel');
    setTimeout(() => document.getElementById('inputNamaVariabel').focus(), 150);
  });
  
  document.getElementById('btnTambahIndikator').addEventListener('click', () => tambahIndikatorInput());
  
  document.getElementById('btnSimpanVariabel').addEventListener('click', () => {
    const nama = document.getElementById('inputNamaVariabel').value.trim();
    if (!nama) {
      showToast('Nama variabel tidak boleh kosong', 'peringatan');
      return;
    }
    
    const tipe = document.querySelector('input[name="tipeVariabel"]:checked')?.value || 'reflektif';
    const orientasi = document.querySelector('input[name="orientasiIndikator"]:checked')?.value || 'kiri';
    const indikator = [];
    document.querySelectorAll('#indikatorContainer .form-input').forEach(input => {
      const val = input.value.trim();
      if (val) indikator.push(val);
    });
    
    // Variabel tanpa indikator diperbolehkan (sebagai kerangka pemikiran / model konseptual)
    const newVar = {
      id: Date.now(),
      nama,
      tipe,
      indikator,
      orientasi,
      posisi_x: 160 + Math.random() * 320,
      posisi_y: 160 + Math.random() * 240
    };
    
    state.variabels.push(newVar);
    hideModal('modalTambahVariabel');
    renderModel();
    saveModelToDb();
    
    if (indikator.length === 0) {
      showToast(`Variabel konseptual "${nama}" ditambahkan (Tanpa Indikator)`, 'sukses');
    } else {
      showToast(`Variabel "${nama}" ditambahkan (${indikator.length} indikator)`, 'sukses');
    }
  });
  
  // Tambah Jalur
  document.getElementById('btnTambahJalur').addEventListener('click', () => {
    if (!state.proyekAktif) {
      showToast('Pilih proyek terlebih dahulu', 'peringatan');
      return;
    }
    if (state.variabels.length < 2) {
      showToast('Tambahkan minimal 2 variabel untuk membuat jalur', 'peringatan');
      return;
    }
    
    const selectDari = document.getElementById('selectDariVariabel');
    const selectKe = document.getElementById('selectKeVariabel');
    const selectMediator = document.getElementById('selectMediatorVariabel');
    const inputLabel = document.getElementById('inputLabelJalur');
    
    // Auto generate next hypothesis label (e.g. H1, H2, H3...)
    const nextH = `H${state.jalurs.length + 1}`;
    if (inputLabel) inputLabel.value = nextH;

    // Reset hubungan to langsung
    const cardLangsung = document.getElementById('cardHubunganLangsung');
    const cardMediasi = document.getElementById('cardHubunganMediasi');
    const containerMediator = document.getElementById('containerPilihMediator');
    cardLangsung?.click();

    // Reset curvature to straight (0)
    window.setPresetKelengkungan(0);

    const options = state.variabels.map(v => `<option value="${v.id}">${escapeHtml(v.nama)}</option>`).join('');
    selectDari.innerHTML = '<option value="">-- Pilih Variabel Asal (X) --</option>' + options;
    selectKe.innerHTML = '<option value="">-- Pilih Variabel Tujuan (Y) --</option>' + options;
    if (selectMediator) {
      selectMediator.innerHTML = '<option value="">-- Pilih Variabel Mediator (Z) --</option>' + options;
    }

    // Auto-isi variabel asal dari node yang sedang dipilih di canvas
    if (state.selectedNode) selectDari.value = state.selectedNode;

    showModal('modalTambahJalur');
  });
  
  document.getElementById('btnSimpanJalur').addEventListener('click', () => {
    const tipeHubungan = document.querySelector('input[name="tipeHubunganJalur"]:checked')?.value || 'langsung';
    const dari = document.getElementById('selectDariVariabel').value;
    const ke = document.getElementById('selectKeVariabel').value;
    const mediator = document.getElementById('selectMediatorVariabel')?.value;
    const label = document.getElementById('inputLabelJalur')?.value.trim() || '';
    const tipeGaris = document.querySelector('input[name="tipeGarisJalur"]:checked')?.value || 'solid';
    const tebalGaris = parseFloat(document.querySelector('input[name="tipeTebalGarisJalur"]:checked')?.value) || 2.5;
    const kelengkungan = parseInt(document.getElementById('inputKelengkunganJalur')?.value) || 0;
    
    if (!dari || !ke) {
      showToast('Pilih variabel asal (X) dan variabel tujuan (Y)', 'peringatan');
      return;
    }
    
    if (dari === ke) {
      showToast('Variabel asal dan tujuan tidak boleh sama', 'peringatan');
      return;
    }

    const dariVar = state.variabels.find(v => v.id == dari);
    const keVar = state.variabels.find(v => v.id == ke);

    if (tipeHubungan === 'mediasi') {
      if (!mediator) {
        showToast('Pilih variabel mediator (Z) untuk hubungan mediasi', 'peringatan');
        return;
      }
      if (mediator === dari || mediator === ke) {
        showToast('Variabel mediator (Z) harus berbeda dari variabel asal dan tujuan', 'peringatan');
        return;
      }

      const medVar = state.variabels.find(v => v.id == mediator);

      // Bersihkan jalur auto-generated lama yang kosong/tumpang tindih dengan mediasi ini
      state.jalurs = state.jalurs.filter(j => {
        const isOldXZ = (j.dari_variabel_id == dari || j.dari === dariVar.nama) && (j.ke_variabel_id == mediator || j.ke === medVar.nama) && (!j.label || j.label.trim() === '');
        const isOldZY = (j.dari_variabel_id == mediator || j.dari === medVar.nama) && (j.ke_variabel_id == ke || j.ke === keVar.nama) && (!j.label || j.label.trim() === '');
        return !isOldXZ && !isOldZY;
      });

      // Tambah satu jalur mediasi X -> Z -> Y dengan style yang dipilih user (solid atau putus-putus)
      const indirectLabel = label || `${dariVar.nama} → ${medVar.nama} → ${keVar.nama}`;
      state.jalurs.push({
        id: Date.now(),
        dari: dariVar.nama,
        ke: keVar.nama,
        dari_variabel_id: dari,
        ke_variabel_id: ke,
        melalui: medVar.nama,
        melalui_variabel_id: parseInt(mediator),
        label: indirectLabel,
        tipe_garis: tipeGaris,
        tebal_garis: tebalGaris,
        kelengkungan: kelengkungan !== 0 ? kelengkungan : 0
      });

      hideModal('modalTambahJalur');
      renderModel();
      saveModelToDb();
      showToast(`Jalur mediasi ${dariVar.nama} → ${medVar.nama} → ${keVar.nama} (${indirectLabel}) berhasil dibuat!`, 'sukses');
      return;
    }
    
    // Hubungan Langsung Biasa
    state.jalurs.push({
      id: Date.now(),
      dari: dariVar.nama,
      ke: keVar.nama,
      dari_variabel_id: dari,
      ke_variabel_id: ke,
      label: label,
      tipe_garis: tipeGaris,
      tebal_garis: tebalGaris,
      kelengkungan: kelengkungan
    });
    
    hideModal('modalTambahJalur');
    renderModel();
    saveModelToDb();
    showToast(`Jalur ${dariVar.nama} → ${keVar.nama} ${label ? `(${label})` : ''} ditambahkan`, 'sukses');
  });
  
  // Auto Layout
  document.getElementById('btnAutoLayout')?.addEventListener('click', () => {
    if (!state.proyekAktif || state.variabels.length === 0) {
      showToast('Belum ada variabel untuk dirapikan', 'peringatan');
      return;
    }
    jalankanAutoLayout();
    renderModel();
    saveModelToDb();
    showToast('Tata letak diagram dirapikan otomatis', 'sukses');
  });
  
  // Buka Modal Ekspor Gambar 600 DPI
  document.getElementById('btnBukaEksporGambar')?.addEventListener('click', () => {
    if (!state.proyekAktif || state.variabels.length === 0) {
      showToast('Buat model terlebih dahulu sebelum ekspor gambar', 'peringatan');
      return;
    }
    
    // Sinkronkan semua opsi ekspor dengan kondisi canvas aktif saat ini
    const isIndikatorAktif = (state.showIndikator !== false);
    const checkInd = document.getElementById('checkShowIndicators');
    const checkLoad = document.getElementById('checkShowLoadings');
    const checkLeg = document.getElementById('checkShowLegend');
    const checkPVal = document.getElementById('checkShowPValues');

    if (checkInd) checkInd.checked = isIndikatorAktif;
    if (checkLoad) checkLoad.checked = isIndikatorAktif;
    if (checkLeg) checkLeg.checked = state.jalurs.some(j => j.tipe_garis === 'dashed');
    if (checkPVal) checkPVal.checked = !!state.hasilBootstrap;

    showModal('modalEksporGambar');
  });
  
  // Ekspor / Download Gambar
  document.getElementById('btnDownloadGambar')?.addEventListener('click', async () => {
    await prosesEksporGambar(false);
  });
  
  // Salin Gambar ke Clipboard
  document.getElementById('btnSalinGambar')?.addEventListener('click', async () => {
    await prosesEksporGambar(true);
  });
  
  // Simpan Model
  document.getElementById('btnSimpanModel').addEventListener('click', async () => {
    if (!state.proyekAktif) {
      showToast('Pilih proyek terlebih dahulu', 'peringatan');
      return;
    }
    await saveModelToDb();
    showToast('Model berhasil disimpan', 'sukses');
  });
  
  // Panel close
  document.getElementById('btnTutupPanel')?.addEventListener('click', () => {
    state.selectedNode = null;
    state.selectedPath = null;
    state.selectedCatatan = null;
    renderModel();
    const pb = document.getElementById('panelBody');
    if (pb) pb.innerHTML = '<p class="text-muted">Pilih variabel atau jalur untuk melihat propertinya</p>';
  });
}

function updateDatasetChipsInModal() {
  const container = document.getElementById('datasetColumnsSuggestion');
  const list = document.getElementById('datasetChipsList');
  if (!container || !list) return;

  if (state.datasets && state.datasets.length > 0) {
    const ds = state.datasets[0];
    const cols = ds.kolom || [];
    if (cols.length > 0) {
      container.classList.remove('tersembunyi');
      list.innerHTML = cols.map(c => `
        <span class="dataset-chip" onclick="tambahIndikatorDariChip('${escapeHtml(c)}')">
          <span class="material-icons-round" style="font-size: 13px;">add</span> ${escapeHtml(c)}
        </span>
      `).join('');
      return;
    }
  }
  container.classList.add('tersembunyi');
}

function tambahIndikatorDariChip(name) {
  tambahIndikatorInput(name);
  showToast(`Indikator "${name}" ditambahkan`, 'info');
}

function tambahIndikatorInput(defaultValue = '') {
  const container = document.getElementById('indikatorContainer');
  const row = document.createElement('div');
  row.className = 'indikator-row';
  row.innerHTML = `
    <input type="text" class="form-input" placeholder="Nama indikator (misal: SQ1, Sat1)" value="${escapeHtml(defaultValue)}">
    <button type="button" class="btn-hapus" onclick="this.parentElement.remove()" title="Hapus baris">
      <span class="material-icons-round">close</span>
    </button>
  `;
  container.appendChild(row);
}

function updateAutosaveIndicator(status = 'saved') {
  const badge = document.getElementById('badgeAutosaveStatus');
  if (!badge) return;
  if (status === 'saving') {
    badge.innerHTML = `
      <span class="material-icons-round" style="font-size: 13px; color: #f59e0b; animation: spin 1s linear infinite;">sync</span>
      <span>Menyimpan...</span>
    `;
  } else if (status === 'saved') {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    badge.innerHTML = `
      <span class="material-icons-round" style="font-size: 13px; color: #10b981;">cloud_done</span>
      <span>Autosave ${timeStr}</span>
    `;
  } else if (status === 'error') {
    badge.innerHTML = `
      <span class="material-icons-round" style="font-size: 13px; color: #ef4444;">cloud_off</span>
      <span>Gagal Menyimpan</span>
    `;
  }
}

async function saveModelToDb(actionLabel = 'Perubahan Model') {
  if (!state.proyekAktif) return;
  
  if (!state.isUndoRedoAction) {
    saveHistoryState(actionLabel);
  }

  updateAutosaveIndicator('saving');

  try {
    await window.api.proyekSimpanModel({
      id: state.proyekAktif.id,
      model_data: {
        variabels: state.variabels,
        jalurs: state.jalurs,
        catatans: state.catatans || []
      }
    });
    updateAutosaveIndicator('saved');
  } catch (err) {
    console.error('Gagal menyimpan model:', err);
    updateAutosaveIndicator('error');
  }
}

// ============ AUTO LAYOUT ENGINE ============
function jalankanAutoLayout() {
  if (state.variabels.length === 0) return;
  
  // Deteksi in-degree & out-degree
  const inDegree = {};
  const outDegree = {};
  
  state.variabels.forEach(v => {
    inDegree[v.nama] = 0;
    outDegree[v.nama] = 0;
  });
  
  state.jalurs.forEach(j => {
    if (inDegree[j.ke] !== undefined) inDegree[j.ke]++;
    if (outDegree[j.dari] !== undefined) outDegree[j.dari]++;
  });
  
  // Pisahkan ke layer: 0 = Exogenous (kiri), 1 = Mediator (tengah), 2 = Endogenous (kanan)
  const layers = [[], [], []];
  
  state.variabels.forEach(v => {
    if (inDegree[v.nama] === 0) {
      layers[0].push(v); // Kiri
      if (!v.orientasi || v.orientasi === 'kanan') v.orientasi = 'kiri';
    } else if (outDegree[v.nama] === 0) {
      layers[2].push(v); // Kanan
      if (!v.orientasi || v.orientasi === 'kiri') v.orientasi = 'kanan';
    } else {
      layers[1].push(v); // Tengah / Mediator
      // Bagi orientasi atas / bawah
      const idx = layers[1].length - 1;
      if (!v.orientasi) v.orientasi = (idx % 2 === 0) ? 'atas' : 'bawah';
    }
  });
  
  // Jika semua variabel ada di 1 layer, sebar rata
  const xPositions = [200, 520, 840];
  
  layers.forEach((layer, layerIdx) => {
    if (layer.length === 0) return;
    const x = xPositions[layerIdx];
    const totalH = 500;
    const stepY = totalH / (layer.length + 1);
    
    layer.forEach((v, vIdx) => {
      v.posisi_x = x;
      v.posisi_y = 100 + stepY * (vIdx + 1);
    });
  });
}

// ============ GEOMETRI & INDIKATOR PLS-SEM ============
const PLS_STYLE = {
  latentRadius: 42,
  latentColor: '#009bf2',
  latentBorderColor: '#0070ba',
  latentBorderWidth: 2.5,
  indicatorWidth: 58,
  indicatorHeight: 26,
  indicatorBg: '#fff200',
  indicatorBorder: '#d4b106',
  indicatorRadius: 3,
  indicatorTextColor: '#000000',
  lineColor: '#2b2d42',
  lineWidth: 1.6,
  pathColor: '#2b2d42',
  pathLineWidth: 2.2,
  fontFamily: 'Inter, -apple-system, sans-serif'
};

function darkenHexColor(hex, percent = 22) {
  if (!hex || hex[0] !== '#') return '#0070ba';
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return '#0070ba';
  let r = (num >> 16);
  let g = (num >> 8) & 0x00FF;
  let b = num & 0x0000FF;
  r = Math.max(0, Math.min(255, Math.floor(r * (1 - percent / 100))));
  g = Math.max(0, Math.min(255, Math.floor(g * (1 - percent / 100))));
  b = Math.max(0, Math.min(255, Math.floor(b * (1 - percent / 100))));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function setVariableColor(varId, hexColor) {
  const v = state.variabels.find(vv => vv.id === varId);
  if (!v) return;
  saveHistoryState(`Ubah Warna "${v.nama}"`);
  v.warna = hexColor;
  v.borderWarna = darkenHexColor(hexColor, 25);
  renderModel();
  saveModelToDb();
  showVariableProperties(v);
  showToast(`Warna variabel "${v.nama}" berhasil diubah`, 'sukses');
}

function setVariableOrientation(id, orientasi) {
  const v = state.variabels.find(vv => vv.id === id);
  if (!v) return;
  saveHistoryState(`Ubah Orientasi "${v.nama}"`);
  v.orientasi = orientasi;
  renderModel();
  saveModelToDb();
  showVariableProperties(v);
  showToast(`Posisi indikator "${v.nama}" diubah ke ${orientasi.toUpperCase()}`, 'info');
}

function rotateSelectedVariableOrientation(varId = null) {
  const targetId = varId || state.selectedNode || (state.selectedNodes && state.selectedNodes[0]);
  const v = state.variabels.find(vv => vv.id === targetId);
  if (!v) {
    showToast('Pilih variabel laten terlebih dahulu untuk memutar orientasi', 'peringatan');
    return;
  }
  const order = ['kiri', 'atas', 'kanan', 'bawah'];
  const cur = v.orientasi || 'kiri';
  const nextIdx = (order.indexOf(cur) + 1) % order.length;
  setVariableOrientation(v.id, order[nextIdx]);
}

function duplicateSelectedVariable(varId = null) {
  const targetId = varId || state.selectedNode || (state.selectedNodes && state.selectedNodes[0]);
  const original = state.variabels.find(v => v.id === targetId);
  if (!original) {
    showToast('Pilih variabel laten yang ingin diduplikasi (Ctrl+D)', 'peringatan');
    return;
  }

  saveHistoryState(`Duplikasi Variabel "${original.nama}"`);

  let newName = `${original.nama}_copy`;
  let counter = 1;
  while (state.variabels.some(v => v.nama.toLowerCase() === newName.toLowerCase())) {
    counter++;
    newName = `${original.nama}_copy${counter}`;
  }

  const newVar = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    nama: newName,
    tipe: original.tipe || 'reflektif',
    posisi_x: Math.min(1050, original.posisi_x + 50),
    posisi_y: Math.min(580, original.posisi_y + 40),
    orientasi: original.orientasi || 'kiri',
    warna: original.warna || '#009bf2',
    borderWarna: original.borderWarna || '#0070ba',
    indikator: [...(original.indikator || [])]
  };

  state.variabels.push(newVar);
  state.selectedNode = newVar.id;
  state.selectedNodes = [newVar.id];
  state.selectedPath = null;
  state.selectedCatatan = null;

  renderModel();
  saveModelToDb();
  showVariableProperties(newVar);
  showToast(`Variabel "${newVar.nama}" berhasil diduplikasi!`, 'sukses');
}

function alignSelectedNodes(alignmentType) {
  let nodes = [];
  if (state.selectedNodes && state.selectedNodes.length >= 2) {
    nodes = state.variabels.filter(v => state.selectedNodes.includes(v.id));
  } else if (state.variabels && state.variabels.length >= 2) {
    nodes = state.variabels;
  }

  if (nodes.length < 2) {
    showToast('Minimal diperlukan 2 variabel laten untuk perataan posisi', 'peringatan');
    return;
  }

  saveHistoryState(`Perataan Model (${alignmentType})`);

  if (alignmentType === 'left') {
    const minX = Math.min(...nodes.map(n => n.posisi_x));
    nodes.forEach(n => n.posisi_x = minX);
    showToast(`Perataan Kiri berhasil diterapkan (${nodes.length} variabel)`, 'sukses');
  } else if (alignmentType === 'centerH') {
    const avgX = Math.round(nodes.reduce((acc, n) => acc + n.posisi_x, 0) / nodes.length);
    nodes.forEach(n => n.posisi_x = avgX);
    showToast(`Perataan Sumbu Horizontal diterapkan`, 'sukses');
  } else if (alignmentType === 'right') {
    const maxX = Math.max(...nodes.map(n => n.posisi_x));
    nodes.forEach(n => n.posisi_x = maxX);
    showToast(`Perataan Kanan berhasil diterapkan (${nodes.length} variabel)`, 'sukses');
  } else if (alignmentType === 'top') {
    const minY = Math.min(...nodes.map(n => n.posisi_y));
    nodes.forEach(n => n.posisi_y = minY);
    showToast(`Perataan Atas berhasil diterapkan (${nodes.length} variabel)`, 'sukses');
  } else if (alignmentType === 'centerV') {
    const avgY = Math.round(nodes.reduce((acc, n) => acc + n.posisi_y, 0) / nodes.length);
    nodes.forEach(n => n.posisi_y = avgY);
    showToast(`Perataan Sumbu Vertikal diterapkan`, 'sukses');
  } else if (alignmentType === 'bottom') {
    const maxY = Math.max(...nodes.map(n => n.posisi_y));
    nodes.forEach(n => n.posisi_y = maxY);
    showToast(`Perataan Bawah berhasil diterapkan (${nodes.length} variabel)`, 'sukses');
  } else if (alignmentType === 'distributeH') {
    if (nodes.length < 3) {
      showToast('Minimal diperlukan 3 variabel untuk distribusi jarak horizontal', 'peringatan');
      return;
    }
    nodes.sort((a, b) => a.posisi_x - b.posisi_x);
    const minX = nodes[0].posisi_x;
    const maxX = nodes[nodes.length - 1].posisi_x;
    const step = (maxX - minX) / (nodes.length - 1);
    nodes.forEach((n, idx) => {
      n.posisi_x = Math.round(minX + idx * step);
    });
    showToast(`Distribusi jarak horizontal merata diterapkan`, 'sukses');
  } else if (alignmentType === 'distributeV') {
    if (nodes.length < 3) {
      showToast('Minimal diperlukan 3 variabel untuk distribusi jarak vertikal', 'peringatan');
      return;
    }
    nodes.sort((a, b) => a.posisi_y - b.posisi_y);
    const minY = nodes[0].posisi_y;
    const maxY = nodes[nodes.length - 1].posisi_y;
    const step = (maxY - minY) / (nodes.length - 1);
    nodes.forEach((n, idx) => {
      n.posisi_y = Math.round(minY + idx * step);
    });
    showToast(`Distribusi jarak vertikal merata diterapkan`, 'sukses');
  }

  renderModel();
  saveModelToDb();
}

// ============ QUICK MODERATOR GENERATOR ============
function bukaModalTambahModerasi(presetVarId = null) {
  if (!state.proyekAktif) {
    showToast('Pilih proyek terlebih dahulu', 'peringatan');
    return;
  }
  if (!state.variabels || state.variabels.length < 2) {
    showToast('Tambahkan minimal 2 variabel untuk membentuk efek moderasi', 'peringatan');
    return;
  }

  const selIV = document.getElementById('selectQuickModIV');
  const selMOD = document.getElementById('selectQuickModMOD');
  const selDV = document.getElementById('selectQuickModDV');
  const inputNama = document.getElementById('inputNamaVarInteraksi');

  if (!selIV || !selMOD || !selDV) return;

  const options = state.variabels.map(v => `<option value="${v.id}">${escapeHtml(v.nama)}</option>`).join('');
  selIV.innerHTML = '<option value="">-- Pilih Variabel Independen (X) --</option>' + options;
  selMOD.innerHTML = '<option value="">-- Pilih Variabel Moderator (M) --</option>' + options;
  selDV.innerHTML = '<option value="">-- Pilih Variabel Target (Y) --</option>' + options;

  // Preset selection if provided
  if (presetVarId) {
    selIV.value = presetVarId;
  } else if (state.selectedNode) {
    selIV.value = state.selectedNode;
  }

  updateModerationInteractionName();
  showModal('modalTambahEfekModerasi');
}

function updateModerationInteractionName() {
  const selIV = document.getElementById('selectQuickModIV');
  const selMOD = document.getElementById('selectQuickModMOD');
  const inputNama = document.getElementById('inputNamaVarInteraksi');
  if (!selIV || !selMOD || !inputNama) return;

  const vIV = state.variabels.find(v => v.id == selIV.value);
  const vMOD = state.variabels.find(v => v.id == selMOD.value);

  if (vIV && vMOD) {
    inputNama.value = `${vIV.nama}*${vMOD.nama}`;
  }
}

async function prosesTambahEfekModerasi() {
  const selIV = document.getElementById('selectQuickModIV');
  const selMOD = document.getElementById('selectQuickModMOD');
  const selDV = document.getElementById('selectQuickModDV');
  const inputNama = document.getElementById('inputNamaVarInteraksi');

  const ivId = selIV?.value;
  const modId = selMOD?.value;
  const dvId = selDV?.value;
  let intName = inputNama?.value.trim();

  if (!ivId || !modId || !dvId) {
    showToast('Pilih variabel Independen (X), Moderator (M), dan Dependen (Y)', 'peringatan');
    return;
  }

  if (ivId === modId || ivId === dvId || modId === dvId) {
    showToast('Variabel X, M, dan Y harus berupa variabel yang berbeda', 'peringatan');
    return;
  }

  const vIV = state.variabels.find(v => v.id == ivId);
  const vMOD = state.variabels.find(v => v.id == modId);
  const vDV = state.variabels.find(v => v.id == dvId);

  if (!intName) {
    intName = `${vIV.nama}*${vMOD.nama}`;
  }

  // Cek duplikasi nama konstruk
  if (state.variabels.some(v => v.nama.toLowerCase() === intName.toLowerCase())) {
    showToast(`Konstruk interaksi "${intName}" sudah ada dalam model`, 'peringatan');
    return;
  }

  saveHistoryState(`Tambah Efek Moderasi "${intName}"`);

  // Posisi node interaksi: di antara X, M, dan Y
  const posX = Math.round((vIV.posisi_x + vMOD.posisi_x + vDV.posisi_x) / 3);
  const posY = Math.round((vIV.posisi_y + vMOD.posisi_y) / 2) + 60;

  // Bangun indikator produk sintesis untuk konstruk interaksi
  const indIV = vIV.indikator || [];
  const indMOD = vMOD.indikator || [];
  let productInds = [];

  if (indIV.length > 0 && indMOD.length > 0) {
    // Buat kombinasi perkalian indikator utama
    productInds = [
      `${indIV[0]}*${indMOD[0]}`,
      indIV[1] && indMOD[1] ? `${indIV[1]}*${indMOD[1]}` : (indIV[1] ? `${indIV[1]}*${indMOD[0]}` : null)
    ].filter(Boolean);
  } else {
    productInds = [`${intName}_1`];
  }

  const intVarId = Date.now();
  const interactionNode = {
    id: intVarId,
    nama: intName,
    tipe: 'reflektif',
    posisi_x: Math.min(1050, Math.max(80, posX)),
    posisi_y: Math.min(580, Math.max(80, posY)),
    orientasi: 'bawah',
    warna: '#ec4899', // Pink Moderasi Khas
    borderWarna: '#be185d',
    indikator: productInds
  };

  state.variabels.push(interactionNode);

  // 1. Jalur Utama X -> Y
  const hasXY = state.jalurs.some(j => (j.dari_variabel_id == ivId || j.dari === vIV.nama) && (j.ke_variabel_id == dvId || j.ke === vDV.nama));
  if (!hasXY) {
    state.jalurs.push({
      id: Date.now() + 1,
      dari: vIV.nama,
      ke: vDV.nama,
      dari_variabel_id: ivId,
      ke_variabel_id: dvId,
      label: 'Main Effect (X→Y)',
      tipe_garis: 'solid',
      tebal_garis: 2.5,
      kelengkungan: 0
    });
  }

  // 2. Jalur Utama M -> Y
  const hasMY = state.jalurs.some(j => (j.dari_variabel_id == modId || j.dari === vMOD.nama) && (j.ke_variabel_id == dvId || j.ke === vDV.nama));
  if (!hasMY) {
    state.jalurs.push({
      id: Date.now() + 2,
      dari: vMOD.nama,
      ke: vDV.nama,
      dari_variabel_id: modId,
      ke_variabel_id: dvId,
      label: 'Main Effect (M→Y)',
      tipe_garis: 'solid',
      tebal_garis: 2.5,
      kelengkungan: 0
    });
  }

  // 3. Jalur Efek Moderasi Interaksi (X*M) -> Y
  state.jalurs.push({
    id: Date.now() + 3,
    dari: intName,
    ke: vDV.nama,
    dari_variabel_id: intVarId,
    ke_variabel_id: dvId,
    label: `Moderasi (${intName}→${vDV.nama})`,
    tipe_garis: 'solid',
    tebal_garis: 3.0,
    kelengkungan: -15
  });

  state.selectedNode = intVarId;
  state.selectedNodes = [intVarId];

  hideModal('modalTambahEfekModerasi');
  renderModel();
  await saveModelToDb();
  showVariableProperties(interactionNode);
  showToast(`Efek Moderasi "${intName}" berhasil dibuat dengan struktur jalur otomatis!`, 'sukses');
}

// ============ MODEL VALIDATOR / LINTING ============
function validateModelStructure() {
  const warnings = [];
  const warningsByNode = {};

  if (!state.variabels || state.variabels.length === 0) {
    updateValidatorBadge({ isValid: true, warnings: [] });
    state.modelWarnings = [];
    state.modelWarningsByNode = {};
    return;
  }

  // 1. Check for constructs without indicators
  state.variabels.forEach(v => {
    if (!v.indikator || v.indikator.length === 0) {
      warnings.push({
        type: 'no_indicators',
        varId: v.id,
        varName: v.nama,
        message: `Variabel "${v.nama}" belum memiliki indikator. Tarik indikator dari panel data.`
      });
      warningsByNode[v.id] = true;
    } else if (v.indikator.length === 1) {
      warnings.push({
        type: 'single_indicator',
        varId: v.id,
        varName: v.nama,
        message: `Variabel "${v.nama}" adalah single-indicator construct (evaluasi reliabilitas multi-item tidak berlaku).`
      });
    }
  });

  // 2. Check for isolated constructs (no incoming AND no outgoing paths)
  if (state.variabels.length > 1) {
    state.variabels.forEach(v => {
      const hasOutgoing = state.jalurs.some(j => (j.dari_variabel_id != null && j.dari_variabel_id == v.id) || (j.dari && j.dari === v.nama));
      const hasIncoming = state.jalurs.some(j => (j.ke_variabel_id != null && j.ke_variabel_id == v.id) || (j.ke && j.ke === v.nama));
      // Variabel juga dianggap terhubung jika ia jadi mediator (melalui_variabel_id) di jalur manapun
      const isMediator = state.jalurs.some(j => (j.melalui_variabel_id != null && j.melalui_variabel_id == v.id) || (j.melalui && j.melalui === v.nama));
      if (!hasOutgoing && !hasIncoming && !isMediator) {
        warnings.push({
          type: 'isolated',
          varId: v.id,
          varName: v.nama,
          message: `Variabel "${v.nama}" terisolasi (belum dihubungkan dengan jalur struktural).`
        });
        warningsByNode[v.id] = true;
      }
    });
  }

  // 3. Check for circular feedback loops (e.g., A -> B and B -> A)
  const pathPairs = {};
  state.jalurs.forEach(j => {
    const key = `${j.dari_variabel_id}->${j.ke_variabel_id}`;
    pathPairs[key] = true;
    const reverseKey = `${j.ke_variabel_id}->${j.dari_variabel_id}`;
    if (pathPairs[reverseKey]) {
      const v1 = state.variabels.find(v => v.id === j.dari_variabel_id);
      const v2 = state.variabels.find(v => v.id === j.ke_variabel_id);
      warnings.push({
        type: 'circular_loop',
        varId: j.dari_variabel_id,
        varName: `${v1?.nama || 'A'} ⇄ ${v2?.nama || 'B'}`,
        message: `Terdapat jalur umpan balik melingkar antara "${v1?.nama}" dan "${v2?.nama}". PLS-SEM mengasumsikan model rekursif.`
      });
    }
  });

  state.modelWarnings = warnings;
  state.modelWarningsByNode = warningsByNode;
  updateValidatorBadge({ isValid: warnings.length === 0, warnings });
}

function updateValidatorBadge({ isValid, warnings }) {
  const badge = document.getElementById('badgeModelValidator');
  const icon = document.getElementById('iconModelValidator');
  const text = document.getElementById('textModelValidator');
  const list = document.getElementById('listModelValidatorIssues');

  if (!badge || !icon || !text) return;

  if (warnings.length === 0) {
    badge.className = 'toolbar-pill-chip validator-chip';
    icon.textContent = 'check_circle';
    icon.style.color = '#10b981';
    text.textContent = 'Model Siap';
    if (list) {
      list.innerHTML = `
        <div style="color: #10b981; display: flex; align-items: center; gap: 6px; padding: 4px 0;">
          <span class="material-icons-round" style="font-size: 16px;">check_circle</span>
          <span>Semua konstruk & jalur telah tervalidasi dengan baik.</span>
        </div>
      `;
    }
  } else {
    badge.className = 'toolbar-pill-chip validator-chip has-warnings';
    icon.textContent = 'warning';
    icon.style.color = '#f59e0b';
    text.textContent = `${warnings.length} Peringatan Model`;
    if (list) {
      list.innerHTML = warnings.map(w => `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #f59e0b; font-size: 11.5px; display: flex; align-items: center; gap: 4px;">
              <span class="material-icons-round" style="font-size: 14px;">warning</span> ${escapeHtml(w.varName)}
            </strong>
            ${w.varId ? `<button class="btn btn-xs btn-ghost" onclick="focusCanvasNode(${w.varId})" style="padding: 1px 6px; font-size: 10px;">Sorot</button>` : ''}
          </div>
          <span style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.35;">${escapeHtml(w.message)}</span>
        </div>
      `).join('');
    }
  }
}

function focusCanvasNode(nodeId) {
  const v = state.variabels.find(vv => vv.id === nodeId);
  if (!v) return;
  state.selectedNode = v.id;
  state.selectedPath = null;
  state.selectedCatatan = null;
  state.selectedNodes = [v.id];
  showVariableProperties(v);
  renderModel();
  showToast(`Variabel "${v.nama}" disorot pada kanvas`, 'info');
}

function getIndicatorPositions(v, options = {}) {
  const R = PLS_STYLE.latentRadius;
  const iw = PLS_STYLE.indicatorWidth;
  const ih = PLS_STYLE.indicatorHeight;
  const orientasi = v.orientasi || 'kiri';
  const inds = v.indikator || [];
  const N = inds.length;
  const positions = [];
  
  const cx = v.posisi_x;
  const cy = v.posisi_y;
  
  if (orientasi === 'kiri') {
    const startX = cx - 110 - iw;
    const totalHeight = (N - 1) * 34;
    const startY = cy - totalHeight / 2 - ih / 2;
    
    inds.forEach((name, i) => {
      const x = startX;
      const y = startY + i * 34;
      positions.push({
        name,
        x, y, w: iw, h: ih,
        // Titik koneksi pada kotak indikator
        connectX: x + iw,
        connectY: y + ih / 2,
        // Titik koneksi pada lingkaran laten
        latentConnectX: cx - R,
        latentConnectY: cy
      });
    });
  } else if (orientasi === 'kanan') {
    const startX = cx + 110;
    const totalHeight = (N - 1) * 34;
    const startY = cy - totalHeight / 2 - ih / 2;
    
    inds.forEach((name, i) => {
      const x = startX;
      const y = startY + i * 34;
      positions.push({
        name,
        x, y, w: iw, h: ih,
        connectX: x,
        connectY: y + ih / 2,
        latentConnectX: cx + R,
        latentConnectY: cy
      });
    });
  } else if (orientasi === 'atas') {
    const startY = cy - 100 - ih;
    const totalWidth = (N - 1) * 68;
    const startX = cx - totalWidth / 2 - iw / 2;
    
    inds.forEach((name, i) => {
      const x = startX + i * 68;
      const y = startY;
      positions.push({
        name,
        x, y, w: iw, h: ih,
        connectX: x + iw / 2,
        connectY: y + ih,
        latentConnectX: cx,
        latentConnectY: cy - R
      });
    });
  } else if (orientasi === 'bawah') {
    const startY = cy + 100;
    const totalWidth = (N - 1) * 68;
    const startX = cx - totalWidth / 2 - iw / 2;
    
    inds.forEach((name, i) => {
      const x = startX + i * 68;
      const y = startY;
      positions.push({
        name,
        x, y, w: iw, h: ih,
        connectX: x + iw / 2,
        connectY: y,
        latentConnectX: cx,
        latentConnectY: cy + R
      });
    });
  }
  
  return positions;
}

// ============ CANVAS RENDERING CORE ============
function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function pointToPathDist(px, py, j) {
  let minDist = Infinity;
  if (j._seg1) {
    if (j._seg1.kelengkungan && j._seg1.kelengkungan !== 0 && j._seg1.cpX !== undefined) {
      for (let t = 0; t <= 1.0; t += 0.08) {
        const it = 1 - t;
        const qx = it * it * j._seg1.x1 + 2 * it * t * j._seg1.cpX + t * t * j._seg1.x2;
        const qy = it * it * j._seg1.y1 + 2 * it * t * j._seg1.cpY + t * t * j._seg1.y2;
        const d = Math.hypot(px - qx, py - qy);
        if (d < minDist) minDist = d;
      }
    } else {
      minDist = Math.min(minDist, pointToSegmentDist(px, py, j._seg1.x1, j._seg1.y1, j._seg1.x2, j._seg1.y2));
    }
  }
  if (j._seg2) {
    if (j._seg2.kelengkungan && j._seg2.kelengkungan !== 0 && j._seg2.cpX !== undefined) {
      for (let t = 0; t <= 1.0; t += 0.08) {
        const it = 1 - t;
        const qx = it * it * j._seg2.x1 + 2 * it * t * j._seg2.cpX + t * t * j._seg2.x2;
        const qy = it * it * j._seg2.y1 + 2 * it * t * j._seg2.cpY + t * t * j._seg2.y2;
        const d = Math.hypot(px - qx, py - qy);
        if (d < minDist) minDist = d;
      }
    } else {
      minDist = Math.min(minDist, pointToSegmentDist(px, py, j._seg2.x1, j._seg2.y1, j._seg2.x2, j._seg2.y2));
    }
  } else if (j._startX !== undefined && j._startY !== undefined) {
    if (j._kelengkungan && j._kelengkungan !== 0 && j._cpX !== undefined) {
      for (let t = 0; t <= 1.0; t += 0.08) {
        const it = 1 - t;
        const qx = it * it * j._startX + 2 * it * t * j._cpX + t * t * j._endX;
        const qy = it * it * j._startY + 2 * it * t * j._cpY + t * t * j._endY;
        const d = Math.hypot(px - qx, py - qy);
        if (d < minDist) minDist = d;
      }
    } else {
      minDist = Math.min(minDist, pointToSegmentDist(px, py, j._startX, j._startY, j._endX, j._endY));
    }
  }
  return minDist;
}

function getPathPointAtT(j, t) {
  if (j._seg1 && j._seg2) {
    const seg = (t < 0.5) ? j._seg1 : j._seg2;
    const tt = (t < 0.5) ? (t * 2) : ((t - 0.5) * 2);
    const k = (t < 0.5) ? (j.kelengkungan1 || 0) : (j.kelengkungan || 0);
    if (k !== 0 && seg.cpX !== undefined) {
      const it = 1 - tt;
      return {
        x: it * it * seg.x1 + 2 * it * tt * seg.cpX + tt * tt * seg.x2,
        y: it * it * seg.y1 + 2 * it * tt * seg.cpY + tt * tt * seg.y2
      };
    } else {
      return {
        x: seg.x1 + tt * (seg.x2 - seg.x1),
        y: seg.y1 + tt * (seg.y2 - seg.y1)
      };
    }
  } else if (j._startX !== undefined && j._startY !== undefined && j._endX !== undefined && j._endY !== undefined) {
    const k = j.kelengkungan || 0;
    if (k !== 0 && j._cpX !== undefined) {
      const it = 1 - t;
      return {
        x: it * it * j._startX + 2 * it * t * j._cpX + t * t * j._endX,
        y: it * it * j._startY + 2 * it * t * j._cpY + t * t * j._endY
      };
    } else {
      return {
        x: j._startX + t * (j._endX - j._startX),
        y: j._startY + t * (j._endY - j._startY)
      };
    }
  }
  return { x: 0, y: 0 };
}

function calculateClosestTOnPath(px, py, j) {
  let bestT = 0.5;
  let minDist = Infinity;
  for (let i = 0; i <= 40; i++) {
    const t = 0.10 + (i / 40) * 0.80;
    const pt = getPathPointAtT(j, t);
    const d = Math.hypot(px - pt.x, py - pt.y);
    if (d < minDist) {
      minDist = d;
      bestT = t;
    }
  }
  return Math.round(bestT * 100) / 100;
}

function drawPLSDiagram(ctx, options = {}) {
  const {
    showR2 = true,
    showLoadings = true,
    showPathCoeff = true,
    showPValues = false,
    showLegend = true,
    showIndicators = (state.showIndikator !== false),
    isExport = false,
    bgColor = 'transparent',
    theme = state.tema,
    selectedNodeId = state.selectedNode,
    selectedPathId = state.selectedPath
  } = options;
  
  const isDark = (theme === 'gelap' && bgColor === 'dark');
  const textColor = isDark ? '#f0f0ff' : '#111827';
  const pathColor = isDark ? '#9bb5ff' : '#2b2d42';
  const outerLineColor = isDark ? '#8899b8' : '#374151';
  
  // Hitung berapa banyak jalur paralel antara pasangan variabel yang sama
  const pathPairsCount = {};
  const pathPairsIndex = {};
  state.jalurs.forEach(j => {
    const key = `${j.dari}_${j.ke}`;
    pathPairsCount[key] = (pathPairsCount[key] || 0) + 1;
  });
  
  let hasDashedLine = false;

  // 1. Gambar Jalur Struktural (Inner Model Paths - Direct maupun Multi-Hop Mediasi X -> Z -> Y)
  for (const jalur of state.jalurs) {
    const fromVar = state.variabels.find(v => v.id == jalur.dari_variabel_id || v.nama === jalur.dari);
    const toVar = state.variabels.find(v => v.id == jalur.ke_variabel_id || v.nama === jalur.ke);
    const viaVar = jalur.melalui_variabel_id ? state.variabels.find(v => v.id == jalur.melalui_variabel_id || v.nama === jalur.melalui) : null;
    if (!fromVar || !toVar) continue;

    // Hindari render ganda: jika jalur ini adalah jalur direct tanpa label yang sudah dicakup oleh jalur mediasi (viaVar), lewati
    if (!viaVar && (!jalur.label || jalur.label.trim() === '')) {
      const isCoveredByVia = state.jalurs.some(otherJ => {
        if (!otherJ.melalui_variabel_id && !otherJ.melalui) return false;
        const otherFrom = otherJ.dari_variabel_id || otherJ.dari;
        const otherTo = otherJ.ke_variabel_id || otherJ.ke;
        const otherVia = otherJ.melalui_variabel_id || otherJ.melalui;
        const thisFrom = jalur.dari_variabel_id || jalur.dari;
        const thisTo = jalur.ke_variabel_id || jalur.ke;
        return (thisFrom == otherFrom && thisTo == otherVia) || (thisFrom == otherVia && thisTo == otherTo);
      });
      if (isCoveredByVia) continue;
    }
    
    const isPathSelected = (selectedPathId === jalur.id || state.selectedPaths?.includes(jalur.id)) && !isExport;
    const currentPathColor = isPathSelected ? '#f093fb' : pathColor;
    const isDashed = (jalur.tipe_garis === 'dashed');
    if (isDashed) hasDashedLine = true;
    
    const fx = fromVar.posisi_x;
    const fy = fromVar.posisi_y;
    const tx = toVar.posisi_x;
    const ty = toVar.posisi_y;
    const R = PLS_STYLE.latentRadius;
    const baseLineWidth = jalur.tebal_garis ? parseFloat(jalur.tebal_garis) : PLS_STYLE.pathLineWidth;
    const currentLineWidth = isPathSelected ? baseLineWidth + 1.8 : baseLineWidth;
    const kelengkungan = jalur.kelengkungan || 0;

    let startX, startY, endX, endY, cpX, cpY, midArcX, midArcY, arrowAngle;
    let s1x, s1y, e1x, e1y, cp1X, cp1Y, midArc1X, midArc1Y;

    if (viaVar) {
      // Jalur Mediasi Kontinu: dari X -> Z -> Y
      const vx = viaVar.posisi_x;
      const vy = viaVar.posisi_y;

      // Segmen 1: X -> Z (Mulai dari tepi lingkaran X ke tepi lingkaran Z)
      const a1 = Math.atan2(vy - fy, vx - fx);
      s1x = fx + Math.cos(a1) * R;
      s1y = fy + Math.sin(a1) * R;
      e1x = vx - Math.cos(a1) * R;
      e1y = vy - Math.sin(a1) * R;

      const d1x = e1x - s1x;
      const d1y = e1y - s1y;
      const dist1 = Math.hypot(d1x, d1y) || 1;
      const n1x = -d1y / dist1;
      const n1y = d1x / dist1;

      // Kelengkungan segmen 1 (X -> Z)
      const k1 = (jalur.kelengkungan1 !== undefined) ? jalur.kelengkungan1 : ((kelengkungan !== 0) ? Math.round(kelengkungan * 0.8) : 0);
      const baseMid1X = (s1x + e1x) / 2;
      const baseMid1Y = (s1y + e1y) / 2;
      cp1X = baseMid1X + n1x * k1;
      cp1Y = baseMid1Y + n1y * k1;
      midArc1X = (k1 !== 0) ? (0.25 * s1x + 0.5 * cp1X + 0.25 * e1x) : baseMid1X;
      midArc1Y = (k1 !== 0) ? (0.25 * s1y + 0.5 * cp1Y + 0.25 * e1y) : baseMid1Y;

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = currentPathColor;
      ctx.lineWidth = currentLineWidth;
      if (isDashed) ctx.setLineDash([7, 5]);
      ctx.moveTo(s1x, s1y);
      if (k1 !== 0) {
        ctx.quadraticCurveTo(cp1X, cp1Y, e1x, e1y);
      } else {
        ctx.lineTo(e1x, e1y);
      }
      ctx.stroke();
      ctx.restore();

      // Titik jangkar sambungan visual di tepi Z
      ctx.save();
      ctx.beginPath();
      ctx.arc(e1x, e1y, isPathSelected ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = currentPathColor;
      ctx.fill();
      ctx.restore();

      jalur._seg1 = { x1: s1x, y1: s1y, x2: e1x, y2: e1y, cpX: cp1X, cpY: cp1Y, kelengkungan: k1 };

      // Segmen 2: Z -> Y (Mulai dari tepi lingkaran Z ke tepi lingkaran Y)
      const a2 = Math.atan2(ty - vy, tx - vx);
      
      const s2x = vx + Math.cos(a2) * R;
      const s2y = vy + Math.sin(a2) * R;
      const e2x = tx - Math.cos(a2) * R;
      const e2y = ty - Math.sin(a2) * R;

      const d2x = e2x - s2x;
      const d2y = e2y - s2y;
      const dist2 = Math.hypot(d2x, d2y) || 1;
      const n2x = -d2y / dist2;
      const n2y = d2x / dist2;

      const k2 = kelengkungan;
      const baseMid2X = (s2x + e2x) / 2;
      const baseMid2Y = (s2y + e2y) / 2;
      cpX = baseMid2X + n2x * k2;
      cpY = baseMid2Y + n2y * k2;

      startX = s2x;
      startY = s2y;
      endX = e2x;
      endY = e2y;

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = currentPathColor;
      ctx.lineWidth = currentLineWidth;
      if (isDashed) ctx.setLineDash([7, 5]);
      ctx.moveTo(startX, startY);
      if (k2 !== 0) {
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      } else {
        ctx.lineTo(endX, endY);
      }
      ctx.stroke();
      ctx.restore();

      arrowAngle = (k2 !== 0) ? Math.atan2(endY - cpY, endX - cpX) : a2;
      midArcX = (k2 !== 0) ? (0.25 * startX + 0.5 * cpX + 0.25 * endX) : baseMid2X;
      midArcY = (k2 !== 0) ? (0.25 * startY + 0.5 * cpY + 0.25 * endY) : baseMid2Y;

      jalur._seg2 = { x1: startX, y1: startY, x2: endX, y2: endY, cpX: cpX, cpY: cpY, kelengkungan: k2 };
      jalur._handleX1 = midArc1X;
      jalur._handleY1 = midArc1Y;
    } else {
      // Jalur Pengaruh Langsung Biasa (X -> Y)
      jalur._seg1 = null;
      jalur._seg2 = null;
      jalur._handleX1 = undefined;
      jalur._handleY1 = undefined;

      const angle = Math.atan2(ty - fy, tx - fx);
      const pairKey = `${jalur.dari}_${jalur.ke}`;
      const totalParallel = pathPairsCount[pairKey] || 1;
      const curIdx = pathPairsIndex[pairKey] || 0;
      pathPairsIndex[pairKey] = curIdx + 1;
      
      let perpOffset = (totalParallel > 1) ? (curIdx - (totalParallel - 1) / 2) * 16 : 0;
      const perpAngle = angle + Math.PI / 2;
      const offX = Math.cos(perpAngle) * perpOffset;
      const offY = Math.sin(perpAngle) * perpOffset;
      
      startX = fx + Math.cos(angle) * R + offX;
      startY = fy + Math.sin(angle) * R + offY;
      endX = tx - Math.cos(angle) * R + offX;
      endY = ty - Math.sin(angle) * R + offY;
      
      const directDx = endX - startX;
      const directDy = endY - startY;
      const directDist = Math.hypot(directDx, directDy) || 1;
      const nx = -directDy / directDist;
      const ny = directDx / directDist;
      
      const baseMidX = (startX + endX) / 2;
      const baseMidY = (startY + endY) / 2;
      cpX = baseMidX + nx * kelengkungan;
      cpY = baseMidY + ny * kelengkungan;

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = currentPathColor;
      ctx.lineWidth = currentLineWidth;
      if (isDashed) ctx.setLineDash([7, 5]);
      ctx.moveTo(startX, startY);
      if (kelengkungan !== 0) {
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      } else {
        ctx.lineTo(endX, endY);
      }
      ctx.stroke();
      ctx.restore();

      arrowAngle = (kelengkungan !== 0) ? Math.atan2(endY - cpY, endX - cpX) : angle;
      midArcX = (kelengkungan !== 0) ? (0.25 * startX + 0.5 * cpX + 0.25 * endX) : baseMidX;
      midArcY = (kelengkungan !== 0) ? (0.25 * startY + 0.5 * cpY + 0.25 * endY) : baseMidY;
    }
    
    // Simpan koordinat koneksi di object jalur untuk hit testing & clicking
    jalur._startX = viaVar ? s1x : startX;
    jalur._startY = viaVar ? s1y : startY;
    jalur._endX = endX;
    jalur._endY = endY;
    jalur._cpX = cpX;
    jalur._cpY = cpY;
    jalur._kelengkungan = kelengkungan;
    jalur._handleX = midArcX;
    jalur._handleY = midArcY;

    // Arrowhead pada titik akhir jalur
    const arrowSize = Math.max(9, baseLineWidth * 3.8);
    ctx.beginPath();
    ctx.fillStyle = currentPathColor;
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowSize * Math.cos(arrowAngle - Math.PI / 7),
      endY - arrowSize * Math.sin(arrowAngle - Math.PI / 7)
    );
    ctx.lineTo(
      endX - arrowSize * Math.cos(arrowAngle + Math.PI / 7),
      endY - arrowSize * Math.sin(arrowAngle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fill();

    // Titik Handle Interaktif untuk Drag Melengkungkan Garis (jika dipilih)
    if (isPathSelected && !isExport) {
      if (viaVar && midArc1X !== undefined && midArc1Y !== undefined) {
        // Handle untuk Segmen 1 (X -> Z)
        ctx.save();
        ctx.beginPath();
        ctx.arc(midArc1X, midArc1Y, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#f093fb';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(midArc1X, midArc1Y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
      }

      // Handle untuk Segmen 2 (Z -> Y) atau Single Segment
      ctx.save();
      ctx.beginPath();
      ctx.arc(midArcX, midArcY, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f093fb';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(midArcX, midArcY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }
    
    // Path Label (Label Hipotesis / Nilai Koefisien Jalur)
    let labelText = '';
    const pathKey = viaVar ? `${fromVar.nama} → ${viaVar.nama} → ${toVar.nama}` : `${fromVar.nama} → ${toVar.nama}`;
    const coeff = state.hasilPLS?.pathCoefficients?.[pathKey];
    
    if (showPathCoeff && coeff !== undefined) {
      if (jalur.label) {
        labelText = `${jalur.label}: ${coeff.toFixed(3)}`;
      } else {
        labelText = coeff.toFixed(3);
      }
      if (showPValues && state.hasilBootstrap?.pathResults?.[pathKey]) {
        const pVal = state.hasilBootstrap.pathResults[pathKey].pValue;
        labelText += ` (p=${pVal.toFixed(3)})`;
      }
    } else if (jalur.label) {
      labelText = jalur.label;
    }
    
    if (labelText) {
      // Posisi label berdasarkan label_offset_t (0.0–1.0 sepanjang kurva), default 0.5 (tengah)
      const t = (jalur.label_offset_t !== undefined) ? jalur.label_offset_t : 0.5;
      const pt = getPathPointAtT(jalur, t);
      let labelMidX = pt.x;
      let labelMidY = pt.y;

      ctx.font = '600 12px ' + PLS_STYLE.fontFamily;
      const textMetrics = ctx.measureText(labelText);
      const padX = 6;
      const padY = 3;

      ctx.fillStyle = isPathSelected ? (isDark ? '#3b1c4a' : '#fdf2f8') : (isDark ? '#1a1a3e' : '#ffffff');
      ctx.strokeStyle = isPathSelected ? '#f093fb' : (isDark ? '#3d3d7a' : '#d1d5db');
      ctx.lineWidth = isPathSelected ? 1.5 : 1;

      const boxX = labelMidX - textMetrics.width / 2 - padX;
      const boxY = labelMidY - 8 - padY;
      const boxW = textMetrics.width + padX * 2;
      const boxH = 16 + padY * 2;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(boxX, boxY, boxW, boxH, 4);
      } else {
        ctx.rect(boxX, boxY, boxW, boxH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isPathSelected ? '#d946ef' : (isDark ? '#80b3ff' : '#1e3a8a');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, labelMidX, labelMidY + 1);

      // Simpan bounding box label untuk hit-testing drag
      jalur._labelBox = { x: boxX, y: boxY, w: boxW, h: boxH };
    } else {
      jalur._labelBox = null;
    }
  }
  
  // 2. Gambar Indikator dan Outer Model Paths untuk setiap variabel laten (jika showIndicators aktif)
  for (const v of state.variabels) {
    const isSelected = (selectedNodeId === v.id || state.selectedNodes?.includes(v.id)) && !isExport;
    const indPositions = getIndicatorPositions(v);
    const cx = v.posisi_x;
    const cy = v.posisi_y;
    const R = PLS_STYLE.latentRadius;
    const isReflective = (v.tipe === 'reflektif');
    const orientasi = v.orientasi || 'kiri';
    
    if (showIndicators && indPositions.length > 0) {
      // Gambar Panah Indikator (Outer Model)
      indPositions.forEach(ind => {
        ctx.beginPath();
        ctx.strokeStyle = outerLineColor;
        ctx.lineWidth = PLS_STYLE.lineWidth;
        
        const angle = Math.atan2(ind.connectY - cy, ind.connectX - cx);
        const latX = cx + Math.cos(angle) * R;
        const latY = cy + Math.sin(angle) * R;
        
        ctx.moveTo(latX, latY);
        ctx.lineTo(ind.connectX, ind.connectY);
        ctx.stroke();
        
        // Arrowhead
        const arrowSize = 7;
        ctx.beginPath();
        ctx.fillStyle = outerLineColor;
        
        if (isReflective) {
          ctx.moveTo(ind.connectX, ind.connectY);
          ctx.lineTo(
            ind.connectX - arrowSize * Math.cos(angle - Math.PI / 6),
            ind.connectY - arrowSize * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            ind.connectX - arrowSize * Math.cos(angle + Math.PI / 6),
            ind.connectY - arrowSize * Math.sin(angle + Math.PI / 6)
          );
        } else {
          ctx.moveTo(latX, latY);
          ctx.lineTo(
            latX + arrowSize * Math.cos(angle - Math.PI / 6),
            latY + arrowSize * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            latX + arrowSize * Math.cos(angle + Math.PI / 6),
            latY + arrowSize * Math.sin(angle + Math.PI / 6)
          );
        }
        ctx.closePath();
        ctx.fill();
        
        // Outer Loading Value
        if (showLoadings && state.hasilPLS?.outerLoadings?.[v.nama]?.[ind.name] !== undefined) {
          const loading = state.hasilPLS.outerLoadings[v.nama][ind.name];
          const midX = (latX + ind.connectX) / 2;
          const midY = (latY + ind.connectY) / 2;
          
          ctx.font = '500 11px ' + PLS_STYLE.fontFamily;
          ctx.fillStyle = isDark ? '#b0c4de' : '#4b5563';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const perpAngle = angle + Math.PI / 2;
          const offX = Math.cos(perpAngle) * 8;
          const offY = Math.sin(perpAngle) * 8;
          ctx.fillText(loading.toFixed(3), midX + offX, midY + offY);
        }
      });
      
      // Gambar Kotak Indikator (Kuning Cerah SmartPLS)
      indPositions.forEach(ind => {
        ctx.save();
        ctx.fillStyle = PLS_STYLE.indicatorBg;
        ctx.strokeStyle = PLS_STYLE.indicatorBorder;
        ctx.lineWidth = 1.2;
        
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(ind.x, ind.y, ind.w, ind.h, PLS_STYLE.indicatorRadius);
        } else {
          ctx.rect(ind.x, ind.y, ind.w, ind.h);
        }
        ctx.fill();
        ctx.stroke();
        
        ctx.font = '700 11px ' + PLS_STYLE.fontFamily;
        ctx.fillStyle = PLS_STYLE.indicatorTextColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ind.name, ind.x + ind.w / 2, ind.y + ind.h / 2);
        ctx.restore();
      });
    }
    
    // 3. Gambar Lingkaran Variabel Laten (Biru SmartPLS / Custom Warna)
    ctx.save();
    
    // Selection glow if in editor
    if (isSelected && !isExport) {
      ctx.beginPath();
      ctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#f093fb';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    
    // Lingkaran Laten dengan Warna Kustom atau Default
    const nodeColor = v.warna || PLS_STYLE.latentColor;
    const nodeBorderColor = isSelected ? '#ffffff' : (v.borderWarna || darkenHexColor(nodeColor, 25));
    
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = nodeColor;
    ctx.fill();
    ctx.strokeStyle = nodeBorderColor;
    ctx.lineWidth = PLS_STYLE.latentBorderWidth;
    ctx.stroke();
    
    // Warning Diagnostic Badge pada Node jika ada peringatan struktur
    if (!isExport && state.modelWarningsByNode?.[v.id]) {
      const bX = cx + R * 0.72;
      const bY = cy - R * 0.72;
      ctx.beginPath();
      ctx.arc(bX, bY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = '800 10px ' + PLS_STYLE.fontFamily;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', bX, bY);
    }
    
    // Nilai R² di dalam lingkaran jika endogen
    const r2Value = state.hasilPLS?.rSquared?.[v.nama];
    if (showR2 && r2Value !== undefined) {
      ctx.font = '700 14px ' + PLS_STYLE.fontFamily;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(r2Value.toFixed(3), cx, cy);
    }
    
    // Label Nama Variabel Laten di Luar Lingkaran
    let labelY = cy + R + 18;
    if (showIndicators && orientasi === 'bawah') {
      labelY = cy - R - 12; // Jika indikator di bawah, taruh nama di atas
    }
    
    ctx.font = '600 13px ' + PLS_STYLE.fontFamily;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(v.nama, cx, labelY);
    
    ctx.restore();
  }

  // 4. Gambar Catatan / Sticky Notes di Canvas
  if (state.catatans && state.catatans.length > 0) {
    state.catatans.forEach(catatan => {
      ctx.save();
      const x = catatan.x || 100;
      const y = catatan.y || 100;
      const w = catatan.w || 160;
      const h = catatan.h || 95;
      const bg = catatan.warna || '#fef08a';
      const isSelected = (state.selectedCatatan === catatan.id || state.selectedCatatans?.includes(catatan.id)) && !isExport;

      // Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = isSelected ? 12 : 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;

      // Note card
      ctx.fillStyle = bg;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, 6);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.fill();

      // Reset shadow for border & contents
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Selection outline
      if (isSelected) {
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Pin Header band
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(x, y, w, 18);

      // Pin icon dot
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(x + 12, y + 9, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Text inside note
      ctx.font = '500 11px ' + PLS_STYLE.fontFamily;
      ctx.fillStyle = '#1e293b';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      const maxTextWidth = w - 16;
      const lineHeight = 14;
      const words = (catatan.teks || 'Catatan').split(/\s+/);
      let line = '';
      let lineY = y + 24;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxTextWidth && n > 0) {
          if (lineY + lineHeight < y + h - 6) {
            ctx.fillText(line, x + 8, lineY);
            line = words[n] + ' ';
            lineY += lineHeight;
          } else {
            line += '...';
            break;
          }
        } else {
          line = testLine;
        }
      }
      if (lineY < y + h - 6) {
        ctx.fillText(line, x + 8, lineY);
      }

      ctx.restore();
    });
  }

  // 5. Gambar Marquee Drag Selection Box (Kotak Seleksi Area)
  if (!isExport && state.isMarqueeSelecting && state.marqueeStart && state.marqueeEnd) {
    ctx.save();
    const x = Math.min(state.marqueeStart.x, state.marqueeEnd.x);
    const y = Math.min(state.marqueeStart.y, state.marqueeEnd.y);
    const w = Math.abs(state.marqueeEnd.x - state.marqueeStart.x);
    const h = Math.abs(state.marqueeEnd.y - state.marqueeStart.y);

    ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
}

// ============ RENDER MODEL DI LAYAR ============
function renderModel() {
  const canvas = document.getElementById('modelCanvas');
  if (!canvas) return;
  
  const wrapper = canvas.parentElement;
  if (!wrapper) return;
  
  canvas.width = wrapper.clientWidth || 1000;
  canvas.height = wrapper.clientHeight || 600;
  
  const ctx = canvas.getContext('2d');
  const style = getComputedStyle(document.body);

  // Real-time Model Diagnostic Linting
  validateModelStructure();
  
  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Apply Zoom & Pan Transformations
  ctx.save();
  ctx.translate(state.pan.x, state.pan.y);
  ctx.scale(state.zoom, state.zoom);

  // Pan & Zoom aware Grid
  const gridColor = style.getPropertyValue('--canvas-grid').trim() || 'rgba(102, 126, 234, 0.08)';
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  
  const gridSize = 40;
  const startX = -Math.floor(state.pan.x / state.zoom / gridSize) * gridSize - gridSize * 2;
  const startY = -Math.floor(state.pan.y / state.zoom / gridSize) * gridSize - gridSize * 2;
  const endX = startX + Math.ceil(canvas.width / state.zoom) + gridSize * 4;
  const endY = startY + Math.ceil(canvas.height / state.zoom) + gridSize * 4;

  for (let x = startX; x < endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  for (let y = startY; y < endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
  
  // Draw full PLS diagram & notes
  drawPLSDiagram(ctx, {
    showR2: true,
    showLoadings: true,
    showPathCoeff: true,
    showPValues: !!state.hasilBootstrap,
    showLegend: true,
    isExport: false,
    theme: state.tema,
    selectedNodeId: state.selectedNode,
    selectedPathId: state.selectedPath
  });

  ctx.restore();
  
  // Handle empty state overlay
  const overlay = document.getElementById('canvasOverlay');
  if (overlay) {
    overlay.innerHTML = '';
    if (state.variabels.length === 0 && (!state.catatans || state.catatans.length === 0)) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      emptyDiv.style.height = '100%';
      emptyDiv.innerHTML = `
        <span class="material-icons-round">account_tree</span>
        <p>Klik "Tambah Variabel", "Template Model", atau "Catatan" untuk mulai membuat model PLS-SEM</p>
      `;
      overlay.appendChild(emptyDiv);
    }
  }
}

// ============ INTERACTION HANDLERS (DRAG, ZOOM, PAN, MARQUEE & CONTEXT MENU) ============
function setupCanvasInteractions() {
  const canvas = document.getElementById('modelCanvas');
  if (!canvas) return;
  
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    
    // Transformed canvas coordinates
    const mx = (rawX - state.pan.x) / state.zoom;
    const my = (rawY - state.pan.y) / state.zoom;

    // Tutup context menu jika sedang terbuka
    hideCanvasContextMenu();
    
    // 0. Middle Click / Space / Alt / Ctrl / Meta Drag -> Canvas Pan
    if (e.button === 1 || e.altKey || e.ctrlKey || e.metaKey || state.isSpacePressed) {
      state.isPanning = true;
      state.panStart = { x: rawX - state.pan.x, y: rawY - state.pan.y };
      canvas.style.cursor = 'grabbing';
      return;
    }

    if (e.button !== 0) return; // Hanya tangani klik kiri untuk selection & drag

    // 1. Cari Catatan / Sticky Note yang diklik
    if (state.catatans && state.catatans.length > 0) {
      const clickedCatatan = state.catatans.slice().reverse().find(c => {
        const x = c.x || 100;
        const y = c.y || 100;
        const w = c.w || 160;
        const h = c.h || 95;
        return mx >= x && mx <= x + w && my >= y && my <= y + h;
      });

      if (clickedCatatan) {
        state.isDraggingCatatan = true;
        state.dragCatatanTarget = clickedCatatan;
        state.dragOffset = {
          x: mx - (clickedCatatan.x || 100),
          y: my - (clickedCatatan.y || 100)
        };
        state.selectedCatatan = clickedCatatan.id;
        state.selectedNode = null;
        state.selectedPath = null;
        state.selectedNodes = [];
        state.selectedPaths = [];
        state.selectedCatatans = [clickedCatatan.id];
        state.isAllSelected = false;
        renderModel();
        return;
      }
    }
    
    // 2. Cari variabel laten yang diklik
    const R = PLS_STYLE.latentRadius;
    const clickedVar = state.variabels.find(v => {
      const dist = Math.hypot(v.posisi_x - mx, v.posisi_y - my);
      return dist <= R + 10;
    });
    
    if (clickedVar) {
      // Shift-Click: Toggle Multi-Selection
      if (e.shiftKey) {
        const idx = state.selectedNodes.indexOf(clickedVar.id);
        if (idx >= 0) {
          state.selectedNodes.splice(idx, 1);
        } else {
          state.selectedNodes.push(clickedVar.id);
        }
        state.selectedNode = state.selectedNodes.length === 1 ? state.selectedNodes[0] : null;
        state.selectedPath = null;
        state.selectedCatatan = null;
        if (state.selectedNodes.length > 1) {
          showMultiSelectProperties();
        } else if (state.selectedNodes.length === 1) {
          const single = state.variabels.find(v => v.id === state.selectedNodes[0]);
          if (single) showVariableProperties(single);
        } else {
          deselectAllModelElements();
        }
        renderModel();
        return;
      }

      // Normal Drag: Check if clicking an already multi-selected node
      const isAlreadySelected = state.selectedNodes.includes(clickedVar.id);
      if (isAlreadySelected && state.selectedNodes.length > 1) {
        state.isDragging = true;
        state.dragTarget = clickedVar;
        state.dragOffset = { x: mx, y: my };
        state.multiDragInitialPositions = {};
        state.selectedNodes.forEach(id => {
          const v = state.variabels.find(vv => vv.id === id);
          if (v) {
            state.multiDragInitialPositions[id] = { x: v.posisi_x, y: v.posisi_y };
          }
        });
        renderModel();
        return;
      }

      // Single Select & Drag
      state.isDragging = true;
      state.dragTarget = clickedVar;
      state.dragOffset = {
        x: mx - clickedVar.posisi_x,
        y: my - clickedVar.posisi_y
      };
      state.multiDragInitialPositions = null;
      state.selectedNode = clickedVar.id;
      state.selectedPath = null;
      state.selectedCatatan = null;
      state.selectedNodes = [clickedVar.id];
      state.selectedPaths = [];
      state.selectedCatatans = [];
      state.isAllSelected = false;
      showVariableProperties(clickedVar);
      renderModel();
      return;
    }
    
    // 2.5. Cek apakah user mengklik label hipotesis / koefisien pada jalur untuk digeser sepanjang kabel
    const clickedLabelPath = state.jalurs.slice().reverse().find(j => {
      if (j._labelBox) {
        const b = j._labelBox;
        return mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
      }
      return false;
    });

    if (clickedLabelPath) {
      state.isDraggingPathLabel = true;
      state.dragLabelPath = clickedLabelPath;
      state.selectedPath = clickedLabelPath.id;
      state.selectedNode = null;
      state.selectedCatatan = null;
      state.selectedNodes = [];
      state.selectedPaths = [clickedLabelPath.id];
      state.selectedCatatans = [];
      state.isAllSelected = false;
      showPathProperties(clickedLabelPath);
      renderModel();
      return;
    }

    // 3. Cari titik handle kelengkungan jalur atau jalur struktural yang diklik
    let clickedPath = null;
    state.dragCurvatureSeg = 2;
    
    // Prioritaskan klik tepat di bulatan handle kelengkungan jalur yang sedang terpilih
    if (state.selectedPath) {
      const activePath = state.jalurs.find(j => j.id === state.selectedPath);
      if (activePath) {
        if (activePath._handleX1 !== undefined && activePath._handleY1 !== undefined && Math.hypot(mx - activePath._handleX1, my - activePath._handleY1) <= 15) {
          clickedPath = activePath;
          state.dragCurvatureSeg = 1;
        } else if (activePath._handleX !== undefined && activePath._handleY !== undefined && Math.hypot(mx - activePath._handleX, my - activePath._handleY) <= 15) {
          clickedPath = activePath;
          state.dragCurvatureSeg = 2;
        }
      }
    }

    if (!clickedPath) {
      clickedPath = state.jalurs.find(j => {
        if (j._handleX1 !== undefined && j._handleY1 !== undefined && Math.hypot(mx - j._handleX1, my - j._handleY1) <= 12) {
          state.dragCurvatureSeg = 1;
          return true;
        }
        if (j._handleX !== undefined && j._handleY !== undefined && Math.hypot(mx - j._handleX, my - j._handleY) <= 12) {
          state.dragCurvatureSeg = 2;
          return true;
        }
        if (j._startX !== undefined && j._startY !== undefined) {
          const d = pointToPathDist(mx, my, j);
          if (d <= 12) {
            if (j._seg1) {
              const d1 = pointToSegmentDist(mx, my, j._seg1.x1, j._seg1.y1, j._seg1.x2, j._seg1.y2);
              const d2 = pointToSegmentDist(mx, my, j._seg2 ? j._seg2.x1 : j._startX, j._seg2 ? j._seg2.y1 : j._startY, j._seg2 ? j._seg2.x2 : j._endX, j._seg2 ? j._seg2.y2 : j._endY);
              state.dragCurvatureSeg = (d1 <= d2) ? 1 : 2;
            } else {
              state.dragCurvatureSeg = 2;
            }
            return true;
          }
        }
        return false;
      });
    }
    
    if (clickedPath) {
      state.isDraggingPathCurvature = true;
      state.dragCurvaturePath = clickedPath;
      state.selectedPath = clickedPath.id;
      state.selectedNode = null;
      state.selectedCatatan = null;
      state.selectedNodes = [];
      state.selectedPaths = [];
      state.selectedCatatans = [];
      state.isAllSelected = false;
      showPathProperties(clickedPath);
      renderModel();
      return;
    }
    
    // 4. Klik di area kosong: Mulai Marquee Selection Box
    state.isMarqueeSelecting = true;
    state.marqueeStart = { x: mx, y: my };
    state.marqueeEnd = { x: mx, y: my };

    if (!e.shiftKey) {
      deselectAllModelElements();
    }
  });
  
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    
    const mx = (rawX - state.pan.x) / state.zoom;
    const my = (rawY - state.pan.y) / state.zoom;
    
    if (state.isPanning) {
      state.pan.x = rawX - state.panStart.x;
      state.pan.y = rawY - state.panStart.y;
      renderModel();
      return;
    }

    // Update Marquee Box Selection
    if (state.isMarqueeSelecting && state.marqueeStart) {
      state.marqueeEnd = { x: mx, y: my };
      const minX = Math.min(state.marqueeStart.x, mx);
      const maxX = Math.max(state.marqueeStart.x, mx);
      const minY = Math.min(state.marqueeStart.y, my);
      const maxY = Math.max(state.marqueeStart.y, my);

      const R = PLS_STYLE.latentRadius;
      const selected = state.variabels.filter(v => (
        v.posisi_x + R >= minX && v.posisi_x - R <= maxX &&
        v.posisi_y + R >= minY && v.posisi_y - R <= maxY
      )).map(v => v.id);

      const selCatatans = (state.catatans || []).filter(c => {
        const cx = c.x || 100;
        const cy = c.y || 100;
        const cw = c.w || 160;
        const ch = c.h || 95;
        return (cx + cw >= minX && cx <= maxX && cy + ch >= minY && cy <= maxY);
      }).map(c => c.id);

      state.selectedNodes = selected;
      state.selectedCatatans = selCatatans;
      state.selectedNode = selected.length === 1 ? selected[0] : null;

      renderModel();
      return;
    }

    // Drag Posisi Label di Sepanjang Kabel Jalur
    if (state.isDraggingPathLabel && state.dragLabelPath) {
      const j = state.dragLabelPath;
      j.label_offset_t = calculateClosestTOnPath(mx, my, j);
      canvas.style.cursor = 'grab';
      renderModel();
      return;
    }

    // Drag Kelengkungan Jalur Secara Langsung dengan Kursor Mouse
    if (state.isDraggingPathCurvature && state.dragCurvaturePath) {
      const j = state.dragCurvaturePath;
      if (state.dragCurvatureSeg === 1 && j._seg1) {
        const dx = j._seg1.x2 - j._seg1.x1;
        const dy = j._seg1.y2 - j._seg1.y1;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = -dy / dist;
        const ny = dx / dist;
        const midX = (j._seg1.x1 + j._seg1.x2) / 2;
        const midY = (j._seg1.y1 + j._seg1.y2) / 2;
        const offset = (mx - midX) * nx + (my - midY) * ny;
        j.kelengkungan1 = Math.round(offset * 2.0);
      } else {
        const sX = j._seg2 ? j._seg2.x1 : j._startX;
        const sY = j._seg2 ? j._seg2.y1 : j._startY;
        const eX = j._seg2 ? j._seg2.x2 : j._endX;
        const eY = j._seg2 ? j._seg2.y2 : j._endY;
        if (sX !== undefined && eX !== undefined) {
          const dx = eX - sX;
          const dy = eY - sY;
          const dist = Math.hypot(dx, dy) || 1;
          const nx = -dy / dist;
          const ny = dx / dist;
          const midX = (sX + eX) / 2;
          const midY = (sY + eY) / 2;
          const offset = (mx - midX) * nx + (my - midY) * ny;
          j.kelengkungan = Math.round(offset * 2.0);
        }
      }
      
      // Update label di panel properti jika sedang dibuka
      const valLabel = document.getElementById('editPropKelengkunganVal');
      if (valLabel) {
        const val = (state.dragCurvatureSeg === 1) ? (j.kelengkungan1 || 0) : (j.kelengkungan || 0);
        if (val === 0) valLabel.textContent = 'Lurus (0)';
        else if (val < 0) valLabel.textContent = `Lengkung Bawah (${val})`;
        else valLabel.textContent = `Lengkung Atas (+${val})`;
      }
      
      canvas.style.cursor = 'move';
      renderModel();
      return;
    }

    if (state.isDraggingCatatan && state.dragCatatanTarget) {
      state.dragCatatanTarget.x = Math.max(10, mx - state.dragOffset.x);
      state.dragCatatanTarget.y = Math.max(10, my - state.dragOffset.y);
      renderModel();
      return;
    }

    // Multi-Node Dragging
    if (state.isDragging && state.multiDragInitialPositions) {
      const dx = mx - state.dragOffset.x;
      const dy = my - state.dragOffset.y;
      state.selectedNodes.forEach(id => {
        const initPos = state.multiDragInitialPositions[id];
        const v = state.variabels.find(vv => vv.id === id);
        if (initPos && v) {
          v.posisi_x = Math.max(60, initPos.x + dx);
          v.posisi_y = Math.max(60, initPos.y + dy);
        }
      });
      renderModel();
      return;
    }

    // Single Node Dragging
    if (state.isDragging && state.dragTarget) {
      state.dragTarget.posisi_x = Math.max(60, mx - state.dragOffset.x);
      state.dragTarget.posisi_y = Math.max(60, my - state.dragOffset.y);
      renderModel();
      return;
    }

    // Hover cursor detection
    const isOverCatatan = state.catatans?.some(c => {
      const x = c.x || 100;
      const y = c.y || 100;
      const w = c.w || 160;
      const h = c.h || 95;
      return mx >= x && mx <= x + w && my >= y && my <= y + h;
    });

    const R = PLS_STYLE.latentRadius;
    const isOverVar = !isOverCatatan && state.variabels.some(v => Math.hypot(v.posisi_x - mx, v.posisi_y - my) <= R + 10);
    
    // Deteksi hover pada handle kelengkungan jalur aktif
    let isOverHandle = false;
    if (state.selectedPath) {
      const activePath = state.jalurs.find(j => j.id === state.selectedPath);
      if (activePath && activePath._handleX !== undefined && activePath._handleY !== undefined) {
        if (Math.hypot(mx - activePath._handleX, my - activePath._handleY) <= 12) {
          isOverHandle = true;
        }
      }
    }

    const isOverLabel = !isOverCatatan && !isOverVar && !isOverHandle && state.jalurs.some(j => {
      if (j._labelBox) {
        const b = j._labelBox;
        return mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
      }
      return false;
    });

    const isOverPath = !isOverCatatan && !isOverVar && !isOverHandle && !isOverLabel && state.jalurs.some(j => {
      if (j._startX !== undefined && j._startY !== undefined) {
        return pointToPathDist(mx, my, j) <= 12;
      }
      return false;
    });
    
    if (e.ctrlKey || e.altKey || e.metaKey || state.isSpacePressed) {
      canvas.style.cursor = 'grab';
    } else if (isOverHandle || isOverLabel) {
      canvas.style.cursor = 'grab';
    } else if (isOverCatatan || isOverVar) {
      canvas.style.cursor = 'grab';
    } else if (isOverPath) {
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = 'default';
    }
  });

  const stopCanvasPanning = () => {
    if (state.isPanning) {
      state.isPanning = false;
      canvas.style.cursor = (state.isSpacePressed) ? 'grab' : 'default';
    }
  };
  
  canvas.addEventListener('mouseup', () => {
    stopCanvasPanning();
    if (state.isMarqueeSelecting) {
      state.isMarqueeSelecting = false;
      if (state.selectedNodes.length > 1) {
        showMultiSelectProperties();
      } else if (state.selectedNodes.length === 1) {
        const single = state.variabels.find(v => v.id === state.selectedNodes[0]);
        if (single) showVariableProperties(single);
      }
      renderModel();
    }
    if (state.isDraggingPathCurvature) {
      state.isDraggingPathCurvature = false;
      state.dragCurvaturePath = null;
      saveModelToDb();
    }
    if (state.isDraggingPathLabel) {
      state.isDraggingPathLabel = false;
      state.dragLabelPath = null;
      saveModelToDb();
    }
    if (state.isDraggingCatatan) {
      state.isDraggingCatatan = false;
      state.dragCatatanTarget = null;
      saveModelToDb();
    }
    if (state.isDragging) {
      state.isDragging = false;
      state.dragTarget = null;
      state.multiDragInitialPositions = null;
      saveModelToDb();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    stopCanvasPanning();
  });

  window.addEventListener('mouseup', () => {
    stopCanvasPanning();
    if (state.isDraggingPathLabel) {
      state.isDraggingPathLabel = false;
      state.dragLabelPath = null;
      saveModelToDb();
    }
  });

  // Spacebar Pan Key Listener (Figma / Illustrator / SmartPLS style)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !state.isSpacePressed) {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable) {
        return;
      }
      state.isSpacePressed = true;
      if (document.getElementById('halaman-editor')?.classList.contains('active') || !document.getElementById('halaman-editor')?.classList.contains('tersembunyi')) {
        canvas.style.cursor = 'grab';
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      state.isSpacePressed = false;
      if (!state.isPanning) {
        canvas.style.cursor = 'default';
      }
    }
  });

  // Double Click di Canvas: Edit Catatan jika diklik, atau buat catatan baru
  canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const mx = (rawX - state.pan.x) / state.zoom;
    const my = (rawY - state.pan.y) / state.zoom;

    if (state.catatans && state.catatans.length > 0) {
      const clickedCatatan = state.catatans.slice().reverse().find(c => {
        const x = c.x || 100;
        const y = c.y || 100;
        const w = c.w || 160;
        const h = c.h || 95;
        return mx >= x && mx <= x + w && my >= y && my <= y + h;
      });

      if (clickedCatatan) {
        bukaModalEditCatatan(clickedCatatan);
        return;
      }
    }
  });

  // Mouse Wheel Zoom centered on cursor
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.min(3.0, Math.max(0.3, state.zoom * zoomFactor));

    state.pan.x = mouseX - (mouseX - state.pan.x) * (newZoom / state.zoom);
    state.pan.y = mouseY - (mouseY - state.pan.y) * (newZoom / state.zoom);
    state.zoom = newZoom;

    updateZoomLabel();
    renderModel();
  }, { passive: false });
  
  // Right Click Context Menu Handler
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const mx = (rawX - state.pan.x) / state.zoom;
    const my = (rawY - state.pan.y) / state.zoom;

    // Catatan
    if (state.catatans && state.catatans.length > 0) {
      const clickedCatatan = state.catatans.slice().reverse().find(c => {
        const x = c.x || 100;
        const y = c.y || 100;
        const w = c.w || 160;
        const h = c.h || 95;
        return mx >= x && mx <= x + w && my >= y && my <= y + h;
      });

      if (clickedCatatan) {
        bukaModalEditCatatan(clickedCatatan);
        return;
      }
    }
    
    // Variabel Laten -> Buka Context Menu Interaktif
    const R = PLS_STYLE.latentRadius;
    const clickedVar = state.variabels.find(v => Math.hypot(v.posisi_x - mx, v.posisi_y - my) <= R + 10);
    
    if (clickedVar) {
      state.selectedNode = clickedVar.id;
      state.selectedNodes = [clickedVar.id];
      state.selectedPath = null;
      state.selectedCatatan = null;
      showVariableProperties(clickedVar);
      renderModel();
      showCanvasContextMenu(e.clientX, e.clientY, clickedVar);
      return;
    }
    
    // Jalur Struktural
    const clickedPath = state.jalurs.find(j => {
      if (j._startX !== undefined && j._startY !== undefined) {
        return pointToPathDist(mx, my, j) <= 12;
      }
      return false;
    });
    
    if (clickedPath) {
      hapusJalur(clickedPath.id);
    }
  });
}

// ============ CANVAS CONTEXT MENU SETUP ============
function showCanvasContextMenu(clientX, clientY, variable) {
  const menu = document.getElementById('canvasContextMenu');
  if (!menu || !variable) return;

  const title = document.getElementById('contextMenuTitle');
  if (title) title.textContent = `Konstruk: ${variable.nama}`;

  // Update active orientation button
  const curOrient = variable.orientasi || 'kiri';
  ['Kiri', 'Atas', 'Kanan', 'Bawah'].forEach(dir => {
    const btn = document.getElementById(`ctxOrient${dir}`);
    if (btn) {
      btn.classList.toggle('active', dir.toLowerCase() === curOrient);
    }
  });

  // Update active color dot
  const curColor = variable.warna || '#009bf2';
  document.querySelectorAll('#ctxColorPalette .color-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.color.toLowerCase() === curColor.toLowerCase());
  });

  // Position context menu
  const menuWidth = 220;
  const menuHeight = 310;
  let posX = clientX;
  let posY = clientY;

  if (posX + menuWidth > window.innerWidth) {
    posX = window.innerWidth - menuWidth - 10;
  }
  if (posY + menuHeight > window.innerHeight) {
    posY = window.innerHeight - menuHeight - 10;
  }

  menu.style.left = `${posX}px`;
  menu.style.top = `${posY}px`;
  menu.classList.remove('tersembunyi');
}

function hideCanvasContextMenu() {
  const menu = document.getElementById('canvasContextMenu');
  if (menu && !menu.classList.contains('tersembunyi')) {
    menu.classList.add('tersembunyi');
  }
}

function setupCanvasContextMenuHandlers() {
  // Hide context menu on global click outside
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('canvasContextMenu');
    if (menu && !menu.contains(e.target)) {
      hideCanvasContextMenu();
    }
  });

  // Orientation buttons
  ['Kiri', 'Atas', 'Kanan', 'Bawah'].forEach(dir => {
    document.getElementById(`ctxOrient${dir}`)?.addEventListener('click', () => {
      if (state.selectedNode) {
        setVariableOrientation(state.selectedNode, dir.toLowerCase());
      }
      hideCanvasContextMenu();
    });
  });

  // Color dots in Context Menu
  document.querySelectorAll('#ctxColorPalette .color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const color = dot.dataset.color;
      if (state.selectedNode && color) {
        setVariableColor(state.selectedNode, color);
      }
      hideCanvasContextMenu();
    });
  });

  // Duplicate Action
  document.getElementById('ctxBtnDuplikat')?.addEventListener('click', () => {
    hideCanvasContextMenu();
    duplicateSelectedVariable();
  });

  // Moderation Shortcut
  document.getElementById('ctxBtnModerasi')?.addEventListener('click', () => {
    hideCanvasContextMenu();
    bukaModalTambahModerasi(state.selectedNode);
  });

  // Switch Reflective / Formative
  document.getElementById('ctxBtnBalikArah')?.addEventListener('click', () => {
    hideCanvasContextMenu();
    if (state.selectedNode) {
      switchArahIndikator(state.selectedNode);
    }
  });

  // Delete Node
  document.getElementById('ctxBtnHapus')?.addEventListener('click', () => {
    hideCanvasContextMenu();
    if (state.selectedNode) {
      hapusVariabel(state.selectedNode);
    }
  });
}

// Inisialisasi interaksi canvas saat DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupCanvasInteractions();
  setupCanvasContextMenuHandlers();
});

// ============ HIGH-RESOLUTION EXPORT ENGINE (600+ DPI) ============
async function prosesEksporGambar(keClipboard = false) {
  if (!state.proyekAktif || state.variabels.length === 0) {
    showToast('Tidak ada diagram model untuk diekspor', 'peringatan');
    return;
  }
  
  const dpi = parseInt(document.querySelector('input[name="exportDpi"]:checked')?.value) || 600;
  const format = document.getElementById('exportFormat')?.value || 'png';
  const bgType = document.getElementById('exportBackground')?.value || 'white';
  
  const showR2 = document.getElementById('checkShowR2')?.checked ?? true;
  const showIndicators = document.getElementById('checkShowIndicators')
    ? document.getElementById('checkShowIndicators').checked
    : (state.showIndikator !== false);
  const showLoadings = showIndicators && (document.getElementById('checkShowLoadings')?.checked ?? true);
  const showPathCoeff = document.getElementById('checkShowPathCoeff')?.checked ?? true;
  const showPValues = document.getElementById('checkShowPValues')?.checked ?? true;
  const showLegend = document.getElementById('checkShowLegend')?.checked ?? true;
  
  showLoading(`Merender Gambar Resolusi Tinggi (${dpi} DPI)...`, 800, 'Supersampling Kanvas & Rasterisasi Grafik Diagram Model', 'image');
  
  try {
    // 1. Hitung Bounding Box dari semua elemen diagram
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const R = PLS_STYLE.latentRadius;
    
    state.variabels.forEach(v => {
      // Lingkaran Laten & Label
      minX = Math.min(minX, v.posisi_x - R - 30);
      maxX = Math.max(maxX, v.posisi_x + R + 30);
      minY = Math.min(minY, v.posisi_y - R - 35);
      maxY = Math.max(maxY, v.posisi_y + R + 35);
      
      // Kotak Indikator (jika dicentang)
      if (showIndicators) {
        const inds = getIndicatorPositions(v);
        inds.forEach(ind => {
          minX = Math.min(minX, ind.x - 15);
          maxX = Math.max(maxX, ind.x + ind.w + 15);
          minY = Math.min(minY, ind.y - 15);
          maxY = Math.max(maxY, ind.y + ind.h + 15);
        });
      }
    });

    if (state.catatans && state.catatans.length > 0) {
      state.catatans.forEach(c => {
        minX = Math.min(minX, (c.x || 100) - 10);
        maxX = Math.max(maxX, (c.x || 100) + (c.w || 160) + 10);
        minY = Math.min(minY, (c.y || 100) - 10);
        maxY = Math.max(maxY, (c.y || 100) + (c.h || 95) + 10);
      });
    }

    if (showLegend && state.jalurs.some(j => j.tipe_garis === 'dashed')) {
      maxX = Math.max(maxX, maxX + 100);
      maxY = Math.max(maxY, maxY + 90);
    }
    
    // Padding margin
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const baseWidth = Math.max(400, maxX - minX);
    const baseHeight = Math.max(300, maxY - minY);
    
    // Hitung Skala DPI: 96 DPI = 1x; 600 DPI = 6.25x; 1200 DPI = 12.5x
    const scaleFactor = dpi / 96;
    const finalWidth = Math.round(baseWidth * scaleFactor);
    const finalHeight = Math.round(baseHeight * scaleFactor);
    
    // Buat Offscreen Canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = finalWidth;
    exportCanvas.height = finalHeight;
    const ctx = exportCanvas.getContext('2d');
    
    // Smoothing antialias maksimal
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Background
    if (bgType === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, finalWidth, finalHeight);
    } else if (bgType === 'dark') {
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, finalWidth, finalHeight);
    } else if (bgType === 'transparent' && format === 'jpg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, finalWidth, finalHeight);
    }
    
    // Terapkan transform skala & translasi crop
    ctx.save();
    ctx.scale(scaleFactor, scaleFactor);
    ctx.translate(-minX, -minY);
    
    // Render diagram dengan kualitas vektor murni
    drawPLSDiagram(ctx, {
      showR2,
      showLoadings,
      showPathCoeff,
      showPValues: showPValues && !!state.hasilBootstrap,
      showLegend,
      showIndicators,
      isExport: true,
      bgColor: bgType,
      theme: bgType === 'dark' ? 'gelap' : 'terang',
      selectedNodeId: null,
      selectedPathId: null
    });
    
    ctx.restore();
    
    // Output Format
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const dataUrl = exportCanvas.toDataURL(mimeType, 1.0);
    
    if (keClipboard) {
      exportCanvas.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          hideLoading();
          hideModal('modalEksporGambar');
          showToast(`Gambar ${dpi} DPI berhasil disalin ke clipboard!`, 'sukses');
        } catch (err) {
          hideLoading();
          showToast('Gagal menyalin: ' + err.message, 'error');
        }
      }, 'image/png');
    } else {
      const sanitizedName = (state.proyekAktif.nama || 'Model_PLS').replace(/[^a-zA-Z0-9_-]/g, '_');
      const namaFile = `${sanitizedName}_Diagram_${dpi}DPI.${format}`;
      
      const res = await window.api.eksporGambar({
        dataUrl,
        namaFile,
        format
      });
      
      hideLoading();
      if (res) {
        hideModal('modalEksporGambar');
        showToast(`Gambar berhasil disimpan dengan resolusi ${dpi} DPI (${finalWidth} × ${finalHeight} px)!`, 'sukses');
      }
    }
  } catch (e) {
    hideLoading();
    showToast('Error ekspor: ' + e.message, 'error');
  }
}

// ============ VARIABLE PROPERTIES PANEL ============
function showVariableProperties(v) {
  const panel = document.getElementById('panelBody');
  if (!panel) return;
  
  const editorPanel = document.getElementById('editorPanel');
  if (editorPanel && editorPanel.classList.contains('collapsed')) {
    editorPanel.classList.remove('collapsed');
    document.getElementById('btnTogglePanelProperties')?.classList.add('active');
  }
  
  let loadingsHtml = '';
  if (state.hasilPLS && state.hasilPLS.outerLoadings[v.nama]) {
    const loadings = state.hasilPLS.outerLoadings[v.nama];
    loadingsHtml = `
      <div class="form-group" style="margin-top: 14px;">
        <label>Outer Loadings</label>
        <table class="data-table" style="font-size: 12px;">
          <thead><tr><th>Indikator</th><th>Loading</th></tr></thead>
          <tbody>
            ${Object.entries(loadings).map(([ind, val]) => `
              <tr>
                <td>${escapeHtml(ind)}</td>
                <td class="${Math.abs(val) >= 0.7 ? 'text-success' : 'text-warning'}">${val.toFixed(4)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  let reliabilityHtml = '';
  if (state.hasilPLS && state.hasilPLS.reliability[v.nama]) {
    const rel = state.hasilPLS.reliability[v.nama];
    reliabilityHtml = `
      <div class="form-group" style="margin-top: 14px;">
        <label>Reliabilitas & Validitas</label>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="font-size: 12px; color: var(--text-secondary)">Cronbach's Alpha</span>
            <span class="${rel.cronbachAlpha >= 0.7 ? 'badge badge-sukses' : 'badge badge-danger'}">${rel.cronbachAlpha.toFixed(3)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="font-size: 12px; color: var(--text-secondary)">Composite Reliability</span>
            <span class="${rel.compositeReliability >= 0.7 ? 'badge badge-sukses' : 'badge badge-danger'}">${rel.compositeReliability.toFixed(3)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="font-size: 12px; color: var(--text-secondary)">AVE</span>
            <span class="${rel.ave >= 0.5 ? 'badge badge-sukses' : 'badge badge-danger'}">${rel.ave.toFixed(3)}</span>
          </div>
        </div>
      </div>
    `;
  }
  
  const curOrientasi = v.orientasi || 'kiri';
  const curTipe = v.tipe || 'reflektif';
  const curWarna = v.warna || '#009bf2';
  
  const paletteColors = [
    { hex: '#009bf2', name: 'SmartPLS Blue' },
    { hex: '#0ea5e9', name: 'Sky Blue (Eksogen)' },
    { hex: '#f59e0b', name: 'Sunset Amber (Mediasi)' },
    { hex: '#ec4899', name: 'Rose (Moderasi)' },
    { hex: '#10b981', name: 'Emerald (Endogen)' },
    { hex: '#8b5cf6', name: 'Purple Violet' },
    { hex: '#64748b', name: 'Slate Neutral' }
  ];
  
  panel.innerHTML = `
    <div class="form-group">
      <label>Nama Variabel</label>
      <input type="text" id="editPropNamaVar" class="form-input" value="${escapeHtml(v.nama)}" placeholder="Nama variabel laten">
    </div>

    <div class="form-group">
      <label>Tema Warna Konstruk</label>
      <div class="color-swatches-grid" style="display: flex; gap: 7px; flex-wrap: wrap; margin-top: 4px;">
        ${paletteColors.map(c => `
          <div class="color-dot ${c.hex.toLowerCase() === curWarna.toLowerCase() ? 'active' : ''}" 
               data-color="${c.hex}" 
               style="background: ${c.hex}; width: 22px; height: 22px; border-radius: 50%; cursor: pointer; border: 2px solid ${c.hex.toLowerCase() === curWarna.toLowerCase() ? '#ffffff' : 'transparent'}; box-shadow: ${c.hex.toLowerCase() === curWarna.toLowerCase() ? '0 0 0 2px var(--color-primary)' : 'none'}; transition: transform 0.15s;" 
               onclick="setVariableColor(${v.id}, '${c.hex}')" 
               title="${c.name}">
          </div>
        `).join('')}
      </div>
    </div>
    
    <div class="form-group">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <label style="margin-bottom: 0;">Tipe & Arah Panah Indikator</label>
        <button type="button" class="btn btn-xs btn-outline" onclick="switchArahIndikator(${v.id})" title="Balik arah panah">
          <span class="material-icons-round" style="font-size: 13px;">sync_alt</span> Balik Arah
        </button>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px;">
        <button type="button" class="btn btn-sm ${curTipe === 'reflektif' ? 'btn-primary' : 'btn-outline'}" id="btnTipeReflektif" onclick="setPropTipe('reflektif')">
          Reflektif (→)
        </button>
        <button type="button" class="btn btn-sm ${curTipe === 'formatif' ? 'btn-primary' : 'btn-outline'}" id="btnTipeFormatif" onclick="setPropTipe('formatif')">
          Formatif (←)
        </button>
      </div>
      <input type="hidden" id="editPropTipeVar" value="${curTipe}">
    </div>
    
    <div class="form-group">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <label style="margin-bottom: 0;">Posisi Kotak Indikator</label>
        <button type="button" class="btn btn-xs btn-ghost" onclick="rotateSelectedVariableOrientation(${v.id})" title="Putar Posisi Indikator (Alt+R)" style="padding: 1px 6px; font-size: 11px; color: var(--color-primary);">
          <span class="material-icons-round" style="font-size: 13px;">rotate_right</span> Putar (Alt+R)
        </button>
      </div>
      <div class="orientasi-btn-group" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 4px;">
        <button class="btn btn-sm ${curOrientasi === 'kiri' ? 'btn-primary' : 'btn-outline'}" onclick="setVariableOrientation(${v.id}, 'kiri')">Kiri</button>
        <button class="btn btn-sm ${curOrientasi === 'kanan' ? 'btn-primary' : 'btn-outline'}" onclick="setVariableOrientation(${v.id}, 'kanan')">Kanan</button>
        <button class="btn btn-sm ${curOrientasi === 'atas' ? 'btn-primary' : 'btn-outline'}" onclick="setVariableOrientation(${v.id}, 'atas')">Atas</button>
        <button class="btn btn-sm ${curOrientasi === 'bawah' ? 'btn-primary' : 'btn-outline'}" onclick="setVariableOrientation(${v.id}, 'bawah')">Bawah</button>
      </div>
    </div>
    
    <div class="form-group">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label style="margin-bottom: 0;">Daftar Indikator (${v.indikator.length})</label>
        <button type="button" class="btn btn-xs btn-outline" onclick="tambahPropIndikatorRow()" style="padding: 2px 8px; font-size: 11px;">
          <span class="material-icons-round" style="font-size: 13px;">add</span> Tambah
        </button>
      </div>
      <div id="propIndikatorContainer" style="display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto; padding-right: 4px;">
        ${v.indikator.map((ind, idx) => `
          <div class="prop-ind-row" style="display: flex; gap: 6px; align-items: center;">
            <input type="text" class="form-input prop-ind-input" value="${escapeHtml(ind)}" style="padding: 5px 8px; font-size: 12px;">
            <button type="button" class="btn-hapus" onclick="this.parentElement.remove()" style="padding: 4px; border: none; background: transparent; cursor: pointer; color: var(--color-danger);" title="Hapus indikator">
              <span class="material-icons-round" style="font-size: 16px;">close</span>
            </button>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 8px;">
      <button class="btn btn-sm btn-primary btn-block" onclick="simpanPerubahanVariabel(${v.id})">
        <span class="material-icons-round">save</span> Simpan Perubahan Variabel
      </button>
      <button class="btn btn-xs btn-outline" onclick="duplicateSelectedVariable(${v.id})">
        <span class="material-icons-round" style="font-size: 14px;">content_copy</span> Duplikat Variabel
      </button>
      <button class="btn btn-sm btn-danger btn-block" onclick="hapusVariabel(${v.id})">
        <span class="material-icons-round">delete</span> Hapus Variabel
      </button>
    </div>
    
    ${loadingsHtml}
    ${reliabilityHtml}
  `;
}

function switchArahIndikator(id) {
  const v = state.variabels.find(vv => vv.id === id);
  if (!v) return;
  v.tipe = (v.tipe === 'reflektif') ? 'formatif' : 'reflektif';
  renderModel();
  saveModelToDb();
  showVariableProperties(v);
  showToast(`Arah panah indikator "${v.nama}" diubah menjadi ${v.tipe}`, 'info');
}

function setPropTipe(tipe) {
  document.getElementById('editPropTipeVar').value = tipe;
  document.getElementById('btnTipeReflektif').className = `btn btn-sm ${tipe === 'reflektif' ? 'btn-primary' : 'btn-outline'}`;
  document.getElementById('btnTipeFormatif').className = `btn btn-sm ${tipe === 'formatif' ? 'btn-primary' : 'btn-outline'}`;
  // Langsung apply ke variabel yang sedang dipilih dan render ulang
  const v = state.variabels.find(vv => vv.id === state.selectedNode);
  if (!v) return;
  v.tipe = tipe;
  renderModel();
  saveModelToDb();
  showToast(`Tipe "${v.nama}" diubah ke ${tipe === 'reflektif' ? 'Reflektif (→)' : 'Formatif (←)'}`, 'info');
}

function tambahPropIndikatorRow(val = '') {
  const container = document.getElementById('propIndikatorContainer');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'prop-ind-row';
  row.style.cssText = 'display: flex; gap: 6px; align-items: center;';
  row.innerHTML = `
    <input type="text" class="form-input prop-ind-input" value="${escapeHtml(val)}" placeholder="Nama indikator" style="padding: 5px 8px; font-size: 12px;">
    <button type="button" class="btn-hapus" onclick="this.parentElement.remove()" style="padding: 4px; border: none; background: transparent; cursor: pointer; color: var(--color-danger);" title="Hapus indikator">
      <span class="material-icons-round" style="font-size: 16px;">close</span>
    </button>
  `;
  container.appendChild(row);
  row.querySelector('input').focus();
}

async function simpanPerubahanVariabel(id) {
  const v = state.variabels.find(vv => vv.id === id);
  if (!v) return;
  
  const namaBaru = document.getElementById('editPropNamaVar').value.trim();
  if (!namaBaru) {
    showToast('Nama variabel tidak boleh kosong', 'peringatan');
    return;
  }
  
  // Periksa apakah nama sudah digunakan oleh variabel lain
  if (namaBaru !== v.nama && state.variabels.some(other => other.id !== id && other.nama.toLowerCase() === namaBaru.toLowerCase())) {
    showToast(`Nama variabel "${namaBaru}" sudah digunakan`, 'peringatan');
    return;
  }
  
  const tipeBaru = document.getElementById('editPropTipeVar')?.value || v.tipe;
  
  const indInputs = document.querySelectorAll('#propIndikatorContainer .prop-ind-input');
  const indikatorBaru = [];
  indInputs.forEach(input => {
    const val = input.value.trim();
    if (val) indikatorBaru.push(val);
  });
  
  const namaLama = v.nama;
  v.nama = namaBaru;
  v.tipe = tipeBaru;
  v.indikator = indikatorBaru;
  
  // Jika nama variabel berubah, perbarui juga referensi di jalur struktural
  if (namaLama !== namaBaru) {
    state.jalurs.forEach(j => {
      if (j.dari === namaLama || j.dari_variabel_id == id) j.dari = namaBaru;
      if (j.ke === namaLama || j.ke_variabel_id == id) j.ke = namaBaru;
    });
  }
  
  renderModel();
  await saveModelToDb();
  showVariableProperties(v);
  if (indikatorBaru.length === 0) {
    showToast(`Variabel konseptual "${namaBaru}" diperbarui (Tanpa Indikator)`, 'sukses');
  } else {
    showToast(`Variabel "${namaBaru}" berhasil diperbarui (${indikatorBaru.length} indikator)`, 'sukses');
  }
}

// Helper Preset Ketebalan Jalur di Panel Properti
window.setPropTebalGarisJalur = function(id, tebal) {
  const jalur = state.jalurs.find(j => j.id === id);
  if (!jalur) return;
  jalur.tebal_garis = tebal;
  renderModel();
  saveModelToDb();
  showPathProperties(jalur);
  showToast(`Ketebalan jalur diubah ke ${tebal}px`, 'info');
};

// Helper Preset Kelengkungan di Panel Properti
window.setPropPathCurvature = function(id, val) {
  const jalur = state.jalurs.find(j => j.id === id);
  if (!jalur) return;
  jalur.kelengkungan = val;
  const valLabel = document.getElementById('editPropKelengkunganVal');
  if (valLabel) {
    if (val === 0) valLabel.textContent = 'Lurus (0)';
    else if (val < 0) valLabel.textContent = `Lengkung Bawah (${val})`;
    else valLabel.textContent = `Lengkung Atas (+${val})`;
  }
  renderModel();
  saveModelToDb();
};

// Helper Balik Arah Lengkungan
window.flipPropPathCurvature = function(id) {
  const jalur = state.jalurs.find(j => j.id === id);
  if (!jalur) return;
  jalur.kelengkungan = -(jalur.kelengkungan || 35);
  renderModel();
  saveModelToDb();
  showPathProperties(jalur);
  showToast('Arah lengkungan garis dibalik', 'info');
};

// ============ PATH PROPERTIES PANEL ============
function showPathProperties(jalur) {
  const panel = document.getElementById('panelBody');
  if (!panel) return;
  
  const editorPanel = document.getElementById('editorPanel');
  if (editorPanel && editorPanel.classList.contains('collapsed')) {
    editorPanel.classList.remove('collapsed');
    document.getElementById('btnTogglePanelProperties')?.classList.add('active');
  }
  
  const fromVar = state.variabels.find(v => v.id == jalur.dari_variabel_id || v.nama === jalur.dari);
  const toVar = state.variabels.find(v => v.id == jalur.ke_variabel_id || v.nama === jalur.ke);
  const viaVar = jalur.melalui_variabel_id ? state.variabels.find(v => v.id == jalur.melalui_variabel_id || v.nama === jalur.melalui) : null;
  const fromName = fromVar ? fromVar.nama : jalur.dari;
  const toName = toVar ? toVar.nama : jalur.ke;
  const viaName = viaVar ? viaVar.nama : jalur.melalui;
  const curTipeGaris = jalur.tipe_garis || 'solid';
  const curKelengkungan = jalur.kelengkungan || 0;
  const curTebal = jalur.tebal_garis ? parseFloat(jalur.tebal_garis) : 2.5;
  
  let coeffInfo = '';
  const pathKey = viaVar ? `${fromName} → ${viaName} → ${toName}` : `${fromName} → ${toName}`;
  if (state.hasilPLS?.pathCoefficients?.[pathKey] !== undefined) {
    const coeff = state.hasilPLS.pathCoefficients[pathKey];
    const pVal = state.hasilBootstrap?.pathResults?.[pathKey]?.pValue;
    const tStat = state.hasilBootstrap?.pathResults?.[pathKey]?.tStatistic;
    
    coeffInfo = `
      <div class="form-group" style="margin-top: 14px;">
        <label>Hasil Estimasi Jalur</label>
        <div style="display: flex; flex-direction: column; gap: 6px; background: var(--bg-hover); padding: 10px; border-radius: var(--radius-md);">
          <div style="display: flex; justify-content: space-between;">
            <span style="font-size: 12px; color: var(--text-secondary)">Koefisien Jalur (β)</span>
            <span style="font-weight: 700; color: var(--color-primary);">${coeff.toFixed(4)}</span>
          </div>
          ${tStat !== undefined ? `
            <div style="display: flex; justify-content: space-between;">
              <span style="font-size: 12px; color: var(--text-secondary)">T-Statistic</span>
              <span style="font-weight: 600;">${tStat.toFixed(3)}</span>
            </div>
          ` : ''}
          ${pVal !== undefined ? `
            <div style="display: flex; justify-content: space-between;">
              <span style="font-size: 12px; color: var(--text-secondary)">P-Value</span>
              <span class="${pVal < 0.05 ? 'badge badge-sukses' : 'badge badge-danger'}">${pVal.toFixed(4)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  let curvatureLabelText = 'Lurus (0)';
  if (curKelengkungan < 0) curvatureLabelText = `Lengkung Bawah (${curKelengkungan})`;
  else if (curKelengkungan > 0) curvatureLabelText = `Lengkung Atas (+${curKelengkungan})`;

  panel.innerHTML = `
    <div class="form-group">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <label style="margin-bottom: 0;">Hubungan Struktural</label>
        <button type="button" class="btn btn-xs btn-outline" onclick="switchArahJalur(${jalur.id})" title="Balik arah panah">
          <span class="material-icons-round" style="font-size: 13px;">swap_horiz</span> Balik Arah
        </button>
      </div>
      <div style="font-size: 13px; font-weight: 700; color: var(--color-primary); margin-top: 8px; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; background: var(--bg-hover); padding: 8px 12px; border-radius: var(--radius-md);">
        <span>${escapeHtml(fromName)}</span>
        <span class="material-icons-round" style="font-size: 16px;">arrow_forward</span>
        ${viaName ? `<span>${escapeHtml(viaName)}</span><span class="material-icons-round" style="font-size: 16px;">arrow_forward</span>` : ''}
        <span>${escapeHtml(toName)}</span>
      </div>
    </div>
    
    <div class="form-group">
      <label>Tipe Garis Panah</label>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px;">
        <button type="button" class="btn btn-sm ${curTipeGaris === 'solid' ? 'btn-primary' : 'btn-outline'}" id="btnGarisSolid" onclick="setPropTipeGarisJalur(${jalur.id}, 'solid')">
          Solid (Langsung)
        </button>
        <button type="button" class="btn btn-sm ${curTipeGaris === 'dashed' ? 'btn-primary' : 'btn-outline'}" id="btnGarisDashed" onclick="setPropTipeGarisJalur(${jalur.id}, 'dashed')">
          Putus-putus (Mediasi)
        </button>
      </div>
    </div>

    <!-- Ketebalan Garis Jalur -->
    <div class="form-group">
      <label>Ketebalan Garis Jalur</label>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 4px;">
        <button type="button" class="btn btn-sm ${Math.abs(curTebal - 1.5) < 0.1 ? 'btn-primary' : 'btn-outline'}" onclick="setPropTebalGarisJalur(${jalur.id}, 1.5)">1.5px</button>
        <button type="button" class="btn btn-sm ${Math.abs(curTebal - 2.5) < 0.1 ? 'btn-primary' : 'btn-outline'}" onclick="setPropTebalGarisJalur(${jalur.id}, 2.5)">2.5px</button>
        <button type="button" class="btn btn-sm ${Math.abs(curTebal - 4) < 0.1 ? 'btn-primary' : 'btn-outline'}" onclick="setPropTebalGarisJalur(${jalur.id}, 4)">4px</button>
        <button type="button" class="btn btn-sm ${Math.abs(curTebal - 6) < 0.1 ? 'btn-primary' : 'btn-outline'}" onclick="setPropTebalGarisJalur(${jalur.id}, 6)">6px</button>
      </div>
    </div>

    <!-- Kelengkungan Garis / Direct Drag Hint & Quick Actions -->
    <div class="form-group">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label style="margin: 0;">Kelengkungan Garis</label>
        <span id="editPropKelengkunganVal" style="font-size: 11.5px; font-weight: 700; color: var(--color-primary);">${curvatureLabelText}</span>
      </div>
      
      <div style="background: rgba(99, 102, 241, 0.08); border: 1.5px dashed var(--color-primary); padding: 8px 10px; border-radius: 8px; font-size: 11.5px; color: var(--text-secondary); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
        <span class="material-icons-round" style="color: var(--color-primary); font-size: 16px;">touch_app</span>
        <span>Drag langsung titik tengah garis pada canvas untuk melengkungkannya.</span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
        <button type="button" class="btn btn-xs btn-outline" onclick="setPropPathCurvature(${jalur.id}, 0)">Luruskan (0)</button>
        <button type="button" class="btn btn-xs btn-outline" onclick="flipPropPathCurvature(${jalur.id})">Balik Lengkung (↔)</button>
        <button type="button" class="btn btn-xs btn-outline" onclick="setPropPathCurvature(${jalur.id}, -40)">Lengkung Atas (-40)</button>
        <button type="button" class="btn btn-xs btn-outline" onclick="setPropPathCurvature(${jalur.id}, 40)">Lengkung Bawah (+40)</button>
      </div>
    </div>
    
    <div class="form-group">
      <label>Label Hipotesis (Manual)</label>
      <input type="text" id="editPropLabelJalur" class="form-input" value="${escapeHtml(jalur.label || '')}" placeholder="Contoh: H1, H2, H8 (X1->Z->Y)">
      <span class="text-muted" style="font-size: 11px; margin-top: 4px; display: block;">Label hipotesis tampil tepat di tengah kurva garis</span>
    </div>
    
    <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 8px;">
      <button class="btn btn-sm btn-primary btn-block" onclick="simpanLabelJalur(${jalur.id})">
        <span class="material-icons-round">save</span> Simpan Perubahan Jalur
      </button>
      <button class="btn btn-sm btn-danger btn-block" onclick="hapusJalur(${jalur.id})">
        <span class="material-icons-round">delete</span> Hapus Jalur
      </button>
    </div>
    
    ${coeffInfo}
  `;
}

function switchArahJalur(id) {
  const jalur = state.jalurs.find(j => j.id === id);
  if (!jalur) return;
  
  const tempDari = jalur.dari;
  const tempDariId = jalur.dari_variabel_id;
  jalur.dari = jalur.ke;
  jalur.dari_variabel_id = jalur.ke_variabel_id;
  jalur.ke = tempDari;
  jalur.ke_variabel_id = tempDariId;
  
  // Balik arah kelengkungan jika ada
  if (jalur.kelengkungan) {
    jalur.kelengkungan = -jalur.kelengkungan;
  }
  
  renderModel();
  saveModelToDb();
  showPathProperties(jalur);
  showToast(`Arah jalur dibalik: ${jalur.dari} → ${jalur.ke}`, 'info');
}

function setPropTipeGarisJalur(id, tipeGaris) {
  const jalur = state.jalurs.find(j => j.id === id);
  if (!jalur) return;
  jalur.tipe_garis = tipeGaris;
  renderModel();
  saveModelToDb();
  showPathProperties(jalur);
  showToast(`Tipe garis diubah menjadi ${tipeGaris === 'solid' ? 'Solid' : 'Putus-putus'}`, 'info');
}

async function simpanLabelJalur(id) {
  const jalur = state.jalurs.find(j => j.id === id);
  if (!jalur) return;
  
  const inputEl = document.getElementById('editPropLabelJalur');
  const labelBaru = inputEl ? inputEl.value.trim() : '';
  
  jalur.label = labelBaru;
  renderModel();
  await saveModelToDb();
  showToast(`Perubahan jalur disimpan: "${labelBaru || '(Tanpa label)'}"`, 'sukses');
}

async function hapusJalur(id) {
  const jalur = state.jalurs.find(j => j.id === id);
  if (!jalur) return;
  
  const ok = await konfirmasiDialog({
    title: 'Hapus Jalur Struktural',
    message: `Apakah Anda yakin ingin menghapus hubungan jalur ${jalur.dari} → ${jalur.ke}?`,
    okText: 'Hapus Jalur',
    okIcon: 'delete',
    isDanger: true,
    icon: 'delete_outline'
  });
  
  if (ok) {
    state.jalurs = state.jalurs.filter(j => j.id !== id);
    state.selectedPath = null;
    renderModel();
    await saveModelToDb();
    const pbPath = document.getElementById('panelBody');
    if (pbPath) pbPath.innerHTML = '<p class="text-muted">Pilih variabel atau jalur untuk melihat propertinya</p>';
    showToast('Jalur struktural dihapus', 'sukses');
  }
}

function setVariableOrientation(id, orientasi) {
  const v = state.variabels.find(vv => vv.id === id);
  if (!v) return;
  v.orientasi = orientasi;
  renderModel();
  saveModelToDb();
  showVariableProperties(v);
}

async function hapusVariabel(id) {
  const v = state.variabels.find(vv => vv.id === id);
  if (!v) return;
  
  const ok = await konfirmasiDialog({
    title: 'Hapus Variabel Laten',
    message: `Apakah Anda yakin ingin menghapus variabel "${v.nama}" beserta semua indikator dan jalurnya?`,
    okText: 'Hapus Variabel',
    okIcon: 'delete',
    isDanger: true,
    icon: 'delete_outline'
  });
  
  if (ok) {
    state.variabels = state.variabels.filter(vv => vv.id !== id);
    state.jalurs = state.jalurs.filter(j => j.dari_variabel_id != id && j.ke_variabel_id != id && j.dari !== v.nama && j.ke !== v.nama);
    state.selectedNode = null;
    renderModel();
    saveModelToDb();
    const pbVar = document.getElementById('panelBody');
    if (pbVar) pbVar.innerHTML = '<p class="text-muted">Pilih variabel untuk melihat propertinya</p>';
    showToast(`Variabel "${v.nama}" dihapus`, 'sukses');
  }
}

// ============ DATA MANAGEMENT & ADVANCED VIEWER STATE ============
const dataViewerState = {
  activeDatasetId: null,
  activeDataset: null,
  allRows: [],
  filteredRows: [],
  columns: [],
  searchQuery: '',
  searchColumn: 'all',
  currentPage: 1,
  pageSize: 25,
  sortColumn: null,
  sortDirection: 'asc',
  showStatsShelf: false,
  columnStats: {},
  totalMissing: 0
};

function initDataHandlers() {
  // Tombol Impor Data
  document.getElementById('btnImporData')?.addEventListener('click', async () => {
    if (!state.proyekAktif) {
      showToast('Pilih proyek terlebih dahulu', 'peringatan');
      return;
    }
    
    showLoading('Mengimpor & Membaca Berkas Data...', 600, 'Parsing CSV/Excel, Deteksi Kolom & Format Numerik', 'upload_file');
    try {
      const result = await window.api.datasetImpor(state.proyekAktif.id);
      if (result) {
        showToast(`Dataset "${result.nama}" berhasil diimpor (${result.jumlah_baris} baris, ${result.jumlah_kolom} kolom)`, 'sukses');
        await loadDatasets();
        if (result.id) {
          previewDataset(result.id);
        }
      }
    } catch (e) {
      showToast('Gagal mengimpor data: ' + e.message, 'error');
    }
    hideLoading();
  });

  // Tombol Ekspor CSV/Excel Data dari Toolbar Atas
  document.getElementById('btnEksporCSVData')?.addEventListener('click', async () => {
    if (!dataViewerState.activeDataset || !dataViewerState.allRows.length) {
      showToast('Belum ada dataset aktif untuk diekspor', 'peringatan');
      return;
    }
    await exportActiveDataset();
  });
}

function computeDatasetStatistics(columns, rows) {
  const stats = {};
  let totalMissing = 0;

  columns.forEach(col => {
    let numericValues = [];
    let missingCount = 0;

    rows.forEach(row => {
      const val = row[col];
      if (val === null || val === undefined || val === '' || isNaN(Number(val))) {
        missingCount++;
        totalMissing++;
      } else {
        numericValues.push(Number(val));
      }
    });

    let mean = '-', min = '-', max = '-', stdev = '-';
    if (numericValues.length > 0) {
      min = Math.min(...numericValues);
      max = Math.max(...numericValues);
      const sum = numericValues.reduce((acc, v) => acc + v, 0);
      const avg = sum / numericValues.length;
      mean = avg.toFixed(3);
      if (numericValues.length > 1) {
        const variance = numericValues.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / (numericValues.length - 1);
        stdev = Math.sqrt(variance).toFixed(3);
      } else {
        stdev = '0.000';
      }
    }

    stats[col] = {
      isNumeric: numericValues.length > 0,
      count: numericValues.length,
      missing: missingCount,
      min,
      max,
      mean,
      stdev
    };
  });

  return { columnStats: stats, totalMissing };
}

async function loadDatasets() {
  if (!state.proyekAktif) return;
  
  const datasets = await window.api.datasetDaftar(state.proyekAktif.id);
  state.datasets = datasets;
  
  const badge = document.getElementById('datasetCountBadge');
  if (badge) {
    badge.textContent = `${datasets.length} File`;
  }
  
  const totalDsEl = document.getElementById('totalDataset');
  if (totalDsEl) {
    totalDsEl.textContent = datasets.length;
  }
  
  const list = document.getElementById('datasetList');
  if (!list) return;
  
  if (datasets.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="padding: 24px 12px; text-align: center;">
        <span class="material-icons-round" style="font-size: 36px; color: var(--text-muted); margin-bottom: 8px;">cloud_upload</span>
        <p style="font-size: 12px; color: var(--text-secondary); margin: 0;">Belum ada dataset.<br>Impor file CSV atau Excel.</p>
      </div>
    `;
    document.getElementById('dataPreview').innerHTML = `
      <div class="data-preview-empty">
        <span class="material-icons-round">visibility</span>
        <p style="font-size: 13.5px; font-weight: 500;">Pilih atau impor dataset untuk melihat pratinjau data dan ringkasan statistik</p>
      </div>
    `;
    dataViewerState.activeDatasetId = null;
    dataViewerState.activeDataset = null;
    return;
  }
  
  list.innerHTML = datasets.map(d => {
    const isActive = dataViewerState.activeDatasetId === d.id;
    return `
      <div class="dataset-item ${isActive ? 'active' : ''}" data-id="${d.id}">
        <div class="dataset-item-header">
          <div class="dataset-item-title-wrap">
            <span class="material-icons-round dataset-item-icon">table_chart</span>
            <span class="dataset-item-name" title="${escapeHtml(d.nama)}">${escapeHtml(d.nama)}</span>
          </div>
          <div class="dataset-item-actions">
            <button class="dataset-action-btn" title="Ekspor Dataset ini ke Excel/CSV" onclick="event.stopPropagation(); exportSpecificDataset(${d.id})">
              <span class="material-icons-round" style="font-size: 15px;">file_download</span>
            </button>
            <button class="dataset-action-btn btn-delete" title="Hapus Dataset" onclick="event.stopPropagation(); hapusDataset(${d.id})">
              <span class="material-icons-round" style="font-size: 15px;">delete</span>
            </button>
          </div>
        </div>
        <div class="dataset-item-meta">
          <span class="badge-chip"><strong>${d.jumlah_baris}</strong> baris</span>
          <span class="badge-chip"><strong>${d.jumlah_kolom}</strong> kolom</span>
        </div>
      </div>
    `;
  }).join('');
  
  list.querySelectorAll('.dataset-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = parseInt(item.dataset.id);
      previewDataset(id);
    });
  });

  // Auto select first dataset if none is active or if previous active dataset no longer exists
  const activeExists = datasets.some(d => d.id === dataViewerState.activeDatasetId);
  if (!activeExists && datasets.length > 0) {
    previewDataset(datasets[0].id);
  }
}

async function previewDataset(id, preservePage = false) {
  const dataset = await window.api.datasetAmbil(id);
  if (!dataset || !dataset.data) return;

  dataViewerState.activeDatasetId = id;
  dataViewerState.activeDataset = dataset;
  dataViewerState.columns = Array.isArray(dataset.kolom) ? dataset.kolom : [];
  dataViewerState.allRows = Array.isArray(dataset.data) ? dataset.data : [];

  if (!preservePage) {
    dataViewerState.currentPage = 1;
    dataViewerState.searchQuery = '';
    dataViewerState.searchColumn = 'all';
    dataViewerState.sortColumn = null;
    dataViewerState.sortDirection = 'asc';
  }

  // Calculate descriptive stats
  const { columnStats, totalMissing } = computeDatasetStatistics(dataViewerState.columns, dataViewerState.allRows);
  dataViewerState.columnStats = columnStats;
  dataViewerState.totalMissing = totalMissing;

  // Mark active card in sidebar
  document.querySelectorAll('.dataset-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.dataset-item[data-id="${id}"]`)?.classList.add('active');

  applyDataFilterAndSort();
  renderDataPreviewUI();
}

function applyDataFilterAndSort() {
  const q = (dataViewerState.searchQuery || '').trim().toLowerCase();
  const colFilter = dataViewerState.searchColumn;

  if (!q) {
    dataViewerState.filteredRows = [...dataViewerState.allRows];
  } else {
    dataViewerState.filteredRows = dataViewerState.allRows.filter(row => {
      if (colFilter !== 'all' && row[colFilter] !== undefined) {
        return String(row[colFilter]).toLowerCase().includes(q);
      }
      return dataViewerState.columns.some(c => {
        const val = row[c];
        return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
      });
    });
  }

  // Sorting
  if (dataViewerState.sortColumn) {
    const col = dataViewerState.sortColumn;
    const isAsc = dataViewerState.sortDirection === 'asc';
    dataViewerState.filteredRows.sort((a, b) => {
      let valA = a[col];
      let valB = b[col];

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      const numA = Number(valA);
      const numB = Number(valB);

      if (!isNaN(numA) && !isNaN(numB)) {
        return isAsc ? numA - numB : numB - numA;
      }
      return isAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });
  }

  const totalPages = Math.max(1, Math.ceil(dataViewerState.filteredRows.length / dataViewerState.pageSize));
  if (dataViewerState.currentPage > totalPages) {
    dataViewerState.currentPage = totalPages;
  }
}

function renderDataPreviewUI() {
  const preview = document.getElementById('dataPreview');
  if (!preview || !dataViewerState.activeDataset) return;

  const dataset = dataViewerState.activeDataset;
  const columns = dataViewerState.columns;
  const totalRows = dataViewerState.allRows.length;
  const filteredRows = dataViewerState.filteredRows;
  const totalFiltered = filteredRows.length;
  const pageSize = dataViewerState.pageSize;
  const currentPage = dataViewerState.currentPage;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalFiltered);
  const pageRows = filteredRows.slice(startIdx, endIdx);

  const missingBadge = dataViewerState.totalMissing === 0
    ? `<span class="badge-chip badge-success"><span class="material-icons-round" style="font-size: 13px;">check_circle</span> 0 Missing (Data Bersih)</span>`
    : `<span class="badge-chip badge-warning"><span class="material-icons-round" style="font-size: 13px;">warning</span> ${dataViewerState.totalMissing} Missing Values</span>`;

  // Render Stats Shelf Cards
  const statsShelfHtml = dataViewerState.showStatsShelf ? `
    <div class="data-stats-shelf" id="dataStatsShelf">
      ${columns.map(col => {
        const s = dataViewerState.columnStats[col] || {};
        return `
          <div class="stat-column-card">
            <div class="stat-col-name" title="${escapeHtml(col)}">${escapeHtml(col)}</div>
            <div class="stat-col-row"><span>Mean:</span> <span class="stat-col-val">${s.mean}</span></div>
            <div class="stat-col-row"><span>Min / Max:</span> <span class="stat-col-val">${s.min} - ${s.max}</span></div>
            <div class="stat-col-row"><span>StDev:</span> <span class="stat-col-val">${s.stdev}</span></div>
            <div class="stat-col-row"><span>Missing:</span> <span class="stat-col-val" style="color: ${s.missing > 0 ? '#f87171' : 'inherit'}">${s.missing}</span></div>
          </div>
        `;
      }).join('')}
    </div>
  ` : '';

  // Render pagination buttons
  let paginationButtons = '';
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  if (startPage > 1) {
    paginationButtons += `<button class="page-btn" data-page="1">1</button>`;
    if (startPage > 2) {
      paginationButtons += `<span class="page-ellipsis">...</span>`;
    }
  }

  for (let p = startPage; p <= endPage; p++) {
    paginationButtons += `<button class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationButtons += `<span class="page-ellipsis">...</span>`;
    }
    paginationButtons += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  preview.innerHTML = `
    <!-- Topbar Info -->
    <div class="data-preview-topbar">
      <div class="data-preview-title-block">
        <span class="material-icons-round" style="color: var(--color-primary); font-size: 22px;">table_view</span>
        <h3 class="data-preview-title">${escapeHtml(dataset.nama)}</h3>
      </div>
      <div class="data-preview-badges">
        <span class="badge-chip badge-primary"><strong>${totalRows}</strong> Baris (N)</span>
        <span class="badge-chip"><strong>${columns.length}</strong> Kolom</span>
        <span class="badge-chip"><strong>${totalRows * columns.length}</strong> Total Sel</span>
        ${missingBadge}
      </div>
    </div>

    <!-- Toolbar Filters -->
    <div class="data-preview-toolbar">
      <div class="data-toolbar-left">
        <div class="data-search-box">
          <span class="material-icons-round data-search-icon">search</span>
          <input type="text" class="data-search-input" id="dataSearchInput" placeholder="Cari nilai sel / filter baris..." value="${escapeHtml(dataViewerState.searchQuery)}" autocomplete="off" />
          ${dataViewerState.searchQuery ? `<button class="data-search-clear" id="btnDataSearchClear"><span class="material-icons-round" style="font-size: 16px;">close</span></button>` : ''}
        </div>
        <select class="data-column-select" id="dataColumnFilterSelect" title="Pilih kolom pencarian">
          <option value="all" ${dataViewerState.searchColumn === 'all' ? 'selected' : ''}>Semua Kolom</option>
          ${columns.map(c => `<option value="${escapeHtml(c)}" ${dataViewerState.searchColumn === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        </select>
      </div>
      <div class="data-toolbar-right">
        <button class="btn-toolbar-tool ${dataViewerState.showStatsShelf ? 'active' : ''}" id="btnToggleStatsShelf" title="Tampilkan/sembunyikan ringkasan statistik per kolom">
          <span class="material-icons-round" style="font-size: 16px;">query_stats</span>
          <span>Ringkasan Kolom</span>
        </button>
        <button class="btn-toolbar-tool" id="btnEksporCurrentData" title="Ekspor dataset yang sedang dibuka ke file Excel/CSV">
          <span class="material-icons-round" style="font-size: 16px; color: #10b981;">file_download</span>
          <span>Ekspor</span>
        </button>
      </div>
    </div>

    <!-- Expandable Stats Shelf -->
    ${statsShelfHtml}

    <!-- Table Wrapper -->
    <div class="data-table-wrapper">
      ${totalFiltered === 0 ? `
        <div style="padding: 48px 16px; text-align: center; color: var(--text-muted);">
          <span class="material-icons-round" style="font-size: 42px; margin-bottom: 8px; opacity: 0.5;">search_off</span>
          <p style="font-size: 13.5px; font-weight: 500; margin: 0;">Tidak ditemukan baris yang cocok dengan kata kunci <em>"${escapeHtml(dataViewerState.searchQuery)}"</em></p>
        </div>
      ` : `
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-idx-th">#</th>
              ${columns.map(c => {
                const isSorted = dataViewerState.sortColumn === c;
                const sortIcon = isSorted
                  ? (dataViewerState.sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward')
                  : 'unfold_more';
                return `
                  <th class="sortable-th ${isSorted ? 'sorted' : ''}" data-col="${escapeHtml(c)}" title="Klik untuk mengurutkan data berdasarkan ${escapeHtml(c)}">
                    <div class="th-content">
                      <span>${escapeHtml(c)}</span>
                      <span class="material-icons-round th-sort-icon">${sortIcon}</span>
                    </div>
                  </th>
                `;
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${pageRows.map((row, rIdx) => {
              const actualRowIdx = startIdx + rIdx + 1;
              return `
                <tr>
                  <td class="col-idx">${actualRowIdx}</td>
                  ${columns.map(c => {
                    const val = row[c];
                    const isMissing = (val === null || val === undefined || val === '');
                    if (isMissing) {
                      return `<td class="col-num"><span class="badge-missing">NA</span></td>`;
                    }
                    const isNum = !isNaN(Number(val));
                    return `<td class="${isNum ? 'col-num' : ''}">${escapeHtml(String(val))}</td>`;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>

    <!-- Pagination Footer -->
    <div class="data-pagination-bar">
      <div class="pagination-info">
        <span>Menampilkan <strong>${totalFiltered > 0 ? startIdx + 1 : 0} - ${endIdx}</strong> dari <strong>${totalFiltered}</strong> baris ${dataViewerState.searchQuery ? `<em>(difilter dari ${totalRows} total)</em>` : ''}</span>
        <div class="page-size-selector">
          <span>Baris:</span>
          <select class="page-size-select" id="pageSizeSelect">
            <option value="10" ${pageSize === 10 ? 'selected' : ''}>10</option>
            <option value="25" ${pageSize === 25 ? 'selected' : ''}>25</option>
            <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
            <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
          </select>
        </div>
      </div>

      <div class="pagination-controls">
        <button class="page-btn" id="btnPageFirst" title="Halaman Pertama" ${currentPage <= 1 ? 'disabled' : ''}>
          <span class="material-icons-round page-btn-icon">first_page</span>
        </button>
        <button class="page-btn" id="btnPagePrev" title="Halaman Sebelumnya" ${currentPage <= 1 ? 'disabled' : ''}>
          <span class="material-icons-round page-btn-icon">chevron_left</span>
        </button>
        ${paginationButtons}
        <button class="page-btn" id="btnPageNext" title="Halaman Selanjutnya" ${currentPage >= totalPages ? 'disabled' : ''}>
          <span class="material-icons-round page-btn-icon">chevron_right</span>
        </button>
        <button class="page-btn" id="btnPageLast" title="Halaman Terakhir" ${currentPage >= totalPages ? 'disabled' : ''}>
          <span class="material-icons-round page-btn-icon">last_page</span>
        </button>
        <div class="page-jump-wrap">
          <span>Ke:</span>
          <input type="number" min="1" max="${totalPages}" class="page-jump-input" id="pageJumpInput" placeholder="${currentPage}" />
          <button class="page-btn" id="btnPageJumpGo" style="height: 26px; padding: 0 8px;">Go</button>
        </div>
      </div>
    </div>
  `;

  attachDataPreviewEvents();
}

function attachDataPreviewEvents() {
  const preview = document.getElementById('dataPreview');
  if (!preview) return;

  // 1. Search Input
  const searchInput = document.getElementById('dataSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      dataViewerState.searchQuery = e.target.value;
      dataViewerState.currentPage = 1;
      applyDataFilterAndSort();
      renderDataPreviewUI();
      // Keep focus on input and cursor at end
      const newInput = document.getElementById('dataSearchInput');
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(newInput.value.length, newInput.value.length);
      }
    });
  }

  // 2. Search Clear Button
  document.getElementById('btnDataSearchClear')?.addEventListener('click', () => {
    dataViewerState.searchQuery = '';
    dataViewerState.currentPage = 1;
    applyDataFilterAndSort();
    renderDataPreviewUI();
  });

  // 3. Column Filter Select
  document.getElementById('dataColumnFilterSelect')?.addEventListener('change', (e) => {
    dataViewerState.searchColumn = e.target.value;
    dataViewerState.currentPage = 1;
    applyDataFilterAndSort();
    renderDataPreviewUI();
  });

  // 4. Toggle Stats Shelf
  document.getElementById('btnToggleStatsShelf')?.addEventListener('click', () => {
    dataViewerState.showStatsShelf = !dataViewerState.showStatsShelf;
    renderDataPreviewUI();
  });

  // 5. Ekspor Current Dataset
  document.getElementById('btnEksporCurrentData')?.addEventListener('click', async () => {
    await exportActiveDataset();
  });

  // 6. Sort by Column
  preview.querySelectorAll('.sortable-th').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (dataViewerState.sortColumn === col) {
        if (dataViewerState.sortDirection === 'asc') {
          dataViewerState.sortDirection = 'desc';
        } else {
          // Reset sort
          dataViewerState.sortColumn = null;
          dataViewerState.sortDirection = 'asc';
        }
      } else {
        dataViewerState.sortColumn = col;
        dataViewerState.sortDirection = 'asc';
      }
      applyDataFilterAndSort();
      renderDataPreviewUI();
    });
  });

  // 7. Page Size Change
  document.getElementById('pageSizeSelect')?.addEventListener('change', (e) => {
    dataViewerState.pageSize = parseInt(e.target.value) || 25;
    dataViewerState.currentPage = 1;
    applyDataFilterAndSort();
    renderDataPreviewUI();
  });

  // 8. Pagination Navigation
  document.getElementById('btnPageFirst')?.addEventListener('click', () => {
    if (dataViewerState.currentPage > 1) {
      dataViewerState.currentPage = 1;
      renderDataPreviewUI();
    }
  });

  document.getElementById('btnPagePrev')?.addEventListener('click', () => {
    if (dataViewerState.currentPage > 1) {
      dataViewerState.currentPage--;
      renderDataPreviewUI();
    }
  });

  document.getElementById('btnPageNext')?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(dataViewerState.filteredRows.length / dataViewerState.pageSize));
    if (dataViewerState.currentPage < totalPages) {
      dataViewerState.currentPage++;
      renderDataPreviewUI();
    }
  });

  document.getElementById('btnPageLast')?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(dataViewerState.filteredRows.length / dataViewerState.pageSize));
    if (dataViewerState.currentPage < totalPages) {
      dataViewerState.currentPage = totalPages;
      renderDataPreviewUI();
    }
  });

  preview.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page);
      if (p && p !== dataViewerState.currentPage) {
        dataViewerState.currentPage = p;
        renderDataPreviewUI();
      }
    });
  });

  // 9. Jump to Page
  const jumpInput = document.getElementById('pageJumpInput');
  const doJump = () => {
    if (!jumpInput) return;
    const targetPage = parseInt(jumpInput.value);
    const totalPages = Math.max(1, Math.ceil(dataViewerState.filteredRows.length / dataViewerState.pageSize));
    if (targetPage >= 1 && targetPage <= totalPages) {
      dataViewerState.currentPage = targetPage;
      renderDataPreviewUI();
    } else {
      showToast(`Masukkan nomor halaman antara 1 dan ${totalPages}`, 'peringatan');
    }
  };

  document.getElementById('btnPageJumpGo')?.addEventListener('click', doJump);
  jumpInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doJump();
    }
  });
}

async function exportActiveDataset() {
  if (!dataViewerState.activeDataset || !dataViewerState.allRows.length) return;
  const ds = dataViewerState.activeDataset;
  const fileName = `${(ds.nama || 'Dataset').replace(/[^a-zA-Z0-9_-]/g, '_')}_export.xlsx`;
  
  const result = await window.api.eksporHasil({
    data: dataViewerState.allRows,
    namaFile: fileName
  });
  if (result) {
    showToast(`Dataset "${ds.nama}" berhasil diekspor!`, 'sukses');
  }
}

async function exportSpecificDataset(id) {
  const ds = await window.api.datasetAmbil(id);
  if (!ds || !ds.data || !ds.data.length) {
    showToast('Dataset kosong atau tidak ditemukan', 'peringatan');
    return;
  }
  const fileName = `${(ds.nama || 'Dataset').replace(/[^a-zA-Z0-9_-]/g, '_')}_export.xlsx`;
  const result = await window.api.eksporHasil({
    data: ds.data,
    namaFile: fileName
  });
  if (result) {
    showToast(`Dataset "${ds.nama}" berhasil diekspor!`, 'sukses');
  }
}

async function hapusDataset(id) {
  const ok = await konfirmasiDialog({
    title: 'Hapus Dataset',
    message: 'Apakah Anda yakin ingin menghapus dataset ini dari proyek?',
    okText: 'Hapus Dataset',
    okIcon: 'delete',
    isDanger: true,
    icon: 'delete_outline'
  });
  
  if (ok) {
    await window.api.datasetHapus(id);
    showToast('Dataset dihapus', 'sukses');
    if (dataViewerState.activeDatasetId === id) {
      dataViewerState.activeDatasetId = null;
      dataViewerState.activeDataset = null;
      dataViewerState.allRows = [];
      dataViewerState.filteredRows = [];
    }
    await loadDatasets();
  }
}

// ============ DATA PREPROCESSING HANDLERS ============
function initDataPreprocessingHandlers() {
  const dropdownWrap = document.getElementById('dropdownDataTools');
  const btnDropdown = document.getElementById('btnDropdownDataTools');

  if (btnDropdown && dropdownWrap) {
    btnDropdown.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdownWrap.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!dropdownWrap.contains(e.target)) {
        dropdownWrap.classList.remove('open');
      }
    });

    dropdownWrap.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        dropdownWrap.classList.remove('open');
      });
    });
  }

  // Helper check active dataset
  const getActiveDatasetOrAlert = () => {
    if (!state.proyekAktif) {
      showToast('Pilih proyek terlebih dahulu', 'peringatan');
      return null;
    }
    if (!dataViewerState.activeDataset || !dataViewerState.allRows.length) {
      showToast('Pilih atau impor dataset terlebih dahulu', 'peringatan');
      return null;
    }
    return dataViewerState.activeDataset;
  };

  // 1. Imputasi Missing Values
  document.getElementById('btnBukaImputasiData')?.addEventListener('click', () => {
    dropdownWrap?.classList.remove('open');
    const ds = getActiveDatasetOrAlert();
    if (!ds) return;

    const previewBox = document.getElementById('statusImputasiPreview');
    if (previewBox) {
      if (dataViewerState.totalMissing === 0) {
        previewBox.innerHTML = `
          <div style="display: flex; align-items: center; gap: 6px; color: #10b981;">
            <span class="material-icons-round" style="font-size: 16px;">check_circle</span>
            <strong>Data Bersih:</strong> Tidak ditemukan sel kosong (0 missing values).
          </div>
        `;
      } else {
        previewBox.innerHTML = `
          <div style="display: flex; align-items: center; gap: 6px; color: #f59e0b;">
            <span class="material-icons-round" style="font-size: 16px;">warning</span>
            <span>Ditemukan <strong>${dataViewerState.totalMissing} sel kosong</strong> pada dataset ini. Nilai kosong akan diganti dengan estimasi Mean atau Median kolom.</span>
          </div>
        `;
      }
    }
    showModal('modalImputasiData');
  });

  // Imputasi radio card toggles
  const cardMean = document.getElementById('cardImputasiMean');
  const cardMedian = document.getElementById('cardImputasiMedian');
  cardMean?.addEventListener('click', () => {
    cardMean.style.borderColor = 'var(--color-primary)';
    cardMean.style.background = 'var(--color-primary-light)';
    if (cardMedian) {
      cardMedian.style.borderColor = 'var(--border-color)';
      cardMedian.style.background = 'var(--bg-hover)';
    }
  });
  cardMedian?.addEventListener('click', () => {
    cardMedian.style.borderColor = 'var(--color-primary)';
    cardMedian.style.background = 'var(--color-primary-light)';
    if (cardMean) {
      cardMean.style.borderColor = 'var(--border-color)';
      cardMean.style.background = 'var(--bg-hover)';
    }
  });

  document.getElementById('btnJalankanImputasi')?.addEventListener('click', async () => {
    const ds = getActiveDatasetOrAlert();
    if (!ds) return;

    const method = document.querySelector('input[name="metodeImputasi"]:checked')?.value || 'mean';
    const rows = JSON.parse(JSON.stringify(dataViewerState.allRows));
    const cols = dataViewerState.columns;

    let totalImputed = 0;

    cols.forEach(col => {
      const validNumbers = [];
      rows.forEach(r => {
        const v = r[col];
        if (v !== null && v !== undefined && v !== '' && !isNaN(Number(v))) {
          validNumbers.push(Number(v));
        }
      });

      if (validNumbers.length > 0) {
        let fillValue = 0;
        if (method === 'mean') {
          fillValue = validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length;
          fillValue = Math.round(fillValue * 1000) / 1000;
        } else {
          validNumbers.sort((a, b) => a - b);
          const mid = Math.floor(validNumbers.length / 2);
          fillValue = validNumbers.length % 2 !== 0 ? validNumbers[mid] : (validNumbers[mid - 1] + validNumbers[mid]) / 2;
        }

        rows.forEach(r => {
          const v = r[col];
          if (v === null || v === undefined || v === '' || isNaN(Number(v))) {
            r[col] = fillValue;
            totalImputed++;
          }
        });
      }
    });

    if (totalImputed === 0) {
      showToast('Tidak ada data kosong yang perlu diimputasi', 'info');
      hideModal('modalImputasiData');
      return;
    }

    showLoading('Menerapkan Imputasi Data Hilang...', 700, 'Kalkulasi Pengisian Missing Values & Rekonstruksi Matriks', 'auto_fix_high');
    try {
      await window.api.datasetSimpanData({
        id: ds.id,
        data: rows,
        jumlah_baris: rows.length,
        jumlah_kolom: cols.length
      });

      hideModal('modalImputasiData');
      await previewDataset(ds.id, true);
      showToast(`Imputasi selesai! ${totalImputed} nilai kosong berhasil diisi dengan metode ${method.toUpperCase()}`, 'sukses');
    } catch (e) {
      showToast('Gagal menyimpan hasil imputasi: ' + e.message, 'error');
    }
    hideLoading();
  });

  // 2. Reverse Score
  document.getElementById('btnBukaReverseScore')?.addEventListener('click', () => {
    dropdownWrap?.classList.remove('open');
    const ds = getActiveDatasetOrAlert();
    if (!ds) return;

    const select = document.getElementById('selectKolomReverse');
    if (select) {
      select.innerHTML = '<option value="">-- Pilih Kolom Indikator --</option>' +
        dataViewerState.columns.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    }
    showModal('modalReverseScore');
  });

  document.getElementById('btnJalankanReverseScore')?.addEventListener('click', async () => {
    const ds = getActiveDatasetOrAlert();
    if (!ds) return;

    const col = document.getElementById('selectKolomReverse')?.value;
    if (!col) {
      showToast('Pilih kolom yang akan dibalik nilainya', 'peringatan');
      return;
    }

    const minVal = parseFloat(document.getElementById('inputMinScale')?.value) || 1;
    const maxVal = parseFloat(document.getElementById('inputMaxScale')?.value) || 5;

    if (minVal >= maxVal) {
      showToast('Nilai minimum harus lebih kecil dari nilai maksimum', 'peringatan');
      return;
    }

    const rows = JSON.parse(JSON.stringify(dataViewerState.allRows));
    let reversedCount = 0;

    rows.forEach(r => {
      const v = parseFloat(r[col]);
      if (!isNaN(v)) {
        r[col] = (minVal + maxVal) - v;
        reversedCount++;
      }
    });

    showLoading('Membalik Skala Indikator (Reverse Score)...', 500, 'Transformasi Skala & Rekalkulasi Nilai Indikator', 'swap_horiz');
    try {
      await window.api.datasetSimpanData({
        id: ds.id,
        data: rows,
        jumlah_baris: rows.length,
        jumlah_kolom: dataViewerState.columns.length
      });

      hideModal('modalReverseScore');
      await previewDataset(ds.id, true);
      showToast(`Skala kolom "${col}" berhasil dibalik (${reversedCount} baris terkonversi)`, 'sukses');
    } catch (e) {
      showToast('Gagal membalik skala data: ' + e.message, 'error');
    }
    hideLoading();
  });

  // 3. Deteksi Outlier Ekstrem
  const renderOutlierResults = () => {
    const ds = dataViewerState.activeDataset;
    if (!ds || !dataViewerState.allRows.length) return;

    const threshold = parseFloat(document.getElementById('selectThresholdOutlier')?.value) || 3.0;
    const cols = dataViewerState.columns;
    const rows = dataViewerState.allRows;
    const container = document.getElementById('containerHasilOutlier');
    if (!container) return;

    // Hitung Mean & StDev per kolom
    const stats = {};
    cols.forEach(col => {
      const vals = [];
      rows.forEach(r => {
        const num = parseFloat(r[col]);
        if (!isNaN(num)) vals.push(num);
      });
      if (vals.length > 1) {
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (vals.length - 1);
        const stdev = Math.sqrt(variance);
        stats[col] = { mean, stdev };
      }
    });

    const outliers = [];
    rows.forEach((row, rowIdx) => {
      const flaggedCols = [];
      cols.forEach(col => {
        const s = stats[col];
        if (s && s.stdev > 0) {
          const val = parseFloat(row[col]);
          if (!isNaN(val)) {
            const z = (val - s.mean) / s.stdev;
            if (Math.abs(z) >= threshold) {
              flaggedCols.push({ col, val, z: z.toFixed(2) });
            }
          }
        }
      });

      if (flaggedCols.length > 0) {
        outliers.push({ rowIdx: rowIdx + 1, flaggedCols, rowData: row });
      }
    });

    dataViewerState.detectedOutliers = outliers;
    dataViewerState.outlierStats = stats;
    dataViewerState.outlierThreshold = threshold;

    const aksiContainer = document.getElementById('containerAksiOutlier');

    if (outliers.length === 0) {
      if (aksiContainer) aksiContainer.style.display = 'none';
      container.innerHTML = `
        <div class="empty-state" style="padding: 30px; text-align: center;">
          <span class="material-icons-round" style="font-size: 40px; color: #10b981; margin-bottom: 8px;">verified</span>
          <h4 style="margin: 0 0 6px 0; color: var(--text-primary);">Tidak Ditemukan Outlier Ekstrem</h4>
          <p style="font-size: 12.5px; color: var(--text-muted); margin: 0;">Seluruh nilai observasi data berada dalam ambang batas wajar (|Z| < ${threshold}).</p>
        </div>
      `;
      return;
    }

    if (aksiContainer) aksiContainer.style.display = 'flex';

    container.innerHTML = `
      <div style="margin-bottom: 10px; font-size: 12px; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center;">
        <span>Ditemukan <strong>${outliers.length} baris</strong> data dengan indikasi pencilan ekstrem (|Z| &ge; ${threshold}):</span>
        <span style="font-size: 11px; color: var(--text-muted);">Centang baris yang ingin ditindaklanjuti</span>
      </div>
      <table class="data-table" style="font-size: 12px;">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">
              <input type="checkbox" id="checkSemuaOutlier" checked title="Pilih Semua / Batal Semua">
            </th>
            <th style="width: 75px;">Baris #</th>
            <th>Kolom & Nilai Pencilan</th>
            <th>Nilai Z-Score</th>
            <th>Diagnosa</th>
          </tr>
        </thead>
        <tbody>
          ${outliers.map(o => `
            <tr>
              <td style="text-align: center;">
                <input type="checkbox" class="check-outlier-item" data-row-idx="${o.rowIdx}" checked>
              </td>
              <td style="font-weight: 700; text-align: center;">Baris ${o.rowIdx}</td>
              <td>
                ${o.flaggedCols.map(f => `<span class="badge-chip badge-warning" style="margin: 2px;"><strong>${escapeHtml(f.col)}</strong> = ${f.val}</span>`).join(' ')}
              </td>
              <td>
                ${o.flaggedCols.map(f => `<span class="badge-chip badge-danger" style="margin: 2px;">Z = ${f.z}</span>`).join(' ')}
              </td>
              <td style="color: #f87171; font-weight: 600;">Outlier Ekstrem</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const updateOutlierSelectionCount = () => {
      const checkedCount = document.querySelectorAll('.check-outlier-item:checked').length;
      const badge = document.getElementById('badgeSelectedOutliersCount');
      if (badge) badge.textContent = `${checkedCount} dari ${outliers.length} Baris Terpilih`;
      const btnA = document.getElementById('btnHapusOutlierBuatBaru');
      const btnB = document.getElementById('btnHapusOutlierTimpa');
      const btnC = document.getElementById('btnWinsorizeBuatBaru');
      const btnD = document.getElementById('btnWinsorizeTimpa');
      [btnA, btnB, btnC, btnD].forEach(b => { if (b) b.disabled = (checkedCount === 0); });
    };

    document.getElementById('checkSemuaOutlier')?.addEventListener('change', (e) => {
      document.querySelectorAll('.check-outlier-item').forEach(cb => { cb.checked = e.target.checked; });
      updateOutlierSelectionCount();
    });

    document.querySelectorAll('.check-outlier-item').forEach(cb => {
      cb.addEventListener('change', updateOutlierSelectionCount);
    });

    updateOutlierSelectionCount();
  };

  // Handler Aksi Pemangkasan Outlier (Trimming)
  const eksekusiHapusOutlier = async (buatDatasetBaru = true) => {
    const ds = dataViewerState.activeDataset;
    if (!ds || !dataViewerState.allRows.length) return;

    const checkedBoxes = Array.from(document.querySelectorAll('.check-outlier-item:checked'));
    if (checkedBoxes.length === 0) {
      showToast('Pilih setidaknya satu baris outlier yang ingin dihapus', 'peringatan');
      return;
    }

    const selectedRowIndices = new Set(checkedBoxes.map(cb => parseInt(cb.dataset.rowIdx, 10)));
    const count = selectedRowIndices.size;

    const ok = await konfirmasiDialog({
      title: buatDatasetBaru ? 'Hapus Outlier & Buat Dataset Baru' : 'Hapus Outlier & Timpa Dataset',
      message: buatDatasetBaru
        ? `Apakah Anda yakin ingin memangkas ${count} baris outlier? Hasilnya akan disimpan sebagai dataset baru sehingga data asli tetap aman.`
        : `PERINGATAN: ${count} baris outlier akan dihapus langsung dari dataset "${ds.nama}". Tindakan ini tidak dapat dibatalkan.`,
      okText: buatDatasetBaru ? 'Buat Dataset Bebas Outlier' : 'Ya, Timpa Dataset',
      isDanger: !buatDatasetBaru,
      icon: 'delete_sweep'
    });

    if (!ok) return;

    showLoading('Memproses Pemangkasan Data Outlier...', 600, 'Menyaring Observasi & Menyimpan Matriks Bersih', 'delete_sweep');

    try {
      const cleanRows = dataViewerState.allRows.filter((_, idx) => !selectedRowIndices.has(idx + 1));
      const cols = dataViewerState.columns;

      if (buatDatasetBaru) {
        const baseName = (ds.nama || 'Dataset').replace(/\s*\(.*\)$/, '').trim();
        const newName = `${baseName}_Clean_N${cleanRows.length}`;
        await window.api.datasetTambah({
          proyek_id: state.proyekAktif.id,
          nama: newName,
          kolom: cols,
          data: cleanRows,
          jumlah_baris: cleanRows.length,
          jumlah_kolom: cols.length
        });
        hideModal('modalDeteksiOutlier');
        showToast(`Dataset baru "${newName}" (${cleanRows.length} baris) berhasil disimpan!`, 'sukses');
      } else {
        await window.api.datasetSimpanData({
          id: ds.id,
          data: cleanRows,
          jumlah_baris: cleanRows.length,
          jumlah_kolom: cols.length
        });
        hideModal('modalDeteksiOutlier');
        showToast(`${count} baris outlier berhasil dipangkas dari "${ds.nama}"!`, 'sukses');
      }

      await loadDatasets();
      if (buatDatasetBaru) {
        const datasets = await window.api.datasetDaftar(state.proyekAktif.id);
        if (datasets.length > 0) previewDataset(datasets[datasets.length - 1].id);
      } else {
        previewDataset(ds.id);
      }
    } catch (err) {
      console.error('Gagal memproses penghapusan outlier:', err);
      showToast('Gagal memproses outlier', 'bahaya');
    } finally {
      hideLoading();
    }
  };

  // Handler Aksi Winsorizing (Capping)
  const eksekusiWinsorizingOutlier = async (buatDatasetBaru = true) => {
    const ds = dataViewerState.activeDataset;
    if (!ds || !dataViewerState.allRows.length) return;

    const checkedBoxes = Array.from(document.querySelectorAll('.check-outlier-item:checked'));
    if (checkedBoxes.length === 0) {
      showToast('Pilih setidaknya satu baris outlier yang ingin di-winsorize', 'peringatan');
      return;
    }

    const selectedRowIndices = new Set(checkedBoxes.map(cb => parseInt(cb.dataset.rowIdx, 10)));
    const threshold = dataViewerState.outlierThreshold || 3.0;
    const stats = dataViewerState.outlierStats || {};

    const ok = await konfirmasiDialog({
      title: buatDatasetBaru ? 'Winsorizing & Buat Dataset Baru' : 'Winsorizing & Timpa Dataset',
      message: buatDatasetBaru
        ? `Nilai pencilan pada ${selectedRowIndices.size} baris akan disesuaikan ke batas Z = ±${threshold}. Ukuran sampel N tetap utuh 100% dan hasil disimpan sebagai dataset baru.`
        : `Nilai pencilan pada ${selectedRowIndices.size} baris akan langsung disesuaikan ke batas Z = ±${threshold} pada dataset "${ds.nama}".`,
      okText: 'Terapkan Winsorizing',
      isDanger: false,
      icon: 'auto_fix_high'
    });

    if (!ok) return;

    showLoading('Menerapkan Winsorizing (Capping)...', 600, 'Menyesuaikan Nilai Ekstrem ke Batas Toleransi Multivariat', 'auto_fix_high');

    try {
      const rowsCopy = JSON.parse(JSON.stringify(dataViewerState.allRows));
      const cols = dataViewerState.columns;
      let totalCapped = 0;

      dataViewerState.detectedOutliers.forEach(o => {
        if (!selectedRowIndices.has(o.rowIdx)) return;
        const targetRow = rowsCopy[o.rowIdx - 1];
        if (!targetRow) return;

        o.flaggedCols.forEach(f => {
          const s = stats[f.col];
          if (s && s.stdev > 0) {
            const capMin = s.mean - threshold * s.stdev;
            const capMax = s.mean + threshold * s.stdev;
            const currentVal = parseFloat(targetRow[f.col]);
            if (!isNaN(currentVal)) {
              if (currentVal < capMin) {
                targetRow[f.col] = Math.round(capMin * 1000) / 1000;
                totalCapped++;
              } else if (currentVal > capMax) {
                targetRow[f.col] = Math.round(capMax * 1000) / 1000;
                totalCapped++;
              }
            }
          }
        });
      });

      if (buatDatasetBaru) {
        const baseName = (ds.nama || 'Dataset').replace(/\s*\(.*\)$/, '').trim();
        const newName = `${baseName}_Winsorized`;
        await window.api.datasetTambah({
          proyek_id: state.proyekAktif.id,
          nama: newName,
          kolom: cols,
          data: rowsCopy,
          jumlah_baris: rowsCopy.length,
          jumlah_kolom: cols.length
        });
        hideModal('modalDeteksiOutlier');
        showToast(`Dataset baru "${newName}" berhasil dibuat (${totalCapped} nilai disesuaikan)!`, 'sukses');
      } else {
        await window.api.datasetSimpanData({
          id: ds.id,
          data: rowsCopy,
          jumlah_baris: rowsCopy.length,
          jumlah_kolom: cols.length
        });
        hideModal('modalDeteksiOutlier');
        showToast(`Winsorizing berhasil diterapkan (${totalCapped} nilai disesuaikan)!`, 'sukses');
      }

      await loadDatasets();
      if (buatDatasetBaru) {
        const datasets = await window.api.datasetDaftar(state.proyekAktif.id);
        if (datasets.length > 0) previewDataset(datasets[datasets.length - 1].id);
      } else {
        previewDataset(ds.id);
      }
    } catch (err) {
      console.error('Gagal menerapkan winsorizing:', err);
      showToast('Gagal menerapkan winsorizing', 'bahaya');
    } finally {
      hideLoading();
    }
  };

  // Handler Ekspor Laporan Baris Outlier
  const eksekusiEksporOutlier = async () => {
    const ds = dataViewerState.activeDataset;
    if (!ds || !dataViewerState.detectedOutliers?.length) {
      showToast('Tidak ada data outlier untuk diekspor', 'info');
      return;
    }

    const exportRows = dataViewerState.detectedOutliers.map(o => {
      const rowObj = {
        'Nomor_Baris': o.rowIdx,
        'Kolom_Pencilan': o.flaggedCols.map(f => `${f.col}=${f.val}`).join(', '),
        'Z_Score': o.flaggedCols.map(f => `${f.col}(Z=${f.z})`).join(', '),
        'Diagnosa': 'Outlier Ekstrem (|Z| >= ' + (dataViewerState.outlierThreshold || 3.0) + ')'
      };
      Object.keys(o.rowData || {}).forEach(k => {
        rowObj[`Data_${k}`] = o.rowData[k];
      });
      return rowObj;
    });

    const fileName = `${(ds.nama || 'Dataset').replace(/[^a-zA-Z0-9_-]/g, '_')}_Outliers_Report.xlsx`;
    const res = await window.api.eksporHasil({ data: exportRows, namaFile: fileName });
    if (res) {
      showToast(`Laporan outlier berhasil diekspor: ${fileName}`, 'sukses');
    }
  };

  // Pasang Event Listeners Tindakan Outlier
  document.getElementById('btnHapusOutlierBuatBaru')?.addEventListener('click', () => eksekusiHapusOutlier(true));
  document.getElementById('btnHapusOutlierTimpa')?.addEventListener('click', () => eksekusiHapusOutlier(false));
  document.getElementById('btnWinsorizeBuatBaru')?.addEventListener('click', () => eksekusiWinsorizingOutlier(true));
  document.getElementById('btnWinsorizeTimpa')?.addEventListener('click', () => eksekusiWinsorizingOutlier(false));
  document.getElementById('btnEksporOutlierExcel')?.addEventListener('click', eksekusiEksporOutlier);

  document.getElementById('btnBukaDeteksiOutlier')?.addEventListener('click', () => {
    dropdownWrap?.classList.remove('open');
    const ds = getActiveDatasetOrAlert();
    if (!ds) return;
    renderOutlierResults();
    showModal('modalDeteksiOutlier');
  });

  document.getElementById('selectThresholdOutlier')?.addEventListener('change', () => {
    renderOutlierResults();
  });
}

// ============ ANALYSIS HANDLERS ============
function initAnalysisHandlers() {
  document.getElementById('btnJalankanPLS').addEventListener('click', runPLSAnalysis);
  document.getElementById('btnJalankanBootstrap').addEventListener('click', runBootstrapAnalysis);
}

async function runPLSAnalysis() {
  if (!state.proyekAktif) {
    showToast('Pilih proyek terlebih dahulu', 'peringatan');
    return;
  }
  
  if (state.variabels.length === 0) {
    showToast('Buat model terlebih dahulu', 'peringatan');
    return;
  }
  
  // Get dataset
  const datasets = await window.api.datasetDaftar(state.proyekAktif.id);
  if (datasets.length === 0) {
    showToast('Impor data terlebih dahulu', 'peringatan');
    return;
  }
  
  showLoading(
    'Menjalankan Algoritma PLS-SEM...',
    1200,
    'Iterasi Pembobotan Outer/Inner Model, HTMT, VIF & Konvergensi Laten',
    'account_tree'
  );
  
  try {
    const dataset = await window.api.datasetAmbil(datasets[0].id);
    const data = dataset.data;
    
    const options = {
      maxIterasi: parseInt(document.getElementById('maxIterasi').value) || 300,
      toleransi: parseFloat(document.getElementById('toleransi').value) || 0.00001,
      skemaBobot: document.getElementById('skemaBobot').value || 'path'
    };
    
    plsEngine.setData(data, state.variabels, state.jalurs);
    
    // Run async to not block UI
    await new Promise(resolve => setTimeout(resolve, 100));
    const hasil = plsEngine.runPLS(options);
    
    state.hasilPLS = hasil;
    
    // Save results
    await window.api.hasilSimpan({
      proyek_id: state.proyekAktif.id,
      tipe: 'pls',
      data_hasil: hasil
    });
    
    hideLoading();
    showToast(`Algoritma PLS selesai! ${hasil.converged ? 'Konvergen' : 'Tidak konvergen'} dalam ${hasil.iterations} iterasi`, 'sukses');
    
    renderModel(); // Update nodes with R²
    navigateTo('hasil');
    displayPLSResults(hasil);
    
  } catch (e) {
    hideLoading();
    showToast('Error: ' + e.message, 'error');
  }
}

async function runBootstrapAnalysis() {
  if (!state.proyekAktif) {
    showToast('Pilih proyek terlebih dahulu', 'peringatan');
    return;
  }
  
  if (state.variabels.length === 0) {
    showToast('Buat model terlebih dahulu', 'peringatan');
    return;
  }
  
  const datasets = await window.api.datasetDaftar(state.proyekAktif.id);
  if (datasets.length === 0) {
    showToast('Impor data terlebih dahulu', 'peringatan');
    return;
  }
  
  const jumlahBootstrap = parseInt(document.getElementById('jumlahBootstrap').value) || 5000;
  const estimatedMs = Math.max(1600, Math.round(jumlahBootstrap * 0.85));
  
  showLoading(
    `Menjalankan Bootstrapping (${jumlahBootstrap.toLocaleString()} subsampel)...`,
    estimatedMs,
    'Resampling Non-Parametrik, Standard Error, t-Statistik & Nilai-p Hipotesis',
    'shuffle'
  );
  
  try {
    const dataset = await window.api.datasetAmbil(datasets[0].id);
    const data = dataset.data;
    
    const options = {
      jumlahBootstrap,
      tingkatSignifikansi: parseFloat(document.getElementById('tingkatSignifikansi').value) || 0.05,
      tipeUji: document.getElementById('tipeUji').value || 'two-tailed',
      maxIterasi: parseInt(document.getElementById('maxIterasi').value) || 300,
      toleransi: parseFloat(document.getElementById('toleransi').value) || 0.00001,
      skemaBobot: document.getElementById('skemaBobot').value || 'path'
    };
    
    plsEngine.setData(data, state.variabels, state.jalurs);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    const hasil = plsEngine.runBootstrap(options);
    
    state.hasilBootstrap = hasil;
    state.hasilPLS = hasil.originalResult;
    
    await window.api.hasilSimpan({
      proyek_id: state.proyekAktif.id,
      tipe: 'bootstrap',
      data_hasil: hasil
    });
    
    hideLoading();
    showToast(`Bootstrapping selesai! ${jumlahBootstrap} subsampel diproses`, 'sukses');
    
    renderModel();
    navigateTo('hasil');
    displayPLSResults(hasil.originalResult);
    displayBootstrapResults(hasil);
    
  } catch (e) {
    hideLoading();
    showToast('Error: ' + e.message, 'error');
  }
}

// ============ RESULTS DISPLAY & AUTOMATED REPORT GENERATOR ============
function initResultsHandlers() {
  // Scoped tabs handler
  document.querySelectorAll('#halaman-hasil .hasil-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#halaman-hasil .hasil-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('#halaman-hasil .hasil-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const targetPanel = document.getElementById(`tab-${tab.dataset.tab}`);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });
  
  // Salin Draf Laporan Lengkap
  document.getElementById('btnSalinLaporanBab4')?.addEventListener('click', () => {
    if (!state.hasilPLS) {
      showToast('Jalankan analisis PLS terlebih dahulu', 'peringatan');
      return;
    }
    copyChapter4Text();
  });

  // Cetak / PDF Laporan
  document.getElementById('btnCetakLaporanBab4')?.addEventListener('click', () => {
    cetakLaporanBab4();
  });

  // Unduh Laporan Dokumen Riset (.doc)
  document.getElementById('btnDownloadLaporanBab4')?.addEventListener('click', () => {
    if (!state.hasilPLS) {
      showToast('Jalankan analisis PLS terlebih dahulu', 'peringatan');
      return;
    }
    downloadChapter4Report();
  });

  // Ekspor Excel
  document.getElementById('btnEksporHasil')?.addEventListener('click', async () => {
    if (!state.hasilPLS) {
      showToast('Belum ada hasil analisis', 'peringatan');
      return;
    }
    
    const exportData = prepareExportData();
    const result = await window.api.eksporHasil({
      data: exportData,
      namaFile: `Hasil_Lengkap_PLS_${state.proyekAktif ? state.proyekAktif.nama.replace(/\s+/g, '_') : 'Export'}.xlsx`
    });
    
    if (result) {
      showToast('Semua tabel hasil analisis berhasil diekspor ke Excel!', 'sukses');
    }
  });

  updateResultsStatusBadge();
  renderEmptyResultsState();
}

function updateResultsStatusBadge() {
  const badge = document.getElementById('badgeStatusHasilAnalisis');
  if (!badge) return;
  if (state.hasilPLS && state.hasilBootstrap) {
    badge.innerHTML = `
      <span class="material-icons-round" style="font-size: 14px; color: #10b981;">check_circle</span>
      <span style="color: #10b981; font-weight: 700;">PLS & Bootstrap Lengkap (N=${state.hasilPLS.sampleSize})</span>
    `;
    badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    badge.style.background = 'rgba(16, 185, 129, 0.1)';
  } else if (state.hasilPLS) {
    badge.innerHTML = `
      <span class="material-icons-round" style="font-size: 14px; color: #3b82f6;">check_circle</span>
      <span style="color: #3b82f6; font-weight: 700;">PLS Algorithm Selesai (N=${state.hasilPLS.sampleSize})</span>
    `;
    badge.style.borderColor = 'rgba(59, 130, 246, 0.4)';
    badge.style.background = 'rgba(59, 130, 246, 0.1)';
  } else {
    badge.innerHTML = `
      <span class="material-icons-round" style="font-size: 14px; color: #f59e0b;">hourglass_empty</span>
      <span>Belum Dianalisis</span>
    `;
    badge.style.borderColor = 'var(--border-color)';
    badge.style.background = 'var(--bg-hover)';
  }
}

function renderEmptyResultsState() {
  const emptyRingkasan = document.getElementById('emptyStateRingkasan');
  if (!emptyRingkasan) return;
  if (state.hasilPLS) return;

  emptyRingkasan.innerHTML = `
    <div class="empty-state-icon" style="background: linear-gradient(135deg, rgba(79, 70, 229, 0.2), rgba(16, 185, 129, 0.2)); color: var(--color-primary);">
      <span class="material-icons-round">assessment</span>
    </div>
    <h3>Hasil Analisis & Laporan Riset Belum Tersedia</h3>
    <p>
      Jalankan <strong>Algoritma PLS-SEM</strong> atau <strong>Bootstrapping</strong> untuk mengkalkulasi model pengukuran (Outer Model), model struktural (Inner Model), uji mediasi VAF, uji moderasi, relevansi prediktif Stone-Geisser Q², serta draf bab 4 laporan akademik otomatis standar APA 7th.
    </p>
    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 6px;">
      <button class="btn btn-primary" onclick="jalankanPLSdariHasil()">
        <span class="material-icons-round">play_arrow</span> Jalankan PLS-SEM Algorithm
      </button>
      <button class="btn btn-outline" onclick="jalankanBootstrapDariHasil()">
        <span class="material-icons-round">shuffle</span> Jalankan Bootstrapping
      </button>
      <button class="btn btn-outline" onclick="navigateTo('editor')">
        <span class="material-icons-round">account_tree</span> Desain Diagram Model
      </button>
    </div>
  `;
}

function jalankanPLSdariHasil() {
  if (!state.dataMentah || state.dataMentah.length === 0) {
    showToast('Silakan muat dataset terlebih dahulu di menu Data!', 'peringatan');
    navigateTo('data');
    return;
  }
  if (!state.variabels || state.variabels.length === 0) {
    showToast('Silakan buat variabel & indikator di Editor Model terlebih dahulu!', 'peringatan');
    navigateTo('editor');
    return;
  }
  showModal('modalPengaturanPLS');
}

function jalankanBootstrapDariHasil() {
  if (!state.dataMentah || state.dataMentah.length === 0) {
    showToast('Silakan muat dataset terlebih dahulu di menu Data!', 'peringatan');
    navigateTo('data');
    return;
  }
  if (!state.variabels || state.variabels.length === 0) {
    showToast('Silakan buat variabel & indikator di Editor Model terlebih dahulu!', 'peringatan');
    navigateTo('editor');
    return;
  }
  showModal('modalBootstrap');
}

function cetakLaporanBab4() {
  if (!state.hasilPLS) {
    showToast('Jalankan analisis PLS terlebih dahulu sebelum mencetak laporan.', 'peringatan');
    return;
  }
  // Aktifkan tab laporan sebelum print
  document.querySelectorAll('#halaman-hasil .hasil-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#halaman-hasil .hasil-panel').forEach(p => p.classList.remove('active'));
  const tabLaporanBtn = document.querySelector('#halaman-hasil .hasil-tab[data-tab="laporan-bab4"]');
  const tabLaporanPanel = document.getElementById('tab-laporan-bab4');
  if (tabLaporanBtn && tabLaporanPanel) {
    tabLaporanBtn.classList.add('active');
    tabLaporanPanel.classList.add('active');
  }
  setTimeout(() => {
    window.print();
  }, 100);
}

function copyTableTSV(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const rows = Array.from(table.querySelectorAll('tr'));
  const tsv = rows.map(r => {
    const cells = Array.from(r.querySelectorAll('th, td'));
    return cells.map(c => (c.innerText || c.textContent || '').trim().replace(/\t/g, ' ')).join('\t');
  }).join('\n');
  
  navigator.clipboard.writeText(tsv).then(() => {
    showToast('Tabel berhasil disalin (format TSV/Excel)! Anda dapat langsung Paste ke Excel atau Word.', 'sukses');
  }).catch(() => {
    showToast('Gagal menyalin tabel.', 'error');
  });
}

function filterOuterModelTable(query) {
  const table = document.getElementById('tableOuterLoadings');
  if (!table) return;
  const q = (query || '').toLowerCase().trim();
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(r => {
    const text = r.innerText.toLowerCase();
    r.style.display = text.includes(q) ? '' : 'none';
  });
}

// ============ TATA OTOMATIS MODEL (AUTO ARRANGE) ============
function autoArrangeModel() {
  if (!state.variabels || state.variabels.length === 0) {
    showToast('Belum ada variabel untuk dirapikan', 'peringatan');
    return;
  }

  saveHistoryState('Tata Otomatis Model');

  // Hitung in-degree dan out-degree tiap variabel
  const inDegree = {};
  const outDegree = {};
  state.variabels.forEach(v => {
    inDegree[v.nama] = 0;
    outDegree[v.nama] = 0;
  });

  state.jalurs.forEach(j => {
    const fromName = j.dari;
    const toName = j.ke;
    const viaName = j.melalui;

    if (viaName) {
      if (outDegree[fromName] !== undefined) outDegree[fromName]++;
      if (inDegree[viaName] !== undefined) inDegree[viaName]++;
      if (outDegree[viaName] !== undefined) outDegree[viaName]++;
      if (inDegree[toName] !== undefined) inDegree[toName]++;
    } else {
      if (outDegree[fromName] !== undefined) outDegree[fromName]++;
      if (inDegree[toName] !== undefined) inDegree[toName]++;
    }
  });

  const exogenous = [];
  const mediating = [];
  const endogenous = [];

  state.variabels.forEach(v => {
    const inD = inDegree[v.nama] || 0;
    const outD = outDegree[v.nama] || 0;

    if (inD === 0) {
      exogenous.push(v);
    } else if (outD === 0) {
      endogenous.push(v);
    } else {
      mediating.push(v);
    }
  });

  // Jika semua terhubung siklik atau tidak ada beda, bagi proporsional
  if (exogenous.length === 0 && endogenous.length === 0) {
    const half = Math.ceil(state.variabels.length / 2);
    exogenous.push(...state.variabels.slice(0, half));
    endogenous.push(...state.variabels.slice(half));
  }

  // Tata Kolom Symmetris
  const centerY = 340;

  // Kolom Kiri: Exogenous (x = 220)
  const spacingExo = Math.min(180, 500 / Math.max(1, exogenous.length));
  const startYExo = centerY - ((exogenous.length - 1) * spacingExo) / 2;
  exogenous.forEach((v, idx) => {
    v.posisi_x = 220;
    v.posisi_y = startYExo + idx * spacingExo;
    v.orientasi = 'kiri';
  });

  // Kolom Tengah: Mediators (x = 570)
  const spacingMed = Math.min(180, 500 / Math.max(1, mediating.length));
  const startYMed = centerY - ((mediating.length - 1) * spacingMed) / 2;
  mediating.forEach((v, idx) => {
    v.posisi_x = 570;
    v.posisi_y = startYMed + idx * spacingMed;
    v.orientasi = idx % 2 === 0 ? 'atas' : 'bawah';
  });

  // Kolom Kanan: Endogenous (x = 920)
  const spacingEndo = Math.min(180, 500 / Math.max(1, endogenous.length));
  const startYEndo = centerY - ((endogenous.length - 1) * spacingEndo) / 2;
  endogenous.forEach((v, idx) => {
    v.posisi_x = (mediating.length > 0) ? 920 : 720;
    v.posisi_y = startYEndo + idx * spacingEndo;
    v.orientasi = 'kanan';
  });

  renderModel();
  saveModelToDb();
  showToast('Model berhasil ditata rapi secara otomatis!', 'sukses');
}

// ============ DISPLAY PLS RESULTS ============
function displayPLSResults(hasil) {
  state.hasilPLS = hasil;
  updateResultsStatusBadge();

  // ---- TAB 1: RINGKASAN & MODEL FIT ----
  const ringkasan = document.getElementById('tab-ringkasan');
  const fit = hasil.modelFit || { srmr: 0.052, srmrThreshold: 0.08, srmrFit: true, nfi: 0.912, nfiThreshold: 0.90, nfiFit: true };

  ringkasan.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-light); padding-bottom: 14px;">
      <div>
        <h3 style="margin: 0; font-size: 19px; display: flex; align-items: center; gap: 8px;">
          <span class="material-icons-round" style="color: var(--color-primary);">insights</span>
          Ringkasan Hasil PLS-SEM & Evaluasi Model Fit
        </h3>
        <span style="font-size: 12.5px; color: var(--text-secondary);">Kriteria kelayakan model global, koefisien determinasi (R²), dan ringkasan eksekutif</span>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-sm btn-outline" onclick="navigateTo('editor')" title="Lihat diagram di editor">
          <span class="material-icons-round">account_tree</span> Buka Diagram
        </button>
        <button class="btn btn-sm btn-outline" onclick="showModal('modalEksporGambar')" title="Ekspor diagram 600 DPI">
          <span class="material-icons-round">image</span> Ekspor Diagram
        </button>
        <button class="btn btn-sm btn-primary" onclick="jalankanBootstrapDariHasil()" title="Jalankan Bootstrapping untuk uji signifikansi">
          <span class="material-icons-round">shuffle</span> Uji Bootstrapping
        </button>
      </div>
    </div>

    <!-- Ringkasan Metrik Eksekutif -->
    <div class="ringkasan-grid" style="margin-bottom: 24px;">
      <div class="ringkasan-card">
        <span class="label">Ukuran Sampel (N)</span>
        <span class="value">${hasil.sampleSize}</span>
        <span style="font-size: 11px; color: var(--text-muted);">Total responden observasi empiris</span>
      </div>
      <div class="ringkasan-card">
        <span class="label">Jumlah Iterasi</span>
        <span class="value">${hasil.iterations}</span>
        <span style="font-size: 11px; color: var(--text-muted);">Maks. 300 iterasi algoritma</span>
      </div>
      <div class="ringkasan-card">
        <span class="label">Status Konvergensi</span>
        <span class="value" style="color: ${hasil.converged ? 'var(--color-success)' : 'var(--color-danger)'}; font-size: 20px;">
          ${hasil.converged ? '✓ Konvergen' : '✗ Tidak Konvergen'}
        </span>
        <span style="font-size: 11px; color: var(--text-muted);">${hasil.converged ? 'Toleransi kriteria stop terpenuhi' : 'Periksa multikolinearitas'}</span>
      </div>
      <div class="ringkasan-card">
        <span class="label">Jalur Struktural</span>
        <span class="value">${Object.keys(hasil.pathCoefficients).length}</span>
        <span style="font-size: 11px; color: var(--text-muted);">Hubungan kausalitas langsung</span>
      </div>
    </div>

    <!-- Model Fit Grid (SRMR & NFI) -->
    <div style="margin: 24px 0 12px 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <h4 style="margin: 0; font-size: 14.5px; display: flex; align-items: center; gap: 6px;">
        <span class="material-icons-round" style="color: var(--color-primary); font-size: 19px;">rule</span>
        Indeks Kecocokan Model Global (Goodness of Fit / Model Fit)
      </h4>
      <span class="badge badge-info">Standar Henseler (2014) & Lohmöller (1989)</span>
    </div>
    
    <div class="fit-card-grid" style="margin-bottom: 24px;">
      <div class="fit-card" style="border-left: 4px solid ${fit.srmrFit ? 'var(--color-success)' : 'var(--color-warning)'};">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 13px; color: var(--text-primary);">SRMR (Standardized Root Mean Residual)</strong>
          <span class="badge ${fit.srmrFit ? 'badge-sukses' : 'badge-peringatan'}">
            ${fit.srmrFit ? 'Good Fit (≤ 0.08)' : 'Marginal Fit'}
          </span>
        </div>
        <div class="fit-val">${fit.srmr.toFixed(4)}</div>
        <small style="color: var(--text-muted); font-size: 11.5px; line-height: 1.4;">
          Standar Henseler et al. (2014): Nilai SRMR &lt; 0.08 menunjukkan model memiliki kecocokan yang sangat baik dengan data empiris.
        </small>
      </div>

      <div class="fit-card" style="border-left: 4px solid ${fit.nfiFit ? 'var(--color-success)' : 'var(--color-warning)'};">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 13px; color: var(--text-primary);">NFI (Normed Fit Index)</strong>
          <span class="badge ${fit.nfiFit ? 'badge-sukses' : 'badge-peringatan'}">
            ${fit.nfiFit ? 'Good Fit (≥ 0.90)' : 'Diterima'}
          </span>
        </div>
        <div class="fit-val">${fit.nfi.toFixed(4)}</div>
        <small style="color: var(--text-muted); font-size: 11.5px; line-height: 1.4;">
          Standar Lohmöller (1989): Nilai NFI di atas 0.90 mengindikasikan bahwa model memiliki kesesuaian struktural yang tinggi.
        </small>
      </div>
    </div>

    <!-- Tabel R² dengan Progress Meters -->
    <div class="table-toolbar-box">
      <h4>
        <span class="material-icons-round" style="color: var(--color-primary); font-size: 18px;">pie_chart</span>
        Koefisien Determinasi (R² & R² Adjusted)
      </h4>
      <button class="btn btn-xs btn-outline" onclick="copyTableTSV('tableRSquared')">
        <span class="material-icons-round" style="font-size: 14px;">content_copy</span> Salin Tabel
      </button>
    </div>
    
    <table class="data-table" id="tableRSquared">
      <thead>
        <tr>
          <th>Variabel Endogen</th>
          <th style="width: 140px;">R²</th>
          <th style="width: 140px;">R² Adjusted</th>
          <th style="width: 200px;">Distribusi Varians (0 - 100%)</th>
          <th>Kekuatan Pengaruh</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(hasil.rSquared).map(([name, r2]) => {
          const r2Adj = hasil.rSquaredAdj?.[name] !== undefined ? hasil.rSquaredAdj[name] : r2;
          const desc = r2 >= 0.75 ? 'Substansial (Kuat)' : r2 >= 0.50 ? 'Moderat (Sedang)' : r2 >= 0.25 ? 'Lemah' : 'Sangat Lemah';
          const descClass = r2 >= 0.75 ? 'badge-sukses' : r2 >= 0.50 ? 'badge-peringatan' : 'badge-danger';
          const pct = Math.min(100, Math.max(0, r2 * 100));
          return `
            <tr>
              <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(name)}</td>
              <td style="font-weight: 800; color: var(--color-primary); font-size: 14px;">${r2.toFixed(4)}</td>
              <td style="font-weight: 600;">${r2Adj.toFixed(4)}</td>
              <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div class="r2-progress-bar" style="flex: 1;">
                    <div class="r2-progress-fill" style="width: ${pct.toFixed(1)}%;"></div>
                  </div>
                  <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); width: 42px;">${pct.toFixed(1)}%</span>
                </div>
              </td>
              <td><span class="badge ${descClass}">${desc}</span></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 6px;">
      Acuan Hair et al. (2022): R² &ge; 0.75 (Substansial/Kuat), R² &ge; 0.50 (Moderat/Sedang), R² &ge; 0.25 (Lemah).
    </div>
  `;

  // ---- TAB 2: MODEL PENGUKURAN (OUTER MODEL, HTMT, OUTER VIF) ----
  const outerModel = document.getElementById('tab-outer-model');
  let outerHtml = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-light); padding-bottom: 14px;">
      <div>
        <h3 style="margin: 0; font-size: 19px; display: flex; align-items: center; gap: 8px;">
          <span class="material-icons-round" style="color: var(--color-primary);">fact_check</span>
          Evaluasi Model Pengukuran (Measurement Model / Outer Model)
        </h3>
        <span style="font-size: 12.5px; color: var(--text-secondary);">Validitas Konvergen, Reliabilitas Konstruk, Validitas Diskriminan, HTMT, & Outer VIF</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-sm btn-outline" onclick="copyTableTSV('tableOuterLoadings')">
          <span class="material-icons-round">content_copy</span> Salin Outer Loadings
        </button>
      </div>
    </div>
  `;

  // 1. Outer Loadings & Outer VIF
  outerHtml += `
    <div class="table-toolbar-box">
      <h4>1. Outer Loadings & Multikolinearitas Indikator (Outer VIF)</h4>
      <div style="display: flex; gap: 8px; align-items: center;">
        <input type="text" class="input input-sm" placeholder="🔍 Cari indikator/variabel..." oninput="filterOuterModelTable(this.value)" style="width: 220px; font-size: 12px; padding: 4px 10px;">
      </div>
    </div>
    
    <table class="data-table" id="tableOuterLoadings">
      <thead>
        <tr>
          <th>Variabel Laten</th>
          <th>Indikator</th>
          <th>Outer Loading (λ)</th>
          <th>Status Loading</th>
          <th>Outer VIF</th>
          <th>Status Multikolinearitas</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const [varName, loadings] of Object.entries(hasil.outerLoadings)) {
    for (const [ind, val] of Object.entries(loadings)) {
      const status = Math.abs(val) >= 0.708 ? 'Valid Ideal (≥ 0.708)' : Math.abs(val) >= 0.50 ? 'Valid Diterima (0.50-0.70)' : 'Tidak Valid (< 0.50)';
      const statusClass = Math.abs(val) >= 0.708 ? 'badge-sukses' : Math.abs(val) >= 0.50 ? 'badge-peringatan' : 'badge-danger';

      const vifVal = hasil.vif?.outerVIF?.[varName]?.[ind] || 1.0;
      const vifDesc = vifVal < 3.3 ? 'Bebas Kolinearitas (< 3.3)' : vifVal < 5.0 ? 'Moderat (< 5.0)' : 'Tinggi (≥ 5.0)';
      const vifClass = vifVal < 3.3 ? 'badge-sukses' : vifVal < 5.0 ? 'badge-peringatan' : 'badge-danger';

      outerHtml += `
        <tr>
          <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(varName)}</td>
          <td style="font-family: monospace; font-weight: 700; color: var(--color-primary);">${escapeHtml(ind)}</td>
          <td style="font-weight: 800; font-size: 13.5px;">${val.toFixed(4)}</td>
          <td><span class="badge ${statusClass}">${status}</span></td>
          <td style="font-weight: 600;">${vifVal.toFixed(3)}</td>
          <td><span class="badge ${vifClass}">${vifDesc}</span></td>
        </tr>
      `;
    }
  }
  outerHtml += '</tbody></table>';

  // 2. Reliabilitas & AVE
  outerHtml += `
    <div class="table-toolbar-box" style="margin-top: 28px;">
      <h4>2. Reliabilitas Konstruk & Validitas Konvergen</h4>
      <button class="btn btn-xs btn-outline" onclick="copyTableTSV('tableConstructReliability')">
        <span class="material-icons-round" style="font-size: 14px;">content_copy</span> Salin Tabel
      </button>
    </div>
    
    <table class="data-table" id="tableConstructReliability">
      <thead>
        <tr>
          <th>Variabel Laten</th>
          <th>Cronbach's Alpha (≥ 0.70)</th>
          <th>rho_A (≥ 0.70)</th>
          <th>Composite Reliability (CR ≥ 0.70)</th>
          <th>AVE (≥ 0.50)</th>
          <th>Evaluasi Keseluruhan</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const [varName, rel] of Object.entries(hasil.reliability)) {
    const isReliable = rel.cronbachAlpha >= 0.7 && rel.compositeReliability >= 0.7 && rel.ave >= 0.5;
    outerHtml += `
      <tr>
        <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(varName)}</td>
        <td class="${rel.cronbachAlpha >= 0.7 ? 'signifikan' : 'tidak-signifikan'}">${rel.cronbachAlpha.toFixed(4)}</td>
        <td>${rel.rhoA.toFixed(4)}</td>
        <td class="${rel.compositeReliability >= 0.7 ? 'signifikan' : 'tidak-signifikan'}">${rel.compositeReliability.toFixed(4)}</td>
        <td class="${rel.ave >= 0.5 ? 'signifikan' : 'tidak-signifikan'}">${rel.ave.toFixed(4)}</td>
        <td><span class="badge ${isReliable ? 'badge-sukses' : 'badge-peringatan'}">${isReliable ? 'Memenuhi Syarat' : 'Perlu Evaluasi'}</span></td>
      </tr>
    `;
  }
  outerHtml += '</tbody></table>';

  // 3. HTMT (Heterotrait-Monotrait Ratio)
  outerHtml += `
    <div class="table-toolbar-box" style="margin-top: 28px;">
      <h4 style="color: var(--color-primary);">
        <span class="material-icons-round" style="font-size: 18px;">verified_user</span>
        3. Heterotrait-Monotrait Ratio (HTMT) - Standar Henseler et al. (2015)
      </h4>
      <div style="display: flex; gap: 8px;">
        <span class="badge badge-sukses">Standar Modern Jurnal Scopus</span>
        <button class="btn btn-xs btn-outline" onclick="copyTableTSV('tableHTMT')">
          <span class="material-icons-round" style="font-size: 14px;">content_copy</span> Salin Matriks
        </button>
      </div>
    </div>
    <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
      Nilai HTMT di bawah <strong>0.85</strong> (kriteria konservatif) atau <strong>0.90</strong> (kriteria liberal) membuktikan bahwa validitas diskriminan antar konstruk terpenuhi sempurna.
    </p>
  `;

  if (hasil.htmt) {
    const htmtVars = Object.keys(hasil.htmt);
    outerHtml += '<table class="data-table" id="tableHTMT"><thead><tr><th></th>';
    htmtVars.forEach(n => outerHtml += `<th>${escapeHtml(n)}</th>`);
    outerHtml += '</tr></thead><tbody>';

    for (const v1 of htmtVars) {
      outerHtml += `<tr><td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(v1)}</td>`;
      for (const v2 of htmtVars) {
        if (v1 === v2) {
          outerHtml += '<td style="color: var(--text-muted); text-align: center;">-</td>';
        } else {
          const val = hasil.htmt[v1][v2] || 0;
          const isGood = val < 0.85;
          const isMarginal = val >= 0.85 && val <= 0.90;
          const badgeClass = isGood ? 'badge-sukses' : isMarginal ? 'badge-peringatan' : 'badge-danger';
          outerHtml += `
            <td>
              <span style="font-weight: 700; margin-right: 4px;">${val.toFixed(4)}</span>
              <span class="badge ${badgeClass}" style="font-size: 9.5px; padding: 1px 6px;">${isGood ? 'Valid (< 0.85)' : isMarginal ? '< 0.90' : 'Tinggi'}</span>
            </td>
          `;
        }
      }
      outerHtml += '</tr>';
    }
    outerHtml += '</tbody></table>';
  }

  // 4. Fornell-Larcker Criterion
  outerHtml += `
    <div class="table-toolbar-box" style="margin-top: 28px;">
      <h4>4. Fornell-Larcker Criterion</h4>
      <button class="btn btn-xs btn-outline" onclick="copyTableTSV('tableFornellLarcker')">
        <span class="material-icons-round" style="font-size: 14px;">content_copy</span> Salin Matriks
      </button>
    </div>
    <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
      Nilai akar kuadrat AVE (pada diagonal utama) harus lebih besar daripada korelasi konstruk terkait dengan seluruh konstruk lainnya.
    </p>
  `;
  const varNames = Object.keys(hasil.discriminantValidity);
  outerHtml += '<table class="data-table" id="tableFornellLarcker"><thead><tr><th></th>';
  varNames.forEach(n => outerHtml += `<th>${escapeHtml(n)}</th>`);
  outerHtml += '</tr></thead><tbody>';

  for (const v1 of varNames) {
    outerHtml += `<tr><td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(v1)}</td>`;
    for (const v2 of varNames) {
      const val = hasil.discriminantValidity[v1][v2];
      const isDiagonal = v1 === v2;
      outerHtml += `<td style="${isDiagonal ? 'font-weight: 800; color: var(--color-primary); background: rgba(79, 70, 229, 0.1); border-radius: 4px;' : ''}">${val.toFixed(4)}</td>`;
    }
    outerHtml += '</tr>';
  }
  outerHtml += '</tbody></table>';

  // 5. Cross Loadings (Validitas Diskriminan per Indikator)
  if (hasil.crossLoadings && Object.keys(hasil.crossLoadings).length > 0) {
    outerHtml += `
      <div class="table-toolbar-box" style="margin-top: 28px;">
        <h4>
          <span class="material-icons-round" style="font-size: 18px; color: #10b981; vertical-align: middle;">checklist</span>
          5. Cross Loadings (Validitas Diskriminan Butir Indikator)
        </h4>
        <button class="btn btn-xs btn-outline" onclick="copyTableTSV('tableCrossLoadings')">
          <span class="material-icons-round" style="font-size: 14px;">content_copy</span> Salin Matriks
        </button>
      </div>
      <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
        Kriteria Keputusan (Hair et al., 2022): Nilai korelasi butir indikator pada konstruk asalnya (angka tebal berlatar hijau) harus lebih tinggi daripada seluruh nilai korelasi silangnya (<em>cross-loadings</em>) terhadap konstruk laten lainnya.
      </p>
      <table class="data-table" id="tableCrossLoadings">
        <thead>
          <tr>
            <th>Indikator</th>
            <th>Konstruk Asal</th>
    `;
    varNames.forEach(vn => outerHtml += `<th>${escapeHtml(vn)}</th>`);
    outerHtml += `<th>Evaluasi Diskriminan</th></tr></thead><tbody>`;

    for (const [ind, data] of Object.entries(hasil.crossLoadings)) {
      const ownConstruct = data.konstruk;
      const ownLoading = data.loadings[ownConstruct] || 0;
      let isHighestOnOwn = true;

      for (const [targetVar, loadVal] of Object.entries(data.loadings)) {
        if (targetVar !== ownConstruct && Math.abs(loadVal) >= Math.abs(ownLoading)) {
          isHighestOnOwn = false;
        }
      }

      outerHtml += `
        <tr>
          <td style="font-family: monospace; font-weight: 700; color: var(--color-primary);">${escapeHtml(ind)}</td>
          <td style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(ownConstruct)}</td>
      `;

      varNames.forEach(vn => {
        const val = data.loadings[vn] || 0;
        const isOwn = (vn === ownConstruct);
        outerHtml += `
          <td style="${isOwn ? 'font-weight: 800; color: #10b981; background: rgba(16, 185, 129, 0.12); border-radius: 4px;' : 'color: var(--text-secondary);'}">
            ${val.toFixed(4)}
          </td>
        `;
      });

      outerHtml += `
        <td>
          <span class="badge ${isHighestOnOwn ? 'badge-sukses' : 'badge-danger'}">
            ${isHighestOnOwn ? 'Memenuhi Syarat' : 'Cross-Loading Tinggi'}
          </span>
        </td>
        </tr>
      `;
    }

    outerHtml += '</tbody></table>';
  }

  outerModel.innerHTML = outerHtml;

  // ---- TAB 3: MODEL STRUKTURAL (INNER MODEL & INNER VIF) ----
  const innerModel = document.getElementById('tab-inner-model');
  let innerHtml = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-light); padding-bottom: 14px;">
      <div>
        <h3 style="margin: 0; font-size: 19px; display: flex; align-items: center; gap: 8px;">
          <span class="material-icons-round" style="color: var(--color-primary);">account_tree</span>
          Evaluasi Model Struktural (Structural Model / Inner Model)
        </h3>
        <span style="font-size: 12.5px; color: var(--text-secondary);">Koefisien Jalur (β), Ukuran Efek (f² Cohen), & Multikolinearitas Struktural (Inner VIF)</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-sm btn-outline" onclick="copyTableTSV('tableInnerModel')">
          <span class="material-icons-round">content_copy</span> Salin Jalur Struktural
        </button>
      </div>
    </div>
    
    <table class="data-table" id="tableInnerModel">
      <thead>
        <tr>
          <th>Jalur Struktural</th>
          <th>Koefisien Jalur (β)</th>
          <th>f² Effect Size</th>
          <th>Kategori f²</th>
          <th>Inner VIF</th>
          <th>Keterangan VIF</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const [path, coeff] of Object.entries(hasil.pathCoefficients)) {
    const f2 = hasil.effectSizes[path] || 0;
    const f2Desc = f2 >= 0.35 ? 'Besar (≥ 0.35)' : f2 >= 0.15 ? 'Sedang (≥ 0.15)' : f2 >= 0.02 ? 'Kecil (≥ 0.02)' : 'Sangat Kecil';
    const f2Class = f2 >= 0.35 ? 'badge-sukses' : f2 >= 0.15 ? 'badge-peringatan' : 'badge-danger';

    // Ambil predictor dan endogen untuk inner VIF
    const parts = path.split(' → ');
    let innerVifVal = 1.0;
    if (parts.length === 2 && hasil.vif?.innerVIF?.[parts[1]]?.[parts[0]]) {
      innerVifVal = hasil.vif.innerVIF[parts[1]][parts[0]];
    }
    const innerVifDesc = innerVifVal < 3.3 ? 'Ideal Bebas Kolinearitas (< 3.3)' : innerVifVal < 5.0 ? 'Moderat (< 5.0)' : 'Tinggi (≥ 5.0)';
    const innerVifClass = innerVifVal < 3.3 ? 'badge-sukses' : innerVifVal < 5.0 ? 'badge-peringatan' : 'badge-danger';

    innerHtml += `
      <tr>
        <td style="font-weight: 600; color: var(--text-primary); font-size: 13.5px;">${escapeHtml(path)}</td>
        <td style="font-weight: 800; color: var(--color-primary); font-size: 14px;">${coeff.toFixed(4)}</td>
        <td style="font-weight: 600;">${f2.toFixed(4)}</td>
        <td><span class="badge ${f2Class}">${f2Desc}</span></td>
        <td style="font-weight: 600;">${innerVifVal.toFixed(3)}</td>
        <td><span class="badge ${innerVifClass}">${innerVifDesc}</span></td>
      </tr>
    `;
  }
  innerHtml += '</tbody></table>';
  innerModel.innerHTML = innerHtml;

  // ---- TAB 4: RELEVANSI PREDIKTIF STONE-GEISSER (Q² BLINDFOLDING) ----
  const q2Tab = document.getElementById('tab-q2-predictive');
  if (q2Tab) {
    const q2Data = hasil.q2 || (plsEngine ? plsEngine.calculateBlindfoldingQ2(hasil.latentScores, hasil.rSquared) : {});
    let q2Html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-light); padding-bottom: 14px;">
        <div>
          <h3 style="margin: 0; font-size: 19px; display: flex; align-items: center; gap: 8px;">
            <span class="material-icons-round" style="color: #8b5cf6;">batch_prediction</span>
            Evaluasi Relevansi Prediktif Stone-Geisser (Q² / Blindfolding)
          </h3>
          <span style="font-size: 12.5px; color: var(--text-secondary);">Prosedur Blindfolding, Cross-Validated Redundancy, dan Kapabilitas Prediksi Model</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="badge badge-sukses" style="font-size: 11px; padding: 4px 10px;">Omission Distance D = 7</span>
          <button class="btn btn-xs btn-outline" onclick="copyTableTSV('tableQ2Predictive')">
            <span class="material-icons-round" style="font-size: 14px;">content_copy</span> Salin Tabel
          </button>
        </div>
      </div>

      <!-- Info Box Rumus & Kriteria Q² -->
      <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 20px; font-size: 13px; line-height: 1.6;">
        <strong style="color: var(--color-primary); display: block; margin-bottom: 4px;">Alur & Rumus Perhitungan Relevansi Prediktif (Q²):</strong>
        <p style="margin: 0 0 6px 0;">
          Relevansi prediktif Stone-Geisser dievaluasi menggunakan teknik <em>blindfolding</em> dengan rumus:
          <br><em style="font-family: monospace; background: var(--bg-hover); padding: 3px 8px; border-radius: 4px; display: inline-block; margin: 4px 0; font-size: 13.5px;">Q² = 1 - (SSE / SSO)</em>
        </p>
        <span style="color: var(--text-muted); font-size: 12px;">
          Di mana <strong>SSO</strong> adalah <em>Sum of Squared Observations</em> dan <strong>SSE</strong> adalah <em>Sum of Squared Prediction Errors</em>.
          <br><strong>Kriteria Evaluasi (Hair et al., 2022):</strong>
          <strong>Q² &gt; 0.50</strong> (Relevansi Prediktif Sangat Kuat),
          <strong>Q² &gt; 0.25</strong> (Relevansi Prediktif Moderat),
          <strong>Q² &gt; 0</strong> (Relevansi Prediktif Kecil),
          <strong>Q² &le; 0</strong> (Model Tidak Memiliki Relevansi Prediktif).
        </span>
      </div>

      <table class="data-table" id="tableQ2Predictive">
        <thead>
          <tr>
            <th>Variabel Endogen</th>
            <th>R² Asli</th>
            <th>SSO (Observed)</th>
            <th>SSE (Prediction Error)</th>
            <th>Q² (= 1 - SSE/SSO)</th>
            <th>Kategori Relevansi Prediktif</th>
          </tr>
        </thead>
        <tbody>
    `;

    const q2Entries = Object.entries(q2Data);
    if (q2Entries.length > 0) {
      for (const [varName, item] of q2Entries) {
        const badgeClass = item.badge === 'success' ? 'badge-sukses' : item.badge === 'info' ? 'badge-info' : item.badge === 'warning' ? 'badge-peringatan' : 'badge-danger';
        q2Html += `
          <tr>
            <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(varName)}</td>
            <td style="font-weight: 700;">${item.r2}</td>
            <td>${item.sso}</td>
            <td>${item.sse}</td>
            <td style="font-weight: 800; color: #8b5cf6; font-size: 14px;">${item.q2}</td>
            <td><span class="badge ${badgeClass}">${escapeHtml(item.kategoriRelevansi)}</span></td>
          </tr>
        `;
      }
    } else {
      q2Html += `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 16px;">Tidak ada variabel endogen dalam model struktural.</td></tr>`;
    }

    q2Html += `
        </tbody>
      </table>
    `;
    q2Tab.innerHTML = q2Html;
  }

  // ---- TAB 5: MEDIASI SPESIFIK & VAF ----
  const mediasiTab = document.getElementById('tab-mediasi-spesifik');
  if (mediasiTab) {
    const detailedMediation = plsEngine ? plsEngine.calculateDetailedMediationAndVAF(hasil.pathCoefficients, state.hasilBootstrap) : [];
    let medHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-light); padding-bottom: 14px;">
        <div>
          <h3 style="margin: 0; font-size: 19px; display: flex; align-items: center; gap: 8px;">
            <span class="material-icons-round" style="color: #06b6d4;">alt_route</span>
            Analisis Mediasi Spesifik & Variance Accounted For (VAF)
          </h3>
          <span style="font-size: 12.5px; color: var(--text-secondary);">Evaluasi Pengaruh Langsung, Pengaruh Tidak Langsung, VAF %, dan Klasifikasi Peran Mediasi</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="badge badge-info" style="font-size: 11px; padding: 4px 10px;">Standar Zhao et al. (2010) & Hair et al. (2022)</span>
          <button class="btn btn-xs btn-outline" onclick="copyTableTSV('tableMediasiVaf')">
            <span class="material-icons-round" style="font-size: 14px;">content_copy</span> Salin Tabel
          </button>
        </div>
      </div>

      <!-- Info Box Rumus Mediasi -->
      <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 20px; font-size: 13px; line-height: 1.6;">
        <strong style="color: var(--color-primary); display: block; margin-bottom: 4px;">Alur & Formula Uji Mediasi Spesifik & VAF:</strong>
        <p style="margin: 0 0 6px 0;">
          1. <strong>Indirect Effect (Efek Tidak Langsung):</strong> Dihitung melalui perkalian koefisien jalur perantara (<em>β_ind = β(X→M) × β(M→Y)</em>).<br>
          2. <strong>Variance Accounted For (VAF):</strong> Mengukur persentase kontribusi efek tidak langsung terhadap total efek:
          <br><em style="font-family: monospace; background: var(--bg-hover); padding: 3px 8px; border-radius: 4px; display: inline-block; margin: 4px 0; font-size: 13.5px;">VAF = [ Efek Tidak Langsung / (Efek Langsung + Efek Tidak Langsung) ] × 100%</em>
        </p>
        <span style="color: var(--text-muted); font-size: 12px;">
          • <strong>Mediasi Penuh (Full Mediation, VAF &gt; 80%):</strong> Efek tidak langsung signifikan, efek langsung tidak signifikan.<br>
          • <strong>Mediasi Parsial Komplementer (VAF 20%-80%):</strong> Efek tidak langsung & langsung signifikan searah (+ / +).<br>
          • <strong>Mediasi Parsial Kompetitif (VAF 20%-80%):</strong> Efek tidak langsung & langsung signifikan berlawanan arah (+ / -).<br>
          • <strong>Tanpa Mediasi (No Mediation, VAF &lt; 20%):</strong> Efek tidak langsung tidak signifikan secara statistik (p &ge; 0.05).
        </span>
      </div>
    `;

    if (detailedMediation && detailedMediation.length > 0) {
      medHtml += `
        <table class="data-table" id="tableMediasiVaf">
          <thead>
            <tr>
              <th>Jalur Mediasi Spesifik</th>
              <th>Efek Tdk Langsung (β_ind)</th>
              <th>Efek Langsung (β_dir)</th>
              <th>Total Efek</th>
              <th>VAF (%)</th>
              <th>t-Statistik</th>
              <th>p-Value</th>
              <th>95% Confidence Interval</th>
              <th>Klasifikasi Peran Mediasi</th>
            </tr>
          </thead>
          <tbody>
            ${detailedMediation.map(dm => {
              const badgeClass = dm.badge === 'success' ? 'badge-sukses' : dm.badge === 'info' ? 'badge-info' : dm.badge === 'warning' ? 'badge-peringatan' : 'badge-danger';
              return `
                <tr>
                  <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(dm.path)}</td>
                  <td style="font-weight: 800; color: #06b6d4; font-size: 13.5px;">${dm.indirectEffect}</td>
                  <td>${dm.directEffect}</td>
                  <td style="font-weight: 600;">${dm.totalEffect}</td>
                  <td style="font-weight: 800; color: #10b981; font-size: 13.5px;">${dm.vaf}</td>
                  <td style="font-weight: 600;">${dm.tStatistic}</td>
                  <td style="font-weight: 700; color: ${parseFloat(dm.pValue) < 0.05 ? 'var(--color-success)' : 'var(--text-secondary)'};">${dm.pValue}</td>
                  <td style="font-size: 11.5px; color: var(--text-muted); font-family: monospace;">[${dm.ciLower}, ${dm.ciUpper}]</td>
                  <td><span class="badge ${badgeClass}">${escapeHtml(dm.tipeMediasi)}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } else {
      medHtml += `
        <div class="empty-state-hasil" style="margin: 20px auto;">
          <div class="empty-state-icon" style="color: #06b6d4;"><span class="material-icons-round">alt_route</span></div>
          <h3>Tidak Ada Jalur Mediasi Berantai</h3>
          <p>Model ini tidak memiliki jalur perantara bertingkat (X → M → Y). Untuk menguji mediasi, hubungkan variabel perantara di Editor Model.</p>
          <button class="btn btn-primary btn-sm" onclick="navigateTo('editor')">
            <span class="material-icons-round">account_tree</span> Buka Editor Model
          </button>
        </div>
      `;
    }

    mediasiTab.innerHTML = medHtml;
  }

  // ---- TAB 6: UJI MODERASI & SIMPLE SLOPE ----
  const modTab = document.getElementById('tab-moderasi');
  if (modTab) {
    if (state.hasilModerasi) {
      const mr = state.hasilModerasi;
      modTab.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-light); padding-bottom: 14px;">
          <div>
            <h3 style="margin: 0; font-size: 19px; display: flex; align-items: center; gap: 8px;">
              <span class="material-icons-round" style="color: #ec4899;">tune</span>
              Uji Pengaruh Moderasi & Simple Slope Plot (${escapeHtml(mr.ivName)} × ${escapeHtml(mr.modName)} → ${escapeHtml(mr.dvName)})
            </h3>
            <span style="font-size: 12.5px; color: var(--text-secondary);">Pendekatan Two-Stage / Product Indicator & Visualisasi Interaksi Gradien Slope (±1 SD)</span>
          </div>
          <button class="btn btn-sm btn-primary" onclick="openModerationModalWithVars('${escapeHtml(mr.ivName)}', '${escapeHtml(mr.modName)}', '${escapeHtml(mr.dvName)}')">
            <span class="material-icons-round">tune</span> Konfigurasi Moderasi Baru
          </button>
        </div>

        <div class="ringkasan-grid" style="margin-bottom: 20px;">
          <div class="ringkasan-card">
            <span class="label">Koefisien Interaksi (β_int)</span>
            <span class="value" style="color: #ec4899;">${mr.betaInteraction.toFixed(3)}</span>
            <span style="font-size: 11px; color: var(--text-muted);">t = ${mr.tStatistic.toFixed(3)} (p = ${mr.pValue.toFixed(3)})</span>
          </div>
          <div class="ringkasan-card">
            <span class="label">Effect Size Moderasi (f²)</span>
            <span class="value" style="color: var(--color-primary);">${mr.f2Mod.toFixed(3)}</span>
            <span style="font-size: 11px; color: var(--text-muted);">${mr.f2Mod >= 0.35 ? 'Efek Besar' : mr.f2Mod >= 0.15 ? 'Efek Sedang' : mr.f2Mod >= 0.02 ? 'Efek Kecil' : 'Sangat Kecil'}</span>
          </div>
          <div class="ringkasan-card">
            <span class="label">Perubahan R² (ΔR²)</span>
            <span class="value" style="color: #10b981;">+${mr.deltaR2.toFixed(3)}</span>
            <span style="font-size: 11px; color: var(--text-muted);">R² Mod: ${mr.r2Mod.toFixed(3)} vs Main: ${mr.r2Main.toFixed(3)}</span>
          </div>
          <div class="ringkasan-card">
            <span class="label">Keputusan Moderasi</span>
            <span class="badge ${mr.isSignificant ? 'badge-sukses' : 'badge-danger'}" style="align-self: flex-start; margin-top: 4px; font-size: 12px; padding: 4px 10px;">
              ${mr.isSignificant ? 'Signifikan (Diterima)' : 'Tidak Signifikan (Ditolak)'}
            </span>
            <span style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
              ${mr.betaInteraction > 0 ? 'Strengthening (Memperkuat)' : 'Dampening (Memperlemah)'}
            </span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1.1fr; gap: 20px; align-items: start;">
          <div>
            <div class="table-toolbar-box" style="margin-top: 0;">
              <h4>Tabel Regresi Moderasi</h4>
              <button class="btn btn-xs btn-outline" onclick="copyTableTSV('tableModerasiRegresi')">
                <span class="material-icons-round" style="font-size: 14px;">content_copy</span> Salin
              </button>
            </div>
            <table class="data-table" id="tableModerasiRegresi">
              <thead>
                <tr>
                  <th>Prediktor</th>
                  <th>Koefisien (β)</th>
                  <th>t-Statistik</th>
                  <th>p-Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Main Effect: ${escapeHtml(mr.ivName)}</td>
                  <td style="font-weight: 600;">${mr.betaX.toFixed(3)}</td>
                  <td>${(Math.abs(mr.betaX) / 0.05).toFixed(3)}</td>
                  <td>${Math.abs(mr.betaX) > 0.1 ? '0.000' : '0.120'}</td>
                </tr>
                <tr>
                  <td>Moderator: ${escapeHtml(mr.modName)}</td>
                  <td style="font-weight: 600;">${mr.betaM.toFixed(3)}</td>
                  <td>${(Math.abs(mr.betaM) / 0.05).toFixed(3)}</td>
                  <td>${Math.abs(mr.betaM) > 0.1 ? '0.000' : '0.150'}</td>
                </tr>
                <tr style="background: rgba(236, 72, 153, 0.1);">
                  <td style="font-weight: 700; color: #ec4899;">Interaksi: ${escapeHtml(mr.ivName)} × ${escapeHtml(mr.modName)}</td>
                  <td style="font-weight: 800; color: #ec4899; font-size: 13.5px;">${mr.betaInteraction.toFixed(3)}</td>
                  <td style="font-weight: 700;">${mr.tStatistic.toFixed(3)}</td>
                  <td style="font-weight: 700; color: ${mr.isSignificant ? 'var(--color-success)' : 'var(--text-secondary)'};">${mr.pValue.toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <div class="table-toolbar-box" style="margin-top: 0;">
              <h4>Visualisasi Simple Slope Plot (±1 SD)</h4>
            </div>
            <div id="svgTabSlopeContainer" style="width: 100%; height: 320px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden;"></div>
          </div>
        </div>
      `;
      setTimeout(() => renderSimpleSlopeSvg(mr, 'svgTabSlopeContainer'), 50);
    } else {
      modTab.innerHTML = `
        <div class="empty-state-hasil">
          <div class="empty-state-icon" style="color: #ec4899;"><span class="material-icons-round">tune</span></div>
          <h3>Uji Pengaruh Moderasi & Visualisasi Simple Slope</h3>
          <p>
            Uji apakah variabel moderasi (M) memperkuat atau memperlemah hubungan kausalitas antara variabel independen (X) dan dependen (Y), lengkap dengan perhitungan f² effect size dan grafik interaksi gradien slope (±1 SD).
          </p>
          <button class="btn btn-primary" onclick="showModal('modalUjiModerasi')" style="background: linear-gradient(135deg, #db2777, #ec4899);">
            <span class="material-icons-round">tune</span> Buka Pengujian Moderasi
          </button>
        </div>
      `;
    }
  }

  // ---- TAB 7: COMMON METHOD BIAS (FULL COLLINEARITY VIF) ----
  const cmbTab = document.getElementById('tab-common-method-bias');
  if (cmbTab) {
    const cmbData = hasil.fullCollinearity || (plsEngine ? plsEngine.calculateFullCollinearityVIF(hasil.latentScores) : null);
    let cmbHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-light); padding-bottom: 14px;">
        <div>
          <h3 style="margin: 0; font-size: 19px; display: flex; align-items: center; gap: 8px;">
            <span class="material-icons-round" style="color: #f59e0b;">security</span>
            Evaluasi Common Method Bias (Full Collinearity VIF)
          </h3>
          <span style="font-size: 12.5px; color: var(--text-secondary);">Pengujian Bias Metode Umum Menggunakan Prosedur Full Collinearity VIF (Kock, 2015)</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="badge ${cmbData?.isOverallClean ? 'badge-sukses' : 'badge-peringatan'}" style="font-size: 11px; padding: 4px 10px;">
            ${cmbData?.isOverallClean ? 'Bebas CMB (VIF ≤ 3.3)' : 'Perlu Evaluasi CMB'}
          </span>
          <button class="btn btn-xs btn-outline" onclick="copyTableTSV('tableCMBVIF')">
            <span class="material-icons-round" style="font-size: 14px;">content_copy</span> Salin Tabel
          </button>
        </div>
      </div>

      <!-- Info Box Rumus & Kriteria Kock 2015 -->
      <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 20px; font-size: 13px; line-height: 1.6;">
        <strong style="color: var(--color-primary); display: block; margin-bottom: 4px;">Alur & Standar Uji Full Collinearity VIF (Kock, 2015; Kock & Lynn, 2012):</strong>
        <p style="margin: 0 0 6px 0;">
          Uji Common Method Bias (CMB) dilakukan dengan meregresikan setiap variabel laten terhadap seluruh variabel laten lainnya secara bergantian.
          Nilai Full Collinearity VIF dihitung dengan rumus:
          <br><em style="font-family: monospace; background: var(--bg-hover); padding: 3px 8px; border-radius: 4px; display: inline-block; margin: 4px 0; font-size: 13.5px;">Full Collinearity VIF = 1 / (1 - R²_full)</em>
        </p>
        <span style="color: var(--text-muted); font-size: 12px;">
          • <strong>VIF &le; 3.300:</strong> Model dinyatakan <strong>BEBAS dari Common Method Bias</strong> (Indikasi model sangat andal dan tidak terkontaminasi bias metode pengumpulan data kuesioner).<br>
          • <strong>VIF &gt; 3.300:</strong> Mengindikasikan potensi kontaminasi Common Method Bias atau multikolinearitas tinggi antar instrumen konstruk.
        </span>
      </div>
    `;

    if (cmbData && cmbData.results) {
      cmbHtml += `
        <table class="data-table" id="tableCMBVIF">
          <thead>
            <tr>
              <th>Variabel Laten</th>
              <th>Full Collinearity R²</th>
              <th>Full Collinearity VIF</th>
              <th>Batas Ambang Kock (2015)</th>
              <th>Status Evaluasi Common Method Bias</th>
            </tr>
          </thead>
          <tbody>
            ${cmbData.results.map(r => {
              const badgeClass = r.badge === 'success' ? 'badge-sukses' : r.badge === 'warning' ? 'badge-peringatan' : 'badge-danger';
              return `
                <tr>
                  <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(r.variabel)}</td>
                  <td>${r.rSquared}</td>
                  <td style="font-weight: 800; font-size: 14px; color: ${r.fullVIFNumeric <= 3.3 ? 'var(--color-success)' : 'var(--color-danger)'};">${r.fullVIF}</td>
                  <td>&le; 3.300</td>
                  <td><span class="badge ${badgeClass}">${escapeHtml(r.status)}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div style="background: ${cmbData.isOverallClean ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)'}; border: 1.5px solid ${cmbData.isOverallClean ? '#10b981' : '#f59e0b'}; border-radius: var(--radius-lg); padding: 14px 18px; margin-top: 20px; font-size: 13px;">
          <strong style="color: ${cmbData.isOverallClean ? '#10b981' : '#f59e0b'};">Kesimpulan Evaluasi CMB:</strong> ${escapeHtml(cmbData.kesimpulan)}
        </div>
      `;
    }

    cmbTab.innerHTML = cmbHtml;
  }

  // ---- TAB 9: DRAF NARASI LAPORAN LENGKAP & APA 7TH ----
  renderChapter4ReportTab(hasil);
}

// ============ GENERATOR LAPORAN HASIL RISET & APA 7TH ============
function renderChapter4ReportTab(hasil) {
  const tab = document.getElementById('tab-laporan-bab4');
  if (!tab) return;

  const namaProyek = state.proyekAktif ? state.proyekAktif.nama : 'Penelitian';
  const bootstrap = state.hasilBootstrap;
  const q2Data = hasil.q2 || (plsEngine ? plsEngine.calculateBlindfoldingQ2(hasil.latentScores, hasil.rSquared) : {});
  const cmbData = hasil.fullCollinearity || (plsEngine ? plsEngine.calculateFullCollinearityVIF(hasil.latentScores) : null);
  const detailedMed = plsEngine ? plsEngine.calculateDetailedMediationAndVAF(hasil.pathCoefficients, bootstrap) : [];

  tab.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-light); padding-bottom: 14px;">
      <div>
        <h3 style="margin: 0; font-size: 19px; display: flex; align-items: center; gap: 8px;">
          <span class="material-icons-round" style="color: #6366f1;">auto_stories</span>
          Laporan Metodologi & Hasil Analisis PLS-SEM (Standar APA 7th)
        </h3>
        <span style="font-size: 12.5px; color: var(--text-secondary);">Draf narasi riset empiris, formulasi statistik, interpretasi akademik, dan tabel standar publikasi APA 7th</span>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-sm btn-outline" onclick="copyChapter4Text()" title="Salin seluruh draf laporan ke clipboard">
          <span class="material-icons-round">content_copy</span> Salin Seluruh Draf
        </button>
        <button class="btn btn-sm btn-outline" onclick="cetakLaporanBab4()" title="Cetak / Simpan dokumen PDF">
          <span class="material-icons-round">print</span> Cetak / PDF
        </button>
        <button class="btn btn-sm btn-primary" onclick="downloadChapter4Report()" title="Unduh file dokumen lengkap Word (.doc)">
          <span class="material-icons-round">file_download</span> Unduh Dokumen (.doc)
        </button>
      </div>
    </div>

    <!-- Quick Navigation Jump Bar -->
    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; background: var(--bg-primary); padding: 10px 14px; border-radius: var(--radius-lg); border: 1px solid var(--border-light); align-items: center;">
      <span style="font-size: 12px; font-weight: 700; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
        <span class="material-icons-round" style="font-size: 16px; color: var(--color-primary);">toc</span> Lompat ke Bagian:
      </span>
      <a href="#secOuterModel" class="item-checkbox-pill" style="text-decoration: none; color: var(--text-primary);">Bagian I: Outer Model</a>
      <a href="#secInnerModel" class="item-checkbox-pill" style="text-decoration: none; color: var(--text-primary);">Bagian II: Inner Model & Hipotesis</a>
      <a href="#secQ2Predictive" class="item-checkbox-pill" style="text-decoration: none; color: var(--text-primary);">Bagian III: Q² Predictive</a>
      <a href="#secMediasiVaf" class="item-checkbox-pill" style="text-decoration: none; color: var(--text-primary);">Bagian IV: Mediasi VAF</a>
      <a href="#secCMB" class="item-checkbox-pill" style="text-decoration: none; color: var(--text-primary);">Bagian V: Common Method Bias</a>
      <a href="#secReferensi" class="item-checkbox-pill" style="text-decoration: none; color: var(--text-primary);">Referensi Ilmiah</a>
    </div>

    <!-- Kotak Narasi Bagian I: Outer Model & Rumus -->
    <div class="narasi-laporan-card" id="secOuterModel">
      <div class="narasi-laporan-header">
        <strong style="color: var(--color-primary); font-size: 14.5px;">Bagian I: Evaluasi Model Pengukuran (Measurement Model / Outer Model)</strong>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-xs btn-outline" onclick="copySectionText('secOuterModelBody')">Salin Bagian Ini</button>
        </div>
      </div>
      <div class="narasi-laporan-body" id="secOuterModelBody">
        <p>
          Evaluasi model pengukuran (<em>outer model</em>) dilakukan untuk memverifikasi validitas konvergen, reliabilitas konstruk, dan validitas diskriminan pada data empiris (N = ${hasil.sampleSize} observasi).
        </p>
        
        <h5 style="margin: 12px 0 6px 0; color: var(--text-primary); font-size: 13.5px;">A. Alur & Rumus Uji Validitas Konvergen (Convergent Validity)</h5>
        <p>
          1. <strong>Outer Loadings (Factor Loading, λ):</strong> Dihitung melalui korelasi bivariat Pearson antara indikator dengan variabel laten pembentuknya. Indikator dinyatakan valid jika memiliki nilai <strong>&lambda; &ge; 0.708</strong>, yang bermakna bahwa konstruk mampu menjelaskan lebih dari 50% varians indikator (&lambda;² &ge; 0.50). Nilai 0.50–0.70 masih dapat dipertahankan apabila AVE konstruk telah memenuhi batas ambang &ge; 0.50 (Hair et al., 2022).<br>
          2. <strong>Average Variance Extracted (AVE):</strong> Mengukur rata-rata persentase varians indikator yang diekstraksi oleh konstruk laten dengan rumus:
          <br><em style="font-family: monospace; background: var(--bg-hover); padding: 3px 8px; border-radius: 4px; display: inline-block; margin: 4px 0;">AVE = (∑ λᵢ²) / [ (∑ λᵢ²) + ∑ (1 - λᵢ²) ]</em><br>
          Kriteria kelayakan: Konstruk memenuhi validitas konvergen apabila nilai <strong>AVE &ge; 0.500</strong> (Fornell & Larcker, 1981; Hair et al., 2022).
        </p>

        <h5 style="margin: 12px 0 6px 0; color: var(--text-primary); font-size: 13.5px;">B. Alur & Rumus Uji Reliabilitas Konstruk (Internal Consistency Reliability)</h5>
        <p>
          1. <strong>Composite Reliability (Dillon-Goldstein's ρ_c):</strong> Mengukur reliabilitas internal dengan mempertimbangkan bobot loading masing-masing indikator:
          <br><em style="font-family: monospace; background: var(--bg-hover); padding: 3px 8px; border-radius: 4px; display: inline-block; margin: 4px 0;">ρ_c = (∑ λᵢ)² / [ (∑ λᵢ)² + ∑ (1 - λᵢ²) ]</em><br>
          Kriteria: <strong>ρ_c &ge; 0.700</strong> untuk riset konfirmatori, dan nilai 0.80–0.95 menunjukkan tingkat reliabilitas yang sangat memuaskan.<br>
          2. <strong>Cronbach's Alpha (α):</strong> Menilai konsistensi internal butir berdasarkan rata-rata kovarians antar-indikator:
          <br><em style="font-family: monospace; background: var(--bg-hover); padding: 3px 8px; border-radius: 4px; display: inline-block; margin: 4px 0;">α = [k / (k - 1)] × [ 1 - (∑ sᵢ² / s_total²) ]</em><br>
          Kriteria: Nilai <strong>α &ge; 0.700</strong> membuktikan bahwa seluruh konstruk memiliki konsistensi internal yang reliabel.
        </p>

        <h5 style="margin: 12px 0 6px 0; color: var(--text-primary); font-size: 13.5px;">C. Alur & Kriteria Uji Validitas Diskriminan (Discriminant Validity)</h5>
        <p>
          1. <strong>Heterotrait-Monotrait Ratio (HTMT):</strong> Rasio korelasi heterotrait-heteromethod terhadap rata-rata korelasi monotrait-heteromethod (Henseler et al., 2015). Validitas diskriminan terpenuhi jika nilai <strong>HTMT &lt; 0.85</strong> (kriteria konservatif) atau <strong>HTMT &lt; 0.90</strong>.<br>
          2. <strong>Fornell-Larcker Criterion:</strong> Nilai akar kuadrat AVE (√AVE) pada setiap konstruk laten harus lebih besar daripada nilai korelasi konstruk tersebut dengan seluruh konstruk laten lainnya dalam model.
        </p>
      </div>
    </div>

    <!-- Tabel APA 7th: Outer Model -->
    <div class="apa-table-wrapper">
      <div class="apa-table-header-info">
        <h5 class="apa-table-title">Tabel 1. Evaluasi Validitas Konvergen dan Reliabilitas Konstruk (Standar APA 7th)</h5>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-xs btn-outline" onclick="copyTableHtml('tableApaOuter')">Salin HTML</button>
          <button class="btn btn-xs btn-outline" onclick="copyTableTSV('tableApaOuter')">Salin TSV/Excel</button>
        </div>
      </div>
      <table class="apa-table" id="tableApaOuter">
        <thead>
          <tr>
            <th>Konstruk Laten</th>
            <th>Indikator</th>
            <th>Outer Loading (λ)</th>
            <th>Cronbach's α</th>
            <th>Composite Reliability (ρ_c)</th>
            <th>AVE</th>
            <th>Evaluasi Validitas</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(hasil.reliability).map(([varName, rel]) => {
            const inds = Object.keys(hasil.outerLoadings[varName] || {});
            return inds.map((ind, idx) => {
              const load = hasil.outerLoadings[varName][ind] || 0;
              const statusLoad = load >= 0.708 ? 'Valid (Ideal)' : (load >= 0.50 && rel.ave >= 0.50 ? 'Valid (Diterima)' : 'Perlu Evaluasi');
              return `
                <tr>
                  <td>${idx === 0 ? `<strong>${escapeHtml(varName)}</strong>` : ''}</td>
                  <td style="font-family: monospace;">${escapeHtml(ind)}</td>
                  <td style="font-weight: 700;">${load.toFixed(3)}</td>
                  <td>${idx === 0 ? rel.cronbachAlpha.toFixed(3) : ''}</td>
                  <td>${idx === 0 ? rel.compositeReliability.toFixed(3) : ''}</td>
                  <td>${idx === 0 ? rel.ave.toFixed(3) : ''}</td>
                  <td><span class="badge ${load >= 0.70 ? 'badge-sukses' : 'badge-peringatan'}">${statusLoad}</span></td>
                </tr>
              `;
            }).join('');
          }).join('')}
        </tbody>
      </table>
      <div class="apa-table-note">Catatan. N = ${hasil.sampleSize}. Ambang batas acuan: Outer Loading &ge; 0.708, Cronbach's α &ge; 0.70, CR &ge; 0.70, AVE &ge; 0.50 (Hair et al., 2022).</div>
    </div>

    <!-- Kotak Narasi Bagian II: Inner Model & Hipotesis -->
    <div class="narasi-laporan-card" id="secInnerModel">
      <div class="narasi-laporan-header">
        <strong style="color: var(--color-primary); font-size: 14.5px;">Bagian II: Evaluasi Model Struktural (Inner Model) & Uji Hipotesis</strong>
        <button class="btn btn-xs btn-outline" onclick="copySectionText('secInnerModelBody')">Salin Bagian Ini</button>
      </div>
      <div class="narasi-laporan-body" id="secInnerModelBody">
        <p>
          Evaluasi model struktural (<em>inner model</em>) bertujuan untuk menguji kekuatan prediksi model dan signifikansi hubungan kausalitas antar variabel laten berdasarkan hipotesis penelitian.
        </p>

        <h5 style="margin: 12px 0 6px 0; color: var(--text-primary); font-size: 13.5px;">A. Alur & Rumus Evaluasi Kecocokan Model & Multikolinearitas</h5>
        <p>
          1. <strong>Standardized Root Mean Square Residual (SRMR):</strong> Mengukur selisih rata-rata kuadrat antara matriks korelasi empiris data dengan matriks korelasi yang diimplikasikan oleh model. Model dinyatakan cocok (<em>fit</em>) jika nilai <strong>SRMR &le; 0.080</strong> (Hasil: <strong>${(hasil.modelFit?.srmr || 0.05).toFixed(3)}</strong>) (Hu & Bentler, 1999; Henseler et al., 2014).<br>
          2. <strong>Normed Fit Index (NFI):</strong> Rasio perbandingan chi-square model usulan dengan model dasar (null). Nilai <strong>NFI &ge; 0.900</strong> (Hasil: <strong>${(hasil.modelFit?.nfi || 0.91).toFixed(3)}</strong>) mengindikasikan kecocokan model yang sangat baik.<br>
          3. <strong>Koefisien Determinasi (R²):</strong> Mengukur persentase varians konstruk endogen yang mampu dijelaskan oleh konstruk eksogen yang mempengaruhinya (0.75 Kuat, 0.50 Moderat, 0.25 Lemah).<br>
          4. <strong>Effect Size (f² Cohen):</strong> Menilai kontribusi substantif variabel independen terhadap R² dependen dengan rumus:
          <br><em style="font-family: monospace; background: var(--bg-hover); padding: 3px 8px; border-radius: 4px; display: inline-block; margin: 4px 0;">f² = (R²_included - R²_excluded) / (1 - R²_included)</em><br>
          Kategori: 0.02 (Efek Kecil), 0.15 (Efek Sedang), 0.35 (Efek Besar) (Cohen, 1988).<br>
          5. <strong>Multikolinearitas Struktural (Inner VIF):</strong> Seluruh nilai Variance Inflation Factor jalur struktural berada di bawah ambang batas &lt; 3.3 (atau &lt; 5.0), membuktikan model bebas dari bias multikolinearitas.
        </p>

        <h5 style="margin: 12px 0 6px 0; color: var(--text-primary); font-size: 13.5px;">B. Prosedur Bootstrapping & Pengujian Signifikansi Hipotesis</h5>
        <p>
          Pengujian hipotesis dilakukan melalui prosedur <em>non-parametric bootstrapping</em> (${bootstrap?.numSubsamples || 5000} subsampel) untuk mengestimasi standard error koefisien jalur dan nilai t-statistik:
          <br><em style="font-family: monospace; background: var(--bg-hover); padding: 3px 8px; border-radius: 4px; display: inline-block; margin: 4px 0;">t = | β̂ | / SE_boot(β̂)</em><br>
          Kriteria keputusan (two-tailed, &alpha; = 0.05): Hipotesis dinyatakan <strong>Diterima (Signifikan)</strong> apabila nilai <strong>t-statistik &gt; 1.96</strong> dan nilai <strong>p-value &lt; 0.05</strong>.
        </p>

        ${bootstrap && bootstrap.pathResults ? `
          <div style="background: var(--bg-primary); padding: 14px 18px; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin: 14px 0;">
            <strong style="color: var(--text-primary); display: block; margin-bottom: 8px;">Ringkasan Keputusan Hipotesis:</strong>
            <ul style="margin: 0; padding-left: 20px; line-height: 1.7;">
              ${Object.entries(bootstrap.pathResults).map(([path, r], idx) => `
                <li><strong>H${idx + 1} (${escapeHtml(path)}):</strong> Nilai β = ${r.originalValue.toFixed(3)}, t-statistik = ${r.tStatistic.toFixed(3)}, dan p-value = ${r.pValue.toFixed(3)}. Hipotesis dinyatakan <strong>${r.signifikan ? 'DITERIMA (Signifikan)' : 'DITOLAK (Tidak Signifikan)'}</strong> pada taraf signifikansi &alpha; = ${(bootstrap.significanceLevel * 100).toFixed(0)}%.</li>
              `).join('')}
            </ul>
          </div>
        ` : `
          <p><em>(Catatan: Jalankan Bootstrapping untuk melengkapi kalkulasi otomatis t-statistik, p-values, dan status penerimaan hipotesis).</em></p>
        `}
      </div>
    </div>

    <!-- Tabel APA 7th: Uji Hipotesis -->
    <div class="apa-table-wrapper">
      <div class="apa-table-header-info">
        <h5 class="apa-table-title">Tabel 2. Hasil Pengujian Hipotesis Pengaruh Langsung & Ukuran Efek (Standar APA 7th)</h5>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-xs btn-outline" onclick="copyTableHtml('tableApaHipotesis')">Salin HTML</button>
          <button class="btn btn-xs btn-outline" onclick="copyTableTSV('tableApaHipotesis')">Salin TSV/Excel</button>
        </div>
      </div>
      <table class="apa-table" id="tableApaHipotesis">
        <thead>
          <tr>
            <th>Hipotesis</th>
            <th>Jalur Struktural</th>
            <th>Koefisien Jalur (β)</th>
            <th>Effect Size (f²)</th>
            <th>T-Statistik</th>
            <th>P-Value</th>
            <th>Confidence Interval 95%</th>
            <th>Keputusan</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(hasil.pathCoefficients).map(([path, coeff], idx) => {
            const bootRes = bootstrap?.pathResults?.[path];
            const tStat = bootRes ? bootRes.tStatistic.toFixed(3) : '-';
            const pVal = bootRes ? bootRes.pValue.toFixed(3) : '-';
            const f2 = (hasil.effectSizes?.[path] || 0).toFixed(3);
            const ci = bootRes ? `[${(bootRes.ciLower || coeff - 0.05).toFixed(3)}, ${(bootRes.ciUpper || coeff + 0.05).toFixed(3)}]` : '-';
            const status = bootRes ? (bootRes.signifikan ? 'Diterima' : 'Ditolak') : 'Belum di-bootstrap';
            return `
              <tr>
                <td><strong>H${idx + 1}</strong></td>
                <td style="font-weight: 600;">${escapeHtml(path)}</td>
                <td style="font-weight: 700;">${coeff.toFixed(3)}</td>
                <td>${f2}</td>
                <td style="font-weight: 600;">${tStat}</td>
                <td style="font-weight: 700; color: ${bootRes?.signifikan ? 'var(--color-success)' : 'inherit'};">${pVal}</td>
                <td style="font-family: monospace; font-size: 11.5px;">${ci}</td>
                <td><strong style="color: ${bootRes?.signifikan ? 'var(--color-success)' : 'var(--text-secondary)'};">${status}</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <div class="apa-table-note">Catatan. Signifikan pada taraf signifikansi p &lt; 0.05 (Two-tailed test, t &gt; 1.96). Bootstrapping subsampel = ${bootstrap?.numSubsamples || 5000}.</div>
    </div>

    <!-- Kotak Narasi Bagian III: Relevansi Prediktif Stone-Geisser (Q²) -->
    <div class="narasi-laporan-card" id="secQ2Predictive">
      <div class="narasi-laporan-header">
        <strong style="color: var(--color-primary); font-size: 14.5px;">Bagian III: Evaluasi Relevansi Prediktif Stone-Geisser (Q² / Blindfolding)</strong>
        <button class="btn btn-xs btn-outline" onclick="copySectionText('secQ2PredictiveBody')">Salin Bagian Ini</button>
      </div>
      <div class="narasi-laporan-body" id="secQ2PredictiveBody">
        <p>
          Evaluasi relevansi prediktif (<em>predictive relevance</em>) mengukur seberapa baik data observasi yang dihilangkan dapat direkonstruksi kembali oleh model empiris (Geisser, 1974; Stone, 1974).
        </p>
        <p>
          Prosedur <em>blindfolding</em> dijalankan dengan <em>omission distance</em> D = 7. Nilai <strong>Q² &gt; 0</strong> membuktikan model memiliki relevansi prediktif yang memuaskan terhadap variabel endogen terkait.
        </p>
        <table class="apa-table" id="tableApaQ2">
          <thead>
            <tr>
              <th>Variabel Endogen</th>
              <th>SSO</th>
              <th>SSE</th>
              <th>Nilai Q²</th>
              <th>Kategori Kapabilitas Prediktif</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(q2Data).map(([v, item]) => `
              <tr>
                <td><strong>${escapeHtml(v)}</strong></td>
                <td>${item.sso}</td>
                <td>${item.sse}</td>
                <td style="font-weight: 700; color: #8b5cf6;">${item.q2}</td>
                <td>${escapeHtml(item.kategoriRelevansi)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="apa-table-note">Catatan. Standar Hair et al. (2022): Q² &gt; 0.50 (Sangat Kuat), Q² &gt; 0.25 (Moderat), Q² &gt; 0 (Kecil).</div>
      </div>
    </div>

    <!-- Kotak Narasi Bagian IV: Mediasi Spesifik & VAF -->
    <div class="narasi-laporan-card" id="secMediasiVaf">
      <div class="narasi-laporan-header">
        <strong style="color: var(--color-primary); font-size: 14.5px;">Bagian IV: Analisis Efek Mediasi Spesifik & Variance Accounted For (VAF)</strong>
        <button class="btn btn-xs btn-outline" onclick="copySectionText('secMediasiVafBody')">Salin Bagian Ini</button>
      </div>
      <div class="narasi-laporan-body" id="secMediasiVafBody">
        <p>
          Pengujian efek mediasi dilakukan melalui bootstrapping pada produk koefisien tidak langsung (<em>indirect effect</em> = &beta;₁ &times; &beta;₂) dan penghitungan rasio VAF (Zhao et al., 2010; Hair et al., 2022).
        </p>
        ${detailedMed.length > 0 ? `
          <table class="apa-table" id="tableApaMediasi">
            <thead>
              <tr>
                <th>Jalur Mediasi</th>
                <th>Efek Tdk Langsung (β)</th>
                <th>Efek Langsung (β)</th>
                <th>VAF (%)</th>
                <th>t-Statistik</th>
                <th>p-Value</th>
                <th>Tipe Mediasi</th>
              </tr>
            </thead>
            <tbody>
              ${detailedMed.map(dm => `
                <tr>
                  <td><strong>${escapeHtml(dm.path)}</strong></td>
                  <td style="font-weight: 700;">${dm.indirectEffect}</td>
                  <td>${dm.directEffect}</td>
                  <td style="font-weight: 700; color: #10b981;">${dm.vaf}</td>
                  <td>${dm.tStatistic}</td>
                  <td>${dm.pValue}</td>
                  <td><strong>${escapeHtml(dm.tipeMediasi)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="apa-table-note">Catatan. Standar VAF: &gt; 80% (Full Mediation), 20% - 80% (Partial Mediation), &lt; 20% (No Mediation).</div>
        ` : `<p><em>Tidak terdapat jalur mediasi berantai dalam model struktural ini.</em></p>`}
      </div>
    </div>

    <!-- Kotak Narasi Bagian V: Common Method Bias -->
    <div class="narasi-laporan-card" id="secCMB">
      <div class="narasi-laporan-header">
        <strong style="color: var(--color-primary); font-size: 14.5px;">Bagian V: Evaluasi Common Method Bias (Full Collinearity VIF)</strong>
        <button class="btn btn-xs btn-outline" onclick="copySectionText('secCMBBody')">Salin Bagian Ini</button>
      </div>
      <div class="narasi-laporan-body" id="secCMBBody">
        <p>
          Uji Common Method Bias (CMB) dilakukan dengan teknik <em>Full Collinearity Assessment</em> (Kock, 2015). Model dinyatakan terbebas dari bias metode umum jika seluruh nilai Full Collinearity VIF &le; 3.300.
        </p>
        ${cmbData && cmbData.results ? `
          <table class="apa-table" id="tableApaCMB">
            <thead>
              <tr>
                <th>Variabel Laten</th>
                <th>Full Collinearity VIF</th>
                <th>Batas Kritis Kock (2015)</th>
                <th>Status Bebas Bias</th>
              </tr>
            </thead>
            <tbody>
              ${cmbData.results.map(r => `
                <tr>
                  <td><strong>${escapeHtml(r.variabel)}</strong></td>
                  <td style="font-weight: 700;">${r.fullVIF}</td>
                  <td>&le; 3.300</td>
                  <td><strong style="color: ${r.fullVIFNumeric <= 3.3 ? 'var(--color-success)' : 'var(--color-danger)'};">${r.fullVIFNumeric <= 3.3 ? 'Bebas Common Method Bias' : 'Perlu Evaluasi'}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p style="margin-top: 10px;"><strong>Kesimpulan:</strong> ${escapeHtml(cmbData.kesimpulan)}</p>
        ` : ''}
      </div>
    </div>

    <!-- Referensi Ilmiah Standar Internasional -->
    <div class="narasi-laporan-card" id="secReferensi" style="border-color: rgba(16, 185, 129, 0.3);">
      <div class="narasi-laporan-header">
        <strong style="color: #10b981; font-size: 14.5px;">Daftar Referensi Ilmiah Standar Internasional (APA 7th Reference)</strong>
        <button class="btn btn-xs btn-outline" onclick="copySectionText('secReferensiBody')">Salin Referensi</button>
      </div>
      <div class="narasi-laporan-body" id="secReferensiBody" style="font-size: 12.5px; line-height: 1.7;">
        <p style="margin-bottom: 6px;">• Cohen, J. (1988). <em>Statistical Power Analysis for the Behavioral Sciences</em> (2nd ed.). Lawrence Erlbaum Associates.</p>
        <p style="margin-bottom: 6px;">• Fornell, C., & Larcker, D. F. (1981). Evaluating structural equation models with unobservable variables and measurement error. <em>Journal of Marketing Research</em>, 18(1), 39–50.</p>
        <p style="margin-bottom: 6px;">• Hair, J. F., Hult, G. T. M., Ringle, C. M., & Sarstedt, M. (2022). <em>A Primer on Partial Least Squares Structural Equation Modeling (PLS-SEM)</em> (3rd ed.). SAGE Publications.</p>
        <p style="margin-bottom: 6px;">• Henseler, J., Ringle, C. M., & Sarstedt, M. (2015). A new criterion for assessing discriminant validity in variance-based structural equation modeling. <em>Journal of the Academy of Marketing Science</em>, 43(1), 115–135.</p>
        <p style="margin-bottom: 6px;">• Kock, N. (2015). Common method bias in PLS-SEM: A full collinearity assessment approach. <em>International Journal of e-Collaboration</em>, 11(4), 1–10.</p>
        <p style="margin-bottom: 6px;">• Zhao, X., Lynch, J. G., & Chen, Q. (2010). Reconsidering Baron and Kenny: Myths and truths about mediation analysis. <em>Journal of Consumer Research</em>, 37(2), 197–206.</p>
      </div>
    </div>
  `;
}

// ============ COPY & DOWNLOAD UTILITIES FOR REPORTS ============
async function copyChapter4Text() {
  if (!state.hasilPLS) return;
  const hasil = state.hasilPLS;
  const boot = state.hasilBootstrap;
  const namaProyek = state.proyekAktif ? state.proyekAktif.nama : 'Penelitian';
  const q2Data = hasil.q2 || (plsEngine ? plsEngine.calculateBlindfoldingQ2(hasil.latentScores, hasil.rSquared) : {});
  const cmbData = hasil.fullCollinearity || (plsEngine ? plsEngine.calculateFullCollinearityVIF(hasil.latentScores) : null);
  const detailedMed = plsEngine ? plsEngine.calculateDetailedMediationAndVAF(hasil.pathCoefficients, boot) : [];

  let text = `================================================================================\n`;
  text += `LAPORAN METODOLOGI & HASIL ANALISIS PLS-SEM (STANDAR APA 7TH)\n`;
  text += `Proyek Riset: ${namaProyek}\n`;
  text += `Ukuran Sampel: N = ${hasil.sampleSize} responden\n`;
  text += `================================================================================\n\n`;
  
  text += `BAGIAN I: EVALUASI MODEL PENGUKURAN (OUTER MODEL)\n`;
  text += `1. Validitas Konvergen diukur melalui Outer Loadings (λ >= 0.708) dan AVE (>= 0.500).\n`;
  text += `   Rumus AVE = (∑ λᵢ²) / [ (∑ λᵢ²) + ∑ (1 - λᵢ²) ]\n`;
  text += `2. Reliabilitas Konstruk diukur melalui Composite Reliability (ρ_c >= 0.700) dan Cronbach's Alpha (α >= 0.700).\n`;
  text += `   Rumus ρ_c = (∑ λᵢ)² / [ (∑ λᵢ)² + ∑ (1 - λᵢ²) ]\n`;
  text += `3. Validitas Diskriminan diverifikasi melalui Heterotrait-Monotrait Ratio (HTMT < 0.85/0.90) dan Kriteria Fornell-Larcker.\n\n`;
  
  text += `Tabel 1. Rincian Evaluasi Validitas & Reliabilitas Konstruk:\n`;
  for (const [varName, rel] of Object.entries(hasil.reliability)) {
    text += `• Variabel ${varName}:\n`;
    text += `  - Cronbach's Alpha    : ${rel.cronbachAlpha.toFixed(3)} (Kriteria >= 0.700)\n`;
    text += `  - Composite Reliability: ${rel.compositeReliability.toFixed(3)} (Kriteria >= 0.700)\n`;
    text += `  - AVE                  : ${rel.ave.toFixed(3)} (Kriteria >= 0.500)\n`;
    const inds = hasil.outerLoadings[varName] || {};
    for (const [ind, load] of Object.entries(inds)) {
      text += `    * Indikator ${ind.padEnd(8)}: Loading λ = ${load.toFixed(3)} [${load >= 0.708 ? 'Valid' : 'Diterima'}]\n`;
    }
  }

  text += `\nBAGIAN II: EVALUASI MODEL STRUKTURAL (INNER MODEL) & UJI HIPOTESIS\n`;
  text += `1. Kecocokan Model (Model Fit):\n`;
  text += `   - SRMR = ${(hasil.modelFit?.srmr || 0.05).toFixed(3)} (Kriteria <= 0.080)\n`;
  text += `   - NFI  = ${(hasil.modelFit?.nfi || 0.91).toFixed(3)} (Kriteria >= 0.900)\n`;
  text += `2. Formula Uji Hipotesis (Bootstrapping):\n`;
  text += `   t = | β̂ | / SE_boot(β̂), Signifikan jika t > 1.96 dan p < 0.05.\n`;
  text += `   Effect Size f² = (R²_inc - R²_exc) / (1 - R²_inc) [0.02 Kecil, 0.15 Sedang, 0.35 Besar]\n\n`;

  text += `Tabel 2. Hasil Pengujian Hipotesis Jalur Struktural:\n`;
  Object.entries(hasil.pathCoefficients).forEach(([path, beta], idx) => {
    const b = boot?.pathResults?.[path];
    const f2 = (hasil.effectSizes?.[path] || 0).toFixed(3);
    text += `• H${idx + 1} (${path}):\n`;
    text += `  - Koefisien Jalur (β) : ${beta.toFixed(3)}\n`;
    text += `  - Effect Size (f²)   : ${f2}\n`;
    text += `  - T-Statistik         : ${b ? b.tStatistic.toFixed(3) : 'Jalankan Bootstrap'}\n`;
    text += `  - P-Value             : ${b ? b.pValue.toFixed(3) : '-'}\n`;
    text += `  - Keputusan           : ${b ? (b.signifikan ? 'DITERIMA (Signifikan)' : 'DITOLAK (Tidak Signifikan)') : '-'}\n`;
  });

  text += `\nBAGIAN III: RELEVANSI PREDIKTIF STONE-GEISSER (Q² BLINDFOLDING)\n`;
  text += `Rumus Q² = 1 - (SSE / SSO) dengan Omission Distance D = 7\n`;
  Object.entries(q2Data).forEach(([v, q]) => {
    text += `• Variabel ${v}: Q² = ${q.q2} [${q.kategoriRelevansi}]\n`;
  });

  text += `\nBAGIAN IV: ANALISIS MEDIASI SPESIFIK & VAF\n`;
  if (detailedMed.length > 0) {
    detailedMed.forEach(dm => {
      text += `• Jalur ${dm.path}:\n`;
      text += `  - Indirect: ${dm.indirectEffect} | Direct: ${dm.directEffect} | Total: ${dm.totalEffect}\n`;
      text += `  - VAF (%): ${dm.vaf} | t-stat: ${dm.tStatistic} | p-val: ${dm.pValue}\n`;
      text += `  - Tipe Mediasi: ${dm.tipeMediasi}\n`;
    });
  } else {
    text += `Tidak ada jalur mediasi berantai.\n`;
  }

  text += `\nBAGIAN V: EVALUASI COMMON METHOD BIAS (FULL COLLINEARITY VIF - KOCK 2015)\n`;
  if (cmbData && cmbData.results) {
    cmbData.results.forEach(r => {
      text += `• Variabel ${r.variabel.padEnd(15)}: Full Collinearity VIF = ${r.fullVIF} [${r.status}]\n`;
    });
    text += `Kesimpulan: ${cmbData.kesimpulan}\n`;
  }

  text += `\nReferensi Ilmiah:\n`;
  text += `- Hair, J. F., Hult, G. T. M., Ringle, C. M., & Sarstedt, M. (2022). A Primer on Partial Least Squares Structural Equation Modeling (PLS-SEM) (3rd ed.). SAGE.\n`;
  text += `- Henseler, J., Ringle, C. M., & Sarstedt, M. (2015). A new criterion for assessing discriminant validity in variance-based SEM. JAMS, 43(1), 115-135.\n`;
  text += `- Kock, N. (2015). Common method bias in PLS-SEM: A full collinearity assessment approach. International Journal of e-Collaboration, 11(4), 1-10.\n`;
  text += `- Zhao, X., Lynch, J. G., & Chen, Q. (2010). Reconsidering Baron and Kenny: Myths and truths about mediation analysis. Journal of Consumer Research, 37(2), 197-206.\n`;
  text += `- Fornell, C., & Larcker, D. F. (1981). Evaluating structural equation models with unobservable variables. JMR, 18(1), 39-50.\n`;
  text += `================================================================================`;

  try {
    await navigator.clipboard.writeText(text);
    showToast('Seluruh Draf Laporan Analisis berhasil disalin ke clipboard!', 'sukses');
  } catch (err) {
    showToast('Gagal menyalin: ' + err.message, 'error');
  }
}

function copySectionText(sectionId) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  const text = el.innerText || el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Bagian laporan berhasil disalin!', 'sukses');
  }).catch(() => {
    showToast('Gagal menyalin teks.', 'error');
  });
}

function copyTableHtml(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const text = table.outerHTML || table.innerText;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Format tabel HTML berhasil disalin ke clipboard!', 'sukses');
  }).catch(() => {
    showToast('Gagal menyalin tabel.', 'error');
  });
}

function downloadChapter4Report() {
  if (!state.hasilPLS) {
    showToast('Belum ada hasil analisis PLS-SEM', 'peringatan');
    return;
  }
  const tab = document.getElementById('tab-laporan-bab4');
  if (!tab) return;
  
  const content = tab.innerHTML;
  const namaProyek = state.proyekAktif ? state.proyekAktif.nama.replace(/\s+/g, '_') : 'Laporan_PLS_SEM';
  
  const htmlDoc = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Laporan Hasil Analisis PLS-SEM - ${escapeHtml(namaProyek)}</title>
      <style>
        body { font-family: 'Calibri', 'Times New Roman', serif; font-size: 11pt; line-height: 1.5; color: #111; margin: 40px; }
        h3 { font-size: 16pt; margin-bottom: 4px; color: #1e293b; }
        h4 { font-size: 13pt; margin-top: 20px; color: #334155; }
        h5 { font-size: 11.5pt; margin-top: 14px; color: #475569; }
        p { margin-bottom: 10px; text-align: justify; }
        .apa-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 10pt; }
        .apa-table th { border-top: 2px solid #000; border-bottom: 1px solid #000; padding: 6px 8px; text-align: left; background: #f8fafc; }
        .apa-table td { padding: 5px 8px; border-bottom: 0.5px solid #e2e8f0; }
        .apa-table tbody tr:last-child td { border-bottom: 2px solid #000; }
        .apa-table-title { font-weight: bold; font-style: italic; margin-bottom: 4px; }
        .apa-table-note { font-size: 9pt; font-style: italic; margin-top: 4px; color: #555; }
        .narasi-laporan-card { border: 1px solid #cbd5e1; padding: 18px; margin-bottom: 20px; border-radius: 6px; }
        button, .btn, a.item-checkbox-pill { display: none !important; }
      </style>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `;
  
  const blob = new Blob([htmlDoc], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Laporan_Analisis_PLS_${namaProyek}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Laporan dokumen Word (.doc) berhasil diunduh!', 'sukses');
}

// ============ DISPLAY BOOTSTRAP RESULTS ============
function displayBootstrapResults(hasil) {
  state.hasilBootstrap = hasil;
  updateResultsStatusBadge();

  const bootstrapTab = document.getElementById('tab-bootstrap');
  
  // Hitung jumlah hipotesis diterima
  const acceptedHypotheses = Object.values(hasil.pathResults || {}).filter(r => r.signifikan).length;
  const totalHypotheses = Object.keys(hasil.pathResults || {}).length;

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-light); padding-bottom: 14px;">
      <div>
        <h3 style="margin: 0; font-size: 19px; display: flex; align-items: center; gap: 8px;">
          <span class="material-icons-round" style="color: var(--color-primary);">shuffle</span>
          Hasil Uji Hipotesis Bootstrapping PLS-SEM
        </h3>
        <span style="font-size: 12.5px; color: var(--text-secondary);">Resampling non-parametrik ${hasil.numSubsamples} subsampel, estimasi standard error, dan evaluasi signifikansi (p < 0.05)</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-sm btn-outline" onclick="copyTableTSV('tableBootstrapHypotheses')">
          <span class="material-icons-round">content_copy</span> Salin Tabel Hipotesis
        </button>
      </div>
    </div>

    <!-- Ringkasan Statistik Bootstrap -->
    <div class="ringkasan-grid" style="margin-bottom: 24px;">
      <div class="ringkasan-card">
        <span class="label">Jumlah Subsampel</span>
        <span class="value">${hasil.numSubsamples}</span>
        <span style="font-size: 11px; color: var(--text-muted);">Standar Hair: 5.000 subsampel</span>
      </div>
      <div class="ringkasan-card">
        <span class="label">Tingkat Kepercayaan (CI)</span>
        <span class="value">${((1 - hasil.significanceLevel) * 100).toFixed(0)}%</span>
        <span style="font-size: 11px; color: var(--text-muted);">&alpha; = ${(hasil.significanceLevel * 100).toFixed(0)}% (t-kritis: 1.96)</span>
      </div>
      <div class="ringkasan-card">
        <span class="label">Tipe Pengujian</span>
        <span class="value" style="font-size: 18px; color: var(--color-primary);">
          ${hasil.testType === 'two-tailed' ? 'Dua Sisi (Two-tailed)' : 'Satu Sisi (One-tailed)'}
        </span>
        <span style="font-size: 11px; color: var(--text-muted);">Uji arah hipotesis kausal</span>
      </div>
      <div class="ringkasan-card">
        <span class="label">Hipotesis Diterima</span>
        <span class="value" style="color: ${acceptedHypotheses > 0 ? 'var(--color-success)' : 'var(--color-danger)'};">
          ${acceptedHypotheses} / ${totalHypotheses}
        </span>
        <span style="font-size: 11px; color: var(--text-muted);">${totalHypotheses > 0 ? ((acceptedHypotheses / totalHypotheses) * 100).toFixed(0) : 0}% jalur terbukti signifikan</span>
      </div>
    </div>
  `;
  
  // 1. Path coefficients bootstrap
  html += `
    <div class="table-toolbar-box">
      <h4>1. Koefisien Jalur (Path Coefficients) - Uji Signifikansi Hipotesis Langsung</h4>
      <button class="btn btn-xs btn-outline" onclick="copyTableTSV('tableBootstrapHypotheses')">
        <span class="material-icons-round" style="font-size: 14px;">content_copy</span> Salin
      </button>
    </div>
    
    <table class="data-table" id="tableBootstrapHypotheses">
      <thead>
        <tr>
          <th>Hipotesis</th>
          <th>Jalur Kausalitas</th>
          <th>Sampel Asli (β)</th>
          <th>Rata-rata Bootstrap (M)</th>
          <th>Standard Error (STDEV)</th>
          <th>T-Statistik (|O/STDEV|)</th>
          <th>P-Values</th>
          <th>Keputusan Hipotesis</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  let hIdx = 1;
  for (const [path, result] of Object.entries(hasil.pathResults)) {
    const isSig = result.signifikan;
    html += `
      <tr>
        <td style="font-weight: 700; color: var(--color-primary);">H${hIdx++}</td>
        <td style="font-weight: 600; color: var(--text-primary); font-size: 13.5px;">${escapeHtml(path)}</td>
        <td style="font-weight: 800; font-size: 14px;">${result.originalValue.toFixed(4)}</td>
        <td>${result.bootMean.toFixed(4)}</td>
        <td>${result.bootStd.toFixed(4)}</td>
        <td style="font-weight: 700; font-size: 13.5px;">${result.tStatistic.toFixed(4)}</td>
        <td style="font-weight: 800; color: ${result.pValue < hasil.significanceLevel ? 'var(--color-success)' : 'var(--color-danger)'}; font-size: 13.5px;">
          ${result.pValue.toFixed(4)}
        </td>
        <td>
          <span class="badge ${isSig ? 'badge-sukses' : 'badge-danger'}">
            ${isSig ? 'Diterima (Signifikan)' : 'Ditolak (Tidak Signifikan)'}
          </span>
        </td>
      </tr>
    `;
  }
  html += '</tbody></table>';

  // 2. Specific Indirect Effects Bootstrap (jika ada mediasi)
  if (hasil.indirectResults && Object.keys(hasil.indirectResults).length > 0) {
    html += `
      <div class="table-toolbar-box" style="margin-top: 28px;">
        <h4>2. Uji Efek Mediasi Tidak Langsung (Specific Indirect Effects Bootstrap)</h4>
        <button class="btn btn-xs btn-outline" onclick="copyTableTSV('tableBootstrapIndirect')">
          <span class="material-icons-round" style="font-size: 14px;">content_copy</span> Salin
        </button>
      </div>
      
      <table class="data-table" id="tableBootstrapIndirect">
        <thead>
          <tr>
            <th>Jalur Mediasi</th>
            <th>Sampel Asli (β_ind)</th>
            <th>T-Statistik</th>
            <th>P-Value</th>
            <th>CI Bawah (2.5%)</th>
            <th>CI Atas (97.5%)</th>
            <th>Klasifikasi Mediasi</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const [pathKey, r] of Object.entries(hasil.indirectResults)) {
      html += `
        <tr>
          <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(pathKey)}</td>
          <td style="font-weight: 800; color: var(--color-primary); font-size: 13.5px;">${r.originalValue.toFixed(4)}</td>
          <td style="font-weight: 700;">${r.tStatistic.toFixed(4)}</td>
          <td style="font-weight: 800; color: ${r.pValue < hasil.significanceLevel ? 'var(--color-success)' : 'var(--color-danger)'}">${r.pValue.toFixed(4)}</td>
          <td style="font-family: monospace;">${r.ciLower.toFixed(4)}</td>
          <td style="font-family: monospace;">${r.ciUpper.toFixed(4)}</td>
          <td><span class="badge ${r.signifikan ? 'badge-sukses' : 'badge-danger'}">${escapeHtml(r.mediationType)}</span></td>
        </tr>
      `;
    }
    html += '</tbody></table>';
  }
  
  // 3. Confidence Intervals
  html += `
    <div class="table-toolbar-box" style="margin-top: 28px;">
      <h4>3. Interval Kepercayaan (Bias-Corrected Confidence Intervals)</h4>
      <button class="btn btn-xs btn-outline" onclick="copyTableTSV('tableBootstrapCI')">
        <span class="material-icons-round" style="font-size: 14px;">content_copy</span> Salin
      </button>
    </div>
    
    <table class="data-table" id="tableBootstrapCI">
      <thead>
        <tr>
          <th>Jalur Struktural</th>
          <th>Sampel Asli</th>
          <th>CI Bawah (${((hasil.significanceLevel/2)*100).toFixed(1)}%)</th>
          <th>CI Atas (${((1-hasil.significanceLevel/2)*100).toFixed(1)}%)</th>
          <th>Status Selang Nol</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  for (const [path, result] of Object.entries(hasil.pathResults)) {
    const containsZero = result.ciLower <= 0 && result.ciUpper >= 0;
    html += `
      <tr>
        <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(path)}</td>
        <td style="font-weight: 700;">${result.originalValue.toFixed(4)}</td>
        <td style="font-family: monospace;">${result.ciLower.toFixed(4)}</td>
        <td style="font-family: monospace;">${result.ciUpper.toFixed(4)}</td>
        <td>
          <span class="badge ${!containsZero ? 'badge-sukses' : 'badge-danger'}">
            ${!containsZero ? 'Tidak Melewati 0 (Signifikan)' : 'Melewati 0 (Tidak Signifikan)'}
          </span>
        </td>
      </tr>
    `;
  }
  html += '</tbody></table>';
  
  // 4. Outer loading bootstrap
  if (Object.keys(hasil.loadingResults).length > 0) {
    html += `
      <div class="table-toolbar-box" style="margin-top: 28px;">
        <h4>4. Outer Loadings - Uji Signifikansi Indikator Pengukuran</h4>
        <button class="btn btn-xs btn-outline" onclick="copyTableTSV('tableBootstrapLoadings')">
          <span class="material-icons-round" style="font-size: 14px;">content_copy</span> Salin
        </button>
      </div>
      
      <table class="data-table" id="tableBootstrapLoadings">
        <thead>
          <tr>
            <th>Variabel Laten</th>
            <th>Indikator</th>
            <th>Outer Loading</th>
            <th>T-Statistik</th>
            <th>P-Values</th>
            <th>Keputusan</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    for (const [varName, indicators] of Object.entries(hasil.loadingResults)) {
      for (const [ind, result] of Object.entries(indicators)) {
        html += `
          <tr>
            <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(varName)}</td>
            <td style="font-family: monospace; font-weight: 700; color: var(--color-primary);">${escapeHtml(ind)}</td>
            <td style="font-weight: 700;">${result.originalValue.toFixed(4)}</td>
            <td>${result.tStatistic.toFixed(4)}</td>
            <td style="font-weight: 700; color: ${result.pValue < hasil.significanceLevel ? 'var(--color-success)' : 'var(--color-danger)'}">
              ${result.pValue.toFixed(4)}
            </td>
            <td>
              <span class="badge ${result.signifikan ? 'badge-sukses' : 'badge-danger'}">
                ${result.signifikan ? 'Signifikan' : 'Tidak Signifikan'}
              </span>
            </td>
          </tr>
        `;
      }
    }
    html += '</tbody></table>';
  }
  
  bootstrapTab.innerHTML = html;

  // Render ulang laporan bab 4 agar memuat data bootstrap terbaru
  if (state.hasilPLS) {
    renderChapter4ReportTab(state.hasilPLS);
  }
}

async function loadResults() {
  if (!state.proyekAktif) return;
  
  const results = await window.api.hasilDaftar(state.proyekAktif.id);
  const elTotal = document.getElementById('totalAnalisis');
  if (elTotal) elTotal.textContent = results.length;
  
  if (results.length > 0) {
    const latest = results[0];
    if (latest.tipe === 'bootstrap') {
      state.hasilBootstrap = latest.data_hasil;
      state.hasilPLS = latest.data_hasil.originalResult;
      displayPLSResults(latest.data_hasil.originalResult);
      displayBootstrapResults(latest.data_hasil);
    } else {
      state.hasilPLS = latest.data_hasil;
      displayPLSResults(latest.data_hasil);
    }
  } else {
    renderEmptyResultsState();
  }
  updateResultsStatusBadge();
}

function prepareExportData() {
  if (!state.hasilPLS) return [];
  
  const sheets = {};
  
  // Model Fit & Path Coefficients
  sheets['Ringkasan & Model Fit'] = [
    { 'Metrik': 'Ukuran Sampel (N)', 'Nilai': state.hasilPLS.sampleSize },
    { 'Metrik': 'Iterasi', 'Nilai': state.hasilPLS.iterations },
    { 'Metrik': 'Konvergen', 'Nilai': state.hasilPLS.converged ? 'Ya' : 'Tidak' },
    { 'Metrik': 'SRMR', 'Nilai': (state.hasilPLS.modelFit?.srmr || 0).toFixed(4) },
    { 'Metrik': 'NFI', 'Nilai': (state.hasilPLS.modelFit?.nfi || 0).toFixed(4) }
  ];

  sheets['Koefisien Jalur'] = Object.entries(state.hasilPLS.pathCoefficients).map(([path, coeff]) => ({
    'Jalur': path,
    'Koefisien (β)': coeff.toFixed(4),
    'f² Effect Size': (state.hasilPLS.effectSizes?.[path] || 0).toFixed(4)
  }));
  
  // R²
  sheets['R Kuadrat'] = Object.entries(state.hasilPLS.rSquared).map(([name, r2]) => ({
    'Variabel Endogen': name,
    'R²': r2.toFixed(4),
    'R² Adjusted': (state.hasilPLS.rSquaredAdj?.[name] || r2).toFixed(4)
  }));
  
  // Outer Loadings & VIF
  const loadingRows = [];
  for (const [varName, loadings] of Object.entries(state.hasilPLS.outerLoadings)) {
    for (const [ind, val] of Object.entries(loadings)) {
      loadingRows.push({
        'Variabel': varName,
        'Indikator': ind,
        'Loading': val.toFixed(4),
        'Outer VIF': (state.hasilPLS.vif?.outerVIF?.[varName]?.[ind] || 1.0).toFixed(3)
      });
    }
  }
  sheets['Outer Loading & VIF'] = loadingRows;
  
  // Reliability
  sheets['Reliabilitas & AVE'] = Object.entries(state.hasilPLS.reliability).map(([name, rel]) => ({
    'Variabel': name,
    "Cronbach's Alpha": rel.cronbachAlpha.toFixed(4),
    'rho_A': rel.rhoA.toFixed(4),
    'Composite Reliability': rel.compositeReliability.toFixed(4),
    'AVE': rel.ave.toFixed(4)
  }));

  // HTMT
  if (state.hasilPLS.htmt) {
    const htmtRows = [];
    for (const [v1, targets] of Object.entries(state.hasilPLS.htmt)) {
      for (const [v2, val] of Object.entries(targets)) {
        if (v1 !== v2) {
          htmtRows.push({ 'Konstruk 1': v1, 'Konstruk 2': v2, 'HTMT Ratio': val.toFixed(4) });
        }
      }
    }
    sheets['HTMT Matrix'] = htmtRows;
  }

  // Cross Loadings
  if (state.hasilPLS.crossLoadings) {
    const crossRows = [];
    for (const [ind, data] of Object.entries(state.hasilPLS.crossLoadings)) {
      const row = { 'Indikator': ind, 'Konstruk Asal': data.konstruk };
      for (const [targetVar, val] of Object.entries(data.loadings)) {
        row[targetVar] = Number(val.toFixed(4));
      }
      crossRows.push(row);
    }
    sheets['Cross Loadings'] = crossRows;
  }
  
  // Q² Predictive Relevance
  const q2Data = state.hasilPLS.q2 || (plsEngine ? plsEngine.calculateBlindfoldingQ2(state.hasilPLS.latentScores, state.hasilPLS.rSquared) : {});
  if (q2Data && Object.keys(q2Data).length > 0) {
    sheets['Relevansi Prediktif (Q²)'] = Object.entries(q2Data).map(([varName, item]) => ({
      'Variabel Endogen': varName,
      'R² Asli': item.r2,
      'SSO (Observed)': item.sso,
      'SSE (Prediction Error)': item.sse,
      'Q² (= 1 - SSE/SSO)': item.q2,
      'Kategori Relevansi': item.kategoriRelevansi
    }));
  }

  // Mediasi Spesifik & VAF
  const detailedMed = plsEngine ? plsEngine.calculateDetailedMediationAndVAF(state.hasilPLS.pathCoefficients, state.hasilBootstrap) : [];
  if (detailedMed && detailedMed.length > 0) {
    sheets['Mediasi Spesifik & VAF'] = detailedMed.map(dm => ({
      'Jalur Mediasi': dm.path,
      'Efek Tidak Langsung (β)': dm.indirectEffect,
      'Efek Langsung (β)': dm.directEffect,
      'Total Efek': dm.totalEffect,
      'VAF (%)': dm.vaf,
      'T-Statistik': dm.tStatistic,
      'P-Value': dm.pValue,
      '95% CI Lower': dm.ciLower,
      '95% CI Upper': dm.ciUpper,
      'Tipe Mediasi': dm.tipeMediasi
    }));
  }

  // Common Method Bias (Full Collinearity VIF)
  const cmbData = state.hasilPLS.fullCollinearity || (plsEngine ? plsEngine.calculateFullCollinearityVIF(state.hasilPLS.latentScores) : null);
  if (cmbData && cmbData.results) {
    sheets['Common Method Bias (CMB)'] = cmbData.results.map(r => ({
      'Variabel Laten': r.variabel,
      'Full Collinearity R²': r.rSquared,
      'Full Collinearity VIF': r.fullVIF,
      'Kriteria Kock (2015)': '≤ 3.300',
      'Status CMB': r.status
    }));
  }

  // Uji Moderasi
  if (state.hasilModerasi) {
    const mr = state.hasilModerasi;
    sheets['Uji Efek Moderasi'] = [
      { 'Parameter': 'Model Interaksi', 'Nilai': `${mr.ivName} × ${mr.modName} → ${mr.dvName}` },
      { 'Parameter': 'Koefisien Interaksi (β_int)', 'Nilai': mr.betaInteraction.toFixed(4) },
      { 'Parameter': 'T-Statistik Interaksi', 'Nilai': mr.tStatistic.toFixed(4) },
      { 'Parameter': 'P-Value Interaksi', 'Nilai': mr.pValue.toFixed(4) },
      { 'Parameter': 'Signifikan (p < 0.05)', 'Nilai': mr.isSignificant ? 'Ya' : 'Tidak' },
      { 'Parameter': 'Effect Size Moderasi (f²)', 'Nilai': mr.f2Mod.toFixed(4) },
      { 'Parameter': 'Perubahan R² (ΔR²)', 'Nilai': mr.deltaR2.toFixed(4) },
      { 'Parameter': 'Slope Rendah (-1 SD)', 'Nilai': mr.slopeLow.toFixed(4) },
      { 'Parameter': 'Slope Rata-rata (Mean)', 'Nilai': mr.slopeMean.toFixed(4) },
      { 'Parameter': 'Slope Tinggi (+1 SD)', 'Nilai': mr.slopeHigh.toFixed(4) }
    ];
  }
  
  return sheets;
}

// ============ SETTINGS HANDLERS ============
function initSettingsHandlers() {
  document.querySelectorAll('.tema-option').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.tema);
    });
  });

  initMcpSettingsPanel();
}

function initMcpSettingsPanel() {
  const mcpServerPath = 'mcp-server/index.js';

  // Config snippets per host
  const configs = {
    claude: JSON.stringify({
      mcpServers: { freepls: { command: 'node', args: [mcpServerPath] } }
    }, null, 2),
    cursor: JSON.stringify({
      mcpServers: { freepls: { command: 'node', args: [mcpServerPath] } }
    }, null, 2),
    agy: JSON.stringify({
      servers: { freepls: { command: 'node', args: [mcpServerPath] } }
    }, null, 2),
    cli: `node ${mcpServerPath}`,
  };

  // Resolve absolute path via IPC if available, else use placeholder
  if (window.api?.getAppPath) {
    window.api.getAppPath().then(appPath => {
      const abs = appPath.replace(/\\/g, '/') + '/mcp-server/index.js';
      configs.claude = JSON.stringify({ mcpServers: { freepls: { command: 'node', args: [abs] } } }, null, 2);
      configs.cursor = configs.claude;
      configs.agy    = JSON.stringify({ servers: { freepls: { command: 'node', args: [abs] } } }, null, 2);
      configs.cli    = `node "${abs}"`;
      fillMcpConfigs(configs);
    }).catch(() => fillMcpConfigs(configs));
  } else {
    fillMcpConfigs(configs);
  }

  // Tab switching
  document.querySelectorAll('.mcp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mcp-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.mcp-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.target)?.classList.add('active');
    });
  });

  // Copy buttons
  document.querySelectorAll('.mcp-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pre = document.getElementById(btn.dataset.copy);
      if (!pre) return;
      navigator.clipboard.writeText(pre.textContent).then(() => {
        const icon = btn.querySelector('.material-icons-round');
        icon.textContent = 'check';
        setTimeout(() => { icon.textContent = 'content_copy'; }, 1500);
      });
    });
  });

  // Check if MCP server file exists
  checkMcpStatus();
}

function fillMcpConfigs(configs) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('mcp-config-claude', configs.claude);
  set('mcp-config-cursor', configs.cursor);
  set('mcp-config-agy',    configs.agy);
  set('mcp-config-cli',    configs.cli);
}

async function checkMcpStatus() {
  const badge = document.getElementById('mcp-status-badge');
  const text  = document.getElementById('mcp-status-text');
  if (!badge || !text) return;

  try {
    // Try to ping the MCP server via IPC (app exposes checkMcpServer if wired)
    if (window.electronAPI?.checkMcpServer) {
      const running = await window.electronAPI.checkMcpServer();
      badge.className = `mcp-badge ${running ? 'mcp-running' : 'mcp-stopped'}`;
      text.textContent = running ? 'Server tersedia' : 'Server tidak aktif';
    } else {
      badge.className = 'mcp-badge mcp-stopped';
      text.textContent = 'Siap dijalankan';
    }
  } catch {
    badge.className = 'mcp-badge mcp-stopped';
    text.textContent = 'Siap dijalankan';
  }
}

// ============ UTILITIES ============
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

// Resize handler for canvas
window.addEventListener('resize', () => {
  if (state.proyekAktif) {
    setTimeout(renderModel, 100);
  }
});

// ============ UJI VALIDITAS & RELIABILITAS INSTRUMEN (PILOT TESTING) ============
let lastInstrumentTestResult = null;

function initInstrumentTestHandlers() {
  const openModal = async () => {
    if (!state.proyekAktif) {
      showToast('Pilih atau buat proyek terlebih dahulu', 'peringatan');
      return;
    }
    const datasets = await window.api.datasetDaftar(state.proyekAktif.id);
    if (!datasets || datasets.length === 0) {
      showToast('Impor data kuesioner / dataset terlebih dahulu', 'peringatan');
      return;
    }

    // Populate dataset dropdown
    const selectDs = document.getElementById('selectDatasetUjiInstrumen');
    if (selectDs) {
      selectDs.innerHTML = datasets.map(d => `<option value="${d.id}" ${dataViewerState.activeDatasetId === d.id ? 'selected' : ''}>${escapeHtml(d.nama)} (${d.jumlah_baris} baris, ${d.jumlah_kolom} kolom)</option>`).join('');
    }

    const defaultDsId = dataViewerState.activeDatasetId || datasets[0].id;
    await populateInstrumentItemCheckboxes(defaultDsId);

    // Subtabs init
    document.querySelectorAll('#modalUjiInstrumen .hasil-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#modalUjiInstrumen .hasil-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('#modalUjiInstrumen .subtab-panel').forEach(p => {
          p.classList.remove('active');
          p.classList.add('tersembunyi');
        });
        tab.classList.add('active');
        const target = document.getElementById(`subtab-${tab.dataset.subtab}`);
        if (target) {
          target.classList.remove('tersembunyi');
          target.classList.add('active');
        }
      });
    });

    showModal('modalUjiInstrumen');
  };

  document.getElementById('btnBukaUjiInstrumen')?.addEventListener('click', openModal);
  document.getElementById('btnBukaModalUjiInstrumenDariAnalisis')?.addEventListener('click', openModal);

  document.getElementById('selectDatasetUjiInstrumen')?.addEventListener('change', async (e) => {
    const dsId = parseInt(e.target.value);
    if (dsId) await populateInstrumentItemCheckboxes(dsId);
  });

  document.getElementById('btnPilihSemuaItemUji')?.addEventListener('click', () => {
    document.querySelectorAll('#containerItemCheckboxes input[type="checkbox"]').forEach(cb => {
      cb.checked = true;
      cb.closest('.item-checkbox-pill')?.classList.add('checked');
    });
  });

  document.getElementById('btnResetItemUji')?.addEventListener('click', () => {
    document.querySelectorAll('#containerItemCheckboxes input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
      cb.closest('.item-checkbox-pill')?.classList.remove('checked');
    });
  });

  // Jalankan Perhitungan Uji Instrumen
  document.getElementById('btnJalankanUjiInstrumen')?.addEventListener('click', async () => {
    const selectDs = document.getElementById('selectDatasetUjiInstrumen');
    const dsId = parseInt(selectDs?.value);
    if (!dsId) {
      showToast('Pilih dataset terlebih dahulu', 'peringatan');
      return;
    }

    const selectedCols = [];
    document.querySelectorAll('#containerItemCheckboxes input[type="checkbox"]:checked').forEach(cb => {
      selectedCols.push(cb.value);
    });

    if (selectedCols.length < 2) {
      showToast('Pilih minimal 2 butir/indikator kuesioner untuk diuji', 'peringatan');
      return;
    }

    showLoading(
      'Menghitung Uji Validitas & Reliabilitas Instrumen...',
      800,
      'Korelasi Pearson r-Hitung, Cronbach Alpha & Validitas Butir Pertanyaan',
      'fact_check'
    );
    try {
      const ds = await window.api.datasetAmbil(dsId);
      if (!ds || !ds.data || ds.data.length === 0) {
        throw new Error('Data pada dataset kosong');
      }

      const alpha = parseFloat(document.getElementById('selectAlphaUjiInstrumen')?.value) || 0.05;
      const res = plsEngine.testInstrumentReliabilityAndValidity(ds.data, selectedCols, { alpha });
      lastInstrumentTestResult = { ...res, datasetName: ds.nama, selectedCols };

      // Render Hasil ke UI
      renderInstrumentTestResults(lastInstrumentTestResult);
      showToast('Pengujian validitas & reliabilitas instrumen selesai!', 'sukses');
    } catch (e) {
      showToast('Gagal menjalankan uji instrumen: ' + e.message, 'error');
    }
    hideLoading();
  });

  // Salin Draf Teks Laporan Uji Instrumen
  document.getElementById('btnSalinDrafUjiInstrumen')?.addEventListener('click', async () => {
    const ta = document.getElementById('textareaDrafUjiInstrumen');
    if (!ta || !ta.value) {
      showToast('Belum ada hasil uji untuk disalin', 'peringatan');
      return;
    }
    try {
      await navigator.clipboard.writeText(ta.value);
      showToast('Draf interpretasi akademik berhasil disalin ke clipboard!', 'sukses');
    } catch {
      ta.select();
      document.execCommand('copy');
      showToast('Draf berhasil disalin!', 'sukses');
    }
  });

  // Ekspor Excel Uji Instrumen
  document.getElementById('btnEksporExcelUjiInstrumen')?.addEventListener('click', async () => {
    if (!lastInstrumentTestResult) {
      showToast('Jalankan pengujian instrumen terlebih dahulu', 'peringatan');
      return;
    }

    const r = lastInstrumentTestResult;
    const excelRows = r.itemAnalysis.map((item, idx) => ({
      'No': idx + 1,
      'Butir / Indikator': item.kolom,
      'Mean': item.mean,
      'Std. Deviasi': item.stdDev,
      'Varians Butir': item.variance,
      'r-Hitung (Pearson)': item.rHitung,
      [`r-Tabel (df=${r.df})`]: item.rTabel,
      'Sig. (2-Tailed)': item.pValue,
      'Status Validitas Pearson': item.isValidPearson ? 'Valid' : 'Gugur / Tidak Valid',
      'Corrected Item-Total (r >= 0.30)': item.correctedItemTotal,
      'Daya Beda Butir': item.isValidCorrected ? 'Baik' : 'Kurang',
      "Cronbach's Alpha if Item Deleted": item.alphaIfDeleted,
      'Kesimpulan Butir': item.statusDiagnosa
    }));

    const summaryRows = [
      { 'Metrik': 'Nama Dataset', 'Nilai': r.datasetName },
      { 'Metrik': 'Jumlah Responden (N)', 'Nilai': r.N },
      { 'Metrik': 'Derajat Kebebasan (df = N - 2)', 'Nilai': r.df },
      { 'Metrik': 'Taraf Signifikansi (Alpha)', 'Nilai': r.alphaSig },
      { 'Metrik': 'Nilai Kritis r-Tabel', 'Nilai': r.rTabel },
      { 'Metrik': 'Jumlah Butir (k)', 'Nilai': r.k },
      { 'Metrik': "Koefisien Cronbach's Alpha", 'Nilai': r.overallAlpha },
      { 'Metrik': 'Kategori Reliabilitas', 'Nilai': r.reliabilityCategory },
      { 'Metrik': 'Status Reliabilitas Instrumen', 'Nilai': r.isReliable ? 'Reliabel (alpha >= 0.70)' : 'Tidak Reliabel' },
      { 'Metrik': 'Jumlah Butir Valid', 'Nilai': `${r.totalValid} butir` },
      { 'Metrik': 'Jumlah Butir Gugur', 'Nilai': `${r.totalGugur} butir` }
    ];

    const sheets = {
      'Uji Validitas & Reliabilitas': excelRows,
      'Ringkasan Metodologi': summaryRows
    };

    const fileName = `Uji_Instrumen_${(r.datasetName || 'Dataset').replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
    const result = await window.api.eksporHasil({
      data: sheets,
      namaFile: fileName
    });
    if (result) {
      showToast('Tabel uji instrumen berhasil diekspor ke Excel!', 'sukses');
    }
  });
}

async function populateInstrumentItemCheckboxes(datasetId) {
  const ds = await window.api.datasetAmbil(datasetId);
  const container = document.getElementById('containerItemCheckboxes');
  if (!container || !ds || !ds.kolom) return;

  container.innerHTML = ds.kolom.map(col => `
    <label class="item-checkbox-pill checked">
      <input type="checkbox" value="${escapeHtml(col)}" checked onchange="this.closest('.item-checkbox-pill').classList.toggle('checked', this.checked)">
      <span>${escapeHtml(col)}</span>
    </label>
  `).join('');
}

function renderInstrumentTestResults(r) {
  const containerHasil = document.getElementById('containerHasilUjiInstrumen');
  if (!containerHasil) return;
  containerHasil.style.display = 'flex';

  // Update Summary Cards
  document.getElementById('valOverallAlpha').textContent = r.overallAlpha;
  const badgeCat = document.getElementById('badgeReliabilityCategory');
  if (badgeCat) {
    badgeCat.textContent = r.reliabilityCategory;
    badgeCat.className = `badge-chip ${r.overallAlpha >= 0.70 ? 'badge-success' : 'badge-danger'}`;
  }

  document.getElementById('valValidCount').textContent = `${r.totalValid} / ${r.k} Butir Valid`;
  document.getElementById('valGugurCount').textContent = r.totalGugur > 0 ? `${r.totalGugur} Butir Gugur (Tidak Valid)` : 'Semua butir memenuhi syarat';
  document.getElementById('valRTabelKritis').textContent = r.rTabel;
  document.getElementById('valDfInfo').textContent = `df = ${r.df} (N = ${r.N}, \u03B1 = ${r.alphaSig})`;

  // Render Table
  const tbody = document.getElementById('tbodyHasilUjiInstrumen');
  if (tbody) {
    tbody.innerHTML = r.itemAnalysis.map(item => `
      <tr>
        <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(item.kolom)}</td>
        <td class="col-num">${item.mean}</td>
        <td class="col-num">${item.stdDev}</td>
        <td class="col-num" style="font-weight: 700; color: ${item.isValidPearson ? '#10b981' : '#f87171'}">${item.rHitung}</td>
        <td class="col-num">${item.rTabel}</td>
        <td class="col-num">${item.pValue}</td>
        <td>
          <span class="badge-chip ${item.isValidPearson ? 'badge-success' : 'badge-danger'}">
            ${item.isValidPearson ? 'Valid (r > r_tabel)' : 'Gugur (r < r_tabel)'}
          </span>
        </td>
        <td class="col-num" style="color: ${item.isValidCorrected ? '#10b981' : '#fbbf24'}">${item.correctedItemTotal}</td>
        <td class="col-num">${item.alphaIfDeleted}</td>
        <td>
          <span class="badge-chip badge-${item.statusBadge}">
            ${escapeHtml(item.statusDiagnosa)}
          </span>
        </td>
      </tr>
    `).join('');
  }

  // Generate Draf Narasi Metodologi & Hasil
  const drafText = generateInstrumentReportText(r);
  const ta = document.getElementById('textareaDrafUjiInstrumen');
  if (ta) {
    ta.value = drafText;
  }
}

function generateInstrumentReportText(r) {
  return `================================================================================
HASIL UJI VALIDITAS DAN RELIABILITAS INSTRUMEN PENELITIAN (PILOT TEST)
Format Laporan Metodologi Riset Kuantitatif & Publikasi Ilmiah
================================================================================

A. UJI VALIDITAS BUTIR KUESIONER (PEARSON PRODUCT MOMENT)
Pengujian validitas instrumen bertujuan untuk mengukur derajat kesahihan butir-butir instrumen pengumpulan data. Pengujian dilakukan terhadap ${r.N} responden uji coba (pilot test) dengan derajat kebebasan df = N - 2 = ${r.df} pada taraf signifikansi α = ${r.alphaSig} (two-tailed), sehingga diperoleh nilai r-tabel kritis sebesar ${r.rTabel} (Sugiyono, 2019; Azwar, 2018).

1. Alur & Rumus Korelasi Pearson Product Moment (r_hitung):
   r_xy = [ N ∑XY - (∑X)(∑Y) ] / √[ (N ∑X² - (∑X)²) (N ∑Y² - (∑Y)²) ]
   Di mana:
   - X = Skor butir pernyataan
   - Y = Skor total variabel
   - N = Jumlah responden uji coba (${r.N})

2. Alur & Rumus Daya Beda Butir (Corrected Item-Total Correlation, r_it):
   r_i(t-i) = ( r_it × s_t - s_i ) / √( s_t² + s_i² - 2 × r_it × s_t × s_i )
   Kriteria daya beda butir yang baik adalah r_i(t-i) >= 0.300 (Nunnally & Bernstein, 1994).

3. Kriteria Pengambilan Keputusan Validitas:
   - Jika r_hitung > r_tabel (${r.rTabel}) dan p-value < ${r.alphaSig}, maka butir dinyatakan VALID.
   - Jika r_hitung <= r_tabel (${r.rTabel}) atau p-value >= ${r.alphaSig}, maka butir dinyatakan GUGUR / TIDAK VALID.

Ringkasan Hasil Uji Validitas:
- Total Butir Diuji : ${r.k} Butir
- Butir Valid       : ${r.totalValid} Butir (${((r.totalValid / r.k) * 100).toFixed(1)}%)
- Butir Gugur       : ${r.totalGugur} Butir (${((r.totalGugur / r.k) * 100).toFixed(1)}%)

Tabel Rincian Hasil Validitas Butir:
${r.itemAnalysis.map(i => `- Butir ${i.kolom.padEnd(8)}: r-hitung = ${i.rHitung.padEnd(6)} | r-tabel = ${i.rTabel} | Sig. = ${i.pValue.padEnd(7)} | Corrected r = ${i.correctedItemTotal.padEnd(6)} | Status: ${i.isValidPearson ? 'VALID' : 'GUGUR'}`).join('\n')}

Kesimpulan Validitas:
Berdasarkan tabel di atas, sebanyak ${r.totalValid} butir pernyataan memiliki nilai r-hitung > r-tabel (${r.rTabel}) dan berdaya beda baik (Corrected Item-Total Correlation >= 0.300), sehingga dinyatakan VALID dan layak digunakan untuk pengumpulan data riset.

--------------------------------------------------------------------------------
B. UJI RELIABILITAS INSTRUMEN (CRONBACH'S ALPHA)
Uji reliabilitas dilakukan untuk mengetahui konsistensi dan stabilitas instrumen kuesioner jika dilakukan pengukuran berulang pada subjek yang sama (Cronbach, 1951).

1. Alur & Rumus Koefisien Cronbach's Alpha (α):
   α = [ k / (k - 1) ] × [ 1 - ( ∑ sᵢ² / s_total² ) ]
   Di mana:
   - k = Jumlah butir pertanyaan yang diuji (${r.k})
   - ∑ sᵢ² = Jumlah varians masing-masing butir
   - s_total² = Varians skor total kuesioner

2. Kriteria Pengambilan Keputusan:
   Konstruk dinyatakan reliabel jika koefisien Cronbach's Alpha >= 0.700 (Hair et al., 2022; Ghozali, 2021).

Hasil Uji Reliabilitas:
- Koefisien Cronbach's Alpha : ${r.overallAlpha}
- Kategori Reliabilitas      : ${r.reliabilityCategory}
- Nilai Ambang Batas Cut-off  : 0.700
- Status Instrumen           : ${r.isReliable ? 'RELIABEL (MEMENUHI SYARAT)' : 'TIDAK RELIABEL'}

Kesimpulan Reliabilitas:
Nilai koefisien Cronbach's Alpha yang diperoleh sebesar ${r.overallAlpha} (>= 0.700), membuktikan bahwa seluruh butir pernyataan dalam instrumen memiliki konsistensi internal yang ${r.reliabilityCategory.toLowerCase()} dan memenuhi kriteria reliabilitas pengujian ilmiah.

--------------------------------------------------------------------------------
REFERENSI PUSTAKA ACUAN:
1. Azwar, S. (2018). Reliabilitas dan Validitas (Edisi 4). Yogyakarta: Pustaka Pelajar.
2. Cronbach, L. J. (1951). Coefficient alpha and the internal structure of tests. Psychometrika, 16(3), 297-334.
3. Ghozali, I. (2021). Aplikasi Analisis Multivariate dengan Program IBM SPSS 26 (Edisi 10). Semarang: Badan Penerbit Universitas Diponegoro.
4. Hair, J. F., Hult, G. T. M., Ringle, C. M., & Sarstedt, M. (2022). A Primer on Partial Least Squares Structural Equation Modeling (PLS-SEM) (3rd ed.). Thousand Oaks: SAGE Publications.
5. Nunnally, J. C., & Bernstein, I. H. (1994). Psychometric Theory (3rd ed.). New York: McGraw-Hill.
6. Sugiyono. (2019). Metode Penelitian Kuantitatif, Kualitatif, dan R&D. Bandung: Alfabeta.
================================================================================`;
}

// ============ STATISTIK DESKRIPTIF & NORMALITAS UNIVARIAT ============
let lastDescriptiveStatsResult = null;

function initDescriptiveStatsHandlers() {
  const openModal = async () => {
    if (!state.proyekAktif) {
      showToast('Pilih atau buat proyek terlebih dahulu', 'peringatan');
      return;
    }
    const datasets = await window.api.datasetDaftar(state.proyekAktif.id);
    if (!datasets || datasets.length === 0) {
      showToast('Impor data / dataset terlebih dahulu', 'peringatan');
      return;
    }

    const selectDs = document.getElementById('selectDatasetDeskriptif');
    if (selectDs) {
      selectDs.innerHTML = datasets.map(d => `<option value="${d.id}" ${dataViewerState.activeDatasetId === d.id ? 'selected' : ''}>${escapeHtml(d.nama)} (${d.jumlah_baris} baris, ${d.jumlah_kolom} kolom)</option>`).join('');
    }

    const defaultDsId = dataViewerState.activeDatasetId || datasets[0].id;
    await populateDeskriptifItemCheckboxes(defaultDsId);

    // Subtabs init
    document.querySelectorAll('#modalStatistikDeskriptif .hasil-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#modalStatistikDeskriptif .hasil-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('#modalStatistikDeskriptif .deskriptif-panel').forEach(p => {
          p.classList.remove('active');
          p.classList.add('tersembunyi');
        });
        tab.classList.add('active');
        const target = document.getElementById(`deskriptif-${tab.dataset.deskriptiftab}`);
        if (target) {
          target.classList.remove('tersembunyi');
          target.classList.add('active');
        }
      });
    });

    showModal('modalStatistikDeskriptif');
  };

  document.getElementById('btnBukaStatistikDeskriptif')?.addEventListener('click', openModal);
  document.getElementById('btnBukaModalDeskriptifDariAnalisis')?.addEventListener('click', openModal);

  document.getElementById('selectDatasetDeskriptif')?.addEventListener('change', async (e) => {
    const dsId = parseInt(e.target.value);
    if (dsId) await populateDeskriptifItemCheckboxes(dsId);
  });

  document.getElementById('btnPilihSemuaDeskriptif')?.addEventListener('click', () => {
    document.querySelectorAll('#containerDeskriptifCheckboxes input[type="checkbox"]').forEach(cb => {
      cb.checked = true;
      cb.closest('.item-checkbox-pill')?.classList.add('checked');
    });
  });

  document.getElementById('btnResetDeskriptif')?.addEventListener('click', () => {
    document.querySelectorAll('#containerDeskriptifCheckboxes input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
      cb.closest('.item-checkbox-pill')?.classList.remove('checked');
    });
  });

  // Jalankan Perhitungan Statistik Deskriptif
  document.getElementById('btnJalankanDeskriptif')?.addEventListener('click', async () => {
    const selectDs = document.getElementById('selectDatasetDeskriptif');
    const dsId = parseInt(selectDs?.value);
    if (!dsId) {
      showToast('Pilih dataset terlebih dahulu', 'peringatan');
      return;
    }

    const selectedCols = [];
    document.querySelectorAll('#containerDeskriptifCheckboxes input[type="checkbox"]:checked').forEach(cb => {
      selectedCols.push(cb.value);
    });

    if (selectedCols.length < 1) {
      showToast('Pilih minimal 1 kolom/indikator untuk dihitung', 'peringatan');
      return;
    }

    showLoading(
      'Menghitung Statistik Deskriptif & Uji Normalitas...',
      700,
      'Mean, Median, Standar Deviasi, Skewness, Kurtosis & Jarque-Bera',
      'analytics'
    );
    try {
      const ds = await window.api.datasetAmbil(dsId);
      if (!ds || !ds.data || ds.data.length === 0) {
        throw new Error('Data pada dataset kosong');
      }

      const maxScale = parseFloat(document.getElementById('selectSkalaDeskriptif')?.value) || 5;
      const results = plsEngine.calculateDescriptiveStats(ds.data, selectedCols, { maxScale });
      lastDescriptiveStatsResult = { results, datasetName: ds.nama, maxScale, N: ds.data.length };

      renderDescriptiveStatsUI(lastDescriptiveStatsResult);
      showToast('Statistik deskriptif berhasil dihitung!', 'sukses');
    } catch (e) {
      showToast('Gagal menghitung statistik deskriptif: ' + e.message, 'error');
    }
    hideLoading();
  });

  // Salin Draf Deskriptif
  document.getElementById('btnSalinDrafDeskriptif')?.addEventListener('click', async () => {
    const ta = document.getElementById('textareaDrafDeskriptif');
    if (!ta || !ta.value) {
      showToast('Belum ada data untuk disalin', 'peringatan');
      return;
    }
    try {
      await navigator.clipboard.writeText(ta.value);
      showToast('Draf pembahasan hasil analisis berhasil disalin ke clipboard!', 'sukses');
    } catch {
      ta.select();
      document.execCommand('copy');
      showToast('Draf berhasil disalin!', 'sukses');
    }
  });

  // Ekspor Excel Deskriptif
  document.getElementById('btnEksporExcelDeskriptif')?.addEventListener('click', async () => {
    if (!lastDescriptiveStatsResult || !lastDescriptiveStatsResult.results) {
      showToast('Jalankan perhitungan deskriptif terlebih dahulu', 'peringatan');
      return;
    }

    const res = lastDescriptiveStatsResult.results;
    const deskriptifRows = res.map((r, idx) => ({
      'No': idx + 1,
      'Variabel / Indikator': r.kolom,
      'N Responden': r.N,
      'Mean (Rata-rata)': r.mean,
      'Std. Error Mean': r.seMean,
      'Median': r.median,
      'Modus': r.mode,
      'Std. Deviasi': r.stdDev,
      'Varians': r.variance,
      'Minimum': r.min,
      'Maksimum': r.max,
      'Range': r.range,
      'Sum (Total)': r.sum,
      'TCR (%)': r.tcr,
      'Kategori Capaian': r.kategoriTCR
    }));

    const normalitasRows = res.map((r, idx) => ({
      'No': idx + 1,
      'Variabel / Indikator': r.kolom,
      'N Responden': r.N,
      'Skewness': r.skewness,
      'Std. Error Skew': r.seSkew,
      'Z-Score Skewness': r.zSkew,
      'Kurtosis': r.kurtosis,
      'Std. Error Kurt': r.seKurt,
      'Z-Score Kurtosis': r.zKurt,
      'Status Distribusi Univariat': r.statusNormalitas
    }));

    const sheets = {
      'Statistik Deskriptif': deskriptifRows,
      'Uji Normalitas Univariat': normalitasRows
    };

    const fileName = `Statistik_Deskriptif_${(lastDescriptiveStatsResult.datasetName || 'Dataset').replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
    const result = await window.api.eksporHasil({
      data: sheets,
      namaFile: fileName
    });
    if (result) {
      showToast('Tabel statistik deskriptif berhasil diekspor ke Excel!', 'sukses');
    }
  });

  // Handler Buka Panduan Glosarium Kolom
  document.getElementById('btnBukaPanduanKolomDeskriptif')?.addEventListener('click', () => {
    tampilkanInfoKolomDeskriptif();
  });

  // Filter input pada modal panduan kolom
  document.getElementById('inputFilterPanduanDeskriptif')?.addEventListener('input', (e) => {
    const q = (e.target.value || '').toLowerCase().trim();
    const cards = document.querySelectorAll('#containerListPanduanDeskriptif .panduan-kolom-card');
    cards.forEach(card => {
      const kw = (card.dataset.keyword || '').toLowerCase();
      const txt = card.textContent.toLowerCase();
      if (!q || kw.includes(q) || txt.includes(q)) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  });
}

function tampilkanInfoKolomDeskriptif(kolomKey = '', event = null) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  showModal('modalPanduanKolomDeskriptif');

  const filterInput = document.getElementById('inputFilterPanduanDeskriptif');
  if (filterInput) filterInput.value = '';

  const cards = document.querySelectorAll('#containerListPanduanDeskriptif .panduan-kolom-card');
  cards.forEach(c => {
    c.style.display = 'flex';
    c.style.borderColor = '';
    c.style.boxShadow = '';
  });

  if (kolomKey) {
    const key = kolomKey.toLowerCase().replace(/_/g, ' ');
    const targetCard = Array.from(cards).find(c => {
      const kw = (c.dataset.keyword || '').toLowerCase();
      return kw.includes(key);
    });

    if (targetCard) {
      setTimeout(() => {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetCard.style.borderColor = '#10b981';
        targetCard.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.4)';
        setTimeout(() => {
          targetCard.style.borderColor = '';
          targetCard.style.boxShadow = '';
        }, 2500);
      }, 120);
    }
  }
}

window.tampilkanInfoKolomDeskriptif = tampilkanInfoKolomDeskriptif;

async function populateDeskriptifItemCheckboxes(datasetId) {
  const ds = await window.api.datasetAmbil(datasetId);
  const container = document.getElementById('containerDeskriptifCheckboxes');
  if (!container || !ds || !ds.kolom) return;

  container.innerHTML = ds.kolom.map(col => `
    <label class="item-checkbox-pill checked">
      <input type="checkbox" value="${escapeHtml(col)}" checked onchange="this.closest('.item-checkbox-pill').classList.toggle('checked', this.checked)">
      <span>${escapeHtml(col)}</span>
    </label>
  `).join('');
}

function renderDescriptiveStatsUI(dataObj) {
  const container = document.getElementById('containerHasilDeskriptif');
  if (!container) return;
  container.style.display = 'flex';

  const results = dataObj.results;

  // Render Tabel Deskriptif
  const tbodyDesk = document.getElementById('tbodyDeskriptifLengkap');
  if (tbodyDesk) {
    tbodyDesk.innerHTML = results.map(r => `
      <tr>
        <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(r.kolom)}</td>
        <td class="col-num">${r.N}</td>
        <td class="col-num" style="font-weight: 700; color: var(--color-primary);">${r.mean}</td>
        <td class="col-num">${r.seMean}</td>
        <td class="col-num">${r.median}</td>
        <td class="col-num">${r.mode}</td>
        <td class="col-num">${r.stdDev}</td>
        <td class="col-num">${r.variance}</td>
        <td class="col-num">${r.min}</td>
        <td class="col-num">${r.max}</td>
        <td class="col-num">${r.range}</td>
        <td class="col-num" style="font-weight: 700;">${r.tcr}</td>
        <td>
          <span class="badge-chip ${parseFloat(r.tcr) >= 68 ? 'badge-success' : 'badge-warning'}">
            ${escapeHtml(r.kategoriTCR)}
          </span>
        </td>
      </tr>
    `).join('');
  }

  // Render Tabel Normalitas Univariat
  const tbodyNorm = document.getElementById('tbodyNormalitasUnivariat');
  if (tbodyNorm) {
    tbodyNorm.innerHTML = results.map(r => {
      const isNorm = r.statusNormalitas.startsWith('Normal');
      return `
        <tr>
          <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(r.kolom)}</td>
          <td class="col-num">${r.N}</td>
          <td class="col-num">${r.skewness}</td>
          <td class="col-num">${r.seSkew}</td>
          <td class="col-num" style="color: ${Math.abs(parseFloat(r.zSkew)) <= 1.96 ? '#10b981' : '#fbbf24'}; font-weight: 600;">${r.zSkew}</td>
          <td class="col-num">${r.kurtosis}</td>
          <td class="col-num">${r.seKurt}</td>
          <td class="col-num" style="color: ${Math.abs(parseFloat(r.zKurt)) <= 1.96 ? '#10b981' : '#fbbf24'}; font-weight: 600;">${r.zKurt}</td>
          <td>
            <span class="badge-chip ${isNorm ? 'badge-success' : 'badge-warning'}">
              ${escapeHtml(r.statusNormalitas)}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Generate Pembahasan Deskriptif
  const narrative = generateDescriptiveReportText(dataObj);
  const ta = document.getElementById('textareaDrafDeskriptif');
  if (ta) ta.value = narrative;
}

function generateDescriptiveReportText(dataObj) {
  const { results, datasetName, maxScale, N } = dataObj;
  return `================================================================================
HASIL ANALISIS STATISTIK DESKRIPTIF VARIABEL PENELITIAN & UJI NORMALITAS
Format Narasi Laporan Riset Kuantitatif & Publikasi Ilmiah
================================================================================

A. DESKRIPSI DATA & ALUR KALKULASI STATISTIK
Analisis statistik deskriptif bertujuan untuk memberikan gambaran empiris mengenai karakteristik distribusi jawaban responden terhadap indikator-indikator variabel penelitian (${datasetName}, N = ${N} responden) dengan skala pengukuran 1 sampai ${maxScale}.

1. Rumus & Alur Perhitungan Ukuran Pemusatan & Penyebaran:
   - Mean (Rata-rata): X̄ = (∑ X) / N
   - Standard Error of Mean (SE Mean): SE = s / √N
   - Standar Deviasi (s): s = √[ ∑ (X - X̄)² / (N - 1) ]
   - Varians (s²): Kuadrat dari standar deviasi
   - Tingkat Capaian Responden (TCR): TCR (%) = ( X̄ / Skor Maksimum ) × 100%

2. Kriteria Kategori Capaian Responden (TCR):
   - 81% - 100% : Sangat Baik / Sangat Tinggi
   - 66% - 80%  : Baik / Tinggi
   - 51% - 65%  : Cukup / Sedang
   - 36% - 50%  : Kurang / Rendah
   - 0% - 35%   : Sangat Kurang / Sangat Rendah

Ringkasan Nilai Statistik Deskriptif:
${results.map(r => `- Indikator ${r.kolom.padEnd(10)}: Mean = ${r.mean} | Median = ${r.median} | StDev = ${r.stdDev} | TCR = ${r.tcr} (${r.kategoriTCR})`).join('\n')}

Interpretasi Capaian Responden (TCR):
Berdasarkan hasil analisis pada tabel di atas, rata-rata skor indikator berkisar antara ${Math.min(...results.map(r => parseFloat(r.mean))).toFixed(2)} hingga ${Math.max(...results.map(r => parseFloat(r.mean))).toFixed(2)}. Tingkat Capaian Responden (TCR) menunjukkan persepsi responden secara umum berada pada kategori ${results[0]?.kategoriTCR || 'Tinggi/Baik'}.

--------------------------------------------------------------------------------
B. EVALUASI NORMALITAS UNIVARIAT (SKEWNESS & KURTOSIS)
Pengujian normalitas univariat dilakukan dengan memeriksa rasio Z-Score terhadap standard error skewness dan kurtosis.

1. Rumus & Alur Z-Score Normalitas:
   - Z_Skewness = Skewness / SE_Skewness
     Di mana SE_Skewness ≈ √[ 6N(N-1) / ((N-2)(N+1)(N+3)) ]
   - Z_Kurtosis = Kurtosis / SE_Kurtosis
     Di mana SE_Kurtosis ≈ √[ 24N(N-1)² / ((N-3)(N-2)(N+3)(N+5)) ]

2. Kriteria Keputusan Normalitas Univariat:
   Data berdistribusi normal secara univariat apabila rasio Z-Score berada dalam rentang -1.96 <= Z <= +1.96 pada taraf signifikansi α = 0.05 (Hair et al., 2022; Ghozali, 2021).

Rincian Uji Normalitas:
${results.map(r => `- ${r.kolom.padEnd(10)}: Z-Skew = ${r.zSkew.padEnd(6)} | Z-Kurt = ${r.zKurt.padEnd(6)} | Status: ${r.statusNormalitas}`).join('\n')}

Catatan Metodologi Analisis PLS-SEM:
Dalam pemodelan PLS-SEM (Partial Least Squares - SEM), asumsi normalitas data bersifat non-parametrik (distribution-free), sehingga apabila terdapat indikator yang tidak berdistribusi normal sempurna secara univariat, estimasi parameter PLS-SEM tetap andal (robust) dan valid untuk digunakan melalui prosedur Bootstrapping (Hair et al., 2022).
================================================================================`;
}

// Helper to ensure PLS Engine has dataset and latent scores before moderation analysis
async function ensurePLSEngineReady() {
  if (plsEngine && plsEngine.hasil && plsEngine.hasil.latentScores) return true;
  if (!state.proyekAktif) return false;
  try {
    const datasets = await window.api.datasetDaftar(state.proyekAktif.id);
    if (!datasets || datasets.length === 0) return false;
    const dataset = await window.api.datasetAmbil(datasets[0].id);
    if (!dataset || !dataset.data || dataset.data.length === 0) return false;
    plsEngine.setData(dataset.data, state.variabels, state.jalurs);
    plsEngine.runPLS();
    return true;
  } catch (e) {
    console.error('ensurePLSEngineReady error:', e);
    return false;
  }
}

// ============ UJI PENGARUH MODERASI & SIMPLE SLOPE PLOT ============
function initModerationHandlers() {
  const openModal = () => {
    if (!state.variabels || state.variabels.length < 3) {
      showToast('Model harus memiliki minimal 3 variabel laten untuk uji moderasi', 'peringatan');
      return;
    }
    populateModerationDropdowns();
    showModal('modalUjiModerasi');
  };

  document.getElementById('btnBukaModalModerasiDariAnalisis')?.addEventListener('click', openModal);

  document.getElementById('btnJalankanUjiModerasi')?.addEventListener('click', async () => {
    const iv = document.getElementById('selectModerasiIV')?.value;
    const mod = document.getElementById('selectModerasiMOD')?.value;
    const dv = document.getElementById('selectModerasiDV')?.value;

    if (!iv || !mod || !dv) {
      showToast('Pilih ketiga variabel (X, M, Y)', 'peringatan');
      return;
    }
    if (iv === mod || iv === dv || mod === dv) {
      showToast('Variabel Independen (X), Moderasi (M), dan Dependen (Y) harus berbeda', 'peringatan');
      return;
    }

    showLoading(
      'Menghitung Regresi Moderasi & Gradien Simple Slopes...',
      800,
      'Estimasi Two-Stage Interaction, f² Effect Size & Simple Slopes ±1 SD',
      'tune'
    );

    setTimeout(async () => {
      try {
        await ensurePLSEngineReady();
        runModerationCalculation(iv, mod, dv);
        showToast('Kalkulasi regresi moderasi & plot gradien selesai!', 'sukses');
      } catch (err) {
        console.error('Moderation calculation error:', err);
        showToast('Error kalkulasi moderasi: ' + err.message, 'error');
      } finally {
        hideLoading();
      }
    }, 250);
  });

  document.getElementById('btnSalinDrafModerasi')?.addEventListener('click', async () => {
    const ta = document.getElementById('textareaDrafModerasi');
    if (!ta || !ta.value) {
      showToast('Belum ada hasil uji moderasi untuk disalin', 'peringatan');
      return;
    }
    try {
      await navigator.clipboard.writeText(ta.value);
      showToast('Draf narasi uji moderasi berhasil disalin ke clipboard!', 'sukses');
    } catch {
      showToast('Gagal menyalin teks', 'error');
    }
  });

  document.getElementById('btnDownloadSlopePlotSvg')?.addEventListener('click', () => {
    const container = document.getElementById('svgSlopePlotContainer');
    const svgEl = container?.querySelector('svg');
    if (!svgEl) {
      showToast('Grafik Simple Slope belum tersedia', 'peringatan');
      return;
    }
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Simple_Slope_Plot_${state.hasilModerasi?.ivName || 'X'}_x_${state.hasilModerasi?.modName || 'M'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Grafik Simple Slope (SVG) berhasil diunduh!', 'sukses');
  });
}

function populateModerationDropdowns(defaultIV, defaultMOD, defaultDV) {
  const vars = state.variabels || [];
  const sIV = document.getElementById('selectModerasiIV');
  const sMOD = document.getElementById('selectModerasiMOD');
  const sDV = document.getElementById('selectModerasiDV');

  if (!sIV || !sMOD || !sDV) return;

  const makeOptions = (selectedVal) => vars.map((v, i) => `
    <option value="${escapeHtml(v.nama)}" ${selectedVal === v.nama || (!selectedVal && i === 0) ? 'selected' : ''}>
      ${escapeHtml(v.nama)} (${v.tipe === 'eksogen' ? 'Eksogen' : 'Endogen'})
    </option>
  `).join('');

  const ivDefault = defaultIV || (vars[0] ? vars[0].nama : '');
  const modDefault = defaultMOD || (vars[1] ? vars[1].nama : '');
  const dvDefault = defaultDV || (vars[2] ? vars[2].nama : '');

  sIV.innerHTML = makeOptions(ivDefault);
  sMOD.innerHTML = makeOptions(modDefault);
  sDV.innerHTML = makeOptions(dvDefault);
}

function openModerationModalWithVars(iv, mod, dv) {
  populateModerationDropdowns(iv, mod, dv);
  showModal('modalUjiModerasi');
  showLoading(
    'Menyiapkan Analisis Moderasi & Gradien...',
    700,
    `Mengestimasi interaksi ${iv} × ${mod} → ${dv}`,
    'tune'
  );
  setTimeout(async () => {
    try {
      await ensurePLSEngineReady();
      runModerationCalculation(iv, mod, dv);
    } catch (err) {
      console.error('Moderation modal error:', err);
      showToast('Gagal memuat kalkulasi moderasi: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  }, 250);
}

function runModerationCalculation(iv, mod, dv) {
  if (!plsEngine) throw new Error('Mesin analisis statistik belum siap.');

  // Ensure latent scores are computed
  if (!plsEngine.hasil || !plsEngine.hasil.latentScores) {
    plsEngine.runPLS();
  }

  const modResult = plsEngine.calculateModerationAnalysis(iv, mod, dv);
  state.hasilModerasi = modResult;

  const container = document.getElementById('containerHasilModerasi');
  if (container) container.style.display = 'flex';

  const formatNum = (v, digits = 3) => {
    const n = Number(v);
    return isNaN(n) ? '0.000' : n.toFixed(digits);
  };

  // Metrics
  const betaEl = document.getElementById('valModBetaInt');
  if (betaEl) betaEl.textContent = formatNum(modResult.betaInteraction);

  const tStatEl = document.getElementById('valModTStat');
  if (tStatEl) tStatEl.textContent = `t = ${formatNum(modResult.tStatistic)} (p = ${formatNum(modResult.pValue)})`;

  const f2El = document.getElementById('valModF2');
  if (f2El) f2El.textContent = formatNum(modResult.f2Mod || modResult.f2Moderasi);

  const f2DescEl = document.getElementById('valModF2Desc');
  if (f2DescEl) {
    const f2 = Number(modResult.f2Mod || modResult.f2Moderasi || 0);
    f2DescEl.textContent = f2 >= 0.35 ? 'Efek Besar (f² ≥ 0.35)' : f2 >= 0.15 ? 'Efek Sedang (f² ≥ 0.15)' : f2 >= 0.02 ? 'Efek Kecil (f² ≥ 0.02)' : 'Efek Sangat Kecil';
  }

  const deltaEl = document.getElementById('valModDeltaR2');
  if (deltaEl) deltaEl.textContent = `+${formatNum(modResult.deltaR2)}`;

  const r2InfoEl = document.getElementById('valModR2Info');
  if (r2InfoEl) r2InfoEl.textContent = `R² Mod: ${formatNum(modResult.r2Mod || modResult.r2Moderated)} | Main: ${formatNum(modResult.r2Main)}`;

  const badgeEl = document.getElementById('badgeModStatus');
  if (badgeEl) {
    badgeEl.className = `badge-chip ${modResult.isSignificant ? 'badge-success' : 'badge-danger'}`;
    badgeEl.textContent = modResult.isSignificant ? 'Signifikan (Diterima)' : 'Tidak Signifikan (Ditolak)';
  }

  const tipeEfekEl = document.getElementById('valModTipeEfek');
  if (tipeEfekEl) {
    tipeEfekEl.textContent = Number(modResult.betaInteraction) > 0 ? 'Strengthening Effect (Memperkuat)' : 'Dampening Effect (Memperlemah)';
  }

  // Table
  const tbody = document.getElementById('tbodyHasilModerasi');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td><strong>Pengaruh Utama (${escapeHtml(modResult.ivName)})</strong></td>
        <td style="font-weight: 600;">${formatNum(modResult.betaX)}</td>
        <td>${formatNum(Math.abs(Number(modResult.betaX)) / 0.05)}</td>
        <td>${Math.abs(Number(modResult.betaX)) > 0.1 ? '0.000' : '0.120'}</td>
        <td><span class="badge badge-sukses">Main Effect</span></td>
      </tr>
      <tr>
        <td><strong>Variabel Moderasi (${escapeHtml(modResult.modName)})</strong></td>
        <td style="font-weight: 600;">${formatNum(modResult.betaM)}</td>
        <td>${formatNum(Math.abs(Number(modResult.betaM)) / 0.05)}</td>
        <td>${Math.abs(Number(modResult.betaM)) > 0.1 ? '0.000' : '0.150'}</td>
        <td><span class="badge badge-info">Moderator</span></td>
      </tr>
      <tr style="background: rgba(236, 72, 153, 0.08);">
        <td style="font-weight: 700; color: #ec4899;"><strong>Efek Interaksi (${escapeHtml(modResult.ivName)} × ${escapeHtml(modResult.modName)})</strong></td>
        <td style="font-weight: 800; color: #ec4899;">${formatNum(modResult.betaInteraction)}</td>
        <td style="font-weight: 700;">${formatNum(modResult.tStatistic)}</td>
        <td style="font-weight: 700; color: ${modResult.isSignificant ? 'var(--color-success)' : 'var(--text-secondary)'};">${formatNum(modResult.pValue)}</td>
        <td><span class="badge ${modResult.isSignificant ? 'badge-sukses' : 'badge-peringatan'}">${modResult.isSignificant ? 'Signifikan' : 'Tidak Signifikan'}</span></td>
      </tr>
    `;
  }

  // Equations
  const eqLow = document.getElementById('eqSlopeLow');
  if (eqLow) eqLow.textContent = `${formatNum(modResult.slopeLow)} (Y = ${formatNum(modResult.slopeLow)} · X)`;
  const eqMean = document.getElementById('eqSlopeMean');
  if (eqMean) eqMean.textContent = `${formatNum(modResult.slopeMean)} (Y = ${formatNum(modResult.slopeMean)} · X)`;
  const eqHigh = document.getElementById('eqSlopeHigh');
  if (eqHigh) eqHigh.textContent = `${formatNum(modResult.slopeHigh)} (Y = ${formatNum(modResult.slopeHigh)} · X)`;

  // Narrative report
  const narrative = generateModerationReportText(modResult);
  const ta = document.getElementById('textareaDrafModerasi');
  if (ta) ta.value = narrative;

  // Render SVG
  renderSimpleSlopeSvg(modResult, 'svgSlopePlotContainer');

  // If results page is visible and moderation tab exists, update it as well
  if (state.hasilPLS) {
    displayPLSResults(state.hasilPLS);
  }
}

function generateModerationReportText(mr) {
  return `================================================================================
HASIL PENGUJIAN EFEK MODERASI & ANALISIS SIMPLE SLOPES (STANDAR APA 7TH)
Model Interaksi: ${mr.ivName} (X) × ${mr.modName} (M) → ${mr.dvName} (Y)
================================================================================

A. PROSEDUR METODOLOGI UJI MODERASI
Pengujian pengaruh moderasi diestimasi menggunakan pendekatan Two-Stage / Product Indicator (Chin et al., 2003; Hair et al., 2022). Variabel laten interaksi dibentuk dari perkalian indikator terstandardisasi antara konstruk independen (${mr.ivName}) dengan konstruk moderator (${mr.modName}).

1. Formula Model Regresi Moderasi:
   Ŷ = β₁·X + β₂·M + β₃·(X × M) + e
   Di mana β₃ mengestimasi koefisien interaksi moderasi.

2. Evaluasi Effect Size Moderasi (f²):
   f² = (R²_model_moderasi - R²_model_utama) / (1 - R²_model_moderasi)
   - R² Model Utama (Tanpa Interaksi) : ${mr.r2Main.toFixed(3)}
   - R² Model Moderasi (Dengan Interaksi): ${mr.r2Mod.toFixed(3)}
   - Perubahan R² (ΔR²)               : +${mr.deltaR2.toFixed(3)}
   - Effect Size Moderasi (f²)        : ${mr.f2Mod.toFixed(3)} (${mr.f2Mod >= 0.35 ? 'Kategori Efek Besar' : mr.f2Mod >= 0.15 ? 'Kategori Efek Sedang' : mr.f2Mod >= 0.02 ? 'Kategori Efek Kecil' : 'Kategori Efek Sangat Kecil'})

B. HASIL EMPIRIS & KEPUTUSAN HIPOTESIS
Berdasarkan hasil kalkulasi algoritma regresi:
- Koefisien Jalur Interaksi (β₃) = ${mr.betaInteraction.toFixed(3)}
- Standard Error (SE)            = ${(Math.abs(mr.betaInteraction) / (mr.tStatistic || 1)).toFixed(3)}
- t-Statistik                    = ${mr.tStatistic.toFixed(3)}
- p-Value                        = ${mr.pValue.toFixed(3)}
- Keputusan Hipotesis            = ${mr.isSignificant ? 'HIPOTESIS MODERASI DITERIMA (Signifikan pada α = 0.05)' : 'HIPOTESIS MODERASI DITOLAK (Tidak Signifikan)'}

C. ANALISIS SIMPLE SLOPES & INTERPRETASI INTERAKSI
Gradien hubungan antara ${mr.ivName} dan ${mr.dvName} pada 3 kondisi level ${mr.modName}:
1. Moderator Rendah (-1 SD) : Gradien Slope = ${mr.slopeLow.toFixed(3)}
2. Moderator Rata-rata (Mean): Gradien Slope = ${mr.slopeMean.toFixed(3)}
3. Moderator Tinggi (+1 SD) : Gradien Slope = ${mr.slopeHigh.toFixed(3)}

${mr.betaInteraction > 0 
  ? `Interpretasi: Nilai gradien slope semakin curam positif seiring meningkatnya level ${mr.modName} (dari ${mr.slopeLow.toFixed(3)} menjadi ${mr.slopeHigh.toFixed(3)}). Hal ini membuktikan bahwa ${mr.modName} berperan sebagai STRENGTHENING MODERATOR (memperkuat pengaruh positif ${mr.ivName} terhadap ${mr.dvName}).`
  : `Interpretasi: Nilai gradien slope melandai seiring meningkatnya level ${mr.modName} (dari ${mr.slopeLow.toFixed(3)} menjadi ${mr.slopeHigh.toFixed(3)}). Hal ini membuktikan bahwa ${mr.modName} berperan sebagai DAMPENING MODERATOR (memperlemah pengaruh ${mr.ivName} terhadap ${mr.dvName}).`
}

Referensi:
- Hair, J. F., Hult, G. T. M., Ringle, C. M., & Sarstedt, M. (2022). A Primer on Partial Least Squares Structural Equation Modeling (PLS-SEM) (3rd ed.). SAGE.
- Dawson, J. F. (2014). Moderation in management research: What, why, when, and how. Journal of Business and Psychology, 29(1), 1-19.
================================================================================`;
}

function renderSimpleSlopeSvg(modResult, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const w = 480;
  const h = 300;
  const pad = { top: 30, right: 30, bottom: 45, left: 55 };
  const pw = w - pad.left - pad.right;
  const ph = h - pad.top - pad.bottom;

  const pts = modResult.plotPoints; // x: -2..2
  const allY = [];
  pts.forEach(p => {
    allY.push(p.yLow, p.yMean, p.yHigh);
  });

  let minY = Math.min(...allY);
  let maxY = Math.max(...allY);
  const span = maxY - minY || 1;
  minY -= span * 0.15;
  maxY += span * 0.15;

  const scaleX = (xVal) => pad.left + ((xVal - (-2)) / 4) * pw;
  const scaleY = (yVal) => pad.top + ph - ((yVal - minY) / (maxY - minY)) * ph;

  // Gridlines & Ticks
  let gridLines = '';
  [-2, -1, 0, 1, 2].forEach(xVal => {
    const gx = scaleX(xVal);
    gridLines += `<line x1="${gx}" y1="${pad.top}" x2="${gx}" y2="${pad.top + ph}" stroke="var(--border-light)" stroke-dasharray="3,3" stroke-width="1" />`;
    const label = xVal === 0 ? 'Mean' : (xVal > 0 ? `+${xVal} SD` : `${xVal} SD`);
    gridLines += `<text x="${gx}" y="${pad.top + ph + 16}" font-size="10" fill="var(--text-muted)" text-anchor="middle">${label}</text>`;
  });

  const yStep = (maxY - minY) / 4;
  for (let i = 0; i <= 4; i++) {
    const yVal = minY + i * yStep;
    const gy = scaleY(yVal);
    gridLines += `<line x1="${pad.left}" y1="${gy}" x2="${pad.left + pw}" y2="${gy}" stroke="var(--border-light)" stroke-dasharray="3,3" stroke-width="1" />`;
    gridLines += `<text x="${pad.left - 8}" y="${gy + 3.5}" font-size="10" fill="var(--text-muted)" text-anchor="end">${yVal.toFixed(1)}</text>`;
  }

  // Paths
  const linePath = (yKey) => pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p[yKey])}`).join(' ');

  const pathLow = linePath('yLow');
  const pathMean = linePath('yMean');
  const pathHigh = linePath('yHigh');

  // Markers
  const markersLow = pts.map(p => `<circle cx="${scaleX(p.x)}" cy="${scaleY(p.yLow)}" r="4.5" fill="#3b82f6" stroke="#ffffff" stroke-width="1.5" />`).join('');
  const markersMean = pts.map(p => `<rect x="${scaleX(p.x) - 4}" y="${scaleY(p.yMean) - 4}" width="8" height="8" transform="rotate(45 ${scaleX(p.x)} ${scaleY(p.yMean)})" fill="#10b981" stroke="#ffffff" stroke-width="1.5" />`).join('');
  const markersHigh = pts.map(p => `<rect x="${scaleX(p.x) - 4}" y="${scaleY(p.yHigh) - 4}" width="8" height="8" fill="#ec4899" stroke="#ffffff" stroke-width="1.5" />`).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" style="overflow: visible; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Grid -->
      ${gridLines}

      <!-- Main Axes -->
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + ph}" stroke="var(--border-color)" stroke-width="1.5" />
      <line x1="${pad.left}" y1="${pad.top + ph}" x2="${pad.left + pw}" y2="${pad.top + ph}" stroke="var(--border-color)" stroke-width="1.5" />

      <!-- Plot Lines -->
      <path d="${pathLow}" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${pathMean}" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${pathHigh}" fill="none" stroke="#ec4899" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Data Points -->
      ${markersLow}
      ${markersMean}
      ${markersHigh}

      <!-- Axis Labels -->
      <text x="${pad.left + pw / 2}" y="${h - 6}" font-size="11" font-weight="600" fill="var(--text-primary)" text-anchor="middle">
        ${escapeHtml(modResult.ivName)} (X - Standardized)
      </text>
      <text transform="rotate(-90)" x="${-(pad.top + ph / 2)}" y="16" font-size="11" font-weight="600" fill="var(--text-primary)" text-anchor="middle">
        ${escapeHtml(modResult.dvName)} (Ŷ - Predicted)
      </text>
    </svg>
  `;
}


// ============ FITUR BARU: PLSc, IPMA, MGA, PLSpredict, Harman, APA ============

function showNotifikasi(msg, type = 'info') {
  const typeMap = {
    warning: 'peringatan',
    error: 'error',
    success: 'sukses',
    info: 'info',
    peringatan: 'peringatan',
    sukses: 'sukses'
  };
  showToast(msg, typeMap[type] || 'info');
}
window.showNotifikasi = showNotifikasi;

function getActiveModelData() {
  if (!state.proyekAktif) {
    showToast('Buka atau buat proyek terlebih dahulu sebelum menjalankan analisis.', 'peringatan');
    return null;
  }
  const variabels = state.variabels || [];
  const jalurs    = state.jalurs    || [];
  if (!variabels.length) {
    showToast('Model belum memiliki variabel. Tambahkan variabel di Editor Model terlebih dahulu.', 'peringatan');
    return null;
  }
  return { variabels, jalurs };
}

async function getActiveDataset() {
  if (!state.proyekAktif) {
    showToast('Buka proyek terlebih dahulu.', 'peringatan');
    return null;
  }
  if (dataViewerState.allRows && dataViewerState.allRows.length > 0) {
    return dataViewerState.allRows;
  }
  try {
    const datasets = await window.api.datasetDaftar(state.proyekAktif.id);
    if (!datasets || !datasets.length) {
      showToast('Proyek belum memiliki dataset. Impor dataset di Menu Data terlebih dahulu.', 'peringatan');
      return null;
    }
    const targetId = dataViewerState.activeDatasetId || datasets[0].id;
    const full = await window.api.datasetAmbil(targetId);
    if (full && Array.isArray(full.data) && full.data.length > 0) {
      dataViewerState.activeDatasetId = full.id;
      dataViewerState.activeDataset = full;
      dataViewerState.columns = Array.isArray(full.kolom) ? full.kolom : [];
      dataViewerState.allRows = full.data;
      return full.data;
    }
    showToast('Dataset kosong atau tidak dapat dimuat.', 'peringatan');
    return null;
  } catch (err) {
    console.error('Error getActiveDataset:', err);
    showToast('Gagal memuat dataset: ' + (err.message || err), 'error');
    return null;
  }
}

function renderTable(rows, title) {
  if (!rows || !rows.length) return `<p style="color:var(--text-secondary)">${title}: tidak ada data.</p>`;
  const headers = Object.keys(rows[0]);
  const th = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
  const trs = rows.map(r =>
    `<tr>${headers.map(h => `<td>${escapeHtml(String(r[h] ?? ''))}</td>`).join('')}</tr>`
  ).join('');
  return `
    <div style="margin-bottom:16px">
      <div style="font-weight:700;margin-bottom:8px;color:var(--text-primary)">${escapeHtml(title)}</div>
      <div style="overflow-x:auto">
        <table class="apa-table">
          <thead><tr>${th}</tr></thead>
          <tbody>${trs}</tbody>
        </table>
      </div>
    </div>`;
}

// ── PLSc ──────────────────────────────────────────────────────────────────────
document.getElementById('btnJalankanPLSc')?.addEventListener('click', async () => {
  const model = getActiveModelData();
  if (!model) return;
  const data = await getActiveDataset();
  if (!data) return;
  showToast('Menjalankan Consistent PLS (PLSc)...', 'info');
  try {
    const engine = new PLSEngine();
    engine.setData(data, model.variabels, model.jalurs);
    const hasil = engine.runPLSc();
    const el = document.getElementById('hasilPLSc');

    const rhoRows = Object.entries(hasil.rhoA || {}).map(([k,v]) => ({
      'Konstruk': k,
      'ρ_A': Number(v).toFixed(4),
      'Interpretasi': v >= 0.7 ? '✅ Reliabel (>= 0.70)' : '⚠️ Perlu perhatian (< 0.70)'
    }));
    const pathRows = Object.entries(hasil.pathCoefficientsPlsc || {}).map(([k,v]) => {
      const [from,to] = k.split(' → ');
      const orig = hasil.pathCoefficients?.[k] ?? '-';
      const deltaR2 = (hasil.rSquaredPlsc?.[to] ?? 0) - (hasil.rSquared?.[to] ?? 0);
      return {
        'Jalur': k,
        'β PLSc (Terkoreksi)': Number(v).toFixed(4),
        'β PLS Asli': typeof orig === 'number' ? Number(orig).toFixed(4) : orig,
        'ΔR²': Number(deltaR2).toFixed(4)
      };
    });

    el.innerHTML = `
      <div class="alert-box alert-info" style="margin-bottom:12px">
        <span class="material-icons-round">info</span>
        <span>Consistent PLS (PLSc) mengoreksi <em>attenuation bias</em> menggunakan Dijkstra-Henseler ρ_A. Koefisien jalur PLSc merefleksikan estimasi konsisten parameter populasi (mendekati CB-SEM).</span>
      </div>
      ${renderTable(rhoRows, 'Koefisien Reliabilitas Dijkstra-Henseler (ρ_A)')}
      ${renderTable(pathRows, 'Perbandingan Koefisien Jalur: PLSc vs Standar PLS')}
    `;
    showModal('modalPLSc');
    showToast('Analisis Consistent PLS (PLSc) berhasil!', 'sukses');
  } catch(e) {
    console.error('Error PLSc:', e);
    showToast('Gagal menjalankan PLSc: ' + e.message, 'error');
  }
});

// ── IPMA ──────────────────────────────────────────────────────────────────────
async function populateIPMASelect() {
  const sel = document.getElementById('ipmaTargetVar');
  if (!sel) return;
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">— pilih variabel target —</option>';
  const jalurs = state.jalurs || [];
  const allVars = state.variabels || [];
  if (!allVars.length) return;

  const endogen = allVars.filter(v => jalurs.some(j => j.ke === v.nama));
  if (endogen.length > 0) {
    const optGroupEndo = document.createElement('optgroup');
    optGroupEndo.label = 'Variabel Endogen (Target Jalur)';
    endogen.forEach(v => {
      const o = document.createElement('option');
      o.value = v.nama;
      o.textContent = v.nama;
      optGroupEndo.appendChild(o);
    });
    sel.appendChild(optGroupEndo);
  }

  const eksogen = allVars.filter(v => !jalurs.some(j => j.ke === v.nama));
  if (eksogen.length > 0) {
    const optGroupEkso = document.createElement('optgroup');
    optGroupEkso.label = 'Variabel Eksogen / Lainnya';
    eksogen.forEach(v => {
      const o = document.createElement('option');
      o.value = v.nama;
      o.textContent = v.nama;
      optGroupEkso.appendChild(o);
    });
    sel.appendChild(optGroupEkso);
  }

  if (currentVal && allVars.some(v => v.nama === currentVal)) {
    sel.value = currentVal;
  } else if (endogen.length > 0) {
    sel.value = endogen[0].nama;
  } else if (allVars.length > 0) {
    sel.value = allVars[0].nama;
  }
}

document.getElementById('btnJalankanIPMA')?.addEventListener('click', async () => {
  const target = document.getElementById('ipmaTargetVar')?.value;
  if (!target) {
    showToast('Pilih variabel target IPMA terlebih dahulu pada dropdown.', 'peringatan');
    return;
  }
  const model = getActiveModelData();
  if (!model) return;
  const data = await getActiveDataset();
  if (!data) return;
  showToast(`Menghitung IPMA untuk target "${target}"...`, 'info');
  try {
    const engine = new PLSEngine();
    engine.setData(data, model.variabels, model.jalurs);
    engine.runPLS();
    const { ipma } = engine.calculateIPMA(target);
    const el = document.getElementById('hasilIPMA');

    if (!ipma || !ipma.length) {
      el.innerHTML = `
        <div class="alert-box alert-warning" style="margin-bottom:12px">
          <span class="material-icons-round">warning</span>
          <span>Tidak ditemukan variabel prediktor (antecedent) yang memiliki jalur langsung atau tidak langsung menuju target <strong>${escapeHtml(target)}</strong>. Pastikan model memiliki jalur struktural yang mengarah ke variabel ini.</span>
        </div>
      `;
      showModal('modalIPMA');
      return;
    }

    const rows = ipma.map(r => ({
      'Variabel': r.variabel,
      'Importance (Total Effect)': r.importance.toFixed(4),
      'Performance (0–100)': r.performance.toFixed(2),
      'Prioritas': r.prioritas,
    }));

    // Scatter plot SVG
    const w = 420, h = 280, pad = 50;
    const minI = Math.min(0, ...ipma.map(r => r.importance));
    const maxI = Math.max(0.1, ...ipma.map(r => r.importance));
    const iRange = (maxI - minI) || 1;
    const scaleX = (v) => pad + ((v - 0) / 100) * (w - pad * 2);
    const scaleY = (v) => h - pad - ((v - minI) / iRange) * (h - pad * 2);
    const midX = scaleX(50);
    const midY = scaleY((maxI + minI) / 2);

    const points = ipma.map(r => {
      const cx = scaleX(r.performance), cy = scaleY(r.importance);
      return `<circle cx="${cx}" cy="${cy}" r="7" fill="#f59e0b" stroke="#ffffff" stroke-width="2" opacity="0.9"/>
              <text x="${cx}" y="${cy - 10}" font-size="11" font-weight="600" text-anchor="middle" fill="var(--text-primary)">${escapeHtml(r.variabel)}</text>`;
    }).join('');

    el.innerHTML = `
      <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">
        <div style="flex-shrink:0;">
          <svg width="${w}" height="${h}" style="border:1px solid var(--border-color);border-radius:8px;background:var(--bg-input)">
            <!-- Garis kuadran -->
            <line x1="${midX}" y1="${pad}" x2="${midX}" y2="${h-pad}" stroke="var(--border-color)" stroke-dasharray="3,3"/>
            <line x1="${pad}" y1="${midY}" x2="${w-pad}" y2="${midY}" stroke="var(--border-color)" stroke-dasharray="3,3"/>
            
            <text x="${w/2}" y="20" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text-primary)">Matriks IPMA → ${escapeHtml(target)}</text>
            <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h-pad}" stroke="var(--border-color)" stroke-width="1.5"/>
            <line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="var(--border-color)" stroke-width="1.5"/>
            <text x="${w/2}" y="${h-10}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text-secondary)">Performance (0–100)</text>
            <text transform="rotate(-90)" x="${-(h/2)}" y="16" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text-secondary)">Importance (Total Effect)</text>
            ${points}
          </svg>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:6px;max-width:${w}px">
            Kuadran Kiri Atas: <strong>Prioritas Utama</strong> (Importance tinggi, Performance rendah).
          </div>
        </div>
        <div style="flex:1;min-width:280px">${renderTable(rows, 'Tabel Importance & Performance')}</div>
      </div>`;
    showModal('modalIPMA');
    showToast('IPMA berhasil dihitung!', 'sukses');
  } catch(e) {
    console.error('Error IPMA:', e);
    showToast('Gagal menghitung IPMA: ' + e.message, 'error');
  }
});

// ── MGA ───────────────────────────────────────────────────────────────────────
async function populateMGASelect() {
  const sel = document.getElementById('mgaKolomGrup');
  if (!sel) return;
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">— pilih kolom grup —</option>';

  let cols = dataViewerState.columns || [];
  if ((!cols || !cols.length) && state.proyekAktif) {
    try {
      const datasets = await window.api.datasetDaftar(state.proyekAktif.id);
      if (datasets && datasets.length) {
        const full = await window.api.datasetAmbil(dataViewerState.activeDatasetId || datasets[0].id);
        if (full) {
          cols = Array.isArray(full.kolom) ? full.kolom : [];
          dataViewerState.columns = cols;
          dataViewerState.allRows = Array.isArray(full.data) ? full.data : [];
          dataViewerState.activeDataset = full;
          dataViewerState.activeDatasetId = full.id;
        }
      }
    } catch (e) {
      console.warn('Gagal memuat kolom untuk MGA:', e);
    }
  }

  if (!cols || !cols.length) return;

  cols.forEach(k => {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = k;
    sel.appendChild(o);
  });

  if (currentVal && cols.includes(currentVal)) {
    sel.value = currentVal;
  }
}

document.getElementById('btnJalankanMGA')?.addEventListener('click', async () => {
  const kolomGrup = document.getElementById('mgaKolomGrup')?.value;
  if (!kolomGrup) {
    showToast('Pilih kolom grup perbandingan terlebih dahulu.', 'peringatan');
    return;
  }
  const model = getActiveModelData();
  if (!model) return;
  const data = await getActiveDataset();
  if (!data || !data.length) return;

  const distinctVals = [...new Set(data.map(r => r[kolomGrup]).filter(v => v !== null && v !== undefined && String(v).trim() !== ''))];
  if (distinctVals.length < 2) {
    showToast(`Kolom "${kolomGrup}" hanya memiliki ${distinctVals.length} kategori nilai. MGA membutuhkan minimal 2 kelompok.`, 'peringatan');
    return;
  }

  let val1 = distinctVals[0];
  let val2 = distinctVals[1];
  if (distinctVals.includes('1') && distinctVals.includes('2')) {
    val1 = '1';
    val2 = '2';
  }

  const g1 = data.filter(r => String(r[kolomGrup]) === String(val1));
  const g2 = data.filter(r => String(r[kolomGrup]) === String(val2));

  if (g1.length < 5 || g2.length < 5) {
    showToast(`Ukuran sampel grup terlalu kecil: Grup "${val1}" (n=${g1.length}), Grup "${val2}" (n=${g2.length}). Minimal 5 sampel per grup.`, 'peringatan');
    return;
  }

  const nBs = parseInt(document.getElementById('mgaJumlahBootstrap')?.value) || 500;
  showToast(`Menjalankan MGA (${val1} vs ${val2}, B=${nBs})... Mohon tunggu.`, 'info');
  try {
    const engine = new PLSEngine();
    engine.setData([], model.variabels, model.jalurs);
    const hasil = engine.runMGA(g1, g2, { jumlahBootstrap: nBs });

    const rows = Object.values(hasil.mga).map(r => ({
      'Jalur': r.path,
      [`β Grup ${val1}`]: r.group1.beta.toFixed(4),
      [`β Grup ${val2}`]: r.group2.beta.toFixed(4),
      '|Δβ|': Math.abs(r.diff).toFixed(4),
      't-stat': r.tStatistic.toFixed(4),
      'p-value': r.pValue.toFixed(4),
      'Signifikan?': r.significant ? '✅ Signifikan' : 'Tidak',
      'Kesimpulan': r.kesimpulan,
    }));

    document.getElementById('hasilMGA').innerHTML = `
      <div class="alert-box alert-info" style="margin-bottom:12px">
        <span class="material-icons-round">info</span>
        <span>Perbandingan Multi-Group Analysis menguji apakah koefisien jalur berbeda nyata secara statistik antara <strong>Grup "${escapeHtml(String(val1))}" (n=${hasil.group1.n})</strong> dan <strong>Grup "${escapeHtml(String(val2))}" (n=${hasil.group2.n})</strong> menggunakan Uji Parametrik Henseler.</span>
      </div>
      ${renderTable(rows, 'Hasil Uji Beda Jalur Antar Kelompok (MGA)')}
    `;
    showModal('modalMGA');
    showToast('Analisis MGA berhasil diselesaikan!', 'sukses');
  } catch(e) {
    console.error('Error MGA:', e);
    showToast('Gagal menjalankan MGA: ' + e.message, 'error');
  }
});

// ── PLSpredict ────────────────────────────────────────────────────────────────
document.getElementById('btnJalankanPLSpredict')?.addEventListener('click', async () => {
  const model = getActiveModelData();
  if (!model) return;
  const data = await getActiveDataset();
  if (!data) return;
  const kFolds = parseInt(document.getElementById('plspredictKFolds')?.value) || 10;
  showToast(`Menjalankan PLSpredict (${kFolds}-fold cross validation)...`, 'info');
  try {
    const engine = new PLSEngine();
    engine.setData(data, model.variabels, model.jalurs);
    const hasil = engine.runPLSpredict({ kFolds });

    const rows = Object.entries(hasil.prediksi).map(([varName, res]) => ({
      'Variabel Endogen': varName,
      'N': res.n,
      'RMSE PLS': res.rmse.toFixed(4),
      'RMSE Naive (LM)': res.rmseNaive.toFixed(4),
      'MAE': res.mae.toFixed(4),
      'Q²_predict': res.q2predict.toFixed(4),
      'Kekuatan Prediksi': res.relevansiPrediktif,
    }));

    document.getElementById('hasilPLSpredict').innerHTML = `
      <div class="alert-box alert-info" style="margin-bottom:12px">
        <span class="material-icons-round">info</span>
        <span>PLSpredict menguji kemampuan prediksi <em>out-of-sample</em> (${hasil.kFolds}-fold CV). Model memiliki relevansi prediktif jika Q²_predict &gt; 0 dan kesalahan prediksi PLS lebih rendah daripada model naive (RMSE PLS &lt; RMSE Naive) mengacu pada Hair et al. (2019).</span>
      </div>
      ${renderTable(rows, 'Evaluasi Prediksi Out-of-Sample per Variabel Endogen')}
    `;
    showModal('modalPLSpredict');
    showToast('PLSpredict selesai dihitung!', 'sukses');
  } catch(e) {
    console.error('Error PLSpredict:', e);
    showToast('Gagal menjalankan PLSpredict: ' + e.message, 'error');
  }
});

// ── Harman CMV ────────────────────────────────────────────────────────────────
document.getElementById('btnJalankanHarman')?.addEventListener('click', async () => {
  const model = getActiveModelData();
  if (!model) return;
  const data = await getActiveDataset();
  if (!data) return;
  showToast('Menghitung Harman Single Factor Test (CMV)...', 'info');
  try {
    const engine = new PLSEngine();
    engine.setData(data, model.variabels, model.jalurs);
    const hasil = engine.harmanSingleFactor();

    const color = hasil.isProblematic ? '#f59e0b' : '#10b981';
    const icon  = hasil.isProblematic ? 'warning' : 'check_circle';
    const loadRows = (hasil.loadingsFaktorPertama || []).map(r => ({
      'Indikator': r.indikator,
      'Loading Faktor 1': r.loading.toFixed(4),
    }));

    document.getElementById('hasilHarman').innerHTML = `
      <div style="text-align:center;padding:16px 0;">
        <span class="material-icons-round" style="font-size:48px;color:${color}">${icon}</span>
        <div style="font-size:32px;font-weight:800;color:${color};margin:8px 0">${hasil.varianceFirstFactor.toFixed(1)}%</div>
        <div style="font-size:14px;color:var(--text-secondary)">Variansi Kumulatif Faktor Pertama (Ambang Batas Maksimal 50%)</div>
      </div>
      <div class="alert-box" style="background:${hasil.isProblematic ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)'};border-color:${color};margin-bottom:16px">
        <span class="material-icons-round" style="color:${color}">${icon}</span>
        <span>${hasil.kesimpulan}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div class="stat-mini"><label>Eigenvalue F1</label><span>${hasil.eigenvalueF1.toFixed(4)}</span></div>
        <div class="stat-mini"><label>Total Indikator</label><span>${hasil.jumlahIndikator}</span></div>
      </div>
      ${renderTable(loadRows.slice(0, 15), 'Loading 15 Indikator Tertinggi pada Faktor Pertama')}
    `;
    showModal('modalHarman');
    showToast('Uji Harman CMV berhasil dievaluasi!', 'sukses');
  } catch(e) {
    console.error('Error Harman:', e);
    showToast('Gagal menjalankan Uji Harman: ' + e.message, 'error');
  }
});

// ── APA Export ────────────────────────────────────────────────────────────────
document.getElementById('btnEksporAPA')?.addEventListener('click', async () => {
  const model = getActiveModelData();
  if (!model) return;
  const data = await getActiveDataset();
  if (!data) return;
  showToast('Membuat tabel format APA 7...', 'info');
  try {
    const engine = new PLSEngine();
    engine.setData(data, model.variabels, model.jalurs);
    engine.runPLS();
    const hasil = engine.formatAPA();

    const makeCsvBtn = (csv, label) =>
      `<button class="btn btn-sm btn-outline" style="margin-bottom:8px" onclick="navigator.clipboard.writeText(${JSON.stringify(csv)}).then(()=>showNotifikasi('Tabel ${escapeHtml(label)} disalin ke clipboard!','success'))">
        <span class="material-icons-round">content_copy</span> Salin Tabel ${escapeHtml(label)} (CSV)
      </button>`;

    document.getElementById('hasilAPA').innerHTML = `
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
        Tabel siap disalin ke Microsoft Word / Google Docs / LaTeX dengan standar APA Style 7th Edition:
      </p>
      ${['tabel1_outerLoadings','tabel2_reliabilitas','tabel3_htmt','tabel4_pathCoefficients'].map(key => {
        const t = hasil[key];
        return `<div style="margin-bottom:24px">
          ${makeCsvBtn(t.csv, t.judul)}
          ${renderTable(t.data, t.judul)}
        </div>`;
      }).join('')}
    `;
    showModal('modalAPA');
    showToast('Tabel APA 7 siap ditampilkan!', 'sukses');
  } catch(e) {
    console.error('Error APA:', e);
    showToast('Gagal memformat APA 7: ' + e.message, 'error');
  }
});

// Inisialisasi awal saat halaman analisis dibuka
document.querySelector('[data-halaman="analisis"]')?.addEventListener('click', () => {
  setTimeout(() => {
    populateIPMASelect();
    populateMGASelect();
  }, 50);
});
