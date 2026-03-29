# Picasa / PMP Reverse-Engineering Notes

This document summarizes what has been reverse engineered so far in this prototype about:

* `.picasa.ini` (in this app `.picasa.info`)
* PMP column files (`albumdata_*`, `catdata_*`, `imagedata_*`)
* thumbnail databases (`bigthumbs`, `thumbs2`, `thumbs`, `previews`)
* `thumbindex.db`
* how thumbnails, PMP rows, and `.picasa` metadata map to one another

It is intended to be a working engineering note, not a final specification.

---

## 1. High-level model

Three representations carry overlapping Picasa metadata:

1. **`.picasa.ini` (in this app `.picasa.info`)**
   * human-readable INI-like metadata stored beside images/folders
   * used for crop, faces, text overlays, filters, albums, star, keywords, etc.

2. **PMP tables**
   * binary column files such as `imagedata_crop64.pmp`, `imagedata_filters.pmp`, `albumdata_name.pmp`
   * conceptually columnar tables, one file per column
   * current prototype reads them as typed arrays of entries

3. **thumbnail databases**
   * binary image cache files such as `bigthumbs_0.db`, `thumbs2_0.db`, `thumbs_0.db`, `previews_0.db`
   * matched back to images by `thumbindex.db`

Current confirmed model:

* **`rowIndex` is the primary key across thumbindex + `imagedata_*`**
* `thumbindex.db` is the structural index / graph layer
* PMP `imagedata_*` columns are the semantic metadata layer attached to those same row indices
* `parentIdx` is a general graph edge, not only a folder hierarchy pointer
* `typeCode = 1001` rows are face nodes attached to media rows (JPEG, PNG, BMP, AVI, etc.)

---

## 2. `.picasa.ini` (in this app `.picasa.info`)

### 2.1 File format

Observed format is INI-like:

* section per image: `[filename.jpg]`
* extra sections such as `[.album:<token>]`
* contact section: `[Contacts2]`

Keys seen in image sections:

* `caption`
* `filters`
* `crop`
* `faces`
* `text`
* `keywords`
* `star`
* `albums`
* `backuphash`
* `redo`
* `textactive`

### 2.2 Crop

Examples:

* `crop=rect64(bcd6c4498ffe666)`
* `filters=crop64=1,bcd6c4498ffe666;`

Interpretation:

* `rect64` is a packed 64-bit rectangle
* format is four unsigned 16-bit numbers:

  * `x1`
  * `y1`
  * `x2`
  * `y2`

### 2.3 Faces

Example:

* `faces=rect64(253395994d33d599),1722d6a2d9a12107`

Interpretation:

* face geometry is stored as a `rect64`
* second value appears to be a face/contact identifier
* PMP stores face geometry / analysis data in `imagedata` columns
* face/contact linkage involves separate face-node rows (`thumbindexTypeCode = 1001`) linked through `parentIdx` to the main media row

### 2.4 Text overlays

`text=` contains serialized overlay records separated by `;;`.

Observed fields include:

* enabled/style codes
* caption text
* font family
* x/y/scale/rotation
* fill and outline colors
* opacity
* stroke width factor
* weight / render flags / anchor flags

The prototype already reads and writes this format and renders it in both gallery and slideshow.

### 2.5 Fields now considered mostly direct mirrors of PMP

Based on paired samples, these look like direct or near-direct equivalents between `.picasa.ini/.info` and PMP:

* `backuphash`
* `filters`
* `text`
* `textactive`
* `redo`

---

## 3. PMP tables

### 3.1 Table families

Observed PMP table prefixes:

* `albumdata_*`
* `catdata_*`
* `imagedata_*`

Current prototype scans all `db/*.pmp` matching:

* `albumdata_<column>.pmp`
* `catdata_<column>.pmp`
* `imagedata_<column>.pmp`

### 3.2 PMP storage model

PMP files appear to be **column-oriented**:

* each file stores one column
* row `i` across multiple `imagedata_*` files refers to the same logical image row

Examples:

* `imagedata_crop64.pmp`
* `imagedata_filters.pmp`
* `imagedata_text.pmp`
* `imagedata_backuphash.pmp`

### 3.3 Known `imagedata_*` field correspondences

Known or strongly supported by samples:

