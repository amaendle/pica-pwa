const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const window = {};
vm.runInNewContext(fs.readFileSync("filter-state-utils.js", "utf8"), { window });
const utils = window.FilterStateUtils;

assert.strictEqual(utils.getFilterEnabled("HDRish=1,20,3,0"), true);
assert.strictEqual(utils.getFilterEnabled("HDRish=0,20,3,0"), false);
assert.strictEqual(utils.toggleFilterEnabled("HDRish=1,20,3,0"), "HDRish=0,20,3,0");
assert.strictEqual(utils.toggleFilterEnabled("crop64=0,gui:0|0|1|1"), "crop64=1,gui:0|0|1|1");
assert.strictEqual(utils.toggleFilterEnabled("malformed-filter"), "malformed-filter");
assert.strictEqual(utils.setFilterEnabled("Neon=0,0,00ff0000;", true), "Neon=1,0,00ff0000;");

const html = fs.readFileSync("index.html", "utf8");
assert.ok(html.includes('id="btnUndoFilter" title="Undo filter" aria-label="Undo filter">↶</button>'));
assert.ok(html.includes('id="btnRedoFilter" title="Redo filter" aria-label="Redo filter" disabled>↷</button>'));
assert.ok(html.includes('id="btnToggleSelectedFilters"'));
assert.ok(html.includes('id="btnRemoveSelectedFilters" title="Remove selected filters" aria-label="Remove selected filters">✕</button>'));
assert.ok(html.includes('faceFaceSelect.addEventListener("input", syncActiveFaceFromNativeSelection)'));
assert.ok(html.includes('faceFaceSelect.addEventListener("change", syncActiveFaceFromNativeSelection)'));
assert.ok(html.includes('btnRenameFace.classList.toggle("hidden", !hasFace)'));
assert.ok(html.includes('btnRemoveFace.classList.toggle("hidden", !hasFace)'));

console.log("filter_state_and_face_selection_tests passed");
