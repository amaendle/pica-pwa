const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const sandbox = { window: {}, Uint8ClampedArray, Math };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("border-filter.js", "utf8"), sandbox, { filename: "border-filter.js" });
const Border = sandbox.window.BorderFilter;

let g = Border.getBorderGeometry(1502, 845, { outerThickness: 20, innerThickness: 5, cornerRadius: 0, captionHeight: 0 });
assert.deepStrictEqual([g.baseWidth, g.baseHeight], [1552, 895]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(g.frameRect)), { x: 20, y: 20, width: 1512, height: 855 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(g.photoRect)), { x: 25, y: 25, width: 1502, height: 845 });

g = Border.getBorderGeometry(1502, 845, { outerThickness: 100, innerThickness: 100, cornerRadius: 0, captionHeight: 0 });
assert.deepStrictEqual([g.baseWidth, g.baseHeight], [1902, 1245]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(g.frameRect)), { x: 100, y: 100, width: 1702, height: 1045 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(g.photoRect)), { x: 200, y: 200, width: 1502, height: 845 });

assert.strictEqual(Border.getBorderCaptionPixels(845, 50.000011), 70);
assert.strictEqual(Border.getBorderCaptionPixels(845, 100), 140);
assert.strictEqual(Border.getBorderCaptionPixels(1413, 100), 235);
const noCaption = Border.getBorderGeometry(1502, 845, { outerThickness: 20, innerThickness: 5, cornerRadius: 50, captionHeight: 0 });
const caption = Border.getBorderGeometry(1502, 845, { outerThickness: 20, innerThickness: 5, cornerRadius: 50, captionHeight: 100 });
for (const key of ["baseWidth", "baseHeight", "frameRadius", "photoRadius"]) assert.strictEqual(caption[key], noCaption[key], `${key} is independent of caption height`);
assert.deepStrictEqual(JSON.parse(JSON.stringify(caption.frameRect)), JSON.parse(JSON.stringify(noCaption.frameRect)));
assert.deepStrictEqual(JSON.parse(JSON.stringify(caption.photoRect)), JSON.parse(JSON.stringify(noCaption.photoRect)));
assert.strictEqual(caption.outputHeight, noCaption.outputHeight + 140);

const corners = Border.getBorderCornerGeometry(1501, 1413, 100, 50.000011);
assert.strictEqual(corners.maxFrameRadius, 806.5);
assert.ok(Math.abs(corners.frameRadius - 403.250088715) < 1e-9);
assert.ok(Math.abs(corners.photoRadius - 303.250088715) < 1e-9);
const square = Border.getBorderCornerGeometry(1501, 1413, 100, 0);
assert.deepStrictEqual(JSON.parse(JSON.stringify(square)), { maxFrameRadius: 806.5, frameRadius: 0, photoRadius: 0 });
assert.strictEqual(Border.getBorderCornerGeometry(1501, 1413, 100, 100).frameRadius, 806.5);
assert.strictEqual(Border.getBorderCornerGeometry(1501, 1413, 0, 100).frameRadius, Border.getBorderCornerGeometry(1501, 1413, 0, 100).photoRadius, "zero inner thickness keeps radii equal");

const fullPreviewGeometry = Border.getBorderGeometry(1502, 846, { outerThickness: 20, innerThickness: 6, cornerRadius: 50, captionHeight: 100 }, 1);
const halfPreviewGeometry = Border.getBorderGeometry(751, 423, { outerThickness: 20, innerThickness: 6, cornerRadius: 50, captionHeight: 100 }, 0.5);
assert.strictEqual(halfPreviewGeometry.frameRect.x, fullPreviewGeometry.frameRect.x / 2, "outer thickness maps from source pixels to preview scale");
assert.strictEqual(halfPreviewGeometry.photoRect.x, fullPreviewGeometry.photoRect.x / 2, "inner thickness maps from source pixels to preview scale");
assert.strictEqual(halfPreviewGeometry.frameRadius, fullPreviewGeometry.frameRadius / 2, "frame radius scales with preview");
assert.strictEqual(halfPreviewGeometry.photoRadius, fullPreviewGeometry.photoRadius / 2, "photo radius scales with preview");

assert.strictEqual(Border.normalizeBorderColor("00000000"), "#000000");
assert.strictEqual(Border.normalizeBorderColor("00ffffff"), "#ffffff");
assert.strictEqual(Border.borderColorToPicasa("#79b3db"), "0079b3db");

