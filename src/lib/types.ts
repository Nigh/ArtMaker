export type Unit = "mm" | "inch";
export type BlendMode = "normal" | "multiply" | "screen" | "overlay";
export type Tool = "select" | "brush" | "eraser" | "pattern" | "line" | "rect" | "ellipse" | "fill" | "eyedropper";

export interface Bleed { top: number; right: number; bottom: number; left: number }
export interface DocumentSpec { unit: Unit; dpi: number; width: number; height: number; bleed: Bleed; safeMargin: number }
export interface Transform { x: number; y: number; scaleX: number; scaleY: number; rotation: number }

export type EffectType = "colorize" | "gradientColorize" | "replaceColor" | "gradientReplaceColor" | "halftone" | "array" | "contour" | "stroke" | "shadow" | "blur" | "adjust" | "levels" | "threshold";
export interface LayerEffect { id: string; type: EffectType; version: 2; enabled: boolean; params: Record<string, number | string | boolean> }
export interface SourceAsset { id: string; name: string; mime: string; width: number; height: number; checksum: string; bytes: Blob }

export type MaskSpace = "layer" | "canvas";
export interface LayerMask { space: MaskSpace; enabled: boolean; bitmap?: string; transform?: Transform }
export const identityTransform = (): Transform => ({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });

export interface ArtLayer {
  id: string; name: string; type: "paint" | "image" | "text" | "group"; visible: boolean; locked: boolean;
  opacity: number; blendMode: BlendMode; transform: Transform; effects: LayerEffect[]; assetId?: string;
  linkSourceId?: string; bitmap?: string; text?: string; font?: string; fontSize?: number; color?: string; children?: ArtLayer[];
  mask?: LayerMask;
}

export interface ArtMakerDocument {
  format: "artmaker"; version: 4; id: string; name: string; locale: "zh-CN" | "en";
  createdAt: string; updatedAt: string; spec: DocumentSpec; layers: ArtLayer[]; activeLayerId?: string;
  background: string | null;
}

