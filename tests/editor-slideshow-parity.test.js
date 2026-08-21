const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");

assert.ok(!html.includes('id="btnSlideZoomReset"'));
assert.ok(!html.includes('id="btnShowSlideImagedata"'));
assert.ok(html.includes('id="linkShowSlideImagedata"'));
assert.ok(html.includes('linkShowSlideImagedata.onclick = (ev)'));
assert.ok(html.includes('faceCanvasWrap.addEventListener("wheel"'));
assert.ok(html.includes('if (zoom <= minZoom * 1.001) { faceEditor.panX = 0; faceEditor.panY = 0; }'));
assert.ok(html.includes('generateAndPersistThumbForImageItem(faceEditor.imageItem, thumbSource, { force: true })'));
assert.ok(html.includes('const idx = existingIdx >= 0 ? existingIdx : nextThumbIdxForSource(source)'));
assert.ok(html.includes('invalidateThumbUrl(source, existingIdx)'));

console.log("editor_slideshow_parity_tests passed");
