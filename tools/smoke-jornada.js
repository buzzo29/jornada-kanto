#!/usr/bin/env node
// VOLTOU A RODAR. O aviso de "desatualizado" (28/08/2026, quando ele quebrava em g.startLeg)
// caducou: o bot foi ajustado ao fluxo de hoje e percorre a jornada inteira. Ele e a ferramenta de
// medicao de dificuldade da casa -- o --html abaixo existe pra rodar o MESMO bot contra duas
// versoes do index.html e comparar a taxa de conclusao.
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
/* --html aponta pra OUTRA copia do index.html. E o que permite medir um A/B rodando o MESMO bot
   contra as duas versoes do jogo, em vez de comparar com uma medicao antiga de outra epoca. */
const HTML = (()=>{ const i=args.indexOf('--html'); return i>=0 ? args[i+1] : null; })();
/* --dificil roda as jornadas no modo DIFICIL. Sem ele o bot so joga no normal, e uma mudanca que
   so existe no dificil (a chance de shiny, o bolo de niveis) ficaria invisivel na medicao. */
const DIFICIL = args.includes('--dificil');
/* --corte finge um treinador que JA TEM o HM01 e o ensinou: ele passa a poder entrar na Mata
   Fechada, e o bot sempre entra quando ela aparece. Sem ele a mata e invisivel na medicao -- o bot
   nunca ensina nada, entao o card fica trancado e a rota nunca e escolhida. E o unico jeito de
   medir a Vigilia contra o encontro selvagem que ela substitui. */
const CORTE = args.includes('--corte');
/* --voo e o mesmo pra MONTANHA SAGRADA: finge um treinador que ja tem o HM02 e o ensinou. Sem ele
   a montanha e invisivel na medicao -- o bot nunca ensina nada, entao o card fica trancado e a
   rota nunca e escolhida. E o unico jeito de medir a montanha contra o encontro selvagem que ela
   substitui. */
const VOO = args.includes('--voo');
/* --surf e o mesmo pras ILHAS LARANJA (23/09/2026, quando a travessia deixou de ser so de admin):
   finge um treinador que ja tem o HM03 e o ensinou. Sem ele a carta aparece TRANCADA e o bot nunca
   entra -- que e exatamente o que um jogador sem o HM03 vive. */
