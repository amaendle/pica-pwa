(function () {
  "use strict";

  const SOFTEN_IDENTITY = Object.freeze({ radiusPct: 0.0, amount: 0.0, glow: 0.0, glowThreshold: 0.52, contrast: 1.0, pivot: 0.5, exposure: 0.0, gamma: 1.0, saturation: 1.0, blackLift: 0.0, gainR: 1.0, gainG: 1.0, gainB: 1.0 });
  const SOFTEN_50 = Object.freeze({ radiusPct: 0.58, amount: 0.833, glow: 0.024, glowThreshold: 0.572, contrast: 0.992, pivot: 0.659, exposure: -0.018, gamma: 0.992, saturation: 1.006, blackLift: 0.004, gainR: 0.999, gainG: 0.998, gainB: 0.997 });
  const SOFTEN_100 = Object.freeze({ radiusPct: 1.27, amount: 0.778, glow: 0.017, glowThreshold: 0.292, contrast: 1.016, pivot: 0.240, exposure: -0.026, gamma: 1.001, saturation: 1.008, blackLift: 0.016, gainR: 0.998, gainG: 0.998, gainB: 1.001 });
  const PROFILE_KEYS = Object.keys(SOFTEN_IDENTITY);
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const mix = (a, b, t) => a + (b - a) * t;

  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0));
    return t * t * (3 - 2 * t);
  }

  function normalizeSoftenPercent(value) {
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  }

  function lerpProfile(a, b, t) {
    const out = {};
    for (const key of PROFILE_KEYS) out[key] = mix(a[key], b[key], t);
    return out;
  }

  function getSoftenProfile(softness) {
    const s = normalizeSoftenPercent(softness);
    if (s <= 50) return lerpProfile(SOFTEN_IDENTITY, SOFTEN_50, s / 50);
    return lerpProfile(SOFTEN_50, SOFTEN_100, (s - 50) / 50);
  }

  function normalizeSoftenParams(params = {}) {
    return {
      softness: normalizeSoftenPercent(params.softness ?? 50),
      fade: normalizeSoftenPercent(params.fade ?? 50),
    };
  }

  function assertBuffer(source, width, height) {
    if (!source || source.constructor?.name !== "Uint8ClampedArray" || source.BYTES_PER_ELEMENT !== 1) throw new TypeError("source must be a Uint8ClampedArray");
    width = Math.floor(Number(width)); height = Math.floor(Number(height));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new RangeError("width and height must be positive numbers");
    const pixelCount = width * height;
    if (source.length < pixelCount * 4) throw new RangeError("source length is smaller than width * height * 4");
    return { width, height, pixelCount };
  }

  function sourceToFloatRgb(source, pixelCount) {
    const out = new Float32Array(pixelCount * 3);
    for (let pixel = 0, si = 0, di = 0; pixel < pixelCount; pixel++, si += 4, di += 3) {
      const a = source[si + 3] / 255;
      out[di] = (source[si] / 255) * a;
      out[di + 1] = (source[si + 1] / 255) * a;
      out[di + 2] = (source[si + 2] / 255) * a;
    }
    return out;
  }

  function sourceToFloatAlpha(source, pixelCount) {
    const out = new Float32Array(pixelCount);
    for (let pixel = 0, si = 3; pixel < pixelCount; pixel++, si += 4) out[pixel] = source[si] / 255;
    return out;
  }

  function horizontalBoxBlurRgb(src, width, height, radius) {
    const out = new Float32Array(src.length);
    const windowSize = radius * 2 + 1;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      let r = 0, g = 0, b = 0;
      for (let x = -radius; x <= radius; x++) {
        const idx = (row + clamp(x, 0, width - 1)) * 3;
        r += src[idx]; g += src[idx + 1]; b += src[idx + 2];
      }
      for (let x = 0; x < width; x++) {
        const di = (row + x) * 3;
        out[di] = r / windowSize; out[di + 1] = g / windowSize; out[di + 2] = b / windowSize;
        const removeIdx = (row + clamp(x - radius, 0, width - 1)) * 3;
        const addIdx = (row + clamp(x + radius + 1, 0, width - 1)) * 3;
        r += src[addIdx] - src[removeIdx];
        g += src[addIdx + 1] - src[removeIdx + 1];
        b += src[addIdx + 2] - src[removeIdx + 2];
      }
    }
    return out;
  }

  function verticalBoxBlurRgb(src, width, height, radius) {
    const out = new Float32Array(src.length);
    const windowSize = radius * 2 + 1;
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let y = -radius; y <= radius; y++) {
        const idx = (clamp(y, 0, height - 1) * width + x) * 3;
        r += src[idx]; g += src[idx + 1]; b += src[idx + 2];
      }
      for (let y = 0; y < height; y++) {
        const di = (y * width + x) * 3;
        out[di] = r / windowSize; out[di + 1] = g / windowSize; out[di + 2] = b / windowSize;
        const removeIdx = (clamp(y - radius, 0, height - 1) * width + x) * 3;
        const addIdx = (clamp(y + radius + 1, 0, height - 1) * width + x) * 3;
        r += src[addIdx] - src[removeIdx];
        g += src[addIdx + 1] - src[removeIdx + 1];
        b += src[addIdx + 2] - src[removeIdx + 2];
      }
    }
    return out;
  }

  function boxBlurAlpha(src, width, height, radius, horizontal) {
    const out = new Float32Array(src.length);
    const windowSize = radius * 2 + 1;
    if (horizontal) {
      for (let y = 0; y < height; y++) {
        const row = y * width;
        let sum = 0;
        for (let x = -radius; x <= radius; x++) sum += src[row + clamp(x, 0, width - 1)];
        for (let x = 0; x < width; x++) {
          out[row + x] = sum / windowSize;
          sum += src[row + clamp(x + radius + 1, 0, width - 1)] - src[row + clamp(x - radius, 0, width - 1)];
        }
      }
      return out;
    }
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) sum += src[clamp(y, 0, height - 1) * width + x];
      for (let y = 0; y < height; y++) {
        out[y * width + x] = sum / windowSize;
        sum += src[clamp(y + radius + 1, 0, height - 1) * width + x] - src[clamp(y - radius, 0, height - 1) * width + x];
      }
    }
    return out;
  }

  function makeBlurredRgb(source, width, height, profile) {
    const pixelCount = width * height;
    const radiusPx = profile.radiusPct * Math.min(width, height) / 100;
    const rgb = sourceToFloatRgb(source, pixelCount);
    if (radiusPx < 0.45) return { rgb: sourceToStraightRgb(source, pixelCount), radiusPx, boxRadius: 0 };
    const boxRadius = Math.max(1, Math.round(radiusPx / 1.8));
    let blurredRgb = rgb;
    let blurredAlpha = sourceToFloatAlpha(source, pixelCount);
    for (let i = 0; i < 3; i++) {
      blurredRgb = verticalBoxBlurRgb(horizontalBoxBlurRgb(blurredRgb, width, height, boxRadius), width, height, boxRadius);
      blurredAlpha = boxBlurAlpha(boxBlurAlpha(blurredAlpha, width, height, boxRadius, true), width, height, boxRadius, false);
    }
    const straight = new Float32Array(pixelCount * 3);
    for (let pixel = 0, di = 0; pixel < pixelCount; pixel++, di += 3) {
      const a = blurredAlpha[pixel];
      if (a > 1e-6) {
        straight[di] = blurredRgb[di] / a;
        straight[di + 1] = blurredRgb[di + 1] / a;
        straight[di + 2] = blurredRgb[di + 2] / a;
      }
    }
    return { rgb: straight, radiusPx, boxRadius };
  }

  function sourceToStraightRgb(source, pixelCount) {
    const out = new Float32Array(pixelCount * 3);
    for (let pixel = 0, si = 0, di = 0; pixel < pixelCount; pixel++, si += 4, di += 3) {
      out[di] = source[si] / 255;
      out[di + 1] = source[si + 1] / 255;
      out[di + 2] = source[si + 2] / 255;
    }
    return out;
  }

  function applySoftenToBuffer(source, width, height, params = {}) {
    const asserted = assertBuffer(source, width, height);
    width = asserted.width; height = asserted.height;
    const { pixelCount } = asserted;
    const normalized = normalizeSoftenParams(params);
    const output = new Uint8ClampedArray(pixelCount * 4);
    if (normalized.softness === 0 || normalized.fade === 100) { output.set(source.slice(0, output.length)); return output; }
    const profile = getSoftenProfile(normalized.softness);
    const fadeT = clamp(normalized.fade / 100);
    const { rgb: blurred } = makeBlurredRgb(source, width, height, profile);
    for (let pixel = 0, si = 0, bi = 0; pixel < pixelCount; pixel++, si += 4, bi += 3) {
      const r = source[si] / 255, g = source[si + 1] / 255, b = source[si + 2] / 255;
      const br = blurred[bi], bg = blurred[bi + 1], bb = blurred[bi + 2];
      const r1 = r + (br - r) * profile.amount;
      const g1 = g + (bg - g) * profile.amount;
      const b1 = b + (bb - b) * profile.amount;
      const blurLum = 0.299 * br + 0.587 * bg + 0.114 * bb;
      const glowMask = smoothstep(profile.glowThreshold, 1.0, blurLum) * profile.glow;
      const screenR = 1.0 - (1.0 - r1) * (1.0 - br);
      const screenG = 1.0 - (1.0 - g1) * (1.0 - bg);
      const screenB = 1.0 - (1.0 - b1) * (1.0 - bb);
      const r2 = r1 + (screenR - r1) * glowMask;
      const g2 = g1 + (screenG - g1) * glowMask;
      const b2 = b1 + (screenB - b1) * glowMask;
      const y = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
      const r3 = y + profile.saturation * (r2 - y);
      const g3 = y + profile.saturation * (g2 - y);
      const b3 = y + profile.saturation * (b2 - y);
      const r4 = (r3 - profile.pivot) * profile.contrast + profile.pivot + profile.exposure;
      const g4 = (g3 - profile.pivot) * profile.contrast + profile.pivot + profile.exposure;
      const b4 = (b3 - profile.pivot) * profile.contrast + profile.pivot + profile.exposure;
      const r5 = profile.blackLift + (1.0 - profile.blackLift) * r4;
      const g5 = profile.blackLift + (1.0 - profile.blackLift) * g4;
      const b5 = profile.blackLift + (1.0 - profile.blackLift) * b4;
      const filteredR = Math.pow(clamp(r5 * profile.gainR), profile.gamma);
      const filteredG = Math.pow(clamp(g5 * profile.gainG), profile.gamma);
      const filteredB = Math.pow(clamp(b5 * profile.gainB), profile.gamma);
      output[si] = Math.round(clamp(filteredR + (r - filteredR) * fadeT) * 255);
      output[si + 1] = Math.round(clamp(filteredG + (g - filteredG) * fadeT) * 255);
      output[si + 2] = Math.round(clamp(filteredB + (b - filteredB) * fadeT) * 255);
      output[si + 3] = source[si + 3];
    }
    return output;
  }

  function applySoftenToImageData(imageData, params = {}) {
    return new ImageData(applySoftenToBuffer(imageData.data, imageData.width, imageData.height, params), imageData.width, imageData.height);
  }

  function applySoftenToCanvas(sourceCanvas, destinationCanvas = sourceCanvas, params = {}) {
    const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const input = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const output = applySoftenToImageData(input, params);
    destinationCanvas.width = sourceCanvas.width;
    destinationCanvas.height = sourceCanvas.height;
    destinationCanvas.getContext("2d").putImageData(output, 0, 0);
    return destinationCanvas;
  }

  window.SoftenFilter = { SOFTEN_IDENTITY, SOFTEN_50, SOFTEN_100, normalizeSoftenPercent, normalizeSoftenParams, lerpProfile, getSoftenProfile, smoothstep, makeBlurredRgb, applySoftenToBuffer, applySoftenToImageData, applySoftenToCanvas };
})();
