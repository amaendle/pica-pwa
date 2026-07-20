const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const sandbox = { window: {}, Uint8ClampedArray, Float32Array, Math };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("creative-filters.js", "utf8"), sandbox, { filename: "creative-filters.js" });
const { CreativeFilters } = sandbox.window;

const image = new Uint8ClampedArray([
  255, 0, 0, 255,
  0, 255, 0, 128,
  0, 0, 255, 64,
  255, 255, 255, 32,
  0, 0, 0, 16,
  30, 90, 150, 200,
]);

function pixels(buffer) {
  const out = [];
  for (let i = 0; i < buffer.length; i += 4) out.push(Array.from(buffer.slice(i, i + 4)));
  return out;
}

function assertGrayAndAlpha(buffer) {
  for (let i = 0; i < buffer.length; i += 4) {
    assert.strictEqual(buffer[i], buffer[i + 1], "R and G output match");
    assert.strictEqual(buffer[i + 1], buffer[i + 2], "G and B output match");
    assert.strictEqual(buffer[i + 3], image[i + 3], "alpha is preserved");
  }
}

let out = CreativeFilters.applyFilteredBwToBuffer(image, 6, 1, { pickColor: "#ffffff" });
assertGrayAndAlpha(out);
assert.deepStrictEqual(pixels(out)[0].slice(0, 3), [85, 85, 85], "white filter averages pure red");
assert.deepStrictEqual(pixels(out)[5].slice(0, 3), [90, 90, 90], "white filter averages mixed color");

out = CreativeFilters.applyFilteredBwToBuffer(image, 6, 1, { pickColor: "#ff0000" });
assertGrayAndAlpha(out);
assert.deepStrictEqual(pixels(out)[0].slice(0, 3), [255, 255, 255], "red filter uses red channel");
assert.deepStrictEqual(pixels(out)[1].slice(0, 3), [0, 0, 0], "red filter suppresses green channel");

out = CreativeFilters.applyFilteredBwToBuffer(image, 6, 1, { pickColor: "#00ff00" });
assertGrayAndAlpha(out);
assert.deepStrictEqual(pixels(out)[1].slice(0, 3), [255, 255, 255], "green filter uses green channel");
assert.deepStrictEqual(pixels(out)[2].slice(0, 3), [0, 0, 0], "green filter suppresses blue channel");

out = CreativeFilters.applyFilteredBwToBuffer(image, 6, 1, { pickColor: "#0000ff" });
assertGrayAndAlpha(out);
assert.deepStrictEqual(pixels(out)[2].slice(0, 3), [255, 255, 255], "blue filter uses blue channel");
assert.deepStrictEqual(pixels(out)[0].slice(0, 3), [0, 0, 0], "blue filter suppresses red channel");

out = CreativeFilters.applyFilteredBwToBuffer(image, 6, 1, { pickColor: "#ffff00" });
assertGrayAndAlpha(out);
assert.deepStrictEqual(pixels(out)[5].slice(0, 3), [60, 60, 60], "yellow filter averages red and green");

out = CreativeFilters.applyFilteredBwToBuffer(image, 6, 1, { pickColor: "#000000" });
assertGrayAndAlpha(out);
assert.deepStrictEqual(pixels(out)[5].slice(0, 3), [90, 90, 90], "black filter falls back to equal weights");

assert.strictEqual(CreativeFilters.parseFilteredBwColor().css, "#ffffff", "default color is white");
assert.strictEqual(CreativeFilters.parseFilteredBwColor("not-a-color").css, "#ffffff", "malformed color falls back safely");
assert.strictEqual(CreativeFilters.parseFilteredBwColor("#123456").argb, "ff123456", "serialization preserves color as opaque ARGB");
assert.strictEqual(CreativeFilters.parseFilteredBwColor("ff123456").css, "#123456", "deserialization preserves selected RGB color");

const preview = CreativeFilters.applyFilteredBwToBuffer(image, 6, 1, { pickColor: "#123456" });
const exportResult = CreativeFilters.applyFilteredBwToBuffer(image, 6, 1, { color: "ff123456" });
assert.deepStrictEqual(Array.from(preview), Array.from(exportResult), "preview and export buffer implementations match");

const indexHtml = fs.readFileSync("index.html", "utf8");
assert.match(indexHtml, /btnFilteredBwMode/, "Filtered B&W is registered in the editor UI");
assert.match(indexHtml, /filtered-bw=1/, "Filtered B&W token serialization is present");
assert.match(indexHtml, /parseFilteredBwFilter/, "Filtered B&W token parsing is present");
assert.strictEqual(typeof CreativeFilters.applyInvertColorsToCanvasWebGL, "function", "invert has a WebGL helper");
assert.strictEqual(typeof CreativeFilters.applyCrossProcessToCanvasWebGL, "function", "cross-process has a WebGL helper");
assert.strictEqual(typeof CreativeFilters.applyFilteredBwToCanvasWebGL, "function", "Filtered B&W has a WebGL helper");
assert.match(indexHtml, /applyInvertColorsToCanvasWebGL/, "invert WebGL helper is used by the preview pipeline");
assert.match(indexHtml, /applyCrossProcessToCanvasWebGL/, "cross-process WebGL helper is used by the preview pipeline");
assert.match(indexHtml, /applyFilteredBwToCanvasWebGL/, "Filtered B&W WebGL helper is used by the preview pipeline");

console.log("filtered-bw tests passed");
