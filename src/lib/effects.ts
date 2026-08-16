import type { EffectType, LayerEffect } from "./types";
import { uid } from "./types";

export interface EffectDefinition { type: EffectType; label: { "zh-CN": string; en: string }; defaults: Record<string, number | string | boolean> }
export const effectRegistry: EffectDefinition[] = [
  { type: "colorize", label: { "zh-CN": "着色", en: "Colorize" }, defaults: { color: "#ff8fa3", strength: 1 } },
  { type: "gradient", label: { "zh-CN": "渐变着色", en: "Gradient colorize" }, defaults: { from: "#ff8fa3", to: "#8fcfff", direction: "horizontal", strength: 1 } },
  { type: "halftone", label: { "zh-CN": "网点 Mask", en: "Halftone mask" }, defaults: { dot: 4, spacingX: 4, spacingY: 4, stagger: true, angle: 0, offsetX: 0, offsetY: 0 } },
  { type: "array", label: { "zh-CN": "Array 阵列", en: "Array" }, defaults: { count: 3, dx: 24, dy: 0 } },
  { type: "contour", label: { "zh-CN": "等高线", en: "Contour" }, defaults: { levels: 6, width: 2, offset: 0, invert: false } },
  { type: "stroke", label: { "zh-CN": "描边", en: "Stroke" }, defaults: { size: 3, color: "#ffffff" } },
  { type: "shadow", label: { "zh-CN": "投影", en: "Drop shadow" }, defaults: { x: 8, y: 8, blur: 10, color: "#000000", opacity: .45 } },
  { type: "blur", label: { "zh-CN": "高斯模糊", en: "Gaussian blur" }, defaults: { radius: 4 } },
  { type: "adjust", label: { "zh-CN": "亮度 / 对比度", en: "Brightness / Contrast" }, defaults: { brightness: 0, contrast: 0 } },
  { type: "levels", label: { "zh-CN": "色阶", en: "Levels" }, defaults: { black: 0, white: 255, gamma: 1 } },
  { type: "threshold", label: { "zh-CN": "阈值", en: "Threshold" }, defaults: { value: 128 } },
];
export const createEffect = (type: EffectType): LayerEffect => { const def = effectRegistry.find((item) => item.type === type)!; return { id: uid(), type, version: 1, enabled: true, params: { ...def.defaults } }; };

const hex = (value: string) => { const v = value.replace("#", ""); const n = parseInt(v.length === 3 ? v.split("").map(x => x + x).join("") : v, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export function processPixels(source: ImageData, effects: LayerEffect[]): ImageData {
  let out = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
  for (const effect of effects.filter(e => e.enabled)) {
    const d = out.data, p = effect.params;
    if (effect.type === "colorize") { const c = hex(String(p.color)), strength=Math.max(0,Math.min(1,Number(p.strength))); for (let i=0;i<d.length;i+=4) { const l=(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722)/255, mix=(1-l)*strength; d[i]+= (c[0]-d[i])*mix; d[i+1]+=(c[1]-d[i+1])*mix; d[i+2]+=(c[2]-d[i+2])*mix; } }
    if (effect.type === "gradient") { const a=hex(String(p.from)), b=hex(String(p.to)), strength=Math.max(0,Math.min(1,Number(p.strength??1)));let minX=out.width,minY=out.height,maxX=0,maxY=0;for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++)if(d[(y*out.width+x)*4+3]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}const w=Math.max(1,maxX-minX),h=Math.max(1,maxY-minY),direction=String(p.direction??"horizontal");for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const i=(y*out.width+x)*4;if(!d[i+3])continue;const nx=(x-minX)/w,ny=(y-minY)/h,t=direction==="vertical"?ny:direction==="diagonal-down"?(nx+ny)/2:direction==="diagonal-up"?(nx+1-ny)/2:nx,target=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],l=(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722)/255,mix=(1-l)*strength;d[i]+=(target[0]-d[i])*mix;d[i+1]+=(target[1]-d[i+1])*mix;d[i+2]+=(target[2]-d[i+2])*mix;} }
    if (effect.type === "adjust") { const br=Number(p.brightness), co=Number(p.contrast); const f=(259*(co+255))/(255*(259-co)); for(let i=0;i<d.length;i+=4) for(let k=0;k<3;k++) d[i+k]=f*(d[i+k]-128)+128+br; }
    if (effect.type === "levels") { const lo=Number(p.black), hi=Math.max(lo+1,Number(p.white)), g=1/Number(p.gamma); for(let i=0;i<d.length;i+=4) for(let k=0;k<3;k++) d[i+k]=255*Math.pow(Math.max(0,Math.min(1,(d[i+k]-lo)/(hi-lo))),g); }
    if (effect.type === "threshold") { const t=Number(p.value); for(let i=0;i<d.length;i+=4) { const v=d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722>=t?255:0; d[i]=d[i+1]=d[i+2]=v; } }
    if (effect.type === "halftone") { const dot=Math.max(1,Math.round(Number(p.dot))), gapX=Math.max(1,Math.round(Number(p.spacingX))),gapY=Math.max(1,Math.round(Number(p.spacingY))),pitchX=dot+gapX,pitchY=dot+gapY,angle=Number(p.angle)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){const i=(y*out.width+x)*4,rx=x*cos-y*sin+Number(p.offsetX),ry=x*sin+y*cos+Number(p.offsetY),row=Math.floor(ry/pitchY),stagger=Boolean(p.stagger)&&Math.abs(row%2)===1?pitchX/2:0,dx=((rx+stagger)%pitchX+pitchX)%pitchX-pitchX/2,dy=((ry%pitchY+pitchY)%pitchY)-pitchY/2,darkness=1-(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722)/255;if(Math.hypot(dx,dy)>dot*.5*darkness)d[i+3]=0;} }
    if (effect.type === "contour") { const levels=Math.max(2,Number(p.levels)), width=Math.max(1,Number(p.width)); for(let i=0;i<d.length;i+=4){ const l=(d[i]+d[i+1]+d[i+2])/3, band=(l/255*levels)%1, on=band<width/Math.max(out.width,out.height)*levels*4; d[i+3]=on?d[i+3]:0; } }
  }
  return out;
}
