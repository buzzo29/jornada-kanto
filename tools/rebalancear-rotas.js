/* REBALANCEIA OS POOLS DAS 32 ROTAS -- por TROCA, nao por corte.
   Cortar sozinho trava: o piso do pool impede tirar, e o teto da linha impede repor. A troca
   resolve os dois de uma vez -- sai quem esta super-representado, entra quem esta faltando, na
   MESMA vaga, e o tamanho do pool nao se mexe.

     A (dura) toda LINHA evolutiva <= 4 entradas (uma entrada = uma forma numa rota).
     B (dura) toda especie continua ALCANCAVEL (rota ou evolucao). E o mesmo fecho do
              tools/test-jornada.js: ele segue o EVOLUTIONS e NAO o EVOLUTION_CHOICES, entao
              Bellossom, Politoed, Slowking, Hitmonlee e Hitmonchan precisam continuar em rota.
     C (dura) o pool de cada rota nao encolhe abaixo do piso (12 nas dez pedidas, 8 nas outras).
     D (dura) toda entrada NOVA tem afinidade de tipo com a rota e cabe no nivel da etapa.
     E (mole) ninguem em 1 rota so.
     F (dura) lendarios e raros nao sao tocados.
   Uso: node rebalancear.js [--detalhe] [--aplicar] */
const path = require('path'), fs = require('fs');
const RAIZ = 'C:/Users/Usuario/Documents/jornada-kanto';
const S = require(path.join(RAIZ, 'tools', 'game-sandbox')).createSandbox();

const LIMITE = 4, TETO = 20;
const GRANDES = ['ilex_forest','rock_tunnel','whirl_islands','fighting_dojo','olivine_lighthouse',
                 'mt_mortar','lake_of_rage','power_plant','ice_path','dragons_den'];
const PISO = id => 9;   // o teto de 4 por linha nao convive com o piso de 12; ver o relatorio
const FORA = ['mewtwo','celebi','lugia','hooh'];

const rotas = [];
[['kanto',S.ROUTE_MAP],['johto',S.JOHTO_ROUTE_MAP]].forEach(([reg,m])=>m.forEach((par,i)=>par.forEach(r=>
  rotas.push({ id:r.id, nome:r.name, tipos:r.types||[], reg, etapa:i+1, leg:S.LEGS[i],
               pool:r.pool.slice(), rare:(r.rare||[]).map(e=>typeof e==='object'?e.species:e),
               niveis:r.niveis||null }))));
const nome = id => S.SPECIES[id].name;
const bst = id => { const s=S.SPECIES[id]; return s.hp+s.attack+s.defense+s.spAtk+s.spDef+s.speed; };

function formasDe(id, r){
  const pr = r.niveis && r.niveis[id];
  let a, b;
  if(pr){ a=pr[0]; b=pr[1]; }
  else if(S.ehLendario(id)){ a=b=S.nivelDeLendario(r.leg); }
  else {
    const piso = (S.SEM_PISO_DE_NIVEL||[]).includes(id) ? null : S.EVOLVED_MIN_LEVEL[id];
    if(!piso || piso <= r.leg.minLevel){ a=r.leg.minLevel; b=r.leg.maxLevel; }
    else { const sp=r.leg.maxLevel-r.leg.minLevel;
           const t=S.EVOLUTIONS[id]?S.EVOLUTIONS[id].level-1:Infinity;
           a=piso; b=Math.max(piso, Math.min(piso+sp,t)); }
  }
  const out=new Set(); for(let n=a;n<=b;n++) out.add(S.especieNoNivel(id,n));
  return [...out];
}
function levantar(){
  const forma={}, linha={};
  rotas.forEach(r=>{
    const v=new Set();
    r.pool.concat(r.rare).forEach(id=>formasDe(id,r).forEach(f=>v.add(f)));
    v.forEach(f=>{ forma[f]=(forma[f]||0)+1; linha[S.raizDaLinha(f)]=(linha[S.raizDaLinha(f)]||0)+1; });
  });
  return { forma, linha };
}
function alcancaveis(){
  const alc=new Set();
  rotas.forEach(r=>r.pool.concat(r.rare).forEach(id=>formasDe(id,r).forEach(f=>alc.add(f))));
  S.STARTERS.forEach(id=>alc.add(id));   // os iniciais nao vem de rota (o teste semeia igual)
  for(let mudou=true; mudou;){ mudou=false;
    for(const de in S.EVOLUTIONS){ const p=S.EVOLUTIONS[de].into;
      if(alc.has(de)&&!alc.has(p)){ alc.add(p); mudou=true; } } }
  if(alc.has('eevee')) ['vaporeon','jolteon','flareon','espeon','umbreon'].forEach(x=>alc.add(x));
  return alc;
}
const orfaos = () => Object.keys(S.SPECIES).filter(id=>!alcancaveis().has(id)&&!FORA.includes(id));
const afim = (id,r) => (S.SPECIES[id].types||[]).some(t=>r.tipos.includes(t));
const mediana = {};
for(let e=1;e<=8;e++){ const v=[];
  rotas.filter(r=>r.etapa===e).forEach(r=>r.pool.forEach(id=>formasDe(id,r).forEach(f=>v.push(bst(f)))));
  v.sort((a,b)=>a-b); mediana[e]=v[Math.floor(v.length/2)]||400; }
