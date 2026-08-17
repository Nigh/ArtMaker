import { documentPixels, type DocumentSpec } from "./types";

// ponytail: complementary CMYK on sRGB bytes, not ICC. Ceiling: hue error vs FOGRA/Japan Color; upgrade: lcms + output profile.
const MIN_CMY = 0.04;
const TAC = 3;
const u8 = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 255);

export function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  let c = 1 - r / 255, m = 1 - g / 255, y = 1 - b / 255;
  const k = Math.min(c, m, y);
  c -= k; m -= k; y -= k;
  if (c < MIN_CMY) c = 0;
  if (m < MIN_CMY) m = 0;
  if (y < MIN_CMY) y = 0;
  const extra = c + m + y;
  if (extra > 0 && k + extra > TAC) { const s = (TAC - k) / extra; c *= s; m *= s; y *= s; }
  return [u8(c), u8(m), u8(y), u8(k)];
}

export function rgbaToCmyk(data: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    const a = data[i + 3];
    if (a < 255) { const t = a / 255, u = 1 - t; r = r * t + 255 * u; g = g * t + 255 * u; b = b * t + 255 * u; }
    const [c, m, y, k] = rgbToCmyk(r, g, b);
    out[i] = c; out[i + 1] = m; out[i + 2] = y; out[i + 3] = k;
  }
  return out;
}

export function pdfBoxes(spec: DocumentSpec) {
  const px = documentPixels(spec), pt = (pixels: number) => pixels * 72 / spec.dpi;
  const mediaW = pt(px.width), mediaH = pt(px.height);
  const trimL = pt(px.trimX), trimB = pt(px.height - px.trimY - px.trimHeight);
  return { mediaW, mediaH, trim: [trimL, trimB, trimL + pt(px.trimWidth), trimB + pt(px.trimHeight)] as const, bleed: [0, 0, mediaW, mediaH] as const };
}

const n = (v: number) => String(Math.round(v * 1000) / 1000);
const box = (b: readonly number[]) => `[${b.map(n).join(" ")}]`;

async function deflate(data: Uint8Array) {
  if (typeof CompressionStream === "undefined") return { bytes: data, filter: "" };
  const copy = new ArrayBuffer(data.byteLength);
  new Uint8Array(copy).set(data);
  const bytes = new Uint8Array(await new Response(new Blob([copy]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
  return { bytes, filter: "/Filter /FlateDecode " };
}

export async function exportCmykPdf(image: ImageData, spec: DocumentSpec) {
  const cmyk = rgbaToCmyk(image.data), { mediaW, mediaH, trim, bleed } = pdfBoxes(spec);
  const { bytes, filter } = await deflate(cmyk);
  const contents = `q ${n(mediaW)} 0 0 ${n(mediaH)} 0 0 cm /Im0 Do Q\n`;
  const parts: Uint8Array[] = [], offsets: number[] = [];
  let pos = 0;
  const add = (part: string | Uint8Array) => {
    const chunk = typeof part === "string" ? new TextEncoder().encode(part) : part;
    parts.push(chunk); pos += chunk.length;
  };
  const obj = (part: string | Uint8Array) => { offsets.push(pos); add(part); };
  add(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x80, 0x80, 0x80, 0x80, 0x0a]));
  obj("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n");
  obj("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n");
  obj(`3 0 obj << /Type /Page /Parent 2 0 R /MediaBox ${box(bleed)} /BleedBox ${box(bleed)} /TrimBox ${box(trim)} /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >> endobj\n`);
  obj(`4 0 obj << /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceCMYK /BitsPerComponent 8 /Interpolate false ${filter}/Length ${bytes.length} >> stream\n`);
  add(bytes); add("\nendstream\nendobj\n");
  obj(`5 0 obj << /Length ${contents.length} >> stream\n${contents}endstream\nendobj\n`);
  const startxref = pos;
  let table = `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) table += `${String(offset).padStart(10, "0")} 00000 n \n`;
  add(table); add(`trailer << /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`);
  const out = new ArrayBuffer(pos), view = new Uint8Array(out);
  let offset = 0;
  for (const part of parts) { view.set(part, offset); offset += part.length; }
  return new Blob([out], { type: "application/pdf" });
}
