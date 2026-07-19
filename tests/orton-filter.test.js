const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const sandbox = { window: {}, Uint8ClampedArray, Float32Array, Math, ImageData: function ImageData(data, width, height) { return { data, width, height }; } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("orton-filter.js", "utf8"), sandbox, { filename: "orton-filter.js" });
const { OrtonFilter } = sandbox.window;

const image = new Uint8ClampedArray([
  12, 60, 180, 255,
  220, 180, 40, 128,
  80, 140, 90, 64,
  250, 250, 250, 32,
]);

assert.strictEqual(JSON.stringify(OrtonFilter.normalizeOrtonParams({ bloom: "bad", fade: Infinity })), JSON.stringify({ bloom: 25, fade: 0 }), "bad params fall back safely");
assert.strictEqual(JSON.stringify(OrtonFilter.normalizeOrtonParams({ bloom: -4, fade: 130 })), JSON.stringify({ bloom: 0, fade: 100 }), "params clamp to 0..100");

const faded = OrtonFilter.applyOrtonIshToBuffer(image, 2, 2, { bloom: 50, fade: 100 });
assert.deepStrictEqual(Array.from(faded), Array.from(image), "fade=100 returns the original exactly");

const tonedOnly = OrtonFilter.applyOrtonBloomRGBA(image, 2, 2, 0);
const viaWrapper = OrtonFilter.applyOrtonIshToBuffer(image, 2, 2, { bloom: 0, fade: 0 });
assert.deepStrictEqual(Array.from(viaWrapper), Array.from(tonedOnly), "bloom=0 uses the shared tone-pass output");

const bloomed = OrtonFilter.applyOrtonIshToBuffer(image, 2, 2, { bloom: 50, fade: 0 });
for (let i = 3; i < bloomed.length; i += 4) {
  assert.strictEqual(bloomed[i], image[i], "alpha is preserved");
}
assert.notDeepStrictEqual(Array.from(bloomed.slice(0, 3)), Array.from(image.slice(0, 3)), "effect changes RGB when not faded");

const halfFade = OrtonFilter.applyOrtonIshToBuffer(image, 2, 2, { bloom: 50, fade: 50 });
for (let i = 0; i < halfFade.length; i += 4) {
  assert.strictEqual(halfFade[i + 3], image[i + 3], "fade preserves alpha");
}

const indexHtml = fs.readFileSync("index.html", "utf8");
assert.match(indexHtml, /orton-filter\.js/, "Orton filter script is loaded");
assert.match(indexHtml, /btnOrtonMode/, "Orton-ish is registered in the editor UI");
assert.match(indexHtml, /ortonish=1/, "Orton-ish token serialization is present");
assert.match(indexHtml, /parseOrtonFilter/, "Orton-ish token parsing is present");

console.log("orton-filter tests passed");
