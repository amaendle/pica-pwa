# To-do ideas and implementation status

This document collects future ideas for Picasanous and notes whether they are currently implemented in the app.

| Idea | Current status | Notes |
|---|---|---|
| Watch folder for new photos | Not implemented | Libraries are loaded through the user-selected folder/import flow. There is no background watcher or automatic refresh when new files are added to the folder. |
| Run color analysis | Partially implemented | Some workflows analyze pixel/color values for specific tools, such as red-eye detection and neutral color picking, but there is no general image color-analysis feature that stores palettes, dominant colors, or color statistics for each photo. |
| Location detection | Partially implemented | The app can read and edit geotags from `.picasa.ini` / `.picasa.info`, PMP metadata, and EXIF GPS, and it provides map-based geotag editing. It does not infer locations from image content or reverse-geocode coordinates into place names. |
| Face recognition | Partially implemented | The editor can detect face rectangles and store named face entries. It does not yet recognize identities automatically across photos. |
| Style classification | Not implemented | The app has many manual style/look filters, but no automatic classifier that tags photos by visual style. |
| Object detection | Not implemented | No general object detection model or object-tagging pipeline is currently implemented. |
