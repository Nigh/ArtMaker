export type Unit = "mm" | "inch";
export type BlendMode = "normal" | "multiply" | "screen" | "overlay";
export type Tool = "select" | "brush" | "eraser" | "line" | "rect" | "ellipse" | "fill" | "eyedropper";

export interface Bleed { top: number; right: number; bottom: number; left: number }
export interface DocumentSpec { unit: Unit; dpi: number; width: number; height: number; bleed: Bleed; safeMargin: number }
export interface Transform { x: number; y: number; scaleX: number; scaleY: number; rotation: number }

export type EffectType = "colorize" | "gradientColorize" | "replaceColor" | "gradientReplaceColor" | "halftone" | "array" | "contour" | "stroke" | "shadow" | "blur" | "adjust" | "levels" | "threshold";
export interface LayerEffect { id: string; type: EffectType; version: 2; enabled: boolean; params: Record<string, number | string | boolean> }
export interface SourceAsset { id: string; name: string; mime: string; width: number; height: number; checksum: string; bytes: Blob }

export type MaskSpace = "layer" | "canvas";
export interface LayerMask { space: MaskSpace; enabled: boolean; bitmap?: string }

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
export const PIXEL_TOOLS: ReadonlySet<Tool> = new Set(["brush", "eraser", "line", "rect", "ellipse", "fill"]);
export const SHAPE_TOOLS: ReadonlySet<Tool> = new Set(["line", "rect", "ellipse"]);
export function pixelBox(x0: number, y0: number, x1: number, y1: number) {
  const x = Math.round(Math.min(x0, x1)), y = Math.round(Math.min(y0, y1));
  return { x, y, w: Math.max(1, Math.round(Math.max(x0, x1)) - x), h: Math.max(1, Math.round(Math.max(y0, y1)) - y) };
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
