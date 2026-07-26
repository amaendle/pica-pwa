(function (root) {
  "use strict";

  const F = 13;
  const DUOTONE_SETTINGS = {
    color1: "#004488",
    color2: "#ffff00",
    model: {
      architecture: "shared-tanh-heads-monotonic-spline-v1",
      normalizer: {
        mean: [0.4954017647058832,0.4684040196078432,0.38020019607843275,0.4677754240741929,0.4680811783347025,0.4677242641504344,0.46712838130962914,0.08652980216475237,0.11447875454062045,0.5320839215686223,0.34624950980392294,0.1858344117647078,0.39141158528174946],
        scale: [0.26562698642020216,0.2619861406492606,0.2702299792025842,0.258266891265786,0.2374885416801277,0.21780782780604566,0.19940024461942624,0.0793672892816903,0.10321184196582174,0.2799995727642992,0.23430818294206207,0.12139374273929371,0.20858258409952948],
        spatial: true
      },
      network: {
        inputCount: 13,
        hiddenCount: 12,
        w1: [0.40292186785196893,-0.002884347156005951,-0.1419357394952273,0.07499640576060065,-0.016486019189470777,-0.008622528464400217,0.006508429814638332,0.005886704236602996,-0.23901307666256288,0.09059751916416504,0.11567800436006188,-0.014769179047757902,0.030200491221755974,0.4422908192557958,-0.0317034963252195,-0.18353021458711083,0.05958196277316187,-0.019320142951742617,-0.020708836231822604,-0.009091608748820874,-0.014000519988931131,0.22483007598711294,0.08481057058547337,0.11290285491300382,-0.022406132275861648,0.0007479079295124553,-0.46556924656829557,0.013446463215018809,0.1990122956631775,-0.07670310594327069,-0.01836051066599694,-0.020168310187541418,-0.02684231098697592,-0.004326579713876692,-0.2986031169519454,-0.08338449927094149,-0.132216917118415,0.06316249819238355,0.02693017459555911,-0.37282532620610126,0.029462642989396482,0.1364102299980678,-0.04960720407641161,0.035239981495843224,0.02638144642880098,0.009275631218236366,-0.014691918766555912,0.14933735443166127,-0.07847713023240664,-0.09809666238459283,0.00868614206030504,-0.031474511179201234,0.7358510018675383,0.13117493782988945,-0.28477077236909276,0.23405617888776864,0.09372181491645738,0.06415825683334983,0.07343999601243942,-0.002461198679111969,0.3683379260186309,0.1744104119850413,0.2527714535310673,-0.0859067610199095,0.019739021538198773,0.3660818316531022,-0.04885205772426414,-0.14602705757289638,0.03336846418118221,-0.048566640185706625,-0.04511274111998235,-0.026445525535185654,-0.0020127656281737957,0.005395094134814155,0.06944747620073649,0.08450905670435493,-0.0030516785684634473,0.02640591009306413,-0.37451839666759545,0.04940732672309686,0.150691901743216,-0.03446622621276455,0.048628646137541864,0.0462207512177962,0.027589037514009613,0.006027345321147713,-0.035005362028620174,-0.07080852443615805,-0.08610691029874432,0.0029917819774811826,-0.024856860869105758,-0.3629908840264938,0.04820689404597951,0.14396632183484603,-0.033311576220926974,0.04822904592459575,0.04423283358121276,0.025603190573654955,-0.000054432294637654454,0.008891151489744172,-0.06916412211486976,-0.08424449798250834,0.0032105265362297993,-0.027051403011626007,0.4234165848416063,-0.04037418666026895,-0.17315159982814837,0.049960915425913285,-0.03481715953594739,-0.03589787131822957,-0.020988656514809804,-0.016464403441656707,0.1694916221368585,0.08173291958601167,0.10318245379845882,-0.010728457334287043,0.011360845658928235,-0.7095560247054227,-0.15446352031448105,0.2784621744487063,-0.2458346812034508,-0.05529319512710318,-0.031793621658298195,-0.048208077355999954,0.022127811157867713,0.39596896933427095,-0.16787878095285683,-0.2306175187315636,0.05844232226245018,-0.02141638500790651,-0.39945379548958,0.005718428273296514,0.14092165248754232,-0.07226435992322988,0.018402291861961278,0.010261824236820238,-0.00500873175473283,-0.007600553902877243,0.23128586388114553,-0.08939552148915002,-0.11393438331842892,0.014153924986863062,-0.03049233601106778,-0.364541961431883,0.04858044730334184,0.14504149342954972,-0.033300871529659756,0.04843198045033314,0.044728104742611845,0.026075249889188176,0.0010550880000261018,0.0012714431938902063,-0.06928106849516602,-0.08434020466336162,0.00311579432479626,-0.026712900046098706],
        b1: [-0.36596183038622265,0.3447454528710704,-0.5012280421053416,0.21394820704117562,0.24497578630156805,0.03756919492796848,-0.08092664930138327,-0.01527444522149212,0.2584587697381575,0.4111015270369472,0.35295624156360417,-0.02726716632790235]
      },
      c0: { kind: "neural-spline", direct: [0.5069612159557946,0.013187434657238935,-0.10442311714953285,0.11253969600660556,0.07256525432215484,0.06310348432695746,0.035361320492754485,0.003232939963458067,0.008841464422072192,0.15126642651219194,0.17498800411497872,0.01101361862112282,-0.014325789943569475], hidden: [0.1589924829665861,0.16964599237091782,-0.12405390266682471,-0.16919762325020773,-0.23230987259543343,0.1831612903390349,-0.18634530120907783,-0.18150795104906028,0.18449010483522635,0.17343357699077183,-0.1602906195173155,-0.18238893651738367], bias: -0.06811514781392183, knots: [0.06730682411127518,0.07725487766813033,0.12004684794073782,0.18338406744970331,0.25302209084626903,0.3194270104235733,0.38244781572330483,0.442601687168344,0.5019787241634701,0.5613474127942377,0.6202449901619795,0.6804159374276555,0.7442724777221807,0.8164561294808595,0.8946664993607512,0.9495819499212397,0.9621677014595239], clipLow: 0, clipHigh: 1, grid: 33 },
      c20: { kind: "neural-spline", direct: [0.6154318181786854,0.025388760614132123,-0.12852353436014427,0.14328631182488766,0.10463372007517167,0.08578105951561649,0.05160992428243361,0.009271467820814502,0.006490608465919587,0.19479035972310316,0.20848469502316688,0.04684748502819939,-0.039671451727477436], hidden: [0.21197540693863234,0.2702905646958872,-0.2595231760711953,-0.21800689378885307,-0.325231128900794,0.23212920598139603,-0.23840715944997182,-0.22936403913465467,0.2649808692570542,0.20116125550239858,-0.21296356719150894,-0.23080552056677897], bias: -0.15361801296446398, knots: [0.0014752200237993537,0.04321557566965612,0.11194078740856347,0.19376023379758928,0.2662197277797209,0.3303684697618844,0.38982877136304633,0.4469204909882565,0.5028516058075567,0.558854498642934,0.615505748641914,0.6738457507773472,0.7372480978257994,0.8094157540929596,0.8916343260108416,0.962853822986921,0.9982452005464361], clipLow: 0, clipHigh: 1, grid: 33 },
      c50: { kind: "neural-spline", direct: [0.6963024609556053,0.013240049059083391,-0.14965899534890417,0.15042638504874437,0.06853401585006909,0.06396292626261701,0.05162575180719164,0.013730019834980926,-0.0000920076247898505,0.23503244520603808,0.2232907478815123,0.11066162695064302,-0.09913018804521544], hidden: [0.2847486764074417,0.34603949824178154,-0.3573432403508784,-0.28172282592665854,0.01750663022727402,0.2887723324763287,-0.2949703886521331,-0.28622658545023105,0.3312226780918967,-0.12703372701687451,-0.2844825917807351,-0.2875416920465929], bias: -0.1514559214533184, knots: [0,0.08414736183257543,0.16568786114387044,0.2381031210949284,0.3003848092817309,0.3552050449289265,0.4061652769037085,0.4540984549746064,0.5007203312320789,0.5469411958978625,0.5946728623865958,0.6448490240063279,0.6982069922801365,0.7586608968243376,0.8302870129829011,0.9095813013228347,1], clipLow: 0.047409527003765106, clipHigh: 0.9467873573303223, grid: 33 },
      c100: { kind: "neural-spline", direct: [0.8264303261972499,0.11746194748869923,-0.17326406200059616,0.2526092081697498,-0.009022266547949203,-0.023351654996672837,0.06399628596346582,0.007188486743968793,-0.05841742805503554,0.2465872348443795,0.31842101758118047,-0.04648023236356685,0.06872077130617048], hidden: [0.5319873987130196,0.5214157658219378,-0.6306211910531624,-0.42329175114552925,1.0361712426542267,0.36114119522689836,-0.3701015459251875,-0.35912668615961324,0.4632531030024978,-1.1184749036644275,-0.5198777377123887,-0.3600012684432821], bias: 0.08895114572202423, knots: [0,0.10583756207120812,0.16298918159849057,0.2078883383867346,0.2580222578441751,0.30994085535995974,0.3701777993112975,0.43127537488026935,0.492283361128518,0.5524548342960856,0.6094560998101717,0.6658690328862807,0.7179352498444882,0.7720300694070753,0.8287674695101179,0.8925079016339557,1], clipLow: 0.07675322890281677, clipHigh: 0.9193801879882812, grid: 33 },
      residualStrength: 1,
      useLut: false,
      grid: 33,
      quality: "fine"
    }
  };

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sigmoid = (x) => x >= 0 ? 1 / (1 + Math.exp(-Math.min(40, x))) : Math.exp(Math.max(-40, x)) / (1 + Math.exp(Math.max(-40, x)));
  const clampPercent = (v, fallback = 0) => { const n = Number(v); return Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : fallback))); };
  const clampSignedPercent = (v, fallback = 0) => { const n = Number(v); return Math.max(-100, Math.min(100, Math.round(Number.isFinite(n) ? n : fallback))); };
  const normalizeColor = (value, fallback = "#ffffff") => { let s = String(value || "").trim().toLowerCase(); if (/^[0-9a-f]{8}$/i.test(s)) s = `#${s.slice(2)}`; const m = s.match(/^#?([0-9a-f]{6})$/i); return m ? `#${m[1].toLowerCase()}` : fallback; };
  const hexRGB = (hex) => { const n = parseInt(normalizeColor(hex).slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

  function context(data, width, height, enabled) {
    const count = width * height, lum = new Float32Array(count);
    for (let p = 0, j = 0; p < count; p++, j += 4) lum[p] = (0.2126 * data[j] + 0.7152 * data[j + 1] + 0.0722 * data[j + 2]) / 255;
    if (!enabled) return { width, height, lum, integral: null, enabled: false };
    const stride = width + 1, integral = new Float64Array((width + 1) * (height + 1));
    for (let y = 0; y < height; y++) { let row = 0; const base = (y + 1) * stride, prev = y * stride; for (let x = 0; x < width; x++) { row += lum[y * width + x]; integral[base + x + 1] = integral[prev + x + 1] + row; } }
    return { width, height, lum, integral, enabled: true };
  }
  function box(c, x, y, radius) {
    if (!c.enabled) return c.lum[y * c.width + x];
    const x0 = Math.max(0, x - radius), x1 = Math.min(c.width - 1, x + radius), y0 = Math.max(0, y - radius), y1 = Math.min(c.height - 1, y + radius), stride = c.width + 1, I = c.integral;
    return (I[(y1 + 1) * stride + x1 + 1] - I[y0 * stride + x1 + 1] - I[(y1 + 1) * stride + x0] + I[y0 * stride + x0]) / ((x1 - x0 + 1) * (y1 - y0 + 1));
  }
  function features(data, pixel, c, normalizer, out) {
    const j = pixel * 4, r = data[j] / 255, g = data[j + 1] / 255, b = data[j + 2] / 255, l = c.lum[pixel], x = pixel % c.width, y = (pixel / c.width) | 0;
    let m3 = l, m7 = l, m15 = l, localContrast = 0, gradient = 0;
    if (c.enabled) { m3 = box(c, x, y, 1); m7 = box(c, x, y, 3); m15 = box(c, x, y, 7); localContrast = Math.abs(l - m7); const xl = Math.max(0, x - 1), xr = Math.min(c.width - 1, x + 1), yu = Math.max(0, y - 1), yd = Math.min(c.height - 1, y + 1); gradient = 0.5 * (Math.abs(c.lum[y * c.width + xr] - c.lum[y * c.width + xl]) + Math.abs(c.lum[yd * c.width + x] - c.lum[yu * c.width + x])); }
    const max = Math.max(r, g, b), min = Math.min(r, g, b), chroma = max - min;
    const raw = [r,g,b,l,m3,m7,m15,localContrast,gradient,max,min,chroma,chroma / (max + 1e-4)];
    for (let k = 0; k < F; k++) out[k] = (raw[k] - normalizer.mean[k]) / normalizer.scale[k];
    return [r, g, b];
  }
  function hidden(network, input, out) { for (let j = 0; j < network.hiddenCount; j++) { let z = network.b1[j], offset = j * F; for (let k = 0; k < F; k++) z += network.w1[offset + k] * input[k]; out[j] = Math.tanh(z); } }
  function spline(head, value) { const low = clamp(head.clipLow || 0), high = clamp(head.clipHigh ?? 1); if (low > 0 && value <= low) return 0; if (high < 1 && value >= high) return 1; const q = clamp((value - low) / Math.max(0.02, high - low)), pos = q * (head.knots.length - 1), i = Math.min(head.knots.length - 2, Math.floor(pos)); return clamp(lerp(head.knots[i], head.knots[i + 1], pos - i)); }
  function score(head, input, hiddenValues) { let z = head.bias; for (let k = 0; k < F; k++) z += head.direct[k] * input[k]; for (let j = 0; j < hiddenValues.length; j++) z += head.hidden[j] * hiddenValues[j]; return spline(head, sigmoid(z)); }

  function normalizeDuoToneParams(params = {}) { return { color1: normalizeColor(params.color1 || DUOTONE_SETTINGS.color1, DUOTONE_SETTINGS.color1), color2: normalizeColor(params.color2 || DUOTONE_SETTINGS.color2, DUOTONE_SETTINGS.color2), brightness: clampSignedPercent(params.brightness, 0), contrast: clampPercent(params.contrast, 100), fade: clampPercent(params.fade, 0) }; }
  function applyDuoToneRGBA(data, width, height, brightness = 0, contrast = 100, settings = DUOTONE_SETTINGS) {
    const color1 = hexRGB(settings.color1), color2 = hexRGB(settings.color2), model = settings.model, c = context(data, width, height, model.normalizer.spatial !== false), out = new Uint8ClampedArray(data.length), input = new Float64Array(F), hiddenValues = new Float64Array(model.network.hiddenCount), bb = clamp(brightness / 100, -1, 1), cc = clamp(contrast, 0, 100);
    for (let pixel = 0, j = 0; pixel < width * height; pixel++, j += 4) {
      features(data, pixel, c, model.normalizer, input); hidden(model.network, input, hiddenValues);
      const s0 = score(model.c0, input, hiddenValues), s100 = score(model.c100, input, hiddenValues); let t;
      if (cc >= 100) t = s100;
      else if (cc <= 20) t = lerp(s0, score(model.c20, input, hiddenValues), cc / 20);
      else { const s20 = score(model.c20, input, hiddenValues), s50 = score(model.c50, input, hiddenValues); t = cc <= 50 ? lerp(s20, s50, (cc - 20) / 30) : lerp(s50, s100, (cc - 50) / 50); }
      t = bb >= 0 ? t + (1 - t) * bb : t * (1 + bb);
      out[j] = Math.round(255 * lerp(color1[0], color2[0], t)); out[j + 1] = Math.round(255 * lerp(color1[1], color2[1], t)); out[j + 2] = Math.round(255 * lerp(color1[2], color2[2], t)); out[j + 3] = data[j + 3];
    }
    return out;
  }
  function applyDuoToneIshToBuffer(source, width, height, params = {}) { const p = normalizeDuoToneParams(params), effect = applyDuoToneRGBA(source, width, height, p.brightness, p.contrast, { ...DUOTONE_SETTINGS, color1: p.color1, color2: p.color2 }), fade = p.fade / 100; if (fade <= 0) return effect; if (fade >= 1) return new Uint8ClampedArray(source); const out = new Uint8ClampedArray(source.length); for (let i = 0; i < source.length; i += 4) { out[i] = Math.round(lerp(effect[i], source[i], fade)); out[i + 1] = Math.round(lerp(effect[i + 1], source[i + 1], fade)); out[i + 2] = Math.round(lerp(effect[i + 2], source[i + 2], fade)); out[i + 3] = source[i + 3]; } return out; }
  function applyDuoToneIshToImageData(imageData, params = {}) { return new ImageData(applyDuoToneIshToBuffer(imageData.data, imageData.width, imageData.height, params), imageData.width, imageData.height); }
  function applyDuoToneIshToCanvas(sourceCanvas, destinationCanvas = sourceCanvas, params = {}) { const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true }), output = applyDuoToneIshToImageData(ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height), params); destinationCanvas.width = sourceCanvas.width; destinationCanvas.height = sourceCanvas.height; destinationCanvas.getContext("2d").putImageData(output, 0, 0); return destinationCanvas; }

  root.DuoToneFilter = { DUOTONE_SETTINGS, normalizeDuoToneParams, applyDuoToneRGBA, applyDuoToneIshToBuffer, applyDuoToneIshToImageData, applyDuoToneIshToCanvas };
})(typeof window !== "undefined" ? window : globalThis);
