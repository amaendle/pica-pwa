# Focal Zoom

`FocalZoom=enabled,relX,relY,zoominess,focalSize,edgeHardness,fade` is an **Effects & Finishes** filter. All controls are clamped to their documented normalized or `0..100` ranges.

The focal point is stored in original, pre-crop normalized coordinates. Rendering explicitly transforms it through the active crop before creating a deterministic multi-sample radial zoom blur. Focal Size is the protected circle's diameter as a percentage of the shorter rendered side; Edge Hardness controls its sharp inner radius, and Fade blends the result back to the original.

`zoominessToStrength()` contains the provisional empirical zoom-strength curve. It is isolated from parsing, focal geometry, masking, and serialization so later calibration can replace it without invalidating saved edits.

The filter preserves canvas dimensions and source alpha. Disabled, zero-Zoominess, and Fade 100 settings are exact bypasses.
