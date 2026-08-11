#!/usr/bin/env node
/**
 * SMOKE TEST DA JORNADA
 *
 * Joga uma jornada inteira sem navegador: escolhe inicial, percorre as 8 pernas
 * passando por rotas, eventos, emboscadas, cassino, roleta e ginásios, e verifica
 * que nenhuma tela quebra e que o jogo sempre termina em um estado válido.
 *
 *   node tools/smoke-jornada.js [--runs 30]
 */
const { createSandbox } = require('./game-sandbox');

const args = process.argv.slice(2);
const RUNS = (()=>{ const i=args.indexOf('--runs'); return i>=0 ? Number(args[i+1]) : 20; })();
const NUZ = !args.includes('--sem-nuzlocke');

const TERMINAL = new Set(['journeyEnd','gameover']);
const MAX_STEPS = 4000;

// escolhe automaticamente uma ação plausível para cada tela
function act(g, log){
  const game = g.__getGame();
  switch(game.screen){
    case 'start':        g.chooseStarter(g.STARTERS[Math.floor(Math.random()*3)]); return true;
    case 'walk':
    case 'walkNext':     g.startLeg(); return true;
    case 'routeChoice':  g.chooseRoute(game.routeCards[Math.floor(Math.random()*game.routeCards.length)]); return true;
    case 'routeEvent':   Math.random()<0.5 ? g.crossTunnelBlind() : g.crossTunnelSlow(); return true;
    case 'fossil':       Math.random()<0.8 ? g.chooseFossil(Math.random()<0.5?'omanyte':'kabuto') : g.skipFossil(); return true;
    case 'dojo':         g.chooseDojoPrize(Math.random()<0.5?'hitmonlee':'hitmonchan'); return true;
    case 'safari': {
      const wild = game.safariOffer.map((e,i)=>[e,i]).filter(([e])=>e.status==='wild');
      if(wild.length && game.safariCaught.length<3){ g.safariTry(wild[0][1]); } else { g.finishSafari(); }
      return true;
    }
    case 'npcTrade':     Math.random()<0.6 ? g.acceptNpcTrade(game.npcTradeOffer.eligibleIds[0]) : g.declineNpcTrade(); return true;
    case 'dayCare':      Math.random()<0.3 ? g.leaveAtDayCare(game.team[game.team.length-1].id) : g.skipDayCare(); return true;
    case 'rocketHideout':Math.random()<0.7 ? g.enterHideout() : g.skipHideout(); return true;
    case 'casino':
      if(game.casinoReels){ g.leaveCasino(); }
      else if(Math.random()<0.7){ g.setCasinoBet(2); g.spinCasino(); }
      else { g.skipCasino(); }
      return true;
    case 'wild': {
      // o bot joga com um mínimo de cabeça: prefere quem tem vantagem contra o próximo líder
      const gymTeam = g.GYMS[game.gymIndex].team;
      const score = id => {
        const sp = g.SPECIES[id];
        const adv = gymTeam.some(b=>g.bestMultiplier(sp.types, g.SPECIES[b.species].types) > 1) ? 1000 : 0;
        return adv + g.bstOf(id);
      };
      const offers = game.wildOffer.map(o=>o.speciesId).sort((a,b)=>score(b)-score(a));
      for(let i=0;i<Math.min(3, offers.length);i++){ g.toggleWild(offers[i]); }
      g.confirmWild();
      return true;
    }
    case 'release': {
      const excess = game.team.length - 6;
      const weakest = game.team.slice().sort((a,b)=>(a.level*10+g.bstOf(a.speciesId)) - (b.level*10+g.bstOf(b.speciesId)));
      for(let i=0;i<excess;i++){ g.toggleRelease(weakest[i].id); }
      g.confirmRelease();
      return true;
    }
    case 'eeveeChoice':  g.chooseEeveeEvolution(['keep','vaporeon','jolteon','flareon'][Math.floor(Math.random()*4)]); return true;
    case 'levels': {
      // um bot que espalha pontos aleatoriamente perde em Brock e nunca vê o resto do jogo.
      // Este aqui joga como gente: concentra nos primeiros da ordem até bater no teto.
      let guard = 0;
      while(g.__getGame().pool > 0 && guard++ < 400){
        const t = g.__getGame().team;
        if(!t.length) break;
        let moved = false;
        for(const p of t){
          const before = g.__getGame().pool;
          g.addPoint(p.id);
          if(g.__getGame().pool < before){ moved = true; break; }
        }
        if(!moved) break;
      }
      g.confirmLevels();
      return true;
    }
    case 'evolution':    g.continueFromEvolution(); return true;
    case 'teamOrder':    g.confirmOrder(); return true;
    case 'preBattle': {
      // desafio declarado é risco REAL: um bot que declara em metade das batalhas se suicida.
      // Aqui ele arrisca só quando está confortável (time cheio e sem derrotas no ginásio).
      const viable = g.DECLARED_CHALLENGES.filter(c=>g.challengeIsViable(c.id));
      const confortavel = game.team.length >= 5 && (game.losses||0) === 0;
      if(viable.length && confortavel && Math.random()<0.35){
        g.declareChallenge(viable[Math.floor(Math.random()*viable.length)].id);
      }
      if(Math.random()<0.5 && game.team.length) g.setMvpBet(game.team[0].id);
      if(Math.random()<0.4) g.toggleScoreBet();
      g.runBattle();
      // o sandbox não tem setTimeout: a revelação é avançada na mão até o fim
      let guard=0; while(g.__getGame().screen==='battling' && guard++<200){ g.advanceReveal(); }
      return true;
    }
    case 'eventIntro': {
      g.runEventBattle();
      let guard=0; while(g.__getGame().screen==='eventBattling' && guard++<200){ g.advanceEventReveal(); }
      return true;
    }
    case 'eventResult':  g.closeEventResult(); return true;
    case 'emergency':    Math.random()<0.7 ? g.takeEmergencyMon(game.emergencyOffer[0]) : g.skipEmergency(); return true;
    case 'victory':      g.goToRouletteOrContinue(); return true;
    case 'roulette':
      if(game.roulette.picked == null){ g.pickRouletteCard(Math.floor(Math.random()*3)); }
      else if((game.rareCandyPending||0) > 0){ g.useRareCandy(game.team[0].id); }
      else { g.closeRoulette(); }
      return true;
    case 'defeat':       g.prepareRetry(); return true;
    case 'gameover':
    case 'journeyEnd':   return false;
    default:
      log.push('TELA DESCONHECIDA: '+game.screen);
      return false;
  }
}

