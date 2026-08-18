# Posterize (classic fixed-bit octree)

`Posterize=1,colors,detail` is a **Looks & Color Styles** effect. Colors (`2..64`, default `8`) is an octree expansion index and is intentionally not guaranteed to equal the number of colors in the rendered palette. Detail (`0..100`) continuously interpolates the model's bilateral preprocessing curve; lower values smooth more strongly.

`posterize-hierarchical-model.json` is authoritative calibration data. Its browser companion only publishes that same data to `window`; structural tree code, smoothing, representative calculation, OKLab conversion, and exact tree-membership assignment remain in `posterize-filter.js`.

Colors 2 and 3 use their calibrated special root reductions. Colors 4–8 expose supported roots structurally, 9–13 apply the known two-bit refinements, and the model-selected FIFO/first-appearance fallback beyond 13 is isolated as provisional. Final pixels are exact transformed image-derived palette representatives, never nearest-palette reassignment or post-quantization blending.

The CPU path caches Detail-dependent preprocessing by source buffer, dimensions, model version, and Detail, and caches tree statistics on the resulting smoothed buffer. Changing only Colors therefore reuses smoothing and population statistics. Transparent pixels do not affect representatives, while source alpha is copied exactly.

The calibration artifacts were not present in the repository at implementation time. The checked-in v12.1 JSON therefore captures all numerical values stated in the task; unspecified Detail anchors and transform coefficients use documented safe defaults (monotonic bilateral anchors and an identity OKLab transform) pending replacement with the original calibration artifact.
