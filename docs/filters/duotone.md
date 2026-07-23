# Duo-tone filter

The Duo-tone filter maps image pixels onto a two-color palette using the calibrated robust model supplied for the Picasanous editor.

## User-facing controls

- **Color 1**: low-end palette color. Default: `#004488`.
- **Color 2**: high-end palette color. Default: `#ffff00`.
- **Contrast**: `0..100`; default `100`, matching the calibrated hard-cutoff profile.
- **Brightness**: `-100..100`; default `0`, applied to the model score before palette mapping.
- **Fade**: `0..100`; `0` shows the Duo-tone result, `100` returns the original image.

## Rendering

The implementation is isolated in `duotone-filter.js`. It computes the calibrated local mean/features, evaluates the calibrated score models (`c0`, `c20`, `c50`, `c100`), maps the score between the two selected colors, preserves alpha, then applies the final fade-to-original blend.

Preview and full-resolution/export-style rendering use the same canvas/buffer implementation through the shared filter pipeline token:

```text
duotone=1,<color1>,<color2>,<contrast>,<brightness>,<fade>
```

The calibrated residual LUT is intentionally disabled because the supplied settings specify `useLut: false` and omit residual data.
