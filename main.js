const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

// Suppress GPU & HTTP cache permission error on Windows multi-instance
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-program-cache');
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disk-cache-size', '0');

let mainWindow;
let db;
let SQL;
let dbPath;

// ============ DATABASE SETUP ============
async function initDatabase() {
  const initSqlJs = require('sql.js');
  
  // Determine WASM path
  let wasmPath;
  if (app.isPackaged) {
    wasmPath = path.join(process.resourcesPath, 'sql-wasm.wasm');
  } else {
    wasmPath = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  }
  
  SQL = await initSqlJs({
    locateFile: () => wasmPath
  });
  
  const freePlsDbPath = path.join(app.getPath('userData'), 'freepls.db');
  const openPlsDbPath = path.join(app.getPath('userData'), 'openpls.db');
  const oldSmartPlsDbPath = path.join(app.getPath('userData'), 'smartpls.db');
  
  if (!fs.existsSync(freePlsDbPath)) {
    if (fs.existsSync(openPlsDbPath)) {
      try { fs.copyFileSync(openPlsDbPath, freePlsDbPath); } catch (e) {}
    } else if (fs.existsSync(oldSmartPlsDbPath)) {
      try { fs.copyFileSync(oldSmartPlsDbPath, freePlsDbPath); } catch (e) {}
    }
  }

  dbPath = freePlsDbPath;
  
  // Load existing DB or create new
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  // Tabel proyek
  db.run(`
    CREATE TABLE IF NOT EXISTS proyek (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      deskripsi TEXT,
      tanggal_dibuat TEXT DEFAULT (datetime('now','localtime')),
      tanggal_diubah TEXT DEFAULT (datetime('now','localtime')),
      model_data TEXT,
      pengaturan TEXT DEFAULT '{}'
    )
  `);

  // Tabel riwayat versi proyek
  db.run(`
    CREATE TABLE IF NOT EXISTS proyek_versi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proyek_id INTEGER NOT NULL,
      nama_versi TEXT NOT NULL,
      catatan TEXT,
      model_data TEXT NOT NULL,
      tanggal_dibuat TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (proyek_id) REFERENCES proyek(id) ON DELETE CASCADE
    )
  `);
  
  // Tabel dataset
  db.run(`
    CREATE TABLE IF NOT EXISTS dataset (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proyek_id INTEGER NOT NULL,
      nama TEXT NOT NULL,
      kolom TEXT,
      data TEXT,
      jumlah_baris INTEGER DEFAULT 0,
      jumlah_kolom INTEGER DEFAULT 0,
      tanggal_impor TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (proyek_id) REFERENCES proyek(id) ON DELETE CASCADE
    )
  `);
  
  // Tabel hasil analisis
  db.run(`
    CREATE TABLE IF NOT EXISTS hasil_analisis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proyek_id INTEGER NOT NULL,
      tipe TEXT NOT NULL,
      data_hasil TEXT,
      tanggal_analisis TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (proyek_id) REFERENCES proyek(id) ON DELETE CASCADE
    )
  `);
  
  saveDb();
}

function saveDb() {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Helper: run query and return rows as objects
function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function dbGet(sql, params = []) {
  const results = dbAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDb();
  return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] || 0 };
}

// ============ WINDOW CREATION ============
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'FreePLS Indonesia',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    frame: false,
    backgroundColor: '#0f0f23'
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  
  // Remove default menu
  Menu.setApplicationMenu(null);
}

app.whenReady().then(async () => {
  await initDatabase();
  createWindow();
});

app.on('window-all-closed', () => {
  saveDb();
  app.quit();
});

// ============ WINDOW CONTROLS ============
ipcMain.handle('window-minimize', () => mainWindow.minimize());
ipcMain.handle('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window-close', () => mainWindow.close());
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));
ipcMain.handle('get-app-path', () => __dirname);

// ============ PROYEK (PROJECT) HANDLERS ============
ipcMain.handle('proyek-buat', (_, { nama, deskripsi }) => {
  const result = dbRun('INSERT INTO proyek (nama, deskripsi) VALUES (?, ?)', [nama, deskripsi || '']);
  return { id: result.lastInsertRowid, nama, deskripsi };
});

ipcMain.handle('proyek-update-nama', (_, { id, nama, deskripsi }) => {
  dbRun('UPDATE proyek SET nama = ?, deskripsi = ?, tanggal_diubah = datetime("now","localtime") WHERE id = ?', [nama, deskripsi || '', id]);
  return true;
});

ipcMain.handle('proyek-daftar', () => {
  return dbAll('SELECT * FROM proyek ORDER BY tanggal_diubah DESC');
});

