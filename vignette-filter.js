(function () {
  "use strict";

  const VIGNETTE_SIGMA_WIDTH_DIVISOR = 410;
  const DEFAULT_VIGNETTE_PARAMS = Object.freeze({ size: 35, strength: 1, color: "ff79b3db", fade: 0 });
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  let maskCache = null;

  function normalizeArgb(value, fallback = DEFAULT_VIGNETTE_PARAMS.color) {
    let text = String(value || "").trim().replace(/^#/, "").toLowerCase();
    if (/^[0-9a-f]{6}$/.test(text)) text = `ff${text}`;
    return /^[0-9a-f]{8}$/.test(text) ? text : fallback;
  }

  function normalizeVignetteParams(params = {}) {
    const size = Number(params.size);
    const strength = Number(params.strength);
    const fade = Number(params.fade);
    return {
      size: clamp(Math.round(Number.isFinite(size) ? size : DEFAULT_VIGNETTE_PARAMS.size), 0, 50),
      strength: clamp(Number.isFinite(strength) ? strength : DEFAULT_VIGNETTE_PARAMS.strength, 1, 2),
      color: normalizeArgb(params.color),
      fade: clamp(Math.round(Number.isFinite(fade) ? fade : DEFAULT_VIGNETTE_PARAMS.fade), 0, 100),
    };
  }

  function getVignetteSigma(size, imageWidth) {
    return Math.max(0, Number(size) || 0) * Math.max(1, Number(imageWidth) || 1) / VIGNETTE_SIGMA_WIDTH_DIVISOR;
  }

  // Abramowitz-Stegun approximation; deterministic and sufficiently accurate
  // for the calibrated Gaussian rectangle mask.
  function erf(value) {
    const sign = value < 0 ? -1 : 1;
    const x = Math.abs(value);
    const t = 1 / (1 + 0.3275911 * x);
    const polynomial = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
    return sign * (1 - polynomial * Math.exp(-x * x));
  }

  function phi(value) {
    return 0.5 * (1 + erf(value / Math.SQRT2));
  }

  function axisInside(position, length, sigma) {
    return phi((length - 0.5 - position) / sigma) - phi((-0.5 - position) / sigma);
  }

  function getVignetteMaskAxes(width, height, size) {
    width = Math.max(1, Math.floor(Number(width) || 1));
    height = Math.max(1, Math.floor(Number(height) || 1));
    size = clamp(Math.round(Number(size) || 0), 0, 50);
    const key = `${width}:${height}:${size}`;
    if (maskCache?.key === key) return maskCache;
    const sigma = getVignetteSigma(size, width);
    const insideX = new Float32Array(width);
    const insideY = new Float32Array(height);
    if (size <= 0 || sigma <= 0) {
      insideX.fill(1); insideY.fill(1);
    } else {
      for (let x = 0; x < width; x++) insideX[x] = axisInside(x, width, sigma);
      for (let y = 0; y < height; y++) insideY[y] = axisInside(y, height, sigma);
    }
    maskCache = { key, width, height, size, sigma, insideX, insideY };
    return maskCache;
  }

  function colorChannels(argb) {
    const color = normalizeArgb(argb);
    return {
      alpha: parseInt(color.slice(0, 2), 16) / 255,
      red: parseInt(color.slice(2, 4), 16),
      green: parseInt(color.slice(4, 6), 16),
      blue: parseInt(color.slice(6, 8), 16),
    };
  }

  function applyVignetteToBuffer(source, width, height, params = {}) {
    if (!(source instanceof Uint8ClampedArray)) throw new TypeError("source must be a Uint8ClampedArray");
    width = Math.floor(Number(width)); height = Math.floor(Number(height));
    if (width <= 0 || height <= 0 || source.length < width * height * 4) throw new RangeError("invalid Vignette image dimensions");
    const normalized = normalizeVignetteParams(params);
    const output = new Uint8ClampedArray(width * height * 4);
    if (normalized.size <= 0 || normalized.fade >= 100) {
      output.set(source.subarray(0, output.length));
      return output;
    }
    const mask = getVignetteMaskAxes(width, height, normalized.size);
    const color = colorChannels(normalized.color);
    const fade = normalized.fade / 100;
    for (let y = 0; y < height; y++) {
      const insideY = mask.insideY[y];
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const baseAlpha = 1 - mask.insideX[x] * insideY;
        const alpha = clamp(baseAlpha * normalized.strength) * color.alpha;
        const effectRed = source[i] * (1 - alpha) + color.red * alpha;
        const effectGreen = source[i + 1] * (1 - alpha) + color.green * alpha;
        const effectBlue = source[i + 2] * (1 - alpha) + color.blue * alpha;
        output[i] = Math.round(effectRed + (source[i] - effectRed) * fade);
        output[i + 1] = Math.round(effectGreen + (source[i + 1] - effectGreen) * fade);
        output[i + 2] = Math.round(effectBlue + (source[i + 2] - effectBlue) * fade);
        output[i + 3] = source[i + 3];
      }
    }
    return output;
  }

  function applyVignetteToImageData(imageData, params = {}) {
    return new ImageData(applyVignetteToBuffer(imageData.data, imageData.width, imageData.height, params), imageData.width, imageData.height);
  }

  function applyVignetteToCanvas(sourceCanvas, destinationCanvas = sourceCanvas, params = {}) {
    const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const input = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const output = applyVignetteToImageData(input, params);
    destinationCanvas.width = sourceCanvas.width;
    destinationCanvas.height = sourceCanvas.height;
    destinationCanvas.getContext("2d").putImageData(output, 0, 0);
    return destinationCanvas;
  }

  window.VignetteFilter = {
    VIGNETTE_SIGMA_WIDTH_DIVISOR,
    DEFAULT_VIGNETTE_PARAMS,
    normalizeArgb,
    normalizeVignetteParams,
    getVignetteSigma,
    erf,
    phi,
    axisInside,
    getVignetteMaskAxes,
    applyVignetteToBuffer,
    applyVignetteToImageData,
    applyVignetteToCanvas,
  };
})();
