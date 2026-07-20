# Filter GPU/WebGL implementation status

Picasanous uses the CPU implementation as the reference path for every filter. WebGL paths are optional preview accelerators and must fall back to CPU when a WebGL2 context is unavailable or when a filter uses operations that are not currently represented in the shader pipeline. No WebGPU path is implemented yet.

| Filter / operation | Token / UI | CPU reference | WebGL/WebGPU status | Feasibility notes |
|---|---|---|---|---|
| Crop | `crop64` | Canvas crop path | WebGL implemented | Uses the existing crop shader; CPU/canvas fallback remains available. |
| Tilt / rotate | `tilt`, `rotate` | Canvas transform path | WebGL implemented | Uses the existing rotation shader when WebGL preview is enabled. |
| Fill Light | `filllight` | Canvas pixel path | WebGL implemented | Uses the existing fill-light shader. |
| Fine Tune 2 | `finetune2` | Canvas pixel path | WebGL implemented | Uses the existing finetune shader with curve uniforms. |
| Sepia, B/W, Warm, Grain2, Saturation, Tint, Ansel | `sepia`, `bw`, `warm`, `grain2`, `sat`, `tint`, `ansel` | `applyAdvancedColorFilterOnCanvas` | WebGL implemented | Uses `applyAdvancedColorFilterWebGL`; CPU fallback is retained. |
| Boost | `boost` | `boost-filter.js` | WebGL implemented | `boost-filter.js` has a matching shader path and CPU fallback. |
| Invert colors | `invert` | `creative-filters.js` | WebGL implemented | Single-pass shader now mirrors the CPU per-pixel math. |
| Cross-process | `crossprocess` | `creative-filters.js` | WebGL implemented | Single-pass shader now mirrors exposure, channel response, shadow lift, contrast, temperature/tint, and HSL saturation math. |
| Filtered B&W | `filtered-bw` | `creative-filters.js` | WebGL implemented | Single-pass shader uses the same selected-color channel weights and outputs neutral grayscale. |
| 1960s | `sixties` / `Sixties` | `sixties-filter.js` | CPU only | Feasible as a single shader pass for the color effect, but rounded-corner/background fill and exact fade/background syntax still need a dedicated shader branch. |
| Infrared Mono | `infraredmono` | `infrared-filter.js` | CPU only | Feasible with a multi-pass WebGL pipeline because it requires blurred luminance. Current shader helpers do not yet provide reusable float luminance blur targets. |
| Heatmap | `heatmap` | `heatmap-filter.js` | CPU only | Feasible as a shader for `inputBlur=0`; the optional input blur requires an additional separable blur pass. |
| Soften | `soften` | `soften-filter.js` | CPU only | Feasible but multi-pass: exact result needs the calibrated three-pass separable blur, glow, tone operations, and final fade. |
| Lomo-ish | `lomoish` | `lomo-filter.js` | CPU only | Feasible but multi-pass when blur is enabled; the base look is single-pass, focal blur needs reusable blur/focus mask passes. |
| Holga-ish | `holgaish` | `holga-filter.js` | CPU only | Feasible but multi-pass when edge blur is enabled, and deterministic grain requires a shader-compatible noise implementation matching the CPU hash. |
| Orton-ish | `ortonish` | `orton-filter.js` | CPU only | Feasible but multi-pass: exact output requires tone pass, approximated bloom blur, hard-light layer, darkening, and final fade. |
| Red-eye | `redeye2` | Editor overlay/pixel path | CPU only | Feasible as a targeted shader pass, but current implementation is rectangle/area driven and not a general full-frame filter shader. |

## Implementation policy

- CPU remains the canonical implementation for saved/exported output unless a filter-specific WebGL path is explicitly called by the preview pipeline.
- New WebGL implementations should reproduce the current CPU mathematics directly and preserve alpha.
- Multi-pass filters should share a common future WebGL blur utility instead of each adding incompatible blur approximations.
- WebGPU is not used in this repository today.
