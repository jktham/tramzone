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
