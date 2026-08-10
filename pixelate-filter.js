(function () {
  "use strict";

  const BLEND_MODE_NAMES = Object.freeze([
    "Add", "Darken", "Difference", "Hard Light", "Lighten",
    "Multiply", "Overlay", "Screen", "Subtract", "Normal"
  ]);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const clampByte = (value) => clamp(Math.round(value), 0, 255);

  function normalizePixelateParams(params = {}) {
    const size = Number(params.pixelSize);
    const mode = Number(params.blendMode);
    const fade = Number(params.fade);
    return {
      pixelSize: clamp(Math.round(Number.isFinite(size) ? size : 20), 1, 150),
      blendMode: clamp(Math.round(Number.isFinite(mode) ? mode : 9), 0, 9),
      fade: clamp(Math.round(Number.isFinite(fade) ? fade : 0), 0, 100),
    };
  }

  function getPixelGrid(width, height, pixelSize) {
    width = Math.max(1, Math.floor(Number(width) || 1));
    height = Math.max(1, Math.floor(Number(height) || 1));
    pixelSize = clamp(Math.round(Number(pixelSize) || 1), 1, 150);
    const blocksX = Math.max(1, Math.round(width / pixelSize));
    const blocksY = Math.max(1, Math.round(height / pixelSize));
    const xBoundaries = new Int32Array(blocksX + 1);
    const yBoundaries = new Int32Array(blocksY + 1);
    for (let x = 0; x <= blocksX; x++) xBoundaries[x] = Math.floor(x * width / blocksX);
    for (let y = 0; y <= blocksY; y++) yBoundaries[y] = Math.floor(y * height / blocksY);
    return { blocksX, blocksY, xBoundaries, yBoundaries };
  }

  function blendPixelateChannel(original, pixelated, blendMode) {
    let result;
    switch (blendMode) {
      case 0: result = Math.min(255, original + pixelated); break;
      case 1: result = Math.min(original, pixelated); break;
      case 2: result = Math.abs(original - pixelated); break;
      case 3:
        result = pixelated < 128
          ? 2 * original * pixelated / 255
          : 255 - 2 * (255 - original) * (255 - pixelated) / 255;
        break;
      case 4: result = Math.max(original, pixelated); break;
      case 5: result = original * pixelated / 255; break;
      case 6:
        result = original < 128
          ? 2 * original * pixelated / 255
          : 255 - 2 * (255 - original) * (255 - pixelated) / 255;
        break;
      case 7: result = 255 - ((255 - original) * (255 - pixelated) / 255); break;
      case 8: result = Math.max(0, original - pixelated); break;
      default: result = pixelated;
    }
    return clamp(result, 0, 255);
  }

  function assertBuffer(source, width, height) {
    if (!(source instanceof Uint8ClampedArray)) throw new TypeError("source must be a Uint8ClampedArray");
    width = Math.floor(Number(width));
    height = Math.floor(Number(height));
    if (width <= 0 || height <= 0 || source.length < width * height * 4) throw new RangeError("invalid Pixelate image dimensions");
    return { width, height };
  }

  function applyPixelateToBuffer(source, width, height, params = {}) {
    ({ width, height } = assertBuffer(source, width, height));
    const normalized = normalizePixelateParams(params);
    const output = new Uint8ClampedArray(source.length);
    if (normalized.fade === 100) {
      output.set(source);
      return output;
    }
    const grid = getPixelGrid(width, height, normalized.pixelSize);
    const fadeT = normalized.fade / 100;
    for (let blockY = 0; blockY < grid.blocksY; blockY++) {
      const y0 = grid.yBoundaries[blockY], y1 = grid.yBoundaries[blockY + 1];
      for (let blockX = 0; blockX < grid.blocksX; blockX++) {
        const x0 = grid.xBoundaries[blockX], x1 = grid.xBoundaries[blockX + 1];
        let sumR = 0, sumG = 0, sumB = 0, sumAlpha = 0, count = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * width + x) * 4;
            const alpha = source[i + 3] / 255;
            sumR += source[i] * alpha;
            sumG += source[i + 1] * alpha;
            sumB += source[i + 2] * alpha;
            sumAlpha += alpha;
            count++;
          }
        }
        // Premultiplied accumulation avoids pulling hidden RGB from transparent
        // pixels into visible block colours. Opaque photos retain exact box means.
        const divisor = sumAlpha > 1e-9 ? sumAlpha : count;
        const pixelatedR = sumR / divisor;
        const pixelatedG = sumG / divisor;
        const pixelatedB = sumB / divisor;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * width + x) * 4;
            const effectR = blendPixelateChannel(source[i], pixelatedR, normalized.blendMode);
            const effectG = blendPixelateChannel(source[i + 1], pixelatedG, normalized.blendMode);
            const effectB = blendPixelateChannel(source[i + 2], pixelatedB, normalized.blendMode);
            output[i] = clampByte(effectR + (source[i] - effectR) * fadeT);
            output[i + 1] = clampByte(effectG + (source[i + 1] - effectG) * fadeT);
            output[i + 2] = clampByte(effectB + (source[i + 2] - effectB) * fadeT);
            output[i + 3] = source[i + 3];
          }
        }
      }
    }
    return output;
  }

  function applyPixelateToImageData(imageData, params = {}) {
    return new ImageData(applyPixelateToBuffer(imageData.data, imageData.width, imageData.height, params), imageData.width, imageData.height);
  }

  function applyPixelateToCanvas(sourceCanvas, destinationCanvas = sourceCanvas, params = {}) {
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const input = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const output = applyPixelateToImageData(input, params);
    destinationCanvas.width = sourceCanvas.width;
    destinationCanvas.height = sourceCanvas.height;
    destinationCanvas.getContext("2d").putImageData(output, 0, 0);
    return destinationCanvas;
  }

  window.PixelateFilter = {
    BLEND_MODE_NAMES,
    normalizePixelateParams,
    getPixelGrid,
    blendPixelateChannel,
    applyPixelateToBuffer,
    applyPixelateToImageData,
    applyPixelateToCanvas,
  };
})();
