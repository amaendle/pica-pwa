# Museum Matte

Museum Matte is an **Effects & Finishes** filter that adds independent outer and inner matte borders around an unscaled source image.

## User parameters

- **Outer thickness**: `0..1000` absolute source-image pixels per side.
- **Outer color**: opaque RGB color; default `#79b3db`.
- **Inner thickness**: `0..1000` absolute source-image pixels per side.
- **Inner color**: opaque RGB color; default `#fff47c`.

The filter token is `museumMatte=1,<outerThickness>,<outerARGB>,<innerThickness>,<innerARGB>`. Derived shadow values are deliberately not serialized.

## Geometry and rendering

For source dimensions `W × H`, outer thickness `O`, and inner thickness `I`, output dimensions are `(W + 2O + 2I) × (H + 2O + 2I)`. The inner matte begins at `(O,O)` and the unscaled photo begins at `(O+I,O+I)`. Zero thickness creates no hidden padding.

Rendering uses the shared CPU buffer/canvas filter API. It fills the outer matte, fills the inner matte when present, copies the original photo without scaling, then directly composites inset edge shadows. The photo always receives an inset shadow. When the inner matte exists, its outer edge receives a separate inset shadow; the outer canvas edge does not.

The shared filter chain processes Museum Matte before final preview downscaling, so border widths and shadow geometry are calculated in source-image pixels for both preview and full-resolution output.
The renderer also accepts full-source dimensions and a preview scale explicitly, keeping the derived shadow radius tied to the original image if a reduced processing canvas is introduced later.

## Provisional shadow calibration

The following values are centralized in `museum-matte-filter.js` for later recalibration:

- Radius: `max(1, round(min(W,H) * 0.02))`.
- Maximum edge opacity: `0.38`.
- Falloff: `0.38 * (1 - distance/radius)²`, becoming zero at the radius.

Only the narrow edge bands are processed; no full-frame blur or CSS shadow is used. The inset distance field uses the nearest rectangle edge, avoiding overlapping corner-strip seams.