const SURF = args.includes('--surf');
/* quanto a Montanha foi jogada, e quantos ninhos acenderam pelo caminho */
const montanha = { entrou:0, venceu:0, ninhos:0, lendario:0, porTrecho:{}, porNinho:{} };
/* quanto a Vigilia foi jogada e como ela terminou -- o numero que interessa nao e so a conclusao */
const vigilia = { entrou:0, venceu:0, niveis:[], porTrecho:{} , ultimoTrecho:null };

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
    case 'routeChoice': {
      /* A MATA FECHADA e uma carta como as outras, mas so da pra entrar com alguem que corte -- e
         o bot nunca ensina o HM01, entao ele filtra o que a tela desabilitaria. Sem o filtro ele
         chamaria chooseRoute num card trancado, a acao recusaria em silencio e a jornada travaria
         na mesma tela ate o MAX_STEPS. */
      if(CORTE){
        /* ensina o Corte a quem puder: e o que um treinador com o HM01 na mochila faria.
           ⚠️ E `podeAprenderHM('hm01', ...)`, NAO o `podeAprenderCorte` -- aquele morreu quando o
           HM03 entrou e a lista passou a viver DENTRO do item. O smoke ficou chamando uma funcao
           que nao existia mais, e o efeito nao foi um erro barulhento: TODA jornada com --corte
           falhava no passo 3, entao qualquer A/B medido com essa flag media ZERO jornadas de cada
           lado e dava "sem diferenca". Ferramenta de medicao quebrada mente calada. */
        const quem = (game.team||[]).find(p => g.podeAprenderHM('hm01', p.speciesId));
        if(quem && !g.sabeCortar(quem)){
          quem.ataques = [g.GOLPE_DO_CORTE].concat((quem.ataques||[]).slice(0, g.MAX_GOLPES - 1));
        }
      }
      if(VOO){
        /* ensina o Voo a quem puder -- o que um treinador com o HM02 na mochila faria */
        const voa = (game.team||[]).find(p => g.podeAprenderHM('hm02', p.speciesId));
        if(voa && (voa.ataques||[]).indexOf(g.GOLPE_DO_VOO) < 0){
          voa.ataques = [g.GOLPE_DO_VOO].concat((voa.ataques||[]).slice(0, g.MAX_GOLPES - 1));
        }
      }
      if(SURF){
        /* ensina o Surf a quem puder -- o que um treinador com o HM03 na mochila faria */
        const nada = (game.team||[]).find(p => g.podeAprenderHM('hm03', p.speciesId));
        if(nada && (nada.ataques||[]).indexOf(g.GOLPE_DO_SURF) < 0){
          nada.ataques = [g.GOLPE_DO_SURF].concat((nada.ataques||[]).slice(0, g.MAX_GOLPES - 1));
        }
      }
      const abertas = game.routeCards.filter(id => {
        const r = g.routeById(id);
        return r && (!r.corte || g.timeQueCorta(game.team)) && (!r.voo || g.podeVoar())
          && (!r.surf || g.podeSurfar());
      });
      /* com --corte a mata e SEMPRE preferida: o que se quer medir e o desvio, nao a chance de o
         bot aleatorio cair nele */
      const mata = CORTE && abertas.find(id => { const r = g.routeById(id); return r && r.corte; });
      const monte = VOO && abertas.find(id => { const r = g.routeById(id); return r && r.voo; });
      const ilha  = SURF && abertas.find(id => { const r = g.routeById(id); return r && r.surf; });
      g.chooseRoute(mata || monte || ilha || abertas[Math.floor(Math.random()*abertas.length)]);
      return true;
    }
    /* A VIGILIA: a clareira e a escolha do premio. O bot pega sempre o primeiro -- o que ele mede
       e a taxa de CONCLUSAO da jornada, nao a qualidade da escolha. */
    case 'mataFechada':
      vigilia.entrou++;
      vigilia.niveis.push(Math.round((game.team||[]).reduce((a,p)=>a+p.level,0) / (game.team||[1]).length));
      vigilia.ultimoTrecho = game.gymIndex;
      const t = vigilia.porTrecho[game.gymIndex] = vigilia.porTrecho[game.gymIndex] || {n:0,v:0,lv:0};
      t.n++; t.lv += Math.round((game.team||[]).reduce((a,p)=>a+p.level,0) / (game.team||[1]).length);
      g.comecarAVigilia();
      return true;
    case 'vigiliaPremio': vigilia.venceu++; if(vigilia.porTrecho[vigilia.ultimoTrecho]) vigilia.porTrecho[vigilia.ultimoTrecho].v++; g.escolherOPremioDaVigilia(0); return true;
    /* A MONTANHA: a chegada, os ninhos e a escolha do premio. O bot sempre luta e sempre pega o
       primeiro -- o que ele mede e a taxa de CONCLUSAO da jornada. */
    case 'montanha': {
      montanha.entrou++;
      const tm = montanha.porTrecho[game.gymIndex] = montanha.porTrecho[game.gymIndex] || {n:0,v:0};
      tm.n++;
      g.enfrentarOsGuardioes();
      return true;
    }
    case 'ninhos': {
      montanha.venceu++;
      montanha.ninhos = Math.max(montanha.ninhos, g.ninhosAcesos());
      if(g.ninhosAcesos() === g.NINHOS.length){ g.enfrentarOsLendarios(); return true; }
      /* sem os tres, ele leva um dos seis guardioes */
      g.escolherOGuardiao(0);
      return true;
    }
    case 'montanhaLendarios': montanha.lendario++; g.escolherOLendario(0); return true;
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
    // o botao de verdade passa pelo seguirDoResultado: quem desmaiou pode ter batido no nivel
    // da evolucao, e ela e anunciada entre o log e o destino. Chamar o destino direto pularia isso
    case 'specialResult':   g.seguirDoResultado('special'); return true;
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
    /* OS DOIS GOLPES DO RECEM-CAPTURADO. O bot leva OS DOIS QUE MAIS BATEM, que e o mesmo criterio
       do ataquesPadrao -- e nao um sorteio: a medicao de dificuldade tem que refletir o jogador que
       escolhe bem, senao ela mede a sorte do bot. */
    case 'escolhaDeAtaques': {
      const p = g.__getGame().team.find(x => x.id === g.__getGame().escolhaDeAtaques);
      g.ataquesPadrao(p).forEach(id => g.marcarAtaque(id));
      g.confirmarAtaques();
      return true;
    }
    /* GOLPE NOVO PELO NIVEL: o bot aprende se o novo bater mais que o pior que ele tem, e recusa se
       nao. E a decisao que um jogador razoavel toma, e ela exercita os dois ramos. */
    /* A tela de ANUNCIO ('aprendeu um golpe') nao tem escolha: so um Continuar. Ela e nova em
       09/09/2026 e sem este caso o bot para na primeira vaga livre -- que e o segundo golpe de
       todos os sete iniciais, ou seja, quase toda jornada. */
    case 'golpeAprendido': g.seguirDoGolpeAprendido(); return true;
    case 'aprenderAtaque': {
      const pend = g.__getGame().aprenderAtaque;
      const p = g.__getGame().team.find(x => x.id === pend.id);
      /* ⚠️ ELE ESCOLHE ENTRE OS TROCAVEIS, nao entre todos os `ataques`: golpe de Maquina (o HM01)
         nao se desaprende, a acao recusa em silencio, e o bot ficava oferecendo o Corte pra sempre
         -- a jornada travava nesta tela ate o MAX_STEPS. 72 falhas em 100 jornadas.
         `ataquesTrocaveis` e a MESMA lista que a tela desenha, que e o que um jogador ve. */
      const podem = g.ataquesTrocaveis(p);
      const pior = podem.slice().sort((a,b)=> g.GOLPES[a][1] - g.GOLPES[b][1])[0];
      g.responderAprendizado(pior && g.GOLPES[pend.golpe][1] > g.GOLPES[pior][1] ? pior : null);
      return true;
    }
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
      g.seguirDoResultado(game.gymIndex < g.numGinasios() - 1 ? 'continueJourney' : 'journeyEnd');
      return true;
    case 'defeat':       g.seguirDoResultado('retry'); return true;
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
  const g = createSandbox(HTML);
  const st = g.freshGameDefaults();
  st.screen = 'start';
  st.trainerName = 'Teste'+run;
  st.rivalName = 'Gary';
  /* o SLOT e a GERACAO entram na semente da Mata Fechada (ver temRotaDoCorte). Sem eles todas as
     jornadas do smoke teriam o MESMO perfil de trechos com mata -- que e exatamente o que
     aconteceu na primeira medicao: zero entradas em 300 jornadas. */
  st.currentSaveSlot = run % 20;
  st.saveGen = Math.floor(run / 20);
  st.gameMode = DIFICIL ? 'hard' : 'normal';
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
      if(TERMINAL.has(cur.screen)){
        /* quantos ninhos cada jornada fechou -- o numero que diz se a batalha dos quatro e
           alcancavel por quem NAO joga de proposito */
        if(VOO) (g.NINHOS||[]).forEach(n => { if(g.ninhoAceso(n.id)) montanha.porNinho[n.id] = (montanha.porNinho[n.id]||0) + 1; });
        break;
      }
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
if(vigilia.entrou){
  const m = vigilia.niveis.reduce((a,n)=>a+n,0) / vigilia.niveis.length;
  console.log(`  Vigilia: entrou ${vigilia.entrou}x, venceu ${vigilia.venceu} (${(100*vigilia.venceu/vigilia.entrou).toFixed(1)}%), nivel medio do time ${m.toFixed(1)}`);
  Object.keys(vigilia.porTrecho).sort().forEach(k=>{ const t=vigilia.porTrecho[k];
    console.log(`    trecho ${Number(k)+1}: ${t.n}x, venceu ${(100*t.v/t.n).toFixed(1)}%, time ~${(t.lv/t.n).toFixed(0)}`); });
}
if(montanha.entrou){
  console.log('  ninhos ao fim da jornada: ' + JSON.stringify(montanha.porNinho||{}));
  console.log(`  Montanha: entrou ${montanha.entrou}x, venceu ${montanha.venceu} (${(100*montanha.venceu/montanha.entrou).toFixed(1)}%), maior nº de ninhos acesos ${montanha.ninhos}, batalha dos quatro ${montanha.lendario}x`);
  Object.keys(montanha.porTrecho).sort().forEach(k=>{ const t=montanha.porTrecho[k];
    console.log(`    trecho ${Number(k)+1}: ${t.n}x`); });
}
console.log(`  Falhas: ${failures}`);
console.log(`\n  Telas visitadas (${screensSeen.size}): ${[...screensSeen].sort().join(', ')}`);
console.log(`  Eventos disparados (${eventsSeen.size}): ${[...eventsSeen].sort().join(', ')}\n`);
process.exit(failures ? 1 : 0);
