import type { EffectType, LayerEffect, MaskSpace, Transform } from "./types";
import { uid } from "./types";

export interface EffectDefinition { type: EffectType; label: { "zh-CN": string; en: string }; defaults: Record<string, number | string | boolean> }
export interface EffectContext { transform?: Transform }

export const effectRegistry: EffectDefinition[] = [
  { type: "colorize", label: { "zh-CN": "着色", en: "Colorize" }, defaults: { color: "#ff8fa3", strength: 1, lightness: 0 } },
  { type: "gradientColorize", label: { "zh-CN": "渐变着色", en: "Gradient colorize" }, defaults: { from: "#ff8fa3", to: "#8fcfff", direction: "horizontal", strength: 1, lightness: 0 } },
  { type: "replaceColor", label: { "zh-CN": "替换颜色", en: "Replace color" }, defaults: { sourceColor: "#000000", color: "#ff8fa3", tolerance: 100, softness: 0, strength: 1 } },
  { type: "gradientReplaceColor", label: { "zh-CN": "渐变替换颜色", en: "Gradient replace color" }, defaults: { sourceColor: "#000000", from: "#ff8fa3", to: "#8fcfff", direction: "horizontal", tolerance: 100, softness: 0, strength: 1 } },
  { type: "halftone", label: { "zh-CN": "网点 Mask", en: "Halftone mask" }, defaults: { dot: 4, spacingX: 1, spacingY: 1, linkSpacing: true, stagger: false } },
  { type: "array", label: { "zh-CN": "Array 阵列", en: "Array" }, defaults: { count: 3, dx: 24, dy: 0 } },
  { type: "contour", label: { "zh-CN": "等高线", en: "Contour" }, defaults: { levels: 6, width: 2, offset: 0, invert: false } },
  { type: "stroke", label: { "zh-CN": "描边", en: "Stroke" }, defaults: { size: 3, color: "#ffffff" } },
  { type: "shadow", label: { "zh-CN": "投影", en: "Drop shadow" }, defaults: { x: 8, y: 8, blur: 10, color: "#000000", opacity: .45 } },
  { type: "blur", label: { "zh-CN": "高斯模糊", en: "Gaussian blur" }, defaults: { radius: 4 } },
  { type: "adjust", label: { "zh-CN": "亮度 / 对比度", en: "Brightness / Contrast" }, defaults: { brightness: 0, contrast: 0 } },
  { type: "levels", label: { "zh-CN": "色阶", en: "Levels" }, defaults: { black: 0, white: 255, gamma: 1 } },
  { type: "threshold", label: { "zh-CN": "阈值", en: "Threshold" }, defaults: { value: 128 } },
];

