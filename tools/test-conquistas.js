/**
 * AS CONQUISTAS -- cada uma acende SÓ quando devia.
 *
 * Por que isso existe: conquista errada e conquista que nunca acende sao os dois defeitos mais
 * silenciosos do jogo. Ninguem reclama de uma conquista que nao acendeu (nao da pra saber que ela
 * devia ter acendido), e uma que acende de graca so aparece quando ja foi distribuida pra todo
 * mundo. Tudo aqui sai de estado do save, entao da pra montar o save e conferir.
 *
 * O que fica trancado: as conquistas de CAMINHO (so Kanto, so Johto, 4+4) e de COMPOSICAO (time
 * todo de Kanto, todo de Johto, monotipo), que o time congelado na vitoria alimenta; que save
 * antigo -- sem esse campo -- cai no time atual em vez de perder o que ja tinha; e que nenhum id
 * de conquista repete.
 *
 *   node tools/test-conquistas.js
 */
const path = require('path');
const Module = require('module');
const fake = require('./fake-firestore');
const { createSandbox } = require('./game-sandbox');

/* ⚠️ O SERVIDOR ENTRA AQUI porque as moedas das conquistas moram nos DOIS lados: a tabela das 69
   foi portada pro functions/index.js (o cliente nao pode escrever `moedas`), e o que este arquivo
   tranca de mais importante e que os dois destravem SEMPRE o mesmo conjunto. */
const db = fake.makeDb();
const stubs = {
  'firebase-functions/v2/scheduler': { onSchedule: (a, b)=> (typeof a === 'function' ? a : b) },
  'firebase-functions/v2/https': {
    onCall: (fn)=>fn,
    HttpsError: class HttpsError extends Error { constructor(code, msg){ super(msg); this.code = code; } }
  },
  'firebase-functions/logger': { error(){}, info(){}, warn(){}, log(){} },
  'firebase-admin': { initializeApp(){}, firestore: Object.assign(()=>db, { FieldValue: fake.FieldValue }) }
};
const loadOriginal = Module._load;
Module._load = function(req){ if(stubs[req]) return stubs[req]; return loadOriginal.apply(this, arguments); };
const fns = require(path.join(__dirname, '..', 'functions', 'index.js'));
Module._load = loadOriginal;
const SRV = fns._conquistas;

const S = createSandbox();
const g = S.__getGame();

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const conquista = id => S.ACHIEVEMENTS.find(c=>c.id===id);
// monta a conta com os saves dados e devolve quais conquistas acendem
function acendeu(id, slots, dexExtra){
  g.saveSlots = slots;
  g.permanentPokedex = dexExtra || [];
  g.permanentShinyDex = [];
  g.trainerBestStreak = 0; g.leagueWinsTotal = 0;
  g.bossTop10 = false; g.bossKiller = false;
  S.__setGame(g);
  const agg = S.getAchievementAggregate();
  return !!conquista(id).check(agg, {});
}
const campeao = (extra) => Object.assign({
  eliteStatus:'champion', badgeCount:8, team:[], caughtSpecies:[], eliteAttemptsUsed:1
}, extra);
const oito = r => new Array(8).fill(r);

console.log('\nTODA CONQUISTA TEM ID PROPRIO');
const ids = S.ACHIEVEMENTS.map(c=>c.id);
ok('nenhum id repetido', new Set(ids).size === ids.length,
   ids.filter((x,i)=>ids.indexOf(x)!==i).join(', ') || String(ids.length) + ' conquistas');
ok('toda conquista tem nome, descricao e teste',
   S.ACHIEVEMENTS.every(c=>c.name && c.desc && typeof c.check === 'function'));

console.log('\nO CAMINHO DA JORNADA');
ok('so ginasios de Kanto', acendeu('elite_path_kanto', [campeao({ gymPath: oito('kanto') })]));
ok('nao acende com um de Johto no meio',
   !acendeu('elite_path_kanto', [campeao({ gymPath: ['kanto','kanto','johto','kanto','kanto','kanto','kanto','kanto'] })]));