ipcMain.handle('proyek-ambil', (_, id) => {
  return dbGet('SELECT * FROM proyek WHERE id = ?', [id]);
});

ipcMain.handle('proyek-simpan-model', (_, { id, model_data }) => {
  dbRun('UPDATE proyek SET model_data = ?, tanggal_diubah = datetime("now","localtime") WHERE id = ?', [JSON.stringify(model_data), id]);
  return true;
});

ipcMain.handle('proyek-hapus', (_, id) => {
  dbRun('DELETE FROM proyek_versi WHERE proyek_id = ?', [id]);
  dbRun('DELETE FROM hasil_analisis WHERE proyek_id = ?', [id]);
  dbRun('DELETE FROM dataset WHERE proyek_id = ?', [id]);
  dbRun('DELETE FROM proyek WHERE id = ?', [id]);
  return true;
});

// ============ PROYEK VERSIONING HANDLERS ============
ipcMain.handle('proyek-versi-simpan', (_, { proyek_id, nama_versi, catatan, model_data }) => {
  const res = dbRun(
    'INSERT INTO proyek_versi (proyek_id, nama_versi, catatan, model_data) VALUES (?, ?, ?, ?)',
    [proyek_id, nama_versi, catatan || '', JSON.stringify(model_data)]
  );
  return { id: res.lastInsertRowid, proyek_id, nama_versi, catatan };
});

ipcMain.handle('proyek-versi-daftar', (_, proyek_id) => {
  return dbAll('SELECT id, proyek_id, nama_versi, catatan, tanggal_dibuat FROM proyek_versi WHERE proyek_id = ? ORDER BY id DESC', [proyek_id]);
});

ipcMain.handle('proyek-versi-ambil', (_, id) => {
  const versi = dbGet('SELECT * FROM proyek_versi WHERE id = ?', [id]);
  if (versi && versi.model_data) {
    try {
      versi.model_data = JSON.parse(versi.model_data);
    } catch(e) {}
  }
  return versi;
});

ipcMain.handle('proyek-versi-hapus', (_, id) => {
  dbRun('DELETE FROM proyek_versi WHERE id = ?', [id]);
  return true;
});

