const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const window = {};
vm.runInNewContext(fs.readFileSync("hdr-ish-filter.js", "utf8"), { window, Uint8ClampedArray, Float32Array });
const filter = window.HdrIshFilter;

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(filter.normalizeHdrIshParams({ radius: -2, strength: 99, fade: -1 }))),
  { enabled: true, radius: 1.3, strength: 7, fade: 0 }
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(filter.normalizeHdrIshParams({ radius: 100, strength: 0, fade: 200 }))),
  { enabled: true, radius: 80, strength: 1, fade: 100 }
);

const uniform = new Uint8ClampedArray([80, 120, 160, 17, 80, 120, 160, 91, 80, 120, 160, 255]);
assert.deepStrictEqual(Array.from(filter.applyHdrIshToBuffer(uniform, 3, 1)), Array.from(uniform));
const edge = new Uint8ClampedArray([
  20, 20, 20, 10, 20, 20, 20, 20, 180, 180, 180, 30, 180, 180, 180, 40
]);
assert.deepStrictEqual(Array.from(filter.applyHdrIshToBuffer(edge, 4, 1, { enabled: false })), Array.from(edge));
assert.deepStrictEqual(Array.from(filter.applyHdrIshToBuffer(edge, 4, 1, { fade: 100 })), Array.from(edge));
const result = filter.applyHdrIshToBuffer(edge, 4, 1, { radius: 1.3, strength: 3, fade: 0 });
assert.notDeepStrictEqual(Array.from(result), Array.from(edge));
assert.deepStrictEqual([result[3], result[7], result[11], result[15]], [10, 20, 30, 40]);
assert.deepStrictEqual(Array.from(filter.applyHdrIshToBuffer(edge, 4, 1, { radius: 1.3, strength: 3 })), Array.from(result));

const html = fs.readFileSync("index.html", "utf8");
assert.ok(html.includes("HDRish="));
assert.ok(html.includes('id="btnHdrIshMode"'));
assert.ok(html.includes('id="hdrIshControls"'));
console.log("hdr_ish_filter_tests passed");
