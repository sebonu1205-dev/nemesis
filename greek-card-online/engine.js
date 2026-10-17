/*ENGINE*/
const CARDS=[
 {id:'joker',n:'サテュロス',p:'A',num:1,eff:'相手の数値が7以上なら勝つ',wt:'得点+2、使用済みを1枚戻す'},
 {id:'hunter',n:'アルテミス',p:'A',num:4,eff:'相手の数値が10なら勝つ',wt:'得点が2倍'},
 {id:'shield',n:'アイギス',p:'A',num:5,eff:'数値差4以内の相手に負けるなら引き分けにする',wt:'次の自分の数値+1'},
 {id:'seal',n:'パンドラ',p:'A',num:8,eff:'相手の勝敗の書き換え効果(条件勝ち・アイギス・テミス・ゼウスの防御)を無効にする',wt:'なし'},
 {id:'general',n:'アキレウス',p:'A',num:9,eff:'第3〜第5ラウンドに出すと数値+2',wt:'なし'},
 {id:'awaken',n:'プロメテウス',p:'B',num:1,eff:'前のラウンドで負けていたなら数値が10になる',wt:'得点+2、使用済みを1枚戻す'},
 {id:'chase',n:'アタランテ',p:'B',num:3,eff:'相手の数値が自分より大きいとき数値+2',wt:'得点+1、次の自分の数値+1'},
 {id:'veteran',n:'オデュッセウス',p:'B',num:4,eff:'使用済みカード1枚につき数値+1(最大+3)',wt:'得点が2倍'},
 {id:'weaken',n:'メドゥーサ',p:'B',num:5,eff:'相手の数値-2',wt:'次の相手の数値-1'},
 {id:'wall',n:'ヘパイストス',p:'B',num:10,eff:'数値の増減を受けない。自分の数値+1',wt:'なし'},
 {id:'comeback',n:'モイライ',p:'C',num:1,eff:'相手に1点以上負けているとき必ず勝つ',wt:'得点+1(合計2点)、使用済みを1枚戻す'},
 {id:'ambush',n:'トロイの木馬',p:'C',num:3,eff:'相手の数値が7以上の奇数(7・9・11)なら勝つ',wt:'得点+1、次の自分の数値+1'},
 {id:'offset',n:'テミス',p:'C',num:4,eff:'数値差2以内の相手に負けるなら引き分けにする',wt:'得点が2倍'},
 {id:'check',n:'スフィンクス',p:'C',num:9,eff:'自分の数値+1。相手の数値を増やす効果を無効にする',wt:'なし'},
 {id:'champ',n:'ゼウス',p:'C',num:10,eff:'モイライを除く、条件による勝ちを受けない',wt:'なし'}
];
const WT={joker:{add:2,ret:1},hunter:{dbl:1},shield:{own:1},awaken:{add:2,ret:1},chase:{add:1,own:1},veteran:{dbl:1},
  weaken:{opp:1},comeback:{add:1,ret:1},ambush:{add:1,own:1},offset:{dbl:1}};
const sumDeck=d=>d.reduce((a,i)=>a+CARDS[i].num,0);
const lowCnt=d=>d.filter(i=>CARDS[i].num<=3).length;
const legal=d=>d.length===5&&new Set(d).size===5&&sumDeck(d)>=22&&sumDeck(d)<=25&&lowCnt(d)<=2;
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const rand=a=>a[Math.floor(Math.random()*a.length)];
function randomLegal(){for(;;){const d=shuffle([...Array(15).keys()]).slice(0,5).sort((x,y)=>x-y);if(legal(d))return d}}
function swapOptions(deck){const o=[];deck.forEach((c,pos)=>{for(let k=0;k<15;k++){if(CARDS[k].p!==CARDS[c].p||deck.includes(k))continue;
  const nd=deck.slice();nd[pos]=k;if(legal(nd))o.push({pos,card:k})}});return o}
