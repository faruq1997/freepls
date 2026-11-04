#!/usr/bin/env node
/**
 * FreePLS Indonesia – MCP Server
 *
 * Transport: stdio — works with Claude Desktop, Cursor, Windsurf, AGY, etc.
 *
 * Tools:
 *  - pls_run_analysis          Run full PLS-SEM on inline data
 *  - pls_run_bootstrap         Bootstrap resampling (t-stats, CI)
 *  - pls_descriptive_stats     Descriptive statistics
 *  - pls_moderation            Moderation / interaction analysis
 *  - pls_run_from_project      Load saved project from DB and run analysis
 *  - pls_interpret_results     Human-readable interpretation of PLS results
 *  - pls_list_projects         List saved projects
 *  - pls_get_project           Get model & datasets of a project
 *  - pls_get_results           Get saved analysis results
 *
 * Resources:
 *  - freepls://projects         All saved projects (index)
 *  - freepls://project/{id}     Single project detail
 */

'use strict';

const readline = require('readline');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ── Helper Resolusi Path (Mendukung Dev dan Packaged App/Release) ───────────
function getAppPath(...segments) {
  const dev = path.join(__dirname, '..', ...segments);
  if (fs.existsSync(dev)) return dev;
  const unpacked = path.join(__dirname, '..', 'app.asar.unpacked', ...segments);
  if (fs.existsSync(unpacked)) return unpacked;
  return dev;
}

// ── Engine ────────────────────────────────────────────────────────────────────
const { PLSEngine } = require(getAppPath('src', 'pls-engine.js'));
const { analyzeFile } = require(path.join(__dirname, 'analyze-runner.js'));

// ── Database (sql.js) ─────────────────────────────────────────────────────────
let db = null;
let SQL = null;

function getAppUserData() {
  const appName = 'freepls-indonesia';
  switch (process.platform) {
    case 'win32':  return path.join(os.homedir(), 'AppData', 'Roaming', appName);
    case 'darwin': return path.join(os.homedir(), 'Library', 'Application Support', appName);
    default:       return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), appName);
  }
}

