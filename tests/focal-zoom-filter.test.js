const assert=require("assert"),fs=require("fs"),vm=require("vm");
const sandbox={window:{},Uint8ClampedArray,Math};vm.createContext(sandbox);vm.runInContext(fs.readFileSync("focal-zoom-filter.js","utf8"),sandbox);const F=sandbox.window.FocalZoomFilter,plain=x=>JSON.parse(JSON.stringify(x)),approx=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
assert.deepStrictEqual(plain(F.normalizeFocalZoomParams({relX:-1,relY:2,zoominess:200,focalSize:-2,edgeHardness:120,fade:101})),{enabled:true,relX:0,relY:1,zoominess:100,focalSize:0,edgeHardness:100,fade:100});
assert.strictEqual(F.zoominessToStrength(0),0);let previous=0;for(let z=1;z<=100;z++){const value=F.zoominessToStrength(z);assert.ok(value>previous);previous=value;}
let radii=F.getFocalZoomRadii(800,600,50,50);assert.deepStrictEqual(plain(radii),{outerRadius:150,hardRadius:75});radii=F.getFocalZoomRadii(800,600,100,100);assert.deepStrictEqual(plain(radii),{outerRadius:300,hardRadius:300});
assert.strictEqual(F.getFocalZoomMask(40,50,100),0);assert.strictEqual(F.getFocalZoomMask(110,50,100),1);approx(F.getFocalZoomMask(75,50,100),.5);
let point=F.resolveFocalZoomPoint(800,600,{relX:.5,relY:.5},{originalFullWidth:1000,originalFullHeight:800,cropLeft:100,cropTop:100,cropWidth:800,cropHeight:600});assert.deepStrictEqual(plain(point),{focusX:400,focusY:300});
point=F.resolveFocalZoomPoint(300,200,{relX:.25,relY:.75});assert.deepStrictEqual(plain(point),{focusX:75,focusY:150});
const source=new Uint8ClampedArray([10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160]);for(const params of [{enabled:false},{zoominess:0},{fade:100}]){const output=F.applyFocalZoomToBuffer(source,2,2,params);assert.deepStrictEqual(Array.from(output),Array.from(source));}
const output=F.applyFocalZoomToBuffer(source,2,2,{zoominess:100,focalSize:0,edgeHardness:0,fade:0});assert.strictEqual(output.length,source.length);for(let i=3;i<output.length;i+=4)assert.strictEqual(output[i],source[i],"alpha preserved");
const html=fs.readFileSync("index.html","utf8");assert.match(html,/FocalZoom=\$\{p\.enabled\?1:0\}/);assert.match(html,/applyFocalZoomToCanvas/);assert.match(html,/<b>Effects &amp; Finishes<\/b>[\s\S]*btnFocalZoomMode/);assert.match(html,/originalFullWidth[\s\S]*cropLeft/);
console.log("focal-zoom-filter tests passed");
