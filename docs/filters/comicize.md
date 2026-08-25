# Comic Book / Comicize (experimental)

`Comicize=enabled,colorBrush,dotDensity,dotFade` is an experimental **Effects &
Finishes** filter.

## Processing order

1. **Color Brush** applies a gamma-encoded RGB Gaussian blur with
   `sigma = colorBrush / 9`, then combines it with the original using a
   per-channel Darken blend (`min(original, blurred)`).
2. Dot geometry is calculated independently from the **original**, unbrushed
   image. The centered resolution-scaled tile lattice, full-tile luminance,
   density response, and hidden vignette determine one normalized radius `rho`
   for each tile.
3. The dot target color is derived from the **brushed** RGB using the calibrated
   density/radius color equations. A tile's center disc and four independently
   clipped corner quarters share its radius.
4. The active Comicize result is rounded to 8-bit and reduced by one level as an
   isolated compatibility quirk.
5. **Dot Fade** is the final encoded-RGB blend toward the original and uses
   Picasa-like truncation. Fade `100` returns the original bytes exactly.

Alpha and output dimensions are preserved. `ComicizeCalibration` centralizes
the fitted brush, grid, luminance, density, vignette, radius, and quantization
constants. Developer-only debug modes remain available for calibration.
