# Museum Matte

Museum Matte is an **Effects & Finishes** filter that adds independent outer and inner matte borders around an unscaled source image.

## User parameters and serialization

- **Outer thickness**: `0..1000` absolute source-image pixels per side.
- **Outer color**: opaque RGB color; default `#79b3db`.
- **Inner thickness**: `0..1000` absolute source-image pixels per side.
- **Inner color**: opaque RGB color; default `#fff47c`.

The compatible filter token remains `museumMatte=1,<outerThickness>,<outerARGB>,<innerThickness>,<innerARGB>`. Sigma, FWHM, and shadow opacities are derived and are not serialized, so existing edits automatically use the corrected rendering.

## Geometry and painting order

For source dimensions `W × H`, outer thickness `O`, and inner thickness `I`, output dimensions remain `(W + 2O + 2I) × (H + 2O + 2I)`. The inner matte begins at `(O,O)` and the unscaled photo begins at `(O+I,O+I)`. Border widths remain absolute source pixels and zero thickness creates no hidden padding.

The renderer fills the exact selected outer and inner colors, copies the source image 1:1, applies Shadow A inside the inner-matte rectangle, and then applies Shadow B inside the photo rectangle. Shadow A is present even when inner thickness is zero. In that case both rectangles coincide and the independently rounded darkening layers stack multiplicatively.

## Calibrated Gaussian rectangle shadows

The former hard radius, quadratic falloff, and nearest-edge distance field were replaced by an analytic separable Gaussian-blurred rectangle mask. For every point inside a shadow rectangle, its inset mask is `1 - insideX * insideY`, where each axis value is the Gaussian integral of the rectangle interval. This naturally makes corners darker than corresponding straight edges.

Calibration is centralized in `museum-matte-filter.js`:

- FWHM ratio: `0.02` of the original source short side.
- Shadow A opacity: `191 / 255`.
- Shadow B opacity: `225 / 255`.
- Sigma: `(min(sourceWidth, sourceHeight) * 0.02) / 2.35482`.

The analytic axis arrays are cached. Rendering is clipped to each rectangle and only a numerically relevant six-sigma edge band is traversed; this is a work bound, not a visual hard-radius falloff.

The shared filter chain currently processes the full source before final preview downscaling. The renderer also accepts original source dimensions and an explicit preview scale, using `previewSigma = sourceSigma * previewScale`; full-resolution output uses the full source sigma.

## Deliberately omitted Picasa artifact

Some Picasa references show a repeatable global offset of about `-1 RGB` on flat inner mattes and `-2 RGB` on otherwise unmodified photo pixels. This appears to be a quantization/compositing artifact, not part of the calibrated visual effect, and is intentionally not reproduced. Selected matte colors and source pixels outside the shadows remain exact.
