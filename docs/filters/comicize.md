# Comic Book / Comicize (experimental)

`Comicize=enabled,colorBrush,dotDensity,dotFade` is an experimental **Effects & Finishes** filter. Color Brush is serialized for compatibility but deliberately ignored in this version.

The current input raster is divided into a centered, resolution-scaled lattice. Each tile is sampled once using its full average luminance, then receives a calibrated luminance, density, and normalized superellipse-vignette score. One radius controls that tile's center disc and four independently clipped corner quarters, preserving different neighboring radii at shared lattice vertices.

Dots darken the untouched source through an antialiased black overlay. Dot Density changes score/radius without moving the lattice; Dot Fade changes only opacity. `ComicizeCalibration` centralizes every fitted constant, while replaceable helpers isolate grid phase, luminance, scoring, transfer, and radius calculations.

Developer-only `debugMode` values can visualize the grid, luminance, fitted terms, score, strength, radius, and alpha. Small-radius quantization is available for calibration but disabled by default.
