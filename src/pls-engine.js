/**
 * ============================================
 * FreePLS Indonesia - PLS-SEM Engine
 * Mesin perhitungan PLS-SEM
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
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /**
   * Hitung standar deviasi
   */
  stdDev(arr) {
    const m = this.mean(arr);
    const squaredDiffs = arr.map(v => Math.pow(v - m, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (arr.length - 1));
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
    const n = x.length;
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
    return denom === 0 ? 0 : sumXY / denom;
  }

  /**
   * Hitung kovarians
   */
  covariance(x, y) {
    const n = x.length;
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
   * Regresi linear berganda (OLS)
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
    
    // Invers X'X menggunakan eliminasi Gauss-Jordan
    const inv = this.invertMatrix(XtX);
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
    const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
    
    return { coefficients, rSquared };
  }

  /**
   * Invers matriks menggunakan Gauss-Jordan
   */
  invertMatrix(matrix) {
    const n = matrix.length;
    const augmented = matrix.map((row, i) => {
      const identity = new Array(n).fill(0);
      identity[i] = 1;
      return [...row, ...identity];
    });
    
    for (let col = 0; col < n; col++) {
      // Cari pivot terbesar
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
   * Ambil data kolom
   */
  getColumnData(columnName) {
    return this.data.map(row => {
      const val = parseFloat(row[columnName]);
      return isNaN(val) ? 0 : val;
    });
  }

  /**
   * Hitung skor variabel laten
   */
  calculateLatentScores(variabel) {
    const indicators = variabel.indikator;
    if (indicators.length === 0) return new Array(this.data.length).fill(0);
    
    const n = this.data.length;
    const scores = new Array(n).fill(0);
    
    // Simple averaging sebagai starting point
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
   * Jalankan Algoritma PLS
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
    const varCount = this.variabels.length;
    
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
      
      // Inner estimation (berdasarkan skema bobot)
      const innerWeights = {};
      for (const v of this.variabels) {
        innerWeights[v.nama] = {};
        for (const v2 of this.variabels) {
          if (v.nama === v2.nama) continue;
          
          const isConnected = this.jalurs.some(j => {
            const fromVar = this.variabels.find(vv => vv.id == j.dari_variabel_id || vv.nama === j.dari);
            const toVar = this.variabels.find(vv => vv.id == j.ke_variabel_id || vv.nama === j.ke);
            return (fromVar && toVar) && 
                   ((fromVar.nama === v.nama && toVar.nama === v2.nama) || 
                    (fromVar.nama === v2.nama && toVar.nama === v.nama));
          });
          
          if (isConnected) {
            if (weightScheme === 'centroid') {
              const corr = this.correlation(latentScores[v.nama], latentScores[v2.nama]);
              innerWeights[v.nama][v2.nama] = Math.sign(corr);
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
        if (v.indikator.length === 0) continue;
        
        const outerWeights = [];
        for (const ind of v.indikator) {
          const indData = this.getColumnData(ind);
          if (v.tipe === 'reflektif') {
            // Mode A: korelasi antara proxy dan indikator
            const corr = this.correlation(innerProxies[v.nama], indData);
            outerWeights.push(corr);
          } else {
            // Mode B: regresi berganda
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
    
    // ---- Langkah 3: Hitung Outer Loading & Weight ----
    const outerLoadings = {};
    const outerWeights = {};
    
    for (const v of this.variabels) {
      outerLoadings[v.nama] = {};
      outerWeights[v.nama] = {};
      
      for (const ind of v.indikator) {
        const indData = this.getColumnData(ind);
        const loading = this.correlation(indData, latentScores[v.nama]);
        outerLoadings[v.nama][ind] = loading;
        
        const reg = this.simpleRegression(latentScores[v.nama], indData);
        outerWeights[v.nama][ind] = reg.beta;
      }
    }
    
    // ---- Langkah 4: Hitung Path Coefficients & R² ----
    const pathCoefficients = {};
    const rSquared = {};
    
    for (const v of this.variabels) {
      const predictors = this.jalurs.filter(j => {
        const toVar = this.variabels.find(vv => vv.id == j.ke_variabel_id || vv.nama === j.ke);
        return toVar && toVar.nama === v.nama;
      });
      
      if (predictors.length > 0) {
        const predictorNames = predictors.map(j => {
          const fromVar = this.variabels.find(vv => vv.id == j.dari_variabel_id || vv.nama === j.dari);
          return fromVar ? fromVar.nama : null;
        }).filter(Boolean);
        
        if (predictorNames.length === 1) {
          const reg = this.simpleRegression(latentScores[predictorNames[0]], latentScores[v.nama]);
          pathCoefficients[`${predictorNames[0]} → ${v.nama}`] = reg.beta;
          
          const yMean = this.mean(latentScores[v.nama]);
          let ssRes = 0, ssTot = 0;
          for (let i = 0; i < n; i++) {
            const predicted = reg.alpha + reg.beta * latentScores[predictorNames[0]][i];
            ssRes += Math.pow(latentScores[v.nama][i] - predicted, 2);
            ssTot += Math.pow(latentScores[v.nama][i] - yMean, 2);
          }
          rSquared[v.nama] = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
        } else {
          const X = [];
          for (let i = 0; i < n; i++) {
            const row = predictorNames.map(pn => latentScores[pn][i]);
            X.push(row);
          }
          const result = this.multipleRegression(X, latentScores[v.nama]);
          
          for (let j = 0; j < predictorNames.length; j++) {
            pathCoefficients[`${predictorNames[j]} → ${v.nama}`] = result.coefficients[j] || 0;
          }
          rSquared[v.nama] = result.rSquared;
        }
      }
    }
    
    // ---- Langkah 5: Hitung Reliabilitas & Validitas ----
    const reliability = {};
    
    for (const v of this.variabels) {
      if (v.indikator.length === 0) continue;
      
      const loadings = v.indikator.map(ind => outerLoadings[v.nama][ind] || 0);
      const k = loadings.length;
      
      // Cronbach's Alpha
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
      const cronbachAlpha = k > 1 ? (k / (k - 1)) * (1 - totalVar / compositeVar) : 1;
      
      // Composite Reliability (CR)
      const sumLoadings = loadings.reduce((a, b) => a + b, 0);
      const sumLoadingsSquared = sumLoadings * sumLoadings;
      const sumErrorVariance = loadings.reduce((sum, l) => sum + (1 - l * l), 0);
      const cr = sumLoadingsSquared / (sumLoadingsSquared + sumErrorVariance);
      
      // Average Variance Extracted (AVE)
      const sumSquaredLoadings = loadings.reduce((sum, l) => sum + l * l, 0);
      const ave = sumSquaredLoadings / k;
      
      // rho_A (Dijkstra-Henseler's rho)
      const weightSquaredSum = loadings.reduce((sum, l) => sum + l * l, 0);
      const rhoA = k > 1 ? Math.pow(sumLoadings, 2) / (Math.pow(sumLoadings, 2) - k + weightSquaredSum) * (1 - totalVar / compositeVar) * (k / (k - 1)) : 1;
      
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
          discriminantValidity[v.nama][v2.nama] = reliability[v.nama] ? Math.sqrt(reliability[v.nama].ave) : 0;
        } else {
          discriminantValidity[v.nama][v2.nama] = this.correlation(latentScores[v.nama], latentScores[v2.nama]);
        }
      }
    }
    
    // ---- Langkah 7: f² (Effect Size) ----
    const effectSizes = {};
    for (const pathKey of Object.keys(pathCoefficients)) {
      const parts = pathKey.split(' → ');
      const predictor = parts[0];
      const endogen = parts[1];
      
      if (rSquared[endogen] !== undefined) {
        const rIncluded = rSquared[endogen];
        // Approximate f² = β² * (1 / (1 - R²))
        const beta = pathCoefficients[pathKey];
        const f2 = rIncluded > 0 ? (beta * beta) / (1 - rIncluded) : beta * beta;
        effectSizes[pathKey] = f2;
      }
    }
    
    this.hasil = {
      converged,
      iterations: iteration + 1,
      latentScores,
      outerLoadings,
      outerWeights,
      pathCoefficients,
      rSquared,
      reliability,
      discriminantValidity,
      effectSizes,
      sampleSize: n
    };
    
    return this.hasil;
  }

  /**
   * Jalankan Bootstrapping
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
    
    // Jalankan PLS pada data asli dulu
    this.data = originalData;
    const originalResult = this.runPLS(plsOptions);
    
    // Bootstrap
    const bootstrapPaths = {};
    const bootstrapLoadings = {};
    
    for (const key of Object.keys(originalResult.pathCoefficients)) {
      bootstrapPaths[key] = [];
    }
    
    for (const varName of Object.keys(originalResult.outerLoadings)) {
      bootstrapLoadings[varName] = {};
      for (const ind of Object.keys(originalResult.outerLoadings[varName])) {
        bootstrapLoadings[varName][ind] = [];
      }
    }
    
    for (let b = 0; b < numSubsamples; b++) {
      // Buat subsampel acak dengan pengembalian
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
      } catch (e) {
        // Skip bootstrap yang gagal
      }
    }
    
    // Restore data asli
    this.data = originalData;
    
    // Hitung statistik bootstrap untuk path
    const pathResults = {};
    for (const key of Object.keys(bootstrapPaths)) {
      const values = bootstrapPaths[key];
      if (values.length === 0) continue;
      
      const originalValue = originalResult.pathCoefficients[key];
      const bootMean = this.mean(values);
      const bootStd = this.stdDev(values);
      const tStatistic = bootStd === 0 ? 0 : Math.abs(originalValue / bootStd);
      
      // p-value (aproksimasi menggunakan distribusi normal)
      let pValue;
      if (testType === 'two-tailed') {
        pValue = 2 * (1 - this.normalCDF(Math.abs(tStatistic)));
      } else {
        pValue = 1 - this.normalCDF(Math.abs(tStatistic));
      }
      
      // Confidence Interval
      const sortedValues = [...values].sort((a, b) => a - b);
      const lowerIdx = Math.floor(values.length * (significanceLevel / 2));
      const upperIdx = Math.floor(values.length * (1 - significanceLevel / 2));
      
      pathResults[key] = {
        originalValue,
        bootMean,
        bootStd,
        tStatistic,
        pValue,
        signifikan: pValue < significanceLevel,
        ciLower: sortedValues[lowerIdx] || 0,
        ciUpper: sortedValues[upperIdx] || 0,
        numSamples: values.length
      };
    }
    
    // Hitung statistik bootstrap untuk loading
    const loadingResults = {};
    for (const varName of Object.keys(bootstrapLoadings)) {
      loadingResults[varName] = {};
      for (const ind of Object.keys(bootstrapLoadings[varName])) {
        const values = bootstrapLoadings[varName][ind];
        if (values.length === 0) continue;
        
        const originalValue = originalResult.outerLoadings[varName][ind];
        const bootMean = this.mean(values);
        const bootStd = this.stdDev(values);
        const tStatistic = bootStd === 0 ? 0 : Math.abs(originalValue / bootStd);
        
        let pValue;
        if (testType === 'two-tailed') {
          pValue = 2 * (1 - this.normalCDF(Math.abs(tStatistic)));
        } else {
          pValue = 1 - this.normalCDF(Math.abs(tStatistic));
        }
        
        loadingResults[varName][ind] = {
          originalValue,
          bootMean,
          bootStd,
          tStatistic,
          pValue,
          signifikan: pValue < significanceLevel
        };
      }
    }
    
    return {
      pathResults,
      loadingResults,
      numSubsamples,
      significanceLevel,
      testType,
      originalResult
    };
  }

  /**
   * Fungsi CDF distribusi normal standar (aproksimasi Abramowitz & Stegun)
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
