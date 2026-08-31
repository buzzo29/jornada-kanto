#!/usr/bin/env node
// DESATUALIZADO (28/08/2026): quebra em g.startLeg, que nao existe mais no jogo -- o fluxo de
// jornada com cassino/roleta que este script percorre foi substituido. Preservado porque a
// estrutura (percorrer telas e validar que o estado nunca fica invalido) ainda serve de base.
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
/* --regiao kanto|johto força o caminho nas 8 etapas. Serve pra comparar os dois lados com o mesmo
   bot: se um deles for mais fácil, a diferença aparece na taxa de conclusão. */
const REGIAO_FORCADA = (()=>{ const i=args.indexOf('--regiao'); return i>=0 ? args[i+1] : null; })();

const TERMINAL = new Set(['journeyEnd','gameover']);
const MAX_STEPS = 4000;

// escolhe automaticamente uma ação plausível para cada tela
function act(g, log){
  const game = g.__getGame();
  switch(game.screen){
    case 'start':        g.chooseStarter(g.STARTERS[Math.floor(Math.random()*g.STARTERS.length)]); return true;
    // a jornada passou a abrir no mapa de Kanto: sem este passo o bot parava na 2ª tela e
    // as 20 jornadas do smoke morriam antes do primeiro encontro
    case 'kantoIntro':   g.comecarJornadaDoMapa(); return true;
    /* A BIFURCAÇÃO: a cada etapa o jogo pergunta Kanto ou Johto. O bot sorteia, de propósito --
       é o que faz o smoke exercitar os dois lados (líderes, rotas e pools de Johto inclusive)
       em vez de percorrer sempre o caminho original. */
    case 'gymChoice':    g.escolherGinasio(REGIAO_FORCADA || (Math.random()<0.5 ? 'kanto' : 'johto')); return true;
    // 'walk' e 'walkNext' já mostram os caminhos (antes passavam por um startLeg e uma tela
    // 'routeChoice' separada, que não existem mais)
    case 'walk':
    case 'walkNext':
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
    // batalha especial (Rocket, rival): mesma mecânica das outras -- sem setTimeout no sandbox,
    // a revelação é avançada na mão
    case 'specialIntro': {
      g.runSpecialBattle();
      let guard=0; while(g.__getGame().screen==='specialBattling' && guard++<200){ g.advanceSpecialReveal(); }
      return true;
    }
    case 'specialBattling': g.advanceSpecialReveal(); return true;
    case 'specialResult':   g.continueAfterSpecial(); return true;
    // o "Mew"/"Mewtwo" da rota é um Ditto disfarçado; a revelação é uma tela só
    case 'wildDisguiseReveal': g.continueAfterWildDisguiseReveal(); return true;
    case 'casino':
      if(game.casinoReels){ g.leaveCasino(); }
      else if(Math.random()<0.7){ g.setCasinoBet(2); g.spinCasino(); }
      else { g.skipCasino(); }
      return true;
    case 'wild': {
      // o bot joga com um mínimo de cabeça: prefere quem tem vantagem contra o próximo líder --
      // que agora depende do caminho escolhido nesta etapa, e por isso vem do gymAtual()
      const gymTeam = g.gymAtual().team;
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
    /* bifurcacao de evolucao (Gloom/Poliwhirl/Slowpoke): o bot sorteia um dos dois destinos,
       de proposito -- e o que faz o smoke exercitar Bellossom, Politoed e Slowking */
    case 'evoChoice': {
      const p = g.evolucoesPendentes()[0];
      const op = g.EVOLUTION_CHOICES[p.pendingEvoChoice];
      g.escolherEvolucao(p.id, op[Math.floor(Math.random()*op.length)]);
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
      // os desafios declarados e as apostas (MVP, placar) saíram do jogo; o que restou aqui é
      // entrar na luta
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
    // a roleta de prêmios saiu do jogo: a vitória vai direto pra próxima etapa (ou pro resumo,
    // quando foi a última insígnia)
    case 'victory':
      if(game.gymIndex < g.numGinasios() - 1) g.continueJourney(); else g.showJourneyEnd();
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
