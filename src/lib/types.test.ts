import { describe, expect, it } from "vitest";
import { createEffect, processPixels } from "./effects";
import { documentPixels, newDocument, toPixels } from "./types";

if (!(globalThis as {ImageData?:unknown}).ImageData) (globalThis as {ImageData:unknown}).ImageData=class { data:Uint8ClampedArray;width:number;height:number;constructor(data:Uint8ClampedArray,width:number,height:number){this.data=data;this.width=width;this.height=height} };

describe("print dimensions", () => {
  it("converts physical units", () => { expect(toPixels(25.4,"mm",300)).toBe(300); expect(toPixels(1,"inch",300)).toBe(300); });
  it("includes four-sided bleed", () => { const size=documentPixels(newDocument().spec); expect(size).toEqual({width:1134,height:709,trimX:35,trimY:35,trimWidth:1063,trimHeight:638}); });
});
describe("effect registry",()=>{it("creates isolated versioned effects",()=>{const a=createEffect("array"),b=createEffect("array");expect(a.version).toBe(1);expect(a.id).not.toBe(b.id);expect(a.params).toEqual({count:3,dx:24,dy:0});});});
describe("color effects",()=>{
  it("leaves white unchanged and fully colors black",()=>{const effect=createEffect("colorize");effect.params.color="#ff0000";const result=processPixels(new ImageData(new Uint8ClampedArray([255,255,255,255,0,0,0,255]),2,1),[effect]);expect([...result.data]).toEqual([255,255,255,255,255,0,0,255]);});
  it("uses strength as a visible mix amount",()=>{const effect=createEffect("colorize");effect.params.color="#ff0000";effect.params.strength=.5;const result=processPixels(new ImageData(new Uint8ClampedArray([0,0,0,255]),1,1),[effect]);expect(result.data[0]).toBe(128);});
});