| PMP column | `.picasa` counterpart | Notes |
| --- | --- | --- |
| `backuphash` | `backuphash=` | direct scalar mirror |
| `filters` | `filters=` | direct string mirror |
| `text` | `text=` | direct serialized overlay string mirror |
| `textactive` | `textactive=` | direct scalar mirror |
| `redo` | `redo=` | direct string mirror |
| `crop64` | `crop=rect64(...)` / `filters=crop64=1,...;` | same geometry, different representation |
| `facerect` | `faces=rect64(...),<faceId>` | geometry is stored as rect64-like packed data; observed on both main image rows and face-related virtual rows |
| `facerectdata` | no direct `.picasa` equivalent yet | on main media rows it is usually just a marker that face side-data exists; on `filetype = 1001` rows it carries the detailed face-analysis payload |

### 3.4 Open PMP questions

Fields still needing more confirmation:

* `avgcolor`
* `originfast`
* `originslow`
* `lat`
* `long`
* `tagdate`
* people-album relation fields

---

## 3.5 Master filter spec table

The table below consolidates observed INI filter tokens and UI naming, including parameter position semantics and observed/default envelopes.

| Filter (INI) | UI Name | Position Parameter | Meaning | Min observed | Default observed | Max observed | Range |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Boost | Boost | 1 | Strength | 0 | 50 | 100 | 0–100 |
| Soften | Soften | 1 | Softness | 0 | 50 | 100 | 0–100 |
| Soften | Soften | 2 | Fade | 0 | 50 | 100 | 0–100 |
| Vignette | Vignette | 1 | Size | 0 | 35 | 50 | 0–100 |
| Vignette | Vignette | 2 | Strength | 1.0 | 1.4 | 2.0 | ~1–5 |
| Vignette | Vignette | 3 | Fade | 0 | 0 | 100 | 0–100 |
| Vignette | Vignette | 4 | Vignette Color | 00000000 | 00000000 | ffc194a8 | ARGB |
| Pixelate | Pixelize | 1 | Pixel Size | 2 | 20 | 150 | 2–150+ |
| Pixelate | Pixelize | 2 | Blend Mode | 0 | 9 | 9 | 0–9 |
| Pixelate | Pixelize | 3 | Fade | 0 | 0 | 100 | 0–100 |
| FocalZoom | Focal Zoom | 1 | Center X | -0.002144 | 0.500000 | 0.500000 | ~0–1 |
| FocalZoom | Focal Zoom | 2 | Center Y | 0.001072 | 0.500000 | 1.004286 | ~0–1 |
| FocalZoom | Focal Zoom | 3 | Zoominess | 1 | 50 | 100 | 0–100 |
| FocalZoom | Focal Zoom | 4 | Focal Size | 0 | 50 | 100 | 0–100 |
| FocalZoom | Focal Zoom | 5 | Edge Hardness | 0 | 50 | 100 | 0–100 |
| FocalZoom | Focal Zoom | 6 | Fade | 0 | 0 | 0 | 0–100* |
| PencilSketch | Pencil Sketch | 1 | Radius | 1.3 | 2 | 5 | ~1–10 |
| PencilSketch | Pencil Sketch | 2 | Strength | 0 | 100 | 200 | 0–200+ |
| PencilSketch | Pencil Sketch | 3 | Fade | 0 | 0 | 100 | 0–100 |
| Neon | Neon | 1 | Fade | 0 | 0 | 100 | 0–100 |
| Neon | Neon | 2 | Neon Color | 00ff0000 | 00ff0000 | ffbba6a2 | ARGB |
| Comicize | Comic Book | 1 | Color Brush | 0 | 20 | 100 | 0–100 |
| Comicize | Comic Book | 2 | Dot Density | 0 | 50 | 100 | 0–100 |
| Comicize | Comic Book | 3 | Dot Fade | 0 | 50 | 100 | 0–100 |
| Border | Border | 1 | Outer Thickness | 0 | 20 | 100 | 0–100 |
| Border | Border | 2 | Inner Thickness | 0 | 5 | 100 | 0–100 |
| Border | Border | 3 | Corner Radius | 0 | 0 | 100 | 0–100 |
| Border | Border | 4 | Outer Color | 00000000 | 00000000 | ffa46d4e | ARGB |
| Border | Border | 5 | Inner Color | 00ffffff | 00ffffff | ffcc6601 | ARGB |
| Border | Border | 6 | Caption Height | 0 | 0 | 100 | 0–100 |
| DropShadow | Drop Shadow | 1 | Distance | 0 | 4 | 30 | 0–100 |
| DropShadow | Drop Shadow | 2 | Angle | 0 | 90 | 360 | 0–360 |
| DropShadow | Drop Shadow | 3 | Size | 0 | 10 | 100 | 0–100 |
| DropShadow | Drop Shadow | 4 | Shadow Color | 00000000 | 00000000 | fff0a556 | ARGB |
| DropShadow | Drop Shadow | 5 | Background Color | 00ffffff | 00ffffff | fff6d971 | ARGB |
| DropShadow | Drop Shadow | 6 | Fade | 0 | 30 | 100 | 0–100 |
| MuseumMatte | Museum Matte | 1 | Outer Thickness | 0 | 25 | 100 | 0–100 |
| MuseumMatte | Museum Matte | 2 | Inner Thickness | 0 | 40 | 100 | 0–100 |
| MuseumMatte | Museum Matte | 3 | Outer Color | 001a0e03 | 001a0e03 | ffffd195 | ARGB |
| MuseumMatte | Museum Matte | 4 | Inner Color | 00f0eae4 | 00f0eae4 | ff8f9a58 | ARGB |
| Polaroid | Polaroid | 1 | Rotation | -10 | 5 | 10 | ~-10–10 |
| Polaroid | Polaroid | 2 | Background Color | 00e2e2e2 | 00e2e2e2 | ffcb94fb | ARGB |
| IR | Infrared Film | 1 | Fade | 0 | 0 | 100 | 0–100 |
| Lomo | Lomo-ish | 1 | Blur Edges | 0 | 50 | 100 | 0–100 |
| Lomo | Lomo-ish | 2 | Fade | 0 | 0 | 100 | 0–100 |
| Holga | Holga-ish | 1 | Blur Edges | 0 | 70 | 100 | 0–100 |
| Holga | Holga-ish | 2 | Grain | 0 | 30 | 100 | 0–100 |
| Holga | Holga-ish | 3 | Fade | 0 | 0 | 100 | 0–100 |
| HDR | HDR-ish | 1 | Radius | 1.3 | 20 | 80 | 0–100** |
| HDR | HDR-ish | 2 | Strength | 1 | 3 | 7 | 0–10** |
| HDR | HDR-ish | 3 | Fade | 0 | 0 | 100 | 0–100 |
| Cinemascope | Cinemascope | 1 | Letterbox | 0 | 1 | 1 | 0/1 |
| Orton | Orton-ish | 1 | Bloom | 0 | 25 | 50 | 0–100 |
| Orton | Orton-ish | 2 | Brightness | 0 | 50 | 100 | 0–100 |
| Orton | Orton-ish | 3 | Fade | 0 | 0 | 100 | 0–100 |
| Sixties | 1960's | 1 | Fade | 0 | 20 | 100 | 0–100 |
| Sixties | 1960's | 2 | Background Color | 00ffffff | 00ffffff | ffc194a8 | ARGB |
| Sixties | 1960's | 3 | Rounded Corners | 0 | 1 | 1 | 0/1 |
| Invert | Invert Colors | 0 | Enabled | 1 | 1 | 1 | constant 1 |
| HeatMap | Heat Map | 1 | Hue | -180 | 0 | 180 | -180–180 |
| HeatMap | Heat Map | 2 | Fade | 0 | 0 | 100 | 0–100 |
| CrossProcess | Cross Process | 1 | Fade | 0 | 0 | 100 | 0–100 |
| QuantizePalette | Posterize | 1 | Number of Colors | 2 | 8 | 30 | 2–256 |
| QuantizePalette | Posterize | 2 | Detail | 0 | 80 | 100 | 0–100 |
| QuantizePalette | Posterize | 3 | Fade | 0 | 0 | 100 | 0–100 |
| TwoTone | Duo-Tone | 1 | Brightness | -95 | 0 | 95 | ~-100–100 |
| TwoTone | Duo-Tone | 2 | Contrast | 0 | 20 | 100 | 0–100 |
| TwoTone | Duo-Tone | 3 | Fade | 0 | 0 | 100 | 0–100 |
| TwoTone | Duo-Tone | 4 | First Color | 00004488 | 00004488 | ffeb9476 | ARGB |
| TwoTone | Duo-Tone | 5 | Second Color | 00ffff00 | 00ffff00 | ffe2baae | ARGB |
| unsharp2 | Sharpen | 1 | Amount | 0 | 0.6 | 3 | 0–3+ |
| sepia | Sepia | 0 | Enabled | 1 | 1 | 1 | constant 1 |
| bw | B&W | 0 | Enabled | 1 | 1 | 1 | constant 1 |
| warm | Warmify | 0 | Enabled | 1 | 1 | 1 | constant 1 |
| PicnikGrain | Film Grain | 1 | Grain | 0 | 10 | 50 | 0–50+ |
| PicnikGrain | Film Grain | 2 | Lighten | 0 | 0 | 1 | 0/1 |
| PicnikTint | Tint | 1 | Fade | 0 | 0 | 100 | 0–100 |
| PicnikTint | Tint | 2 | Pick Color | 0080cfff | 0080cfff | ff8f9a58 | ARGB |
| sat | Saturation | 1 | Amount | -1 | 0.161800 | 1 | -1–1 |
| radblur | Soft Focus | 1 | Center X | -0.003215 | 0.500000 | 0.500000 | ~0–1 |
| radblur | Soft Focus | 2 | Center Y | 0.000000 | 0.500000 | 1.001429 | ~0–1 |
| radblur | Soft Focus | 3 | Size | -1 | 0 | 1 | -1–1 |
| radblur | Soft Focus | 4 | Amount | -1 | 0 | 0 | -1–1 |
| glow2 | Glow | 1 | Intensity | 0 | 0.650000 | 1 | 0–1 |
| glow2 | Glow | 2 | Radius | 1 | 3 | 250 | 1–250 |
| ansel | Filtered B&W | 1 | Pick Color | ffffffff | ffffffff | ff009e25 | ARGB |
| radsat | Focal B&W | 1 | Center X | -0.003215 | 0.500000 | 0.500000 | ~0–1 |
| radsat | Focal B&W | 2 | Center Y | 0.002144 | 0.500000 | 1.004286 | ~0–1 |
| radsat | Focal B&W | 3 | Size | -1 | 0 | 1 | -1–1 |
| radsat | Focal B&W | 4 | Sharpness | 0 | 0 | 1 | 0–1 |
| dir_tint | Graduated Tint | 1 | Center X | 0 | 0.500000 | 0.500000 | 0–1 |
| dir_tint | Graduated Tint | 2 | Center Y | 0.002144 | 0.500000 | 0.500000 | 0–1 |
| dir_tint | Graduated Tint | 3 | Feather | 0 | 0.250000 | 1 | 0–1 |
| dir_tint | Graduated Tint | 4 | Shade | 0 | 0.250000 | 1 | 0–1 |
| dir_tint | Graduated Tint | 5 | Pick Color | ffffffff | ffffffff | ffeb9476 | ARGB |
| dir_tint | Graduated Tint | 6 | Mode / Variant | 0 | 1 | 3 | 0–3 |
| tilt | Straighten | 1 | Angle value (converted by `tiltValueToRad`) | -1.000000 | 0.000000 | 1.000000 | normalized slider domain |
| tilt | Straighten | 2 | Legacy secondary parameter (typically 0) | 0.000000 | 0.000000 | 0.000000 | legacy/constant in observed data |
| finetune2 | Fill Light / tuning | 1 | Fill | 0.000000 | 0.000000 | 1.000000 | 0–1 |
| finetune2 | Fill Light / tuning | 2 | Highlights | 0.000000 | 0.000000 | 1.000000 | 0–1 |
| finetune2 | Fill Light / tuning | 3 | Shadows | 0.000000 | 0.000000 | 1.000000 | 0–1 |
| finetune2 | Fill Light / tuning | 4 | Saturation | 0.000000 | 1.000000 | 2.000000 | 0–2 |
| finetune2 | Fill Light / tuning | 5 | Warmth | -1.000000 | 0.000000 | 1.000000 | -1–1 |
| finetune2 | Fill Light / tuning | 6 | Tint | -1.000000 | 0.000000 | 1.000000 | -1–1 |
| redeye | Redeye | 0 | Enabled | 1 | — | 1 | constant 1 |
| enhance | I'm Feeling Lucky | 0 | Enabled | 1 | — | 1 | constant 1 |
| autolight | Auto Contrast | 0 | Enabled | 1 | — | 1 | constant 1 |
| autocolor | Auto Color | 0 | Enabled | 1 | — | 1 | constant 1 |
| retouch | Retouch | 0 | Enabled | 1 | — | 1 | constant 1 |
| crop64 | Crop | 1 | Crop rectangle (`rect64`-encoded x1/y1/x2/y2; decode via 16-bit normalized coords) | 0000000000000000 | example: bcd6c44908ffe666 | ffffffffffffffff | 64-bit encoded rectangle |

