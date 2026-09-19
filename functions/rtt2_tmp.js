const fs=require('fs'),os=require('os'),path=require('path');
const cfg=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.config/configstore/firebase-tools.json'),'utf8'));
const rt=(cfg.tokens&&cfg.tokens.refresh_token)||cfg.refresh_token;
const P='jornada-kanto';
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
const stat=(n,a)=>console.log('  '+n.padEnd(34),'med',med(a).toFixed(0)+'ms  min',Math.min(...a).toFixed(0)+'  max',Math.max(...a).toFixed(0)+'   ['+a.map(x=>x.toFixed(0)).join(',')+']');
(async()=>{
 const body=new URLSearchParams({client_id:'563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',client_secret:'j9iVZfS8kkCEFUPaAeJV0sAi',refresh_token:rt,grant_type:'refresh_token'});
 const j=await (await fetch('https://oauth2.googleapis.com/token',{method:'POST',body})).json();
 const H={Authorization:'Bearer '+j.access_token};
 const B=`https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;
 // sem agent custom: deixa o undici usar HTTP/2 + pool padrao, como o navegador
 const hit=async(u)=>{const a=process.hrtime.bigint();const r=await fetch(u,{headers:H});await r.arrayBuffer();return{ms:Number(process.hrtime.bigint()-a)/1e6,st:r.status,len:0};};
 const runs=async(u,n=11)=>{await hit(u);const o=[];for(let i=0;i<n;i++)o.push((await hit(u)).ms);return o;};

 console.log('LEITURAS (conexao quente, 11 amostras cada)\n');
 // doc grande conhecido (9.5KB segundo o CLAUDE.md)
 stat('schedule_classic (~9.5KB)', await runs(`${B}/leagues/schedule_classic`));
 // doc INEXISTENTE: resposta 404 minima -> RTT quase puro, sem payload
 stat('doc inexistente (404, ~0 payload)', await runs(`${B}/leagues/__nao_existe__`));
 // doc pequeno real
 stat('globalBoss/mew (pequeno)', await runs(`${B}/globalBoss/mew`));
})().catch(e=>console.log('ERRO',e.message));
