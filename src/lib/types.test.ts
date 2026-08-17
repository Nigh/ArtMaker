import { describe, expect, it } from "vitest";
import { createEffect, processPixels, applyMaskLuminance, rebakeMaskData } from "./effects";
import { migrateDocument, prepareExportDocument } from "./project";
import { documentPixels, fitImportScale, newDocument, newLayer, patternStampOrigin, pixelBox, pixelLine, snapLine, snapSquare, scaleAround, toPixels, contentOwnerId, flattenLayerLinks, linkDependents, linkableSources, isSvgSource, svgIntrinsicSize, sizedSvgMarkup, svgRebakeTransform } from "./types";

if (!(globalThis as {ImageData?:unknown}).ImageData) (globalThis as {ImageData:unknown}).ImageData=class { data:Uint8ClampedArray;width:number;height:number;constructor(data:Uint8ClampedArray,width:number,height:number){this.data=data;this.width=width;this.height=height} };

describe("print dimensions", () => {
  it("converts physical units", () => { expect(toPixels(25.4,"mm",300)).toBe(300); expect(toPixels(1,"inch",300)).toBe(300); });
  it("includes four-sided bleed", () => { const size=documentPixels(newDocument().spec); expect(size).toEqual({width:827,height:1122,trimX:35,trimY:35,trimWidth:756,trimHeight:1051}); });
});
describe("import fit", () => {
  it("keeps 1:1 unless both sides overflow", () => {
    expect(fitImportScale(100,100,800,800)).toBe(1);
    expect(fitImportScale(2000,500,800,800)).toBe(1);
    expect(fitImportScale(2000,2000,800,800)).toBe(0.4);
    expect(fitImportScale(1600,2000,800,800)).toBe(0.4);
  });
});
describe("svg source", () => {
  it("reads explicit pixel size", () => {
    expect(svgIntrinsicSize(`<svg width="24px" height="16" viewBox="0 0 24 16"></svg>`)).toEqual({width:24,height:16});
  });
  it("falls back to viewBox", () => {
    expect(svgIntrinsicSize(`<svg viewBox="0 0 100 50"></svg>`)).toEqual({width:100,height:50});
  });
  it("derives the missing side from viewBox", () => {
    expect(svgIntrinsicSize(`<svg width="200" viewBox="0 0 100 50"></svg>`)).toEqual({width:200,height:100});
  });
  it("defaults to 300x150", () => {
    expect(svgIntrinsicSize(`<svg></svg>`)).toEqual({width:300,height:150});
  });
  it("sniffs mime, name, and markup", () => {
    expect(isSvgSource({mime:"image/svg+xml"})).toBe(true);
    expect(isSvgSource({name:"icon.SVG"})).toBe(true);
    expect(isSvgSource({head:"<?xml version='1.0'?><svg xmlns='http://www.w3.org/2000/svg'>"})).toBe(true);
    expect(isSvgSource({mime:"image/png",name:"a.png",head:"\x89PNG"})).toBe(false);
  });
  it("sets root width and height for rasterization", () => {
    expect(sizedSvgMarkup(`<svg viewBox="0 0 10 10" width="10">`,20,30)).toBe(`<svg width="20" height="30" viewBox="0 0 10 10">`);
  });
  it("bakes scale into a centered blit and keeps the document origin", () => {
    expect(svgRebakeTransform({x:0,y:0,scaleX:2,scaleY:2,rotation:0},40,20,80,40,100,100)).toEqual({x:50,y:50,scaleX:1,scaleY:1,rotation:0});
  });
});
describe("pixel box", () => {
  it("rounds to a hard integer rectangle", () => {
    expect(pixelBox(0.4, 0.6, 10.4, 4.4)).toEqual({x:0,y:1,w:10,h:3});
    expect(pixelBox(5, 5, 5, 5)).toEqual({x:5,y:5,w:1,h:1});
  });
});
describe("pattern stamp", () => {
  it("places the cursor at the pattern center", () => {
    expect(patternStampOrigin(10, 10, {x:10, y:10})).toEqual({x:5, y:5});
    expect(patternStampOrigin(3, 4, {x:10, y:10})).toEqual({x:9, y:8});
    expect(patternStampOrigin(1, 1, {x:5, y:5})).toEqual({x:5, y:5});
  });
});
describe("shape snap", () => {
  const o={x:0,y:0};
  it("snaps lines to 90 or 45 degrees", () => {
    expect(snapLine(o,{x:10,y:1})).toEqual({x:10,y:0});
    expect(snapLine(o,{x:1,y:10})).toEqual({x:0,y:10});
    expect(snapLine(o,{x:10,y:9})).toEqual({x:10,y:10});
    expect(snapLine(o,{x:-8,y:2})).toEqual({x:-8,y:0});
  });
  it("snaps rects to a square", () => {
    expect(snapSquare(o,{x:10,y:4})).toEqual({x:10,y:10});
    expect(snapSquare(o,{x:-3,y:8})).toEqual({x:-8,y:8});
  });
  it("walks a Bresenham pixel line", () => {
    expect(pixelLine(0,0,3,0)).toEqual([{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:3,y:0}]);
    expect(pixelLine(0,0,2,2)).toEqual([{x:0,y:0},{x:1,y:1},{x:2,y:2}]);
  });
});
describe("scale around anchor", () => {
  const tr={x:0,y:0,scaleX:1,scaleY:1,rotation:0};
  it("keeps the layer-space anchor fixed when scaling uniformly", () => {
    expect(scaleAround(tr,10,20,2,2)).toEqual({x:-10,y:-20,scaleX:2,scaleY:2,rotation:0});
  });
  it("scales one axis without moving the other", () => {
    expect(scaleAround(tr,10,20,2,1)).toEqual({x:-10,y:0,scaleX:2,scaleY:1,rotation:0});
  });
});
describe("effect registry",()=>{it("creates isolated versioned effects",()=>{const a=createEffect("array"),b=createEffect("array");expect(a.version).toBe(2);expect(a.id).not.toBe(b.id);expect(a.params).toEqual({count:3,dx:24,dy:0});});});
describe("color effects",()=>{
  it("uses target hue/saturation and source luminance",()=>{const effect=createEffect("colorize");effect.params.color="#ff0000";const result=processPixels(new ImageData(new Uint8ClampedArray([255,255,255,255,128,128,128,255,0,0,0,255]),3,1),[effect]);expect([...result.data]).toEqual([255,255,255,255,255,1,1,255,0,0,0,255]);});
  it("honors target saturation",()=>{const effect=createEffect("colorize");effect.params.color="#808080";const result=processPixels(new ImageData(new Uint8ClampedArray([40,180,90,255]),1,1),[effect]);expect(result.data[0]).toBe(result.data[1]);expect(result.data[1]).toBe(result.data[2]);});
  it("adjusts source lightness before colorization",()=>{const dark=createEffect("colorize"),light=createEffect("colorize");dark.params={color:"#ff0000",strength:1,lightness:-100};light.params={color:"#ff0000",strength:1,lightness:100};const input=()=>new ImageData(new Uint8ClampedArray([128,128,128,255]),1,1);expect([...processPixels(input(),[dark]).data]).toEqual([0,0,0,255]);expect([...processPixels(input(),[light]).data]).toEqual([255,255,255,255]);});
  it("keeps the legacy replacement algorithm",()=>{const effect=createEffect("replaceColor");effect.params.color="#ff0000";const result=processPixels(new ImageData(new Uint8ClampedArray([0,0,0,255]),1,1),[effect]);expect([...result.data]).toEqual([255,0,0,255]);});
});
describe("halftone mask",()=>{it("creates exact 2x2 blocks separated by one pixel",()=>{const effect=createEffect("halftone");effect.params={dot:2,spacingX:1,spacingY:1,stagger:false};const bytes=new Uint8ClampedArray(6*6*4).fill(77);for(let i=3;i<bytes.length;i+=4)bytes[i]=255;const result=processPixels(new ImageData(bytes,6,6),[effect]);const alpha=[];for(let y=0;y<6;y++)alpha.push([...Array(6)].map((_,x)=>result.data[(y*6+x)*4+3]));expect(alpha).toEqual([[255,255,0,255,255,0],[255,255,0,255,255,0],[0,0,0,0,0,0],[255,255,0,255,255,0],[255,255,0,255,255,0],[0,0,0,0,0,0]]);expect([...result.data.slice(0,3)]).toEqual([77,77,77]);});});
describe("contour",()=>{
  const alphaAt=(data:Uint8ClampedArray,w:number,x:number,y:number)=>data[(y*w+x)*4+3];
  it("leaves a blank transparent layer empty",()=>{const effect=createEffect("contour");const result=processPixels(new ImageData(new Uint8ClampedArray(8*8*4),8,8),[effect]);expect(result.data.every(v=>v===0)).toBe(true);});
  it("draws anti-aliased rings from transparent paint",()=>{
    const w=32,bytes=new Uint8ClampedArray(w*w*4);
    for(let y=12;y<20;y++)for(let x=12;x<20;x++){const i=(y*w+x)*4;bytes[i]=255;bytes[i+3]=255;}
    const effect=createEffect("contour");effect.params={levels:4,width:2,offset:0,invert:false};
    const result=processPixels(new ImageData(bytes,w,w),[effect]),alphas=[...Array(w*w)].map((_,i)=>result.data[i*4+3]);
    expect(alphas.some(a=>a===0)).toBe(true);
    expect(alphas.some(a=>a>0&&a<255)).toBe(true);
    let outside=0,solid=0;
    for(let y=0;y<w;y++)for(let x=0;x<w;x++){const a=alphaAt(result.data,w,x,y);if(x>=12&&x<20&&y>=12&&y<20){if(a>200)solid++}else if(a>0)outside++}
    expect(outside).toBeGreaterThan(20);
    expect(solid).toBeLessThan(48);
    const hit=alphas.findIndex(a=>a>200);expect(result.data[hit*4]).toBeGreaterThan(200);expect(result.data[hit*4+1]).toBeLessThan(20);
  });
});
describe("project migration",()=>{
  it("maps v1 color effects and removes legacy halftone parameters",()=>{const old=newDocument() as unknown as {version:number;layers:Array<{effects:Array<Record<string,unknown>>}>};old.version=1;old.layers[0].effects=[{id:"a",type:"colorize",version:1,enabled:true,params:{color:"#fff",strength:1}},{id:"b",type:"halftone",version:1,enabled:true,params:{dot:2,spacingX:1,spacingY:1,stagger:false,angle:20,offsetX:3}}];const migrated=migrateDocument(old);expect(migrated.version).toBe(4);expect(migrated.layers[0].effects[0].type).toBe("replaceColor");expect(migrated.layers[0].effects[1].params).toEqual({dot:2,spacingX:1,spacingY:1,linkSpacing:true,stagger:false});});
  it("keeps unequal halftone spacing unlinked",()=>{const old=newDocument() as unknown as {version:number;layers:Array<{effects:Array<Record<string,unknown>>}>};old.version=2;old.layers[0].effects=[{id:"h",type:"halftone",version:2,enabled:true,params:{dot:2,spacingX:1,spacingY:4,stagger:false}}];expect(migrateDocument(old).layers[0].effects[0].params.linkSpacing).toBe(false);});
  it("promotes v2 documents and flattens dangling links",()=>{const old=newDocument();(old as {version:number}).version=2;const ghost=newLayer("ghost");ghost.linkSourceId="missing";const chain=newLayer("chain");chain.linkSourceId=old.layers[0].id;old.layers.push(ghost,chain);const migrated=migrateDocument(old);expect(migrated.version).toBe(4);expect(migrated.layers[1].linkSourceId).toBeUndefined();expect(migrated.layers[2].linkSourceId).toBe(old.layers[0].id);});
  it("rejects newer project versions",()=>{const old=newDocument() as {version:number};old.version=5;expect(()=>migrateDocument(old)).toThrow(/Unsupported/);});
  it("omits instance bitmaps from exported documents",()=>{const document=newDocument();const inst=newLayer("inst");inst.linkSourceId=document.layers[0].id;inst.bitmap="data:image/png;base64,xxx";inst.assetId="asset";document.layers.push(inst);const exported=prepareExportDocument(document);expect(exported.layers[1].linkSourceId).toBe(document.layers[0].id);expect(exported.layers[1].bitmap).toBeUndefined();expect(exported.layers[1].assetId).toBeUndefined();expect(document.layers[1].bitmap).toBe("data:image/png;base64,xxx");});
  it("promotes v3 documents without adding masks",()=>{const old=newDocument();(old as {version:number}).version=3;const migrated=migrateDocument(old);expect(migrated.version).toBe(4);expect(migrated.layers[0].mask).toBeUndefined();});
});
describe("layer masks",()=>{
  const pixel=(w:number,x:number,y:number,r=0,g=0,b=0,a=255)=>{const d=new Uint8ClampedArray(w*w*4);d[(y*w+x)*4]=r;d[(y*w+x)*4+1]=g;d[(y*w+x)*4+2]=b;d[(y*w+x)*4+3]=a;return new ImageData(d,w,w);};
  it("hides by mask luminance: black shows, white covers",()=>{
    const source=new ImageData(new Uint8ClampedArray([10,20,30,200,1,2,3,100,9,9,9,255]),3,1);
    const mask=new ImageData(new Uint8ClampedArray([0,0,0,255,255,255,255,255,128,128,128,255]),3,1);
    const out=applyMaskLuminance(source,mask);
    expect([...out.data.slice(0,4)]).toEqual([10,20,30,200]);
    expect([...out.data.slice(4,8)]).toEqual([1,2,3,0]);
    expect(out.data[11]).toBe(127);
  });
  it("rebakes a translated layer mask into the same canvas pixels",()=>{
    const mask=pixel(4,1,1,255,255,255,255),tr={x:2,y:0,scaleX:1,scaleY:1,rotation:0};
    const canvas=rebakeMaskData(mask,tr,"layer","canvas");
    expect(canvas.data[(1*4+3)*4+3]).toBe(255);
    expect(canvas.data[(1*4+1)*4+3]).toBe(0);
    const back=rebakeMaskData(canvas,tr,"canvas","layer");
    expect(back.data[(1*4+1)*4+3]).toBe(255);
  });
  it("bakes mask transform when switching space",()=>{
    const mask=pixel(4,1,1,255,255,255,255),host={x:1,y:0,scaleX:1,scaleY:1,rotation:0},local={x:1,y:0,scaleX:1,scaleY:1,rotation:0};
    const canvas=rebakeMaskData(mask,host,"layer","canvas",local);
    expect(canvas.data[(1*4+3)*4+3]).toBe(255);
  });
  it("bakes a pending mask transform in the same space",()=>{
    const mask=pixel(4,1,1,255,255,255,255),host={x:0,y:0,scaleX:1,scaleY:1,rotation:0},local={x:2,y:0,scaleX:1,scaleY:1,rotation:0};
    const out=rebakeMaskData(mask,host,"layer","layer",local);
    expect(out.data[(1*4+3)*4+3]).toBe(255);
    expect(out.data[(1*4+1)*4+3]).toBe(0);
  });
});
describe("layer links",()=>{
  it("resolves through a chain to the content owner",()=>{
    const a=newLayer("A"),b=newLayer("B"),c=newLayer("C");a.linkSourceId=b.id;b.linkSourceId=c.id;
    expect(contentOwnerId([a,b,c],a)).toBe(c.id);
    flattenLayerLinks([a,b,c]);
    expect(a.linkSourceId).toBe(c.id);expect(b.linkSourceId).toBe(c.id);
  });
  it("treats a missing or cyclic target as unlinked",()=>{
    const a=newLayer("A"),b=newLayer("B");a.linkSourceId="missing";b.linkSourceId=b.id;
    expect(contentOwnerId([a,b],a)).toBe(a.id);expect(contentOwnerId([a,b],b)).toBe(b.id);
    flattenLayerLinks([a,b]);expect(a.linkSourceId).toBeUndefined();expect(b.linkSourceId).toBeUndefined();
  });
  it("lists dependents and only unlinked layers as link targets",()=>{
    const a=newLayer("A"),b=newLayer("B"),c=newLayer("C");c.linkSourceId=a.id;
    expect(linkDependents([a,b,c],a.id).map(l=>l.id)).toEqual([c.id]);
    expect(linkableSources([a,b,c],c.id).map(l=>l.id)).toEqual([a.id,b.id]);
    expect(linkableSources([a,b,c],a.id).map(l=>l.id)).toEqual([b.id]);
  });
});
