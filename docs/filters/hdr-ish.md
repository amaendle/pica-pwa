# HDR-ish

`HDRish=1,radius,strength,fade`

HDR-ish enhances local per-channel detail without changing image dimensions. For
each RGB channel it applies three clamp-to-edge box-blur passes, subtracts that
local base from the source, and adds the detail back using **Strength**. **Fade**
then blends the completed effect toward the original image. Alpha is preserved.

- **Radius:** `1.3–80.0` pixels; controls the local neighborhood.
- **Strength:** `1.0–7.0`; controls detail amplification.
- **Fade:** `0–100`; `0` is the full effect and `100` is the original image.

The CPU implementation is shared by live preview and full-resolution rendering.
