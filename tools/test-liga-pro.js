/**
 * LIGA PRO (23/09/2026) -- a liga em que o TIME e sorteado, nao trazido de casa.
 *
 * Pedida assim: *"crie a liga Pro, onde quando o usuario se inscrever, sera sorteado 12 pokemons e
 * ele tera que escolher 6 desses 12 para ir para a liga. A liga sempre vai estabelecer um ciclo,
 * em que vai respeitar uma ordenacao ... primeiro 55-70, depois 15-30, depois 35-50 ... cada
 * pokemon tem 5% de chance de ser shiny, e os pokemons nao podem se repetir ... sempre respeitar a
 * evolucao de acordo com o level ... se nao fechar 8 treinadores, continua os que estao na fila ate
 * fechar no minimo 8 treinadores, so quando acontecer um campeonato de uma faixa de level, que o
 * troca a faixa de level. A mecanica e toda igual a Liga Classica, a unica diferenca e na hora de
 * se inscrever"*.
 *
 * O QUE ESTE ARQUIVO TRANCA -- e por que cada coisa esta aqui:
 *
 *   O BOLO
 *     - 12, sempre, sem repetir LINHA evolutiva (e nao so "especie diferente": duas entradas
 *       diferentes viram a MESMA forma no mesmo nivel);
 *     - todos dentro da faixa da rodada, e na FORMA que existe naquele nivel (a licao da Vigilia,
 *       relatada em 14/09/2026: *"esta aparecendo Charizard no level 24"*);
 *     - sem lendario nem intocavel -- e o MEWTWO precisa ser nomeado, porque ele nao esta em
 *       nenhuma das duas listas do jogo;
 *     - shiny a 5%, medido;
 *     - SEMEADO por `uid + cycleId`: sair e voltar devolve o MESMO bolo (a trava anti re-sorteio,
 *       a mesma do encontro selvagem), e os DOIS motores tem que dar exatamente o mesmo.
 *
 *   A FAIXA
 *     - gira 55-70 -> 15-30 -> 35-50, nessa ordem;
 *     - e CARIMBADA no ciclo (lida da agenda na hora, ela mudaria debaixo de quem ja se inscreveu);
 *     - e so ANDA quando a liga ACONTECE.
 *
 *   A VALIDACAO DO SERVIDOR -- a parte que impede time forjado. A inscricao da liga e ESCRITA
 *     DIRETA do cliente (nao passa por callable), entao o unico lugar onde da pra conferir e o
 *     `drawCycle`: ele REFAZ o bolo de cada inscrito, porque o sorteio e deterministico.
 *
 *   A TELA -- 12 cards, escolhe 6, e quem RECUSA e a ACAO.
 *
 *   node tools/test-liga-pro.js
 */
const path = require('path');
const raiz = path.join(__dirname, '..');
const S = require('./game-sandbox.js').createSandbox(path.join(raiz, 'index.html'));
const srv = require(path.join(raiz, 'functions', 'index.js'));
const src = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
const srvSrc = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');

let falhas = 0, total = 0;
function ok(nome, cond, extra){
  total++;
  if(cond){ console.log('  OK     ' + nome + (extra !== undefined ? '   ' + extra : '')); }
  else { falhas++; console.log('  FALHA  ' + nome + (extra !== undefined ? '   ' + extra : '')); }
}

/* ============================================================================
   1) AS CONSTANTES E A ORDEM DAS FAIXAS
   ============================================================================ */
console.log('\n=== AS FAIXAS ===');
{
  /* ⚠️ AS CONSTANTES SAO LIDAS DO SERVIDOR, que as exporta: `const` dentro do sandbox do cliente
     nao vira propriedade do objeto (a licao do `const` que nao vira global, que a Queimada ja
     custou). O que a trava compara entre os dois lados e o COMPORTAMENTO, logo abaixo. */
  ok('sao 12 sorteados e 6 escolhidos', srv._PRO_SORTEADOS === 12 && srv._PRO_ESCOLHE === 6,
     srv._PRO_SORTEADOS + ' / ' + srv._PRO_ESCOLHE);
  /* ⚠️ A ORDEM E A PEDIDA, e ela importa: o pedido nomeia as tres na sequencia em que elas
     acontecem. Uma ordem diferente daria as mesmas faixas num ciclo que nao e o pedido. */
  ok('  e a ordem e 55-70, 15-30, 35-50',
     JSON.stringify(srv._PRO_FAIXAS) === JSON.stringify([[55,70],[15,30],[35,50]]),
     JSON.stringify(srv._PRO_FAIXAS));
  /* ⚠️ A ROTACAO E CIRCULAR e tolera indice fora: a faixa vem de um contador que so cresce, e
     sem o modulo ela sairia `undefined` na quarta liga -- um bolo sem faixa nenhuma. */
  ok('  e ela gira (a 4a volta ao comeco)',
     JSON.stringify(srv._proFaixaDe(3)) === JSON.stringify([55,70])
     && JSON.stringify(srv._proFaixaDe(4)) === JSON.stringify([15,30]));
  ok('  e indice negativo ou absurdo nao quebra',
     Array.isArray(srv._proFaixaDe(-1)) && Array.isArray(srv._proFaixaDe(999)),
     JSON.stringify(srv._proFaixaDe(-1)) + ' / ' + JSON.stringify(srv._proFaixaDe(999)));
  /* ⚠️ CICLO SEM O CAMPO CAI NA FAIXA 0, que e a primeira pedida: a Liga Pro nasce hoje e nao ha
     ciclo antigo, mas a rede existe pelo mesmo motivo que log velho nao pode sumir. */
  ok('  e ciclo sem o campo cai na primeira faixa',
     srv._proFaixaDoCiclo({ id: 'x' }) === 0 && srv._proFaixaDoCiclo(null) === 0);
  ok('  e ciclo com o campo usa o dele', srv._proFaixaDoCiclo({ proFaixa: 2 }) === 2);
}

