(function () {
  "use strict";

  // Museum Matte shadow calibration is provisional.
  // Keep radius/falloff/opacity centralized; further reference
  // images will be used to refine the exact Picasa behavior.
  const MUSEUM_MATTE_SHADOW_RADIUS_SCALE = 0.02;
  const MUSEUM_MATTE_SHADOW_MAX_ALPHA = 0.38;
  const MAX_MATTE_THICKNESS = 1000;

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

  function getMuseumMatteShadowRadius(width, height) {
    return Math.max(1, Math.round(Math.min(width, height) * MUSEUM_MATTE_SHADOW_RADIUS_SCALE));
  }

  function getMuseumMatteShadowOpacity(distance, radius) {
    if (radius <= 0 || distance >= radius) return 0;
    const inward = clamp(distance / radius, 0, 1);
    const falloff = (1 - inward) * (1 - inward);
    return MUSEUM_MATTE_SHADOW_MAX_ALPHA * falloff;
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

  function darkenShadowPixel(data, index, distance, radius) {
    const opacity = getMuseumMatteShadowOpacity(distance, radius);
    if (opacity <= 0) return;
    const scale = 1 - opacity;
    data[index] = Math.round(data[index] * scale);
    data[index + 1] = Math.round(data[index + 1] * scale);
    data[index + 2] = Math.round(data[index + 2] * scale);
  }

  function applyInsetShadow(data, canvasWidth, rect, radius) {
    const band = Math.min(radius, Math.ceil(Math.min(rect.width, rect.height) / 2));
    if (band <= 0) return;
    const right = rect.width - 1, bottom = rect.height - 1;
    const applyRow = (localY, xStart, xEnd) => {
      for (let localX = xStart; localX < xEnd; localX++) {
        const distance = Math.min(localX, right - localX, localY, bottom - localY);
        const index = ((rect.y + localY) * canvasWidth + rect.x + localX) * 4;
        darkenShadowPixel(data, index, distance, radius);
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

  function getRenderedMuseumMatteShadowRadius(width, height, renderContext = {}) {
    const sourceWidth = Math.max(1, Number(renderContext.sourceWidth) || width);
    const sourceHeight = Math.max(1, Number(renderContext.sourceHeight) || height);
    const previewScale = Math.max(0, Number(renderContext.previewScale) || 1);
    return Math.max(1, Math.round(getMuseumMatteShadowRadius(sourceWidth, sourceHeight) * previewScale));
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

    const radius = getRenderedMuseumMatteShadowRadius(width, height, renderContext);
    if (p.innerThickness > 0) applyInsetShadow(output, geometry.outputWidth, geometry.innerRect, radius);
    applyInsetShadow(output, geometry.outputWidth, geometry.photoRect, radius);
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
    MUSEUM_MATTE_SHADOW_RADIUS_SCALE,
    MUSEUM_MATTE_SHADOW_MAX_ALPHA,
    MAX_MATTE_THICKNESS,
    normalizeMuseumMatteParams,
    getMuseumMatteGeometry,
    getMuseumMatteShadowRadius,
    getRenderedMuseumMatteShadowRadius,
    getMuseumMatteShadowOpacity,
    applyInsetShadow,
    applyMuseumMatteToBuffer,
    applyMuseumMatteToCanvas,
  };
})();
