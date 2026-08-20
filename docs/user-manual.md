# Pixasa User Manual

> **Template status:** This manual is intentionally incomplete. Sections marked
> **TODO** are placeholders for future user documentation.

## Contents

1. [Getting started](#getting-started)
2. [Browsing and slideshows](#browsing-and-slideshows)
3. [Editing images](#editing-images)
4. [Location metadata and Clear Tag](#location-metadata-and-clear-tag)
5. [Import, export, and backups](#import-export-and-backups)
6. [Troubleshooting](#troubleshooting)

## Getting started

**TODO:** Document browser requirements, opening a library, and the permissions
requested by the application.

## Browsing and slideshows

**TODO:** Document gallery navigation, slideshow controls, maps, and metadata
inspection.

## Editing images

**TODO:** Document the editor, filters, undo/redo, captions, faces, and saving.

## Location metadata and Clear Tag

The editor's **Clear Tag** action clears the location used by Pixasa. After the
image is saved, Pixasa records that the location was deliberately cleared and
will not restore it from its PMP metadata cache or from GPS metadata embedded in
the source image. Reopening the image in Pixasa therefore continues to show no
geotag.

### Important: the source image is not rewritten

Clearing a tag in Pixasa **does not remove GPS/EXIF information embedded in the
original image file**. Pixasa currently leaves source-image bytes unchanged. An
embedded location may consequently remain visible in another photo application,
an EXIF inspection tool, or a copy of the original file.

Pixasa stores the cleared state in its managed metadata (`geotagCleared=yes`) and
clears the corresponding latitude, longitude, and geoview values in its PMP
metadata cache. This suppresses the old location inside Pixasa; it is not an
EXIF-scrubbing operation.

To permanently remove embedded GPS data before sharing a file, use a trusted
metadata-removal tool or an export workflow that explicitly strips location
metadata. Keep a backup first, because those operations may rewrite the image
file. Pixasa does not currently provide that operation.

> **Note:** Coordinates `0, 0` are valid coordinates. Blank latitude and
> longitude fields mean “no Pixasa geotag”; entering zero in both fields creates
> a real tag at `0, 0`.

## Import, export, and backups

**TODO:** Document library metadata, thumbnail data, exports, and backup
recommendations.

## Troubleshooting

**TODO:** Add solutions for common permission, decoding, map, and metadata
issues.