/* ============================================================================
   2) O BOLO DOS 12
   ============================================================================ */
console.log('\n=== O BOLO DOS 12 ===');
{
  let curto = 0, foraFaixa = 0, linhaRep = 0, formaErr = 0, proibido = 0, div = 0;
  let shinies = 0, totalMon = 0;
  const N = 600;
  for(let i = 0; i < N; i++){
    const f = i % 3, uid = 'u' + i, cid = String(1758600000000 + i * 3600000);
    const bC = S.proSorteiaBolo(uid, cid, f), bS = srv._proSorteiaBolo(uid, cid, f);
    if(JSON.stringify(bC) !== JSON.stringify(bS)) div++;
    if(bC.length !== srv._PRO_SORTEADOS) curto++;
    const [mi, ma] = srv._proFaixaDe(f);
    const linhas = bC.map(p => S.raizDaLinha(p.id));
    foraFaixa += bC.filter(p => p.level < mi || p.level > ma).length;
    linhaRep += linhas.length - new Set(linhas).size;
    formaErr += bC.filter(p => S.formaNoNivel(p.id, p.level) !== p.id).length;
    proibido += bC.filter(p => S.proForaDoBolo().indexOf(p.id) >= 0).length;
    shinies += bC.filter(p => p.shiny).length;
    totalMon += bC.length;
  }
  ok('o bolo tem sempre 12', curto === 0, curto + ' curtos em ' + N);
  ok('  e todos dentro da faixa da rodada', foraFaixa === 0, foraFaixa + ' fora');
  /* ⚠️ SEM REPETIR LINHA EVOLUTIVA, e nao so "especie diferente": charmander e charmeleon no nivel
     40 sao os DOIS Charizard. Pela linha os 12 saem distintos por construcao. */
  ok('  e sem repetir LINHA evolutiva', linhaRep === 0, linhaRep + ' repetidas');
  /* ⚠️ A FORMA TEM QUE BATER COM O NIVEL -- foi o pedido ao pe da letra, e e a licao da Vigilia:
     o `especieNoNivel` sozinho so anda PRA FRENTE, e quem sorteia da dex inteira nao tem piso
     nenhum pra barrar. Medido la: 28,5% dos sorteados eram forma que nao existe naquele nivel. */
  ok('  e na FORMA que existe naquele nivel', formaErr === 0, formaErr + ' erradas');
  ok('  e sem lendario nem intocavel', proibido === 0, proibido + ' proibidos');
  /* ⚠️ O MEWTWO PRECISA SER NOMEADO: ele NAO esta no `LENDARIOS` (a lista dos capturaveis em rota)
     nem no `ESPECIES_INTOCAVEIS` (os tres que ninguem pega). A primeira versao o deixava passar. */
  ['mewtwo', 'mew', 'lugia', 'hooh', 'celebi', 'articuno', 'raikou'].forEach(id => {
    ok('  o `' + id + '` esta fora do bolo', S.proForaDoBolo().indexOf(id) >= 0);
  });
  const p = shinies / totalMon, sig = Math.sqrt(.05 * .95 / totalMon);
  ok('  e o shiny e 5% por pokemon', Math.abs(p - .05) / sig < 4,
     (100 * p).toFixed(2) + '% em ' + totalMon + ' (' + ((p - .05) / sig).toFixed(1) + ' sigma)');
  /* ⚠️ OS DOIS MOTORES TEM QUE DAR O MESMO BOLO: o cliente sorteia e o servidor REFAZ pra
     validar. Divergindo, a inscricao legitima seria DESCARTADA no sorteio -- e em silencio. */
  ok('  e os DOIS motores dao o mesmo bolo', div === 0, div + ' divergencias em ' + N);
}

/* ============================================================================
   3) A SEMENTE -- a trava anti re-sorteio
   ============================================================================ */
