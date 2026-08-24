const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");

assert.ok(html.includes("async function refreshGlobalStarredImageRefs()"));
assert.ok(html.includes("Array.from(state.dirIndex?.entries?.() || [])"));
assert.ok(html.includes("for (const [pathRel, dirHandle] of folders)"));
assert.ok(html.includes("await getPicasaMetaForFolder(pathRel, dirHandle)"));
assert.ok(html.includes("state.starredRefsLoaded = true"));
assert.ok(html.includes('if (album.token === "]star")'));
assert.ok(html.includes("await refreshGlobalStarredImageRefs()"));
assert.ok(!html.includes("const starRefs = (state.currentImages || [])\n    .filter((it) => !!it.star)"));

console.log("starred_album_tests passed");