export const DOCUMENT_VERSION = 4;
export const PIXEL_TOOLS: ReadonlySet<Tool> = new Set(["brush", "eraser", "pattern", "line", "rect", "ellipse", "fill"]);
export function patternStampOrigin(w: number, h: number, p: { x: number; y: number }) {
  return { x: Math.round(p.x - w / 2), y: Math.round(p.y - h / 2) };
}
export const SHAPE_TOOLS: ReadonlySet<Tool> = new Set(["line", "rect", "ellipse"]);
export function pixelBox(x0: number, y0: number, x1: number, y1: number) {
  const x = Math.round(Math.min(x0, x1)), y = Math.round(Math.min(y0, y1));
  return { x, y, w: Math.max(1, Math.round(Math.max(x0, x1)) - x), h: Math.max(1, Math.round(Math.max(y0, y1)) - y) };
}
export function snapLine(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x, dy = to.y - from.y, adx = Math.abs(dx), ady = Math.abs(dy);
  if (!adx && !ady) return to;
  const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1, t = Math.tan(Math.PI / 8);
  if (ady < adx * t) return { x: to.x, y: from.y };
  if (adx < ady * t) return { x: from.x, y: to.y };
  const s = Math.round(Math.max(adx, ady));
  return { x: from.x + sx * s, y: from.y + sy * s };
}
export function snapSquare(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x, dy = to.y - from.y, s = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: from.x + (dx < 0 ? -s : s), y: from.y + (dy < 0 ? -s : s) };
}
export function pixelLine(x0: number, y0: number, x1: number, y1: number) {
  let x = Math.round(x0), y = Math.round(y0); const x1i = Math.round(x1), y1i = Math.round(y1);
  const dx = Math.abs(x1i - x), dy = Math.abs(y1i - y), sx = x < x1i ? 1 : -1, sy = y < y1i ? 1 : -1;
  const pts: { x: number; y: number }[] = [];
  let err = dx - dy;
  for (;;) {
    pts.push({ x, y });
    if (x === x1i && y === y1i) return pts;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

export const uid = () => crypto.randomUUID();
export const defaultSpec = (): DocumentSpec => ({ unit: "mm", dpi: 300, width: 64, height: 89, bleed: { top: 3, right: 3, bottom: 3, left: 3 }, safeMargin: 3 });
export const toPixels = (value: number, unit: Unit, dpi: number) => Math.round(value * dpi / (unit === "mm" ? 25.4 : 1));
export const documentPixels = (spec: DocumentSpec) => ({
  width: toPixels(spec.width + spec.bleed.left + spec.bleed.right, spec.unit, spec.dpi),
  height: toPixels(spec.height + spec.bleed.top + spec.bleed.bottom, spec.unit, spec.dpi),
  trimX: toPixels(spec.bleed.left, spec.unit, spec.dpi), trimY: toPixels(spec.bleed.top, spec.unit, spec.dpi),
  trimWidth: toPixels(spec.width, spec.unit, spec.dpi), trimHeight: toPixels(spec.height, spec.unit, spec.dpi),
});
export const fitImportScale = (iw: number, ih: number, cw: number, ch: number) => iw > cw && ih > ch ? Math.min(cw / iw, ch / ih) : 1;
const parseSvgLen = (value?: string) => { if (!value || /%/.test(value)) return 0; const n = parseFloat(value); return Number.isFinite(n) && n > 0 ? n : 0; };
export function isSvgSource(src: { mime?: string; name?: string; head?: string }) {
  if (src.mime?.toLowerCase().includes("svg")) return true;
  if (src.name && /\.svg$/i.test(src.name)) return true;
  return Boolean(src.head && /<svg[\s>]/i.test(src.head));
}
export function svgIntrinsicSize(svg: string) {
  const root = svg.match(/<svg\b[^>]*>/i)?.[0] ?? "";
  const width = parseSvgLen(root.match(/\bwidth\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean));
  const height = parseSvgLen(root.match(/\bheight\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean));
  const vb = root.match(/\bviewBox\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean)?.trim().split(/[\s,]+/).map(Number);
  const vw = vb && vb.length >= 4 && Number.isFinite(vb[2]) && Number.isFinite(vb[3]) ? Math.abs(vb[2]) : 0;
  const vh = vb && vb.length >= 4 ? Math.abs(vb[3]) : 0;
  if (width && height) return { width, height };
  if (vw && vh) {
    if (width) return { width, height: width * vh / vw };
    if (height) return { width: height * vw / vh, height };
    return { width: vw, height: vh };
  }
  return { width: width || 300, height: height || 150 };
}
export function sizedSvgMarkup(svg: string, width: number, height: number) {
  return svg.replace(/<svg\b[^>]*>/i, tag => tag.replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/<svg/i, `<svg width="${width}" height="${height}"`));
}
export function svgRebakeTransform(tr: Transform, oldW: number, oldH: number, newW: number, newH: number, canvasW: number, canvasH: number): Transform {
  const a = tr.rotation * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
  const oldBx = (canvasW - oldW) / 2, oldBy = (canvasH - oldH) / 2;
  const tlx = oldBx * tr.scaleX * cos - oldBy * tr.scaleY * sin + tr.x, tly = oldBx * tr.scaleX * sin + oldBy * tr.scaleY * cos + tr.y;
  const sx = tr.scaleX < 0 ? -1 : 1, sy = tr.scaleY < 0 ? -1 : 1, newBx = (canvasW - newW) / 2, newBy = (canvasH - newH) / 2, rx = newBx * sx, ry = newBy * sy;
  return { rotation: tr.rotation, scaleX: sx, scaleY: sy, x: tlx - (rx * cos - ry * sin), y: tly - (rx * sin + ry * cos) };
}
export function scaleAround(tr: Transform, ax: number, ay: number, scaleX: number, scaleY: number): Transform {
  const a = tr.rotation * Math.PI / 180, dx = (tr.scaleX - scaleX) * ax, dy = (tr.scaleY - scaleY) * ay;
  return { ...tr, scaleX, scaleY, x: tr.x + dx * Math.cos(a) - dy * Math.sin(a), y: tr.y + dx * Math.sin(a) + dy * Math.cos(a) };
}
export const newLayer = (name = "Paint layer"): ArtLayer => ({ id: uid(), name, type: "paint", visible: true, locked: false, opacity: 1, blendMode: "normal", transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }, effects: [] });
export const newDocument = (locale: "zh-CN" | "en" = "zh-CN"): ArtMakerDocument => { const layer = newLayer(locale === "zh-CN" ? "绘制图层" : "Paint layer"); const now = new Date().toISOString(); return { format: "artmaker", version: DOCUMENT_VERSION, id: uid(), name: "Untitled", locale, createdAt: now, updatedAt: now, spec: defaultSpec(), layers: [layer], activeLayerId: layer.id, background: "#ffffff" }; };

export function contentOwnerId(layers: ArtLayer[], layer: ArtLayer): string {
  const seen = new Set<string>();
  let current = layer;
  while (current.linkSourceId && !seen.has(current.id)) {
    seen.add(current.id);
    const next = layers.find(item => item.id === current.linkSourceId);
    if (!next) return layer.id;
    current = next;
  }
  return current.linkSourceId && seen.has(current.id) ? layer.id : current.id;
}

export const linkDependents = (layers: ArtLayer[], sourceId: string) => layers.filter(layer => layer.linkSourceId === sourceId);
export const linkableSources = (layers: ArtLayer[], fromId: string) => layers.filter(layer => layer.id !== fromId && !layer.linkSourceId);

export function flattenLayerLinks(layers: ArtLayer[]) {
  for (const layer of layers) {
    if (!layer.linkSourceId) continue;
    const ownerId = contentOwnerId(layers, layer);
    if (ownerId === layer.id) delete layer.linkSourceId;
    else layer.linkSourceId = ownerId;
    if (layer.children) flattenLayerLinks(layer.children);
  }
}
