export function generateLabelColor(labelName: string): string {
  const trimmed = labelName.trim().toLowerCase();
  let hash = 0;

  for (let index = 0; index < trimmed.length; index += 1) {
    hash = (hash * 31 + trimmed.charCodeAt(index)) >>> 0;
  }

  const hue = hash % 360;
  return hslToHex(hue, 64, 48);
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = l - chroma / 2;

  const [red, green, blue] = getRgbPrime(hue, chroma, x).map((channel) =>
    Math.round((channel + match) * 255)
  );

  return [red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("");
}

function getRgbPrime(hue: number, chroma: number, x: number): [number, number, number] {
  if (hue < 60) {
    return [chroma, x, 0];
  }
  if (hue < 120) {
    return [x, chroma, 0];
  }
  if (hue < 180) {
    return [0, chroma, x];
  }
  if (hue < 240) {
    return [0, x, chroma];
  }
  if (hue < 300) {
    return [x, 0, chroma];
  }
  return [chroma, 0, x];
}
