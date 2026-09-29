/**
 * PAINEL DE TREINADORES -- a leitura de TODAS as contas, no servidor.
 *
 * Por que esta função existe no servidor: a regra do `/users/{userId}` deixa ler só o PRÓPRIO
 * documento, e os saves herdam isso. Não existe consulta de cliente que veja a conta de outro --
 * e afrouxar a regra pra isso abriria o save de todo mundo pra qualquer jogador logado.
 *
 * O que este teste pega:
 *  - a porta abrindo pra quem não é admin (o defeito mais caro possível aqui: vazar a conta alheia);
 *  - alguém se promovendo a admin pelo cliente (a regra do Firestore, lida como texto);
 *  - a paginação lendo sempre a primeira página -- que passa despercebido porque "funciona";
 *  - o slot "10" caindo entre o "1" e o "2" (a armadilha da ordem de TEXTO que já mordeu a liga);
 *  - o time voltando cru, com o save inteiro dentro.
 *
 *   node tools/test-admin.js
 */
const path = require('path');
const Module = require('module');
const fake = require('./fake-firestore');

const db = fake.makeDb();
const authApagados = [];   // ver o duble do auth, logo abaixo
const stubs = {
  'firebase-functions/v2/scheduler': { onSchedule: (a, b)=> (typeof a === 'function' ? a : b) },
  'firebase-functions/v2/https': {
    onCall: (fn)=>fn,
    HttpsError: class HttpsError extends Error { constructor(code, msg){ super(msg); this.code = code; } }
  },
  'firebase-functions/logger': { error(){}, info(){}, warn(){}, log(){} },
  'firebase-admin': {
    initializeApp(){},
    firestore: Object.assign(()=>db, { FieldValue: fake.FieldValue, FieldPath: fake.FieldPath }),
    /* ⚠️ O DUBLE DO AUTH anota em vez de apagar: a exclusao de conta apaga o LOGIN junto, e sem
       isto ela morreria com "admin.auth is not a function" num ponto que nao tem nada a ver com o
       que esta sendo testado. O `authApagados` e o que deixa a trava conferir que ele foi mesmo
       chamado -- olhar so o retorno da funcao provaria que ela DIZ ter apagado, nao que apagou. */
    auth: () => ({ async deleteUser(uid){ authApagados.push(uid); } })
  }
};
const loadOriginal = Module._load;
Module._load = function(req){ if(stubs[req]) return stubs[req]; return loadOriginal.apply(this, arguments); };
const fns = require(path.join(__dirname, '..', 'functions', 'index.js'));
Module._load = loadOriginal;

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const chamar = (uid, dados) => fns.adminListTrainers({ auth: uid ? { uid } : null, data: dados || {} });
const erroDe = async (p) => { try { await p; return null; } catch(e){ return e.code || e.message; } };

