// 12 high-saturation, maximally-spaced hues — distinct even at low opacity on dark/light themes
const PASTEL_PALETTE = [
  "#E85D75", // rose         (hue ~350)
  "#E8883D", // orange       (hue ~25)
  "#D4B83D", // gold         (hue ~47)
  "#7BC856", // green        (hue ~100)
  "#3DC4A7", // teal         (hue ~167)
  "#3DA7E8", // blue         (hue ~207)
  "#5B7EE8", // indigo       (hue ~227)
  "#8B5CE8", // purple       (hue ~262)
  "#C85CB8", // magenta      (hue ~308)
  "#E85D9F", // pink         (hue ~330)
  "#A0C44E", // lime         (hue ~75)
  "#4EC4C4", // cyan         (hue ~180)
];

function hashStringToIndex(str, len) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0) % len;
}

function getAutoColor(repoName) {
  const index = hashStringToIndex(repoName, PASTEL_PALETTE.length);
  return PASTEL_PALETTE[index];
}

function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
