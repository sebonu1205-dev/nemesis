const WebSocket=require('ws');
const mk=()=>new Promise(r=>{const w=new WebSocket('ws://localhost:8124');w.q=[];w.on('message',d=>{const m=JSON.parse(d);w.q.push(m);w.emit('m',m)});w.on('open',()=>r(w))});
const nx=(w,t)=>new Promise(r=>{const f=m=>{if(!t||m.t===t){w.off('m',f);r(m)}};const i=w.q.findIndex(m=>!t||m.t===t);if(i>=0){r(w.q.splice(i,1)[0])}else w.on('m',f)});
(async()=>{
 const a=await mk();a.send(JSON.stringify({t:'create',name:'A'}));const c=await nx(a,'created');
 const x=await mk();x.send(JSON.stringify({t:'join',code:'ZZZZ'}));console.log('bad',(await nx(x,'error')).msg);
 const b=await mk();b.send(JSON.stringify({t:'join',code:c.code,name:'B'}));await nx(b,'joined');await nx(a,'build');await nx(b,'build');
 const y=await mk();y.send(JSON.stringify({t:'join',code:c.code}));console.log('full',(await nx(y,'error')).msg);
 a.send(JSON.stringify({t:'deck',deck:[0,1,2,3,4]}));console.log('illegal',(await nx(a,'error')).msg);
 a.send(JSON.stringify({t:'deck',deck:[0,2,4,6,7]}));b.send(JSON.stringify({t:'deck',deck:[1,5,8,11,13]}));
 const ra=await nx(a,'reveal');await nx(b,'reveal');console.log('reveal opp',ra.orig[1]);
 a.send(JSON.stringify({t:'swap',pos:0,card:14}));console.log('badswap',(await nx(a,'error')).msg);
 a.send(JSON.stringify({t:'swap',pos:null}));b.send(JSON.stringify({t:'swap',pos:null}));
 const ta=await nx(a,'turn');await nx(b,'turn');console.log('turn',ta.view.me.hand,ta.view.opp.handN);
 a.send(JSON.stringify({t:'pick',card:9}));console.log('notinhand',(await nx(a,'error')).msg);
 a.send(JSON.stringify({t:'pick',card:0}));
 // A drops, resumes
 a.close();const o=await nx(b,'opp');console.log('opp off',o.on);
 const a2=await mk();a2.send(JSON.stringify({t:'resume',code:c.code,token:c.token}));const s=await nx(a2,'sync');console.log('sync',s.phase,s.picked);
 console.log('opp on',(await nx(b,'opp')).on);
 b.send(JSON.stringify({t:'pick',card:1}));const r=await nx(a2,'result');console.log('result w',r.L.w,r.L.cards,'oppHand',r.view.opp.handN);
 // disconnect and timeout
 b.close();await nx(a2,'opp');const cl=await nx(a2,'closed');console.log('closed',cl.why);process.exit(0)
})().catch(e=>{console.error(e);process.exit(1)});