ok('so ginasios de Johto', acendeu('elite_path_johto', [campeao({ gymPath: oito('johto') })]));
ok('4 de cada lado', acendeu('elite_path_split',
   [campeao({ gymPath: ['kanto','johto','kanto','johto','kanto','johto','kanto','johto'] })]));
ok('5 e 3 nao contam como metade',
   !acendeu('elite_path_split', [campeao({ gymPath: ['johto','johto','johto','johto','johto','kanto','kanto','kanto'] })]));
/* Save de antes da bifurcacao nao tem gymPath -- e naquele tempo so existia Kanto. */
ok('campeao antigo, sem gymPath, conta como Kanto puro', acendeu('elite_path_kanto', [campeao({})]));
ok('e nao ganha o de Johto de graca', !acendeu('elite_path_johto', [campeao({})]));
/* Quem nao venceu a Elite nao entra na conta, por mais que a jornada tenha sido toda de Johto. */
ok('sem vencer a Elite, nenhum caminho conta',
   !acendeu('elite_path_johto', [{ eliteStatus:null, badgeCount:8, gymPath: oito('johto'), team:[] }]));

console.log('\nA COMPOSICAO DO TIME NA VITORIA');
const kanto = ['venusaur','charizard','blastoise','pikachu','snorlax','gyarados'];
const johto = ['meganium','typhlosion','feraligatr','ampharos','scizor','kingdra'];
ok('time todo de Kanto', acendeu('elite_team_kanto', [campeao({ eliteWinTeam: kanto })]));
ok('um de Johto no meio ja tira', !acendeu('elite_team_kanto', [campeao({ eliteWinTeam: kanto.slice(0,5).concat('ampharos') })]));
ok('time todo de Johto', acendeu('elite_team_johto', [campeao({ eliteWinTeam: johto })]));
ok('um de Kanto no meio ja tira', !acendeu('elite_team_johto', [campeao({ eliteWinTeam: johto.slice(0,5).concat('pikachu') })]));
/* O time do save MUDA depois da vitoria (o Mewtwo emprestado entra por 24h). Por isso a conquista
   olha o time congelado, e nao o de agora. */
ok('o Mewtwo emprestado depois nao apaga a conquista de Johto',
   acendeu('elite_team_johto', [campeao({ eliteWinTeam: johto, team: johto.slice(0,5).concat('mewtwo').map(id=>({speciesId:id, level:70})) })]));
/* Save campeao anterior a este campo cai no time ATUAL -- ninguem perde o que ja tinha. */
ok('campeao antigo, sem o time congelado, usa o time atual',
   acendeu('elite_team_kanto', [campeao({ team: kanto.map(id=>({speciesId:id, level:70})) })]));

console.log('\nMONOTIPO');
ok('time todo de Agua', acendeu('elite_monotype',
   [campeao({ eliteWinTeam: ['blastoise','gyarados','lapras','vaporeon','starmie','kingdra'] })]));
/* Tipagem dupla vale: basta existir UM tipo que todos tenham. Gyarados e Agua/Voador, Lapras e
   Agua/Gelo -- o tipo em comum e Agua. */
ok('um intruso derruba', !acendeu('elite_monotype',
   [campeao({ eliteWinTeam: ['blastoise','gyarados','lapras','vaporeon','starmie','pikachu'] })]));
ok('time misturado nao acende', !acendeu('elite_monotype', [campeao({ eliteWinTeam: kanto })]));

console.log('\nDE PRIMEIRA');
/* eliteAttemptsUsed conta DERROTAS: zero quer dizer que passou sem gastar tentativa. */
ok('campeao sem nenhuma derrota na Elite', acendeu('elite_first_try', [campeao({ eliteAttemptsUsed: 0 })]));
ok('com uma derrota no caminho, nao', !acendeu('elite_first_try', [campeao({ eliteAttemptsUsed: 1 })]));

