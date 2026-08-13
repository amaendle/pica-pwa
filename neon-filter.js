(function () {
  "use strict";

  const NEON_DEFAULTS=Object.freeze({enabled:true,fade:0,color:"#ff0000"});
  const NEON_GLOW_SIGMA=2;
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
  const smoothstep=(low,high,value)=>{const t=clamp((value-low)/(high-low),0,1);return t*t*(3-2*t);};
  function normalizeNeonColor(value,fallback="#ff0000") {
    let text=String(value||"").trim().replace(/^#/,"").toLowerCase();
    if(/^[0-9a-f]{8}$/.test(text))text=text.slice(-6);
    return /^[0-9a-f]{6}$/.test(text)?`#${text}`:fallback;
  }
  const neonColorToPicasa=value=>`00${normalizeNeonColor(value).slice(1)}`;
  function normalizeNeonParams(params={}) {
    const fade=Number(params.fade);
    return {enabled:params.enabled===undefined?true:!!params.enabled,fade:clamp(Number.isFinite(fade)?fade:0,0,100),color:normalizeNeonColor(params.color)};
  }
  function assertImage(source,width,height){if(!(source instanceof Uint8ClampedArray))throw new TypeError("source must be Uint8ClampedArray");width=Math.floor(Number(width));height=Math.floor(Number(height));if(width<1||height<1||source.length<width*height*4)throw new RangeError("invalid Neon image dimensions");return {width,height};}

  // Scharr gradients are evaluated independently for R, G and B. Combining
  // channel-vector magnitudes (rather than luminance) preserves hue-only seams.
  function computeNeonEdgeMap(source,width,height) {
    ({width,height}=assertImage(source,width,height));const edge=new Float32Array(width*height),sample=(x,y,c)=>source[(clamp(y,0,height-1)*width+clamp(x,0,width-1))*4+c]/255;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){let sum=0;for(let c=0;c<3;c++){
      const gx=(3*(sample(x+1,y-1,c)-sample(x-1,y-1,c))+10*(sample(x+1,y,c)-sample(x-1,y,c))+3*(sample(x+1,y+1,c)-sample(x-1,y+1,c)))/16;
      const gy=(3*(sample(x-1,y+1,c)-sample(x-1,y-1,c))+10*(sample(x,y+1,c)-sample(x,y-1,c))+3*(sample(x+1,y+1,c)-sample(x+1,y-1,c)))/16;
      sum+=gx*gx+gy*gy;
    }edge[y*width+x]=clamp(Math.sqrt(sum/3)*1.35,0,1);}
    return edge;
  }
  function gaussianKernel(sigma){const radius=Math.max(1,Math.ceil(sigma*3)),kernel=new Float32Array(radius*2+1);let sum=0;for(let i=-radius;i<=radius;i++){const value=Math.exp(-(i*i)/(2*sigma*sigma));kernel[i+radius]=value;sum+=value;}for(let i=0;i<kernel.length;i++)kernel[i]/=sum;return {kernel,radius};}
  function blurScalar(source,width,height,sigma=NEON_GLOW_SIGMA){const {kernel,radius}=gaussianKernel(sigma),temporary=new Float32Array(source.length),output=new Float32Array(source.length);for(let y=0;y<height;y++)for(let x=0;x<width;x++){let sum=0;for(let k=-radius;k<=radius;k++)sum+=source[y*width+clamp(x+k,0,width-1)]*kernel[k+radius];temporary[y*width+x]=sum;}for(let y=0;y<height;y++)for(let x=0;x<width;x++){let sum=0;for(let k=-radius;k<=radius;k++)sum+=temporary[clamp(y+k,0,height-1)*width+x]*kernel[k+radius];output[y*width+x]=sum;}return output;}
  function buildNeonIntensityMaps(source,width,height){const edge=computeNeonEdgeMap(source,width,height),core=new Float32Array(edge.length),glowSource=new Float32Array(edge.length);for(let i=0;i<edge.length;i++){core[i]=smoothstep(.18,.72,edge[i]);glowSource[i]=smoothstep(.025,.5,edge[i]);}return {edge,core,glow:blurScalar(glowSource,width,height)};}
  function colorBytes(color){const text=normalizeNeonColor(color).slice(1);return [parseInt(text.slice(0,2),16)/255,parseInt(text.slice(2,4),16)/255,parseInt(text.slice(4,6),16)/255];}
  function applyNeonToBuffer(source,width,height,params={}) {
    ({width,height}=assertImage(source,width,height));const p=normalizeNeonParams(params),output=source.slice(0,width*height*4);if(!p.enabled||p.fade>=100)return output;
    const maps=buildNeonIntensityMaps(source,width,height),color=colorBytes(p.color),fade=p.fade/100;
    for(let pixel=0,index=0;pixel<width*height;pixel++,index+=4){const core=maps.core[pixel],glow=maps.glow[pixel],neon=[0,0,0];for(let c=0;c<3;c++){neon[c]=clamp((glow*.9*color[c]+core)*255,0,255);output[index+c]=Math.round(neon[c]+(source[index+c]-neon[c])*fade);}output[index+3]=source[index+3];}
    return output;
  }
  function applyNeonToCanvas(sourceCanvas,destinationCanvas,params={}){const context=sourceCanvas.getContext("2d",{willReadFrequently:true}),image=context.getImageData(0,0,sourceCanvas.width,sourceCanvas.height),data=applyNeonToBuffer(image.data,image.width,image.height,params),output=destinationCanvas||document.createElement("canvas");output.width=image.width;output.height=image.height;output.getContext("2d").putImageData(new ImageData(data,image.width,image.height),0,0);return output;}
  window.NeonFilter={NEON_DEFAULTS,NEON_GLOW_SIGMA,normalizeNeonColor,neonColorToPicasa,normalizeNeonParams,computeNeonEdgeMap,buildNeonIntensityMaps,applyNeonToBuffer,applyNeonToCanvas};
})();
