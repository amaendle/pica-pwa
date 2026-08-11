const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const sandbox = { window: {}, Uint8ClampedArray, Float32Array, Math };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("vignette-filter.js", "utf8"), sandbox, { filename: "vignette-filter.js" });
const Vignette = sandbox.window.VignetteFilter;

assert.strictEqual(Vignette.getVignetteSigma(35, 3280), 280);
assert.strictEqual(Vignette.getVignetteSigma(50, 3280), 400);
assert.ok(Math.abs(Vignette.getVignetteSigma(50, 1647) - 200.85365853658536) < 1e-12);
assert.strictEqual(Vignette.getVignetteSigma(50, 820), 100, "sigma scales from image width");

const normalized = Vignette.normalizeVignetteParams({ size: 99, strength: 3, color: "79B3DB" });
assert.deepStrictEqual(JSON.parse(JSON.stringify(normalized)), { size: 50, strength: 2, color: "ff79b3db" });
assert.deepStrictEqual(JSON.parse(JSON.stringify(Vignette.normalizeVignetteParams({ size: -4, strength: 0, color: "bad" }))), { size: 0, strength: 1, color: "ff79b3db" });

const width = 9, height = 7;
const source = new Uint8ClampedArray(width * height * 4);
for (let i = 0; i < source.length; i += 4) {
  source[i] = 20; source[i + 1] = 40; source[i + 2] = 60; source[i + 3] = 137;
}
assert.deepStrictEqual(Array.from(Vignette.applyVignetteToBuffer(source, width, height, { size: 0, strength: 2, color: "ffffffff" })), Array.from(source), "size zero is an exact bypass");

const full = Vignette.applyVignetteToBuffer(source, width, height, { size: 50, strength: 2, color: "ff79b3db" });
const transparentColor = Vignette.applyVignetteToBuffer(source, width, height, { size: 50, strength: 2, color: "0079b3db" });
assert.deepStrictEqual(Array.from(transparentColor), Array.from(source), "zero color alpha is identity");
for (let i = 3; i < source.length; i += 4) assert.strictEqual(full[i], source[i], "source alpha is preserved");
assert.notStrictEqual(full[0], source[0], "edge pixel receives vignette color");
const center = ((height >> 1) * width + (width >> 1)) * 4;
const edgeDelta = Math.abs(full[0] - source[0]);
const centerDelta = Math.abs(full[center] - source[center]);
assert.ok(edgeDelta > centerDelta, "rectangular Gaussian exterior is stronger at the edge than the center");

const maskA = Vignette.getVignetteMaskAxes(328, 246, 35);
const maskB = Vignette.getVignetteMaskAxes(328, 246, 35);
assert.strictEqual(maskA, maskB, "mask axes are reused while dimensions and size are unchanged");
assert.notStrictEqual(maskA, Vignette.getVignetteMaskAxes(328, 246, 36), "size invalidates the mask cache");

const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /vignette=1,\$\{normalized\.size\},\$\{normalized\.strength\},\$\{normalized\.color\}/, "token serializes only size, strength, and color");
assert.match(html, /applyVignetteToCanvas/, "preview and full output use the shared renderer");
assert.match(html, /<b>Effects &amp; Finishes<\/b>[\s\S]*btnVignetteMode/, "Vignette is registered in Effects & Finishes");

console.log("vignette-filter tests passed");