console.log('\nOS BURACOS QUE JOHTO DEIXOU');
/* Os intocaveis (Lugia, Ho-Oh, Celebi) nao entram na conta: nao da pra capturar nenhum, e uma
   conquista impossivel e pior que conquista nenhuma. */
const INTOCAVEIS = ['lugia','hooh','celebi'];
const johtoCapturavel = Object.keys(S.SPECIES).filter(id=>S.SPECIES[id].dex>=152 && !INTOCAVEIS.includes(id));
ok('Pokedex de Johto completa sem os intocaveis', acendeu('catch_johto', [], johtoCapturavel),
   johtoCapturavel.length + ' de ' + (johtoCapturavel.length + INTOCAVEIS.length) + ' especies de Johto');
ok('faltando uma capturavel, nao acende', !acendeu('catch_johto', [], johtoCapturavel.slice(0,-1)));
ok('e os intocaveis nao fazem falta', acendeu('catch_johto', [], johtoCapturavel));
/* Mestre Pokemon idem: a Pokedex mostra 250, mas o que se cobra e o que da pra ter. */
const tudoCapturavel = Object.keys(S.SPECIES).filter(id=>!INTOCAVEIS.includes(id));
ok('Mestre Pokemon acende sem os intocaveis', acendeu('catch_all', [], tudoCapturavel));
ok('e nao acende faltando uma capturavel', !acendeu('catch_all', [], tudoCapturavel.slice(0,-1)));
ok('as tres bestas', acendeu('all_beasts', [], ['raikou','entei','suicune']));
ok('duas bestas nao bastam', !acendeu('all_beasts', [], ['raikou','entei']));
/* A conquista de capturar Lugia e Ho-Oh saiu junto com eles das rotas: ninguem os captura mais. */
ok('nao existe mais conquista de capturar Lugia e Ho-Oh', !S.ACHIEVEMENTS.some(c=>c.id==='tower_duo'));

console.log('\nE AS ANTIGAS CONTINUAM DE PE');
ok('Pokedex de Kanto ainda exige as 150', !acendeu('catch_149', [], ['pikachu']));
ok('o Ditto da Elite continua vindo da flag da vitoria',
   acendeu('elite_ditto', [campeao({ eliteDittoWin:true, team:[] })]));
ok('campeao da Elite', acendeu('elite_champion', [campeao({})]));


/* =====================================================================
   AS MOEDAS DAS CONQUISTAS (16/09/2026)
   ===================================================================== */
console.log('\nCADA CONQUISTA TEM NIVEL, E O NIVEL VALE MOEDA');
const NIVEIS = ['facil','media','dificil','lendaria'];
ok('todas as 69 tem nivel declarado',
   S.ACHIEVEMENTS.every(c => NIVEIS.indexOf(c.nivel) >= 0),
   S.ACHIEVEMENTS.filter(c => NIVEIS.indexOf(c.nivel) < 0).map(c=>c.id).join(', ') || 'todas');
ok('os quatro niveis existem de verdade (nenhum sem dono)',
   NIVEIS.every(n => S.ACHIEVEMENTS.some(c => c.nivel === n)),
   NIVEIS.map(n => n + ':' + S.ACHIEVEMENTS.filter(c=>c.nivel===n).length).join(' '));
/* ⚠️ O PEDIDO E "facil da MENOS, dificil da MAIS" -- entao a escala tem que ser CRESCENTE, e isso
   e o que se cobra. Trancar os valores 10/25/60/150 aqui faria o teste virar uma copia da tabela:
   qualquer reajuste passaria a exigir editar os dois lugares, e o teste nao diria nada sobre a
   regra. O que nao pode e um nivel "dificil" pagando menos que um "facil". */
ok('a escala e crescente: facil < media < dificil < lendaria',
   S.NIVEL_DA_CONQUISTA.facil.moedas < S.NIVEL_DA_CONQUISTA.media.moedas &&
   S.NIVEL_DA_CONQUISTA.media.moedas < S.NIVEL_DA_CONQUISTA.dificil.moedas &&
   S.NIVEL_DA_CONQUISTA.dificil.moedas < S.NIVEL_DA_CONQUISTA.lendaria.moedas,
   NIVEIS.map(n => S.NIVEL_DA_CONQUISTA[n].moedas).join(' < '));

