// usage: node render.mjs <dump|understand|replan> <light|dark> <outDir> [still t...]
// Renders scenes.html at 3x (1026x810), 60 fps, to <outDir>/onboarding-<scene>-<theme>.{mp4,webm} and -poster.png
import {chromium} from '/Users/prateekvangari/Downloads/untangle/node_modules/playwright/index.mjs';
import {spawn} from 'node:child_process';import path from 'node:path';import {fileURLToPath} from 'node:url';import fs from 'node:fs';
const dir=path.dirname(fileURLToPath(import.meta.url)),[scene,theme,out,mode,...ts]=process.argv.slice(2);
fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({channel:'chrome'}),pg=await b.newPage({viewport:{width:342,height:270},deviceScaleFactor:3});
await pg.goto(`file://${dir}/scenes.html?scene=${scene}&theme=${theme}`);
await pg.evaluate(async()=>{await Promise.all(['SG Heavy','SG Semi','SG Body'].map(f=>document.fonts.load(`40px "${f}"`)));await document.fonts.ready});
const base=`${out}/onboarding-${scene}-${theme}`;
if(mode==='still'){for(const t of ts){await pg.evaluate(t=>seek(t),+t);await pg.screenshot({path:`${out}/still_${scene}_${theme}_${t}.png`})}await b.close();process.exit(0)}
const FPS=60,DUR=await pg.evaluate(()=>window.DUR),POSTER=await pg.evaluate(()=>window.POSTER);
await pg.evaluate(t=>seek(t),POSTER);await pg.screenshot({path:`${base}-poster.png`});
const vf='scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',tags=['-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709'];
const ff=spawn('ffmpeg',['-y','-f','image2pipe','-framerate',String(FPS),'-c:v','png','-i','-','-an',
 '-vf',vf,'-c:v','libx264','-preset','slow','-crf','17',...tags,'-movflags','+faststart',`${base}.mp4`,
 '-vf',vf,'-c:v','libvpx-vp9','-b:v','0','-crf','32','-row-mt','1',...tags,`${base}.webm`],{stdio:['pipe','ignore','inherit']});
const n=Math.round(DUR*FPS);
for(let f=0;f<n;f++){await pg.evaluate(t=>seek(t),f/FPS);const buf=await pg.screenshot({type:'png'});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r))}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.log('done',scene,theme);