const cabe = (f,r) => Math.abs(bst(f)-mediana[r.etapa]) <= 140;
const temLinha = (r,f) => r.pool.concat(r.rare).some(x=>S.raizDaLinha(x)===S.raizDaLinha(f));

/* SO PODE ENTRAR QUEM JA ERA SELVAGEM. Sem esta trava o rebalanceador comecou a por INICIAIS em
   rota -- Totodile, Charizard, Feraligatr --, que nunca foram capturaveis: o inicial e escolha do
   jogador, e a unica porta selvagem pra essa linha e o encontro de 15% da etapa 5. Fixar a lista
   no estado ANTERIOR tambem garante que nenhuma especie nova entre no jogo por acidente. */
const ELEGIVEIS = (() => { const s = new Set();
  rotas.forEach(r => r.pool.concat(r.rare).forEach(id => formasDe(id, r).forEach(f => s.add(f))));
  return s; })();
const trocas = [], cortes = [], adicoes = [];
/* Quem pode ENTRAR nesta rota: afinidade, nivel, linha com orcamento, sem repetir linha.
   Prioriza quem esta com MENOS entradas -- assim a troca conserta os dois lados de uma vez. */
function candidatos(r, est){
  return Object.keys(S.SPECIES)
    .filter(f=>ELEGIVEIS.has(f)&&!S.ehLendario(f)&&!FORA.includes(f))
    .filter(f=>(est.linha[S.raizDaLinha(f)]||0) < LIMITE)
    .filter(f=>!temLinha(r,f))
    .filter(f=>afim(f,r)&&formasDe(f,r).includes(f)&&cabe(f,r))
    .sort((a,b)=>((est.forma[a]||0)-(est.forma[b]||0)) || (bst(a)-bst(b)));
}
function trocar(){
  for(let volta=0; volta<800; volta++){
    const est = levantar();
    const acima = Object.entries(est.linha).filter(([,n])=>n>LIMITE).sort((a,b)=>b[1]-a[1]);
    if(!acima.length) return true;
    let fez = false;
    for(const [raiz] of acima){
      const cands = [];
      rotas.forEach(r=>r.pool.forEach(id=>{
        if(S.raizDaLinha(id)!==raiz || r.rare.includes(id)) return;
        cands.push({ r, id, score:(afim(id,r)?0:100)+(r.pool.length-PISO(r.id)) });
      }));
      cands.sort((a,b)=>b.score-a.score);
      for(const c of cands){
        const antes = c.r.pool.slice();
        c.r.pool = c.r.pool.filter(x=>x!==c.id);
        /* SO REMOVE. A versao por troca oscilava: ela tirava um Zubat, punha um Remoraid, e na
           volta seguinte tirava o Remoraid pra por outro -- 1.584 trocas sem convergir. Remocao
           pura e monotona: cada volta diminui uma entrada e o laco termina. */
        if(antes.length-1 >= PISO(c.r.id) && !orfaos().length){
          cortes.push({ rota:c.r.nome, id:c.id }); fez = true; break;
        }
        c.r.pool = antes;
      }
      if(fez) break;
    }
    if(!fez) return false;
  }
  return false;
}
/* Depois das trocas, quem ficou em 1 rota tenta a segunda. */
function espalhar(){
  for(let volta=0; volta<400; volta++){
    const est = levantar();
    const alvos = Object.entries(est.forma)
      .filter(([f,n])=>n===1 && !S.ehLendario(f) && (est.linha[S.raizDaLinha(f)]||0) < LIMITE)
      .map(([f])=>f);
    if(!alvos.length) return;
    let fez = false;
    for(const f of alvos){
      const rs = rotas.filter(r=>r.pool.length<TETO && !temLinha(r,f) && afim(f,r) &&
                                 formasDe(f,r).includes(f) && cabe(f,r));
      if(!rs.length) continue;
      rs.sort((a,b)=>a.pool.length-b.pool.length);
      rs[0].pool.push(f); adicoes.push({ rota:rs[0].nome, id:f });
      fez = true; break;
    }
    if(!fez) return;
  }
}

