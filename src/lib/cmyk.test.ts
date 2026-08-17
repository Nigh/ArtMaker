import { describe, expect, it } from "vitest";
import { exportCmykPdf, pdfBoxes, rgbToCmyk, rgbaToCmyk } from "./cmyk";
import { defaultSpec, documentPixels } from "./types";

if (!(globalThis as { ImageData?: unknown }).ImageData) (globalThis as { ImageData: unknown }).ImageData = class {
  data: Uint8ClampedArray; width: number; height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) { this.data = data; this.width = width; this.height = height; }
};

describe("CMYK separation", () => {
  it("maps black to pure K and white to no ink", () => {
    expect(rgbToCmyk(0, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(rgbToCmyk(255, 255, 255)).toEqual([0, 0, 0, 0]);
  });
  it("maps neutral gray to K only", () => {
    const [c, m, y, k] = rgbToCmyk(128, 128, 128);
    expect([c, m, y]).toEqual([0, 0, 0]);
    expect(k).toBe(127);
  });
  it("snaps near-black tint to K only", () => {
    const [c, m, y, k] = rgbToCmyk(12, 8, 8);
    expect([c, m, y]).toEqual([0, 0, 0]);
    expect(k).toBeGreaterThan(240);
  });
  it("keeps printable chroma on dark red", () => {
    const [c, m, y, k] = rgbToCmyk(64, 0, 0);
    expect(c).toBe(0);
    expect(m).toBeGreaterThan(40);
    expect(y).toBe(m);
    expect(k).toBeGreaterThan(180);
  });
  it("composites transparent pixels onto white paper", () => {
    expect([...rgbaToCmyk(new Uint8ClampedArray([0, 0, 0, 0]))]).toEqual([0, 0, 0, 0]);
  });
});

describe("CMYK PDF", () => {
  it("writes DeviceCMYK with trim and bleed boxes from the document spec", async () => {
    const spec = defaultSpec(), px = documentPixels(spec), boxes = pdfBoxes(spec);
    const image = new ImageData(new Uint8ClampedArray(px.width * px.height * 4), px.width, px.height);
    const pdf = await (await exportCmykPdf(image, spec)).text();
    expect(pdf).toContain("/DeviceCMYK");
    expect(pdf).toContain("/Interpolate false");
    expect(pdf).toContain(`/TrimBox [${boxes.trim.map(v => String(Math.round(v * 1000) / 1000)).join(" ")}]`);
    expect(pdf).toContain(`/BleedBox [0 0 ${String(Math.round(boxes.mediaW * 1000) / 1000)} ${String(Math.round(boxes.mediaH * 1000) / 1000)}]`);
  });
});
