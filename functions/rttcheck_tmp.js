const fs=require('fs'),os=require('os'),path=require('path'),https=require('https');
const cfg=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.config/configstore/firebase-tools.json'),'utf8'));
const rt=(cfg.tokens&&cfg.tokens.refresh_token)||cfg.refresh_token;
const P='jornada-kanto';
const agent=new https.Agent({keepAlive:true,maxSockets:1});
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
(async()=>{
 const body=new URLSearchParams({client_id:'563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',client_secret:'j9iVZfS8kkCEFUPaAeJV0sAi',refresh_token:rt,grant_type:'refresh_token'});
 const j=await (await fetch('https://oauth2.googleapis.com/token',{method:'POST',body})).json();
 const H={Authorization:'Bearer '+j.access_token};
 const B=`https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;
 const hit=async(url,h)=>{const a=process.hrtime.bigint();const r=await fetch(url,{headers:h,agent});await r.arrayBuffer();return{ms:Number(process.hrtime.bigint()-a)/1e6,ok:r.ok,st:r.status};};

 // 1) BASELINE: endpoint Google servido na BORDA (nao toca banco) -> mede so ate o GFE
 await hit('https://www.google.com/generate_204',{});
 const edge=[];for(let i=0;i<9;i++)edge.push((await hit('https://www.google.com/generate_204',{})).ms);

 // 2) LEITURA REAL de documento (tem que alcancar nam5)
 const doc=`${B}/leagues/schedule_classic`;
 const w=await hit(doc,H); // aquece TLS+HTTP2 para firestore.googleapis.com
 const fs_=[];for(let i=0;i<9;i++)fs_.push((await hit(doc,H)).ms);

 console.log('warm-up leitura: HTTP',w.st,'ok='+w.ok);
 console.log('\n[A] BORDA Google (generate_204, nao toca banco)');
 console.log('    amostras:',edge.map(x=>x.toFixed(0)).join(', '));
 console.log('    MEDIANA:',med(edge).toFixed(0),'ms   min:',Math.min(...edge).toFixed(0));
 console.log('\n[B] LEITURA Firestore nam5 (doc real, conexao quente)');
 console.log('    amostras:',fs_.map(x=>x.toFixed(0)).join(', '));
 console.log('    MEDIANA:',med(fs_).toFixed(0),'ms   min:',Math.min(...fs_).toFixed(0));
 console.log('\n    => custo do trecho Brasil->nam5 (B - A):',(med(fs_)-med(edge)).toFixed(0),'ms');
})().catch(e=>console.log('ERRO',e.message));
