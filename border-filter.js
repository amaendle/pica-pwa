(function () {
  "use strict";

  const BORDER_DEFAULTS = Object.freeze({
    outerThickness: 20,
    innerThickness: 5,
    outerColor: "#000000",
    innerColor: "#ffffff",
    cornerRadius: 0,
    captionHeight: 0,
  });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function normalizeBorderColor(value, fallback = "#000000") {
    let text = String(value || "").trim().replace(/^#/, "").toLowerCase();
    if (/^[0-9a-f]{8}$/.test(text)) text = text.slice(-6); // Picasa 00RRGGBB: leading byte is not alpha.
    return /^[0-9a-f]{6}$/.test(text) ? `#${text}` : fallback;
  }

  function borderColorToPicasa(value, fallback = "#000000") {
    return `00${normalizeBorderColor(value, fallback).slice(1)}`;
  }

  function normalizeBorderParams(params = {}) {
    const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    return {
      outerThickness: clamp(Math.round(number(params.outerThickness, BORDER_DEFAULTS.outerThickness)), 0, 100),
      innerThickness: clamp(Math.round(number(params.innerThickness, BORDER_DEFAULTS.innerThickness)), 0, 100),
      outerColor: normalizeBorderColor(params.outerColor, BORDER_DEFAULTS.outerColor),
      innerColor: normalizeBorderColor(params.innerColor, BORDER_DEFAULTS.innerColor),
      cornerRadius: clamp(number(params.cornerRadius, BORDER_DEFAULTS.cornerRadius), 0, 100),
      captionHeight: clamp(number(params.captionHeight, BORDER_DEFAULTS.captionHeight), 0, 100),
    };
  }

  function getBorderCaptionPixels(sourceHeight, captionHeight) {
    return Math.floor(Math.max(1, Number(sourceHeight) || 1) * clamp(Number(captionHeight) || 0, 0, 100) / 600);
  }

  function getBorderCornerGeometry(sourceWidth, sourceHeight, innerThickness, cornerRadius) {
    const frameWidth = sourceWidth + 2 * innerThickness;
    const frameHeight = sourceHeight + 2 * innerThickness;
    const maxFrameRadius = Math.min(frameWidth, frameHeight) / 2;
    const frameRadius = maxFrameRadius * clamp(Number(cornerRadius) || 0, 0, 100) / 100;
    return { maxFrameRadius, frameRadius, photoRadius: Math.max(0, frameRadius - innerThickness) };
  }

  function getBorderGeometry(sourceWidth, sourceHeight, params = {}, previewScale = 1) {
    const p = normalizeBorderParams(params);
    const scale = Math.max(0, Number(previewScale) || 1);
    const width = Math.max(1, Math.round(Number(sourceWidth) || 1));
    const height = Math.max(1, Math.round(Number(sourceHeight) || 1));
    const outerThickness = Math.round(p.outerThickness * scale);
    const innerThickness = Math.round(p.innerThickness * scale);
    const baseWidth = width + 2 * (outerThickness + innerThickness);
    const baseHeight = height + 2 * (outerThickness + innerThickness);
    const sourceCaptionPixels = getBorderCaptionPixels(height / scale, p.captionHeight);
    const captionPixels = Math.round(sourceCaptionPixels * scale);
    const frameRect = { x: outerThickness, y: outerThickness, width: width + 2 * innerThickness, height: height + 2 * innerThickness };
    const photoRect = { x: outerThickness + innerThickness, y: outerThickness + innerThickness, width, height };
    const corners = getBorderCornerGeometry(width / scale, height / scale, p.innerThickness, p.cornerRadius);
    return {
      sourceWidth: width,
      sourceHeight: height,
      baseWidth,
      baseHeight,
      captionPixels,
      outputWidth: baseWidth,
      outputHeight: baseHeight + captionPixels,
      frameRect,
      photoRect,
      maxFrameRadius: corners.maxFrameRadius * scale,
      frameRadius: corners.frameRadius * scale,
      photoRadius: corners.photoRadius * scale,
      params: p,
      previewScale: scale,
    };
  }

  function colorBytes(color) {
    const hex = normalizeBorderColor(color).slice(1);
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }

  // Pixel-center signed-distance coverage gives deterministic one-pixel
  // anti-aliasing for both preview and export without CSS border-radius.
  function roundedRectangleCoverage(x, y, width, height, radius) {
    if (radius <= 0) return 1;
    const r = Math.min(radius, width / 2, height / 2);
    const qx = Math.abs(x + 0.5 - width / 2) - (width / 2 - r);
    const qy = Math.abs(y + 0.5 - height / 2) - (height / 2 - r);
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
    const inside = Math.min(Math.max(qx, qy), 0);
    const signedDistance = outside + inside - r;
    return clamp(0.5 - signedDistance, 0, 1);
  }

  function fillOpaque(data, color) {
    const [r, g, b] = colorBytes(color);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }

  function paintRoundedColor(data, canvasWidth, rect, radius, color) {
    const [r, g, b] = colorBytes(color);
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        const coverage = roundedRectangleCoverage(x, y, rect.width, rect.height, radius);
        if (coverage <= 0) continue;
        const i = ((rect.y + y) * canvasWidth + rect.x + x) * 4;
        if (coverage >= 1) {
          data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
        } else {
          data[i] = Math.round(data[i] + (r - data[i]) * coverage);
          data[i + 1] = Math.round(data[i + 1] + (g - data[i + 1]) * coverage);
          data[i + 2] = Math.round(data[i + 2] + (b - data[i + 2]) * coverage);
        }
      }
    }
  }

  function paintRoundedPhoto(data, canvasWidth, source, rect, radius) {
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        const coverage = roundedRectangleCoverage(x, y, rect.width, rect.height, radius);
        if (coverage <= 0) continue;
        const si = (y * rect.width + x) * 4;
        const di = ((rect.y + y) * canvasWidth + rect.x + x) * 4;
        if (coverage >= 1) {
          data[di] = source[si]; data[di + 1] = source[si + 1]; data[di + 2] = source[si + 2]; data[di + 3] = source[si + 3];
        } else {
          const sourceAlpha = source[si + 3] / 255 * coverage;
          data[di] = Math.round(data[di] * (1 - sourceAlpha) + source[si] * sourceAlpha);
          data[di + 1] = Math.round(data[di + 1] * (1 - sourceAlpha) + source[si + 1] * sourceAlpha);
          data[di + 2] = Math.round(data[di + 2] * (1 - sourceAlpha) + source[si + 2] * sourceAlpha);
          data[di + 3] = 255;
        }
      }
    }
  }

  function applyBorderToBuffer(source, width, height, params = {}, renderContext = {}) {
    if (!(source instanceof Uint8ClampedArray)) throw new TypeError("source must be a Uint8ClampedArray");
    width = Math.floor(Number(width)); height = Math.floor(Number(height));
    if (width <= 0 || height <= 0 || source.length < width * height * 4) throw new RangeError("invalid Border image dimensions");
    const normalized = normalizeBorderParams(params);
    if (!normalized.outerThickness && !normalized.innerThickness && !normalized.cornerRadius && !normalized.captionHeight) {
      return { data: source.slice(0, width * height * 4), width, height };
    }
    const previewScale = Math.max(0, Number(renderContext.previewScale) || 1);
    const geometry = getBorderGeometry(width, height, normalized, previewScale);
    const output = new Uint8ClampedArray(geometry.outputWidth * geometry.outputHeight * 4);
    fillOpaque(output, normalized.outerColor);
    paintRoundedColor(output, geometry.outputWidth, geometry.frameRect, geometry.frameRadius, normalized.innerColor);
    paintRoundedPhoto(output, geometry.outputWidth, source, geometry.photoRect, geometry.photoRadius);
    return { data: output, width: geometry.outputWidth, height: geometry.outputHeight };
  }

  function applyBorderToCanvas(sourceCanvas, destinationCanvas, params = {}, renderContext = {}) {
    const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const input = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const rendered = applyBorderToBuffer(input.data, input.width, input.height, params, renderContext);
    const output = destinationCanvas || document.createElement("canvas");
    output.width = rendered.width; output.height = rendered.height;
    output.getContext("2d").putImageData(new ImageData(rendered.data, rendered.width, rendered.height), 0, 0);
    return output;
  }

  window.BorderFilter = {
    BORDER_DEFAULTS,
    normalizeBorderColor,
    borderColorToPicasa,
    normalizeBorderParams,
    getBorderCaptionPixels,
    getBorderCornerGeometry,
    getBorderGeometry,
    roundedRectangleCoverage,
    applyBorderToBuffer,
    applyBorderToCanvas,
  };
})();
