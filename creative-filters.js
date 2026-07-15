(function () {
  "use strict";

  const clamp01 = (x) => Math.min(1, Math.max(0, x));

  function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h / 6, s, l];
  }

  function hslToRgb(h, s, l) {
    if (s === 0) return [l, l, l];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)];
  }

  function assertBuffer(source, width, height) {
    if (!source || source.constructor?.name !== "Uint8ClampedArray" || source.BYTES_PER_ELEMENT !== 1) {
      throw new TypeError("source must be a Uint8ClampedArray");
    }
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new RangeError("width and height must be positive numbers");
    }
    width = Math.floor(width);
    height = Math.floor(height);
    const pixelCount = width * height;
    if (source.length < pixelCount * 4) throw new RangeError("source length is smaller than width * height * 4");
    return { width, height, pixelCount };
  }

  function applyInvertColorsToBuffer(source, width, height) {
    const { pixelCount } = assertBuffer(source, width, height);
    const output = new Uint8ClampedArray(pixelCount * 4);
    for (let i = 0; i < output.length; i += 4) {
      output[i] = 255 - source[i];
      output[i + 1] = 255 - source[i + 1];
      output[i + 2] = 255 - source[i + 2];
      output[i + 3] = source[i + 3];
    }
    return output;
  }

  function applyCrossProcessToBuffer(source, width, height) {
    const { pixelCount } = assertBuffer(source, width, height);
    const output = new Uint8ClampedArray(pixelCount * 4);
    const exposureScale = 0.93952;

    for (let pixel = 0, i = 0; pixel < pixelCount; pixel++, i += 4) {
      let r = (source[i] / 255) * exposureScale;
      let g = (source[i + 1] / 255) * exposureScale;
      let b = (source[i + 2] / 255) * exposureScale;

      r = Math.pow(clamp01(r), 1 / 0.57) * 2.28 - 2 / 255;
      g = Math.pow(clamp01(g), 1 / 0.89) * 1.55 - 16 / 255;
      b = Math.pow(clamp01(b), 1 / 0.73) * 0.83 + 8 / 255;

      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const shadowMask = Math.pow(1 - clamp01(luma), 1.2);
      r += 0.05 * shadowMask;
      g += 0.05 * shadowMask;
      b += 0.05 * shadowMask;

      const avg = (r + g + b) / 3;
      r = avg + (r - avg) * 0.91;
      g = avg + (g - avg) * 0.91;
      b = avg + (b - avg) * 0.91;

      r -= 0.0616;
      b += 0.0616;

      g -= 0.0186;
      r += 0.0093;
      b += 0.0093;

      let h; let s; let l;
      [h, s, l] = rgbToHsl(clamp01(r), clamp01(g), clamp01(b));
      s *= 0.92;
      [r, g, b] = hslToRgb(h, clamp01(s), l);

      output[i] = Math.round(clamp01(r) * 255);
      output[i + 1] = Math.round(clamp01(g) * 255);
      output[i + 2] = Math.round(clamp01(b) * 255);
      output[i + 3] = source[i + 3];
    }

    return output;
  }


  function parseFilteredBwColor(input = "#ffffff") {
    const text = String(input || "").trim();
    let hex = "";
    const css = text.match(/^#?([0-9a-f]{6})$/i);
    const argb = text.match(/^#?([0-9a-f]{8})$/i);
    if (argb) hex = argb[1].slice(2);
    else if (css) hex = css[1];
    else hex = "ffffff";
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b, css: `#${hex.toLowerCase()}`, argb: `ff${hex.toLowerCase()}` };
  }

  function filteredBwWeights(input = "#ffffff") {
    const { r, g, b } = parseFilteredBwColor(input);
    const sum = r + g + b;
    if (sum <= 0) return { weightR: 1 / 3, weightG: 1 / 3, weightB: 1 / 3 };
    return { weightR: r / sum, weightG: g / sum, weightB: b / sum };
  }

  function applyFilteredBwToBuffer(source, width, height, params = {}) {
    const { pixelCount } = assertBuffer(source, width, height);
    const output = new Uint8ClampedArray(pixelCount * 4);
    const color = typeof params === "string" ? params : (params.pickColor || params.color || "#ffffff");
    const { weightR, weightG, weightB } = filteredBwWeights(color);
    for (let pixel = 0, i = 0; pixel < pixelCount; pixel++, i += 4) {
      const gray = source[i] * weightR + source[i + 1] * weightG + source[i + 2] * weightB;
      const value = Math.round(Math.min(255, Math.max(0, gray)));
      output[i] = value;
      output[i + 1] = value;
      output[i + 2] = value;
      output[i + 3] = source[i + 3];
    }
    return output;
  }

  function applyBufferFilterToImageData(imageData, fn) {
    return new ImageData(fn(imageData.data, imageData.width, imageData.height), imageData.width, imageData.height);
  }

  function applyBufferFilterToCanvas(sourceCanvas, destinationCanvas, fn) {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const input = sourceContext.getImageData(0, 0, width, height);
    const output = applyBufferFilterToImageData(input, fn);
    destinationCanvas.width = width;
    destinationCanvas.height = height;
    destinationCanvas.getContext("2d").putImageData(output, 0, 0);
    return destinationCanvas;
  }

  window.CreativeFilters = {
    applyInvertColorsToBuffer,
    applyInvertColorsToImageData: (imageData) => applyBufferFilterToImageData(imageData, applyInvertColorsToBuffer),
    applyInvertColorsToCanvas: (sourceCanvas, destinationCanvas = sourceCanvas) => applyBufferFilterToCanvas(sourceCanvas, destinationCanvas, applyInvertColorsToBuffer),
    applyCrossProcessToBuffer,
    applyCrossProcessToImageData: (imageData) => applyBufferFilterToImageData(imageData, applyCrossProcessToBuffer),
    applyCrossProcessToCanvas: (sourceCanvas, destinationCanvas = sourceCanvas) => applyBufferFilterToCanvas(sourceCanvas, destinationCanvas, applyCrossProcessToBuffer),
    parseFilteredBwColor,
    filteredBwWeights,
    applyFilteredBwToBuffer,
    applyFilteredBwToImageData: (imageData, params = {}) => new ImageData(applyFilteredBwToBuffer(imageData.data, imageData.width, imageData.height, params), imageData.width, imageData.height),
    applyFilteredBwToCanvas: (sourceCanvas, destinationCanvas = sourceCanvas, params = {}) => applyBufferFilterToCanvas(sourceCanvas, destinationCanvas, (data, width, height) => applyFilteredBwToBuffer(data, width, height, params)),
  };
})();
