'use strict';
/**
 * FreePLS File Analyzer
 * Pipeline: file path → FreePLS engine → from_freePLS/{filename}/ (HTML, SVG, MD, CSV, JSON) → DB
 */
const fs   = require('fs');
const path = require('path');

function getAppPath(...segments) {
  const dev = path.join(__dirname, '..', ...segments);
  if (fs.existsSync(dev)) return dev;
  const unpacked = path.join(__dirname, '..', 'app.asar.unpacked', ...segments);
  if (fs.existsSync(unpacked)) return unpacked;
  return dev;
}

const PROJECT_ROOT = path.join(__dirname, '..');
const OUT_BASE     = path.join(PROJECT_ROOT, 'from_freePLS');
const { PLSEngine } = require(getAppPath('src', 'pls-engine.js'));

// ─── FILE PARSERS ─────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  const raw   = fs.readFileSync(filePath, 'utf8').trim();
  const lines = raw.split(/\r?\n/);
  // Detect delimiter (comma or semicolon)
  const delim = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delim).map(h => h.trim().replace(/^["']|["']$/g,''));
  const data = lines.slice(1)
    .filter(l => l.trim())
    .map(line => {
      const vals = line.split(delim);
      const row  = {};
      headers.forEach((h, i) => {
        const raw = (vals[i]||'').trim().replace(/^["']|["']$/g,'');
        row[h] = parseFloat(raw.replace(',','.')) || 0;
      });
      return row;
    });
  return { headers, data, n: data.length };
}

function parseExcel(filePath) {
  // Try xlsx (may be available in Electron node_modules or app.asar.unpacked)
  const XLSX = require(getAppPath('node_modules', 'xlsx'));
  const wb   = XLSX.readFile(filePath);
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: 0 });
  if (!rows.length) throw new Error('File Excel kosong.');
  const headers = Object.keys(rows[0]);
  return { headers, data: rows, n: rows.length };
}

function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') return parseCSV(filePath);
  if (ext === '.xlsx' || ext === '.xls') return parseExcel(filePath);
  throw new Error(`Format tidak didukung: ${ext}. Gunakan .csv atau .xlsx`);
}

// ─── MODEL AUTO-DETECTION ────────────────────────────────────────────────────

function autoDetectModel(headers) {
  // Group by prefix (strip trailing digits)
  const groups = {};
  for (const h of headers) {
    const prefix = h.replace(/\d+$/, '').trim();
    if (!prefix) continue;
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(h);
  }

  // Only use groups with ≥2 indicators (likely constructs)
  const constructs = Object.entries(groups)
    .filter(([, items]) => items.length >= 2)
    .map(([nama, indikator]) => ({ nama, indikator: indikator.sort(), tipe: 'reflektif' }));

  if (!constructs.length) throw new Error('Tidak dapat mendeteksi konstruk dari header kolom. Pastikan format: NamaKonstruk1, NamaKonstruk2, dst.');

  // Detect endogenous: priority list of common names
  const ENDO_PRIORITY = ['BI','BU','USE','INT','IU','AU','Y','ADOPT','CONTINUE'];
  const cNames = constructs.map(c => c.nama);
  let endogenous = cNames.find(n => ENDO_PRIORITY.includes(n.toUpperCase()));

  // If not found, assume last construct
  if (!endogenous) endogenous = cNames[cNames.length - 1];

  // Detect mediators (common TAM mediators)
  const MEDIATORS = ['PU','PEOU','ATT','TRUST','SAT','PERF'];
  const mediators = cNames.filter(n => MEDIATORS.includes(n.toUpperCase()) && n !== endogenous);
  const exogenous = cNames.filter(n => n !== endogenous && !mediators.includes(n));

  // Build paths: exogenous → mediators → endogenous
  const jalurs = [];
  if (mediators.length > 0) {
    exogenous.forEach(e => mediators.forEach(m => jalurs.push({ dari: e, ke: m })));
    mediators.forEach(m => jalurs.push({ dari: m, ke: endogenous }));
    // PEOU → PU if both exist
    if (cNames.includes('PEOU') && cNames.includes('PU')) {
      if (!jalurs.find(j => j.dari==='PEOU' && j.ke==='PU'))
        jalurs.push({ dari: 'PEOU', ke: 'PU' });
    }
  } else {
    // Simple: all → endogenous
    exogenous.forEach(e => jalurs.push({ dari: e, ke: endogenous }));
  }

  return { constructs, jalurs, endogenous, mediators, exogenous };
}

function applyCanvasLayout(constructs, jalurs) {
  const inDegree = {};
  const outDegree = {};
  constructs.forEach(c => {
    inDegree[c.nama] = 0;
    outDegree[c.nama] = 0;
  });
  jalurs.forEach(j => {
    if (inDegree[j.ke] !== undefined) inDegree[j.ke]++;
    if (outDegree[j.dari] !== undefined) outDegree[j.dari]++;
  });

  const exo = [];
  const med = [];
  const endo = [];

  constructs.forEach(c => {
    if (inDegree[c.nama] === 0) exo.push(c);
    else if (outDegree[c.nama] === 0) endo.push(c);
    else med.push(c);
  });

  // Exogenous: 2 staggered columns if > 6
  if (exo.length > 6) {
    const half = Math.ceil(exo.length / 2);
    const col1 = exo.slice(0, half);
    const col2 = exo.slice(half);
    const step1 = Math.max(90, Math.min(140, 750 / (col1.length + 1)));
    const step2 = Math.max(90, Math.min(140, 750 / (col2.length + 1)));
    col1.forEach((c, i) => {
      c.posisi_x = 180;
      c.posisi_y = 70 + (i + 1) * step1;
      c.orientasi = 'kiri';
    });
    col2.forEach((c, i) => {
      c.posisi_x = 360;
      c.posisi_y = 70 + (i + 1) * step2;
      c.orientasi = 'kiri';
    });
  } else {
    const step = Math.max(100, 600 / (exo.length + 1));
    exo.forEach((c, i) => {
      c.posisi_x = 220;
      c.posisi_y = 100 + (i + 1) * step;
      c.orientasi = 'kiri';
    });
  }

  // Mediators in middle
  const medStep = Math.max(160, 600 / (med.length + 1));
  med.forEach((c, i) => {
    c.posisi_x = 640;
    c.posisi_y = 100 + (i + 1) * medStep;
    c.orientasi = (i % 2 === 0) ? 'atas' : 'bawah';
  });

  // Endogenous on right
  const endoStep = Math.max(160, 600 / (endo.length + 1));
  endo.forEach((c, i) => {
    c.posisi_x = 940;
    c.posisi_y = 100 + (i + 1) * endoStep;
    c.orientasi = 'kanan';
  });

  // Jalur properties for FreePLS canvas
  jalurs.forEach((j, idx) => {
    j.id = j.id || (idx + 1);
    j.label = j.label || `H${idx + 1}`;
    j.tipe_garis = j.tipe_garis || 'solid';
    j.tebal_garis = j.tebal_garis || 2.2;
    j.kelengkungan = j.kelengkungan || 0;
  });
}

// ─── GENERATE MARKDOWN REPORT ────────────────────────────────────────────────

function generateMarkdown(results, outDir) {
  const { filename, n, variabels, plsResult, bootstrap, harman, ipma, descStats } = results;
  const { constructStats={}, outerLoadings={}, pathCoefs={}, htmt={} } = plsResult||{};
  const bootPaths = bootstrap?.pathResults||{};

  const lines = [];
  const add = s => lines.push(s);

  add(`# Laporan Analisis PLS-SEM — ${filename}`);
  add(`**n = ${n} responden** | ${variabels.length} konstruk | ${variabels.reduce((s,v)=>s+v.indikator.length,0)} indikator | Skala Likert 1–5`);
  add(`**Standar:** Hair et al. (2022), Henseler et al. (2015)`);
  add('');

  // Deskriptif
  add('## Statistik Deskriptif');
  add('| Indikator | Mean | SD | Min | Max | TCR% |');
  add('|-----------|------|-----|-----|-----|------|');
  for (const [ind, s] of Object.entries(descStats||{})) {
    add(`| ${ind} | ${(+s.mean||0).toFixed(3)} | ${(+s.sd||0).toFixed(3)} | ${(+s.min||0).toFixed(2)} | ${(+s.max||0).toFixed(2)} | ${(((+s.mean||0)/5)*100).toFixed(1)}% |`);
  }
  add('');

  // CMV
  add('## Common Method Bias (Harman)');
  add(`- Faktor pertama: **${harman?.explainedFirst?.toFixed(2)||'?'}%** (batas: <50%)`);
  add(`- Status: ${(harman?.explainedFirst||0)<50?'✅ Tidak ada masalah serius':'⚠️ Perlu framing akademik (lihat Richardson et al., 2009)'}`);
  add('');

  // Outer model
  add('## Outer Model');
  add('| Konstruk | Indikator | Loading | Status |');
  add('|----------|-----------|---------|--------|');
  for (const v of variabels) {
    v.indikator.forEach(it => {
      const l = outerLoadings[it]||0;
      add(`| ${v.nama} | ${it} | ${l.toFixed(4)} | ${l>=0.70?'✅':'❌'} |`);
    });
  }
  add('');
  add('| Konstruk | α | CR | AVE |');
  add('|----------|---|-----|-----|');
  for (const [name, cs] of Object.entries(constructStats)) {
    add(`| ${name} | ${cs.alpha?.toFixed(3)||'-'} | ${cs.cr?.toFixed(3)||'-'} | ${cs.ave?.toFixed(3)||'-'} |`);
  }
  add('');

  // Inner model
  add('## Inner Model — Koefisien Jalur (Bootstrap)');
  add('| # | Jalur | β | SE | t | p | Sig. |');
  add('|---|-------|---|-----|---|---|------|');
  let hi=1;
  for (const [key, b] of Object.entries(bootPaths)) {
    const beta = pathCoefs[key]||0;
    const star = b.p<0.001?'***':b.p<0.01?'**':b.p<0.05?'*':'ns';
    add(`| H${hi++} | ${key} | ${beta.toFixed(4)} | ${b.se?.toFixed(4)||'-'} | ${b.t?.toFixed(3)||'-'} | ${b.p?.toFixed(4)||'-'} | ${star} ${b.significant?'✅':'❌'} |`);
  }
  add('');

  // R²
  add('## R² per Konstruk Endogen');
  for (const [name, cs] of Object.entries(constructStats)) {
    if (cs.r2!==undefined) {
      const cls = cs.r2>=0.75?'Substansial':cs.r2>=0.50?'Moderat':'Lemah';
      add(`- **${name}**: R²=${cs.r2.toFixed(4)} (${cls})`);
    }
  }
  add('');

  // IPMA
  add('## IPMA');
  add('| Konstruk | Importance | Performance | Prioritas |');
  add('|----------|------------|-------------|-----------|');
  for (const r of (ipma||[])) {
    const hiI=r.importance>0, hiP=r.performance>75;
    const q=hiI&&!hiP?'🔴 Prioritas Utama':hiI&&hiP?'🟢 Pertahankan':'🟡 Rendah';
    add(`| ${r.construct||r.konstruk} | ${r.importance?.toFixed(4)||'-'} | ${r.performance?.toFixed(1)||'-'}% | ${q} |`);
  }
  add('');

  add('## Referensi');
  add('- Hair, J. F., et al. (2022). *A Primer on PLS-SEM* (3rd ed.). Sage.');
  add('- Henseler, J., Ringle, C. M., & Sarstedt, M. (2015). HTMT. *JAMS, 43*(1), 115–135.');
  add('- Dijkstra, T. K., & Henseler, J. (2015). PLSc. *MIS Quarterly, 39*(2), 297–316.');

  fs.writeFileSync(path.join(outDir, 'laporan.md'), lines.join('\n'));
}

// ─── GENERATE CSV TABLES ─────────────────────────────────────────────────────

function generateCSVTables(results, outDir) {
  const { variabels, plsResult, bootstrap } = results;
  const { constructStats={}, outerLoadings={}, pathCoefs={}, htmt={} } = plsResult||{};
  const bootPaths = bootstrap?.pathResults||{};

  // Table 1: Outer loadings
  const t1 = ['Konstruk,Indikator,Outer_Loading,Status'];
  for (const v of (variabels||[])) {
    v.indikator.forEach(it => {
      const l = outerLoadings[it]||0;
      t1.push(`${v.nama},${it},${l.toFixed(4)},${l>=0.70?'OK':'Below 0.70'}`);
    });
  }
  fs.writeFileSync(path.join(outDir,'tabel_1_outer_loadings.csv'), t1.join('\n'));

  // Table 2: Reliability
  const t2 = ['Konstruk,Alpha_Cronbach,CR,AVE'];
  for (const [name, cs] of Object.entries(constructStats)) {
    t2.push(`${name},${cs.alpha?.toFixed(4)||''},${cs.cr?.toFixed(4)||''},${cs.ave?.toFixed(4)||''}`);
  }
  fs.writeFileSync(path.join(outDir,'tabel_2_reliability.csv'), t2.join('\n'));

  // Table 3: HTMT
  const t3 = ['Pasangan,HTMT,Status'];
  for (const [pair, val] of Object.entries(htmt)) {
    t3.push(`${pair},${val?.toFixed(4)||''},${(val||0)<0.85?'OK':'Masalah'}`);
  }
  fs.writeFileSync(path.join(outDir,'tabel_3_htmt.csv'), t3.join('\n'));

  // Table 4: Path coefficients
  const t4 = ['Jalur,Beta,SE,t_stat,p_value,Signifikan'];
  for (const [key, b] of Object.entries(bootPaths)) {
    const beta = pathCoefs[key]||0;
    t4.push(`"${key}",${beta.toFixed(4)},${b.se?.toFixed(4)||''},${b.t?.toFixed(4)||''},${b.p?.toFixed(4)||''},${b.significant?'Ya':'Tidak'}`);
  }
  fs.writeFileSync(path.join(outDir,'tabel_4_path_coefficients.csv'), t4.join('\n'));
}

// ─── SAVE TO FREEPLS DB ───────────────────────────────────────────────────────

function saveToDatabase(db, filename, variabels, jalurs, data, plsResult, bootstrapRaw = null, dbPath = null) {
  try {
    // 1. Create or update project
    db.run(
      'INSERT INTO proyek (nama, deskripsi, model_data, tanggal_dibuat, tanggal_diubah) VALUES (?,?,?,?,?)',
      [
        filename,
        `Auto-analisis dari file: ${filename}. ${data.length} responden, ${variabels.length} konstruk.`,
        JSON.stringify({ variabels, jalurs }),
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
    // Get project ID (last insert)
    const row = db.exec('SELECT last_insert_rowid() as id');
    const proyekId = row[0]?.values[0]?.[0];
    if (!proyekId) return null;

    // 2. Save dataset
    const headers = variabels.flatMap(v => v.indikator);
    db.run(
      'INSERT INTO dataset (proyek_id, nama, kolom, data, jumlah_baris, jumlah_kolom, tanggal_impor) VALUES (?,?,?,?,?,?,?)',
      [proyekId, filename, JSON.stringify(headers), JSON.stringify(data), data.length, headers.length, new Date().toISOString()]
    );

    // 3. Save PLS result
    db.run(
      'INSERT INTO hasil_analisis (proyek_id, tipe, data_hasil, tanggal_analisis) VALUES (?,?,?,?)',
      [proyekId, 'pls', JSON.stringify(plsResult), new Date().toISOString()]
    );

    // 4. Save Bootstrap result so FreePLS UI loads both PLS and hypothesis testing
    if (bootstrapRaw) {
      db.run(
        'INSERT INTO hasil_analisis (proyek_id, tipe, data_hasil, tanggal_analisis) VALUES (?,?,?,?)',
        [proyekId, 'bootstrap', JSON.stringify(bootstrapRaw), new Date().toISOString()]
      );
    }

    // 5. Persist to SQLite file on disk
    if (dbPath && typeof db.export === 'function') {
      const buffer = Buffer.from(db.export());
      fs.writeFileSync(dbPath, buffer);
    }

    return proyekId;
  } catch(e) {
    console.warn('[FreePLS] DB save warning:', e.message);
    return null;
  }
}

// ─── MAIN PIPELINE ────────────────────────────────────────────────────────────

async function analyzeFile({ filePath, variabels, jalurs, targetIPMA, options={}, db=null, dbPath=null }) {
  // 1. Parse file
  if (!fs.existsSync(filePath)) throw new Error(`File tidak ditemukan: ${filePath}`);
  const { headers, data, n } = parseFile(filePath);
  if (n < 10) throw new Error(`Terlalu sedikit responden: ${n}. Minimum 10.`);

  const ext      = path.extname(filePath).toLowerCase();
  const filename = path.basename(filePath, ext);

  // 2. Create output directory: from_freePLS/{filename}/
  const outDir = path.join(OUT_BASE, filename);
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'charts'), { recursive: true });

  // 3. Auto-detect model if not provided
  let autoModel = null;
  if (!variabels || !variabels.length) {
    autoModel  = autoDetectModel(headers);
    variabels  = autoModel.constructs;
    jalurs     = autoModel.jalurs;
    targetIPMA = targetIPMA || autoModel.endogenous;
  }
  targetIPMA = targetIPMA || variabels[variabels.length-1].nama;

  // Assign numeric ids so engine's `vv.id == j.dari_variabel_id` lookup works correctly.
  // Without ids, `undefined == undefined` always returns the first construct.
  const nameToId = {};
  variabels = variabels.map((v, i) => { nameToId[v.nama] = i + 1; return { ...v, id: i + 1 }; });
  jalurs = jalurs.map(j => ({
    ...j,
    dari_variabel_id: nameToId[j.dari] ?? nameToId[j.from],
    ke_variabel_id:   nameToId[j.ke]   ?? nameToId[j.to],
  }));

  // Assign x, y coordinates and visual attributes for FreePLS canvas model editor
  applyCanvasLayout(variabels, jalurs);

  // 4. Run FreePLS engine
  const engine = new PLSEngine();
  engine.setData(data, variabels, jalurs);

  const allIndicators = variabels.flatMap(v => v.indikator);
  const descStats = {};
  const descArr = engine.calculateDescriptiveStats(data, allIndicators, { maxScale: options.maxScale||5 });
  // Engine returns {kolom, mean:string, stdDev:string, min:string, max:string, tcr:string, ...}
  descArr.forEach(d => {
    const key = d.kolom || d.column || d.variabel || d.indikator;
    if (key) descStats[key] = {
      mean:   parseFloat(d.mean)   || 0,
      sd:     parseFloat(d.stdDev) || 0,
      min:    parseFloat(d.min)    || 0,
      max:    parseFloat(d.max)    || 0,
      tcr:    parseFloat(d.tcr)    || 0,
      median: parseFloat(d.median) || 0,
      N:      d.N || 0,
    };
  });

  const plsResult = engine.runPLS(options);
  const bootstrapRaw = engine.runBootstrap({ ...options, jumlah: options.jumlahBootstrap||500 });
  const ipma      = engine.calculateIPMA(targetIPMA);
  const harman    = engine.harmanSingleFactor();
  let   plsc      = null;
  try { plsc = engine.runPLSc(options); } catch(_) {}
  let   apa       = null;
  try { apa  = engine.formatAPA(options); } catch(_) {}

  // Flatten nested outerLoadings {TC:{TC1:0.85}} → {TC1:0.85}
  const outerLoadings = {};
  for (const [, items] of Object.entries(plsResult.outerLoadings || {})) {
    if (typeof items === 'object' && items !== null)
      for (const [ind, val] of Object.entries(items)) outerLoadings[ind] = val;
  }

  // Build constructStats from reliability + rSquared (engine doesn't have constructStats)
  const endoSet = new Set(jalurs.map(j => j.ke || j.to).filter(Boolean));
  const constructStats = {};
  for (const [name, rel] of Object.entries(plsResult.reliability || {})) {
    constructStats[name] = {
      alpha: rel.cronbachAlpha,
      cr:    rel.compositeReliability,
      ave:   rel.ave,
      rhoA:  rel.rhoA,
    };
    if (endoSet.has(name) && plsResult.rSquared?.[name] !== undefined) {
      constructStats[name].r2    = plsResult.rSquared[name];
      constructStats[name].r2adj = plsResult.rSquaredAdj?.[name] ?? plsResult.rSquared[name];
    }
  }

  // Add f² (effect sizes) per endogenous construct
  for (const [key, val] of Object.entries(plsResult.effectSizes || {})) {
    // key like "TC → PU" — add to PU's f2
    const arrow = key.indexOf(' → ');
    if (arrow === -1) continue;
    const pred = key.slice(0, arrow);
    const endo = key.slice(arrow + 3);
    if (constructStats[endo]) {
      constructStats[endo].f2 = constructStats[endo].f2 || {};
      constructStats[endo].f2[pred] = val;
    }
  }

  // Flatten htmt matrix {TC:{PU:0.86}} → {'TC-PU': 0.86}
  const htmt = {};
  const cNames = variabels.map(v => v.nama);
  for (let i = 0; i < cNames.length; i++) {
    for (let j2 = i + 1; j2 < cNames.length; j2++) {
      const vi = cNames[i], vj = cNames[j2];
      const val = plsResult.htmt?.[vi]?.[vj] ?? plsResult.htmt?.[vj]?.[vi];
      if (val !== undefined && val !== 1) htmt[`${vi}-${vj}`] = val;
    }
  }

  // Filter pathCoefs to only declared jalurs, excluding self-paths
  const declaredPaths = new Set(jalurs.map(j => `${j.dari||j.from} → ${j.ke||j.to}`));
  const pathCoefs = {};
  for (const [key, val] of Object.entries(plsResult.pathCoefficients || {})) {
    if (declaredPaths.has(key)) pathCoefs[key] = val;
  }

  // Normalize bootstrap: filter to declared paths + fix field names
  const bootPaths = {};
  for (const [key, b] of Object.entries(bootstrapRaw?.pathResults || {})) {
    if (!declaredPaths.has(key)) continue;
    bootPaths[key] = {
      mean:        b.bootMean   ?? b.mean   ?? 0,
      se:          b.bootStd    ?? b.se     ?? 0,
      t:           b.tStatistic ?? b.t      ?? 0,
      p:           b.pValue     ?? b.p      ?? 1,
      ci_lo:       b.ciLower    ?? b.ci_lo  ?? 0,
      ci_hi:       b.ciUpper    ?? b.ci_hi  ?? 0,
      significant: b.signifikan ?? b.significant ?? false,
    };
  }

  const normalizedPLS = { constructStats, outerLoadings, pathCoefs, htmt, srmr: plsResult.modelFit?.srmr ?? 0 };

  // 5. Build raw results bundle
  const rawResults = {
    filename, n, headers,
    variabels, jalurs, targetIPMA,
    descStats,
    cmv:     harman,
    pls: normalizedPLS,
    boot:    bootPaths,
    ipmaRes: Array.isArray(ipma) ? ipma : (ipma?.results || []),
    plsc,
    apa,
    autoDetected: autoModel ? {
      endogenous: autoModel.endogenous,
      mediators:  autoModel.mediators,
      exogenous:  autoModel.exogenous,
    } : null,
  };

  fs.writeFileSync(path.join(outDir,'results_raw.json'), JSON.stringify(rawResults, null, 2));

  // 6. Generate visuals (HTML + SVG charts)
  try {
    const visualsPath = path.join(__dirname, 'generate-visuals.js');
    delete require.cache[require.resolve(visualsPath)];
    const generateVisuals = require(visualsPath);
    generateVisuals(rawResults, outDir);
  } catch(e) {
    console.warn('[FreePLS] Visual generation warning:', e.message);
  }

  // 7. Markdown + CSV tables
  generateMarkdown({ filename, n, variabels, plsResult: normalizedPLS, bootstrap:{ pathResults: bootPaths }, harman, ipma: rawResults.ipmaRes, descStats }, outDir);
  generateCSVTables({ variabels, plsResult: normalizedPLS, bootstrap:{ pathResults: bootPaths } }, outDir);

  // 8. Save to FreePLS DB if db connection provided
  let proyekId = null;
  if (db) proyekId = saveToDatabase(db, filename, variabels, jalurs, data, plsResult, bootstrapRaw, dbPath);

  // 9. Return summary
  return {
    success:    true,
    filename,
    outputDir:  outDir,
    proyekId,
    autoDetected: rawResults.autoDetected,
    files: [
      'report.html',
      'laporan.md',
      'results_raw.json',
      'charts/chart_path_model.svg',
      'charts/chart_outer_loadings.svg',
      'charts/chart_path_coefficients.svg',
      'charts/chart_r2.svg',
      'charts/chart_ave.svg',
      'charts/chart_alpha.svg',
      'charts/chart_f2.svg',
      'charts/chart_ipma.svg',
      'charts/chart_htmt.svg',
      'tabel_1_outer_loadings.csv',
      'tabel_2_reliability.csv',
      'tabel_3_htmt.csv',
      'tabel_4_path_coefficients.csv',
    ],
    summary: {
      n,
      constructs:       variabels.length,
      indicators:       allIndicators.length,
      totalPaths:       Object.keys(bootPaths).length,
      significantPaths: Object.values(bootPaths).filter(b=>b?.significant).length,
      r2: Object.fromEntries(
        Object.entries(constructStats)
          .filter(([,cs])=>cs.r2!==undefined)
          .map(([name,cs])=>[name, cs.r2])
      ),
    },
  };
}

module.exports = { analyzeFile, parseFile, autoDetectModel };

