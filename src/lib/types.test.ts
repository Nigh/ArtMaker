import { describe, expect, it } from "vitest";
import { createEffect } from "./effects";
import { documentPixels, newDocument, toPixels } from "./types";

describe("print dimensions", () => {
  it("converts physical units", () => { expect(toPixels(25.4,"mm",300)).toBe(300); expect(toPixels(1,"inch",300)).toBe(300); });
  it("includes four-sided bleed", () => { const size=documentPixels(newDocument().spec); expect(size).toEqual({width:1134,height:709,trimX:35,trimY:35,trimWidth:1063,trimHeight:638}); });
});
describe("effect registry",()=>{it("creates isolated versioned effects",()=>{const a=createEffect("array"),b=createEffect("array");expect(a.version).toBe(1);expect(a.id).not.toBe(b.id);expect(a.params).toEqual({count:3,dx:24,dy:0});});});