// ============ BUNDLE EKSPOR / IMPOR (.openpls / .smartpls) ============
ipcMain.handle('proyek-ekspor-file', async (_, proyekId) => {
  const proyek = dbGet('SELECT * FROM proyek WHERE id = ?', [proyekId]);
  if (!proyek) return false;

  const datasets = dbAll('SELECT * FROM dataset WHERE proyek_id = ?', [proyekId]);
  const versis = dbAll('SELECT * FROM proyek_versi WHERE proyek_id = ? ORDER BY id ASC', [proyekId]);
  const hasil = dbAll('SELECT * FROM hasil_analisis WHERE proyek_id = ?', [proyekId]);

  const bundle = {
    format: 'FreePLS_Indonesia_Project',
    version: '2.0',
    export_time: new Date().toISOString(),
    proyek: {
      nama: proyek.nama,
      deskripsi: proyek.deskripsi,
      model_data: proyek.model_data ? JSON.parse(proyek.model_data) : null,
      pengaturan: proyek.pengaturan
    },
    versis: versis.map(v => ({
      nama_versi: v.nama_versi,
      catatan: v.catatan,
      model_data: JSON.parse(v.model_data || '{}'),
      tanggal_dibuat: v.tanggal_dibuat
    })),
    datasets: datasets.map(d => ({
      nama: d.nama,
      kolom: JSON.parse(d.kolom || '[]'),
      data: JSON.parse(d.data || '[]'),
      jumlah_baris: d.jumlah_baris,
      jumlah_kolom: d.jumlah_kolom
    })),
    hasil: hasil.map(h => ({
      tipe: h.tipe,
      data_hasil: JSON.parse(h.data_hasil || '{}'),
      tanggal_analisis: h.tanggal_analisis
    }))
  };

  const safeName = (proyek.nama || 'Proyek_FreePLS').replace(/[^a-zA-Z0-9_-]/g, '_');
  let defaultFolder;
  try {
    defaultFolder = app.getPath('documents') || app.getPath('desktop');
  } catch (e) {
    defaultFolder = app.getPath('desktop');
  }
  const defaultPath = path.join(defaultFolder, `${safeName}.freepls`);

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Simpan Berkas Proyek FreePLS (.freepls)',
    defaultPath: defaultPath,
    filters: [
      { name: 'Berkas Proyek FreePLS (*.freepls)', extensions: ['freepls'] },
      { name: 'Semua Berkas (*.*)', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { sukses: false, canceled: true };
  }

  let targetPath = result.filePath;
  if (!path.extname(targetPath)) {
    targetPath += '.freepls';
  }

  fs.writeFileSync(targetPath, JSON.stringify(bundle, null, 2), 'utf-8');
  return { sukses: true, filePath: targetPath };
});

ipcMain.handle('proyek-impor-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Impor File Proyek FreePLS',
    filters: [
      { name: 'FreePLS Project File (*.freepls, *.openpls, *.smartpls, *.json)', extensions: ['freepls', 'openpls', 'smartpls', 'json'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled) return null;

  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    const bundle = JSON.parse(raw);

    if (!bundle.proyek || !bundle.proyek.nama) {
      throw new Error('Format file proyek tidak valid');
    }

    // Insert project
    const resP = dbRun(
      'INSERT INTO proyek (nama, deskripsi, model_data, pengaturan) VALUES (?, ?, ?, ?)',
      [
        `${bundle.proyek.nama} (Impor)`,
        bundle.proyek.deskripsi || '',
        bundle.proyek.model_data ? JSON.stringify(bundle.proyek.model_data) : null,
        bundle.proyek.pengaturan || '{}'
      ]
    );
    const newProyekId = resP.lastInsertRowid;

    // Insert datasets
    if (bundle.datasets && Array.isArray(bundle.datasets)) {
      bundle.datasets.forEach(ds => {
        dbRun(
          'INSERT INTO dataset (proyek_id, nama, kolom, data, jumlah_baris, jumlah_kolom) VALUES (?, ?, ?, ?, ?, ?)',
          [
            newProyekId,
            ds.nama,
            JSON.stringify(ds.kolom || []),
            JSON.stringify(ds.data || []),
            ds.jumlah_baris || 0,
            ds.jumlah_kolom || 0
          ]
        );
      });
    }

    // Insert versis
    if (bundle.versis && Array.isArray(bundle.versis)) {
      bundle.versis.forEach(v => {
        dbRun(
          'INSERT INTO proyek_versi (proyek_id, nama_versi, catatan, model_data, tanggal_dibuat) VALUES (?, ?, ?, ?, ?)',
          [
            newProyekId,
            v.nama_versi,
            v.catatan || '',
            JSON.stringify(v.model_data || {}),
            v.tanggal_dibuat || new Date().toISOString().replace('T', ' ').substring(0, 19)
          ]
        );
      });
    }

    return dbGet('SELECT * FROM proyek WHERE id = ?', [newProyekId]);
  } catch (err) {
    throw new Error('Gagal mengimpor file: ' + err.message);
  }
});

// ============ DATASET HANDLERS ============
ipcMain.handle('dataset-impor', async (_, proyekId) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Impor Data',
    filters: [
      { name: 'File Data', extensions: ['csv', 'xlsx', 'xls'] }
    ],
    properties: ['openFile']
  });
  
  if (result.canceled) return null;
  
  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath, ext);
  
  let columns = [];
  let rows = [];
  
  if (ext === '.csv') {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    if (lines.length > 0) {
      columns = lines[0].split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(/[,;\t]/).map(v => v.trim().replace(/^["']|["']$/g, ''));
        const row = {};
        columns.forEach((col, idx) => {
          row[col] = isNaN(parseFloat(vals[idx])) ? vals[idx] : parseFloat(vals[idx]);
        });
        rows.push(row);
      }
    }
  } else {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet);
    if (jsonData.length > 0) {
      columns = Object.keys(jsonData[0]);
      rows = jsonData;
    }
  }
  
  const res = dbRun(
    'INSERT INTO dataset (proyek_id, nama, kolom, data, jumlah_baris, jumlah_kolom) VALUES (?, ?, ?, ?, ?, ?)',
    [proyekId, fileName, JSON.stringify(columns), JSON.stringify(rows), rows.length, columns.length]
  );
  
  return {
    id: res.lastInsertRowid,
    nama: fileName,
    kolom: columns,
    jumlah_baris: rows.length,
    jumlah_kolom: columns.length
  };
});

ipcMain.handle('dataset-tambah', (_, { proyek_id, nama, kolom, data, jumlah_baris, jumlah_kolom }) => {
  const res = dbRun(
    'INSERT INTO dataset (proyek_id, nama, kolom, data, jumlah_baris, jumlah_kolom) VALUES (?, ?, ?, ?, ?, ?)',
    [proyek_id, nama, JSON.stringify(kolom || []), JSON.stringify(data || []), jumlah_baris || data.length, jumlah_kolom || kolom.length]
  );
  return { id: res.lastInsertRowid, proyek_id, nama, kolom, data, jumlah_baris: jumlah_baris || data.length, jumlah_kolom: jumlah_kolom || kolom.length };
});

