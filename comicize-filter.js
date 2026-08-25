(function () {
  "use strict";

  const ComicizeCalibration = Object.freeze({
    tilesAlongLongSide: 64,
    colorBrush: Object.freeze({ sigmaDivisor: 9, kernelSupportSigma: 3 }),
    density: Object.freeze({ amplitude: 0.574, decay: 38.25 }),
    vignette: Object.freeze({ p: 2.79, c: 0.97286065, m: 4.76388558 }),
    luminanceTable: Object.freeze([[16,1.730],[32,1.410],[64,.667],[96,.253],[128,0],[160,-.247],[192,-.520],[224,-.760],[240,-.873]]),
    radius: Object.freeze({ scale: 0.25, exponent: 1.175 }),
    quantizationOffset: 1
  });
  const COMICIZE_DEFAULTS = Object.freeze({ enabled:true, colorBrush:0, dotDensity:50, dotFade:0, debugMode:"none", quantizeSmallRadii:false });
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function normalizeComicizeParams(params = {}) {
    const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const allowed = new Set(["none","grid","luminance","luminanceTerm","densityTerm","radius","vignetteRadius","vignetteTerm","score","strength","alpha"]);
    return {
      enabled: params.enabled === undefined ? true : !!params.enabled,
      colorBrush: clamp(number(params.colorBrush, 0), 0, 100),
      dotDensity: clamp(number(params.dotDensity, 50), 0, 100),
      dotFade: clamp(number(params.dotFade, 0), 0, 100),
      debugMode: allowed.has(params.debugMode) ? params.debugMode : "none",
      quantizeSmallRadii: !!params.quantizeSmallRadii
    };
  }
  function assertImage(source, width, height) {
    if (!(source instanceof Uint8ClampedArray)) throw new TypeError("source must be Uint8ClampedArray");
    width = Math.floor(Number(width)); height = Math.floor(Number(height));
    if (width < 1 || height < 1 || source.length < width * height * 4) throw new RangeError("invalid Comicize dimensions");
    return { width, height };
  }
  function comicizeLuminance(r, g, b) { return 0.299*r + 0.587*g + 0.114*b; }

  function gaussianKernel(sigma) {
    if (!(sigma > 0)) return { radius:0, weights:new Float32Array([1]) };
    const radius = Math.max(1, Math.ceil(sigma * ComicizeCalibration.colorBrush.kernelSupportSigma));
    const weights = new Float32Array(radius * 2 + 1);
    let sum = 0;
    for (let offset=-radius; offset<=radius; offset++) {
      const weight = Math.exp(-(offset*offset)/(2*sigma*sigma));
      weights[offset+radius] = weight; sum += weight;
    }
    for (let i=0; i<weights.length; i++) weights[i] /= sum;
    return { radius, weights };
  }
  function sourceRgbFloat(source, width, height) {
    const rgb = new Float32Array(width*height*3);
    for (let pixel=0, si=0, di=0; pixel<width*height; pixel++, si+=4, di+=3) {
      rgb[di]=source[si]; rgb[di+1]=source[si+1]; rgb[di+2]=source[si+2];
    }
    return rgb;
  }
  function gaussianBlurGammaRGB(source, width, height, sigma) {
    const input = sourceRgbFloat(source, width, height);
    if (!(sigma > 0)) return input;
    const { radius, weights } = gaussianKernel(sigma);
    const temporary = new Float32Array(input.length), output = new Float32Array(input.length);
    for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
      const out=(y*width+x)*3;
      for (let offset=-radius; offset<=radius; offset++) {
        const sx=clamp(x+offset,0,width-1), sample=(y*width+sx)*3, weight=weights[offset+radius];
        temporary[out]+=input[sample]*weight; temporary[out+1]+=input[sample+1]*weight; temporary[out+2]+=input[sample+2]*weight;
      }
    }
    for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
      const out=(y*width+x)*3;
      for (let offset=-radius; offset<=radius; offset++) {
        const sy=clamp(y+offset,0,height-1), sample=(sy*width+x)*3, weight=weights[offset+radius];
        output[out]+=temporary[sample]*weight; output[out+1]+=temporary[sample+1]*weight; output[out+2]+=temporary[sample+2]*weight;
      }
    }
    return output;
  }
  function applyColorBrushToBuffer(source, width, height, brush) {
    ({width,height}=assertImage(source,width,height));
    const original=sourceRgbFloat(source,width,height), amount=clamp(Number(brush)||0,0,100);
    if (amount<=0) return original;
    const blurred=gaussianBlurGammaRGB(source,width,height,amount/ComicizeCalibration.colorBrush.sigmaDivisor);
    for (let i=0;i<original.length;i++) original[i]=Math.min(original[i],blurred[i]);
    return original;
  }

  function getComicizeGridPhase(width,height,tileSize) { const columns=Math.max(1,Math.ceil(width/tileSize)),rows=Math.max(1,Math.ceil(height/tileSize)); return {originX:(width-columns*tileSize)/2,originY:(height-rows*tileSize)/2,columns,rows}; }
  function getComicizeGrid(width,height) {
    width=Math.max(1,Math.floor(Number(width)||1)); height=Math.max(1,Math.floor(Number(height)||1));
    const tileSize=Math.max(1,Math.max(width,height)/ComicizeCalibration.tilesAlongLongSide), phase=getComicizeGridPhase(width,height,tileSize), tiles=[];
    for(let row=0;row<phase.rows;row++) for(let column=0;column<phase.columns;column++) {
      const left=phase.originX+column*tileSize,top=phase.originY+row*tileSize,right=left+tileSize,bottom=top+tileSize;
      tiles.push({row,column,left,top,right,bottom,x0:clamp(Math.floor(left),0,width),y0:clamp(Math.floor(top),0,height),x1:clamp(Math.ceil(right),0,width),y1:clamp(Math.ceil(bottom),0,height),centerX:(left+right)/2,centerY:(top+bottom)/2});
    }
    return {width,height,tileSize,...phase,tiles};
  }
  function densityTerm(density) { const c=ComicizeCalibration.density; return c.amplitude*(1-Math.exp(-clamp(Number(density)||0,0,100)/c.decay)); }
  // TEMPORARY empirical calibration. Replace after exact-RGB luminance calibration.
  function luminanceTerm(luminance) { const table=ComicizeCalibration.luminanceTable,value=clamp(Number(luminance)||0,table[0][0],table[table.length-1][0]); for(let i=1;i<table.length;i++) if(value<=table[i][0]) { const [x0,y0]=table[i-1],[x1,y1]=table[i],t=(value-x0)/(x1-x0); return y0+(y1-y0)*t; } return table[table.length-1][1]; }
  function getComicizeVignette(x,y,width,height) { const c=ComicizeCalibration.vignette,xn=(x-width/2)/(width/2),yn=(y-height/2)/(height/2),radius=Math.pow((Math.pow(Math.abs(xn),c.p)+Math.pow(Math.abs(yn),c.p))/2,1/c.p); return {radius,term:c.c*Math.pow(radius,c.m)}; }
  function scoreToDotStrength(score) { return clamp(score,0,1); }
  function dotStrengthToNormalizedRadius(strength, quantize=false) { let rho=Math.pow(clamp(strength,0,1),ComicizeCalibration.radius.exponent); if(quantize) rho=Math.round(rho*64)/64; return rho; }
  function dotStrengthToRadius(strength,tileSize,quantize=false) { return tileSize*ComicizeCalibration.radius.scale*dotStrengthToNormalizedRadius(strength,quantize); }
  function buildLuminanceIntegral(source,width,height) { const stride=width+1,integral=new Float64Array((width+1)*(height+1)); for(let y=0;y<height;y++){let row=0;for(let x=0;x<width;x++){const i=(y*width+x)*4;row+=comicizeLuminance(source[i],source[i+1],source[i+2]);integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;}} return {integral,stride}; }
  function tileAverage(integral,stride,tile) { const {x0,y0,x1,y1}=tile,count=Math.max(1,(x1-x0)*(y1-y0)),sum=integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0]; return sum/count; }
  function analyzeComicizeTiles(source,width,height,params={}) {
    const p=normalizeComicizeParams(params),grid=getComicizeGrid(width,height),{integral,stride}=buildLuminanceIntegral(source,width,height),density=densityTerm(p.dotDensity);
    const tiles=grid.tiles.filter(tile=>tile.x1>tile.x0&&tile.y1>tile.y0).map(tile=>{const luminance=tileAverage(integral,stride,tile),lumTerm=luminanceTerm(luminance),vignette=getComicizeVignette(tile.centerX,tile.centerY,width,height),score=lumTerm+density+vignette.term,strength=scoreToDotStrength(score),rho=dotStrengthToNormalizedRadius(strength,p.quantizeSmallRadii),radius=grid.tileSize*ComicizeCalibration.radius.scale*rho,alpha=1-p.dotFade/100;return {...tile,luminance,luminanceTerm:lumTerm,densityTerm:density,vignetteRadius:vignette.radius,vignetteTerm:vignette.term,score,strength,rho,normalizedRadius:rho,radius,alpha,pieceRadii:Object.freeze([radius,radius,radius,radius,radius])};});
    return {...grid,tiles,params:p};
  }
  function discCoverage(x,y,cx,cy,radius) { if(radius<=0)return 0; return clamp(radius+.5-Math.hypot(x+.5-cx,y+.5-cy),0,1); }
  function debugValue(tile,mode) { switch(mode){case"luminance":return tile.luminance/255;case"luminanceTerm":return clamp((tile.luminanceTerm+1)/2,0,1);case"densityTerm":return tile.densityTerm;case"radius":return tile.rho;case"vignetteRadius":return tile.vignetteRadius;case"vignetteTerm":return tile.vignetteTerm;case"score":return clamp((tile.score+1)/2,0,1);case"strength":return tile.strength;case"alpha":return tile.alpha;default:return 0;} }
  function comicizeDotTarget(r,g,b,rho,density) {
    const d=clamp(Number(density)||0,0,100)/100,k=8/9-3*clamp(rho,0,1)/8,eta=.5-d*d/8,Y=comicizeLuminance(r,g,b);
    if(!(Y>0)) return [0,0,0];
    return [r,g,b].map(channel=>clamp(k*channel*Math.pow(channel/Y,eta),0,channel));
  }
  function quantizeActiveComicize(channel) { return Math.max(0,Math.round(clamp(channel,0,255))-ComicizeCalibration.quantizationOffset); }
  function finalizeComicizeChannel(comicizeFloat,original,fade) { const comicize0=quantizeActiveComicize(comicizeFloat),f=clamp(Number(fade)||0,0,100)/100; return Math.floor(clamp(comicize0*(1-f)+original*f,0,255)); }

  function applyComicizeToBuffer(source,width,height,params={}) {
    ({width,height}=assertImage(source,width,height)); const p=normalizeComicizeParams(params),output=source.slice(0,width*height*4);
    if(!p.enabled||p.dotFade>=100)return output;
    const analysis=analyzeComicizeTiles(source,width,height,p),brushed=applyColorBrushToBuffer(source,width,height,p.colorBrush);
    for(const tile of analysis.tiles) {
      if(p.debugMode!=="none"&&p.debugMode!=="grid") { const value=Math.round(clamp(debugValue(tile,p.debugMode),0,1)*255); for(let y=tile.y0;y<tile.y1;y++)for(let x=tile.x0;x<tile.x1;x++){if(x+.5<tile.left||x+.5>=tile.right||y+.5<tile.top||y+.5>=tile.bottom)continue;const i=(y*width+x)*4;output[i]=output[i+1]=output[i+2]=value;} continue; }
      const points=[[tile.centerX,tile.centerY],[tile.left,tile.top],[tile.right,tile.top],[tile.left,tile.bottom],[tile.right,tile.bottom]];
      for(let y=tile.y0;y<tile.y1;y++) for(let x=tile.x0;x<tile.x1;x++) {
        if(x+.5<tile.left||x+.5>=tile.right||y+.5<tile.top||y+.5>=tile.bottom)continue;
        let coverage=0; for(const point of points)coverage=Math.max(coverage,discCoverage(x,y,point[0],point[1],tile.radius));
        const si=(y*width+x)*4,bi=(y*width+x)*3,r=brushed[bi],g=brushed[bi+1],b=brushed[bi+2],target=comicizeDotTarget(r,g,b,tile.rho,p.dotDensity);
        output[si]=finalizeComicizeChannel(r+(target[0]-r)*coverage,source[si],p.dotFade);
        output[si+1]=finalizeComicizeChannel(g+(target[1]-g)*coverage,source[si+1],p.dotFade);
        output[si+2]=finalizeComicizeChannel(b+(target[2]-b)*coverage,source[si+2],p.dotFade);
      }
      if(p.debugMode==="grid") for(let y=tile.y0;y<tile.y1;y++)for(let x=tile.x0;x<tile.x1;x++){if(x+.5<tile.left||x+.5>=tile.right||y+.5<tile.top||y+.5>=tile.bottom)continue;const center=Math.hypot(x+.5-tile.centerX,y+.5-tile.centerY)<=1.25,corner=points.slice(1).some(point=>Math.hypot(x+.5-point[0],y+.5-point[1])<=1.25),boundary=x===tile.x0||y===tile.y0||x===tile.x1-1||y===tile.y1-1;if(center||corner||boundary){const i=(y*width+x)*4;output[i]=center?255:0;output[i+1]=boundary?255:0;output[i+2]=corner?255:0;}}
    }
    return output;
  }
  function applyComicizeToCanvas(sourceCanvas,destinationCanvas,params={}) { const context=sourceCanvas.getContext("2d",{willReadFrequently:true}),image=context.getImageData(0,0,sourceCanvas.width,sourceCanvas.height),data=applyComicizeToBuffer(image.data,image.width,image.height,params),output=destinationCanvas||document.createElement("canvas");output.width=image.width;output.height=image.height;output.getContext("2d").putImageData(new ImageData(data,image.width,image.height),0,0);return output; }
  window.ComicizeFilter={ComicizeCalibration,COMICIZE_DEFAULTS,normalizeComicizeParams,comicizeLuminance,gaussianKernel,gaussianBlurGammaRGB,applyColorBrushToBuffer,getComicizeGridPhase,getComicizeGrid,densityTerm,luminanceTerm,getComicizeVignette,scoreToDotStrength,dotStrengthToNormalizedRadius,dotStrengthToRadius,analyzeComicizeTiles,comicizeDotTarget,quantizeActiveComicize,finalizeComicizeChannel,applyComicizeToBuffer,applyComicizeToCanvas};
})();
