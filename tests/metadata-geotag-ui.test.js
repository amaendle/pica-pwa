const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const window = {};
vm.runInNewContext(fs.readFileSync("metadata-utils.js", "utf8"), { window });
const utils = window.MetadataUtils;

assert.strictEqual(utils.parseOptionalFiniteNumber(""), null);
assert.strictEqual(utils.parseOptionalFiniteNumber("  "), null);
assert.strictEqual(utils.parseOptionalFiniteNumber("0"), 0);
assert.strictEqual(utils.parseOptionalGeotag("", ""), null);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(utils.parseOptionalGeotag("0", "0"))),
  { lat: 0, lng: 0 }
);

const uncropped = utils.getImagePixelDimensions(4000, 3000, []);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(uncropped)),
  { originalWidth: 4000, originalHeight: 3000, croppedWidth: null, croppedHeight: null, hasCrop: false }
);
const cropped = utils.getImagePixelDimensions(4000, 3000, ["crop64=1,gui:0.1|0.2|0.5|0.25"]);
assert.strictEqual(cropped.croppedWidth, 2000);
assert.strictEqual(cropped.croppedHeight, 750);
assert.strictEqual(cropped.hasCrop, true);

const html = fs.readFileSync("index.html", "utf8");
const top = html.match(/<div class="overlayTop">([\s\S]*?)<div class="overlayBar">/)[1];
const bar = html.match(/<div class="overlayBar">([\s\S]*?)<\/div>/)[1];
for (const id of ["btnToggleSlideMap", "btnSlideEdit", "btnClose"]) {
  assert.ok(!top.includes(`id="${id}"`), `${id} must not remain in the top overlay`);
  assert.ok(bar.includes(`id="${id}"`), `${id} must be in the bottom overlay bar`);
}
assert.ok(html.includes("pixelDimensionsOriginal:"));
assert.ok(html.includes("pixelDimensionsCropped:"));
assert.ok(html.includes("geotagCleared=yes"));
assert.ok(html.includes("if (!faceEditor.geotag) faceEditor.imageItem.exifGps = null;"));

console.log("metadata_geotag_ui_tests passed");