console.log('\n=== A SEMENTE ===');
{
  const a = S.proSorteiaBolo('u', 'c', 0);
  ok('a mesma semente da o MESMO bolo (sair e voltar nao muda)',
     JSON.stringify(a) === JSON.stringify(S.proSorteiaBolo('u', 'c', 0)));
  ok('  e outro CICLO da outro bolo',
     JSON.stringify(S.proSorteiaBolo('u', 'c1', 0)) !== JSON.stringify(S.proSorteiaBolo('u', 'c2', 0)));
  ok('  e outro TREINADOR da outro bolo',
     JSON.stringify(S.proSorteiaBolo('u1', 'c', 0)) !== JSON.stringify(S.proSorteiaBolo('u2', 'c', 0)));
  /* ⚠️ E A FAIXA MUDA O BOLO MANTENDO A LINHA: o mesmo sorteio base, noutra faixa, devolve a
     forma daquele nivel. E isso que faz o pedido do charmander/charmeleon/charizard valer. */
  const b0 = S.proSorteiaBolo('u', 'c', 0), b1 = S.proSorteiaBolo('u', 'c', 1);
  const mesmasLinhas = b0.every((p, i) => S.raizDaLinha(p.id) === S.raizDaLinha(b1[i].id));
  ok('  e a mesma semente noutra faixa da as MESMAS linhas, noutra forma',
     mesmasLinhas && b0.some((p, i) => p.id !== b1[i].id),
     b0.slice(0,3).map((p,i) => p.id + '->' + b1[i].id).join(', '));
}

/* ============================================================================
   4) A VALIDACAO DO SERVIDOR
   ============================================================================ */