console.log('\nO CLIENTE E O SERVIDOR CONCORDAM (a tabela e duplicada)');
ok('as duas tabelas tem as mesmas 69, na mesma ordem',
   S.ACHIEVEMENTS.map(a=>a.id).join(',') === SRV.CONQUISTAS.map(a=>a.id).join(','),
   S.ACHIEVEMENTS.length + ' x ' + SRV.CONQUISTAS.length);
ok('e o NIVEL de cada uma bate nos dois lados',
   S.ACHIEVEMENTS.every((a,i) => a.nivel === SRV.CONQUISTAS[i].nivel),
   S.ACHIEVEMENTS.filter((a,i)=> a.nivel !== SRV.CONQUISTAS[i].nivel).map(a=>a.id).join(', ') || 'todas');
/* ⚠️ O VALOR TAMBEM: o cliente DESENHA o numero e o servidor PAGA. Divergindo, a tela promete um
   preco que a cobranca nao pratica -- a mesma armadilha do catalogo da loja (ITENS x LOJA). */
ok('e quanto cada nivel paga bate nos dois lados',
   NIVEIS.every(n => S.NIVEL_DA_CONQUISTA[n].moedas === SRV.NIVEL_DA_CONQUISTA[n].moedas),
   NIVEIS.map(n => n + ' ' + S.NIVEL_DA_CONQUISTA[n].moedas + '/' + SRV.NIVEL_DA_CONQUISTA[n].moedas).join(' '));

/* ⚠️ E A TRAVA QUE IMPORTA E ESTA: os dois lados destravam o MESMO conjunto pra a MESMA conta.
   Comparar o TEXTO das tabelas nao serviria -- elas foram geradas uma da outra, entao passariam
   iguais mesmo com os AGREGADOS divergindo, que e onde o risco de verdade esta (o cliente monta o
   dele do `game`, o servidor dos documentos). Por isso a comparacao e por COMPORTAMENTO, sobre
   contas sorteadas. */
