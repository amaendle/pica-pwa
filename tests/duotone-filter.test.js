const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const sandbox = { window: {}, Uint8ClampedArray, Float32Array, Float64Array, Math, ImageData: function ImageData(data, width, height) { return { data, width, height }; } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("duotone-filter.js", "utf8"), sandbox, { filename: "duotone-filter.js" });
const { DuoToneFilter } = sandbox.window;

assert.strictEqual(JSON.stringify(DuoToneFilter.normalizeDuoToneParams({})), JSON.stringify({ color1: "#004488", color2: "#ffff00", brightness: 0, contrast: 100, fade: 0 }));
assert.strictEqual(JSON.stringify(DuoToneFilter.normalizeDuoToneParams({ color1: "bad", color2: "ff00aa", brightness: -10, contrast: 150, fade: 101 })), JSON.stringify({ color1: "#004488", color2: "#ff00aa", brightness: -10, contrast: 100, fade: 100 }));

const image = new Uint8ClampedArray([
  255, 0, 0, 255,
  0, 255, 0, 128,
  0, 0, 255, 64,
  200, 120, 40, 32,
]);

const original = DuoToneFilter.applyDuoToneIshToBuffer(image, 2, 2, { fade: 100 });
assert.deepStrictEqual(Array.from(original), Array.from(image), "fade=100 returns original pixels");

const effect = DuoToneFilter.applyDuoToneIshToBuffer(image, 2, 2, { fade: 0, color1: "#000000", color2: "#ffffff", contrast: 100, brightness: 0 });
for (let i = 0; i < effect.length; i += 4) {
  assert.strictEqual(effect[i + 3], image[i + 3], "alpha is preserved");
}
assert.notDeepStrictEqual(Array.from(effect.slice(0, 3)), Array.from(image.slice(0, 3)), "duo-tone effect changes RGB when not faded");

const half = DuoToneFilter.applyDuoToneIshToBuffer(image, 2, 2, { fade: 50, color1: "#000000", color2: "#ffffff", contrast: 100, brightness: 0 });
for (let i = 0; i < half.length; i += 4) {
  assert.strictEqual(half[i + 3], image[i + 3], "faded output preserves alpha");
}

const indexHtml = fs.readFileSync("index.html", "utf8");
assert.match(indexHtml, /duotone-filter\.js/, "Duo-tone filter script is loaded");
assert.match(indexHtml, /btnDuoToneMode/, "Duo-tone is registered in the editor UI");
assert.match(indexHtml, /duotone=1/, "Duo-tone token serialization is present");
assert.match(indexHtml, /parseDuoToneFilter/, "Duo-tone token parsing is present");
assert.match(indexHtml, /applyDuoToneIshToCanvas/, "Duo-tone uses shared canvas implementation in render pipeline");

console.log("duotone-filter tests passed");
