export type Unit = "mm" | "inch";
export type BlendMode = "normal" | "multiply" | "screen" | "overlay";
export type Tool = "select" | "brush" | "eraser" | "line" | "rect" | "ellipse" | "fill" | "eyedropper";

export interface Bleed { top: number; right: number; bottom: number; left: number }
export interface DocumentSpec { unit: Unit; dpi: number; width: number; height: number; bleed: Bleed; safeMargin: number }
export interface Transform { x: number; y: number; scaleX: number; scaleY: number; rotation: number }

export type EffectType = "colorize" | "gradient" | "halftone" | "array" | "contour" | "stroke" | "shadow" | "blur" | "adjust" | "levels" | "threshold";
export interface LayerEffect { id: string; type: EffectType; version: 1; enabled: boolean; params: Record<string, number | string | boolean> }
export interface SourceAsset { id: string; name: string; mime: string; width: number; height: number; checksum: string; bytes: Blob }

export interface ArtLayer {
  id: string; name: string; type: "paint" | "image" | "text" | "group"; visible: boolean; locked: boolean;
  opacity: number; blendMode: BlendMode; transform: Transform; effects: LayerEffect[]; assetId?: string;
  bitmap?: string; text?: string; font?: string; fontSize?: number; color?: string; children?: ArtLayer[];
}

export interface ArtMakerDocument {
  format: "artmaker"; version: 1; id: string; name: string; locale: "zh-CN" | "en";
  createdAt: string; updatedAt: string; spec: DocumentSpec; layers: ArtLayer[]; activeLayerId?: string;
  background: string | null;
}

export const uid = () => crypto.randomUUID();
export const defaultSpec = (): DocumentSpec => ({ unit: "mm", dpi: 300, width: 90, height: 54, bleed: { top: 3, right: 3, bottom: 3, left: 3 }, safeMargin: 3 });
export const toPixels = (value: number, unit: Unit, dpi: number) => Math.round(value * dpi / (unit === "mm" ? 25.4 : 1));
export const documentPixels = (spec: DocumentSpec) => ({
  width: toPixels(spec.width + spec.bleed.left + spec.bleed.right, spec.unit, spec.dpi),
  height: toPixels(spec.height + spec.bleed.top + spec.bleed.bottom, spec.unit, spec.dpi),
  trimX: toPixels(spec.bleed.left, spec.unit, spec.dpi), trimY: toPixels(spec.bleed.top, spec.unit, spec.dpi),
  trimWidth: toPixels(spec.width, spec.unit, spec.dpi), trimHeight: toPixels(spec.height, spec.unit, spec.dpi),
});
export const newLayer = (name = "Paint layer"): ArtLayer => ({ id: uid(), name, type: "paint", visible: true, locked: false, opacity: 1, blendMode: "normal", transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }, effects: [] });
export const newDocument = (locale: "zh-CN" | "en" = "zh-CN"): ArtMakerDocument => { const layer = newLayer(locale === "zh-CN" ? "绘制图层" : "Paint layer"); const now = new Date().toISOString(); return { format: "artmaker", version: 1, id: uid(), name: "Untitled", locale, createdAt: now, updatedAt: now, spec: defaultSpec(), layers: [layer], activeLayerId: layer.id, background: "#ffffff" }; };