console.log('\n=== A VALIDACAO (o servidor REFAZ o bolo) ===');
{
  const cyc = { id: '1758600000000', proFaixa: 0 };
  const uid = 'trainer-1';
  const bolo = srv._proSorteiaBolo(uid, cyc.id, 0);
  const cod = (t) => Buffer.from(t.map(p => p.speciesId + ':' + p.level + (p.shiny ? ':1' : '')).join(','))
    .toString('base64').replace(/=+$/, '');
  const seis = bolo.slice(0, 6).map(p => ({ speciesId: p.id, level: p.level, shiny: p.shiny }));

  ok('os 6 do bolo passam', srv._proInscricaoValida({ uid, code: cod(seis) }, cyc));
  /* ⚠️ SEM ISTO, UM CLIENTE FORJADO INSCREVERIA SEIS MEWTWO: a inscricao da liga e escrita DIRETA
     do cliente, e a regra do Firestore so confere que o documento e do proprio uid. Na Classica
     isso nao acontece porque o time tem que SER da conta; aqui ele e sorteado. */
  ok('  seis Mewtwo forjados NAO passam',
     !srv._proInscricaoValida({ uid, code: cod(Array.from({ length: 6 }, () => ({ speciesId: 'mewtwo', level: 70 }))) }, cyc));
  /* ⚠️ E CADA UM SO VALE UMA VEZ: sem isto daria pra inscrever seis copias do melhor do bolo, que
     e justamente o que o sorteio existe pra impedir. */
  ok('  o MESMO do bolo seis vezes NAO passa',
     !srv._proInscricaoValida({ uid, code: cod(Array.from({ length: 6 }, () => seis[0])) }, cyc));
  ok('  cinco em vez de seis NAO passa', !srv._proInscricaoValida({ uid, code: cod(seis.slice(0, 5)) }, cyc));
  ok('  os doze inteiros NAO passam',
     !srv._proInscricaoValida({ uid, code: cod(bolo.map(p => ({ speciesId: p.id, level: p.level, shiny: p.shiny }))) }, cyc));
  /* ⚠️ A TRINCA especie+nivel+shiny: so a especie deixaria passar um Charizard Lv.70 num bolo que
     tinha um Lv.56, e so o nivel deixaria passar um shiny que nao foi sorteado. */
  ok('  o NIVEL adulterado NAO passa',
     !srv._proInscricaoValida({ uid, code: cod(seis.map((p, i) => i ? p : { ...p, level: p.level + 5 })) }, cyc));
  ok('  o SHINY adulterado NAO passa',
     !srv._proInscricaoValida({ uid, code: cod(seis.map((p, i) => i ? p : { ...p, shiny: !p.shiny })) }, cyc));
  ok('  o bolo de OUTRO treinador NAO passa', !srv._proInscricaoValida({ uid: 'outro', code: cod(seis) }, cyc));
  ok('  o bolo de OUTRO ciclo NAO passa', !srv._proInscricaoValida({ uid, code: cod(seis) }, { id: '999', proFaixa: 0 }));
  ok('  codigo lixo NAO passa', !srv._proInscricaoValida({ uid, code: 'nao-e-base64-!!!' }, cyc));
  ok('  e inscricao sem uid ou sem code NAO passa',
     !srv._proInscricaoValida({ code: cod(seis) }, cyc) && !srv._proInscricaoValida({ uid }, cyc));
  /* ⚠️ E O `drawCycle` TEM QUE CHAMAR ISSO -- os casos acima chamam a funcao na mao e passariam
     com a chamada orfa. E ele so filtra na PRO: a Classica nao tem bolo pra conferir. */
  /* ⚠️ A TRAVA LE A LINHA DO `filter`, e nao uma fatia do bloco: a fatia inclui o COMENTARIO, e
     um comentario que reproduz o nome da funcao ESCONDE o defeito -- foi exatamente o que
     aconteceu na primeira conferencia de acusacao, e ele passou em branco. */
  const linhaFiltro = (srvSrc.match(/registrants = registrants\.filter\([^\n]*/) || [''])[0];
  ok('  e o drawCycle CHAMA a validacao', /proInscricaoValida\(r, cycleEntry\)/.test(linhaFiltro),
     linhaFiltro.trim().slice(0, 70));
  const bloco = (srvSrc.match(/const regSnap = await registrantsCollRef\(typeId, cycleEntry\.id\)[\s\S]{0,900}/) || [''])[0];
  ok('  e so na Liga Pro', bloco.length > 100 && bloco.indexOf('typeId === PRO_LEAGUE_TYPE') >= 0);
}

/* ============================================================================
   5) A FAIXA QUE GIRA
   ============================================================================ */
console.log('\n=== A FAIXA SO ANDA QUANDO A LIGA ACONTECE ===');
{
  /* ⚠️ ISSO SE LE DO CODIGO porque o `drawCycle` precisa de Firestore, de inscritos e de um ciclo
     travado pra rodar -- e o que a trava quer provar e a CONDICAO, que e uma linha. */
  const bloco = (srvSrc.match(/if\(typeId === PRO_LEAGUE_TYPE && leagues\.length > 0\)\{[\s\S]{0,200}?\}/) || [''])[0];
  ok('o drawCycle avanca a faixa', bloco.length > 30, bloco.replace(/\s+/g, ' ').slice(0, 90));
  /* ⚠️ E A CONDICAO E `leagues.length > 0`, nao "o ciclo terminou": com menos de 8 inscritos o
     drawCycle forma ZERO ligas e manda todo mundo pro leftover -- a fila continua na MESMA faixa,
     que e o pedido ao pe da letra. */
  ok('  e so quando ELA ACONTECE (leagues.length > 0)', /leagues\.length > 0/.test(bloco));
  ok('  e o proximo ciclo ja nasce carimbado',
     /novo\.proFaixa = \(data\.proFaixaIdx \| 0\) % PRO_FAIXAS\.length/.test(srvSrc));
  /* ⚠️ O CLIENTE TAMBEM CRIA CICLO (`ensureRegisteringCycle`), entao ele precisa carimbar: sem
     isto, um ciclo criado pelo primeiro inscrito nasceria sempre na faixa 0 e a rotacao nunca
     sairia do lugar. */
  ok('  e o CLIENTE carimba a faixa ao criar ciclo',
     /entry\.proFaixa = \(data\.proFaixaIdx \| 0\) % PRO_FAIXAS\.length/.test(src));
  /* o minimo de 8 nao foi inventado: ele E o REGULAR_LIGA_SIZE da Classica */
  ok('  e o minimo de 8 e o tamanho de liga que ja existia',
     /const REGULAR_LIGA_SIZE = 8;/.test(srvSrc));
}

/* ============================================================================
   6) O TIPO ENTRA NA LISTA DO CRON -- sem isso a liga NUNCA acontece
   ============================================================================ */
console.log('\n=== O TIPO RESERVADO ===');
{
  /* ⚠️ ESTA E A TRAVA MAIS IMPORTANTE DO ARQUIVO: o cron itera exatamente a lista do
     `listActiveLeagueTypes`, e uma liga que ninguem avanca fica presa em `registering` pra
     sempre -- inscricoes abertas e sorteio que nunca chega. */
  const bloco = (srvSrc.match(/async function listActiveLeagueTypes\(\)[\s\S]{0,1400}/) || [''])[0];
  ok('a trava tem o bloco pra ler', bloco.length > 200, bloco.length + ' chars');
  ok('a Liga Pro entra na lista que o cron itera', /types\.push\(proEntry\)/.test(bloco));
  /* ⚠️ `botFillEnabled: false` DE PROPOSITO: o minimo de 8 E a regra da Pro (com menos, a fila
     espera e a faixa nao troca), e encher com bot desfaria isso. */
  ok('  e ela NAO enche com bot', /id: PRO_LEAGUE_TYPE[^}]*botFillEnabled: false/.test(bloco));
  /* o id `pro` e reservado: um doc com esse nome na colecao nao vira uma liga a parte */
  ok('  e o id `pro` e reservado na colecao', /if\(doc\.id === PRO_LEAGUE_TYPE\) return;/.test(bloco));
  ok('  e o cliente tambem o ignora na lista de customizadas',
     /if\(doc\.id === PRO_LEAGUE_TYPE\) return;/.test(src));
  ok('  e ela tem botao proprio na lista de ligas', /onclick="openLeague\('\$\{PRO_LEAGUE_TYPE\}'\)"/.test(src));
}