async function openDb() {
  if (db) return db;
  const initSqlJs = require(getAppPath('node_modules', 'sql.js'));
  SQL = await initSqlJs();
  const dbFile = path.join(getAppUserData(), 'freepls.db');
  db = fs.existsSync(dbFile)
    ? new SQL.Database(fs.readFileSync(dbFile))
    : new SQL.Database();
  return db;
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// ── MCP protocol helpers ──────────────────────────────────────────────────────
const JSONRPC = '2.0';
function send(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }
function ok(id, result) { send({ jsonrpc: JSONRPC, id, result }); }
function err(id, code, message) { send({ jsonrpc: JSONRPC, id, error: { code, message } }); }

// ── Interpreter ───────────────────────────────────────────────────────────────
function interpretResults(hasil, bootstrap = null) {
  const lines = [];
  const ok  = (msg) => `  ✅ ${msg}`;
  const warn = (msg) => `  ⚠️  ${msg}`;
  const bad  = (msg) => `  ❌ ${msg}`;
  const val  = (n, d = 3) => (typeof n === 'number' ? n.toFixed(d) : '–');

  lines.push('# Interpretasi Hasil PLS-SEM (FreePLS Indonesia)\n');

  // ── Outer Model ──────────────────────────────────────────────────────────
  lines.push('## 1. Outer Model (Model Pengukuran)\n');

  // Outer loadings
  lines.push('### Outer Loadings');
  const { outerLoadings = {}, reliability = {}, htmt = {} } = hasil;
  let loadingIssues = 0;
  for (const [varName, inds] of Object.entries(outerLoadings)) {
    for (const [ind, loading] of Object.entries(inds)) {
      const l = Number(loading);
      if (l >= 0.7) lines.push(ok(`${varName} → ${ind}: ${val(l)} (≥ 0.70 ✓)`));
      else if (l >= 0.5) { lines.push(warn(`${varName} → ${ind}: ${val(l)} (0.50–0.69, perlu dipertimbangkan)`)); loadingIssues++; }
      else { lines.push(bad(`${varName} → ${ind}: ${val(l)} (< 0.50, indikator lemah)`)); loadingIssues++; }
    }
  }

  // AVE & CR
  lines.push('\n### Reliabilitas & Validitas Konvergen (AVE, CR)');
  let reliabilityIssues = 0;
  for (const [varName, rel] of Object.entries(reliability)) {
    const ave = Number(rel.ave ?? rel.AVE ?? 0);
    const cr  = Number(rel.cr  ?? rel.CR  ?? rel.compositeReliability ?? 0);
    const ca  = Number(rel.cronbachAlpha ?? rel.alpha ?? 0);

    const aveOk = ave >= 0.5;
    const crOk  = cr  >= 0.7;
    const caOk  = ca  >= 0.7;

    lines.push(`\n**${varName}**`);
    lines.push(aveOk ? ok(`AVE = ${val(ave)} (≥ 0.50 ✓)`) : bad(`AVE = ${val(ave)} (< 0.50 – validitas konvergen tidak terpenuhi)`));
    lines.push(crOk  ? ok(`CR  = ${val(cr)}  (≥ 0.70 ✓)`) : bad(`CR  = ${val(cr)}  (< 0.70)`));
    if (ca > 0) lines.push(caOk ? ok(`Cronbach α = ${val(ca)} (≥ 0.70 ✓)`) : warn(`Cronbach α = ${val(ca)} (< 0.70)`));
    if (!aveOk || !crOk) reliabilityIssues++;
  }

  // HTMT
  lines.push('\n### Validitas Diskriminan (HTMT < 0.85)');
  let htmtIssues = 0;
  const varNames = Object.keys(htmt);
  for (let i = 0; i < varNames.length; i++) {
    for (let j = i + 1; j < varNames.length; j++) {
      const v1 = varNames[i], v2 = varNames[j];
      const h = Number(htmt[v1]?.[v2] ?? htmt[v2]?.[v1] ?? 0);
      if (h < 0.85)      lines.push(ok(`HTMT(${v1}, ${v2}) = ${val(h)} (< 0.85 ✓)`));
      else if (h < 0.90) { lines.push(warn(`HTMT(${v1}, ${v2}) = ${val(h)} (0.85–0.90, batas toleransi)`)); htmtIssues++; }
      else               { lines.push(bad(`HTMT(${v1}, ${v2}) = ${val(h)} (≥ 0.90 – validitas diskriminan bermasalah)`)); htmtIssues++; }
    }
  }
  if (varNames.length < 2) lines.push('  (Kurang dari 2 variabel – HTMT tidak relevan)');

  // ── Inner Model ──────────────────────────────────────────────────────────
  lines.push('\n## 2. Inner Model (Model Struktural)\n');

  // R²
  lines.push('### Koefisien Determinasi (R²)');
  for (const [varName, r2] of Object.entries(hasil.rSquared || {})) {
    const r = Number(r2);
    if (r >= 0.75)      lines.push(ok(`R²(${varName}) = ${val(r)} – Substansial`));
    else if (r >= 0.50) lines.push(ok(`R²(${varName}) = ${val(r)} – Moderat`));
    else if (r >= 0.25) lines.push(warn(`R²(${varName}) = ${val(r)} – Lemah`));
    else                lines.push(bad(`R²(${varName}) = ${val(r)} – Sangat Lemah (< 0.25)`));
  }

  // Path coefficients (+ bootstrap jika ada)
  lines.push('\n### Koefisien Jalur (Path Coefficients)');
  for (const [path_, beta] of Object.entries(hasil.pathCoefficients || {})) {
    const b = Number(beta);
    let line = `  ${path_}: β = ${val(b)}`;
    if (bootstrap) {
      const bPath = bootstrap.paths?.[path_] ?? bootstrap.pathResults?.[path_];
      if (bPath) {
        const t = Number(bPath.tStatistic ?? bPath.tStat ?? 0);
        const p = Number(bPath.pValue ?? bPath.p ?? 1);
        const sig = p < 0.05;
        line += `, t = ${val(t, 2)}, p = ${val(p, 3)}`;
        line = sig ? ok(line + ' – Signifikan (p < 0.05)') : warn(line + ' – Tidak Signifikan');
      }
    } else {
      line = Math.abs(b) >= 0.1 ? ok(line) : warn(line + ' (efek kecil)');
    }
    lines.push(line);
  }
  if (!bootstrap) lines.push('\n  ℹ️  Jalankan pls_run_bootstrap untuk mendapatkan t-statistik dan p-value.');

  // Model fit
  lines.push('\n### Kelayakan Model (Model Fit)');
  const fit = hasil.modelFit || {};
  const srmr = Number(fit.srmr ?? 0);
  const nfi  = Number(fit.nfi  ?? 0);
  lines.push(srmr <= 0.08 ? ok(`SRMR = ${val(srmr)} (≤ 0.08 ✓)`) : warn(`SRMR = ${val(srmr)} (> 0.08 – model fit marjinal)`));
  lines.push(nfi  >= 0.90 ? ok(`NFI  = ${val(nfi)}  (≥ 0.90 ✓)`) : warn(`NFI  = ${val(nfi)}  (< 0.90)`));

  // VIF inner
  lines.push('\n### Kolinearitas Inner Model (VIF < 5)');
  let vifIssues = 0;
  for (const [target, preds] of Object.entries(hasil.vif?.innerVIF || {})) {
    for (const [pred, vifVal] of Object.entries(preds)) {
      const v = Number(vifVal);
      if (v < 3.3)     lines.push(ok(`VIF(${pred} → ${target}) = ${val(v, 2)}`));
      else if (v < 5)  lines.push(warn(`VIF(${pred} → ${target}) = ${val(v, 2)} (3.3–5, perhatikan)`));
      else             { lines.push(bad(`VIF(${pred} → ${target}) = ${val(v, 2)} (≥ 5 – multikolinearitas)`)); vifIssues++; }
    }
  }

  // ── Kesimpulan ────────────────────────────────────────────────────────────
  lines.push('\n## 3. Kesimpulan\n');
  const totalIssues = loadingIssues + reliabilityIssues + htmtIssues + vifIssues;
  if (totalIssues === 0) {
    lines.push('✅ **Model memenuhi semua kriteria validitas dan reliabilitas yang dipersyaratkan.**');
    lines.push('   Outer model valid (AVE ≥ 0.50, CR ≥ 0.70, HTMT < 0.85) dan inner model layak dianalisis.');
  } else {
    lines.push(`⚠️  **Ditemukan ${totalIssues} isu yang perlu ditangani sebelum interpretasi final:**`);
    if (loadingIssues)    lines.push(`   - ${loadingIssues} indikator dengan outer loading < 0.70`);
    if (reliabilityIssues) lines.push(`   - ${reliabilityIssues} variabel dengan AVE atau CR di bawah ambang batas`);
    if (htmtIssues)       lines.push(`   - ${htmtIssues} pasang variabel dengan HTMT ≥ 0.85`);
    if (vifIssues)        lines.push(`   - ${vifIssues} prediktor dengan VIF ≥ 5`);
  }

  lines.push(`\n---\n_Dihasilkan oleh FreePLS Indonesia MCP Server — n = ${hasil.sampleSize ?? '?'}, iterasi = ${hasil.iterations ?? '?'}, konvergen: ${hasil.converged ? 'Ya' : 'Tidak'}_`);

  return lines.join('\n');
}

// ── Tool definitions ──────────────────────────────────────────────────────────
const LATENT_VAR_SCHEMA = {
  type: 'object',
  required: ['nama', 'indikator', 'tipe'],
  properties: {
    nama:      { type: 'string', description: 'Latent variable name' },
    indikator: { type: 'array', items: { type: 'string' }, description: 'Indicator column names' },
    tipe:      { type: 'string', enum: ['reflektif', 'formatif'] },
  },
};

const JALUR_SCHEMA = {
  type: 'object',
  required: ['dari', 'ke'],
  properties: {
    dari: { type: 'string', description: 'Source latent variable name' },
    ke:   { type: 'string', description: 'Target latent variable name' },
  },
};

const TOOLS = [
  {
    name: 'pls_run_analysis',
    description: 'Run a full PLS-SEM analysis. Returns outer loadings, path coefficients, R², AVE, composite reliability, HTMT, VIF, model fit (SRMR/NFI), and indirect/total effects.',
    inputSchema: {
      type: 'object',
      required: ['data', 'variabels', 'jalurs'],
      properties: {
        data:      { type: 'array', items: { type: 'object' }, description: 'Array of row objects. Keys are indicator column names.' },
        variabels: { type: 'array', items: LATENT_VAR_SCHEMA, description: 'Latent variable definitions.' },
        jalurs:    { type: 'array', items: JALUR_SCHEMA, description: 'Structural paths.' },
        options:   { type: 'object', properties: { maxIterasi: { type: 'integer', default: 300 }, toleransi: { type: 'number', default: 0.00001 } } },
      },
    },
  },
  {
    name: 'pls_run_bootstrap',
    description: 'Run bootstrap resampling. Returns t-statistics, p-values, and 95% confidence intervals for path coefficients and outer loadings.',
    inputSchema: {
      type: 'object',
      required: ['data', 'variabels', 'jalurs'],
      properties: {
        data:      { type: 'array', items: { type: 'object' } },
        variabels: { type: 'array', items: LATENT_VAR_SCHEMA },
        jalurs:    { type: 'array', items: JALUR_SCHEMA },
        options:   { type: 'object', properties: { jumlahBootstrap: { type: 'integer', default: 500, description: 'Number of bootstrap subsamples (engine default: 5000)' }, maxIterasi: { type: 'integer', default: 300 } } },
      },
    },
  },
  {
    name: 'pls_descriptive_stats',
    description: 'Calculate descriptive statistics (mean, median, std dev, min, max, skewness, kurtosis, normality) for a dataset.',
    inputSchema: {
      type: 'object',
      required: ['data', 'columns'],
      properties: {
        data:    { type: 'array', items: { type: 'object' } },
        columns: { type: 'array', items: { type: 'string' }, description: 'Column names to analyse' },
        options: { type: 'object', properties: { includeOutliers: { type: 'boolean', default: false } } },
      },
    },
  },
  {
    name: 'pls_moderation',
    description: 'Run moderation (interaction) analysis. Tests whether a moderating variable significantly changes the IV → DV relationship.',
    inputSchema: {
      type: 'object',
      required: ['data', 'variabels', 'jalurs', 'ivName', 'modName', 'dvName'],
      properties: {
        data:      { type: 'array', items: { type: 'object' } },
        variabels: { type: 'array', items: LATENT_VAR_SCHEMA },
        jalurs:    { type: 'array', items: JALUR_SCHEMA },
        ivName:    { type: 'string', description: 'Independent variable (latent) name' },
        modName:   { type: 'string', description: 'Moderating variable (latent) name' },
        dvName:    { type: 'string', description: 'Dependent variable (latent) name' },
        options:   { type: 'object' },
      },
    },
  },
  {
    name: 'pls_run_from_project',
    description: 'Load a saved FreePLS project from the local database and run PLS-SEM in one step — no need to pass data or model manually. Optionally also runs bootstrap.',
    inputSchema: {
      type: 'object',
      required: ['proyek_id'],
      properties: {
        proyek_id:     { type: 'integer', description: 'Project ID (from pls_list_projects)' },
        dataset_id:    { type: 'integer', description: 'Dataset ID to use. Omits to use the first dataset in the project.' },
        run_bootstrap: { type: 'boolean', default: false, description: 'Also run bootstrap after PLS analysis.' },
        options: {
          type: 'object',
          properties: {
            jumlahBootstrap: { type: 'integer', default: 500 },
            maxIterasi:      { type: 'integer', default: 300 },
          },
        },
      },
    },
  },
  {
    name: 'pls_interpret_results',
    description: 'Generate a structured Indonesian-language interpretation of PLS-SEM results: outer model validity (loadings, AVE, CR, HTMT), inner model (R², path coefficients, SRMR, VIF), and overall conclusion. Pass the result object from pls_run_analysis or pls_run_from_project.',
    inputSchema: {
      type: 'object',
      required: ['hasil'],
      properties: {
        hasil:     { type: 'object', description: 'Full result object from pls_run_analysis or pls_run_from_project.' },
        bootstrap: { type: 'object', description: '(Optional) Bootstrap result from pls_run_bootstrap to include t-stats and p-values in path interpretation.' },
      },
    },
  },
  {
    name: 'pls_run_plsc',
    description: 'Consistent PLS (PLSc) — corrects attenuation bias in reflective constructs using Dijkstra-Henseler ρ_A. Returns corrected path coefficients, disattenuated correlations, and ρ_A per construct.',
    inputSchema: {
      type: 'object', required: ['data', 'variabels', 'jalurs'],
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        variabels: { type: 'array', items: LATENT_VAR_SCHEMA },
        jalurs:    { type: 'array', items: JALUR_SCHEMA },
        options:   { type: 'object', properties: { maxIterasi: { type: 'integer', default: 300 } } },
      },
    },
  },
  {
    name: 'pls_ipma',
    description: 'Importance-Performance Map Analysis. Returns importance (total effect) and performance (rescaled mean 0-100) of each predictor toward a target construct. Used to identify improvement priorities.',
    inputSchema: {
      type: 'object', required: ['data', 'variabels', 'jalurs', 'target'],
      properties: {
        data:      { type: 'array', items: { type: 'object' } },
        variabels: { type: 'array', items: LATENT_VAR_SCHEMA },
        jalurs:    { type: 'array', items: JALUR_SCHEMA },
        target:    { type: 'string', description: 'Name of the target (endogenous) latent variable' },
        options:   { type: 'object' },
      },
    },
  },
  {
    name: 'pls_mga',
    description: 'Multi-Group Analysis (Henseler parametric test) — compares path coefficients between two groups. Returns diff, t-statistic, p-value per path.',
    inputSchema: {
      type: 'object', required: ['data_group1', 'data_group2', 'variabels', 'jalurs'],
      properties: {
        data_group1: { type: 'array', items: { type: 'object' }, description: 'Row data for group 1' },
        data_group2: { type: 'array', items: { type: 'object' }, description: 'Row data for group 2' },
        variabels:   { type: 'array', items: LATENT_VAR_SCHEMA },
        jalurs:      { type: 'array', items: JALUR_SCHEMA },
        options:     { type: 'object', properties: { jumlahBootstrap: { type: 'integer', default: 500 } } },
      },
    },
  },
  {
    name: 'pls_predict',
    description: 'PLSpredict: k-fold cross-validation for out-of-sample predictive relevance. Returns RMSE, MAE, Q²_predict per endogenous construct (Hair et al. 2019).',
    inputSchema: {
      type: 'object', required: ['data', 'variabels', 'jalurs'],
      properties: {
        data:      { type: 'array', items: { type: 'object' } },
        variabels: { type: 'array', items: LATENT_VAR_SCHEMA },
        jalurs:    { type: 'array', items: JALUR_SCHEMA },
        options:   { type: 'object', properties: { kFolds: { type: 'integer', default: 10 } } },
      },
    },
  },
  {
    name: 'pls_harman_cmv',
    description: 'Harman Single Factor Test for Common Method Bias. If first factor variance > 50%, CMV may be a concern.',
    inputSchema: {
      type: 'object', required: ['data', 'variabels', 'jalurs'],
      properties: {
        data:      { type: 'array', items: { type: 'object' } },
        variabels: { type: 'array', items: LATENT_VAR_SCHEMA },
        jalurs:    { type: 'array', items: JALUR_SCHEMA },
      },
    },
  },
  {
    name: 'pls_export_apa',
    description: 'Generate APA 7 formatted tables: outer loadings, reliability & AVE, HTMT, path coefficients & R². Returns data arrays + CSV strings ready to paste into Word/Excel.',
    inputSchema: {
      type: 'object', required: ['data', 'variabels', 'jalurs'],
      properties: {
        data:      { type: 'array', items: { type: 'object' } },
        variabels: { type: 'array', items: LATENT_VAR_SCHEMA },
        jalurs:    { type: 'array', items: JALUR_SCHEMA },
        options:   { type: 'object' },
      },
    },
  },
  {
    name: 'pls_mardia_normality',
    description: 'Calculate Mardia multivariate skewness and kurtosis tests (Mardia, 1970). Generates p-values and academic justification text in Indonesian explaining why PLS-SEM was chosen over CB-SEM.',
    inputSchema: {
      type: 'object', required: ['data'],
      properties: {
        data:           { type: 'array', items: { type: 'object' } },
        variabels:      { type: 'array', items: LATENT_VAR_SCHEMA },
        indikator_list: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'pls_formative_assessment',
    description: 'Evaluate formative measurement model (Mode B): indicator VIF collinearity (< 3.3/5.0), outer weights, outer loadings, and Hair et al. (2021) indicator retention decision rules.',
    inputSchema: {
      type: 'object', required: ['data', 'variabels', 'jalurs'],
      properties: {
        data:        { type: 'array', items: { type: 'object' } },
        variabels:   { type: 'array', items: LATENT_VAR_SCHEMA },
        jalurs:      { type: 'array', items: JALUR_SCHEMA },
        target_var:  { type: 'string', description: 'Optional specific construct name to evaluate' },
      },
    },
  },
  {
    name: 'pls_hoc_analysis',
    description: 'Evaluate Higher-Order Constructs (HOC / HCM) using the Two-Stage Approach (Sarstedt et al., 2019). Stage 1 LOC reliabilities, Stage 2 HOC loadings/weights, AVE/CR, and structural path to target.',
    inputSchema: {
      type: 'object', required: ['data', 'variabels', 'jalurs', 'loc_names'],
      properties: {
        data:       { type: 'array', items: { type: 'object' } },
        variabels:  { type: 'array', items: LATENT_VAR_SCHEMA },
        jalurs:     { type: 'array', items: JALUR_SCHEMA },
        hoc_name:   { type: 'string', description: 'Name of the HOC' },
        hoc_type:   { type: 'string', enum: ['reflektif', 'formatif'], description: 'Type I (reflektif) or Type II (formatif)' },
        loc_names:  { type: 'array', items: { type: 'string' }, description: 'Names of lower-order constructs' },
        target_var: { type: 'string', description: 'Target endogenous variable (optional)' },
      },
    },
  },
  {
    name: 'pls_nca_analysis',
    description: 'Perform Necessary Condition Analysis (NCA; Dul, 2016). Estimates Ceiling Envelopment (CE-FDH) effect size d, CR-FDH line, and produces the Bottleneck Table.',
    inputSchema: {
      type: 'object', required: ['data', 'variabels', 'jalurs', 'x_var', 'y_var'],
      properties: {
        data:      { type: 'array', items: { type: 'object' } },
        variabels: { type: 'array', items: LATENT_VAR_SCHEMA },
        jalurs:    { type: 'array', items: JALUR_SCHEMA },
        x_var:     { type: 'string', description: 'Condition variable name (X)' },
        y_var:     { type: 'string', description: 'Outcome variable name (Y)' },
      },
    },
  },
  {
    name: 'pls_analyze_file',
    description: `Auto-analyze a CSV or Excel file end-to-end using the FreePLS engine.
Automatically:
  1. Parses the file (CSV/XLSX)
  2. Detects constructs from column names (e.g. TC1,TC2,TC3 → construct TC)
  3. Infers structural paths (TAM-style: exogenous→mediators→BI)
  4. Runs PLS-SEM + Bootstrap (500) + IPMA + Harman CMV via FreePLS engine
  5. Creates from_freePLS/{filename}/ folder with:
       report.html, laporan.md, results_raw.json,
       charts/*.svg (path model diagram + 8 analytic charts),
       tabel_1..4.csv
  6. Saves project to FreePLS database
Perfect for AI agents: send a file path, get back a full academic analysis.`,
    inputSchema: {
      type: 'object', required: ['file_path'],
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to CSV or Excel (.xlsx) file. Example: C:/Users/me/data.csv',
        },
        variabels: {
          type: 'array',
          description: 'Optional: construct definitions. If omitted, auto-detected from column names.',
          items: LATENT_VAR_SCHEMA,
        },
        jalurs: {
          type: 'array',
          description: 'Optional: structural paths. If omitted, auto-inferred.',
          items: JALUR_SCHEMA,
        },
        target_ipma: {
          type: 'string',
          description: 'Endogenous target for IPMA. Auto-detected if omitted (looks for BI, BU, USE, etc.).',
        },
        options: {
          type: 'object',
          properties: {
            jumlahBootstrap: { type: 'integer', default: 500, description: 'Bootstrap samples' },
            maxScale:        { type: 'integer', default: 5,   description: 'Max Likert scale value' },
          },
        },
      },
    },
  },
  {
    name: 'pls_full_pipeline',
    description: 'Full pipeline in one call: PLS-SEM + bootstrap + IPMA + Harman CMV + APA tables + interpretation. Best for agents that need a complete research report without multiple round-trips.',
    inputSchema: {
      type: 'object', required: ['data', 'variabels', 'jalurs', 'target_ipma'],
      properties: {
        data:        { type: 'array', items: { type: 'object' } },
        variabels:   { type: 'array', items: LATENT_VAR_SCHEMA },
        jalurs:      { type: 'array', items: JALUR_SCHEMA },
        target_ipma: { type: 'string', description: 'Target variable name for IPMA' },
        options: {
          type: 'object',
          properties: {
            jumlahBootstrap: { type: 'integer', default: 500 },
            kFolds:          { type: 'integer', default: 10 },
          },
        },
      },
    },
  },
  {
    name: 'pls_list_projects',
    description: 'List all saved projects from the FreePLS Indonesia database on this machine.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'pls_get_project',
    description: 'Get the full model definition and datasets for a saved project.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:           { type: 'integer', description: 'Project ID (from pls_list_projects)' },
        include_data: { type: 'boolean', default: false, description: 'Also return row data (can be large)' },
      },
    },
  },
  {
    name: 'pls_get_results',
    description: 'Get previously saved analysis results for a project.',
    inputSchema: {
      type: 'object',
      required: ['proyek_id'],
      properties: { proyek_id: { type: 'integer' } },
    },
  },
];

