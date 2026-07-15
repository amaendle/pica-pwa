# Filtered B&W

**Filtered B&W** is a production filter in the **Basic Fixes** category. Its internal token is:

```text
filtered-bw=1,<opaque-argb-color>
```

The UI exposes one parameter:

| Parameter | Control | Default | Meaning |
| --- | --- | --- | --- |
| `pickColor` | HTML color input labeled **Pick Color** | `#ffffff` | Selects the virtual color filter used to weight red, green, and blue source channels before grayscale conversion. |

The selected color controls channel contribution only. It never tints the output; every output pixel remains neutral grayscale with `R = G = B`. Alpha is preserved from the source pixel.

## Algorithm

For each pixel, the selected color is converted to RGB channel weights:

```js
const sum = filterR + filterG + filterB;
const weightR = sum > 0 ? filterR / sum : 1 / 3;
const weightG = sum > 0 ? filterG / sum : 1 / 3;
const weightB = sum > 0 ? filterB / sum : 1 / 3;
```

Then grayscale is calculated directly from the source bytes:

```js
const gray = sourceR * weightR + sourceG * weightG + sourceB * weightB;
const value = clampByte(gray);

outputR = value;
outputG = value;
outputB = value;
outputA = sourceA;
```

No tint overlay, hue replacement, post-saturation, extra gamma, automatic contrast, or image-wide normalization is applied.

## Color behavior

- `#ffffff`: equal red/green/blue weighting.
- `#ff0000`: red source channel only.
- `#00ff00`: green source channel only.
- `#0000ff`: blue source channel only.
- `#ffff00`: equal red and green weighting, blue suppressed.
- `#000000`: safely falls back to equal channel weights.

Malformed colors fall back to `#ffffff`.
