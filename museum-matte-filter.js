(function () {
  "use strict";

  const MUSEUM_MATTE_SHADOW_FWHM_RATIO = 0.02;
  const MUSEUM_MATTE_OUTER_SHADOW_OPACITY = 191 / 255;
  const MUSEUM_MATTE_PHOTO_SHADOW_OPACITY = 225 / 255;
  const GAUSSIAN_FWHM_TO_SIGMA = 2.35482;
  const MAX_MATTE_THICKNESS = 1000;
  const gaussianAxesCache = new Map();

  // Picasa reference renders show a small global quantization/compositing
  // offset in some Museum Matte outputs (roughly -1 RGB on the inner matte
  // and roughly -2 RGB on otherwise unmodified photo pixels). This is
  // intentionally NOT reproduced because it appears to be an implementation
  // artifact rather than part of the visual-effect calibration.

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function normalizeHexColor(value, fallback) {
    const text = String(value || "").trim().replace(/^#/, "").toLowerCase();
    return /^[0-9a-f]{6}$/.test(text) ? `#${text}` : fallback;
  }

  function normalizeMuseumMatteParams(params = {}) {
    const outer = Number(params.outerThickness);
    const inner = Number(params.innerThickness);
    return {
      outerThickness: clamp(Math.round(Number.isFinite(outer) ? outer : 100), 0, MAX_MATTE_THICKNESS),
      outerColor: normalizeHexColor(params.outerColor, "#79b3db"),
      innerThickness: clamp(Math.round(Number.isFinite(inner) ? inner : 40), 0, MAX_MATTE_THICKNESS),
      innerColor: normalizeHexColor(params.innerColor, "#fff47c"),
    };
  }

  function getMuseumMatteGeometry(width, height, params = {}) {
    width = Math.max(1, Math.floor(Number(width) || 1));
    height = Math.max(1, Math.floor(Number(height) || 1));
    const normalized = normalizeMuseumMatteParams(params);
    const offset = normalized.outerThickness + normalized.innerThickness;
    return {
      sourceWidth: width,
      sourceHeight: height,
      outputWidth: width + 2 * offset,
      outputHeight: height + 2 * offset,
      outerRect: { x: 0, y: 0, width: width + 2 * offset, height: height + 2 * offset },
      innerRect: {
        x: normalized.outerThickness,
        y: normalized.outerThickness,
        width: width + 2 * normalized.innerThickness,
        height: height + 2 * normalized.innerThickness,
      },
      photoRect: { x: offset, y: offset, width, height },
      params: normalized,
    };
  }

  function getMuseumMatteShadowSigma(width, height) {
    const shortSide = Math.min(Math.max(1, Number(width) || 1), Math.max(1, Number(height) || 1));
    return (shortSide * MUSEUM_MATTE_SHADOW_FWHM_RATIO) / GAUSSIAN_FWHM_TO_SIGMA;
  }

  // Deterministic Abramowitz-Stegun error-function approximation used by the
  // analytic separable Gaussian rectangle mask.
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

  function gaussianAxisInside(position, length, sigma) {
    return phi((length - 0.5 - position) / sigma) - phi((-0.5 - position) / sigma);
  }

  function getGaussianRectangleAxes(width, height, sigma) {
    const key = `${width}:${height}:${sigma.toFixed(8)}`;
    if (gaussianAxesCache.has(key)) return gaussianAxesCache.get(key);
    const insideX = new Float32Array(width);
    const insideY = new Float32Array(height);
    for (let x = 0; x < width; x++) insideX[x] = gaussianAxisInside(x, width, sigma);
    for (let y = 0; y < height; y++) insideY[y] = gaussianAxisInside(y, height, sigma);
    const axes = { insideX, insideY };
    if (gaussianAxesCache.size >= 8) gaussianAxesCache.delete(gaussianAxesCache.keys().next().value);
    gaussianAxesCache.set(key, axes);
    return axes;
  }

  function colorBytes(color) {
    const hex = normalizeHexColor(color, "#000000").slice(1);
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }

  function fillRect(data, canvasWidth, rect, color) {
    const [r, g, b] = colorBytes(color);
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      let i = (y * canvasWidth + rect.x) * 4;
      for (let x = 0; x < rect.width; x++, i += 4) {
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
      }
    }
  }

  function darkenShadowPixel(data, index, insetMask, opacity) {
    const scale = 1 - clamp(insetMask * opacity, 0, 1);
    data[index] = Math.round(data[index] * scale);
    data[index + 1] = Math.round(data[index + 1] * scale);
    data[index + 2] = Math.round(data[index + 2] * scale);
  }

  function applyGaussianInsetShadow(data, canvasWidth, rect, sigma, opacity) {
    if (sigma <= 0 || opacity <= 0 || rect.width <= 0 || rect.height <= 0) return;
    const { insideX, insideY } = getGaussianRectangleAxes(rect.width, rect.height, sigma);
    // Six sigma is only a numerical work bound; opacity follows the Gaussian
    // continuously and is already effectively zero at this distance.
    const band = Math.min(Math.ceil(sigma * 6 + 1), Math.ceil(Math.min(rect.width, rect.height) / 2));
    const applyRow = (localY, xStart, xEnd) => {
      for (let localX = xStart; localX < xEnd; localX++) {
        const insetMask = 1 - insideX[localX] * insideY[localY];
        const index = ((rect.y + localY) * canvasWidth + rect.x + localX) * 4;
        darkenShadowPixel(data, index, insetMask, opacity);
      }
    };

    const topEnd = Math.min(band, rect.height);
    for (let y = 0; y < topEnd; y++) applyRow(y, 0, rect.width);
    const bottomStart = Math.max(topEnd, rect.height - band);
    for (let y = bottomStart; y < rect.height; y++) applyRow(y, 0, rect.width);
    for (let y = topEnd; y < bottomStart; y++) {
      const leftEnd = Math.min(band, rect.width);
      applyRow(y, 0, leftEnd);
      const rightStart = Math.max(leftEnd, rect.width - band);
      applyRow(y, rightStart, rect.width);
    }
  }

  function getRenderedMuseumMatteShadowSigma(width, height, renderContext = {}) {
    const sourceWidth = Math.max(1, Number(renderContext.sourceWidth) || width);
    const sourceHeight = Math.max(1, Number(renderContext.sourceHeight) || height);
    const previewScale = Math.max(0, Number(renderContext.previewScale) || 1);
    return getMuseumMatteShadowSigma(sourceWidth, sourceHeight) * previewScale;
  }

  function applyMuseumMatteToBuffer(source, width, height, params = {}, renderContext = {}) {
    if (!(source instanceof Uint8ClampedArray)) throw new TypeError("source must be a Uint8ClampedArray");
    width = Math.floor(Number(width)); height = Math.floor(Number(height));
    if (width <= 0 || height <= 0 || source.length < width * height * 4) throw new RangeError("invalid Museum Matte image dimensions");
    const geometry = getMuseumMatteGeometry(width, height, params);
    const output = new Uint8ClampedArray(geometry.outputWidth * geometry.outputHeight * 4);
    const p = geometry.params;

    if (p.outerThickness > 0) fillRect(output, geometry.outputWidth, geometry.outerRect, p.outerColor);
    if (p.innerThickness > 0) fillRect(output, geometry.outputWidth, geometry.innerRect, p.innerColor);
    for (let y = 0; y < height; y++) {
      const sourceStart = y * width * 4;
      const destinationStart = ((geometry.photoRect.y + y) * geometry.outputWidth + geometry.photoRect.x) * 4;
      output.set(source.subarray(sourceStart, sourceStart + width * 4), destinationStart);
    }

    const sigma = getRenderedMuseumMatteShadowSigma(width, height, renderContext);
    // Shadow A always exists. With a zero-width inner matte innerRect and
    // photoRect coincide, so A and B remain independent multiplicative layers.
    applyGaussianInsetShadow(output, geometry.outputWidth, geometry.innerRect, sigma, MUSEUM_MATTE_OUTER_SHADOW_OPACITY);
    applyGaussianInsetShadow(output, geometry.outputWidth, geometry.photoRect, sigma, MUSEUM_MATTE_PHOTO_SHADOW_OPACITY);
    return { data: output, width: geometry.outputWidth, height: geometry.outputHeight };
  }

  function applyMuseumMatteToCanvas(sourceCanvas, destinationCanvas, params = {}, renderContext = {}) {
    const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const source = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const rendered = applyMuseumMatteToBuffer(source.data, source.width, source.height, params, renderContext);
    const output = destinationCanvas || document.createElement("canvas");
    output.width = rendered.width;
    output.height = rendered.height;
    output.getContext("2d").putImageData(new ImageData(rendered.data, rendered.width, rendered.height), 0, 0);
    return output;
  }

  window.MuseumMatteFilter = {
    MUSEUM_MATTE_SHADOW_FWHM_RATIO,
    MUSEUM_MATTE_OUTER_SHADOW_OPACITY,
    MUSEUM_MATTE_PHOTO_SHADOW_OPACITY,
    MAX_MATTE_THICKNESS,
    normalizeMuseumMatteParams,
    getMuseumMatteGeometry,
    getMuseumMatteShadowSigma,
    getRenderedMuseumMatteShadowSigma,
    gaussianAxisInside,
    getGaussianRectangleAxes,
    applyGaussianInsetShadow,
    applyMuseumMatteToBuffer,
    applyMuseumMatteToCanvas,
  };
})();
