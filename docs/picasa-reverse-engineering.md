# Picasa / PMP Reverse-Engineering Notes

This document summarizes what has been reverse engineered so far in this prototype about:

* `.picasa.ini` / `.picasa.info`
* PMP column files (`albumdata_*`, `catdata_*`, `imagedata_*`)
* thumbnail databases (`bigthumbs`, `thumbs2`, `thumbs`, `previews`)
* `thumbindex.db`
* how thumbnails, PMP rows, and `.picasa` metadata map to one another

It is intended to be a working engineering note, not a final specification.

---

## 1. High-level model

Three representations carry overlapping Picasa metadata:

1. **`.picasa.ini` / `.picasa.info`**
   * human-readable INI-like metadata stored beside images/folders
   * used for crop, faces, text overlays, filters, albums, star, keywords, etc.

2. **PMP tables**
   * binary column files such as `imagedata_crop64.pmp`, `imagedata_filters.pmp`, `albumdata_name.pmp`
   * conceptually columnar tables, one file per column
   * current prototype reads them as typed arrays of entries

3. **thumbnail databases**
   * binary image cache files such as `bigthumbs_0.db`, `thumbs2_0.db`, `thumbs_0.db`, `previews_0.db`
   * matched back to images by `thumbindex.db`

Current working assumption:

* **thumbnail row idx == PMP row idx for the corresponding image row**
* `thumbindex.db` provides the mapping from path/name to thumbnail/PMP row index
* some **virtual rows** exist in `thumbindex.db` for per-face or per-region objects

---

## 2. `.picasa.ini` / `.picasa.info`

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
* current working theory: PMP stores face geometry on the main image row, but face/contact linkage may live in a separate virtual row

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
| `facerect` | `faces=rect64(...),<faceId>` | geometry likely on main image row |
| `facerectdata` | no confirmed `.picasa` equivalent yet | likely flag/count/presence of virtual face rows |

### 3.4 Open PMP questions

Fields still needing more confirmation:

* `facerectdata`
* `avgcolor`
* `originfast`
* `originslow`
* `lat`
* `long`
* `tagdate`
* people-album relation fields

---

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

Observed paired index files:

* `<source>_0_index.db`
* `<source>_index.db`

Current prototype can extract blobs from:

* paired indexed DB formats
* embedded-image fallbacks
* some CFB stream containers

These extracted thumbnails are cached in IndexedDB and then exposed via lazy-bound blob URLs at runtime.

---

## 6. `thumbindex.db`

### 6.1 Purpose

`thumbindex.db` is the key file that maps thumbnail rows back to images and, by extension, to PMP row indices.

Current working model:

* `thumbindex idx` → thumbnail row index
* same `idx` → corresponding `imagedata_*` PMP row index

### 6.2 Entry layout (confirmed)

Each entry is:

```text
null-terminated name/path
+ 26-byte metadata block
+ 4-byte parent index
```

### 6.3 26-byte metadata block

Current decoded structure:

* bytes `0..7`   → 64-bit Windows `FILETIME` (filesystem timestamp; likely modified time)
* bytes `8..15`  → 64-bit Windows `FILETIME` (Picasa/import/index timestamp)
* bytes `16..19` → 32-bit file size in bytes
* bytes `20..23` → 32-bit type code
* bytes `24..25` → 16-bit flags/status

### 6.4 Observed type codes

Observed values:

* `1` → directory
* `5` → root
* `2` → normal image (e.g. JPEG)
* `1001` → virtual face/region-related entry

### 6.5 Virtual entries

Important finding:

* virtual entries often have **no filename**
* they point to a real image via `parentIdx`
* multiple virtual entries can exist per real image
* they correlate with face/region metadata

Working hypothesis:

* these virtual entries store face/region objects or related side-data
* the face/contact id from `.picasa.ini/.info` may be linked through these virtual records rather than the main image row itself

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

This overlay is now callable from:

* slideshow
* normal gallery tiles
* raw thumbnail gallery tiles

---

## 8. What is still unresolved

Open investigations:

1. confirm decimal↔hex conversion for all `facerect` values
2. determine exact meaning of `facerectdata`
3. trace face/contact IDs through virtual thumbindex/PMP rows
4. decode remaining PMP-specific fields:
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

1. `facerect`
2. `facerectdata`
3. virtual thumbindex rows (`typeCode = 1001`)
4. linked PMP rows for those virtual entries
5. remaining PMP-only scalar/structured fields

This should clarify where Picasa stores per-face metadata beyond the visible face rectangle.