/* ============================================================================
   7) A TELA DOS 12
   ============================================================================ */
console.log('\n=== A TELA ===');
{
  S.game.authUser = { uid: 'trainer-1' };
  S.game.trainerName = 'Buzzo';
  S.game.currentLeagueTypeId = 'pro';
  S.game.proCicloId = '1758600000000';
  S.game.proFaixa = 0;
  S.game.proBolo = S.proSorteiaBolo('trainer-1', '1758600000000', 0);
  S.game.proEscolhidos = [];
  const h = S.renderProPicker();
  ok('a tela desenha os 12', (h.match(/class="selecao-card/g) || []).length === 12,
     (h.match(/class="selecao-card/g) || []).length);
  /* ⚠️ O CARD E O DO DRAFT DA SELECAO, e a grade tambem: e o MESMO problema, resolvido la em
     21/09. O `.btn` da casa -- que foi a primeira tentativa -- e `display:block;width:100%`, e
     ele esticou cada card pra a largura inteira: os doze viraram uma pilha. */
  ok('  na grade de 3 por linha do draft', /class="selecao-bolo"/.test(h));
  ok('  e nao no `.btn` da casa (que estica o card)', !/class="btn tower-pick/.test(h));
  /* ⚠️ O `spriteHtml` PRECISA DO `speciesId`, e o bolo guarda `id`: passando o objeto cru o sprite
     saia VAZIO em todos os doze, sem erro nenhum -- foi o navegador que pegou. */
  ok('  com o sprite de cada um', (h.match(/sprite-wrap|sprite-img|sprite-fallback/g) || []).length >= 12,
     (h.match(/sprite-wrap|sprite-img|sprite-fallback/g) || []).length);
  /* ⚠️ A FAIXA TEM QUE ESTAR ESCRITA NA TELA: ela gira a cada campeonato, e o bolo dos 12 só
     faz sentido sabendo em que nível a liga vai ser. A trava procura o NÚMERO, e não o texto em
     volta -- a frase quebra linha no meio (o HTML é indentado), e um padrão largo passaria com a
     faixa ERRADA na tela. */
  ok('  e a faixa da rodada escrita', h.indexOf('<strong>55 e 70</strong>') >= 0,
     (h.match(/<strong>[0-9]+ e [0-9]+<[/]strong>/) || ['(nao achei)'])[0]);
  S.game.proFaixa = 1;
  ok('  e ela acompanha a faixa', S.renderProPicker().indexOf('<strong>15 e 30</strong>') >= 0);
  S.game.proFaixa = 0;

  S.proAlternar(0); S.proAlternar(3); S.proAlternar(5);
  ok('marcar poe na ordem da escolha', JSON.stringify(S.game.proEscolhidos) === '[0,3,5]',
     JSON.stringify(S.game.proEscolhidos));
  const h2 = S.renderProPicker();
  ok('  e a tela mostra a POSICAO de cada um', (h2.match(/selecao-dono eu/g) || []).length === 3);
  S.proAlternar(3);
  ok('  e clicar de novo desmarca', JSON.stringify(S.game.proEscolhidos) === '[0,5]');
  S.proAlternar(1); S.proAlternar(2); S.proAlternar(4); S.proAlternar(6);
  ok('  ate seis', S.game.proEscolhidos.length === 6, S.game.proEscolhidos.length);
  /* ⚠️ QUEM RECUSA E A ACAO, nunca o card desabilitado: a mesma regra do `confirmarAtaques` e do
     `chooseRoute`. */
  S.proAlternar(7);
  ok('  e o SETIMO e recusado pela ACAO', S.game.proEscolhidos.length === 6);
  S.proAlternar(99); S.proAlternar(-1);
  ok('  e indice forjado tambem', S.game.proEscolhidos.length === 6);
  /* ⚠️ E O INDICE FORJADO TEM QUE SER RECUSADO COM VAGA SOBRANDO: com os seis cheios, quem barra e
     o TETO -- a trava nao distinguiria as duas guardas. Foi a conferencia de acusacao que pegou. */
  S.game.proEscolhidos = [0];
  S.proAlternar(99); S.proAlternar(-1); S.proAlternar(1.5); S.proAlternar('x');
  ok('  e recusado mesmo com vaga sobrando', JSON.stringify(S.game.proEscolhidos) === '[0]',
     JSON.stringify(S.game.proEscolhidos));
  S.game.proEscolhidos = [0, 1, 2, 3, 4, 5];
  const h3 = S.renderProPicker();
  ok('  e com seis o botao libera', /Inscrever estes 6/.test(h3));
  ok('  e os nao escolhidos viram <span>, nao botao apagado',
     (h3.match(/<span class="selecao-card off"/g) || []).length === 6,
     (h3.match(/<span class="selecao-card off"/g) || []).length);
}

/* ============================================================================
   8) A INSCRICAO
   ============================================================================ */
console.log('\n=== A INSCRICAO ===');
{
  /* ⚠️ ELA GRAVA O MESMO DOCUMENTO DA CLASSICA (name, uid, code, ataques, specialties, elite):
     e isso que faz a Pro herdar o `drawCycle`, o `advanceLeague`, o ranking e o historico sem uma
     linha nova. O que muda e de onde o `code` vem. */
  const bloco = (src.match(/async function inscreverNaLigaPro\(\)[\s\S]{0,3000}/) || [''])[0];
  ok('a trava tem o bloco pra ler', bloco.length > 500, bloco.length + ' chars');
  ['name', 'code:', 'uid', 'ataques:', 'specialties:', 'elite:'].forEach(c => {
    ok('  o documento leva `' + c.replace(':', '') + '`', bloco.indexOf(c) >= 0);
  });
  ok('  e o contador de inscritos sobe na MESMA transacao',
     /registrantCount: firebase\.firestore\.FieldValue\.increment\(1\)/.test(bloco));
  /* ⚠️ O `createInstance` NAO COPIA A FLAG SHINY -- armadilha da casa, que ja custou o mesmo
     defeito em TRES lugares. Sem esta linha o shiny do bolo sumia no time inscrito. */
  ok('  e o shiny e recolado na instancia', /inst\.shiny = !!p\.shiny/.test(bloco));
  /* ⚠️ OS GOLPES SAO OS DA ESPECIE POR NIVEL: aqui o jogador escolhe o POKEMON, nao o moveset.
     Sem eles o time cairia no motor de tipo. */
  ok('  e os golpes sao os da especie por nivel', /ataquesPadrao\(inst\)/.test(bloco));
  /* ⚠️ QUEM VALIDA E A ACAO: seis exatos, e todos do bolo. */
  ok('  e a ACAO cobra exatamente 6 do bolo',
     /sel\.length !== PRO_ESCOLHE \|\| sel\.some\(i => !bolo\[i\]\)/.test(bloco));
  /* ⚠️ O CICLO PODE TER VIRADO enquanto o jogador escolhia -- e ai o bolo dele e de OUTRO ciclo,
     porque o cycleId entra na semente. Inscrever assim mandaria um time que o servidor descarta,
     em silencio. */
  ok('  e se o ciclo virou, ela RE-SORTEIA em vez de inscrever',
     /cycleEntry\.id !== game\.proCicloId/.test(bloco) && /proSorteiaBolo\(uid, cycleEntry\.id/.test(bloco));
  ok('  e a trava de "ja inscrito em outra rodada" vale', /ACTIVE_ELSEWHERE/.test(bloco));
}

/* ============================================================================
   9) O RANKING E O HISTÓRICO -- o que o pedido chama de "igual a Liga Clássica"
   ============================================================================ */
console.log('\n=== O RANKING E O HISTÓRICO ===');
{
  /* ⚠️ ELES SÃO GENÉRICOS POR `typeId` E ISSO ERA UMA AFIRMAÇÃO -- esta trava DESENHA a tela da Pro
     e a da Clássica e compara os quadros. Um quadro que faltasse na Pro só apareceria pra quem
     abrisse a liga, e depois de a primeira rodada acontecer. */
  const antes = { id: S.game.currentLeagueTypeId, cfg: S.game.currentLeagueTypeConfig,
                  data: S.game.leagueData, lb: S.game.leagueLeaderboard,
                  hist: S.game.leagueHistory, meu: S.game.myLeagueHistory, tela: S.game.screen };
  S.game.screen = 'league';
  S.game.leagueData = { cycles: [
    { id: '1758600000000', scheduledTime: Date.now() + 600000, status: 'registering',
      proFaixa: 0, registrantCount: 5, registrants: [] },
    { id: '1758500000000', scheduledTime: Date.now() - 3600000, status: 'complete', proFaixa: 2 } ] };
  S.game.leagueLeaderboard = [{ name: 'Buzzo', wins: 3 }, { name: 'Ana', wins: 2 }];
  S.game.leagueHistory = [{ cycleId: '1758500000000', leagueId: 0,
    scheduledTime: Date.now() - 3600000, champion: { name: 'Ana' } }];
  S.game.myLeagueHistory = [{ cycleId: '1758500000000', leagueId: 0, cycleTime: Date.now() - 3600000,
    placement: 'Campeão', leagueTypeId: 'pro', leagueTypeName: 'Liga Pro', leagueSize: 8 }];
  /* ⚠️ o fixture do global é da CLÁSSICA de propósito: é o que prova que o quadro existe lá e
     não aqui -- sem ele, as duas ligas sairiam sem o quadro e a trava não distinguiria nada */
  S.game.globalLeagueHistory = [{ cycleId: '1758500000000', cycleTime: Date.now() - 3600000,
    league: { id: 0, size: 8, champion: { name: 'Ana' } } }];

  S.game.currentLeagueTypeId = 'pro';
  S.game.currentLeagueTypeConfig = { id: 'pro', name: 'Liga Pro' };
  const hPro = S.renderLeague();
  S.game.currentLeagueTypeId = 'classic';
  S.game.currentLeagueTypeConfig = { id: 'classic', name: 'Liga Clássica' };
  const hCla = S.renderLeague();
  const quadros = (x) => (x.match(/dobra-cab|Top 10|Últimas Ligas/g) || []).length;

  ok('a Pro tem o Top 10', /Top 10/.test(hPro));
  ok('  e "Suas últimas Ligas"', /Suas últimas Ligas/.test(hPro));
  /* ⚠️ O QUADRO GLOBAL ("🌐 Últimas Ligas") É DA CLÁSSICA, e não é esquecimento: o
     `loadGlobalLeagueHistory` varre o `schedule_classic` e o botão "Rever" dele CRAVA o tipo
     clássico -- ele nunca foi por liga. A Trainers League também não o tem. O que "histórico"
     quer dizer por liga é o PESSOAL, que é o que a Pro tem: ele carrega o `leagueTypeId` de cada
     linha, então o "Rever" dela leva ao chaveamento DELA. */
  ok('  e o global continua sendo da Clássica', /Últimas Ligas/.test(hCla) && !/🌐/.test(hPro));
  ok('  e o "Rever" do histórico pessoal leva ao tipo CERTO',
     /viewLeagueHistory\('\$\{h\.leagueTypeId\|\|CLASSIC_LEAGUE_TYPE\}'/.test(src));
  /* ⚠️ A PRO TEM OS DOIS QUADROS POR LIGA e a Clássica tem TRÊS (o global é só dela): a trava
     cobra a DIFERENÇA de exatamente um, e não a igualdade. Igualando, ela passaria de volta com o
     vazamento do campo global -- que era o defeito. */
  ok('  e a Clássica tem UM quadro a mais (o global)', quadros(hCla) - quadros(hPro) === 2,
     quadros(hPro) + ' na Pro / ' + quadros(hCla) + ' na Clássica');
  /* ⚠️ O QUE SÓ A PRO TEM é a faixa da rodada: ela gira, e sem ela na tela o jogador só descobre
     em que nível vai lutar depois de abrir o picker. */
  ok('  e só a Pro anuncia a faixa', /<strong>55 e 70<\/strong>/.test(hPro) && !/níveis/.test(hCla));
  ok('  e ela nomeia a liga no título', /Liga Pro/.test(hPro));
  Object.assign(S.game, { currentLeagueTypeId: antes.id, currentLeagueTypeConfig: antes.cfg,
    leagueData: antes.data, leagueLeaderboard: antes.lb, leagueHistory: antes.hist,
    myLeagueHistory: antes.meu, screen: antes.tela });
}

/* ============================================================================
   10) PONTA A PONTA -- 8 inscritos entram no chaveamento, o forjado não
   ============================================================================ */
console.log('\n=== PONTA A PONTA (o drawCycle de verdade) ===');
{
  /* ⚠️ ESTA É A TRAVA QUE PROVA A FEATURE INTEIRA: ela roda o `drawCycle` contra o Firestore em
     memória, com 8 inscrições legítimas e UMA forjada. Todos os outros casos chamam a validação na
     mão e passariam com a chamada órfã. */
  const Module = require('module');
  const fake = require('./fake-firestore.js');
  const db = fake.makeDb();
  const stubs = {
    'firebase-functions/v2/scheduler': { onSchedule: (a, b) => (typeof a === 'function' ? a : b) },
    'firebase-functions/v2/https': { onCall: (fn) => fn,
      HttpsError: class HttpsError extends Error { constructor(c, m){ super(m); this.code = c; } } },
    'firebase-functions/logger': { error(){}, info(){}, warn(){}, log(){} },
    'firebase-admin': { initializeApp(){}, firestore: Object.assign(() => db, { FieldValue: fake.FieldValue }) }
  };
  const load = Module._load;
  Module._load = function(req){ if(stubs[req]) return stubs[req]; return load.apply(this, arguments); };
  delete require.cache[require.resolve(path.join(raiz, 'functions', 'index.js'))];
  const F = require(path.join(raiz, 'functions', 'index.js'));
  Module._load = load;

  const T = F._PRO_LEAGUE_TYPE, N = F._PRO_ESCOLHE, CID = '1758600000000';
  const cod = (t) => Buffer.from(t.map(p => p.speciesId + ':' + p.level + (p.shiny ? ':1' : '')).join(','))
    .toString('base64').replace(/=+$/, '');
  const cyc = () => db.collection('leagueCycles').doc(T + '__' + CID);
  const sch = () => db.collection('leagues').doc('schedule_' + T);

  (async () => {
    await sch().set({ cycles: [{ id: CID, scheduledTime: Date.now() - 1000,
      status: 'registering', proFaixa: 0 }], proFaixaIdx: 0 });
    for(let i = 0; i < 8; i++){
      const uid = 'tr' + i;
      const seis = F._proSorteiaBolo(uid, CID, 0).slice(0, N)
        .map(p => ({ speciesId: p.id, level: p.level, shiny: p.shiny }));
      await cyc().collection('registrants').doc(uid).set({ name: 'Treinador ' + i, uid,
        code: cod(seis), slot: null, ataques: {}, specialties: [], elite: false, registeredAt: 1000 + i });
    }
    await cyc().collection('registrants').doc('forjado').set({ name: 'Trapaceiro', uid: 'forjado',
      code: cod(Array.from({ length: N }, () => ({ speciesId: 'mewtwo', level: 70 }))),
      slot: null, ataques: {}, specialties: [], elite: false, registeredAt: 999 });

    const d0 = (await sch().get()).data();
    await F._drawCycle(T, d0.cycles[0], { id: T, name: 'Liga Pro', botFillEnabled: false });
    const doc = (await cyc().get()).data() || {};
    const L = (doc.leagues || [])[0] || {};
    const quem = new Set();
    Object.values(L.rounds || {}).forEach(r => (r || []).forEach(m => {
      if(m.a) quem.add(m.a.uid); if(m.b) quem.add(m.b.uid); }));

    ok('com 8 válidos a liga se forma', (doc.leagues || []).length === 1, (doc.leagues || []).length + ' liga(s)');
    ok('  e os 8 entram no chaveamento', quem.size === 8, quem.size + ' treinadores');
    /* ⚠️ E O FORJADO NÃO ENTRA -- é a única coisa que o servidor pode fazer, porque a inscrição é
       escrita DIRETA do cliente: ele refaz o bolo e descarta quem não bate. */
    ok('  e o time FORJADO é descartado', !quem.has('forjado'));
    const s1 = (await sch().get()).data();
    ok('  e a faixa ANDOU (a liga aconteceu)', s1.proFaixaIdx === 1, 'proFaixaIdx=' + s1.proFaixaIdx);
    const novo = s1.cycles.find(c => c.id !== CID) || {};
    ok('  e o ciclo novo nasce na faixa 15-30',
       JSON.stringify(F._proFaixaDe(novo.proFaixa)) === '[15,30]',
       JSON.stringify(F._proFaixaDe(novo.proFaixa)));
    ok('  e o ciclo velho virou `drawn`',
       (s1.cycles.find(c => c.id === CID) || {}).status === 'drawn');

    /* ⚠️ E COM MENOS DE 8 A FILA ESPERA E A FAIXA NÃO TROCA -- é o pedido ao pé da letra
       (*"se nao fechar 8 treinadores, continua os que estao na fila"*). Ela cai do
       `REGULAR_LIGA_SIZE`, que é a regra da Clássica, e não de código novo. */
    const CID2 = '1758700000000';
    const cyc2 = () => db.collection('leagueCycles').doc(T + '__' + CID2);
    await sch().set({ cycles: [{ id: CID2, scheduledTime: Date.now() - 1000,
      status: 'registering', proFaixa: 1 }], proFaixaIdx: 1 });
    for(let i = 0; i < 5; i++){
      const uid = 'p' + i;
      const seis = F._proSorteiaBolo(uid, CID2, 1).slice(0, N)
        .map(p => ({ speciesId: p.id, level: p.level, shiny: p.shiny }));
      await cyc2().collection('registrants').doc(uid).set({ name: 'T' + i, uid, code: cod(seis),
        slot: null, ataques: {}, specialties: [], elite: false, registeredAt: 2000 + i });
    }
    const d1 = (await sch().get()).data();
    await F._drawCycle(T, d1.cycles[0], { id: T, name: 'Liga Pro', botFillEnabled: false });
    const doc2 = (await cyc2().get()).data() || {};
    const s2 = (await sch().get()).data();
    ok('com 5 inscritos NENHUMA liga se forma', (doc2.leagues || []).length === 0,
       (doc2.leagues || []).length + ' liga(s)');
    ok('  e a faixa NÃO anda', s2.proFaixaIdx === 1, 'proFaixaIdx=' + s2.proFaixaIdx);
    ok('  e os 5 ficam na fila (leftover)', (doc2.leftover || []).length === 5,
       (doc2.leftover || []).length + ' na fila');

    /* ⚠️ E A TRAVA DO PAINEL CONHECE A PRO: a Clássica e a Pro são tipos RESERVADOS (não vivem na
       coleção `leagueTypes`), então sem a Pro na lista o painel deixaria inscrever na Clássica
       alguém que está disputando um chaveamento da Pro. */
    ok('a trava do painel varre a Liga Pro',
       /const tipos = \[CLASSIC_LEAGUE_TYPE, PRO_LEAGUE_TYPE\]/.test(srvSrc));

    console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'Tudo certo.') + '  (' + total + ' asserções)');
    process.exit(falhas ? 1 : 0);
  })().catch(e => { console.log('\nESTOUROU: ' + e.message); process.exit(1); });
}