const width = 4, height = 3;
const source = new Uint8ClampedArray(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const i = (y * width + x) * 4;
  source[i] = 20 + x; source[i + 1] = 40 + y; source[i + 2] = 60; source[i + 3] = 200;
}
const identity = Border.applyBorderToBuffer(source, width, height, { outerThickness: 0, innerThickness: 0, cornerRadius: 0, captionHeight: 0 });
assert.deepStrictEqual([identity.width, identity.height], [width, height]);
assert.deepStrictEqual(Array.from(identity.data), Array.from(source), "all-zero geometry is exact identity");

const framed = Border.applyBorderToBuffer(source, width, height, { outerThickness: 2, innerThickness: 1, outerColor: "00000000", innerColor: "00ffffff", cornerRadius: 0, captionHeight: 0 });
assert.deepStrictEqual([framed.width, framed.height], [10, 9]);
assert.deepStrictEqual(Array.from(framed.data.slice(0, 4)), [0, 0, 0, 255], "outer border is opaque black");
const innerPixel = (2 * framed.width + 2) * 4;
assert.deepStrictEqual(Array.from(framed.data.slice(innerPixel, innerPixel + 4)), [255, 255, 255, 255], "inner border is opaque white");
const photoPixel = (3 * framed.width + 3) * 4;
assert.deepStrictEqual(Array.from(framed.data.slice(photoPixel, photoPixel + 4)), Array.from(source.slice(0, 4)), "square source pixels are copied unchanged at 1:1");

const captioned = Border.applyBorderToBuffer(source, width, height, { outerThickness: 2, innerThickness: 1, outerColor: "#102030", innerColor: "#ffffff", captionHeight: 100 });
assert.strictEqual(captioned.height, framed.height, "tiny source caption floors to zero pixels");
const tallSource = new Uint8ClampedArray(10 * 60 * 4).fill(255);
const tallNoCaption = Border.applyBorderToBuffer(tallSource, 10, 60, { outerThickness: 2, innerThickness: 1, outerColor: "#102030", captionHeight: 0 });
const tallCaption = Border.applyBorderToBuffer(tallSource, 10, 60, { outerThickness: 2, innerThickness: 1, outerColor: "#102030", captionHeight: 100 });
assert.strictEqual(tallCaption.height, tallNoCaption.height + 10);
assert.deepStrictEqual(Array.from(tallCaption.data.slice(0, tallNoCaption.data.length)), Array.from(tallNoCaption.data), "caption does not alter the normal frame rows");
const last = tallCaption.data.length - 4;
assert.deepStrictEqual(Array.from(tallCaption.data.slice(last, last + 4)), [16, 32, 48, 255], "caption is appended below using outer color");

const partialCoverage = Border.roundedRectangleCoverage(1, 1, 10, 10, 5);
assert.ok(partialCoverage > 0 && partialCoverage < 1, "rounded clipping has anti-aliased partial coverage");
const roundedSource = new Uint8ClampedArray(10 * 10 * 4);
for (let i = 0; i < roundedSource.length; i += 4) { roundedSource[i] = 220; roundedSource[i + 3] = 255; }
const rounded = Border.applyBorderToBuffer(roundedSource, 10, 10, { outerThickness: 2, innerThickness: 2, outerColor: "#000000", innerColor: "#ffffff", cornerRadius: 100, captionHeight: 0 });
const roundedPhotoCenter = ((4 + 5) * rounded.width + 4 + 5) * 4;
assert.deepStrictEqual(Array.from(rounded.data.slice(roundedPhotoCenter, roundedPhotoCenter + 4)), [220, 0, 0, 255], "fully covered rounded-photo pixels remain byte-identical");
const roundedPhotoCorner = (4 * rounded.width + 4) * 4;
assert.notDeepStrictEqual(Array.from(rounded.data.slice(roundedPhotoCorner, roundedPhotoCorner + 4)), [220, 0, 0, 255], "photo corner is clipped rather than rescaled");

const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /border=1,\$\{p\.outerThickness\},\$\{p\.innerThickness\},/, "token stores user-facing Border parameters");
assert.match(html, /applyBorderToCanvas/, "preview and export share the Border renderer");
assert.match(html, /<b>Effects &amp; Finishes<\/b>[\s\S]*btnBorderMode/, "Border is registered in Effects & Finishes");
assert.match(html, /function mapPointThroughFilterChain[\s\S]*m = parseBorderFilter\(f\);[\s\S]*captionHeight/, "image-coordinate overlays account for Border and its bottom caption");

console.log("border-filter tests passed");
