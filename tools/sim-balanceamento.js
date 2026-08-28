#!/usr/bin/env node
/**
 * SIMULADOR DE BALANCEAMENTO (doc 02 §4.6)
 *
 * O motor de batalha é JS puro e determinístico, então dá para rodar dezenas de
 * milhares de batalhas simuladas e ver exatamente quem está OP — antes e depois
 * de cada ajuste. Nenhum jogo indie balanceia melhor do que isso.
 *
 *   node tools/sim-balanceamento.js                # 60 batalhas por espécie
 *   node tools/sim-balanceamento.js --n 200        # mais amostras (mais lento)
 *   node tools/sim-balanceamento.js --nivel 50
 *   node tools/sim-balanceamento.js --ginasios     # winrate de times aleatórios vs cada líder
 */
const { createSandbox } = require('./game-sandbox');
const g = createSandbox();

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf('--'+name);
  return i>=0 && args[i+1] ? Number(args[i+1]) : def;
};
const N = getArg('n', 60);
const LEVEL = getArg('nivel', 45);
const GYM_MODE = args.includes('--ginasios');

const ALL = Object.keys(g.SPECIES);
const BST = id => g.SPECIES[id].hp + g.SPECIES[id].attack + g.SPECIES[id].defense + g.SPECIES[id].speed;

function duel(aId, bId, seed){
  const rng = g.makeSeededRng(seed);
  const a = [g.createInstance(aId, LEVEL)];
  const b = [g.createInstance(bId, LEVEL)];
  a[0].dmgBonus = 1; b[0].dmgBonus = 1;
  return g.simulateGymBattle(a, b, rng).win;
}

function speciesWinrates(){
  const rows = ALL.map(id=>{
    let wins = 0, total = 0;
    for(let i=0;i<N;i++){
      const foe = ALL[Math.floor((i*2654435761 % ALL.length))] || ALL[i % ALL.length];
      if(foe === id) continue;
      total++;
      if(duel(id, foe, `${id}-${foe}-${i}`)) wins++;
    }
    return { id, name:g.SPECIES[id].name, bst:BST(id), speed:g.SPECIES[id].speed, wr: total ? wins/total : 0 };
  });
  rows.sort((a,b)=>b.wr-a.wr);
  return rows;
}

function fmtPct(x){ return (x*100).toFixed(1).padStart(5) + '%'; }

if(!GYM_MODE){
  console.log(`\n=== WINRATE POR ESPÉCIE — nível ${LEVEL}, ${N} duelos cada ===\n`);
  const rows = speciesWinrates();
  const line = r => `  ${fmtPct(r.wr)}  ${r.name.padEnd(14)} BST ${String(r.bst).padStart(3)}  SPD ${String(r.speed).padStart(3)}`;
  console.log('  ── TOP 15 (candidatos a OP) ──');
  rows.slice(0,15).forEach(r=>console.log(line(r)));
  console.log('\n  ── BOTTOM 15 (candidatos a inúteis) ──');
  rows.slice(-15).forEach(r=>console.log(line(r)));

  // o quanto o resultado ainda é explicado só por "somar os maiores números"
  const n = rows.length;
  const mean = a => a.reduce((x,y)=>x+y,0)/a.length;
  const corr = (xs, ys) => {
    const mx = mean(xs), my = mean(ys);
    const num = xs.reduce((acc,x,i)=>acc + (x-mx)*(ys[i]-my), 0);
    const den = Math.sqrt(xs.reduce((a,x)=>a+(x-mx)**2,0) * ys.reduce((a,y)=>a+(y-my)**2,0));
    return den ? num/den : 0;
  };
  const cBst = corr(rows.map(r=>r.bst), rows.map(r=>r.wr));
  const cSpd = corr(rows.map(r=>r.speed), rows.map(r=>r.wr));
  console.log(`\n  Correlação BST × winrate:   ${cBst.toFixed(3)}   (quanto menor, menos "BST é rei absoluto")`);
  console.log(`  Correlação Speed × winrate: ${cSpd.toFixed(3)}   (Speed passou a valer algo — doc 02 §4.1)`);
  console.log(`  Espécies analisadas: ${n}\n`);
} else {
  console.log(`\n=== WINRATE DE TIMES ALEATÓRIOS CONTRA CADA GINÁSIO (${N} tentativas) ===\n`);
  g.GYMS.forEach((gym, gi)=>{
    const leg = g.LEGS[gi];
    let wins = 0;
    for(let i=0;i<N;i++){
      const rng = g.makeSeededRng(`gym${gi}-${i}`);
      const pool = leg.pool;
      const team = [];
      for(let k=0;k<6;k++){
        const id = pool[Math.floor(rng()*pool.length)];
        team.push(g.createInstance(id, Math.min(55, gym.team[gym.team.length-1].level)));
      }
      g.applyTeamBonuses(team, gi);
      const foes = gym.team.map(b=>g.createInstance(b.species, b.level));
      if(g.simulateGymBattle(team, foes, rng).win) wins++;
    }
    console.log(`  ${fmtPct(wins/N)}  ${String(gi+1)}. ${gym.leaderName.padEnd(10)} (${gym.gymTypeName})`);
  });
  console.log('\n  Referência saudável: entre 45% e 75%. Muito acima = ginásio de enfeite; muito abaixo = parede.\n');
}
