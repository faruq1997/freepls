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
  isAddingPath: false,
  pathFrom: null,
  // Zoom & Pan state
  zoom: 1.0,
  pan: { x: 0, y: 0 },
  isPanning: false,
  panStart: { x: 0, y: 0 },
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
  initAnalysisHandlers();
  initResultsHandlers();
  initSettingsHandlers();
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
  if (halaman === 'editor' && state.proyekAktif) renderModel();
  if (halaman === 'data' && state.proyekAktif) loadDatasets();
  if (halaman === 'hasil' && state.proyekAktif) loadResults();
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

// ============ LOADING ============
function showLoading(text = 'Memproses...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').classList.remove('tersembunyi');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('tersembunyi');
}

// ============ PROJECT HANDLERS ============
function initProjectHandlers() {
  document.getElementById('btnProyekBaru')?.addEventListener('click', () => showModal('modalProyekBaru'));
  document.getElementById('btnImporProyek')?.addEventListener('click', () => showProjectPickerModal());
  document.getElementById('btnImporSmartPLSFile')?.addEventListener('click', () => imporProyekFile());
  
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
}

async function showProjectPickerModal() {
  const proyeks = await window.api.proyekDaftar();
  const list = document.getElementById('proyekListModal');
  
  if (proyeks.length === 0) {
    list.innerHTML = '<div class="empty-state"><span class="material-icons-round">folder_off</span><p>Belum ada proyek. Buat proyek baru terlebih dahulu.</p></div>';
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
    if (selectedV) {
      state.versiAktifId = selectedV.id;
      modelToLoad = selectedV.model_data;
      activeVersiName = selectedV.nama_versi;
    }
  } else if (state.versiList.length > 0) {
    // ATURAN DEFAULT: Jika user belum pilih versi, versi TERAKHIR yang otomatis dimuat sebagai default
    const latestV = state.versiList[0];
    state.versiAktifId = latestV.id;
    modelToLoad = latestV.model_data;
    activeVersiName = latestV.nama_versi;
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

  showToast(`Proyek "${proyek.nama}" dibuka (${activeVersiName})`, 'sukses');
  navigateTo('editor');
}

async function loadDashboard() {
  const proyeks = await window.api.proyekDaftar();
  
  document.getElementById('totalProyek').textContent = proyeks.length;
  
  const grid = document.getElementById('proyekGrid');
  
  if (proyeks.length === 0) {
    grid.innerHTML = `
      <div class="proyek-empty">
        <span class="material-icons-round" style="font-size: 64px; opacity: 0.3; display: block; margin-bottom: 16px;">folder_open</span>
        <p style="color: var(--text-muted)">Belum ada proyek. Klik "Proyek Baru" untuk memulai.</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = proyeks.map(p => `
    <div class="proyek-card" data-id="${p.id}">
      <div class="proyek-card-header">
        <span class="proyek-card-title">${escapeHtml(p.nama)}</span>
        <div class="proyek-card-actions">
          <button class="proyek-hapus" onclick="event.stopPropagation(); hapusProyek(${p.id}, '${escapeHtml(p.nama)}')" title="Hapus">
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
    }
    showToast(`Proyek "${nama}" telah dihapus`, 'sukses');
    loadDashboard();
  }
}

