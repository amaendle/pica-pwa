# Pencil Sketch

`PencilSketch=enabled,radius,strength,fade` is an **Effects & Finishes** filter. Radius is clamped to `1.3..5`, Strength to `0..200`, and Fade to `0..100`.

The renderer converts RGB to Rec.601 luminance, computes a clamp-to-edge separable local Gaussian estimate, and maps local detail plus persistent high-contrast contours to graded dark marks on white paper. Strength changes nonlinear detail sensitivity rather than acting as opacity; Fade is applied only after the complete grayscale sketch is generated.

Legacy Picasa stores Radius continuously but changes output in discrete processing stages, with a conspicuous transition and occasional preview instability near Radius 3. This implementation deterministically quantizes Radius to half-step kernels and intentionally does not reproduce that instability.

The filter preserves dimensions and source alpha. Disabled and Fade 100 states return an exact copy of the input.
