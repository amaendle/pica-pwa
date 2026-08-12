# Polaroid

`Polaroid=enabled,rotate,backgroundColor` is an **Effects & Finishes** filter. Its only controls are enabled state, rotation (`-10..10`, default `5`) and a Picasa `xxRRGGBB` background color.

The renderer takes a native-resolution centered square crop, surrounds it with calibrated white paper borders, and places the card at fixed asymmetric margins. The complete background, subtle paper shadow, paper, and photograph composition is then rotated clockwise for positive angles. Rotated bounds use the calibrated `floor` formula and exposed corners remain opaque background color.

Paper ratios (`0.0645`, `0.097`, `0.258`) and margins (`11`, `11`, `8`, `14`) are centralized in `polaroid-filter.js`. The paper shadow offset `(0, 3)`, sigma `2`, and opacity `0.10` are isolated because only their precise appearance remains provisional.

Disabled filters return the source unchanged. Saved state contains no derived crop, paper, shadow, or output geometry.
