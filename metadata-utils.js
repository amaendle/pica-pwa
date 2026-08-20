(function () {
  "use strict";

  function parseOptionalFiniteNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "string" && value.trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  function parseOptionalGeotag(latitude, longitude) {
    const lat = parseOptionalFiniteNumber(latitude), lng = parseOptionalFiniteNumber(longitude);
    if (lat === null || lng === null) return null;
    return { lat: Math.max(-90, Math.min(90, lat)), lng: Math.max(-180, Math.min(180, lng)) };
  }
  function parseRect64Box(rect64) {
    const text = String(rect64 || "").trim();
    if (text.startsWith("gui:")) {
      const values = text.slice(4).split("|").map(Number);
      if (values.length === 4 && values.every(Number.isFinite)) return { x:values[0], y:values[1], w:values[2], h:values[3] };
    }
    if (/^[0-9a-f]{16}$/i.test(text)) {
      const left=parseInt(text.slice(0,4),16)/65535,top=parseInt(text.slice(4,8),16)/65535,right=parseInt(text.slice(8,12),16)/65535,bottom=parseInt(text.slice(12,16),16)/65535;
      return { x:left, y:top, w:Math.max(0,right-left), h:Math.max(0,bottom-top) };
    }
    return null;
  }
  function getImagePixelDimensions(width, height, filters = [], fallbackCropRect64 = "") {
    const originalWidth=Math.max(1,Math.round(Number(width)||1)),originalHeight=Math.max(1,Math.round(Number(height)||1));
    const chain=Array.isArray(filters)?filters.map(String):[];
    const cropToken=chain.findLast?chain.findLast(token=>/^crop64=1,/i.test(token)):chain.slice().reverse().find(token=>/^crop64=1,/i.test(token));
    const rect64=cropToken?cropToken.replace(/^crop64=1,/i,""):String(fallbackCropRect64||"").trim(),box=parseRect64Box(rect64);
    return { originalWidth, originalHeight, croppedWidth:box?Math.max(1,Math.round(originalWidth*Math.max(0,Math.min(1,box.w)))):null, croppedHeight:box?Math.max(1,Math.round(originalHeight*Math.max(0,Math.min(1,box.h)))):null, hasCrop:!!box };
  }
  window.MetadataUtils={parseOptionalFiniteNumber,parseOptionalGeotag,parseRect64Box,getImagePixelDimensions};
})();