## 4. Rect64 encoding

### 4.1 What `rect64` is

`rect64` is a 64-bit value storing four unsigned 16-bit values:

```text
[x1][y1][x2][y2]
```

It may appear in two representations:

* hex string: `bcd6c4498ffe666`
* decimal integer: `850454946523375206`

### 4.2 Decode procedure

1. Normalize to a 16-digit hex string
2. Split into four 16-bit chunks
3. Convert each chunk to float via:

```text
value / 65535.0
```

4. Convert top-left/bottom-right to a box:

```text
x = x1
y = y1
w = x2 - x1
h = y2 - y1
```

### 4.3 Worked example

```text
bcd6c4498ffe666
=> 0bcd 6c44 98ff e666
=> x1  y1  x2  y2
```

This matches current prototype handling of hex `rect64` strings for crop and face boxes.

---

## 5. Thumbnail databases

Observed thumbnail database families:

* `bigthumbs_0.db`
* `thumbs2_0.db`
* `thumbs_0.db`
* `previews_0.db`

Observed larger thumbnail dimension by source:

* `previews` → `640 px`
* `bigthumbs` → `288 px`
* `thumbs` → `144 px`
* `thumbs2` → `72 px`

Observed paired index files:

* `<source>_0_index.db`

Current prototype can extract blobs from:

* paired indexed DB formats
* embedded-image fallbacks
* some Compound File Binary (CFB) stream containers (OLE structured-storage style containers with named streams)

These extracted thumbnails are cached in IndexedDB and then exposed via lazy-bound blob URLs at runtime.

---

## 6. `thumbindex.db`

### 6.1 Purpose

`thumbindex.db` is the structural index for the whole Picasa object graph.

Confirmed model:

* `thumbindex idx` / row index is the primary key
* the same row index addresses the corresponding `imagedata_*` PMP entries
* `parentIdx` expresses graph edges:
  * folders → files
  * images → face nodes
* thumbindex therefore is not just a directory tree; it is a typed node graph

Confirmed semantic split:

* thumbindex 26-byte block = structural/object metadata only
* PMP `imagedata_*` = semantic metadata (faces, edits, tags, geodata, captions, etc.)
* `facerectdata` behaves differently on main media rows and face rows
* on main media rows it is usually just a marker that face side-data exists
* on `filetype = 1001` rows it is a detailed per-face analysis payload
* `facequality`, `personalbumid`, `facerect`, and `facerectdata` together identify the face-node semantics
* in this sample, every media row that has child `1001` face rows also has non-empty face-related marker data on the parent row

### 6.2 Entry layout (confirmed)

Each entry is:

```text
(0x00 OR 0x00-terminated name/path string)
+ 26-byte metadata block
+ 4-byte parent index
```

Important parser note:

* the first field can be completely empty and represented by a single `0x00`
* this is different from “a normal string that merely happens to be short”
* empty-name rows are important for virtual objects, so the parser must treat leading `0x00` as a valid empty first field and then read metadata immediately after that one byte

### 6.3 26-byte metadata block

Current decoded structure:

* bytes `0..7`   → 64-bit Windows `FILETIME` (appears to track date-taken / image-metadata time)
* bytes `8..15`  → 64-bit Windows `FILETIME` (appears to track the file's last-modified data)
* bytes `16..19` → 32-bit file size in bytes
* bytes `20..23` → 32-bit row/media class code
* bytes `24..25` → 16-bit flags field

Cleaned CSV observations for the flags field:

* `0x0100` is used for most file and face rows
* `0x0102` occurs almost exclusively on directories
* `0x0101` appears rarely on a small subset of AVI rows

Important conclusion:

* the 26-byte block appears to contain compact per-node record metadata (timestamps, file size, type, flags)
* richer semantics such as face analysis, edits, tags, captions, and geodata live in PMP columns

### 6.4 Observed type codes

In our analysis, `thumbindexTypeCode` and PMP `filetype` match exactly for all populated rows.

Observed values in this sample:

* `1` → directory
* `2` → JPG/JPEG
* `4` → small mixed special bucket (`.avi`, `.mod`, some `.jpg`)
* `5` → root (`c:/`)
* `6` → BMP
* `8` → AVI
* `10` → MPG
* `13` → TIF
* `19` → PAL
* `31` → JPG special bucket
* `1001` → face node

So in this sample, type codes behave primarily like row/media class labels, with `1001` reserved for synthetic per-face rows.

### 6.5 Virtual entries

Important finding:

* `parentIdx` links them back to their parent media row
* multiple face rows can exist per real media row
* in this sample, `typeCode = 1001` rows have empty names, file size `1`, flags `0x0100`, and both thumbindex FILETIME values equal to zero
* rows with `typeCode = 1001` consistently carry face metadata such as `facerect`, `facequality`, `personalbumid`, and `facerectdata`

Confirmed interpretation:

* each `typeCode = 1001` row is one detected face record
* the parent media row carries image-level state; the child face rows carry per-face state
* face geometry is stored in PMP columns (`facerect` / `facerectdata`)

Detailed sample:

```text
facequality: 32954
facerect: 12070288535093797128
facerectdata: "conf(0.330),pan(23.032),leye(0.676,0.326),reye(0.692,0.328),mouth(0.681,0.363)"
filetype: 1001
```

Interpretation of that payload:

* `conf(...)` → confidence score for the detected face object
* `pan(...)` → estimated left/right face angle in degrees
* `leye(x,y)` → normalized left-eye position within the face rectangle
* `reye(x,y)` → normalized right-eye position within the face rectangle
* `mouth(x,y)` → normalized mouth position within the face rectangle

### 6.6 Folder/path reconstruction

Path reconstruction works by following `parentIdx` recursively and joining leaf names onto parent paths.

The prototype now stores for each thumbindex entry:

* row index
* name
* full reconstructed path
* folder path
* parent idx
* type code
* flags
* file size
* filesystem timestamp
* Picasa timestamp

---

## 7. Current mapping model used in the prototype

### 7.1 Gallery/slideshow row mapping

Current prototype behavior:

1. image item is matched to a thumbindex alias/path
2. that match yields a thumbnail row index
3. same index is used as the PMP `imagedata_*` row index

This has proven to work for the current slideshow PMP dump feature.

### 7.2 Metadata overlay

The metadata overlay currently shows:

* image path / label
* matched PMP row index
* thumbnail source used for the mapping
* thumbindex metadata for that index
* raw `imagedata_*` values for the same row
* decoded helper values for `crop64` / `facerect`
* decoded thumbindex timestamps with the raw FILETIME hex value appended in parentheses

This overlay is now callable from:

* slideshow
* normal gallery tiles
* raw thumbnail gallery tiles

---

## 8. What is still unresolved

Open investigations:

1. confirm decimal↔hex conversion for all `facerect` values
2. trace face/contact IDs through face-node rows and `Contacts2`
3. decode remaining PMP-specific fields:
   * `avgcolor`
   * `originfast`
   * `originslow`
   * `lat`
   * `long`
   * `tagdate`
   * people/alias fields

---

## 9. Practical engineering guidance

If continuing reverse engineering, prioritize in this order:

1. keep `.picasa.ini` parsing aligned with this app's `.picasa.info` usage and validate one-to-one field mirrors (`filters`, `text`, `redo`, `textactive`, `backuphash`)
2. for faces, treat `typeCode = 1001` rows as first-class face nodes and follow `parentIdx` back to the owning media row
3. normalize `crop64` and `facerect` decoding into shared helpers so the same rect64 logic is used in importer, overlay, and export paths
4. keep `thumbindex.db` focused on structure (path graph, parent links, type/flags/timestamps) and keep semantic decoding in PMP columns
5. continue decoding lower-confidence PMP fields (`avgcolor`, `originfast`, `originslow`, `lat`, `long`, `tagdate`) with paired sample validation
6. document every new field mapping in this file together with an example source token/value and the decoded representation used in code

This keeps structural indexing, semantic metadata, and UI/export behavior aligned as the prototype grows.
