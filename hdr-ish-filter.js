(function () {
  "use strict";

  const HDR_ISH_DEFAULTS = Object.freeze({ enabled: true, radius: 20, strength: 3, fade: 0 });
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function normalizeHdrIshParams(params = {}) {
    const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    return {
      enabled: params.enabled === undefined ? true : !!params.enabled,
      radius: clamp(number(params.radius, HDR_ISH_DEFAULTS.radius), 1.3, 80),
      strength: clamp(number(params.strength, HDR_ISH_DEFAULTS.strength), 1, 7),
      fade: clamp(number(params.fade, HDR_ISH_DEFAULTS.fade), 0, 100)
    };
  }

  function assertImage(source, width, height) {
    if (!(source instanceof Uint8ClampedArray)) throw new TypeError("source must be Uint8ClampedArray");
    width = Math.floor(Number(width));
    height = Math.floor(Number(height));
    if (width < 1 || height < 1 || source.length < width * height * 4) throw new RangeError("invalid HDR-ish dimensions");
    return { width, height };
  }

  // Separable, clamp-to-edge box blur. The historic control is continuous,
  // while a raster box kernel has integral support, so radius is rounded once.
  function boxBlur(channel, width, height, radius) {
    const r = Math.max(1, Math.round(radius));
    const span = r * 2 + 1;
    const horizontal = new Float32Array(channel.length);
    const output = new Float32Array(channel.length);
    for (let y = 0; y < height; y++) {
      const row = y * width;
      let sum = channel[row] * (r + 1);
      for (let k = 1; k <= r; k++) sum += channel[row + Math.min(width - 1, k)];
      for (let x = 0; x < width; x++) {
        horizontal[row + x] = sum / span;
        sum += channel[row + Math.min(width - 1, x + r + 1)] - channel[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < width; x++) {
      let sum = horizontal[x] * (r + 1);
      for (let k = 1; k <= r; k++) sum += horizontal[Math.min(height - 1, k) * width + x];
      for (let y = 0; y < height; y++) {
        output[y * width + x] = sum / span;
        sum += horizontal[Math.min(height - 1, y + r + 1) * width + x] - horizontal[Math.max(0, y - r) * width + x];
      }
    }
    return output;
  }

  function applyHdrIshToBuffer(source, width, height, params = {}) {
    ({ width, height } = assertImage(source, width, height));
    const normalized = normalizeHdrIshParams(params);
    const output = source.slice(0, width * height * 4);
    if (!normalized.enabled || normalized.fade >= 100) return output;
    const pixels = width * height;
    const fade = normalized.fade / 100;
    for (let channelIndex = 0; channelIndex < 3; channelIndex++) {
      const original = new Float32Array(pixels);
      for (let pixel = 0, index = channelIndex; pixel < pixels; pixel++, index += 4) original[pixel] = source[index];
      let blurred = original;
      for (let pass = 0; pass < 3; pass++) blurred = boxBlur(blurred, width, height, normalized.radius);
      for (let pixel = 0, index = channelIndex; pixel < pixels; pixel++, index += 4) {
        const effect = clamp(original[pixel] + normalized.strength * (original[pixel] - blurred[pixel]), 0, 255);
        output[index] = Math.round(effect * (1 - fade) + original[pixel] * fade);
      }
    }
    return output;
  }

  function applyHdrIshToCanvas(sourceCanvas, destinationCanvas, params = {}) {
    const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const image = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const data = applyHdrIshToBuffer(image.data, image.width, image.height, params);
    const output = destinationCanvas || document.createElement("canvas");
    output.width = image.width;
    output.height = image.height;
    output.getContext("2d").putImageData(new ImageData(data, image.width, image.height), 0, 0);
    return output;
  }

  window.HdrIshFilter = { HDR_ISH_DEFAULTS, normalizeHdrIshParams, boxBlur, applyHdrIshToBuffer, applyHdrIshToCanvas };
})();
