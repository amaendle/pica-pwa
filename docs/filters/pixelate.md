# Pixelate

Pixelate is an **Effects & Finishes** filter with three stored user parameters:

- **Pixel size** (`1..150` source-image pixels) controls the approximate block width and height.
- **Blend mode** (`0..9`) selects Add, Darken, Difference, Hard Light, Lighten, Multiply, Overlay, Screen, Subtract, or Normal.
- **Fade** (`0..100`) blends the completed effect back to the original; `0` is the full effect and `100` is the original image.

The serialized token is `pixelate=1,<pixelSize>,<blendMode>,<fade>`.

## Grid and averaging

The implementation first calculates `round(width / pixelSize)` by `round(height / pixelSize)` blocks. Integer boundaries are distributed over the complete image, so there is no narrow remainder block at the right or bottom edge. Every block uses an explicit arithmetic RGB box average rather than browser image resampling. For transparent input, accumulation is alpha-weighted to avoid hidden RGB causing fringes; source alpha is preserved.

## Rendering

Each original channel and its block-average channel are combined with the selected deterministic 8-bit blend formula. Hard Light branches on the pixelated value, while Overlay branches on the original value. Fade is applied after the blend operation.

The same buffer/canvas implementation is called by the shared filter chain for editor previews, slideshow views, generated thumbnails, and full-resolution output. Because the filter chain processes the source canvas before final preview downscaling, pixel size remains defined in source-image pixels.
