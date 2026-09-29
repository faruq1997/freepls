/**
 * ============================================
 * FreePLS Indonesia - PLS-SEM Engine
 * Mesin perhitungan PLS-SEM Lengkap & Komprehensif
 * (Wold, Lohmöller, Henseler, Hair et al.)
 * ============================================
 */

class PLSEngine {
  constructor() {
    this.data = [];
    this.variabels = [];
    this.jalurs = [];
    this.hasil = null;
  }

  /**
   * Set data dan model
   */
  setData(data, variabels, jalurs) {
    this.data = data;
    this.variabels = variabels;
    this.jalurs = jalurs;
  }

  /**
   * Hitung rata-rata kolom
   */
  mean(arr) {
    if (!arr || arr.length === 0) return 0;
    const valid = arr.filter(v => typeof v === 'number' && !isNaN(v));
    if (valid.length === 0) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }

  /**
   * Hitung median
   */
  median(arr) {
    if (!arr || arr.length === 0) return 0;
    const valid = arr.filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b);
    if (valid.length === 0) return 0;
    const mid = Math.floor(valid.length / 2);
    return valid.length % 2 !== 0 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
  }

  /**
   * Hitung standar deviasi
   */
  stdDev(arr) {
    const valid = arr.filter(v => typeof v === 'number' && !isNaN(v));
    if (valid.length <= 1) return 0;
    const m = this.mean(valid);
    const squaredDiffs = valid.map(v => Math.pow(v - m, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (valid.length - 1));
  }

  /**
   * Standardisasi data (z-score)
   */
  standardize(arr) {
    const m = this.mean(arr);
    const sd = this.stdDev(arr);
    if (sd === 0) return arr.map(() => 0);
    return arr.map(v => (v - m) / sd);
  }

  /**
   * Hitung korelasi Pearson
   */
  correlation(x, y) {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;
    const mx = this.mean(x);
    const my = this.mean(y);
    let sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - mx;
      const dy = y[i] - my;
      sumXY += dx * dy;
      sumX2 += dx * dx;
      sumY2 += dy * dy;
    }
    const denom = Math.sqrt(sumX2 * sumY2);
    return denom === 0 ? 0 : Math.max(-1, Math.min(1, sumXY / denom));
  }

  /**
   * Hitung kovarians
   */
  covariance(x, y) {
    const n = Math.min(x.length, y.length);
    if (n <= 1) return 0;
    const mx = this.mean(x);
    const my = this.mean(y);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += (x[i] - mx) * (y[i] - my);
    }
    return sum / (n - 1);
  }

  /**
   * Regresi linear sederhana
   */
  simpleRegression(x, y) {
    const n = x.length;
    const mx = this.mean(x);
    const my = this.mean(y);
    let ssXY = 0, ssXX = 0;
    for (let i = 0; i < n; i++) {
      ssXY += (x[i] - mx) * (y[i] - my);
      ssXX += (x[i] - mx) * (x[i] - mx);
    }
    const beta = ssXX === 0 ? 0 : ssXY / ssXX;
    const alpha = my - beta * mx;
    return { alpha, beta };
  }

  /**
   * Regresi linear berganda (OLS) dengan deteksi multikolinearitas (Ridge regularization jika singular)
   */
  multipleRegression(X, y) {
    const n = y.length;
    const k = X[0] ? X[0].length : 0;
    
    if (k === 0 || n === 0) return { coefficients: [], rSquared: 0 };
    
    // X'X
    const XtX = [];
    for (let i = 0; i < k; i++) {
      XtX[i] = [];
      for (let j = 0; j < k; j++) {
        let sum = 0;
        for (let r = 0; r < n; r++) {
          sum += X[r][i] * X[r][j];
        }
        XtX[i][j] = sum;
      }
    }
    
    // X'y
    const Xty = [];
    for (let i = 0; i < k; i++) {
      let sum = 0;
      for (let r = 0; r < n; r++) {
        sum += X[r][i] * y[r];
      }
      Xty[i] = sum;
    }
    
    // Invers X'X
    let inv = this.invertMatrix(XtX);
    if (!inv) {
      // Tambahkan ridge regularization jika singular
      for (let i = 0; i < k; i++) {
        XtX[i][i] += 1e-4;
      }
      inv = this.invertMatrix(XtX);
    }
    if (!inv) return { coefficients: new Array(k).fill(0), rSquared: 0 };
    
    // beta = (X'X)^-1 * X'y
    const coefficients = [];
    for (let i = 0; i < k; i++) {
      let sum = 0;
      for (let j = 0; j < k; j++) {
        sum += inv[i][j] * Xty[j];
      }
      coefficients[i] = sum;
    }
    
    // R²
    const yMean = this.mean(y);
    let ssRes = 0, ssTot = 0;
    for (let r = 0; r < n; r++) {
      let predicted = 0;
      for (let j = 0; j < k; j++) {
        predicted += X[r][j] * coefficients[j];
      }
      ssRes += Math.pow(y[r] - predicted, 2);
      ssTot += Math.pow(y[r] - yMean, 2);
    }
    const rSquared = ssTot === 0 ? 0 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));
    
    return { coefficients, rSquared };
  }

  /**
   * Invers matriks Gauss-Jordan
   */
  invertMatrix(matrix) {
    const n = matrix.length;
    const augmented = matrix.map((row, i) => {
      const identity = new Array(n).fill(0);
      identity[i] = 1;
      return [...row, ...identity];
    });
    
    for (let col = 0; col < n; col++) {
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
          maxRow = row;
        }
      }
      [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];
      
      const pivot = augmented[col][col];
      if (Math.abs(pivot) < 1e-12) return null;
      
      for (let j = 0; j < 2 * n; j++) {
        augmented[col][j] /= pivot;
      }
      
      for (let row = 0; row < n; row++) {
        if (row !== col) {
          const factor = augmented[row][col];
          for (let j = 0; j < 2 * n; j++) {
            augmented[row][j] -= factor * augmented[col][j];
          }
        }
      }
    }
    
    return augmented.map(row => row.slice(n));
  }

  /**
   * Ambil data kolom terstandardisasi
   */
  getColumnData(columnName) {
    return this.data.map(row => {
      const val = parseFloat(row[columnName]);
      return isNaN(val) ? 0 : val;
    });
  }

  /**
   * Hitung skor variabel laten awal
   */
  calculateLatentScores(variabel) {
    const indicators = variabel.indikator;
    if (!indicators || indicators.length === 0) return new Array(this.data.length).fill(0);
    
    const n = this.data.length;
    const scores = new Array(n).fill(0);
    
    for (let i = 0; i < n; i++) {
      let sum = 0;
      let count = 0;
      for (const ind of indicators) {
        const val = parseFloat(this.data[i][ind]);
        if (!isNaN(val)) {
          sum += val;
          count++;
        }
      }
      scores[i] = count > 0 ? sum / count : 0;
    }
    
    return scores;
  }

  /**
   * Jalankan Algoritma PLS Komprehensif
   */
  runPLS(options = {}) {
    const maxIterations = options.maxIterasi || 300;
    const tolerance = options.toleransi || 0.00001;
    const weightScheme = options.skemaBobot || 'path';
    
    if (!this.data || this.data.length === 0) {
      throw new Error('Data belum diimpor. Silakan impor data terlebih dahulu.');
    }
    
    if (!this.variabels || this.variabels.length === 0) {
      throw new Error('Belum ada variabel laten. Silakan buat model terlebih dahulu.');
    }
    
    const n = this.data.length;
    
    // ---- Langkah 1: Inisialisasi skor variabel laten ----
    let latentScores = {};
    for (const v of this.variabels) {
      const scores = this.calculateLatentScores(v);
      latentScores[v.nama] = this.standardize(scores);
    }
    
    // ---- Langkah 2: Iterasi PLS ----
    let converged = false;
    let iteration = 0;
    let prevScores = {};
    
    for (iteration = 0; iteration < maxIterations; iteration++) {
      prevScores = JSON.parse(JSON.stringify(latentScores));
      
      // Inner estimation
      const innerWeights = {};
      for (const v of this.variabels) {
        innerWeights[v.nama] = {};
        for (const v2 of this.variabels) {
          if (v.nama === v2.nama) continue;
          
          const isConnected = this.jalurs.some(j => {
            const fromVar = this.variabels.find(vv => vv.id == j.dari_variabel_id || vv.nama === j.dari);
            const toVar = this.variabels.find(vv => vv.id == j.ke_variabel_id || vv.nama === j.ke);
            const viaVar = j.melalui_variabel_id ? this.variabels.find(vv => vv.id == j.melalui_variabel_id || vv.nama === j.melalui) : null;
            
            if (viaVar) {
              return (fromVar && toVar && viaVar) &&
                ((fromVar.nama === v.nama && viaVar.nama === v2.nama) ||
                 (viaVar.nama === v.nama && toVar.nama === v2.nama) ||
                 (toVar.nama === v.nama && viaVar.nama === v2.nama) ||
                 (viaVar.nama === v.nama && fromVar.nama === v2.nama));
            }

            return (fromVar && toVar) && 
                   ((fromVar.nama === v.nama && toVar.nama === v2.nama) || 
                    (fromVar.nama === v2.nama && toVar.nama === v.nama));
          });
          
          if (isConnected) {
            if (weightScheme === 'centroid') {
              const corr = this.correlation(latentScores[v.nama], latentScores[v2.nama]);
              innerWeights[v.nama][v2.nama] = Math.sign(corr) || 1;
            } else if (weightScheme === 'factorial') {
              innerWeights[v.nama][v2.nama] = this.correlation(latentScores[v.nama], latentScores[v2.nama]);
            } else {
              // Path scheme
              const isPredictor = this.jalurs.some(j => {
                const fromVar = this.variabels.find(vv => vv.id == j.dari_variabel_id || vv.nama === j.dari);
                const toVar = this.variabels.find(vv => vv.id == j.ke_variabel_id || vv.nama === j.ke);
                return fromVar && toVar && fromVar.nama === v2.nama && toVar.nama === v.nama;
              });
              
              if (isPredictor) {
                const reg = this.simpleRegression(latentScores[v2.nama], latentScores[v.nama]);
                innerWeights[v.nama][v2.nama] = reg.beta;
              } else {
                innerWeights[v.nama][v2.nama] = this.correlation(latentScores[v.nama], latentScores[v2.nama]);
              }
            }
          }
        }
      }
      
      // Hitung skor proxy inner
      const innerProxies = {};
      for (const v of this.variabels) {
        innerProxies[v.nama] = new Array(n).fill(0);
        const weights = innerWeights[v.nama];
        const connectedVars = Object.keys(weights);
        
        if (connectedVars.length > 0) {
          for (let i = 0; i < n; i++) {
            let sum = 0;
            for (const cv of connectedVars) {
              sum += weights[cv] * latentScores[cv][i];
            }
            innerProxies[v.nama][i] = sum;
          }
        } else {
          innerProxies[v.nama] = latentScores[v.nama].slice();
        }
      }
      
      // Outer estimation
      for (const v of this.variabels) {
        if (!v.indikator || v.indikator.length === 0) continue;
        
        const outerWeights = [];
        for (const ind of v.indikator) {
          const indData = this.getColumnData(ind);
          if (v.tipe === 'reflektif') {
            // Mode A
            const corr = this.correlation(innerProxies[v.nama], indData);
            outerWeights.push(corr);
          } else {
            // Mode B
            const reg = this.simpleRegression(indData, innerProxies[v.nama]);
            outerWeights.push(reg.beta);
          }
        }
        
        // Hitung skor baru
        const newScores = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
          let sum = 0;
          for (let j = 0; j < v.indikator.length; j++) {
            const indData = this.getColumnData(v.indikator[j]);
            sum += outerWeights[j] * indData[i];
          }
          newScores[i] = sum;
        }
        
        latentScores[v.nama] = this.standardize(newScores);
      }
      
      // Cek konvergensi
      let maxDiff = 0;
      for (const v of this.variabels) {
        for (let i = 0; i < n; i++) {
          const diff = Math.abs(latentScores[v.nama][i] - (prevScores[v.nama] ? prevScores[v.nama][i] : 0));
          if (diff > maxDiff) maxDiff = diff;
        }
      }
      
      if (maxDiff < tolerance) {
        converged = true;
        break;
      }
    }
    
    // ---- Langkah 3: Outer Loading & Outer Weights ----
    const outerLoadings = {};
    const outerWeights = {};
    
    for (const v of this.variabels) {
      outerLoadings[v.nama] = {};
      outerWeights[v.nama] = {};
      if (!v.indikator) continue;
      
      for (const ind of v.indikator) {
        const indData = this.getColumnData(ind);
        const loading = this.correlation(indData, latentScores[v.nama]);
        outerLoadings[v.nama][ind] = loading;
        
        const reg = this.simpleRegression(latentScores[v.nama], indData);
        outerWeights[v.nama][ind] = reg.beta;
      }
    }
    
    // ---- Langkah 4: Path Coefficients & R² ----
    const pathCoefficients = {};
    const rSquared = {};
    const rSquaredAdj = {};
    
    for (const v of this.variabels) {
      // Kumpulkan direct predictors & indirect predictors
      const predictors = [];
      
      this.jalurs.forEach(j => {
        const fromVar = this.variabels.find(vv => vv.id == j.dari_variabel_id || vv.nama === j.dari);
        const toVar = this.variabels.find(vv => vv.id == j.ke_variabel_id || vv.nama === j.ke);
        const viaVar = j.melalui_variabel_id ? this.variabels.find(vv => vv.id == j.melalui_variabel_id || vv.nama === j.melalui) : null;
        
        if (viaVar && toVar && toVar.nama === v.nama) {
          if (!predictors.includes(viaVar.nama)) predictors.push(viaVar.nama);
        } else if (fromVar && toVar && toVar.nama === v.nama) {
          if (!predictors.includes(fromVar.nama)) predictors.push(fromVar.nama);
        }
      });
      
      if (predictors.length > 0) {
        if (predictors.length === 1) {
          const reg = this.simpleRegression(latentScores[predictors[0]], latentScores[v.nama]);
          pathCoefficients[`${predictors[0]} → ${v.nama}`] = reg.beta;
          
          const yMean = this.mean(latentScores[v.nama]);
          let ssRes = 0, ssTot = 0;
          for (let i = 0; i < n; i++) {
            const predicted = reg.alpha + reg.beta * latentScores[predictors[0]][i];
            ssRes += Math.pow(latentScores[v.nama][i] - predicted, 2);
            ssTot += Math.pow(latentScores[v.nama][i] - yMean, 2);
          }
          const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);
          rSquared[v.nama] = r2;
          rSquaredAdj[v.nama] = n > 2 ? 1 - (1 - r2) * ((n - 1) / (n - 1 - 1)) : r2;
        } else {
          const X = [];
          for (let i = 0; i < n; i++) {
            const row = predictors.map(pn => latentScores[pn][i]);
            X.push(row);
          }
          const result = this.multipleRegression(X, latentScores[v.nama]);
          
          for (let j = 0; j < predictors.length; j++) {
            pathCoefficients[`${predictors[j]} → ${v.nama}`] = result.coefficients[j] || 0;
          }
          const r2 = result.rSquared;
          rSquared[v.nama] = r2;
          const k = predictors.length;
          rSquaredAdj[v.nama] = (n > k + 1) ? 1 - (1 - r2) * ((n - 1) / (n - k - 1)) : r2;
        }
      }
    }
    
    // Process multi-hop mediasi paths coefficients jika ada
    this.jalurs.forEach(j => {
      if (j.melalui_variabel_id || j.melalui) {
        const fromVar = this.variabels.find(vv => vv.id == j.dari_variabel_id || vv.nama === j.dari);
        const viaVar = this.variabels.find(vv => vv.id == j.melalui_variabel_id || vv.nama === j.melalui);
        const toVar = this.variabels.find(vv => vv.id == j.ke_variabel_id || vv.nama === j.ke);
        if (fromVar && viaVar && toVar) {
          const b1 = pathCoefficients[`${fromVar.nama} → ${viaVar.nama}`] || 0;
          const b2 = pathCoefficients[`${viaVar.nama} → ${toVar.nama}`] || 0;
          pathCoefficients[`${fromVar.nama} → ${viaVar.nama} → ${toVar.nama}`] = b1 * b2;
        }
      }
    });

    // ---- Langkah 5: Reliabilitas & Validitas Konvergen ----
    const reliability = {};
    for (const v of this.variabels) {
      if (!v.indikator || v.indikator.length === 0) continue;
      
      const loadings = v.indikator.map(ind => outerLoadings[v.nama][ind] || 0);
      const k = loadings.length;
      
      const indicators = v.indikator.map(ind => this.getColumnData(ind));
      let totalVar = 0;
      for (const ind of indicators) {
        const sd = this.stdDev(ind);
        totalVar += sd * sd;
      }
      const compositeScores = [];
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (const ind of indicators) {
          sum += ind[i];
        }
        compositeScores.push(sum);
      }
      const compositeSD = this.stdDev(compositeScores);
      const compositeVar = compositeSD * compositeSD;
      const cronbachAlpha = k > 1 ? (k / (k - 1)) * (1 - (compositeVar > 0 ? totalVar / compositeVar : 1)) : 1;
      
      // Composite Reliability (CR)
      const sumLoadings = loadings.reduce((a, b) => a + b, 0);
      const sumLoadingsSquared = sumLoadings * sumLoadings;
      const sumErrorVariance = loadings.reduce((sum, l) => sum + (1 - l * l), 0);
      const cr = (sumLoadingsSquared + sumErrorVariance > 0) ? sumLoadingsSquared / (sumLoadingsSquared + sumErrorVariance) : 1;
      
      // Average Variance Extracted (AVE)
      const sumSquaredLoadings = loadings.reduce((sum, l) => sum + l * l, 0);
      const ave = k > 0 ? sumSquaredLoadings / k : 0;
      
      // rho_A (Dijkstra-Henseler's rho)
      const weightSquaredSum = loadings.reduce((sum, l) => sum + l * l, 0);
      const rhoADenom = (Math.pow(sumLoadings, 2) - k + weightSquaredSum);
      const rhoA = (k > 1 && rhoADenom > 0 && compositeVar > 0)
        ? (Math.pow(sumLoadings, 2) / rhoADenom) * (1 - totalVar / compositeVar) * (k / (k - 1))
        : 1;
      
      reliability[v.nama] = {
        cronbachAlpha: Math.max(0, Math.min(1, cronbachAlpha)),
        compositeReliability: Math.max(0, Math.min(1, cr)),
        ave: Math.max(0, Math.min(1, ave)),
        rhoA: Math.max(0, Math.min(1, rhoA || 0))
      };
    }
    
    // ---- Langkah 6: Validitas Diskriminan (Fornell-Larcker) ----
    const discriminantValidity = {};
    for (const v of this.variabels) {
      discriminantValidity[v.nama] = {};
      for (const v2 of this.variabels) {
        if (v.nama === v2.nama) {
          discriminantValidity[v.nama][v2.nama] = reliability[v.nama] ? Math.sqrt(reliability[v.nama].ave) : 1.0;
        } else {
          discriminantValidity[v.nama][v2.nama] = this.correlation(latentScores[v.nama], latentScores[v2.nama]);
        }
      }
    }
    
    // ---- Langkah 7: HTMT (Heterotrait-Monotrait Ratio) ----
    const htmt = this.calculateHTMT();

    // ---- Langkah 8: VIF (Multicollinearity Test: Outer & Inner) ----
    const vif = this.calculateVIF(latentScores);

    // ---- Langkah 9: f² (Effect Size) ----
    const effectSizes = {};
    for (const pathKey of Object.keys(pathCoefficients)) {
      if (pathKey.includes(' → ') && pathKey.split(' → ').length === 2) {
        const parts = pathKey.split(' → ');
        const predictor = parts[0];
        const endogen = parts[1];
        
        if (rSquared[endogen] !== undefined) {
          const rIncluded = rSquared[endogen];
          const beta = pathCoefficients[pathKey];
          // f² formula = (R²incl - R²excl) / (1 - R²incl)
          const f2 = (1 - rIncluded > 0.001) ? (beta * beta) / (1 - rIncluded) : (beta * beta);
          effectSizes[pathKey] = f2;
        }
      }
    }

    // ---- Langkah 10: Model Fit (SRMR & NFI) ----
    const modelFit = this.calculateModelFit(latentScores, outerLoadings);

    // ---- Langkah 11: Specific Indirect & Total Effects ----
    const indirectEffects = this.calculateSpecificIndirectEffects(pathCoefficients);

    this.hasil = {
      converged,
      iterations: iteration + 1,
      latentScores,
      outerLoadings,
      outerWeights,
      pathCoefficients,
      rSquared,
      rSquaredAdj,
      reliability,
      discriminantValidity,
      htmt,
      vif,
      modelFit,
      effectSizes,
      indirectEffects,
      sampleSize: n
    };
    
    return this.hasil;
  }

  /**
   * Hitung HTMT (Heterotrait-Monotrait Ratio of Correlations)
   * Standar Henseler et al. (2015)
   */
  calculateHTMT() {
    const htmt = {};
    const varList = this.variabels.filter(v => v.indikator && v.indikator.length > 0);
    
    for (const v1 of varList) {
      htmt[v1.nama] = {};
      for (const v2 of varList) {
        if (v1.nama === v2.nama) {
          htmt[v1.nama][v2.nama] = 1.0;
          continue;
        }
        
        // 1. Monotrait correlation v1
        const inds1 = v1.indikator;
        let sumMono1 = 0, countMono1 = 0;
        for (let i = 0; i < inds1.length; i++) {
          for (let j = i + 1; j < inds1.length; j++) {
            const r = Math.abs(this.correlation(this.getColumnData(inds1[i]), this.getColumnData(inds1[j])));
            sumMono1 += r;
            countMono1++;
          }
        }
        const mono1 = countMono1 > 0 ? (sumMono1 / countMono1) : 1.0;
        
        // 2. Monotrait correlation v2
        const inds2 = v2.indikator;
        let sumMono2 = 0, countMono2 = 0;
        for (let i = 0; i < inds2.length; i++) {
          for (let j = i + 1; j < inds2.length; j++) {
            const r = Math.abs(this.correlation(this.getColumnData(inds2[i]), this.getColumnData(inds2[j])));
            sumMono2 += r;
            countMono2++;
          }
        }
        const mono2 = countMono2 > 0 ? (sumMono2 / countMono2) : 1.0;
        
        // 3. Heterotrait correlation v1 vs v2
        let sumHetero = 0, countHetero = 0;
        for (const ind1 of inds1) {
          for (const ind2 of inds2) {
            const r = Math.abs(this.correlation(this.getColumnData(ind1), this.getColumnData(ind2)));
            sumHetero += r;
            countHetero++;
          }
        }
        const hetero = countHetero > 0 ? (sumHetero / countHetero) : 0;
        
        // 4. HTMT = Hetero / sqrt(mono1 * mono2)
        const denom = Math.sqrt(Math.max(0.001, mono1 * mono2));
        const val = denom > 0 ? (hetero / denom) : 0;
        htmt[v1.nama][v2.nama] = val;
      }
    }
    
    return htmt;
  }

  /**
   * Hitung VIF (Variance Inflation Factor) untuk Outer & Inner Model
   */
  calculateVIF(latentScores) {
    const outerVIF = {};
    const innerVIF = {};
    const n = this.data.length;

    // 1. Outer VIF (Kolinearitas antar indikator dalam 1 konstruk)
    for (const v of this.variabels) {
      outerVIF[v.nama] = {};
      const inds = v.indikator || [];
      
      if (inds.length <= 1) {
        inds.forEach(ind => { outerVIF[v.nama][ind] = 1.0; });
        continue;
      }

      for (let i = 0; i < inds.length; i++) {
        const targetInd = inds[i];
        const predictorInds = inds.filter((_, idx) => idx !== i);
        
        const y = this.getColumnData(targetInd);
        const X = [];
        for (let r = 0; r < n; r++) {
          X.push(predictorInds.map(pInd => parseFloat(this.data[r][pInd]) || 0));
        }
        
        const reg = this.multipleRegression(X, y);
        const r2 = Math.min(0.999, Math.max(0, reg.rSquared));
        outerVIF[v.nama][targetInd] = 1 / (1 - r2);
      }
    }

    // 2. Inner VIF (Kolinearitas antar variabel prediktor laten)
    for (const v of this.variabels) {
      // Cari semua variabel yang mengarah ke v
      const predictors = [];
      this.jalurs.forEach(j => {
        const fromVar = this.variabels.find(vv => vv.id == j.dari_variabel_id || vv.nama === j.dari);
        const toVar = this.variabels.find(vv => vv.id == j.ke_variabel_id || vv.nama === j.ke);
        const viaVar = j.melalui_variabel_id ? this.variabels.find(vv => vv.id == j.melalui_variabel_id || vv.nama === j.melalui) : null;
        
        if (viaVar && toVar && toVar.nama === v.nama) {
          if (!predictors.includes(viaVar.nama)) predictors.push(viaVar.nama);
        } else if (fromVar && toVar && toVar.nama === v.nama) {
          if (!predictors.includes(fromVar.nama)) predictors.push(fromVar.nama);
        }
      });

      if (predictors.length > 0) {
        innerVIF[v.nama] = {};
        if (predictors.length === 1) {
          innerVIF[v.nama][predictors[0]] = 1.0;
        } else {
          for (let i = 0; i < predictors.length; i++) {
            const targetPred = predictors[i];
            const otherPreds = predictors.filter((_, idx) => idx !== i);
            
            const y = latentScores[targetPred];
            const X = [];
            for (let r = 0; r < n; r++) {
              X.push(otherPreds.map(op => latentScores[op][r]));
            }
            
            const reg = this.multipleRegression(X, y);
            const r2 = Math.min(0.999, Math.max(0, reg.rSquared));
            innerVIF[v.nama][targetPred] = 1 / (1 - r2);
          }
        }
      }
    }

    return { outerVIF, innerVIF };
  }

  /**
   * Hitung Model Fit (SRMR & NFI)
   */
  calculateModelFit(latentScores, outerLoadings) {
    // Kumpulkan semua indikator unik
    const allIndicators = [];
    const indToVarMap = {};
    for (const v of this.variabels) {
      if (v.indikator) {
        for (const ind of v.indikator) {
          allIndicators.push(ind);
          indToVarMap[ind] = v.nama;
        }
      }
    }

    const p = allIndicators.length;
    if (p < 2) return { srmr: 0, nfi: 1.0 };

    // 1. Matriks Korelasi Empiris (S)
    let sumSqResidual = 0;
    let countPairs = 0;

    for (let i = 0; i < p; i++) {
      for (let j = i + 1; j < p; j++) {
        const ind1 = allIndicators[i];
        const ind2 = allIndicators[j];
        const var1 = indToVarMap[ind1];
        const var2 = indToVarMap[ind2];

        const s_ij = this.correlation(this.getColumnData(ind1), this.getColumnData(ind2));
        
        // Korelasi Terimplikasi Model: sigma_ij = lambda1 * r(var1, var2) * lambda2
        const l1 = outerLoadings[var1]?.[ind1] || 0;
        const l2 = outerLoadings[var2]?.[ind2] || 0;
        const latentCorr = (var1 === var2) ? 1.0 : this.correlation(latentScores[var1], latentScores[var2]);
        const sigma_ij = l1 * latentCorr * l2;

        const diff = s_ij - sigma_ij;
        sumSqResidual += diff * diff;
        countPairs++;
      }
    }

    const srmr = countPairs > 0 ? Math.sqrt(sumSqResidual / countPairs) : 0;
    
    // NFI aproksimasi berbasis SRMR vs Null Model
    const nfi = Math.max(0, Math.min(1.0, 1 - (srmr / 0.35)));

    return {
      srmr: Math.max(0, srmr),
      srmrThreshold: 0.08,
      srmrFit: srmr <= 0.08,
      nfi: Math.max(0, Math.min(1.0, nfi)),
      nfiThreshold: 0.90,
      nfiFit: nfi >= 0.90
    };
  }

  /**
   * Hitung Specific Indirect Effects & Total Effects
   */
  calculateSpecificIndirectEffects(pathCoeffs) {
    const adj = {};
    for (const v of this.variabels) {
      adj[v.nama] = [];
    }

    // Bangun graf langsung
    for (const [key, beta] of Object.entries(pathCoeffs)) {
      if (!key.includes(' → ')) continue;
      const parts = key.split(' → ');
      if (parts.length === 2) {
        const [u, w] = parts;
        if (adj[u]) adj[u].push({ target: w, beta });
      }
    }

    // Temukan semua jalur berpanjang >= 2 (indirect)
    const specificIndirect = [];
    const directEffects = {};
    const totalEffects = {};

    const dfs = (current, end, path, currentBeta) => {
      if (current === end) {
        if (path.length > 2) {
          specificIndirect.push({
            path: path.join(' → '),
            hops: path.length - 1,
            from: path[0],
            to: path[path.length - 1],
            mediators: path.slice(1, -1),
            effect: currentBeta
          });
        }
        return;
      }
      for (const edge of (adj[current] || [])) {
        if (!path.includes(edge.target)) {
          dfs(edge.target, end, [...path, edge.target], currentBeta * edge.beta);
        }
      }
    };

    const varNames = this.variabels.map(v => v.nama);
    for (const v1 of varNames) {
      for (const v2 of varNames) {
        if (v1 !== v2) {
          dfs(v1, v2, [v1], 1.0);
        }
      }
    }

    // Hitung Direct, Indirect & Total Effect per pasangan
    const summary = {};
    for (const v1 of varNames) {
      for (const v2 of varNames) {
        if (v1 === v2) continue;
        const pairKey = `${v1} → ${v2}`;
        const direct = pathCoeffs[pairKey] !== undefined ? pathCoeffs[pairKey] : 0;
        
        const pairIndirects = specificIndirect.filter(p => p.from === v1 && p.to === v2);
        const indirect = pairIndirects.reduce((sum, p) => sum + p.effect, 0);
        const total = direct + indirect;

        if (direct !== 0 || indirect !== 0) {
          const vaf = total !== 0 ? Math.max(0, Math.min(100, (indirect / total) * 100)) : 0;
          summary[pairKey] = {
            from: v1,
            to: v2,
            directEffect: direct,
            indirectEffect: indirect,
            totalEffect: total,
            vaf,
            specificPaths: pairIndirects
          };
        }
      }
    }

    return {
      specificIndirect,
      summary
    };
  }

  /**
   * Jalankan Bootstrapping Lengkap
   */
  runBootstrap(options = {}) {
    const numSubsamples = options.jumlahBootstrap || 5000;
    const significanceLevel = options.tingkatSignifikansi || 0.05;
    const testType = options.tipeUji || 'two-tailed';
    const plsOptions = {
      maxIterasi: options.maxIterasi || 300,
      toleransi: options.toleransi || 0.00001,
      skemaBobot: options.skemaBobot || 'path'
    };
    
    if (!this.data || this.data.length === 0) {
      throw new Error('Data belum diimpor.');
    }
    
    const n = this.data.length;
    const originalData = [...this.data];
    
    // 1. Jalankan pada data asli
    this.data = originalData;
    const originalResult = this.runPLS(plsOptions);
    
    // 2. Kumpulkan wadah statistik bootstrap
    const bootstrapPaths = {};
    const bootstrapLoadings = {};
    const bootstrapIndirect = {};
    
    for (const key of Object.keys(originalResult.pathCoefficients)) {
      bootstrapPaths[key] = [];
    }
    
    for (const varName of Object.keys(originalResult.outerLoadings)) {
      bootstrapLoadings[varName] = {};
      for (const ind of Object.keys(originalResult.outerLoadings[varName])) {
        bootstrapLoadings[varName][ind] = [];
      }
    }

    if (originalResult.indirectEffects && originalResult.indirectEffects.specificIndirect) {
      for (const sp of originalResult.indirectEffects.specificIndirect) {
        bootstrapIndirect[sp.path] = [];
      }
    }
    
    // 3. Loop Resampling Bootstrap
    for (let b = 0; b < numSubsamples; b++) {
      const sample = [];
      for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * n);
        sample.push(originalData[idx]);
      }
      
      this.data = sample;
      
      try {
        const bResult = this.runPLS(plsOptions);
        
        for (const key of Object.keys(bootstrapPaths)) {
          if (bResult.pathCoefficients[key] !== undefined) {
            bootstrapPaths[key].push(bResult.pathCoefficients[key]);
          }
        }
        
        for (const varName of Object.keys(bootstrapLoadings)) {
          for (const ind of Object.keys(bootstrapLoadings[varName])) {
            if (bResult.outerLoadings[varName] && bResult.outerLoadings[varName][ind] !== undefined) {
              bootstrapLoadings[varName][ind].push(bResult.outerLoadings[varName][ind]);
            }
          }
        }

        if (bResult.indirectEffects && bResult.indirectEffects.specificIndirect) {
          for (const sp of bResult.indirectEffects.specificIndirect) {
            if (bootstrapIndirect[sp.path]) {
              bootstrapIndirect[sp.path].push(sp.effect);
            }
          }
        }
      } catch (e) {
        // Skip subsample gagal
      }
    }
    
    // Restore data asli
    this.data = originalData;
    
    // 4. Hitung statistik bootstrap untuk Path Coefficients
    const pathResults = {};
    for (const key of Object.keys(bootstrapPaths)) {
      const values = bootstrapPaths[key];
      if (values.length === 0) continue;
      
      const originalValue = originalResult.pathCoefficients[key] || 0;
      const bootMean = this.mean(values);
      const bootStd = this.stdDev(values);
      const tStatistic = bootStd === 0 ? 0 : Math.abs(originalValue / bootStd);
      
      let pValue = (testType === 'two-tailed') 
        ? 2 * (1 - this.normalCDF(Math.abs(tStatistic)))
        : 1 - this.normalCDF(Math.abs(tStatistic));
      
      const sortedValues = [...values].sort((a, b) => a - b);
      const lowerIdx = Math.floor(values.length * (significanceLevel / 2));
      const upperIdx = Math.floor(values.length * (1 - significanceLevel / 2));
      
      pathResults[key] = {
        originalValue,
        bootMean,
        bootStd,
        tStatistic,
        pValue: Math.max(0, Math.min(1, pValue)),
        signifikan: pValue < significanceLevel,
        ciLower: sortedValues[lowerIdx] !== undefined ? sortedValues[lowerIdx] : 0,
        ciUpper: sortedValues[upperIdx] !== undefined ? sortedValues[upperIdx] : 0,
        numSamples: values.length
      };
    }
    
    // 5. Hitung statistik bootstrap untuk Outer Loadings
    const loadingResults = {};
    for (const varName of Object.keys(bootstrapLoadings)) {
      loadingResults[varName] = {};
      for (const ind of Object.keys(bootstrapLoadings[varName])) {
        const values = bootstrapLoadings[varName][ind];
        if (values.length === 0) continue;
        
        const originalValue = originalResult.outerLoadings[varName][ind] || 0;
        const bootMean = this.mean(values);
        const bootStd = this.stdDev(values);
        const tStatistic = bootStd === 0 ? 0 : Math.abs(originalValue / bootStd);
        
        let pValue = (testType === 'two-tailed')
          ? 2 * (1 - this.normalCDF(Math.abs(tStatistic)))
          : 1 - this.normalCDF(Math.abs(tStatistic));
        
        loadingResults[varName][ind] = {
          originalValue,
          bootMean,
          bootStd,
          tStatistic,
          pValue: Math.max(0, Math.min(1, pValue)),
          signifikan: pValue < significanceLevel
        };
      }
    }

    // 6. Hitung statistik bootstrap untuk Specific Indirect Effects & Klasifikasi Mediasi
    const indirectResults = {};
    for (const pathKey of Object.keys(bootstrapIndirect)) {
      const values = bootstrapIndirect[pathKey];
      if (values.length === 0) continue;

      const spOrig = originalResult.indirectEffects.specificIndirect.find(p => p.path === pathKey);
      const originalValue = spOrig ? spOrig.effect : 0;
      const bootMean = this.mean(values);
      const bootStd = this.stdDev(values);
      const tStatistic = bootStd === 0 ? 0 : Math.abs(originalValue / bootStd);

      let pValue = (testType === 'two-tailed')
        ? 2 * (1 - this.normalCDF(Math.abs(tStatistic)))
        : 1 - this.normalCDF(Math.abs(tStatistic));

      const sortedValues = [...values].sort((a, b) => a - b);
      const lowerIdx = Math.floor(values.length * (significanceLevel / 2));
      const upperIdx = Math.floor(values.length * (1 - significanceLevel / 2));

      // Klasifikasi Mediasi (Zhao et al., 2010 / Hair et al., 2021)
      let mediationType = 'Tidak Ada Mediasi';
      const isIndirectSig = pValue < significanceLevel;
      
      // Ambil direct path
      const fromVar = spOrig ? spOrig.from : '';
      const toVar = spOrig ? spOrig.to : '';
      const directKey = `${fromVar} → ${toVar}`;
      const directStat = pathResults[directKey];
      const isDirectSig = directStat ? directStat.signifikan : false;
      const directVal = directStat ? directStat.originalValue : 0;

      if (isIndirectSig) {
        if (!isDirectSig) {
          mediationType = 'Full Mediation (Mediasi Penuh)';
        } else {
          // Cek tanda arah (sign)
          if ((originalValue * directVal) > 0) {
            mediationType = 'Complementary Partial Mediation (Mediasi Parsial Komplementer)';
          } else {
            mediationType = 'Competitive Partial Mediation (Mediasi Parsial Kompetitif)';
          }
        }
      } else {
        if (isDirectSig) {
          mediationType = 'Direct-Only (Hanya Pengaruh Langsung)';
        } else {
          mediationType = 'No Effect (Tidak Ada Pengaruh)';
        }
      }

      indirectResults[pathKey] = {
        path: pathKey,
        from: fromVar,
        to: toVar,
        originalValue,
        bootMean,
        bootStd,
        tStatistic,
        pValue: Math.max(0, Math.min(1, pValue)),
        signifikan: isIndirectSig,
        ciLower: sortedValues[lowerIdx] !== undefined ? sortedValues[lowerIdx] : 0,
        ciUpper: sortedValues[upperIdx] !== undefined ? sortedValues[upperIdx] : 0,
        mediationType
      };
    }
    
    return {
      pathResults,
      loadingResults,
      indirectResults,
      numSubsamples,
      significanceLevel,
      testType,
      originalResult
    };
  }

  /**
   * Data Preprocessing: Imputasi Nilai Kosong (Missing Values)
   */
  imputeMissingValues(data, method = 'mean') {
    if (!data || data.length === 0) return data;
    const columns = Object.keys(data[0]);
    const colStats = {};

    columns.forEach(col => {
      const values = data.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
      colStats[col] = (method === 'median') ? this.median(values) : this.mean(values);
    });

    let countImputed = 0;
    const cleaned = data.map(row => {
      const newRow = { ...row };
      columns.forEach(col => {
        const val = parseFloat(newRow[col]);
        if (isNaN(val) || newRow[col] === '' || newRow[col] === null || newRow[col] === undefined) {
          newRow[col] = Math.round(colStats[col] * 100) / 100;
          countImputed++;
        }
      });
      return newRow;
    });

    return { cleanedData: cleaned, countImputed };
  }

  /**
   * Data Preprocessing: Reverse Scoring Indikator Negatif
   */
  reverseScoreColumn(data, column, minScale = 1, maxScale = 5) {
    return data.map(row => {
      const val = parseFloat(row[column]);
      if (!isNaN(val)) {
        return {
          ...row,
          [column]: (maxScale + minScale) - val
        };
      }
      return row;
    });
  }

  /**
   * Data Preprocessing: Deteksi Outlier Berbasis Z-Score
   */
  detectOutliers(data, threshold = 3.0) {
    if (!data || data.length === 0) return [];
    const columns = Object.keys(data[0]);
    const outliers = [];

    const colStats = {};
    columns.forEach(col => {
      const vals = data.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
      colStats[col] = {
        mean: this.mean(vals),
        sd: this.stdDev(vals)
      };
    });

    data.forEach((row, rowIdx) => {
      const rowOutliers = [];
      columns.forEach(col => {
        const val = parseFloat(row[col]);
        if (!isNaN(val) && colStats[col].sd > 0) {
          const z = Math.abs((val - colStats[col].mean) / colStats[col].sd);
          if (z >= threshold) {
            rowOutliers.push({ col, val, z: z.toFixed(2) });
          }
        }
      });
      if (rowOutliers.length > 0) {
        outliers.push({ rowIndex: rowIdx + 1, details: rowOutliers });
      }
    });

    return outliers;
  }

  /**
   * Fungsi CDF distribusi normal standar (Abramowitz & Stegun)
   */
  normalCDF(x) {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }
}

// Export
if (typeof window !== 'undefined') {
  window.PLSEngine = PLSEngine;
  window.FreePLS = PLSEngine;
  window.OpenPLS = PLSEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PLSEngine, FreePLS: PLSEngine, OpenPLS: PLSEngine };
}
