#!/usr/bin/env node
/**
 * TESTE DE REGRESSÃO DA ECONOMIA (docs 03 e 04)
 *
 * Simula os quatro arquétipos de jogador e confirma que a ordem
 *     Feeder  <  Mediano  <  Habilidoso  <  Mestre
 * se mantém. Se um dia alguém mexer na economia e o feeder voltar a ser
 * o caminho mais lucrativo, este script grita — o buraco reabriu.
 *
 *   node tools/sim-economia.js
 */
const { createSandbox } = require('./game-sandbox');
const g = createSandbox();

const NUM_GYMS = g.GYMS.length;

// monta um resultado de batalha falso só com o que a economia lê
function fakeResult(teamSize, survivors, mvpId){
  const status = [];
  for(let i=0;i<teamSize;i++){
    status.push({
      id:'mon'+i, name:'Mon'+i, speciesId:'ratata', level:20,
      fainted: i >= survivors,
      wins: (mvpId === 'mon'+i) ? 3 : 1
    });
  }
  return { win:true, playerStatus:status };
}

function baseGame(){
  const st = g.freshGameDefaults();
  st.team = Array.from({length:6}, (_,i)=>({ id:'mon'+i, level:20, types:['Normal'], speciesId:'ratata', attack:50 }));
  st.badgesEarned = [];
  st.gymIndex = 0;
  return st;
}

/**
 * Roda uma jornada inteira aplicando a economia real do jogo.
 * profile:
 *   deliberateLosses  quantas derrotas de propósito por ginásio
 *   survivors         quantos pokémons costumam sobrar na vitória
 *   declaresChallenge se declara desafio (e qual)
 *   betsMvp           se aposta no MVP e se acerta
 *   rouletteAvg       ganho médio da roleta por vitória
 */
function runJourney(profile){
  const st = baseGame();
  g.__setGame(st);
  let totalPool = 20;              // a primeira distribuição é sempre 20
  st.totalPointsEarned = 20;
  st.nextLegPoints = 10;

  for(let gym=0; gym<NUM_GYMS; gym++){
    st.gymIndex = gym;
    st.losses = 0;

    // --- derrotas (de propósito ou não) ---
    let advancedThisGym = 0;
    for(let l=0; l<profile.deliberateLosses; l++){
      st.losses++;
      st.winStreak = 0;
      // empréstimo: +5 agora, UMA VEZ POR GINÁSIO, dívida quitada na vitória (doc 03 proposta A).
      // A partir da 2ª derrota no mesmo ginásio o socorro é só informação e fôlego (proposta E).
      const advance = advancedThisGym > 0 ? 0 : g.DEFEAT_ADVANCE;
      advancedThisGym += advance;
      totalPool += advance;
      st.pointsOwed += advance;
      st.totalPointsEarned += advance;
      // doc 03 proposta D: derrota NÃO dá mais nível por desmaio. Antes rendia +6 níveis por derrota.
    }

    // --- a vitória ---
    st.declaredChallenge = profile.challenge || null;
    st.mvpBet = profile.betsMvp ? 'mon0' : null;
    st.scoreBet = !!profile.scoreBet;
    const mvpId = profile.mvpHits ? 'mon0' : 'mon3';
    const rewards = g.computeVictoryRewards(fakeResult(6, profile.survivors, mvpId));

    if(gym < NUM_GYMS-1){ totalPool += rewards.net + (profile.rouletteAvg||0); }
    st.pointsOwed = rewards.owedAfter;
    st.totalPointsEarned += rewards.net;
    st.winStreak = (st.winStreak||0) + 1;
    st.badgesEarned.push('x');
  }
  return { totalPool, owed: st.pointsOwed };
}

const PROFILES = [
  { key:'Feeder',     label:'Perde 4× de propósito em cada ginásio, vence no arrastão',
    deliberateLosses:4, survivors:1, challenge:null, betsMvp:false, mvpHits:false, rouletteAvg:1.05 },
  { key:'Mediano',    label:'Vence tudo, geralmente na 2ª/3ª tentativa, sem apostas',
    deliberateLosses:1, survivors:3, challenge:null, betsMvp:false, mvpHits:false, rouletteAvg:1.05 },
  { key:'Habilidoso', label:'Vence de primeira, times certos, apostas moderadas',
    deliberateLosses:0, survivors:4, challenge:null, betsMvp:true, mvpHits:true, scoreBet:true, rouletteAvg:1.05 },
  { key:'Mestre',     label:'Vitória perfeita, desafios declarados, MVP certeiro, roleta gorda',
    deliberateLosses:0, survivors:6, challenge:'notype', betsMvp:true, mvpHits:true, scoreBet:true, rouletteAvg:1.05 }
];

console.log('\n╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║  TESTE DE REGRESSÃO DA ECONOMIA — Jornada Kanto (docs 03/04)             ║');
console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

const results = PROFILES.map(p=>({ ...p, ...runJourney(p) }));
const width = Math.max(...results.map(r=>r.key.length));
results.forEach(r=>{
  console.log(`  ${r.key.padEnd(width)}  ${String(Math.round(r.totalPool)).padStart(4)} pontos na jornada`);
  console.log(`  ${''.padEnd(width)}  ${r.label}`);
  console.log('');
});

// --- a verificação que importa ---
let ok = true;
for(let i=1;i<results.length;i++){
  if(results[i].totalPool <= results[i-1].totalPool){
    ok = false;
    console.log(`  ❌ FALHOU: ${results[i].key} (${Math.round(results[i].totalPool)}) não supera ${results[i-1].key} (${Math.round(results[i-1].totalPool)}).`);
  }
}
const feeder = results[0].totalPool, mediano = results[1].totalPool;
console.log('  ── Verificações ────────────────────────────────────────────────────────');
console.log(`  ${feeder < mediano ? '✅' : '❌'} Perder de propósito é PIOR que jogar normal (${Math.round(feeder)} < ${Math.round(mediano)})`);
console.log(`  ${ok ? '✅' : '❌'} Ordem Feeder < Mediano < Habilidoso < Mestre mantida`);
const amplitude = ((results[3].totalPool / results[0].totalPool) - 1) * 100;
console.log(`  ℹ️  Amplitude entre o pior e o melhor caminho: ${amplitude.toFixed(0)}% (a meta do doc 04 é ~70%)`);
console.log(`  ℹ️  Teto teórico de pontos usado pela validação da Cloud Function: ${g.theoreticalMaxPoints()}`);
console.log('');

if(!(ok && feeder < mediano)){
  console.error('  ⚠️  A ECONOMIA REGREDIU: o exploit de perder de propósito voltou a compensar.\n');
  process.exit(1);
}
console.log('  🎉 Economia saudável: ninguém é impedido de nada, só deixou de ser pago por perder.\n');
