const E=require('./engine.js');const C=E.CARDS;
const sh=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const decks=[];for(let a=0;a<15;a++)for(let b=a+1;b<15;b++)for(let c=b+1;c<15;c++)for(let d=c+1;d<15;d++)for(let e=d+1;e<15;e++){const k=[a,b,c,d,e];if(E.legal(k))decks.push(k)}
console.log('legal decks',decks.length);
const inc=Array(15).fill(0),incW=Array(15).fill(0),pl=Array(15).fill(0),plW=Array(15).fill(0),plPts=Array(15).fill(0);
const N=200000;let ties=0,p0=0;
for(let g=0;g<N;g++){
 const d0=decks[Math.floor(Math.random()*decks.length)],d1=decks[Math.floor(Math.random()*decks.length)];
 const S=E.mkState([d0,d1]);
 for(let r=1;r<=5;r++){
  const c=[S.p[0].hand[Math.floor(Math.random()*S.p[0].hand.length)],S.p[1].hand[Math.floor(Math.random()*S.p[1].hand.length)]];
  const L={notes:[],names:['a','b']};const w=E.resolve(S,c,L);S.round++;
  for(let p=0;p<2;p++){pl[c[p]]++;if(w===p){plW[c[p]]++;plPts[c[p]]+=L.sc}}
 }
 const f=E.finalWinner(S);if(f.w===-1)ties++;
 d0.forEach(k=>{inc[k]++;if(f.w===0)incW[k]++;else if(f.w===-1)incW[k]+=.5});
 d1.forEach(k=>{inc[k]++;if(f.w===1)incW[k]++;else if(f.w===-1)incW[k]+=.5});
 if(f.w===0)p0++;
}
console.log('tie',(ties/N*100).toFixed(1)+'%','p0 win',(p0/N*100).toFixed(1));
C.forEach((c,k)=>console.log(c.n.padEnd(8),String(c.num).padStart(2),c.p,'デッキ勝率',(incW[k]/inc[k]*100).toFixed(1),'ラウンド勝率',(plW[k]/pl[k]*100).toFixed(1),'平均得点',(plPts[k]/pl[k]).toFixed(2)));
