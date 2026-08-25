const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const sandbox = { window:{}, Uint8ClampedArray, Float32Array, Float64Array, Math, Set, Object };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("comicize-filter.js", "utf8"), sandbox);
const C = sandbox.window.ComicizeFilter;
const plain = (value) => JSON.parse(JSON.stringify(value));

assert.deepStrictEqual(plain(C.normalizeComicizeParams({colorBrush:-1,dotDensity:150,dotFade:-2})), {enabled:true,colorBrush:0,dotDensity:100,dotFade:0,debugMode:"none",quantizeSmallRadii:false});
const grid640=C.getComicizeGrid(640,320),grid1280=C.getComicizeGrid(1280,640);
assert.strictEqual(grid640.tileSize,10);
assert.strictEqual(grid1280.tileSize,20,"grid spacing scales with current dimensions");
assert.notStrictEqual(C.getComicizeGrid(640,333).originY,0,"short-axis lattice is centered independently");

const makeUniform=(width,height,value)=>{const source=new Uint8ClampedArray(width*height*4);for(let i=0;i<source.length;i+=4)source.set([value,value,value,90+(i/4)%100],i);return source;};
const source=makeUniform(128,64,160);
for(const params of [{enabled:false},{dotFade:100}]) assert.deepStrictEqual(Array.from(C.applyComicizeToBuffer(source,128,64,params)),Array.from(source));

const brushSource=new Uint8ClampedArray([
  0,200,40,255, 255,200,80,255, 0,200,120,255
]);
const brushZero=C.applyColorBrushToBuffer(brushSource,3,1,0);
assert.deepStrictEqual(Array.from(brushZero),[0,200,40,255,200,80,0,200,120]);
const brushed=C.applyColorBrushToBuffer(brushSource,3,1,90);
for(let i=0,j=0;i<brushSource.length;i+=4,j+=3)for(let c=0;c<3;c++)assert.ok(brushed[j+c]<=brushSource[i+c]+1e-6,"Darken brush never brightens a channel");
assert.ok(brushed[3]<255,"Gaussian Color Brush darkens a bright local peak");
assert.strictEqual(brushed[0],0,"per-channel Darken keeps an already-dark channel");

const lowDensity=C.analyzeComicizeTiles(source,128,64,{dotDensity:0}),highDensity=C.analyzeComicizeTiles(source,128,64,{dotDensity:100});
assert.deepStrictEqual(lowDensity.tiles.map(t=>[t.centerX,t.centerY]),highDensity.tiles.map(t=>[t.centerX,t.centerY]),"density does not alter grid positions");
assert.ok(highDensity.tiles.some((tile,index)=>tile.radius>lowDensity.tiles[index].radius),"density changes radius response");
for(const tile of highDensity.tiles.slice(0,20)) {
  assert.ok(tile.pieceRadii.every(radius=>radius===tile.radius),"center and four owned quarters share one radius");
  assert.ok(Math.abs(tile.radius-highDensity.tileSize*.25*tile.rho)<1e-9,"pixel radius uses 0.25 * pitch * rho");
}
const center=lowDensity.tiles.reduce((a,b)=>Math.abs(b.centerX-64)+Math.abs(b.centerY-32)<Math.abs(a.centerX-64)+Math.abs(a.centerY-32)?b:a),corner=lowDensity.tiles[0];
assert.ok(corner.radius>center.radius,"uniform image has stronger corner dots from vignette");
const dark=C.analyzeComicizeTiles(makeUniform(128,64,32),128,64,{dotDensity:50}),bright=C.analyzeComicizeTiles(makeUniform(128,64,224),128,64,{dotDensity:50});
assert.ok(dark.tiles[Math.floor(dark.tiles.length/2)].radius>bright.tiles[Math.floor(bright.tiles.length/2)].radius,"dark tile average makes a larger dot");

const target=C.comicizeDotTarget(180,100,40,.7,50);
assert.ok(target.every((channel,index)=>channel>=0&&channel<=[180,100,40][index]),"dot target is clamped to brushed RGB");
assert.strictEqual(C.quantizeActiveComicize(100.6),100,"active Comicize rounds then subtracts one level");
assert.strictEqual(C.finalizeComicizeChannel(100.6,200,50),150,"Dot Fade is applied after active quantization with final truncation");

const varied=new Uint8ClampedArray(128*64*4);for(let y=0;y<64;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4,v=(x<64?35:220)+(y<32?0:25);varied.set([v,v,v,255],i);}
const analyzed=C.analyzeComicizeTiles(varied,128,64,{dotDensity:30}),shared=analyzed.tiles.filter(t=>Math.abs(t.centerX-64)<=2&&Math.abs(t.centerY-32)<=2);
assert.ok(new Set(shared.map(t=>t.radius.toFixed(6))).size>1,"four neighboring tiles at a shared corner may retain different quarter radii");
const result=C.applyComicizeToBuffer(varied,128,64,{colorBrush:35,dotDensity:50,dotFade:0});
assert.strictEqual(result.length,varied.length);
for(let i=3;i<result.length;i+=4)assert.strictEqual(result[i],varied[i],"alpha preserved");

const html=fs.readFileSync("index.html","utf8");
assert.match(html,/Comicize=\$\{p\.enabled\?1:0\}/);
assert.match(html,/applyComicizeToCanvas/);
assert.match(html,/<b>Effects &amp; Finishes<\/b>[\s\S]*btnComicizeMode/);
assert.match(html,/comicizeColorBrushInput[^>]*type="range"/);
assert.doesNotMatch(html,/comicizeColorBrushInput[^>]*disabled/);
assert.match(html,/comicizeColorBrushInput,el\.comicizeDensityInput,el\.comicizeFadeInput/);
console.log("comicize-filter tests passed");
