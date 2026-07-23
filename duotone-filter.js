(function (root) {
  "use strict";

  const DUOTONE_SETTINGS = Object.freeze({
    color1: "#004488",
    color2: "#ffff00",
    model: Object.freeze({
      normalizer: Object.freeze({
        mean: Object.freeze([0.4943376605814791,0.46753579445571103,0.3793119134550408,0.4666719182942034,0.3144922078245789,0.2869265338265134,0.2169715618130956,0.2956673664505703,0.24172724432247597,0.24120477354863606,0.2740308517941016,0.28826464742000946,0.27743416595405057,0.23259336910646874]),
        scale: Object.freeze([0.2648074182535177,0.26141401267109776,0.2703600159499106,0.23716778953059073,0.26611289631195684,0.25975496869944426,0.26176839414681347,0.25368470433482215,0.22999172251946673,0.2513187307563475,0.23174706706238146,0.239540909935994,0.24279703908364356,0.23481623235344423]),
        edgeAware: true
      }),
      c0: Object.freeze({ kind: "continuous", beta: Object.freeze([0.4954631660652066,0.26464134494184893,0.00009266777593296652,0.000047746674378308255,0.00016734383958745,0.0000358172000247641,-0.0004321518030728252,-0.0001999122895581419,0.00008230547326016675,0.000016344386983978355,0.0004059659358855482,-0.00025234824621188823,-0.00006307590502769,0.0004894570511060914,-0.00027747445959632307]), grid: 33 }),
      c20: Object.freeze({ kind: "continuous", beta: Object.freeze([0.4932651566938423,0.34447155282998715,-0.030505129754030053,0.033751584128939645,0.003362030153618652,-0.02433671412290723,-0.07785229390936022,-0.038335903687120115,0.09206781065756726,-0.04805075706420297,0.07020781017959798,-0.0018625914488234223,-0.06281657170219164,0.07980002835368774,-0.02181528946614522]), grid: 33 }),
      c50: Object.freeze({ kind: "continuous", beta: Object.freeze([0.5051035982530461,0.4995902145794258,-0.14852421845792502,0.17117418277750612,-0.0543438936115716,0.016730827219125416,-0.1007490151252099,-0.18594860742831557,-0.03176867767662191,-0.06296753302847168,0.14548954798048405,-0.05020218697707755,-0.21678031873830536,0.47206912392081946,-0.08911796999347413]), grid: 33 }),
      c100: Object.freeze({ kind: "hard", beta: Object.freeze([0.36885403077923423,7.0952455822283556,-2.6618893281113554,2.106731818265008,-1.1865272322938683,-2.0286312815665077,0.8419194619507394,-2.613983333539861,0.7514510437380258,-0.9829655271301523,1.313604302965912,-0.8873731709341395,0.3589163491881892,3.7461945318991905,-0.4071349077047679]), grid: 33 }),
      hardCutoff: 0.5410557184750733,
      residualStrength: 1,
      useLut: false,
      grid: 33,
      quality: "fine"
    })
  });

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clampPercent = (v, fallback = 0) => {
    const n = Number(v);
    return Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : fallback)));
  };
  const clampSignedPercent = (v, fallback = 0) => {
    const n = Number(v);
    return Math.max(-100, Math.min(100, Math.round(Number.isFinite(n) ? n : fallback)));
  };
  const normalizeColor = (value, fallback = "#ffffff") => {
    let s = String(value || "").trim().toLowerCase();
    const argb = s.match(/^[0-9a-f]{8}$/i);
    if (argb) s = `#${s.slice(2)}`;
    const rgb = s.match(/^#?([0-9a-f]{6})$/i);
    return rgb ? `#${rgb[1].toLowerCase()}` : fallback;
  };
  const hexRGB = (h) => {
    const s = normalizeColor(h, "#ffffff");
    const n = parseInt(s.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  };
  const sigmoid = (x) => x >= 0 ? 1 / (1 + Math.exp(-Math.min(40, x))) : Math.exp(Math.max(-40, x)) / (1 + Math.exp(Math.max(-40, x)));
  function localMean(data, w, h, enabled) {
    const n = w * h, base = new Float32Array(n);
    for (let p = 0, j = 0; p < n; p++, j += 4) base[p] = (0.2126 * data[j] + 0.7152 * data[j + 1] + 0.0722 * data[j + 2]) / 255;
    if (!enabled) return base;
    const tmp = new Float32Array(n), out = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      let s = base[y * w] + base[y * w] + base[y * w + Math.min(1, w - 1)];
      for (let x = 0; x < w; x++) { tmp[y * w + x] = s / 3; s += base[y * w + Math.min(w - 1, x + 2)] - base[y * w + Math.max(0, x - 1)]; }
    }
    for (let x = 0; x < w; x++) {
      let s = tmp[x] + tmp[x] + tmp[Math.min(1, h - 1) * w + x];
      for (let y = 0; y < h; y++) { out[y * w + x] = s / 3; s += tmp[Math.min(h - 1, y + 2) * w + x] - tmp[Math.max(0, y - 1) * w + x]; }
    }
    return out;
  }
  function features(r, g, b, m, n, out) {
    const a = [r, g, b, m, r*r, g*g, b*b, r*g, r*b, g*b, m*m, r*m, g*m, b*m];
    out[0] = 1;
    for (let k = 0; k < a.length; k++) out[k + 1] = (a[k] - n.mean[k]) / n.scale[k];
    return out;
  }
  function score(p, r, g, b, m, n, f) {
    features(r, g, b, m, n, f);
    let z = 0;
    for (let k = 0; k < f.length; k++) z += p.beta[k] * f[k];
    return clamp(p.kind === "hard" ? sigmoid(z) : z);
  }
  function normalizeDuoToneParams(params = {}) {
    return {
      color1: normalizeColor(params.color1 || DUOTONE_SETTINGS.color1, DUOTONE_SETTINGS.color1),
      color2: normalizeColor(params.color2 || DUOTONE_SETTINGS.color2, DUOTONE_SETTINGS.color2),
      brightness: clampSignedPercent(params.brightness, 0),
      contrast: clampPercent(params.contrast, 100),
      fade: clampPercent(params.fade, 0)
    };
  }
  function applyDuoToneRGBA(data, width, height, brightness = 0, contrast = 100, settings = DUOTONE_SETTINGS) {
    const c1 = hexRGB(settings.color1), c2 = hexRGB(settings.color2), model = settings.model;
    const local = localMean(data, width, height, model.normalizer.edgeAware);
    const out = new Uint8ClampedArray(data.length), f = new Float64Array(15);
    const bb = clamp(brightness / 100, -1, 1), cc = clamp(contrast, 0, 100);
    for (let p = 0, j = 0; p < local.length; p++, j += 4) {
      const r = data[j] / 255, g = data[j + 1] / 255, b = data[j + 2] / 255;
      const s0 = score(model.c0, r, g, b, local[p], model.normalizer, f);
      const s100 = score(model.c100, r, g, b, local[p], model.normalizer, f);
      let t;
      if (cc >= 100) t = s100 >= model.hardCutoff ? 1 : 0;
      else {
        const s20 = score(model.c20, r, g, b, local[p], model.normalizer, f);
        const s50 = score(model.c50, r, g, b, local[p], model.normalizer, f);
        if (cc <= 20) t = lerp(s0, s20, cc / 20);
        else if (cc <= 50) t = lerp(s20, s50, (cc - 20) / 30);
        else t = lerp(s50, s100, (cc - 50) / 50);
      }
      t = bb >= 0 ? t + (1 - t) * bb : t * (1 + bb);
      out[j] = Math.round(255 * lerp(c1[0], c2[0], clamp(t)));
      out[j + 1] = Math.round(255 * lerp(c1[1], c2[1], clamp(t)));
      out[j + 2] = Math.round(255 * lerp(c1[2], c2[2], clamp(t)));
      out[j + 3] = data[j + 3];
    }
    return out;
  }
  function applyDuoToneIshToBuffer(source, width, height, params = {}) {
    const p = normalizeDuoToneParams(params);
    const effect = applyDuoToneRGBA(source, width, height, p.brightness, p.contrast, { ...DUOTONE_SETTINGS, color1: p.color1, color2: p.color2 });
    const fade = clamp(p.fade / 100, 0, 1);
    if (fade <= 0) return effect;
    if (fade >= 1) return new Uint8ClampedArray(source);
    const out = new Uint8ClampedArray(source.length);
    for (let i = 0; i < source.length; i += 4) {
      out[i] = Math.round(effect[i] + (source[i] - effect[i]) * fade);
      out[i + 1] = Math.round(effect[i + 1] + (source[i + 1] - effect[i + 1]) * fade);
      out[i + 2] = Math.round(effect[i + 2] + (source[i + 2] - effect[i + 2]) * fade);
      out[i + 3] = source[i + 3];
    }
    return out;
  }
  function applyDuoToneIshToImageData(imageData, params = {}) {
    return new ImageData(applyDuoToneIshToBuffer(imageData.data, imageData.width, imageData.height, params), imageData.width, imageData.height);
  }
  function applyDuoToneIshToCanvas(sourceCanvas, destinationCanvas = sourceCanvas, params = {}) {
    const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const input = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const output = applyDuoToneIshToImageData(input, params);
    destinationCanvas.width = sourceCanvas.width;
    destinationCanvas.height = sourceCanvas.height;
    destinationCanvas.getContext("2d").putImageData(output, 0, 0);
    return destinationCanvas;
  }
  root.DuoToneFilter = { DUOTONE_SETTINGS, normalizeDuoToneParams, applyDuoToneRGBA, applyDuoToneIshToBuffer, applyDuoToneIshToImageData, applyDuoToneIshToCanvas };
})(typeof window !== "undefined" ? window : globalThis);
