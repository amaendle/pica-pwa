# Border

Border is an **Effects & Finishes** filter that draws an opaque outer area, a separately colored rounded inner frame, a native-resolution rounded photo opening, and optional caption space below the frame. It has no shadow, bevel, blur, image scaling, or color adjustment.

## User parameters

- Outer thickness: `0..100` absolute source pixels per side.
- Inner thickness: `0..100` absolute source pixels per side.
- Outer and inner colors: Picasa-style `00RRGGBB`; the leading `00` is metadata padding, not visible alpha.
- Corner radius: `0..100`, linearly selecting square through maximally rounded frame geometry.
- Caption height: `0..100`, converted with `floor(sourceHeight * captionHeight / 600)`.

The token is `border=1,<outerThickness>,<innerThickness>,<outerColor>,<innerColor>,<cornerRadius>,<captionHeight>`. Only these user values are serialized.

## Geometry

Geometry helpers are isolated in `border-filter.js`. For source `W × H`, outer thickness `O`, and inner thickness `I`, base output is `(W + 2(O+I)) × (H + 2(O+I))`; the photo remains `W × H` at `(O+I,O+I)`. Caption pixels are appended only below this base output and remain outer color.

`getBorderCornerGeometry` centralizes the calibrated radius formula: frame radius is `min(frameWidth, frameHeight) / 2 * cornerRadius / 100`, and photo radius is `max(0, frameRadius - I)`.

## Rasterization and preview

The CPU buffer/canvas renderer fills the rectangular output with outer color, rasterizes the rounded frame in inner color, then copies the source 1:1 through a separately rounded photo opening. A deterministic signed-distance coverage function provides one-pixel anti-aliasing without CSS. Pixels with full photo coverage are copied byte-for-byte.

The current shared pipeline applies Border at full source resolution before final preview downscaling. The geometry API also accepts a preview scale so thickness, caption pixels, and radii can be mapped from source coordinates if reduced pre-rendering is introduced later.

Face and text overlay coordinates pass through the same Border expansion mapping: the photo offset is added, output dimensions include only the bottom caption extension, and normalized overlays therefore remain aligned with the unscaled source image.
