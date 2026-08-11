# Vignette

Vignette is an **Effects & Finishes** filter using a calibrated Gaussian-blurred rectangular exterior mask. It is not a radial or elliptical gradient.

## User parameters

- **Size**: integer `0..50`; `0` is an exact bypass.
- **Strength**: `1.0..2.0`.
- **Vignette color**: opaque or translucent `AARRGGBB`, with an RGB color picker for convenience.

Defaults are size `35`, strength `1`, and color `ff79b3db`. The serialized token is `vignette=1,<size>,<strength>,<AARRGGBB>`; the internal Gaussian calibration is not serialized.

## Calibrated model

Sigma is derived from rendered image width only:

```text
sigma = size * imageWidth / 410
```

This gives sigma `280` for size 35 at width 3280 and sigma `400` for size 50 at width 3280. The rectangular interior probability is calculated independently for X and Y using the normal CDF. Exterior alpha is `1 - insideX * insideY`, multiplied by strength and color alpha.

RGB output uses deterministic source-over interpolation in sRGB byte space, and source alpha is preserved. The same buffer/canvas function is used by editor previews, slideshow/generated-thumbnail rendering, and full-resolution output.

The renderer caches the X/Y interior-mask arrays by width, height, and size. Strength or color changes reuse those arrays; changing dimensions or size invalidates the cache.
