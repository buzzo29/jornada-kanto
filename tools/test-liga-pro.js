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
  /* ⚠️ A ORDEM E A ESCADA BRONZE -> PRATA -> OURO (23/09/2026, a pedido). Ela era
     55-70 -> 15-30 -> 35-50, que foi o pedido de quando a liga nasceu.
     ⚠️ A TRAVA COBRA A REGRA, nao os numeros: uma lista fixa aqui envelheceria no proximo
     ajuste -- e a regra e que a rotacao SOBE (a mais baixa primeiro), que e o que os nomes
     Bronze/Prata/Ouro prometem. */
  ok('  e a ordem SOBE (a mais baixa primeiro)',
     srv._PRO_FAIXAS.every((f, i) => i === 0 || f[0] > srv._PRO_FAIXAS[i-1][1]),
     JSON.stringify(srv._PRO_FAIXAS));
  ok('  e as tres faixas nao se encostam nem se repetem',
     new Set(srv._PRO_FAIXAS.map(f => f.join('-'))).size === srv._PRO_FAIXAS.length
     && srv._PRO_FAIXAS.every(f => f[0] < f[1]));
  /* ⚠️ A ROTACAO E CIRCULAR e tolera indice fora: a faixa vem de um contador que so cresce, e
     sem o modulo ela sairia `undefined` na quarta liga -- um bolo sem faixa nenhuma. */
  ok('  e ela gira (a 4a volta ao comeco)',
     JSON.stringify(srv._proFaixaDe(3)) === JSON.stringify(srv._PRO_FAIXAS[0])
     && JSON.stringify(srv._proFaixaDe(4)) === JSON.stringify(srv._PRO_FAIXAS[1]));
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
  ok('  na grade de 3 por linha do draft', /class="selecao-bolo/.test(h));
  /* ⚠️ E A GRADE DA PRO LEVA A CLASSE PROPRIA (`pro-bolo`): e ela que escopa o Level maior do
     card (23/09/2026, a pedido). Sem o escopo, a Selecao da Ilha Kumquat -- que usa o MESMO card
     e a MESMA classe -- mudaria junto, numa tela que ninguem pediu. */
  ok('  e com a classe que escopa o Level maior', /class="selecao-bolo pro-bolo"/.test(h));
  ok('  e o Level da Pro e MAIOR que o da Selecao, mas nao passa do nome',
     /\.pro-bolo \.selecao-lv\{font-size:\.58rem/.test(src)
     && /\.selecao-lv\{display:block;font-size:\.52rem/.test(src));
  ok('  e nao no `.btn` da casa (que estica o card)', !/class="btn tower-pick/.test(h));
  /* ⚠️ O `spriteHtml` PRECISA DO `speciesId`, e o bolo guarda `id`: passando o objeto cru o sprite
     saia VAZIO em todos os doze, sem erro nenhum -- foi o navegador que pegou. */
  ok('  com o sprite de cada um', (h.match(/sprite-wrap|sprite-img|sprite-fallback/g) || []).length >= 12,
     (h.match(/sprite-wrap|sprite-img|sprite-fallback/g) || []).length);
  /* ⚠️ A FAIXA TEM QUE ESTAR ESCRITA NA TELA: ela gira a cada campeonato, e o bolo dos 12 só
     faz sentido sabendo em que nível a liga vai ser. A trava procura os DOIS NÚMEROS da faixa
     que o estado diz, e não o texto em volta. */
  const nums = f => '<strong>' + f[0] + ' e ' + f[1] + '</strong>';
  ok('  e a faixa da rodada escrita', h.indexOf(nums(srv._proFaixaDe(0))) >= 0,
     (h.match(/<strong>[0-9]+ e [0-9]+<[/]strong>/) || ['(nao achei)'])[0]);
  S.game.proFaixa = 1;
  ok('  e ela acompanha a faixa', S.renderProPicker().indexOf(nums(srv._proFaixaDe(1))) >= 0);
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
  /* ⚠️ O BOTÃO NÃO INSCREVE MAIS: desde 23/09 ele leva à escolha dos GOLPES, e a inscrição só
     acontece no fim dela. A trava media o TEXTO antigo e caiu com o código certo -- ela passou a
     cobrar o DESTINO, que é a regra. */
  ok('  e com seis o botao libera', /Escolher os golpes/.test(h3),
     (h3.match(/onclick="pro\w+\(\)/g) || []).join(' '));
  ok('  e ele leva à escolha dos golpes', /onclick="proIrParaOsGolpes\(\)"/.test(h3));
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
  /* ⚠️ A FATIA VAI ATÉ O FIM DA FUNÇÃO, e não por offset fixo: com um teto de caracteres ela
     envelheceu no primeiro comentário novo -- os campos `specialties`, `elite` e o contador saíram
     da janela e TRÊS travas certas caíram, com o código certo. É a quarta vez desta família aqui. */
  const iIns = src.indexOf('async function inscreverNaLigaPro()');
  const fIns = src.indexOf('\nasync function ', iIns + 10);
  const bloco = iIns >= 0 ? src.slice(iIns, fIns > iIns ? fIns : src.length) : '';
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
  /* ⚠️ E A FAIXA DA RODADA VIROU UM QUADRO (23/09/2026, a pedido: *"crie um quadro indicando qual
     é a faixa de level que é a liga atual"*). Ela era uma LINHA dentro do bloco de inscrição --
     ou seja sumia justamente depois de o jogador entrar, que é quem vai lutar nela. */
  /* ⚠️ A CLASSE SE PROCURA COMPLETA, com o `"` que a fecha: `/pro-faixa-box/` casa com
     `pro-faixa-box-QUALQUERCOISA`, e foi assim que o defeito religado passou em branco na
     conferência de acusação. É a mesma armadilha das regex do `mlog-mais` e do `matchup-row`. */
  ok('  e só a Pro anuncia a faixa',
     hPro.indexOf('class="box pro-faixa-box"') > 0 && hCla.indexOf('pro-faixa-box') < 0);
  const fAtual = srv._proFaixaDe(((S.game.leagueData||{}).cycles||[]).find(c=>c.status==='registering').proFaixa||0);
  ok('  e o quadro diz o NOME do tier e o level',
     hPro.indexOf('Liga Pro ' + S.proNomeDaFaixa(fAtual)) > 0 && hPro.indexOf('Level ' + fAtual[0] + '-' + fAtual[1]) > 0,
     (hPro.match(/pro-faixa-nome">([^<]*)/) || [])[1]);
  /* ⚠️ E ELE DIZ A PRÓXIMA (23/09/2026, a pedido: *"siga o ciclo que combinamos, mas escreve isso
     no quadro"*). Ela é DERIVADA do índice seguinte -- escrita à mão, ela mentiria no dia em que
     a rotação mudasse, que é justamente o que acabou de acontecer com a ordem. */
  {
    const idxA = ((S.game.leagueData||{}).cycles||[]).find(c=>c.status==='registering').proFaixa||0;
    const prox = srv._proFaixaDe(idxA + 1);
    ok('  e diz qual vem DEPOIS dela',
       hPro.indexOf('Liga Pro ' + S.proNomeDaFaixa(prox)) > 0
       && hPro.indexOf('Level ' + prox[0] + '-' + prox[1]) > 0
       && /pro-faixa-prox/.test(hPro),
       S.proNomeDaFaixa(prox) + ' ' + prox.join('-'));
    ok('    e ela NÃO é a de agora', S.proNomeDaFaixa(prox) !== S.proNomeDaFaixa(fAtual));
  }
  /* ⚠️ E A LINHA VELHA NÃO VOLTA: com as duas, a tela diria a mesma coisa duas vezes na mesma
     rolagem -- e a de baixo só aparecia pra quem NÃO estava inscrito. */
  ok('  e a linha velha não sobrou', !/Esta rodada é entre os níveis/.test(hPro));
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
    ok('  e o ciclo novo nasce na faixa SEGUINTE da rotação',
       JSON.stringify(F._proFaixaDe(novo.proFaixa)) === JSON.stringify(F._PRO_FAIXAS[1]),
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
    await separacaoDaClassica(F, db, cod);
    descricaoContadorEGolpes();

    console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'Tudo certo.') + '  (' + total + ' asserções)');
    process.exit(falhas ? 1 : 0);
  })().catch(e => { console.log('\nESTOUROU: ' + e.message); process.exit(1); });
}

/* ============================================================================
   11) A SEPARAÇÃO DA CLÁSSICA -- inscritos e times
   ============================================================================
   ⚠️ O PIOR CASO É O DE VERDADE: as duas ligas rodam de hora em hora pelo MESMO relógio
   (`computeNextScheduledTime`), então o `cycleId` delas COINCIDE. O que separa é só o prefixo do
   documento (`classic__<id>` contra `pro__<id>`) -- e é por isso que esta trava usa o MESMO id
   nas duas: com ids diferentes ela passaria por acidente e não mediria nada. */
async function separacaoDaClassica(F, db, cod){
  console.log('\n=== A SEPARAÇÃO DA CLÁSSICA ===');
  const T = F._PRO_LEAGUE_TYPE, MESMO = '1758900000000';
  const dc = (t) => db.collection('leagueCycles').doc(t + '__' + MESMO);
  const sc = (t) => db.collection('leagues').doc('schedule_' + t);
  const timeCla = ['charizard','blastoise','venusaur','snorlax','alakazam','gyarados']
    .map(id => ({ speciesId: id, level: 70 }));

  for(const t of ['classic', T]){
    await sc(t).set({ cycles: [{ id: MESMO, scheduledTime: Date.now() - 1000,
      status: 'registering', ...(t === T ? { proFaixa: 0 } : {}) }],
      ...(t === T ? { proFaixaIdx: 0 } : {}) });
  }
  /* o MESMO treinador nas duas, com times DIFERENTES de propósito */
  const eu = 'buzzo';
  const meuPro = F._proSorteiaBolo(eu, MESMO, 0).slice(0, 6)
    .map(p => ({ speciesId: p.id, level: p.level, shiny: p.shiny }));
  await dc('classic').collection('registrants').doc(eu)
    .set({ name: 'Buzzo', uid: eu, code: cod(timeCla), registeredAt: 1000 });
  await dc(T).collection('registrants').doc(eu)
    .set({ name: 'Buzzo', uid: eu, code: cod(meuPro), registeredAt: 1000 });
  for(let i = 0; i < 7; i++){
    await dc('classic').collection('registrants').doc('c' + i)
      .set({ name: 'C' + i, uid: 'c' + i, code: cod(timeCla), registeredAt: 1100 + i });
    const u = 'p' + i;
    const b = F._proSorteiaBolo(u, MESMO, 0).slice(0, 6)
      .map(p => ({ speciesId: p.id, level: p.level, shiny: p.shiny }));
    await dc(T).collection('registrants').doc(u)
      .set({ name: 'P' + i, uid: u, code: cod(b), registeredAt: 1200 + i });
  }

  const regCla = await dc('classic').collection('registrants').get();
  const regPro = await dc(T).collection('registrants').get();
  ok('com o MESMO cycleId, as listas não se misturam',
     regCla.size === 8 && regPro.size === 8, regCla.size + ' / ' + regPro.size);
  ok('  e nenhum inscrito da Clássica aparece na Pro',
     !regPro.docs.some(d => /^c[0-6]$/.test(d.id)), regPro.docs.map(d => d.id).join(','));
  ok('  e nenhum da Pro aparece na Clássica',
     !regCla.docs.some(d => /^p[0-6]$/.test(d.id)), regCla.docs.map(d => d.id).join(','));

  /* ⚠️ O MESMO TREINADOR ESTÁ NAS DUAS, e isso é a regra da casa: a trava do jogador é POR LIGA
     (o `accountLeagueSlots` é indexado por typeId, e a tela diz *"já está disputando ESSA Liga
     em outra rodada"*), não por conta -- vale igual entre a Clássica e uma customizada. O que ela
     tem que garantir é que o TIME de cada uma seja o DELA. */
  const tCla = F._decodeTeamCode((await dc('classic').collection('registrants').doc(eu).get()).data().code);
  const tPro = F._decodeTeamCode((await dc(T).collection('registrants').doc(eu).get()).data().code);
  ok('  e o MESMO treinador leva times DIFERENTES em cada uma',
     tCla.map(p => p.speciesId).join() !== tPro.map(p => p.speciesId).join(),
     tCla[0].speciesId + '... / ' + tPro[0].speciesId + '...');
  ok('  e o da Clássica é o que ELE montou', tCla[0].speciesId === 'charizard');
  ok('  e o da Pro é o do BOLO dele',
     F._proInscricaoValida({ uid: eu, code: cod(tPro) }, { id: MESMO, proFaixa: 0 }));

  /* os dois chaveamentos, sorteados um depois do outro no mesmo ciclo */
  const quem = {};
  for(const t of ['classic', T]){
    const sd = (await sc(t).get()).data();
    await F._drawCycle(t, sd.cycles[0], { id: t, name: t, botFillEnabled: false });
    const d = (await dc(t).get()).data() || {};
    const set = new Set();
    Object.values(((d.leagues || [])[0] || {}).rounds || {}).forEach(r => (r || []).forEach(m => {
      if(m.a) set.add(m.a.uid); if(m.b) set.add(m.b.uid); }));
    quem[t] = [...set].sort();
  }
  ok('cada chaveamento tem 8', quem.classic.length === 8 && quem[T].length === 8,
     quem.classic.length + ' / ' + quem[T].length);
  ok('  e ninguém da Pro cai no chaveamento da Clássica',
     !quem.classic.some(u => /^p[0-6]$/.test(u)), quem.classic.join(','));
  ok('  e ninguém da Clássica cai no da Pro',
     !quem[T].some(u => /^c[0-6]$/.test(u)), quem[T].join(','));

  /* ===== o lado do CLIENTE =====
     ⚠️ AQUI O RISCO É DE CAMPO GLOBAL: o `game` tem UM `proBolo` e UM `leagueTeamPickError`,
     não um por tipo. Se algum não for zerado ao trocar de liga, ele vaza -- que é exatamente o
     defeito que o quadro "🌐 Últimas Ligas" tinha. */
  S.game.authUser = { uid: 'buzzo' }; S.game.trainerName = 'Buzzo';
  S.game.currentLeagueTypeId = T;
  S.game.proCicloId = MESMO; S.game.proFaixa = 0;
  S.game.proBolo = S.proSorteiaBolo('buzzo', MESMO, 0);
  S.game.proEscolhidos = [0, 1, 2];
  const pkPro = S.renderLeagueTeamPicker();
  S.game.currentLeagueTypeId = 'classic';
  const pkCla = S.renderLeagueTeamPicker();
  ok('o picker da Pro mostra o bolo', /selecao-bolo/.test(pkPro));
  ok('  e o da Clássica NÃO mostra o bolo da Pro', !/selecao-bolo/.test(pkCla));
  /* ⚠️ E O PICKER DA PRO ZERA bolo, seleção e erro NA PRIMEIRA LINHA: sem isso, um ciclo que virou
     deixaria os índices escolhidos apontando pro bolo ANTIGO. */
  ok('  e o picker da Pro zera bolo/seleção/erro na 1ª linha',
     /async function abrirBoloDaLigaPro\(\)\{\s*\n\s*game\.leagueTeamPickError = null;\s*\n\s*game\.proBolo = null;\s*\n\s*game\.proEscolhidos = \[\];/.test(src));
  S.game.leagueTeamPickError = 'erro do picker da Pro';
  S.game.screen = 'league';
  S.game.currentLeagueTypeConfig = { id: 'classic', name: 'Liga Clássica' };
  S.game.leagueData = { cycles: [{ id: '1', scheduledTime: Date.now() + 600000,
    status: 'registering', registrantCount: 2, registrants: [] }] };
  ok('  e o erro do picker não vaza pra tela da Liga',
     S.renderLeague().indexOf('erro do picker da Pro') < 0);

  /* ⚠️ E "SUAS ÚLTIMAS LIGAS" MOSTRA AS DUAS, DE PROPÓSITO: ele é por CONTA (lê o
     `leaguePlacements` do documento do usuário), cada linha NOMEIA a liga e o "Rever" leva o
     `leagueTypeId` dela. Filtrar por liga aqui esconderia metade do histórico do jogador. */
  S.game.currentLeagueTypeId = T;
  S.game.currentLeagueTypeConfig = { id: T, name: 'Liga Pro' };
  S.game.leagueData = { cycles: [{ id: '1', scheduledTime: Date.now() + 600000,
    status: 'registering', proFaixa: 0, registrantCount: 2, registrants: [] }] };
  S.game.leagueTeamPickError = null;
  S.game.myLeagueHistory = [
    { cycleId: 'a', leagueId: 0, cycleTime: Date.now() - 3600000, placement: 'Campeão',
      leagueTypeId: T, leagueTypeName: 'Liga Pro', leagueSize: 8 },
    { cycleId: 'b', leagueId: 0, cycleTime: Date.now() - 7200000, placement: 'Semifinal',
      leagueTypeId: 'classic', leagueTypeName: 'Liga Clássica', leagueSize: 8 } ];
  S.game.quadrosAbertos = { ...(S.game.quadrosAbertos || {}), minhas_ligas: true };
  const hh = S.renderLeague();
  const revs = [...hh.matchAll(/viewLeagueHistory\('([^']+)'/g)].map(m => m[1]);
  ok('o histórico pessoal mostra as DUAS ligas', revs.length === 2, JSON.stringify(revs));
  ok('  e o "Rever" de cada uma leva ao tipo DELA', revs[0] === T && revs[1] === 'classic',
     JSON.stringify(revs));
  ok('  e cada linha nomeia a liga', /Liga Pro/.test(hh) && /Liga Clássica/.test(hh));

  /* ===== e o que só a LEITURA DO CÓDIGO alcança =====
     ⚠️ O bloco acima roda contra o `db` do SERVIDOR, então um `cycleDocRef` do CLIENTE que
     perdesse o prefixo do tipo passaria em branco por ele -- e as duas ligas passariam a escrever
     no MESMO documento sem nada acusar. Foi a conferência de acusação que mostrou esse buraco. */
  [['cycleDocRef', /function cycleDocRef\(typeId, cycleId\)\{[^}]*\(typeId\|\|CLASSIC_LEAGUE_TYPE\)\+'__'\+cycleId/],
   ['scheduleDocRef', /function scheduleDocRef\(typeId\)\{[^}]*'schedule_'\+\(typeId\|\|CLASSIC_LEAGUE_TYPE\)/],
   ['registrantsCollRef', /function registrantsCollRef\(typeId, cycleId\)\{[^}]*cycleDocRef\(typeId, cycleId\)/]
  ].forEach(([nome, re]) => {
    ok('o ' + nome + ' leva o tipo no caminho, nos DOIS motores',
       re.test(src) && re.test(srvSrc));
  });
  /* ⚠️ E A INSCRIÇÃO DA PRO GRAVA NO CAMINHO DELA: ela é um caminho PRÓPRIO (não passa pelo
     `registerForLeague`), então nada garante por construção que ela use o tipo certo. */
  /* ⚠️ ATÉ O FIM DA FUNÇÃO, pela mesma razão do bloco da inscrição: offset fixo envelhece no
     primeiro comentário novo e derruba uma trava certa. */
  const iPro = src.indexOf('async function inscreverNaLigaPro()');
  const fPro = src.indexOf('\nasync function ', iPro + 10);
  const insPro = iPro >= 0 ? src.slice(iPro, fPro > iPro ? fPro : src.length) : '';
  ok('a inscrição da Pro grava no caminho da PRO', insPro.length > 500 &&
     /registrantDocRef\(PRO_LEAGUE_TYPE, cycleEntry\.id, uid\)/.test(insPro) &&
     !/registrantDocRef\(CLASSIC_LEAGUE_TYPE/.test(insPro));
  ok('  e o contador dela sobe no ciclo da PRO',
     /cycleDocRef\(PRO_LEAGUE_TYPE, cycleEntry\.id\)/.test(insPro));
  /* ⚠️ E O PICKER DESPACHA PELO TIPO: sem essa linha, a tela da Clássica desenharia o bolo. */
  ok('  e o picker despacha pelo tipo',
     /function renderLeagueTeamPicker\(\)\{\s*\n\s*if\(game\.currentLeagueTypeId === PRO_LEAGUE_TYPE\)\{ return renderProPicker\(\); \}/.test(src));
  ok('  e o abrir do picker também',
     /function openLeagueTeamPicker\(\)\{\s*\n\s*if\(game\.currentLeagueTypeId === PRO_LEAGUE_TYPE\)\{ abrirBoloDaLigaPro\(\); return; \}/.test(src));
}

/* ============================================================================
   12) A DESCRIÇÃO, O CONTADOR E OS GOLPES (23/09/2026, a tarde)
   ============================================================================ */
function descricaoContadorEGolpes(){
/* ⚠️ AS CONSTANTES SAO LIDAS DO SERVIDOR (`srv._X`): `const` no sandbox do cliente nao vira
   propriedade do objeto -- a licao do `const` que nao vira global. O bloco 1 ja cobra que as duas
   copias batem, entao comparar com a do servidor E comparar com a do cliente. */
const P_SORT = srv._PRO_SORTEADOS, P_ESC = srv._PRO_ESCOLHE, P_FX = srv._PRO_FAIXAS;
const P_TIPO = srv._PRO_LEAGUE_TYPE, C_TIPO = S.CLASSIC_LEAGUE_TYPE;
const P_MIN = Number((srvSrc.match(/const REGULAR_LIGA_SIZE = (\d+);/) || [])[1]);
console.log('\n=== A DESCRIÇÃO DA PRO ===');
{
  /* ⚠️ A PRO É UM TIPO RESERVADO (como a Clássica): ela NÃO vive na coleção `leagueTypes`, então
     não tem `typeConfig` -- e caía no `else` do render, que é o bloco da CLÁSSICA. Reportado:
     *"na liga pro, muda a descrição, esta aparecendo a descrição da Liga Classica"*. */
  const g = S.__getGame();
  g.leagueScreenLoading = false;
  g.leagueData = { cycles: [] };
  g.currentLeagueTypeConfig = null;

  g.currentLeagueTypeId = P_TIPO; S.__setGame(g);
  const hPro = S.renderLeague();
  g.currentLeagueTypeId = C_TIPO; S.__setGame(g);
  const hCla = S.renderLeague();

  ok('a Pro tem título próprio', hPro.indexOf('Liga Pro</h2>') > 0);
  ok('  e NÃO mostra a descrição da Clássica', hPro.indexOf('Ligas de 16 ou 8 jogadores') < 0);
  ok('  (e a Clássica continua com a dela)', hCla.indexOf('Ligas de 16 ou 8 jogadores') > 0);
  ok('  e a Clássica não ganhou a da Pro', hCla.indexOf('ninguém traz o time de casa') < 0);

  /* ⚠️ OS NÚMEROS SÃO DERIVADOS das constantes, nunca escritos na frase: um número fixo
     envelheceria no primeiro ajuste -- é o defeito que o rótulo do revezamento da Corrida teve. */
  ok('  ela diz quantos são sorteados', hPro.indexOf('<strong>' + P_SORT + ' pokémon sorteados</strong>') > 0);
  ok('  e quantos ele escolhe', hPro.indexOf('<strong>' + P_ESC + '</strong>') > 0);
  /* ⚠️ AS TRÊS VIRARAM UMA LISTA, com o NOME do tier (23/09/2026, a pedido) -- e ela sai na ordem
     da ROTAÇÃO, porque a frase diz *"seguindo a ordem"*. */
  ok('  e as TRÊS faixas, na ordem da rotação, com o nome do tier',
     P_FX.every(f => hPro.indexOf('Liga Pro ' + S.proNomeDaFaixa(f) + ': Level ' + f[0] + '-' + f[1]) > 0)
     && hPro.indexOf('pro-tiers') > 0,
     P_FX.map(f => S.proNomeDaFaixa(f)).join(' > '));
  ok('    e na ORDEM da rotação, não ordenada por outra coisa',
     P_FX.map(f => hPro.indexOf('Liga Pro ' + S.proNomeDaFaixa(f)))
         .every((p, i, a) => i === 0 || p > a[i-1]));
  /* ⚠️ O NOME É DERIVADO DO NÍVEL, não do índice: a mais baixa é a Bronze. Indexado por posição,
     reordenar a rotação RENOMEARIA os três, e quem viu "Prata 35-50" ontem leria outra coisa. */
  ok('    e o nome sai do NÍVEL (a mais baixa é a Bronze)',
     S.proNomeDaFaixa([15,30]) === 'Bronze' && S.proNomeDaFaixa([35,50]) === 'Prata'
     && S.proNomeDaFaixa([55,70]) === 'Ouro'
     && /const ord = PRO_FAIXAS\.slice\(\)\.sort/.test(src));
  /* ⚠️ AS DUAS FRASES SÃO COBRADAS PELO TEXTO, e não só pelo número: os textos VELHOS também
     traziam o 8 e as três faixas, então uma trava que olhasse só os números passava com eles de
     volta -- foi o que a conferência de acusação mostrou. */
  ok('  e o mínimo pra formar', hPro.indexOf('<strong>' + P_MIN + ' treinadores</strong>') > 0);
  ok('  com a frase pedida (o mínimo)',
     hPro.indexOf('É necessário no mínimo') > 0
     && hPro.indexOf('inscritos para começar') > 0
     && hPro.indexOf('mesma faixa de Level') > 0);
  ok('    e a frase velha não sobrou', hPro.indexOf('Faltando gente') < 0);
  ok('  e com a frase pedida (a ordem das faixas)',
     hPro.indexOf('A cada vez que acontece uma Liga Pro') > 0
     && hPro.indexOf('seguindo a ordem') > 0);
  ok('    e a frase velha não sobrou', hPro.indexOf('e ela gira a cada liga que acontece') < 0);
  /* ⚠️ E ELA EXPLICA O QUE A PRO TEM DE DIFERENTE, não a mecânica inteira: o resto é igual à
     Clássica, e é isso que o pedido diz (*"no mesmo modelo da Liga Classica"*). */
  ok('  e ela nomeia a escolha dos golpes', /golpes<\/strong>/.test(hPro));
  ok('  e o prêmio (o mesmo da Clássica)', /bônus shiny de 1h/.test(hPro) && /bônus shiny de 1h/.test(hCla));
  /* ⚠️ E A PROVA DE QUE ELES SAO DERIVADOS E LER O CODIGO: comparar o HTML com a constante nao
     distingue um numero escrito a mao (hoje 12 e 12). E a mesma tecnica que a conta da Pokedex
     precisou -- ali 250+1 dava 251 e o fixo passava. */
  {
    const ini = src.indexOf('const ehPro = game.currentLeagueTypeId === PRO_LEAGUE_TYPE;');
    /* ⚠️ A FATIA VAI ATÉ O `league-wins-total-label`, e não por OFFSET: fatia por offset envelhece
       no primeiro comentário novo -- foi o que derrubou quatro travas deste arquivo hoje. */
    const bl = ini < 0 ? '' : src.slice(ini, src.indexOf('league-wins-total-label', ini));
    ok('  (a trava tem o bloco da descrição pra ler)', bl.length > 800, bl.length + ' chars');
    ok('  e os números vêm das CONSTANTES, não escritos na frase',
       bl.indexOf('${PRO_SORTEADOS}') > 0 && bl.indexOf('${PRO_ESCOLHE}') > 0
       && bl.indexOf('PRO_FAIXAS.map') > 0 && bl.indexOf('${REGULAR_LIGA_SIZE}') > 0);
  }
}

console.log('\n=== O CONTADOR SEPARADO ===');
{
  const g = S.__getGame();
  g.leagueScreenLoading = false; g.leagueData = { cycles: [] }; g.currentLeagueTypeConfig = null;
  g.leagueWinsTotal = 7; g.leagueWinsPro = 2;

  g.currentLeagueTypeId = P_TIPO; S.__setGame(g);
  const hPro = S.renderLeague();
  g.currentLeagueTypeId = C_TIPO; S.__setGame(g);
  const hCla = S.renderLeague();
  const num = h => (h.match(/league-wins-total-num">(\d+)</) || [])[1];
  const rot = h => (h.match(/league-wins-total-label">([^<]*)</) || [])[1];

  ok('a Pro mostra SÓ as vitórias dela', num(hPro) === '2', num(hPro));
  ok('  com rótulo próprio', rot(hPro) === 'Campeão da Liga Pro', rot(hPro));
  ok('a Clássica continua no total', num(hCla) === '7', num(hCla));
  ok('  com o rótulo de sempre', rot(hCla) === 'Campeão da Liga Pokémon', rot(hCla));

  /* ⚠️ E A PRO CONTA NOS DOIS: o total alimenta as conquistas e o histórico, e o recorte é só a
     TELA. Contando só num deles, ou a conquista deixaria de ver a Pro, ou a tela dela mostraria
     as vitórias da Clássica junto -- que é o que o pedido tira. */
  const bloco = (src.match(/async function recordLeagueChampionWin\([\s\S]*?\n\}/) || [''])[0];
  ok('  (a trava tem o bloco pra ler)', bloco.length > 300, bloco.length + ' chars');
  ok('  o cliente conta nos DOIS', /leagueWinsTotal: firebase\.firestore\.FieldValue\.increment\(1\)/.test(bloco)
     && /typeId===PRO_LEAGUE_TYPE \? \{ leagueWinsPro/.test(bloco));
  /* ⚠️ E O SERVIDOR É O ESPELHO: quando o navegador de outro jogador (ou ninguém) resolve a
     partida, é ele que roda -- se os dois divergirem, o contador fica certo em umas contas e
     errado em outras. */
  const blocoSrv = (srvSrc.match(/async function recordLeagueChampionWin\([\s\S]*?\n\}/) || [''])[0];
  ok('  e o servidor também', /typeId===PRO_LEAGUE_TYPE \? \{ leagueWinsPro/.test(blocoSrv), blocoSrv.length + ' chars');
  /* ⚠️ E O CAMPO ENTRA NO `CAMPOS_DA_CONTA`: sem isso o `resetGame` o apagaria ao abrir um save. */
  ok('  e o campo está no CAMPOS_DA_CONTA', /'leagueWinsTotal','leagueWinsPro'/.test(src));
}

console.log('\n=== OS GOLPES, DEPOIS DOS 6 ===');
{
  /* Pedido: *"após escolher os 6 pokemons, o usuario vai precisar escolher os ataques de cada
     pokemon tambem, até aquele level que ele esta, e ai sim a inscrição vai ser feita"*. */
  const g = S.__getGame();
  g.authUser = { uid: 'u1' }; g.trainerName = 'Buzzo';
  g.currentLeagueTypeId = P_TIPO;
  g.proCicloId = 'c1'; g.proFaixa = 0;
  g.proBolo = S.proSorteiaBolo('u1', 'c1', 0);
  g.proEscolhidos = [0, 1, 2, 3, 4, 5];
  g.proGolpes = {}; g.proGolpesMarcados = [];
  S.__setGame(g);

  /* ⚠️ A INSCRIÇÃO É DUBLADA: ela fala com o Firestore, que não existe aqui -- o que se mede é o
     FLUXO de tela, e o time que chega nela. */
  let inscrito = null;
  const original = S.inscreverNaLigaPro;
  S.inscreverNaLigaPro = function(){
    const feitos = S.__getGame().proGolpes || {};
    inscrito = (S.__getGame().proEscolhidos || []).map(i => {
      const inst = S.proInstanciaDoBolo(i);
      const disp = S.ataquesEscolhiveis(inst);
      const meus = (feitos[i] || []).filter(x => disp.indexOf(x) >= 0).slice(0, S.MAX_GOLPES);
      inst.ataques = meus.length ? meus : S.ataquesPadrao(inst);
      return inst;
    });
    const gg = S.__getGame(); gg.screen = 'league'; S.__setGame(gg);
  };

  S.proIrParaOsGolpes();
  ok('o botão dos 6 leva à tela de GOLPES', S.__getGame().screen === 'proGolpes', S.__getGame().screen);

  /* ⚠️ QUEM TEM <= MAX_GOLPES DISPONÍVEIS NÃO VÊ TELA: escolher 3 entre 3 não é escolha, e uma
     tela de uma resposta só é pior que tela nenhuma. É a MESMA regra da captura na jornada. */
  const semEscolha = (S.__getGame().proEscolhidos || [])
    .filter(i => S.ataquesEscolhiveis(S.proInstanciaDoBolo(i)).length <= S.MAX_GOLPES);
  ok('  e quem tinha ' + S.MAX_GOLPES + ' ou menos já veio preenchido',
     semEscolha.every(i => Array.isArray(S.__getGame().proGolpes[i])),
     semEscolha.length + ' preenchido(s) sem tela');

  const h = S.renderProGolpes();
  const alvo = S.proInstanciaDoBolo(S.__getGame().proGolpeDe);
  ok('  a tela nomeia o pokémon', h.indexOf(alvo.name) > 0);
  ok('  e o NÍVEL dele (a lista é até aquele nível)', h.indexOf('Lv.' + alvo.level) > 0);
  ok('  e mostra as opções', (h.match(/golpe-opcao/g) || []).length === S.ataquesEscolhiveis(alvo).length,
     (h.match(/golpe-opcao/g) || []).length + ' de ' + S.ataquesEscolhiveis(alvo).length);
  ok('  e diz quantos faltam', /de \d+ prontos/.test(h), (h.match(/hint-text[^>]*>([^<]*)/) || [])[1]);
  /* ⚠️ A LISTA É A MESMA DA TELA DA JORNADA (o `listaDeGolpesHtml`): as telas de golpe da casa
     dividem os blocos desde 09/09, e montadas em separado elas já tinham divergido no texto. */
  ok('  e a lista é a MESMA função da tela da jornada',
     /function listaDeGolpesHtml\(disp, marcados, fnMarcar\)/.test(src)
     && /listaDeGolpesHtml\(disp, marcados, 'marcarAtaque'\)/.test(src)
     && /listaDeGolpesHtml\(disp, marcados, 'proMarcarGolpe'\)/.test(src));

  const dispAlvo = S.ataquesEscolhiveis(alvo);
  dispAlvo.slice(0, S.MAX_GOLPES + 2).forEach(x => S.proMarcarGolpe(x));
  ok('  o teto é ' + S.MAX_GOLPES, (S.__getGame().proGolpesMarcados || []).length === S.MAX_GOLPES,
     (S.__getGame().proGolpesMarcados || []).length + ' marcados');

  /* ⚠️ QUEM VALIDA É A AÇÃO: com menos que MAX_GOLPES ela recusa, e golpe forjado ela filtra */
  {
    const gg = S.__getGame(); const antes = gg.proGolpeDe;
    gg.proGolpesMarcados = [dispAlvo[0]]; S.__setGame(gg);
    S.proConfirmarGolpes();
    ok('  e a AÇÃO recusa com menos que ' + S.MAX_GOLPES,
       S.__getGame().proGolpeDe === antes && !S.__getGame().proGolpes[antes]);
    const g2 = S.__getGame();
    g2.proGolpesMarcados = ['hyperbeam', 'naoexiste', dispAlvo[0]]; S.__setGame(g2);
    S.proConfirmarGolpes();
    ok('  e golpe que ele NÃO aprende é filtrado (não confirma)',
       S.__getGame().proGolpeDe === antes && !S.__getGame().proGolpes[antes]);
  }

  let telas = 0;
  while (S.__getGame().screen === 'proGolpes' && telas++ < 20) {
    const inst = S.proInstanciaDoBolo(S.__getGame().proGolpeDe);
    const d = S.ataquesEscolhiveis(inst);
    const gg = S.__getGame(); gg.proGolpesMarcados = []; S.__setGame(gg);
    d.slice(0, S.MAX_GOLPES).forEach(x => S.proMarcarGolpe(x));
    S.proConfirmarGolpes();
  }
  ok('a fila termina e INSCREVE', S.__getGame().screen === 'league' && !!inscrito, S.__getGame().screen);
  ok('  com os SEIS', (inscrito || []).length === P_ESC);
  /* ⚠️ A REGRA É "CADA UM LEVA O QUE DÁ, ATÉ `MAX_GOLPES`", e não "todo mundo leva 3": na faixa
     Bronze (15-30) só 43,6% das espécies aprendem três golpes de dano naquele nível -- medido em
     720 sorteios. A trava dizia 3 porque ela nasceu com a rotação começando no OURO, onde 94,3%
     levam três. É a mesma família das travas que mediam o painel e não a regra. */
  ok('  cada um leva o que dá, até ' + S.MAX_GOLPES,
     (inscrito || []).every((p, k) => {
       const i = S.__getGame().proEscolhidos[k];
       const disp = S.ataquesEscolhiveis(S.proInstanciaDoBolo(i));
       return (p.ataques || []).length === Math.min(S.MAX_GOLPES, disp.length);
     }), JSON.stringify((inscrito || []).map(p => (p.ataques || []).length)));
  /* ⚠️ E SÃO OS QUE O JOGADOR ESCOLHEU, não o `ataquesPadrao`: a escolha é a mais forte do jogo
     (o par de golpes vale 79 pontos de taxa de vitória entre o melhor e o pior par).
     ⚠️ ISSO SE PROVA LENDO O CÓDIGO, e não pelo `inscrito` acima: a inscrição de verdade fala com
     o Firestore, então ela é DUBLADA aqui -- e uma asserção sobre o dublê mede a cópia da regra
     que o próprio teste escreveu. É a armadilha do *"trava que pergunta à função que ela mede"*,
     e foi a conferência de acusação que a pegou (o defeito passava em branco). */
  {
    const i0 = src.indexOf('async function inscreverNaLigaPro(');
    const bl = i0 < 0 ? '' : src.slice(i0, src.indexOf('\nasync function ', i0 + 10));
    ok('  (a trava tem a inscrição pra ler)', bl.length > 500, bl.length + ' chars');
    ok('  e ela usa os golpes ESCOLHIDOS, com o automático só de rede',
       /inst\.ataques = meus\.length \? meus : ataquesPadrao\(inst\)/.test(bl));
    ok('  e ela filtra pelo que a espécie aprende NAQUELE nível',
       /const disp = ataquesEscolhiveis\(inst\)/.test(bl)
       && /\(feitos\[i\] \|\| \[\]\)\.filter\(g => disp\.indexOf\(g\) >= 0\)\.slice\(0, MAX_GOLPES\)/.test(bl));
  }
  /* ⚠️ E TODO GOLPE É DA ESPÉCIE NAQUELE NÍVEL -- o servidor valida isso pelo `golpesValidos`, e um
     golpe que ele não aprende sumiria lá, deixando o time com menos golpe que a tela mostrou. */
  ok('  e todo golpe é da espécie NAQUELE nível', (inscrito || []).every(p => {
    const disp = S.ataquesDisponiveis(p.speciesId, p.level);
    return (p.ataques || []).every(x => disp.indexOf(x) >= 0);
  }));

  /* ⚠️ O MAPA É POR ÍNDICE DO BOLO: voltar e trocar um dos seis NÃO invalida os golpes dos outros */
  {
    const guardados = JSON.stringify(S.__getGame().proGolpes);
    S.proVoltarDosGolpes();
    ok('  e o Voltar leva ao picker', S.__getGame().screen === 'leagueTeamPicker', S.__getGame().screen);
    ok('  e o que já foi escolhido FICA', JSON.stringify(S.__getGame().proGolpes) === guardados);
  }
  /* ⚠️ E O CICLO QUE VIRA LIMPA OS GOLPES: eles são por índice do bolo, e o bolo passa a ser OUTRO */
  ok('  e o ciclo que vira limpa os golpes junto',
     /game\.proBolo = proSorteiaBolo\(uid, cycleEntry\.id, game\.proFaixa\);[\s\S]{0,400}game\.proGolpes = \{\};/.test(src));

  S.inscreverNaLigaPro = original;
}
}
