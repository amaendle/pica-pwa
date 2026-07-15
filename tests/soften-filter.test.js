const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const sandbox = { window: {}, Uint8ClampedArray, Float32Array, Math };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("soften-filter.js", "utf8"), sandbox, { filename: "soften-filter.js" });
const Soften = sandbox.window.SoftenFilter;

const source = new Uint8ClampedArray([
  12, 34, 56, 255,
  78, 90, 123, 128,
  200, 150, 100, 64,
  240, 230, 220, 255,
]);

function approx(a, b, eps = 1e-12) {
  assert.ok(Math.abs(a - b) <= eps, `${a} !== ${b}`);
}

function assertProfileEqual(actual, expected) {
  for (const key of Object.keys(expected)) approx(actual[key], expected[key]);
}

assert.deepStrictEqual(Array.from(Soften.applySoftenToBuffer(source, 2, 2, { softness: 0, fade: 0 })), Array.from(source), "softness=0 is identity");
assert.deepStrictEqual(Array.from(Soften.applySoftenToBuffer(source, 2, 2, { softness: 100, fade: 100 })), Array.from(source), "fade=100 is identity");
assertProfileEqual(Soften.getSoftenProfile(50), Soften.SOFTEN_50);
assertProfileEqual(Soften.getSoftenProfile(100), Soften.SOFTEN_100);
approx(Soften.getSoftenProfile(25).radiusPct, (Soften.SOFTEN_IDENTITY.radiusPct + Soften.SOFTEN_50.radiusPct) / 2);
approx(Soften.getSoftenProfile(75).amount, (Soften.SOFTEN_50.amount + Soften.SOFTEN_100.amount) / 2);

const full = Soften.applySoftenToBuffer(source, 2, 2, { softness: 100, fade: 0 });
const half = Soften.applySoftenToBuffer(source, 2, 2, { softness: 100, fade: 50 });
for (let i = 0; i < source.length; i += 4) {
  assert.strictEqual(full[i + 3], source[i + 3], "alpha remains unchanged");
  assert.strictEqual(half[i + 3], source[i + 3], "alpha remains unchanged after fade");
  assert.ok(Math.abs(half[i] - Math.round((full[i] + source[i]) / 2)) <= 1, "fade=50 red midpoint");
  assert.ok(Math.abs(half[i + 1] - Math.round((full[i + 1] + source[i + 1]) / 2)) <= 1, "fade=50 green midpoint");
  assert.ok(Math.abs(half[i + 2] - Math.round((full[i + 2] + source[i + 2]) / 2)) <= 1, "fade=50 blue midpoint");
}

const profile = Soften.getSoftenProfile(100);
const small = Soften.makeBlurredRgb(source, 2, 4, profile);
const large = Soften.makeBlurredRgb(new Uint8ClampedArray(8 * 16 * 4), 8, 16, profile);
approx(small.radiusPx, profile.radiusPct * 2 / 100);
approx(large.radiusPx, profile.radiusPct * 8 / 100);
assert.doesNotThrow(() => Soften.applySoftenToBuffer(source, 1, 4, { softness: 100, fade: 0 }), "edge clamping stays in bounds");

const indexHtml = fs.readFileSync("index.html", "utf8");
assert.match(indexHtml, /soften=1,\$\{normalized\.softness\},\$\{normalized\.fade\}/, "soften token preserves parameter order");
assert.match(indexHtml, /applySoftenToCanvas/, "preview/export path uses shared Soften implementation");
assert.match(indexHtml, /parseBoostFilter/, "existing filter parsing remains present");

console.log("soften-filter tests passed");
