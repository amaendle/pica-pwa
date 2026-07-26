# Duo-tone filter

The Duo-tone filter maps image pixels onto a two-color palette using the calibrated shared neural-spline model supplied for the Picasanous editor.

## User-facing controls

- **Color 1**: low-end palette color. Default: `#004488`.
- **Color 2**: high-end palette color. Default: `#ffff00`.
- **Contrast**: `0..100`; default `100`, selecting the calibrated `c100` neural-spline profile.
- **Brightness**: `-100..100`; default `0`, applied to the model score before palette mapping.
- **Fade**: `0..100`; `0` shows the Duo-tone result, `100` returns the original image.

## Rendering

The implementation is isolated in `duotone-filter.js`. It builds spatial context from integral-image luminance means at 3×3, 7×7, and 15×15 scales, plus local contrast, gradient, and channel statistics. The 13 normalized features feed a shared 12-unit `tanh` layer and the calibrated monotonic-spline heads (`c0`, `c20`, `c50`, and `c100`). The selected contrast interpolates those heads before the score is mapped between the two selected colors. Alpha is preserved, and fade is applied only as the final blend back to the original.

Preview and full-resolution/export-style rendering use the same canvas/buffer implementation through the shared filter pipeline token:

```text
duotone=1,<color1>,<color2>,<contrast>,<brightness>,<fade>
```

At contrast 100, the calibrated `c100` neural-spline score is used directly; the previous hard-threshold behavior is no longer part of the model. The residual LUT is intentionally disabled because the supplied settings specify `useLut: false` and omit residual data.
