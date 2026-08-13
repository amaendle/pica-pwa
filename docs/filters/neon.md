# Neon

`Neon=enabled,fade,color` is an **Effects & Finishes** filter. Fade is clamped to `0..100`; color accepts Picasa `AARRGGBB` tokens while using their RGB channels for the visible glow.

The CPU reference renderer computes Scharr gradients independently for red, green, and blue, combines those channel vectors into a neutral edge map, and therefore preserves equal-luminance hue boundaries. A contrast-shaped core and Gaussian-blurred glow are composed over black, with the selected color applied only after edge detection. Strong contours receive an additive white-hot core.

Fade linearly interpolates the neon result toward the original. Fade 100 and disabled tokens are exact bypasses, dimensions are unchanged, and source alpha is preserved.
