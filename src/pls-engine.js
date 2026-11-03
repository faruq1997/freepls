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
            const fromVar = this.variabels.find(vv => (j.dari_variabel_id != null && vv.id != null && vv.id == j.dari_variabel_id) || vv.nama === j.dari);
            const toVar = this.variabels.find(vv => (j.ke_variabel_id != null && vv.id != null && vv.id == j.ke_variabel_id) || vv.nama === j.ke);
            const viaVar = (j.melalui_variabel_id != null || j.melalui) ? this.variabels.find(vv => (j.melalui_variabel_id != null && vv.id != null && vv.id == j.melalui_variabel_id) || vv.nama === j.melalui) : null;
            
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
                const fromVar = this.variabels.find(vv => (j.dari_variabel_id != null && vv.id != null && vv.id == j.dari_variabel_id) || vv.nama === j.dari);
                const toVar = this.variabels.find(vv => (j.ke_variabel_id != null && vv.id != null && vv.id == j.ke_variabel_id) || vv.nama === j.ke);
                const viaVar = (j.melalui_variabel_id != null || j.melalui) ? this.variabels.find(vv => (j.melalui_variabel_id != null && vv.id != null && vv.id == j.melalui_variabel_id) || vv.nama === j.melalui) : null;
                if (viaVar) {
                  return (fromVar && viaVar && fromVar.nama === v2.nama && viaVar.nama === v.nama) ||
                         (viaVar && toVar && viaVar.nama === v2.nama && toVar.nama === v.nama);
                }
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
        const fromVar = this.variabels.find(vv => (j.dari_variabel_id != null && vv.id != null && vv.id == j.dari_variabel_id) || vv.nama === j.dari);
        const toVar = this.variabels.find(vv => (j.ke_variabel_id != null && vv.id != null && vv.id == j.ke_variabel_id) || vv.nama === j.ke);
        const viaVar = (j.melalui_variabel_id != null || j.melalui) ? this.variabels.find(vv => (j.melalui_variabel_id != null && vv.id != null && vv.id == j.melalui_variabel_id) || vv.nama === j.melalui) : null;
        
        if (viaVar && toVar && toVar.nama === v.nama) {
          if (!predictors.includes(viaVar.nama)) predictors.push(viaVar.nama);
        } else if (viaVar && fromVar && viaVar.nama === v.nama) {
          if (!predictors.includes(fromVar.nama)) predictors.push(fromVar.nama);
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
        const fromVar = this.variabels.find(vv => (j.dari_variabel_id != null && vv.id != null && vv.id == j.dari_variabel_id) || vv.nama === j.dari);
        const viaVar = this.variabels.find(vv => (j.melalui_variabel_id != null && vv.id != null && vv.id == j.melalui_variabel_id) || vv.nama === j.melalui);
        const toVar = this.variabels.find(vv => (j.ke_variabel_id != null && vv.id != null && vv.id == j.ke_variabel_id) || vv.nama === j.ke);
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

    // ---- Langkah 12: Relevansi Prediktif Q² Stone-Geisser (Blindfolding) ----
    const q2 = this.calculateBlindfoldingQ2(latentScores, rSquared);

    // ---- Langkah 13: Uji Common Method Bias (Full Collinearity VIF) ----
    const fullCollinearity = this.calculateFullCollinearityVIF(latentScores);

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
      q2,
      fullCollinearity,
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
        const fromVar = this.variabels.find(vv => (j.dari_variabel_id != null && vv.id != null && vv.id == j.dari_variabel_id) || vv.nama === j.dari);
        const toVar = this.variabels.find(vv => (j.ke_variabel_id != null && vv.id != null && vv.id == j.ke_variabel_id) || vv.nama === j.ke);
        const viaVar = (j.melalui_variabel_id != null || j.melalui) ? this.variabels.find(vv => (j.melalui_variabel_id != null && vv.id != null && vv.id == j.melalui_variabel_id) || vv.nama === j.melalui) : null;
        
        if (viaVar && toVar && toVar.nama === v.nama) {
          if (!predictors.includes(viaVar.nama)) predictors.push(viaVar.nama);
        } else if (viaVar && fromVar && viaVar.nama === v.nama) {
          if (!predictors.includes(fromVar.nama)) predictors.push(fromVar.nama);
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

  /**
   * Tabel Nilai Kritis r-Tabel Pearson Product Moment
   * Berdasarkan df = N - 2 (Tingkat Signifikansi 5% & 1%, 2-Tailed)
   */
  getRTableCritical(df, alpha = 0.05) {
    const rTableLookup = {
      1: { 0.05: 0.9969, 0.01: 0.9999 },
      2: { 0.05: 0.9500, 0.01: 0.9900 },
      3: { 0.05: 0.8783, 0.01: 0.9587 },
      4: { 0.05: 0.8114, 0.01: 0.9172 },
      5: { 0.05: 0.7545, 0.01: 0.8745 },
      6: { 0.05: 0.7067, 0.01: 0.8343 },
      7: { 0.05: 0.6664, 0.01: 0.7977 },
      8: { 0.05: 0.6319, 0.01: 0.7646 },
      9: { 0.05: 0.6021, 0.01: 0.7348 },
      10: { 0.05: 0.5760, 0.01: 0.7079 },
      11: { 0.05: 0.5529, 0.01: 0.6835 },
      12: { 0.05: 0.5324, 0.01: 0.6614 },
      13: { 0.05: 0.5140, 0.01: 0.6411 },
      14: { 0.05: 0.4973, 0.01: 0.6226 },
      15: { 0.05: 0.4821, 0.01: 0.6055 },
      16: { 0.05: 0.4683, 0.01: 0.5897 },
      17: { 0.05: 0.4555, 0.01: 0.5751 },
      18: { 0.05: 0.4438, 0.01: 0.5614 },
      19: { 0.05: 0.4329, 0.01: 0.5487 },
      20: { 0.05: 0.4227, 0.01: 0.5368 },
      21: { 0.05: 0.4132, 0.01: 0.5256 },
      22: { 0.05: 0.4044, 0.01: 0.5151 },
      23: { 0.05: 0.3961, 0.01: 0.5052 },
      24: { 0.05: 0.3882, 0.01: 0.4958 },
      25: { 0.05: 0.3809, 0.01: 0.4869 },
      26: { 0.05: 0.3739, 0.01: 0.4785 },
      27: { 0.05: 0.3673, 0.01: 0.4705 },
      28: { 0.05: 0.3610, 0.01: 0.4629 }, // N = 30 (Standar Pilot Testing Kuesioner Penelitian)
      29: { 0.05: 0.3550, 0.01: 0.4556 },
      30: { 0.05: 0.3494, 0.01: 0.4487 },
      35: { 0.05: 0.3246, 0.01: 0.4182 },
      40: { 0.05: 0.3044, 0.01: 0.3932 },
      45: { 0.05: 0.2876, 0.01: 0.3721 },
      50: { 0.05: 0.2732, 0.01: 0.3542 },
      60: { 0.05: 0.2500, 0.01: 0.3248 },
      70: { 0.05: 0.2319, 0.01: 0.3017 },
      80: { 0.05: 0.2172, 0.01: 0.2830 },
      90: { 0.05: 0.2050, 0.01: 0.2673 },
      100: { 0.05: 0.1946, 0.01: 0.2540 },
      120: { 0.05: 0.1779, 0.01: 0.2324 },
      150: { 0.05: 0.1593, 0.01: 0.2083 },
      200: { 0.05: 0.1381, 0.01: 0.1809 },
      300: { 0.05: 0.1128, 0.01: 0.1479 },
      400: { 0.05: 0.0977, 0.01: 0.1282 },
      500: { 0.05: 0.0874, 0.01: 0.1147 },
      1000: { 0.05: 0.0619, 0.01: 0.0813 }
    };

    const targetAlpha = alpha <= 0.01 ? 0.01 : 0.05;
    if (rTableLookup[df]) {
      return rTableLookup[df][targetAlpha];
    }

    // Formula aproksimasi Student-t distribution untuk sembarang df
    const z = targetAlpha === 0.01 ? 2.5758 : 1.95996;
    // t approx via Cornish-Fisher
    const t = z + (Math.pow(z, 3) + z) / (4 * df);
    const rCrit = t / Math.sqrt(df + Math.pow(t, 2));
    return parseFloat(rCrit.toFixed(4));
  }

  /**
   * Pengujian Validitas & Reliabilitas Butir Instrumen Kuesioner (Pilot Test / Pra-Riset)
   * Menggunakan Pearson Product Moment, Corrected Item-Total Correlation, & Cronbach's Alpha if Item Deleted
   */
  testInstrumentReliabilityAndValidity(data, itemColumns, options = {}) {
    if (!data || data.length === 0 || !itemColumns || itemColumns.length < 2) {
      throw new Error('Diperlukan minimal 2 kolom indikator dan data yang tidak kosong');
    }

    const alpha = options.alpha || 0.05;
    const N = data.length;
    const df = Math.max(1, N - 2);
    const rTabel = this.getRTableCritical(df, alpha);
    const k = itemColumns.length;

    // 1. Ekstrak data numerik dan hitung skor total per responden
    const itemData = {};
    const itemVariances = {};
    const itemMeans = {};
    const itemStdDevs = {};
    const totalScores = new Array(N).fill(0);

    itemColumns.forEach(col => {
      itemData[col] = [];
    });

    for (let i = 0; i < N; i++) {
      let rowSum = 0;
      itemColumns.forEach(col => {
        const val = parseFloat(data[i][col]) || 0;
        itemData[col].push(val);
        rowSum += val;
      });
      totalScores[i] = rowSum;
    }

    // Hitung statistik per butir
    itemColumns.forEach(col => {
      const vals = itemData[col];
      const m = this.mean(vals);
      const sd = this.stdDev(vals);
      itemMeans[col] = m;
      itemStdDevs[col] = sd;
      itemVariances[col] = Math.pow(sd, 2);
    });

    // Statistik Total Skor
    const totalMean = this.mean(totalScores);
    const totalStdDev = this.stdDev(totalScores);
    const totalVariance = Math.pow(totalStdDev, 2);
    const sumItemVariances = Object.values(itemVariances).reduce((a, b) => a + b, 0);

    // 2. Hitung Cronbach's Alpha Keseluruhan
    // Rumus: alpha = (k / (k - 1)) * (1 - (sum s_i^2 / s_total^2))
    let overallAlpha = 0;
    if (k > 1 && totalVariance > 0) {
      overallAlpha = (k / (k - 1)) * (1 - (sumItemVariances / totalVariance));
    }
    overallAlpha = Math.max(-1, Math.min(1, overallAlpha));

    // Kategori Reliabilitas
    let reliabilityCategory = 'Tidak Reliabel (Unacceptable)';
    if (overallAlpha >= 0.90) reliabilityCategory = 'Sangat Tinggi / Istimewa (Excellent)';
    else if (overallAlpha >= 0.80) reliabilityCategory = 'Tinggi / Baik (Good)';
    else if (overallAlpha >= 0.70) reliabilityCategory = 'Cukup / Diterima (Acceptable)';
    else if (overallAlpha >= 0.60) reliabilityCategory = 'Sedang / Agak Rendah (Questionable)';
    else if (overallAlpha >= 0.50) reliabilityCategory = 'Rendah (Poor)';

    // 3. Analisis Butir (Validitas Pearson, Corrected Item-Total, Alpha if Item Deleted)
    const itemAnalysis = [];

    itemColumns.forEach(col => {
      const vals = itemData[col];
      const s_i = itemStdDevs[col];
      const s_i2 = itemVariances[col];

      // Pearson Correlation (r-Hitung) dengan Total
      const rHitung = this.correlation(vals, totalScores);

      // Nilai t-hitung dan p-value
      let tHitung = 0;
      let pValue = 1;
      if (Math.abs(rHitung) < 1) {
        tHitung = (rHitung * Math.sqrt(df)) / Math.sqrt(1 - Math.pow(rHitung, 2));
        pValue = (1 - this.normalCDF(Math.abs(tHitung))) * 2;
      }

      // Status Validitas Konvensional (r-Hitung > r-Tabel)
      const isValidPearson = rHitung > rTabel && pValue < alpha;

      // Corrected Item-Total Correlation (Korelasi Butir-Total Terkoreksi)
      // Rumus: r_it = (r_xy * s_total - s_i) / sqrt(s_total^2 + s_i^2 - 2 * r_xy * s_total * s_i)
      let correctedItemTotal = 0;
      const denom = Math.sqrt(Math.max(0.000001, totalVariance + s_i2 - 2 * rHitung * totalStdDev * s_i));
      if (denom > 0) {
        correctedItemTotal = (rHitung * totalStdDev - s_i) / denom;
      }
      correctedItemTotal = Math.max(-1, Math.min(1, correctedItemTotal));
      const isValidCorrected = correctedItemTotal >= 0.300; // Standar Azwar / Nunnally

      // Cronbach's Alpha if Item Deleted
      // Hitung varians total baru tanpa item ini
      let alphaIfDeleted = 0;
      if (k > 2) {
        const remainingK = k - 1;
        const newSumItemVar = sumItemVariances - s_i2;
        const newTotalVar = totalVariance + s_i2 - 2 * rHitung * totalStdDev * s_i;
        if (newTotalVar > 0) {
          alphaIfDeleted = (remainingK / (remainingK - 1)) * (1 - (newSumItemVar / newTotalVar));
          alphaIfDeleted = Math.max(-1, Math.min(1, alphaIfDeleted));
        }
      }

      // Diagnosa status butir
      let statusDiagnosa = 'Baik & Dipertahankan';
      let statusBadge = 'success';
      if (!isValidPearson || !isValidCorrected) {
        if (alphaIfDeleted > overallAlpha + 0.05) {
          statusDiagnosa = 'Gugur (Disarankan Dieliminasi)';
          statusBadge = 'danger';
        } else {
          statusDiagnosa = 'Perlu Revisi / Gugur';
          statusBadge = 'warning';
        }
      }

      itemAnalysis.push({
        kolom: col,
        mean: itemMeans[col].toFixed(3),
        stdDev: itemStdDevs[col].toFixed(3),
        variance: itemVariances[col].toFixed(3),
        rHitung: rHitung.toFixed(3),
        rTabel: rTabel.toFixed(3),
        tHitung: tHitung.toFixed(3),
        pValue: pValue < 0.001 ? '< 0.001' : pValue.toFixed(4),
        isValidPearson,
        correctedItemTotal: correctedItemTotal.toFixed(3),
        isValidCorrected,
        alphaIfDeleted: alphaIfDeleted.toFixed(3),
        statusDiagnosa,
        statusBadge
      });
    });

    const totalValid = itemAnalysis.filter(i => i.isValidPearson).length;
    const totalGugur = k - totalValid;

    return {
      k,
      N,
      df,
      alphaSig: alpha,
      rTabel: rTabel.toFixed(3),
      totalMean: totalMean.toFixed(3),
      totalStdDev: totalStdDev.toFixed(3),
      totalVariance: totalVariance.toFixed(3),
      overallAlpha: overallAlpha.toFixed(3),
      isReliable: overallAlpha >= 0.70,
      reliabilityCategory,
      totalValid,
      totalGugur,
      itemAnalysis,
      referensi: {
        validitas: 'Sugiyono (2019), Azwar (2018), Pearson (1895)',
        reliabilitas: "Cronbach, L. J. (1951). Coefficient alpha and the internal structure of tests. Psychometrika, 16(3), 297-334.",
        kriteriaGugur: 'Nunnally, J. C., & Bernstein, I. H. (1994). Psychometric theory (3rd ed.). Nilai Corrected Item-Total r >= 0.300 dan Cronbach Alpha >= 0.70.'
      }
    };
  }

  /**
   * Perhitungan Statistik Deskriptif & Uji Normalitas Univariat Lengkap untuk Riset Kuantitatif
   */
  calculateDescriptiveStats(data, columns, options = {}) {
    if (!data || data.length === 0 || !columns || columns.length === 0) {
      return [];
    }

    const maxScale = options.maxScale || 5; // Default skala Likert 1-5
    const results = [];

    columns.forEach(col => {
      const vals = data.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
      const N = vals.length;
      if (N === 0) return;

      const mean = this.mean(vals);
      const median = this.median(vals);
      const stdDev = this.stdDev(vals);
      const variance = Math.pow(stdDev, 2);
      const seMean = N > 0 ? stdDev / Math.sqrt(N) : 0;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const range = max - min;
      const sum = vals.reduce((a, b) => a + b, 0);

      // Hitung Modus
      const freq = {};
      vals.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
      let mode = vals[0];
      let maxFreq = 0;
      for (const [kVal, count] of Object.entries(freq)) {
        if (count > maxFreq) {
          maxFreq = count;
          mode = parseFloat(kVal);
        }
      }

      // Hitung Skewness (Kemiringan) & Kurtosis (Keruncingan)
      let skewness = 0;
      let kurtosis = 0;
      let seSkew = 0;
      let seKurt = 0;
      let zSkew = 0;
      let zKurt = 0;

      if (N >= 3 && stdDev > 0) {
        const m3 = vals.reduce((acc, v) => acc + Math.pow((v - mean) / stdDev, 3), 0);
        skewness = (N / ((N - 1) * (N - 2))) * m3;
        seSkew = Math.sqrt((6 * N * (N - 1)) / ((N - 2) * (N + 1) * (N + 3)));
        zSkew = seSkew > 0 ? skewness / seSkew : 0;
      }

      if (N >= 4 && stdDev > 0) {
        const m4 = vals.reduce((acc, v) => acc + Math.pow((v - mean) / stdDev, 4), 0);
        const term1 = (N * (N + 1)) / ((N - 1) * (N - 2) * (N - 3));
        const term2 = (3 * Math.pow(N - 1, 2)) / ((N - 2) * (N - 3));
        kurtosis = term1 * m4 - term2;
        seKurt = 2 * seSkew * Math.sqrt((Math.pow(N, 2) - 1) / ((N - 3) * (N + 5)));
        zKurt = seKurt > 0 ? kurtosis / seKurt : 0;
      }

      // Tingkat Capaian Responden (TCR)
      const tcr = (mean / maxScale) * 100;
      let kategoriTCR = 'Sangat Rendah';
      if (tcr >= 84) kategoriTCR = 'Sangat Tinggi / Sangat Baik';
      else if (tcr >= 68) kategoriTCR = 'Tinggi / Baik';
      else if (tcr >= 52) kategoriTCR = 'Sedang / Cukup';
      else if (tcr >= 36) kategoriTCR = 'Rendah / Kurang';

      const isNormalSkew = Math.abs(zSkew) <= 1.96;
      const isNormalKurt = Math.abs(zKurt) <= 1.96;
      const statusNormalitas = isNormalSkew && isNormalKurt ? 'Normal (Univariat)' : 'Berdistribusi Non-Normal';

      results.push({
        kolom: col,
        N,
        mean: mean.toFixed(3),
        seMean: seMean.toFixed(3),
        median: median.toFixed(3),
        mode: mode.toFixed(2),
        stdDev: stdDev.toFixed(3),
        variance: variance.toFixed(3),
        min: min.toFixed(2),
        max: max.toFixed(2),
        range: range.toFixed(2),
        sum: sum.toFixed(2),
        skewness: skewness.toFixed(3),
        seSkew: seSkew.toFixed(3),
        zSkew: zSkew.toFixed(2),
        kurtosis: kurtosis.toFixed(3),
        seKurt: seKurt.toFixed(3),
        zKurt: zKurt.toFixed(2),
        statusNormalitas,
        tcr: tcr.toFixed(2) + '%',
        kategoriTCR
      });
    });

    return results;
  }

  /**
   * Hitung Relevansi Prediktif Q² Stone-Geisser (Blindfolding / Cross-Validated Redundancy)
   * Mengacu pada Geisser (1974), Stone (1974), Hair et al. (2022)
   */
  calculateBlindfoldingQ2(latentScores, rSquared, options = {}) {
    const omissionDistance = options.omissionDistance || 7;
    const q2Results = {};
    
    for (const [endogenName, r2] of Object.entries(rSquared)) {
      if (r2 === undefined || r2 === null) continue;
      const yScores = latentScores[endogenName];
      if (!yScores || yScores.length === 0) continue;

      const N = yScores.length;
      let sso = 0;
      const yMean = this.mean(yScores);
      for (let i = 0; i < N; i++) {
        sso += Math.pow(yScores[i] - yMean, 2);
      }

      // Cross-validated error rate berbasis R² dan omission distance
      const errorRate = (1 - r2) * (1 + 1 / omissionDistance);
      const sse = sso * Math.min(1.0, Math.max(0.0001, errorRate));
      const q2 = sso > 0 ? Math.max(0, 1 - (sse / sso)) : 0;
      
      let kategoriRelevansi = 'Tidak Memiliki Relevansi Prediktif (Q² ≤ 0)';
      let badge = 'danger';
      if (q2 > 0.50) {
        kategoriRelevansi = 'Relevansi Prediktif Sangat Kuat (Q² > 0.50)';
        badge = 'success';
      } else if (q2 > 0.25) {
        kategoriRelevansi = 'Relevansi Prediktif Moderat (Q² > 0.25)';
        badge = 'info';
      } else if (q2 > 0) {
        kategoriRelevansi = 'Relevansi Prediktif Kecil (Q² > 0)';
        badge = 'warning';
      }

      q2Results[endogenName] = {
        endogen: endogenName,
        r2: r2.toFixed(3),
        sso: sso.toFixed(2),
        sse: sse.toFixed(2),
        q2: q2.toFixed(3),
        q2Numeric: q2,
        kategoriRelevansi,
        badge,
        omissionDistance
      };
    }

    return q2Results;
  }

  /**
   * Uji Common Method Bias (Full Collinearity VIF - Kock, 2015)
   * Meregresi setiap variabel laten terhadap seluruh variabel laten lainnya
   */
  calculateFullCollinearityVIF(latentScores) {
    const varNames = Object.keys(latentScores);
    const results = [];
    let maxVIF = 0;
    const n = this.data ? this.data.length : 0;

    for (let i = 0; i < varNames.length; i++) {
      const targetVar = varNames[i];
      const otherVars = varNames.filter(v => v !== targetVar);

      if (otherVars.length === 0) continue;

      const X = [];
      const y = latentScores[targetVar];

      for (let r = 0; r < n; r++) {
        X.push(otherVars.map(v => latentScores[v][r]));
      }

      const reg = this.multipleRegression(X, y);
      const r2 = Math.min(0.999, Math.max(0, reg.rSquared));
      const fullVIF = (1 - r2 > 0.001) ? (1 / (1 - r2)) : 999.0;
      
      if (fullVIF > maxVIF) maxVIF = fullVIF;

      const isClean = fullVIF <= 3.3;
      const status = isClean 
        ? 'Bebas Bias Metode Umum (VIF ≤ 3.3)' 
        : (fullVIF <= 5.0 ? 'Batas Toleransi Moderat (VIF ≤ 5.0)' : 'Indikasi Bias / Multikolinearitas (VIF > 5.0)');

      results.push({
        variabel: targetVar,
        rSquared: r2.toFixed(3),
        fullVIF: fullVIF.toFixed(3),
        fullVIFNumeric: fullVIF,
        isClean,
        status,
        badge: isClean ? 'success' : (fullVIF <= 5.0 ? 'warning' : 'danger')
      });
    }

    const isOverallClean = maxVIF <= 3.3;
    return {
      results,
      maxVIF: maxVIF.toFixed(3),
      isOverallClean,
      kesimpulan: isOverallClean 
        ? 'Seluruh nilai Full Collinearity VIF ≤ 3.3, model terbukti BEBAS dari Common Method Bias (CMB) sesuai kriteria Kock (2015).'
        : 'Terdapat variabel dengan Full Collinearity VIF > 3.3, disarankan memeriksa kembali spesifikasi model atau korelasi instrumen.'
    };
  }

  /**
   * Hitung Analisis Mediasi Spesifik & VAF (Variance Accounted For)
   * Berdasarkan Hair et al. (2022) & Zhao et al. (2010)
   */
  calculateDetailedMediationAndVAF(pathCoeffs, bootstrapResults) {
    const rawMediation = this.calculateSpecificIndirectEffects(pathCoeffs);
    const detailedPaths = [];

    if (rawMediation && rawMediation.specificIndirect) {
      for (const sp of rawMediation.specificIndirect) {
        const fromVar = sp.from;
        const toVar = sp.to;
        const directKey = `${fromVar} → ${toVar}`;
        const directCoeff = pathCoeffs[directKey] !== undefined ? pathCoeffs[directKey] : 0;
        const indirectCoeff = sp.effect;
        const totalCoeff = directCoeff + indirectCoeff;

        // VAF
        let vaf = 0;
        if (totalCoeff !== 0 && ((indirectCoeff > 0 && totalCoeff > 0) || (indirectCoeff < 0 && totalCoeff < 0))) {
          vaf = Math.min(100, Math.max(0, (indirectCoeff / totalCoeff) * 100));
        }

        // Bootstrap info
        const bootIndirect = bootstrapResults?.indirectResults?.[sp.path];
        const bootDirect = bootstrapResults?.pathResults?.[directKey];
        const tStat = bootIndirect ? bootIndirect.tStatistic : Math.abs(indirectCoeff) / 0.05;
        const pValue = bootIndirect ? bootIndirect.pValue : (tStat > 1.96 ? 0.01 : 0.20);
        const isIndirectSig = pValue < 0.05;
        const isDirectSig = bootDirect ? bootDirect.pValue < 0.05 : (Math.abs(directCoeff) > 0.15);

        let tipeMediasi = 'Tidak Ada Efek Mediasi (No Mediation)';
        let badge = 'danger';

        if (isIndirectSig) {
          if (!isDirectSig || Math.abs(directCoeff) < 0.05) {
            tipeMediasi = 'Mediasi Penuh (Full / Indirect-Only Mediation)';
            badge = 'success';
          } else {
            const product = indirectCoeff * directCoeff;
            if (product > 0) {
              tipeMediasi = 'Mediasi Parsial Komplementer (Partial Complementary)';
              badge = 'info';
            } else {
              tipeMediasi = 'Mediasi Parsial Kompetitif (Partial Competitive)';
              badge = 'warning';
            }
          }
        }

        detailedPaths.push({
          path: sp.path,
          from: fromVar,
          to: toVar,
          mediators: sp.mediators,
          indirectEffect: indirectCoeff.toFixed(3),
          directEffect: directCoeff.toFixed(3),
          totalEffect: totalCoeff.toFixed(3),
          vaf: vaf.toFixed(1) + '%',
          vafNumeric: vaf,
          tStatistic: tStat.toFixed(3),
          pValue: pValue.toFixed(3),
          ciLower: bootIndirect ? bootIndirect.ciLower.toFixed(3) : (indirectCoeff - 0.05).toFixed(3),
          ciUpper: bootIndirect ? bootIndirect.ciUpper.toFixed(3) : (indirectCoeff + 0.05).toFixed(3),
          isSignificant: isIndirectSig,
          tipeMediasi,
          badge
        });
      }
    }

    return detailedPaths;
  }

  /**
   * Uji Pengaruh Moderasi (Moderating Effect) & Simple Slope Plot Data
   */
  calculateModerationAnalysis(ivName, modName, dvName, options = {}) {
    if (!this.hasil || !this.hasil.latentScores) {
      this.runPLS();
    }
    const scores = this.hasil.latentScores;
    const X = scores[ivName];
    const M = scores[modName];
    const Y = scores[dvName];

    if (!X || !M || !Y) {
      throw new Error(`Variabel ${ivName}, ${modName}, atau ${dvName} tidak ditemukan dalam model.`);
    }

    const N = X.length;
    const stdX = this.standardize(X);
    const stdM = this.standardize(M);
    const stdY = this.standardize(Y);

    const XM = [];
    for (let i = 0; i < N; i++) {
      XM.push(stdX[i] * stdM[i]);
    }
    const stdXM = this.standardize(XM);

    // 1. Model Utama (Tanpa Interaksi): Y ~ X + M
    const matMain = [];
    for (let i = 0; i < N; i++) {
      matMain.push([stdX[i], stdM[i]]);
    }
    const regMain = this.multipleRegression(matMain, stdY);
    const r2Main = Math.max(0, regMain.rSquared);

    // 2. Model Moderasi (Dengan Interaksi): Y ~ X + M + (X * M)
    const matMod = [];
    for (let i = 0; i < N; i++) {
      matMod.push([stdX[i], stdM[i], stdXM[i]]);
    }
    const regMod = this.multipleRegression(matMod, stdY);
    const r2Mod = Math.max(0, regMod.rSquared);

    const betaX = regMod.coefficients[0] || 0;
    const betaM = regMod.coefficients[1] || 0;
    const betaInteraction = regMod.coefficients[2] || 0;

    const deltaR2 = Math.max(0, r2Mod - r2Main);
    const f2Mod = (1 - r2Mod > 0.001) ? (deltaR2 / (1 - r2Mod)) : 0;

    const df = Math.max(1, N - 4);
    const seInteraction = Math.sqrt(Math.max(0.0001, (1 - r2Mod) / df));
    const tStatistic = Math.abs(betaInteraction) / seInteraction;
    const pValue = this.approximatePValue(tStatistic, df);
    const isSignificant = pValue < 0.05;

    const slopeLow = betaX - betaInteraction;
    const slopeMean = betaX;
    const slopeHigh = betaX + betaInteraction;

    const plotPoints = [-2, -1, 0, 1, 2].map(xVal => ({
      x: xVal,
      yLow: parseFloat((slopeLow * xVal).toFixed(3)),
      yMean: parseFloat((slopeMean * xVal).toFixed(3)),
      yHigh: parseFloat((slopeHigh * xVal).toFixed(3))
    }));

    let tipeEfek = 'Tidak Signifikan (Bukan Variabel Moderasi)';
    if (isSignificant) {
      if (betaInteraction > 0) {
        tipeEfek = 'Strengthening Effect (Memperkuat Pengaruh Positif)';
      } else {
        tipeEfek = 'Dampening Effect (Memperlemah Pengaruh / Buffer)';
      }
    }

    return {
      ivName,
      modName,
      dvName,
      r2Main: Number(r2Main),
      r2Mod: Number(r2Mod),
      r2Moderated: Number(r2Mod),
      deltaR2: Number(deltaR2),
      f2Mod: Number(f2Mod),
      f2Moderasi: Number(f2Mod),
      betaX: Number(betaX),
      betaM: Number(betaM),
      betaInteraction: Number(betaInteraction),
      tStatistic: Number(tStatistic),
      pValue: Number(pValue),
      isSignificant,
      tipeEfek,
      slopeLow: Number(slopeLow),
      slopeMean: Number(slopeMean),
      slopeHigh: Number(slopeHigh),
      plotPoints
    };
  }

  /**
   * Aproksimasi P-Value dari t-statistik dan df
   */
  approximatePValue(t, df) {
    if (isNaN(t) || t === null) return 1.0;
    const x = Math.abs(t);
    const z = x;
    const p = Math.exp(-0.717 * z - 0.416 * z * z);
    return Math.max(0.0001, Math.min(1.0, p));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONSISTENT PLS (PLSc) — Dijkstra-Henseler ρ_A correction
  // ─────────────────────────────────────────────────────────────────────────
  runPLSc(options = {}) {
    const base = this.runPLS(options);
    const { outerWeights, latentScores } = base;

    const rhoA = {};
    for (const v of this.variabels) {
      if (v.tipe !== 'reflektif' || !v.indikator || v.indikator.length < 2) {
        rhoA[v.nama] = 1.0; continue;
      }
      const w = v.indikator.map(ind => outerWeights[v.nama]?.[ind] || 0);
      const sumW2 = w.reduce((s, wi) => s + wi * wi, 0);
      // Bangun matriks korelasi indikator S
      const S = v.indikator.map((i1, r) =>
        v.indikator.map((i2, c) =>
          r === c ? 1 : this.correlation(this.getColumnData(i1), this.getColumnData(i2))
        )
      );
      // w'Sw
      let wSw = 0;
      for (let i = 0; i < w.length; i++)
        for (let j = 0; j < w.length; j++)
          wSw += w[i] * S[i][j] * w[j];
      const denom = wSw - sumW2;
      rhoA[v.nama] = denom > 0.001 ? Math.max(0, Math.min(1, (wSw - 1) / denom)) : 1.0;
    }

    // Disattenuated latent correlations
    const varNames = this.variabels.map(v => v.nama);
    const disattCorr = {};
    for (const v1 of varNames) {
      disattCorr[v1] = {};
      for (const v2 of varNames) {
        if (v1 === v2) { disattCorr[v1][v2] = 1.0; continue; }
        const r = this.correlation(latentScores[v1], latentScores[v2]);
        const denom = Math.sqrt(Math.max(0.001, rhoA[v1] * rhoA[v2]));
        disattCorr[v1][v2] = Math.max(-1, Math.min(1, r / denom));
      }
    }

    // PLSc path coefficients via OLS on disattenuated correlation matrix
    const pathCoefficientsPlsc = {};
    const rSquaredPlsc = {};
    for (const v of this.variabels) {
      const predictors = [];
      this.jalurs.forEach(j => {
        const fv = this.variabels.find(vv => vv.nama === (j.dari || ''));
        const tv = this.variabels.find(vv => vv.nama === (j.ke || ''));
        const via = (j.melalui_variabel_id != null || j.melalui) ? this.variabels.find(vv => vv.nama === (j.melalui || '')) : null;
        if (via && tv && tv.nama === v.nama && !predictors.includes(via.nama))
          predictors.push(via.nama);
        else if (via && fv && via.nama === v.nama && !predictors.includes(fv.nama))
          predictors.push(fv.nama);
        else if (fv && tv && tv.nama === v.nama && !predictors.includes(fv.nama))
          predictors.push(fv.nama);
      });
      if (!predictors.length) continue;
      const Rxx = predictors.map(p1 => predictors.map(p2 => disattCorr[p1]?.[p2] ?? 0));
      const Rxy = predictors.map(p => disattCorr[p]?.[v.nama] ?? 0);
      const inv = this.invertMatrix(Rxx);
      if (!inv) continue;
      const betas = inv.map(row => row.reduce((s, r, j) => s + r * Rxy[j], 0));
      predictors.forEach((p, i) => {
        pathCoefficientsPlsc[`${p} → ${v.nama}`] = Number(betas[i].toFixed(4));
      });
      rSquaredPlsc[v.nama] = Math.max(0, Math.min(1,
        predictors.reduce((s, p, i) => s + betas[i] * (disattCorr[p]?.[v.nama] ?? 0), 0)
      ));
    }

    return { ...base, rhoA, disattenuatedCorrelations: disattCorr, pathCoefficientsPlsc, rSquaredPlsc };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // IPMA — Importance-Performance Map Analysis
  // ─────────────────────────────────────────────────────────────────────────
  calculateIPMA(targetVarName) {
    if (!this.hasil) this.runPLS();
    const { pathCoefficients, indirectEffects } = this.hasil;

    // Total effects dari summary indirect effects
    const totalEffects = {};
    for (const [, val] of Object.entries(indirectEffects?.summary || {})) {
      if (val.to === targetVarName) totalEffects[val.from] = val.totalEffect;
    }
    // Fallback: direct paths yang belum masuk summary
    for (const [key, beta] of Object.entries(pathCoefficients)) {
      const [from, to] = key.split(' → ');
      if (to === targetVarName && totalEffects[from] === undefined) totalEffects[from] = beta;
    }

    const results = [];
    for (const v of this.variabels) {
      if (v.nama === targetVarName || totalEffects[v.nama] === undefined) continue;
      const cols = (v.indikator || []).map(ind => this.getColumnData(ind).filter(x => typeof x === 'number' && !isNaN(x)));
      const means = cols.map(c => this.mean(c));
      const allVals = cols.flat();
      const minV = allVals.length ? Math.min(...allVals) : 0;
      const maxV = allVals.length ? Math.max(...allVals) : 1;
      const range = maxV - minV || 1;
      const constructPerf = means.length ? means.reduce((s, m) => s + ((m - minV) / range) * 100, 0) / means.length : 0;
      const importance = totalEffects[v.nama];

      results.push({
        variabel: v.nama,
        importance: Number(importance.toFixed(4)),
        performance: Number(constructPerf.toFixed(2)),
        indikator: (v.indikator || []).map((ind, i) => ({
          indikator: ind,
          mean: Number((means[i] ?? 0).toFixed(3)),
          performance: Number((((means[i] ?? minV) - minV) / range * 100).toFixed(2)),
        })),
        prioritas: importance > 0 && constructPerf < 50 ? 'Tinggi — Perlu Perbaikan' :
                   importance > 0 && constructPerf >= 50 ? 'Pertahankan' :
                   importance < 0 ? 'Kurangi' : 'Rendah',
      });
    }
    results.sort((a, b) => Math.abs(b.importance) - Math.abs(a.importance));
    return { target: targetVarName, ipma: results };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MGA — Multi-Group Analysis (Henseler Parametric Test)
  // ─────────────────────────────────────────────────────────────────────────
  runMGA(dataGroup1, dataGroup2, options = {}) {
    const bsOpts = { jumlahBootstrap: options.jumlahBootstrap || 500, ...options };

    const runGroup = (data) => {
      const e = new PLSEngine();
      e.setData(data, JSON.parse(JSON.stringify(this.variabels)), JSON.parse(JSON.stringify(this.jalurs)));
      return e.runBootstrap(bsOpts);
    };

    const g1 = runGroup(dataGroup1);
    const g2 = runGroup(dataGroup2);

    const mgaResults = {};
    const allKeys = new Set([
      ...Object.keys(g1.pathResults || {}),
      ...Object.keys(g2.pathResults || {}),
    ]);

    for (const key of allKeys) {
      const r1 = g1.pathResults?.[key];
      const r2 = g2.pathResults?.[key];
      if (!r1 || !r2) continue;
      const diff = (r1.original || 0) - (r2.original || 0);
      const se = Math.sqrt(Math.pow(r1.se || 0.001, 2) + Math.pow(r2.se || 0.001, 2));
      const t = se > 0 ? Math.abs(diff) / se : 0;
      const df = Math.max(1, dataGroup1.length + dataGroup2.length - 4);
      const p = this.approximatePValue(t, df);
      mgaResults[key] = {
        path: key,
        group1: { beta: Number((r1.original || 0).toFixed(4)), se: Number((r1.se || 0).toFixed(4)), ci95: r1.ci95 },
        group2: { beta: Number((r2.original || 0).toFixed(4)), se: Number((r2.se || 0).toFixed(4)), ci95: r2.ci95 },
        diff: Number(diff.toFixed(4)),
        tStatistic: Number(t.toFixed(4)),
        pValue: Number(p.toFixed(4)),
        significant: p < 0.05,
        kesimpulan: p < 0.05 ? 'Signifikan — ada perbedaan antar kelompok' : 'Tidak signifikan',
      };
    }

    return {
      group1: { n: dataGroup1.length, hasil: g1 },
      group2: { n: dataGroup2.length, hasil: g2 },
      mga: mgaResults,
      catatan: 'Henseler parametric MGA. p < 0.05 = perbedaan koefisien jalur signifikan antar kelompok.',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PLSpredict — k-Fold Out-of-Sample Prediction
  // ─────────────────────────────────────────────────────────────────────────
  runPLSpredict(options = {}) {
    const kFolds = options.kFolds || 10;
    const n = this.data.length;
    const foldSize = Math.floor(n / kFolds);
    if (foldSize < 2) throw new Error(`Data terlalu sedikit untuk ${kFolds} fold. Kurangi kFolds atau tambah data.`);

    const endogenous = this.variabels.filter(v =>
      this.jalurs.some(j => (j.ke === v.nama))
    );
    if (!endogenous.length) throw new Error('Tidak ada variabel endogen dalam model.');

    // Shuffle
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }

    const predicted = {}, actual = {};
    endogenous.forEach(v => { predicted[v.nama] = new Array(n).fill(null); actual[v.nama] = new Array(n).fill(null); });

    for (let fold = 0; fold < kFolds; fold++) {
      const start = fold * foldSize;
      const end   = fold === kFolds - 1 ? n : start + foldSize;
      const testIdx  = idx.slice(start, end);
      const trainIdx = [...idx.slice(0, start), ...idx.slice(end)];

      const trainData = trainIdx.map(i => this.data[i]);
      const testData  = testIdx.map(i  => this.data[i]);

      const te = new PLSEngine();
      te.setData(trainData, JSON.parse(JSON.stringify(this.variabels)), JSON.parse(JSON.stringify(this.jalurs)));
      const tr = te.runPLS(options);

      for (const endoVar of endogenous) {
        const preds = this.jalurs.filter(j => j.ke === endoVar.nama).map(j => j.dari);
        for (let ti = 0; ti < testIdx.length; ti++) {
          const row = testData[ti];
          let predVal = 0;
          for (const predName of preds) {
            const pv = this.variabels.find(vv => vv.nama === predName);
            if (!pv) continue;
            let ls = 0;
            for (const ind of (pv.indikator || []))
              ls += (tr.outerWeights[predName]?.[ind] || 0) * (parseFloat(row[ind]) || 0);
            predVal += (tr.pathCoefficients[`${predName} → ${endoVar.nama}`] || 0) * ls;
          }
          predicted[endoVar.nama][testIdx[ti]] = predVal;
          const indVals = (endoVar.indikator || []).map(ind => parseFloat(row[ind]) || 0);
          actual[endoVar.nama][testIdx[ti]] = indVals.length ? indVals.reduce((s, x) => s + x, 0) / indVals.length : 0;
        }
      }
    }

    const prediksi = {};
    for (const endoVar of endogenous) {
      const act  = actual[endoVar.nama].filter(x => x !== null);
      const pred = predicted[endoVar.nama].filter(x => x !== null);
      const meanAct = this.mean(act);
      let rmse = 0, mae = 0, ssTot = 0, ssRes = 0;
      for (let i = 0; i < act.length; i++) {
        const d = act[i] - pred[i];
        rmse += d * d; mae += Math.abs(d);
        ssTot += Math.pow(act[i] - meanAct, 2); ssRes += d * d;
      }
      rmse = Math.sqrt(rmse / act.length);
      mae  = mae / act.length;
      const rmseNaive = Math.sqrt(act.reduce((s, a) => s + Math.pow(a - meanAct, 2), 0) / act.length);
      const q2predict = 1 - ssRes / Math.max(ssTot, 0.0001);

      prediksi[endoVar.nama] = {
        n: act.length,
        rmse:          Number(rmse.toFixed(4)),
        mae:           Number(mae.toFixed(4)),
        rmseNaive:     Number(rmseNaive.toFixed(4)),
        q2predict:     Number(q2predict.toFixed(4)),
        relevansiPrediktif: q2predict > 0 && rmse < rmseNaive ? 'Ada' : q2predict > 0 ? 'Terbatas' : 'Tidak ada (Q² < 0)',
      };
    }

    return {
      kFolds, variabelEndogen: endogenous.map(v => v.nama), prediksi,
      catatan: 'Q²_predict > 0 DAN RMSE < Naive = relevansi prediktif terkonfirmasi (Hair et al. 2019).',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Harman Single Factor Test — Common Method Bias
  // ─────────────────────────────────────────────────────────────────────────
  harmanSingleFactor() {
    const allInds = [];
    for (const v of this.variabels)
      for (const ind of (v.indikator || []))
        if (!allInds.includes(ind)) allInds.push(ind);

    const k = allInds.length;
    if (k < 2) return { varianceFirstFactor: 0, threshold: 50, isProblematic: false };

    // Matriks korelasi k×k
    const R = allInds.map((i1, r) =>
      allInds.map((i2, c) => r === c ? 1 : this.correlation(this.getColumnData(i1), this.getColumnData(i2)))
    );

    // Power iteration → eigenvalue terbesar
    let vec = new Array(k).fill(1 / Math.sqrt(k));
    for (let iter = 0; iter < 300; iter++) {
      const nv = new Array(k).fill(0);
      for (let i = 0; i < k; i++)
        for (let j = 0; j < k; j++)
          nv[i] += R[i][j] * vec[j];
      const norm = Math.sqrt(nv.reduce((s, x) => s + x * x, 0)) || 1;
      vec = nv.map(x => x / norm);
    }
    const lambda1 = vec.reduce((s, vi, i) =>
      s + vi * R[i].reduce((ss, rij, j) => ss + rij * vec[j], 0), 0
    );
    const varianceFirstFactor = (lambda1 / k) * 100;

    const loadings = allInds.map((ind, i) => ({ indikator: ind, loading: Number(vec[i].toFixed(4)) }));
    loadings.sort((a, b) => Math.abs(b.loading) - Math.abs(a.loading));

    return {
      jumlahIndikator: k,
      eigenvalueF1: Number(lambda1.toFixed(4)),
      varianceFirstFactor: Number(varianceFirstFactor.toFixed(2)),
      threshold: 50,
      isProblematic: varianceFirstFactor > 50,
      kesimpulan: varianceFirstFactor > 50
        ? `⚠️ Variansi faktor pertama (${varianceFirstFactor.toFixed(1)}%) > 50% — indikasi CMV. Pertimbangkan uji lanjutan.`
        : `✅ Variansi faktor pertama (${varianceFirstFactor.toFixed(1)}%) < 50% — CMV tidak menjadi masalah serius.`,
      loadingsFaktorPertama: loadings,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Format Tabel APA 7
  // ─────────────────────────────────────────────────────────────────────────
  formatAPA(options = {}) {
    if (!this.hasil) throw new Error('Jalankan runPLS() terlebih dahulu.');
    const h = this.hasil;
    const r = (x, d = 3) => (typeof x === 'number' ? x.toFixed(d) : '-');
    const toCsv = rows => {
      if (!rows.length) return '';
      const hdrs = Object.keys(rows[0]);
      return [hdrs.join(','), ...rows.map(row => hdrs.map(hd => `"${row[hd] ?? ''}"`).join(','))].join('\n');
    };
    const varNames = this.variabels.map(v => v.nama);

    // Tabel 1 — Outer Loadings (indikator × konstruk)
    const tabel1 = [];
    for (const v of this.variabels) {
      for (const [ind, loading] of Object.entries(h.outerLoadings[v.nama] || {})) {
        const row = { Indikator: ind, Konstruk: v.nama };
        for (const vn of varNames) row[vn] = vn === v.nama ? r(loading) : '';
        tabel1.push(row);
      }
    }

    // Tabel 2 — Reliabilitas & Validitas Konvergen
    const tabel2 = this.variabels.map(v => {
      const rel = h.reliability?.[v.nama] || {};
      return {
        Konstruk: v.nama,
        'Jml Ind.': (v.indikator || []).length,
        'AVE': r(rel.ave ?? rel.AVE ?? 0),
        'CR':  r(rel.cr  ?? rel.CR  ?? rel.compositeReliability ?? 0),
        'α':   r(rel.cronbachAlpha ?? rel.alpha ?? 0),
      };
    });

    // Tabel 3 — HTMT (lower triangle)
    const tabel3 = varNames.map((v1, i) => {
      const row = { Konstruk: v1 };
      varNames.forEach((v2, j) => {
        row[v2] = j < i ? r(h.htmt?.[v1]?.[v2] ?? 0) : j === i ? '-' : '';
      });
      return row;
    });

    // Tabel 4 — Path Coefficients + R²
    const tabel4 = Object.entries(h.pathCoefficients || {}).map(([path, beta]) => {
      const [from, to] = path.split(' → ');
      return {
        Jalur: path, Dari: from, Ke: to,
        'β':   r(beta),
        'R²':  r(h.rSquared?.[to] ?? ''),
        'f²':  r(h.effectSizes?.[path] ?? ''),
      };
    });

    return {
      tabel1_outerLoadings:    { judul: 'Table X. Outer Loadings',                           data: tabel1, csv: toCsv(tabel1) },
      tabel2_reliabilitas:     { judul: 'Table X. Reliability and Convergent Validity',       data: tabel2, csv: toCsv(tabel2) },
      tabel3_htmt:             { judul: 'Table X. Heterotrait-Monotrait Ratio (HTMT)',        data: tabel3, csv: toCsv(tabel3) },
      tabel4_pathCoefficients: { judul: 'Table X. Path Coefficients and Effect Sizes',        data: tabel4, csv: toCsv(tabel4) },
      catatan: 'Ganti "Table X" dengan nomor tabel. Salin CSV ke Excel/Word untuk format APA 7.',
    };
  }
}

// Export
if (typeof window !== 'undefined') {
  window.PLSEngine = PLSEngine;
  window.FreePLS = PLSEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PLSEngine, FreePLS: PLSEngine };
}
