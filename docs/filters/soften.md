# Calibrated Soften filter

The **Soften** filter is a non-destructive, calibrated Picasa-style effect in the editor filter stack. It exposes only two user-facing parameters:

| Parameter | Range | Direction |
| --- | ---: | --- |
| `softness` | `0..100` integer | Selects the calibrated response. `0` is identity, `50` is the calibrated 50% profile, and `100` is the calibrated 100% profile. |
| `fade` | `0..100` integer | Final blend back to the untouched original. `0` shows the full softened result; `100` shows the original image. |

Filter tokens preserve Picasa-compatible parameter order as `softness, fade`, using the app's enabled-filter convention: `soften=1,<softness>,<fade>`.

## Calibrated profiles

```js
const SOFTEN_IDENTITY = {
  radiusPct: 0.0,
  amount: 0.0,
  glow: 0.0,
  glowThreshold: 0.52,
  contrast: 1.0,
  pivot: 0.5,
  exposure: 0.0,
  gamma: 1.0,
  saturation: 1.0,
  blackLift: 0.0,
  gainR: 1.0,
  gainG: 1.0,
  gainB: 1.0,
};

const SOFTEN_50 = {
  radiusPct: 0.58,
  amount: 0.833,
  glow: 0.024,
  glowThreshold: 0.572,
  contrast: 0.992,
  pivot: 0.659,
  exposure: -0.018,
  gamma: 0.992,
  saturation: 1.006,
  blackLift: 0.004,
  gainR: 0.999,
  gainG: 0.998,
  gainB: 0.997,
};

const SOFTEN_100 = {
  radiusPct: 1.27,
  amount: 0.778,
  glow: 0.017,
  glowThreshold: 0.292,
  contrast: 1.016,
  pivot: 0.240,
  exposure: -0.026,
  gamma: 1.001,
  saturation: 1.008,
  blackLift: 0.016,
  gainR: 0.998,
  gainG: 0.998,
  gainB: 1.001,
};
```

## Interpolation

Internal profile fields are interpolated piecewise-linearly, not by blending endpoint images:

- `softness <= 50`: interpolate from identity to the 50% profile using `softness / 50`.
- `softness > 50`: interpolate from the 50% profile to the 100% profile using `(softness - 50) / 50`.

This preserves exact identity at `0`, exact calibrated 50% values at `50`, and exact calibrated 100% values at `100`. Individual fields are not forced to be monotonic.

## Blur radius and blur approximation

The blur radius is resolution-independent:

```js
radiusPx = profile.radiusPct * Math.min(width, height) / 100;
```

If `radiusPx < 0.45`, the source RGB is copied. Otherwise the browser-friendly Gaussian approximation uses:

```js
boxRadius = Math.max(1, Math.round(radiusPx / 1.8));
```

The implementation then performs three repetitions of separable sliding-window box blur passes: horizontal then vertical. Edge samples are clamped to the closest valid pixel.

## Pixel-operation order

For each pixel, the filter:

1. Mixes original RGB with blurred RGB using profile `amount`.
2. Applies thresholded highlight glow using blurred luminance and screen blend.
3. Applies luminance-preserving saturation.
4. Applies contrast around the profile pivot, then exposure.
5. Applies black lift.
6. Applies per-channel gains, clamps, and gamma.
7. Applies final user-facing `fade` once by blending the fully filtered RGB back to the original RGB.
8. Preserves the original alpha channel.

The final fade blend is:

```js
out = filtered + (original - filtered) * (fade / 100);
```

## Calibration notes

Calibration losses:

- 50% softness: `1.69`
- 100% softness: `1.25`

The loss is sampled RGB RMSE expressed in 8-bit channel units; lower is better. The endpoint values were calibrated from the supplied original/50%/100% reference images.