function mkState(decks){return{round:1,p:decks.map(d=>({deck:d.slice(),hand:d.slice(),used:[],own:0,dec:0,prev:-1,score:0}))}}
function cloneState(S){return{round:S.round,p:S.p.map(q=>({deck:q.deck,hand:q.hand.slice(),used:q.used.slice(),own:q.own,dec:q.dec,prev:q.prev,score:q.score}))}}
function resolve(S,c,L){
  const P=S.p,r=S.round,cd=[CARDS[c[0]],CARDS[c[1]]],id=[cd[0].id,cd[1].id];
  const note=t=>{if(L)L.notes.push(t)};
  const nm=p=>L?L.names[p]:'';
  const vd=[id[1]==='seal',id[0]==='seal'];
  const uc=[P[0].used.length,P[1].used.length];
  const iv=[id[1]==='check',id[0]==='check'];
  const n=[0,0],pre=[0,0];
  for(let p=0;p<2;p++){
    let v=cd[p].num;const act=!iv[p];
    if(act&&id[p]==='awaken'&&P[p].prev===0){v=10;note(`プロメテウス: 前のラウンドで負けていたので、数値が10になる`)}
    v+=P[p].own;if(P[p].own>0)note(`${nm(p)}: 前のラウンドの勝利時の効果で数値+${P[p].own}`);
    if(act){
      if(id[p]==='veteran'){const a=Math.min(uc[p],3);v+=a;note(`オデュッセウス: 使用済み${uc[p]}枚で数値+${a}`)}
      if(id[p]==='check'){v+=1;note('スフィンクス: 数値+1')}
      if(id[p]==='general'&&r>=3){v+=2;note('アキレウス: 第3ラウンド以降なので数値+2')}
    }else if(['awaken','veteran','general','check','chase'].includes(id[p])&&!(id[p]==='awaken'&&P[p].prev!==0))note(`スフィンクス: ${cd[p].n}の数値を増やす効果が無効`);
    pre[p]=v;n[p]=v;
  }
  for(let p=0;p<2;p++)if(!iv[p]&&id[p]==='chase'&&pre[1-p]>pre[p]){n[p]+=2;note('アタランテ: 相手の数値が大きいので数値+2')}
  for(let p=0;p<2;p++){
    let d=P[p].dec;
    if(id[p]==='wall'){n[p]+=1;note('ヘパイストス: 数値を減らす効果を受けず、数値+1')}
    else{
      if(d>0)note(`${nm(p)}: 前のラウンドの勝利時の効果で数値-${d}`);
      if(id[1-p]==='weaken'){d+=2;note(`メドゥーサ: ${nm(p)}の数値-2`)}
      n[p]=Math.max(0,n[p]-d);
    }
  }
  const carryOwn=[P[0].own,P[1].own];P[0].own=P[1].own=0;P[0].dec=P[1].dec=0;
  const force=[false,false];
  for(let p=0;p<2;p++){
    const q=1-p;
    if(!['joker','hunter','ambush','comeback'].includes(id[p]))continue;
    if(vd[p]){note(`パンドラ: ${cd[p].n}の効果が無効`);continue}
    if(id[q]==='champ'&&!vd[q]&&id[p]!=='comeback'){note(`ゼウス: ${cd[p].n}の勝ちを受けない`);continue}
    let f=false;
    if(id[p]==='joker')f=n[q]>=7;
    if(id[p]==='hunter')f=n[q]===10;
    if(id[p]==='ambush')f=n[q]>=7&&n[q]%2===1;
    if(id[p]==='comeback')f=P[p].score+1<=P[q].score;
    force[p]=f;if(f)note(`${cd[p].n}: 条件を満たし、勝ちが確定`);
  }
  let w;
  if(force[0]&&force[1]){w=-1;note('両方の勝ちが確定したので、引き分け')}
  else if(force[0])w=0;else if(force[1])w=1;
  else if(n[0]===n[1])w=-1;
  else{
    w=n[0]>n[1]?0:1;const l=1-w,diff=Math.abs(n[0]-n[1]);
    if(id[l]==='shield'||id[l]==='offset'){
      if(vd[l])note(`パンドラ: ${cd[l].n}の効果が無効`);
      else if((id[l]==='shield'&&diff<=4)||(id[l]==='offset'&&diff<=2)){w=-1;note(`${cd[l].n}: 数値差${diff}なので、負けが引き分けになる`)}
      else note(`${cd[l].n}: 数値差${diff}で条件を満たさず、働かない`);
    }
  }
  const usedprev=[P[0].used.slice(),P[1].used.slice()];
  for(let p=0;p<2;p++){P[p].hand.splice(P[p].hand.indexOf(c[p]),1);P[p].used.push(c[p])}
  let sc=0;
  if(w>=0){
    const l=1-w,cw=cd[w],t=WT[cw.id];sc=1;
    if(cw.num<=5&&t){
      if(t.dbl){sc=2;note(`${cw.n}の勝利時の効果: 得点が2倍`)}
      else if(t.add){sc=1+t.add;note(`${cw.n}の勝利時の効果: 得点+${t.add}`)}
      if(t.own){P[w].own+=t.own;note(`${cw.n}の勝利時の効果: 次のラウンド、${nm(w)}の数値+${t.own}`)}
      if(t.opp){P[l].dec+=t.opp;note(`${cw.n}の勝利時の効果: 次のラウンド、${nm(l)}の数値-${t.opp}`)}
      if(t.ret){
        let best=-1;
        for(const k of usedprev[w])if(best<0||CARDS[k].num>CARDS[best].num||(CARDS[k].num===CARDS[best].num&&P[w].deck.indexOf(k)<P[w].deck.indexOf(best)))best=k;
        if(best>=0){P[w].used.splice(P[w].used.indexOf(best),1);P[w].hand.push(best);note(`${cw.n}の勝利時の効果: 使用済みの${CARDS[best].n}が手札に戻る`)}
        else note(`${cw.n}の勝利時の効果: 戻せる使用済みカードがない`);
      }
    }
    sc=Math.min(sc,3);P[w].score+=sc;
  }
  P[0].prev=w===0?1:(w===1?0:2);P[1].prev=w===1?1:(w===0?0:2);
  if(L){L.n=n;L.w=w;L.sc=sc;L.pre=pre}
  return w;
}
function finalWinner(S){
  const a=S.p[0].score,b=S.p[1].score;
  if(a!==b)return{w:a>b?0:1,why:'合計得点'};
  const s0=sumDeck(S.p[0].deck),s1=sumDeck(S.p[1].deck);
  if(s0!==s1)return{w:s0<s1?0:1,why:`同点のため、数値の合計が小さい方(${Math.min(s0,s1)} 対 ${Math.max(s0,s1)})`};
  return{w:-1,why:'得点も数値の合計も同じ'};
}
/*ENDENGINE*/
if(typeof module!=='undefined')module.exports={CARDS,legal,swapOptions,mkState,resolve,finalWinner,sumDeck};
