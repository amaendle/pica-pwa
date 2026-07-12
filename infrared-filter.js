(function () {
  "use strict";

  const INFRARED_MONO_CALIBRATED = Object.freeze({
    intensity: 1.0,
    monochromeMix: 1.0,
    foliageBoost: 0.03,
    foliageThreshold: 0.05,
    orthoRedBias: -0.12,
    contrast: 0.34,
    gamma: 0.68,
    clarity: -0.12,
    redWeight: -0.35,
    greenWeight: 1.56,
    blueWeight: -0.39,
  });

  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  function smoothstep(a, b, x) {
    const t = clamp01((x - a) / Math.max(1e-6, b - a));
    return t * t * (3 - 2 * t);
  }

  function buildLuminanceBuffer(source, width, height) {
    const out = new Float32Array(width * height);
    for (let i = 0, p = 0; p < out.length; p++, i += 4) {
      out[p] = luminance(source[i] / 255, source[i + 1] / 255, source[i + 2] / 255);
    }
    return out;
  }

  function boxBlurRadius2(source, width, height) {
    const radius = 2;
    const horizontal = new Float32Array(source.length);
    const output = new Float32Array(source.length);

    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          sum += source[row + xx];
          count++;
        }
        horizontal[row + x] = sum / count;
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= height) continue;
          sum += horizontal[yy * width + x];
          count++;
        }
        output[y * width + x] = sum / count;
      }
    }

    return output;
  }

  function foliageMaskForPixel(r, g, b, p) {
    const greenAdvantage = g - Math.max(r, b);
    const greenOverRed = g - r;
    const greenOverBlue = g - b;
    const saturated = Math.max(r, g, b) - Math.min(r, g, b);
    const brightness = luminance(r, g, b);
    const vegetationSignal = greenAdvantage + 0.35 * greenOverRed + 0.18 * greenOverBlue + 0.25 * saturated;

    return smoothstep(p.foliageThreshold - 0.04, p.foliageThreshold + 0.18, vegetationSignal)
      * smoothstep(0.06, 0.32, brightness)
      * (1 - smoothstep(0.02, 0.22, b - g));
  }

  function applyInfraredMonoCalibratedToBuffer(source, width, height) {
    if (!source || source.constructor?.name !== "Uint8ClampedArray" || source.BYTES_PER_ELEMENT !== 1) {
      throw new TypeError("source must be a Uint8ClampedArray");
    }
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new RangeError("width and height must be positive numbers");
    }
    width = Math.floor(width);
    height = Math.floor(height);
    const pixelCount = width * height;
    if (source.length < pixelCount * 4) {
      throw new RangeError("source length is smaller than width * height * 4");
    }

    const p = INFRARED_MONO_CALIBRATED;
    const blurredLuma = boxBlurRadius2(buildLuminanceBuffer(source, width, height), width, height);
    const output = new Uint8ClampedArray(pixelCount * 4);

    for (let pixel = 0, i = 0; pixel < pixelCount; pixel++, i += 4) {
      const r0 = source[i] / 255;
      const g0 = source[i + 1] / 255;
      const b0 = source[i + 2] / 255;
      const foliageMask = foliageMaskForPixel(r0, g0, b0, p);

      const irR = r0 + p.orthoRedBias;
      const irG = g0 + p.foliageBoost * foliageMask * 0.75;
      const irB = b0;

      let mono = irR * p.redWeight
        + irG * p.greenWeight
        + irB * p.blueWeight
        + foliageMask * p.foliageBoost * 0.5;

      mono = clamp01(mono);

      const localBase = blurredLuma[pixel];
      const localDetail = mono - localBase;
      mono = clamp01(mono + localDetail * p.clarity);

      mono = clamp01(mono);
      mono = Math.pow(mono, p.gamma);
      mono = 0.5 + (mono - 0.5) * (1 + p.contrast);
      mono = clamp01(mono);

      let rr = mono;
      let gg = mono;
      let bb = mono;

      rr = lerp(r0, rr, p.monochromeMix);
      gg = lerp(g0, gg, p.monochromeMix);
      bb = lerp(b0, bb, p.monochromeMix);

      rr = lerp(r0, rr, p.intensity);
      gg = lerp(g0, gg, p.intensity);
      bb = lerp(b0, bb, p.intensity);

      output[i] = Math.round(clamp01(rr) * 255);
      output[i + 1] = Math.round(clamp01(gg) * 255);
      output[i + 2] = Math.round(clamp01(bb) * 255);
      output[i + 3] = source[i + 3];
    }

    return output;
  }

  function applyInfraredMonoCalibrated(imageData) {
    const output = applyInfraredMonoCalibratedToBuffer(imageData.data, imageData.width, imageData.height);
    return new ImageData(output, imageData.width, imageData.height);
  }

  function applyInfraredMonoCalibratedToCanvas(sourceCanvas, destinationCanvas = sourceCanvas) {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const input = sourceContext.getImageData(0, 0, width, height);
    const output = applyInfraredMonoCalibrated(input);

    destinationCanvas.width = width;
    destinationCanvas.height = height;
    destinationCanvas.getContext("2d").putImageData(output, 0, 0);
    return destinationCanvas;
  }

  window.InfraredFilter = {
    INFRARED_MONO_CALIBRATED,
    applyInfraredMonoCalibrated,
    applyInfraredMonoCalibratedToBuffer,
    applyInfraredMonoCalibratedToCanvas,
  };
})();