(async function(){
  const agora = Date.now();
  /* ---------------------------------------------------------------------------------------
     O CENARIO: um admin, e tres jogadores -- um online agora, um visto ontem, um que nunca
     abriu o jogo. O do meio tem DOIS saves, e um deles no slot 10: e o caso que pega a ordem
     de TEXTO do Firestore ("10" vem entre "1" e "2").
     --------------------------------------------------------------------------------------- */
  await db.collection('users').doc('a_admin').set({ trainerName:'Buzzo', admin:true, lastSeenAt: agora - 1000 });
  await db.collection('users').doc('b_online').set({
    trainerName:'Ash', lastSeenAt: agora - 2*60000, moedas: 140,
    /* o `increment` deixa a chave com ZERO quando o item acaba -- um "0x Poção" na tela seria ruido */
    inventario: { potion: 3, awakening: 0 },
    equipados: { '0:charizard': 'faixa_foco' },
    hms: ['hm01'],
    permanentPokedex: ['bulbasaur','charmander','squirtle'],
    permanentShinyDex: ['charmander'],
    specialties: ['Fire'], leagueWinsTotal: 2, trainerBestStreak: 7,
    accountEliteChampion: true, shinyBonusExpiresAt: agora + 600000,
    mewtwoLoanUnlocked: true, mewtwoLoanActive: false,
    neighborhoodGymLocation: { city: 'São José dos Campos' }
  });
  await db.collection('neighborhoodGyms').doc('sjc').set({ leaderUid:'b_online', city:'São José dos Campos', terrain:'Vulcão' });
  await db.collection('neighborhoodGyms').doc('outra').set({ leaderUid:'zzz_ninguem', city:'Curitiba' });
  await db.collection('users').doc('c_ontem').set({ trainerName:'Misty', lastSeenAt: agora - 26*3600000, rareCandies: 3 });
  await db.collection('users').doc('d_nunca').set({ trainerName:'Brock' });

  await db.collection('users').doc('b_online').collection('saves').doc('0').set({
    trainerName:'Ash', rivalName:'Gary', badgeCount:8, gameMode:'hard', eliteStatus:'champion',
    screen:'journeyEnd', updatedAt: agora - 60000,
    gymIndex: 7, currentRoute:'victory_road', losses: 2, eliteStage: 3, eliteAttemptsUsed: 1,
    hideoutStage: 2, badgesEarned:['Rocha','Cascata'], caughtSpecies:['pidgey','rattata'],
    gymPath:['kanto','johto','kanto','kanto','johto','kanto','kanto','johto'],
    team: [ { speciesId:'charizard', level:70, shiny:true, hp:200, maxHp:220,
              ataques:['flamethrower','wingattack'], item:'faixa_foco' },
            { speciesId:'blastoise', level:68, shiny:false, hp:0, maxHp:230 } ]
  });
  await db.collection('users').doc('c_ontem').collection('saves').doc('1').set({
    trainerName:'Misty', badgeCount:2, team: [ { speciesId:'staryu', level:18 } ]
  });
  await db.collection('users').doc('c_ontem').collection('saves').doc('10').set({
    trainerName:'Misty', badgeCount:0, team: [ { speciesId:'psyduck', level:5 } ]
  });

  /* ======================================================================================
     1) A PORTA. E o unico jeito de ver a conta alheia, entao ela e a coisa mais importante
     daqui: nao ha "meio aberto".
     ====================================================================================== */
  console.log('\n=== A PORTA ===');
  ok('sem login, recusa', await erroDe(chamar(null)) === 'unauthenticated');
  ok('logado mas SEM o campo admin, recusa', await erroDe(chamar('b_online')) === 'permission-denied');
  ok('conta que nem existe, recusa', await erroDe(chamar('fantasma')) === 'permission-denied');
  await db.collection('users').doc('b_online').set({ admin:'sim' }, { merge:true });
  ok('e admin que nao e exatamente true tambem recusa',
     await erroDe(chamar('b_online')) === 'permission-denied', "admin:'sim'");
  await db.collection('users').doc('b_online').set({ admin:false }, { merge:true });
  ok('nem admin:false', await erroDe(chamar('b_online')) === 'permission-denied');
  ok('so o admin passa', await erroDe(chamar('a_admin')) === null);

  /* ⚠️ E A PORTA E UM CAMPO QUE O CLIENTE NAO ESCREVE. O teste le a REGRA como texto: sem isso,
     bastava uma linha no console do navegador pra qualquer jogador se promover e ler a conta de
     todo mundo -- e nada no codigo do servidor acusaria. */
  {
    const regras = require('fs').readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const trechos = regras.split("match /users/{userId}")[1] || '';
    const ateOsSaves = trechos.split('match /saves')[0];
    const linhas = (ateOsSaves.match(/hasAny\(\[[^\]]*\]\)/g) || []);
    ok('a regra protege o campo admin na ESCRITA e na CRIACAO',
       linhas.length === 2 && linhas.every(l => l.indexOf("'admin'") >= 0),
       linhas.length + ' listas de campos protegidos');
  }

  /* ======================================================================================
     2) O QUE ELA DEVOLVE
     ====================================================================================== */
  console.log('\n=== OS TREINADORES ===');
  const r = await chamar('a_admin');
  ok('traz os quatro', r.treinadores.length === 4, r.treinadores.map(t=>t.nome).join(', '));
  ok('e conta quantos estao online', r.online === 2, r.online + ' online');
  ok('a janela de online e a do jogo (10 min)', r.janelaOnlineMs === 10*60000, r.janelaOnlineMs + 'ms');
  const porUid = Object.fromEntries(r.treinadores.map(t => [t.uid, t]));
  ok('quem foi visto ha 2 min esta ONLINE', porUid.b_online.online === true);
  ok('quem foi visto ontem esta offline', porUid.c_ontem.online === false);
  ok('e quem nunca abriu tambem', porUid.d_nunca.online === false && porUid.d_nunca.visto === 0);
  /* ONLINE PRIMEIRO: e a ordem em que a pergunta e feita ("quem esta jogando agora?"). */
  ok('a lista vem do mais recente pro mais antigo',
     r.treinadores.map(t=>t.uid).join(',') === 'a_admin,b_online,c_ontem,d_nunca',
     r.treinadores.map(t=>t.uid).join(','));

  console.log('\n=== OS SAVES E O TIME ===');
  ok('quem nao tem save vem com a lista vazia', porUid.d_nunca.saves.length === 0);
  const ash = porUid.b_online.saves[0];
  ok('o save traz insignias, modo e campeao',
     ash.insignias === 8 && ash.modo === 'hard' && ash.campeao === true,
     ash.insignias + ' insignias, ' + ash.modo + (ash.campeao ? ', campeao' : ''));
  ok('e o time vem com NOME e TIPOS resolvidos (a pagina nao carrega tabela)',
     ash.time[0].nome === 'Charizard' && ash.time[0].tipos.join('/') === 'Fire/Flying',
     JSON.stringify(ash.time[0]));
  ok('com nivel, shiny e a vida', ash.time[0].nivel === 70 && ash.time[0].shiny === true &&
     ash.time[0].hp === 200 && ash.time[0].maxHp === 220);
  ok('e o que caiu aparece com 0 de HP', ash.time[1].hp === 0 && ash.time[1].maxHp === 230);
  /* ⚠️ O SAVE NAO VOLTA INTEIRO. Ele tem dezenas de campos de estado de tela (wildOffer,
     routeCards, battleResult) que nao dizem nada sobre "como esta o time" -- e mandar isso de 20
     treinadores x N saves seria um payload enorme pra desenhar seis etiquetas. */
  ok('o save NAO volta cru', ash.wildOffer === undefined && ash.routeCards === undefined &&
     ash.caughtSpecies === undefined, Object.keys(ash).join(','));

  console.log('\n=== TUDO O QUE ACONTECE NA CONTA ===');
  /* Pedido em 13/09/2026: *"quero saber tudo o que esta acontecendo na conta dos outros treinadores
     sendo o admin do jogo"*. O que se cobra aqui e que cada peca da conta chegue na pagina -- sem
     isso, um campo novo entra no jogo e some do painel sem ninguem ver. */
  {
    const t = porUid.b_online;
    ok('a mochila vem, e sem os itens zerados',
       JSON.stringify(t.itens) === JSON.stringify([{item:'potion', qtd:3}]), JSON.stringify(t.itens));
    ok('o que esta equipado, e em quem', t.equipados.length === 1 &&
       t.equipados[0].chave === '0:charizard' && t.equipados[0].item === 'faixa_foco',
       JSON.stringify(t.equipados));
    ok('os HMs', t.hms.join(',') === 'hm01', t.hms.join(','));
    ok('a pokedex (normal e shiny)', t.pokedex === 3 && t.shinyDex === 1, t.pokedex + ' / ' + t.shinyDex);
    ok('especialidade, ligas e sequencia',
       t.especialidades.join(',') === 'Fire' && t.ligas === 2 && t.sequencia === 7);
    ok('o bonus shiny valendo', t.bonusShinyAte > agora, String(t.bonusShinyAte));
    ok('o emprestimo do Mewtwo', t.mewtwo.liberado === true && t.mewtwo.emprestado === false,
       JSON.stringify(t.mewtwo));
    ok('a cidade do ginasio', t.cidade === 'São José dos Campos', t.cidade);
    /* ⚠️ OS GINASIOS QUE ELE LIDERA saem de UMA consulta pra a pagina inteira (o `in` do Firestore),
       e nao uma por treinador. E eles nao dariam pra deduzir do save: a defesa e um codigo
       CONGELADO, nao o time atual. */
    ok('e os ginasios que ele lidera', t.ginasios.length === 1 && t.ginasios[0].id === 'sjc',
       JSON.stringify(t.ginasios));
    ok('e quem nao lidera nada vem sem ginasio', porUid.c_ontem.ginasios.length === 0);
    ok('o admin aparece marcado', porUid.a_admin.admin === true && t.admin === false);
  }

  console.log('\n=== ONDE A JORNADA ESTA ===');
  {
    const sv = porUid.b_online.saves[0];
    ok('a tela em que ele parou', sv.tela === 'journeyEnd', sv.tela);
    ok('o trecho, a rota e as derrotas do ginasio',
       sv.trecho === 7 && sv.rota === 'victory_road' && sv.derrotas === 2,
       'trecho ' + sv.trecho + ', ' + sv.rota + ', ' + sv.derrotas + ' derrota(s)');
    ok('onde ele parou na Elite', sv.eliteEtapa === 3 && sv.eliteTentativas === 1);
    ok('e no esconderijo da Rocket', sv.rocket === 2);
    ok('as insignias pelo NOME', sv.insigniasNomes.join(',') === 'Rocha,Cascata', sv.insigniasNomes.join(','));
    ok('o caminho Kanto/Johto de cada trecho', sv.caminho.length === 8 && sv.caminho[1] === 'johto',
       sv.caminho.join(','));
    ok('e quantos ele capturou', sv.capturados === 2, String(sv.capturados));
    /* OS GOLPES com o nome em portugues: o GOLPES_PT ja vive no servidor desde o moveset dos NPCs,
       entao a pagina nao precisa de tabela nenhuma. */
    const mon = sv.time[0];
    ok('o time traz os GOLPES, com nome em portugues',
       mon.golpes.length === 2 && mon.golpes[0].nome === 'Lança-Chamas',
       mon.golpes.map(g => g.nome + '(' + g.tipo + ' ' + g.poder + ')').join(', '));
    ok('e o ITEM que ele carrega', mon.item === 'faixa_foco', String(mon.item));
    ok('e quem nao tem golpe escolhido vem com a lista vazia',
       sv.time[1].golpes.length === 0 && sv.time[1].item === null);
  }

  /* ⚠️ A ORDEM DOS SLOTS E NUMERICA. O Firestore devolve por id em ordem de TEXTO, entao o "10"
     vem entre o "1" e o "2" -- a mesma armadilha que ja mordeu a Trainers League. */
  ok('os slots saem em ordem NUMERICA',
     porUid.c_ontem.saves.map(s=>s.slot).join(',') === '1,10',
     porUid.c_ontem.saves.map(s=>s.slot).join(','));

  /* ======================================================================================
     3) A PAGINACAO E QUEM ESTA ONLINE. Ela existe porque o custo e 1 leitura por treinador MAIS
     1 por save -- e o que o bloco abaixo tranca e que a paginacao nao ESCONDA quem esta jogando.
     ====================================================================================== */
  console.log('\n=== A PAGINACAO E QUEM ESTA ONLINE ===');
  /* ⚠️ O CASO REPORTADO EM 13/09/2026: *"hoje tem gente online mas so carrega 20, entao se eu clico
     pra carregar mais, ai carrega mais conta e dessas que carregou mais, tinha gente online porem eu
     so conseguia ver se eu clicasse no carregar mais"*.
     O `z_online` e exatamente esse treinador: esta ONLINE e tem o uid no FIM da ordem do banco, que
     e a ordem em que a pagina caminha. Com o bloco de online, ele tem que sair na PRIMEIRA pagina
     mesmo com limite 2 -- antes ele so aparecia depois de dois cliques em "carregar mais". */
  await db.collection('users').doc('z_online').set({ trainerName:'Gary', lastSeenAt: agora - 60000 });

  const p1 = await chamar('a_admin', { limite: 2 });
  const uidsP1 = p1.treinadores.map(t => t.uid);
  ok('quem esta online no FIM da ordem do banco vem na PRIMEIRA pagina',
     uidsP1.indexOf('z_online') >= 0, uidsP1.join(','));
  ok('e os online vem na frente de todo mundo',
     p1.treinadores.length > 3 && p1.treinadores.slice(0, 3).every(t => t.online) && !p1.treinadores[3].online,
     p1.treinadores.map(t => t.uid + (t.online ? '(on)' : '')).join(','));
  /* A CONTAGEM E A DE VERDADE, e nao a do que foi carregado: era ela que dizia "1 online" numa hora
     em que havia mais. */
  ok('a contagem de online e a da COLECAO, nao a da pagina', p1.online === 3, p1.online + ' online');
  /* ⚠️ E A PAGINA CONTINUA CHEIA. Tirar os repetidos da fatia deixava a pagina curta e, no pior
     caso, VAZIA -- a fatia podia ser so de gente online, e a tela oferecia um "Carregar mais" que
     nao carregava nada. O bloco de online NAO conta pro limite: ele vem por cima. */
  ok('e o limite vale pro resto, que vem cheio',
     p1.treinadores.filter(t => !t.online).length === 2,
     p1.treinadores.filter(t => !t.online).map(t=>t.uid).join(','));
  ok('e ela diz que ha mais', !!p1.proximo, String(p1.proximo));

  /* NINGUEM REPETE E NINGUEM SOME: o teste caminha todas as paginas e confere a conta. */
  const vistos = [];
  let cursor = null, voltas = 0;
  do {
    const pg = await chamar('a_admin', { limite: 2, cursor });
    pg.treinadores.forEach(t => vistos.push(t.uid));
    cursor = pg.proximo;
  } while(cursor && ++voltas < 10);
  const unicos = [...new Set(vistos)].sort();
  ok('ninguem aparece duas vezes nas paginas', vistos.length === unicos.length,
     vistos.join(',') );
  ok('e ninguem some no caminho',
     unicos.join(',') === 'a_admin,b_online,c_ontem,d_nunca,z_online', unicos.join(','));

  const tudo = await chamar('a_admin', { limite: 99 });
  ok('o limite tem teto', tudo.treinadores.length === 5 && tudo.proximo === null,
     tudo.treinadores.length + ' treinadores');


  /* ============================================================================
     O MONITOR DAS ILHAS LARANJA (21/09/2026, a pedido)

     ⚠️ QUEM CONTA E O SERVIDOR, e e isso que a trava cobra: um contador que o cliente escreve nao
     mede nada, e a METRICA e o motivo da feature. E a licao do registrantCount da Liga Classica.
     ============================================================================ */
  console.log('');
  console.log('=== O MONITOR DAS ILHAS ===');
  {
    await db.collection('users').doc('m1').set({ trainerName: 'Monitorado', lastSeenAt: Date.now() });

    /* sem login nao conta */
    let recusou = false;
    try { await fns.registerIslandPlay({ data: { ilha: 'mikan' } }); }
    catch(e){ recusou = e.code === 'unauthenticated'; }
    ok('sem login a callable recusa', recusou);

    /* ⚠️ ILHA DESCONHECIDA RECUSA: sem a lista fechada, um cliente forjado escreveria chave
       qualquer no documento e o mapa viraria lixo que ninguem limpa de fora. */
    for(const lixo of ['', 'xxx', 'MIKAN', '__proto__', 'a'.repeat(200)]){
      let barrou = false;
      try { await fns.registerIslandPlay({ auth: { uid: 'm1' }, data: { ilha: lixo } }); }
      catch(e){ barrou = e.code === 'invalid-argument'; }
      ok('  e ' + JSON.stringify(lixo.slice(0, 12)) + ' e recusado', barrou);
    }

    /* conta de verdade, e ACUMULA */
    await fns.registerIslandPlay({ auth: { uid: 'm1' }, data: { ilha: 'mikan' } });
    await fns.registerIslandPlay({ auth: { uid: 'm1' }, data: { ilha: 'mikan' } });
    await fns.registerIslandPlay({ auth: { uid: 'm1' }, data: { ilha: 'navel' } });
    const doc = (await db.collection('users').doc('m1').get()).data() || {};
    ok('a partida e contada por jogo', (doc.ilhasJogadas || {}).mikan === 2,
       JSON.stringify(doc.ilhasJogadas));
    ok('  e cada jogo tem a sua conta', (doc.ilhasJogadas || {}).navel === 1);
    /* ⚠️ E O RESTO DO DOCUMENTO NAO E TOCADO -- o `merge` e o que impede o contador de apagar a
       conta inteira, e um `set` sem ele faria exatamente isso. */
    ok('  e o resto da conta continua inteiro', doc.trainerName === 'Monitorado', doc.trainerName);

    /* ⚠️ E O PAINEL O DEVOLVE -- ZERO leitura a mais: o documento ja estava em maos. */
    const lista = await fns.adminListTrainers({ auth: { uid: 'a_admin' }, data: {} });
    const eu = (lista.treinadores || []).find(t => t.uid === 'm1');
    ok('o painel devolve o monitor', !!eu && Array.isArray(eu.ilhas), eu ? JSON.stringify(eu.ilhas) : 'sem o treinador');
    ok('  ordenado pelo MAIS jogado', !!eu && eu.ilhas[0] && eu.ilhas[0].ilha === 'mikan' && eu.ilhas[0].vezes === 2,
       eu ? JSON.stringify(eu.ilhas) : '');
    /* ⚠️ E COM O ZERO FORA: o `increment` deixa a chave em 0 quando um contador zera, e um
       "0x Corrida" na tela seria ruido -- e a mesma regra do inventario. */
    await db.collection('users').doc('m1').set({ ilhasJogadas: { trovita: 0 } }, { merge: true });
    const lista2 = await fns.adminListTrainers({ auth: { uid: 'a_admin' }, data: {} });
    const eu2 = (lista2.treinadores || []).find(t => t.uid === 'm1');
    ok('  e o zero fica de fora', !!eu2 && !eu2.ilhas.some(i => i.ilha === 'trovita'),
       eu2 ? JSON.stringify(eu2.ilhas) : '');

    /* quem nunca jogou vem com a lista vazia, e nao com undefined -- a tela faz `.forEach` nela */
    await db.collection('users').doc('m2').set({ trainerName: 'Nunca jogou' });
    const lista3 = await fns.adminListTrainers({ auth: { uid: 'a_admin' }, data: {} });
    const outro = (lista3.treinadores || []).find(t => t.uid === 'm2');
    ok('  e quem nunca jogou vem com lista VAZIA', !!outro && Array.isArray(outro.ilhas) && outro.ilhas.length === 0);

    /* ⚠️ E O CAMPO ESTA NA TRAVA DAS REGRAS: e ela que faz o contador valer alguma coisa. */
    const regras = require('fs').readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const trechos = regras.split('ilhasJogadas').length - 1;
    ok('e o `ilhasJogadas` esta travado no write E no create', trechos >= 2, trechos + ' ocorrencia(s)');
  }

  console.log('');

/* ============================================================================
   A SEÇÃO DA FILA NO PAINEL (21/09/2026)

   ⚠️ O PAINEL NÃO TEM SUÍTE DE TELA -- ele é uma página à parte, sem o sandbox do jogo. O que dá
   pra trancar aqui é o CÓDIGO dele, e são justamente as três coisas que o navegador não perdoaria:
   o `onclick` com o argumento entre ASPAS, a porta sendo a mesma do resto, e o botão só aparecendo
   onde a callable aceitaria.
   ============================================================================ */
console.log('\n=== A FILA DA LIGA NO PAINEL ===');
{
  const painel = require('fs').readFileSync(path.join(__dirname, '..', 'admin-treinadores.html'), 'utf8');

  ok('(e a trava lê o painel)', painel.length > 5000, painel.length + ' chars');
  ok('a caixa da fila existe', /function filaHtml\(\)/.test(painel));
  ok('  e ela é desenhada na tela', /\$\{filaHtml\(\)\}/.test(painel));
  ok('  e carregada no login', /if\(u\)\{ carregar\(null\); carregarFila\(\); \}/.test(painel),
     'a fila só apareceria depois de um clique em Atualizar');
  ok('  e zerada quando a conta muda', /estado\.fila = null;/.test(painel),
     'a fila de uma sessão anterior ficaria na tela');

  /* ⚠️ O ARGUMENTO VAI ENTRE ASPAS NO `onclick`. É a lição do montador de time (20/09): um valor
     sem aspas vira sintaxe inválida no atributo, o clique NÃO FAZ NADA e **não há erro no
     console** -- a tela continua parecendo certa. Aqui os dois argumentos são strings (uid e
     ⚠️ E O PADRAO NAO PODE PARAR NO PRIMEIRO parêntese: os argumentos TEM parênteses dentro, e a
     primeira versao casava com ZERO handlers -- passando em branco sobre o defeito que ela existe
     pra pegar. Quem denunciou foi o `ok` de "os handlers existem", a rede de toda varredura daqui.
     slot), e é exatamente o caso em que isso morde. */
  const handlers = [...painel.matchAll(/on\w+="(inscreverNaFila|removerDaFila)\((.*?)\)"/g)];
  ok('os handlers da fila existem', handlers.length >= 2, handlers.length + ' handlers');
  handlers.forEach(m => {
    const args = m[2].split(',').map(a => a.trim());
    ok('  ' + m[1] + ' manda os argumentos entre aspas',
       args.every(a => /^'.*'$/.test(a)), m[2]);
  });

  /* ⚠️ E O `esc` CORRE EM CIMA: o nome do treinador é texto que ele escolheu, e ele entra no
     `onclick` do Remover. Sem escapar, uma aspa no nome fecha o atributo. */
  ok('  e o conteúdo passa pelo `esc`',
     /removerDaFila\('\$\{esc\(x\.uid\)\}', '\$\{esc\(x\.nome\)\}'\)/.test(painel),
     'nome de treinador é texto do jogador');

  /* ⚠️ O BOTÃO SÓ ONDE A CALLABLE ACEITARIA: 8 insígnias, com time, não aposentado -- e quem já
     está na fila vê o estado, não o botão. Oferecer a ação num save que o servidor vai recusar é
     pior que não oferecer. */
  const i = painel.indexOf('function botaoDaLigaHtml');
  const corpo = i >= 0 ? painel.slice(i, painel.indexOf('async function inscreverNaFila', i)) : '';
  ok('(e a trava lê o botão do save)', corpo.length > 100, corpo.length + ' chars');
  ok('o botão exige as 8 insígnias', /insignias \|\| 0\) < 8/.test(corpo));
  ok('  e um time montado', /!s\.time\.length/.test(corpo));
  ok('  e recusa o time aposentado', /s\.aposentado/.test(corpo));
  ok('  e quem já está na fila vê o ESTADO, não o botão', /jaInscrito/.test(corpo));

  /* ⚠️ E O SLOT SAI COM O MESMO RÓTULO DO RESTO DO PAINEL: ele mostra `Slot ${slot + 1}` (o slot 0
     é o "Slot 1", como o jogador vê na home), e a fila mostrava o número CRU -- a mesma inscrição
     aparecia como "save 0" na fila e "Slot 1" no card. */
  ok('o rótulo do slot é o mesmo do painel', /function rotuloDoSlot\(slot\)/.test(painel));
  ok('  e a fila o usa', /rotuloDoSlot\(x\.slot\)/.test(painel));
  ok('  e o aviso do card também', /rotuloDoSlot\(jaInscrito\.slot\)/.test(painel));

  /* ⚠️ E AS DUAS AÇÕES RECARREGAM A FILA em vez de remendar a lista em memória: o que a tela
     mostra passa a ser o que o servidor tem. */
  ['inscreverNaFila', 'removerDaFila'].forEach(nome => {
    const j = painel.indexOf('async function ' + nome);
    const c = j >= 0 ? painel.slice(j, j + 900) : '';
    ok('  ' + nome + ' recarrega a fila no fim', /await carregarFila\(\);/.test(c),
       c.length ? 'ela ficaria mostrando o estado de antes' : 'não achei a função');
  });

  /* ⚠️ REMOVER PERGUNTA ANTES: é a inscrição de OUTRA pessoa, e ela não tem como saber que saiu. */
  const k = painel.indexOf('async function removerDaFila');
  ok('  e remover pergunta antes', /confirm\(/.test(painel.slice(k, k + 400)));

  /* ⚠️ O `aposentado` TEM QUE CHEGAR DO SERVIDOR, senão o painel nunca sabe que aquele time é
     recusado -- ele tem as 8 insígnias e parece elegível. */
  const srv = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  const res = srv.slice(srv.indexOf('function adminResumoDoSave'), srv.indexOf('exports.adminListTrainers'));
  ok('o resumo do save manda o `aposentado`', /aposentado: !!\(s && s\.aposentado\)/.test(res),
     'o painel ofereceria a inscrição de um time aposentado');
}


  console.log('\nAPAGAR UMA CONTA INTEIRA (29/09/2026)');
  {
    /* ⚠️ A CONTA E ESPALHADA DE PROPOSITO, em todos os lugares que o mapa achou: e um painel que
       so testasse `users/{uid}` daria verde com a conta viva em nove outros lugares -- e o sintoma
       seria ela reaparecer num ranking meses depois, que e mudo.
       ⚠️ E A TRAVA QUE IMPORTA NAO E UMA LISTA DE LUGARES: e o STORE INTEIRO varrido no fim, sem
       achar o uid em canto nenhum. Uma lista so prova o que EU lembrei; a varredura prova o resto. */
    const ALVO = 'uidAlvo', OUTRO = 'uidAmigo', ADM = 'uidAdmin';
    const montar = async () => {
      await db.collection('users').doc(ADM).set({ admin: true, trainerName: 'O Chefe' });
      await db.collection('users').doc(ALVO).set({ trainerName: 'Fulano', leagueWinsTotal: 3 });
      await db.collection('users').doc(ALVO).collection('saves').doc('0').set({ badgeCount: 8 });
      await db.collection('users').doc(ALVO).collection('saves').doc('1').set({ badgeCount: 2 });
      await db.collection('users').doc(ALVO).collection('notifications').doc('n1').set({ tipo: 'x' });
      /* a amizade e ESPELHADA: os dois lados existem */
      await db.collection('users').doc(ALVO).collection('friends').doc(OUTRO).set({ uid: OUTRO });
      await db.collection('users').doc(OUTRO).collection('friends').doc(ALVO).set({ uid: ALVO });
      await db.collection('users').doc(ALVO).collection('friendRequests').doc(OUTRO).set({ uid: OUTRO });
      await db.collection('users').doc(OUTRO).collection('friendRequests').doc(ALVO).set({ uid: ALVO });
      await db.collection('users').doc(OUTRO).set({ trainerName: 'Cicrano' });
      /* colecoes de topo com o uid como id -- inclusive uma que o codigo NUNCA nomeia */
      await db.collection('trainerTowerRanking').doc(ALVO).set({ topDays: 4 });
      await db.collection('trainerTowerRuns').doc(ALVO).set({ dia: 'x' });
      await db.collection('fishingRanking').doc(ALVO).set({ pontos: 900 });
      await db.collection('arenaRanking').doc(ALVO).set({ nivel: 12 });
      await db.collection('onlineBattlePointer').doc(ALVO).set({ battleId: 'b1' });
      await db.collection('colecaoQueNinguemNomeia').doc(ALVO).set({ algo: 1 });
      /* os que usam OUTRA chave */
      await db.collection('neighborhoodGyms').doc('g1').set({ leaderUid: ALVO, leaderName: 'Fulano' });
      await db.collection('neighborhoodGymActiveDefenses').doc(ALVO + '_0').set({ gymId: 'g1' });
      await db.collection('rivalries').doc([ALVO, OUTRO].sort().join('__')).set({ a: 1 });
      await db.collection('rivalries').doc(['aaaOutro', ALVO].sort().join('__')).set({ b: 2 });
      await db.collection('rivalries').doc('semRelacao__comEle').set({ c: 3 });
      await db.collection('leagueCycles').doc('c1').collection('registrants').doc(ALVO).set({ uid: ALVO });
      await db.collection('trainersLeagueCycles').doc('d1').collection('registrants').doc(ALVO).set({ uid: ALVO });
      await db.collection('trainersLeagueCycles').doc('d1').collection('teamPicks').doc(ALVO).set({ overrides: {} });
      await db.collection('trainersLeagueCycles').doc('d1').collection('terrainPicks').doc(ALVO).set({ picks: {} });
      await db.collection('fishingRankingWeekly').doc('2026-09-21').collection('players').doc(ALVO).set({ pontos: 5 });
      await db.collection('arenaRankingWeekly').doc('2026-09-21').collection('players').doc(ALVO).set({ nivel: 3 });
      await db.collection('globalBoss').doc('mew').collection('players').doc(ALVO).set({ dano: 100 });
      await db.collection('globalBoss').doc('mewRank').set({ top: [{ uid: ALVO, dano: 100 }, { uid: OUTRO, dano: 50 }] });
      await db.collection('leagues').doc('champions_alltime_classic').set({
        lista: [{ uid: ALVO, name: 'Fulano' }, { uid: OUTRO, name: 'Cicrano' }] });
      /* ⚠️ E UM DE OUTRA PESSOA EM CADA LUGAR: sem eles, uma exclusao que apagasse a colecao
         INTEIRA passaria em todas as travas de "sumiu". */
      await db.collection('fishingRanking').doc(OUTRO).set({ pontos: 10 });
      await db.collection('trainerTowerRanking').doc(OUTRO).set({ topDays: 1 });
      await db.collection('fishingRankingWeekly').doc('2026-09-21').collection('players').doc(OUTRO).set({ pontos: 7 });
      await db.collection('globalBoss').doc('mew').collection('players').doc(OUTRO).set({ dano: 50 });
      await db.collection('trainerTowerDays').doc('2026-09-21').collection('players').doc(OUTRO).set({ dias: 2 });
      await db.collection('leagueCycles').doc('c1').collection('registrants').doc(OUTRO).set({ uid: OUTRO });
      await db.collection('neighborhoodGymActiveDefenses').doc(OUTRO + '_0').set({ gymId: 'g2' });
    };
    const req = (data, quem) => ({ auth: { uid: quem || ADM }, data });
    const temOAlvo = () => Object.entries(fake.dump())
      .filter(([k, v]) => k.indexOf(ALVO) >= 0 || JSON.stringify(v).indexOf(ALVO) >= 0)
      .map(([k]) => k);

    fake.reset(); await montar();
    const antes = temOAlvo().length;
    ok('  (o painel espalha a conta de verdade)', antes >= 20, antes + ' lugares com o uid');

    /* FASE 1: o inventario NAO pode apagar nada -- e o que o admin ve antes de confirmar */
    const inv = await fns.adminDeleteTrainer(req({ uid: ALVO }));
    ok('o inventario nao apaga nada', temOAlvo().length === antes,
       antes + ' -> ' + temOAlvo().length);
    ok('  e ele diz o nome do treinador', inv.nome === 'Fulano', String(inv.nome));
    ok('  e conta o que seria apagado', inv.fase === 'inventario' && inv.total > 0, 'total=' + inv.total);
    ok('  e a colecao que NINGUEM nomeia aparece no inventario (ela foi descoberta)',
       inv.itens.some(i => i.onde === 'colecaoQueNinguemNomeia'),
       inv.itens.map(i => i.onde).join(', ').slice(0, 120));

    /* A CONFIRMACAO POR NOME: e a unica barreira contra o clique errado num painel paginado */
    let recusou = '';
    try{ await fns.adminDeleteTrainer(req({ uid: ALVO, confirmarNome: 'nome errado' })); }
    catch(e){ recusou = e.message; }
    ok('sem o nome certo ele RECUSA', /nao confere|não confere/.test(recusou), recusou.slice(0, 60));
    ok('  e nada foi apagado na recusa', temOAlvo().length === antes);

    /* O ADMIN NAO SE APAGA */
    let seuProprio = '';
    try{ await fns.adminDeleteTrainer(req({ uid: ADM, confirmarNome: 'O Chefe' })); }
    catch(e){ seuProprio = e.message; }
    ok('o admin nao pode apagar a PROPRIA conta', /propria|própria/.test(seuProprio), seuProprio.slice(0, 60));

    /* E QUEM NAO E ADMIN NAO CHEGA PERTO */
    let semPermissao = '';
    try{ await fns.adminDeleteTrainer(req({ uid: ALVO }, OUTRO)); }
    catch(e){ semPermissao = e.code || e.message; }
    ok('  e quem nao e admin nao chama', /permission-denied/.test(semPermissao), String(semPermissao));

    /* FASE 2: apaga */
    const feito = await fns.adminDeleteTrainer(req({ uid: ALVO, confirmarNome: 'Fulano' }));
    ok('apagou', feito.fase === 'apagado', JSON.stringify(feito.fase));

    /* ⚠️ A TRAVA QUE IMPORTA: o STORE INTEIRO, sem o uid em canto nenhum. */
    const sobrou = temOAlvo();
    ok('o uid nao existe em NENHUM lugar do banco', sobrou.length === 0,
       sobrou.length ? sobrou.slice(0, 6).join('  |  ') : '');

    /* e o que era dos OUTROS continua la -- uma exclusao que limpasse demais passaria na de cima */
    const d = fake.dump();
    /* ⚠️ UM VIZINHO EM CADA LUGAR QUE A EXCLUSAO TOCA. Sem os quatro ultimos, uma exclusao que
       apagasse a subcolecao inteira (em vez de so o documento do alvo) passava MUDO -- foi a
       conferencia de acusacao que cobrou. */
    const doOutro = ['fishingRanking/' + OUTRO, 'trainerTowerRanking/' + OUTRO, 'users/' + OUTRO,
                     'rivalries/semRelacao__comEle',
                     'fishingRankingWeekly/2026-09-21/players/' + OUTRO,
                     'globalBoss/mew/players/' + OUTRO,
                     'trainerTowerDays/2026-09-21/players/' + OUTRO,
                     'leagueCycles/c1/registrants/' + OUTRO,
                     'neighborhoodGymActiveDefenses/' + OUTRO + '_0'];
    const sumiram = doOutro.filter(k => !d[k]);
    ok('  e o que e de OUTRA pessoa continua, em TODO lugar que a exclusao toca',
       sumiram.length === 0, sumiram.length ? 'levou junto: ' + sumiram.join('  |  ') : doOutro.length + ' conferidos');
    ok('  e o espelho da amizade sumiu do lado DELE', !d['users/' + OUTRO + '/friends/' + ALVO]);
    ok('  e o ginasio ficou VAGO, nao apagado',
       !!d['neighborhoodGyms/g1'] && d['neighborhoodGyms/g1'].leaderUid === null,
       JSON.stringify((d['neighborhoodGyms/g1'] || {}).leaderUid));
    ok('  e o top da raide perdeu so ele', Array.isArray((d['globalBoss/mewRank'] || {}).top) &&
       d['globalBoss/mewRank'].top.length === 1 && d['globalBoss/mewRank'].top[0].uid === OUTRO);
    ok('  e o mural de campeoes perdeu so ele',
       ((d['leagues/champions_alltime_classic'] || {}).lista || []).length === 1);
    ok('  e o login foi apagado', feito.loginApagado === true && authApagados.indexOf(ALVO) >= 0,
       JSON.stringify(authApagados));

    /* ⚠️ CONTA SEM NOME: ela existe (ha contas sem trainerName), e sem esta regra ela seria
       IMPOSSIVEL de apagar -- a confirmacao pediria uma string vazia. */
    fake.reset();
    await db.collection('users').doc(ADM).set({ admin: true, trainerName: 'O Chefe' });
    await db.collection('users').doc('semNome').set({ lastSeenAt: 1 });
    const inv2 = await fns.adminDeleteTrainer(req({ uid: 'semNome' }));
    ok('conta SEM nome: o inventario funciona', inv2.fase === 'inventario' && inv2.nome === '');
    const f2 = await fns.adminDeleteTrainer(req({ uid: 'semNome', confirmarNome: 'semNome' }));
    ok('  e a confirmacao dela e o proprio uid', f2.fase === 'apagado' && !fake.dump()['users/semNome']);

    /* ⚠️ CONTA QUE NAO EXISTE nao pode estourar: o painel e paginado e o admin pode clicar duas
       vezes -- a segunda tem que ser um no-op, nao um erro na cara dele. */
    const f3 = await fns.adminDeleteTrainer(req({ uid: 'naoExiste', confirmarNome: 'naoExiste' }));
    ok('apagar uma conta que nao existe nao estoura', f3.fase === 'apagado' && f3.total === 0,
       'total=' + f3.total);
  }


  {
    /* ⚠️ A TELA DO PAINEL, lida do HTML: os casos acima dirigem a CALLABLE, e passariam com a
       tela chamando errado -- ou nem chamando. */
    const painel = require('fs').readFileSync(path.join(__dirname, '..', 'admin-treinadores.html'), 'utf8');
    ok('o painel tem a zona de perigo no card', /zonaDePerigoHtml\(t\)/.test(painel));
    ok('  e ela vem DEPOIS dos saves (nao divide espaco com as acoes de liga)',
       painel.indexOf('zonaDePerigoHtml(t)') > painel.indexOf('t.saves.map(sv => saveHtml'));
    /* ⚠️ A FASE 1 NAO PODE MANDAR O NOME: mandando, ela viraria a exclusao direta e o inventario
       -- que e o degrau inteiro da confirmacao -- deixaria de existir. */
    const iVer = painel.indexOf('async function verOQueSeriaApagado');
    const corpoVer = painel.slice(iVer, painel.indexOf('\n}', iVer));
    ok('a fase 1 chama a callable SEM o nome (so inventaria)',
       /adminDeleteTrainer'\)\(\{ uid \}\)/.test(corpoVer), corpoVer.slice(0, 0) + 'ok');
    ok('  e ela nao manda confirmarNome', corpoVer.indexOf('confirmarNome') < 0);
    const iAp = painel.indexOf('async function apagarDeVerdade');
    const corpoAp = painel.slice(iAp, painel.indexOf('\n}', iAp));
    ok('a fase 2 manda o confirmarNome', /confirmarNome:/.test(corpoAp));
    ok('  e a conta sai da lista depois de apagada', /estado\.treinadores.*filter/.test(corpoAp));
    /* ⚠️ O BOTAO SO DESTRAVA COM O NOME EXATO -- e a barreira contra o clique errado num painel
       paginado, onde o card de cada treinador e igual ao do vizinho. */
    const iZona = painel.indexOf('function zonaDePerigoHtml');
    const corpoZona = painel.slice(iZona, painel.indexOf('\nasync function verOQueSeriaApagado', iZona));
    ok('o botao de apagar so destrava com o nome EXATO',
       /\(inv\.digitado \|\| ''\)\.trim\(\) === esperado/.test(corpoZona));
    ok('  e o esperado cai no uid quando a conta nao tem nome',
       /const esperado = inv\.nome \|\| t\.uid/.test(corpoZona));
    ok('  e o inventario e mostrado item por item antes do campo',
       corpoZona.indexOf('perigo-lista') > 0 &&
       corpoZona.indexOf('perigo-lista') < corpoZona.indexOf('perigo-campo'));
    /* ⚠️ O QUE FOI DIGITADO MORA NO ESTADO, e nao so no campo: o `render()` recria o HTML inteiro
       a cada toque, entao o valor se perderia a cada letra e o botao nunca destravaria. */
    const iDig = painel.indexOf('function digitouConfirmacao');
    const corpoDig = painel.slice(iDig, painel.indexOf('\n}', iDig));
    ok('o texto digitado e guardado no estado (o render recria o campo a cada letra)',
       /estado\.apagar\[uid\]\.digitado = valor/.test(corpoDig));
    ok('  e o cursor volta pro campo depois do render', /\.focus\(\)/.test(corpoDig));
    /* e o CSS da zona existe -- marcacao certa com estilo faltando e a familia que este projeto
       ja pagou tres vezes */
    ok('  e a zona tem estilo proprio (ela nao pode parecer uma acao de liga)',
       /\.perigo-zona\{/.test(painel) && /\.perigo-campo\{/.test(painel));
  }

  console.log(falhas === 0 ? 'Tudo certo.' : falhas + ' FALHA(S)');
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