ipcMain.handle('dataset-daftar', (_, proyekId) => {
  const datasets = dbAll('SELECT id, proyek_id, nama, kolom, jumlah_baris, jumlah_kolom, tanggal_impor FROM dataset WHERE proyek_id = ?', [proyekId]);
  return datasets.map(d => ({ ...d, kolom: JSON.parse(d.kolom || '[]') }));
});

ipcMain.handle('dataset-ambil', (_, id) => {
  const dataset = dbGet('SELECT * FROM dataset WHERE id = ?', [id]);
  if (dataset) {
    dataset.kolom = JSON.parse(dataset.kolom || '[]');
    dataset.data = JSON.parse(dataset.data || '[]');
  }
  return dataset;
});

ipcMain.handle('dataset-simpan-data', (_, { id, data, jumlah_baris, jumlah_kolom }) => {
  dbRun('UPDATE dataset SET data = ?, jumlah_baris = ?, jumlah_kolom = ? WHERE id = ?', [JSON.stringify(data), jumlah_baris, jumlah_kolom, id]);
  return true;
});

ipcMain.handle('dataset-hapus', (_, id) => {
  dbRun('DELETE FROM dataset WHERE id = ?', [id]);
  return true;
});

// ============ HASIL ANALISIS HANDLERS ============
ipcMain.handle('hasil-simpan', (_, { proyek_id, tipe, data_hasil }) => {
  dbRun('INSERT INTO hasil_analisis (proyek_id, tipe, data_hasil) VALUES (?, ?, ?)', [proyek_id, tipe, JSON.stringify(data_hasil)]);
  return true;
});

ipcMain.handle('hasil-daftar', (_, proyekId) => {
  const results = dbAll('SELECT * FROM hasil_analisis WHERE proyek_id = ? ORDER BY tanggal_analisis DESC', [proyekId]);
  return results.map(r => ({ ...r, data_hasil: JSON.parse(r.data_hasil || '{}') }));
});

ipcMain.handle('hasil-hapus', (_, id) => {
  dbRun('DELETE FROM hasil_analisis WHERE id = ?', [id]);
  return true;
});

// ============ EXPORT HANDLERS ============
ipcMain.handle('ekspor-hasil', async (_, { data, namaFile }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Ekspor Hasil',
    defaultPath: namaFile,
    filters: [
      { name: 'Excel', extensions: ['xlsx'] },
      { name: 'CSV', extensions: ['csv'] }
    ]
  });
  
  if (result.canceled) return false;
  
  const ext = path.extname(result.filePath).toLowerCase();
  
  if (ext === '.xlsx') {
    const wb = XLSX.utils.book_new();
    if (Array.isArray(data)) {
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Hasil');
    } else {
      for (const [sheetName, sheetData] of Object.entries(data)) {
        const ws = XLSX.utils.json_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }
    }
    XLSX.writeFile(wb, result.filePath);
  } else {
    const rows = Array.isArray(data) ? data : Object.values(data)[0];
    if (rows && rows.length > 0) {
      const headers = Object.keys(rows[0]);
      const csvContent = [headers.join(','), ...rows.map(r => headers.map(h => r[h]).join(','))].join('\n');
      fs.writeFileSync(result.filePath, csvContent, 'utf-8');
    }
  }
  
  return true;
});

ipcMain.handle('ekspor-gambar', async (_, { dataUrl, namaFile, format }) => {
  const defaultExt = format === 'jpg' ? 'jpg' : (format === 'svg' ? 'svg' : 'png');
  const filters = [
    { name: 'PNG Image (*.png)', extensions: ['png'] },
    { name: 'JPEG Image (*.jpg)', extensions: ['jpg', 'jpeg'] },
    { name: 'SVG Vector (*.svg)', extensions: ['svg'] }
  ];
  
  // Rearrange filters based on requested format
  if (defaultExt === 'jpg') {
    filters.unshift(filters.splice(1, 1)[0]);
  } else if (defaultExt === 'svg') {
    filters.unshift(filters.splice(2, 1)[0]);
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Simpan Gambar Diagram (High Resolution)',
    defaultPath: namaFile || `diagram_model_600dpi.${defaultExt}`,
    filters: filters
  });
  
  if (result.canceled) return false;
  
  const ext = path.extname(result.filePath).toLowerCase();
  
  if (ext === '.svg' && typeof dataUrl === 'string' && dataUrl.startsWith('<svg')) {
    fs.writeFileSync(result.filePath, dataUrl, 'utf-8');
  } else {
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(result.filePath, buffer);
  }
  
  return true;
});