export const createEffect = (type: EffectType): LayerEffect => { const def=effectRegistry.find(item=>item.type===type)!;return{id:uid(),type,version:2,enabled:true,params:{...def.defaults}}; };
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const hex=(value:string)=>{const v=value.replace("#","");const n=parseInt(v.length===3?v.split("").map(x=>x+x).join(""):v,16);return[(n>>16)&255,(n>>8)&255,n&255];};
const rgbToHsl=([r,g,b]:number[])=>{r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2,d=max-min;let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));if(max===r)h=60*(((g-b)/d)%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4)}return[(h+360)%360,s,l];};
const hslToRgb=(h:number,s:number,l:number)=>{const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return rgb.map(v=>(v+m)*255);};
export const bounds=(d:Uint8ClampedArray,w:number,h:number)=>{let minX=w,minY=h,maxX=-1,maxY=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}return{minX,minY,maxX,maxY,w:Math.max(1,maxX-minX),h:Math.max(1,maxY-minY)};};
const gradientAt=(p:Record<string,number|string|boolean>,x:number,y:number,b:{minX:number;minY:number;w:number;h:number})=>{const a=rgbToHsl(hex(String(p.from))),z=rgbToHsl(hex(String(p.to))),nx=(x-b.minX)/b.w,ny=(y-b.minY)/b.h,dir=String(p.direction??"horizontal"),t=dir==="vertical"?ny:dir==="diagonal-down"?(nx+ny)/2:dir==="diagonal-up"?(nx+1-ny)/2:nx,delta=((z[0]-a[0]+540)%360)-180;return[(a[0]+delta*t+360)%360,a[1]+(z[1]-a[1])*t];};
const matchWeight=(rgb:number[],target:number[],tolerance:number,softness:number)=>{const distance=Math.hypot(rgb[0]-target[0],rgb[1]-target[1],rgb[2]-target[2])/Math.sqrt(3*255*255)*100,edge=Math.max(0.001,softness);return tolerance>=100?1:1-clamp((distance-tolerance)/edge);};
export const documentPoint=(x:number,y:number,tr?:Transform)=>{if(!tr)return{x,y};const sx=x*tr.scaleX,sy=y*tr.scaleY,a=tr.rotation*Math.PI/180;return{x:sx*Math.cos(a)-sy*Math.sin(a)+tr.x,y:sx*Math.sin(a)+sy*Math.cos(a)+tr.y};};
export const inverseDocumentPoint=(p:{x:number;y:number},tr:Transform)=>{const a=-tr.rotation*Math.PI/180,dx=p.x-tr.x,dy=p.y-tr.y;return{x:(dx*Math.cos(a)-dy*Math.sin(a))/tr.scaleX,y:(dx*Math.sin(a)+dy*Math.cos(a))/tr.scaleY};};
export function applyMaskLuminance(source:ImageData,mask:ImageData):ImageData{
  const out=new ImageData(new Uint8ClampedArray(source.data),source.width,source.height),d=out.data,m=mask.data,n=Math.min(d.length,m.length);
  for(let i=0;i<n;i+=4){const cover=(m[i]*.2126+m[i+1]*.7152+m[i+2]*.0722)/255*(m[i+3]/255);d[i+3]=d[i+3]*(1-cover);}
  return out;
}
export function rebakeMaskData(src:ImageData,tr:Transform,from:MaskSpace,to:MaskSpace):ImageData{
  const out=new ImageData(new Uint8ClampedArray(src.width*src.height*4),src.width,src.height);
  if(from===to){out.data.set(src.data);return out;}
  const s=src.data,d=out.data,w=src.width,h=src.height;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=from==="layer"?inverseDocumentPoint({x,y},tr):documentPoint(x,y,tr),ix=Math.round(p.x),iy=Math.round(p.y);
    if(ix<0||iy<0||ix>=w||iy>=h)continue;
    const si=(iy*w+ix)*4,di=(y*w+x)*4;
    d[di]=s[si];d[di+1]=s[si+1];d[di+2]=s[si+2];d[di+3]=s[si+3];
  }
  return out;
}
const adjustedLightness=(value:number,amount:number)=>{const a=clamp(amount/100,-1,1);return a<0?value*(1+a):value+(1-value)*a;};
const INF=1e20;
function edt1d(grid:Float64Array,offset:number,stride:number,length:number,f:Float64Array,v:Int32Array,z:Float64Array){
  for(let q=0;q<length;q++)f[q]=grid[offset+q*stride];
  v[0]=0;z[0]=-INF;z[1]=INF;let k=0;
  for(let q=1;q<length;q++){let s=0;while(k>=0){const r=v[k];s=(f[q]-f[r]+q*q-r*r)/(2*(q-r));if(s>z[k])break;k--}k++;v[k]=q;z[k]=s;z[k+1]=INF}
  k=0;for(let q=0;q<length;q++){while(z[k+1]<q)k++;const r=v[k];grid[offset+q*stride]=(q-r)*(q-r)+f[r]}
}
function edt2d(grid:Float64Array,w:number,h:number){
  const max=Math.max(w,h),f=new Float64Array(max),v=new Int32Array(max),z=new Float64Array(max+1);
  for(let x=0;x<w;x++)edt1d(grid,x,w,h,f,v,z);
  for(let y=0;y<h;y++)edt1d(grid,y*w,1,w,f,v,z);
}
function isolines(d:Uint8ClampedArray,height:Float64Array,w:number,h:number,spacing:number,width:number,offset:number,ink:number[]|null){
  const hw=Math.max(.25,width/2);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x,xm=height[y*w+Math.max(0,x-1)],xp=height[y*w+Math.min(w-1,x+1)],ym=height[Math.max(0,y-1)*w+x],yp=height[Math.min(h-1,y+1)*w+x];
    const g=Math.hypot(xp-xm,yp-ym)/2,v=height[i]+offset,m=((v%spacing)+spacing)%spacing,pixelDist=Math.min(m,spacing-m)/Math.max(g,1e-6),a=clamp(hw+.5-pixelDist);
    const o=i*4;if(ink){d[o]=ink[0];d[o+1]=ink[1];d[o+2]=ink[2]}d[o+3]=a*255;
  }
}
function contour(d:Uint8ClampedArray,w:number,h:number,p:Record<string,number|string|boolean>){
  const levels=Math.max(2,Number(p.levels)),width=Math.max(.5,Number(p.width)),offset=Number(p.offset)||0,invert=Boolean(p.invert),n=w*h;
  let opaque=0,ink=[0,0,0];
  for(let i=0;i<n;i++)if(d[i*4+3]){opaque++;ink[0]+=d[i*4];ink[1]+=d[i*4+1];ink[2]+=d[i*4+2]}
  if(!opaque){d.fill(0);return}
  ink=ink.map(v=>Math.round(v/opaque));
  const height=new Float64Array(n);
  if(opaque>n*.98){
    for(let i=0;i<n;i++){const l=(d[i*4]*.2126+d[i*4+1]*.7152+d[i*4+2]*.0722)/255;height[i]=invert?1-l:l}
    isolines(d,height,w,h,1/levels,width,offset/levels,null);
    return;
  }
  const outside=new Float64Array(n),inside=new Float64Array(n);
  for(let i=0;i<n;i++){const painted=invert?d[i*4+3]===0:d[i*4+3]>0;outside[i]=painted?0:INF;inside[i]=painted?INF:0}
  edt2d(outside,w,h);edt2d(inside,w,h);
  for(let i=0;i<n;i++)height[i]=Math.sqrt(outside[i])-Math.sqrt(inside[i]);
  isolines(d,height,w,h,Math.max(width+2,Math.min(w,h)/(levels*3)),width,offset,ink);
}

