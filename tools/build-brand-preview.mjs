/** Render the OfferMe brand sheet and transparent PNG lockups from editable SVGs. */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const canvas=createCanvas(1600,1080),c=canvas.getContext('2d');
const [mark,logo,light]=await Promise.all(['mark','lockup','lockup-light'].map(n=>loadImage(readFileSync(`brand/${n}.svg`))));
const text=(str,x,y,size,color='#123E37',weight=400)=>{c.fillStyle=color;c.font=`${weight} ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;c.fillText(str,x,y)};
c.fillStyle='#F4F6F0';c.fillRect(0,0,1600,1080);
text('OfferMe',72,80,26,'#123E37',600);text('VISUAL IDENTITY / 01',1230,76,15,'#6B7D71',500);
c.strokeStyle='#D6DED1';c.beginPath();c.moveTo(72,112);c.lineTo(1528,112);c.stroke();
c.drawImage(logo,72,185,970,315);
text('Every conversation, one step closer.',409,462,24,'#65796C',400);
c.drawImage(mark,1185,217,300,300);
text('APP ICON',1279,551,13,'#65796C',500);
c.fillStyle='#123E37';c.beginPath();c.roundRect(72,612,925,337,32);c.fill();
c.drawImage(light,119,659,690,224);
text('DARK SURFACES',124,915,13,'#9CB8A6',500);
const swatches=[['#123E37','FOREST'],['#D6F9DD','MINT'],['#B7F59C','GROWTH']];
swatches.forEach(([color,label],i)=>{const x=1041+i*169;c.fillStyle=color;c.beginPath();c.roundRect(x,612,149,164,22);c.fill();text(label,x,807,12,'#65796C',500);text(color,x,832,16,'#123E37',500)});
text('O + conversation + a step forward',1041,898,17,'#123E37',500);
text('Designed for clarity at every size.',1041,926,16,'#65796C');
text('OfferMe / Interview preparation',72,1022,17,'#65796C');text('EDITABLE SVG  /  APP  /  TRAY',1213,1022,13,'#65796C',500);
mkdirSync('brand/exports',{recursive:true});
writeFileSync('brand/exports/offerme-identity.png',canvas.toBuffer('image/png'));
for (const [name,img,w,h] of [['offerme-logo',logo,1380,448],['offerme-logo-light',light,1380,448],['offerme-icon',mark,1024,1024]]) {const out=createCanvas(w,h);out.getContext('2d').drawImage(img,0,0,w,h);writeFileSync(`brand/exports/${name}.png`,out.toBuffer('image/png'))}
