# DropShadow

DropShadow is an **Effects & Finishes** filter with enabled, distance, clockwise angle, size, shadow color, background color, and fade controls. It serializes as `DropShadow=<enabled>,<distance>,<angle>,<size>,<shadow xxRRGGBB>,<background xxRRGGBB>,<fade>`.

Geometry and calibration helpers live in `drop-shadow-filter.js`. Offset uses `Math.trunc(distance*cos/sin(angle))`; support is `2` at size zero or `round(size*1.36)` otherwise. Soft shadows use the provisional `sigma=size*0.35`. Fade uses the calibrated nonlinear `1-sqrt(fade/100)`. The high color byte is ignored and the lower 24 bits are rendered as opaque RGB.

The output is filled with background color, the hard or analytic Gaussian rectangular shadow is composited, and the source is copied byte-for-byte on top at 1:1. Disabled is an exact identity. Source-coordinate overlay mapping includes the expanded output and source placement.

The shared pipeline currently renders source resolution before final preview scaling. The geometry API also accepts a preview scale, scaling offsets, support, and sigma from source space. Size remains independent of source dimensions.

The exact historical blur kernel/corner tendency remains provisional. Picasa PNG alpha variations around soft edges (occasionally near 191/255) are documented in code but intentionally not reproduced; output background and shadow pixels are opaque.
