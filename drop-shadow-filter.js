(function () {
  "use strict";

  const DROP_SHADOW_SUPPORT_RATIO = 1.36;
  const DROP_SHADOW_SIGMA_RATIO = 0.35; // Provisional: exact historical Picasa kernel is not yet proven.
  const DROP_SHADOW_ZERO_SIZE_PADDING = 2;
  const DROP_SHADOW_DEFAULTS = Object.freeze({ enabled: true, distance: 4, angle: 90, size: 10, shadowColor: "#000000", backgroundColor: "#ffffff", fade: 30 });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Picasa DropShadow reference PNGs show unusual alpha variation around
  // blurred edges (down to roughly 191/255). It appears to be an export
  // artifact and is intentionally not reproduced; visible RGB is calibrated.
  function normalizeDropShadowColor(value, fallback = "#000000") {
    let s = String(value || "").trim().replace(/^#/, "").toLowerCase();
    if (/^[0-9a-f]{8}$/.test(s)) s = s.slice(-6);
    return /^[0-9a-f]{6}$/.test(s) ? `#${s}` : fallback;
  }
  const dropShadowColorToPicasa = (value, fallback) => `00${normalizeDropShadowColor(value, fallback).slice(1)}`;

  function normalizeDropShadowParams(params = {}) {
    const num = (v, d) => Number.isFinite(Number(v)) ? Number(v) : d;
    return {
      enabled: params.enabled === undefined ? true : !!params.enabled,
      distance: clamp(num(params.distance, 4), 0, 100),
      angle: ((num(params.angle, 90) % 360) + 360) % 360,
      size: clamp(num(params.size, 10), 0, 100),
      shadowColor: normalizeDropShadowColor(params.shadowColor, "#000000"),
      backgroundColor: normalizeDropShadowColor(params.backgroundColor, "#ffffff"),
      fade: clamp(num(params.fade, 30), 0, 100),
    };
  }
  function getDropShadowSupportPadding(size) { return size <= 0 ? DROP_SHADOW_ZERO_SIZE_PADDING : Math.round(size * DROP_SHADOW_SUPPORT_RATIO); }
  function getDropShadowSigma(size) { return Math.max(0, size * DROP_SHADOW_SIGMA_RATIO); }
  function getDropShadowFadeFactor(fade) { return 1 - Math.sqrt(clamp(Number(fade) || 0, 0, 100) / 100); }
  function getDropShadowOffset(distance, angle) {
    const theta = (((Number(angle) || 0) % 360) + 360) % 360 * Math.PI / 180;
    const clean = (v) => Math.abs(v) < 1e-10 ? 0 : Math.trunc(v);
    return { dx: clean((Number(distance) || 0) * Math.cos(theta)), dy: clean((Number(distance) || 0) * Math.sin(theta)) };
  }
  function getDropShadowGeometry(width, height, params = {}, previewScale = 1) {
    const p = normalizeDropShadowParams(params), scale = Math.max(0, Number(previewScale) || 1);
    width = Math.max(1, Math.round(width)); height = Math.max(1, Math.round(height));
    if (!p.enabled) return { outputWidth: width, outputHeight: height, imageX: 0, imageY: 0, shadowX: 0, shadowY: 0, dx: 0, dy: 0, supportPadding: 0, sigma: 0, params: p };
    const offset = getDropShadowOffset(p.distance, p.angle);
    const dx = Math.trunc(offset.dx * scale), dy = Math.trunc(offset.dy * scale);
    const supportPadding = Math.round(getDropShadowSupportPadding(p.size) * scale);
    const minX = Math.min(0, dx - supportPadding), minY = Math.min(0, dy - supportPadding);
    const maxX = Math.max(width, dx + width + supportPadding), maxY = Math.max(height, dy + height + supportPadding);
    const imageX = -minX || 0, imageY = -minY || 0;
    return { outputWidth: maxX - minX, outputHeight: maxY - minY, imageX, imageY, shadowX: imageX + dx, shadowY: imageY + dy, dx, dy, supportPadding, sigma: getDropShadowSigma(p.size) * scale, params: p };
  }

  function erf(v) { const s=v<0?-1:1,x=Math.abs(v),t=1/(1+.3275911*x),q=(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t; return s*(1-q*Math.exp(-x*x)); }
  const phi = v => .5 * (1 + erf(v / Math.SQRT2));
  function axisMask(position, start, length, sigma) { return phi((start + length - .5 - position) / sigma) - phi((start - .5 - position) / sigma); }
  function rgb(color) { const h=normalizeDropShadowColor(color).slice(1); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
  function applyDropShadowToBuffer(source, width, height, params = {}, renderContext = {}) {
    if (!(source instanceof Uint8ClampedArray)) throw new TypeError("source must be Uint8ClampedArray");
    const p = normalizeDropShadowParams(params);
    if (!p.enabled) return { data: source.slice(0, width * height * 4), width, height };
    const g = getDropShadowGeometry(width, height, p, renderContext.previewScale || 1), out = new Uint8ClampedArray(g.outputWidth * g.outputHeight * 4);
    const bg=rgb(p.backgroundColor), sh=rgb(p.shadowColor), factor=getDropShadowFadeFactor(p.fade);
    for(let i=0;i<out.length;i+=4){out[i]=bg[0];out[i+1]=bg[1];out[i+2]=bg[2];out[i+3]=255;}
    if (p.size <= 0) {
      for(let y=0;y<height;y++) for(let x=0;x<width;x++){const i=((g.shadowY+y)*g.outputWidth+g.shadowX+x)*4;out[i]=Math.round(bg[0]+(sh[0]-bg[0])*factor);out[i+1]=Math.round(bg[1]+(sh[1]-bg[1])*factor);out[i+2]=Math.round(bg[2]+(sh[2]-bg[2])*factor);}
    } else {
      for(let y=0;y<g.outputHeight;y++){const my=axisMask(y,g.shadowY,height,g.sigma);for(let x=0;x<g.outputWidth;x++){const amount=axisMask(x,g.shadowX,width,g.sigma)*my*factor;if(amount<=1e-7)continue;const i=(y*g.outputWidth+x)*4;out[i]=Math.round(bg[0]+(sh[0]-bg[0])*amount);out[i+1]=Math.round(bg[1]+(sh[1]-bg[1])*amount);out[i+2]=Math.round(bg[2]+(sh[2]-bg[2])*amount);}}
    }
    for(let y=0;y<height;y++){const si=y*width*4,di=((g.imageY+y)*g.outputWidth+g.imageX)*4;out.set(source.subarray(si,si+width*4),di);}
    return { data: out, width: g.outputWidth, height: g.outputHeight };
  }
  function applyDropShadowToCanvas(sourceCanvas, destinationCanvas, params={}, renderContext={}) { const c=sourceCanvas.getContext("2d",{willReadFrequently:true}),i=c.getImageData(0,0,sourceCanvas.width,sourceCanvas.height),r=applyDropShadowToBuffer(i.data,i.width,i.height,params,renderContext),o=destinationCanvas||document.createElement("canvas");o.width=r.width;o.height=r.height;o.getContext("2d").putImageData(new ImageData(r.data,r.width,r.height),0,0);return o; }
  window.DropShadowFilter={DROP_SHADOW_SUPPORT_RATIO,DROP_SHADOW_SIGMA_RATIO,DROP_SHADOW_ZERO_SIZE_PADDING,DROP_SHADOW_DEFAULTS,normalizeDropShadowColor,dropShadowColorToPicasa,normalizeDropShadowParams,getDropShadowSupportPadding,getDropShadowSigma,getDropShadowFadeFactor,getDropShadowOffset,getDropShadowGeometry,applyDropShadowToBuffer,applyDropShadowToCanvas};
})();
