(function () {
  "use strict";

  const HEATMAP_FIXED_PARAMS = Object.freeze({
    inputBlur: 0,
    redWeight: 1,
    greenWeight: 0,
    blueWeight: 0,
    bias: 0,
    inputGamma: 1,
    low: 0.125,
    high: 0.875,
    hueSpan: 240,
    reverse: false,
    endpointValue: 0.5,
    saturation: 1,
    brightness: 1,
  });

  const HEATMAP_DEFAULTS = Object.freeze({ hueShift: 0, fade: 1 });
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrapHueShift = (x) => ((((Number(x) || 0) + 180) % 360) + 360) % 360 - 180;

  function normalizeParams(input = {}) {
    return {
      ...HEATMAP_FIXED_PARAMS,
      hueShift: wrapHueShift(input.hueShift ?? HEATMAP_DEFAULTS.hueShift),
      fade: clamp01(Number(input.fade ?? HEATMAP_DEFAULTS.fade)),
    };
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
    const output = new Uint8ClampedArray(dims.pixelCount * 4);
    for (let pixel = 0, i = 0; pixel < dims.pixelCount; pixel++, i += 4) {
      const r = source[i] / 255;
      const g = source[i + 1] / 255;
      const b = source[i + 2] / 255;
      let [rr, gg, bb] = heatmapPixel(r, g, b, p);
      rr = lerp(r, rr, p.fade);
      gg = lerp(g, gg, p.fade);
      bb = lerp(b, bb, p.fade);
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

  window.HeatmapFilter = {
    HEATMAP_FIXED_PARAMS,
    HEATMAP_DEFAULTS,
    normalizeParams,
    applyHeatmapToBuffer,
    applyHeatmapToImageData,
    applyHeatmapToCanvas,
    heatmapPixel,
    hsvToRgb,
  };
})();