// ── Tool execution ─────────────────────────────────────────────────────────────
async function callTool(name, args) {
  const engine = new PLSEngine();

  switch (name) {
    case 'pls_run_analysis': {
      const { data, variabels, jalurs, options = {} } = args;
      engine.setData(data, variabels, jalurs);
      return engine.runPLS(options);
    }

    case 'pls_run_bootstrap': {
      const { data, variabels, jalurs, options = {} } = args;
      engine.setData(data, variabels, jalurs);
      return engine.runBootstrap(options);
    }

    case 'pls_descriptive_stats': {
      const { data, columns, options = {} } = args;
      engine.setData(data, [], []);
      return engine.calculateDescriptiveStats(data, columns, options);
    }

    case 'pls_moderation': {
      const { data, variabels, jalurs, ivName, modName, dvName, options = {} } = args;
      engine.setData(data, variabels, jalurs);
      return engine.calculateModerationAnalysis(ivName, modName, dvName, options);
    }

    case 'pls_run_from_project': {
      await openDb();
      const { proyek_id, dataset_id, run_bootstrap = false, options = {} } = args;

      const project = dbAll('SELECT * FROM proyek WHERE id = ?', [proyek_id])[0];
      if (!project) throw new Error(`Proyek ${proyek_id} tidak ditemukan.`);

      const model = project.model_data ? JSON.parse(project.model_data) : null;
      if (!model?.variabels?.length) throw new Error('Proyek tidak memiliki model (variabel/jalur). Buka di aplikasi dan simpan model terlebih dahulu.');

      const datasetRow = dataset_id
        ? dbAll('SELECT * FROM dataset WHERE id = ? AND proyek_id = ?', [dataset_id, proyek_id])[0]
        : dbAll('SELECT * FROM dataset WHERE proyek_id = ? LIMIT 1', [proyek_id])[0];
      if (!datasetRow) throw new Error('Dataset tidak ditemukan untuk proyek ini.');

      const data = JSON.parse(datasetRow.data || '[]');
      if (!data.length) throw new Error('Dataset kosong.');

      engine.setData(data, model.variabels, model.jalurs);
      const hasil = engine.runPLS(options);

      const out = {
        proyek: { id: project.id, nama: project.nama },
        dataset: { id: datasetRow.id, nama: datasetRow.nama, jumlah_baris: datasetRow.jumlah_baris },
        hasil,
      };

      if (run_bootstrap) {
        out.bootstrap = engine.runBootstrap(options);
      }

      return out;
    }

    case 'pls_interpret_results': {
      const { hasil, bootstrap } = args;
      if (!hasil) throw new Error('Parameter "hasil" wajib diisi.');
      return { interpretasi: interpretResults(hasil, bootstrap) };
    }

    case 'pls_list_projects': {
      await openDb();
      return dbAll('SELECT id, nama, deskripsi, tanggal_dibuat, tanggal_diubah FROM proyek ORDER BY tanggal_diubah DESC');
    }

    case 'pls_get_project': {
      await openDb();
      const { id, include_data = false } = args;
      const project = dbAll('SELECT * FROM proyek WHERE id = ?', [id])[0];
      if (!project) throw new Error(`Project ${id} not found`);
      project.model_data = project.model_data ? JSON.parse(project.model_data) : null;

      const sql = include_data
        ? 'SELECT * FROM dataset WHERE proyek_id = ?'
        : 'SELECT id, proyek_id, nama, kolom, jumlah_baris, jumlah_kolom, tanggal_impor FROM dataset WHERE proyek_id = ?';
      const datasets = dbAll(sql, [id]).map((d) => {
        d.kolom = d.kolom ? JSON.parse(d.kolom) : [];
        if (d.data) d.data = JSON.parse(d.data);
        return d;
      });
      return { project, datasets };
    }

    case 'pls_get_results': {
      await openDb();
      const rows = dbAll('SELECT * FROM hasil_analisis WHERE proyek_id = ? ORDER BY tanggal_analisis DESC', [args.proyek_id]);
      return rows.map((r) => ({ ...r, data_hasil: JSON.parse(r.data_hasil || '{}') }));
    }

    case 'pls_run_plsc': {
      const { data, variabels, jalurs, options = {} } = args;
      engine.setData(data, variabels, jalurs);
      return engine.runPLSc(options);
    }

    case 'pls_ipma': {
      const { data, variabels, jalurs, target, options = {} } = args;
      engine.setData(data, variabels, jalurs);
      engine.runPLS(options);
      return engine.calculateIPMA(target);
    }

    case 'pls_mga': {
      const { data_group1, data_group2, variabels, jalurs, options = {} } = args;
      engine.setData([], variabels, jalurs);
      return engine.runMGA(data_group1, data_group2, options);
    }

    case 'pls_predict': {
      const { data, variabels, jalurs, options = {} } = args;
      engine.setData(data, variabels, jalurs);
      return engine.runPLSpredict(options);
    }

    case 'pls_harman_cmv': {
      const { data, variabels, jalurs } = args;
      engine.setData(data, variabels, jalurs);
      return engine.harmanSingleFactor();
    }

    case 'pls_export_apa': {
      const { data, variabels, jalurs, options = {} } = args;
      engine.setData(data, variabels, jalurs);
      engine.runPLS(options);
      return engine.formatAPA(options);
    }

    case 'pls_mardia_normality': {
      const { data, variabels = [], indikator_list = null } = args;
      engine.setData(data, variabels, []);
      return engine.calculateMardiaNormality(indikator_list);
    }

    case 'pls_formative_assessment': {
      const { data, variabels, jalurs, target_var = null } = args;
      engine.setData(data, variabels, jalurs);
      engine.runPLS();
      return engine.evaluateFormativeModel(target_var);
    }

    case 'pls_hoc_analysis': {
      const { data, variabels, jalurs, hoc_name = 'HOC', hoc_type = 'reflektif', loc_names = [], target_var = null } = args;
      engine.setData(data, variabels, jalurs);
      engine.runPLS();
      return engine.runHOC({ hocName: hoc_name, hocType: hoc_type, locNames: loc_names, targetVar: target_var });
    }

    case 'pls_nca_analysis': {
      const { data, variabels, jalurs, x_var, y_var, options = {} } = args;
      engine.setData(data, variabels, jalurs);
      engine.runPLS();
      return engine.runNCA(x_var, y_var, options);
    }

    case 'pls_analyze_file': {
      await openDb();
      const dbPath = path.join(getAppUserData(), 'freepls.db');
      const { file_path, variabels: vars, jalurs: jlrs, target_ipma, options={} } = args;
      return await analyzeFile({
        filePath:   file_path,
        variabels:  vars,
        jalurs:     jlrs,
        targetIPMA: target_ipma,
        options,
        db,
        dbPath,
      });
    }

    case 'pls_full_report': {
      const { data, variabels, jalurs, target_ipma, output_dir, options = {} } = args;
      engine.setData(data, variabels, jalurs);
      const hasil      = engine.runPLS(options);
      const bootstrap  = engine.runBootstrap(options);
      const ipma       = engine.calculateIPMA(target_ipma);
      const harman     = engine.harmanSingleFactor();
      const apa        = engine.formatAPA(options);
      const result = { hasil, bootstrap, ipma, harman, apa, interpretasi: interpretResults(hasil, bootstrap) };

      // Auto-generate HTML report + SVG charts if output_dir specified
      if (output_dir) {
        try {
          const fs   = require('fs');
          const path = require('path');
          if (!fs.existsSync(output_dir)) fs.mkdirSync(output_dir, { recursive: true });
          const rawPath = path.join(output_dir, 'results_raw.json');
          // Write a minimal results_raw.json compatible with generate-visuals
          const rawData = {
            n: data.length,
            headers: variabels.flatMap(v => v.indikator || v.items || []),
            descStats: {},
            cmv: harman,
            pls: { constructStats: hasil.constructStats || {}, outerLoadings: hasil.outerLoadings || {},
                   pathCoefs: hasil.pathCoefficients || {}, htmt: hasil.htmt || {}, srmr: hasil.srmr || 0 },
            boot: bootstrap.pathResults || {},
            predict: { target: target_ipma, q2predict: 0, rmseModel: 0, rmseNaive: 0, interpretation: 'N/A', predictiveRelevance: 'N/A' },
            ipmaRes: ipma || [],
          };
          fs.writeFileSync(rawPath, JSON.stringify(rawData, null, 2));
          // Copy generate-visuals.js from from_freePLS if exists, else skip
          const visualsSrc = path.join(path.dirname(__dirname), 'from_freePLS', 'generate-visuals.js');
          if (fs.existsSync(visualsSrc)) {
            const origDir = process.cwd();
            process.chdir(output_dir);
            try { require(visualsSrc); } catch(e) {}
            process.chdir(origDir);
          }
          result.output_dir = output_dir;
          result.files = ['results_raw.json', 'report.html', 'charts/'];
        } catch(e) { result.visual_error = e.message; }
      }

      return result;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Resource helpers ───────────────────────────────────────────────────────────
async function listResources() {
  await openDb();
  const projects = dbAll('SELECT id, nama, deskripsi, tanggal_diubah FROM proyek ORDER BY tanggal_diubah DESC');
  return [
    {
      uri: 'freepls://projects',
      name: 'Daftar Proyek FreePLS',
      description: `${projects.length} proyek tersimpan di database lokal`,
      mimeType: 'application/json',
    },
    ...projects.map((p) => ({
      uri: `freepls://project/${p.id}`,
      name: p.nama,
      description: p.deskripsi || `Proyek FreePLS ID ${p.id}`,
      mimeType: 'application/json',
    })),
  ];
}

async function readResource(uri) {
  await openDb();

  if (uri === 'freepls://projects') {
    const projects = dbAll('SELECT id, nama, deskripsi, tanggal_dibuat, tanggal_diubah FROM proyek ORDER BY tanggal_diubah DESC');
    return JSON.stringify(projects, null, 2);
  }

  const match = uri.match(/^freepls:\/\/project\/(\d+)$/);
  if (!match) throw new Error(`Unknown resource URI: ${uri}`);

  const id = parseInt(match[1], 10);
  const project = dbAll('SELECT * FROM proyek WHERE id = ?', [id])[0];
  if (!project) throw new Error(`Proyek ${id} tidak ditemukan.`);
  project.model_data = project.model_data ? JSON.parse(project.model_data) : null;

  const datasets = dbAll(
    'SELECT id, nama, kolom, jumlah_baris, jumlah_kolom, tanggal_impor FROM dataset WHERE proyek_id = ?',
    [id]
  ).map((d) => ({ ...d, kolom: JSON.parse(d.kolom || '[]') }));

  return JSON.stringify({ project, datasets }, null, 2);
}

// ── MCP request router ─────────────────────────────────────────────────────────
async function handleRequest(req) {
  const { id, method, params } = req;

  try {
    switch (method) {
      case 'initialize':
        ok(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: 'freepls-indonesia', version: '1.2.0' },
        });
        break;

      case 'tools/list':
        ok(id, { tools: TOOLS });
        break;

      case 'tools/call': {
        const { name, arguments: toolArgs } = params;
        const result = await callTool(name, toolArgs || {});
        ok(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
        break;
      }

      case 'resources/list':
        ok(id, { resources: await listResources() });
        break;

      case 'resources/read': {
        const text = await readResource(params.uri);
        ok(id, { contents: [{ uri: params.uri, mimeType: 'application/json', text }] });
        break;
      }

      case 'notifications/initialized':
        break;

      default:
        err(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    err(id, -32603, e.message);
  }
}

// ── Stdin/stdout transport ─────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let req;
  try {
    req = JSON.parse(trimmed);
  } catch {
    err(null, -32700, 'Parse error');
    return;
  }
  handleRequest(req);
});

rl.on('close', () => process.exit(0));

process.stderr.write('[FreePLS MCP] Server started\n');
