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



  function applyCreativeFilterToCanvasWebGL(sourceCanvas, destinationCanvas = sourceCanvas, mode = "", params = {}) {
    if (!sourceCanvas || typeof document === "undefined") return false;
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const glCanvas = document.createElement("canvas");
    glCanvas.width = width;
    glCanvas.height = height;
    const gl = glCanvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) return false;
    const modeMap = { invert: 1, crossprocess: 2, "filtered-bw": 3 };
    const normalizedMode = String(mode || "").toLowerCase();
    const modeId = modeMap[normalizedMode] || 0;
    if (!modeId) return false;
    const color = typeof params === "string" ? params : (params.pickColor || params.color || "#ffffff");
    const { weightR, weightG, weightB } = filteredBwWeights(color);
    const vsSrc = `#version 300 es
      in vec2 aPos; out vec2 vUv;
      void main(){ vUv=aPos*0.5+0.5; gl_Position=vec4(aPos,0.0,1.0); }`;
    const fsSrc = `#version 300 es
      precision highp float;
      uniform sampler2D uImage;
      uniform int uMode;
      uniform vec3 uBwWeights;
      in vec2 vUv; out vec4 outColor;
      float clamp01(float x){ return clamp(x, 0.0, 1.0); }
      vec3 rgbToHsl(vec3 c){
        float maxc=max(max(c.r,c.g),c.b), minc=min(min(c.r,c.g),c.b), l=(maxc+minc)*0.5;
        if (maxc == minc) return vec3(0.0, 0.0, l);
        float d=maxc-minc, s=l>0.5 ? d/(2.0-maxc-minc) : d/(maxc+minc), h=0.0;
        if (maxc == c.r) h=(c.g-c.b)/d + (c.g<c.b ? 6.0 : 0.0);
        else if (maxc == c.g) h=(c.b-c.r)/d + 2.0;
        else h=(c.r-c.g)/d + 4.0;
        return vec3(h/6.0, s, l);
      }
      float hueToRgb(float p,float q,float t){
        if (t < 0.0) t += 1.0;
        if (t > 1.0) t -= 1.0;
        if (t < 1.0/6.0) return p + (q-p)*6.0*t;
        if (t < 0.5) return q;
        if (t < 2.0/3.0) return p + (q-p)*(2.0/3.0-t)*6.0;
        return p;
      }
      vec3 hslToRgb(vec3 hsl){
        float h=hsl.x, s=hsl.y, l=hsl.z;
        if (s == 0.0) return vec3(l);
        float q=l<0.5 ? l*(1.0+s) : l+s-l*s;
        float p=2.0*l-q;
        return vec3(hueToRgb(p,q,h+1.0/3.0), hueToRgb(p,q,h), hueToRgb(p,q,h-1.0/3.0));
      }
      void main(){
        vec4 texel=texture(uImage, vUv);
        vec3 rgb=texel.rgb;
        if (uMode == 1) {
          rgb = vec3(1.0) - rgb;
        } else if (uMode == 2) {
          float exposureScale = 0.93952;
          float r = rgb.r * exposureScale;
          float g = rgb.g * exposureScale;
          float b = rgb.b * exposureScale;
          r = pow(clamp01(r), 1.0/0.57) * 2.28 - 2.0/255.0;
          g = pow(clamp01(g), 1.0/0.89) * 1.55 - 16.0/255.0;
          b = pow(clamp01(b), 1.0/0.73) * 0.83 + 8.0/255.0;
          float luma = 0.299*r + 0.587*g + 0.114*b;
          float shadowMask = pow(1.0 - clamp01(luma), 1.2);
          r += 0.05 * shadowMask; g += 0.05 * shadowMask; b += 0.05 * shadowMask;
          float avg = (r + g + b) / 3.0;
          r = avg + (r - avg) * 0.91; g = avg + (g - avg) * 0.91; b = avg + (b - avg) * 0.91;
          r -= 0.0616; b += 0.0616;
          g -= 0.0186; r += 0.0093; b += 0.0093;
          vec3 hsl = rgbToHsl(clamp(vec3(r,g,b), 0.0, 1.0));
          hsl.y = clamp01(hsl.y * 0.92);
          rgb = hslToRgb(hsl);
        } else if (uMode == 3) {
          float gray = dot(rgb, uBwWeights);
          rgb = vec3(gray);
        }
        outColor = vec4(clamp(rgb, 0.0, 1.0), texel.a);
      }`;
    const compile = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || "shader"); return sh; };
    try {
      const vs = compile(gl.VERTEX_SHADER, vsSrc), fs = compile(gl.FRAGMENT_SHADER, fsSrc);
      const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
      gl.useProgram(prog);
      const aPos = gl.getAttribLocation(prog, "aPos");
      gl.uniform1i(gl.getUniformLocation(prog, "uImage"), 0);
      gl.uniform1i(gl.getUniformLocation(prog, "uMode"), modeId);
      gl.uniform3f(gl.getUniformLocation(prog, "uBwWeights"), weightR, weightG, weightB);
      const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      const tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
      gl.viewport(0, 0, width, height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 6);
      destinationCanvas.width = width; destinationCanvas.height = height;
      const ctx = destinationCanvas.getContext("2d"); ctx.clearRect(0, 0, width, height); ctx.drawImage(glCanvas, 0, 0);
      return destinationCanvas;
    } catch {
      return false;
    }
  }


  window.CreativeFilters = {
    applyInvertColorsToBuffer,
    applyInvertColorsToImageData: (imageData) => applyBufferFilterToImageData(imageData, applyInvertColorsToBuffer),
    applyInvertColorsToCanvas: (sourceCanvas, destinationCanvas = sourceCanvas) => applyBufferFilterToCanvas(sourceCanvas, destinationCanvas, applyInvertColorsToBuffer),
    applyInvertColorsToCanvasWebGL: (sourceCanvas, destinationCanvas = sourceCanvas) => applyCreativeFilterToCanvasWebGL(sourceCanvas, destinationCanvas, "invert"),
    applyCrossProcessToBuffer,
    applyCrossProcessToImageData: (imageData) => applyBufferFilterToImageData(imageData, applyCrossProcessToBuffer),
    applyCrossProcessToCanvas: (sourceCanvas, destinationCanvas = sourceCanvas) => applyBufferFilterToCanvas(sourceCanvas, destinationCanvas, applyCrossProcessToBuffer),
    applyCrossProcessToCanvasWebGL: (sourceCanvas, destinationCanvas = sourceCanvas) => applyCreativeFilterToCanvasWebGL(sourceCanvas, destinationCanvas, "crossprocess"),
    parseFilteredBwColor,
    filteredBwWeights,
    applyFilteredBwToBuffer,
    applyFilteredBwToImageData: (imageData, params = {}) => new ImageData(applyFilteredBwToBuffer(imageData.data, imageData.width, imageData.height, params), imageData.width, imageData.height),
    applyFilteredBwToCanvas: (sourceCanvas, destinationCanvas = sourceCanvas, params = {}) => applyBufferFilterToCanvas(sourceCanvas, destinationCanvas, (data, width, height) => applyFilteredBwToBuffer(data, width, height, params)),
    applyFilteredBwToCanvasWebGL: (sourceCanvas, destinationCanvas = sourceCanvas, params = {}) => applyCreativeFilterToCanvasWebGL(sourceCanvas, destinationCanvas, "filtered-bw", params),
    applyCreativeFilterToCanvasWebGL,
  };
})();
