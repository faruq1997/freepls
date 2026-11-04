# FreePLS Indonesia 🇮🇩

Aplikasi desktop *open-source* modern untuk analisis **Partial Least Squares - Structural Equation Modeling (PLS-SEM)** dengan antarmuka penuh Bahasa Indonesia, dirancang khusus untuk mendukung kegiatan penelitian, skripsi, tesis, disertasi, dan pembelajaran statistika.

---

## ⚖️ Disclaimer Etis & Hukum (Legal & Ethical Disclaimer)

1. **Independensi Perangkat Lunak**: **FreePLS Indonesia** adalah proyek independen dan sumber terbuka (*open-source*) yang didedikasikan untuk kemajuan sains terbuka (*Open Science*) dan edukasi.
2. **Bukan Afiliasi**: Proyek ini **TIDAK berafiliasi, tidak disponsori, dan tidak didukung oleh SmartPLS GmbH** atau pemegang merek komersial lainnya.
3. **Implementasi Mandiri**: Seluruh perhitungan statistika (Algoritma PLS-SEM, Bootstrapping, Uji Reliabilitas & Validitas) dibangun secara independen (*clean-room implementation*) berdasarkan literatur ilmiah dan publikasi domain publik (Wold, Lohmöller, Hair et al.).

---

## ✨ Fitur Utama

- 📊 **Algoritma PLS-SEM Lengkap** - Hitung koefisien jalur (*Path Coefficients*), *Outer Loadings*, $R^2$, $f^2$, Cronbach's Alpha, Composite Reliability, AVE, dan rho_A.
- 🔄 **Non-Parametric Bootstrapping** - Uji signifikansi hipotesis dengan T-Statistik, P-Values, dan Confidence Intervals.
- 🎨 **Interactive Canvas Editor** - Buat model visual dengan drag-and-drop, lengkungkan jalur sesuka hati, model mediasi langsung, dan multi-select (*Ctrl + A* / *Delete*).
- 🖼️ **Ekspor Gambar High-Resolution 600+ DPI** - Ekspor diagram model beresolusi publikasi jurnal (PNG / JPG / SVG) dengan atau tanpa indikator.
- 💾 **Autosave Real-Time & Versi Snapshot** - Perubahan otomatis tersimpan ke SQLite lokal, dilengkapi fitur pencadangan snapshot versi model.
- 📁 **Ekspor & Impor File Proyek (.freepls)** - Backup dan bagikan file proyek lengkap antar pengguna.
- 🌙 **Tema Gelap & Terang Modern** - Desain antarmuka *glassmorphic* premium yang nyaman di mata.

---

## 📋 Pengujian Statistika

### 1. Model Pengukuran (Outer Model)
- Outer Loadings & Indikator Validitas (Reflektif)
- Model Formatif (Mode B): Outer Weights, Outer Loadings, Indicator VIF (< 3.3/5.0), dan Aturan Retensi Indikator
- Cronbach's Alpha & rho_A (Dijkstra-Henseler)
- Composite Reliability (CR)
- Average Variance Extracted (AVE)
- Validitas Diskriminan (Fornell-Larcker Criterion & HTMT)

### 2. Model Struktural (Inner Model)
- Koefisien Jalur (*Path Coefficients* $\beta$)
- Koefisien Determinasi ($R^2$ & $R^2$ Adjusted)
- Ukuran Pengaruh (*Effect Size* $f^2$)
- Uji Mediasi Spesifik & Uji Pengaruh Moderasi (Two-Stage / Simple Slope Plot)

### 3. Analisis Lanjutan & Metodologi Mutakhir
- **Uji Normalitas Multivariat Mardia** (Skewness & Kurtosis) beserta Generator Narasi Justifikasi Ilmiah untuk Skripsi/Tesis/Jurnal
- **Higher-Order Constructs (HOC / HCM)** - Pemodelan konstruk berdimensi ganda melalui *Two-Stage Approach*
- **Necessary Condition Analysis (NCA)** - Analisis kondisi keharusan (Dul, 2016), estimasi Ceiling Envelopment (CE-FDH & CR-FDH), dan *Bottleneck Table*
- **Consistent PLS (PLSc)** - Koreksi *attenuation bias* pada model reflektif
- **PLSpredict** - Evaluasi relevansi prediktif *out-of-sample* (RMSE, MAE, $Q^2_{\text{predict}}$)
- **Multi-Group Analysis (MGA)** & **IPMA** (*Importance-Performance Map Analysis*)
- **Common Method Bias (CMV)** - Harman's Single Factor Test & Full Collinearity VIF

### 4. Bootstrapping (Pengujian Hipotesis)
- Original Sample ($O$)
- Sample Mean ($M$)
- Standard Deviation ($STDEV$)
- T-Statistics ($|O/STDEV|$)
- P-Values (Signifikansi 5% / 1%)
- Bias-Corrected Confidence Intervals (CI)

---

## 🚀 Cara Menjalankan

### Prasyarat
- [Node.js](https://nodejs.org/) v18+
- npm / yarn

### Instalasi Dependensi
```bash
npm install
```

### Menjalankan Mode Pengembangan
```bash
npm start
```

### Build Installer Desktop (.exe)
```bash
npm run build
```
File installer akan tersedia di folder `dist/`.

---

## 📖 Cara Penggunaan

1. **Buat Proyek Baru** - Klik tombol "Proyek Baru" di beranda.
2. **Impor Data** - Buka menu Data dan impor file data mentah (.csv atau .xlsx).
3. **Susun Model** - Buka Editor Model, tambahkan variabel laten dan hubungkan jalur hipotesis (atau gunakan **Template Model** siap pakai).
4. **Jalankan Analisis** - Buka tab Analisis, atur iterasi/sampel bootstrap, lalu klik jalankan.
5. **Lihat & Ekspor Hasil** - Tinjau tab Hasil & Laporan, dan unduh laporan Excel/CSV atau gambar diagram 600 DPI.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah **[Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](LICENSE)**.

* **Bebas Digunakan**: Untuk riset ilmiah, tugas akhir, skripsi, tesis, disertasi, dan pembelajaran akademik non-komersial.
* **Non-Komersial**: Dilarang diperjualbelikan atau digunakan untuk tujuan komersial langsung tanpa izin.
