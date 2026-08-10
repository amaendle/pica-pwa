const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const sandbox = { window: {}, Uint8ClampedArray, Int32Array, Math };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("pixelate-filter.js", "utf8"), sandbox, { filename: "pixelate-filter.js" });
const Pixelate = sandbox.window.PixelateFilter;

const grid = Pixelate.getPixelGrid(3280, 2464, 150);
assert.strictEqual(grid.blocksX, 22);
assert.strictEqual(grid.blocksY, 16);
assert.strictEqual(grid.xBoundaries[0], 0);
assert.strictEqual(grid.xBoundaries[grid.blocksX], 3280);
assert.strictEqual(grid.yBoundaries[0], 0);
assert.strictEqual(grid.yBoundaries[grid.blocksY], 2464);
const widths = Array.from({ length: grid.blocksX }, (_, i) => grid.xBoundaries[i + 1] - grid.xBoundaries[i]);
const heights = Array.from({ length: grid.blocksY }, (_, i) => grid.yBoundaries[i + 1] - grid.yBoundaries[i]);
assert.ok(Math.max(...widths) - Math.min(...widths) <= 1, "block widths are evenly distributed");
assert.ok(Math.max(...heights) - Math.min(...heights) <= 1, "block heights are evenly distributed");
assert.strictEqual(widths.reduce((a, b) => a + b, 0), 3280, "all columns are covered");
assert.strictEqual(heights.reduce((a, b) => a + b, 0), 2464, "all rows are covered");

const blend = Pixelate.blendPixelateChannel;
assert.strictEqual(blend(200, 100, 0), 255, "Add clamps to 255");
assert.strictEqual(blend(200, 100, 1), 100, "Darken chooses the lower channel");
assert.strictEqual(blend(200, 100, 2), 100, "Difference is absolute");
assert.strictEqual(blend(200, 100, 4), 200, "Lighten chooses the higher channel");
assert.ok(Math.abs(blend(200, 100, 5) - 200 * 100 / 255) < 1e-12, "Multiply formula");
assert.ok(Math.abs(blend(200, 100, 7) - (255 - 55 * 155 / 255)) < 1e-12, "Screen formula");
assert.strictEqual(blend(100, 200, 8), 0, "Subtract clamps to zero");
assert.strictEqual(blend(200, 100, 8), 100, "Subtract keeps positive differences");
assert.strictEqual(blend(200, 100, 9), 100, "Normal returns the pixelated channel");
assert.notStrictEqual(blend(200, 100, 3), blend(200, 100, 6), "Hard Light branches on P while Overlay branches on O");

const source = new Uint8ClampedArray([
  10, 20, 30, 255, 30, 40, 50, 128,
  50, 60, 70, 64, 70, 80, 90, 0,
]);
const normal = Pixelate.applyPixelateToBuffer(source, 4, 1, { pixelSize: 4, blendMode: 9, fade: 0 });
assert.strictEqual(normal[0], normal[4], "mode 9 fills a block with P");
for (let i = 3; i < source.length; i += 4) assert.strictEqual(normal[i], source[i], "alpha is preserved");
assert.deepStrictEqual(Array.from(Pixelate.applyPixelateToBuffer(source, 4, 1, { pixelSize: 4, blendMode: 0, fade: 100 })), Array.from(source), "fade 100 is identity");

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(Pixelate.normalizePixelateParams({ pixelSize: 999, blendMode: -2, fade: 101 }))),
  { pixelSize: 150, blendMode: 0, fade: 100 },
  "parameters are clamped"
);

const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /pixelate=1,\$\{normalized\.pixelSize\},\$\{normalized\.blendMode\},\$\{normalized\.fade\}/, "token preserves parameter order");
assert.match(html, /applyPixelateToCanvas/, "preview and export use the shared implementation");
assert.match(html, /<b>Effects &amp; Finishes<\/b>[\s\S]*btnPixelateMode/, "Pixelate is in Effects & Finishes");

console.log("pixelate-filter tests passed");