console.log('\nOS DOIS AGREGADOS SAO O MESMO AGREGADO');
{
  let semente = 12345;
  const rnd = () => (semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const esp = Object.keys(S.SPECIES);
  const pega = n => { const r = []; for(let i=0;i<n;i++) r.push(esp[Math.floor(rnd()*esp.length)]); return r; };
  const timeDe = n => { const t=[]; for(let i=0;i<n;i++) t.push({ speciesId: esp[Math.floor(rnd()*esp.length)], level: 1+Math.floor(rnd()*99), shiny: rnd()<0.15 }); return t; };
  let difCampos = 0, difConjunto = 0, camposRuins = {};
  const VOLTAS = 400;
  for(let k = 0; k < VOLTAS; k++){
    const saves = [];
    const quantos = Math.floor(rnd()*5);
    for(let i = 0; i < quantos; i++){
      saves.push({
        badgeCount: Math.floor(rnd()*9), team: timeDe(Math.floor(rnd()*7)),
        caughtSpecies: pega(Math.floor(rnd()*25)), evolutions: rnd()<0.5 ? ['x'] : [],
        everComeback: rnd()<0.3, losses: Math.floor(rnd()*6),
        eliteStatus: rnd()<0.3 ? 'champion' : null,
        eliteWinTeam: rnd()<0.5 ? pega(6) : null,
        gymPath: rnd()<0.5 ? new Array(8).fill(rnd()<0.5?'kanto':'johto') : null,
        eliteAttemptsUsed: Math.floor(rnd()*3), eliteDittoWin: rnd()<0.2,
        mewtwoReward: rnd()<0.3 ? { earned:true, used: rnd()<0.5 } : null,
        lossesTotal: Math.floor(rnd()*12)
      });
    }
    const conta = {
      pokedexCaught: pega(Math.floor(rnd()*120)), pokedexShinyCaught: pega(Math.floor(rnd()*60)),
      bossTop10: rnd()<0.2, bossKiller: rnd()<0.1,
      mewtwoLoanActive: rnd()<0.2, mewtwoLoanCooldownUntil: rnd()<0.2 ? Date.now() : 0,
      trainerBestStreak: Math.floor(rnd()*14), leagueWinsTotal: Math.floor(rnd()*4),
      anyRegistered: rnd()<0.5, anySemifinal: rnd()<0.4, anyRunnerUp: rnd()<0.3,
      anyChampion: rnd()<0.2, anyTrainersChampion: rnd()<0.2
    };
    /* o cliente le do `game`: e assim que o carregamento da conta o deixa */
    g.saveSlots = saves;
    g.permanentPokedex = conta.pokedexCaught.slice();
    saves.forEach(sv => (sv.caughtSpecies||[]).forEach(id => { if(g.permanentPokedex.indexOf(id) < 0) g.permanentPokedex.push(id); }));
    g.caughtSpecies = [];
    g.permanentShinyDex = conta.pokedexShinyCaught;
    g.bossTop10 = conta.bossTop10; g.bossKiller = conta.bossKiller;
    g.mewtwoLoanActive = conta.mewtwoLoanActive; g.mewtwoLoanCooldownUntil = conta.mewtwoLoanCooldownUntil;
    g.trainerBestStreak = conta.trainerBestStreak; g.leagueWinsTotal = conta.leagueWinsTotal;
    S.__setGame(g);
    const aCli = S.getAchievementAggregate();
    const aSrv = SRV.agregadoDasConquistas(saves, conta);
    Object.keys(aCli).forEach(campo => {
      if(campo === 'trainerNames') return;     // so o cliente usa, pro escaneamento da Liga
      if(JSON.stringify(aCli[campo]) !== JSON.stringify(aSrv[campo])){
        difCampos++; camposRuins[campo] = (camposRuins[campo]||0) + 1;
      }
    });
    const extra = { anyRegistered:conta.anyRegistered, anySemifinal:conta.anySemifinal,
                    anyRunnerUp:conta.anyRunnerUp, anyChampion:conta.anyChampion,
                    anyTrainersChampion:conta.anyTrainersChampion };
    const doCliente = S.ACHIEVEMENTS.filter(a=>a.check(aCli, extra)).map(a=>a.id).join(',');
    const doServidor = SRV.conquistasGanhasDaConta(saves, conta).join(',');
    if(doCliente !== doServidor) difConjunto++;
  }
  ok('nenhum campo do agregado diverge em ' + VOLTAS + ' contas sorteadas', difCampos === 0,
     Object.keys(camposRuins).length ? JSON.stringify(camposRuins) : 'zero');
  ok('e o conjunto destravado e identico nas ' + VOLTAS, difConjunto === 0, difConjunto + ' divergencias');
}

console.log('\nO RESGATE PAGA UMA VEZ SO');
{
  const conta = { pokedexCaught: [], trainerBestStreak: 0 };
  const saves = [{ badgeCount: 8, team: [], caughtSpecies: [], evolutions: ['x'] }];
  const ganhas = SRV.conquistasGanhasDaConta(saves, conta);
  ok('uma conta com 8 insignias ja tem o que resgatar', ganhas.length > 0, ganhas.length + ' conquistas');
  const total = SRV.moedasDasConquistas(ganhas);
  ok('e elas valem moeda', total > 0, '🪙 ' + total);
  /* ⚠️ O QUE JA FOI PAGO NAO PAGA DE NOVO -- e o mesmo desenho do coinsPaid da jornada: conta do
     zero o que esta ganho e paga a DIFERENCA pro que ja saiu. */
  const metade = ganhas.slice(0, Math.floor(ganhas.length/2));
  const falta = ganhas.filter(id => metade.indexOf(id) < 0);
  ok('pagando a metade, sobra exatamente a outra metade',
     SRV.moedasDasConquistas(falta) === total - SRV.moedasDasConquistas(metade),
     '🪙 ' + SRV.moedasDasConquistas(falta) + ' de ' + total);
  ok('e com tudo pago nao sobra nada', SRV.moedasDasConquistas([]) === 0);
  /* id desconhecido (conquista removida do jogo, mas ainda na lista de pagas da conta) nao pode
     valer moeda nem quebrar a conta */
  ok('id que nao existe mais vale zero', SRV.moedasDasConquistas(['conquista_que_sumiu']) === 0);
}

console.log('\nO AVISO SO APARECE QUANDO HA O QUE PEGAR');
{
  g.saveSlots = [{ badgeCount: 8, team: [], caughtSpecies: [], evolutions: ['x'] }];
  g.permanentPokedex = []; g.permanentShinyDex = [];
  g.bossTop10 = false; g.bossKiller = false; g.trainerBestStreak = 0; g.leagueWinsTotal = 0;
  g.achievementsExtra = { anyRegistered:false, anySemifinal:false, anyRunnerUp:false, anyChampion:false, anyTrainersChampion:false };
  g.achievementsPaid = [];
  g.contaCarregada = true;
  S.__setGame(g);
  const pendente = S.moedasAResgatar();
  ok('com conquista nova, ha moeda esperando', pendente > 0, '🪙 ' + pendente);
  ok('e o aviso acende', S.temConquistaAResgatar() === true);
  /* ⚠️ E ELE NAO PODE ACENDER ANTES DA CONTA CARREGAR: o achievementsPaid nasce vazio, entao
     TUDO pareceria por resgatar -- o circulo vermelho apareceria numa conta que ja pegou tudo. */
  g.contaCarregada = false; S.__setGame(g);
  ok('mas NAO acende enquanto a conta nao carregou', S.temConquistaAResgatar() === false);
  g.contaCarregada = true;
  g.achievementsPaid = S.conquistasGanhas().map(a=>a.id);
  S.__setGame(g);
  ok('com tudo resgatado, o aviso apaga', S.temConquistaAResgatar() === false, '🪙 ' + S.moedasAResgatar());
}

console.log('\nA TELA MOSTRA O PREMIO E O BOTAO');
{
  g.achievementsPaid = [];
  g.contaCarregada = true;
  g.conquistaResgateGanhou = 0;
  g.conquistaResgateErro = null;
  S.__setGame(g);
  const html = S.renderAchievements();
  /* ⚠️ O RESGATE E POR LINHA desde 17/09/2026: o botao unico de "resgatar tudo" saiu, e cada
     conquista GANHA tem o seu, com o valor dela. A trava passou a contar os BOTOES e a cobrar que
     eles sejam exatamente as ganhas-e-nao-pagas -- nem as trancadas nem as ja pagas podem ter um.
     Ela media o botao unico ate aqui; medir "tem um botao" so seria fraco demais pro que mudou. */
  const botoes = (html.match(/<button class="conquista-premio pronta"/g) || []).length;
  const ganhasNaoPagas = S.conquistasAResgatar().length;
  ok('cada conquista ganha tem o BOTAO dela, com o valor', botoes > 0 && botoes === ganhasNaoPagas,
     botoes + ' botoes para ' + ganhasNaoPagas + ' a resgatar');
  ok('e o botao carrega o id da conquista', /onclick="resgatarConquista\('[a-z0-9_]+'\)"/.test(html),
     (html.match(/resgatarConquista\('[a-z0-9_]+'\)/) || ['(sem onclick)'])[0]);
  /* ⚠️ E O BOTAO DE "RESGATAR TUDO" NAO PODE VOLTAR: ele foi TIRADO a pedido, e uma volta por
     descuido passaria despercebida -- a tela continuaria funcionando com os dois. */
  ok('e o botao de resgatar TUDO nao existe mais',
     !/🪙 Resgatar \d+ moedas/.test(html) && !/resgatarConquistas\(\)/.test(html));
  ok('e cada linha mostra o premio dela', (html.match(/conquista-premio/g)||[]).length === S.ACHIEVEMENTS.length,
     (html.match(/conquista-premio/g)||[]).length + ' de ' + S.ACHIEVEMENTS.length);
  /* ⚠️ O PREMIO APARECE NA TRANCADA TAMBEM: e ele que diz por que vale a pena ir atras daquela. */
  const trancadas = (html.match(/achievement-row locked/g)||[]).length;
  ok('inclusive nas trancadas', trancadas > 0 && (html.match(/conquista-premio/g)||[]).length > trancadas,
     trancadas + ' trancadas');
  g.achievementsPaid = S.conquistasGanhas().map(a=>a.id);
  S.__setGame(g);
  const pago = S.renderAchievements();
  ok('resgatado, o botao some e a linha vira ✓',
     !/<button class="conquista-premio pronta"/.test(pago) && /conquista-premio paga/.test(pago));
  ok('e a tela diz que esta tudo pego', /Tudo resgatado/.test(pago));
}


console.log('\nO claimAchievementCoins DE PONTA A PONTA');
/* ⚠️ ATE AQUI o que se testava eram as PECAS (o que esta ganho, quanto vale). Esta parte roda a
   CALLABLE de verdade contra o fake-firestore: a transacao, o increment das moedas e o arrayUnion
   da lista de pagas. E onde mora o risco que nenhuma das outras pega -- uma escrita errada aqui
   paga duas vezes ou nao paga nunca, e so apareceria em producao. */
async function rodaOResgate(){
  const uid = "treinador1";
  const userRef = db.collection("users").doc(uid);
  await userRef.set({ moedas: 100, pokedexCaught: [], trainerBestStreak: 0 });
  await userRef.collection("saves").doc("0").set({
    badgeCount: 8, team: [], caughtSpecies: [], evolutions: ["x"], lossesTotal: 3
  });

  const req = { auth: { uid } };

  /* ⚠️ O RESGATE POR ID (17/09/2026) -- a parte nova, e a que tem risco proprio: o `id` vem do
     CLIENTE, entao o servidor tem que recalcular o que esta ganho e ignorar qualquer coisa fora
     disso. Sem essa checagem, um id inventado pagaria uma conquista trancada. */
  {
    const ganhasAgora = fns._conquistas.conquistasGanhasDaConta(
      [{ badgeCount:8, team:[], caughtSpecies:[], evolutions:["x"], lossesTotal:3 }],
      { moedas:100, pokedexCaught:[], trainerBestStreak:0 });
    const uma = ganhasAgora[0];
    const antesDeUma = (await userRef.get()).data().moedas | 0;
    const rUma = await fns.claimAchievementCoins({ auth:{ uid }, data:{ id: uma } });
    ok('resgatar UMA paga so ela', rUma.ganhou === fns._conquistas.moedasDasConquistas([uma]),
       '🪙 ' + rUma.ganhou + ' pela ' + uma);
    ok('e a lista de pagas tem exatamente ela', (rUma.pagas||[]).length === 1 && rUma.pagas[0] === uma,
       (rUma.pagas||[]).join(','));
    ok('e o saldo sobe so isso', rUma.moedas === antesDeUma + rUma.ganhou, antesDeUma + ' -> ' + rUma.moedas);
    /* ⚠️ E A MESMA DE NOVO NAO PAGA: e o duplo-clique numa linha so. */
    const rDeNovo = await fns.claimAchievementCoins({ auth:{ uid }, data:{ id: uma } });
    ok('a mesma conquista de novo nao paga', rDeNovo.ganhou === 0, '🪙 ' + rDeNovo.ganhou);
    /* ⚠️ E UM ID INVENTADO NAO PAGA NADA -- o pedido vem do cliente, a resposta vem do servidor. */
    const rFalso = await fns.claimAchievementCoins({ auth:{ uid }, data:{ id: 'conquista_que_nao_existe' } });
    ok('um id inventado nao paga nada', rFalso.ganhou === 0, '🪙 ' + rFalso.ganhou);
    /* ⚠️ E UMA CONQUISTA TRANCADA tambem nao: ela EXISTE na tabela, mas esta conta nao a tem. */
    const trancada = fns._conquistas.CONQUISTAS.map(c => c.id).find(id => ganhasAgora.indexOf(id) < 0);
    const rTrancada = await fns.claimAchievementCoins({ auth:{ uid }, data:{ id: trancada } });
    ok('e uma conquista TRANCADA nao paga', rTrancada.ganhou === 0, trancada + ': 🪙 ' + rTrancada.ganhou);
  }

  /* ⚠️ SEM `id` ELE PAGA TUDO, e isso NAO e sobra: e o que um cliente antigo em cache manda. */
  /* o saldo de partida e LIDO, e nao 100 fixo: o bloco do resgate por id acima ja pagou uma. */
  const antesDoResto = (await userRef.get()).data().moedas | 0;
  const r1 = await fns.claimAchievementCoins(req);
  ok('sem id, o resgate paga o resto todo de uma vez', r1.ganhou > 0, '🪙 ' + r1.ganhou);
  ok('e o saldo sobe exatamente isso', r1.moedas === antesDoResto + r1.ganhou, antesDoResto + ' -> ' + r1.moedas);
  ok('e a lista de pagas volta preenchida', (r1.pagas||[]).length > 0, (r1.pagas||[]).length + ' conquistas');

  /* ⚠️ O SEGUNDO RESGATE NAO PAGA NADA -- e a trava mais importante deste bloco: sem ela, um
     duplo-clique (ou um F5 na tela) viraria moeda de graca. */
  const r2 = await fns.claimAchievementCoins(req);
  ok('o segundo resgate seguido nao paga nada', r2.ganhou === 0, '🪙 ' + r2.ganhou);
  ok('e o saldo nao se move', r2.moedas === r1.moedas, String(r2.moedas));

  /* conquista NOVA depois do resgate paga so a diferenca */
  const doc = await userRef.get();
  const antes = (doc.data().moedas)|0;
  await userRef.collection("saves").doc("1").set({
    badgeCount: 8, team: [], caughtSpecies: [], evolutions: ["x"]
  });
  const r3 = await fns.claimAchievementCoins(req);
  ok('uma conquista nova depois paga so a diferenca', r3.ganhou > 0 && r3.ganhou < r1.ganhou,
     '🪙 ' + r3.ganhou + ' (o primeiro tinha sido ' + r1.ganhou + ')');
  ok('e o saldo acompanha', r3.moedas === antes + r3.ganhou);

  /* ⚠️ A LISTA DE PAGAS SO CRESCE (arrayUnion): sem isso, o resgate seguinte reescreveria a lista
     com o que ELE viu, e uma conquista paga que sumisse da lista seria paga de novo. */
  const fim = (await userRef.get()).data();
  ok('a lista de pagas so cresce', (fim.achievementsPaid||[]).length >= (r1.pagas||[]).length,
     (fim.achievementsPaid||[]).length + ' >= ' + (r1.pagas||[]).length);
  ok('e nao repete id', new Set(fim.achievementsPaid||[]).size === (fim.achievementsPaid||[]).length);

  /* sem login nao resgata */
  let recusou = false;
  try{ await fns.claimAchievementCoins({}); }catch(e){ recusou = true; }
  ok('sem login ele recusa', recusou);

  /* conta sem save nenhum: nao quebra e nao paga */
  const r4 = await fns.claimAchievementCoins({ auth: { uid: "vazio" } });
  ok('conta vazia nao paga nem quebra', r4.ganhou === 0, '🪙 ' + r4.ganhou);
}

rodaOResgate().then(()=>{
  console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
  process.exit(falhas ? 1 : 0);
}).catch(e => { console.error(e); process.exit(1); });