trocar(); espalhar(); trocar(); espalhar();

const fim = levantar();
const acima = Object.entries(fim.linha).filter(([,n])=>n>LIMITE);
const sozinhas = Object.entries(fim.forma).filter(([f,n])=>n<2 && !S.ehLendario(f));
const ruins = rotas.filter(r=>r.pool.length<PISO(r.id)||r.pool.length>TETO);
console.log('TROCAS ' + trocas.length + '   CORTES ' + cortes.length + '   ADICOES ' + adicoes.length);
console.log('linhas acima de ' + LIMITE + ': ' + acima.length + (acima.length?' -> '+acima.map(([r,n])=>nome(r)+':'+n).join(', '):''));
console.log('especies em 1 rota so: ' + sozinhas.length + ' (eram 87)');
console.log('pools fora da faixa: ' + ruins.length + (ruins.length?' -> '+ruins.map(r=>r.nome+':'+r.pool.length).join(', '):''));
console.log('orfas: ' + orfaos().length);
const tam = rotas.map(r=>r.pool.length).sort((a,b)=>a-b);
console.log('pool: menor '+tam[0]+', maior '+tam[tam.length-1]+', media '+(tam.reduce((a,b)=>a+b,0)/tam.length).toFixed(1));
console.log('especies em rota: ' + Object.keys(fim.forma).length);
if(sozinhas.length) console.log('\nem 1 rota so: ' + sozinhas.map(([f])=>nome(f)).join(', '));

if(process.argv.includes('--detalhe')){
  console.log('\nTROCAS:'); trocas.forEach(t=>console.log('  ' + t.rota.padEnd(22) + nome(t.saiu).padEnd(12) + ' -> ' + nome(t.entrou)));
  if(cortes.length){ console.log('\nCORTES SECOS:'); cortes.forEach(c=>console.log('  ' + c.rota.padEnd(22) + nome(c.id))); }
  if(adicoes.length){ console.log('\nADICOES:'); adicoes.forEach(a=>console.log('  ' + a.rota.padEnd(22) + '+ ' + nome(a.id))); }
}
if(process.argv.includes('--aplicar')){
  let t = fs.readFileSync(path.join(RAIZ,'index.html'),'utf8');
  rotas.forEach(r=>{
    const re = new RegExp("(id:'"+r.id+"'[\\s\\S]{0,800}?pool:)\\[[^\\]]*\\]");
    if(!re.test(t)) throw new Error('nao achei o pool de '+r.id);
    t = t.replace(re,(m,p1)=>p1+'['+r.pool.map(x=>"'"+x+"'").join(',')+']');
  });
  fs.writeFileSync(path.join(RAIZ,'index.html'), t);
  console.log('\nAPLICADO nas 32 rotas.');
}
