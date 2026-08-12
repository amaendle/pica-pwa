(function () {
  "use strict";

  const POLAROID_SIDE_BORDER_RATIO = 0.0645;
  const POLAROID_TOP_BORDER_RATIO = 0.097;
  const POLAROID_BOTTOM_BORDER_RATIO = 0.258;
  const POLAROID_MARGIN_LEFT = 11, POLAROID_MARGIN_RIGHT = 11;
  const POLAROID_MARGIN_TOP = 8, POLAROID_MARGIN_BOTTOM = 14;
  const POLAROID_SHADOW_OFFSET_X = 0, POLAROID_SHADOW_OFFSET_Y = 3;
  // The built-in shadow appearance is provisional; calibrated card geometry is not.
  const POLAROID_SHADOW_SIGMA = 2, POLAROID_SHADOW_OPACITY = 0.10;
  const POLAROID_DEFAULTS = Object.freeze({ enabled: true, rotate: 5, backgroundColor: "#e2e2e2" });
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function normalizePolaroidColor(value, fallback = "#e2e2e2") {
    let text = String(value || "").trim().replace(/^#/, "").toLowerCase();
    if (/^[0-9a-f]{8}$/.test(text)) text = text.slice(-6);
    return /^[0-9a-f]{6}$/.test(text) ? `#${text}` : fallback;
  }
  const polaroidColorToPicasa = value => `00${normalizePolaroidColor(value).slice(1)}`;
  function normalizePolaroidParams(params = {}) {
    const rotate = Number.isFinite(Number(params.rotate)) ? Number(params.rotate) : 5;
    return {
      enabled: params.enabled === undefined ? true : !!params.enabled,
      rotate: clamp(rotate, -10, 10),
      backgroundColor: normalizePolaroidColor(params.backgroundColor),
    };
  }

  function getPolaroidGeometry(sourceWidth, sourceHeight, rotate = 0, previewScale = 1) {
    const scale = Math.max(0, Number(previewScale) || 1);
    const width = Math.max(1, Math.round(sourceWidth)), height = Math.max(1, Math.round(sourceHeight));
    const squareSize = Math.min(width, height);
    const cropRect = { x: Math.floor((width - squareSize) / 2), y: Math.floor((height - squareSize) / 2), width: squareSize, height: squareSize };
    const sideBorder = Math.round(squareSize * POLAROID_SIDE_BORDER_RATIO);
    const topBorder = Math.round(squareSize * POLAROID_TOP_BORDER_RATIO);
    const bottomBorder = Math.round(squareSize * POLAROID_BOTTOM_BORDER_RATIO);
    const paperWidth = squareSize + 2 * sideBorder, paperHeight = squareSize + topBorder + bottomBorder;
    const baseWidth = paperWidth + POLAROID_MARGIN_LEFT + POLAROID_MARGIN_RIGHT;
    const baseHeight = paperHeight + POLAROID_MARGIN_TOP + POLAROID_MARGIN_BOTTOM;
    const radians = Math.abs(clamp(Number(rotate) || 0, -10, 10)) * Math.PI / 180;
    const outputWidth = Math.max(1, Math.floor(Math.abs(baseWidth * Math.cos(radians)) + Math.abs(baseHeight * Math.sin(radians))));
    const outputHeight = Math.max(1, Math.floor(Math.abs(baseWidth * Math.sin(radians)) + Math.abs(baseHeight * Math.cos(radians))));
    return {
      squareSize, cropRect, sideBorder, topBorder, bottomBorder,
      paperRect: { x: POLAROID_MARGIN_LEFT, y: POLAROID_MARGIN_TOP, width: paperWidth, height: paperHeight },
      photoRect: { x: POLAROID_MARGIN_LEFT + sideBorder, y: POLAROID_MARGIN_TOP + topBorder, width: squareSize, height: squareSize },
      baseWidth, baseHeight, outputWidth, outputHeight, previewScale: scale,
    };
  }

  function erf(value) { const sign=value<0?-1:1,x=Math.abs(value),t=1/(1+.3275911*x),q=(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t; return sign*(1-q*Math.exp(-x*x)); }
  const phi = value => .5 * (1 + erf(value / Math.SQRT2));
  const axisMask = (position, start, length, sigma) => phi((start + length - .5 - position) / sigma) - phi((start - .5 - position) / sigma);
  function colorBytes(color) { const text=normalizePolaroidColor(color).slice(1); return [parseInt(text.slice(0,2),16),parseInt(text.slice(2,4),16),parseInt(text.slice(4,6),16)]; }
  function fill(data, color) { for(let i=0;i<data.length;i+=4){data[i]=color[0];data[i+1]=color[1];data[i+2]=color[2];data[i+3]=255;} }

  function makeBaseComposition(source, width, height, params) {
    const geometry = getPolaroidGeometry(width, height, params.rotate), background = colorBytes(params.backgroundColor);
    const data = new Uint8ClampedArray(geometry.baseWidth * geometry.baseHeight * 4); fill(data, background);
    const shadowX=geometry.paperRect.x+POLAROID_SHADOW_OFFSET_X, shadowY=geometry.paperRect.y+POLAROID_SHADOW_OFFSET_Y;
    for(let y=0;y<geometry.baseHeight;y++){const my=axisMask(y,shadowY,geometry.paperRect.height,POLAROID_SHADOW_SIGMA);for(let x=0;x<geometry.baseWidth;x++){const alpha=axisMask(x,shadowX,geometry.paperRect.width,POLAROID_SHADOW_SIGMA)*my*POLAROID_SHADOW_OPACITY;if(alpha<=1e-6)continue;const i=(y*geometry.baseWidth+x)*4;data[i]=Math.round(data[i]*(1-alpha));data[i+1]=Math.round(data[i+1]*(1-alpha));data[i+2]=Math.round(data[i+2]*(1-alpha));}}
    for(let y=geometry.paperRect.y;y<geometry.paperRect.y+geometry.paperRect.height;y++)for(let x=geometry.paperRect.x;x<geometry.paperRect.x+geometry.paperRect.width;x++){const i=(y*geometry.baseWidth+x)*4;data[i]=data[i+1]=data[i+2]=255;}
    for(let y=0;y<geometry.squareSize;y++){const sourceStart=((geometry.cropRect.y+y)*width+geometry.cropRect.x)*4,destinationStart=((geometry.photoRect.y+y)*geometry.baseWidth+geometry.photoRect.x)*4;data.set(source.subarray(sourceStart,sourceStart+geometry.squareSize*4),destinationStart);}
    return { data, geometry, background };
  }

  function applyPolaroidToBuffer(source, width, height, params = {}) {
    if (!(source instanceof Uint8ClampedArray)) throw new TypeError("source must be Uint8ClampedArray");
    const normalized = normalizePolaroidParams(params);
    if (!normalized.enabled) return { data: source.slice(0, width * height * 4), width, height };
    const base = makeBaseComposition(source, width, height, normalized), g=base.geometry;
    if (normalized.rotate === 0) return { data: base.data, width:g.baseWidth, height:g.baseHeight };
    const output=new Uint8ClampedArray(g.outputWidth*g.outputHeight*4);fill(output,base.background);
    const radians=normalized.rotate*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians),sourceCx=g.baseWidth/2,sourceCy=g.baseHeight/2,destCx=g.outputWidth/2,destCy=g.outputHeight/2;
    for(let y=0;y<g.outputHeight;y++)for(let x=0;x<g.outputWidth;x++){const rx=x+.5-destCx,ry=y+.5-destCy,sx=cos*rx+sin*ry+sourceCx-.5,sy=-sin*rx+cos*ry+sourceCy-.5;if(sx<0||sy<0||sx>g.baseWidth-1||sy>g.baseHeight-1)continue;const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(g.baseWidth-1,x0+1),y1=Math.min(g.baseHeight-1,y0+1),fx=sx-x0,fy=sy-y0,di=(y*g.outputWidth+x)*4;for(let c=0;c<3;c++){const a=base.data[(y0*g.baseWidth+x0)*4+c]*(1-fx)+base.data[(y0*g.baseWidth+x1)*4+c]*fx,b=base.data[(y1*g.baseWidth+x0)*4+c]*(1-fx)+base.data[(y1*g.baseWidth+x1)*4+c]*fx;output[di+c]=Math.round(a*(1-fy)+b*fy);}output[di+3]=255;}
    return { data:output, width:g.outputWidth, height:g.outputHeight };
  }
  function applyPolaroidToCanvas(sourceCanvas,destinationCanvas,params={}){const context=sourceCanvas.getContext("2d",{willReadFrequently:true}),image=context.getImageData(0,0,sourceCanvas.width,sourceCanvas.height),result=applyPolaroidToBuffer(image.data,image.width,image.height,params),output=destinationCanvas||document.createElement("canvas");output.width=result.width;output.height=result.height;output.getContext("2d").putImageData(new ImageData(result.data,result.width,result.height),0,0);return output;}

  window.PolaroidFilter={POLAROID_SIDE_BORDER_RATIO,POLAROID_TOP_BORDER_RATIO,POLAROID_BOTTOM_BORDER_RATIO,POLAROID_MARGIN_LEFT,POLAROID_MARGIN_RIGHT,POLAROID_MARGIN_TOP,POLAROID_MARGIN_BOTTOM,POLAROID_SHADOW_OFFSET_X,POLAROID_SHADOW_OFFSET_Y,POLAROID_SHADOW_SIGMA,POLAROID_SHADOW_OPACITY,POLAROID_DEFAULTS,normalizePolaroidColor,polaroidColorToPicasa,normalizePolaroidParams,getPolaroidGeometry,applyPolaroidToBuffer,applyPolaroidToCanvas};
})();
