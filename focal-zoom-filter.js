(function () {
  "use strict";

  const FOCAL_ZOOM_DEFAULTS = Object.freeze({ enabled:true, relX:0.5, relY:0.5, zoominess:50, focalSize:50, edgeHardness:100, fade:0 });
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
  const smoothstep01=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};

  function normalizeFocalZoomParams(params={}) {
    const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
    return {
      enabled:params.enabled===undefined?true:!!params.enabled,
      relX:clamp(number(params.relX,.5),0,1), relY:clamp(number(params.relY,.5),0,1),
      zoominess:clamp(number(params.zoominess,50),0,100), focalSize:clamp(number(params.focalSize,50),0,100),
      edgeHardness:clamp(number(params.edgeHardness,100),0,100), fade:clamp(number(params.fade,0),0,100),
    };
  }

  // Empirically reconstructed from calibration images. Keep isolated so a
  // better Picasa zoom-kernel fit can be substituted without changing state.
  function zoominessToStrength(zoominess) {
    const z=clamp(Number(zoominess)||0,0,100);if(z<=0)return 0;
    return .55*(1-Math.exp(-3*z/100));
  }
  function getFocalZoomRadii(width,height,focalSize,edgeHardness) {
    const outerRadius=Math.min(width,height)*clamp(Number(focalSize)||0,0,100)/200;
    return { outerRadius, hardRadius:outerRadius*clamp(Number(edgeHardness)||0,0,100)/100 };
  }
  function getFocalZoomMask(distance,hardRadius,outerRadius) {
    if(outerRadius<=0)return 1;if(distance<=hardRadius)return 0;if(distance>=outerRadius)return 1;
    if(outerRadius===hardRadius)return distance>outerRadius?1:0;
    return smoothstep01((distance-hardRadius)/(outerRadius-hardRadius));
  }
  // relX/relY deliberately live in original/pre-crop coordinates. The render
  // context maps that point into the current cropped raster explicitly.
  function resolveFocalZoomPoint(width,height,params={},renderContext={}) {
    const p=normalizeFocalZoomParams(params);
    const originalFullWidth=Math.max(1,Number(renderContext.originalFullWidth)||width);
    const originalFullHeight=Math.max(1,Number(renderContext.originalFullHeight)||height);
    const cropLeft=Number(renderContext.cropLeft)||0,cropTop=Number(renderContext.cropTop)||0;
    const cropWidth=Math.max(1,Number(renderContext.cropWidth)||width),cropHeight=Math.max(1,Number(renderContext.cropHeight)||height);
    return { focusX:(p.relX*originalFullWidth-cropLeft)*width/cropWidth, focusY:(p.relY*originalFullHeight-cropTop)*height/cropHeight };
  }
  function sampleBilinear(source,width,height,x,y,channel) {
    x=clamp(x,0,width-1);y=clamp(y,0,height-1);const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),fx=x-x0,fy=y-y0;
    const a=source[(y0*width+x0)*4+channel]*(1-fx)+source[(y0*width+x1)*4+channel]*fx;
    const b=source[(y1*width+x0)*4+channel]*(1-fx)+source[(y1*width+x1)*4+channel]*fx;
    return a*(1-fy)+b*fy;
  }
  function applyFocalZoomToBuffer(source,width,height,params={},renderContext={}) {
    if(!(source instanceof Uint8ClampedArray))throw new TypeError("source must be Uint8ClampedArray");
    width=Math.max(1,Math.floor(width));height=Math.max(1,Math.floor(height));const p=normalizeFocalZoomParams(params),strength=zoominessToStrength(p.zoominess),output=source.slice(0,width*height*4);
    if(!p.enabled||strength<=0||p.fade>=100)return output;
    const focus=resolveFocalZoomPoint(width,height,p,renderContext),radii=getFocalZoomRadii(width,height,p.focalSize,p.edgeHardness),sampleCount=24+Math.round(24*strength/.55),effectMix=1-p.fade/100;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const dx=x-focus.focusX,dy=y-focus.focusY,mask=getFocalZoomMask(Math.hypot(dx,dy),radii.hardRadius,radii.outerRadius)*effectMix;if(mask<=0)continue;
      const i=(y*width+x)*4,sums=[0,0,0];let weights=0;
      for(let sample=0;sample<sampleCount;sample++){const t=sampleCount===1?0:sample/(sampleCount-1),scale=1+strength*t,weight=1-.25*t,sx=focus.focusX+dx*scale,sy=focus.focusY+dy*scale;for(let c=0;c<3;c++)sums[c]+=sampleBilinear(source,width,height,sx,sy,c)*weight;weights+=weight;}
      for(let c=0;c<3;c++){const blurred=sums[c]/weights;output[i+c]=Math.round(source[i+c]+(blurred-source[i+c])*mask);}output[i+3]=source[i+3];
    }
    return output;
  }
  function applyFocalZoomToCanvas(sourceCanvas,destinationCanvas,params={},renderContext={}){const context=sourceCanvas.getContext("2d",{willReadFrequently:true}),image=context.getImageData(0,0,sourceCanvas.width,sourceCanvas.height),data=applyFocalZoomToBuffer(image.data,image.width,image.height,params,renderContext),output=destinationCanvas||document.createElement("canvas");output.width=image.width;output.height=image.height;output.getContext("2d").putImageData(new ImageData(data,image.width,image.height),0,0);return output;}
  window.FocalZoomFilter={FOCAL_ZOOM_DEFAULTS,normalizeFocalZoomParams,zoominessToStrength,smoothstep01,getFocalZoomRadii,getFocalZoomMask,resolveFocalZoomPoint,applyFocalZoomToBuffer,applyFocalZoomToCanvas};
})();