// ============ RENAME PROJECT ============
function bukaModalRenameProyek() {
  if (!state.proyekAktif) {
    showToast('Pilih proyek terlebih dahulu', 'peringatan');
    return;
  }
  document.getElementById('inputRenameNamaProyek').value = state.proyekAktif.nama;
  document.getElementById('inputRenameDeskripsiProyek').value = state.proyekAktif.deskripsi || '';
  showModal('modalRenameProyek');
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
    try {
      modelObj = typeof v.model_data === 'string' ? JSON.parse(v.model_data) : (v.model_data || {});
    } catch {}
    const totalVar = modelObj.variabels?.length || 0;
    const totalJalur = modelObj.jalurs?.length || 0;
    
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
        <div style="display: flex; gap: 6px; margin-left: 12px;">
          <button class="btn btn-sm ${isActive ? 'btn-outline' : 'btn-primary'}" onclick="muatVersiSnapshot(${v.id})" title="Terapkan dan buka versi model ini">
            <span class="material-icons-round" style="font-size: 15px;">folder_open</span> ${isActive ? 'Aktif' : 'Buka'}
          </button>
          <button class="btn btn-sm btn-icon btn-ghost" onclick="hapusVersiSnapshot(${v.id}, '${escapeHtml(v.nama_versi)}')" title="Hapus snapshot versi ini" style="color: var(--color-danger);">
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
  const v = state.versiList.find(item => item.id === versiId);
  if (!v) return;
  
  state.versiAktifId = v.id;
  
  let modelObj = {};
  try {
    modelObj = typeof v.model_data === 'string' ? JSON.parse(v.model_data) : (v.model_data || {});
  } catch {}
  
  state.variabels = modelObj.variabels || [];
  state.jalurs = modelObj.jalurs || [];
  state.catatans = modelObj.catatans || [];
  
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

async function hapusVersiSnapshot(versiId, namaVersi) {
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

// ============ EXPORT / IMPORT .FREEPLS FILE ============
async function eksporProyekFile() {
  if (!state.proyekAktif) {
    showToast('Pilih proyek terlebih dahulu', 'peringatan');
    return;
  }
  showLoading('Mengekspor bundle proyek .freepls...');
  try {
    const res = await window.api.proyekEksporFile(state.proyekAktif.id);
    hideLoading();
    if (res && res.sukses) {
      showToast('Proyek berhasil diekspor ke file .freepls!', 'sukses');
    }
  } catch (e) {
    hideLoading();
    showToast('Gagal ekspor proyek: ' + e.message, 'error');
  }
}

async function imporProyekFile() {
  showLoading('Mengimpor file .freepls...');
  try {
    const res = await window.api.proyekImporFile();
    hideLoading();
    if (res && res.sukses && res.proyek) {
      showToast(`Proyek "${res.proyek.nama}" berhasil diimpor!`, 'sukses');
      await setActiveProject(res.proyek);
      loadDashboard();
    }
  } catch (e) {
    hideLoading();
    showToast('Gagal impor: ' + e.message, 'error');
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

// ============ ZOOM & FULLSCREEN CONTROLS ============
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

function toggleCanvasFullscreen() {
  const wrapper = document.getElementById('editorCanvasWrapper');
  if (!wrapper) return;
  
  wrapper.classList.toggle('fullscreen-canvas');
  const isFs = wrapper.classList.contains('fullscreen-canvas');
  
  const icon = document.querySelector('#btnCanvasFullscreen .material-icons-round');
  if (icon) {
    icon.textContent = isFs ? 'fullscreen_exit' : 'fullscreen';
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
  document.getElementById('btnSimpanRenameProyek')?.addEventListener('click', () => simpanRenameProyek());

  // Versioning Handlers
  document.getElementById('btnVersiModel')?.addEventListener('click', () => bukaModalRiwayatVersi());
  document.getElementById('btnSimpanVersiSnapshot')?.addEventListener('click', () => simpanVersiSnapshot());

  // Export Project Bundle Handler
  document.getElementById('btnEksporProyekFile')?.addEventListener('click', () => eksporProyekFile());

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

  // Zoom Controls
  document.getElementById('btnZoomIn')?.addEventListener('click', () => setZoom(state.zoom + 0.15));
  document.getElementById('btnZoomOut')?.addEventListener('click', () => setZoom(state.zoom - 0.15));
  document.getElementById('btnZoomReset')?.addEventListener('click', () => setZoom(1.0, true));
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

  // Modal Template Model
  document.getElementById('btnBukaTemplateModel')?.addEventListener('click', () => {
    showModal('modalTemplateModel');
  });

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

      // 1. Tambah jalur X -> Z jika belum ada
      const existingXZ = state.jalurs.find(j => (j.dari_variabel_id == dari || j.dari === dariVar.nama) && (j.ke_variabel_id == mediator || j.ke === medVar.nama));
      if (!existingXZ) {
        state.jalurs.push({
          id: Date.now(),
          dari: dariVar.nama,
          ke: medVar.nama,
          dari_variabel_id: dari,
          ke_variabel_id: mediator,
          label: '',
          tipe_garis: 'solid',
          tebal_garis: tebalGaris,
          kelengkungan: 0
        });
      }

      // 2. Tambah jalur Z -> Y jika belum ada
      const existingZY = state.jalurs.find(j => (j.dari_variabel_id == mediator || j.dari === medVar.nama) && (j.ke_variabel_id == ke || j.ke === keVar.nama));
      if (!existingZY) {
        state.jalurs.push({
          id: Date.now() + 1,
          dari: medVar.nama,
          ke: keVar.nama,
          dari_variabel_id: mediator,
          ke_variabel_id: ke,
          label: '',
          tipe_garis: 'solid',
          tebal_garis: tebalGaris,
          kelengkungan: 0
        });
      }

      // 3. Tambah jalur mediasi tidak langsung X -> Y dengan lengkungan dan garis putus-putus
      const indirectLabel = label || `${dariVar.nama} → ${medVar.nama} → ${keVar.nama}`;
      state.jalurs.push({
        id: Date.now() + 2,
        dari: dariVar.nama,
        ke: keVar.nama,
        dari_variabel_id: dari,
        ke_variabel_id: ke,
        label: indirectLabel,
        tipe_garis: tipeGaris,
        tebal_garis: tebalGaris,
        kelengkungan: kelengkungan !== 0 ? kelengkungan : 45
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
    document.getElementById('panelBody').innerHTML = '<p class="text-muted">Pilih variabel atau jalur untuk melihat propertinya</p>';
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
      let labelMidX = midArcX;
      let labelMidY = midArcY;
      
      if (isPathSelected && !isExport) {
        labelMidY += (kelengkungan < 0 ? 14 : -14);
      }

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
    
    // 3. Gambar Lingkaran Variabel Laten (Biru SmartPLS)
    ctx.save();
    
    // Selection glow if in editor
    if (isSelected && !isExport) {
      ctx.beginPath();
      ctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#f093fb';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    
    // Lingkaran Laten
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = PLS_STYLE.latentColor;
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#ffffff' : PLS_STYLE.latentBorderColor;
    ctx.lineWidth = PLS_STYLE.latentBorderWidth;
    ctx.stroke();
    
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

// ============ INTERACTION HANDLERS (DRAG, ZOOM, PAN, & CLICK) ============
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
    
    // 0. Ctrl + Left Click / Middle Click / Space / Shift / Alt Drag -> Canvas Pan
    if (e.ctrlKey || e.button === 1 || e.shiftKey || e.altKey) {
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
        state.selectedCatatans = [];
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
      state.isDragging = true;
      state.dragTarget = clickedVar;
      state.dragOffset = {
        x: mx - clickedVar.posisi_x,
        y: my - clickedVar.posisi_y
      };
      state.selectedNode = clickedVar.id;
      state.selectedPath = null;
      state.selectedCatatan = null;
      state.selectedNodes = [];
      state.selectedPaths = [];
      state.selectedCatatans = [];
      state.isAllSelected = false;
      showVariableProperties(clickedVar);
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
    
    // 4. Klik di area kosong (Deselect / Clear Multi-select)
    if (state.selectedNode || state.selectedPath || state.selectedCatatan || state.isAllSelected || state.selectedNodes.length > 0 || state.selectedPaths.length > 0 || state.selectedCatatans.length > 0) {
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

    const isOverPath = !isOverCatatan && !isOverVar && !isOverHandle && state.jalurs.some(j => {
      if (j._startX !== undefined && j._startY !== undefined) {
        return pointToPathDist(mx, my, j) <= 12;
      }
      return false;
    });
    
    if (e.ctrlKey) {
      canvas.style.cursor = 'grab';
    } else if (isOverHandle) {
      canvas.style.cursor = 'move';
    } else if (isOverCatatan || isOverVar) {
      canvas.style.cursor = 'grab';
    } else if (isOverPath) {
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = 'default';
    }
  });
  
  canvas.addEventListener('mouseup', () => {
    if (state.isPanning) {
      state.isPanning = false;
      canvas.style.cursor = 'default';
    }
    if (state.isDraggingPathCurvature) {
      state.isDraggingPathCurvature = false;
      state.dragCurvaturePath = null;
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
      saveModelToDb();
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
  
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const mx = (rawX - state.pan.x) / state.zoom;
    const my = (rawY - state.pan.y) / state.zoom;

    // Hapus catatan jika klik kanan di catatan
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
    
    const R = PLS_STYLE.latentRadius;
    const clickedVar = state.variabels.find(v => Math.hypot(v.posisi_x - mx, v.posisi_y - my) <= R + 10);
    
    if (clickedVar) {
      hapusVariabel(clickedVar.id);
      return;
    }
    
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

// Inisialisasi interaksi canvas saat DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupCanvasInteractions();
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
  
  showLoading(`Merender gambar resolusi tinggi (${dpi} DPI)...`);
  
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
  
  panel.innerHTML = `
    <div class="form-group">
      <label>Nama Variabel</label>
      <input type="text" id="editPropNamaVar" class="form-input" value="${escapeHtml(v.nama)}" placeholder="Nama variabel laten">
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
      <label>Posisi Kotak Indikator</label>
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
    document.getElementById('panelBody').innerHTML = '<p class="text-muted">Pilih variabel atau jalur untuk melihat propertinya</p>';
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

// ============ TEMPLATE MODEL GENERATOR ============
async function terapkanTemplateModel(templateKey) {
  // Pastikan ada proyek aktif, jika belum ada buat otomatis
  if (!state.proyekAktif) {
    const proyekBaru = await window.api.proyekBuat({
      nama: 'Model Penelitian FreePLS',
      deskripsi: 'Proyek dibuat otomatis dari Template Model'
    });
    setActiveProject(proyekBaru);
  }

  let vars = [];
  let paths = [];
  let notes = [];

  if (templateKey === 'mediasi_umkm') {
    // Sesuai persis dengan gambar lampiran user & spesifikasi 10 Hipotesis:
    // H1: X1 -> Y, H2: X2 -> Y, H3: X3 -> Y
    // H4: X1 -> Z, H5: X2 -> Z, H6: X3 -> Z
    // H7: Z -> Y
    // H8: X1 -> Z -> Y (Indirect)
    // H9: X2 -> Z -> Y (Indirect)
    // H10: X3 -> Z -> Y (Indirect)
    vars = [
      {
        id: 101,
        nama: 'Literasi Keuangan (X1)',
        tipe: 'reflektif',
        orientasi: 'kiri',
        posisi_x: 200,
        posisi_y: 100,
        indikator: ['LK1', 'LK2', 'LK3']
      },
      {
        id: 102,
        nama: 'Kompetensi SDM (X2)',
        tipe: 'reflektif',
        orientasi: 'kiri',
        posisi_x: 200,
        posisi_y: 250,
        indikator: ['SDM1', 'SDM2', 'SDM3']
      },
      {
        id: 103,
        nama: 'Inklusi Keuangan (X3)',
        tipe: 'reflektif',
        orientasi: 'kiri',
        posisi_x: 200,
        posisi_y: 400,
        indikator: ['IK1', 'IK2', 'IK3']
      },
      {
        id: 104,
        nama: 'Adaptasi Fintech (Z)',
        tipe: 'reflektif',
        orientasi: 'bawah',
        posisi_x: 560,
        posisi_y: 250,
        indikator: ['AT1', 'AT2', 'AT3', 'AT4']
      },
      {
        id: 105,
        nama: 'Keberlanjutan UMKM (Y)',
        tipe: 'reflektif',
        orientasi: 'kanan',
        posisi_x: 920,
        posisi_y: 250,
        indikator: ['KU1', 'KU2', 'KU3', 'KU4']
      }
    ];

    paths = [
      // Jalur Pengaruh Langsung (Solid)
      { id: 201, dari_variabel_id: 101, ke_variabel_id: 105, dari: 'Literasi Keuangan (X1)', ke: 'Keberlanjutan UMKM (Y)', label: 'H1', tipe_garis: 'solid', tebal_garis: 2.5, kelengkungan: 0 },
      { id: 202, dari_variabel_id: 102, ke_variabel_id: 105, dari: 'Kompetensi SDM (X2)', ke: 'Keberlanjutan UMKM (Y)', label: 'H2', tipe_garis: 'solid', tebal_garis: 2.5, kelengkungan: 45 },
      { id: 203, dari_variabel_id: 103, ke_variabel_id: 105, dari: 'Inklusi Keuangan (X3)', ke: 'Keberlanjutan UMKM (Y)', label: 'H3', tipe_garis: 'solid', tebal_garis: 2.5, kelengkungan: 0 },
      { id: 204, dari_variabel_id: 101, ke_variabel_id: 104, dari: 'Literasi Keuangan (X1)', ke: 'Adaptasi Fintech (Z)', label: 'H4', tipe_garis: 'solid', tebal_garis: 2.5, kelengkungan: 0 },
      { id: 205, dari_variabel_id: 102, ke_variabel_id: 104, dari: 'Kompetensi SDM (X2)', ke: 'Adaptasi Fintech (Z)', label: 'H5', tipe_garis: 'solid', tebal_garis: 2.5, kelengkungan: 0 },
      { id: 206, dari_variabel_id: 103, ke_variabel_id: 104, dari: 'Inklusi Keuangan (X3)', ke: 'Adaptasi Fintech (Z)', label: 'H6', tipe_garis: 'solid', tebal_garis: 2.5, kelengkungan: 0 },
      { id: 207, dari_variabel_id: 104, ke_variabel_id: 105, dari: 'Adaptasi Fintech (Z)', ke: 'Keberlanjutan UMKM (Y)', label: 'H7', tipe_garis: 'solid', tebal_garis: 2.5, kelengkungan: 0 },
      // Jalur Pengaruh Tidak Langsung / Mediasi (H8, H9, H10 dari X lalu ke Z kemudian ke Y - Garis Putus-putus)
      { id: 208, dari_variabel_id: 101, melalui_variabel_id: 104, ke_variabel_id: 105, dari: 'Literasi Keuangan (X1)', melalui: 'Adaptasi Fintech (Z)', ke: 'Keberlanjutan UMKM (Y)', label: 'H8', tipe_garis: 'dashed', tebal_garis: 2.5, kelengkungan1: -22, kelengkungan: -28 },
      { id: 209, dari_variabel_id: 102, melalui_variabel_id: 104, ke_variabel_id: 105, dari: 'Kompetensi SDM (X2)', melalui: 'Adaptasi Fintech (Z)', ke: 'Keberlanjutan UMKM (Y)', label: 'H9', tipe_garis: 'dashed', tebal_garis: 2.5, kelengkungan1: 22, kelengkungan: 28 },
      { id: 210, dari_variabel_id: 103, melalui_variabel_id: 104, ke_variabel_id: 105, dari: 'Inklusi Keuangan (X3)', melalui: 'Adaptasi Fintech (Z)', ke: 'Keberlanjutan UMKM (Y)', label: 'H10', tipe_garis: 'dashed', tebal_garis: 2.5, kelengkungan1: 35, kelengkungan: 52 }
    ];

    // Catatan Sticky Note Penjelasan Hipotesis & Jalur
    notes = [
      {
        id: Date.now(),
        teks: "Keterangan :\n—> : Pengaruh langsung (H1 - H7)\n- - - > : Pengaruh tidak langsung melalui Z (H8 - H10)",
        warna: "#fef08a",
        x: 820,
        y: 390,
        w: 260,
        h: 110
      }
    ];
  } else if (templateKey === 'tam') {
    vars = [
      { id: 301, nama: 'Perceived Ease of Use (PEOU)', tipe: 'reflektif', orientasi: 'kiri', posisi_x: 200, posisi_y: 180, indikator: ['PEOU1', 'PEOU2', 'PEOU3'] },
      { id: 302, nama: 'Perceived Usefulness (PU)', tipe: 'reflektif', orientasi: 'atas', posisi_x: 440, posisi_y: 180, indikator: ['PU1', 'PU2', 'PU3'] },
      { id: 303, nama: 'Attitude Toward Using (ATU)', tipe: 'reflektif', orientasi: 'bawah', posisi_x: 440, posisi_y: 380, indikator: ['ATU1', 'ATU2', 'ATU3'] },
      { id: 304, nama: 'Behavioral Intention (BI)', tipe: 'reflektif', orientasi: 'atas', posisi_x: 700, posisi_y: 280, indikator: ['BI1', 'BI2', 'BI3'] },
      { id: 305, nama: 'Actual Usage (AU)', tipe: 'reflektif', orientasi: 'kanan', posisi_x: 940, posisi_y: 280, indikator: ['AU1', 'AU2', 'AU3'] }
    ];
    paths = [
      { id: 401, dari_variabel_id: 301, ke_variabel_id: 302, dari: 'Perceived Ease of Use (PEOU)', ke: 'Perceived Usefulness (PU)', label: 'H1', tipe_garis: 'solid', tebal_garis: 2.5 },
      { id: 402, dari_variabel_id: 301, ke_variabel_id: 303, dari: 'Perceived Ease of Use (PEOU)', ke: 'Attitude Toward Using (ATU)', label: 'H2', tipe_garis: 'solid', tebal_garis: 2.5 },
      { id: 403, dari_variabel_id: 302, ke_variabel_id: 303, dari: 'Perceived Usefulness (PU)', ke: 'Attitude Toward Using (ATU)', label: 'H3', tipe_garis: 'solid', tebal_garis: 2.5 },
      { id: 404, dari_variabel_id: 302, ke_variabel_id: 304, dari: 'Perceived Usefulness (PU)', ke: 'Behavioral Intention (BI)', label: 'H4', tipe_garis: 'solid', tebal_garis: 2.5 },
      { id: 405, dari_variabel_id: 303, ke_variabel_id: 304, dari: 'Attitude Toward Using (ATU)', ke: 'Behavioral Intention (BI)', label: 'H5', tipe_garis: 'solid', tebal_garis: 2.5 },
      { id: 406, dari_variabel_id: 304, ke_variabel_id: 305, dari: 'Behavioral Intention (BI)', ke: 'Actual Usage (AU)', label: 'H6', tipe_garis: 'solid', tebal_garis: 2.5 }
    ];
    notes = [
      {
        id: Date.now(),
        teks: "Technology Acceptance Model (Davis, 1989):\n• PEOU & PU → Sikap & Niat Penggunaan\n• BI → Penggunaan Nyata Teknologi",
        warna: "#bae6fd",
        x: 820,
        y: 430,
        w: 260,
        h: 110
      }
    ];
  } else if (templateKey === 'customer_satisfaction') {
    vars = [
      { id: 501, nama: 'Kualitas Produk (X1)', tipe: 'reflektif', orientasi: 'kiri', posisi_x: 200, posisi_y: 130, indikator: ['KP1', 'KP2', 'KP3'] },
      { id: 502, nama: 'Kualitas Layanan (X2)', tipe: 'reflektif', orientasi: 'kiri', posisi_x: 200, posisi_y: 280, indikator: ['KL1', 'KL2', 'KL3'] },
      { id: 503, nama: 'Persepsi Harga (X3)', tipe: 'reflektif', orientasi: 'kiri', posisi_x: 200, posisi_y: 430, indikator: ['PH1', 'PH2', 'PH3'] },
      { id: 504, nama: 'Kepuasan Pelanggan (Y1)', tipe: 'reflektif', orientasi: 'bawah', posisi_x: 560, posisi_y: 280, indikator: ['SAT1', 'SAT2', 'SAT3'] },
      { id: 505, nama: 'Loyalitas Pelanggan (Y2)', tipe: 'reflektif', orientasi: 'kanan', posisi_x: 880, posisi_y: 280, indikator: ['LOY1', 'LOY2', 'LOY3'] }
    ];
    paths = [
      { id: 601, dari_variabel_id: 501, ke_variabel_id: 504, dari: 'Kualitas Produk (X1)', ke: 'Kepuasan Pelanggan (Y1)', label: 'H1', tipe_garis: 'solid', tebal_garis: 2.5 },
      { id: 602, dari_variabel_id: 502, ke_variabel_id: 504, dari: 'Kualitas Layanan (X2)', ke: 'Kepuasan Pelanggan (Y1)', label: 'H2', tipe_garis: 'solid', tebal_garis: 2.5 },
      { id: 603, dari_variabel_id: 503, ke_variabel_id: 504, dari: 'Persepsi Harga (X3)', ke: 'Kepuasan Pelanggan (Y1)', label: 'H3', tipe_garis: 'solid', tebal_garis: 2.5 },
      { id: 604, dari_variabel_id: 504, ke_variabel_id: 505, dari: 'Kepuasan Pelanggan (Y1)', ke: 'Loyalitas Pelanggan (Y2)', label: 'H4', tipe_garis: 'solid', tebal_garis: 2.5 },
      { id: 605, dari_variabel_id: 501, ke_variabel_id: 505, dari: 'Kualitas Produk (X1)', ke: 'Loyalitas Pelanggan (Y2)', label: 'H5', tipe_garis: 'dashed', tebal_garis: 2.5, kelengkungan: 50 }
    ];
    notes = [
      {
        id: Date.now(),
        teks: "Model Kepuasan Pelanggan:\n• Kualitas & Harga → Kepuasan (Y1)\n• Kepuasan → Loyalitas (Y2)",
        warna: "#bbf7d0",
        x: 820,
        y: 430,
        w: 250,
        h: 110
      }
    ];
  } else if (templateKey === 'moderasi') {
    vars = [
      { id: 701, nama: 'Disiplin Kerja (X)', tipe: 'reflektif', orientasi: 'kiri', posisi_x: 220, posisi_y: 280, indikator: ['DK1', 'DK2', 'DK3'] },
      { id: 702, nama: 'Budaya Organisasi (M)', tipe: 'reflektif', orientasi: 'atas', posisi_x: 520, posisi_y: 130, indikator: ['BO1', 'BO2', 'BO3'] },
      { id: 703, nama: 'Interaksi X*M', tipe: 'formatif', orientasi: 'bawah', posisi_x: 520, posisi_y: 430, indikator: ['XM1', 'XM2'] },
      { id: 704, nama: 'Kinerja Pegawai (Y)', tipe: 'reflektif', orientasi: 'kanan', posisi_x: 820, posisi_y: 280, indikator: ['KP1', 'KP2', 'KP3'] }
    ];
    paths = [
      { id: 801, dari_variabel_id: 701, ke_variabel_id: 704, dari: 'Disiplin Kerja (X)', ke: 'Kinerja Pegawai (Y)', label: 'H1', tipe_garis: 'solid', tebal_garis: 2.5 },
      { id: 802, dari_variabel_id: 702, ke_variabel_id: 704, dari: 'Budaya Organisasi (M)', ke: 'Kinerja Pegawai (Y)', label: 'H2', tipe_garis: 'solid', tebal_garis: 2.5 },
      { id: 803, dari_variabel_id: 703, ke_variabel_id: 704, dari: 'Interaksi X*M', ke: 'Kinerja Pegawai (Y)', label: 'H3 (Moderasi)', tipe_garis: 'dashed', tebal_garis: 2.5 }
    ];
    notes = [
      {
        id: Date.now(),
        teks: "Model Moderasi (Interaction Effect):\n• X*M menguji apakah Budaya Organisasi memperkuat hubungan Disiplin → Kinerja",
        warna: "#fbcfe8",
        x: 780,
        y: 440,
        w: 270,
        h: 110
      }
    ];
  } else {
    // Standar 2 Eksogen 1 Endogen
    vars = [
      { id: 901, nama: 'Motivasi Kerja (X1)', tipe: 'reflektif', orientasi: 'kiri', posisi_x: 240, posisi_y: 180, indikator: ['MK1', 'MK2', 'MK3'] },
      { id: 902, nama: 'Disiplin Kerja (X2)', tipe: 'reflektif', orientasi: 'kiri', posisi_x: 240, posisi_y: 380, indikator: ['DK1', 'DK2', 'DK3'] },
      { id: 903, nama: 'Kinerja Karyawan (Y)', tipe: 'reflektif', orientasi: 'kanan', posisi_x: 740, posisi_y: 280, indikator: ['KK1', 'KK2', 'KK3', 'KK4'] }
    ];
    paths = [
      { id: 1001, dari_variabel_id: 901, ke_variabel_id: 903, dari: 'Motivasi Kerja (X1)', ke: 'Kinerja Karyawan (Y)', label: 'H1', tipe_garis: 'solid', tebal_garis: 2.5 },
      { id: 1002, dari_variabel_id: 902, ke_variabel_id: 903, dari: 'Disiplin Kerja (X2)', ke: 'Kinerja Karyawan (Y)', label: 'H2', tipe_garis: 'solid', tebal_garis: 2.5 }
    ];
    notes = [];
  }

  state.variabels = vars;
  state.jalurs = paths;
  state.catatans = notes;
  state.hasilPLS = null;
  state.hasilBootstrap = null;
  state.selectedNode = null;
  state.selectedPath = null;
  state.selectedCatatan = null;

  hideModal('modalTemplateModel');
  renderModel();
  await saveModelToDb();
  showToast('Template model berhasil dimuat!', 'sukses');
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
    document.getElementById('panelBody').innerHTML = '<p class="text-muted">Pilih variabel untuk melihat propertinya</p>';
    showToast(`Variabel "${v.nama}" dihapus`, 'sukses');
  }
}

// ============ DATA HANDLERS ============
function initDataHandlers() {
  document.getElementById('btnImporData').addEventListener('click', async () => {
    if (!state.proyekAktif) {
      showToast('Pilih proyek terlebih dahulu', 'peringatan');
      return;
    }
    
    showLoading('Mengimpor data...');
    try {
      const result = await window.api.datasetImpor(state.proyekAktif.id);
      if (result) {
        showToast(`Dataset "${result.nama}" berhasil diimpor (${result.jumlah_baris} baris, ${result.jumlah_kolom} kolom)`, 'sukses');
        loadDatasets();
      }
    } catch (e) {
      showToast('Gagal mengimpor data: ' + e.message, 'error');
    }
    hideLoading();
  });
}

async function loadDatasets() {
  if (!state.proyekAktif) return;
  
  const datasets = await window.api.datasetDaftar(state.proyekAktif.id);
  state.datasets = datasets;
  
  document.getElementById('totalDataset').textContent = datasets.length;
  
  const list = document.getElementById('datasetList');
  
  if (datasets.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="material-icons-round">cloud_upload</span>
        <p>Belum ada dataset. Impor file CSV atau Excel.</p>
      </div>
    `;
    return;
  }
  
  list.innerHTML = datasets.map(d => `
    <div class="dataset-item" data-id="${d.id}">
      <div class="dataset-item-name">${escapeHtml(d.nama)}</div>
      <div class="dataset-item-meta">
        <span>${d.jumlah_baris} baris</span>
        <span>${d.jumlah_kolom} kolom</span>
      </div>
      <div class="dataset-item-actions">
        <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); hapusDataset(${d.id})">
          <span class="material-icons-round" style="font-size: 16px;">delete</span>
        </button>
      </div>
    </div>
  `).join('');
  
  list.querySelectorAll('.dataset-item').forEach(item => {
    item.addEventListener('click', () => previewDataset(parseInt(item.dataset.id)));
  });
}

async function previewDataset(id) {
  const dataset = await window.api.datasetAmbil(id);
  if (!dataset || !dataset.data) return;
  
  // Mark active
  document.querySelectorAll('.dataset-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.dataset-item[data-id="${id}"]`)?.classList.add('active');
  
  const preview = document.getElementById('dataPreview');
  const columns = dataset.kolom;
  const data = dataset.data;
  
  const maxRows = Math.min(data.length, 100);
  
  preview.innerHTML = `
    <div style="margin-bottom: 12px;">
      <strong>${escapeHtml(dataset.nama)}</strong>
      <span class="text-muted" style="margin-left: 8px;">(${data.length} baris × ${columns.length} kolom)</span>
    </div>
    <div style="overflow: auto; max-height: calc(100% - 40px);">
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            ${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.slice(0, maxRows).map((row, i) => `
            <tr>
              <td style="color: var(--text-muted)">${i + 1}</td>
              ${columns.map(c => `<td>${row[c] !== undefined ? row[c] : '-'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${data.length > maxRows ? `<p class="text-muted text-center" style="padding: 12px;">Menampilkan ${maxRows} dari ${data.length} baris</p>` : ''}
    </div>
  `;
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
    loadDatasets();
    document.getElementById('dataPreview').innerHTML = '<div class="empty-state"><span class="material-icons-round">visibility</span><p>Pilih dataset untuk melihat pratinjau</p></div>';
  }
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
  
  showLoading('Menjalankan Algoritma PLS-SEM...');
  
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
  
  showLoading(`Menjalankan Bootstrapping (${jumlahBootstrap} subsampel)... Mohon tunggu.`);
  
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

// ============ RESULTS DISPLAY ============
function initResultsHandlers() {
  document.querySelectorAll('.hasil-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.hasil-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.hasil-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
  
  document.getElementById('btnEksporHasil').addEventListener('click', async () => {
    if (!state.hasilPLS) {
      showToast('Belum ada hasil analisis', 'peringatan');
      return;
    }
    
    const exportData = prepareExportData();
    const result = await window.api.eksporHasil({
      data: exportData,
      namaFile: `Hasil_PLS_${state.proyekAktif ? state.proyekAktif.nama : 'Export'}.xlsx`
    });
    
    if (result) {
      showToast('Hasil berhasil diekspor', 'sukses');
    }
  });
}

function displayPLSResults(hasil) {
  // Tab Ringkasan
  const ringkasan = document.getElementById('tab-ringkasan');
  ringkasan.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
      <h3 style="margin: 0;">Ringkasan Hasil PLS-SEM</h3>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-sm btn-outline" onclick="navigateTo('editor')" title="Lihat diagram di editor">
          <span class="material-icons-round">account_tree</span> Buka di Editor
        </button>
        <button class="btn btn-sm btn-primary" onclick="showModal('modalEksporGambar')" title="Ekspor diagram lengkap dengan hasil kalkulasi 600 DPI">
          <span class="material-icons-round">image</span> Ekspor Diagram (600 DPI)
        </button>
      </div>
    </div>
    <div class="ringkasan-grid">
      <div class="ringkasan-card">
        <span class="value">${hasil.sampleSize}</span>
        <span class="label">Ukuran Sampel</span>
      </div>
      <div class="ringkasan-card">
        <span class="value">${hasil.iterations}</span>
        <span class="label">Iterasi</span>
      </div>
      <div class="ringkasan-card">
        <span class="value" style="color: ${hasil.converged ? 'var(--color-success)' : 'var(--color-danger)'}">
          ${hasil.converged ? 'Ya' : 'Tidak'}
        </span>
        <span class="label">Konvergen</span>
      </div>
      <div class="ringkasan-card">
        <span class="value">${Object.keys(hasil.pathCoefficients).length}</span>
        <span class="label">Jalur</span>
      </div>
    </div>
    
    <h4 style="margin: 24px 0 12px;">Koefisien Jalur (Path Coefficients)</h4>
    <table class="data-table">
      <thead>
        <tr>
          <th>Jalur</th>
          <th>Koefisien</th>
          <th>Kekuatan</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(hasil.pathCoefficients).map(([path, coeff]) => {
          const strength = Math.abs(coeff) >= 0.5 ? 'Kuat' : Math.abs(coeff) >= 0.3 ? 'Sedang' : 'Lemah';
          const strengthClass = Math.abs(coeff) >= 0.5 ? 'badge-sukses' : Math.abs(coeff) >= 0.3 ? 'badge-peringatan' : 'badge-danger';
          return `
            <tr>
              <td>${escapeHtml(path)}</td>
              <td style="font-weight: 600;">${coeff.toFixed(4)}</td>
              <td><span class="badge ${strengthClass}">${strength}</span></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    
    <h4 style="margin: 24px 0 12px;">R² (Koefisien Determinasi)</h4>
    <table class="data-table">
      <thead>
        <tr>
          <th>Variabel</th>
          <th>R²</th>
          <th>Keterangan</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(hasil.rSquared).map(([name, r2]) => {
          const desc = r2 >= 0.75 ? 'Substansial' : r2 >= 0.50 ? 'Moderat' : r2 >= 0.25 ? 'Lemah' : 'Sangat Lemah';
          const descClass = r2 >= 0.75 ? 'badge-sukses' : r2 >= 0.50 ? 'badge-peringatan' : 'badge-danger';
          return `
            <tr>
              <td>${escapeHtml(name)}</td>
              <td style="font-weight: 600;">${r2.toFixed(4)}</td>
              <td><span class="badge ${descClass}">${desc}</span></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
  
  // Tab Outer Model (Model Pengukuran)
  const outerModel = document.getElementById('tab-outer-model');
  let outerHtml = '<h3 style="margin-bottom: 16px;">Model Pengukuran (Outer Model)</h3>';
  
  // Outer Loadings
  outerHtml += '<h4 style="margin-bottom: 12px;">Outer Loadings</h4>';
  outerHtml += '<table class="data-table"><thead><tr><th>Variabel</th><th>Indikator</th><th>Loading</th><th>Status</th></tr></thead><tbody>';
  
  for (const [varName, loadings] of Object.entries(hasil.outerLoadings)) {
    for (const [ind, val] of Object.entries(loadings)) {
      const status = Math.abs(val) >= 0.7 ? 'Baik' : Math.abs(val) >= 0.4 ? 'Marginal' : 'Rendah';
      const statusClass = Math.abs(val) >= 0.7 ? 'badge-sukses' : Math.abs(val) >= 0.4 ? 'badge-peringatan' : 'badge-danger';
      outerHtml += `
        <tr>
          <td>${escapeHtml(varName)}</td>
          <td>${escapeHtml(ind)}</td>
          <td style="font-weight: 600;">${val.toFixed(4)}</td>
          <td><span class="badge ${statusClass}">${status}</span></td>
        </tr>
      `;
    }
  }
  outerHtml += '</tbody></table>';
  
  // Reliabilitas
  outerHtml += '<h4 style="margin: 24px 0 12px;">Reliabilitas & Validitas Konvergen</h4>';
  outerHtml += '<table class="data-table"><thead><tr><th>Variabel</th><th>Cronbach\'s Alpha</th><th>rho_A</th><th>CR</th><th>AVE</th></tr></thead><tbody>';
  
  for (const [varName, rel] of Object.entries(hasil.reliability)) {
    outerHtml += `
      <tr>
        <td>${escapeHtml(varName)}</td>
        <td class="${rel.cronbachAlpha >= 0.7 ? 'signifikan' : 'tidak-signifikan'}">${rel.cronbachAlpha.toFixed(4)}</td>
        <td>${rel.rhoA.toFixed(4)}</td>
        <td class="${rel.compositeReliability >= 0.7 ? 'signifikan' : 'tidak-signifikan'}">${rel.compositeReliability.toFixed(4)}</td>
        <td class="${rel.ave >= 0.5 ? 'signifikan' : 'tidak-signifikan'}">${rel.ave.toFixed(4)}</td>
      </tr>
    `;
  }
  outerHtml += '</tbody></table>';
  
  // Validitas Diskriminan (Fornell-Larcker)
  outerHtml += '<h4 style="margin: 24px 0 12px;">Validitas Diskriminan (Fornell-Larcker Criterion)</h4>';
  const varNames = Object.keys(hasil.discriminantValidity);
  outerHtml += '<table class="data-table"><thead><tr><th></th>';
  varNames.forEach(n => outerHtml += `<th>${escapeHtml(n)}</th>`);
  outerHtml += '</tr></thead><tbody>';
  
  for (const v1 of varNames) {
    outerHtml += `<tr><td style="font-weight: 600;">${escapeHtml(v1)}</td>`;
    for (const v2 of varNames) {
      const val = hasil.discriminantValidity[v1][v2];
      const isDiagonal = v1 === v2;
      outerHtml += `<td style="${isDiagonal ? 'font-weight: 700; color: var(--color-primary);' : ''}">${val.toFixed(4)}</td>`;
    }
    outerHtml += '</tr>';
  }
  outerHtml += '</tbody></table>';
  
  outerModel.innerHTML = outerHtml;
  
  // Tab Inner Model (Model Struktural)
  const innerModel = document.getElementById('tab-inner-model');
  let innerHtml = '<h3 style="margin-bottom: 16px;">Model Struktural (Inner Model)</h3>';
  
  // Path coefficients detail
  innerHtml += '<h4 style="margin-bottom: 12px;">Koefisien Jalur</h4>';
  innerHtml += '<table class="data-table"><thead><tr><th>Jalur</th><th>Koefisien (β)</th><th>f² (Effect Size)</th><th>Keterangan f²</th></tr></thead><tbody>';
  
  for (const [path, coeff] of Object.entries(hasil.pathCoefficients)) {
    const f2 = hasil.effectSizes[path] || 0;
    const f2Desc = f2 >= 0.35 ? 'Besar' : f2 >= 0.15 ? 'Sedang' : f2 >= 0.02 ? 'Kecil' : 'Sangat Kecil';
    const f2Class = f2 >= 0.35 ? 'badge-sukses' : f2 >= 0.15 ? 'badge-peringatan' : 'badge-danger';
    
    innerHtml += `
      <tr>
        <td>${escapeHtml(path)}</td>
        <td style="font-weight: 600;">${coeff.toFixed(4)}</td>
        <td>${f2.toFixed(4)}</td>
        <td><span class="badge ${f2Class}">${f2Desc}</span></td>
      </tr>
    `;
  }
  innerHtml += '</tbody></table>';
  
  // R²
  innerHtml += '<h4 style="margin: 24px 0 12px;">R² & R² Adjusted</h4>';
  innerHtml += '<table class="data-table"><thead><tr><th>Variabel Endogen</th><th>R²</th><th>Keterangan</th></tr></thead><tbody>';
  
  for (const [name, r2] of Object.entries(hasil.rSquared)) {
    const desc = r2 >= 0.75 ? 'Substansial' : r2 >= 0.50 ? 'Moderat' : r2 >= 0.25 ? 'Lemah' : 'Sangat Lemah';
    const descClass = r2 >= 0.75 ? 'badge-sukses' : r2 >= 0.50 ? 'badge-peringatan' : 'badge-danger';
    innerHtml += `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td style="font-weight: 600;">${r2.toFixed(4)}</td>
        <td><span class="badge ${descClass}">${desc}</span></td>
      </tr>
    `;
  }
  innerHtml += '</tbody></table>';
  
  innerModel.innerHTML = innerHtml;
}

function displayBootstrapResults(hasil) {
  const bootstrapTab = document.getElementById('tab-bootstrap');
  let html = '<h3 style="margin-bottom: 16px;">Hasil Bootstrapping</h3>';
  
  html += `
    <div class="ringkasan-grid" style="margin-bottom: 24px;">
      <div class="ringkasan-card">
        <span class="value">${hasil.numSubsamples}</span>
        <span class="label">Jumlah Subsampel</span>
      </div>
      <div class="ringkasan-card">
        <span class="value">${(hasil.significanceLevel * 100).toFixed(0)}%</span>
        <span class="label">Tingkat Kepercayaan</span>
      </div>
      <div class="ringkasan-card">
        <span class="value">${hasil.testType === 'two-tailed' ? 'Dua Sisi' : 'Satu Sisi'}</span>
        <span class="label">Tipe Uji</span>
      </div>
    </div>
  `;
  
  // Path coefficients bootstrap
  html += '<h4 style="margin-bottom: 12px;">Koefisien Jalur - Hasil Bootstrap</h4>';
  html += `<table class="data-table">
    <thead>
      <tr>
        <th>Jalur</th>
        <th>Sampel Asli (O)</th>
        <th>Rata-rata Sampel (M)</th>
        <th>Std. Deviasi</th>
        <th>T Statistik</th>
        <th>P Values</th>
        <th>Keputusan</th>
      </tr>
    </thead>
    <tbody>
  `;
  
  for (const [path, result] of Object.entries(hasil.pathResults)) {
    const criticalT = hasil.testType === 'two-tailed' 
      ? (hasil.significanceLevel === 0.05 ? 1.96 : hasil.significanceLevel === 0.01 ? 2.576 : 1.645)
      : (hasil.significanceLevel === 0.05 ? 1.645 : hasil.significanceLevel === 0.01 ? 2.326 : 1.282);
    
    html += `
      <tr>
        <td>${escapeHtml(path)}</td>
        <td style="font-weight: 600;">${result.originalValue.toFixed(4)}</td>
        <td>${result.bootMean.toFixed(4)}</td>
        <td>${result.bootStd.toFixed(4)}</td>
        <td style="font-weight: 600;">${result.tStatistic.toFixed(4)}</td>
        <td style="font-weight: 600; color: ${result.pValue < hasil.significanceLevel ? 'var(--color-success)' : 'var(--color-danger)'}">
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
  html += '</tbody></table>';
  
  // Confidence Intervals
  html += '<h4 style="margin: 24px 0 12px;">Interval Kepercayaan (Confidence Intervals)</h4>';
  html += `<table class="data-table">
    <thead>
      <tr>
        <th>Jalur</th>
        <th>Sampel Asli</th>
        <th>CI Bawah (${((hasil.significanceLevel/2)*100).toFixed(1)}%)</th>
        <th>CI Atas (${((1-hasil.significanceLevel/2)*100).toFixed(1)}%)</th>
        <th>Keterangan</th>
      </tr>
    </thead>
    <tbody>
  `;
  
  for (const [path, result] of Object.entries(hasil.pathResults)) {
    const containsZero = result.ciLower <= 0 && result.ciUpper >= 0;
    html += `
      <tr>
        <td>${escapeHtml(path)}</td>
        <td style="font-weight: 600;">${result.originalValue.toFixed(4)}</td>
        <td>${result.ciLower.toFixed(4)}</td>
        <td>${result.ciUpper.toFixed(4)}</td>
        <td>
          <span class="badge ${!containsZero ? 'badge-sukses' : 'badge-danger'}">
            ${!containsZero ? 'Tidak melewati 0' : 'Melewati 0'}
          </span>
        </td>
      </tr>
    `;
  }
  html += '</tbody></table>';
  
  // Outer loading bootstrap
  if (Object.keys(hasil.loadingResults).length > 0) {
    html += '<h4 style="margin: 24px 0 12px;">Outer Loading - Hasil Bootstrap</h4>';
    html += `<table class="data-table">
      <thead>
        <tr>
          <th>Variabel</th>
          <th>Indikator</th>
          <th>Loading</th>
          <th>T Statistik</th>
          <th>P Values</th>
          <th>Keputusan</th>
        </tr>
      </thead>
      <tbody>
    `;
    
    for (const [varName, indicators] of Object.entries(hasil.loadingResults)) {
      for (const [ind, result] of Object.entries(indicators)) {
        html += `
          <tr>
            <td>${escapeHtml(varName)}</td>
            <td>${escapeHtml(ind)}</td>
            <td style="font-weight: 600;">${result.originalValue.toFixed(4)}</td>
            <td>${result.tStatistic.toFixed(4)}</td>
            <td style="color: ${result.pValue < hasil.significanceLevel ? 'var(--color-success)' : 'var(--color-danger)'}">
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
}

async function loadResults() {
  if (!state.proyekAktif) return;
  
  const results = await window.api.hasilDaftar(state.proyekAktif.id);
  
  document.getElementById('totalAnalisis').textContent = results.length;
  
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
  }
}

function prepareExportData() {
  if (!state.hasilPLS) return [];
  
  const sheets = {};
  
  // Path Coefficients
  sheets['Koefisien Jalur'] = Object.entries(state.hasilPLS.pathCoefficients).map(([path, coeff]) => ({
    'Jalur': path,
    'Koefisien': coeff.toFixed(4)
  }));
  
  // R²
  sheets['R Kuadrat'] = Object.entries(state.hasilPLS.rSquared).map(([name, r2]) => ({
    'Variabel': name,
    'R²': r2.toFixed(4)
  }));
  
  // Outer Loadings
  const loadingRows = [];
  for (const [varName, loadings] of Object.entries(state.hasilPLS.outerLoadings)) {
    for (const [ind, val] of Object.entries(loadings)) {
      loadingRows.push({ 'Variabel': varName, 'Indikator': ind, 'Loading': val.toFixed(4) });
    }
  }
  sheets['Outer Loading'] = loadingRows;
  
  // Reliability
  sheets['Reliabilitas'] = Object.entries(state.hasilPLS.reliability).map(([name, rel]) => ({
    'Variabel': name,
    "Cronbach's Alpha": rel.cronbachAlpha.toFixed(4),
    'rho_A': rel.rhoA.toFixed(4),
    'Composite Reliability': rel.compositeReliability.toFixed(4),
    'AVE': rel.ave.toFixed(4)
  }));
  
  // Bootstrap if available
  if (state.hasilBootstrap && state.hasilBootstrap.pathResults) {
    sheets['Bootstrapping'] = Object.entries(state.hasilBootstrap.pathResults).map(([path, result]) => ({
      'Jalur': path,
      'Sampel Asli': result.originalValue.toFixed(4),
      'Rata-rata Bootstrap': result.bootMean.toFixed(4),
      'Std. Deviasi': result.bootStd.toFixed(4),
      'T Statistik': result.tStatistic.toFixed(4),
      'P Values': result.pValue.toFixed(4),
      'Signifikan': result.signifikan ? 'Ya' : 'Tidak'
    }));
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