export function processPixels(source:ImageData,effects:LayerEffect[],context:EffectContext={}):ImageData{
  const out=new ImageData(new Uint8ClampedArray(source.data),source.width,source.height);
  for(const effect of effects.filter(e=>e.enabled)){
    const d=out.data,p=effect.params,b=bounds(d,out.width,out.height),strength=clamp(Number(p.strength??1));
    if(effect.type==="colorize"||effect.type==="gradientColorize")for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){const i=(y*out.width+x)*4;if(!d[i+3])continue;const l=adjustedLightness((d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722)/255,Number(p.lightness??0)),hs=effect.type==="colorize"?rgbToHsl(hex(String(p.color))):gradientAt(p,x,y,b),target=hslToRgb(hs[0],hs[1],l);for(let k=0;k<3;k++)d[i+k]+=(target[k]-d[i+k])*strength;}
    if(effect.type==="replaceColor"||effect.type==="gradientReplaceColor"){const sourceColor=hex(String(p.sourceColor??"#000000"));for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){const i=(y*out.width+x)*4;if(!d[i+3])continue;const rgb=[d[i],d[i+1],d[i+2]],weight=matchWeight(rgb,sourceColor,Number(p.tolerance??100),Number(p.softness??0));if(!weight)continue;const target=effect.type==="replaceColor"?hex(String(p.color)):hslToRgb(...gradientAt(p,x,y,b) as [number,number],.5),l=(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722)/255,mix=(1-l)*strength*weight;for(let k=0;k<3;k++)d[i+k]+=(target[k]-d[i+k])*mix;}}
    if(effect.type==="halftone"){const dot=Math.max(1,Math.round(Number(p.dot))),pitchX=dot+Math.max(1,Math.round(Number(p.spacingX))),pitchY=dot+Math.max(1,Math.round(Number(p.spacingY)));for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){const i=(y*out.width+x)*4,doc=documentPoint(x,y,context.transform),row=Math.floor(doc.y/pitchY),shift=Boolean(p.stagger)&&Math.abs(row%2)===1?Math.floor(pitchX/2):0,mx=((Math.floor(doc.x)-shift)%pitchX+pitchX)%pitchX,my=((Math.floor(doc.y)%pitchY)+pitchY)%pitchY;if(mx>=dot||my>=dot)d[i+3]=0;}}
    if(effect.type==="adjust"){const br=Number(p.brightness),co=Number(p.contrast),f=(259*(co+255))/(255*(259-co));for(let i=0;i<d.length;i+=4)for(let k=0;k<3;k++)d[i+k]=f*(d[i+k]-128)+128+br;}
    if(effect.type==="levels"){const lo=Number(p.black),hi=Math.max(lo+1,Number(p.white)),g=1/Number(p.gamma);for(let i=0;i<d.length;i+=4)for(let k=0;k<3;k++)d[i+k]=255*Math.pow(clamp((d[i+k]-lo)/(hi-lo)),g);}
    if(effect.type==="threshold"){const t=Number(p.value);for(let i=0;i<d.length;i+=4){const v=d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722>=t?255:0;d[i]=d[i+1]=d[i+2]=v;}}
    if(effect.type==="contour")contour(d,out.width,out.height,p);
  }
  return out;
}