let failures = 0, completed = 0, gameovers = 0;
const gameoverGyms = [];
const screensSeen = new Set();
const eventsSeen = new Set();

for(let run=0; run<RUNS; run++){
  const g = createSandbox();
  const st = g.freshGameDefaults();
  st.screen = 'start';
  st.trainerName = 'Teste'+run;
  st.rivalName = 'Gary';
  st.nuzlocke = NUZ ? (run % 5 === 0) : false;      // 1 em 5 jornadas testa o modo Nuzlocke
  st.dailyChallenge = (run % 7 === 0);
  st.dailySeed = '2026-08-11';
  g.__setGame(st);

  const log = [];
  let steps = 0, ok = true;
  try{
    while(steps++ < MAX_STEPS){
      const cur = g.__getGame();
      screensSeen.add(cur.screen);
      if(cur.eventBattle) eventsSeen.add(cur.eventBattle.id);
      if(TERMINAL.has(cur.screen)) break;
      if(!act(g, log)){ break; }
      // sanidade: o time nunca pode passar de 6 nem ficar com nível inválido
      const cur2 = g.__getGame();
      const t = cur2.team;
      // a tela 'release' existe justamente para o momento em que o time passou de 6
      if(t.length > 6 && cur2.screen !== 'release') throw new Error('time com '+t.length+' pokémons na tela '+cur2.screen);
      if(t.some(p=>!Number.isFinite(p.level) || p.level < 1)) throw new Error('nível inválido');
    }
  } catch(e){
    ok = false; failures++;
    console.error(`  ❌ run ${run} (tela "${g.__getGame().screen}", passo ${steps}): ${e.message}`);
    if(log.length) console.error('     '+log.join(' | '));
  }
  if(ok){
    const fim = g.__getGame();
    if(fim.screen === 'journeyEnd') completed++;
    else if(fim.screen === 'gameover'){ gameovers++; gameoverGyms.push(fim.gymIndex+1); }
    else { failures++; console.error(`  ❌ run ${run} terminou em tela inesperada: ${fim.screen} (${steps} passos)`); }
  }
}

console.log(`\n=== SMOKE TEST DA JORNADA — ${RUNS} jornadas completas ===\n`);
console.log(`  Jornadas concluídas (8 insígnias ou fim normal): ${completed}`);
console.log(`  Game overs (5 derrotas): ${gameovers}${gameoverGyms.length?' — no ginásio '+gameoverGyms.sort((a,b)=>a-b).join(', '):''}`);
console.log(`  Falhas: ${failures}`);
console.log(`\n  Telas visitadas (${screensSeen.size}): ${[...screensSeen].sort().join(', ')}`);
console.log(`  Eventos disparados (${eventsSeen.size}): ${[...eventsSeen].sort().join(', ')}\n`);
process.exit(failures ? 1 : 0);
