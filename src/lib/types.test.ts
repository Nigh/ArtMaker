import { describe, expect, it } from "vitest";
import { createEffect, processPixels } from "./effects";
import { migrateDocument } from "./project";
import { documentPixels, newDocument, toPixels } from "./types";

if (!(globalThis as {ImageData?:unknown}).ImageData) (globalThis as {ImageData:unknown}).ImageData=class { data:Uint8ClampedArray;width:number;height:number;constructor(data:Uint8ClampedArray,width:number,height:number){this.data=data;this.width=width;this.height=height} };

describe("print dimensions", () => {
  it("converts physical units", () => { expect(toPixels(25.4,"mm",300)).toBe(300); expect(toPixels(1,"inch",300)).toBe(300); });
  it("includes four-sided bleed", () => { const size=documentPixels(newDocument().spec); expect(size).toEqual({width:1134,height:709,trimX:35,trimY:35,trimWidth:1063,trimHeight:638}); });
});
describe("effect registry",()=>{it("creates isolated versioned effects",()=>{const a=createEffect("array"),b=createEffect("array");expect(a.version).toBe(2);expect(a.id).not.toBe(b.id);expect(a.params).toEqual({count:3,dx:24,dy:0});});});
describe("color effects",()=>{
  it("uses target hue/saturation and source luminance",()=>{const effect=createEffect("colorize");effect.params.color="#ff0000";const result=processPixels(new ImageData(new Uint8ClampedArray([255,255,255,255,128,128,128,255,0,0,0,255]),3,1),[effect]);expect([...result.data]).toEqual([255,255,255,255,255,1,1,255,0,0,0,255]);});
  it("honors target saturation",()=>{const effect=createEffect("colorize");effect.params.color="#808080";const result=processPixels(new ImageData(new Uint8ClampedArray([40,180,90,255]),1,1),[effect]);expect(result.data[0]).toBe(result.data[1]);expect(result.data[1]).toBe(result.data[2]);});
  it("adjusts source lightness before colorization",()=>{const dark=createEffect("colorize"),light=createEffect("colorize");dark.params={color:"#ff0000",strength:1,lightness:-100};light.params={color:"#ff0000",strength:1,lightness:100};const input=()=>new ImageData(new Uint8ClampedArray([128,128,128,255]),1,1);expect([...processPixels(input(),[dark]).data]).toEqual([0,0,0,255]);expect([...processPixels(input(),[light]).data]).toEqual([255,255,255,255]);});
  it("keeps the legacy replacement algorithm",()=>{const effect=createEffect("replaceColor");effect.params.color="#ff0000";const result=processPixels(new ImageData(new Uint8ClampedArray([0,0,0,255]),1,1),[effect]);expect([...result.data]).toEqual([255,0,0,255]);});
});
describe("halftone mask",()=>{it("creates exact 2x2 blocks separated by one pixel",()=>{const effect=createEffect("halftone");effect.params={dot:2,spacingX:1,spacingY:1,stagger:false};const bytes=new Uint8ClampedArray(6*6*4).fill(77);for(let i=3;i<bytes.length;i+=4)bytes[i]=255;const result=processPixels(new ImageData(bytes,6,6),[effect]);const alpha=[];for(let y=0;y<6;y++)alpha.push([...Array(6)].map((_,x)=>result.data[(y*6+x)*4+3]));expect(alpha).toEqual([[255,255,0,255,255,0],[255,255,0,255,255,0],[0,0,0,0,0,0],[255,255,0,255,255,0],[255,255,0,255,255,0],[0,0,0,0,0,0]]);expect([...result.data.slice(0,3)]).toEqual([77,77,77]);});});
describe("project migration",()=>{it("maps v1 color effects and removes legacy halftone parameters",()=>{const old=newDocument() as unknown as {version:number;layers:Array<{effects:Array<Record<string,unknown>>}>};old.version=1;old.layers[0].effects=[{id:"a",type:"colorize",version:1,enabled:true,params:{color:"#fff",strength:1}},{id:"b",type:"halftone",version:1,enabled:true,params:{dot:2,spacingX:1,spacingY:1,stagger:false,angle:20,offsetX:3}}];const migrated=migrateDocument(old);expect(migrated.version).toBe(2);expect(migrated.layers[0].effects[0].type).toBe("replaceColor");expect(migrated.layers[0].effects[1].params).toEqual({dot:2,spacingX:1,spacingY:1,stagger:false});});});
