const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  
  // Proyek
  proyekBuat: (data) => ipcRenderer.invoke('proyek-buat', data),
  proyekUpdateNama: (data) => ipcRenderer.invoke('proyek-update-nama', data),
  proyekDaftar: () => ipcRenderer.invoke('proyek-daftar'),
  proyekAmbil: (id) => ipcRenderer.invoke('proyek-ambil', id),
  proyekSimpanModel: (data) => ipcRenderer.invoke('proyek-simpan-model', data),
  proyekHapus: (id) => ipcRenderer.invoke('proyek-hapus', id),
  proyekEksporFile: (proyekId) => ipcRenderer.invoke('proyek-ekspor-file', proyekId),
  proyekImporFile: () => ipcRenderer.invoke('proyek-impor-file'),

  // Versioning
  proyekVersiSimpan: (data) => ipcRenderer.invoke('proyek-versi-simpan', data),
  proyekVersiDaftar: (proyekId) => ipcRenderer.invoke('proyek-versi-daftar', proyekId),
  proyekVersiAmbil: (id) => ipcRenderer.invoke('proyek-versi-ambil', id),
  proyekVersiHapus: (id) => ipcRenderer.invoke('proyek-versi-hapus', id),
  
  // Dataset
  datasetImpor: (proyekId) => ipcRenderer.invoke('dataset-impor', proyekId),
  datasetDaftar: (proyekId) => ipcRenderer.invoke('dataset-daftar', proyekId),
  datasetAmbil: (id) => ipcRenderer.invoke('dataset-ambil', id),
  datasetHapus: (id) => ipcRenderer.invoke('dataset-hapus', id),
  
  // Variabel Laten
  variabelSimpan: (data) => ipcRenderer.invoke('variabel-simpan', data),
  variabelDaftar: (proyekId) => ipcRenderer.invoke('variabel-daftar', proyekId),
  
  // Jalur
  jalurSimpan: (data) => ipcRenderer.invoke('jalur-simpan', data),
  jalurDaftar: (proyekId) => ipcRenderer.invoke('jalur-daftar', proyekId),
  
  // Hasil
  hasilSimpan: (data) => ipcRenderer.invoke('hasil-simpan', data),
  hasilDaftar: (proyekId) => ipcRenderer.invoke('hasil-daftar', proyekId),
  hasilHapus: (id) => ipcRenderer.invoke('hasil-hapus', id),
  
  // Ekspor
  eksporHasil: (data) => ipcRenderer.invoke('ekspor-hasil', data),
  eksporGambar: (data) => ipcRenderer.invoke('ekspor-gambar', data),

  // External Links & Email
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});

