(function () {
  "use strict";

  const BOOST_IDENTITY = Object.freeze({ saturation: 1.0, contrast: 1.0, pivot: 0.5, exposure: 0.0, gamma: 1.0, blackClip: 0.0, whiteClip: 0.0, sCurve: 0.0, gainR: 1.0, gainG: 1.0, gainB: 1.0, offsetR: 0.0, offsetG: 0.0, offsetB: 0.0 });
  const BOOST_50 = Object.freeze({ saturation: 1.588, contrast: 1.778, pivot: 0.488, exposure: 0.015, gamma: 1.000, blackClip: -0.046, whiteClip: -0.032, sCurve: 0.114, gainR: 0.993, gainG: 0.995, gainB: 0.988, offsetR: 0.009, offsetG: 0.008, offsetB: 0.010 });
  const BOOST_100 = Object.freeze({ saturation: 2.181, contrast: 1.942, pivot: 0.475, exposure: -0.035, gamma: 1.159, blackClip: 0.136, whiteClip: 0.101, sCurve: 1.001, gainR: 1.133, gainG: 1.096, gainB: 1.230, offsetR: 0.006, offsetG: 0.024, offsetB: -0.040 });
  const PROFILE_KEYS = Object.keys(BOOST_IDENTITY);
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const mix = (a, b, t) => a + (b - a) * t;

  function mixProfile(a, b, t) {
    const out = {};
    for (const key of PROFILE_KEYS) out[key] = mix(a[key], b[key], t);
    return out;
  }

  function normalizeBoostPercent(percent) {
    return Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  }

  function getBoostProfile(percent) {
    const amount = clamp(normalizeBoostPercent(percent) / 100, 0, 1);
    if (amount <= 0.5) return mixProfile(BOOST_IDENTITY, BOOST_50, amount * 2);
    return mixProfile(BOOST_50, BOOST_100, (amount - 0.5) * 2);
  }

  function processBoostChannel(x, gain, offset, p) {
    x = x * gain + offset;
    x = (x - p.pivot) * p.contrast + p.pivot + p.exposure;
    const span = Math.max(0.05, 1 - p.blackClip - p.whiteClip);
    x = (x - p.blackClip) / span;
    const z = clamp(x);
    const smooth = z * z * (3 - 2 * z);
    x = x * (1 - p.sCurve) + smooth * p.sCurve;
    return Math.pow(clamp(x), p.gamma);
  }

  function applyBoostPixel(r, g, b, percent) {
    const p = getBoostProfile(percent);
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    r = y + p.saturation * (r - y);
    g = y + p.saturation * (g - y);
    b = y + p.saturation * (b - y);
    return [
      processBoostChannel(r, p.gainR, p.offsetR, p),
      processBoostChannel(g, p.gainG, p.offsetG, p),
      processBoostChannel(b, p.gainB, p.offsetB, p),
    ];
  }

  function assertBuffer(source, width, height) {
    if (!source || source.constructor?.name !== "Uint8ClampedArray" || source.BYTES_PER_ELEMENT !== 1) throw new TypeError("source must be a Uint8ClampedArray");
    width = Math.floor(Number(width)); height = Math.floor(Number(height));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new RangeError("width and height must be positive numbers");
    const pixelCount = width * height;
    if (source.length < pixelCount * 4) throw new RangeError("source length is smaller than width * height * 4");
    return { pixelCount };
  }

  function applyBoostToBuffer(source, width, height, percent = 50) {
    const { pixelCount } = assertBuffer(source, width, height);
    const pct = normalizeBoostPercent(percent);
    const output = new Uint8ClampedArray(pixelCount * 4);
    if (pct === 0) { output.set(source.slice(0, output.length)); return output; }
    for (let pixel = 0, i = 0; pixel < pixelCount; pixel++, i += 4) {
      const [r, g, b] = applyBoostPixel(source[i] / 255, source[i + 1] / 255, source[i + 2] / 255, pct);
      output[i] = Math.round(clamp(r) * 255);
      output[i + 1] = Math.round(clamp(g) * 255);
      output[i + 2] = Math.round(clamp(b) * 255);
      output[i + 3] = source[i + 3];
    }
    return output;
  }

  function applyBoostToImageData(imageData, percent = 50) {
    return new ImageData(applyBoostToBuffer(imageData.data, imageData.width, imageData.height, percent), imageData.width, imageData.height);
  }

  function applyBoostToCanvas(sourceCanvas, destinationCanvas = sourceCanvas, percent = 50) {
    const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const input = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const output = applyBoostToImageData(input, percent);
    destinationCanvas.width = sourceCanvas.width;
    destinationCanvas.height = sourceCanvas.height;
    destinationCanvas.getContext("2d").putImageData(output, 0, 0);
    return destinationCanvas;
  }

  function applyBoostToCanvasWebGL(canvas, percent = 50) {
    const pct = normalizeBoostPercent(percent);
    if (!canvas || pct === 0) return pct === 0;
    const p = getBoostProfile(pct);
    const glCanvas = document.createElement("canvas");
    glCanvas.width = canvas.width; glCanvas.height = canvas.height;
    const gl = glCanvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) return false;
    const vsSrc = `#version 300 es
      in vec2 aPos; out vec2 vUv;
      void main(){ vUv=aPos*0.5+0.5; gl_Position=vec4(aPos,0.0,1.0); }`;
    const fsSrc = `#version 300 es
      precision highp float;
      uniform sampler2D uImage;
      uniform float uSaturation, uContrast, uPivot, uExposure, uGamma, uBlackClip, uWhiteClip, uSCurve;
      uniform vec3 uGain, uOffset;
      in vec2 vUv; out vec4 outColor;
      float processChannel(float x, float gain, float offset){
        x = x * gain + offset;
        x = (x - uPivot) * uContrast + uPivot + uExposure;
        float span = max(0.05, 1.0 - uBlackClip - uWhiteClip);
        x = (x - uBlackClip) / span;
        float z = clamp(x, 0.0, 1.0);
        float smoothv = z * z * (3.0 - 2.0 * z);
        x = x * (1.0 - uSCurve) + smoothv * uSCurve;
        return pow(clamp(x, 0.0, 1.0), uGamma);
      }
      void main(){
        vec4 texel = texture(uImage, vUv);
        vec3 rgb = texel.rgb;
        float y = dot(rgb, vec3(0.299, 0.587, 0.114));
        rgb = vec3(y) + uSaturation * (rgb - vec3(y));
        rgb = vec3(
          processChannel(rgb.r, uGain.r, uOffset.r),
          processChannel(rgb.g, uGain.g, uOffset.g),
          processChannel(rgb.b, uGain.b, uOffset.b)
        );
        outColor = vec4(clamp(rgb, 0.0, 1.0), texel.a);
      }`;
    const compile = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || "shader"); return sh; };
    try {
      const vs = compile(gl.VERTEX_SHADER, vsSrc), fs = compile(gl.FRAGMENT_SHADER, fsSrc);
      const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
      gl.useProgram(prog);
      const loc = (name) => gl.getUniformLocation(prog, name);
      gl.uniform1i(loc("uImage"), 0);
      gl.uniform1f(loc("uSaturation"), p.saturation); gl.uniform1f(loc("uContrast"), p.contrast); gl.uniform1f(loc("uPivot"), p.pivot);
      gl.uniform1f(loc("uExposure"), p.exposure); gl.uniform1f(loc("uGamma"), p.gamma); gl.uniform1f(loc("uBlackClip"), p.blackClip);
      gl.uniform1f(loc("uWhiteClip"), p.whiteClip); gl.uniform1f(loc("uSCurve"), p.sCurve);
      gl.uniform3f(loc("uGain"), p.gainR, p.gainG, p.gainB); gl.uniform3f(loc("uOffset"), p.offsetR, p.offsetG, p.offsetB);
      const aPos = gl.getAttribLocation(prog, "aPos");
      const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      const tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      gl.viewport(0, 0, glCanvas.width, glCanvas.height); gl.drawArrays(gl.TRIANGLES, 0, 6);
      const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(glCanvas, 0, 0);
      return true;
    } catch { return false; }
  }

  window.BoostFilter = { BOOST_IDENTITY, BOOST_50, BOOST_100, mixProfile, getBoostProfile, normalizeBoostPercent, processBoostChannel, applyBoostPixel, applyBoostToBuffer, applyBoostToImageData, applyBoostToCanvas, applyBoostToCanvasWebGL };
})();
