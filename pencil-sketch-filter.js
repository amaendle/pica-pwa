(function () {
  "use strict";

  const PENCIL_SKETCH_DEFAULTS=Object.freeze({enabled:true,radius:2,strength:100,fade:0});
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
  const smoothstep=(low,high,value)=>{const t=clamp((value-low)/(high-low),0,1);return t*t*(3-2*t);};
  function normalizePencilSketchParams(params={}) {
    const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
    return {enabled:params.enabled===undefined?true:!!params.enabled,radius:clamp(number(params.radius,2),1.3,5),strength:clamp(number(params.strength,100),0,200),fade:clamp(number(params.fade,0),0,100)};
  }
  // Legacy Picasa quirk: Radius is stored continuously, but observed output
  // changes in discrete processing stages, especially around Radius ~= 3.
  // Picasa previews may also become unstable there on synthetic images. This
  // deterministic approximation deliberately quantizes scale without copying
  // that preview instability.
  function radiusToDiscreteKernel(radius){return Math.round(clamp(Number(radius)||2,1.3,5)*2)/2;}
  function strengthToDetailGain(strength){const normalized=clamp(Number(strength)||0,0,200)/100;return 1.5+9*Math.sqrt(normalized);}
  function assertImage(source,width,height){if(!(source instanceof Uint8ClampedArray))throw new TypeError("source must be Uint8ClampedArray");width=Math.floor(Number(width));height=Math.floor(Number(height));if(width<1||height<1||source.length<width*height*4)throw new RangeError("invalid Pencil Sketch dimensions");return {width,height};}
  function computeLuminance(source,width,height){const luminance=new Float32Array(width*height);for(let p=0,i=0;p<luminance.length;p++,i+=4)luminance[p]=.299*source[i]+.587*source[i+1]+.114*source[i+2];return luminance;}
  function gaussianKernel(sigma){const radius=Math.max(1,Math.ceil(sigma*2.5)),kernel=new Float32Array(radius*2+1);let sum=0;for(let i=-radius;i<=radius;i++){const value=Math.exp(-(i*i)/(2*sigma*sigma));kernel[i+radius]=value;sum+=value;}for(let i=0;i<kernel.length;i++)kernel[i]/=sum;return {kernel,radius};}
  function blurLuminance(source,width,height,sigma){const {kernel,radius}=gaussianKernel(sigma),temporary=new Float32Array(source.length),output=new Float32Array(source.length);for(let y=0;y<height;y++)for(let x=0;x<width;x++){let sum=0;for(let k=-radius;k<=radius;k++)sum+=source[y*width+clamp(x+k,0,width-1)]*kernel[k+radius];temporary[y*width+x]=sum;}for(let y=0;y<height;y++)for(let x=0;x<width;x++){let sum=0;for(let k=-radius;k<=radius;k++)sum+=temporary[clamp(y+k,0,height-1)*width+x]*kernel[k+radius];output[y*width+x]=sum;}return output;}
  function buildPencilSketchMap(source,width,height,params={}) {
    ({width,height}=assertImage(source,width,height));const p=normalizePencilSketchParams(params),luma=computeLuminance(source,width,height),effectiveRadius=radiusToDiscreteKernel(p.radius),local=blurLuminance(luma,width,height,effectiveRadius),sketch=new Float32Array(luma.length),sample=(x,y)=>luma[clamp(y,0,height-1)*width+clamp(x,0,width-1)],detailGain=strengthToDetailGain(p.strength);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x,gx=(sample(x+1,y)-sample(x-1,y))*.5,gy=(sample(x,y+1)-sample(x,y-1))*.5,gradient=Math.hypot(gx,gy),strongContour=smoothstep(34,125,gradient)*150,localDetail=Math.abs(luma[i]-local[i]),texture=Math.max(0,localDetail-1.25)*detailGain,response=clamp(strongContour+texture,0,255);sketch[i]=255-response;}
    return {sketch,effectiveRadius};
  }
  function applyPencilSketchToBuffer(source,width,height,params={}) {
    ({width,height}=assertImage(source,width,height));const p=normalizePencilSketchParams(params),output=source.slice(0,width*height*4);if(!p.enabled||p.fade>=100)return output;const {sketch}=buildPencilSketchMap(source,width,height,p),fade=p.fade/100;
    for(let pixel=0,index=0;pixel<sketch.length;pixel++,index+=4){const gray=sketch[pixel];for(let c=0;c<3;c++)output[index+c]=Math.round(gray+(source[index+c]-gray)*fade);output[index+3]=source[index+3];}return output;
  }
  function applyPencilSketchToCanvas(sourceCanvas,destinationCanvas,params={}){const context=sourceCanvas.getContext("2d",{willReadFrequently:true}),image=context.getImageData(0,0,sourceCanvas.width,sourceCanvas.height),data=applyPencilSketchToBuffer(image.data,image.width,image.height,params),output=destinationCanvas||document.createElement("canvas");output.width=image.width;output.height=image.height;output.getContext("2d").putImageData(new ImageData(data,image.width,image.height),0,0);return output;}
  window.PencilSketchFilter={PENCIL_SKETCH_DEFAULTS,normalizePencilSketchParams,radiusToDiscreteKernel,strengthToDetailGain,computeLuminance,buildPencilSketchMap,applyPencilSketchToBuffer,applyPencilSketchToCanvas};
})();
