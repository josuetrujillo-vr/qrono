// Iconos geométricos propios: canvas del navegador, sin recursos externos.
import { chromium } from '@playwright/test';
import { mkdirSync,writeFileSync } from 'node:fs';
mkdirSync('public/icons',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage();for(const [name,size,maskable] of [['icon-192',192,false],['icon-512',512,false],['maskable-512',512,true]]){
 const png=await page.evaluate(({size,maskable})=>{const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');ctx.fillStyle='#17324D';ctx.fillRect(0,0,size,size);ctx.translate(size/2,size/2);const radius=size*(maskable?.24:.31);ctx.strokeStyle='#FFFFFF';ctx.lineWidth=size*.045;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();ctx.lineCap='round';ctx.strokeStyle='#A5C8FF';ctx.beginPath();ctx.moveTo(0,-radius*.62);ctx.lineTo(0,0);ctx.lineTo(radius*.5,radius*.3);ctx.stroke();return c.toDataURL('image/png').split(',')[1]},{size,maskable});
 writeFileSync(`public/icons/${name}.png`,Buffer.from(png,'base64'));}console.log('Iconos 192/512/maskable generados.')}finally{await browser.close()}
