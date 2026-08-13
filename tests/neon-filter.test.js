const assert=require("assert"),fs=require("fs"),vm=require("vm");
const sandbox={window:{},Uint8ClampedArray,Float32Array,Math};vm.createContext(sandbox);vm.runInContext(fs.readFileSync("neon-filter.js","utf8"),sandbox);const N=sandbox.window.NeonFilter,plain=x=>JSON.parse(JSON.stringify(x));
assert.deepStrictEqual(plain(N.normalizeNeonParams({fade:-2,color:"ff1902ff"})),{enabled:true,fade:0,color:"#1902ff"});assert.deepStrictEqual(plain(N.normalizeNeonParams({fade:200,color:"ff02ff08"})),{enabled:true,fade:100,color:"#02ff08"});
assert.deepStrictEqual([N.normalizeNeonColor("00ff0000"),N.normalizeNeonColor("ff1902ff"),N.normalizeNeonColor("ff02ff08")],["#ff0000","#1902ff","#02ff08"]);
const width=16,height=8,source=new Uint8ClampedArray(width*height*4),left=[0x54,0x83,0xe4],right=[0xac,0x7d,0x1c];for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,c=x<8?left:right;source.set([c[0],c[1],c[2],77+y],i);}
const edge=N.computeNeonEdgeMap(source,width,height);assert.ok(edge[4*width+7]>.15,"equal-luminance hue seam has a visible color-vector edge");assert.ok(edge[4*width+1]<1e-6,"flat color area has no edge");
const mapsRed=N.buildNeonIntensityMaps(source,width,height),mapsBlue=N.buildNeonIntensityMaps(source,width,height);assert.deepStrictEqual(Array.from(mapsRed.edge),Array.from(mapsBlue.edge),"edge structure is independent of neon color");
const red=N.applyNeonToBuffer(source,width,height,{fade:0,color:"00ff0000"}),blue=N.applyNeonToBuffer(source,width,height,{fade:0,color:"ff1902ff"});assert.notDeepStrictEqual(Array.from(red),Array.from(blue),"color recolors the neutral edge map");
const seam=(4*width+7)*4;assert.ok(red[seam]>0&&red[seam]>=red[seam+1],"red glow appears at seam");assert.ok(red[seam+1]>0&&red[seam+2]>0,"strong edge receives a white-hot core");
const flat=(4*width+1)*4;assert.ok(red[flat]<10&&red[flat+1]<10&&red[flat+2]<10,"pure effect background is black away from edges");
for(const params of [{enabled:false,fade:0,color:"00ff0000"},{enabled:true,fade:100,color:"00ff0000"}]){const output=N.applyNeonToBuffer(source,width,height,params);assert.deepStrictEqual(Array.from(output),Array.from(source));}
const half=N.applyNeonToBuffer(source,width,height,{fade:50,color:"00ff0000"});for(let c=0;c<3;c++)assert.ok(Math.abs(half[seam+c]-Math.round((red[seam+c]+source[seam+c])/2))<=1);for(let i=3;i<red.length;i+=4)assert.strictEqual(red[i],source[i],"alpha preserved");
const html=fs.readFileSync("index.html","utf8");assert.match(html,/Neon=\$\{p\.enabled\?1:0\}/);assert.match(html,/applyNeonToCanvas/);assert.match(html,/<b>Effects &amp; Finishes<\/b>[\s\S]*btnNeonMode/);assert.match(html,/function parseNeonFilter/);
console.log("neon-filter tests passed");
