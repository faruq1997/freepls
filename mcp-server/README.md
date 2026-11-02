# FreePLS Indonesia – MCP Server

MCP server yang mengekspos kemampuan PLS-SEM FreePLS ke AI agent seperti **Claude CLI**, **Cursor**, **Windsurf**, **Antigravity**, dan host MCP lainnya.

## Instalasi

```bash
# Di root folder FreePLS Indonesia
npm install          # jika belum

# Masuk ke folder mcp-server
cd mcp-server
npm install          # install sql.js untuk MCP server
```

## Konfigurasi di AI Agent / IDE

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "freepls": {
      "command": "node",
      "args": ["<PATH_TO_FREEPLS>/mcp-server/index.js"]
    }
  }
}
```

### Antigravity / AGY (`~/.gemini/config/mcp.json`)

```json
{
  "servers": {
    "freepls": {
      "command": "node",
      "args": ["<PATH_TO_FREEPLS>/mcp-server/index.js"]
    }
  }
}
```

### Cursor / Windsurf (`.cursor/mcp.json` atau `.windsurf/mcp.json` di workspace)

```json
{
  "mcpServers": {
    "freepls": {
      "command": "node",
      "args": ["<PATH_TO_FREEPLS>/mcp-server/index.js"]
    }
  }
}
```

### VS Code (ekstensi Cline/Continue, `settings.json`)

```json
{
  "cline.mcpServers": {
    "freepls": {
      "command": "node",
      "args": ["<PATH_TO_FREEPLS>/mcp-server/index.js"]
    }
  }
}
```

---

## Tools yang Tersedia

| Tool | Deskripsi |
|------|-----------|
| `pls_analyze_file` | Pipeline otomatis end-to-end: baca CSV/Excel, deteksi model, hitung PLS-SEM + Bootstrap + IPMA + CMV, simpan ke FreePLS DB, hasilkan report HTML & chart SVG |
| `pls_full_pipeline` | Pipeline analitis komprehensif lengkap dalam satu panggilan |
| `pls_run_analysis` | Jalankan PLS-SEM penuh (outer loadings, path coefficient, R², AVE, CR, HTMT, VIF, SRMR/NFI, efek tidak langsung) |
| `pls_run_bootstrap` | Bootstrap resampling → t-statistik, p-value, confidence interval |
| `pls_run_plsc` | Consistent PLS (PLSc) untuk konstruk reflektif murni |
| `pls_ipma` | Importance-Performance Matrix Analysis (IPMA) |
| `pls_mga` | Multi-Group Analysis (MGA Henseler / Permutasi) |
| `pls_predict` | Evaluasi daya prediksi model (PLSpredict, $Q^2_\text{predict}$) |
| `pls_harman_cmv` | Uji Common Method Bias (Harman Single Factor Test) |
| `pls_export_apa` | Ekspor tabel format APA 7th Edition (Word/Excel ready) |
| `pls_descriptive_stats` | Statistik deskriptif (mean, median, SD, skewness, kurtosis, normalitas) |
| `pls_moderation` | Analisis moderasi / efek interaksi dua tahap |
| `pls_interpret_results` | Interpretasi naratif akademik hasil PLS-SEM otomatis |
| `pls_list_projects` | Daftar proyek tersimpan di database FreePLS lokal |
| `pls_get_project` | Detail model & dataset proyek tersimpan |
| `pls_get_results` | Hasil analisis tersimpan untuk suatu proyek |

---

## ⚖️ Disclaimer Etis & Hukum (Legal & Ethical Disclaimer)

1. **Independensi Perangkat Lunak**: **FreePLS Indonesia** adalah proyek independen dan sumber terbuka (*open-source*) yang didedikasikan untuk kemajuan sains terbuka (*Open Science*) dan edukasi.
2. **Bukan Afiliasi**: Proyek ini **TIDAK berafiliasi, tidak disponsori, dan tidak didukung oleh SmartPLS GmbH** atau pemegang merek komersial lainnya.
3. **Implementasi Mandiri**: Seluruh perhitungan statistika dibangun secara independen (*clean-room implementation*) berdasarkan literatur ilmiah publik (Wold 1982, Lohmöller 1989, Hair et al. 2022, Henseler et al. 2015).

---

## Contoh Penggunaan via AI Agent

Setelah MCP server dikonfigurasi, Anda bisa minta AI agent langsung:

```
"Analisis data berikut dengan PLS-SEM:
- Variabel X (reflektif): X1, X2, X3
- Variabel Y (reflektif): Y1, Y2
- Jalur: X → Y
Data: ..."
```

Agent akan memanggil `pls_run_analysis` dan menginterpretasi hasilnya.

---

## Test Manual

```bash
cd mcp-server
node test-mcp.js
```

