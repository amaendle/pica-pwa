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

## 3.5 Filter spec table

The table below consolidates observed parameter positions and value envelopes for filter tokens seen in legacy Picasa metadata samples.
For readability, the `Filter` cell is only shown on the first parameter row of each filter.

| Filter | Position Parameter | Meaning | Min observed | Default observed | Max observed | Range |
| --- | --- | --- | --- | --- | --- | --- |
| Boost | 1 | intensity | 0 | 50 | 100 | 0–100 |
| Soften | 1 | softness | 0 | 50 | 100 | 0–100 |
|  | 2 | fade | 0 | 50 | 100 | 0–100 |
| Vignette | 1 | strength | 0 | 35 | 50 | 0–100 |
|  | 2 | radius | 1.0 | 1.4 | 2.0 | ~1–5 |
|  | 3 | fade | 0 | 0 | 100 | 0–100 |
|  | 4 | color | — | — | — | ARGB |
| Pixelate | 1 | pixel size | 2 | 20 | 150 | 2–150+ |
|  | 2 | block size | 0 | 9 | 9 | 0–~10 |
|  | 3 | blend/fade | 0 | 0 | 100 | 0–100 |
| FocalZoom | 1 | center X | 0 | 0.5 | ~1.004 | ~0–1 |
|  | 2 | center Y | 0 | 0.5 | ~1.004 | ~0–1 |
|  | 3 | zoom | 1 | 50 | 100 | 0–100 |
|  | 4 | focal size | 0 | 50 | 100 | 0–100 |
|  | 5 | edge hardness | 0 | 50 | 100 | 0–100 |
|  | 6 | fade | 0 | 0 | 0 | 0–100* |
| PencilSketch | 1 | radius | 1.3 | 2 | 5 | ~1–10 |
|  | 2 | strength | 0 | 100 | 200 | 0–200+ |
|  | 3 | fade | 0 | 0 | 100 | 0–100 |
| Neon | 1 | fade/intensity | 0 | 0 | 100 | 0–100 |
|  | 2 | color | — | — | — | ARGB |
| Comicize | 1 | color brush | 0 | 20 | 100 | 0–100 |
|  | 2 | dot density | 0 | 50 | 100 | 0–100 |
|  | 3 | dot fade | 0 | 50 | 100 | 0–100 |
| Border | 1 | outer thickness | 0 | 20 | 100 | 0–100 |
|  | 2 | inner thickness | 0 | 5 | 100 | 0–100 |
|  | 3 | corner radius | 0 | 0 | 100 | 0–100 |
|  | 4 | outer color | — | — | — | ARGB |
|  | 5 | inner color | — | — | — | ARGB |
|  | 6 | caption height/fade | 0 | 0 | 100 | 0–100 |
| DropShadow | 1 | distance | 0 | 4 | 30 | 0–100 |
|  | 2 | angle | 0 | 90 | 360 | 0–360 |
|  | 3 | size | 0 | 10 | 100 | 0–100 |
|  | 6 | fade | 0 | 30 | 100 | 0–100 |
| MuseumMatte | 1 | outer thickness | 0 | 25 | 100 | 0–100 |
|  | 2 | inner thickness | 0 | 40 | 100 | 0–100 |
| Polaroid | 1 | rotation | -10 | 5 | 10 | ~-10–10 |
|  | 2 | color | — | — | — | ARGB |
| IR | 1 | fade | 0 | 0 | 100 | 0–100 |
| Lomo | 1 | edge blur | 0 | 50 | 100 | 0–100 |
|  | 2 | fade | 0 | 0 | 100 | 0–100 |
| Holga | 1 | edge blur | 0 | 70 | 100 | 0–100 |
|  | 2 | grain | 0 | 30 | 100 | 0–100 |
|  | 3 | fade | 0 | 0 | 100 | 0–100 |
| HDR | 1 | strength | ~1.3 | 20 | 80 | 0–100 |
|  | 2 | radius | 1 | 3 | 7 | 0–10 |
|  | 3 | fade | 0 | 0 | 100 | 0–100 |
| Orton | 1 | bloom | 0 | 25 | 50 | 0–100 |
|  | 2 | brightness | 0 | 50 | 100 | 0–100 |
|  | 3 | fade | 0 | 0 | 100 | 0–100 |
| Sixties | 1 | fade | 0 | 20 | 100 | 0–100 |
|  | 3 | rounded toggle | 0 | 1 | 1 | 0/1 |
| HeatMap | 1 | hue | -180 | 0 | 180 | -180–180 |
|  | 2 | fade | 0 | 0 | 100 | 0–100 |
| CrossProcess | 1 | fade | 0 | 0 | 100 | 0–100 |
| QuantizePalette | 1 | colors | 2 | 8 | 30 | 2–256 |
|  | 2 | detail | 0 | 80 | 100 | 0–100 |
|  | 3 | fade | 0 | 0 | 100 | 0–100 |
| TwoTone | 1 | brightness | -95 | 0 | 95 | ~-100–100 |
|  | 2 | contrast | 0 | 20 | 100 | 0–100 |
|  | 3 | fade | 0 | 0 | 100 | 0–100 |
| unsharp2 | 1 | sharpen amount | 0 | 0.6 | 3 | 0–3+ |
| sat | 1 | saturation | -1 | 0.16 | 1 | -1–1 |
| radblur | 1 | center X | 0 | 0.5 | ~1 | ~0–1 |
|  | 2 | center Y | 0 | 0.5 | ~1 | ~0–1 |
|  | 3 | radius | -1 | 0 | 1 | -1–1 |
|  | 4 | blur | -1 | 0 | 0 | -1–1 |
| glow2 | 1 | intensity | 0 | 0.65 | 1 | 0–1 |
|  | 2 | radius | 1 | 3 | 250 | 1–250 |
| ansel | 1 | tint color | — | — | — | ARGB |
| radsat | 1 | center X | 0 | 0.5 | ~1 | ~0–1 |
|  | 2 | center Y | 0 | 0.5 | ~1 | ~0–1 |
|  | 3 | radius | -1 | 0 | 1 | -1–1 |
|  | 4 | sharpness | 0 | 0 | 1 | 0–1 |
| dir_tint | 1 | center X | 0 | 0.5 | 1 | 0–1 |
|  | 2 | center Y | 0 | 0.5 | 1 | 0–1 |
|  | 3 | feather | 0 | 0.25 | 1 | 0–1 |
|  | 4 | shade | 0 | 0.25 | 1 | 0–1 |
|  | 5 | color | — | — | — | ARGB |
|  | 6 | mode | 0 | 1 | 3 | 0–3 |
| PicnikGrain | 1 | grain amount | 0 | 10 | 50 | 0–50+ |
|  | 2 | lighten toggle | 0 | 0 | 1 | 0/1 |
| PicnikTint | 1 | fade | 0 | 0 | 100 | 0–100 |
|  | 2 | color | — | — | — | ARGB |
| Cinemascope | 1 | letterbox toggle | 0 | 1 | 1 | 0/1 |
| crop64 (`filters=crop64=1,<rect64>;`) | 1 | rect64 packed crop rectangle | — | — | — | rect64 payload |
| tint | 1 | preserveColor | 0 | 0 | 1 | 0–1 |
|  | 2 | tint color | — | ffffffff | — | ARGB |
| filllight | 1 | strength | 0 | 0 | 1 | 0–1 |
| finetune2 | 1 | fill | 0 | 0 | 1 | 0–1 |
|  | 2 | highlights | 0 | 0 | 1 | 0–1 |
|  | 3 | shadows | 0 | 0 | 1 | 0–1 |
|  | 4 | saturation | 0 | 1 | 2 | 0–2 |
|  | 5 | warmth | -1 | 0 | 1 | -1–1 |
|  | 6 | tint | -1 | 0 | 1 | -1–1 |
| sepia | 1 | enabled flag | 1 | 1 | 1 | literal 1 |
| bw | 1 | enabled flag | 1 | 1 | 1 | literal 1 |
| warm | 1 | enabled flag | 1 | 1 | 1 | literal 1 |
| grain2 | 1 | enabled flag | 1 | 1 | 1 | literal 1 |

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
