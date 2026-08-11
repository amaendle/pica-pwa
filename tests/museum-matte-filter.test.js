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

function approx(actual, expected, tolerance = 0.02) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

approx(Museum.getMuseumMatteShadowSigma(340, 618), 2.89);
approx(Museum.getMuseumMatteShadowSigma(1502, 845), 7.18);
approx(Museum.getMuseumMatteShadowSigma(1647, 989), 8.40);
approx(Museum.getRenderedMuseumMatteShadowSigma(824, 495, { sourceWidth: 1647, sourceHeight: 989, previewScale: 0.5 }), 4.20);
const unchangedSigma = Museum.getMuseumMatteShadowSigma(1647, 989);
const outerGeometry = geometry(1647, 989, 300, 0);
const innerGeometry = geometry(1647, 989, 0, 300);
assert.strictEqual(unchangedSigma, Museum.getMuseumMatteShadowSigma(outerGeometry.sourceWidth, outerGeometry.sourceHeight), "outer thickness does not change sigma");
assert.strictEqual(unchangedSigma, Museum.getMuseumMatteShadowSigma(innerGeometry.sourceWidth, innerGeometry.sourceHeight), "inner thickness does not change sigma");

const width = 100, height = 100;
const source = new Uint8ClampedArray(width * height * 4);
for (let i = 0; i < source.length; i += 4) {
  source[i] = 200; source[i + 1] = 180; source[i + 2] = 160; source[i + 3] = 173;
}
const noBorders = Museum.applyMuseumMatteToBuffer(source, width, height, { outerThickness: 0, innerThickness: 0 });
assert.deepStrictEqual([noBorders.width, noBorders.height], [width, height]);
const edge = 0;
const center = (50 * width + 50) * 4;
assert.ok(noBorders.data[edge] < source[edge], "both coincident shadows darken the photo edge with no borders");
assert.deepStrictEqual(Array.from(noBorders.data.slice(center, center + 4)), Array.from(source.slice(center, center + 4)), "pixels far from all edges are unchanged");
assert.strictEqual(noBorders.data[edge + 3], source[edge + 3], "photo alpha is preserved");

const sigma = Museum.getMuseumMatteShadowSigma(width, height);
const axes = Museum.getGaussianRectangleAxes(width, height, sigma);
const insetAtCorner = 1 - axes.insideX[0] * axes.insideY[0];
const scaleA = 1 - insetAtCorner * Museum.MUSEUM_MATTE_OUTER_SHADOW_OPACITY;
const scaleB = 1 - insetAtCorner * Museum.MUSEUM_MATTE_PHOTO_SHADOW_OPACITY;
const expectedStackedRed = Math.round(Math.round(source[0] * scaleA) * scaleB);
assert.strictEqual(noBorders.data[0], expectedStackedRed, "coincident shadows remain independent multiplicative layers");

const framed = Museum.applyMuseumMatteToBuffer(source, width, height, {
  outerThickness: 10, outerColor: "#79b3db", innerThickness: 10, innerColor: "#fff47c"
});
assert.deepStrictEqual(Array.from(framed.data.slice(0, 4)), [121, 179, 219, 255], "shadow A is clipped and does not touch the outer canvas edge");
const innerEdge = (10 * framed.width + 10) * 4;
assert.ok(framed.data[innerEdge] < 255, "shadow A darkens the outer edge of a visible inner matte");
const photoEdge = (20 * framed.width + 20) * 4;
assert.ok(framed.data[photoEdge] < source[0], "shadow B always darkens the photo edge");
assert.notDeepStrictEqual([framed.width, framed.height], [width, height], "inner and photo shadow rectangles are separated when inner thickness is positive");

const outerOnly = Museum.applyMuseumMatteToBuffer(source, width, height, { outerThickness: 10, innerThickness: 0, outerColor: "#79b3db" });
assert.deepStrictEqual(Array.from(outerOnly.data.slice(0, 4)), [121, 179, 219, 255], "outer matte keeps its exact selected color outside both clipped shadows");
const outerOnlyPhoto = (10 * outerOnly.width + 10) * 4;
assert.ok(outerOnly.data[outerOnlyPhoto] < source[0], "shadow A still exists when inner thickness is zero and stacks with shadow B");

const exactMatte = Museum.applyMuseumMatteToBuffer(source, width, height, { outerThickness: 20, innerThickness: 40, innerColor: "#fff47c" });
const flatMattePixel = ((20 + 20) * exactMatte.width + (20 + 20)) * 4;
assert.deepStrictEqual(Array.from(exactMatte.data.slice(flatMattePixel, flatMattePixel + 4)), [255, 244, 124, 255], "unshadowed inner matte keeps the exact selected RGB without Picasa's quantization offset");

const largeWidth = 340, largeHeight = 340;
const largeSource = new Uint8ClampedArray(largeWidth * largeHeight * 4);
for (let i = 0; i < largeSource.length; i += 4) {
  largeSource[i] = 200; largeSource[i + 1] = 200; largeSource[i + 2] = 200; largeSource[i + 3] = 255;
}
const gaussian = Museum.applyMuseumMatteToBuffer(largeSource, largeWidth, largeHeight, { outerThickness: 0, innerThickness: 0 });
const at = (x, y) => gaussian.data[(y * largeWidth + x) * 4];
assert.ok(at(0, 0) < at(largeWidth >> 1, 0), "2D Gaussian rectangle makes corners darker than straight-edge points");
assert.ok(at(largeWidth >> 1, 0) < at(largeWidth >> 1, 2), "straight-edge shadow fades smoothly inward");
assert.ok(at(largeWidth >> 1, 2) <= at(largeWidth >> 1, 5), "Gaussian fade remains monotonic inward");
assert.strictEqual(at(largeWidth >> 1, largeHeight >> 1), 200, "unshadowed source RGB is not quantized or offset");

const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /museumMatte=1,\$\{normalized\.outerThickness\},\$\{outerColor\},\$\{normalized\.innerThickness\},\$\{innerColor\}/, "token persists four user parameters only");
assert.match(html, /applyMuseumMatteToCanvas/, "shared preview and output pipeline uses Museum Matte renderer");
assert.match(html, /<b>Effects &amp; Finishes<\/b>[\s\S]*btnMuseumMatteMode/, "Museum Matte is registered in Effects & Finishes");

console.log("museum-matte-filter tests passed");
