const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const sandbox = { window: {}, Uint8ClampedArray, Math };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("museum-matte-filter.js", "utf8"), sandbox, { filename: "museum-matte-filter.js" });
const Museum = sandbox.window.MuseumMatteFilter;

function geometry(width, height, outerThickness, innerThickness) {
  return Museum.getMuseumMatteGeometry(width, height, { outerThickness, innerThickness });
}

let g = geometry(1647, 989, 100, 0);
assert.deepStrictEqual([g.outputWidth, g.outputHeight, g.photoRect.x, g.photoRect.y], [1847, 1189, 100, 100]);
g = geometry(1647, 989, 0, 100);
assert.deepStrictEqual([g.outputWidth, g.outputHeight, g.photoRect.x, g.photoRect.y], [1847, 1189, 100, 100]);
g = geometry(1647, 989, 100, 100);
assert.deepStrictEqual([g.outputWidth, g.outputHeight], [2047, 1389]);
assert.deepStrictEqual([g.innerRect.x, g.innerRect.y, g.photoRect.x, g.photoRect.y], [100, 100, 200, 200]);
g = geometry(340, 618, 0, 40);
assert.deepStrictEqual([g.outputWidth, g.outputHeight, g.photoRect.x, g.photoRect.y], [420, 698, 40, 40]);
g = geometry(340, 618, 0, 0);
assert.deepStrictEqual([g.outputWidth, g.outputHeight, g.photoRect.x, g.photoRect.y], [340, 618, 0, 0]);

assert.strictEqual(Museum.getMuseumMatteShadowRadius(1647, 989), 20);
assert.strictEqual(Museum.getMuseumMatteShadowRadius(340, 618), 7);
assert.strictEqual(Museum.getRenderedMuseumMatteShadowRadius(824, 495, { sourceWidth: 1647, sourceHeight: 989, previewScale: 0.5 }), 10, "preview radius scales from full source dimensions");
const radius = 20;
assert.ok(Museum.getMuseumMatteShadowOpacity(0, radius) > Museum.getMuseumMatteShadowOpacity(1, radius));
for (let d = 0; d < radius; d++) {
  assert.ok(Museum.getMuseumMatteShadowOpacity(d, radius) >= Museum.getMuseumMatteShadowOpacity(d + 1, radius), "shadow decreases inward");
}
assert.strictEqual(Museum.getMuseumMatteShadowOpacity(radius, radius), 0);
assert.strictEqual(Museum.getMuseumMatteShadowOpacity(radius + 5, radius), 0);

const width = 100, height = 100;
const source = new Uint8ClampedArray(width * height * 4);
for (let i = 0; i < source.length; i += 4) {
  source[i] = 200; source[i + 1] = 180; source[i + 2] = 160; source[i + 3] = 173;
}
const noBorders = Museum.applyMuseumMatteToBuffer(source, width, height, { outerThickness: 0, innerThickness: 0 });
assert.deepStrictEqual([noBorders.width, noBorders.height], [width, height]);
const edge = 0;
const center = (50 * width + 50) * 4;
assert.ok(noBorders.data[edge] < source[edge], "photo edge receives inset shadow with no borders");
assert.deepStrictEqual(Array.from(noBorders.data.slice(center, center + 4)), Array.from(source.slice(center, center + 4)), "center pixel is unchanged");
assert.strictEqual(noBorders.data[edge + 3], source[edge + 3], "photo alpha is preserved");

const framed = Museum.applyMuseumMatteToBuffer(source, width, height, {
  outerThickness: 10, outerColor: "#79b3db", innerThickness: 10, innerColor: "#fff47c"
});
const outerCorner = 0;
assert.deepStrictEqual(Array.from(framed.data.slice(outerCorner, outerCorner + 4)), [121, 179, 219, 255], "outer canvas edge has no outer bevel");
const innerEdge = (10 * framed.width + 10) * 4;
assert.ok(framed.data[innerEdge] < 255, "inner matte outer edge receives an inset shadow");
const photoEdge = (20 * framed.width + 20) * 4;
assert.ok(framed.data[photoEdge] < source[0], "photo receives its own inset shadow");

const outerOnly = Museum.applyMuseumMatteToBuffer(source, width, height, { outerThickness: 10, innerThickness: 0, outerColor: "#79b3db" });
assert.deepStrictEqual(Array.from(outerOnly.data.slice(0, 4)), [121, 179, 219, 255], "no inner-matte shadow is added when inner thickness is zero");

const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /museumMatte=1,\$\{normalized\.outerThickness\},\$\{outerColor\},\$\{normalized\.innerThickness\},\$\{innerColor\}/, "token persists four user parameters only");
assert.match(html, /applyMuseumMatteToCanvas/, "shared preview and output pipeline uses Museum Matte renderer");
assert.match(html, /<b>Effects &amp; Finishes<\/b>[\s\S]*btnMuseumMatteMode/, "Museum Matte is registered in Effects & Finishes");

console.log("museum-matte-filter tests passed");
