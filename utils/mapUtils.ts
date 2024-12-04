export function grayscaleLayer(context) {
  let canvas = context.canvas;
  let width = canvas.width;
  let height = canvas.height;
  let imageData = context.getImageData(0, 0, width, height);
  let data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    // CIE luminance for the RGB
    let v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // Show white color instead of black color while loading new tiles:
    if (v === 0.0) v = 255.0;
    v = 255 - (255 - v) * 0.6;
    data[i] = v; // Red
    data[i + 1] = v; // Green
    data[i + 2] = v; // Blue
    data[i + 3] = 255; // Alpha
  }
  context.putImageData(imageData, 0, 0);
}

export function convertLV95toWGS84(coords) {
  let x1 = (coords[1] - 1200000) / 1000000;
  let y1 = (coords[0] - 2600000) / 1000000;
  let eastCoord1 =
    2.6779094 +
    4.728982 * y1 +
    0.791484 * y1 * x1 +
    0.1306 * y1 * x1 ** 2 -
    0.0436 * y1 ** 3;
  let northCoord1 =
    16.9023892 +
    3.238272 * x1 -
    0.270978 * y1 ** 2 -
    0.002528 * x1 ** 2 -
    0.0447 * y1 ** 2 * x1 -
    0.014 * x1 ** 3;
  let eastCoord = (eastCoord1 * 100) / 36;
  let northCoord = (northCoord1 * 100) / 36;
  return [eastCoord, northCoord];
}
