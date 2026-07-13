(function () {
  "use strict";

  const HEATMAP_DEFAULTS = Object.freeze({
    inputBlur: 0,
    redWeight: 1,
    greenWeight: 0,
    blueWeight: 0,
    bias: 0,
    inputGamma: 1,
    low: 0.125,
    high: 0.875,
    hueSpan: 240,
    hueShift: 0,
    reverse: false,
    endpointValue: 0.5,
    saturation: 1,
    brightness: 1,
    fade: 1,
  });

  const HEATMAP_PARAM_DEFS = Object.freeze({
    inputBlur: { group: "Input signal", label: "Input blur", min: 0, max: 3, step: 1, type: "range" },
    redWeight: { group: "Input signal", label: "Red weight", min: -1.5, max: 1.5, step: 0.01, type: "range" },
    greenWeight: { group: "Input signal", label: "Green weight", min: -1.5, max: 1.5, step: 0.01, type: "range" },
    blueWeight: { group: "Input signal", label: "Blue weight", min: -1.5, max: 1.5, step: 0.01, type: "range" },
    bias: { group: "Input signal", label: "Bias", min: -0.5, max: 0.5, step: 0.005, type: "range" },
    inputGamma: { group: "Input signal", label: "Input gamma", min: 0.25, max: 3, step: 0.01, type: "range" },
    low: { group: "Palette mapping", label: "Low", min: 0, max: 0.6, step: 0.002, type: "range" },
    high: { group: "Palette mapping", label: "High", min: 0.4, max: 1, step: 0.002, type: "range" },
    hueSpan: { group: "Palette mapping", label: "Hue span", min: 60, max: 360, step: 1, type: "range" },
    hueShift: { group: "Palette mapping", label: "Hue shift", min: -180, max: 180, step: 1, type: "range" },
    endpointValue: { group: "Palette mapping", label: "Endpoint value", min: 0, max: 1, step: 0.01, type: "range" },
    saturation: { group: "Output", label: "Saturation", min: 0, max: 1, step: 0.01, type: "range" },
    brightness: { group: "Output", label: "Brightness", min: 0.4, max: 1.5, step: 0.01, type: "range" },
    fade: { group: "Output", label: "Fade", min: 0, max: 1, step: 0.01, type: "range" },
  });

  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrapHueShift = (x) => ((((Number(x) || 0) + 180) % 360) + 360) % 360 - 180;

  function normalizeParams(input = {}) {
    const p = { ...HEATMAP_DEFAULTS, ...(input || {}) };
    for (const [key, def] of Object.entries(HEATMAP_PARAM_DEFS)) {
      p[key] = Math.max(def.min, Math.min(def.max, Number(p[key])));
      if (def.step === 1) p[key] = Math.round(p[key]);
    }
    p.inputBlur = Math.max(0, Math.min(3, Math.round(Number(p.inputBlur) || 0)));
    p.hueShift = wrapHueShift(p.hueShift);
    p.high = Math.max(p.low + 0.02, p.high);
    p.high = Math.min(1, p.high);
    if (p.low > p.high - 0.02) p.low = Math.max(0, p.high - 0.02);
    p.reverse = !!(p.reverse === true || p.reverse === 1 || p.reverse === "1" || p.reverse === "true");
    return p;
  }

  function assertBuffer(source, width, height) {
    if (!source || source.constructor?.name !== "Uint8ClampedArray" || source.BYTES_PER_ELEMENT !== 1) throw new TypeError("source must be a Uint8ClampedArray");
    width = Math.floor(Number(width));
    height = Math.floor(Number(height));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new RangeError("width and height must be positive numbers");
    const pixelCount = width * height;
    if (source.length < pixelCount * 4) throw new RangeError("source length is smaller than width * height * 4");
    return { width, height, pixelCount };
  }

  function boxBlurRgb(source, width, height, radius) {
    if (!radius) return source;
    const tmp = new Float32Array(width * height * 3);
    const out = new Float32Array(width * height * 3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0; let g = 0; let b = 0; let count = 0;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          const si = (y * width + xx) * 4;
          r += source[si] / 255; g += source[si + 1] / 255; b += source[si + 2] / 255; count++;
        }
        const di = (y * width + x) * 3;
        tmp[di] = r / count; tmp[di + 1] = g / count; tmp[di + 2] = b / count;
      }
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0; let g = 0; let b = 0; let count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= height) continue;
          const si = (yy * width + x) * 3;
          r += tmp[si]; g += tmp[si + 1]; b += tmp[si + 2]; count++;
        }
        const di = (y * width + x) * 3;
        out[di] = r / count; out[di + 1] = g / count; out[di + 2] = b / count;
      }
    }
    return out;
  }

  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    s = clamp01(s); v = clamp01(v);
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r = 0; let g = 0; let b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [r + m, g + m, b + m];
  }

  function heatmapPixel(r, g, b, p) {
    let signal = clamp01(p.redWeight * r + p.greenWeight * g + p.blueWeight * b + p.bias);
    signal = Math.pow(signal, p.inputGamma);
    let t = clamp01((signal - p.low) / Math.max(1e-6, p.high - p.low));
    if (p.reverse) t = 1 - t;
    const hue = p.hueShift + (1 - t) * p.hueSpan;
    let value = 1;
    if (signal < p.low) {
      const f = p.low > 0 ? clamp01(signal / p.low) : 1;
      value = p.endpointValue + (1 - p.endpointValue) * f;
    } else if (signal > p.high) {
      const f = p.high < 1 ? clamp01((1 - signal) / (1 - p.high)) : 1;
      value = p.endpointValue + (1 - p.endpointValue) * f;
    }
    return hsvToRgb(hue, p.saturation, clamp01(value * p.brightness));
  }

  function applyHeatmapToBuffer(source, width, height, params = {}) {
    const dims = assertBuffer(source, width, height);
    const p = normalizeParams(params);
    const blurred = boxBlurRgb(source, dims.width, dims.height, p.inputBlur);
    const output = new Uint8ClampedArray(dims.pixelCount * 4);
    const useBlur = p.inputBlur > 0;
    for (let pixel = 0, i = 0; pixel < dims.pixelCount; pixel++, i += 4) {
      const bi = pixel * 3;
      const r = useBlur ? blurred[bi] : source[i] / 255;
      const g = useBlur ? blurred[bi + 1] : source[i + 1] / 255;
      const b = useBlur ? blurred[bi + 2] : source[i + 2] / 255;
      let [rr, gg, bb] = heatmapPixel(r, g, b, p);
      const fade = clamp01(p.fade);
      rr = lerp(source[i] / 255, rr, fade);
      gg = lerp(source[i + 1] / 255, gg, fade);
      bb = lerp(source[i + 2] / 255, bb, fade);
      output[i] = Math.round(clamp01(rr) * 255);
      output[i + 1] = Math.round(clamp01(gg) * 255);
      output[i + 2] = Math.round(clamp01(bb) * 255);
      output[i + 3] = source[i + 3];
    }
    return output;
  }

  function applyHeatmapToImageData(imageData, params = {}) {
    return new ImageData(applyHeatmapToBuffer(imageData.data, imageData.width, imageData.height, params), imageData.width, imageData.height);
  }

  function applyHeatmapToCanvas(sourceCanvas, destinationCanvas = sourceCanvas, params = {}) {
    const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const input = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const output = applyHeatmapToImageData(input, params);
    destinationCanvas.width = sourceCanvas.width;
    destinationCanvas.height = sourceCanvas.height;
    destinationCanvas.getContext("2d").putImageData(output, 0, 0);
    return destinationCanvas;
  }


  function makePrng(seed = 0x5eed1234) {
    let x = seed >>> 0;
    return () => {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      return ((x >>> 0) / 4294967296);
    };
  }

  function makeSampleIndexes(width, height, requested = 28000) {
    const total = width * height;
    const count = Math.min(total, Math.max(1, Math.floor(requested)));
    const out = new Uint32Array(count);
    const stride = total / count;
    for (let i = 0; i < count; i++) out[i] = Math.min(total - 1, Math.floor((i + 0.5) * stride));
    return out;
  }

  function lossForParams(source, target, width, height, samples, params, blurCache) {
    const p = normalizeParams(params);
    const blurred = blurCache[p.inputBlur] || source;
    const useBlur = p.inputBlur > 0;
    let sum = 0;
    for (const pixel of samples) {
      const i = pixel * 4;
      const bi = pixel * 3;
      const r = useBlur ? blurred[bi] : source[i] / 255;
      const g = useBlur ? blurred[bi + 1] : source[i + 1] / 255;
      const b = useBlur ? blurred[bi + 2] : source[i + 2] / 255;
      const [pr, pg, pb] = heatmapPixel(r, g, b, p);
      const dr = pr - target[i] / 255;
      const dg = pg - target[i + 1] / 255;
      const db = pb - target[i + 2] / 255;
      sum += dr * dr + dg * dg + db * db;
    }
    return 255 * Math.sqrt(sum / Math.max(1, samples.length * 3));
  }

  function calibrateHeatmapToTarget(source, target, width, height, params = {}, locked = {}, options = {}) {
    const dims = assertBuffer(source, width, height);
    const targetDims = assertBuffer(target, width, height);
    if (dims.width !== targetDims.width || dims.height !== targetDims.height) throw new RangeError("source and target dimensions must match");
    const sampleCount = options.fullSizeRefinement ? 70000 : 28000;
    const samples = makeSampleIndexes(dims.width, dims.height, sampleCount);
    const blurCache = { 0: source };
    for (let r = 1; r <= 3; r++) blurCache[r] = boxBlurRgb(source, dims.width, dims.height, r);
    const startParams = normalizeParams(params);
    let bestParams = { ...startParams };
    let bestLoss = lossForParams(source, target, dims.width, dims.height, samples, bestParams, blurCache);
    const startLoss = bestLoss;
    const prng = makePrng(options.seed || 0x5eed1234);
    const tryCandidate = (candidate) => {
      const c = normalizeParams({ ...bestParams, ...candidate });
      for (const key of Object.keys(locked || {})) if (locked[key]) c[key] = startParams[key];
      const loss = lossForParams(source, target, dims.width, dims.height, samples, c, blurCache);
      if (loss < bestLoss) { bestLoss = loss; bestParams = c; }
    };
    if (!locked.inputBlur) for (let inputBlur = 0; inputBlur <= 3; inputBlur++) tryCandidate({ inputBlur });
    if (!locked.reverse) { tryCandidate({ reverse: false }); tryCandidate({ reverse: true }); }
    for (const seed of [
      {}, { redWeight: 1, greenWeight: 0, blueWeight: 0 }, { redWeight: 0, greenWeight: 1, blueWeight: 0 },
      { redWeight: 0, greenWeight: 0, blueWeight: 1 }, { redWeight: 0.2126, greenWeight: 0.7152, blueWeight: 0.0722 },
      { redWeight: 1 / 3, greenWeight: 1 / 3, blueWeight: 1 / 3 }
    ]) tryCandidate(seed);
    const defs = HEATMAP_PARAM_DEFS;
    for (let iter = 0; iter < 180; iter++) {
      const scale = 1 - iter / 180;
      const candidate = { ...bestParams };
      for (const [key, def] of Object.entries(defs)) {
        if (locked[key] || key === "fade") continue;
        const span = def.max - def.min;
        candidate[key] += (prng() - 0.5) * span * 0.35 * scale;
      }
      if (!locked.reverse && prng() < 0.08) candidate.reverse = !candidate.reverse;
      if (!locked.inputBlur && prng() < 0.15) candidate.inputBlur = Math.floor(prng() * 4);
      tryCandidate(candidate);
    }
    for (const pct of [0.05, 0.02, 0.008, 0.003]) {
      for (const [key, def] of Object.entries(defs)) {
        if (locked[key] || key === "fade") continue;
        const step = (def.max - def.min) * pct;
        tryCandidate({ [key]: bestParams[key] + step });
        tryCandidate({ [key]: bestParams[key] - step });
      }
    }
    const finalLoss = lossForParams(source, target, dims.width, dims.height, samples, bestParams, blurCache);
    if (finalLoss <= startLoss) {
      return { params: bestParams, startLoss, bestLoss: finalLoss, finalLoss, improvement: startLoss - finalLoss, message: finalLoss < startLoss ? "Calibration improved loss" : "No lower loss found; current settings kept" };
    }
    return { params: startParams, startLoss, bestLoss: startLoss, finalLoss: startLoss, improvement: 0, message: "No lower loss found; current settings kept" };
  }

  function makePreset(params = {}, locked = {}, fullSizeRefinement = false) {
    return { filter: "heatmap-calibrator-v2", params: normalizeParams(params), locked: { ...(locked || {}) }, fullSizeRefinement: !!fullSizeRefinement, savedAt: new Date().toISOString() };
  }

  window.HeatmapFilter = {
    HEATMAP_DEFAULTS,
    HEATMAP_PARAM_DEFS,
    normalizeParams,
    makePreset,
    applyHeatmapToBuffer,
    applyHeatmapToImageData,
    applyHeatmapToCanvas,
    calibrateHeatmapToTarget,
    heatmapPixel,
    hsvToRgb,
  };
})();
