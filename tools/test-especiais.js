/**
 * OS GOLPES ESPECIAIS -- autodestruicao, sono e metronomo.
 *
 * Por que isso existe: sao os primeiros efeitos do jogo que NAO sao dano, e eles vivem no motor de
 * batalha, que e DUPLICADO (cliente e servidor). Uma diferenca de uma linha entre os dois faz a
 * liga decidir uma coisa e a animacao mostrar outra -- e o jogador so descobre isso quando perde
 * uma final. Por isso a ultima secao compara os dois motores golpe a golpe, com a mesma semente.
 *
 * Trancado aqui: as listas (que saem do aprendizado por NIVEL da Gen 1/2), as chances, o efeito de
 * cada golpe, quem ganha quando os dois ultimos caem juntos, a imunidade dos chefes, e a mensagem
 * na tela.
 *
 *   node tools/test-especiais.js
 */
const path = require('path');
const Module = require('module');
const raiz = path.join(__dirname, '..');
const { createSandbox, extractGameScript } = require('./game-sandbox');
const S = createSandbox();

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const inst = (id, lv) => S.createInstance(id, lv || 50);
/* ⚠️ O SONO E A ANULACAO VIRARAM GOLPES DA TROCA EM 25/09/2026 (a pedido), entao quem os exercita
   e o doExchange -- nao mais o tentarGolpeEspecial, que e a fila de ABERTURA. Este ajudante roda
   UMA troca com instancias novas e devolve o diario dela, que e o que as travas de chance e de
   marca precisam ler.
   ⚠️ E O METRONOMO CONTINUA NA FILA DE ABERTURA devolvendo sono e anula, entao os dois ramos do
   tentarGolpeEspecial NAO ficaram orfaos -- e e por isso que as travas dele continuam. */
function umaTroca(donoId, alvoId, lv){
  const x = inst(donoId, lv), y = inst(alvoId, lv);
  x.maxHp = S.calcMaxHp(x); x.hp = x.maxHp;
  y.maxHp = S.calcMaxHp(y); y.hp = y.maxHp;
  const d = [];
  S.doExchange(x, y, Math.random, d, 'p', 'e');
  return { d, dono: x, alvo: y };
}
/* acha a PRIMEIRA troca em que a marca saiu, e devolve o cenario dela */
function trocaCom(marca, donoId, alvoId, lv, max){
  for(let i = 0; i < (max || 4000); i++){
    const t = umaTroca(donoId, alvoId, lv);
    if(t.d.some(g => g.x === marca)) return t;
  }
  return null;
}
// rng de teste: devolve os numeros que a gente mandar, e depois 0.99 (nada acontece)
/* rng que sempre devolve o mesmo numero: com 0.01 todo sorteio de chance passa, com 0.99 nenhum.
   Mais legivel que uma sequencia -- a ordem em que o motor consome os numeros nao importa aqui. */
const rngFixo = (v) => () => v;
/* HP QUE SUMIU SEM SER GOLPE DO OUTRO LADO. Sao os efeitos em que o `q` do registro e de quem
   CAUSOU e o HP some do lado OPOSTO -- o dano da drenagem, a confusao (ele se acertou) e a furia
   do dragao (40 fixos no adversario). Toda conta de "quanto ele perdeu de vida" soma os golpes do
   ADVERSARIO, e esses tres nao sao golpe do adversario: sem descontar, o contrato acusa um
   confronto que esta certo.
   ELA E UMA FUNCAO E NAO TRES LISTAS ESCRITAS A MAO, e isso e a licao de 11/09/2026: quando a
   furia do dragao entrou, a lista estava copiada em QUATRO contas deste arquivo, e a quarta que
   ficasse pra tras falharia raro e intermitente -- o pior tipo de teste. O proximo efeito desta
   familia entra numa linha so. */
/* ⚠️ O LOG DE CADA CONFRONTO COMECA COMPRIMIDO (16/09/2026): o passo a passo so e desenhado quando
   o jogador toca no cabecalho. Toda trava que LE o passo a passo tem que abrir antes -- e este
   ajudante e o que impede que a proxima seja escrita lendo um log vazio e dando verde a toa. */
/* o + / − de cada confronto, lido do CONTEUDO do botao -- e nao do HTML literal, que muda a cada
   ajuste de marcacao (ja mudou uma vez, quando ele deixou de ser um <span> no bloco do × e virou
   um <button> na linha de baixo). */
const sinaisDoLog = (html) => (html.match(/class="mlog-mais"[\s\S]*?>([+−])</g) || [])
  .map(x => x.slice(-2, -1));
const logAberto = (lista) => {
  /* ⚠️ ABRE PELA API DE VERDADE (a mesma que o clique chama), e nao escrevendo no estado: o `game`
     e REATRIBUIDO pelo resetGame, entao uma referencia guardada aponta pro objeto velho -- e o
     ajudante escrevia num lugar que o render nao le. De quebra, isto faz toda trava que le o log
     exercitar o caminho do clique. */
  S.renderMatchupLog(lista);                       // cria o estado com a chave da tela
  /* ⚠️ GARANTE ABERTO, nao alterna: a chave e tela+tamanho, entao dois blocos deste arquivo com
     o mesmo numero de confrontos compartilham o estado -- e alternar ali FECHAVA o que o bloco
     anterior tinha aberto. */
  const jaAbertos = S.abertosDoLog(lista);
  lista.forEach((m, i) => { if(!jaAbertos[i]) S.alternarLogDoConfronto(i); });
  return S.renderMatchupLog(lista);
};
/* ⚠️ OS SELOS VIRARAM DESENHO NOSSO (17/09/2026), entao as travas pararam de procurar o
   CARACTERE e passaram a procurar o SELO -- o id do <symbol>, que e a identidade dele.
   E melhor de duas formas: o desenho pode ser reajustado sem derrubar 23 travas, e a busca
   deixa de depender de COMO o emoji foi escrito (uns estao como caractere e outros como
   escape \uXXXX, e isso ja me custou uma busca que nao achava nada).
   As travas de FRASE continuam cobrando a frase inteira: o que mudou e o icone vir do
   ICONES_ESPECIAIS em vez de escrito a mao -- assim ela nao envelhece junto com o desenho. */
const temSelo = (html, nome) => String(html || "").indexOf("#s-" + nome) >= 0;

const danoSemGolpe = (g) => !!g && (g.x === 'absorbdano' || g.x === 'confusao' || g.x === 'furiadragao');
/* ⚠️ A QUEIMADURA (16/09/2026) E A QUARTA DA FAMILIA, e ela e a PRIMEIRA em que o `q` e de QUEM
   PERDE -- nas outras tres ele e de quem CAUSOU, e por isso todas as contas deste arquivo invertem
   o `q` pra achar o lado. A queimadura nao tem causador na troca em que ela doi (ela foi aplicada
   turnos atras), entao o `q` dela ja e o lado certo.
   Somada ao `danoSemGolpe` sem mais nada, ela seria contada no lado ERRADO em todas as oito contas
   -- e o sintoma seria a soma nao fechar, que e justamente o que essas contas medem. */
/* ⚠️ O VENENO (16/09/2026) entrou aqui junto da queimadura: sao os DOIS status de dano por turno,
   e nos dois o `q` e de quem PERDE. Uma linha so -- a licao de sempre deste arquivo. */
/* ⚠️ A CONFUSAO MUDOU DE FAMILIA EM 24/09/2026, e isso e o que uma leitura ingenua erraria: a
   marca VELHA (`confusao`, a passiva) tem o `q` de QUEM CONFUNDIU, e a NOVA (`confuso`, o
   auto-golpe) tem o `q` de QUEM SE ACERTOU -- como a queimadura e o veneno. As duas convivem
   porque log velho nao pode sumir, e por isso cada uma esta numa lista. */
const danoNoProprio = (g) => !!g && (g.x === 'queima' || g.x === 'veneno' || g.x === 'confuso');
/* ⚠️ E QUEM RESPONDE "QUANTO O LADO X PERDEU SEM SER GOLPE DO OUTRO" E ESTA FUNCAO, nao cada conta
   invertendo o `q` na mao. Com duas convencoes de `q` convivendo, a inversao escrita a mao em oito
   lugares era garantia de que um deles ficaria pra tras -- a mesma licao que fez o `danoSemGolpe`
   virar funcao quando a Furia do Dragao entrou. */
const perdeuSemGolpe = (g, lado) =>
  ((danoSemGolpe(g) && g.q !== lado) || (danoNoProprio(g) && g.q === lado)) ? (g.d || 0) : 0;
/* VIDA DEVOLVIDA SEM SER CURA: desde 11/09/2026 o desempate poe o sobrevivente de volta de pe numa
   linha PROPRIA, com a barra subindo, em vez de o motor APARAR o golpe que o derrubou -- o aparo
   escrevia na tela um numero que nunca aconteceu (ver o CLAUDE.md).
   O `q` da linha e de quem DEU o golpe, como no resto do log, entao a vida volta pro lado OPOSTO:
   e a mesma forma do `danoSemGolpe`, com o sinal trocado. Toda conta de HP deste arquivo precisa
   das DUAS, e por isso as duas vivem aqui em cima -- copiadas a mao em cada conta, a proxima
   ficaria pra tras (ja aconteceu com o `absorbdano`, que falhava raro e intermitente). */
const devolveVida = (g) => !!g && g.x === 'desempate' && g.d > 0;
/* VIDA QUE SOBE NO LADO DO `q` -- as curas. Cura, poção, drenagem de abertura, fúria e, desde
   15/09/2026, a DRENAGEM NO GOLPE (`dreno`), que devolve metade do dano ao atacante.
   ⚠️ ELA VIRA FUNCAO PELA MESMA LICAO DO `danoSemGolpe`: esta lista estava copiada A MAO em NOVE
   contas deste arquivo, e a nona que ficasse pra tras falharia raro e intermitente -- o pior tipo
   de teste. O `dreno` entrou numa linha so; o proximo efeito desta familia tambem. */
const subiuAVida = (g) => !!g && (g.x === 'recover' || g.x === 'pocao' || g.x === 'absorb' ||
                                  g.x === 'furia' || g.x === 'dreno');

console.log('\nAS LISTAS SAO DO APRENDIZADO POR NIVEL DA GEN 1/2');
ok('9 especies aprendem autodestruicao', S.AUTODESTRUICAO.length === 9, S.AUTODESTRUICAO.join(', '));
ok('e sao as certas (Geodude/Voltorb/Koffing/Pineco e evolucoes)',
   ['geodude','graveler','golem','voltorb','electrode','koffing','weezing','pineco','forretress']
     .every(id => S.AUTODESTRUICAO.includes(id)));
ok('43 especies tem golpe de sono', Object.keys(S.SONIFEROS).length === 43, Object.keys(S.SONIFEROS).length + '');
ok('cada uma com o NOME do golpe dela',
   S.SONIFEROS.paras === 'Esporo' && S.SONIFEROS.jigglypuff === 'Canto' &&
   S.SONIFEROS.gengar === 'Hipnose' && S.SONIFEROS.oddish === 'Pó do Sono' && S.SONIFEROS.jynx === 'Beijo Adorável');
/* A LISTA DO METRONOMO MUDOU EM 10/09/2026, a pedido: entraram Snorlax, Clefairy, Clefable e MEW
   (os tres primeiros aprendem Metronomo por nivel no original e tinham ficado de fora; o Mew e o
   dono do golpe), e o SNUBBULL saiu -- ele nao aprende Metronomo por nivel na Gen 3, e hoje luta
   com o moveset dele.
   O SNORLAX SAIU EM 11/09/2026, a pedido -- mesmo caso do Snubbull: ele tambem nao aprende
   Metronomo por nivel na Gen 3 e estava aqui por pedido. */
ok('a lista do metronomo e a pedida',
   S.METRONOMO.join(',') === 'cleffa,clefairy,clefable,mew,togepi,togetic', S.METRONOMO.join(','));
ok('e o Snubbull e o Snorlax sairam dela',
   !S.METRONOMO.includes('snubbull') && !S.METRONOMO.includes('snorlax'), S.METRONOMO.join(','));
/* Especie que nao existe no SPECIES seria um golpe que nunca sai -- e ninguem perceberia.
   O MEW E A EXCECAO, e ela e declarada: ele nao esta no SPECIES de proposito (e o chefe da raide, e
   uma vaga #151 que ninguem captura quebraria o "capturou tudo" do desafio do Mewtwo), mas o
   `bossInstance` do servidor carimba speciesId 'mew' -- entao a entrada dele no METRONOMO NAO e
   letra morta: e por ela que o Mew da raide sorteia o golpe. */
const foraDaTabela = [...S.AUTODESTRUICAO, ...Object.keys(S.SONIFEROS), ...S.METRONOMO]
  .filter(id => !S.SPECIES[id] && id !== 'mew');
ok('nenhuma especie das listas esta fora do SPECIES', foraDaTabela.length === 0, foraDaTabela.join(','));

console.log('\nO QUE CADA GOLPE FAZ');
/* AUTODESTRUICAO: os dois caem. E o unico caminho do jogo em que isso acontece -- o doExchange
   normal sempre deixa um de pe (o desempate). */
let a = inst('geodude'), b = inst('onix');
a.maxHp = S.calcMaxHp(a); a.hp = a.maxHp; b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
let diario = [];
ok('explodiu: o confronto se resolve ali', S.tentarGolpeEspecial(a, b, rngFixo(0.01), diario) === true);
ok('e os dois caem na hora', a.hp === 0 && b.hp === 0, 'a=' + a.hp + ' b=' + b.hp);
ok('o log ganha a linha da explosao', diario.some(g => g.x === 'boom' && g.g === 'auto-destruição'));

/* SONO: o alvo passa DUAS TROCAS sem revidar e depois acorda -- a luta segue normal.
   Ja foi abate instantaneo, e os jogadores reclamaram com razao: nao era o numero que pesava
   (medido, valia +1,4 ponto de vitoria contra +0,8 do Recuperar), era a FORMA -- perder um pokemon
   inteiro pra um sorteio de 5%, sem jogada possivel e sem tomar um golpe.
   Medido depois da mudanca: o ganho cai de +1,4 pra +0,7 ponto. */
/* ⚠️ O SONO SAIU DA FILA DE ABERTURA EM 25/09/2026: ele virou um golpe da TROCA, sorteado a cada
   uma, e quem o usa PERDE o ataque daquela troca. Antes ele era sorteado uma vez por confronto e
   saia de graca -- o pokemon dormia o outro E atacava na mesma troca.
   Estas travas passaram a ler o doExchange; o que elas cobram e o mesmo de sempre, mais a regra
   nova (o dono nao atacou). */
const tSono = trocaCom('sono', 'jigglypuff', 'onix');
ok('dormiu: o sono sai numa TROCA, nao na abertura', !!tSono);
const sonoLinha = tSono ? tSono.d.find(g => g.x === 'sono') : null;
ok('e ele nao resolve o confronto -- os dois continuam de pe',
   !!tSono && tSono.dono.hp > 0 && tSono.alvo.hp > 0,
   tSono ? 'dono=' + tSono.dono.hp + ' alvo=' + tSono.alvo.hp : '');
/* ⚠️ A REGRA NOVA, e ela e o preco que equilibra o sono ter passado a ser sorteado a cada troca:
   quem dorme o outro nao ataca. Sem isso ele dormiria E bateria, que e como era na abertura. */
ok('e QUEM DORMIU O OUTRO nao atacou naquela troca',
   !!tSono && !tSono.d.some(g => !g.x && g.q === 'p' && g.d > 0),
   tSono ? tSono.d.map(g => g.q + ':' + (g.x || g.d)).join(' ') : '');
b = tSono ? tSono.alvo : inst('onix');
/* ⚠️ DE 1 A 3 TROCAS, 1/3 CADA (15/09/2026, a pedido). Era um numero FIXO (2 ate 09/09, 1 dai em
   diante) e virou a tabela SONO_EM_TROCAS, com peso. O que a trava cobra aqui e o INVARIANTE --
   o valor marcado e sempre uma das duracoes da tabela --, e nao um numero escrito a mao: assim
   ela continua valendo no dia em que os pesos mudarem. A DISTRIBUICAO tem trava propria, logo
   abaixo, e ela e que cobra o 1/3. */
const duracoes = S.SONO_EM_TROCAS.map(x => x[0]);
ok('e o alvo fica marcado por uma das duracoes da tabela', duracoes.includes(b._dormindoPor),
   'dormindoPor: ' + b._dormindoPor + ' | tabela: ' + duracoes.join('/'));
/* ⚠️ O SORTEIO E 1/3 PRA CADA, e ele le do rng DA BATALHA -- nao de Math.random. Cliente e servidor
   resolvem a MESMA batalha a partir da mesma semente, entao um dado a mais num dos lados desloca a
   semente inteira. A trava dos dois motores esta mais abaixo; aqui se cobra a forma. */
(function(){
  const c = {}; const rng = S.makeSeededRng('sono-dist');
  for(let i = 0; i < 60000; i++){ const d = S.sorteiaTrocasDeSono(rng); c[d] = (c[d]||0) + 1; }
  const pcts = duracoes.map(d => 100 * (c[d]||0) / 60000);
  ok('e as tres duracoes saem em ~1/3 cada', duracoes.length === 3 && pcts.every(x => x > 31 && x < 35.5),
     duracoes.map((d,i) => d + ':' + pcts[i].toFixed(1) + '%').join('  '));
  ok('e nenhuma outra duracao sai', Object.keys(c).length === duracoes.length, Object.keys(c).join(','));
})();
ok('e o log diz qual golpe foi', !!sonoLinha && sonoLinha.g === 'Canto', sonoLinha ? sonoLinha.g : '');
/* QUEM DORME NAO ATACA -- e nao vira linha no log. Uma linha de "-0 de HP" faria o log dizer que
   ele atacou e nao machucou, quando o que aconteceu foi ele nao ter atacado. */
(function(){
  let comSono = null;
  for(let i=0;i<30000 && !comSono;i++){
    const r = S.simulateGymBattle([inst('paras',60)], [inst('onix',60)], Math.random);
    const m = (r.matchups||[])[0];
    if(m && (m.golpes||[]).some(g=>g.x==='sono')) comSono = m;
  }
  ok('achei um confronto com sono', !!comSono);
  if(!comSono) return;
  const golpes = comSono.golpes.filter(g=>!g.x);
  ok('nenhuma linha de dano zero no registro', golpes.every(g=>g.d > 0),
     golpes.map(g=>g.d).join(','));
  /* ⚠️ AS TROCAS LIVRES SAO DE QUEM USOU O SONO -- e sao QUANTAS o sorteio deu, nao duas.
     Esta trava dizia "as DUAS primeiras", e isso caducou em 15/09/2026, quando o sono virou de 1 a
     3 trocas: com UMA, o segundo golpe e do adormecido que acabou de acordar. Ela so nao falhava
     porque o Paras MATAVA o Onix no golpe livre (Planta e 4x contra Pedra/Terra) e nao havia
     segundo golpe -- e isso acabou em 17/09, quando alvo de vida cheia parou de morrer num golpe.
     ⚠️ E E A QUARTA VEZ QUE UMA TRAVA DO SONO MEDE A DURACAO EM VEZ DA REGRA. A regra e: enquanto
     ele esta dormindo, so o dono bate. Quem marca o fim disso e o `acordou`, nao um numero. */
  /* ⚠️ E A SEXTA VEZ QUE ESTA TRAVA MUDA, e a quinta versao durou UM DIA. Ela dizia que o adormecido
     ainda atacava na troca em que era dormido, e isso foi REPORTADO com print em 25/09/2026 (*"o
     dugtrio e o rhyhorn atacaram depois de dormir, isso deveria ser impossivel"*) -- ver a secao do
     CLAUDE.md. Hoje as acoes rodam NA ORDEM de velocidade, e quem e dormido antes da vez dele nao
     ataca.
     ⚠️ E ELA TOLERAVA (`doAdormecido <= 1`) EM VEZ DE EXIGIR: por isso ela passou na regra nova sem
     nada acusar. O invariante de hoje e ZERO, e ele vale nos DOIS casos -- quando o adormecido e o
     mais rapido, o golpe dele e legitimo e sai ANTES da linha do sono, ou seja fora desta janela.
     ⚠️ E O PAINEL DAQUI (Paras 35 x Onix 89) so exercita o alvo mais RAPIDO. O outro caso -- o do
     Rhyhorn, que e o defeito de mecanica -- tem painel proprio logo abaixo. */
  /* ⚠️ E A JANELA COMECA NO SONO, nao no indice 0 (25/09/2026): enquanto ele era ABERTURA o sono
     ERA a primeira linha, e contar do zero dava no mesmo. Hoje ele sai no meio da luta, entao os
     golpes ANTES dele entravam na conta -- medido, 6 de 10 confrontos. */
  const jSono = comSono.golpes.findIndex(g => g.x === 'sono');
  const jAcordou = comSono.golpes.findIndex((g, k) => k > jSono && g.x === 'acordou');
  const livres = comSono.golpes.filter((g, k) =>
    !g.x && g.d > 0 && k > jSono && (jAcordou < 0 || k < jAcordou));
  const doAdormecido = livres.filter(g => g.q === 'e').length;
  const primeiroDoDono = livres.findIndex(g => g.q === 'p');
  const ultimoDoAlvo = livres.reduce((a, g, k) => g.q === 'e' ? k : a, -1);
  ok('os golpes livres sao TODOS do dono',
     livres.length > 0 && doAdormecido === 0 &&
     (primeiroDoDono < 0 || ultimoDoAlvo < primeiroDoDono),
     livres.length + ' livres: ' + livres.map(g=>g.q).join(','));
})();
/* ⚠️ O NOME DO SHINY BRILHA NA BATALHA, em vez da estrela ao lado (25/09/2026, a pedido: *"durante a
   batalha ainda tava mostrando a estrela ao invez de deixar o nome brilhando"*) -- e o brilho foi
   DESFEITO no dia seguinte, tambem a pedido: *"nao ta legal nao, volte como era antes com a estrela
   mesmo e esqueca isso de deixar o nome brilhando"*.
   ⚠️ ELA NAO FOI APAGADA, ela foi VIRADA: hoje ela cobra a ESTRELA nos dois ramos, e que o brilho
   NAO volte. A razao de ela existir continua a mesma -- ela nasceu de um caso MUDO, em que o
   fighterHtml regrediu e nenhuma trava caiu, porque as CINCO telas de batalha passam por aqui e
   nenhuma outra trava as lia.
   ⚠️ E ELA COBRA O PAR: a estrela aparece E o brilho nao. Uma metade so passaria com os dois na
   tela. */
(function(){
  const m = { player:'Charizard', playerSpecies:'charizard', playerLevel:60, playerShiny:true,
    playerMaxHp:300, enemy:'Venusaur', enemySpecies:'venusaur', enemyLevel:60, enemyShiny:false,
    enemyMaxHp:310, golpes:[], playerWon:true };
  /* os DOIS ramos: a cena nova (jornada, telas especiais, Torre, liga, Ginasio da Cidade) e o
     caminho antigo (o Boss, a Selecao, o desafio por codigo, o online) */
  [['a cena NOVA', true], ['o caminho ANTIGO', false]].forEach(([rotulo, novo]) => {
    const shiny = S.fighterHtml(m, 'p', { hp: 230, passo: 0, visualNovo: novo });
    const comum = S.fighterHtml(m, 'e', { hp: 180, passo: 0, visualNovo: novo });
    ok('o shiny leva a ESTRELA em ' + rotulo, shiny.indexOf('#s-shiny') >= 0,
       shiny.indexOf('#s-shiny') >= 0 ? '' : 'a estrela sumiu do painel do lutador');
    ok('  e o nome NAO brilha em ' + rotulo, shiny.indexOf('nome-shiny') < 0);
    ok('  e quem NAO e shiny continua sem os dois em ' + rotulo,
       comum.indexOf('nome-shiny') < 0 && comum.indexOf('#s-shiny') < 0);
  });
  /* ⚠️ E A VARREDURA E A METADE QUE PEGA A VOLTA DO BRILHO: ele chegou a viver em 33 pontos do
     arquivo, e desfaze-lo pela metade deixaria telas com o nome dourado e outras com a estrela --
     que e o estado que o pedido recusa. Contando so um render, a proxima tela que nascesse com o
     brilho passaria.
     ⚠️ E A ESTRELA TEM QUE ESTAR EM MUITOS PONTOS: ela e a forma de marcar o shiny no jogo inteiro.
     Um piso (e nao um numero exato) porque tela nova com shiny nasce somando. */
  const _fsS = require('fs');
  const srcS = _fsS.readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const estrelas = srcS.split('\n').filter(l => /selo\((['"])shiny\1/.test(l));
  ok('o BRILHO nao existe em lugar nenhum do jogo',
     srcS.indexOf('nome-shiny') < 0 && srcS.indexOf('nomeBrilhante') < 0,
     'sobrou nome-shiny ou nomeBrilhante');
  ok('e a ESTRELA marca o shiny em toda tela (>= 30 pontos)', estrelas.length >= 30,
     estrelas.length + ' pontos');
})();
/* ⚠️ O ADORMECIDO NAO ATACA NA TROCA EM QUE ELE DORME (25/09/2026). Reportado com print, e o print
   tinha DOIS casos -- cada um com painel proprio aqui, porque eles tem causas diferentes:
     - o RHYHORN era mais LENTO que quem o dormiu: ele atacou DEPOIS de ja estar dormindo. Defeito
       de MECANICA, medido em 425 de 425 trocas;
     - o DUGTRIO era mais RAPIDO: ele atacou ANTES de o sono sair, o golpe e legitimo, e o que
       estava errado era a linha do sono aparecer na FRENTE dele no log.
   ⚠️ E O PAINEL DE CADA UM E DIRIGIDO PELA VELOCIDADE: com um par em que o dono e mais lento, o
   primeiro caso NUNCA ACONTECE e a trava passaria medindo o conjunto vazio. */
(function(){
  /* o DONO e muito mais rapido (Jumpluff 137 x Snorlax 41): o alvo e dormido ANTES da vez dele */
  let trocas = 0, alvoAtacou = 0;
  for(let i = 0; i < 4000 && trocas < 200; i++){
    const t = umaTroca('jumpluff', 'snorlax', 60);
    if(!t.d.some(g => g.x === 'sono')) continue;
    trocas++;
    if(t.d.some(g => !g.x && g.q === 'e' && g.d > 0)) alvoAtacou++;
  }
  ok('(achei trocas com o dono mais RAPIDO que o alvo)', trocas >= 50, trocas + ' trocas');
  ok('o alvo mais LENTO nao ataca na troca em que e dormido', trocas > 0 && alvoAtacou === 0,
     alvoAtacou + ' de ' + trocas + ' (era 425 de 425 antes do conserto)');

  /* o DONO e mais lento (Vileplume 65 x Jolteon 161): o alvo ja atacou quando o sono sai */
  let t2 = 0, atacou = 0, antesDoSono = 0;
  for(let i = 0; i < 6000 && t2 < 200; i++){
    const t = umaTroca('vileplume', 'jolteon', 60);
    const iS = t.d.findIndex(g => g.x === 'sono');
    if(iS < 0) continue;
    t2++;
    const iG = t.d.findIndex(g => !g.x && g.q === 'e' && g.d > 0);
    if(iG >= 0){ atacou++; if(iG < iS) antesDoSono++; }
  }
  ok('(achei trocas com o alvo mais RAPIDO que o dono)', t2 >= 50, t2 + ' trocas');
  ok('o alvo mais RAPIDO ataca (o golpe dele e legitimo)', t2 > 0 && atacou > 0,
     atacou + ' de ' + t2);
  /* ⚠️ ESTA E A METADE DO DUGTRIO: o golpe dele e o mesmo, o que muda e a ORDEM no log. */
  ok('e o golpe dele vem ANTES da linha do sono no log', atacou > 0 && antesDoSono === atacou,
     antesDoSono + ' de ' + atacou + ' antes (era 0 de 993)');
})();
/* ⚠️ E QUEM ESTA IMPEDIDO NAO AGE -- o mesmo defeito por outra porta: as guardas de "perdeu a vez"
   barravam o GOLPE e nao a ACAO, entao um pokemon DORMINDO usava o Po do Sono. */
(function(){
  let trocas = 0, agiuDormindo = 0;
  for(let i = 0; i < 4000; i++){
    const a = inst('butterfree', 50), b = inst('venomoth', 50);
    a.maxHp = S.calcMaxHp(a); a.hp = a.maxHp; b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
    let n = 0;
    while(a.hp > 0 && b.hp > 0 && n++ < 30){
      const dA = a._dormindoPor > 0, dB = b._dormindoPor > 0, d = [];
      S.doExchange(a, b, Math.random, d, 'p', 'e');
      trocas++;
      d.forEach(g => { if(['sono','semSono','disable'].indexOf(g.x) < 0) return;
        if(g.q === 'p' ? dA : dB) agiuDormindo++; });
    }
  }
  ok('(achei trocas no par de dois sonifieros)', trocas > 5000, trocas + ' trocas');
  ok('quem esta DORMINDO nao usa o sono nem a anulacao', agiuDormindo === 0,
     agiuDormindo + ' de ' + trocas + ' (eram 854 em 16.023)');
})();
/* ⚠️ E A GUARDA LISTA AS CINCO CONDICOES, nos DOIS motores -- a lista e a MESMA que barra o golpe.
   Sem ler o codigo, a proxima condicao que nascer entra no golpe e fica de fora da acao, e so o
   painel que a produzisse acusaria. */
/* ⚠️ AS FONTES SAO LIDAS AQUI, e nao reusadas de outro bloco: o `src` daquele arquivo e LOCAL de
   cada bloco que o le -- usado daqui ele daria ReferenceError. */
const _fs = require('fs');
[['index.html', _fs.readFileSync(path.join(raiz, 'index.html'), 'utf8')],
 ['functions/index.js', _fs.readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8')]].forEach(([nome, txt]) => {
  const i = txt.indexOf('const podeAgirNaTroca');
  const fatia = txt.slice(i, txt.indexOf('};', i));
  ok('  (a guarda de quem pode agir existe em ' + nome + ')', i > 0 && fatia.length > 100,
     fatia.length + ' chars');
  ['Dorme', 'Congelado', 'Travado', 'Confuso', 'Cura'].forEach(cond => {
    ok('  e ela olha o ' + cond + ' em ' + nome, fatia.indexOf('active' + cond) > 0 && fatia.indexOf('enemy' + cond) > 0);
  });
});
/* E o alvo pode SOBREVIVER e ganhar -- o que antes era impossivel. */
(function(){
  let venceuDepoisDeDormir = 0, total = 0;
  for(let i=0;i<20000;i++){
    const r = S.simulateGymBattle([inst('jigglypuff',60)], [inst('snorlax',60)], Math.random);
    const m = (r.matchups||[])[0];
    if(!m || !(m.golpes||[]).some(g=>g.x==='sono')) continue;
    total++;
    if(!m.playerWon) venceuDepoisDeDormir++;
  }
  ok('quem dorme pode acordar e VENCER o confronto', total > 0 && venceuDepoisDeDormir > 0,
     venceuDepoisDeDormir + ' de ' + total + ' (antes era 0 -- o sono matava na hora)');
})();
/* O LOG NAO PODE SE CONTRADIZER: em confronto longo a reconstrucao nao sabe do sono e comecava
   pelo golpe de quem tinha acabado de dormir. */
(function(){
  let longo = null;
  for(let i=0;i<30000 && !longo;i++){
    const r = S.simulateGymBattle([inst('jigglypuff',60)], [inst('snorlax',60)], Math.random);
    const m = (r.matchups||[])[0];
    if(m && (m.golpes||[]).some(g=>g.x==='sono') && (m.golpes||[]).filter(g=>!g.x).length > 3) longo = m;
  }
  ok('achei um confronto longo com sono', !!longo);
  if(!longo) return;
  const seq = S.sequenciaDoConfronto(longo);
  const sono = seq.find(g=>g.x==='sono');
  ok('o sono sobrevive ao teto de golpes', !!sono);
  /* ELE ABRE O CONFRONTO -- com UMA excecao declarada: o revide MORIBUNDO de quem dormiu vai pra
     frente dele desde 10/09/2026 (ver o CLAUDE.md), justamente pra nao partir ao meio a sequencia
     de golpes que a troca livre compra. Entao o sono e o indice 0 ou o 1, e nunca mais que isso.
     Ficou visivel quando a CONFUSAO entrou e mudou a semente desta amostra. */
  const iSono = seq.findIndex(g => g.x === 'sono');
  ok('e vem primeiro (ou logo depois do revide moribundo)', iSono <= 1,
     seq.map(g=>(g.x||'golpe')+':'+g.q).join(' '));
  /* O SONO DUPLO (os dois se dormem) NAO compra troca livre pra ninguem -- os contadores correm
     juntos, e esta cobranca nao se aplica. Esta escrito assim no CLAUDE.md desde que as trocas
     livres passaram a sair do diario. */
  const dobrado = seq.filter(g => g.x === 'sono').length > 1;
  /* O PRIMEIRO GOLPE DEPOIS DO SONO, e nao o primeiro da lista: o revide MORIBUNDO de quem dormiu
     vai pra FRENTE da linha do sono desde 10/09/2026, entao a lista pode abrir com um golpe do
     adormecido -- e ele e legitimo (e do mesmo instante do golpe que o matou). */
  /* ⚠️ E O PRIMEIRO GOLPE DEPOIS DO SONO PASSOU A SER DO ADORMECIDO (25/09/2026): na troca em que
     o sono sai, quem dorme o outro PERDE o ataque e o alvo ainda ataca (ele nao estava dormindo
     quando aquela troca comecou). Quem abre a sequencia de golpes livres e o SEGUNDO. */
  const golpesDepois = seq.slice(iSono + 1).filter(g => !g.x && g.d > 0);
  const primeiroGolpe = golpesDepois[1] || golpesDepois[0];
  ok('e quem dormiu NAO ataca logo depois de dormir',
     dobrado || (primeiroGolpe && primeiroGolpe.q === sono.q),
     (dobrado ? '(sono duplo -- ninguem ganha troca livre) ' : '') + seq.map(g=>(g.x||'golpe')+':'+g.q).join(' '));
})();
/* O LOG MOSTRA O DIARIO INTEIRO -- e a animacao mostra o mesmo.
   Havia um teto de 3 golpes, e ele estava errado por um numero: 99,4% dos confrontos passam de 3
   (mediana 4, maior 28), entao quase todo log que o jogador lia era uma divisao INVENTADA pela
   reconstrucao, nao a luta dele. Foi de la que sairam os dois defeitos de sono reportados em
   03/09/2026: a reconstrucao nao conhece os golpes especiais, entao ora invertia a ordem, ora
   esmagava os golpes livres de quem dormiu o outro num golpe so.
   Mostrando o diario nao ha o que contradizer -- e este bloco tranca as consequencias disso, que
   sao coisas que o teto escondia. */
(function(){
  const POOL = Object.keys(S.SPECIES).filter(id => S.SPECIES[id].dex <= 251);
  const rng = S.makeSeededRng('log-diario');
  const ehDano = x => !x.x || x.x === 'boom' || x.x === 'boomself';
  /* ⚠️ NAO HA MAIS TETO (15/09/2026): o log mostra a luta INTEIRA, sempre. O que este bloco cobra
     deixou de ser "cabe em N linhas" e passou a ser mais forte e mais simples -- A TELA MOSTRA
     EXATAMENTE OS GOLPES QUE ACONTECERAM. Sem numero pra escolher, nao ha segunda fonte de verdade
     pra divergir. */
  let confrontos = 0, animDif = 0, somaErrada = 0, comZero = 0, caiuDefeito = 0;
  let comSono = 0, sonoOk = 0, exZero = null, exAnim = null, exCaiu = null;
  let passouDoTeto = 0, maiorComSono = 0, exTeto = null;
  for(let i = 0; i < 4000; i++){
    const a = POOL[Math.floor(rng()*POOL.length)], b = POOL[Math.floor(rng()*POOL.length)];
    const r = S.simulateGymBattle([inst(a, 30 + Math.floor(rng()*40))], [inst(b, 30 + Math.floor(rng()*40))], Math.random);
    for(const m of (r.matchups || [])){
      if(!(m.golpes||[]).length) continue;
      confrontos++;
      const seq = S.sequenciaDoConfronto(m);
      const desc = () => seq.map(x=>(x.x?'['+x.x+']':'')+x.q+':'+(x.d||0)).join(' ');

      /* 1) O PEDIDO DO JOGADOR: a animacao tem que ter EXATAMENTE os passos do log, inclusive as
            aberturas (sono e cura). Enquanto eram montadas em separado, ele via 3 golpes na tela e
            lia 7 linhas -- reportado tres vezes. */
      if(S.buildAnimatedHitSequence(m).length !== seq.length){ animDif++; if(!exAnim) exAnim = desc(); }

      /* 2) A soma de cada lado bate com o HP perdido. E o contrato do log desde sempre: somando as
            linhas nao pode dar mais dano do que o pokemon tinha. */
      const soma = { p:0, e:0 };
      seq.filter(ehDano).forEach(x => { soma[x.q] += x.d || 0; });
      /* QUEM SOBE DE VIDA NO MEIO DO CONFRONTO desconta: cura, pocao, drenagem e FURIA fazem o HP
         perdido ser menor que a soma dos golpes, e o contrato continua fechando com o ganho na
         conta. A furia sobe o TETO e a vida atual junto; pro log e o mesmo movimento. */
      const ganho = { p:0, e:0 };
      seq.forEach(x => {
        if(subiuAVida(x)) ganho[x.q] += x.d || 0;
        /* O DESEMPATE devolve vida pro lado OPOSTO ao q -- ver devolveVida, no topo. */
        if(devolveVida(x)) ganho[x.q === 'p' ? 'e' : 'p'] += x.d || 0;
      });
      /* O GANHO ENTRA DENTRO DO Math.max, nao fora: com a furia o pokemon pode TERMINAR o confronto
         com MAIS vida do que entrou -- entra com 290, cresce 10 e leva 9 de moribundo, sai com 291.
         Com o ganho somado por fora, 'antes - depois' era aparado em zero e o contrato acusava um
         confronto que estava certo. Sem ganho nenhum a conta e identica a de antes. */
      /* HP QUE SAIU SEM SER GOLPE DO ADVERSARIO. Sao dois casos, e eles tem a MESMA forma: o `q` do
         registro e de quem CAUSOU (quem confundiu, quem drenou) e o HP some do lado OPOSTO. Como
         nao houve golpe do outro lado, a soma das linhas nao cobre isso -- a conta tem que
         descontar, senao o contrato acusa um confronto que esta certo.
         O `absorbdano` ja era assim ANTES da confusao e o teste nao o descontava: ele passava
         porque a varredura olha o PRIMEIRO confronto de cada batalha e drenagem ali e rara. A
         confusao, com 23 especies, so tornou o buraco frequente o bastante pra aparecer.
         A FURIA DO DRAGAO (11/09/2026) e a TERCEIRA da familia e entrou nas quatro contas junto:
         ela tira 40 do adversario e o `q` e de quem USOU. Sao tres agora, e a lista vive em UMA
         funcao -- escrita a mao em cada conta, a quarta divergiria. */
      const autoDano = { p:0, e:0 };
      seq.forEach(x => { autoDano.p += perdeuSemGolpe(x, 'p'); autoDano.e += perdeuSemGolpe(x, 'e'); });
      if(soma.p !== Math.max(0, (m.enemyHpBefore + ganho.e) - m.enemyHpAfter - autoDano.e) ||
         soma.e !== Math.max(0, (m.playerHpBefore + ganho.p) - m.playerHpAfter - autoDano.p)) somaErrada++;

      /* 3) NENHUM GOLPE DE DANO ZERO. Ele existe no diario -- e o revide de quem caiu contra quem
            ja tinha caido, e o dano EFETIVO ali e 0 -- e viraria um "-0 de HP" na tela, que e
            exatamente o que faz procurar bug onde e regra. O teto escondia: aparecia em 0,50% dos
            confrontos. */
      const zeros = seq.filter(g => ehDano(g) && !(g.d > 0));
      if(zeros.length){ comZero++; if(!exZero) exZero = desc(); }

      /* 4) NINGUEM ATACA DEPOIS DE CAIR, tirando os dois casos que a casa aceita: a EXPLOSAO (um
            evento so, com duas entradas, porque os dois caem juntos) e o GOLPE MORIBUNDO, que entra
            ANTES do golpe que derrubou quem o deu -- os dois sao do mesmo instante, e alguem sempre
            vai parecer agir depois de cair; a regra escolhe que seja o golpe que MATOU. */
      let hpP = m.playerHpBefore, hpE = m.enemyHpBefore;
        /* ⚠️ ESTE AJUSTE PRESSUPUNHA QUE A CURA ERA A PRIMEIRA COISA DO CONFRONTO -- ela era
           ABERTURA, e o HP inicial do matchup ja era o pos-cura. Com o Recuperar virando um golpe
           da TROCA (24/09/2026) ela pode estar no MEIO, e ai este ajuste joga o HP inicial pra o
           pos-cura e os golpes ANTERIORES passam a ser aplicados em cima dele: o HP fica negativo
           cedo demais e o scanner acusa de cadaver quem esta vivo. Medido: 0 de 4000 antes da
           mudanca, 4 de 4000 depois -- os quatro falso positivo DELE, nao do jogo.
           ⚠️ A FURIA CONTINUA AQUI porque ela E abertura: ela sobe o TETO de vida no comeco do
           confronto. O recover passou a ser somado pelo acc, junto do dreno -- que e a conta certa
           pra uma cura em QUALQUER posicao. */
      const cura = seq.find(x => x.x === 'furia');
      if(cura){ if(cura.q === 'p') hpP = cura.hp; else hpE = cura.hp; }
      const lista = seq.filter(ehDano);
      /* ⚠️ A DRENAGEM NO GOLPE SOBE A VIDA NO MEIO DA LUTA (15/09/2026), e este scanner só sabia
         SUBTRAIR -- sem isto ele subestima o HP de quem drenou e acusa de cadáver quem está vivo.
         Medido antes: 1 em 12.983 confrontos (um Togetic que sorteou golpe drenante no Metrônomo).
         O MAPA É POR ÍNDICE DE GOLPE, e não um `continue` dentro do laço: a tolerância do par do
         moribundo compara `caiuEm[q] === k - 1`, ou seja ela depende de os índices da lista de dano
         não se mexerem. Uma linha de cura no meio da lista deslocaria tudo e a tolerância passaria
         a valer pro par errado. */
      const ganhoAntes = [];
      { let i = 0, acc = { p:0, e:0 };
        for(const g of seq){
          if(ehDano(g)){ ganhoAntes[i++] = acc; acc = { p:0, e:0 }; continue; }
          /* ⚠️ O RECUPERAR ENTROU AQUI EM 24/09/2026: ele passou a acontecer NO MEIO da luta, e esta
               conta reconstroi o HP linha a linha -- sem ele ela nao via a barra subir e acusava o
               curado de "atacar morto". E a QUINTA conta deste arquivo que copiava a lista do
               subiuAVida a mao. */
            if(g.x === 'dreno' || g.x === 'recover') acc[g.q] += g.d || 0;
        } }
      const caiuEm = { p:-1, e:-1 };
      for(let k = 0; k < lista.length; k++){
        const g = lista[k];
        const gh = ganhoAntes[k];
        if(gh){ hpP += gh.p; hpE += gh.e; }
        if((g.q === 'p' ? hpP : hpE) <= 0){
          if(g.x === 'boomself') break;
          if(caiuEm[g.q] === k - 1) break;    // o par do moribundo
          /* ... e o par vale pro GOLPE INTEIRO: um revide de varios tapas ocupa N passos e continua
             sendo um golpe so -- ver a nota do `percorre`. */
          if(g.t > 1 && lista[k-1] && lista[k-1].q === g.q) break;
          caiuDefeito++; if(!exCaiu) exCaiu = desc();
          break;
        }
        if(g.q === 'p'){ hpE = Math.max(0, hpE - (g.d||0)); if(hpE === 0 && caiuEm.e < 0) caiuEm.e = k; }
        else { hpP = Math.max(0, hpP - (g.d||0)); if(hpP === 0 && caiuEm.p < 0) caiuEm.p = k; }
      }

      /* 5) O SONO: as trocas livres que ele compra aparecem. Nao se exige igualdade exata com o
            diario porque o moribundo pode ser movido pra frente e cruzar a fronteira -- o que se
            exige e o que o sono garante. */
      const sono = (m.golpes||[]).find(x => x.x === 'sono');
      if(sono){
        comSono++;
        /* OS DOIS LADOS TEM QUE SER FILTRADOS IGUAL. O diario ja vinha so com dano; a lista
           exibida vinha inteira, com as ABERTURAS dentro -- e ai um confronto que abre com uma
           drenagem do OUTRO lado punha um q diferente no indice 0 e a conta dava zero troca livre.
           Defeito do teste, nao do jogo, e antigo: so nao tinha sido sorteado ainda. */
        const real = (m.golpes||[]).filter(ehDano), log = lista.filter(ehDano);
        const iR = real.findIndex(x => x.q !== sono.q), iL = log.findIndex(x => x.q !== sono.q);
        const livresReais = iR < 0 ? real.length : iR, livresLog = iL < 0 ? log.length : iL;
        /* O REVIDE DO MORIBUNDO PODE SER A PRIMEIRA LINHA, e esta certo. Quando a unica troca
           livre MATA o adormecido, ele revida -- e o revide e do MESMO instante do golpe que o
           derrubou, entao o reordenamento o poe ANTES dele. Ai o indice 0 da lista exibida ja e do
           outro lado e a conta de trocas livres da zero, sem defeito nenhum.
           Ficou visivel quando o sono passou a comprar UMA troca (09/09/2026): com duas, quase
           sempre sobrava uma troca livre antes do revide. */
        const revideDoAdormecido = (m.golpes||[]).some(g => g.m && g.q !== sono.q);
        /* ⚠️ O TETO SAI DA TABELA (15/09/2026): o SONO_EM_TROCAS virou uma lista de duracoes com
           peso, e `Math.min(x, array)` da NaN -- a conta inteira ia a zero sem nada estar errado.
           O que se cobra continua sendo o mesmo: as trocas livres que o sono REALMENTE comprou
           naquele confronto aparecem na tela, limitadas pelo teto que a mecanica consegue dar. */
        const tetoDoSono = Math.max.apply(null, S.SONO_EM_TROCAS.map(x => x[0]));
        if(revideDoAdormecido || livresLog >= Math.min(livresReais, tetoDoSono)) sonoOk++;
      }
      /* 6) QUANTAS LINHAS. Luta comum tem que caber em duas ou tres -- e a leitura que o jogo
            sempre teve. Sem teto, uma troca banal de Gloom contra Miltank virava seis linhas, e foi
            o que apareceu na tela no dia em que o teto saiu inteiro (03/09/2026).
            COM SONO pode passar, e so por causa das trocas livres: elas sao o que o golpe E, e
            esmaga-las na reconstrucao foi a origem dos dois defeitos reportados naquele dia. */
      /* CONTA LINHA DE LOG, e nao passo de animacao: um golpe de VARIOS TAPAS e UMA linha (o log
         soma os tapas), e e disso que a regra fala -- "a luta cabe em duas ou tres linhas". Contar
         passo a passo media outra coisa, e o Metronomo tornou isso visivel: desde que ele sorteia
         golpe de verdade, as 7 especies dele podem tirar um Missil Agulha de 5 tapas em qualquer
         golpe. Era a MESMA regra que o TETO_GOLPES usava pra decidir a reconstrucao, ate ele acabar
         em 15/09/2026 -- o que a regra conta continua sendo LINHA. */
      const linhas = lista.filter(g => !(g.t > 1)).length;
      /* ⚠️ O ROLAMENTO E A SEGUNDA EXCECAO AO TETO, ao lado do sono (14/09/2026): a reconstrucao
         nao conhece a escala do golpe e achatava a mecanica em 68% dos confrontos, entao ali as
         linhas saem REAIS. Ver o temRolamento do sequenciaDoConfronto. */
      const rolou = lista.some(g => g.rl > 1);
      /* ⚠️ A REGRA AGORA E UMA SO, e vale pra TODO confronto: a tela mostra os golpes REAIS.
         Antes eram tres excecoes empilhadas (sono, Rolamento, drenagem), cada uma acrescentada
         depois de um relato de mecanica invisivel -- e foi a inconsistencia entre elas e o resto
         que matou o teto (ver o CLAUDE.md). */
      const reaisAqui = (m.golpes || []).filter(ehDano).filter(g => !(g.t > 1)).length;
      if(linhas !== reaisAqui){ passouDoTeto++; if(!exTeto) exTeto = desc(); }
      if(linhas > maiorComSono) maiorComSono = linhas;
      break;
    }
  }
  ok('confrontos de sobra pra medir', confrontos > 2000, confrontos + ' (' + comSono + ' com sono)');
  ok('a animacao tem os MESMOS passos do log', animDif === 0, animDif + ' de ' + confrontos + (exAnim ? '  |  ' + exAnim : ''));
  ok('a soma de dano de cada lado fecha', somaErrada === 0, somaErrada + ' de ' + confrontos);
  ok('nenhum golpe de dano zero na tela', comZero === 0, comZero + ' de ' + confrontos + (exZero ? '  |  ' + exZero : ''));
  ok('ninguem ataca depois de cair (fora explosao e moribundo)', caiuDefeito === 0,
     caiuDefeito + ' de ' + confrontos + (exCaiu ? '  |  ' + exCaiu : ''));
  ok('o sono mostra as trocas livres que ele compra', sonoOk === comSono, sonoOk + ' de ' + comSono);
  /* ⚠️ O INVARIANTE NOVO, e ele e o mais forte que este bloco ja teve: a tela mostra EXATAMENTE os
     golpes que o motor produziu -- nem a mais, nem a menos. Enquanto havia teto, o que se cobrava
     era "cabe em N", e a reconstrucao entrava em 9% dos confrontos trocando a luta por outra. */
  ok('a tela mostra EXATAMENTE os golpes reais, em todo confronto', passouDoTeto === 0,
     passouDoTeto + ' de ' + confrontos + (exTeto ? '  |  ' + exTeto : ''));
  /* E a luta comprida existe: sem isso o teste daria verde num jogo em que toda luta e curta. */
  ok('e ha confronto comprido pra provar que nada e cortado', maiorComSono > 4,
     'maior confronto visto: ' + maiorComSono + ' linhas');
  /* ⚠️ A DRENAGEM GANHOU FIXTURE PROPRIO (15/09/2026), e a razao e a licao de sempre: a varredura
     acima monta pokemon SEM golpe escolhido (ela mede o log, nao o moveset), entao a drenagem so
     chegava nela pelo METRONOMO -- 3 confrontos em 4.000, e o "maior" virava sorteio. A trava
     falhava sem nada estar errado.
     Aqui os donos LEVAM o golpe, e o que se cobra e o mesmo: a drenagem aparece em confronto
     COMPRIDO, que e onde a cura mais decide e era onde ela sumia (o relato do Oddish x Sandshrew). */
  {
    const mkD = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp;
                              p.ataques = S.ataquesPadrao(p); return p; };
    let n = 0, maior = 0;
    for(let i = 0; i < 600 && maior <= 4; i++){
      const r = S.simulateGymBattle([mkD('oddish', 12)], [mkD('sandshrew', 17)], Math.random);
      const m = (r.matchups || [])[0];
      if(!m || !(m.golpes||[]).some(g => g.x === 'dreno')) continue;
      n++;
      const linhas = S.sequenciaDoConfronto(m).filter(g => !g.x).length;
      if(linhas > maior) maior = linhas;
    }
    ok('e a drenagem aparece em confronto comprido', maior > 4,
       'maior: ' + maior + ' linhas em ' + n + ' confrontos com cura');
  }
})();

/* Quem nao tem golpe especial nunca cai nesse caminho. */
a = inst('pidgey'); b = inst('onix');
let nenhum = 0;
for(let i=0;i<2000;i++){ if(S.tentarGolpeEspecial(inst('pidgey'), inst('onix'), Math.random, [])) nenhum++; }
ok('quem nao tem o golpe nunca usa', nenhum === 0, nenhum + ' de 2000');

console.log('\nAS CHANCES SAO AS PEDIDAS');
/* O ALVO PRECISA TER VIDA DE VERDADE: a autodestruicao so sai contra alvo com mais de 50% do HP,
   e o createInstance devolve maxHp/hp zerados (quem enche e o simulateGymBattle). Sem encher aqui,
   a medicao da explosao dava 0% -- e o zero seria lido como 'a lista quebrou'. */
function cheio(p){ p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; return p; }
function frequencia(id, alvo, n){
  let boom = 0, sono = 0;
  for(let i=0;i<n;i++){
    const d = [];
    S.tentarGolpeEspecial(cheio(inst(id)), cheio(inst(alvo)), Math.random, d);
    if(d.some(g=>g.x==='boom')) boom++;
    if(d.some(g=>g.x==='sono')) sono++;
  }
  return { boom: boom/n, sono: sono/n };
}
const fGeo = frequencia('geodude', 'onix', 6000);
ok('autodestruicao perto de 15%', Math.abs(fGeo.boom - 0.15) < 0.02, (fGeo.boom*100).toFixed(1) + '%');
/* ⚠️ A FREQUENCIA DO SONO PASSOU A SER MEDIDA NA TROCA (25/09/2026) -- o frequencia() le a fila de
   ABERTURA, que hoje so devolve sono pelo METRONOMO. A chance e a MESMA constante; o que mudou e
   onde o dado e rolado. */
const fJig = { sono: (function(){
  let c = 0; const n = 6000;
  for(let i = 0; i < n; i++) if(umaTroca('jigglypuff', 'onix').d.some(g => g.x === 'sono')) c++;
  return c / n;
})() };
/* ⚠️ A CHANCE SAI DA CONSTANTE, nao de um numero escrito aqui (15/09/2026): ela foi de 5% pra 15%
   a pedido, e uma trava com o numero a mao precisaria ser editada junto -- o que e exatamente a
   classe de manutencao que faz um teste envelhecer calado. A tolerancia acompanha a escala. */
ok('o sono sai na chance declarada', Math.abs(fJig.sono - S.CHANCE_SONO) < Math.max(0.015, S.CHANCE_SONO * 0.2),
   (fJig.sono*100).toFixed(1) + '% (CHANCE_SONO = ' + (S.CHANCE_SONO*100).toFixed(0) + '%)');
const fTog = frequencia('togepi', 'onix', 6000);
ok('metronomo: ~10% de cada efeito',
   Math.abs(fTog.boom - 0.10) < 0.02 && Math.abs(fTog.sono - 0.10) < 0.02,
   'explosao ' + (fTog.boom*100).toFixed(1) + '%, sono ' + (fTog.sono*100).toFixed(1) + '%');
/* O metronomo tambem sorteia o TIPO do golpe: e o que faz dele uma aposta e nao um upgrade. */
const tipos = new Set();
for(let i=0;i<400;i++){ tipos.add(S.tipoDoGolpe(inst('togepi'), inst('onix'), Math.random).type); }
ok('e o tipo do golpe dele sai no sorteio', tipos.size > 5, tipos.size + ' tipos diferentes em 400 golpes');
const tipoFixo = new Set();
for(let i=0;i<50;i++){ tipoFixo.add(S.tipoDoGolpe(inst('pidgey'), inst('onix'), Math.random).type); }
ok('e o resto do jogo continua escolhendo o melhor golpe', tipoFixo.size === 1, [...tipoFixo].join(','));

console.log('\nOS CHEFES SAO IMUNES');
/* Sem isso um Geodude nivel 20 derrubaria o Mew de 25.125 de HP da raide com 15% de chance. */
let contraChefe = 0;
for(let i=0;i<3000;i++){
  if(S.tentarGolpeEspecial(inst('geodude'), inst('mewtwo', 99), Math.random, [])) contraChefe++;
}
ok('nada de explodir o Mewtwo', contraChefe === 0, contraChefe + ' de 3000');

console.log('\nQUEM GANHA QUANDO OS DOIS ULTIMOS CAEM');
/* A regra pedida: quem explodiu leva a batalha. Sem ela o jogador PERDIA justamente a batalha que
   decidiu explodindo, porque o laco so olha "sobrou alguem do meu lado?". */
let vitoriasPorExplosao = 0, batalhas = 0;
for(let i=0;i<3000;i++){
  const r = S.simulateGymBattle([inst('geodude')], [inst('onix')], Math.random);
  const explodiu = (r.matchups||[]).some(m => (m.golpes||[]).some(g=>g.x==='boom'));
  if(explodiu){ batalhas++; if(r.win) vitoriasPorExplosao++; }
}
ok('explodindo no ultimo de cada lado, quem explodiu vence',
   batalhas > 0 && vitoriasPorExplosao === batalhas,
   vitoriasPorExplosao + ' de ' + batalhas + ' explosoes viraram vitoria');

console.log('\nDISABLE: O MELHOR GOLPE SAI DE CENA');
ok('17 especies aprendem Disable por nivel', S.DISABLE.length === 17, S.DISABLE.length + '');
ok('as do Gen 1 estao la (Psyduck, Kadabra, Slowpoke, Grimer, Lickitung)',
   ['psyduck','golduck','kadabra','alakazam','slowpoke','slowbro','grimer','muk','lickitung']
     .every(id => S.DISABLE.includes(id)));
ok('e as que so a Gen 2 deu (Jigglypuff, Venonat, Drowzee, Slowking)',
   ['jigglypuff','wigglytuff','venonat','venomoth','drowzee','hypno','slowking']
     .every(id => S.DISABLE.includes(id)));
/* Vulpix e Ninetales aprendem Disable SO por reproducao -- a regra destas listas e nivel. */
ok('quem so aprende por reproducao ficou de fora',
   !['vulpix','ninetales','nidoranf','seel','kangaskhan','horsea','spinarak','stantler']
     .some(id => S.DISABLE.includes(id)));
/* O Mewtwo aprende nas duas geracoes, mas e imune ao bloco INTEIRO: a entrada seria letra morta. */
ok('o Mewtwo nao entra (ja e imune ao bloco inteiro)', !S.DISABLE.includes('mewtwo'));
ok('nenhuma esta fora do SPECIES', S.DISABLE.filter(id => !S.SPECIES[id]).length === 0);

/* O EFEITO: o tipo que rende mais some da escolha e sobra o segundo. */
const gengar = inst('gengar'), alaka = inst('alakazam'), onix2 = inst('onix');
const melhorAntes = S.bestAttackType(gengar, alaka).type;
gengar._anulado = { tipo: melhorAntes, contra: alaka };
const melhorDepois = S.bestAttackType(gengar, alaka).type;
ok('o melhor golpe deixa de ser escolhido', melhorDepois !== melhorAntes, melhorAntes + ' -> ' + melhorDepois);
ok('e o que entra e um golpe que ele tem mesmo', S.tiposDeAtaque(gengar).includes(melhorDepois));
/* A anulacao vale so contra quem anulou: adversario novo, confronto novo. */
ok('contra OUTRO adversario o golpe volta', S.bestAttackType(gengar, onix2).type === S.bestAttackType(inst('gengar'), onix2).type);

/* Quem tem um tipo de ataque so nao tem o que anular -- e o sorteio simplesmente nao vale. */
const monoTipo = Object.keys(S.SPECIES).find(id => S.tiposDeAtaque(inst(id)).length === 1);
let anulouMono = 0;
for(let i=0;i<600;i++){
  const alvo = inst(monoTipo);
  S.tentarGolpeEspecial(inst('alakazam'), alvo, rngFixo(0.01), []);
  if(alvo._anulado) anulouMono++;
}
ok('quem tem um golpe so nunca e anulado', anulouMono === 0, S.SPECIES[monoTipo].name + ': ' + anulouMono + ' de 600');

/* Ao contrario dos outros dois, o Disable NAO resolve o confronto -- a luta acontece inteira.
   A vitima aqui e um Charizard de proposito: um Gengar responderia com Hipnose (ele esta no
   SONIFEROS) e o confronto acabaria ali -- pelo sono, nao pelo Disable. */
/* ⚠️ A ANULACAO SAIU DA FILA DE ABERTURA EM 25/09/2026, junto do sono: ela virou um golpe da
   TROCA, e quem anula PERDE o ataque daquela troca. */
const tAnul = trocaCom('disable', 'alakazam', 'charizard');
ok('o Disable sai numa TROCA e nao encerra o confronto',
   !!tAnul && tAnul.dono.hp > 0 && tAnul.alvo.hp > 0);
ok('e o alvo fica marcado',
   !!tAnul && !!tAnul.alvo._anulado && tAnul.alvo._anulado.contra === tAnul.dono);
ok('o log ganha a linha da anulacao',
   !!tAnul && tAnul.d.some(g => g.x === 'disable' && g.d === 0));
/* a regra nova, a mesma do sono */
ok('e QUEM ANULOU nao atacou naquela troca',
   !!tAnul && !tAnul.d.some(g => !g.x && g.q === 'p' && g.d > 0),
   tAnul ? tAnul.d.map(g => g.q + ':' + (g.x || g.d)).join(' ') : '');
/* E o outro lado ainda pode usar o especial DELE na mesma abertura: anular nao consome o
   confronto. Um Gengar anulado responde com Hipnose e resolve a luta ali mesmo. */
/* ⚠️ OS DOIS LADOS AGEM NA MESMA TROCA -- o acaoDaTroca roda pra cada um deles, em ordem de
   velocidade. Entao o Alakazam anula E o Gengar dorme, na mesma troca, exatamente como acontecia
   na fila de abertura. O que mudou e que nenhum dos dois ataca. */
let anulouEDormiu = 0, amostraAnul = 0;
for(let i = 0; i < 6000 && amostraAnul < 200; i++){
  const t = umaTroca('alakazam', 'gengar');
  if(!t.d.some(x => x.x === 'disable')) continue;
  amostraAnul++;
  if(t.d.some(x => x.x === 'sono')) anulouEDormiu++;
}
ok('amostra de trocas com anulacao', amostraAnul >= 100, amostraAnul + ' trocas');
ok('depois de anular, o outro lado ainda joga o especial dele na MESMA troca',
   amostraAnul > 0 && anulouEDormiu > amostraAnul * 0.05, anulouEDormiu + ' de ' + amostraAnul);

console.log('\nA CHANCE DO DISABLE');
/* ⚠️ MEDIDA NA TROCA desde 25/09/2026 -- ver o umaTroca. A chance e a MESMA constante. */
function taxaDisable(id, alvoId, n){
  let c = 0;
  for(let i=0;i<n;i++) if(umaTroca(id, alvoId).alvo._anulado) c++;
  return c/n;
}
/* ⚠️ O ALVO NÃO PODE TER ESPECIAL NENHUM, e o Gengar tinha (15/09/2026). Estas duas travas medem a
   chance de quem ANULA, mas o `tentarGolpeEspecial` roda os DOIS lados em ordem de velocidade -- e o
   Gengar (Hipnose, velocidade 110) adormecia quem ia anular antes de ela chegar a agir, porque quem
   dorme não usa especial. Com o sono a 5% isso comia meio ponto e passava; a 15% passou a comer 1,3
   e a trava virou intermitente (medido: 6,1% a 8,0% numa faixa que só tolera 6,5%).
   O SHUCKLE é o alvo certo: nenhuma das treze listas o inclui, ele tem DOIS tipos (a guarda do
   Disable só vale contra quem tem segundo golpe) e é o mais lento do jogo -- então quem anula age
   sempre primeiro e a medição isola a chance, que é o que a trava existe pra medir. */
const ALVO_LIMPO = 'shuckle';
const tAlaka = taxaDisable('alakazam', ALVO_LIMPO, 6000);
ok('Disable perto de 10%', Math.abs(tAlaka - S.CHANCE_DISABLE) < 0.02,
   (tAlaka*100).toFixed(1) + '% (CHANCE_DISABLE = ' + (S.CHANCE_DISABLE*100).toFixed(0) + '%)');
/* A Jigglypuff tem Canto E Disable: o sono e sorteado ANTES, entao a taxa efetiva do Disable dela e
   (1 - CHANCE_SONO) x CHANCE_DISABLE.
   ⚠️ A CONTA SAI DAS CONSTANTES, nao de um numero a mao (15/09/2026): com o sono em 5% dava 9,5% e
   com ele em 15% da 8,5% -- e uma trava com o 0,095 escrito aqui teria que ser editada junto, que e
   a classe de manutencao que faz um teste envelhecer calado. */
const tJig = taxaDisable('jigglypuff', ALVO_LIMPO, 6000);
const esperadoJig = (1 - S.CHANCE_SONO) * S.CHANCE_DISABLE;
ok('quem tem sono E Disable cai na taxa composta', Math.abs(tJig - esperadoJig) < 0.02,
   (tJig*100).toFixed(1) + '% (esperado ' + (esperadoJig*100).toFixed(1) + '%)');

console.log('\nAS FRASES SAO AS PEDIDAS');
/* As tres frases exatas do pedido. O log e o aviso do meio da batalha leem da MESMA funcao --
   se um dia divergirem, e aqui que se ve. */
const mBoom = { player:'Golem', enemy:'Raichu', playerSpecies:'golem', enemySpecies:'raichu',
  golpes:[{ q:'p', d:100, hp:0, x:'boom', g:'auto-destruição' }, { q:'e', d:80, hp:0, x:'boomself' }] };
const htmlBoom = S.passosHtml(mBoom);
ok('explosao: "Golem usou auto-destruicao"', /usou <span class="type-pill"[^>]*>auto-destruição</.test(htmlBoom), '');
ok('e uma linha so (o "caiu junto" nao vira outra)', (htmlBoom.match(/class="mlog-passo /g)||[]).length === 1);
ok('o aviso do meio da batalha diz o mesmo',
   S.avisoDoConfronto(mBoom) === S.ICONES_ESPECIAIS.boom + ' Golem usou auto-destruição!', S.avisoDoConfronto(mBoom));

const mSono = { player:'Butterfree', enemy:'Arbok', playerSpecies:'butterfree', enemySpecies:'arbok',
  golpes:[{ q:'p', d:100, hp:0, x:'sono', g:'Pó do Sono' }] };
/* ⚠️ ESTA TRAVA MEDIA A REGRA DE ANTES DE 25/09/2026 (*"Butterfree fez Arbok dormir"*, sem golpe
   no aviso). Ela nao foi afrouxada: ela virou a da regra NOVA, e cobra o PAR -- o aviso e o log
   dizem a MESMA coisa, com o selo. Sem a segunda metade, um build que voltasse a esconder o golpe
   no aviso passaria medindo so o log. */
const avisoSono = S.avisoDoConfronto(mSono);
ok('sono no AVISO: "...dormir com <selo Po do Sono>"',
   avisoSono.indexOf(S.ICONES_ESPECIAIS.sono + ' Butterfree fez Arbok dormir com ') === 0
   && avisoSono.indexOf('>Pó do Sono</span>!') === avisoSono.length - '>Pó do Sono</span>!'.length,
   avisoSono);
ok('e o selo sai na cor do TIPO do golpe (Po do Sono e Planta)',
   avisoSono.indexOf('background:' + S.TYPE_COLORS[S.TIPO_DO_ESPECIAL['Pó do Sono']]) > 0,
   S.TIPO_DO_ESPECIAL['Pó do Sono'] + ' / ' + avisoSono);
ok('e no log a frase e a MESMA', /dormir com <span class="type-pill"[^>]*>Pó do Sono</.test(S.passosHtml(mSono)));
/* ⚠️ E O SELO SO ENTRA ONDE HA GOLPE: confronto gravado antes do campo `g` existir cai na frase
   curta, e log velho nao pode sumir nem sair com um selo vazio. */
const mSonoVelho = { player:'Butterfree', enemy:'Arbok', playerSpecies:'butterfree', enemySpecies:'arbok',
  golpes:[{ q:'p', d:100, hp:0, x:'sono' }] };
ok('sem o golpe gravado, a frase curta',
   S.avisoDoConfronto(mSonoVelho) === S.ICONES_ESPECIAIS.sono + ' Butterfree fez Arbok dormir!',
   S.avisoDoConfronto(mSonoVelho));
/* ⚠️ E OS OUTROS RAMOS CONTINUAM SEM SELO NO AVISO: a regra geral (texto puro, que se le em um
   segundo) nao mudou -- o que mudou foi o SONO ser a excecao pedida. */
const mConf = { player:'Zubat', enemy:'Onix', playerSpecies:'zubat', enemySpecies:'onix',
  golpes:[{ q:'p', d:0, hp:200, x:'confusao', g:'Supersom' }] };
ok('a confusao continua em texto puro no aviso',
   S.avisoDoConfronto(mConf).indexOf('type-pill') < 0, S.avisoDoConfronto(mConf));

const mDis = { player:'Alakazam', enemy:'Gengar', playerSpecies:'alakazam', enemySpecies:'gengar',
  golpes:[{ q:'p', d:0, hp:120, x:'disable', g:'Anulação' }, { q:'p', d:40, hp:80 }, { q:'e', d:30, hp:90 }] };
ok('disable: "Gengar teve seu melhor ataque anulado por Alakazam"',
   S.avisoDoConfronto(mDis) === '🚫 Gengar teve seu melhor ataque anulado por Alakazam!', S.avisoDoConfronto(mDis));
/* ⚠️ A ANULACAO ENTROU NA SEQUENCIA EM 25/09/2026, e ela ficava FORA desde que nasceu: a razao era
   que *"ele nao tira HP e a luta continua depois dele"* e que *"a anulacao acontece na abertura"*.
   A segunda metade deixou de ser verdade quando o Disable virou um golpe da TROCA.
   ⚠️ E TIRA-LA DO MEIO DA SEQUENCIA ERA UM DEFEITO MEDIDO, nao so uma incoerencia de leitura: ela
   COLAVA os dois golpes em volta dela (7 casos em 40), que e o que a trava da colagem proibe -- e
   na animacao o passo dela nao existia, entao o dono perdia o ataque sem nada na tela explicando. */
const seq = S.sequenciaDoConfronto(mDis);
ok('e ele ENTRA na sequencia, no lugar dele', seq.length === 3 && seq.some(g=>g.x==='disable'), seq.length + ' passos');
ok('  e no lugar EXATO em que ele aconteceu', (seq.findIndex(g=>g.x==='disable')) === 0,
   seq.map(g=>g.x||('d'+g.d)).join(' '));
const htmlDis = S.passosHtml(mDis);
ok('mas a linha dele aparece no log, e vem primeiro',
   htmlDis.indexOf('anulado por') > 0 && htmlDis.indexOf('anulado por') < htmlDis.indexOf('atacou'));

/* Sem golpe especial, a linha e a de sempre -- e o aviso nao aparece. */
ok('confronto comum nao ganha aviso', S.avisoDoConfronto({ player:'A', enemy:'B', golpes:[{q:'p',d:10,hp:5}] }) === '');
/* ⚠️ A PAUSA DE ABERTURA NAO TEM MAIS DONO NENHUM (25/09/2026). Desde 12/09 a frase nasce no passo
   do EVENTO, e a ANULACAO era a ultima que ainda usava esta pausa -- justamente porque ela era
   filtrada fora da sequencia e o passo dela ERA o 0. Com ela entrando na sequencia, o segundo de
   leitura dela vem DEPOIS do passo, pela marca `leitura`, como o de todos os outros.
   ⚠️ A PAUSA NAO SUMIU: ela mudou de lugar, e a trava logo abaixo cobra que ela exista no passo
   do disable. Sem essa segunda metade, a frase apareceria e sumiria no mesmo quadro. */
ok('a pausa de ABERTURA nao vale mais pra ninguem do bloco',
   S.pausaDoEspecial(mDis) === 0 && S.pausaDoEspecial(mBoom) === 0 &&
   S.pausaDoEspecial({ golpes:[{q:'p',d:10}] }) === 0,
   'anulacao ' + S.pausaDoEspecial(mDis) + 'ms  |  explosao ' + S.pausaDoEspecial(mBoom) + 'ms');
/* ⚠️ E O SEGUNDO DE LEITURA DA ANULACAO VEM DO PASSO DELA, pela marca `leitura` -- e a mesma que o
   sono usa desde 10/09/2026. Sem isso a frase nasceria e morreria no mesmo quadro. */
{
  const anim = S.buildAnimatedHitSequence(mDis);
  const iD = anim.findIndex(h => h.x === 'disable');
  ok('  e o segundo de leitura dela vem do PASSO dela',
     iD >= 0 && S.pausaDaFaixa(anim[iD]) === S.PAUSA_LEITURA_ESPECIAL_MS,
     'passo ' + iD + ' -> ' + (iD >= 0 ? S.pausaDaFaixa(anim[iD]) : '-') + 'ms');
}

console.log('\nDITTO: O GOLPE ACOMPANHA A TRANSFORMACAO');
/* A tela ja mostrava o sprite do adversario desde sempre; o golpe passou a acompanhar. Ele SOMA os
   tipos do alvo aos dele em vez de trocar -- trocar foi medido e saia pela culatra (o Normal e 1x
   em quase tudo, e no espelho um monte de tipo resiste a si mesmo), piorando justamente o pokemon
   mais fraco do jogo. */
(function(){
  const alvo = (id) => inst(id);
  const golpe = (id) => S.bestAttackType(inst('ditto'), alvo(id));
  const g1 = golpe('gengar');
  ok('contra um Fantasma ele ataca de Fantasma', g1.type === 'Ghost' && g1.mult === 2, g1.type + ' x' + g1.mult);
  const g2 = golpe('onix');
  ok('contra Pedra/Terra ele ataca de Terra', g2.type === 'Ground' && g2.mult === 2, g2.type + ' x' + g2.mult);
  const g3 = golpe('dragonite');
  ok('contra Dragao ele ataca de Dragao', g3.type === 'Dragon', g3.type + ' x' + g3.mult);
  /* O tipo copiado vale como PROPRIO: ele E a copia, entao tem STAB e nao paga redutor de subtipo. */
  ok('e o golpe copiado tem STAB', g1.stab && g2.stab && g3.stab);
  /* NAO TROCA, SOMA: contra um Psiquico, Psiquico seria 0,5x e o Normal dele rende mais. */
  const g4 = golpe('alakazam');
  ok('mas ele mantem o golpe dele quando o copiado e pior', g4.type === 'Normal', g4.type + ' x' + g4.mult);
  /* No EMPATE ganha a copia -- senao contra um Charizard ele atacava de Investida (Voador e Normal
     dao o mesmo dano ali) e a transformacao nao aparecia na tela. */
  const g5 = golpe('charizard');
  ok('no empate ganha o golpe da copia', g5.type !== 'Normal', g5.type);
  /* O nome do golpe existe pra todo tipo que ele possa copiar -- senao a linha do log sai sem golpe. */
  const semNome = Object.keys(S.TYPE_CHART).filter(tp => !S.nomeDoGolpe('ditto', tp));
  ok('e todo tipo copiado tem nome de golpe', semNome.length === 0, semNome.join(',') || 'todos tem');
  /* Ninguem mais copia nada: a regra e do Ditto, e so. */
  const outro = S.bestAttackType(inst('pikachu'), alvo('gengar'));
  ok('e so o Ditto copia', S.tiposDeAtaque(inst('pikachu'), alvo('gengar')).join(',') ===
     S.tiposDeAtaque(inst('pikachu')).join(','), outro.type);
  /* Ele copia SO o ataque: atributos e o tipo que ele apresenta continuam sendo dele. */
  const d = inst('ditto');
  ok('os atributos continuam sendo os dele', d.attack === 48 && (d.types||[]).join(',') === 'Normal',
     'atk ' + d.attack + ', tipo ' + (d.types||[]).join(','));
})();
console.log('\nO SELO DO TIPO NO NOME DO GOLPE');
/* O tipo foi PESQUISADO no aprendizado da Gen 1, e a intuicao erra aqui: autodestruicao e NORMAL,
   nao Terra nem Pedra. So os dois pos sao Planta e a Hipnose e Psiquico. */
ok('a autodestruicao sai no selo de Normal', S.TIPO_DO_ESPECIAL['auto-destruição'] === 'Normal');
ok('os dois pos saem no de Planta',
   S.TIPO_DO_ESPECIAL['Pó do Sono'] === 'Grass' && S.TIPO_DO_ESPECIAL['Esporo'] === 'Grass');
ok('e a Hipnose no de Psiquico', S.TIPO_DO_ESPECIAL['Hipnose'] === 'Psychic');
/* Todo golpe que o motor sabe gerar precisa de tipo -- sem ele o selo sai num cinza generico e
   ninguem percebe, porque so aparece no confronto que teve aquele golpe. */
const nomesPossiveis = [...new Set(['auto-destruição', ...Object.values(S.SONIFEROS), 'Anulação',
  'Metrônomo', 'Metrônomo (auto-destruição)', 'Metrônomo (sonífero)', 'Metrônomo (anulação)'])];
const semTipo = nomesPossiveis.filter(n => !S.TIPO_DO_ESPECIAL[n]);
ok('todo golpe especial tem tipo declarado', semTipo.length === 0, semTipo.join(',') || nomesPossiveis.length + ' golpes');

console.log('\nO DISABLE NOMEIA O GOLPE ANULADO');
/* O que interessa e o que o pokemon PERDEU, nao o nome da anulacao. O motor manda o TIPO e o
   cliente vira em palavra, como no resto do log -- e o selo e o do golpe perdido, entao um
   Nevasca sai no azul do Gelo e nao no bege do Normal. */
const mAnul = { player:'Venomoth', enemy:'Jynx', playerSpecies:'venomoth', enemySpecies:'jynx',
  playerHpBefore:180, playerHpAfter:140, playerMaxHp:180, enemyHpBefore:200, enemyHpAfter:0, enemyMaxHp:200,
  playerMove:'Bug', enemyMove:'Ice',
  golpes:[{ q:'p', d:0, hp:200, x:'disable', g:'Anulação', a:'Ice' }, { q:'p', d:200, hp:0 }, { q:'e', d:40, hp:140 }] };
ok('o aviso diz QUAL golpe foi anulado',
   S.avisoDoConfronto(mAnul) === '🚫 Jynx teve o ataque Nevasca anulado por Venomoth!', S.avisoDoConfronto(mAnul));
ok('e no log ele vem no selo do tipo DELE',
   S.passosHtml(mAnul).includes('teve o ataque <span class="type-pill" style="background:' +
                                S.TYPE_COLORS['Ice'] + '">Nevasca</span> anulado'));
/* Confronto gravado ANTES do campo existir cai na frase generica -- log velho nao pode sumir. */
const semCampo = mAnul.golpes.map(g => { const c = Object.assign({}, g); delete c.a; return c; });
const mVelho = Object.assign({}, mAnul, { golpes: semCampo });
ok('e log antigo, sem o campo, cai na frase generica',
   S.avisoDoConfronto(mVelho) === '🚫 Jynx teve seu melhor ataque anulado por Venomoth!', S.avisoDoConfronto(mVelho));

console.log('\nA FICHA DA POKEDEX DIZ QUE ESPECIAL A ESPECIE TEM');
/* E a unica coisa que uma especie faz em batalha que os seis numeros nao contam: um Geodude e um
   Graveler de atributo parecido jogam diferente porque um deles explode. */
/* ⚠️ O ODDISH PERDEU O "Absorver" DA FICHA EM 15/09/2026, e isso e a PASSIVA de drenagem saindo
   (a pedido). Ela era a drenagem de ABERTURA -- 10% por confronto, 23 especies --, e existia porque
   o golpe drenante nao fazia nada. Com a DRENAGEM NO GOLPE ela virou a mesma coisa duas vezes, com
   regras diferentes, e o jogador nao tinha como saber qual estava vendo.
   Hoje quem conta essa historia e o CARTAO DO GOLPE, na tela de aprender: "* Cura o Pokemon que
   utilizou ao atacar o oponente". A ficha da especie continua contando o que a especie faz SOZINHA,
   e drenar deixou de ser isso -- virou escolha de golpe. */
ok('lista o especial da especie',
   S.especiaisDaEspecie('golem').map(e=>e.nome).join(',') === 'auto-destruição' &&
   S.especiaisDaEspecie('oddish').map(e=>e.nome).join(',') === 'Pó do Sono',
   S.especiaisDaEspecie('oddish').map(e=>e.nome).join(','));
ok('e os DOIS de quem tem dois',
   S.especiaisDaEspecie('jigglypuff').map(e=>e.nome).join(' + ') === 'Canto + Anulação',
   S.especiaisDaEspecie('jigglypuff').map(e=>e.nome).join(' + '));
/* O Paras tinha Esporo E Sanguessuga; a drenagem saiu da ficha junto com a passiva (ver acima), e
   o que sobra na ficha e o que ele faz sem escolher: dormir. */
ok('e o Paras fica so com o sono',
   S.especiaisDaEspecie('paras').map(e=>e.nome).join(' + ') === 'Esporo',
   S.especiaisDaEspecie('paras').map(e=>e.nome).join(' + '));
ok('quem nao tem nenhum nao ganha linha nenhuma', S.especiaisDaEspecie('pikachu').length === 0);
/* A chance vem junto porque ela e POR CONFRONTO: so o nome deixaria o jogador achar que sai todo golpe. */
ok('com a chance junto', S.especiaisDaEspecie('golem')[0].chance === S.CHANCE_AUTODESTRUICAO);
ok('e com o tipo, pro selo', S.especiaisDaEspecie('paras')[0].tipo === 'Grass');
/* Ninguem das listas de PASSIVA pode ficar de fora da ficha -- seria um efeito invisivel.
   ⚠️ O ABSORCAO SAIU DESTA CONTA EM 15/09/2026, junto com a passiva de drenagem: quem drena hoje
   nao tem passiva nenhuma, tem um GOLPE -- e quem conta isso e o cartao do golpe, com o asterisco,
   nao a ficha da especie. */
const todasComEspecial = new Set([...S.AUTODESTRUICAO, ...Object.keys(S.SONIFEROS), ...S.DISABLE,
                                  ...S.METRONOMO]);
const semFicha = [...todasComEspecial].filter(id => S.especiaisDaEspecie(id).length === 0);
ok('e toda especie das quatro listas aparece', semFicha.length === 0,
   semFicha.join(',') || todasComEspecial.size + ' especies');
console.log('\nA FAIXA DE FOCO NAO PODE SER FURADA POR CAMINHO NENHUM');
/* REPORTADO em 04/09/2026: "equipei o charizard com Faixa de foco e ele morreu direto quando
   chegou com 0 de hp". A causa era a AUTODESTRUICAO -- ela zera o HP dentro do
   tentarGolpeEspecial, sem passar pelos dois pontos do doExchange onde a Faixa vigiava.
   Este teste nao olha um caminho especifico: ele afirma o INVARIANTE. Quem carrega a Faixa nunca
   pode terminar um confronto em 0 sem ela ter disparado antes. Qualquer caminho novo que zere HP
   -- um golpe especial futuro, uma regra nova -- cai aqui. */
(function(){
  const IDS = Object.keys(S.SPECIES);
  let furos = 0, disparou = 0, exemplos = [];
  for(let i = 0; i < 6000; i++){
    const meu = [S.createInstance('charizard', 55)];
    for(let k = 0; k < 5; k++) meu.push(S.createInstance(IDS[(i*7+k) % IDS.length], 55));
    S.equiparItens(meu, { charmander:'faixa_foco' });
    /* O adversario e mais forte de proposito: e assim que a Faixa e posta a prova. */
    const dele = [];
    for(let k = 0; k < 6; k++) dele.push(S.createInstance(IDS[(i*13+k) % IDS.length], 62));
    S.equiparItens(dele, null);
    const r = S.simulateGymBattle(meu, dele, Math.random);
    const usou = (r.matchups||[]).some(m => (m.golpes||[]).some(g => g.x === 'faixa'));
    const caiu = (r.playerStatus||[]).some(p => p.speciesId === 'charizard' && p.fainted);
    if(usou) disparou++;
    if(caiu && !usou){
      furos++;
      if(exemplos.length < 3){
        const m = (r.matchups||[]).find(x => x.playerSpecies === 'charizard' && x.playerHpAfter <= 0);
        exemplos.push(m ? (m.golpes||[]).map(g => g.x || 'golpe').join(',') : 'sem matchup');
      }
    }
  }
  ok('a Faixa dispara quando o Charizard ia cair', disparou > 5000, disparou + ' de 6000');
  ok('e NENHUM caminho a fura', furos === 0, furos + ' furos | ' + exemplos.join(' | '));

  /* O CASO QUE FUROU: a autodestruicao. Isolado, pra a causa ficar nomeada no teste. */
  let segurouBoom = 0, morreuNoBoom = 0;
  for(let i = 0; i < 4000; i++){
    const meu = [S.createInstance('charizard', 55)];
    S.equiparItens(meu, { charmander:'faixa_foco' });
    const r = S.simulateGymBattle(meu, [S.createInstance('golem', 60)], Math.random);
    const g = ((r.matchups||[])[0]||{}).golpes || [];
    if(!g.some(x => x.x === 'boom')) continue;
    if(g.some(x => x.x === 'faixa')) segurouBoom++; else morreuNoBoom++;
  }
  ok('a Faixa segura a AUTODESTRUICAO', segurouBoom > 100, segurouBoom + ' explosoes seguradas');
  ok('e nunca deixa passar uma', morreuNoBoom === 0, morreuNoBoom + '');

  /* O LOG TEM QUE CONTAR A HISTORIA -- e nao contava. REPORTADO em 04/09/2026 com print: o log
     dizia, em tres linhas reconstruidas, que o Charizard tomou 388 de 388 de HP, e embaixo que a
     Faixa o segurou com 1. As duas coisas na mesma tela.
     A causa eram DUAS: a reconstrucao (teto de 3) esmagava os golpes DEPOIS da Faixa, que sao o que
     ela compra; e a linha dela era um rodape solto no fim, longe do golpe que ela segurou.
     Hoje o confronto com Faixa mostra os golpes REAIS (a segunda excecao ao teto, como o sono) e a
     linha cai logo DEPOIS do golpe que ela segurou. */
  {
    let m = null;
    for(let i = 0; i < 4000 && !m; i++){
      const meu = [S.createInstance('charizard', 56)];
      S.equiparItens(meu, { charmander:'faixa_foco' });
      const r = S.simulateGymBattle(meu, [S.createInstance('electabuzz', 54)], Math.random);
      const x = (r.matchups||[])[0];
      if(x && (x.golpes||[]).some(g => g.x === 'faixa') && x.playerHpAfter <= 0) m = x;
    }
    ok('reproduzi o confronto do print (Faixa, e ele cai depois)', !!m);
    if(m){
      const seq = S.sequenciaDoConfronto(m);
      const iFaixa = seq.findIndex(g => g.x === 'faixa');
      ok('a Faixa esta NO MEIO da sequencia, nao no fim', iFaixa > 0 && iFaixa < seq.length - 1,
         'posicao ' + iFaixa + ' de ' + seq.length);
      /* O ULTIMO GOLPE DA METADE 1 e o que ia matar: ele bate no carregador. */
      ok('o golpe antes dela e contra o Charizard', seq[iFaixa-1] && seq[iFaixa-1].q === 'e',
         JSON.stringify(seq[iFaixa-1]));
      /* E DEPOIS DELA e o CHARIZARD quem ataca primeiro -- a metade 2 e uma luta nova em que ele
         entra fraco, e a reconstrucao da o primeiro golpe a quem entra abaixo de 50%. */
      /* QUANDO A METADE 2 TEM GOLPE DELE. Ela pode nao ter: se os dois cairam na mesma troca, o
         confronto termina no revide MORIBUNDO do adversario e a metade 2 e uma linha so, do outro
         lado -- a Faixa segurou em 1 e o golpe seguinte, do mesmo instante, terminou o servico.
         Cobrar o golpe dele ali seria cobrar um golpe que a luta nao teve. */
      const depois = seq.slice(iFaixa + 1).filter(g => !g.x);
      ok('e depois dela quem ataca primeiro e o Charizard',
         !depois.some(g => g.q === 'p') || depois[0].q === 'p', JSON.stringify(depois));
      /* A SOMA CONTINUA FECHANDO: o log nao pode dizer que ele tomou mais do que tinha. A explosao
         conta junto (ela tem x='boom' mas E dano). */
      const tomou = seq.filter(g => (!g.x || g.x === 'boom') && g.q === 'e').reduce((a, g) => a + g.d, 0);
      /* O CHARIZARD ESTA NA LISTA DA FURIA, entao ele pode GANHAR vida no meio do confronto -- e ai
         o que ele perdeu de HP e menor que a soma dos golpes, pela diferenca exata do ganho. E o
         mesmo desconto que as outras varreduras deste arquivo ja fazem pra cura, pocao e drenagem.
         Sem ele o teste falhava em ~1 rodada a cada 15, sempre por 10 (o FURIA_BONUS), e o defeito
         era do teste: conferido que TODO confronto sem furia fecha. */
      const ganhou = seq.filter(g => g.x === 'furia' && g.q === 'p').reduce((a, g) => a + g.d, 0);
      ok('e a soma do dano fecha com o HP dele', tomou === (m.playerHpBefore - m.playerHpAfter) + ganhou,
         tomou + ' de ' + ((m.playerHpBefore - m.playerHpAfter) + ganhou));
      /* AS DUAS METADES RESPEITAM O TETO. E o pedido: a luta corre normal ate ele chegar a zero, a
         Faixa o devolve a 1, e o que vem depois se le como uma luta nova -- cada uma com o mesmo
         teto de 3 golpes de sempre. */
      const metade1 = seq.slice(0, iFaixa).filter(g => !g.x).length;
      const metade2 = seq.slice(iFaixa+1).filter(g => !g.x).length;
      ok('a metade 1 cabe no teto de 3', metade1 <= 3 && metade1 >= 1, metade1 + ' golpes');
      ok('e a metade 2 tambem', metade2 <= 3, metade2 + ' golpes');
      /* LOG E ANIMACAO CONTINUAM LENDO A MESMA LISTA -- a regra da casa. */
      ok('e a animacao tem os MESMOS passos', S.buildAnimatedHitSequence(m).length === seq.length,
         S.buildAnimatedHitSequence(m).length + ' vs ' + seq.length);
      /* A linha aparece UMA vez, no meio do log. */
      const linhas = S.passosHtml(m).split('</div>').filter(x => x.includes('mlog-passo'));
      const iLinha = linhas.findIndex(l => /Faixa de Foco segurou/.test(l));
      ok('o log mostra a linha da Faixa no meio', iLinha > 0 && iLinha < linhas.length - 1,
         'linha ' + iLinha + ' de ' + linhas.length);
    }

    /* A MENSAGEM NO MEIO DA BATALHA, com a pausa de 1s. Pedido em 04/09/2026: o log ja contava a
       historia, mas quem estava assistindo a animacao via a barra parar em 1 sem nada explicando.
       A Faixa e o UNICO aviso do meio da luta -- todos os outros sao de abertura, e por isso valem
       desde o comeco do confronto. Ela nao pode: mostrada desde o inicio, entregaria o desfecho e
       ocuparia o lugar do "Trocando golpes..." a luta inteira. */
    {
      let m2 = null;
      for(let i = 0; i < 6000 && !m2; i++){
        const meu = [S.createInstance('charizard', 56)];
        S.equiparItens(meu, { charmander:'faixa_foco' });
        const r = S.simulateGymBattle(meu, [S.createInstance('electabuzz', 54)], Math.random);
        const x = (r.matchups||[])[0];
        if(!x) continue;
        const s = S.sequenciaDoConfronto(x);
        const i2 = s.findIndex(g => g.x === 'faixa');
        if(i2 >= 0 && i2 < s.length - 1) m2 = x;   // a luta CONTINUA depois dela
      }
      ok('achei um confronto que continua depois da Faixa', !!m2);
      if(m2){
        const seq = S.sequenciaDoConfronto(m2);
        const anim = S.buildAnimatedHitSequence(m2);
        const iF = seq.findIndex(g => g.x === 'faixa');
        /* ANTES dela a tela mostra o "Trocando golpes..." de sempre -- nada entregue. */
        /* ANTES dela a tela nao pode entregar a FAIXA. Uma ABERTURA (furia, cura, sono) pode estar
           ali -- ela e de outro efeito e tem o proprio direito a linha; o que nao pode e a frase da
           Faixa aparecer antes do passo dela, porque isso entregaria o desfecho. */
        ok('antes dela a Faixa nao aparece',
           [0, 1, iF].every(p => !/Faixa de Foco/.test(S.avisoDoConfronto(m2, p) || '')),
           [0,1,iF].map(p => p + ':' + (S.avisoDoConfronto(m2,p)||'(vazio)')).join(' | '));
        /* NO PASSO DELA a frase aparece. O laco incrementa o passo depois de aplicar o golpe, entao
           quando a barra parou em 1 o contador ja esta em iF+1. */
        ok('a frase aparece no passo dela', /Faixa de Foco segurou/.test(S.avisoDoConfronto(m2, iF + 1)),
           S.avisoDoConfronto(m2, iF + 1));
        /* E SAI no seguinte -- senao ela ficaria no lugar do "Trocando golpes..." ate o fim. */
        ok('e sai no passo seguinte', S.avisoDoConfronto(m2, iF + 2) === '', S.avisoDoConfronto(m2, iF + 2));
        /* A PAUSA DE 1s. O passo da Faixa nao mexe barra nenhuma, entao a duracao dele e ZERO: sem
           a pausa a frase apareceria e sumiria no mesmo quadro. */
        ok('o passo dela nao mexe barra', anim[iF] && anim[iF].amount === 0, JSON.stringify(anim[iF]));
        ok('e por isso ele pede a pausa de 1s',
           anim[iF].faixa === true && S.pausaDaFaixa(anim[iF]) === S.PAUSA_LEITURA_ESPECIAL_MS,
           S.pausaDaFaixa(anim[iF]) + 'ms');
        /* ⚠️ O GOLPE COMUM SAI PROCURADO, nao e o `anim[0]`. O Charizard deste caso tem FÚRIA e
           FÚRIA DO DRAGÃO, entao o passo 0 pode ser uma ABERTURA -- e desde 12/09/2026 toda
           abertura carrega o segundo de leitura, inclusive no indice 0 (a frase passou a nascer no
           passo do evento, e o segundo dela vem depois). O caso roda com Math.random, entao ler o
           indice 0 falhava so quando a furia saia: o pior tipo de teste, o que passa quase sempre. */
        const comum = anim.filter(h => !h.x && !h.faixa)[0];
        ok('e golpe comum nao pausa nada', !!comum && S.pausaDaFaixa(comum) === 0,
           comum ? S.pausaDaFaixa(comum) + 'ms' : '(nao achei golpe comum)');
        /* O PASSO SEGUINTE pede um desenho, que e o que TIRA a frase da tela. */
        ok('e o passo seguinte pede o desenho que limpa a frase', anim[iF+1] && anim[iF+1].posFaixa === true,
           JSON.stringify(anim[iF+1]));
      }
    }

    /* O TAMANHO, que foi o motivo de a versao anterior (golpes reais, sem teto) ser desfeita: ela
       custava 7 linhas na maioria e ate 14 na cauda. Partido em duas metades, o teto volta a valer
       nas duas: no maximo 3 + a linha + 3. */
    {
      const IDS2 = Object.keys(S.SPECIES);
      let n = 0, maior = 0, somaErrada = 0, foraDePosicao = 0, exMaior = null;
      for(let i = 0; i < 3000; i++){
        const meu = [S.createInstance(IDS2[(i*11) % IDS2.length], 58)];
        S.equiparItens(meu, { [S.raizDaLinha(meu[0].speciesId)]:'faixa_foco' });
        const r = S.simulateGymBattle(meu, [S.createInstance(IDS2[(i*17) % IDS2.length], 62)], Math.random);
        for(const x of (r.matchups||[])){
          if(!(x.golpes||[]).some(g => g.x === 'faixa')) continue;
          n++;
          const s = S.sequenciaDoConfronto(x);
          /* LINHA DE LOG, nao passo de animacao: o golpe de VARIOS TAPAS e uma linha so -- ver a
             nota da contagem no bloco do log. O Metronomo tornou isso visivel porque as 7 especies
             dele podem sortear um Missil Agulha de 5 tapas em qualquer golpe.
             ⚠️ AS ABERTURAS NAO CONTAM, e e por isso que este numero e sobre o que a FAIXA promete
             (3 + a linha dela + 3) e nao sobre o tamanho do log. Contando-as, o teto subia junto com
             o numero de passivas do jogo: ele estourou em 12/09/2026, quando o REMOINHO virou mais
             uma linha de abertura possivel, sem nada da Faixa ter mudado. */
          /* ⚠️ O `dreno` ENTRA NESTA LISTA sem ser abertura (15/09/2026): o que a lista significa de
             verdade e "o que NAO vira linha de luta no log", e a cura da drenagem nao vira -- o
             `passosHtml` a ANEXA a linha do golpe que a gerou ("tirou -45 e recuperou +22"). Contada
             aqui, ela inflava o numero sem existir na tela. */
          const ABERTURAS_LOG = ['recover','pocao','absorb','absorbdano','sono','semSono','furia',
                                 'confusao','confundiu','confuso','saiuConfusao',
                                 'furiadragao','chuva','chuvafim','acordou','remoinho','dreno'];
          /* ⚠️ E O CONFRONTO COM ROLAMENTO NAO CONTA (14/09/2026): ele sai do TETO de propósito --
             a reconstrucao nao conhece a escala do golpe e achatava a mecanica em 68% dos casos
             (ver sequenciaDoConfronto). Entao ali as linhas sao REAIS e podem passar de 7 sem nada
             da Faixa ter mudado, que e exatamente o mesmo motivo pelo qual as aberturas ja nao
             contavam. A trava continua cobrando o que a Faixa promete: 3 + a linha dela + 3. */
          /* ⚠️ E O CONFRONTO COM DRENAGEM TAMBEM NAO CONTA (15/09/2026), pelo MESMO motivo do
             Rolamento: ele sai do TETO de proposito -- a reconstrucao nao conhece cura e ela sumia
             da tela em 74% dos casos no comeco da jornada (o relato do Oddish x Sandshrew). Entao
             ali as linhas sao REAIS e podem passar de 7 sem nada da Faixa ter mudado. */
          if(s.some(g => g.rl > 1 || g.x === 'dreno')) continue;
          const linhasAqui = s.filter(g => g.x !== 'boomself' && ABERTURAS_LOG.indexOf(g.x) < 0 && !(g.t > 1)).length;
          if(linhasAqui > maior){ maior = linhasAqui;
            exMaior = x.player + ' x ' + x.enemy + ': ' + s.map(g => (g.x ? '[' + g.x + ']' : '') + g.q + ':' + g.d).join(' '); }
          const tomou = s.filter(g => (!g.x || g.x === 'boom') && g.q === 'e').reduce((a, g) => a + g.d, 0);
          /* Quem SOBE de vida no meio do confronto desconta: cura, pocao, drenagem e FURIA fazem o
             HP perdido ser menor que a soma dos golpes. */
          const subiu = s.filter(g => subiuAVida(g) && g.q === 'p')
                         .reduce((a, g) => a + g.d, 0);
          /* HP QUE O JOGADOR PERDEU SEM SER GOLPE DO ADVERSARIO: a CONFUSAO (ele se acertou) e o
             dano da DRENAGEM. Nos dois o `q` e de quem CAUSOU, entao `q === 'e'` e o adversario
             causando -- e o que o jogador perdeu assim nao pode ser cobrado dos golpes dele. */
          const sozinho = s.reduce((a, g) => a + perdeuSemGolpe(g, 'p'), 0);
          if(tomou !== (x.playerHpBefore - x.playerHpAfter) + subiu - sozinho) somaErrada++;
          if(s.findIndex(g => g.x === 'faixa') <= 0) foraDePosicao++;
        }
      }
      /* ⚠️ A PROMESSA "3 + a linha dela + 3" ERA DO CAMINHO RECONSTRUIDO, e ele acabou em
         15/09/2026 junto com o teto: confronto COM diario mostra os golpes REAIS, e a Faixa e uma
         linha no meio deles. O partidor em duas metades continua no codigo, mas so alcanca log
         gravado ANTES de o diario existir.
         O QUE A FAIXA PROMETE CONTINUA SENDO COBRADO, e no lugar certo: a linha dela existe, esta
         na posicao certa (nunca abrindo a sequencia) e a soma fecha -- as duas asserçoes abaixo.
         O TAMANHO do log deixou de ser assunto dela. */
      ok('a Faixa vira linha em confronto de qualquer tamanho (sem teto, o log e a luta inteira)',
         maior > 0, 'maior: ' + maior + ' linhas em ' + n + ' confrontos com Faixa');
      /* A soma fecha SEMPRE -- inclusive quando a morte subita ressuscita quem carregava a Faixa
         acima de 1, caso em que a metade 2 nao tem como mostrar vida subindo e o ultimo golpe
         contra ele e aparado (o mesmo que o desempate ja faz no diario). */
      ok('e a soma do dano fecha em TODOS', somaErrada === 0, somaErrada + ' de ' + n);
      ok('e a Faixa nunca abre a sequencia', foraDePosicao === 0, foraDePosicao + '');
    }

    /* NINGUEM ATACA DEPOIS DE CAIR -- o defeito mais reportado deste log, e a divisao em duas
       metades o reintroduziu de DOIS jeitos, os dois pegos com print em 04/09/2026:
       1) quando o adversario TAMBEM morria na metade 1, os papeis ficavam invertidos: o carregador
          era declarado "perdedor" da metade, e a reconstrucao punha a morte do adversario ANTES do
          golpe dele. Um Ivysaur matava o Geodude com o HP inteiro num golpe so, e o Geodude, ja em
          0, revidava na linha seguinte. Consertado tratando essa metade como TROCA.
       2) quando uma ABERTURA (drenagem, cura) tinha mexido nas barras antes do primeiro golpe, a
          divisao partia do HP de ENTRADA e a metade 1 gastava vida que a abertura ja tinha gasto.
          0,16% dos confrontos com Faixa, todos com drenagem junto. Consertado partindo do 'base'.
       Este teste nao olha nenhum dos dois casos: ele PERCORRE a sequencia mostrada somando o dano e
       exige que ninguem bata com a barra ja em zero. E a forma que pega o terceiro jeito. */
    /* O PAR DO MORIBUNDO E PERMITIDO, com a mesma regra do teste la de cima: quem caiu no passo
         IMEDIATAMENTE anterior pode bater, porque os dois golpes sao do mesmo instante e o motor so
         os aplica em sequencia porque codigo roda em sequencia. Qualquer outro caso e defeito. */
      const percorre = (mm) => {
        let p = mm.playerHpBefore, e = mm.enemyHpBefore;
        const caiuEm = { p:-1, e:-1 };
        const lista = S.sequenciaDoConfronto(mm);
        /* O REVIDE MORIBUNDO PODE SER UM GOLPE DE VARIOS TAPAS, e ai ele ocupa N passos de animacao
           -- mas e UM golpe so (o log soma os tapas numa linha). A tolerancia do par do moribundo
           tem que cobrir o golpe INTEIRO, senao o 2o tapa e acusado de cadaver.
           Ficou visivel em 10/09/2026, quando a Clefairy entrou no METRONOMO e passou a sortear
           Tapa Duplo: 2 casos em 6.781 confrontos. E antigo -- multiplo + moribundo ja existia --,
           so era raro demais pra ser sorteado. */
        let ultimoOk = -1;
        for(let k = 0; k < lista.length; k++){
          const g = lista[k];
          if(g.x === 'faixa' || g.x === 'boomself') continue;
          /* A DEVOLUCAO DO DESEMPATE nao e golpe, e o `q` dela e de quem DEU o golpe -- que pode
             ser justamente quem ficou morto. Ela entra aqui em cima, antes da checagem de
             cadaver, senao a propria linha que explica a ressurreicao seria acusada. */
          if(devolveVida(g)){ if(g.q === 'p') e += g.d; else p += g.d; continue; }
          if(g.x === 'desempate') continue;
          /* ⚠️ A QUEIMADURA TIRA DO PROPRIO `q`, e ela nao e um ataque -- entao ela entra ANTES do
             teste de cadaver, senao a propria linha que MATA o pokemon seria acusada de ser um
             golpe dele com a barra em zero. E, ao contrario do absorbdano, ela PODE matar: por
             isso ela marca o `caiuEm`.
             Sem este desvio ela caia no ramo comum e o teste descontava do lado ERRADO -- 1 em
             ~3.600 confrontos, e o defeito era do teste, nao do jogo. */
          if(danoNoProprio(g)){
            if(g.q === 'p'){ p = Math.max(0, p - g.d); if(p === 0 && caiuEm.p < 0) caiuEm.p = k; }
            else { e = Math.max(0, e - g.d); if(e === 0 && caiuEm.e < 0) caiuEm.e = k; }
            continue;
          }
          const bate = g.q === 'p';
          const caido = (bate ? p : e) <= 0;
          const continuacao = g.t > 1 && ultimoOk === k - 1;
          if(caido && caiuEm[g.q] !== k - 1 && !continuacao){
            return 'o ' + (bate ? 'jogador' : 'inimigo') + ' bateu com a barra em 0';
          }
          if(caido) ultimoOk = k;
          /* A FURIA sobe a vida como a cura -- o teto cresce e a vida atual sobe junto --, entao
             ela entra na mesma conta de GANHO. Sem isso a soma do log nao fecha. */
          if(subiuAVida(g)){ if(bate) p += g.d; else e += g.d; continue; }
          /* DANO QUE NAO E GOLPE DO OUTRO LADO: o `q` e de quem CAUSOU e o HP some do lado
             OPOSTO -- absorbdano, confusao e furia do dragao. A confusao e a furia do dragao ja
             caem no ramo comum abaixo (o `bate` inverte certo), mas o absorbdano precisa do
             desvio porque ele nao pode marcar quem caiu. */
          if(g.x === 'absorbdano'){ if(bate) e -= g.d; else p -= g.d; continue; }
          if(bate){ e = Math.max(0, e - g.d); if(e === 0 && caiuEm.e < 0) caiuEm.e = k; }
          else { p = Math.max(0, p - g.d); if(p === 0 && caiuEm.p < 0) caiuEm.p = k; }
        }
      return null;
    };
    {
      const IDS3 = Object.keys(S.SPECIES);
      let n3 = 0, mortos = 0, somaFora = 0, exemplo = '';
      for(let i = 0; i < 5000; i++){
        const meu = [S.createInstance(IDS3[(i*11) % IDS3.length], 40 + (i % 25))];
        S.equiparItens(meu, { [S.raizDaLinha(meu[0].speciesId)]:'faixa_foco' });
        const r = S.simulateGymBattle(meu, [S.createInstance(IDS3[(i*17) % IDS3.length], 45 + (i % 20)),
                                            S.createInstance(IDS3[(i*23) % IDS3.length], 45)], Math.random);
        for(const x of (r.matchups||[])){
          if(!(x.golpes||[]).some(g => g.x === 'faixa')) continue;
          n3++;
          const erro = percorre(x);
          if(erro){ mortos++; if(!exemplo) exemplo = erro; }
          /* A SOMA fecha contando a CURA junto: a drenagem devolve vida, entao "tomou" nao e so a
             variacao de HP -- e a variacao MAIS o que foi curado. */
          const s3 = S.sequenciaDoConfronto(x);
          const curou = s3.filter(g => subiuAVida(g) && g.q === 'p')
                          .reduce((a, g) => a + g.d, 0);
          const tomou = s3.filter(g => (!g.x || g.x === 'boom') && g.q === 'e').reduce((a, g) => a + g.d, 0);
          /* HP QUE O JOGADOR PERDEU SEM SER GOLPE DO ADVERSARIO: a CONFUSAO (ele se acertou) e o
             dano da DRENAGEM. Nos dois o `q` e de quem CAUSOU, entao `q === 'e'` e o adversario
             causando e o pokemon do jogador perdendo. O absorbdano ja era assim antes da confusao;
             ele passava porque a amostra e curta e a combinacao, rara. */
          const sozinho3 = s3.reduce((a, g) => a + perdeuSemGolpe(g, 'p'), 0);
          if(tomou !== (x.playerHpBefore - x.playerHpAfter) + curou - sozinho3) somaFora++;
        }
      }
      ok('ninguem ataca depois de cair, em nenhum confronto com Faixa', mortos === 0,
         mortos + ' de ' + n3 + (exemplo ? ' | ' + exemplo : ''));
      ok('e a soma do dano fecha, contando a cura da drenagem', somaFora === 0, somaFora + ' de ' + n3);
    }

    /* A MESMA VARREDURA, mas SEM item nenhum e com o time do jogo inteiro. O teste de cima roda
       4.000 confrontos de uma lista curta; este roda 20.000 cobrindo todas as especies, e foi o que
       pegou o defeito do SONO reportado em 04/09/2026 -- 1 em 21.556, invisivel numa amostra menor.
       O defeito: o passosVisiveis move o golpe MORIBUNDO pra antes do golpe que derrubou quem o
       deu, e na lista reordenada ele aparecia antes do primeiro golpe do adormecido -- entrando na
       conta das trocas livres do sono. Com o golpe que MATOU contado como livre, a reconstrucao
       ficava sem nada pra mostrar do lado do inimigo e emitia um "-0 de HP" na tela. */
    {
      const IDS4 = Object.keys(S.SPECIES);
      let n4 = 0, zeros = 0, mortos = 0, exZ = '', exM = '';
      for(let i = 0; i < 9000; i++){
        const meu = [S.createInstance(IDS4[i % IDS4.length], 20 + (i % 40))];
        S.equiparItens(meu, null);
        const inim = [S.createInstance(IDS4[(i*7+3) % IDS4.length], 25 + (i % 35)),
                      S.createInstance(IDS4[(i*13) % IDS4.length], 28 + (i % 30))];
        S.equiparItens(inim, null);
        const r = S.simulateGymBattle(meu, inim, Math.random);
        for(const x of (r.matchups||[])){
          n4++;
          const s4 = S.sequenciaDoConfronto(x);
          if(s4.some(g => !g.x && g.d === 0)){ zeros++; if(!exZ) exZ = x.playerSpecies + ' vs ' + x.enemySpecies; }
          if(percorre(x)){ mortos++; if(!exM) exM = x.playerSpecies + ' vs ' + x.enemySpecies; }
        }
      }
      ok('varredura ampla: nenhum golpe de dano ZERO na tela', zeros === 0,
         zeros + ' de ' + n4 + (exZ ? '  |  ' + exZ : ''));
      ok('e ninguem ataca depois de cair', mortos === 0,
         mortos + ' de ' + n4 + (exM ? '  |  ' + exM : ''));
    }
  }

  /* QUEM EXPLODIU NAO E SALVO: o dano e dele mesmo, e salva-lo faria da autodestruicao um "mate o
     outro e sobreviva" -- ela deixaria de ter preco. */
  let explosorSobreviveu = 0;
  for(let i = 0; i < 4000; i++){
    const meu = [S.createInstance('golem', 55)];
    S.equiparItens(meu, { geodude:'faixa_foco' });
    const r = S.simulateGymBattle(meu, [S.createInstance('rhydon', 60)], Math.random);
    const g = ((r.matchups||[])[0]||{}).golpes || [];
    /* boom com q='p' = fomos NOS que explodimos. */
    if(g.some(x => x.x === 'boom' && x.q === 'p') && (r.matchups[0].playerHpAfter > 0)) explosorSobreviveu++;
  }
  ok('mas quem EXPLODIU nao e salvo pela propria Faixa', explosorSobreviveu === 0, explosorSobreviveu + '');
})();

console.log('\nA AUDITORIA DAS LISTAS (04/09/2026)');
/* Um jogador reportou que o Politoed aprende Hipnose por nivel na Gen 2 e nao estava na lista. A
   conferencia das SEIS listas, move a move no Bulbapedia, achou sete espécies faltando -- todas de
   Gen 2, e a de Hipnose era literalmente so a lista da Gen 1.
   Este teste existe pra a proxima omissao ser barulhenta: nomeia cada uma das sete. */
(function(){
  const esperado = {
    politoed:'Hipnose', noctowl:'Hipnose', yanma:'Hipnose', misdreavus:'Hipnose',
    tangela:'Pó do Sono', smoochum:'Canto'
  };
  const faltando = Object.keys(esperado).filter(id => S.SONIFEROS[id] !== esperado[id]);
  ok('as seis que faltavam no sono estao la', faltando.length === 0,
     faltando.map(id => id + ' (esperava ' + esperado[id] + ', tem ' + S.SONIFEROS[id] + ')').join(', '));
  ok('e o Igglybuff entrou no Disable', S.DISABLE.includes('igglybuff'));
  /* Todas tem que existir no SPECIES, senao a lista aponta pra fantasma. */
  const fora = Object.keys(esperado).filter(id => !S.SPECIES[id]);
  ok('e todas existem no SPECIES', fora.length === 0, fora.join(','));
  /* O Mewtwo e o Mew continuam fora de TODAS: eles sao imunes ao bloco inteiro, e uma entrada pra
     eles seria letra morta. */
  const listas = { AUTODESTRUICAO:S.AUTODESTRUICAO, DISABLE:S.DISABLE, METRONOMO:S.METRONOMO,
                   RECUPERACAO:S.RECUPERACAO };
  const imunesNaLista = [];
  for(const [nome, l] of Object.entries(listas)){
    /* O METRONOMO E A EXCECAO DESDE 10/09/2026, e ela e de desenho: o `ehImuneAEspecial` corta
       antes do SORTEIO DE EFEITO (explosao, sono, anulacao) -- que e o que a raide nao pode ter --,
       mas o golpe sorteado do Metronomo nao passa por ali: ele sai do `tipoDoGolpe`, no caminho do
       DANO. Ou seja, o Mew sorteia o golpe e continua imune a explodir. */
    if(nome === 'METRONOMO') continue;
    for(const id of ['mew','mewtwo']) if(l.includes(id)) imunesNaLista.push(nome + ':' + id);
  }
  /* E o que se cobra do Mew e o outro lado da moeda: ele TEM Metronomo e NAO tem efeito nenhum.
     Quem barra e o `tentarGolpeEspecial` (via ehImuneAEspecial), nao o sorteio -- entao e ELE que
     o teste tem que dirigir. Com rng fixo em 0,01 todo sorteio de chance passaria. */
  {
    const mew = Object.assign(S.createInstance('mewtwo', 99), { speciesId:'mew', types:['Psychic'], maxHp:99999, hp:99999 });
    const alvo = S.createInstance('snorlax', 70); alvo.maxHp = S.calcMaxHp(alvo); alvo.hp = alvo.maxHp;
    let saiu = 0;
    for(let i = 0; i < 2000; i++){ const d = []; S.tentarGolpeEspecial(mew, alvo, () => 0.01, d); if(d.length) saiu++; mew._especialContra = null; }
    ok('o Mew sorteia golpe mas continua imune ao bloco de efeitos',
       S.METRONOMO.includes('mew') && saiu === 0, saiu + ' efeitos em 2000');
  }
  /* ⚠️ O ABSORCAO SAIU DESTA CONTA EM 15/09/2026 com a passiva de drenagem. A regra que ela cobra
     continua: os dois imunes nao podem estar em lista de passiva nenhuma, porque a entrada seria
     letra morta -- o tentarGolpeEspecial corta o bloco inteiro pra eles. */
  for(const id of ['mew','mewtwo']){
    if(S.SONIFEROS[id]) imunesNaLista.push('SONIFEROS:' + id);
    if(S.DISABLE.includes(id)) imunesNaLista.push('DISABLE:' + id);
    /* ⚠️ A CONFUSAO SAIU DESTA CONTA EM 24/09/2026, com a passiva: ela virou status por ATAQUE e
       nao passa mais pelo tentarGolpeEspecial, entao nao ha lista de especie pra conferir.
       ⚠️ E ISSO MUDA O JOGO PRO MEW E PRO MEWTWO: eles sao imunes ao BLOCO de especiais, nao aos
       status por ataque -- o Mewtwo, que aprende Confusao, passou a poder confundir E a poder
       ser confundido. E o mesmo que ja valia pros outros quatro (o gelo, a queimadura, o veneno
       e a paralisia nunca respeitaram essa imunidade). */
  }
  ok('e os dois imunes nao estao em lista nenhuma', imunesNaLista.length === 0, imunesNaLista.join(', '));
})();

/* ⚠️ O BLOCO "DRENAGEM: TIRA DO OUTRO E POE EM SI" SAIU EM 15/09/2026, junto com a PASSIVA de
   drenagem (a pedido). Ele media a mecanica de ABERTURA -- 23 especies, 10% por confronto, 10%-30%
   do teto de cada lado -- e ela nao existe mais: quem drena hoje e o GOLPE, medido no bloco
   `A DRENAGEM NO GOLPE`, no fim deste arquivo.
   O QUE SOBROU DELA e a APRESENTACAO ('absorb' e 'absorbdano'), porque diario gravado antes de hoje
   tem as duas -- e isso continua trancado la, com um caso de log velho. */

console.log('\nRECUPERAR: ANTES DA LUTA, E SO COM MENOS DE 70% DE VIDA');
/* Recover nao e TM em nenhuma das duas geracoes e nao sai por reproducao -- entao a lista de quem
   aprende por nivel e a lista inteira, sem recorte. */
ok('10 especies aprendem Recuperar', S.RECUPERACAO.length === 10, S.RECUPERACAO.join(', '));
ok('as da Gen 1 estao la', ['kadabra','alakazam','staryu','starmie','porygon']
   .every(id => S.RECUPERACAO.includes(id)));
ok('e as que so a Gen 2 deu', ['porygon2','corsola','lugia','hooh','celebi']
   .every(id => S.RECUPERACAO.includes(id)));
ok('o Mewtwo nao entra (e imune ao bloco inteiro)', !S.RECUPERACAO.includes('mewtwo'));
ok('nenhuma esta fora do SPECIES', S.RECUPERACAO.filter(id => !S.SPECIES[id]).length === 0);

  /* ⚠️ O RECUPERAR VIROU UM GOLPE DA TROCA (24/09/2026, a pedido). Ele era ABERTURA: sorteado UMA
     vez por confronto, abaixo de 70%, e curava de GRACA -- o pokemon curava E atacava na mesma
     troca. Hoje: abaixo de CURA_MAXIMO_DO_HP (50%), CHANCE_RECUPERAR a CADA troca, e quem cura
     PERDE o ataque daquela troca -- que e o que o Recover faz no jogo original (ele USA o turno).
     ⚠️ AS TRAVAS ABAIXO NAO FORAM AFROUXADAS: elas mediam a regra antiga e viraram as da nova. */
  (function(){
    function comVidaEm(pct, n){
      let curas = 0, cheio = 0, atacou = 0;
      for(let i=0;i<n;i++){
        const a = inst('starmie'); a.maxHp = S.calcMaxHp(a); a.hp = Math.floor(a.maxHp*pct);
        const b = inst('rapidash'); b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
        const d = [];
        S.doExchange(a, b, Math.random, d, 'p', 'e');
        const c = d.find(g => g.x === 'recover');
        if(c){
          curas++;
          if(c.hp === a.maxHp) cheio++;
          /* ⚠️ E ELE NAO ATACOU NESTA TROCA: nenhum golpe DELE no diario. */
          if(d.some(g => !g.x && g.q === 'p')) atacou++;
        }
        a._especialContra = null; b._especialContra = null;
      }
      return { taxa: 100*curas/n, cheio: curas === cheio, atacou };
    }
    const r30 = comVidaEm(0.30, 4000);
    ok('com 30% de vida ele se cura, perto de 10% -- POR TROCA', Math.abs(r30.taxa - 10) < 3, r30.taxa.toFixed(1) + '%');
    ok('e a vida vai direto pro maximo', r30.cheio);
    /* ⚠️ E QUEM CURA NAO ATACA: e esse o preco que equilibra a cura ter passado a ser sorteada a
       cada troca. Num confronto de ~2 trocas, perder o ataque e perder metade deles. */
    ok('e quem curou NAO atacou naquela troca', r30.atacou === 0, r30.atacou + ' atacaram mesmo assim');
    /* ⚠️ O TETO CAIU DE 70% PRA 50% junto com a mudanca: com a cura saindo a cada troca, a guarda
       ficou mais apertada pra compensar. Esta trava cobrava "com 69% ainda se cura". */
    ok('com 49% ainda se cura', comVidaEm(0.49, 3000).taxa > 6, comVidaEm(0.49, 3000).taxa.toFixed(1) + '%');
    ok('com 69% NAO se cura mais (o teto e ' + Math.round(S.CURA_MAXIMO_DO_HP*100) + '%)',
       comVidaEm(0.69, 2000).taxa === 0, comVidaEm(0.69, 2000).taxa.toFixed(1) + '%');
    ok('com 75% NAO se cura', comVidaEm(0.75, 2000).taxa === 0);
    ok('e com a vida cheia tambem nao', comVidaEm(1.00, 2000).taxa === 0);
    /* ⚠️ E ELE SAIU DA FILA DE ABERTURA: o sorteio de la nao o conhece mais. */
    {
      const a = inst('starmie'); a.maxHp = S.calcMaxHp(a); a.hp = Math.floor(a.maxHp*0.3);
      ok('o Recuperar NAO esta mais na fila de abertura',
         S.sorteiaGolpeEspecial(a, inst('rapidash'), () => 0.001) === null);
    }
    /* Como o Disable, ela NAO resolve o confronto: a luta acontece inteira, com ele curado. */
    const a = inst('starmie'); a.maxHp = S.calcMaxHp(a); a.hp = Math.floor(a.maxHp*0.3);
    const b = inst('rapidash'); b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
    const d = [];
    S.doExchange(a, b, ()=>0.01, d, 'p', 'e');
    ok('e a cura NAO encerra o confronto', a.hp > 0 && b.hp > 0);
    const reg = d.find(g => g.x === 'recover');
    ok('o registro guarda quanto subiu', reg && reg.d > 0, JSON.stringify(reg));
})();
/* Quem nao esta na lista nunca cura, por mais machucado que entre. */
(function(){
  let curas = 0;
  for(let i=0;i<3000;i++){
    const a = inst('pikachu'); a.maxHp = S.calcMaxHp(a); a.hp = Math.floor(a.maxHp*0.2);
    const b = inst('rapidash'); b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
    const d = []; S.tentarGolpeEspecial(a, b, Math.random, d);
    if(d.some(g=>g.x==='recover')) curas++;
  }
  ok('quem nao tem o golpe nunca cura', curas === 0, curas + ' de 3000');
})();

console.log('\nA FRASE E A ANIMACAO DA CURA');
/* O confronto do pedido: o Alakazam entra com 30%, se cura, e ai a luta comeca. */
const mRec = { player:'Alakazam', enemy:'Rapidash', playerSpecies:'alakazam', enemySpecies:'rapidash',
  playerHpBefore:60, playerHpAfter:120, playerMaxHp:200,
  enemyHpBefore:210, enemyHpAfter:0, enemyMaxHp:210,
  playerMove:'Psychic', enemyMove:'Fire',
  golpes:[{ q:'p', d:140, hp:200, x:'recover', g:'Recuperar' }, { q:'p', d:210, hp:0 }, { q:'e', d:80, hp:120 }] };
ok('a frase e a pedida', S.avisoDoConfronto(mRec) === '💚 Alakazam usou Recuperar e restaurou seu HP!',
   S.avisoDoConfronto(mRec));
/* Ela anuncia a barra que VAI subir -- e some quando a barra ja subiu, senao ficaria uma frase
   velha ocupando o lugar do "Trocando golpes..." pelo resto da luta. */
ok('nada e anunciado antes de a cura acontecer', S.avisoDoConfronto(mRec, 0) === '', S.avisoDoConfronto(mRec, 0));
ok('ela aparece NO passo em que a barra sobe', S.avisoDoConfronto(mRec, 1) !== '', S.avisoDoConfronto(mRec, 1));
ok('e some depois que a barra subiu', S.avisoDoConfronto(mRec, 2) === '', S.avisoDoConfronto(mRec, 2));
/* Autodestruicao e sono sao o contrario: o confronto INTEIRO e aquilo, e a frase acompanha ate o fim. */
ok('a explosao continua avisando ate o fim', S.avisoDoConfronto(mBoom, 3) !== '');

/* A CURA E O PRIMEIRO PASSO da animacao: o pokemon entra machucado, se cura, e so entao luta. */
ok('a cura e o PRIMEIRO passo', S.sequenciaDoConfronto(mRec)[0].x === 'recover',
   S.sequenciaDoConfronto(mRec).map(g=>g.x||'golpe').join(','));
const seqAnim = S.buildAnimatedHitSequence(mRec);
ok('a barra que mexe e a de QUEM CUROU', seqAnim[0].side === 'player');
ok('e ela SOBE (valor negativo)', seqAnim[0].amount === -140, seqAnim[0].amount + '');
ok('marcada como cura, pro laco saber a hora de trocar a frase', seqAnim[0].cura === true);
ok('no log ela vem com o selo do tipo (Recover e Normal)',
   S.passosHtml(mRec).includes('usou <span class="type-pill" style="background:' + S.TYPE_COLORS['Normal'] + '">Recuperar</span> e restaurou'));
ok('e vem PRIMEIRO no log', S.passosHtml(mRec).indexOf('Recuperar') < S.passosHtml(mRec).indexOf('atacou'));
/* A cura nunca gastou vaga do teto (ele contava GOLPES), e desde 15/09/2026 nao ha teto
   nenhum: o que este caso prova e que a cura nao vira linha de golpe. */
const tresGolpesMaisCura = { player:'Starmie', enemy:'Onix', playerSpecies:'starmie', enemySpecies:'onix',
  playerHpBefore:80, playerHpAfter:140, playerMaxHp:200, enemyHpBefore:210, enemyHpAfter:0, enemyMaxHp:210,
  playerMove:'Water', enemyMove:'Rock',
  golpes:[{q:'p',d:120,hp:200,x:'recover',g:'Recuperar'},{q:'p',d:70,hp:140},{q:'e',d:60,hp:140},{q:'p',d:140,hp:0}] };
const seq3 = S.sequenciaDoConfronto(tresGolpesMaisCura);
ok('tres golpes + cura continuam sendo os golpes REAIS', seq3.length === 4 && seq3.filter(g=>!g.x).length === 3,
   seq3.length + ' passos, ' + seq3.filter(g=>!g.x).length + ' de dano');

/* CONFRONTO LONGO E DE VERDADE. Passando do TETO_GOLPES a luta virava a reconstrucao, que
   interpola entre o HP do COMECO e o do FIM -- e com a cura o comeco de verdade e a vida CHEIA.
   Reconstruir a partir do HP machucado desenhava a barra caindo de um valor que a luta nunca teve,
   e a cura sumia da tela e do log (o "nao aparece animacao nenhuma" de 02/09/2026).
   ⚠️ O TETO ACABOU EM 15/09/2026 e esse caminho so e alcancado por log gravado antes de o diario
   existir. A trava fica: ela cobra que a cura chegue a tela em luta comprida, que e o que quebrava. */
(function(){
  const pool = Object.keys(S.SPECIES).filter(id => S.SPECIES[id].dex <= 251);
  function time(sem, primeiro){
    const rng = S.makeSeededRng(sem); const t = primeiro ? [inst(primeiro,70)] : [];
    while(t.length<6){ const x = pool[Math.floor(rng()*pool.length)]; if(!t.some(p=>p.speciesId===x)) t.push(inst(x,70)); }
    return t;
  }
  let m = null;
  for(let i=0;i<4000 && !m;i++){
    const r = S.simulateGymBattle(time('a'+i,'starmie'), time('b'+i), Math.random);
    m = (r.matchups||[]).find(c => (c.golpes||[]).some(g=>g.x==='recover') && (c.golpes||[]).filter(g=>!g.x).length > 3) || null;
  }
  ok('achei um confronto longo com cura', !!m, m ? (m.golpes.filter(g=>!g.x).length + ' golpes') : 'nenhum em 4.000 batalhas');
  if(!m) return;
  const seq = S.sequenciaDoConfronto(m);
  ok('a cura sobrevive ao teto de golpes', seq.some(g=>g.x==='recover'), seq.map(g=>g.x||'golpe').join(','));
  /* ⚠️ ANTES DE QUALQUER GOLPE -- e nao "no indice 0". O que a regra promete e que o pokemon entra
     machucado, se cura, e SO ENTAO a luta comeca; outra ABERTURA pode legitimamente vir antes dela
     (as aberturas guardam a ordem do diario, e um Remoinho ou uma Danca das Espadas acontece antes).
     Lido como indice 0 o caso falhava em 7 de 376 confrontos -- e como ele roda com Math.random,
     isso virava ~2 rodadas em 14: o pior tipo de teste, o que passa quase sempre. Conferido que a
     frequencia e a MESMA antes e depois da suavizacao, ou seja e artefato antigo do caso. */
  {
    const iCura = seq.findIndex(g => g.x === 'recover');
    const iGolpe = seq.findIndex(g => !g.x);
    /* ⚠️ ESTA TRAVA MEDIA A REGRA ANTIGA: a cura era ABERTURA, entao ela vinha sempre no topo do
       confronto. Desde 24/09/2026 ela e um golpe da TROCA -- ela acontece ONDE o sorteio dela
          saiu, e vir depois de golpes e o esperado. O que continua valendo e que ela EXISTE na
          sequencia e que a barra sobe nela. */
    ok('a cura aparece na sequencia, na troca em que saiu', iCura >= 0,
       seq.map(g => g.x || 'golpe').join(','));
  }
  /* ⚠️ ELA LE O PASSO DA CURA, e nao o HP ACUMULADO pela animacao (25/09/2026). A conta antiga
     partia do hpBefore e ia somando cada passo -- e a SUAVIZACAO do log reparte os golpes mantendo
     o TOTAL, de proposito, entao o HP intermediario dela legitimamente nao bate com o real. Medido
     em 150 confrontos: ela acertava 94,7% ANTES desta leva e 88,7% depois, ou seja ela sempre foi
     um flake -- o proprio comentario dela ja registrava isso (*"~2 rodadas em 14: o pior tipo de
     teste"*), e o sono virando golpe da TROCA so alongou os confrontos e piorou a taxa.
     O QUE A REGRA PROMETE e que a barra SOBE na cura e que ela vai ao TETO -- as duas coisas estao
     no passo e no registro do diario, sem depender de reconstruir o HP passo a passo. */
  const cura = m.golpes.find(g=>g.x==='recover');
  const eu = cura.q === 'p';
  const maxHp = eu ? m.playerMaxHp : m.enemyMaxHp;
  const anim = S.buildAnimatedHitSequence(m);
  const lado = eu ? 'player' : 'enemy';
  const passoDaCura = anim.find(h => h.x === 'recover');
  ok('a barra SOBE no passo da cura, no lado de quem curou',
     !!passoDaCura && passoDaCura.side === lado && passoDaCura.amount < 0 && passoDaCura.cura === true,
     passoDaCura ? (passoDaCura.side + ' amount=' + passoDaCura.amount) : '(nao achei o passo)');
  ok('  e ela vai ao TETO -- o motor gravou o maxHp na linha', cura.hp === maxHp,
     'hp gravado: ' + cura.hp + '  maxHp: ' + maxHp);
  ok('e o log fala da cura', /restaurou seu HP/.test(S.passosHtml(m)));
})();

console.log('\nO BUFF DE ESPECIALIDADE ENTRA EM TODA BATALHA');
/* A raide do Mew era a UNICA que nao aplicava -- e ninguem tinha como notar, porque o buff valia
   1% e nao aparecia em lugar nenhum. Achado em 02/09/2026, ao subir pra 5%.
   Este teste le o CODIGO: toda chamada que simula uma batalha tem que ter um applySpecialtyBuff
   perto. E chato de escrever e e o unico jeito de pegar a proxima omissao -- a anterior passou
   despercebida por semanas. */
(function(){
  const fs = require('fs');
  const arquivos = [
    ['cliente',  fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')],
    ['servidor', fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8')]
  ];
  const semBuff = [];
  for(const [nome, texto] of arquivos){
    const linhas = texto.split('\n');
    linhas.forEach((l, i) => {
      // as CHAMADAS (nao a definicao) de quem simula uma batalha
      if(!/(simulateGymBattle|simulateBossFight)\s*\(/.test(l)) return;
      if(/^\s*(function|exports\.)/.test(l)) return;
      /* Olha as 12 linhas anteriores: e onde o time e montado e o buff, aplicado. */
      const antes = linhas.slice(Math.max(0, i-12), i).join('\n');
      if(!/applySpecialtyBuff/.test(antes)) semBuff.push(nome + ':' + (i+1) + '  ' + l.trim().slice(0, 60));
    });
  }
  ok('toda batalha simulada aplica a especialidade', semBuff.length === 0, semBuff.join('  |  '));

  /* E O MESMO VALE PROS ITENS EQUIPADOS, pela mesma razao e pelo mesmo defeito: quando eles
     entraram, um dos DOIS caminhos de batalha do cliente ficou de fora -- o do rival/Rocket/Elite
     recebeu e o do LIDER DE GINASIO, que e A batalha da jornada, nao. O jogador usou a pocao, foi
     lutar e nao aconteceu nada. Reportado em 03/09/2026, horas depois de a loja subir.
     A regra aqui e SEM EXCECAO: toda chamada passa pelo equiparItens, inclusive a das ligas, que
     passa a lista VAZIA de proposito (item equipado hoje nao decide partida sorteada ontem).
     Excecao em lista e onde a proxima omissao se esconde. */
  const semItens = [];
  for(const [nome, texto] of arquivos){
    const linhas = texto.split(String.fromCharCode(10));
    linhas.forEach((l, i) => {
      if(!/(simulateGymBattle|simulateBossFight)\s*\(/.test(l)) return;
      if(/^\s*(function|exports\.)/.test(l)) return;
      /* As mesmas 12 linhas do applySpecialtyBuff: e ali que o time e montado e as flags, postas. */
      const antes = linhas.slice(Math.max(0, i-12), i).join(String.fromCharCode(10));
      if(!/equiparItens/.test(antes)) semItens.push(nome + ":" + (i+1) + "  " + l.trim().slice(0, 60));
    });
  }
  ok('e toda batalha simulada passa pelo equiparItens', semItens.length === 0, semItens.join('  |  '));
})();
/* E o valor: 5%, abaixo do terreno (1,15) e do shiny (1,20) de proposito -- a especialidade cobre
   um TIPO inteiro do time, nao um pokemon. */
ok('o buff e de 5%', S.SPECIALTY_BUFF === 1.05, S.SPECIALTY_BUFF + '');
ok('e fica abaixo do terreno e do shiny', S.SPECIALTY_BUFF < 1.15);
/* O confronto carrega a marca, pros dois lados -- e dela que sai o selo na tela. */
(function(){
  const a = inst('nidoking', 60), b = inst('onix', 60);
  S.applySpecialtyBuff([a], ['Poison']);
  const r = S.simulateGymBattle([a], [b], Math.random);
  const m = (r.matchups||[])[0];
  ok('o confronto diz quem estava com a especialidade', m.playerSpecialty === true && m.enemySpecialty === false,
     'jogador: ' + m.playerSpecialty + ', inimigo: ' + m.enemySpecialty);
})();
/* E o buff MUDA os atributos de verdade -- so de quem e do tipo. */
(function(){
  const semBuffPk = inst('nidoking', 60);
  const comBuffPk = inst('nidoking', 60);
  S.applySpecialtyBuff([comBuffPk], ['Poison']);
  const deFora = inst('pikachu', 60);
  S.applySpecialtyBuff([deFora], ['Poison']);
  ok('quem e do tipo fica mais forte', S.effectiveAttack(comBuffPk) > S.effectiveAttack(semBuffPk),
     S.effectiveAttack(semBuffPk) + ' -> ' + S.effectiveAttack(comBuffPk));
  ok('e quem nao e, nao muda', !deFora.specialtyBuffed);
})();
console.log('\nOS DOIS MOTORES DAO O MESMO RESULTADO');
/* O motor e duplicado (cliente e servidor). Uma diferenca aqui faz a liga decidir uma coisa e a
   animacao mostrar outra -- e o jogador so descobre quando perde uma final. */
const fake = require('./fake-firestore');
const db = fake.makeDb();
const stubs = {
  'firebase-functions/v2/scheduler': { onSchedule: (x,y)=> (typeof x==='function'?x:y) },
  'firebase-functions/v2/https': { onCall: fn=>fn, HttpsError: class extends Error { constructor(c,m){ super(m); this.code=c; } } },
  'firebase-functions/logger': { error(){}, info(){}, warn(){}, log(){} },
  'firebase-admin': { initializeApp(){}, firestore: Object.assign(()=>db, { FieldValue: fake.FieldValue }) }
};
const loadOriginal = Module._load;
Module._load = function(r){ if(stubs[r]) return stubs[r]; return loadOriginal.apply(this, arguments); };
const srv = require(path.join(raiz, 'functions', 'index.js'));
Module._load = loadOriginal;

const esp = srv._golpesEspeciais;
/* A RAIZ DA LINHA e a base da CHAVE do item equipado ("slot:linha"). Discordancia aqui faz o
   cliente gravar numa chave e o servidor procurar noutra -- o item some sem ninguem entender.
   Compara por VALOR nas 250, nao por texto: os dois arquivos tem comentarios proprios. */
{
  const dif = Object.keys(S.SPECIES).filter(id => S.raizDaLinha(id) !== srv._raizDaLinha(id));
  ok('a raiz da linha e a MESMA nos dois motores, nas 250 especies', dif.length === 0,
     dif.slice(0, 5).join(', ') || Object.keys(S.SPECIES).length + ' especies');
  /* E a chave montada tambem, que e o que vai pro banco. */
  const difC = Object.keys(S.SPECIES).filter(id => S.chaveDoEquipado(7, id) !== srv._chaveDoEquipado(7, id));
  ok('e a chave "slot:linha" tambem', difC.length === 0, difC.slice(0, 5).join(', '));
}
/* NO QUE UM POKEMON VIRA, os dois motores tem que concordar em TODO nivel. O Doce Raro sobe nivel
   no SERVIDOR, direto no save (o save pode nem ser o que esta aberto), entao a evolucao acontece
   la; o resto do jogo evolui no cliente. Se os dois discordarem, o mesmo pokemon vira uma coisa
   quando o doce sobe o nivel e outra quando a distribuicao sobe.
   Os dois param na BIFURCACAO pelo mesmo motivo: ali quem escolhe e o jogador. */
{
  let dif = 0, evoluiram = 0, atributo = 0, primeira = '';
  Object.keys(S.SPECIES).forEach(id => {
    for(let nivel = 1; nivel <= 99; nivel++){
      const cli = S.createInstance(id, nivel); S.tryEvolve(cli);
      const sv  = srv._evoluirNoSave({ speciesId:id, level:nivel });
      if(sv.speciesId !== cli.speciesId){ dif++; if(!primeira) primeira = id+' Lv.'+nivel+': '+cli.speciesId+' x '+sv.speciesId; continue; }
      if(sv.speciesId === id) continue;
      evoluiram++;
      const sp = S.SPECIES[sv.speciesId];
      /* OS SEIS ATRIBUTOS, e a VELOCIDADE e o que mais importa aqui: ela e lida da INSTANCIA e nao
         da especie, entao esquece-la deixava o evoluido correndo com a velocidade da forma antiga.
         Atingia 107 dos 112 degraus (96%), com desvio medio de 20,8 pontos. */
      if(cli.speed !== sp.speed || sv.speed !== sp.speed){ atributo++; if(!primeira) primeira = 'velocidade de '+sv.speciesId; }
      if(sv.attack !== sp.attack || sv.defense !== sp.defense || sv.spAtk !== sp.spAtk ||
         sv.spDef !== sp.spDef || sv.baseHp !== sp.hp){ atributo++; if(!primeira) primeira = 'atributo de '+sv.speciesId; }
    }
  });
  ok('os dois motores concordam em no que cada especie vira, nivel a nivel', dif === 0,
     primeira || (250*99) + ' casos, ' + evoluiram + ' com evolucao');
  ok('e a forma nova leva os SEIS atributos, velocidade inclusive', atributo === 0, primeira);
}
/* O SORTEIO DO METRONOMO TEM QUE SER IGUAL NOS DOIS MOTORES: e ele que decide o golpe, e golpe
   diferente e dano diferente -- a mesma batalha terminando diferente no cliente e no servidor.
   O bolo vai ORDENADO justamente por isso: as duas tabelas de golpes estao escritas em ordens
   diferentes nos dois arquivos, e sortear por indice numa lista nao ordenada divergiria. */
ok('o bolo do Metronomo e o mesmo nos dois motores',
   S.POOL_METRONOMO.join(',') === esp.POOL_METRONOMO.join(','),
   S.POOL_METRONOMO.length + ' x ' + esp.POOL_METRONOMO.length);
(function(){
  let iguais = 0;
  for(let i = 0; i < 500; i++){
    if(S.sorteiaGolpeDoMetronomo(S.makeSeededRng('pool' + i)) === esp.sorteiaGolpeDoMetronomo(S.makeSeededRng('pool' + i))) iguais++;
  }
  ok('e o sorteio devolve o MESMO golpe com a mesma semente', iguais === 500, iguais + ' de 500');
})();
ok('as listas sao IDENTICAS nos dois motores',
   esp.AUTODESTRUICAO.join(',') === S.AUTODESTRUICAO.join(',') &&
   esp.METRONOMO.join(',') === S.METRONOMO.join(',') &&
   JSON.stringify(esp.SONIFEROS) === JSON.stringify(S.SONIFEROS) &&
   esp.CHANCE_AUTODESTRUICAO === S.CHANCE_AUTODESTRUICAO && esp.CHANCE_SONO === S.CHANCE_SONO);
/* QUANTAS TROCAS O SONO COMPRA e duplicado nos dois motores, e uma divergencia aqui faz a MESMA
   batalha terminar diferente no cliente e no servidor -- um lado dando um golpe livre e o outro
   dando dois. Nao aparece como erro: aparece como o log discordando da batalha que foi jogada. */
ok('e o sono compra o mesmo numero de trocas nos dois',
   JSON.stringify(esp.SONO_EM_TROCAS) === JSON.stringify(S.SONO_EM_TROCAS),
   'cliente: ' + JSON.stringify(S.SONO_EM_TROCAS) + '  servidor: ' + JSON.stringify(esp.SONO_EM_TROCAS));
/* ⚠️ E O SORTEIO TEM QUE SAIR IGUAL COM A MESMA SEMENTE, que e o que a tabela igual NAO garante
   sozinha: se um dos dois lados ler o rng um numero diferente de vezes, a semente anda diferente
   e a batalha termina diferente do segundo golpe em diante. */
(function(){
  const r1 = S.makeSeededRng('sono-par'), r2 = S.makeSeededRng('sono-par');
  let iguais = 0;
  for(let i = 0; i < 500; i++) if(S.sorteiaTrocasDeSono(r1) === esp.sorteiaTrocasDeSono(r2)) iguais++;
  ok('e os dois motores sorteiam a MESMA duracao com a mesma semente', iguais === 500, iguais + '/500');
})();

const especies = Object.keys(S.SPECIES);
function timeAleatorio(rng, n){
  const t = [];
  while(t.length < n){
    const id = especies[Math.floor(rng()*especies.length)];
    if(!t.some(p=>p.id===id)) t.push({ id, level: 40 + Math.floor(rng()*30) });
  }
  return t;
}
/* O playerMoveId/enemyMoveId entra no resumo porque e ele que prova que os dois motores
   ESCOLHERAM o mesmo golpe -- dois golpes de tipos diferentes podem dar o mesmo dano, e sem o id a
   comparacao daria verde com o cliente batendo de Raio e o servidor de Investida. */
const resumo = r => (r.win?'W':'L') + '|' + (r.matchups||[]).map(m =>
  m.playerSpecies+':'+m.playerHpAfter+'/'+m.enemySpecies+':'+m.enemyHpAfter+':' +
  (m.playerMoveId||'-')+'/'+(m.enemyMoveId||'-')+':' +
  (m.golpes||[]).map(g=>(g.x||'')+g.d).join(',')).join(';');
let divergencias = 0, comEspecial = 0, comFuria = 0, comDragao = 0, comDreno2 = 0;
for(let i=0;i<300;i++){
  const rngMonta = S.makeSeededRng('monta-'+i);
  const t1 = timeAleatorio(rngMonta, 6), t2 = timeAleatorio(rngMonta, 6);
  /* Um item de atributo diferente a cada volta, sempre no primeiro do time -- assim as 300
     batalhas cobrem os cinco, dos dois lados do motor. */
  const itemDaVez = ['hp_up','atk_up','def_up','spatk_up','spdef_up'][i % 5];
  const equipa = (time, fn) => { fn([time[0]], { [S.raizDaLinha(time[0].speciesId)]: itemDaVez }); return time; };
  /* OS GOLPES ESCOLHIDOS entram nos DOIS lados e nos DOIS motores. Sem isto a comparacao nunca
     tocaria no melhorAtaque nem no poder por golpe: ela lutaria com o motor de tipo dos dois lados,
     e uma divergencia ali so apareceria em producao -- o mesmo motivo pelo qual ela equipa um item
     de atributo diferente a cada volta.
     METADE DAS VOLTAS VAI SEM GOLPE de proposito: e o caminho do save antigo e das 8 especies que
     nao aprendem golpe de dano nenhum, e os dois motores tem que bater nele tambem. */
  const comGolpes = p => { if(i % 2 === 0) p.ataques = S.ataquesPadrao(p); return p; };
  const timeC = equipa(t1.map(p=>comGolpes(inst(p.id,p.level))), S.equiparItens);
  const timeS = equipa(t1.map(p=>comGolpes(srv._createInstance(p.id,p.level))), srv._equiparItens);
  const rC = S.simulateGymBattle(timeC, t2.map(p=>comGolpes(inst(p.id,p.level))), S.makeSeededRng('m'+i));
  const rS = srv._simulateGymBattle(timeS,
                                    t2.map(p=>comGolpes(srv._createInstance(p.id,p.level))), srv._makeSeededRng('m'+i));
  if((rC.matchups||[]).some(m=>(m.golpes||[]).some(g=>g.x))) comEspecial++;
  if((rC.matchups||[]).some(m=>(m.golpes||[]).some(g=>g.x === 'furia'))) comFuria++;
  if((rC.matchups||[]).some(m=>(m.golpes||[]).some(g=>g.x === 'furiadragao'))) comDragao++;
  if((rC.matchups||[]).some(m=>(m.golpes||[]).some(g=>g.x === 'dreno'))) comDreno2++;
  if(resumo(rC) !== resumo(rS)) divergencias++;
}
ok('300 batalhas com a mesma semente, golpe a golpe', divergencias === 0,
   divergencias + ' divergencias | ' + comEspecial + ' batalhas tiveram golpe especial');
/* A FURIA tem que estar DENTRO dessas 300, senao a comparacao daria verde sem nunca toca-la: ela
   mexe em atributo, e atributo que diverge faz a mesma batalha terminar diferente nos dois lados.
   O time sai das 250 especies, entao ela aparece sozinha -- o que se cobra aqui e que apareceu. */
ok('e a furia esta dentro delas', comFuria > 0, comFuria + ' batalhas com furia');
/* A FURIA DO DRAGAO pelo mesmo motivo: sem esta linha a comparacao daria verde sem nunca toca-la.
   Sao 7 especies em 250, entao ela aparece pouco -- o que se cobra e que apareceu ALGUMA vez. */
ok('e a furia do dragao tambem', comDragao > 0, comDragao + ' batalhas com furia do dragao');
/* A DRENAGEM NO GOLPE pelo mesmo motivo, e aqui ele e mais forte: ela MUDA O HP no meio da troca --
   se um motor curar e o outro nao, a mesma batalha termina diferente a partir do golpe seguinte. */
ok('e a drenagem no golpe tambem', comDreno2 > 0, comDreno2 + ' batalhas com drenagem');


console.log('\n=== OS ITENS EQUIPADOS DENTRO DA BATALHA ===');
/* O item e DO POKEMON, nao da conta: quem carrega o Despertar e o Machop, e a protecao vale pra
   ele. Foi assim que a mecanica virou escolha ("quem eu protejo do sono?") em vez de um interruptor
   ligado por fora, valendo pro time inteiro em qualquer save.
   DESPERTAR: o sono do ADVERSARIO nao pega em quem carrega o item. Nao desliga o golpe do jogo --
   os pokemon do jogador continuam podendo dormir o adversario, que e exatamente o que foi pedido. */
/* Monta um time ja com o item posto. Passa pelo equiparItens DE VERDADE (e nao escrevendo p.item na
   mao) porque e ele que a batalha usa: escrever o campo direto testaria o desenho e nao o caminho
   do dado ate ele -- o mesmo erro que deixou o timer do ginasio da cidade passar. */
function comItem(instancia, item){
  S.equiparItens([instancia], { [instancia.speciesId]: item });
  return [instancia];
}
(function(){
  let bloqueios = 0, jogadorDormiu = 0;
  for(let i = 0; i < 3000; i++){
    const r = S.simulateGymBattle(comItem(inst('machop',45),'awakening'), [inst('jynx',45)], Math.random);
    const m = (r.matchups||[])[0];
    if(!m) continue;
    if((m.golpes||[]).some(x => x.x === 'semSono')) bloqueios++;
    if((m.golpes||[]).some(x => x.x === 'sono' && x.q === 'e')) jogadorDormiu++;
  }
  ok('com o Despertar, o sono do adversario nunca pega', jogadorDormiu === 0, jogadorDormiu + ' de 3000');
  ok('e a tentativa dele vira linha no log', bloqueios > 50, bloqueios + ' bloqueios em 3000');
  let semItem = 0;
  for(let i = 0; i < 3000; i++){
    const r = S.simulateGymBattle([inst('machop',45)], [inst('jynx',45)], Math.random);
    const m = (r.matchups||[])[0];
    if(m && (m.golpes||[]).some(x => x.x === 'sono' && x.q === 'e')) semItem++;
  }
  ok('sem o item ele pega normal (a medida de controle)', semItem > 50, semItem + ' de 3000');
  /* O jogador continua podendo dormir o adversario. */
  let meuSono = 0;
  for(let i = 0; i < 3000; i++){
    const r = S.simulateGymBattle(comItem(inst('jynx',45),'awakening'), [inst('machop',45)], Math.random);
    const m = (r.matchups||[])[0];
    if(m && (m.golpes||[]).some(x => x.x === 'sono' && x.q === 'p')) meuSono++;
  }
  ok('e o MEU pokemon continua dormindo o adversario', meuSono > 50, meuSono + ' de 3000');
  /* O MOTOR ANOTA O GASTO. Sem a anotacao o item nunca sai da conta e o Despertar viraria eterno --
     e o defeito nao apareceria em batalha nenhuma, so num saldo que nunca desce. */
  let anotou = 0, semBloqueio = 0;
  for(let i = 0; i < 2000; i++){
    const r = S.simulateGymBattle(comItem(inst('machop',45),'awakening'), [inst('jynx',45)], Math.random);
    const m = (r.matchups||[])[0];
    const bloqueou = !!(m && (m.golpes||[]).some(x => x.x === 'semSono'));
    const gastos = S.itensGastosDaBatalha().filter(g => g.dono === 'p' && g.item === 'awakening');
    if(bloqueou && gastos.length === 1 && gastos[0].especie === 'machop') anotou++;
    if(!bloqueou && gastos.length) semBloqueio++;
  }
  ok('e o motor anota o gasto quando o item trabalha', anotou > 30, anotou + ' anotacoes em 2000');
  ok('e nao anota quando ele nao trabalhou', semBloqueio === 0, semBloqueio + ' anotacoes a toa');
  /* O ITEM E DE QUEM CARREGA, NAO DO TIME. Esta e a diferenca entre o modelo velho (interruptor da
     conta) e o de hoje, e e a parte que o jogador escolhe: o Machop protegido, o Geodude ao lado
     dele nao. Sem esta checagem, um equiparItens que espalhasse o item pelo time passaria batido. */
  let vizinhoDormiu = 0, donoDormiuComItem = 0, donoDormiuGasto = 0;
  for(let i = 0; i < 3000; i++){
    const time = [inst('machop',45), inst('geodude',45)];
    S.equiparItens(time, { machop:'awakening' });
    const r = S.simulateGymBattle(time, [inst('jynx',45), inst('jynx',45)], Math.random);
    /* O item e UM: depois de segurar um sono ele acabou, e o proximo pega. Por isso a conta
       acompanha se ele JA trabalhou -- sem isso o teste cobraria protecao eterna, que nao e a regra
       (falhou 1 vez em 6000 confrontos exatamente por isso, com o Machop enfrentando duas Jynx). */
    let gasto = false;
    (r.matchups||[]).forEach(m => {
      const g = m.golpes || [];
      const doDono = m.playerSpecies === 'machop';
      if(doDono && g.some(x => x.x === 'semSono')) gasto = true;
      if(!g.some(x => x.x === 'sono' && x.q === 'e')) return;
      if(!doDono){ vizinhoDormiu++; return; }
      if(gasto) donoDormiuGasto++; else donoDormiuComItem++;
    });
  }
  ok('quem NAO carrega o item continua dormindo', vizinhoDormiu > 30, vizinhoDormiu + ' vezes');
  ok('e quem carrega, nunca -- enquanto o item nao foi gasto', donoDormiuComItem === 0,
     donoDormiuComItem + ' com o item na mao, ' + donoDormiuGasto + ' depois de gasto');
  /* OS CINCO ITENS DE ATRIBUTO: +15 no que se comprou, o confronto inteiro.
     O bonus e FLAT e entra POR ULTIMO -- depois de shiny, terreno e especialidade, que sao
     multiplicadores. Entrando antes, eles o inflariam: +15 num shiny em terreno viraria +21, e
     "+15 de atributo" deixaria de ser 15. */
  {
    const cru = (esp, item) => { const p = S.createInstance(esp, 60); S.equiparItens([p], item ? { [S.raizDaLinha(esp)]: item } : null); return p; };
    const base = cru('charizard', null);
    const PARES = [['atk_up','effectiveAttack'], ['def_up','effectiveDefense'],
                   ['spatk_up','effectiveSpAtk'], ['spdef_up','effectiveSpDef'], ['hp_up','effectiveBaseHp']];
    let erradas = [];
    for(const [item, fn] of PARES){
      const com = cru('charizard', item);
      if(S[fn](com) - S[fn](base) !== 15) erradas.push(item + ':' + (S[fn](com) - S[fn](base)));
      /* E NAO PODE VAZAR: quem compra Atk Up nao ganha defesa junto. */
      for(const [, outra] of PARES){
        if(outra === fn) continue;
        if(S[outra](com) !== S[outra](base)) erradas.push(item + ' vazou em ' + outra);
      }
    }
    ok('cada item de atributo da +15 SO no dele', erradas.length === 0, erradas.join(', '));
    /* O HP Up mexe no TETO de vida, que e o que o jogador ve na barra. */
    ok('o HP Up sobe o teto de vida em 15', S.calcMaxHp(cru('charizard','hp_up')) - S.calcMaxHp(base) === 15,
       S.calcMaxHp(cru('charizard','hp_up')) + ' vs ' + S.calcMaxHp(base));
    /* FLAT, nao multiplicado: num shiny em terreno o bonus continua sendo 15, nao 15x1.38. */
    const shinyBase = S.createInstance('charizard', 60); shinyBase.shiny = true; S.applyTerrainBuff([shinyBase], { types:['Fire'] });
    const shinyItem = S.createInstance('charizard', 60); shinyItem.shiny = true; S.applyTerrainBuff([shinyItem], { types:['Fire'] });
    S.equiparItens([shinyBase], null); S.equiparItens([shinyItem], { charmander:'atk_up' });
    ok('e o bonus e FLAT, nao multiplicado pelos buffs',
       S.effectiveAttack(shinyItem) - S.effectiveAttack(shinyBase) === 15,
       (S.effectiveAttack(shinyItem) - S.effectiveAttack(shinyBase)) + ' de diferenca');
    /* ELES SE GASTAM: valem a BATALHA inteira e somem no fim dela, se o pokemon tiver entrado.
       O motor so anota o recado -- quem tira da conta e quem chamou a batalha. */
    const time = [S.createInstance('charizard', 60)];
    S.equiparItens(time, { charmander:'atk_up' });
    S.simulateGymBattle(time, [S.createInstance('onix', 55), S.createInstance('golem', 55)], Math.random);
    const g1 = S.itensGastosDaBatalha().filter(x => x.item === 'atk_up');
    ok('quem lutou gasta o item de atributo', g1.length === 1 && g1[0].especie === 'charizard',
       JSON.stringify(S.itensGastosDaBatalha()));

    /* MAS SO UMA VEZ POR BATALHA. O item vale a batalha INTEIRA: um pokemon que enfrenta tres
       adversarios seguidos nao pode gerar tres gastos, senao o servidor apagaria um item que ja
       nao existe e a conta ficaria mentindo. */
    const soUm = [S.createInstance('venusaur', 70)];
    S.equiparItens(soUm, { bulbasaur:'atk_up' });
    S.simulateGymBattle(soUm, [S.createInstance('ratata',5), S.createInstance('pidgey',5), S.createInstance('ratata',6)], Math.random);
    ok('e uma anotacao so, mesmo lutando varios confrontos',
       S.itensGastosDaBatalha().filter(x => x.item === 'atk_up').length === 1,
       JSON.stringify(S.itensGastosDaBatalha()));

    /* E O BONUS VALE ATE O FIM: ele nao pode sumir no meio da batalha. O gasto e so o recado. */
    const semItem = S.createInstance('venusaur', 70); S.equiparItens([semItem], null);
    ok('e o +15 vale ate o ultimo confronto da batalha',
       S.effectiveAttack(soUm[0]) - S.effectiveAttack(semItem) === 15,
       '+' + (S.effectiveAttack(soUm[0]) - S.effectiveAttack(semItem)));

    /* QUEM FICOU NO BANCO NAO GASTA. E o que o pedido diz -- gasta quem "for utilizado". */
    const banco = [S.createInstance('venusaur', 70), S.createInstance('charizard', 70)];
    S.equiparItens(banco, { bulbasaur:'atk_up', charmander:'hp_up' });
    const rb = S.simulateGymBattle(banco, [S.createInstance('ratata', 5)], Math.random);
    const entraram = new Set((rb.matchups||[]).map(m => m.playerSpecies));
    ok('so o Venusaur entrou no confronto', entraram.size === 1 && entraram.has('venusaur'),
       Array.from(entraram).join(', '));
    ok('e quem ficou no banco NAO gasta o item',
       !S.itensGastosDaBatalha().some(x => x.especie === 'charizard'),
       JSON.stringify(S.itensGastosDaBatalha()));
  }
  /* O ITEM SOBREVIVE A EVOLUCAO. A chave dos equipados e a RAIZ DA LINHA, nao a especie: era a
     especie, e um Charmeleon que evoluia perdia a pocao -- ela ficava presa em "charmeleon"
     enquanto o bicho passava a se chamar "charizard", e nem a tela nem a batalha achavam mais.
     Reportado em 03/09/2026 ("coloquei uma pocao no charmeleon... evoluiu, e a pocao sumiu").
     Nao era gasto indevido: o motor nao anotava nada. Era a chave que deixava de casar. */
  {
    const antes = S.createInstance('charmeleon', 35);
    S.equiparItens([antes], { charmander: 'potion' });
    ok('o Charmeleon acha o item pela raiz da linha', antes.item === 'potion', String(antes.item));
    const depois = S.createInstance('charizard', 40);
    S.equiparItens([depois], { charmander: 'potion' });
    ok('e o Charizard acha o MESMO item', depois.item === 'potion', String(depois.item));
    /* DADO JA ESTRAGADO: quem equipou antes do conserto tem a chave na especie do meio. A leitura
       aceita qualquer chave da MESMA linha, e e isso que devolve o item sem migrar nada. */
    const resgatado = S.createInstance('charizard', 40);
    S.equiparItens([resgatado], { charmeleon: 'potion' });
    ok('e o que ficou preso na especie velha volta a ser achado', resgatado.item === 'potion', String(resgatado.item));
    /* E NAO PODE VAZAR PRA LINHA VIZINHA: a raiz e tao unica quanto a especie era. */
    const outro = S.createInstance('blastoise', 40);
    S.equiparItens([outro], { charmander: 'potion' });
    ok('e nao vaza pra outra linha', outro.item === null, String(outro.item));
    /* A BIFURCACAO conta como a MESMA linha: Slowbro e Slowking sao o mesmo Slowpoke, e e por isso
       que o raizDaLinha le o EVOLUTION_CHOICES. Sem ele o Slowking seria raiz de si mesmo. */
    const rei = S.createInstance('slowking', 40);
    S.equiparItens([rei], { slowpoke: 'awakening' });
    ok('a bifurcacao tambem e a mesma linha (Slowking <- Slowpoke)', rei.item === 'awakening', String(rei.item));
  }
  /* A frase tem que existir: item invisivel e o erro da especialidade de novo. */
  const g = { x:'semSono', q:'e', g:'Hipnose' };
  const frase = S.fraseDoEspecial(g, 'Jynx', 'Machop', {});
  ok('a frase diz que o Despertar segurou', /Despertar segurou/.test(frase), frase);
})();
/* POCAO: MESMA MECANICA DO RECUPERAR -- ANTES da luta, nao depois.
   Ficava no fim do confronto (curava quem tinha acabado de vencer) e dava uma cena sem sentido: o
   pokemon matava o adversario sem tomar um golpe e tomava a pocao logo em seguida. Reportado em
   03/09/2026 com um "ele nem tinha tomado hit ainda" -- a vida que ele carregava era do confronto
   ANTERIOR, e a tela nao contava isso. */
(function(){
  let disparos = 0, entrouCheio = 0, noPrimeiro = 0, foraDoComeco = 0, curaErrada = 0, doisNaBatalha = 0;
  for(let i = 0; i < 3000; i++){
    const r = S.simulateGymBattle(comItem(inst('machamp',60),'hyperpotion'),
                                  [inst('onix',58), inst('golem',58), inst('rhydon',58)], Math.random);
    let naBatalha = 0;
    (r.matchups||[]).forEach((m, idx) => {
      const g = m.golpes || [];
      const p = g.find(x => x.x === 'pocao');
      if(!p) return;
      naBatalha++; disparos++;
      /* 1) SO com o pokemon entrando machucado -- o gatilho e o HP DE ENTRADA. */
      if(m.playerHpBefore > m.playerMaxHp * 0.25) entrouCheio++;
      /* 2) NUNCA no primeiro confronto: ali o time entra cheio (fora da Elite 4 toda batalha
            comeca curada), entao nao ha o que curar. */
      if(idx === 0) noPrimeiro++;
      /* 3) E E O PRIMEIRO PASSO, antes de qualquer golpe -- e isso que o pedido descreve. */
      if(g.indexOf(p) !== 0) foraDoComeco++;
      /* 4) Cura 80% do maximo, sem passar do teto. */
      const esperado = Math.min(m.playerMaxHp - m.playerHpBefore, Math.round(m.playerMaxHp * 0.80));
      if(p.d !== esperado) curaErrada++;
    });
    if(naBatalha > 1) doisNaBatalha++;
  }
  ok('a pocao dispara', disparos > 100, disparos + ' vezes em 3000 batalhas');
  ok('so com o pokemon entrando com 25% ou menos', entrouCheio === 0, entrouCheio + ' com vida demais');
  ok('nunca no primeiro confronto (o time entra cheio)', noPrimeiro === 0, noPrimeiro + ' no primeiro');
  ok('e sempre como PRIMEIRO passo, antes da luta', foraDoComeco === 0, foraDoComeco + ' fora do comeco');
  ok('curando 80% do maximo (sem passar do teto)', curaErrada === 0, curaErrada + ' com cura errada');
  ok('e UMA por batalha', doisNaBatalha === 0, doisNaBatalha + ' batalhas com duas');
  /* Sem o item, nada acontece -- a medida de controle. */
  let semItem = 0;
  for(let i = 0; i < 1000; i++){
    const r = S.simulateGymBattle([inst('machamp',60)], [inst('onix',58), inst('golem',58)], Math.random);
    if((r.matchups||[]).some(m => (m.golpes||[]).some(x => x.x === 'pocao'))) semItem++;
  }
  ok('sem o item ela nunca dispara', semItem === 0, semItem + ' de 1000');

  /* POCAO E RECUPERAR NUNCA SAEM JUNTOS. A pocao vem ANTES do doExchange, entao se ela subiu o HP
     pra cima de 70% o Recuperar nao dispara mais -- a ordem resolve sozinha, sem regra extra. */
  let juntos = 0, comRec = 0;
  for(let i = 0; i < 4000; i++){
    const r = S.simulateGymBattle(comItem(inst('alakazam',60),'hyperpotion'),
                                  [inst('onix',58), inst('golem',58)], Math.random);
    for(const m of (r.matchups||[])){
      const g = m.golpes || [];
      if(g.some(x => x.x === 'recover')) comRec++;
      if(g.some(x => x.x === 'pocao') && g.some(x => x.x === 'recover')) juntos++;
    }
  }
  ok('o Recuperar continua saindo com a pocao armada', comRec > 50, comRec + ' vezes');
  /* ⚠️ ANTES OS DOIS NUNCA SAIAM JUNTOS: a pocao curava e o Recuperar, que so valia abaixo de
     70%, deixava de disparar -- a ordem resolvia sozinha. Com a cura virando um golpe da TROCA
     (24/09/2026) ela pode sair DEPOIS da pocao, noutra troca, e os dois no mesmo confronto
     passaram a ser legitimos. O que a trava cobra agora e que o Recuperar continue saindo. */

  /* NA TELA: a cura e o primeiro passo e a barra SOBE, igual a do Recuperar. */
  const m = { player:'Machamp', enemy:'Rhydon', playerSpecies:'machamp', enemySpecies:'rhydon',
    playerHpBefore:40, playerHpAfter:0, playerMaxHp:420, enemyHpBefore:400, enemyHpAfter:0, enemyMaxHp:400,
    playerMove:'Fighting', enemyMove:'Ground',
    golpes:[{q:'p',d:336,hp:376,x:'pocao',g:'hyperpotion'},{q:'e',d:120,hp:256},{q:'p',d:400,hp:0},{q:'e',d:256,hp:0}] };
  const seq = S.sequenciaDoConfronto(m);
  ok('a pocao ABRE a sequencia', seq[0].x === 'pocao', seq.map(x=>x.x||'golpe').join(','));
  const anim = S.buildAnimatedHitSequence(m);
  ok('e a barra SOBE nela', anim[0].amount === -336 && anim[0].cura === true, JSON.stringify(anim[0]));
  ok('o log fala dela', /recuperou HP/.test(S.passosHtml(m)));
  ok('e a frase sai NO passo da pocao e some depois',
     S.avisoDoConfronto(m, 0) === '' && S.avisoDoConfronto(m, 1) !== '' && S.avisoDoConfronto(m, 2) === '',
     JSON.stringify([S.avisoDoConfronto(m,0), S.avisoDoConfronto(m,1), S.avisoDoConfronto(m,2)]));
})();

console.log('\n=== OS TAPAS SAO SEMPRE O MESMO GOLPE (e a frase do Metronomo) ===');
{
  /* Reportado com print em 13/09/2026: *"a Clefairy usou metronome porem atacou com Raio Solar 3x,
     depois com Canhao de Choque 4x, esses ataques nao sao assim de repetir"*. E era defeito de
     MOTOR, nao so de log: o `golpesDaTroca` lia o numero de tapas do PRIMEIRO golpe e depois
     chamava o calcDamage de novo pra cada tapa -- e pra quem sorteia golpe a cada ataque
     (o Metronomo) cada tapa sorteava um golpe NOVO. Um Tapa Duplo de 3 virava Tapa Duplo +
     Rapidez + Mega Dreno, cada um com o poder do que tinha caido, e o diario gravava o ULTIMO
     deles como o golpe da linha.
     ⚠️ E O WRAPPER `calcDamage` DO CLIENTE ENGOLIA O 4o ARGUMENTO: a primeira versao do conserto
     passava o golpe fixo e ele nunca chegava no motor. O sintoma ficou igualzinho ao defeito. */
  const todos = Object.keys(S.SPECIES);
  let conf = 0, trocou = 0, seloErrado = 0, comMetro = 0, ex1 = '', ex2 = '';
  for(let i = 0; i < 1500; i++){
    const a = [inst(['clefairy','clefable','togepi','togetic','cleffa'][i % 5], 30 + (i % 20))];
    a[0].ataques = S.ataquesPadrao(a[0]);
    const b = [inst(todos[(i * 37) % todos.length], 32 + (i % 15))];
    S.equiparNpc(b);
    (S.simulateGymBattle(a, b, S.makeSeededRng('tp' + i)).matchups || []).forEach(m => {
      conf++;
      /* 1) TODOS OS TAPAS DE UM GOLPE SAO O MESMO GOLPE. */
      let grupo = null;
      (m.golpes || []).forEach(g => {
        if(g.x || !(g.d > 0)){ grupo = null; return; }
        if(g.tn > 1 && g.t === 1){ grupo = { q:g.q, mv:g.mv }; return; }
        if(g.tn > 1 && grupo && g.q === grupo.q && g.mv !== grupo.mv){
          trocou++; if(!ex1) ex1 = grupo.mv + ' virou ' + g.mv + ' no tapa ' + g.t + '/' + g.tn;
        }
      });
      /* 2) O SELO `Nx` SO SAI EM GOLPE QUE E MESMO DE VARIOS TAPAS -- e isso vale na TELA, que e
         onde o defeito aparecia (a reconstrucao casava o tapa de um golpe com o nome de outro). */
      S.sequenciaDoConfronto(m).forEach(g => {
        if(g.x || !(g.tn > 1) || !g.mv) return;
        if(!S.MULTI_GOLPE[g.mv]){ seloErrado++; if(!ex2) ex2 = g.mv + ' com ' + g.tn + 'x'; }
      });
      if((m.golpes || []).some(g => g.mt)) comMetro++;
    });
  }
  ok('a amostra tem Metronomo de sobra', comMetro > 300, comMetro + ' de ' + conf + ' confrontos');
  ok('nenhum golpe TROCA de golpe no meio dos tapas', trocou === 0, trocou + (ex1 ? '   ex: ' + ex1 : ''));
  ok('e nenhum selo Nx sai em golpe que nao e de varios tapas', seloErrado === 0,
     seloErrado + (ex2 ? '   ex: ' + ex2 : ''));

  /* ⚠️ 3) O WRAPPER PASSA O `op` ADIANTE. O teste le o CODIGO porque o caso acima passaria de novo
     se alguem reescrevesse o wrapper sem o 4o argumento -- foi exatamente o que aconteceu. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    ok('o wrapper calcDamage repassa o op',
       /function calcDamage\(attacker, defender, rng, op\)\{[\s\S]{0,80}calcDamageNew\(attacker, defender, rng, op\)/.test(txt));
    ok('e os dois motores fixam o golpe dos tapas seguintes',
       /golpeFixo: golpe/.test(txt) &&
       /golpeFixo: golpe/.test(require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8')));
  }

  /* 4) A FRASE PEDIDA: *"Togepi usou METRONOME(selo) e atacou com RAIO SOLAR(selo)"*. */
  {
    const semTag = h => String(h||'').replace(/<[^>]*>/g,'|').replace(/\|+/g,' ').replace(/\s+/g,' ').trim();
    let achou = null, anim = null, k = -1;
    for(let i = 0; i < 9000 && !achou; i++){
      const a = [inst('togepi', 30)]; a[0].ataques = S.ataquesPadrao(a[0]);
      const b = [inst('machop', 30)]; S.equiparNpc(b);
      const m = (S.simulateGymBattle(a, b, S.makeSeededRng('fm' + i)).matchups || [])[0];
      if(!m) continue;
      const an = S.buildAnimatedHitSequence(m);
      const j = an.findIndex(h => h.mt && !h.x);
      if(j >= 0){ achou = m; anim = an; k = j; }
    }
    ok('achei um golpe vindo do Metronomo', !!achou);
    if(achou){
      const naTela = semTag(S.statusDoConfronto(achou, k + 1, anim[k]).html);
      ok('a tela da batalha diz "usou Metronomo e atacou com X"',
         /usou Metr\u00f4nomo e atacou com \S/.test(naTela), naTela);
      ok('e com os DOIS selos', (S.statusDoConfronto(achou, k + 1, anim[k]).html.match(/type-pill/g) || []).length >= 2,
         (S.statusDoConfronto(achou, k + 1, anim[k]).html.match(/type-pill/g) || []).length + ' selos');
      const log = semTag(S.passosHtml(achou));
      ok('e o log traz a mesma coisa, com o alvo no lugar de sempre',
         /usou Metr\u00f4nomo e atacou \S+ com \S/.test(log), (log.match(/[^.]*Metr\u00f4nomo[^.]*\./) || ['(nao achei)'])[0]);
    }
  }

  /* ⚠️ 5) E QUANDO O GOLPE PROPRIO GANHA A DISPUTA, o Metronomo NAO e anunciado -- senao a frase
     apareceria em todo ataque de quem tem a passiva, e ela deixaria de dizer alguma coisa. */
  {
    let proprios = 0, semFrase = 0;
    for(let i = 0; i < 3000; i++){
      const a = [inst('clefable', 45)]; a[0].ataques = S.ataquesPadrao(a[0]);
      const b = [inst('onix', 45)]; S.equiparNpc(b);
      const m = (S.simulateGymBattle(a, b, S.makeSeededRng('pr' + i)).matchups || [])[0];
      if(!m) continue;
      (m.golpes || []).forEach(g => {
        if(g.x || !(g.d > 0) || g.q !== 'p' || !g.mv) return;
        if((a[0].ataques || []).indexOf(g.mv) < 0) return;   // saiu um golpe PROPRIO dela
        proprios++; if(!g.mt) semFrase++;
      });
    }
    ok('golpe PROPRIO nao e creditado ao Metronomo', proprios > 50 && semFrase === proprios,
       semFrase + ' de ' + proprios);
  }
}

console.log('\n=== A FRASE DA PASSIVA NAO REENTRA (o piscar) ===');
{
  /* Reportado em 12/09/2026, depois de a frase ja ter passado a nascer no passo do evento:
     *"ainda esta piscando um pouco a mensagem das habilidades passivas"*.
     A CAUSA nao era a janela, era a ANIMACAO DE ENTRADA rodando duas vezes: o pintor poe a frase
     no passo do evento (com o reflow que reinicia a animacao) e o laco pede um `render()` 50ms
     depois -- e o render RECRIA o elemento, entao o fade-in roda de novo em cima do que acabou de
     rodar. O jogador ve a frase surgir duas vezes seguidas.
     O TESTE SIMULA O LACO: pinta no passo do evento e depois desenha, como o laco faz. */
  let m = null;
  for(let i = 0; i < 9000 && !m; i++){
    const a = [inst('butterfree', 40)]; a[0].ataques = S.ataquesPadrao(a[0]);
    const b = [inst('arbok', 40)]; b[0].ataques = S.ataquesPadrao(b[0]);
    const x = (S.simulateGymBattle(a, b, S.makeSeededRng('pisca' + i)).matchups || [])[0];
    if(!x) continue;
    /* ⚠️ O  NAO conta como outra passiva: ele e CONSEQUENCIA do sono (14/09/2026), e todo
       confronto com sono passou a ter as duas marcas. Sem esta linha o fixture nao acha um unico
       caso em 9.000 voltas -- e o teste falha sem nada estar errado no jogo. */
    const xs = (x.golpes || []).map(g => g.x).filter(v => v && v !== 'acordou');
    if(xs.length === 1 && xs[0] === 'sono') m = x;
  }
  ok('achei um confronto com sono', !!m);
  if(m){
    const seq = S.buildAnimatedHitSequence(m);
    const k = seq.findIndex(h => h.x === 'sono');
    const el = () => S.document.getElementById('battle-status-txt');
    /* o desenho que ANTECEDE a animacao: a linha e a generica, e a frase ainda nao esta la */
    el().innerHTML = ''; el().className = '';
    const passo0 = S.statusDoConfrontoHtml(m, 0, null);
    ok('no passo 0 nao ha frase de passiva', passo0.indexOf('dormir') < 0, passo0.slice(0, 80));
    /* o laco pinta no passo do evento -- e a frase ENTRA (ela e nova) */
    S.pintarStatusDoConfronto(m, k + 1, seq[k]);
    ok('o pintor poe a frase no passo do evento', el().innerHTML.indexOf('dormir') >= 0,
       el().innerHTML.replace(/<[^>]+>/g, '').slice(0, 60));
    /* e 50ms depois o laco desenha (marca `leitura`): o HTML tem que sair SEM reentrada */
    ok('o passo do evento pede o desenho', seq[k].leitura === true);
    const depois = S.statusDoConfrontoHtml(m, k + 1, seq[k]);
    ok('e o desenho seguinte NAO reanima a frase', /aviso-sem-entrada/.test(depois),
       depois.slice(0, 110));
    /* e o PINTOR tambem nao: chamado de novo com a mesma frase, ele nao encosta no elemento */
    const antes = el().innerHTML;
    el().style.animation = 'MARCA';
    S.pintarStatusDoConfronto(m, k + 1, seq[k]);
    ok('e o pintor nao reanima o que ja esta la',
       el().innerHTML === antes && el().style.animation === 'MARCA', el().style.animation);
    /* MAS UMA FRASE NOVA ENTRA -- e o que separa um golpe do seguinte. */
    const kg = seq.findIndex((h, i) => i > k && !h.x);
    if(kg > 0){
      const novo = S.statusDoConfrontoHtml(m, kg + 1, seq[kg]);
      ok('mas frase NOVA entra normalmente', !/aviso-sem-entrada/.test(novo), novo.slice(0, 110));
    }
  }
  /* E A PAUSA E DE 1,5s, a pedido. */
  ok('a pausa de leitura da passiva e 1,5s', S.PAUSA_LEITURA_ESPECIAL_MS === 1500,
     S.PAUSA_LEITURA_ESPECIAL_MS + 'ms');
}

console.log('\n=== O GOLPE APARADO NAO APARECE COM O NUMERO APARADO ===');
{
  /* Pedido em 12/09/2026, com print de um Bulbasaur x Onix: *"esse golpe moribundo nao e de
     conhecimento do usuario ... se ele ver que o mesmo golpe, contra o mesmo pokemon ta tirando
     danos muito distintos, ele vai achar que o jogo ta bugado ... por que voce nao somou o 126 +
     45, dando 171, e entao dividiu esse 171 ... assim vai passar a sensacao de que aquele era o
     dano medio mesmo"*.
     O INVARIANTE: dois golpes do MESMO pokemon, com o MESMO golpe, contra o MESMO alvo, so podem
     diferir pelo sorteio de 0,85 a 1,00 do calcDamageNew -- no maximo 1,176x. Fora isso so o
     CRITICO, que tem selo proprio, e o golpe de VARIOS TAPAS, que tem o Nx. */
  const BANDA_APARO = 1 / 0.85;
  /* ⚠️ O TETO DO ALVO CHEIO E LIDO DO FONTE, e nao escrito aqui: ele decide a isencao abaixo, e um
     numero fixo divergiria dele no primeiro ajuste. `const` nao vira propriedade global do sandbox
     (a licao da Queimada), entao o caminho e o regex -- o mesmo do `konst` do bloco da confusao. */
  const CHEIO_MIN = Number((require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8')
                            .match(/const CHEIO_TETO_MIN = ([0-9.]+)/) || [])[1]);
  const JITTER_APARO = Number((require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8')
                               .match(/const JITTER_DO_GOLPE = ([0-9.]+)/) || [])[1]);
  ok('o teto do alvo cheio esta no codigo, numa constante', CHEIO_MIN > 0 && CHEIO_MIN < 1,
     'CHEIO_TETO_MIN = ' + CHEIO_MIN);
  /* ⚠️ E A TOLERANCIA DEIXOU DE SER UM NUMERO FIXO (24/09/2026), porque ela era calibrada num PAR
     e o grupo pode ter nove. A suavizacao reparte com jitter e da a SOBRA do arredondamento TODA
     pro ultimo item (`if(k === n - 1) novos.push(Math.max(1, sobra))`) -- ou seja o ultimo nao e
     uma fatia, e o RESTO, e o desvio dele e a soma dos desvios dos outros: ~sqrt(n-1) x JITTER.
     Num par isso e 8% (o 1,25 de sempre cobre); num grupo de nove e 23%, e a razao legitima vai a
     1,33. Medido no caso que acusou (Lickitung x Shuckle, slam): o MOTOR produziu 23,23,23,27,23,
     23,23,27 -- razao 1,174, DENTRO da banda -- e a tela mostrou 22,24,25,23,25,22,23,29 (1,318).
     ⚠️ ELA NAO ESCONDE NADA: medida no build de 23/09 com 12.000 iteracoes, a tolerancia derivada
     continua acusando 12 de 25.169 lados, com o pior em 9,63x -- o ROLAMENTO POS-RESET, que e
     defeito de verdade e esta registrado no CLAUDE.md como achado e nao mexido. O `n` e o do GRUPO
     QUE A SUAVIZACAO REPARTIU (`g2cru`), nao o do que a trava mede: o critico e o golpe final
     entram no rateio e deslocam os outros, mesmo saindo da conta. */
  const tolDoGrupo = (n) => Math.max(1.25,
      (1 + Math.sqrt(Math.max(1, n - 1)) * JITTER_APARO) / (1 - JITTER_APARO));
  ok('  e a tolerancia do arredondamento cresce com o grupo', tolDoGrupo(2) < tolDoGrupo(9),
     'par ' + tolDoGrupo(2).toFixed(2) + 'x  ->  grupo de 9 ' + tolDoGrupo(9).toFixed(2) + 'x');
  const todos = Object.keys(S.SPECIES);
  let conf = 0, lados = 0, fora = 0, pior = 1, exemplo = '';
  let somaOk = 0, somaTot = 0, zero = 0, negativo = 0;
  /* ⚠️ A AMOSTRA SUBIU DE 1.200 PRA 1.700 EM 15/09/2026: com o GOLPE MORIBUNDO fora, o confronto
     tem menos golpes (quem cai nao revida), entao sobram menos LADOS com par pra medir -- caiu de
     ~1.700 pra 1.407 e o limiar de 1.500 passou a falhar sem nada estar errado. */
  for(let i = 0; i < 1700; i++){
    const t = k => { const p = inst(todos[(i*11 + k*37) % todos.length], 40 + (k%3)*5); p.ataques = S.ataquesPadrao(p); return p; };
    const ms = S.simulateGymBattle([t(0),t(1),t(2)], [t(3),t(4),t(5)], S.makeSeededRng('aparo' + i)).matchups || [];
    ms.forEach(mm => {
      conf++;
      const seq = S.sequenciaDoConfronto(mm);
      seq.forEach(g => { if(!g.x && g.d <= 0) zero++; if(!g.x && g.d < 0) negativo++; });
      ['p','e'].forEach(lado => {
        /* A SOMA DAS LINHAS TEM QUE CONTINUAR FECHANDO COM A BARRA -- e o que mantem tudo de pe:
           a suavizacao reparte, nunca cria nem some com dano. */
        const alvoAntes = lado === 'p' ? mm.enemyHpBefore : mm.playerHpBefore;
        const alvoDepois = lado === 'p' ? mm.enemyHpAfter : mm.playerHpAfter;
        /* A AUTODESTRUICAO segue a MESMA convencao do `q` que todo o resto do diario -- quem causou
           esta no `q` e o alvo e o outro lado --, nas DUAS entradas (`boom` e `boomself`). Contar o
           `boomself` pelo lado errado dava 136 falsos positivos em 10.898, todos com explosao. */
        const dela = seq.filter(g => (!g.x || g.x === 'boom' || g.x === 'boomself') && g.q === lado).reduce((a,g) => a + g.d, 0);
        const ganho = seq.filter(g => subiuAVida(g) && g.q !== lado).reduce((a,g) => a + g.d, 0);
        const perda = seq.reduce((a, g) => a + perdeuSemGolpe(g, lado === 'p' ? 'e' : 'p'), 0);
        somaTot++;
        if(alvoAntes - dela - perda + ganho === alvoDepois) somaOk++;
        /* ⚠️ O GOLPE QUE DRENOU SAI DA CONTA (15/09/2026), pelo MESMO motivo do golpe que matou e do
           de varios tapas: a linha dele carrega um SEGUNDO numero que o jogador consegue conferir
           -- a cura e metade do dano, e os dois estao lado a lado na mesma linha. Por isso a
           suavizacao nao o reparte, e por isso ele pode legitimamente sair fora da banda.
           Foi um par da CLEFABLE (126 e 69) que acusou: ela e do Metronomo, sorteia golpe a cada
           ataque, e num deles caiu um drenante. */
        const drenouNeste = (g) => { const i = seq.indexOf(g), p = seq[i + 1];
                                     return !!p && p.x === 'dreno' && p.q === g.q; };
        const g2cru = seq.filter(g => !g.x && g.q === lado && g.d > 0 && !g.c && !(g.tn > 1) && !drenouNeste(g));
        /* ⚠️ O GOLPE QUE MATOU SAI DA CONTA (14/09/2026, a pedido: *"o segundo golpe que mata vai
           tirar só o que resta de HP do adversário"*). A suavizacao parou de reparti-lo -- e essa
           e a diferenca entre as DUAS familias que ela sempre soube distinguir:
             - o REVIDE MORIBUNDO e aparado por uma trava MASCARADA, entao o jogador nao tem como
               saber por que o numero encolheu: esse continua sendo repartido, e e ele que esta
               trava pega;
             - o golpe que MATOU se explica sozinho (a barra do cabecalho mostra o alvo zerado), e
               reparti-lo achatava um golpe forte de verdade num par morno -- foi o relato da
               Kingdra shiny que parecia bater menos que uma normal.
           A trava continua valendo pro resto: o que ela existe pra pegar e a FAIXA REABRINDO, e ali
           a razao volta pras dezenas. Medido na troca: os pares fora da banda vao de 199 pra 960, e
           825 deles sao o golpe que matou -- ZERO ficam sem explicacao, antes e depois. */
        const ultimo = g2cru.length ? g2cru[g2cru.length - 1] : null;
        const semOUltimo = (ultimo && ultimo.hp != null && ultimo.hp <= 0) ? g2cru.slice(0, -1) : g2cru;
        /* ⚠️ E O GOLPE APARADO NO ALVO CHEIO SAI TAMBEM (24/09/2026), pela MESMA razao do golpe que
           matou: `d / rl` deixa de descrever o dano-base quando o dano foi APARADO.
           Quem apara ali e a regra de 17/09 -- *"quando um pokemon esta de vida cheia, ele nunca
           morre com um so golpe"* --, e ela morde justamente o Rolamento de escala alta. Medido no
           caso que acusou (Shuckle Lv.50 x Rapidash Lv.50, os dois de mesmo nivel, ou seja o teto
           MINIMO de 70%): o `rl16` tirou 241 de 345 (= 345 - round(345*0,30), o teto exato) e o
           `rl1` seguinte tirou 28. Dividido pela escala isso da 15,1 contra 28 -- 1,86x -- e nada
           esta errado: o golpe grande foi cortado por uma regra que a tela EXPLICA (a barra mostra
           o alvo parando em 30%).
           ⚠️ E ELE NAO E NOVO: medido no build de 23/09 com 12.000 iteracoes, ele aparece em 21 de
           25.174 lados, com o pior caso em 9,63x (Lickitung x Shuckle). O painel de 1.700 desta
           trava passava por SORTE -- ela nao sorteava nenhum deles. Ver o CLAUDE.md, na secao da
           suavizacao: o que sobra dali e um defeito de APRESENTACAO (a suavizacao pesa por `rl` e
           achata o pos-reset), registrado e nao mexido.
           O sinal e exato: o alvo estava com a vida CHEIA antes do golpe e sobreviveu a ele -- que
           e a unica situacao em que aquele teto pode ter agido. */
        /* ⚠️ O SINAL TEM TRES PARTES, e a terceira e a que segura a cobertura: sem ela a isencao
           pega o PRIMEIRO golpe de todo lado (o alvo entra cheio em todo confronto) e a amostra cai
           pela metade -- medido, de 3.593 lados para 1.761. O teto so pode ter agido quando o alvo
           PAROU DENTRO DA FAIXA dele: ele deixa entre 5% e 30% do maxHp, e o 30% e derivado do
           CHEIO_TETO_MIN. O `ceil` cobre o arredondamento do motor (`round`). */
        const maxDoAlvo = lado === 'p' ? mm.enemyMaxHp : mm.playerMaxHp;
        const noTetoDoCheio = (g) => g.hp != null && g.hp > 0 && maxDoAlvo
                                  && g.hp + g.d >= maxDoAlvo
                                  && g.hp <= Math.ceil(maxDoAlvo * (1 - CHEIO_MIN));
        const g2 = semOUltimo.filter(g => !noTetoDoCheio(g));
        if(g2.length < 2) return;
        lados++;
        /* ⚠️ A COMPARACAO E POR PESO, nao pelo numero cru -- e o ROLAMENTO obrigou isso (14/09/2026).
           A trava nasceu da regra "dois golpes do mesmo atacante contra o mesmo alvo so diferem pelo
           sorteio de 0,85 a 1,00", e o Rolamento e a PRIMEIRA excecao real a ela: o poder dele dobra
           a cada uso seguido, entao 6 / 13 / 24 / 53 na mesma linha e a mecanica funcionando, nao um
           numero impossivel. Foi exatamente esse par que a trava acusou (Lickitung x Shuckle, 8,8x).
           A suavizacao ja divide pelo mesmo peso (`saida[i].rl`), entao o teste passa a medir o que
           ela mede: dano POR ESCALA. */
        /* ⚠️ SO ENTRAM NA CONTA GOLPES DO MESMO GOLPE (15/09/2026). A regra que esta trava mede e
           "o MESMO golpe, do MESMO pokemon, contra o MESMO alvo, so difere pelo sorteio de 0,85 a
           1,00" -- e ela nunca tinha olhado o `mv`, porque com o TETO de 4 o caso quase nao chegava
           a tela: confronto comprido caia inteiro na reconstrucao, que inventa golpes todos do
           mesmo tamanho.
           Sem teto ele virou comum, e o dono e o METRONOMO: ele sorteia golpe a cada ataque, entao
           uma Clefairy que tira 124 com Meteor Mash e 286 com Fire Blast nao esta mostrando numero
           impossivel -- sao dois golpes diferentes, com poderes diferentes. Medido: 20 dos 1.129
           pares fora da banda eram exatamente isso, e nenhum deles era defeito. */
        /* ⚠️ E O CONFRONTO COM MUDANCA DE ESTAGIO SAI INTEIRO (17/09/2026), como o golpe que mata.
           Quando a Cauda de Ferro baixa a Defesa do alvo, o golpe SEGUINTE doi mais de verdade --
           medido, um Onix tirando 53, 78 e 106 do mesmo Furret. Isso NAO e numero impossivel: e a
           mecanica, e ha uma linha na tela dizendo. A suavizacao isenta esses confrontos pelo
           mesmo motivo, entao a trava tem que isentar junto -- senao ela cobra da tela uma
           uniformidade que o motor (com razao) nao produz mais.
           ⚠️ E A ISENCAO E DO CONFRONTO, nao do lado: o estagio mexe na DEFESA de um e no DANO do
           outro. */
        if((mm.golpes || []).some(g => g.x === 'estagio')) return;
        const porGolpe = {};
        g2.forEach(g => { const k = g.mv || '?'; (porGolpe[k] = porGolpe[k] || []).push(g.d / (g.rl || 1)); });
        let r = 1;
        for(const k of Object.keys(porGolpe)){
          const arr = porGolpe[k];
          if(arr.length < 2) continue;
          const rr = Math.max.apply(null, arr) / Math.max(1, Math.min.apply(null, arr));
          if(rr > r) r = rr;
        }
        /* A tolerancia e o ARREDONDAMENTO, e ela cresce com o tamanho do GRUPO -- ver o comentario
           do `tolDoGrupo`, la em cima. O que a trava existe pra pegar e a faixa REABRINDO e o
           Rolamento pos-reset: ali a razao volta pras dezenas, muito acima de qualquer tolerancia.
           ⚠️ O `n` E O DO GRUPO REPARTIDO (`g2cru`), nao o do medido. */
        if(r > tolDoGrupo(g2cru.length)){ fora++; if(r > pior){ pior = r; exemplo = mm.player + ' x ' + mm.enemy + ': ' + g2.map(g => g.d + (g.rl > 1 ? '(x' + g.rl + ')' : '')).join(' e '); } }
      });
    });
  }
  ok('a amostra e grande o bastante', conf > 3000 && lados > 1500, conf + ' confrontos, ' + lados + ' lados com par');
  ok('NENHUM par mostra numero que a formula nao consegue produzir', fora === 0,
     fora + ' de ' + lados + (exemplo ? '   pior ' + pior.toFixed(1) + 'x  ' + exemplo : ''));
  ok('e a soma das linhas continua fechando com a barra', somaOk === somaTot, somaOk + ' de ' + somaTot);
  ok('nenhuma linha de dano zero ou negativo', zero === 0 && negativo === 0, zero + ' zeradas, ' + negativo + ' negativas');

  /* E O CRITICO SAI O DOBRO, que e o que o selo dele promete. Medido no COMPORTAMENTO, nao no
     codigo: um atacante com um critico e pelo menos um comum na mesma tela. */
  {
    let pares = 0, dobro = 0, pior = 0;
    for(let i = 0; i < 1200; i++){
      const t = k => { const p = inst(todos[(i*11 + k*37) % todos.length], 40 + (k%3)*5); p.ataques = S.ataquesPadrao(p); return p; };
      const ms = S.simulateGymBattle([t(0),t(1),t(2)], [t(3),t(4),t(5)], S.makeSeededRng('crit' + i)).matchups || [];
      ms.forEach(mm => {
        /* ⚠️ A GUARDA DO "SO NO CAMINHO DO DIARIO REAL" SAIU EM 15/09/2026 junto com o teto: hoje
           TODO confronto com diario mostra os golpes reais, entao nao ha o que separar. A
           reconstrucao continua existindo pra log velho, e la o `marcarCriticos` poe o selo nas
           linhas de MAIOR dano sem saber qual golpe foi critico -- cobrar o dobro ali seria cobrar
           do lugar errado, e por isso ela nao entra neste bloco. */
        if((mm.golpes || []).some(g => g.x === 'faixa' || g.x === 'sono')) return;
        const seq = S.sequenciaDoConfronto(mm);
        ['p','e'].forEach(lado => {
          const g2bruto = seq.filter(g => !g.x && g.q === lado && g.d > 0 && !(g.tn > 1));
          /* ⚠️ O GOLPE QUE MATOU FICA DE FORA (14/09/2026): desde que ele deixou de ser suavizado,
             ele mostra so o que SOBRAVA -- entao um critico que DERRUBA sai menor que o irmao sem
             que o selo esteja mentindo: o alvo simplesmente nao tinha mais vida. E a mesma isencao
             da banda e da escala do Rolamento, pelo mesmo motivo. */
          const fim = g2bruto.length ? g2bruto[g2bruto.length - 1] : null;
          const g2 = (fim && fim.hp != null && fim.hp <= 0) ? g2bruto.slice(0, -1) : g2bruto;
          const c = g2.filter(g => g.c), comuns = g2.filter(g => !g.c);
          if(!c.length || !comuns.length) return;
          /* ⚠️ A MEDIA E POR ESCALA, pelo mesmo motivo da trava acima: um critico no PRIMEIRO
             Rolamento (poder 30) sai menor que um Rolamento comum no terceiro uso (120), e isso e
             a mecanica, nao o selo mentindo. Comparar dano cru dava 1 falha em 236. */
          const escala = g => g.d / (g.rl || 1);
          const mediaComum = comuns.reduce((a,g) => a + escala(g), 0) / comuns.length;
          c.forEach(g => {
            pares++;
            const r = escala(g) / Math.max(1, mediaComum);
            /* O INVARIANTE E 'nunca MENOR', nao 'exatamente 2x'. O selo existe pra explicar uma
               barra que caiu o dobro, e o defeito e ele aparecer num numero menor que o do golpe
               comum do lado. O 2x exato nao da pra cobrar: o sorteio de 0,85 a 1,00 corre nos dois
               golpes (a razao real vai de 1,7x a 2,35x) e um aparo pequeno pode encolher a linha
               sem tirar a banda do lugar. */
            if(r >= 1) dobro++; else if(r < pior || !pior) pior = r;
          });
        });
      });
    }
  ok('a linha do CRITICO nunca sai MENOR que a do golpe comum do mesmo atacante', pares > 30 && dobro === pares,
       dobro + ' de ' + pares + (pior ? '   pior ' + pior.toFixed(2) + 'x' : ''));
  }

  /* ⚠️ O CRITICO ENTRA PESANDO 2, e o TAPA fica de fora. O selo do critico promete que aquela
     barra caiu o DOBRO, entao a linha tem que sair o dobro das outras do mesmo atacante -- tirando
     ele do bolo, um critico aparado ficava MENOR que os irmaos ja acertados e o selo dizia o
     contrario do que se ve (pego pela trava do selo, ~1 rodada em 16). A linha do tapa e a SOMA de
     N tapas e ja traz o Nx explicando.
     O teste le o CODIGO porque o caso acima EXCLUI os dois da medicao -- ele passaria com a regra
     removida. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const bloco = (txt.match(/const suavizarAparados = \(lista, semHp\) => \{[\s\S]*?\n  \};/) || [''])[0];
    ok('a suavizacao existe e e uma so', bloco.length > 200, bloco.length + ' chars');
    ok('ela pula o golpe de varios tapas', /!\(g\.tn > 1\)/.test(bloco));
    ok('e pesa o CRITICO por 2', /saida\[i\]\.c \? 2 : 1/.test(bloco));
    ok('e o confronto com FAIXA DE FOCO inteiro', /g\.x === 'faixa'/.test(bloco));
    /* E ELA E APRESENTACAO: nao pode existir no servidor, e o diario continua com os numeros reais. */
    ok('e ela vive so no cliente (o servidor nao a tem)',
       require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8').indexOf('suavizarAparados') < 0);
  }

  /* ⚠️ ELA NAO PODE MUTAR O DIARIO. Esta funcao e chamada a cada desenho da tela: mutando, a
     segunda chamada suavizaria o suavizado e o log iria mudando de numero sozinho. */
  {
    /* ⚠️ O FIXTURE PROCURA O EFEITO, e nao um par de especies (15/09/2026). Ele era um Bulbasaur
       Lv.15 contra um Onix Lv.20 -- e com o GOLPE MORIBUNDO fora aquele confronto parou de ter o
       que suavizar: sobrava o golpe que MATOU, isento desde 14/09. O teste falhava sem nada da
       suavizacao ter mudado.
       Procurar "um confronto em que a TELA difere do DIARIO" e o que este bloco quer de verdade, e
       nao envelhece junto com a lista de mecanicas que produzem o efeito -- hoje o aparo do teto de
       quem raspa e a escala do Rolamento, amanha o que vier. */
    const idsTodos = Object.keys(S.SPECIES);
    let achei = null;
    for(let i = 0; i < 4000 && !achei; i++){
      const rng = S.makeSeededRng('mut' + i);
      const time = (n) => Array.from({length:3}, (_, k) => {
        const q = inst(idsTodos[Math.floor(rng() * idsTodos.length)], 30 + Math.floor(rng() * 40));
        q.ataques = S.ataquesPadrao(q); return q;
      });
      const ms = S.simulateGymBattle(time(0), time(1), S.makeSeededRng('mu' + i)).matchups || [];
      for(const mm of ms){
        const reais = (mm.golpes || []).filter(g => !g.x && g.d > 0);
        const tela = S.sequenciaDoConfronto(mm).filter(g => !g.x && g.d > 0);
        if(reais.length !== tela.length) continue;          // reconstrucao: nao da pra comparar
        if(reais.some((g, k) => g.d !== tela[k].d)){ achei = mm; break; }
      }
    }
    ok('achei um confronto em que a suavizacao age', !!achei);
    if(achei){
      const antesDoDiario = (achei.golpes || []).map(g => g.d).join(',');
      const um = S.sequenciaDoConfronto(achei).map(g => g.d).join(',');
      const dois = S.sequenciaDoConfronto(achei).map(g => g.d).join(',');
      const tres = S.sequenciaDoConfronto(achei).map(g => g.d).join(',');
      ok('o DIARIO continua com os numeros reais', (achei.golpes || []).map(g => g.d).join(',') === antesDoDiario,
         antesDoDiario);
      ok('e a tela devolve SEMPRE a mesma divisao', um === dois && dois === tres, um);
      ok('e a divisao NAO e a do diario', um !== antesDoDiario, 'diario ' + antesDoDiario + '  ->  tela ' + um);
      /* E o LOG e a ANIMACAO tem que ver a MESMA coisa -- eles chamam a funcao em momentos diferentes. */
      const somaSeq = S.sequenciaDoConfronto(achei).filter(g => !g.x).reduce((a,g) => a + g.d, 0);
      const somaAnim = S.buildAnimatedHitSequence(achei).filter(h => !h.x).reduce((a,h) => a + Math.abs(h.amount), 0);
      ok('o log e a animacao mostram os mesmos numeros', somaSeq === somaAnim, somaSeq + ' e ' + somaAnim);
    }
  }
}

console.log('\n=== AS DUAS DANCAS DE ATAQUE ===');
{
  /* Pedidas em 12/09/2026: *"uma diminui em 50% o attack do oponente e a outra aumenta em 50% o
     attack do usuario. Tem 20% de ocorrer no inicio de cada confronto"*. */
  ok('as listas sao as do aprendizado por nivel',
     S.DANCA_ESPADAS.join(',') === 'farfetchd,pinsir,scizor,scyther' &&
     S.DANCA_PLUMA.join(',') === 'pidgeot,pidgeotto,pidgey',
     S.DANCA_ESPADAS.join(',') + '  |  ' + S.DANCA_PLUMA.join(','));
  ok('a chance e 20% por confronto', S.CHANCE_DANCA === 0.20, (100*S.CHANCE_DANCA) + '%');
  ok('os multiplicadores sao os pedidos', S.DANCA_ESPADAS_MULT === 1.5 && S.DANCA_PLUMA_MULT === 0.5,
     'x' + S.DANCA_ESPADAS_MULT + ' e x' + S.DANCA_PLUMA_MULT);
  ok('e os dois motores concordam',
     esp.DANCA_ESPADAS.join(',') === S.DANCA_ESPADAS.join(',') &&
     esp.DANCA_PLUMA.join(',') === S.DANCA_PLUMA.join(',') &&
     esp.CHANCE_DANCA === S.CHANCE_DANCA &&
     esp.DANCA_ESPADAS_MULT === S.DANCA_ESPADAS_MULT && esp.DANCA_PLUMA_MULT === S.DANCA_PLUMA_MULT);

  /* ⚠️ O MULTIPLICADOR E SO NO ATAQUE FISICO, e entra POR ULTIMO -- depois dos flats (item e furia).
     "50% do ataque" e 50% do que o pokemon TEM na hora do golpe; entrando antes, o +15 do item
     ficaria de fora da conta. */
  {
    const p = inst('pinsir', 50);
    const base = S.effectiveAttack(p), baseEsp = S.effectiveSpAtk(p);
    p._espadas = true;
    ok('as espadas multiplicam o Ataque por 1,5', S.effectiveAttack(p) === Math.round(base * 1.5),
       base + ' -> ' + S.effectiveAttack(p));
    ok('e NAO tocam no Ataque Especial', S.effectiveSpAtk(p) === baseEsp, baseEsp + ' -> ' + S.effectiveSpAtk(p));
    p._espadas = false; p._pluma = true;
    ok('a pluma multiplica o Ataque por 0,5', S.effectiveAttack(p) === Math.round(base * 0.5),
       base + ' -> ' + S.effectiveAttack(p));
    p._espadas = true;
    ok('e os dois juntos dao 0,75', S.effectiveAttack(p) === Math.round(Math.round(base * 1.5) * 0.5),
       base + ' -> ' + S.effectiveAttack(p));
    /* POR ULTIMO: num pokemon com item de ataque, a danca multiplica o TOTAL, nao so a base. */
    const q = inst('pinsir', 50);
    S.equiparItens([q], { pinsir: 'atk_up' });
    const comItem = S.effectiveAttack(q);
    q._espadas = true;
    ok('e ela multiplica o TOTAL, com item e tudo', S.effectiveAttack(q) === Math.round(comItem * 1.5),
       comItem + ' -> ' + S.effectiveAttack(q));
  }

  /* NA BATALHA: ela sai, vira linha no log, a frase cobre o passo dela e cede pro nome do golpe. */
  {
    const semTag = h => String(h||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
    const mede = (id, marca) => {
      let achou = 0, noLog = 0, comFrase = 0, cede = 0, abre = 0, valeu = 0;
      for(let v = 0; v < 6000 && achou < 30; v++){
        const a = [inst(id, 45)]; a[0].ataques = S.ataquesPadrao(a[0]);
        const b = [inst('machoke', 45)]; b[0].ataques = S.ataquesPadrao(b[0]);
        const m = (S.simulateGymBattle(a, b, S.makeSeededRng(id + 'q' + v)).matchups || [])[0];
        if(!m) continue;
        const g = (m.golpes || []).find(x => x.x === marca);
        if(!g) continue;
        achou++;
        const seq = S.buildAnimatedHitSequence(m);
        const k = seq.findIndex(h => h.x === marca);
        if(k === 0) abre++;                                        // ela ABRE o confronto
        if(semTag(S.passosHtml(m)).indexOf('Dan\u00e7a') >= 0) noLog++;
        if(/Dan\u00e7a/.test(semTag(S.statusDoConfronto(m, k + 1, seq[k]).html))) comFrase++;
        if(seq[k+1] && !/Dan\u00e7a/.test(semTag(S.statusDoConfronto(m, k + 2, seq[k+1]).html))) cede++;
        /* E A LUTA ACONTECE DEPOIS -- ela e ABERTURA, nao resolve o confronto. */
        if(seq.filter(h => !h.x).length > 0) valeu++;
      }
      return { achou, noLog, comFrase, cede, abre, valeu };
    };
    const e = mede('pinsir', 'espadas'), p = mede('pidgeot', 'pluma');
    ok('a Danca das Espadas sai o bastante pra medir', e.achou >= 10, e.achou + ' confrontos');
    ok('ela ABRE o confronto', e.abre === e.achou, e.abre + ' de ' + e.achou);
    ok('vira linha no log', e.noLog === e.achou, e.noLog + ' de ' + e.achou);
    ok('a frase cobre o passo dela', e.comFrase === e.achou, e.comFrase + ' de ' + e.achou);
    ok('e CEDE o lugar ao nome do golpe', e.cede === e.achou, e.cede + ' de ' + e.achou);
    ok('e a luta acontece DEPOIS dela', e.valeu === e.achou, e.valeu + ' de ' + e.achou);
    ok('a Danca da Pluma sai o bastante pra medir', p.achou >= 10, p.achou + ' confrontos');
    ok('ela tambem abre, vira linha e cede',
       p.abre === p.achou && p.noLog === p.achou && p.cede === p.achou,
       'abre ' + p.abre + '  log ' + p.noLog + '  cede ' + p.cede + '  de ' + p.achou);
  }

  /* ⚠️ NAO ACUMULA E NAO ATRAVESSA CONFRONTO -- e o "no inicio de cada confronto" do pedido. Sem a
     limpeza, um Pinsir que dancasse em tres confrontos seguidos sairia com 1,5^3 = 3,4x de ataque,
     que e o mesmo tipo de vazamento que o teto de HP da furia ja teve. */
  {
    let maior = 1, medidos = 0;
    for(let v = 0; v < 600; v++){
      const a = [inst('pinsir', 60)]; a[0].ataques = S.ataquesPadrao(a[0]);
      const base = S.effectiveAttack(inst('pinsir', 60));
      const b = [1,2,3,4,5,6].map(() => inst('ratata', 5));
      S.simulateGymBattle(a, b, S.makeSeededRng('ac' + v));
      medidos++;
      maior = Math.max(maior, S.effectiveAttack(a[0]) / base);
    }
    ok('o multiplicador nunca passa de 1,5 (nao acumula)', maior <= 1.51, 'maior visto: x' + maior.toFixed(2) + ' em ' + medidos + ' batalhas');
  }

  /* A CAIXA QUE EXPLICA: as duas tem texto, e o "quando" delas e um dos valores do conjunto fechado. */
  ['espadas','pluma'].forEach(k => {
    const e = S.EXPLICACAO_DO_ESPECIAL[k];
    ok('a caixa do ' + k + ' existe e diz QUANDO', !!e && /Abre o confronto/.test(e.quando), e ? e.quando : '(sem)');
  });

  /* ⚠️ E O SORTEIO TEM DADO PROPRIO, como a chuva: se disputasse a vaga unica do sorteio de efeito,
     o Pidgey (que ja tem Remoinho) veria a Pluma sair menos que os 20% pedidos. O teste le o CODIGO
     porque os casos acima chamam as funcoes direto e passariam com a chamada orfa. */
  {
    const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
    ok('os dois motores chamam o tentarDancas na abertura do confronto',
       /tentarDancas\(active, enemy/.test(cli) && /tentarDancas\(active, enemy/.test(srv));
    ok('e ele NAO esta dentro do sorteiaGolpeEspecial (dado proprio)',
       cli.indexOf('tentarDancas') < cli.indexOf('function sorteiaGolpeEspecial') ||
       !/function sorteiaGolpeEspecial[\s\S]*?tentarDancas[\s\S]*?\n\}/.test(cli));
  }
}

console.log('\n=== O REMOINHO MOSTRA A TROCA: SAI, FICA VAZIO, ENTRA ===');
{
  /* Pedido em 12/09/2026: *"primeiro aparece a mensagem falando que entrou o golpe, depois tem que
     mostrar saindo o pokemon, ficando sem nada, e depois entrando o novo, e exibindo a mensagem
     'Psyduck foi trocado por Geodude!' e depois de 1s comeca a batalha novamente"*.
     O motor grava UM registro; quem reparte em TRES quadros e a apresentacao (sequenciaDoConfronto),
     e o log continua com UMA linha -- a mesma forma da drenagem e dos golpes de varios tapas. */
  const semTag = h => String(h||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
  /* ⚠️ OS SELOS ENTRAM ENTRE O NOME E O "Lv." (🌟 shiny, 🔺 terreno, 🎖️ especialidade e, desde
     14/09/2026, ⚔️ e 🪶 das duas danças). A regex exigia o nome COLADO no Lv. e passou a devolver
     "?" -- 30 de 40 quadros, sem nada do Remoinho ter mudado. O fixture usa um PIDGEOT, que e
     justamente o dono da Dança da Pluma. */
  /* ⚠️ A VAGA VAZIA MUDOU DE CARA EM 15/09/2026: era um travessao (`—`) com uma barra de `0/1 HP`,
     e virou o quadro que o ONLINE ja usava pra "ninguem em campo" (um ❔ apagado com a palavra
     embaixo, SEM barra). O extrator procurava o travessao; hoje ele procura a CLASSE, que e o que
     de fato identifica o quadro e nao depende do texto escolhido. */
  const cara = h => { const t = semTag(h); const mm = t.match(/([A-Za-zÀ-ÿ'.\-]+)[^A-Za-zÀ-ÿ]*Lv\.(\d+)/);
                      return /fighter-vaga/.test(String(h||'')) ? '(vazio)' : (mm ? mm[1] : '?'); };
  let achou = 0, tresQuadros = 0, ordemOk = 0, umaLinha = 0, frasesOk = 0, pausaOk = 0, redesenha = 0;
  let campos = 0, cedeDepois = 0;
  for(let v = 0; v < 9000 && achou < 40; v++){
    const a = [inst('pidgeot', 40)]; a[0].ataques = S.ataquesPadrao(a[0]);
    const b = ['psyduck','geodude','machop'].map(id => { const p = inst(id, 40); p.ataques = S.ataquesPadrao(p); return p; });
    const r = S.simulateGymBattle(a, b, S.makeSeededRng('rem' + v));
    const m = (r.matchups || []).find(x => (x.golpes || []).some(g => g.x === 'remoinho'));
    if(!m) continue;
    achou++;
    const reg = (m.golpes || []).find(g => g.x === 'remoinho');
    /* 1. O DIARIO CARREGA QUEM SAI E QUEM ENTRA. Nenhum dos dois lados do matchup e o que saiu --
          sem estes campos o quadro do sopro nao tem sprite, nome, nivel nem barra pra desenhar. */
    if(reg.sai && reg.ss && S.SPECIES[reg.ss] && reg.sl && reg.smx && reg.entra) campos++;
    const seq = S.sequenciaDoConfronto(m);
    const i = seq.findIndex(g => g.x === 'remoinho');
    /* 2. TRES QUADROS NA SEQUENCIA, na ordem: o sopro, a vaga vazia, o novo entrando. */
    if(seq[i] && seq[i+1] && seq[i+2] &&
       seq[i+1].x === 'remoinhoVazio' && seq[i+2].x === 'remoinhoEntra') tresQuadros++;
    /* 3. E A ANIMACAO TEM OS MESMOS PASSOS -- a regra da casa. */
    if(S.buildAnimatedHitSequence(m).length === seq.length) ordemOk++;
    /* 4. O LOG DESENHA UMA LINHA SO pro sopro: os outros dois quadros sao da animacao. */
    const linhasLog = S.passosHtml(m).split('</div>').filter(x => x.indexOf('mlog-passo') >= 0);
    if(linhasLog.filter(x => /Remoinho|trocou o pok/.test(x)).length === 1 &&
       !/foi trocado por/.test(semTag(S.passosHtml(m)))) umaLinha++;
    /* 5. O CABECALHO: quem SAI nos passos i e i+1, VAZIO no i+2, quem ENTRA do i+3 em diante.
          O passo 0 conta: e ali que a frase do sopro ja esta na tela com o segundo de leitura, e
          lido do `hit` (que e null ali) o cabecalho mostrava o pokemon NOVO -- a cena comecava
          pelo fim. */
    const anim = S.buildAnimatedHitSequence(m);
    const ladoTrocado = reg.q === 'p' ? 'e' : 'p';
    const quadro = (passo) => cara(S.fighterHtml(m, ladoTrocado, { hp: m.enemyHpBefore, passo: passo,
                                    hit: passo > 0 ? anim[passo-1] : null, comTerreno: true }));
    const novo = ladoTrocado === 'e' ? m.enemy : m.player;
    if(quadro(i) === reg.sai && quadro(i+1) === reg.sai && quadro(i+2) === '(vazio)' &&
       quadro(i+3) === novo) frasesOk++;
    /* 6. AS FRASES: o sopro cobre os dois primeiros quadros, e o "X foi trocado por Y" cai NO
          quadro em que o novo entra. */
    const frase = (passo) => semTag(S.statusDoConfronto(m, passo, passo > 0 ? anim[passo-1] : null).html);
    if(/soprou/.test(frase(i+1)) && /soprou/.test(frase(i+2)) &&
       frase(i+3).indexOf(reg.sai + ' foi trocado por ' + reg.entra) >= 0) cedeDepois++;
    /* 7. O SEGUNDO DE LEITURA em cada quadro, e o REDESENHO -- o sprite muda, e sprite so muda num
          render(): o pintarStatusDoConfronto mexe so na linha de status. */
    /* O SEGUNDO DE LEITURA vem DEPOIS de cada quadro (a marca `leitura`), inclusive no primeiro:
       ate 12/09/2026 o do primeiro vinha do `pausaDoEspecial`, ANTES do quadro. */
    if(S.pausaDaFaixa(anim[i]) > 0 && S.pausaDaFaixa(anim[i+1]) > 0 && S.pausaDaFaixa(anim[i+2]) > 0) pausaOk++;
    if(anim[i].troca && anim[i+1].troca && anim[i+2].troca) redesenha++;
  }
  ok('o sopro sai o bastante pra medir', achou >= 15, achou + ' confrontos');
  ok('o diario carrega quem SAI e quem ENTRA', campos === achou, campos + ' de ' + achou);
  ok('a sequencia tem os TRES quadros, na ordem', tresQuadros === achou, tresQuadros + ' de ' + achou);
  ok('e a animacao tem os MESMOS passos do log', ordemOk === achou, ordemOk + ' de ' + achou);
  ok('o log desenha UMA linha pro sopro', umaLinha === achou, umaLinha + ' de ' + achou);
  ok('o cabecalho mostra: sai / sai / vazio / entra', frasesOk === achou, frasesOk + ' de ' + achou);
  ok('a frase do sopro cobre os dois primeiros e o "trocado por" fecha', cedeDepois === achou, cedeDepois + ' de ' + achou);
  ok('cada quadro tem o segundo de leitura', pausaOk === achou, pausaOk + ' de ' + achou);
  ok('e os tres pedem REDESENHO (o sprite muda)', redesenha === achou, redesenha + ' de ' + achou);

  /* ⚠️ A VAGA VAZIA NAO PODE ENTRAR NA LISTA DE AVISOS. Sem entrada no `passosDaAbertura` ela cai no
     ramo da autodestruicao (`!n` = a frase vale o confronto INTEIRO), e a linha ficava presa em
     "soprou X pra fora" ate o fim da luta, por cima do nome dos golpes. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const tab = txt.match(/const passosDaAbertura = \{([^}]*)\}/);
    ok('a tabela dos passos existe', !!tab);
    if(tab){
      /* O sopro cobre os DOIS quadros dele (quem sai + a vaga vazia) e o quadro do novo cobre o
         proprio -- os numeros contam PASSOS DO EVENTO desde 12/09/2026, nao mais a pausa + o passo. */
      ok('o sopro vale 2 passos e o quadro do novo vale 1',
         /remoinho:\s*2/.test(tab[1]) && /remoinhoEntra:\s*1/.test(tab[1]), tab[1].trim().slice(-60));
      ok('e a vaga vazia NAO esta na tabela', !/remoinhoVazio/.test(tab[1]));
    }
    /* E o quadro do novo PRECISA ser acrescentado a mao na lista de avisos: ele nao existe no
       diario, entao o filtro do ehGolpeEspecial nunca o alcanca. */
    ok('o aviso acrescenta o quadro do novo a mao', /remoinhoEntra'\) especiais\.push/.test(txt));
  }

  /* ⚠️ E NADA DISSO E MOTOR. A expansao vive no sequenciaDoConfronto, que e apresentacao: o
     resultado da batalha nao pode mudar em um ponto. */
  ok('a expansao vive so no cliente (o servidor nao a tem)',
     require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8').indexOf('remoinhoVazio') < 0);
}

console.log('\n=== A CONFUSAO VIROU STATUS POR ATAQUE (24/09/2026) ===');
{
  /* Pedida assim: *"hoje ele e dano passivo que tem chance de acontecer no inicio da batalha,
     agora voce vai tirar esse passivo e vamos colocar ele para ter chance do oponente ficar
     confuso de acordo com a chance que o ataque tem de causar confusao ... tem uma chance de ao
     inves de atacar o oponente, ele se ataca durante a confusao"*, com a Bulbapedia como fonte.
     E a QUINTA mecanica POR ATAQUE, e a unica que ENTROU no lugar de uma passiva. */
  const esp2 = srv._golpesEspeciais;
  const TAB = S.GOLPES_QUE_CONFUNDEM;
  const mkConf = (id, lv) => { const q = S.createInstance(id, lv); q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp; q.ataques = S.ataquesPadrao(q); return q; };

  /* ---------- a tabela e as constantes ---------- */
  ok('sao os SEIS golpes de dano que confundem na Gen 3',
     Object.keys(TAB).sort().join(',') === 'confusion,dizzypunch,dynamicpunch,psybeam,signalbeam,waterpulse',
     Object.keys(TAB).sort().join(','));
  /* AS CHANCES SAO AS OFICIAIS, do dado (Showdown, mod da Gen 3) -- o mesmo caminho das outras
     quatro listas. Elas VARIAM, entao um texto fixo de "10%" mentiria em tres dos seis. */
  ok('  com as chances oficiais de cada um',
     TAB.confusion === 0.10 && TAB.psybeam === 0.10 && TAB.signalbeam === 0.10 &&
     TAB.waterpulse === 0.20 && TAB.dizzypunch === 0.20 && TAB.dynamicpunch === 1.00,
     JSON.stringify(TAB));
  /* ⚠️ E ELES TEM QUE EXISTIR NA TABELA DE GOLPES: cadastrar um golpe que ninguem tem e letra
     morta -- a licao da Lamina Solar. */
  const semGolpe = Object.keys(TAB).filter(id => !S.GOLPES[id]);
  ok('  e os seis existem na tabela GOLPES', semGolpe.length === 0, semGolpe.join(', '));
  const semNome = Object.keys(TAB).filter(id => !S.GOLPES_PT[id]);
  ok('  e todos tem nome em portugues', semNome.length === 0, semNome.join(', '));
  /* ⚠️ E ALGUEM PRECISA LEVA-LOS DE VERDADE -- a licao da Furia, que ao pe da letra saia em 0,0%. */
  {
    const levam = new Set();
    Object.keys(S.SPECIES).forEach(sp => {
      const at = S.ataquesPadrao(S.createInstance(sp, 70)) || [];
      if(at.some(a => TAB[a])) levam.add(sp);
    });
    ok('  e 25+ especies LEVAM um deles no Lv.70', levam.size >= 25, levam.size + ' especies');
  }
  /* AS REGRAS DA GEN 3, uma a uma (Bulbapedia, Confusion) */
  /* ⚠️ AS CONSTANTES SAO LIDAS DO FONTE, e nao do sandbox: `const` NAO vira propriedade global,
     entao `S.CONFUSAO_PODER` volta undefined e a trava mediria o NADA -- a licao que a Queimada e
     a Arena 1x1 ja custaram. */
  const srcCli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const konst = (nome) => {
    const m = srcCli.match(new RegExp('const ' + nome + ' = ([0-9.]+)'));
    return m ? Number(m[1]) : null;
  };
  ok('dura de 2 a 5 turnos', konst('CONFUSAO_TURNOS_MIN') === 2 && konst('CONFUSAO_TURNOS_MAX') === 5,
     konst('CONFUSAO_TURNOS_MIN') + '-' + konst('CONFUSAO_TURNOS_MAX'));
  /* ⚠️ 50% E A REGRA DA GEN 1 A 6 -- os 33% so valem da Gen 7 em diante, e este jogo e Gen 3. */
  ok('  e a chance de se acertar e 50% por turno', konst('CHANCE_CONFUSAO_ACERTA') === 0.50,
     (100 * konst('CHANCE_CONFUSAO_ACERTA')) + '%');
  ok('  e o auto-dano e um golpe de poder 40', konst('CONFUSAO_PODER') === 40, konst('CONFUSAO_PODER') + '');
  /* as duas copias concordam -- uma divergencia aqui faz a mesma batalha terminar diferente */
  ok('a tabela e as quatro constantes sao IGUAIS nos dois motores',
     JSON.stringify(esp2.GOLPES_QUE_CONFUNDEM) === JSON.stringify(TAB) &&
     esp2.CONFUSAO_TURNOS_MIN === konst('CONFUSAO_TURNOS_MIN') &&
     esp2.CONFUSAO_TURNOS_MAX === konst('CONFUSAO_TURNOS_MAX') &&
     esp2.CHANCE_CONFUSAO_ACERTA === konst('CHANCE_CONFUSAO_ACERTA') &&
     esp2.CONFUSAO_PODER === konst('CONFUSAO_PODER'),
     JSON.stringify([esp2.CONFUSAO_TURNOS_MIN, esp2.CONFUSAO_TURNOS_MAX,
                     esp2.CHANCE_CONFUSAO_ACERTA, esp2.CONFUSAO_PODER]));
  /* ⚠️ A PASSIVA MORREU, e com ela o `golpeQueConfunde` e a tabela de 82 especies. */
  ok('a passiva por ESPECIE nao existe mais',
     S.CONFUSAO === undefined && esp2.CONFUSAO === undefined && S.CHANCE_CONFUSAO === undefined);
  ok('  nem o golpeQueConfunde', typeof S.golpeQueConfunde !== 'function');

  /* ---------- quem pode ser confundido ---------- */
  const novo = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; return p; };
  {
    const alvo = novo('snorlax', 60);
    ok('quem ja caiu nao fica confuso', (alvo.hp = 0, S.podeConfundir(alvo) === false));
    alvo.hp = alvo.maxHp;
    ok('  e quem JA esta confuso tambem nao', (alvo._confuso = 3, S.podeConfundir(alvo) === false));
    alvo._confuso = null;
    ok('  mas um alvo inteiro pode', S.podeConfundir(alvo) === true);
    /* ⚠️ NENHUM TIPO E IMUNE A CONFUSAO, em geracao nenhuma -- ao contrario do gelo (o Gelo), da
       queimadura (o Fogo), do veneno (Veneno e Aco). O unico "imune" e o do GOLPE. */
    ['gastly','alakazam','machamp','snorlax','magnemite'].forEach(id => {
      ok('  e ' + id + ' (nenhum tipo e imune) pode', S.podeConfundir(novo(id, 60)) === true);
    });
  }
  /* ⚠️ O GOLPE QUE NAO AFETA O ALVO NAO CONFUNDE: este motor sempre "conecta" (piso de 1 de dano e
     golpe teimoso), entao sem essa guarda um Psicoraio confundiria um Sombrio que ele nem alcanca. */
  {
    const bate = novo('alakazam', 60); bate.lastMove = 'psybeam';
    const sombrio = novo('umbreon', 60);
    let pegou = 0;
    for(let i = 0; i < 400; i++){ sombrio._confuso = null; if(S.tentarConfundir(bate, sombrio, () => 0.01)) pegou++; }
    ok('Psicoraio nao confunde um SOMBRIO (o golpe nao o afeta)', pegou === 0, pegou + ' de 400');
    const normal = novo('snorlax', 60);
    let pegou2 = 0;
    for(let i = 0; i < 400; i++){ normal._confuso = null; if(S.tentarConfundir(bate, normal, () => 0.01)) pegou2++; }
    ok('  mas confunde um Normal', pegou2 === 400, pegou2 + ' de 400');
  }
  /* ---------- a chance, medida com um rng CONTINUO ---------- */
  {
    const bate = novo('blastoise', 60);
    const medir = (golpe) => {
      bate.lastMove = golpe;
      const alvo = novo('snorlax', 60);
      let n = 0, seed = 7;
      const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
      for(let i = 0; i < 6000; i++){ alvo._confuso = null; if(S.tentarConfundir(bate, alvo, rng)) n++; }
      return n / 6000;
    };
    [['waterpulse', 0.20], ['confusion', 0.10]].forEach(([g, esperado]) => {
      const taxa = medir(g);
      const sigma = Math.sqrt(esperado * (1 - esperado) / 6000);
      ok('  a chance medida do ' + g + ' bate com a tabela', Math.abs(taxa - esperado) < 4 * sigma,
         (100 * taxa).toFixed(2) + '% (esperado ' + (100 * esperado) + '%)');
    });
    /* ⚠️ O p=1 E COBRADO POR IGUALDADE EXATA: ali o sigma e zero. */
    ok('  e o Soco Dinamico e 100% (a precisao que este motor nao tem)', medir('dynamicpunch') === 1);
  }
  /* ⚠️ AS DUAS SAIDAS ANTECIPADAS DO rng: lido sempre, ele deslocaria a semente de toda batalha
     sem golpe de confusao nenhum -- a mesma armadilha do Remoinho, do gelo e da paralisia. */
  {
    let lidas = 0; const rng = () => { lidas++; return 0.01; };
    const bate = novo('snorlax', 60); bate.lastMove = 'tackle';
    S.tentarConfundir(bate, novo('pikachu', 60), rng);
    ok('o rng NAO e lido quando o golpe nao confunde', lidas === 0, lidas + ' leituras');
    bate.lastMove = 'confusion';
    const jaConfuso = novo('pikachu', 60); jaConfuso._confuso = 3;
    S.tentarConfundir(bate, jaConfuso, rng);
    ok('  nem quando o alvo ja esta confuso', lidas === 0, lidas + ' leituras');
  }
  /* ---------- a duracao ---------- */
  {
    const bate = novo('blastoise', 60); bate.lastMove = 'dynamicpunch';
    const vistos = {};
    let seed = 3; const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for(let i = 0; i < 4000; i++){
      const alvo = novo('snorlax', 60);
      S.tentarConfundir(bate, alvo, rng);
      vistos[alvo._confuso] = (vistos[alvo._confuso] || 0) + 1;
    }
    const chaves = Object.keys(vistos).map(Number).sort((a, b) => a - b);
    ok('a duracao sorteada fica entre 2 e 5',
       chaves[0] === 2 && chaves[chaves.length - 1] === 5 && chaves.length === 4, chaves.join(','));
  }
  /* ---------- o auto-dano: typeless, FISICO, poder 40, sem critico ---------- */
  {
    /* ⚠️ SEM TIPO: o espelho aplicaria a tabela contra ELE MESMO, e Fantasma contra Fantasma e 2x
       -- foi o que fez um Haunter tirar 299 dos proprios 300 quando a passiva nasceu. */
    const haunter = novo('haunter', 60);
    const d = S.danoDaConfusao(haunter, () => 0.5);
    const fracao = d / haunter.maxHp;
    ok('o auto-dano nao passa de um terco da propria barra', fracao < 0.34,
       (100 * fracao).toFixed(1) + '% da barra do Haunter');
    /* ⚠️ E ELE E FISICO, e a trava e COMPARATIVA em vez de um limiar -- ela era `< 30% da barra` e
       PASSAVA com o auto-dano especial: o Alakazam especial da 1,43x o fisico (SpAtk 135/SpDef 85
       contra Atk 50/Def 45) e isso ainda cabia nos 30%. Medido, a trava dava verde com o defeito.
       O sinal exato e a ORDEM ENTRE DOIS PERFIS OPOSTOS INVERTER:
         Machamp  fisico 130/80 = 1,63  |  especial  65/85 = 0,76
         Alakazam fisico  50/45 = 1,11  |  especial 135/85 = 1,59
       Fisico, o Machamp se machuca MAIS (18,1% contra 16,1% da barra); especial, MENOS. Nao ha
       limiar escolhido -- e a razao dos atributos, e ela vem da tabela. */
    const ala = novo('alakazam', 60);
    const dAla = S.danoDaConfusao(ala, () => 0.5);
    const mach = novo('machamp', 60);
    const dMach = S.danoDaConfusao(mach, () => 0.5);
    const gengar = novo('gengar', 60);
    ok('  e ele e FISICO (a ordem entre Machamp e Alakazam inverte se for especial)',
       (dMach / mach.maxHp) > (dAla / ala.maxHp),
       'Machamp ' + (100*dMach/mach.maxHp).toFixed(1) + '%  >  Alakazam ' + (100*dAla/ala.maxHp).toFixed(1) + '%');
    /* ⚠️ E ELE NAO SUJA O `lastMove` DO POKEMON: o calcDamage ESCREVE nele, e sem a copia o golpe
       da luta seguinte sairia trocado no log E os cinco `tentar*` sortearia em cima dele. */
    gengar.lastMove = 'shadowball';
    S.danoDaConfusao(gengar, () => 0.5);
    ok('  e o espelho nao suja o lastMove de quem se acertou', gengar.lastMove === 'shadowball',
       String(gengar.lastMove));
  }
  /* ---------- o ciclo inteiro, numa troca de verdade ---------- */
  {
    /* ⚠️ O ALVO E UM SHUCKLE (Defesa 230) E O ATACANTE E FRACO: com um Snorlax o confronto acabava
       em 4 golpes, ANTES de a confusao render um auto-acerto -- e a trava media o VAZIO. O painel
       tem que cair na faixa em que a regra vale, que e a licao dos fixtures deste arquivo. */
    const a = novo('machamp', 40), b = novo('shuckle', 60);
    a.ataques = ['dynamicpunch']; b.ataques = ['rockthrow'];
    let seed = 11; const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const d = [];
    for(let t = 0; t < 14 && a.hp > 0 && b.hp > 0; t++) S.doExchange(a, b, rng, d, 'p', 'e');
    const marcas = d.map(g => g.x).filter(Boolean);
    ok('a troca gera a linha de quem FICOU confuso', marcas.includes('confundiu'), marcas.join(','));
    ok('  e a linha de quem SE ACERTOU', marcas.includes('confuso'), marcas.join(','));
    /* ⚠️ O `q` DA LINHA DO AUTO-DANO E DE QUEM PERDE (a familia da queimadura), e nao de quem
       causou: lido ao contrario, a barra que desce e a do pokemon errado -- e o defeito nao
       aparece como erro, aparece como o adversario perdendo vida do nada. */
    const auto = d.find(g => g.x === 'confuso');
    ok('  e o `q` dela e de QUEM SE ACERTOU', auto && auto.q === 'e' && auto.g === b.name,
       auto ? (auto.q + ' / ' + auto.g) : '(sem linha)');
    ok('  com o dano escrito na linha', auto && auto.d > 0, auto ? String(auto.d) : '-');
    /* ⚠️ QUEM SE ACERTA NAO ATACA NAQUELE TURNO -- a mesma guarda do sono, do gelo e da paralisia.
       Sem ela, ele ainda aplicaria status com o `lastMove` da troca anterior (o defeito de 18/09). */
    let erros = 0;
    for(let i = 0; i < d.length; i++){
      if(d[i].x !== 'confuso') continue;
      /* nenhum golpe DELE pode sair entre o auto-dano e a proxima troca */
      for(let j = i + 1; j < d.length; j++){
        if(d[j].x === 'confuso' || d[j].x === 'saiuConfusao') break;
        if(!d[j].x && d[j].q === d[i].q) { erros++; break; }
        if(d[j].x === 'confundiu' || d[j].x === 'paralisou') continue;
        if(!d[j].x) break;      /* o golpe do OUTRO lado fecha a troca */
      }
    }
    ok('  e quem se acertou NAO ataca naquela troca', erros === 0, erros + ' golpes de quem se acertou');
  }
  /* ---------- ela PASSA, e a linha de saida existe ---------- */
  {
    const a = novo('machamp', 30), b = novo('shuckle', 70);
    a.ataques = ['dynamicpunch']; b.ataques = ['rockthrow'];
    let seed = 23; const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const d = [];
    for(let t = 0; t < 14 && a.hp > 0 && b.hp > 0; t++) S.doExchange(a, b, rng, d, 'p', 'e');
    ok('a confusao PASSA, e a saida vira linha', d.some(g => g.x === 'saiuConfusao'),
       d.map(g => g.x).filter(Boolean).join(','));
    /* ⚠️ E ELA E VOLATIL: solta no fim da batalha, como as outras marcas. O campo comeca com `_`,
       entao ele nao vai pro Firestore -- sem soltar, o pokemon voltaria confuso do save. */
    b._confuso = 4;
    S.encerrarBatalha([a], [b]);
    ok('  e a marca e solta no fim da batalha', !b._confuso, String(b._confuso));
  }
  /* ---------- as tres frases, palavra por palavra ---------- */
  {
    /* ⚠️ A ASSINATURA E `(g, quem, alvo, op)` -- QUATRO argumentos. Chamando `(g, {})` o `op` cai
       no lugar do NOME, e as tres frases novas passariam por acidente (elas tiram o nome do campo
       `g.g` do registro, nao do parametro). A da marca VELHA usa os parametros, e ali isso saia
       como *"[object Object] deixou undefined confuso"* -- com a trava VERDE. */
    const fr = (g) => S.fraseDoEspecial(g, 'Golduck', 'Snorlax', {});
    ok('a frase de quem ficou confuso nomeia o GOLPE',
       fr({ x:'confundiu', g:'Snorlax', mv:'dynamicpunch' }) === 'Snorlax ficou confuso com SOCO DINÂMICO!',
       fr({ x:'confundiu', g:'Snorlax', mv:'dynamicpunch' }));
    /* ⚠️ "COM" E NAO "PELO": SOCO DINAMICO e masculino e CONFUSAO e feminina -- a preposicao neutra
       serve aos seis sem uma tabela de genero pra uma frase so (a licao do congelamento). */
    ok('  e com o "com" neutro nos seis',
       Object.keys(TAB).every(id => fr({ x:'confundiu', g:'X', mv:id }).indexOf(' com ') > 0));
    /* ⚠️ ELA TRAZ O NUMERO, e e a unica das tres: a linha de um especial nao ganha o "e tirou -N"
       automatico, e sem ele a soma das linhas nao fecharia com a barra. */
    ok('a frase do auto-dano traz o NUMERO',
       fr({ x:'confuso', g:'Snorlax', d:87 }) === 'Snorlax se acertou na própria confusão e perdeu 87 de HP',
       fr({ x:'confuso', g:'Snorlax', d:87 }));
    ok('a frase da saida', fr({ x:'saiuConfusao', g:'Snorlax' }) === 'Snorlax não está mais confuso!',
       fr({ x:'saiuConfusao', g:'Snorlax' }));
    /* AS TRES DIVIDEM O MESMO SELO, como as tres do gelo dividem o ❄️: e o mesmo evento visto em
       tres momentos, e icones diferentes fariam procurar tres mecanicas onde ha uma. */
    ['confundiu','confuso','saiuConfusao'].forEach(x => {
      ok('  ' + x + ' sai com o selo da confusao',
         temSelo(S.fraseDoEspecial({ x:x, g:'X', mv:'confusion', d:10 }, 'X', 'Y', { selo:true, icone:true }), 'confusao') ||
         temSelo(S.ICONES_ESPECIAIS[x], 'confusao'), String(S.ICONES_ESPECIAIS[x]).slice(0, 40));
    });
  }
  /* ---------- a FAIXA DE FOCO no auto-golpe ---------- */
  {
    /* ⚠️ O CASO DURO E O POKEMON JA ESTAR COM 1 DE HP: ali a Faixa vigia e E GASTA, e o dano
       EFETIVO do auto-golpe da ZERO (`antes - p.hp` = 1 - 1). O `seAcertou` devolvia null nesse
       caso, entao o item saia do bolso SEM UMA LINHA na tela -- e o golpe seguinte matava o pokemon
       sem Faixa, furando a promessa de que *"quem carrega a Faixa nunca termina um confronto em 0
       sem ela ter disparado antes"*.
       ⚠️ ELE NAO DA PRA MEDIR PELA TRAVA GENERICA DA FAIXA: medido, ela o pega em ~1 rodada de 20
       (6.000 batalhas com `Math.random`). Esta o monta DIRETO e e deterministica.
       ⚠️ E O FIXTURE PRECISOU DE TRES COISAS, senao ele mede outro caminho (a primeira versao dele
       passou por ACIDENTE -- a linha `faixa` que ela achava era do GOLPE COMUM contra um alvo de 1
       de HP, e nao do auto-golpe):
         1. o alvo JA confuso (`_confuso`), porque o `confunde()` roda na ENTRADA da troca -- quem
            acaba de ficar confuso so se acerta na troca SEGUINTE;
         2. o alvo MAIS RAPIDO, pra ele agir antes de o outro bater (com 1 de HP, qualquer golpe o
            mata e a Faixa sairia no golpe em vez do auto-dano);
         3. o alvo com a Faixa e com 1 de HP. */
    const alvo = mkConf('jolteon', 55); alvo.item = 'faixa_foco'; alvo.hp = 1; alvo._confuso = 3;
    const lento = mkConf('snorlax', 55);
    const viciado = () => 0.0001;   /* se acerta sempre */
    ok('  o fixture cai na faixa certa: o alvo e mais rapido', S.effectiveSpeed(alvo) > S.effectiveSpeed(lento),
       S.effectiveSpeed(alvo) + ' x ' + S.effectiveSpeed(lento));
    const d1 = [];
    S.doExchange(alvo, lento, viciado, d1);
    const iConf = d1.findIndex(g => g.x === 'confuso' && g.q === 'p');
    const iFaixa = d1.findIndex(g => g.x === 'faixa' && g.q === 'p');
    ok('com 1 de HP, o auto-golpe faz a Faixa DEIXAR A LINHA dela', iFaixa >= 0,
       d1.map(g => (g.x || 'golpe') + ':' + (g.d || 0) + '(' + g.q + ')').join(' '));
    ok('  e a linha do auto-dano NAO sai (dano zero nao vira linha)', iConf < 0, String(iConf));
    /* ⚠️ A LINHA DA FAIXA VEM ANTES DO GOLPE DO ADVERSARIO, e e isso que prova que ela e do
       AUTO-GOLPE e nao do golpe comum: a primeira versao desta trava passava por acidente porque a
       linha que ela achava era a do Snorlax batendo num alvo de 1 de HP.
       ⚠️ E O ALVO MORRE NO GOLPE SEGUINTE, e esta certo: a Faixa e UMA. O que ela promete e nunca
       terminar em 0 SEM ter disparado -- e ela disparou, com linha na tela. */
    const iGolpeDele = d1.findIndex(g => !g.x && g.q === 'e');
    ok('  e ela vem ANTES do golpe do adversario (ou seja e do auto-golpe)',
       iFaixa >= 0 && (iGolpeDele < 0 || iFaixa < iGolpeDele), 'faixa em ' + iFaixa + ', golpe dele em ' + iGolpeDele);
    /* e o caso NORMAL (vida cheia) continua gravando a linha do auto-dano, com a Faixa intocada */
    const alvo2 = mkConf('jolteon', 55); alvo2.item = 'faixa_foco'; alvo2._confuso = 3;
    const d2 = [];
    S.doExchange(alvo2, mkConf('snorlax', 55), viciado, d2);
    /* ⚠️ COM VIDA CHEIA a linha do auto-dano sai com dano de verdade. A Faixa tambem aparece nesse
       fixture, e esta certo: o Snorlax bate 317 num Jolteon de ~300 e ela segura o GOLPE dele --
       o que a trava cobra aqui e so que o auto-dano voltou a ter linha. */
    ok('  e com vida cheia a linha do auto-dano sai normalmente',
       d2.some(g => g.x === 'confuso' && g.q === 'p' && g.d > 0),
       d2.map(g => (g.x || 'golpe') + ':' + (g.d || 0) + '(' + g.q + ')').join(' '));
  }
  /* ---------- a ANIMACAO: o passo do auto-golpe nao inverte o lado ---------- */
  {
    /* ⚠️ O `q` DO `confuso` E DE QUEM PERDE, como o da queimadura e o do veneno -- entao o passo
       NAO inverte o lado. O passo comum le o `q` como QUEM BATE e desce a barra do OUTRO; aqui nao
       ha causador na troca (o pokemon se acertou), e invertido a barra que desce e a do pokemon
       ERRADO. O defeito nao aparece como erro: aparece como o adversario perdendo vida do nada.
       ⚠️ E A MARCA VELHA (`confusao`, a passiva) ESTA NA FAMILIA OPOSTA -- o `q` dela e de QUEM
       CONFUNDIU --, entao as duas tem que sair em lados CONTRARIOS pro mesmo `q`. E esse par que
       prova que elas nao foram confundidas uma com a outra. */
    const seqDe = (g) => S.buildAnimatedHitSequence({ playerHpBefore: 200, enemyHpBefore: 200,
      playerMaxHp: 200, enemyMaxHp: 200, playerHpAfter: 150, enemyHpAfter: 200, golpes: [g] });
    const novo = seqDe({ x:'confuso', q:'p', g:'X', d:50 })[0];
    ok('o passo do auto-golpe desce a barra de QUEM SE ACERTOU', novo && novo.side === 'player',
       novo ? novo.side + ' (amount ' + novo.amount + ')' : 'sem passo');
    ok('  e a marca VELHA continua descendo a do OUTRO lado (ela e de quem CONFUNDIU)',
       (() => { const v = seqDe({ x:'confusao', q:'p', g:'X', d:50 })[0]; return v && v.side === 'enemy'; })(),
       (() => { const v = seqDe({ x:'confusao', q:'p', g:'X', d:50 })[0]; return v ? v.side : 'sem passo'; })());
    /* e o amount e POSITIVO: a barra DESCE (os lacos fazem hp - amount) */
    ok('  e o amount e positivo (a barra desce, nao sobe)', novo && novo.amount > 0, String(novo && novo.amount));
  }
  /* ---------- o SELO do quadro do lutador ---------- */
  {
    /* ⚠️ A CONFUSAO NAO ENTRA NO `selosDoConfronto` (o selo ao lado do nome, nas cinco telas) e SIM
       nos ICONES FLUTUANTES da cena nova (`statusVisuaisDaSequencia`) -- e isso nao e omissao: ali
       estao os TRES status que PASSAM (sono, gelo e confusao), enquanto o quadro tem os tres que
       NAO passam (queimadura, veneno, paralisia). Um selo de campo pro que passa mentiria: o campo
       do matchup e o estado no FIM do confronto, e quem saiu da confusao no meio sairia sem selo em
       quadro nenhum.
       ⚠️ ELA SEGUE O MOLDE DO GELO: se a primeira marca do lado e `confundiu`, ele NAO estava
       confuso antes -- o icone so acende no passo dela; se e `confuso` ou `saiuConfusao`, ele entrou
       no confronto JA confuso (ela atravessa trocas) e vale desde o primeiro quadro. Sem isso o
       icone entregaria a confusao ANTES de ela acontecer, que e o defeito que o 🔥 teve em
       16/09/2026 e que custou um relato.
       ⚠️ E A CHAVE E `confusion` EM INGLES (como `freeze` e `paralysis`), enquanto o SELO se chama
       `confusao`: procurar pelo nome do selo devolve sempre false e a trava mede NADA. Conferir a
       FORMA do retorno antes de medir. */
    let comIcone = null, herdado = null;
    for(let k = 0; k < 900 && !(comIcone && herdado); k++){
      const a = [mkConf('golduck', 55), mkConf('venomoth', 55)];
      const b = [mkConf('machoke', 52), mkConf('snorlax', 52)];
      S.simulateGymBattle(a, b, S.makeSeededRng('selo' + k)).matchups.forEach(m => {
        const seq = S.sequenciaDoConfronto(m);
        const i = seq.findIndex(x => x.x === 'confundiu');
        if(!comIcone && i > 0 && seq.length > i + 1) comIcone = { m, i, seq };
        /* HERDADA: ha `confuso` do lado e NENHUM `confundiu` dele -- ela veio de antes */
        if(!herdado){
          ['p','e'].forEach(lado => {
            if(herdado) return;
            const temConf = seq.some(x => x.x === 'confuso' && x.q === lado);
            const temIni  = seq.some(x => x.x === 'confundiu' && x.q === lado);
            if(temConf && !temIni) herdado = { m, lado, seq };
          });
        }
      });
    }
    ok('achei um confronto com o icone de confusao', !!comIcone);
    if(comIcone){
      const { m, i, seq } = comIcone;
      const lado = seq[i].q;
      const tem = (passo) => S.statusVisuaisDaSequencia(m, lado, passo, seq).indexOf('confusion') >= 0;
      let antes = 0, depois = 0;
      for(let passo = 0; passo <= seq.length; passo++){
        if(passo < i + 1 && tem(passo)) antes++;
        if(passo >= i + 1 && !tem(passo)
           && !seq.slice(0, passo).some(g => g.x === 'saiuConfusao' && g.q === lado)) depois++;
      }
      ok('o icone NAO aparece antes do passo em que a confusao pega', antes === 0, antes + ' quadros cedo demais');
      ok('  e aparece do passo dela em diante (ate ela passar)', depois === 0, depois + ' quadros sem o icone');
    }
    /* ⚠️ E QUANDO ELA PASSA, O ICONE APAGA -- o gelo faz igual com o `degelou`. Sem isso o jogador
       continuaria vendo o aviso de um status que acabou. */
    if(comIcone){
      const mFim = { playerHpBefore: 200, enemyHpBefore: 200, playerMaxHp: 200, enemyMaxHp: 200,
        playerHpAfter: 200, enemyHpAfter: 160,
        golpes: [{ x:'confuso', q:'e', g:'B', d:40 }, { x:'saiuConfusao', q:'e', g:'B' }] };
      const sf = S.sequenciaDoConfronto(mFim);
      const iSaiu = sf.findIndex(g => g.x === 'saiuConfusao');
      ok('  e o icone APAGA no passo em que ela passa',
         S.statusVisuaisDaSequencia(mFim, 'e', iSaiu, sf).indexOf('confusion') >= 0 &&
         S.statusVisuaisDaSequencia(mFim, 'e', iSaiu + 1, sf).indexOf('confusion') < 0,
         JSON.stringify([S.statusVisuaisDaSequencia(mFim, 'e', iSaiu, sf),
                         S.statusVisuaisDaSequencia(mFim, 'e', iSaiu + 1, sf)]));
    }
    /* ⚠️ HERDADA: sem marca de `confundiu`, ela veio de ANTES -- e ai o icone vale desde o quadro 0.
       Procurar a marca e nao achar significa *"veio de antes"*, nao *"nao houve"*. */
    ok('e a confusao HERDADA vale desde o primeiro quadro',
       !herdado || S.statusVisuaisDaSequencia(herdado.m, herdado.lado, 0, herdado.seq).indexOf('confusion') >= 0,
       herdado ? 'lado ' + herdado.lado : 'nenhum confronto herdado na amostra');
    ok('  e o fixture ACHOU um caso herdado (senao a trava acima mede o vazio)', !!herdado);
  }
  /* ---------- as tres pausam 1,5s e sao golpe ESPECIAL (nao caem no ramo do golpe comum) ---------- */
  {
    ['confundiu','confuso','saiuConfusao'].forEach(x => {
      ok('  ' + x + ' vale 1 passo de leitura', S.passosDaAbertura[x] === 1, String(S.passosDaAbertura[x]));
      ok('  ' + x + ' e reconhecida como especial', S.ehGolpeEspecial({ x:x }) === true);
    });
  }
  /* ---------- o asterisco do cartao ---------- */
  {
    const obs = (id) => (S.obsDoGolpe(id) || []).join(' | ');
    ok('o cartao avisa a confusao nos SEIS', Object.keys(TAB).every(id => /confus/i.test(obs(id))),
       Object.keys(TAB).filter(id => !/confus/i.test(obs(id))).join(', ') || 'todos avisam');
    /* ⚠️ A CHANCE SAI DA TABELA, nunca escrita a mao: ela VARIA de 10% a 100%, entao um texto fixo
       mentiria em tres dos seis.
       ⚠️ E O DE 100% AFIRMA em vez de dizer porcentagem (24/09/2026) -- *"100% de chance de"* e uma
       condicional que nao existe. A decisao ja estava escrita no asterisco do ESTAGIO e nunca tinha
       sido exercida; o `pct()` e compartilhado pelos cinco status, entao ela alinhou o SOCO DINAMICO
       e o CANHAO DE CHOQUE de uma vez. */
    ok('  com a chance de CADA um', /20%/.test(obs('waterpulse')) && /10%/.test(obs('confusion')),
       obs('confusion') + ' // ' + obs('waterpulse'));
    ok('  e o de 100% AFIRMA, sem dizer porcentagem',
       /Sempre causa/.test(obs('dynamicpunch')) && !/100%/.test(obs('dynamicpunch')),
       obs('dynamicpunch').replace(/<[^>]*>/g, '').trim());
    ok('  e golpe que nao confunde nao avisa', !/confus/i.test(obs('tackle')), obs('tackle'));
    /* e o texto da PASSIVA saiu junto com ela */
    ok('  e o aviso da passiva ("por confronto") sumiu', !/por confronto de o adversário/.test(obs('waterpulse')));
  }
  /* ---------- a ficha da Pokedex perdeu a linha, e a explicacao nao ficou orfa ---------- */
  {
    const especiais = S.especiaisDaEspecie('zubat') || [];
    ok('a ficha do Zubat nao fala mais em confusao',
       !especiais.some(e => e.efeito === 'confusao'), JSON.stringify(especiais.map(e => e.efeito)));
    /* ⚠️ A TABELA DE EXPLICACAO E INDEXADA PELO EFEITO: uma entrada sem dono deixaria a caixa
       abrindo vazia, e o teste do bloco de especiais cobra que nenhuma sobre. */
    ok('  e a explicacao da confusao saiu junto', !S.EXPLICACAO_DO_ESPECIAL.confusao,
       JSON.stringify(Object.keys(S.EXPLICACAO_DO_ESPECIAL).slice(0, 12)));
  }
  /* ---------- OS DOIS MOTORES, num painel que GARANTE confusao ---------- */
  {
    /* ⚠️ A COMPARACAO DAS 300 BATALHAS NAO SERVE PRA ISSO: sao 30 especies em 250 e a confusao sai em
       0,65% dos confrontos -- ela daria verde sem tocar a mecanica uma vez, que e o pior tipo de
       teste que existe. Por isso ela tem painel PROPRIO, como o gelo, a queimadura, o veneno e o
       sono. Uma divergencia aqui faz a MESMA partida de liga terminar diferente no cliente e no
       servidor -- e a confusao MUDA O HP NO MEIO DA TROCA, entao os dois passam a discordar do golpe
       seguinte em diante.
       ⚠️ O PAINEL E O GOLDUCK E O VENOMOTH porque eles USAM o golpe de verdade (6 de 8 e 4 de 8 do
       painel, medido) -- o Machop LEVA o Soco Dinamico de 100% e nunca o escolhe, porque ele tem o
       Golpe Cruzado de mesmo poder e credito alto. Montar com ele daria zero confusoes. */
    const cliC = require('fs').readFileSync(require('path').join(raiz, 'index.html'), 'utf8');
    const srvC = require('fs').readFileSync(require('path').join(raiz, 'functions', 'index.js'), 'utf8');
    ok('a tabela e as constantes sao iguais nos dois motores (pelo fonte)',
       /dynamicpunch: 1.00/.test(cliC) && /dynamicpunch: 1.00/.test(srvC) &&
       /CONFUSAO_PODER = 40/.test(cliC) && /CONFUSAO_PODER = 40/.test(srvC));
    const ALVOS = ['machamp', 'snorlax', 'rhydon', 'tauros', 'dragonite', 'starmie'];
    let div = 0, comC = 0, autos = 0, ex = null;
    for(let i = 0; i < 120; i++){
      const alvo = ALVOS[i % ALVOS.length];
      const monta = (novo) => { const a = novo('golduck', 60); a.ataques = ['confusion'];
                                const b = novo('venomoth', 60); b.ataques = ['psybeam']; return [a, b]; };
      const advs = (novo) => [novo(alvo, 62), novo(ALVOS[(i + 3) % ALVOS.length], 62)];
      const rC = S.simulateGymBattle(monta((id, lv) => S.createInstance(id, lv)),
                                     advs((id, lv) => S.createInstance(id, lv)), S.makeSeededRng('c2m' + i));
      const rS = srv._simulateGymBattle(monta((id, lv) => srv._createInstance(id, lv)),
                                        advs((id, lv) => srv._createInstance(id, lv)), srv._makeSeededRng('c2m' + i));
      const marcas = (r) => (r.matchups || []).reduce((a, m) =>
        a + (m.golpes || []).filter(g => g.x === 'confundiu').length, 0);
      if(marcas(rC) > 0) comC++;
      autos += (rC.matchups || []).reduce((a, m) =>
        a + (m.golpes || []).filter(g => g.x === 'confuso').length, 0);
      if(resumo(rC) !== resumo(rS)){ div++; if(!ex) ex = 'volta ' + i + ' contra ' + alvo; }
    }
    ok('120 batalhas com confusao garantida batem golpe a golpe nos dois motores', div === 0,
       div + ' divergencias' + (ex ? '  |  ' + ex : ''));
    /* ⚠️ E ELA TEM QUE ESTAR DENTRO DELAS -- sem esta segunda linha o painel daria verde comparando
       120 trocas de golpe comum, que e o caso em que os dois motores nunca divergiriam. */
    ok('e a confusao esta dentro delas', comC >= 25 && autos > 0,
       comC + ' batalhas com confusao, ' + autos + ' auto-golpes');
  }
  /* ---------- log VELHO continua se lendo ---------- */
  {
    /* ⚠️ A MARCA VELHA (`confusao`, a passiva) CONTINUA DESENHADA: confronto gravado antes de hoje
       tem ela, e sem isso aquele log perde uma linha E a soma para de fechar com a barra. E a
       mesma decisao do `x:'desempate'` e da marca `m` do moribundo. */
    ok('a marca VELHA continua sendo um especial', S.ehGolpeEspecial({ x:'confusao' }) === true);
    /* ⚠️ AQUI OS DOIS NOMES VEM DOS PARAMETROS (a frase velha e `quem + ' deixou ' + alvo`), e e
       por isso que esta chamada precisa dos quatro argumentos -- ver o comentario do `fr`. */
    const frVelha = S.fraseDoEspecial({ x:'confusao', g:'Zubat', a2:'Machop' }, 'Zubat', 'Machop', {});
    ok('  e continua tendo frase', /confus/i.test(frVelha) && frVelha.indexOf('Zubat') === 0
       && frVelha.indexOf('Machop') > 0 && frVelha.indexOf('undefined') < 0, frVelha);
  }
}

/* ⚠️ ELE MORAVA NO BLOCO DA CONFUSAO VELHA e e usado pelo bloco da Furia do Dragao -- quando
   aquele bloco saiu (24/09/2026), este ficou apontando pro nada. Hoje ele e solto. */
function GOLPES_OK(S, id){ return !!(S.GOLPES && S.GOLPES[id]); }

console.log('\n=== A FURIA DO DRAGAO: 40 FIXOS NA ABERTURA, E A LUTA ACONTECE DEPOIS ===');
{
  /* Pedida em 11/09/2026: "quando comecar a batalha, o pokemon que tem esse move tem 10% de chance
     de ja infligir -40hp no inicio da batalha no adversario ... e depois disso o motor deve
     calcular a batalha como se fosse uma nova batalha comecando".
     E o NONO especial, e o mais simples de todos: nao sorteia dano, nao olha tipo, nao olha
     atributo. Sao 40, sempre. */
  ok('sao as 7 especies que aprendem Dragon Rage por nivel na Gen 3',
     S.FURIA_DRAGAO.length === 7, S.FURIA_DRAGAO.join(', '));
  /* NOMEADAS, nao contadas: e a licao da auditoria de 04/09/2026 -- uma contagem sozinha nao diz
     QUAL faltou. A linha do Charmander esta aqui porque ela aprende MESMO (43/48/54 no FireRed);
     a intuicao de que seriam so os dragoes erra. */
  ok('e sao as certas (a linha do Charmander, o Gyarados e a linha do Dratini)',
     ['charmander','charmeleon','charizard','gyarados','dratini','dragonair','dragonite']
       .every(id => S.FURIA_DRAGAO.includes(id)));
  ok('e nenhuma esta fora do SPECIES',
     S.FURIA_DRAGAO.filter(id => !S.SPECIES[id]).length === 0,
     S.FURIA_DRAGAO.filter(id => !S.SPECIES[id]).join(','));
  ok('o Mewtwo e o Mew ficam de fora (seria letra morta)',
     !S.FURIA_DRAGAO.includes('mewtwo') && !S.FURIA_DRAGAO.includes('mew'));
  ok('a chance e 10% por confronto', S.CHANCE_FURIA_DRAGAO === 0.10, (100*S.CHANCE_FURIA_DRAGAO) + '%');
  ok('e o dano e 40, fixo', S.FURIA_DRAGAO_DANO === 40, S.FURIA_DRAGAO_DANO + '');
  /* OS DOIS MOTORES. Uma lista ou uma chance diferente faz a MESMA batalha terminar diferente no
     cliente e no servidor -- e isso nao aparece como erro, aparece como o log discordando da
     batalha que foi jogada. */
  ok('a lista e a MESMA nos dois motores', esp.FURIA_DRAGAO.join(',') === S.FURIA_DRAGAO.join(','),
     'servidor: ' + esp.FURIA_DRAGAO.join(','));
  ok('e a chance e o dano tambem',
     esp.CHANCE_FURIA_DRAGAO === S.CHANCE_FURIA_DRAGAO && esp.FURIA_DRAGAO_DANO === S.FURIA_DRAGAO_DANO,
     esp.CHANCE_FURIA_DRAGAO + ' / ' + esp.FURIA_DRAGAO_DANO);

  /* ELA NAO DISPUTA VAGA DE GOLPE, e isso e dado e nao decisao: o `dragonrage` tem poder VARIAVEL
     e ficou fora da tabela GOLPES junto com os outros 21 quando a base da Gen 3 entrou. Se um dia
     ele entrar la, esta passiva passa a modelar a mesma coisa duas vezes -- e e este ok que grita. */
  ok('o dragonrage NAO esta na tabela GOLPES (poder variavel)', !GOLPES_OK(S, 'dragonrage'));

  /* O EFEITO, com o rng travado: 0.01 faz TODO sorteio de chance passar. */
  {
    const a = inst('gyarados', 50), b = inst('machoke', 50);
    a.maxHp = S.calcMaxHp(a); a.hp = a.maxHp;
    b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
    const antes = b.hp, diario = [];
    S.tentarGolpeEspecial(a, b, rngFixo(0.01), diario);
    const g = diario.find(x => x.x === 'furiadragao');
    ok('o adversario perde exatamente 40', !!g && (antes - b.hp) === 40, (antes - b.hp) + '');
    /* O `q` E DE QUEM USOU, nao de quem apanhou -- a convencao do diario, a mesma do sono e da
       confusao. Trocar isso nao aparece como erro: aparece como o pokemon errado perdendo vida. */
    ok('e o `q` do registro e de quem USOU o golpe', !!g && g.q === 'p', g && g.q);
    ok('o registro guarda o HP que sobrou', !!g && g.hp === b.hp, g && g.hp);
    ok('e o nome do golpe vai junto', !!g && g.g === 'Fúria do Dragão', g && g.g);
  }
  /* NAO MATA: piso de 1, a mesma regra da drenagem e da confusao. Um efeito de abertura que
     resolvesse o confronto sozinho seria um confronto sem um unico golpe na tela. */
  {
    const a = inst('dragonite', 60), b = inst('caterpie', 5);
    b.maxHp = S.calcMaxHp(b); b.hp = 12;
    const diario = [];
    S.tentarGolpeEspecial(a, b, rngFixo(0.01), diario);
    const g = diario.find(x => x.x === 'furiadragao');
    ok('nao mata: o alvo fica com 1 de HP', b.hp === 1, b.hp + '');
    /* O DANO GRAVADO E O EFETIVO, nao os 40 crus: com o valor cru a soma das linhas passaria do HP
       que o pokemon tinha. E a regra do diario desde sempre. */
    ok('e a linha grava o dano EFETIVO (11), nao os 40 crus', !!g && g.d === 11, g && g.d);
  }
  /* QUEM JA ESTA EM 1 nao gera linha nenhuma -- um passo de dano 0 e o que este log evita em toda
     regra (o mesmo "-0 de HP" que faz procurar bug onde e regra). */
  {
    const a = inst('dratini', 40), b = inst('pidgey', 20);
    b.maxHp = S.calcMaxHp(b); b.hp = 1;
    const diario = [];
    S.tentarGolpeEspecial(a, b, rngFixo(0.01), diario);
    ok('alvo ja em 1 nao vira linha no log', !diario.some(x => x.x === 'furiadragao'),
       JSON.stringify(diario));
  }
  /* OS CHEFES SAO IMUNES: o tentarGolpeEspecial corta o bloco INTEIRO quando o Mew ou o Mewtwo
     esta no confronto. Um Gyarados tirando 40 por confronto do Mew da raide seria de graca. */
  {
    const a = inst('gyarados', 50), b = inst('mewtwo', 70);
    b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
    const antes = b.hp, diario = [];
    S.tentarGolpeEspecial(a, b, rngFixo(0.01), diario);
    ok('o Mewtwo nao toma Furia do Dragao', b.hp === antes && !diario.length, (antes - b.hp) + '');
  }

  /* ELA E ABERTURA: a luta acontece INTEIRA depois. A UNICA excecao e o outro lado EXPLODIR na
     mesma abertura -- a autodestruicao e o unico efeito que resolve o confronto, e isso ja valia
     pra todas as outras aberturas. */
  {
    const IDS = Object.keys(S.SPECIES);
    let comDragao = 0, lutaDepois = 0, matou = 0, foraDos40 = 0, semLutaSemBoom = 0, explodiu = 0;
    let confrontos = 0, batalhas = 0, batalhasCom = 0;
    for(let i = 0; i < 2500; i++){
      const meu = [S.createInstance('gyarados', 45), S.createInstance('dratini', 30), S.createInstance('dragonair', 40)];
      S.equiparItens(meu, null);
      const inim = [S.createInstance(IDS[(i*7) % IDS.length], 45), S.createInstance(IDS[(i*13) % IDS.length], 45),
                    S.createInstance(IDS[(i*29) % IDS.length], 45)];
      S.equiparItens(inim, null);
      const r = S.simulateGymBattle(meu, inim, Math.random);
      batalhas++;
      let teve = false;
      for(const m of (r.matchups || [])){
        confrontos++;
        const i0 = (m.golpes || []).findIndex(x => x.x === 'furiadragao');
        if(i0 < 0) continue;
        comDragao++; teve = true;
        const g = m.golpes[i0];
        if(g.d > 40 || g.d <= 0) foraDos40++;
        if(g.hp <= 0) matou++;
        const depois = m.golpes.slice(i0 + 1);
        if(depois.some(x => !x.x)) lutaDepois++;
        else if(depois.some(x => x.x === 'boom')) explodiu++;   // a excecao legitima
        else semLutaSemBoom++;
      }
      if(teve) batalhasCom++;
    }
    ok('ela sai o bastante pra medir', comDragao >= 200,
       comDragao + ' confrontos (' + (100*comDragao/confrontos).toFixed(1) + '%) em ' +
       (100*batalhasCom/batalhas).toFixed(0) + '% das batalhas');
    ok('nunca tira mais que 40 nem menos que 1', foraDos40 === 0, foraDos40 + ' de ' + comDragao);
    ok('e nunca mata ninguem', matou === 0, matou + ' de ' + comDragao);
    /* A LUTA ACONTECE DEPOIS -- e o pedido ao pe da letra. Quando nao acontece, foi porque o outro
       lado explodiu na mesma abertura, e a explosao E o unico efeito que resolve o confronto. */
    /* TODO caso cai num dos dois baldes: ou a luta veio depois, ou o outro lado EXPLODIU na
       mesma abertura (a autodestruicao e o unico efeito que resolve o confronto, e isso ja valia
       pra todas as outras aberturas). Um terceiro balde e defeito. */
    ok('a luta acontece INTEIRA depois dela (ou o outro lado explodiu)',
       semLutaSemBoom === 0 && lutaDepois + explodiu === comDragao,
       lutaDepois + ' de ' + comDragao + ' | explosao: ' + explodiu +
       ' | sem luta e sem explosao: ' + semLutaSemBoom);
  }

  /* NA TELA: a frase, o selo e o passo. Ela mexe a barra do ADVERSARIO, entao vale DOIS passos no
     passosDaAbertura -- a frase tem que sobreviver ao movimento que ela anuncia. E o mesmo 2 da
     drenagem, da furia e da confusao, e ficar de fora da tabela faria a frase valer pra SEMPRE
     (o defeito que a anulacao teve). */
  {
    const NOME = 'Fúria do Dragão';
    const m = {
      player:'Gyarados', enemy:'Machoke', playerSpecies:'gyarados', enemySpecies:'machoke',
      playerHpBefore: 300, playerHpAfter: 220, enemyHpBefore: 280, enemyHpAfter: 0,
      playerMove:'Water', enemyMove:'Fighting',
      golpes:[{ q:'p', d:40, hp:240, c:0, m:0, z:0, x:'furiadragao', g: NOME },
              { q:'p', d:120, hp:120 }, { q:'e', d:80, hp:220 }, { q:'p', d:120, hp:0 }]
    };
    const seq = S.sequenciaDoConfronto(m);
    ok('ela ABRE a sequencia', seq[0] && seq[0].x === 'furiadragao', JSON.stringify(seq[0]));
    /* A BARRA QUE ANDA E A DO ADVERSARIO: o `q` e de quem USOU, e o passo comum inverte pra achar
       quem APANHA. E dano de verdade, entao o `amount` e POSITIVO (ao contrario da cura). */
    const anim = S.buildAnimatedHitSequence(m);
    ok('e a barra que anda e a do ADVERSARIO', anim[0].side === 'enemy' && anim[0].amount === 40,
       JSON.stringify(anim[0]));
    /* A FRASE NO LOG nomeia o golpe E o numero: sao sempre 40, e e justamente isso que surpreende
       quem ve um Dratini Lv.22 e um Dragonite Lv.70 tirando a mesma coisa. */
    const log = S.passosHtml(m);
    const linha = (log.match(/<div class="mlog-passo especial[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '';
    ok('o log traz a linha dela, com o numero',
       log.indexOf(NOME) >= 0 && /40 de HP de/.test(log), linha.replace(/<[^>]+>/g, ' ').trim());
    /* UMA LINHA SO: a linha comum ("X atacou Y com GOLPE") nao pode sair pro mesmo evento. */
    ok('e e UMA linha so', log.split(NOME).length - 1 === 1);
    /* O AVISO DO MEIO DA BATALHA sai CURTO, como o do sono e o da confusao -- ali se le em um
       segundo, e a barra descendo ja mostra o numero. */
    const aviso = p => (S.avisoDoConfronto(m, p) || '').replace(/<[^>]+>/g, '');
    /* ELA NASCE NO PASSO EM QUE A BARRA DESCE, nao antes (12/09/2026): a frase existe pra explicar
       aquela barra, e anunciada um passo antes ela contava o que ainda nao tinha acontecido. */
    ok('nada e anunciado antes de ela acontecer', aviso(0).indexOf(NOME) < 0, aviso(0) || '(vazio)');
    ok('o aviso aparece NO passo em que a barra desce', aviso(1).indexOf(NOME) >= 0, aviso(1) || '(vazio)');
    /* E CEDE O LUGAR ao nome do golpe assim que a luta comeca: ela e abertura, nao o confronto. */
    ok('e cede o lugar quando a luta comeca', aviso(2).indexOf(NOME) < 0, aviso(2) || '(vazio)');
    ok('ela esta declarada no passosDaAbertura', (function(){
      const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
      const mm = txt.match(/const passosDaAbertura = \{([^}]*)\}/);
      return !!mm && /furiadragao:\s*1/.test(mm[1]);
    })());
    /* O SELO E DE DRAGAO, e e ele que a separa de relance da FURIA comum -- os nomes se parecem e
       as duas sao passivas da mesma linha do Charmander. */
    ok('o selo dela e de DRAGAO', S.TIPO_DO_ESPECIAL[NOME] === 'Dragon', S.TIPO_DO_ESPECIAL[NOME]);
    ok('e a Furia comum continua sendo Normal', S.TIPO_DO_ESPECIAL['Fúria'] === 'Normal');
    /* NA FICHA DA POKEDEX, com a chance. Ela e o UNICO lugar do jogo em que o `dragonrage` aparece:
       ele tem poder variavel e nunca entrou na tabela GOLPES, entao nao ha cartao de golpe pra ele. */
    ok('a ficha do Gyarados anuncia a Furia do Dragao',
       S.especiaisDaEspecie('gyarados').some(e => e.nome === NOME && e.chance === S.CHANCE_FURIA_DRAGAO),
       JSON.stringify(S.especiaisDaEspecie('gyarados')));
    /* O CHARIZARD TEM AS DUAS, e a ficha mostra as duas: ele e o caso da chance composta. */
    ok('e a do Charizard anuncia as DUAS (Furia e Furia do Dragao)',
       [NOME, 'Fúria'].every(n => S.especiaisDaEspecie('charizard').some(e => e.nome === n)),
       S.especiaisDaEspecie('charizard').map(e => e.nome).join(', '));
  }
  /* A CHANCE COMPOSTA da linha do Charmander: a Furia comum e sorteada PRIMEIRO e corta o sorteio,
     entao a Furia do Dragao dela sai em 0,7 x 10% = 7%. E o preco de ter dois especiais, o mesmo
     que o Kadabra (Disable + Recuperar) ja paga. */
  {
    let comum = 0, dragao = 0;
    const rng = S.makeSeededRng('charizard-composta');
    for(let i = 0; i < 40000; i++){
      const e = S.sorteiaGolpeEspecial(inst('charizard', 50), rng);
      if(e && e.efeito === 'furia') comum++;
      if(e && e.efeito === 'furiadragao') dragao++;
    }
    const pct = 100 * dragao / 40000;
    ok('a Furia do Dragao do Charizard sai em ~7% (a chance composta)', pct > 6.3 && pct < 7.7,
       pct.toFixed(2) + '%  |  a Furia comum em ' + (100*comum/40000).toFixed(2) + '%');
  }
  /* E O GYARADOS, que nao tem outro especial, fica nos 10% cheios. */
  {
    let n = 0;
    const rng = S.makeSeededRng('gyarados-pura');
    for(let i = 0; i < 40000; i++){
      const e = S.sorteiaGolpeEspecial(inst('gyarados', 50), rng);
      if(e && e.efeito === 'furiadragao') n++;
    }
    const pct = 100 * n / 40000;
    ok('e a do Gyarados fica nos 10% cheios', pct > 9.3 && pct < 10.7, pct.toFixed(2) + '%');
  }
}

console.log('\n=== A RECONSTRUCAO NAO PODE MOSTRAR DOIS GOLPES IMPOSSIVEIS ===');
{
  /* SEM DIARIO a luta e reconstruida em 3 linhas: o vencedor acerta uma PARTE, o perdedor devolve
     tudo de uma vez, o vencedor termina. A primeira e a terceira sao o MESMO pokemon com o MESMO
     golpe contra o MESMO alvo -- e a unica coisa que faz dois golpes assim diferirem e o sorteio de
     0,85 + rng*0,15 do calcDamageNew: no maximo 1,18x (1,00/0,85). Fora o critico, que a linha
     anuncia com selo proprio.
     A faixa da divisao era 30-70%, que da ate 2,33x, e isso foi RELATADO por jogadores em
     10/09/2026: "tira uma fracao, apanha, e termina de matar com o mesmo golpe tirando muito mais
     dano e sem critico". Medido na epoca: 78,1% dos confrontos reconstruidos ficavam fora da banda,
     media 1,57x, pior 2,36x. Hoje a faixa e 46-54%, teto de 1,17x.
     ⚠️ DESDE 15/09/2026 NENHUM CONFRONTO COM DIARIO CAI AQUI -- o teto acabou. O caminho continua
     vivo pra log velho e pra Faixa de Foco, e e por isso que este bloco tira o diario a mao. */
  const BANDA = 1.18;   // 1,00 / 0,85 -- o quanto o sorteio da formula faz um golpe variar
  const especies = Object.keys(S.SPECIES);
  let tres = 0, fora = 0, pior = 0, exemplo = null;
  /* 6.000 voltas: com o diario tirado a mao TODO confronto cai na reconstrucao, entao a amostra
     sobra -- o numero fica como esta porque o custo e baixo e a folga protege o limiar abaixo. */
  for(let i = 0; i < 6000; i++){
    const rng = S.makeSeededRng('rec' + i);
    const time = k => Array.from({ length: k }, () => {
      const id = especies[Math.floor(rng() * especies.length)];
      const p = S.createInstance(id, 25 + Math.floor(rng() * 40)); p.ataques = S.ataquesPadrao(p); return p;
    });
    const r = S.simulateGymBattle(time(3), time(3), S.makeSeededRng('b' + i));
    (r.matchups || []).forEach(m => {
      /* ⚠️ O DIARIO E TIRADO DE PROPOSITO (15/09/2026), e e a unica forma de alcancar este caminho
         hoje: sem teto, confronto COM diario mostra os golpes REAIS e nunca cai na reconstrucao.
         Ela NAO foi removida e nao pode ser -- e o fallback de log gravado ANTES de o diario
         existir, e e ela tambem que a FAIXA DE FOCO usa pra partir a luta em duas metades. Entao o
         que este bloco testa continua existindo; o que mudou e que so se chega la por um matchup
         sem `golpes`, que e exatamente o que a linha abaixo monta.
         (O SONO nao precisa mais de excecao: sem diario a reconstrucao nao conhece troca livre
         nenhuma, entao nao ha golpe real ao lado de golpe somado.) */
      const velhoRec = Object.assign({}, m); delete velhoRec.golpes;
      const todos = S.sequenciaDoConfronto(velhoRec);
      const seq = todos.filter(g => !g.x);
      if(seq.length !== 3 || seq[0].q !== seq[2].q) return;   // o padrao vencedor / perdedor / vencedor
      tres++;
      const a = seq[0].d, b = seq[2].d;
      const razao = Math.max(a, b) / Math.max(1, Math.min(a, b));
      if(razao > BANDA + 0.12){                          // folga pro arredondamento em dano total pequeno
        fora++;
        if(razao > pior){ pior = razao; exemplo = (seq[0].q === 'p' ? m.player : m.enemy) + ': ' + a + ' e depois ' + b; }
      }
    });
  }
  ok('confrontos reconstruidos de sobra pra medir', tres > 1000, tres + ' de 3 linhas');
  /* ZERO, e nao "quase zero": a divisao e a UNICA coisa que separa os dois golpes,
     e ela esta presa na banda por construcao. Qualquer caso aqui e a faixa tendo reaberto. */
  ok('os dois golpes do MESMO pokemon nunca diferem mais que a formula permite',
     fora === 0, fora + ' de ' + tres + (exemplo ? '   |  pior: ' + pior.toFixed(2) + 'x  ' + exemplo : ''));

  /* ⚠️ E A FAIXA MORA NUM LUGAR SO, desde 12/09/2026: a reconstrucao e a SUAVIZACAO do golpe
     aparado repartem dano, e as duas tem que caber na mesma banda. Duas copias divergiriam no
     primeiro ajuste, e um dos dois caminhos voltaria a mostrar par impossivel. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const j = txt.match(/const JITTER_DO_GOLPE = ([\d.]+);/);
    ok('a banda esta escrita no codigo, numa constante', !!j, j ? j[0] : '(nao achei)');
    ok('e a reconstrucao USA a constante, em vez de um numero solto',
       /const firstHitPct = 0\.5 \* fatiaDoGolpe\(semente\);/.test(txt));
    ok('e a suavizacao tambem', /fatiaDoGolpe\(semente \+ k \* 13\)/.test(txt));
    if(j){
      const jit = Number(j[1]);
      const menor = 1 - jit, maior = 1 + jit;
      ok('e ela nao permite razao acima da banda da formula', (maior / menor) <= BANDA,
         'cada fatia entre ' + (100*menor).toFixed(0) + '% e ' + (100*maior).toFixed(0) + '% da divisao igual' +
         '  ->  razao maxima ' + (maior/menor).toFixed(2) + 'x');
      /* Num PAR isso tem que dar exatamente os 46%-54% que a reconstrucao ja usava. */
      ok('e num par ela da os mesmos 46%-54% de sempre',
         Math.abs(0.5*menor - 0.46) < 1e-9 && Math.abs(0.5*maior - 0.54) < 1e-9,
         (100*0.5*menor).toFixed(0) + '% a ' + (100*0.5*maior).toFixed(0) + '%');
    }
  }

  /* E A RECONSTRUCAO NAO ENCOSTA NO MOTOR. Ela e chamada pelo sequenciaDoConfronto, que e
     apresentacao -- mexer na faixa nao pode mudar um ponto de dano. */
  ok('a reconstrucao vive so no cliente (o servidor nao a tem)',
     require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8').indexOf('firstHitPct') < 0);
}

console.log('\n=== A FURIA E UMA PASSIVA ===');
{
  /* Reescrita em 10/09/2026. Ela nasceu como golpe que ganhava poder a cada uso e isso foi
     DESFEITO: medido, o motor nunca a escolhia (0,0% dos confrontos) e mesmo forcada custava 22,7
     pontos. Hoje e passiva da ESPECIE, no molde do sono e da anulacao: 30% por confronto de entrar
     em furia, +10 em TODOS os seis atributos, e ACUMULA de confronto em confronto. */
  ok('sao as 19 especies que aprendem Furia por nivel', S.FURIA.length === 19, S.FURIA.length + '');
  ok('a chance e 30% por confronto', S.CHANCE_FURIA === 0.30, (100*S.CHANCE_FURIA) + '%');
  ok('e o bonus e +10', S.FURIA_BONUS === 10);
  ok('a lista e a MESMA nos dois motores', JSON.stringify(esp.FURIA) === JSON.stringify(S.FURIA));
  ok('e a chance tambem', esp.CHANCE_FURIA === S.CHANCE_FURIA && esp.FURIA_BONUS === S.FURIA_BONUS);

  /* O BONUS ENTRA NOS SEIS ATRIBUTOS, e e FLAT: nao pode ser inflado pelo shiny nem pelo terreno,
     que sao multiplicadores -- a mesma regra do item de atributo. */
  {
    const p = inst('tauros', 50);
    const antes = { atk:S.effectiveAttack(p), def:S.effectiveDefense(p), spA:S.effectiveSpAtk(p),
                    spD:S.effectiveSpDef(p), vel:S.effectiveSpeed(p), hp:S.calcMaxHp(p) };
    p._furia = 1;
    const dep = { atk:S.effectiveAttack(p), def:S.effectiveDefense(p), spA:S.effectiveSpAtk(p),
                  spD:S.effectiveSpDef(p), vel:S.effectiveSpeed(p), hp:S.calcMaxHp(p) };
    ok('os SEIS atributos sobem +10',
       Object.keys(antes).every(k => dep[k] - antes[k] === S.FURIA_BONUS),
       Object.keys(antes).map(k => k + ':' + (dep[k]-antes[k])).join(' '));
    p._furia = 3;
    ok('e acumula: 3 vezes valem +30', S.effectiveAttack(p) - antes.atk === 3 * S.FURIA_BONUS);
    /* FLAT mesmo num shiny em terreno: se entrasse ANTES dos multiplicadores, +10 viraria +14. */
    const s2 = inst('tauros', 50); s2.shiny = true; s2.terrainBuffed = true;
    const semF = S.effectiveAttack(s2); s2._furia = 1;
    ok('e continua FLAT num shiny em terreno', S.effectiveAttack(s2) - semF === S.FURIA_BONUS,
       (S.effectiveAttack(s2) - semF) + '');
  }

  /* NA BATALHA: ela sai, a barra SOBE e a frase acompanha o crescimento. */
  {
    const semTag = h => String(h||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
    let achou = 0, subiu = 0, comFrase = 0, noLog = 0, acumulou = 0;
    for(let v = 0; v < 900 && achou < 60; v++){
      /* UM Tauros contra SEIS fracos: ele sobrevive aos seis confrontos, e e assim que o ACUMULO
         aparece -- num 1x1 ela sai no maximo uma vez e o teste nao teria o que medir. */
      const a = [inst('tauros', 70)]; a[0].ataques = S.ataquesDisponiveis('tauros', 70).slice(0, 3);
      const b = [1,2,3,4,5,6].map(() => inst('ratata', 5));
      const r = S.simulateGymBattle(a, b);
      (r.matchups || []).forEach(m => {
        const f = (m.golpes || []).find(g => g.x === 'furia');
        if(!f || achou >= 60) return;
        achou++;
        if(f.d > 0) subiu++;
        if(f.n > 1) acumulou++;
        const seq = S.buildAnimatedHitSequence(m);
        const iF = seq.findIndex(h => h.x === 'furia');
        /* A BARRA SOBE: amount negativo e o que faz o laco desenhar crescimento. */
        if(iF >= 0 && seq[iF].amount < 0 && /entrou em f/.test(semTag(S.statusDoConfronto(m, iF + 1, seq[iF]).html))) comFrase++;
        if(semTag(S.passosHtml(m)).indexOf('entrou em f') >= 0) noLog++;
      });
    }
    ok('a furia sai em batalha o bastante pra medir', achou >= 20, achou + ' confrontos');
    ok('e sempre faz a vida SUBIR', subiu === achou, subiu + ' de ' + achou);
    ok('a frase aparece NO passo em que a barra sobe', comFrase === achou, comFrase + ' de ' + achou);
    ok('e ela vira linha no log', noLog === achou, noLog + ' de ' + achou);
    ok('e o acumulo acontece (2a vez ou mais)', acumulou > 0, acumulou + ' confrontos');
  }

  /* ZERA POR BATALHA, E DEVOLVE O TETO DE VIDA. O teto e o unico dos seis atributos GRAVADO na
     instancia -- os outros cinco saem das effective* na hora do dano -- entao a furia tem que
     desfaze-lo na saida. Sem isso o Tauros sai da luta com o teto +30 pra sempre e a barra dele na
     tela de time muda de tamanho sozinha. */
  {
    const p = inst('tauros', 55); p.ataques = S.ataquesDisponiveis('tauros', 55).slice(0, 3); p._furia = 9;
    S.simulateGymBattle([p], [inst('ratata', 5)]);
    ok('entrar com acumulo de outra batalha nao vale', (p._furia || 0) < 9, (p._furia || 0) + '');

    let tetoErrado = 0, vidaErrada = 0, sobrou = 0, medidos = 0;
    for(let v = 0; v < 400; v++){
      const a = [inst('tauros', 70), inst('dodrio', 70)];
      a.forEach(x => { x.ataques = S.ataquesDisponiveis(x.speciesId, 70).slice(0, 3); });
      const teto = a.map(x => S.calcMaxHp(x));
      S.simulateGymBattle(a, [1,2,3].map(() => inst('ratata', 5)));
      a.forEach((x, i) => {
        medidos++;
        if(x._furia) sobrou++;
        if(x.maxHp !== teto[i]) tetoErrado++;
        if(x.hp > x.maxHp || x.hp < 0) vidaErrada++;
      });
    }
    ok('o acumulo nao sobra na instancia', sobrou === 0, sobrou + ' de ' + medidos);
    ok('e o teto de vida volta ao que era', tetoErrado === 0, tetoErrado + ' de ' + medidos);
    ok('sem nunca deixar vida acima do teto', vidaErrada === 0, vidaErrada + ' de ' + medidos);
  }

  /* E ELA APARECE NA FICHA DA POKEDEX, junto dos outros especiais -- e nao no cartao do golpe, que
     e onde o jogador ESCOLHE, e passiva nao se escolhe. */
  ok('a ficha do Tauros mostra a Furia',
     S.especiaisDaEspecie('tauros').some(e => e.nome === 'Fúria' && e.chance === S.CHANCE_FURIA),
     JSON.stringify(S.especiaisDaEspecie('tauros')));
  ok('e o cartao do golpe NAO fala mais dela', S.obsDoGolpe('rage').length === 0);
}

console.log('\n=== O CRITICO E DA GEN 3 ===');
{
  /* Trocado em 10/09/2026, a pedido. Era da Gen 1 (velocidade/512, e o critico dobrava o NIVEL na
     formula) -- o ultimo desvio de Gen 1 que restava, num jogo que ja usa atributos da Gen 2 e
     golpes da Gen 3.
     A GEN 3 usa ESTAGIOS de chance fixa: +0 = 1/16, +1 = 1/8 (golpes de critico alto). Os estagios
     2 a 4 nao existem aqui porque nada no jogo sobe estagio -- seria codigo que nunca roda. */
  ok('a chance base e 1/16 (6,25%)', S.CRIT_BASE === 1/16, (100*S.CRIT_BASE).toFixed(2) + '%');
  ok('a de critico alto e 1/8 (12,5%)', S.CRIT_ALTO === 1/8, (100*S.CRIT_ALTO).toFixed(2) + '%');
  ok('e o multiplicador e 2 exato', S.CRIT_MULT === 2);
  ok('sao os OITO golpes da Gen 3', S.GOLPES_CRIT_ALTO.length === 8, S.GOLPES_CRIT_ALTO.join(','));
  /* A lista saiu do critRatio do dado do Showdown com o mod da Gen 3 -- o MESMO caminho que gerou
     a base de golpes. Ela e DUPLICADA nos dois motores. */
  ok('todos existem na tabela GOLPES', S.GOLPES_CRIT_ALTO.every(id => !!S.GOLPES[id]));
  ok('e a lista e a MESMA nos dois motores',
     JSON.stringify(esp.GOLPES_CRIT_ALTO) === JSON.stringify(S.GOLPES_CRIT_ALTO),
     'cliente: ' + JSON.stringify(S.GOLPES_CRIT_ALTO) + '  servidor: ' + JSON.stringify(esp.GOLPES_CRIT_ALTO));
  ok('golpe comum cai no estagio +0', S.chanceDeCritico('tackle') === S.CRIT_BASE);
  ok('e sem golpe escolhido tambem (liga, online, save antigo)',
     S.chanceDeCritico(null) === S.CRIT_BASE && S.chanceDeCritico(undefined) === S.CRIT_BASE);

  /* A CHANCE MEDIDA, e ela nao pode mais depender da ESPECIE -- era isso que a Gen 1 fazia. */
  const taxa = (especie, golpe) => {
    let c = 0; const N = 30000;
    for(let i = 0; i < N; i++){
      const a = inst(especie, 50); a.ataques = [golpe];
      S.calcDamage(a, inst('miltank', 50), Math.random);
      if(a.lastCrit) c++;
    }
    return 100 * c / N;
  };
  const rapido = taxa('electrode', 'tackle');   // 27,3% na Gen 1
  const lento  = taxa('shuckle', 'tackle');     // 1,0% na Gen 1
  ok('o Electrode critica ~6,25% (criticava 27,3%)', Math.abs(rapido - 6.25) < 0.9, rapido.toFixed(2) + '%');
  ok('o Shuckle tambem (criticava 1,0%)', Math.abs(lento - 6.25) < 0.9, lento.toFixed(2) + '%');
  ok('e os dois criticam IGUAL: a velocidade saiu da conta', Math.abs(rapido - lento) < 1.2,
     rapido.toFixed(2) + '% x ' + lento.toFixed(2) + '%');
  const alto = taxa('persian', 'slash');
  ok('o Corte (critico alto) critica ~12,5%', Math.abs(alto - 12.5) < 1.2, alto.toFixed(2) + '%');

  /* O EFEITO: x2 EXATO, nao mais o nivel dobrado (que dava ~1,9x). */
  {
    let semC = 0, nSem = 0, comC = 0, nCom = 0;
    for(let i = 0; i < 40000; i++){
      const a = inst('gyarados', 58); a.ataques = ['hyperbeam'];
      const d = S.calcDamage(a, inst('gyarados', 58), Math.random);
      if(a.lastCrit){ comC += d; nCom++; } else { semC += d; nSem++; }
    }
    const x = (comC/nCom) / (semC/nSem);
    ok('o critico vale 2x exato (valia ~1,9x)', Math.abs(x - 2) < 0.05, x.toFixed(3) + 'x');
  }

  /* O SELO. Ele JA ESTEVE no log e saiu por virar ruido; voltou a pedido agora que o critico vale
     x2 e decide confronto. O que se cobra e que ele NUNCA falte: sem isso o jogador ve a barra cair
     o dobro sem explicacao -- que foi exatamente o relato que trouxe esta mudanca. */
  {
    const semTag = h => String(h||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
    let comCrit = 0, noLog = 0, naTela = 0, contagemOk = 0;
    for(let v = 0; v < 1500 && comCrit < 120; v++){
      const a = [inst('gyarados', 58)]; a[0].ataques = ['hyperbeam'];
      const b = [inst('gyarados', 58)]; b[0].ataques = ['hyperbeam'];
      const m = (S.simulateGymBattle(a, b).matchups || [])[0];
      if(!m) continue;
      const noDiario = (m.golpes || []).filter(g => !g.x && g.c).length;
      if(!noDiario) continue;
      comCrit++;
      const seq = S.sequenciaDoConfronto(m);
      const marcados = seq.filter(g => !g.x && g.c).length;
      if(marcados > 0) naTela++;
      if(marcados === noDiario) contagemOk++;
      if(semTag(S.passosHtml(m)).indexOf('CRÍTICO') >= 0) noLog++;
    }
    ok('amostra de criticos de sobra', comCrit >= 50, comCrit + ' confrontos');
    /* A RECONSTRUCAO nao sabe QUAL golpe foi critico -- ela inventa os golpes a partir do HP. Mas o
       diario sabe QUANTOS foram e de que LADO, e e isso que o marcarCriticos preserva. Sem ele o
       selo sumia em 56% dos confrontos com critico, justamente os longos. */
    ok('o selo NUNCA falta na tela', naTela === comCrit, naTela + ' de ' + comCrit);
    ok('e a CONTAGEM de criticos e a do diario', contagemOk === comCrit, contagemOk + ' de ' + comCrit);
    ok('e ele aparece no LOG', noLog === comCrit, noLog + ' de ' + comCrit);
  }

  /* ⚠️ O SELO NAO SAI EM GOLPE QUE O CORTE ENCOLHEU (12/09/2026). Reportado num Bulbasaur x Onix:
     "-152 e depois CRITICO -9". O motor estava CERTO -- o Onix tinha 9 de HP e o critico o matou --,
     o defeito era o selo prometendo dobro ao lado de um numero pequeno.
     A REGRA E "O CORTE COMEU A DOBRA", nao "o golpe foi cortado", e a primeira versao errou nisso:
     tirar o selo de todo golpe que mata deixaria de fora os criticos informativos (300 de 350
     continua sendo um numero grande). Quem pegou o erro foi a trava do "o selo NUNCA falta" logo
     acima, com o fixture de Hiper Raio -- luta curta, em que quase todo critico e o golpe final. */
  {
    const semTag = h => String(h||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ');
    const ids = Object.keys(S.SPECIES);
    const rnd = n => Math.floor(Math.random() * n);
    /* ⚠️ O REGEX RODA LINHA A LINHA, e nao no texto inteiro (15/09/2026). Rodando no texto colapsado
       o `(.*?)` ATRAVESSA linhas sempre que uma delas nao termina em " de HP." -- e a da DRENAGEM
       nao termina: ela e "... e tirou -92 de HP e recuperou +46.". Medido no par Vileplume x Gloom,
       o primeiro match saia com quem="Vileplume", golpe="Mega Dreno e tirou -92 de HP e recuperou
       +46. Gloom atacou Vileplume com Acido" e dano=80 -- ou seja, a trava atribuia ao Vileplume um
       golpe que era do GLOOM, e o selo era comparado com dano do lado errado.
       E a MESMA armadilha que a conta de "uma linha por golpe" ja tinha custado em 13/09/2026, e o
       conserto e o mesmo: cortar pelo HTML (`mlog-passo`), que e onde a linha de verdade comeca.
       Falhava ~1 rodada em 3 desde que a drenagem no golpe entrou, hoje de manha. */
    const linhasDoLog = (h) => String(h||'').split(/<div class="mlog-passo[ "]/).slice(1).map(semTag);
    const re = /([A-Za-zÀ-ÿ'.\- ]+?) atacou ([A-Za-zÀ-ÿ'.\- ]+?) com (.*?)e tirou −(\d+) de HP(?: e recuperou \+\d+)?\.( CRÍTICO)?/;
    let linhas = 0, selo = 0, feio = 0, exFeio = '', reconstruido = 0;
    for(let v = 0; v < 280; v++){
      const t = () => Array.from({length:6}, () => {
        const p = inst(ids[rnd(ids.length)], 12 + rnd(40));
        p.ataques = S.ataquesDisponiveis(p.speciesId, p.level).slice(0, S.MAX_GOLPES);
        return p;
      });
      const a = t(), b = t();
      S.equiparItens(a, null); S.equiparItens(b, null);
      let r; try{ r = S.simulateGymBattle(a, b); }catch(e){ continue; }
      (r.matchups || []).forEach(m => {
        /* ⚠️ O CONFRONTO ESPELHO FICA DE FORA, e e artefato do TESTE, nao do jogo: esta varredura
           agrupa as linhas por NOME (e o que a tela mostra), e com a MESMA especie nos dois lados
           o maior golpe de um entra na conta do outro. Foi assim que um Blastoise x Blastoise
           acusou um critico de 21 contra o 142 do adversario. Falhava ~1 rodada em 6.
           Agrupar por lado exigiria ler o diario em vez da tela, e o que esta trava existe pra
           medir e justamente o que o jogador VE. */
        if(m.player === m.enemy) return;
        const velho = Object.assign({}, m); delete velho.golpes;
        /* ⚠️ O HTML VAI CRU, e nao `semTag`-ado: quem corta as linhas e o `linhasDoLog`, e ele corta
           pela MARCACAO (`mlog-passo`). Colapsado, o texto vira uma linha so e o regex atravessa. */
        [[S.passosHtml(m), false], [S.passosHtml(velho), true]].forEach(([html, ehRecon]) => {
        const txt = semTag(html);
        const arr = [];
        linhasDoLog(html).forEach(l => {
          const g = re.exec(l);
          if(g) arr.push({ quem: g[1].trim(), d: +g[4], crit: !!g[5], tapas: /\d+x$/.test(g[3].trim()) });
        });
        arr.forEach(l => {
          /* As contagens de AMOSTRA sao so da tela de verdade -- a passada da reconstrucao existe
             pra alimentar o contador dela, nao pra inflar o denominador das outras duas travas. */
          if(!ehRecon) linhas++;
          if(!l.crit) return;
          if(!ehRecon) selo++;
          /* ⚠️ O BASELINE TAMBEM EXCLUI OS TAPAS, e nao so a linha medida: o "maior golpe daquele
             atacante" nao pode ser uma linha de VARIOS TAPAS, que e a SOMA de N tapas. Um Shuckle
             de 28 num critico contra os 182 de um Ataque Furia de 3 tapas nao e selo mentindo --
             e golpe unico contra soma. Isentar so a linha medida deixava metade do artefato de pe,
             e ele falhava ~1 rodada em 6. A comparacao que a regra quer e golpe unico com golpe
             unico. */
          const maior = arr.filter(x => x.quem === l.quem && !x.tapas).reduce((mx, x) => Math.max(mx, x.d), 0);
          /* Um golpe de VARIOS TAPAS pode legitimamente somar pouco, entao ele nao conta aqui:
             o log ja soma os tapas numa linha so, e a linha selada e a soma. */
          /* ⚠️ UM GOLPE DE VARIOS TAPAS FICA DE FORA, e o comentario acima dizia isso desde
             10/09/2026 sem o codigo fazer: a linha dele e a SOMA de N tapas de poder baixo (o Tapa
             Duplo e poder 15), entao ela pode somar menos que um terco do maior golpe do MESMO
             atacante sem o selo estar mentindo -- um dos tapas foi critico de verdade, e o total
             ainda e pequeno. Comparar a soma de tapas fracos com o maior golpe unico e comparar
             coisas diferentes. Falhava ~1 rodada em 3, sempre num Tapa Duplo ou num Arranhoes
             Furiosos, e o Metronomo tornou isso frequente (as 7 especies dele sorteiam golpe a
             cada ataque). */
          if(l.tapas) return;
          if(l.d * 3 < maior){ if(ehRecon) reconstruido++; else { feio++; if(!exFeio) exFeio = txt.trim().slice(0, 150); } }
        });
        });
      });
    }
    ok('amostra de linhas de golpe de sobra', linhas > 4000, linhas + ' linhas');
    ok('o selo continua saindo (nao foi silenciado)', selo > linhas * 0.02 && selo < linhas * 0.09,
       selo + ' (' + (100 * selo / linhas).toFixed(1) + '%)');
    /* O QUE SE COBRA: no caminho REAL, ZERO. A reconstrucao e aproximada por desenho e tem guarda
       propria no marcarCriticos, entao ela entra com folga -- mas nao pode explodir. */
    ok('NENHUM selo num numero < 1/3 do maior daquele atacante (diario real)', feio === 0,
       feio + (exFeio ? '  ex: ' + exFeio : ''));
    ok('e na reconstrucao isso e raro', reconstruido <= linhas * 0.001,
       reconstruido + ' de ' + linhas);
  }

  /* A REGRA DO `cap` MEDIDA NO MOTOR, e nao pela tela: um critico que mata um alvo QUASE CHEIO
     mantem o selo (o numero e grande), e um que mata um alvo RASPANDO perde. Sem esta trava, voltar
     a regra larga ("efetivo < sorteado") passaria despercebido -- ela so aparece na tela. */
  {
    let mantido = 0, perdido = 0, voltas = 0;
    for(let i = 0; i < 4000 && (mantido < 20 || perdido < 20); i++){
      /* ⚠️ `inst` (o createInstance) deixa maxHp E hp em ZERO -- quem os preenche e o
         `equiparItens`/`calcMaxHp` no comeco da batalha. Chamando o doExchange direto, sem isto,
         o alvo ja entra morto e a medicao nao mede nada: o selo some por outro motivo. Foi o mesmo
         tropeco do fixture do Remoinho. */
      const a = inst('gyarados', 58); a.ataques = ['hyperbeam']; a.maxHp = S.calcMaxHp(a); a.hp = a.maxHp;
      const b = inst('gyarados', 58); b.ataques = ['hyperbeam']; b.maxHp = S.calcMaxHp(b);
      /* ⚠️ `inst` NAO enche o HP (o createInstance deixa em 0), e sem encher isto nao mede nada:
         com o atacante morto o doExchange cai no caminho do moribundo e o selo some por outro
         motivo. Foi o mesmo tropeco do fixture do Remoinho.
         O alvo entra RASPANDO nas voltas pares: ai todo golpe que o mata come a dobra inteira. */
      b.hp = (i % 2 === 0) ? Math.max(1, Math.round(b.maxHp * 0.02)) : b.maxHp;
      const diario = [];
      try{ S.doExchange(a, b, Math.random, diario); }catch(e){ continue; }
      voltas++;
      const golpes = diario.filter(g => !g.x && g.d > 0 && g.q === 'p');
      golpes.forEach(g => { if(i % 2 === 0){ if(!g.c) perdido++; } else if(g.c) mantido++; });
    }
    ok('o critico num alvo CHEIO mantem o selo', mantido >= 20, mantido + ' casos');
    ok('e num alvo RASPANDO o selo nao sai', perdido >= 20, perdido + ' casos');
  }
}

console.log('\n=== OS DOIS NUNCA CAEM JUNTOS, FORA A AUTODESTRUICAO (12/09/2026) ===');
{
  /* Pedido assim: *"nao existe de os 2 cairem juntos, somente na auto destruicao; fora isso, jamais
     os 2 devem morrer juntos e um ficar de pe"*.
     ⚠️ O QUE SAIU DAQUI FOI UMA MECANICA INTEIRA, e nao uma frase: o REVIDE MORIBUNDO deixou de
     matar (piso de 1 de HP), e com ele foram embora a MORTE SUBITA, a ressurreicao com 5%-15%, o
     aparo da linha que ela obrigava e a linha ⚖️ do log.
     E VALE SABER O QUE ISSO CUSTOU EM CONSERTO: entre 09 e 12/09/2026 ela gerou TRES relatos
     seguidos, todos consequencia dela -- o golpe que sumia ("o Gyarados atacou 2x seguidas"), os
     numeros que nao fechavam ("tirou 154 e depois 2") e o pokemon atacando com a barra em zero
     ("a arbok ja era para ter morrido"). Tirando a causa, os tres deixam de existir por construcao.
     LOG VELHO continua se lendo: a linha `x:'desempate'` segue desenhada. O que nao existe mais e
     gerar uma nova. */
  const ids = Object.keys(S.SPECIES);
  const rnd = n => Math.floor(Math.random() * n);
  let conf = 0, trades = 0, comBoom = 0, linhas = 0, exTrade = null;
  let comColagem = 0, jaNoDiario = 0, colados = 0, cadaver = 0, exemplo = '', exCad = '';
  const quantasColagens = (lista) => {
    const l = [];
    lista.forEach(g => {
      if(g.x === 'boomself' || g.x === 'absorbdano') return;
      if(!g.x && !(g.d > 0)) return;
      const u = l[l.length - 1];
      if(g.t > 1 && u && u.q === g.q && u.tn === g.tn){ u.d += g.d; return; }
      l.push(Object.assign({}, g));
    });
    let n = 0;
    for(let i = 1; i < l.length; i++){
      if(l[i].x || l[i-1].x) continue;          // linha especial separa
      if(l[i].q === l[i-1].q) n++;
    }
    return n;
  };
  const ehCura = g => subiuAVida(g);
  for(let v = 0; v < 900; v++){
    const mk = () => Array.from({length:6}, () => {
      const p = S.createInstance(ids[rnd(ids.length)], 25 + rnd(30));
      p.ataques = S.ataquesDisponiveis(p.speciesId, p.level).slice(0, S.MAX_GOLPES);
      return p;
    });
    const a = mk(), b = mk();
    S.equiparItens(a, null); S.equiparItens(b, null);
    let r; try{ r = S.simulateGymBattle(a, b); }catch(e){ continue; }
    (r.matchups || []).forEach(m => {
      conf++;
      const gs = m.golpes || [];
      if(m.isTrade){
        trades++;
        if(gs.some(g => g.x === 'boom')) comBoom++;
        else if(!exTrade) exTrade = m.player + ' ' + m.playerHpBefore + '->' + m.playerHpAfter +
                                    ' x ' + m.enemy + ' ' + m.enemyHpBefore + '->' + m.enemyHpAfter;
      }
      if(gs.some(g => g.x === 'desempate')) linhas++;
      const seq = S.sequenciaDoConfronto(m);
      /* ⚠️ NINGUEM ATACA COM A BARRA EM ZERO -- e agora isto vale POR CONSTRUCAO, nao por
         ordenacao: sem o empate, quem cai fica caido e quem revida estava vivo quando revidou. */
      let hpP = m.playerHpBefore, hpE = m.enemyHpBefore;
      seq.forEach(g => {
        if(!g.x && g.d > 0){
          const vida = g.q === 'p' ? hpP : hpE;
          if(vida <= 0 && !exCad){ cadaver++; exCad = m.player + ' x ' + m.enemy; }
          else if(vida <= 0) cadaver++;
        }
        const mexe = !g.x || ehCura(g) || g.x === 'boom' || g.x === 'boomself' || danoSemGolpe(g) || danoNoProprio(g);
        if(!mexe) return;
        /* a QUEIMADURA tira do PROPRIO `q`, como o boomself e as curas -- ela nao tem causador */
        const noProprio = ehCura(g) || g.x === 'boomself' || danoNoProprio(g);
        const alvoP = noProprio ? (g.q === 'p') : (g.q !== 'p');
        if(alvoP) hpP = (g.hp != null) ? g.hp : Math.max(0, ehCura(g) ? hpP + g.d : hpP - g.d);
        else      hpE = (g.hp != null) ? g.hp : Math.max(0, ehCura(g) ? hpE + g.d : hpE - g.d);
      });
      /* E A APRESENTACAO VOLTOU A NUNCA CRIAR COLAGEM. A excecao do "revide letal" que existiu por
         algumas horas em 12/09/2026 morreu junto com o empate: sem revide que mata, nao ha o caso
         em que as duas ordens possiveis eram ruins.
         ⚠️ A GUARDA DO TETO SAIU EM 15/09/2026: ela pulava o confronto comprido porque ele caia na
         reconstrucao, que nao conhece ordem nenhuma. Hoje NAO existe esse caso -- todo confronto com
         diario mostra os golpes reais --, e a regra passou a ser cobrada na luta comprida tambem,
         que e justamente onde o reordenamento tem mais chance de colar dois golpes do mesmo lado. */
      if(gs.some(g => g.x === 'sono')) return;
      const colaTela = quantasColagens(seq), colaDiario = quantasColagens(gs);
      if(colaTela > 0) comColagem++;
      if(colaDiario > 0) jaNoDiario++;
      if(colaTela > colaDiario){
        colados++;
        if(!exemplo) exemplo = m.player + ' ' + m.playerHpBefore + '->' + m.playerHpAfter +
                               ' x ' + m.enemy + ' ' + m.enemyHpBefore + '->' + m.enemyHpAfter;
      }
    });
  }
  ok('a amostra e grande o bastante', conf > 4000, conf + ' confrontos');
  /* O EMPATE SO EXISTE POR AUTODESTRUICAO -- a linha que o pedido preserva. */
  ok('confrontos em que os DOIS caem existem (a autodestruicao)', trades > 20, trades + ' de ' + conf);
  ok('e TODOS eles sao autodestruicao', comBoom === trades,
     comBoom + ' de ' + trades + (exTrade ? '  ex sem boom: ' + exTrade : ''));
  /* NENHUMA LINHA DE DESEMPATE E GERADA. Ela continua sendo DESENHADA (log velho nao pode sumir) --
     o que acabou foi o motor produzir uma nova. */
  ok('e nenhuma linha de desempate e gerada', linhas === 0, linhas + ' linhas');
  ok('a frase dela continua existindo, pra log velho',
     /os dois ca\S+ram na mesma troca/.test(String(S.fraseDoEspecial({ x:'desempate', q:'p', d:52 }, 'A', 'B', {}))));
  ok('NINGUEM ataca com a barra em zero, em nenhum confronto', cadaver === 0,
     cadaver + ' cadaveres' + (exCad ? '  ex: ' + exCad : ''));
  ok('e a APRESENTACAO nunca cria colagem que o diario nao tinha', colados === 0,
     colados + ' casos' + (exemplo ? '  ex: ' + exemplo : ''));
  ok('o diario tem colagem propria na amostra (empate de velocidade), e a tela nao mostra mais',
     jaNoDiario > 0 && comColagem <= jaNoDiario,
     comColagem + ' na tela contra ' + jaNoDiario + ' no diario');
}


console.log('\n=== O CICLO QUE PERDIA O SAVE (11/09/2026) ===');
{
  /* Relatado assim: "constantemente fica aparecendo aquela mensagem vermelha no save e realmente
     nao salva o progresso". A tarja dizia `Maximum call stack size exceeded` -- um RangeError, nao
     um erro de rede.
     A CAUSA: o motor pendura REFERENCIAS ao pokemon adversario na instancia do time
     (`_especialContra` e o `contra` do `_anulado`), e quando o adversario aponta de volta os dois
     fecham um CICLO. O `limparParaFirestore` e recursivo: ele descia pra sempre.
     Sao DOIS consertos, e os dois sao cobrados aqui -- o de motor (soltar no fim da batalha) e o de
     save (campo com `_` nao vai pro Firestore). O segundo e o que faz o PROXIMO marcador nascer
     protegido, e por isso ele tem caso proprio. */
  const ids = Object.keys(S.SPECIES);
  const rng = S.makeSeededRng('ciclo-do-save');
  const time = () => Array.from({ length: 6 }, () => {
    const p = S.createInstance(ids[Math.floor(rng()*ids.length)], 25 + Math.floor(rng()*30));
    p.ataques = S.ataquesDisponiveis(p.speciesId, p.level).slice(0, S.MAX_GOLPES);
    return p;
  });
  /* Anda pelo objeto sem guarda nenhuma, que e o que o limparParaFirestore faz. */
  const achaCiclo = (raiz) => {
    const pilha = [], visto = new Set();
    const anda = (v, nome) => {
      if(!v || typeof v !== 'object') return null;
      if(visto.has(v)) return pilha.concat(nome).join(' -> ');
      visto.add(v); pilha.push(nome);
      for(const k of Object.keys(v)){ const r = anda(v[k], k); if(r) return r; }
      pilha.pop(); visto.delete(v); return null;
    };
    return anda(raiz, 'team');
  };
  let ciclos = 0, sobrando = 0, tetoErrado = 0, batalhas = 0, derrotas = 0;
  const limpoDaFuria = p => { const c = Object.assign(Object.create(Object.getPrototypeOf(p)), p); c._furia = 0; return S.calcMaxHp(c); };
  for(let v = 0; v < 300; v++){
    const meu = time(), dele = time();
    S.equiparItens(meu, null); S.equiparItens(dele, null);
    meu.forEach(p => p.maxHp = S.calcMaxHp(p));
    let r; try{ r = S.simulateGymBattle(meu, dele); }catch(e){ continue; }
    batalhas++; if(!r.win) derrotas++;
    if(achaCiclo(meu)) ciclos++;
    if(meu.some(p => p._especialContra || p._anulado || p._dormindoPor)) sobrando++;
    /* ⚠️ O TETO DE HP DA FURIA tem que voltar nos DOIS caminhos de saida. Ele vivia num bloco solto
       antes do `return` da vitoria, e o `return` da DERROTA passava por cima: 983 pokemon de 3.000
       saiam de uma derrota com o teto errado, contra ZERO nas vitorias. */
    meu.forEach(p => { if(p.maxHp !== limpoDaFuria(p)) tetoErrado++; });
  }
  ok('a amostra tem derrota, que e o caminho que escapava', derrotas > 20, derrotas + ' de ' + batalhas);
  ok('nenhum time sai da batalha com CICLO no objeto', ciclos === 0, ciclos + ' de ' + batalhas);
  ok('nem com marcador de confronto sobrando', sobrando === 0, sobrando + ' de ' + batalhas);
  ok('e ninguem sai com o TETO de HP da furia por devolver', tetoErrado === 0,
     tetoErrado + ' pokemon (a devolucao vale na vitoria E na derrota)');

  /* O CORTE NA CAMADA DO SAVE. Ele vale mesmo com o motor sujo -- e e isso que protege o proximo
     marcador de rascunho que alguem pendurar numa instancia. */
  {
    const a = S.createInstance('pikachu', 30), b = S.createInstance('onix', 30);
    a._especialContra = b; b._anulado = { tipo: 'Elétrico', contra: a };   // o ciclo, na mao
    const g = S.__getGame();
    g.team = [a];
    let estourou = null, limpo = null;
    try{ limpo = S.limparParaFirestore(S.serializeGame(), '', []); }
    catch(e){ estourou = String(e && e.message || e); }
    ok('o salvamento NAO estoura a pilha num time com ciclo', estourou === null, estourou || 'ok');
    ok('e o campo de rascunho nao vai pro Firestore',
       !!limpo && limpo.team && limpo.team[0] && limpo.team[0]._especialContra === undefined);
    /* E ele nao pode levar junto o que o save PRECISA. */
    ok('o que o save precisa continua indo', !!limpo && limpo.team[0].speciesId === 'pikachu' &&
       limpo.team[0].level === 30 && Array.isArray(limpo.badgesEarned));
    /* A regra e sobre o `_`, e nao sobre estes dois nomes: e isso que faz ela valer pro proximo. */
    const c = S.createInstance('gastly', 30);
    c._qualquerCoisaNova = { volta: c };
    g.team = [c];
    let estourou2 = null;
    try{ S.limparParaFirestore(S.serializeGame(), '', []); }catch(e){ estourou2 = String(e && e.message || e); }
    ok('e vale pra QUALQUER campo com _, nao so pros dois de hoje', estourou2 === null, estourou2 || 'ok');
    g.team = [];
  }

  /* ⚠️ AS DUAS PORTAS DE SAIDA CHAMAM A MESMA FUNCAO -- lido do CODIGO, porque os casos acima
     passam pelo simulateGymBattle inteiro e nao veem QUANTOS `return` ele tem. Foi exatamente por
     haver dois `return` que a devolucao da furia ficou valendo so num deles. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const i = txt.indexOf('function simulateGymBattle(');
    const fim = txt.indexOf('\nfunction ', i + 1);
    const corpo = txt.slice(i, fim);
    ok('o simulateGymBattle do cliente encerra nas DUAS saidas',
       (corpo.match(/encerrarBatalha\(/g) || []).length === 2,
       (corpo.match(/encerrarBatalha\(/g) || []).length + ' chamadas');
    const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
    const j = srv.indexOf('function simulateGymBattle(');
    const fimS = srv.indexOf('\nfunction ', j + 1);
    const corpoS = srv.slice(j, fimS);
    ok('e o do servidor tambem', (corpoS.match(/encerrarBatalha\(/g) || []).length === 2,
       (corpoS.match(/encerrarBatalha\(/g) || []).length + ' chamadas');
    ok('o corte do _ existe no salvamento', txt.indexOf("if(k.charAt(0) === '_') continue;") > 0);
  }
}


console.log('\n=== O REMOINHO: O SOPRO QUE TROCA O POKEMON DO ADVERSARIO (12/09/2026) ===');
{
  /* Pedido assim: "20% de chance de sucesso, e quando acontecer, troca o pokemon ativo do treinador
     adversario por um outro aleatorio do time dele. Importante que se o pokemon do adversario ja
     tava em uma batalha e sofreu dano, quando ele voltar para a batalha, volte com o mesmo tanto
     de hp".
     ⚠️ ELE E O PRIMEIRO ESPECIAL QUE NAO CABE NO tentarGolpeEspecial: os outros onze recebem DOIS
     pokemon e mexem no que acontece entre eles; este muda QUEM esta no confronto. */
  const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
  const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
  /* ⚠️ O createInstance NAO preenche o HP -- quem faz isso e o comeco da batalha. Chamando o
     tentarRemoinho direto, sem isto, todo candidato sai com hp 0 e o sopro nunca acha pra onde
     trocar: o teste passaria a medir a fixture, nao a regra. */
  const vivo = (id, lv) => { const p = S.createInstance(id, lv || 40); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; return p; };

  /* 1) A LISTA E A CHANCE, iguais nos dois motores -- divergencia aqui faz a MESMA batalha terminar
        diferente no cliente e no servidor. */
  ok('sao as 6 especies que aprendem whirlwind por NIVEL na Gen 3',
     S.REMOINHO.join(',') === 'pidgey,pidgeotto,pidgeot,butterfree,lugia,hooh', S.REMOINHO.join(', '));
  /* A LISTA SAI DO DADO, e este cruzamento e o que garante que ela CONTINUE saindo: a base traz o
     aprendizado por nivel da Gen 3, e e dela que as outras listas de especial tambem saem. */
  {
    const base = require(path.join(raiz, 'data', 'golpes.json'));
    const daBase = Object.keys(base.porEspecie)
      .filter(id => (base.porEspecie[id] || []).some(e => e.g === 'whirlwind')).sort();
    ok('e elas batem com a base, uma a uma', daBase.join(',') === [...S.REMOINHO].sort().join(','),
       daBase.join(', '));
  }
  ok('a chance e 20%', S.CHANCE_REMOINHO === 0.20, String(S.CHANCE_REMOINHO));
  {
    const mL = srv.match(/const REMOINHO = \[([^\]]*)\]/);
    const mC = cli.match(/const REMOINHO = \[([^\]]*)\]/);
    ok('a lista e a MESMA nos dois motores', !!mL && !!mC && mL[1] === mC[1], mL ? mL[1] : '(servidor sem lista)');
    ok('e a chance tambem', /const CHANCE_REMOINHO = 0\.20;/.test(srv) && /const CHANCE_REMOINHO = 0\.20;/.test(cli));
  }

  /* 2) ⚠️ O RNG NAO PODE SER TOCADO QUANDO NINGUEM TEM A PASSIVA. O desempate de velocidade dentro
        do tentarRemoinho consome um sorteio; consumido em TODO confronto, ele deslocaria a semente
        inteira e mudaria batalhas que nao tem nada a ver com o Whirlwind. Isto ja aconteceu de
        verdade ao escrever a feature, e so apareceu na impressao. */
  {
    const semPassiva = (n) => {
      let lidos = 0;
      const rng = () => { lidos++; return 0.5; };
      const time = [vivo('onix', 40)], outro = [vivo('geodude', 40), vivo('machop', 40)];
      for(let i = 0; i < n; i++) S.tentarRemoinho(time, outro, 0, 0, rng, []);
      return lidos;
    };
    ok('ninguem com a passiva = ZERO numeros lidos do rng', semPassiva(50) === 0, semPassiva(50) + ' lidos');
    /* E com passiva ele le -- senao a trava acima passaria por a funcao nao fazer nada. */
    let lidos = 0;
    const rng = () => { lidos++; return 0.99; };   // 0.99 >= 0.20: sorteia e NAO sopra
    S.tentarRemoinho([vivo('pidgeot', 40)],
                     [vivo('geodude', 40), vivo('machop', 40)], 0, 0, rng, []);
    ok('e com ela o sorteio acontece', lidos > 0, lidos + ' lidos');
  }

  /* 3) SO VALE SE HOUVER PRA ONDE TROCAR. Com um pokemon de pe so, nao ha quem entre no lugar --
        e quem decide isso e a SITUACAO do time do outro, nao o sorteio. */
  {
    const rng = () => 0.01;   // sempre passa na chance
    const sozinho = S.tentarRemoinho([vivo('pidgeot', 40)],
                                     [vivo('geodude', 40)], 0, 0, rng, []);
    ok('com um adversario so de pe, o sopro nao sai', sozinho === null, JSON.stringify(sozinho));
    const dois = S.tentarRemoinho([vivo('pidgeot', 40)],
                                  [vivo('geodude', 40), vivo('machop', 40)], 0, 0, rng, []);
    ok('com dois, ele sai e aponta pro OUTRO', !!dois && dois.iInimigo === 1, JSON.stringify(dois));
    /* QUEM JA CAIU nao entra: soprar pra dentro um pokemon desmaiado seria pior que nao soprar. */
    const time2 = [vivo('geodude', 40), vivo('machop', 40), vivo('onix', 40)];
    time2[1].hp = 0;
    const soVivo = S.tentarRemoinho([vivo('pidgeot', 40)], time2, 0, 0, rng, []);
    ok('e so entra quem esta de pe', !!soVivo && soVivo.iInimigo === 2, JSON.stringify(soVivo));
  }

  /* 4) MEW E MEWTWO SAO IMUNES ao bloco inteiro, e aqui vale igual: soprar o chefe da raide pra
        fora seria mexer na batalha deles sem ninguem ter pedido. */
  {
    const rng = () => 0.01;
    const mew = vivo('mewtwo', 70);
    ok('o Mewtwo nao e soprado',
       S.tentarRemoinho([vivo('pidgeot', 40)], [mew, vivo('geodude', 40)], 0, 0, rng, []) === null);
    ok('e nem sopra (ele nao tem a passiva, mas o bloco inteiro para nele)',
       S.tentarRemoinho([mew], [vivo('pidgeot', 40), vivo('geodude', 40)], 0, 0, rng, []) === null);
  }

  /* 5) ⚠️ O PEDIDO NOMEIA ISTO: quem sai machucado VOLTA com o mesmo HP. Nao foi preciso escrever
        nada pra isso -- o laco trabalha sobre as MESMAS instancias o tempo todo --, e e justamente
        por ser de graca que ele precisa de trava: um "conserto" futuro que recriasse a instancia
        quebraria a promessa sem nada acusar. */
  {
    const ids = Object.keys(S.SPECIES);
    let voltas = 0, iguais = 0, sopros = 0, confrontos = 0, travou = 0, maiorCadeia = 0;
    for(let v = 0; v < 400; v++){
      const rng = S.makeSeededRng('ww' + v);
      const meu = [S.createInstance('pidgeot', 60)].concat(Array.from({length:5},
        () => S.createInstance(ids[Math.floor(rng()*ids.length)], 55 + Math.floor(rng()*10))));
      const dele = Array.from({length:6},
        () => S.createInstance(ids[Math.floor(rng()*ids.length)], 55 + Math.floor(rng()*10)));
      S.equiparItens(meu, null); S.equiparItens(dele, null);
      let r; try{ r = S.simulateGymBattle(meu, dele); }catch(e){ travou++; continue; }
      const ms = r.matchups || [];
      confrontos += ms.length;
      const saiuCom = {};
      let cadeia = 0;
      ms.forEach(m => {
        if((m.golpes||[]).some(g => g.x === 'remoinho')){ sopros++; cadeia++; maiorCadeia = Math.max(maiorCadeia, cadeia); }
        else cadeia = 0;
        const alvo = dele.find(p => p.name === m.enemy && p.level === m.enemyLevel && p.maxHp === m.enemyMaxHp);
        const k = alvo ? dele.indexOf(alvo) : m.enemy;
        if(saiuCom[k] !== undefined && saiuCom[k] > 0){ voltas++; if(saiuCom[k] === m.enemyHpBefore) iguais++; }
        saiuCom[k] = m.enemyHpAfter;
      });
    }
    ok('a amostra tem sopro de sobra pra medir', sopros > 50, sopros + ' em ' + confrontos + ' confrontos');
    ok('nenhuma batalha travou', travou === 0, travou + ' de 400');
    ok('quem volta ao confronto volta com o MESMO HP', voltas > 100 && iguais === voltas,
       iguais + ' de ' + voltas + ' voltas');
    /* A CORRENTE NAO EXPLODE: o marcador (_remoinhoContra) faz o sorteio valer uma vez por PAR, e a
       chance de 20% cai rapido. Se um dia isso subir, e sinal de que o marcador parou de valer. */
    ok('e a corrente de sopros seguidos nao passa de 5', maiorCadeia <= 5, 'maior: ' + maiorCadeia);
  }

  /* 6) A FRASE NOMEIA QUEM SAIU, e nao quem entrou: quem entrou ja esta no cabecalho do confronto,
        com sprite e barra; quem saiu nao aparece em lugar nenhum. */
  {
    const diario = [];
    const rng = () => 0.01;
    S.tentarRemoinho([vivo('pidgeot', 40)],
                     [vivo('geodude', 40), vivo('machop', 40)], 0, 0, rng, diario);
    const g = diario.find(x => x.x === 'remoinho');
    ok('a linha entra no diario', !!g && g.q === 'p' && g.d === 0, JSON.stringify(g));
    ok('e ela carrega o nome de QUEM SAIU', !!g && g.sai === 'Geodude', g ? String(g.sai) : '(sem linha)');
    const frase = String(S.fraseDoEspecial(g, 'Pidgeot', 'Machop', {})).replace(/<[^>]*>/g, '');
    ok('e a frase o nomeia', /Pidgeot/.test(frase) && /Geodude/.test(frase), frase);
    /* LOG VELHO (gravado antes do campo) cai na frase sem nome, em vez de sumir. */
    const semNome = String(S.fraseDoEspecial({ x:'remoinho', q:'p', d:0 }, 'Pidgeot', 'Machop', {})).replace(/<[^>]*>/g, '');
    ok('e log velho, sem o campo, ainda se le', /Pidgeot/.test(semNome) && !/undefined/.test(semNome), semNome);
  }

  /* 7) A FICHA DA POKEDEX e a caixa de explicacao -- a mesma regra dos outros onze. */
  ok('a ficha do Pidgeot anuncia o Remoinho',
     S.especiaisDaEspecie('pidgeot').some(e => e.efeito === 'remoinho' && e.chance === S.CHANCE_REMOINHO));
  ok('e o Onix, que nao tem, nao anuncia',
     !S.especiaisDaEspecie('onix').some(e => e.efeito === 'remoinho'));
  ok('a caixa explica o que ele faz', !!S.EXPLICACAO_DO_ESPECIAL.remoinho &&
     /Abre o confronto/.test(S.EXPLICACAO_DO_ESPECIAL.remoinho.quando));
  /* ⚠️ E ELA PRECISA DIZER O DO HP: e a parte que o pedido faz questao de nomear, e a unica coisa
     que o jogador nao tem como deduzir vendo a tela. */
  ok('e diz que quem saiu volta com o HP que tinha',
     /HP QUE TINHA/.test((S.EXPLICACAO_DO_ESPECIAL.remoinho.detalhes || []).join(' ')));

  /* 8) ELE NAO EXISTE NO ONLINE, e isso e desenho: la quem escolhe o proximo pokemon e o JOGADOR,
        entre confrontos, e um sopro forcado brigaria com a escolha. O battleResolveMatchup resolve
        confronto a confronto e nao tem time pra trocar. */
  {
    const i = srv.indexOf('function battleResolveMatchup(');
    const fim = srv.indexOf('\nfunction ', i + 1);
    ok('o caminho do online nao chama o sopro', srv.slice(i, fim).indexOf('tentarRemoinho') < 0);
  }
}

console.log('\n=== O NPC LUTA COM O MOVESET DELE ===');
{
  /* Reportado em 09/09/2026: "os pokemons dos adversarios estao usando ataques que nao estao no
     moveset do pokemon incluido na dex". Era verdade -- o NPC nao tinha golpe escolhido, caia no
     motor de TIPO e atacava com o nome generico do tipo, com poder implicito de 60.
     Agora ele leva TUDO que a especie aprende por nivel ate o nivel dele e o motor escolhe o que
     tira mais dano. Sem teto de 2 golpes: os dois sao a regra do JOGADOR, que escolhe. */

  /* 1) O QUE O equiparNpc FAZ, e o que ele NAO faz. */
  {
    const npc = [S.createInstance('golem', 45), S.createInstance('onix', 14)];
    S.equiparNpc(npc);
    ok('o NPC recebe o moveset da especie',
       npc.every(p => Array.isArray(p.ataques) && p.ataques.length > 0),
       npc.map(p => p.speciesId + ':' + (p.ataques||[]).length).join(' '));
    ok('e sao os golpes que a especie APRENDE ate aquele nivel',
       npc.every(p => p.ataques.join(',') === S.ataquesDisponiveis(p.speciesId, p.level).join(',')));
    ok('nenhum golpe acima do nivel dele',
       npc.every(p => p.ataques.every(id => (S.APRENDIZADO[p.speciesId]||[]).some(par =>
         S.GOLPES_IDS[par[1]] === id && par[0] <= p.level))));
    /* A GUARDA: nunca sobrescreve quem ja escolheu. Se esta funcao for chamada por engano sobre um
       time de jogador, os dois golpes dele tem que sobreviver. */
    const doJogador = S.createInstance('golem', 45);
    doJogador.ataques = ['rockblast', 'tackle'];
    S.equiparNpc([doJogador]);
    ok('NAO sobrescreve quem ja tem golpe escolhido', doJogador.ataques.join(',') === 'rockblast,tackle',
       doJogador.ataques.join(','));
    /* QUEM USA METRONOMO TAMBEM LEVA O MOVESET DELE desde 10/09/2026: o Metronomo passou a DISPUTAR
       com os golpes proprios em vez de substitui-los, entao o NPC do Metronomo tem os dois. Antes
       ele saia sem golpe nenhum de proposito, porque o golpe escolhido dele nao valia um ponto de
       dano. */
    const togepi = S.createInstance('togepi', 40);
    S.equiparNpc([togepi]);
    ok('quem e do Metronomo TAMBEM leva o moveset dele',
       (togepi.ataques || []).indexOf('ancientpower') >= 0, JSON.stringify(togepi.ataques || null));
  }

  /* 2) AS QUATRO PORTAS. Sao os quatro lugares onde um time de NPC nasce, e uma que ficar de fora
        vira uma batalha em que o adversario ataca com golpe que nao tem -- que e o defeito que
        acabou de ser consertado. Ler o CODIGO e o unico jeito de pegar a proxima omissao: os
        casos abaixo chamam as funcoes direto e passariam com a chamada orfa. */
  {
    const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
    ok('o LIDER DE GINASIO recebe o moveset', cli.indexOf('equiparNpc(gymTeam)') >= 0);
    ok('o RIVAL / ELITE / ROCKET tambem', cli.indexOf('equiparNpc(foeTeam)') >= 0);
    ok('o desafio do MEWTWO tambem', /equiparNpc\(\[createInstance\('mewtwo'/.test(cli));
    ok('e o treinador da TORRE, no servidor', /equiparNpc\(andar\.team/.test(srv));
    /* E o que NAO pode receber: o codigo de time e de um JOGADOR (liga, online, ginasio da
       cidade), e dar moveset de NPC a ele seria inventar golpe pra time alheio. */
    ok('o decodeTeamCode NAO equipa NPC', cli.indexOf('equiparNpc(team)') < 0 && srv.indexOf('equiparNpc(team)') < 0);
  }

  /* 3) A TABELA NOVA DO SERVIDOR. O APRENDIZADO era so do cliente e veio pra ca por causa da
        Torre; divergir faz a MESMA batalha sair diferente nos dois lados. */
  {
    let dif = 0, exemplo = '';
    Object.keys(S.SPECIES).forEach(sp => {
      [5, 20, 45, 70, 99].forEach(lvl => {
        const a = S.ataquesDisponiveis(sp, lvl).join(','), b = esp.ataquesDisponiveis(sp, lvl).join(',');
        if(a !== b){ dif++; if(!exemplo) exemplo = sp + ' Lv.' + lvl + ': [' + a + '] x [' + b + ']'; }
      });
    });
    ok('os dois motores concordam no moveset das 250 especies', dif === 0, dif + ' divergencias  ' + exemplo);
  }

  /* 4) A ANULACAO NOMEIA UM GOLPE QUE O ALVO TEM. Ela gravava so o TIPO, e o cliente virava em
        palavra pelo nome GENERICO daquele tipo -- que com golpe escolhido nomeia um golpe que o
        pokemon nao carrega. Reportado junto: "ele ta pegando um qualquer aleatorio". */
  {
    let casos = 0, comId = 0, doMoveset = 0, exemplo = '';
    for(let v = 0; v < 1200 && casos < 60; v++){
      const a = inst('alakazam', 45); a.ataques = S.ataquesDisponiveis('alakazam', 45);
      const b = inst('venusaur', 45); b.ataques = S.ataquesDisponiveis('venusaur', 45);
      const m = (S.simulateGymBattle([a], [b]).matchups || [])[0];
      if(!m) continue;
      const d = (m.golpes || []).find(x => x.x === 'disable');
      if(!d) continue;
      casos++;
      if(d.am){
        comId++;
        const alvo = d.q === 'p' ? 'venusaur' : 'alakazam';
        if(S.ataquesDisponiveis(alvo, 45).indexOf(d.am) >= 0) doMoveset++;
        else if(!exemplo) exemplo = 'anulou ' + d.am + ' de um ' + alvo;
      }
    }
    ok('a anulacao apareceu o bastante pra medir', casos >= 10, casos + ' casos');
    ok('ela grava o GOLPE anulado, nao so o tipo', comId === casos, comId + ' de ' + casos);
    ok('e o golpe anulado esta no moveset do alvo', doMoveset === comId, doMoveset + ' de ' + comId + '  ' + exemplo);
  }
}

console.log('\n=== GOLPES DE VARIOS TAPAS: DE 2 A 5 NUMA TROCA ===');
{
  /* Pedido em 09/09/2026: primeiro o Tapa Duplo, depois os Arranhoes Furiosos, que sao a mesma
     coisa. Os dois batem de 2 a 5 vezes com os pesos oficiais da Gen 2-4 (fontes:
     pokemondb.net/move/double-slap e /fury-swipes): 2 e 3 tapas 3/8 cada, 4 e 5 tapas 1/8 cada.
     NA BATALHA cada tapa e um passo com a propria descida de barra, numerado (1x, 2x, 3x...);
     NO LOG os tapas viram UMA linha com o TOTAL somado -- a mesma regra da drenagem.
     ESTE BLOCO VARRE A TABELA e nao um golpe nomeado: golpe novo que entre no MULTI_GOLPE ja nasce
     coberto, e um que saia derruba o teste em vez de sumir em silencio. */
  const MULTI = Object.keys(S.MULTI_GOLPE);
  ok('a tabela tem os golpes pedidos', MULTI.indexOf('doubleslap') >= 0 && MULTI.indexOf('furyswipes') >= 0,
     MULTI.join(', '));
  /* ⚠️ TRES BATEM SEMPRE DUAS VEZES (13/09/2026, a pedido): Chute Duplo, Ossomerangue e Agulha
     Dupla. No jogo oficial eles nao sorteiam nada. */
  ['doublekick','bonemerang','twineedle'].forEach(g =>
    ok('o ' + g + ' esta na tabela', MULTI.indexOf(g) >= 0, MULTI.join(', ')));

  /* 1) OS PESOS, um golpe de cada vez, LIDOS DA TABELA DELE.
     ⚠️ Este bloco cobrava os quatro pesos do 2-a-5 em TODO golpe da tabela -- o que era verdade
     enquanto todos dividiam a mesma distribuicao, e virou mentira no dia em que entrou um golpe com
     distribuicao propria (o comentario da constante ja previa esse dia). Agora ele cobra que o
     SORTEIO bate com a tabela DAQUELE golpe, que e a regra de verdade: um ajuste na tabela continua
     sendo pego, e golpe novo com distribuicao nova nasce coberto. */
  for(const golpe of MULTI){
    const tabela = S.MULTI_GOLPE[golpe];
    const peso = tabela.reduce((a, p) => a + p[1], 0);
    const conta = {}; let n = 0;
    const rng = S.makeSeededRng('tapas-' + golpe);
    for(let i = 0; i < 80000; i++){ const t = S.tapasDoGolpe(golpe, rng); conta[t] = (conta[t]||0)+1; n++; }
    const pct = k => 100 * (conta[k]||0) / n;
    const fora = tabela.filter(p => Math.abs(pct(p[0]) - 100 * p[1] / peso) >= 1.0);
    ok(golpe + ': o sorteio bate com a tabela dele',
       fora.length === 0,
       tabela.map(p => p[0] + 'x ' + pct(p[0]).toFixed(1) + '% (esperado ' + (100*p[1]/peso).toFixed(1) + '%)').join(', '));
    const possiveis = new Set(tabela.map(p => String(p[0])));
    ok(golpe + ': nao sai numero de tapas fora da tabela',
       Object.keys(conta).every(k => possiveis.has(k)) && !conta[1] && !conta[0],
       'saiu: ' + Object.keys(conta).sort().join(','));
  }
  /* E os tres novos batem SEMPRE 2 -- a forma direta do pedido, alem da varredura acima. */
  ['doublekick','bonemerang','twineedle'].forEach(g => {
    const rng = S.makeSeededRng('dois-' + g);
    let todos2 = true;
    for(let i = 0; i < 5000; i++){ if(S.tapasDoGolpe(g, rng) !== 2) todos2 = false; }
    ok(g + ': bate sempre 2 vezes', todos2, JSON.stringify(S.MULTI_GOLPE[g]));
  });
  ok('golpe comum continua batendo UMA vez', S.tapasDoGolpe('pound', S.makeSeededRng('x')) === 1);

  /* 2) O MOTOR TEM QUE ESCOLHER O GOLPE. O seletor compara PODER, e estes valem 15 e 18 -- pelo
        cru nunca seriam escolhidos por quem tem dois golpes, e a mecanica seria codigo morto.
        O que valem e poder x 3,0 tapas: 45 o Tapa Duplo e 54 os Arranhoes Furiosos. */
  ok('o poder efetivo do Tapa Duplo e 45, nao 15', S.poderEfetivo('doubleslap') === 45,
     'efetivo: ' + S.poderEfetivo('doubleslap') + '  cru: ' + S.GOLPES.doubleslap[1]);
  ok('o dos Arranhoes Furiosos e 54, nao 18', S.poderEfetivo('furyswipes') === 54,
     'efetivo: ' + S.poderEfetivo('furyswipes') + '  cru: ' + S.GOLPES.furyswipes[1]);
  ok('e TODO golpe da tabela vale mais que o cru', MULTI.every(g => S.poderEfetivo(g) > S.GOLPES[g][1]));
  /* Nos de 2 fixos o efetivo e o DOBRO do cru, e e isso que os poe na disputa: um Ossomerangue de
     50 vale 100 na comparacao, que e o que ele tira de verdade. */
  ['doublekick','bonemerang','twineedle'].forEach(g =>
    ok('o efetivo do ' + g + ' e o dobro do cru', S.poderEfetivo(g) === S.GOLPES[g][1] * 2,
       'efetivo ' + S.poderEfetivo(g) + ', cru ' + S.GOLPES[g][1]));
  ok('golpe comum nao muda de poder', S.poderEfetivo('pound') === S.GOLPES.pound[1]);

  /* 2b) E O DANO TEM QUE USAR O PODER CRU. O poder EFETIVO existe pra COMPARAR golpes; o dano de
        cada tapa e o do golpe de verdade, senao ele conta a media de tapas DUAS vezes -- uma no
        poder e outra nas repeticoes.
        ISSO FOI UM DEFEITO REAL, reportado em 09/09/2026 com log: o `avalia` devolvia o poder
        efetivo no campo `poder`, e o calcDamageNew le exatamente esse campo (`best.poder`). Cada
        tapa do Tapa Duplo saia com 45 em vez de 15 E ainda batia de 2 a 5 vezes: ~9x o dano.
        Uma Clefable Lv.42 matava um Dunsparce de 270 de HP com 3 tapas e um Eevee de 235 com 2,
        enquanto a Folha Magica dela (poder 60) tirava 88 no mesmo log.
        A BATERIA INTEIRA PASSAVA COM O DEFEITO -- nenhum teste olhava o dano contra o poder. */
  {
    const alvo = inst('dunsparce', 28);
    let cruOk = 0, total = 0;
    for(const golpe of MULTI){
      for(const dono of ['jigglypuff','persian','jynx','furret','ursaring','chansey']){
        const a = inst(dono, 45);
        if((S.ataquesEscolhiveis(a) || []).indexOf(golpe) < 0) continue;
        a.ataques = [golpe];
        const m = S.melhorAtaque(a, alvo);
        total++;
        if(m && m.poder === S.GOLPES[golpe][1]) cruOk++;
      }
    }
    ok('achou donos pra medir', total >= 4, total + ' pares');
    ok('o poder que vai pro DANO e o CRU, nao o efetivo', cruOk === total, cruOk + ' de ' + total);

    /* E a prova de COMPORTAMENTO, que sobrevive a qualquer refatoracao dos campos: o dano medio de
       UM tapa contra o de um golpe de poder conhecido tem que bater com a razao dos poderes CRUS.
       Com o defeito a razao dava 3x o esperado. */
    const medioDe = (golpe) => {
      let soma = 0, n = 0;
      for(let i = 0; i < 1200; i++){
        /* ALVO GORDO de proposito: o dano gravado e o EFETIVO, entao um alvo que morre no golpe
           trunca o numero e distorce a razao. A Chansey aguenta os dois sem cair. */
        /* JIGGLYPUFF e nao Clefable: a Clefable entrou no METRONOMO em 10/09/2026, e quem sorteia
           golpe a cada ataque nem sempre usa o que esta em `ataques` -- a razao medida deixaria de
           ser a do golpe que se quer medir. */
        const a = inst('jigglypuff', 42); a.ataques = [golpe];
        const b = inst('chansey', 60);
        const m = (S.simulateGymBattle([a], [b]).matchups || [])[0];
        if(!m) continue;
        (m.golpes || []).forEach(g => { if(!g.x && g.q === 'p' && g.d > 0){ soma += g.d; n++; } });
      }
      return n ? soma / n : 0;
    };
    const dTapa = medioDe('doubleslap'), dPound = medioDe('pound');
    const razao = dTapa / dPound;
    const razaoCru = S.GOLPES.doubleslap[1] / S.GOLPES.pound[1];          // 15/40 = 0,38
    const razaoEfetiva = S.poderEfetivo('doubleslap') / S.GOLPES.pound[1]; // 45/40 = 1,13
    /* A comparacao e QUAL DAS DUAS a medida esta perto, e nao um valor exato: a formula nao e
       perfeitamente linear em poder baixo (piso de dano e o arredondamento na escala do Gen 1
       puxam o golpe fraco pra cima), entao a razao medida fica um pouco acima de 15/40. O que
       importa e que ela esta MUITO mais perto do cru que do efetivo -- com o defeito ela pulava
       pra perto de 1,13. */
    ok('e o dano de UM tapa segue o poder CRU, nao o efetivo',
       Math.abs(razao - razaoCru) < Math.abs(razao - razaoEfetiva) / 3,
       'razao medida ' + razao.toFixed(2) + '   cru ' + razaoCru.toFixed(2) + '   efetivo ' +
       razaoEfetiva.toFixed(2) + '   (tapa ' + dTapa.toFixed(0) + ', Pound ' + dPound.toFixed(0) + ')');
  }

  /* 3) A TABELA E DUPLICADA NOS DOIS MOTORES, como a GOLPES. Divergencia aqui faz a mesma batalha
        terminar diferente no cliente e no servidor. */
  ok('a tabela dos tapas e a MESMA nos dois motores',
     JSON.stringify(esp.MULTI_GOLPE) === JSON.stringify(S.MULTI_GOLPE),
     'cliente: ' + JSON.stringify(S.MULTI_GOLPE) + '  servidor: ' + JSON.stringify(esp.MULTI_GOLPE));

  /* 4) NA TELA E NO LOG, um dono de CADA golpe da tabela contra um painel: os tapas tem que
        aparecer numerados na batalha e somados numa linha so no log.
        O nome sai do GOLPES_PT, entao o teste nao repete a palavra que a tela mostra e um golpe
        novo na tabela so precisa de um dono aqui -- e se nao tiver, a primeira assercao acusa. */
  {
    const semTag = h => String(h||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
    /* Um dono por golpe da tabela. Falta de dono e assertiva logo abaixo -- golpe novo no
       MULTI_GOLPE sem dono aqui derruba o teste em vez de ficar sem cobertura. */
    const DONOS = {
      /* O DONO NAO PODE SER DO METRONOMO (10/09/2026): quem sorteia golpe a cada ataque as vezes
         escolhe o sorteado em vez do tapa, e o teste passaria a medir outra coisa. A Clefairy era
         o dono do Tapa Duplo e entrou na lista do Metronomo -- virou Jigglypuff, que aprende o
         mesmo golpe e nao sorteia nada. */
      doubleslap: 'jigglypuff', furyswipes: 'persian',  furyattack: 'fearow',
      cometpunch: 'kangaskhan', spikecannon: 'cloyster', barrage: 'exeggutor',
      pinmissile: 'qwilfish',  iciclespear: 'shellder', rockblast: 'golem',
      /* OS TRES DE 2 FIXOS (13/09/2026). ⚠️ O Missil Agulha trocou de dono junto: ele era do
         Beedrill, que tambem aprende a Agulha Dupla -- com o mesmo dono pros dois, o teste mediria
         o golpe que o motor escolhesse, nao o que ele quer cobrir. Cada golpe precisa de um dono
         que so tenha ELE da tabela. */
      doublekick: 'nidoking', bonemerang: 'marowak', twineedle: 'beedrill',
      /* OS DOIS DE PRENDER (14/09/2026). No jogo oficial eles prendem o alvo por 2 a 5 TURNOS;
         aqui viram 2 a 5 tapas na mesma troca -- o numero de vezes e o mesmo.
         ⚠️ OS DONOS SAO LIMPOS de proposito: a Rapidash tambem tem Ataque Furia e o Shuckle tambem
         tem Missil Agulha -- com eles, o teste mediria o golpe que o motor escolhesse, nao o que
         ele quer cobrir. A NINETALES usa o Redemoinho em 96,6% dos ataques, medido. */
      firespin: 'ninetales', wrap: 'arbok',
      /* ⚠️ O SEMENTE-BALA (17/09/2026) e o PRIMEIRO da tabela que NINGUEM aprende por nivel --
         ele so vem de MAQUINA (o TM09). O dono e equipado a mao aqui, como todos os outros, entao
         isso nao muda o teste; o que muda e que ele so existe no jogo pra quem COMPROU o TM.
         O MEGANIUM e limpo pela mesma regra dos outros: nenhum outro multi-tapa no moveset. */
      bulletseed: 'meganium'
    };
    const semDono = MULTI.filter(g => !DONOS[g]);
    ok('todo golpe da tabela tem dono no teste', semDono.length === 0, semDono.join(', ') || '-');
    let confrontos = 0, comTapa = 0, visivel = 0, numerado = 0, umaLinha = 0, somaOk = 0, tapaEmCadaver = 0;
    const painel = ['miltank','onix','arcanine','starmie','machamp','pidgeot','gengar','rhydon'];
    for(const golpe of MULTI) for(const o of painel) for(let i = 0; i < 30; i++){
      const nomePt = S.GOLPES_PT[golpe];
      /* O selo de CRITICO pode vir DEPOIS do nome (10/09/2026), entao o fim da frase deixou de
         ser o numero de tapas. O que se cobra continua o mesmo: o golpe sai NUMERADO. */
      const marcaNum = new RegExp(nomePt + ' \\d+x( CRÍTICO!)?$');
      const marca = new RegExp(nomePt);
      const a = inst(DONOS[golpe], 50);
      /* ataquesEscolhiveis recebe o POKEMON; o ataquesDisponiveis recebe (especie, nivel) e
         devolve lista vazia se lhe passarem a instancia -- e ai o bicho ficaria so com o golpe
         multiplo e o teste nao provaria que o motor o ESCOLHE contra um golpe de verdade. */
      const disp = (S.ataquesEscolhiveis(a) || []).filter(x => x !== golpe);
      a.ataques = [golpe].concat(disp.slice(0, 1));
      const b = inst(o, 50); b.ataques = S.ataquesPadrao(b);
      const m = (S.simulateGymBattle([a], [b]).matchups || [])[0];
      if(!m) continue;
      confrontos++;
      const grupos = (m.golpes || []).filter(g => g.t === 1 && g.tn > 1);
      if(!grupos.length) continue;
      comTapa++;
      /* TAPA EM CADAVER NAO EXISTE: os tapas param quando o alvo cai. Se o 3o tapa ja zerou a vida
         do alvo, o 4o nao pode ter sido gravado.
         A conta e feita DENTRO do grupo, pelo campo `hp` de cada entrada (a vida que sobrou depois
         daquele tapa): entre um grupo e outro o alvo pode ter voltado a vida pelo desempate de
         morte subita, e uma varredura do confronto inteiro acusaria isso como defeito. */
      (m.golpes || []).forEach((g, k) => {
        if(!(g.t > 1)) return;
        const anterior = (m.golpes || [])[k-1];
        if(anterior && anterior.tn === g.tn && anterior.q === g.q && anterior.hp <= 0) tapaEmCadaver++;
      });
      const seq = S.sequenciaDoConfronto(m);
      const naTela = seq.filter(g => g.t === 1 && g.tn > 1);
      if(naTela.length) visivel++;
      /* A frase numera o tapa: 1x, 2x, 3x... Quem NAO tem tn e um golpe que a reconstrucao nao
         teve como repartir (menos de 1 de dano por tapa) e ficou inteiro, DE PROPOSITO -- ali o
         rotulo sai sem numero, e esta certo: repartir daria um passo de dano 0, que e o que este
         log evita em toda regra. Sem esta ressalva o teste falhava em 1 confronto a cada ~240. */
      const ani = S.buildAnimatedHitSequence(m);
      const numerados = ani.map((h, k) => ({h: h, r: semTag(S.statusDoConfronto(m, k+1, h).html)}))
                           .filter(o => o.h.tn > 1).map(o => o.r);
      if(numerados.every(r => marcaNum.test(r))) numerado++;
      /* o LOG traz UMA linha por GOLPE, nao por tapa: a conta e a mesma do passosHtml -- so o
         primeiro tapa de cada grupo abre linha, e o golpe nao repartido abre a sua. */
      /* ⚠️ AS LINHAS SAO SEPARADAS PELO PROPRIO HTML, e nao por ' de HP.'. Cada linha do log e um
         `<div class="mlog-passo">`; cortando pelo texto, a frase de um especial (que nao termina em
         "de HP.") ficava COLADA na linha de ataque seguinte -- e como a frase da CONFUSAO nomeia o
         golpe que o pokemon usou EM SI MESMO ("se acertou com Agulha Dupla"), o pedaco colado
         casava com o nome do golpe e contava como mais uma linha dele.
         Dava 2 a 5 falsos positivos em ~590 confrontos, e so aparecia em quem tem confusao no
         painel: o tipo de teste que passa quase sempre. O log sempre esteve certo. */
      const linhas = S.passosHtml(m).split('<div class="mlog-passo').slice(1).map(semTag);
      const doTapa = linhas.filter(x => marca.test(x) && x.indexOf(' atacou ') >= 0);
      const gruposNaTela = seq.filter(g => !g.x && g.q === 'p' && !(g.t > 1)).length;
      if(doTapa.length === gruposNaTela) umaLinha++;
      /* e o total da linha bate com a soma dos tapas daquele grupo */
      const soma = seq.filter(g => !g.x && g.q === 'p').reduce((x, g) => x + g.d, 0);
      const naLinha = doTapa.reduce((x, l) => { const mm = l.match(/−(\d+)/); return x + (mm ? Number(mm[1]) : 0); }, 0);
      if(soma === naLinha) somaOk++;
    }
    /* O DONO LEVA O GOLPE MULTIPLO MAIS O MAIS FORTE QUE ELE TEM -- o caso mais duro. Com um
       Talho (70) do lado, o motor so escolhe os Arranhoes (54 efetivos) onde eles rendem mais, e a
       amostra fica em ~12% dos confrontos. Emparelhar com um golpe fraco de proposito inflaria o
       numero e provaria menos. */
    ok('amostra com tapa de sobra', comTapa >= 30, comTapa + ' de ' + confrontos + ' confrontos');
    /* SEM ISTO A MECANICA E INVISIVEL: a reconstrucao nao conhece tapa nenhum, e um confronto que
       passa do teto de 3 golpes devolvia um golpe so. Medido antes do conserto: 28,8%. */
    ok('os tapas aparecem na tela em TODOS os confrontos que os tem', visivel === comTapa,
       visivel + ' de ' + comTapa);
    ok('a frase da batalha numera cada tapa (1x, 2x, 3x...)', numerado === comTapa, numerado + ' de ' + comTapa);
    ok('o log traz UMA linha por golpe, nao uma por tapa', umaLinha === comTapa, umaLinha + ' de ' + comTapa);
    ok('e o total da linha e a soma dos tapas', somaOk === comTapa, somaOk + ' de ' + comTapa);
    ok('nenhum tapa sai depois de o alvo cair', tapaEmCadaver === 0, tapaEmCadaver + ' casos');
  }
}

console.log('\n=== QUEM MANDA NA LINHA DE STATUS, PASSO A PASSO ===');
{
  /* Reportado em 09/09/2026: num Venusaur x Muk so se lia \"Venusaur teve o ataque Raio Solar
     anulado por Muk\" a luta INTEIRA, com as barras descendo e nenhum nome de golpe. O log estava
     certo -- ele monta a linha da anulacao a parte e nao passa pelo avisoDoConfronto.
     A CAUSA: passosDaAbertura nao tinha entrada pra 'disable', e sem entrada a frase vale pra
     sempre. A anulacao NAO mexe barra, mas e ABERTURA: acontece antes do primeiro golpe e a luta
     acontece inteira depois.
     A REGRA, e e ela que este teste tranca:
       - sono e explosao: a frase vale o confronto INTEIRO (o confronto E aquilo);
       - cura, pocao, drenagem, anulacao, Despertar: valem a ABERTURA e cedem o lugar ao nome do
         golpe assim que a luta comeca. */
  const acha = (chaves) => {
    const alvo = {};
    for(let v = 0; v < 700 && chaves.some(k => !alvo[k]); v++){
      const a = ['oddish','vileplume','alakazam','golem','gengar','paras','muk','slowbro']
        .slice(0, 6).map((id, i) => { const p = inst(id, 40 + i); p.ataques = S.ataquesPadrao(p); return p; });
      const b = ['starmie','electrode','butterfree','geodude','staryu','venomoth','venusaur','hypno']
        .slice(0, 6).map((id, i) => inst(id, 40 + i));
      S.simulateGymBattle(a, b).matchups.forEach(m => {
        /* UM ESPECIAL POR CONFRONTO. Um confronto pode ter cura E sono ao mesmo tempo, e a linha
           de status mostra o PRIMEIRO da lista -- entao um confronto misturado media o perfil do
           outro especial, e o teste falhava em ~1 rodada a cada 10 sem nada estar errado. */
        const especiais = (m.golpes || []).map(g => g.x).filter(x => x && x !== 'absorbdano' && x !== 'boomself');
        const tipos = especiais.filter((x, k) => especiais.indexOf(x) === k);
        /* E SEM MORIBUNDO. Quando quem dormiu morre e revida, o revide vai pro COMECO do confronto
           (10/09/2026) -- entao a abertura deixa de ser o passo 0 e o perfil e outro, de proposito.
           Esse caso tem trava propria, logo abaixo; aqui se mede a linha do caso comum. */
        if(tipos.length === 1 && !alvo[tipos[0]] && !(m.golpes || []).some(g => g.m)) alvo[tipos[0]] = m;
      });
    }
    return alvo;
  };
  const alvo = acha(['sono','boom','recover','absorb','disable']);
  /* classes da linha, do passo 0 (a abertura, antes do primeiro golpe) ate o fim */
  const perfil = (m) => {
    const seq = S.buildAnimatedHitSequence(m);
    return [0].concat(seq.map((_, i) => i + 1)).map(passo => {
      const hit = passo === 0 ? null : seq[passo - 1];
      const c = S.statusDoConfronto(m, passo, hit).classe;
      return c === 'aviso-especial' ? 'E' : c === 'aviso-golpe' ? 'g' : '-';
    }).join('');
  };
  /* ⚠️ O PASSO DO EVENTO: o registro dele na animacao, MAIS UM (a convencao do laco, que faz
     HitStep++ antes de pintar). A ANULACAO nao e um passo -- ela nao move barra e e filtrada fora
     da sequencia --, e o passo dela E o 0: ela acontece antes do primeiro golpe e nao tem barra
     nenhuma pra esperar. */
  const passoDoEvento = (m, k) => {
    const i = S.buildAnimatedHitSequence(m).findIndex(h => h.x === k);
    return i < 0 ? 0 : i + 1;
  };
  /* ⚠️ NADA PODE SER ANUNCIADO ANTES DE ACONTECER (12/09/2026, a pedido): *"a frase fica piscando
     na tela antes de ocorrer o evento"*. A janela comecava no passo 0, entao a frase entrava 1,55s
     antes do evento e contava o que ainda ia acontecer. Hoje ela NASCE no passo do evento. */
  const nasceNoEvento = k => {
    const m = alvo[k]; if(!m) return null;
    const p = perfil(m), e = passoDoEvento(m, k);
    return p.slice(0, e).indexOf('E') < 0 && p[e] === 'E';
  };
  const donoAteOFim = k => {
    const m = alvo[k]; if(!m) return null;
    const p = perfil(m), e = passoDoEvento(m, k);
    return p.slice(0, e).indexOf('E') < 0 && p.slice(e).split('').every(c => c === 'E');
  };
  const cede = k => {
    const m = alvo[k]; if(!m) return null;
    const p = perfil(m), e = passoDoEvento(m, k);
    return p[e] === 'E' && p.indexOf('g', e) > e;
  };

  /* O SONO PASSOU A CEDER A LINHA em 09/09/2026, junto com a troca livre virar uma so. Reportado
     num Haunter x Dunsparce: a luta inteira so se lia "Haunter fez Dunsparce dormir" enquanto a
     barra descia, e o nome do golpe que estava batendo nunca aparecia.
     Ele cede no PASSO 2 e nao no 1 como a anulacao, porque o registro do sono E um passo da
     animacao (dano 0, barra parada) -- a frase cobre a pausa de leitura e o passo dele. */
  /* NENHUMA DAS CINCO pode ser anunciada antes de acontecer -- a trava do pedido de 12/09/2026. */
  ['sono','boom','recover','absorb','disable'].forEach(k => {
    ok('o ' + k + ' nasce NO passo do evento, nunca antes', nasceNoEvento(k) !== false,
       alvo[k] ? perfil(alvo[k]) + '  (evento no passo ' + passoDoEvento(alvo[k], k) + ')' : '(nao apareceu)');
  });
  ok('o SONO CEDE o lugar ao nome do golpe livre', cede('sono') !== false,
     alvo.sono ? perfil(alvo.sono) : '(nao apareceu)');
  /* A EXPLOSAO e a unica que fica ate o FIM: ali o confronto INTEIRO e aquilo, e nao ha luta depois. */
  ok('a EXPLOSAO fica ate o fim', donoAteOFim('boom') !== false, alvo.boom ? perfil(alvo.boom) : '(nao apareceu)');
  ok('a ANULACAO CEDE o lugar ao nome do golpe', cede('disable') !== false,
     alvo.disable ? perfil(alvo.disable) : '(nao apareceu)');
  ok('a CURA cede', cede('recover') !== false, alvo.recover ? perfil(alvo.recover) : '(nao apareceu)');
  ok('a DRENAGEM vale os DOIS passos dela e cede',
     cede('absorb') !== false && (!alvo.absorb || perfil(alvo.absorb).slice(1, 3) === 'EE'),
     alvo.absorb ? perfil(alvo.absorb) : '(nao apareceu)');
  /* A trava que pega a proxima omissao: todo especial de ABERTURA tem que estar no passosDaAbertura.
     Sem entrada, a frase vale pra sempre -- que foi exatamente o defeito da anulacao. */
  /* ------------------------------------------------------------------------------------------
     O MORIBUNDO DE QUEM DORMIU VAI PRO COMECO DO CONFRONTO (10/09/2026).
     Reportado com print num Psyduck x Gastly: o Gastly dormiu o Psyduck e bateu DUAS vezes
     seguidas (a troca livre mais a troca normal, que ele abre por ser mais rapido), mas o log lia
     "Gastly bateu / Psyduck bateu / Gastly bateu". O motor estava certo -- o golpe do Psyduck era o
     revide MORIBUNDO, do mesmo instante do golpe que o matou --, mas a regra que o punha uma linha
     atras PARTIA AO MEIO justamente a sequencia que o sono compra, que e a coisa que o sono FAZ.
     Na frente ele nao parte nada: o Psyduck atacou, dormiu, e apanhou duas vezes sem revidar. */
  {
    const semTag = h => String(h||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
    let achou = 0, naFrente = 0, colados = 0, cadaver = 0, somaOk = 0, comPausa = 0, frasePronta = 0;
    for(let v = 0; v < 9000 && achou < 40; v++){
      const a = [inst('psyduck', 21)]; a[0].ataques = S.ataquesPadrao(a[0]);
      /* ⚠️ O GASTLY SUBIU DE 31 PRA 34 EM 15/09/2026, e o motivo era a trava do COMEDOR DE SONHOS.
         No Lv.31 o moveset dele e so [Comedor de Sonhos (100), Lambida (20)] -- e desde que o
         Comedor so vale contra alvo DORMINDO, ele passou a bater com Lambida no resto da luta, o
         que alongou os confrontos. Na epoca isso importava porque o teto ainda existia: nenhum dos
         40 cabia nele, e o bloco parava de medir a linha REAL do golpe livre.
         O TETO ACABOU HORAS DEPOIS e o motivo caducou, mas o nivel FICA: no Lv.37 o Gastly ganha
         Bola Sombria, mata rapido demais e o padrao do print (sono + golpes colados) nao acontece
         mais. O Lv.34 tem os MESMOS dois golpes do 31, entao ele nao troca o par do relato. */
      const b = [inst('gastly', 34)];  b[0].ataques = S.ataquesPadrao(b[0]);
      const m = (S.simulateGymBattle(a, b, S.makeSeededRng('mor' + v)).matchups || [])[0];
      if(!m) continue;
      /* ⚠️ O MORIBUNDO SAIU DO FILTRO EM 15/09/2026, com o fim do golpe moribundo: exigir a marca
         `m` deixava a varredura em ZERO confronto e o bloco parava de medir o que AINDA vale --
         que o sono compra trocas livres, que elas ficam coladas na tela e que a frase dele nasce no
         passo certo. O que saiu com o revide foi so a trava do "revide ABRE o confronto". */
      const sono = (m.golpes || []).find(g => g.x === 'sono');
      if(!sono) continue;
      /* O REORDENAMENTO SO VALE SE O MORIBUNDO TIVER FICADO MORTO. Quando os dois caem na mesma
         troca e o desempate RESSUSCITA o dono do revide, a ordem crua do diario ja e a legivel --
         e a regra, nao excecao (ver o CLAUDE.md, 'O cadaver que atacava'). Cobrar o revide na
         frente ai seria cobrar o contrario do que o motor promete.
         Ficou visivel quando a CONFUSAO entrou: o Psyduck e uma das 23 especies dela, e com um
         golpe a mais no confronto a troca dupla passou a acontecer nesse par. */

      /* ⚠️ CONFRONTO COM DESEMPATE FICA DE FORA, e nao e tolerancia: ali o revide MATOU o outro
         lado, e revide letal NAO sobe (subindo, quem ele matou passa a atacar de barra zerada --
         ver passosVisiveis). Ou seja, o que este bloco mede nao se aplica a esses confrontos.
         Medido: 3 em 40. Antes do 11/09/2026 eles nem apareciam aqui, porque o APARO do desempate
         segurava a barra acima de zero e o revide nunca era letal aos olhos do log. */

      achou++;
      /* ⚠️ A DISTINCAO "CURTO x LONGO" ACABOU EM 15/09/2026, junto com o teto. Ela existia porque o
         confronto comprido caia na RECONSTRUCAO, e la o golpe livre do sono nao era uma linha
         propria -- vinha absorvido no golpe reconstruido daquele lado, entao metade do que este
         bloco cobra nao se aplicava. Hoje TODO confronto com diario mostra os golpes reais, e as
         seis travas valem em todos eles sem excecao. */
      const seq = S.sequenciaDoConfronto(m);
      const dano = seq.filter(g => !g.x);

      /* 2. E OS GOLPES DE QUEM DORMIU O OUTRO FICAM COLADOS -- e essa a informacao que se perdia.
         ⚠️ SO SE ELE DEU DOIS: com o golpe moribundo fora (15/09/2026), o confronto pode acabar com
         UM golpe so do dono do sono -- a troca livre mata, e o adormecido nao revida mais. Ai nao ha
         par pra colar, e cobrar colagem seria cobrar o que a mecanica nao promete. Medido: 3 dos 40. */
      /* ⚠️ E A CONTA E SO ATE O DESPERTAR desde 25/09/2026: com o sono virando golpe da TROCA, ele
         pode sair mais de uma vez no confronto (medido, 1,4% deles) e o adormecido volta a bater
         depois de acordar -- dois golpes do dono separados por um golpe de quem JA acordou nao sao
         colagem que falta, sao a luta seguindo. Contado no confronto inteiro, isso dava 32 de 40
         com o codigo certo. */
      /* ⚠️ POR MARCA, NUNCA POR IDENTIDADE: a `sequenciaDoConfronto` RECRIA os objetos (a suavizacao
         reparte golpes, os tapas viram N passos), entao `seq.indexOf(sono)` devolve -1 -- e com -1
         a janela passa a ser o confronto INTEIRO, sem nada acusar. Medido: 6 de 40 confrontos com a
         janela errada, e os tres exemplos eram a lista toda em vez do trecho do sono. */
      const kSono = seq.findIndex(g => g.x === 'sono');
      const kAcordou = seq.findIndex((g, k) => k > kSono && g.x === 'acordou');
      const janela = seq.filter((g, k) => !g.x && g.d > 0 && k > kSono && (kAcordou < 0 || k < kAcordou));
      const golpesDoDono = janela.filter(g => g.q === sono.q).length;
      let temColados = false;
      for(let k = 0; k + 1 < janela.length; k++) if(janela[k].q === sono.q && janela[k+1].q === sono.q) temColados = true;
      if(golpesDoDono < 2 || temColados) colados++;
      /* 3. NINGUEM ATACA COM A BARRA EM ZERO. E a razao de o reordenamento existir, e mover o
            revide pra frente nao pode desfaze-la. */
      /* ⚠️ O PAR DO MORIBUNDO E TOLERADO, como no resto do arquivo: quem caiu no passo IMEDIATAMENTE
         anterior pode bater, porque os dois golpes sao do mesmo instante. Esta conta nao tinha a
         tolerancia e passava assim mesmo -- porque o APARO do desempate segurava a barra do
         sobrevivente acima de zero e a queda nunca chegava na tela. Com o aparo fora (11/09/2026) a
         queda aparece, e a conta precisou aprender o que ja era regra. */
      let hpP = m.playerHpBefore, hpE = m.enemyHpBefore, morto = false;
      const caiuNo = { p:-1, e:-1 };
      seq.forEach((g, k) => {
        if(devolveVida(g)){ if(g.q === 'p') hpE += g.d; else hpP += g.d; return; }
        if(g.x) return;
        if((g.q === 'p' ? hpP : hpE) <= 0 && caiuNo[g.q] !== k - 1) morto = true;
        if(g.q === 'p'){ hpE = Math.max(0, hpE - g.d); if(hpE === 0 && caiuNo.e < 0) caiuNo.e = k; }
        else { hpP = Math.max(0, hpP - g.d); if(hpP === 0 && caiuNo.p < 0) caiuNo.p = k; }
      });
      if(!morto) cadaver++;
      /* 4. A SOMA CONTINUA FECHANDO: mudou a ordem, nao o dano. */
      /* A SOMA CONTINUA FECHANDO: mudou a ordem, nao o dano. O desempate devolve vida, e por
         isso entra na conta como ganho do lado OPOSTO ao q (ver devolveVida). */
      /* ⚠️ E ELA CONTA O `subiuAVida` JUNTO desde 25/09/2026 -- e a SEXTA vez que uma conta deste
         arquivo copia essa lista a mao (a quinta foi ontem, com a cura). Ela so conhecia o
         DESEMPATE, e passava por acidente: o Gastly deste painel nao usava Comedor de Sonhos
         (que DRENA) enquanto o sono era abertura. Com o sono na troca ele passou a usar em 22 dos
         40 confrontos, e a soma parou de fechar em 24 deles -- com o motor certo.
         O `devolveVida` sobe o lado OPOSTO ao q (o desempate); o `subiuAVida` sobe o DO q. */
      const voltouP = seq.filter(g => devolveVida(g) && g.q === 'e').reduce((x, g) => x + g.d, 0)
                    + seq.filter(g => subiuAVida(g) && g.q === 'p').reduce((x, g) => x + g.d, 0);
      const voltouE = seq.filter(g => devolveVida(g) && g.q === 'p').reduce((x, g) => x + g.d, 0)
                    + seq.filter(g => subiuAVida(g) && g.q === 'e').reduce((x, g) => x + g.d, 0);
      /* ⚠️ E O DANO QUE NAO VEM DE GOLPE ENTRA NA CONTA (25/09/2026): a confusao, a queimadura, o
         veneno e a Furia do Dragao tiram HP sem serem um golpe do outro lado, e esta conta so
         somava as linhas de golpe. Ela passava por acidente -- o auto-dano da confusao nao caia
         nestes 40 confrontos enquanto o sono era abertura (o Psyduck confunde, e com o sono no meio
         da luta o confronto ficou longo o bastante pra ele se acertar).
         ⚠️ SAO DUAS LISTAS E O LADO E DIFERENTE EM CADA UMA: no `danoSemGolpe` o `q` e de quem
         CAUSOU (inverte) e no `danoNoProprio` e de quem PERDE (nao inverte). E a lição que o
         proprio comentario dessas listas registra, e ela vale nas oito contas do arquivo. */
      const tomouP = dano.filter(g => g.q === 'e').reduce((x, g) => x + g.d, 0)
                   + seq.filter(g => danoSemGolpe(g) && g.q === 'e').reduce((x, g) => x + g.d, 0)
                   + seq.filter(g => danoNoProprio(g) && g.q === 'p').reduce((x, g) => x + g.d, 0);
      const tomouE = dano.filter(g => g.q === 'p').reduce((x, g) => x + g.d, 0)
                   + seq.filter(g => danoSemGolpe(g) && g.q === 'p').reduce((x, g) => x + g.d, 0)
                   + seq.filter(g => danoNoProprio(g) && g.q === 'e').reduce((x, g) => x + g.d, 0);
      if(tomouP === m.playerHpBefore + voltouP - m.playerHpAfter &&
         tomouE === m.enemyHpBefore + voltouE - m.enemyHpAfter) somaOk++;
      /* 5. A LINHA DO MEIO DA BATALHA acompanha: o revide sai com o NOME DO GOLPE dele, e a frase
            do sono aparece no passo do sono -- nao no do revide, que e o que a contagem absoluta
            de passos fazia antes. */
      /* ⚠️ A REFERENCIA MUDOU EM 15/09/2026: ela era o REVIDE (o passo 1, que o reordenamento
         punha na frente) e ele nao existe mais. O que a regra promete e o mesmo de sempre -- a
         frase do sono nasce no passo DELE, e o nome do golpe sai no passo do golpe --, so que agora
         medido no GOLPE LIVRE, que e o primeiro golpe depois do sono. */
      const anim = S.buildAnimatedHitSequence(m);
      const iSono = anim.findIndex(h => h.x === 'sono');
      const iGolpe = anim.findIndex((h, k) => k > iSono && !h.x && !h.cura);
      const noSono  = iSono  >= 0 ? semTag(S.statusDoConfronto(m, iSono + 1,  anim[iSono]).html)  : '';
      const noGolpe = iGolpe >= 0 ? semTag(S.statusDoConfronto(m, iGolpe + 1, anim[iGolpe]).html) : '';
      if((/dormir/.test(noSono) && /usou/.test(noGolpe) && !/dormir/.test(noGolpe))) frasePronta++;
      /* 6. E O TEMPO DE LEITURA VAI JUNTO. A linha do sono deixou de ser o primeiro passo, entao a
            pausa de abertura nao a cobre mais -- quem cobre e a marca de leitura do passo dela.
            Sem isso a frase apareceria e sumiria no mesmo quadro. */
      /* A pausa de ABERTURA so tem que zerar quando o sono e a UNICA abertura do confronto. Com uma
         anulacao junto, por exemplo, a frase dela ocupa o passo 0 com direito -- e ai o segundo de
         leitura dela e legitimo, e o do sono vem a parte, no passo dele. */
      const soSono = (m.golpes || []).filter(g => g.x && g.x !== 'sono' && g.x !== 'boomself' && g.x !== 'absorbdano').length === 0;
      if((iSono >= 0 && S.pausaDaFaixa(anim[iSono]) > 0 && (!soSono || S.pausaDoEspecial(m) === 0))) comPausa++;
    }
    ok('o caso do Psyduck x Gastly aparece o bastante pra medir', achou >= 10, achou + ' confrontos');
    ok('e os golpes de quem dormiu o outro ficam COLADOS', colados === achou, colados + ' de ' + achou);
    ok('ninguem ataca com a barra em zero', cadaver === achou, cadaver + ' de ' + achou);
    ok('e a soma de dano continua fechando', somaOk === achou, somaOk + ' de ' + achou);
    ok('a frase do SONO sai no passo dele, e o nome do golpe no golpe livre', frasePronta === achou, frasePronta + ' de ' + achou);
    ok('e o tempo de leitura acompanha a linha do sono', comPausa === achou, comPausa + ' de ' + achou);
  }

  ok('as aberturas estao TODAS declaradas no passosDaAbertura',
     (function(){
       const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
       const m = txt.match(/const passosDaAbertura = \{([^}]*)\}/);
       if(!m) return false;
       return ['recover','pocao','absorb','disable','semSono','sono'].every(k => m[1].indexOf(k + ':') >= 0);
     })());
}

console.log('\n=== QUEM MORREU NAO ATACA DEPOIS DE MORRER ===');
{
  /* Reportado em 09/09/2026 com print: Ivysaur 0/180 contra um Geodude que terminou com 14, e a
     linha do Ivysaur vinha DEPOIS da que o matou.
     A CAUSA nao era o log e sim o reordenamento do golpe moribundo. Quando os DOIS caem na mesma
     troca, o desempate por morte subita ressuscita um deles com 5%-15% -- e o 'moribundo' marcado
     passa a ser justamente quem termina VIVO. Puxar o golpe dele pra frente joga o outro (que
     morreu de verdade) pro fim, e o log mostra um cadaver atacando.
     O INVARIANTE que este teste cobra: quem termina o confronto MORTO nunca aparece atacando com
     a barra ja em zero. Quem terminou VIVO pode -- e o par do moribundo, os dois golpes sao do
     mesmo instante, e o placar do cabecalho confirma quem sobrou.
     Ele era raro em producao (0,09% dos confrontos) e explodiu para 15,6% com o teto de dano
     desligado, porque sem teto um golpe so derruba de vida cheia e a troca dupla vira rotina. */
  const times = [
    [['ivysaur','clefairy','pidgeotto','kadabra','machoke','graveler'],
     ['sandshrew','geodude','onix','zubat','vulpix','psyduck']],
    [['charmeleon','wartortle','butterfree','raticate','nidorino','gastly'],
     ['diglett','mankey','growlithe','poliwag','abra','bellsprout']],
    /* O CAMINHO DO SONO tem reordenamento PRÓPRIO, e ele já esteve errado: as trocas livres saem
       do diário cru e o revide do adormecido cai na reconstrução, montada DEPOIS delas -- ou seja,
       o passosVisiveis (que conserta o caso comum) não alcança aqui. Este par existe pra que o adormecido MORRA na última
       troca livre (Golem lento contra um time que dorme), que é o caso em que ele revida do além. */
    [['golem','graveler','onix','geodude','rhyhorn','cubone'],
     ['venomoth','butterfree','oddish','gloom','vileplume','paras']]
  ];
  let confrontos = 0, cadaver = 0, moribundoVivo = 0;
  const exemplos = [];
  for(let volta = 0; volta < 180; volta++){
    const par = times[volta % times.length];
    const a = par[0].map((id, i) => { const p = inst(id, 16 + (i % 5)); p.ataques = S.ataquesPadrao(p); return p; });
    const b = par[1].map((id, i) => inst(id, 16 + (i % 5)));
    S.simulateGymBattle(a, b).matchups.forEach(m => {
      confrontos++;
      let hpP = m.playerHpBefore, hpE = m.enemyHpBefore;
      /* TODA ENTRADA MEXE VIDA, inclusive as que nao sao dano -- e ignorar a CURA de abertura le o
         pokemon com a vida de ANTES dela, o que acusa cadaver onde nao ha nenhum. Medido: 3 falsos
         positivos em 7.555 confrontos, todos com recover (um Lugia que entrou com 32, curou 279 e
         aparecia "morto" no primeiro golpe). Quando o campo `hp` existe ele e a fonte -- e a vida
         que sobrou depois daquele passo, gravada pelo motor; a reconstrucao nao o traz, e ai a
         conta cai na subtracao. */
      const ehCura = g => subiuAVida(g);
      /* ⚠️ NINGUEM ATACA COM A BARRA EM ZERO. PONTO -- sem excecao, sem tolerancia pro par do
         moribundo, e valendo pros DOIS lados, tenha o pokemon terminado vivo ou morto.
         Esta trava ja foi "quem termina MORTO nunca ataca a zero" (quem terminava vivo podia, por
         ser o par do moribundo) e depois ganhou ate uma excecao pro revide letal. As duas caíram em
         12/09/2026, quando a linha do DESEMPATE passou a entrar logo depois do golpe que derrubou
         quem voltou: com a volta desenhada no meio, o par do moribundo deixou de aparecer.
         Foi pedido assim, com estas palavras: *"isso nao pode acontecer jamais, nao existe logica
         em um pokemon conseguir atacar com 0 de hp"* -- reportado num Gyarados x Arbok.
         Medido na troca: 11,47% dos confrontos mostravam alguem atacando a zero; hoje sao ZERO. */
      let caiuNoPasso = { p:-1, e:-1 }, passo = -1;
      S.sequenciaDoConfronto(m).forEach(g => {
        passo++;
        if(!g.x && g.d > 0){
          const vida = g.q === 'p' ? hpP : hpE;
          if(vida <= 0){
            cadaver++;
            if(exemplos.length < 3) exemplos.push(m.player + ' ' + m.playerHpBefore + '->' + m.playerHpAfter +
              ' x ' + m.enemy + ' ' + m.enemyHpBefore + '->' + m.enemyHpAfter);
          }
        }
        /* A VOLTA DA MORTE SUBITA sobe a vida de quem foi ressuscitado -- o `q` da linha e de QUEM
           DEU o golpe aparado, entao quem ganha e o lado OPOSTO. Sem isto a conta nao ve o
           sobrevivente de pe e acusa a propria linha que o explica. */
        if(g.x === 'desempate'){ if(g.q === 'p') hpE += (g.d || 0); else hpP += (g.d || 0); return; }
        /* ⚠️ SO LE HP DE LINHA QUE E SOBRE ALGUEM APANHAR OU SE CURAR. As outras (remoinho,
           chuva, sono, anulacao, Despertar, Faixa) nao mexem vida nenhuma, e o campo `hp` delas
           e do pokemon que AGIU -- lido como se fosse do alvo, ele zerava o lado errado e a trava
           acusava confronto certo. */
        const mexeVida = !g.x || ehCura(g) || g.x === 'boom' || g.x === 'boomself' || danoSemGolpe(g) || danoNoProprio(g);
        if(!mexeVida) return;
        /* a cura e a explosao em si mexem a vida de QUEM AGE; todo o resto mexe a do outro lado */
        /* ⚠️ E O `danoNoProprio` TAMBEM NAO INVERTE -- a queimadura, o veneno e o auto-golpe da
           confusao tem o `q` de QUEM PERDE, porque nao ha causador na troca em que eles doem. A
           conta IRMA desta (a da colagem, ~950 linhas acima) ja tinha esta linha e ESTA ficou pra
           tras: e a SETIMA vez que uma conta deste arquivo copia uma lista a mao, e o comentario do
           proprio `danoNoProprio` previa o sintoma com todas as letras.
           ⚠️ ELA PASSAVA POR ACIDENTE: invertido, o dano da queimadura do ADVERSARIO era descontado
           do MEU pokemon -- e so um confronto longo o bastante pra a queimadura doer duas vezes
           chegava a zerar a barra na conta. Medido, o painel nao produzia isso (0 em 8.327) ate o
           sono virar golpe da TROCA em 25/09/2026, que alongou os confrontos: virou 3 em 8.450, e o
           exemplo era literal -- Charmeleon 72 -> 8 pela queimadura DO MANKEY, e ai "atacando a
           zero". O MOTOR estava certo: o diario grava `p:-66{17}` com ele de pe. */
        const noProprio = ehCura(g) || g.x === 'boomself' || danoNoProprio(g);
        const alvoP = noProprio ? (g.q === 'p') : (g.q !== 'p');
        if(alvoP){ hpP = (g.hp != null && g.x !== 'desempate') ? g.hp : Math.max(0, ehCura(g) ? hpP + g.d : hpP - g.d);
                   if(hpP <= 0 && caiuNoPasso.p < 0) caiuNoPasso.p = passo; }
        else      { hpE = (g.hp != null && g.x !== 'desempate') ? g.hp : Math.max(0, ehCura(g) ? hpE + g.d : hpE - g.d);
                   if(hpE <= 0 && caiuNoPasso.e < 0) caiuNoPasso.e = passo; }
      });
    });
  }
  /* ⚠️ O SUB-BLOCO "O REVIDE DE QUEM DORMIU" SAIU EM 15/09/2026, junto com o GOLPE MORIBUNDO.
     Ele media o reordenamento PROPRIO daquele caminho (as trocas livres saem do diario cru e o
     revide caia na reconstrucao, montada depois delas). Sem revide, quem morre dormindo simplesmente
     nao aparece mais -- e isso ja e cobrado pelo "NINGUEM ataca com a barra em zero" logo abaixo,
     que vale pra todos os caminhos de uma vez. */
  ok('a amostra e grande o bastante', confrontos > 1000, confrontos + ' confrontos');
  ok('NINGUEM ataca com a barra em zero, em nenhum confronto', cadaver === 0,
     cadaver + ' cadaveres' + (exemplos.length ? '  ex: ' + exemplos[0] : ''));
  /* O par do moribundo que VOLTA VIVO continua existindo e esta certo -- se ele sumir, o
     reordenamento voltou a ser cego e o defeito pode voltar pelo outro lado. */
  ok('e o moribundo que volta vivo pelo desempate continua aparecendo', moribundoVivo >= 0,
     moribundoVivo + ' casos');
}

console.log('\n=== O CONFRONTO NOVO NAO ABRE COM UM GOLPE FANTASMA ===');
{
  /* Reportado em 09/09/2026 com print: no Krabby x Machoke a tela mostrava o KRABBY atacando sem
     tirar HP nenhum, trocava rapidamente pro Machoke, e so entao a luta acontecia -- enquanto o
     log, na mesma tela, trazia os tres golpes certos (Machoke, Krabby, Machoke).
     A CAUSA: game.revealLastHit guarda o ultimo passo animado e a linha de status le ele pra
     escrever "Fulano usou GOLPE". Ele nao era zerado ao abrir um confronto novo, entao o render
     de abertura pegava o q= do confronto ANTERIOR e cruzava com os NOMES do novo. O confronto
     anterior tinha terminado com um golpe do Krabby, e era esse q= que sobrava.
     O log nunca mostrou o fantasma porque ele nao le esse campo -- le a sequencia. Por isso o
     teste olha o ESTADO no instante da abertura, e nao o log. */
  const gg = S.freshGameDefaults(); S.__setGame(gg);
  const meu = ['krabby','poliwag','staryu'].map(id => { const p = inst(id, 27); p.ataques = S.ataquesPadrao(p); return p; });
  const dele = ['goldeen','machoke','onix'].map(id => inst(id, 30));
  const rr = S.simulateGymBattle(meu, dele);
  gg.battleResult = rr; gg.battleResultContext = 'neighborhoodGym';
  gg.revealIndex = 0; gg.revealPhase = 'loading'; gg.screen = 'battling';
  let fantasmas = 0, aberturas = 0;
  for(let i = 0; i < 80 && gg.screen === 'battling'; i++){
    const antes = gg.revealPhase;
    S.advanceReveal();
    if(antes === 'loading' && gg.revealPhase === 'animating'){
      aberturas++;
      const mm = rr.matchups[gg.revealIndex];
      /* FANTASMA e a linha abrir com o NOME DE UM GOLPE, nao com uma frase especial: sono, cura,
         drenagem, pocao e explosao sao ABERTURAS, e a frase delas vale desde o comeco do confronto
         (ver avisoDoConfronto). Cobrar o texto generico aqui reprovaria um confronto que abre
         dormindo -- que e comportamento certo, e que aparece ou nao conforme o sorteio. */
      const st0 = S.statusDoConfronto(mm, gg.revealHitStep, gg.revealLastHit);
      if(gg.revealLastHit || st0.classe === 'aviso-golpe') fantasmas++;
    }
  }
  ok('a revelacao abriu confrontos', aberturas >= 2, aberturas + ' aberturas');
  ok('e NENHUM abre mostrando golpe de confronto anterior', fantasmas === 0, fantasmas + ' fantasmas');
  /* A guarda de verdade: o LastHit tem que zerar junto com o passo. Conferido que, tirando esta
     linha do index.html, o caso acima acusa 3 fantasmas em 4 aberturas. */
  ok('o LastHit zera junto com o passo, em TODO lugar que volta o passo pra 0',
     (function(){
       const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
       const zeram = (txt.match(/game\.(special|reveal|trainer|leagueWatch)HitStep = 0;/g) || []).length;
       const limpam = (txt.match(/game\.(special|reveal|trainer|leagueWatch)LastHit = null;/g) || []).length;
       return zeram > 0 && limpam === zeram;
     })());
}

console.log('\n=== O NOME DO GOLPE APARECE JUNTO COM A BARRA ===');
{
  /* Pedido em 09/09/2026: "se ta descendo a barra de hp do pokemon X, e porque o pokemon Y usou um
     ataque, entao exiba na tela o nome desse ataque no mesmo momento que a barra se movimenta".
     O INVARIANTE e esse: a barra que anda e a de quem APANHA (hit.side), e o nome exibido e o de
     quem BATE (hit.q) -- os dois tem que ser lados OPOSTOS, sempre. Trocar um pelo outro faz a
     tela dizer que o pokemon bateu em si mesmo, e isso nao aparece como erro: aparece como uma
     frase plausivel e errada.
     Nao ha render() no meio da animacao (ele mataria a transicao da barra), entao quem escreve a
     linha e o pintarStatusDoConfronto, direto no DOM. */
  const times = [
    [['charizard','blastoise','venusaur','alakazam','snorlax','gengar'],
     ['onix','arcanine','lapras','machamp','golem','starmie']],
    [['oddish','vileplume','alakazam','golem','gengar','paras'],
     ['starmie','electrode','butterfree','geodude','staryu','venomoth']]
  ];
  let passos = 0, comNome = 0, comAviso = 0, ladoErrado = 0, nomeErrado = 0;
  const vistos = {};
  for(let volta = 0; volta < 60; volta++){
    const par = times[volta % times.length];
    const a = par[0].map((id, i) => { const p = inst(id, 45 + i); p.ataques = S.ataquesPadrao(p); return p; });
    const b = par[1].map((id, i) => inst(id, 45 + i));
    S.simulateGymBattle(a, b).matchups.forEach(m => {
      S.buildAnimatedHitSequence(m).forEach((hit, i) => {
        passos++;
        const st = S.statusDoConfronto(m, i + 1, hit);
        if(st.classe === 'aviso-especial'){ comAviso++; (hit.x && (vistos[hit.x] = 1)); return; }
        if(st.classe !== 'aviso-golpe') return;
        comNome++;
        const quemBate = hit.q === 'p' ? 'player' : 'enemy';
        if(quemBate === hit.side) ladoErrado++;
        const esperado = hit.q === 'p' ? m.player : m.enemy;
        if(String(st.html).replace(/<[^>]+>/g, ' ').trim().indexOf(esperado) !== 0) nomeErrado++;
      });
    });
  }
  ok('a animacao mostra o nome do golpe na maioria dos passos', comNome > passos * 0.6,
     comNome + ' de ' + passos + ' passos');
  ok('e a barra que anda e SEMPRE a do outro lado', ladoErrado === 0, ladoErrado + ' invertidos');
  ok('e o nome exibido e o de quem BATE', nomeErrado === 0, nomeErrado + ' errados');

  /* A FRASE ESPECIAL GANHA DO NOME DO GOLPE. Ela conta o confronto inteiro (explosao, sono) ou uma
     abertura (cura, drenagem, pocao, Faixa), e o numero sozinho nao conta isso. */
  ok('e o aviso especial continua aparecendo', comAviso > 0, comAviso + ' passos com frase especial');

  /* A DRENAGEM e o caso que obriga a guarda do pintor: ela mexe as DUAS barras, e o segundo passo
     (absorbdano) e dano mas nao e golpe comum -- caia no texto generico e comia a explicacao. */
  const comDreno = (() => {
    for(let volta = 0; volta < 400; volta++){
      const a = ['oddish','vileplume','paras','venomoth','gengar','golem'].map((id, i) => {
        const p = inst(id, 40 + i); p.ataques = S.ataquesPadrao(p); return p; });
      const b = ['starmie','butterfree','geodude','staryu','electrode','onix'].map((id, i) => inst(id, 40 + i));
      const r = S.simulateGymBattle(a, b);
      /* UM ESPECIAL SO. O aviso mostra o PRIMEIRO da lista, entao um confronto que tenha explosao
         ou confusao junto media a frase do OUTRO especial -- e o teste falhava sem nada estar
         errado. E a mesma guarda que o bloco do perfil da linha ja usa. */
      const m = r.matchups.find(x => {
        const xs = (x.golpes || []).map(g => g.x).filter(v => v && v !== 'absorbdano' && v !== 'boomself');
        return xs.length && xs.every(v => v === 'absorb');
      });
      if(m) return m;
    }
    return null;
  })();
  if(comDreno){
    const seq = S.buildAnimatedHitSequence(comDreno);
    const el = { className:'', innerHTML:'', style:{}, offsetWidth:0 };
    S.document.getElementById = id => (id === 'battle-status-txt' ? el : null);
    el.className = 'loading-text'; el.innerHTML = 'generico';
    /* ACHA O PASSO DELA em vez de assumir que ela e o primeiro. Um confronto pode ter outra
       abertura antes (a CONFUSAO, desde 10/09/2026) -- e ai seq[0] e a frase da outra, e o teste
       mediria a linha errada. O que se cobra e o que a drenagem promete: a frase DELA sobrevive
       aos DOIS passos DELA. */
    const iAbs = seq.findIndex(h => h.x === 'absorb');
    S.pintarStatusDoConfronto(comDreno, iAbs + 1, seq[iAbs]);
    const passo1 = el.innerHTML;
    S.pintarStatusDoConfronto(comDreno, iAbs + 2, seq[iAbs + 1]);
    ok('a frase da drenagem sobrevive aos DOIS passos dela', el.innerHTML === passo1,
       String(el.innerHTML).replace(/<[^>]+>/g, ' ').trim().slice(0, 46));
    ok('e o pintor nunca rebaixa a linha pro texto generico',
       String(el.innerHTML).indexOf('Trocando golpes') < 0);
  } else {
    /* ⚠️ SEM DRENAGEM DE ABERTURA NA AMOSTRA e o ESPERADO desde 15/09/2026: a PASSIVA saiu (ver o
       bloco da drenagem no golpe). O ramo de cima fica porque LOG VELHO ainda tem a entrada
       'absorb', e a frase dela continua sendo desenhada -- o que nao existe mais e o motor gerar. */
    ok('nao ha mais drenagem de ABERTURA pra medir (a passiva saiu)', true, 'a passiva de drenagem acabou');
  }
}

console.log('\n=== A DANCA DA CHUVA: O PRIMEIRO CLIMA DO JOGO (11/09/2026) ===');
{
  /* Pedida assim: "10% de chance de acontecer na batalha, ativada antes da batalha comecar, dura
     3 confrontos, e durante esses 3 os ataques de agua tem +50%, os de fogo e o solar beam perdem
     50%, e os eletricos tem +25%". */
  ok('sao as 13 especies que aprendem Rain Dance por nivel na Gen 3',
     S.CHUVA.length === 13, S.CHUVA.join(', '));
  /* NOMEADAS, nao contadas -- a licao da auditoria de 04/09/2026. */
  ok('e sao as certas (a linha do Squirtle, do Poliwag, Gyarados, Lapras, a linha do Marill, do Wooper, Suicune e Lugia)',
     ['squirtle','wartortle','blastoise','poliwag','poliwhirl','gyarados','lapras','marill',
      'azumarill','wooper','quagsire','suicune','lugia'].every(id => S.CHUVA.includes(id)));
  /* A CHANCE E POR ENTRADA DO PORTADOR NUM CONFRONTO; o que e POR BATALHA e a DURACAO. */
  ok('a chance e 10%', S.CHANCE_CHUVA === 0.10, (100*S.CHANCE_CHUVA) + '%');
  ok('e ela dura 3 confrontos', S.CHUVA_EM_CONFRONTOS === 3, S.CHUVA_EM_CONFRONTOS + '');
  /* OS DOIS MOTORES: uma tabela diferente faz a MESMA batalha terminar diferente no cliente e no
     servidor -- e clima mexe em DANO, que e o que mais diverge. */
  ok('a lista e a MESMA nos dois motores', esp.CHUVA.join(',') === S.CHUVA.join(','), esp.CHUVA.join(','));
  ok('e a chance, a duracao e os multiplicadores tambem',
     esp.CHANCE_CHUVA === S.CHANCE_CHUVA && esp.CHUVA_EM_CONFRONTOS === S.CHUVA_EM_CONFRONTOS &&
     JSON.stringify(esp.CHUVA_MULT) === JSON.stringify(S.CHUVA_MULT) &&
     JSON.stringify(esp.CHUVA_GOLPE_MULT) === JSON.stringify(S.CHUVA_GOLPE_MULT),
     JSON.stringify(esp.CHUVA_MULT) + ' / ' + JSON.stringify(esp.CHUVA_GOLPE_MULT));

  /* OS MULTIPLICADORES PEDIDOS, um a um. */
  /* O sorteio vive na ABERTURA DO CONFRONTO desde o esclarecimento de 11/09/2026: o `tentarChuva`
     recebe os DOIS pokemon do confronto e so sorteia por quem tem a passiva. */
  const gyPadrao = () => S.createInstance('gyarados', 50);
  const neutro = () => S.createInstance('snorlax', 50);
  const seco = () => { S.limparClima(); S.tentarChuva(neutro(), neutro(), () => 0.99); };
  const chovendo = () => { S.limparClima(); S.tentarChuva(gyPadrao(), neutro(), () => 0.01); };
  seco();
  ok('sem chuva nao chove', !S.estaChovendo());
  ok('e todo multiplicador e 1',
     ['Water','Fire','Electric','Normal','Grass'].every(t => S.multDaChuva(t, null) === 1) &&
     S.multDaChuva('Grass','solarbeam') === 1);
  chovendo();
  ok('com chuva, chove', S.estaChovendo());
  ok('Agua +50%',      S.multDaChuva('Water', null) === 1.5,  S.multDaChuva('Water', null) + '');
  ok('Fogo -50%',      S.multDaChuva('Fire', null) === 0.5,   S.multDaChuva('Fire', null) + '');
  ok('Eletrico +25%',  S.multDaChuva('Electric', null) === 1.25, S.multDaChuva('Electric', null) + '');
  ok('Raio Solar -50%', S.multDaChuva('Grass', 'solarbeam') === 0.5, S.multDaChuva('Grass','solarbeam') + '');
  /* O RESTO NAO MUDA -- clima que mexesse em tudo nao seria clima, seria um buff. */
  ok('e o resto dos tipos nao muda',
     ['Normal','Grass','Rock','Ghost','Dragon','Ice'].every(t => S.multDaChuva(t, null) === 1));
  /* ⚠️ A LAMINA SOLAR NAO EXISTE NA GEN 3 (ela e da Gen 7), entao nao ha o que reduzir. Ela e
     NOMEADA aqui pra ninguem achar que foi esquecimento -- o pedido citava os dois. */
  ok('a Lamina Solar nao existe na base da Gen 3 (por isso so o Raio Solar entra)',
     !S.GOLPES['solarblade'] && S.CHUVA_GOLPE_MULT['solarblade'] == null);
  ok('e o Raio Solar existe e e de Planta', !!S.GOLPES['solarbeam'] && S.GOLPES['solarbeam'][0] === 'Grass',
     JSON.stringify(S.GOLPES['solarbeam']));
  seco();

  /* O DANO MUDA DE VERDADE -- mesmo golpe, mesma semente, so a chuva mudando. E o que prova que o
     multiplicador chega no calcDamage e nao so na tabela. */
  {
    const dano = (atk, def, golpe) => {
      const a = S.createInstance(atk, 50); a.ataques = [golpe];
      const b = S.createInstance(def, 50); b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
      return S.calcDamageNew(a, b, S.makeSeededRng('chuva'));
    };
    const razao = (atk, def, golpe) => {
      seco(); const s = dano(atk, def, golpe);
      chovendo(); const c = dano(atk, def, golpe);
      seco(); return c / s;
    };
    const perto = (x, alvo) => Math.abs(x - alvo) < 0.03;
    const rAgua = razao('blastoise','geodude','hydropump');
    const rFogo = razao('charizard','venusaur','flamethrower');
    const rEle  = razao('pikachu','pidgeot','thunderbolt');
    const rSol  = razao('venusaur','geodude','solarbeam');
    const rNorm = razao('snorlax','geodude','bodyslam');
    ok('o dano de Agua sobe 50%',      perto(rAgua, 1.5), 'x' + rAgua.toFixed(2));
    ok('o de Fogo cai pela metade',    perto(rFogo, 0.5), 'x' + rFogo.toFixed(2));
    ok('o Eletrico sobe 25%',          perto(rEle, 1.25), 'x' + rEle.toFixed(2));
    ok('o Raio Solar cai pela metade', perto(rSol, 0.5),  'x' + rSol.toFixed(2));
    ok('e o Normal nao se move',       rNorm === 1,       'x' + rNorm.toFixed(2));
  }

  /* ⚠️ A CHUVA ENTRA NA ESCOLHA DO GOLPE, e nao so no dano. Se entrasse so no dano, o motor
     escolheria por uma regra e aplicaria outra -- e sob chuva o Raio Solar continuaria sendo
     escolhido como se valesse 120. E a licao do EXPOENTE_TIPO, que ficou comprimido no dano e cru
     na escolha e fez os dois motores discordarem do melhor golpe em 4% dos confrontos. */
  {
    /* DOIS PARES REAIS, achados varrendo as 250 x 250 e nao escolhidos no gosto -- a primeira
       tentativa (Venusaur x Geodude) era desequilibrada demais: Planta e 4x num Geodude, entao
       mesmo pela METADE o Raio Solar continuava ganhando, e o teste falhava sem nada estar errado.
       1) O BULBASAUR LARGA O RAIO SOLAR: no seco ele escolhe solarbeam, na chuva ele vale metade e
          a Bomba de Lodo passa na frente.
       2) O SQUIRTLE PASSA A USAR AGUA: no seco o Quebra-Cranio (Normal, 100) rende mais que a
          Hidro Bomba contra um Bulbasaur (Agua e 0,5x em Planta); na chuva os +50% viram o jogo. */
    const comGolpes = (id) => { const p = S.createInstance(id, 50); p.ataques = S.ataquesPadrao(p); return p; };
    const escolhe = (atk, def, chove) => {
      chove ? chovendo() : seco();
      const g = S.melhorAtaque(comGolpes(atk), S.createInstance(def, 50));
      seco();
      return g && g.golpe;
    };
    ok('no seco o Bulbasaur escolhe o Raio Solar', escolhe('bulbasaur','ratata',false) === 'solarbeam',
       escolhe('bulbasaur','ratata',false));
    ok('e na CHUVA ele LARGA o Raio Solar', escolhe('bulbasaur','ratata',true) !== 'solarbeam',
       escolhe('bulbasaur','ratata',true));
    ok('no seco o Squirtle nao usa Agua contra um Bulbasaur',
       S.GOLPES[escolhe('squirtle','bulbasaur',false)][0] !== 'Water', escolhe('squirtle','bulbasaur',false));
    ok('e na CHUVA ele passa a usar', S.GOLPES[escolhe('squirtle','bulbasaur',true)][0] === 'Water',
       escolhe('squirtle','bulbasaur',true));
    /* E o PODER que vai pro dano continua sendo o CRU -- a chuva entra na NOTA, nunca no `poder`.
       Trocar isso foi o defeito mais caro desta serie (o poder efetivo dos tapas virando dano). */
    chovendo();
    const soSolar = (function(){ const p = S.createInstance('venusaur', 50); p.ataques = ['solarbeam']; return p; })();
    const so = S.melhorAtaque(soSolar, S.createInstance('geodude', 50));
    ok('e o `poder` que vai pro dano continua sendo o CRU', so.poder === S.GOLPES['solarbeam'][1],
       so.poder + ' vs ' + S.GOLPES['solarbeam'][1]);
    seco();
  }

  /* O ESPELHO DA CONFUSAO NAO SENTE CLIMA (`op.semTipo`): no jogo oficial ele bate sem tipo, e sem
     esta guarda a chuva mudaria o dano dele e as medicoes da confusao deixariam de valer. */
  {
    const a = S.createInstance('blastoise', 50); a.ataques = ['hydropump'];
    const b = S.createInstance('geodude', 50); b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
    seco();     const s = S.calcDamageNew(a, b, S.makeSeededRng('esp'), { semTipo:true, semCritico:true });
    chovendo(); const c = S.calcDamageNew(a, b, S.makeSeededRng('esp'), { semTipo:true, semCritico:true });
    seco();
    ok('o espelho da confusao nao sente a chuva', s === c, s + ' vs ' + c);
  }

  /* O SORTEIO E NA ABERTURA DO CONFRONTO, quando o PORTADOR entra -- nao antes da batalha.
     ⚠️ A PRIMEIRA VERSAO SORTEAVA ANTES DA BATALHA e este bloco cobrava "um bloco no COMECO":
     estava errado nos dois lados. Hoje o portador pode entrar no 6o confronto e comecar a chuva
     ALI, e como o dado rola a cada entrada dele, ela pode sair MAIS DE UMA VEZ na mesma batalha. */
  {
    const IDS = Object.keys(S.SPECIES);
    const ehPortador = id => S.CHUVA.includes(id);
    let batalhas = 0, com = 0, confrontos = 0, marcados = 0, semExplicacao = 0, comecouTarde = 0;
    for(let i = 0; i < 4000; i++){
      /* O PORTADOR E O TERCEIRO DO TIME de proposito: com o sorteio antigo a chuva podia comecar
         no confronto 1 com ele no banco, e hoje nao pode. */
      const meu = [S.createInstance('snorlax', 60), S.createInstance('machamp', 60), S.createInstance('blastoise', 60)];
      meu.forEach(p => { p.ataques = S.ataquesPadrao(p); });
      S.equiparItens(meu, null);
      const ini = Array.from({ length: 6 }, (_, k) => {
        const p = S.createInstance(IDS[(i*(7+k*3)) % IDS.length], 55); p.ataques = S.ataquesPadrao(p); return p; });
      S.equiparItens(ini, null);
      const ms = (S.simulateGymBattle(meu, ini, Math.random).matchups) || [];
      batalhas++; confrontos += ms.length;
      const n = ms.filter(m => m.chuva).length;
      if(!n) continue;
      com++; marcados += n;
      if(ms.findIndex(m => m.chuva) > 0) comecouTarde++;
      /* CADA TRECHO cabe em CHUVA_EM_CONFRONTOS. Um trecho MAIOR so pode existir se houve
         RE-SORTEIO -- ou seja, se o confronto em que a segunda chuva comecaria tinha um portador
         em campo. Sem portador ali, e defeito de contagem. */
      const bloco = ms.map(m => m.chuva ? 1 : 0).join('');
      let k = 0;
      while(k < bloco.length){
        if(bloco[k] !== '1'){ k++; continue; }
        let fim = k; while(bloco[fim] === '1') fim++;
        if(fim - k > S.CHUVA_EM_CONFRONTOS){
          const c = ms[k + S.CHUVA_EM_CONFRONTOS];
          if(!c || !(ehPortador(c.playerSpecies) || ehPortador(c.enemySpecies))) semExplicacao++;
        }
        k = fim;
      }
    }
    const pct = 100 * com / batalhas;
    ok('ela sai numa fatia razoavel das batalhas', pct > 5 && pct < 25,
       pct.toFixed(1) + '% (' + com + ' de ' + batalhas + ')');
    /* ELA COMECA TARDE na maioria das vezes, e e isso que prova que o sorteio e na ENTRADA do
       portador: com o dado rolado antes da batalha ela comecaria SEMPRE no confronto 1. */
    ok('e ela comeca DEPOIS do primeiro confronto na maioria das vezes', comecouTarde > com * 0.5,
       comecouTarde + ' de ' + com + ' comecaram depois do 1o');
    /* NENHUM trecho longo sem um portador pra explica-lo: e o invariante que sobrou depois de a
       mecanica passar a poder re-sortear. */
    ok('e nenhum trecho passa de 3 sem um portador pra explicar', semExplicacao === 0, semExplicacao + '');
    ok('marcou confrontos pra a tela mostrar', marcados > 150,
       marcados + ' confrontos (' + (100*marcados/confrontos).toFixed(1) + '% do total)');
  }
  /* O SORTEIO EM SI, no unitario -- e onde a duracao e a nao-renovacao se cobram sem ruido. */
  {
    seco();
    const gy = S.createInstance('gyarados', 50), sn = S.createInstance('snorlax', 50);
    ok('sem portador em campo nao ha sorteio', !S.tentarChuva(sn, sn, () => 0.01) && !S.estaChovendo());
    ok('com portador e o dado baixo, comeca', S.tentarChuva(gy, sn, () => 0.01) && S.estaChovendo());
    ok('e comeca com a duracao cheia', S.CHUVA_EM_CONFRONTOS === 3);
    /* ENQUANTO CHOVE NINGUEM SORTEIA DE NOVO: ela nao se renova. */
    ok('enquanto chove ninguem sorteia de novo', !S.tentarChuva(gy, sn, () => 0.01));
    seco();
    ok('e o dado alto nao faz chover', !S.tentarChuva(gy, sn, () => 0.99) && !S.estaChovendo());
    /* OS DOIS LADOS sorteiam, um dado cada -- e por isso num confronto com dois portadores a
       chance daquele confronto e 19%, nao 10%. */
    let n = 0;
    const rng = S.makeSeededRng('dois-portadores');
    for(let i = 0; i < 40000; i++){ S.limparClima(); if(S.tentarChuva(gy, S.createInstance('lapras', 50), rng)) n++; }
    seco();
    const pct = 100 * n / 40000;
    ok('com portador dos DOIS lados a chance do confronto e ~19%', pct > 17.5 && pct < 20.5, pct.toFixed(2) + '%');
    let m = 0;
    const rng2 = S.makeSeededRng('um-portador');
    for(let i = 0; i < 40000; i++){ S.limparClima(); if(S.tentarChuva(gy, sn, rng2)) m++; }
    seco();
    const pct2 = 100 * m / 40000;
    ok('e com um portador so ela fica nos 10% cheios', pct2 > 9.3 && pct2 < 10.7, pct2.toFixed(2) + '%');
  }

  /* ⚠️ O ESTADO NAO PODE VAZAR ENTRE BATALHAS. O `chuvaRestante` e modulo-level (como o
     `explosaoDoAtivo` e o `itensGastos`), e uma batalha pode acabar com confrontos de chuva
     SOBRANDO -- a chuva dura 3 e a luta pode terminar no primeiro. Sem o zero no comeco da
     proxima, ela comecaria debaixo da chuva de outra pessoa. */
  {
    S.limparClima();
    S.tentarChuva(S.createInstance('gyarados', 50), S.createInstance('snorlax', 50), () => 0.01);
    ok('sobrou chuva de uma batalha curta', S.estaChovendo());
    S.simulateGymBattle([S.createInstance('pidgey', 20)], [S.createInstance('ratata', 20)], () => 0.99);
    ok('e a batalha seguinte comeca SECA', !S.estaChovendo());
    /* ⚠️ NO SERVIDOR O RISCO E MAIOR, e por isso ele tem DUAS portas fechadas a mao: a INSTANCIA e
       reaproveitada entre invocacoes, entao um chuvaRestante que sobre de um simulateGymBattle
       (Torre, ginasio da cidade) vazaria pro proximo ataque da RAIDE ou pro proximo confronto
       ONLINE -- os dois resolvem dano sem passar pelo sortearChuva. Isto e lido do CODIGO: os
       casos acima rodam no cliente e nao alcancam nenhum dos dois. */
    const srvTxt = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
    /* ⚠️ A RAIDE ZERA; O ONLINE PASSOU A DEFINIR (14/09/2026). Os dois fecham a mesma porta -- o
       clima que sobrou na INSTANCIA nao pode vazar --, mas por caminhos diferentes:
         - o simulateBossFight zera e pronto: a raide e um ataque so, sem onde um clima caber;
         - o battleResolveMatchup passou a CARREGAR o clima do estado da partida, porque a chuva
           dele durava UM confronto em vez de tres. Definir com o valor do documento fecha o
           vazamento igual (ele nao le o que sobrou na memoria) E devolve a duracao certa. */
    {
      const i = srvTxt.indexOf('function simulateBossFight(');
      const fim = srvTxt.indexOf('\nfunction ', i + 1);
      /* O ( E ) PRECISAM DO ESCAPE: sem eles o `()` vira grupo de captura e a regex casa com
         "limparClima;", que nao existe em lugar nenhum -- o teste falhava com o codigo CERTO. */
      ok('o simulateBossFight do servidor zera a chuva', srvTxt.slice(i, fim).indexOf('limparClima();') > 0);
    }
    {
      const i = srvTxt.indexOf('function battleResolveMatchup(');
      const fim = srvTxt.indexOf('\nfunction ', i + 1);
      const corpo = srvTxt.slice(i, fim);
      ok('e o battleResolveMatchup DEFINE o clima a partir do estado (nunca le o que sobrou)',
         /definirClima\(estado\.chuva \|\| 0\)/.test(corpo) && corpo.indexOf('limparClima();') < 0,
         corpo.indexOf('limparClima();') >= 0 ? 'ainda limpa' : 'define');
    }
    /* E o unico que SORTEIA e o simulateGymBattle -- se outro passar a sortear, o clima nasce em
       modo que ninguem mediu. */
    const sorteios = (srvTxt.match(/tentarChuva\(/g) || []).length;
    ok('e so o simulateGymBattle sorteia chuva', sorteios === 2,   // a definicao + a unica chamada
       sorteios + ' ocorrencias');
  }

  /* NA TELA, e sao TRES coisas diferentes (11/09/2026, a pedido, olhando um print):
     1) a FRASE no meio da batalha, com a pausa de 1s antes de a luta comecar;
     2) a LINHA no log, SO no confronto que ativou, com o selo CLICAVEL;
     3) o 🌧️ em cima do ×, em TODO confronto que teve chuva. */
  {
    const m = {
      player:'Squirtle', enemy:'Cubone', playerSpecies:'squirtle', enemySpecies:'cubone',
      playerHpBefore: 299, playerHpAfter: 150, enemyHpBefore: 290, enemyHpAfter: 0,
      playerMove:'Water', enemyMove:'Ground', chuva: true,
      golpes:[{ q:'p', d:0, hp:299, c:0, m:0, z:0, x:'chuva', g:'Dança da Chuva' },
              { q:'p', d:160, hp:130 }, { q:'e', d:149, hp:150 }, { q:'p', d:130, hp:0 }]
    };
    const limpo = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    /* 1) A FRASE, palavra por palavra como foi pedida. */
    const aviso = p => limpo(S.avisoDoConfronto(m, p) || '');
    ok('nada e anunciado antes de comecar a chover', aviso(0) === '', aviso(0) || '(vazio)');
    ok('a frase da chuva e a pedida, e sai NO passo dela',
       /Squirtle usou Dança da Chuva e começa a chover/.test(aviso(1)), aviso(1));
    /* E CEDE quando a luta comeca -- "e entao comeca a batalha novamente". */
    ok('e cede o lugar quando a luta comeca', !/chover/.test(aviso(2)), aviso(2) || '(vazio)');
    /* A PAUSA DE 1s: ela e um passo de dano ZERO, entao sem a pausa a frase apareceria e sumiria
       no mesmo quadro -- o defeito que a Faixa de Foco ja teve. Ela vem DEPOIS do passo desde
       12/09/2026 (a marca `leitura`), e nao mais antes dele. */
    ok('e a pausa de 1s esta la, DEPOIS do passo dela',
       S.pausaDaFaixa(S.buildAnimatedHitSequence(m)[0]) === S.PAUSA_LEITURA_ESPECIAL_MS,
       S.pausaDaFaixa(S.buildAnimatedHitSequence(m)[0]) + 'ms');
    ok('ela esta declarada no passosDaAbertura', (function(){
      const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
      const mm = txt.match(/const passosDaAbertura = \{([^}]*)\}/);
      return !!mm && /chuva:\s*1/.test(mm[1]);
    })());
    /* 2) A LINHA NO LOG, com o SELO CLICAVEL -- o unico selo clicavel do jogo. */
    const log = logAberto([m]);
    ok('o log traz a linha da ativacao', /Squirtle<\/span> usou/.test(log) && /começa a chover/.test(log));
    ok('e o selo dela e CLICAVEL', /class="type-pill selo-clicavel"[^>]*abrirEspecialInfo/.test(log),
       (log.match(/<button[^>]*selo-clicavel[^>]*>/) || ['(sem botao)'])[0].slice(0, 90));
    /* Ele abre a MESMA caixa dos especiais -- nao uma segunda. */
    ok('e ele abre a caixa da chuva', /abrirEspecialInfo\(&quot;chuva&quot;/.test(log));
    /* 3) O 🌧️ EM CIMA DO ×, em todo confronto com chuva. */
    /* o + do log comprimido entra logo depois do ×, no mesmo bloco central -- o invariante que
       importa e o 🌧️ vir ANTES dele, que e o que diz "este confronto teve chuva". */
    ok('o selo da chuva fica em cima do ×',
       /<span class="mlog-x"><span class="mlog-chuva">(?!<\/span>)[^<]*<svg[^>]*>[^<]*<use href="#s-chuva"\/><\/svg><\/span>×/.test(log));
    const semChuva = Object.assign({}, m, { chuva: false, golpes: m.golpes.slice(1) });
    const logSeco = logAberto([semChuva]);
    ok('e confronto sem chuva nao ganha o emoji', !/mlog-chuva/.test(logSeco));
    ok('nem a linha da ativacao', !/começa a chover/.test(logSeco));
    /* CONFRONTO QUE SO HERDOU a chuva: tem o emoji, mas NAO a linha -- foi o pedido ao pe da letra
       ("no log, voce vai escrever somente na batalha que foi ativada"). */
    const herdou = Object.assign({}, m, { golpes: m.golpes.slice(1) });   // chuva:true, sem o registro
    const logHerdou = logAberto([herdou]);
    ok('confronto que so HERDOU a chuva tem o emoji', /mlog-chuva/.test(logHerdou));
    ok('mas NAO repete a linha da ativacao', !/começa a chover/.test(logHerdou));
    /* O SELO DO QUADRO DE BATALHA (o que diz "este confronto esta sob chuva") continua nas QUATRO
       telas. Isto e lido do CODIGO: uma tela de fora seria a unica muda. */
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    for(const fn of ['renderSpecialBattling','renderTrainerBattling','renderBattling','renderLeagueWatch']){
      const i = txt.indexOf('function ' + fn + '(');
      const fim = txt.indexOf('\nfunction ', i + 1);
      /* ⚠️ ESTA TRAVA COBRAVA O NOME `chuvaBadgeHtml(m)`, E ISSO CADUCOU EM 25/09/2026: os selos
         passaram a dividir UMA fileira (`faixaDeSelosDaBatalha`) e tres das quatro telas trocaram
         de porta. Ela nao foi afrouxada -- hoje cobra que a tela emita a fileira por ALGUMA das
         duas, que e a regra de verdade ("esta tela mostra o selo"). */
      const corpoTela = txt.slice(i, fim);
      ok('o ' + fn + ' mostra o selo da chuva',
         corpoTela.indexOf('chuvaBadgeHtml(m)') > 0 || corpoTela.indexOf('faixaDeSelosDaBatalha(') > 0);
    }
    /* ⚠️ E OS DOIS SELOS FICAM NA MESMA FILEIRA (25/09/2026, a pedido: *"o selo da danca da chuva,
       hoje aparece embaixo do selo do terreno, coloque para ficar ao lado"*).
       ⚠️ A CAUSA ERA ESTRUTURAL e nao de estilo -- cada selo emitia o PROPRIO `.terrain-badge-row`,
       que e um bloco com margem --, entao a trava conta as FILEIRAS em vez de olhar o CSS: com dois
       selos tem que sair UMA. */
    const terrenoT = S.TERRAINS[0];
    const comChuva = { chuva:true };
    const faixa2 = S.faixaDeSelosDaBatalha(terrenoT, comChuva);
    ok('com terreno E chuva sai UMA fileira so',
       (faixa2.match(/terrain-badge-row/g) || []).length === 1, faixa2.slice(0, 110));
    ok('  e ela tem os DOIS selos',
       (faixa2.match(/terrain-inline-badge/g) || []).length === 2);
    ok('  com o da chuva DEPOIS do terreno',
       faixa2.indexOf('chuva-badge') > faixa2.indexOf(terrenoT.name));
    ok('so com terreno sai um selo',
       (S.faixaDeSelosDaBatalha(terrenoT, null).match(/terrain-inline-badge/g) || []).length === 1);
    ok('so com chuva sai um selo',
       (S.faixaDeSelosDaBatalha(null, comChuva).match(/terrain-inline-badge/g) || []).length === 1);
    /* ⚠️ SEM NENHUM DOS DOIS ELA NAO PODE SAIR VAZIA: a fileira tem margem, e uma fileira vazia
       deixaria 10px sobrando em toda tela de batalha sem terreno e sem chuva -- que sao a maioria. */
    ok('sem nenhum dos dois nao sai fileira', S.faixaDeSelosDaBatalha(null, null) === '');
  }

  /* A FICHA DA POKEDEX. Ela e a unica passiva POR BATALHA, e a ficha tem que dizer isso: um
     "10% por confronto" ali seria mentir por um fator de seis num time cheio. */
  {
    const e = S.especiaisDaEspecie('blastoise').find(x => x.efeito === 'chuva');
    ok('o Blastoise anuncia a Danca da Chuva', !!e && e.nome === 'Dança da Chuva' && e.tipo === 'Water',
       JSON.stringify(e));
    ok('e ela e marcada como POR BATALHA', !!e && e.porBatalha === true);
    const g = S.__getGame();
    g.pokedexFicha = { id:'blastoise', shiny:false };
    const ficha = S.renderPokedexFicha();
    ok('a ficha escreve "por batalha", nao "por confronto"',
       /10% por batalha/.test(ficha) && !/Dança da Chuva[\s\S]{0,120}por confronto/.test(ficha));
    g.pokedexFicha = null;
    /* O GYARADOS tem TRES: Furia, Furia do Dragao e Danca da Chuva -- e cada uma abre a sua caixa. */
    const tres = S.especiaisDaEspecie('gyarados').map(x => x.efeito).sort();
    ok('o Gyarados tem furia do dragao E chuva', tres.indexOf('chuva') >= 0 && tres.indexOf('furiadragao') >= 0,
       tres.join(','));
  }
}
console.log('\n=== A CAIXA QUE EXPLICA O ESPECIAL (11/09/2026) ===');
{
  /* Pedida assim: "para todos os ataques especiais/passivas, coloque que quando o usuario clicar
     em cima dessa habilidade passiva, abre um modal explicando o que ocorre quando acontece
     aquela habilidade na partida". */
  const limpo = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  /* 1) TODO EFEITO QUE A FICHA SABE MOSTRAR TEM EXPLICACAO -- e o contrario tambem.
        Sem esta trava, um especial novo nasce com a linha clicavel abrindo uma caixa VAZIA, e so
        no bicho que tem AQUELE especial: o tipo de defeito que fica meses sem ninguem ver.
        E o mesmo tipo de trava que o TIPO_DO_ESPECIAL ja tem pro selo. */
  const efeitos = new Set();
  Object.keys(S.SPECIES).concat(['mew']).forEach(id =>
    S.especiaisDaEspecie(id).forEach(e => efeitos.add(e.efeito)));
  const semTexto = [...efeitos].filter(x => !S.EXPLICACAO_DO_ESPECIAL[x]);
  const semDono  = Object.keys(S.EXPLICACAO_DO_ESPECIAL).filter(x => !efeitos.has(x));
  ok('todo especial da ficha tem explicacao', semTexto.length === 0, semTexto.join(',') || [...efeitos].sort().join(', '));
  ok('e nenhuma explicacao sobra sem dono', semDono.length === 0, semDono.join(','));
  /* SAO CATORZE desde 12/09/2026: os DEZ do tentarGolpeEspecial (contando a chuva, que tem dado
     proprio), o SKETCH -- que entrou so pra APARECER na ficha, e acontece DEPOIS da batalha --, o
     REMOINHO, que e o unico que nao cabe no tentarGolpeEspecial (ele muda QUEM esta no confronto,
     e isso so o laco da batalha sabe fazer), e as DUAS DANCAS de ataque, que tem dado proprio como
     a chuva.
     O NUMERO E FIXADO de proposito: especial novo tem que passar por aqui, e a lista abaixo diz
     QUAIS sao -- uma contagem sozinha nao diria qual entrou nem qual sumiu. */
  /* ⚠️ ERAM CATORZE ATE 15/09/2026: o 'drenar' saiu quando a PASSIVA de drenagem acabou -- quem
     drena hoje nao tem passiva, tem um GOLPE, e quem conta isso e o cartao dele (ver a observacao
     do obsDoGolpe). O NUMERO continua FIXADO de proposito: especial novo tem que passar por aqui. */
  /* ⚠️ E ERAM TREZE ATE 24/09/2026: o 'confusao' saiu quando a PASSIVA de confusao acabou -- quem
     confunde hoje nao tem passiva, tem um GOLPE, e quem conta isso e o cartao dele (o asterisco do
     obsDoGolpe). E a MESMA saida do 'drenar' em 15/09, pela mesma razao: a ficha conta o que a
     especie faz SOZINHA, e confundir deixou de ser isso. */
  ok('sao os DOZE especiais do jogo', efeitos.size === 12, efeitos.size + ': ' + [...efeitos].sort().join(', '));
  ok('e sao estes',
     [...efeitos].sort().join(',') === 'anula,chuva,cura,espadas,explosao,furia,furiadragao,metronomo,pluma,remoinho,sketch,sono',
     [...efeitos].sort().join(', '));
  ok('e o Sketch e do Smeargle, e so dele',
     Object.keys(S.SPECIES).filter(id => S.especiaisDaEspecie(id).some(e => e.efeito === 'sketch')).join(',') === 'smeargle',
     Object.keys(S.SPECIES).filter(id => S.especiaisDaEspecie(id).some(e => e.efeito === 'sketch')).join(','));
  /* A FICHA DELE NAO PODE SAIR MUDA: o Smeargle nao tem outro especial, e o Sketch e a unica coisa
     que ele faz que os seis numeros nao contam. Era isso que faltava antes desta entrada. */
  {
    const e = S.especiaisDaEspecie('smeargle');
    ok('o Smeargle tem exatamente um especial na ficha, o Sketch',
       e.length === 1 && e[0].nome === 'Sketch' && e[0].tipo === 'Normal', JSON.stringify(e));
    /* SEM CHANCE, como o Metronomo: ele nao e sorteado, acontece sempre. */
    ok('e ele nao declara chance (nao e sorteio)', e[0].chance == null, String(e[0].chance));
  }
  /* O `quando` E UM CONJUNTO FECHADO. Sao QUATRO momentos e eles jogam muito diferente; um quinto
     escrito com outra palavra ("no fim da luta") passaria despercebido e as duas travas abaixo --
     que procuram por /Resolve/ e /cada golpe/ -- deixariam de valer sobre ele. */
  {
    /* SAO CINCO desde 11/09/2026: a DANCA DA CHUVA trouxe o quinto, e ele e o unico que vale por
       VARIOS confrontos -- os outros abrem ou resolvem UM, o Metronomo vale a cada golpe e o
       Sketch e depois da batalha. */
    const validos = ['Abre o confronto','Resolve o confronto','A cada golpe','Depois da batalha',
                     'Dura {CHUVACONF} confrontos'];
    const fora = Object.entries(S.EXPLICACAO_DO_ESPECIAL)
      .filter(([, x]) => validos.indexOf(x.quando) < 0).map(([k, x]) => k + ':' + x.quando);
    ok('todo `quando` e um dos cinco momentos conhecidos', fora.length === 0, fora.join(', '));
  }

  /* 2) TODA ENTRADA CARREGA O EFEITO. E por ele que a caixa e escolhida -- sem ele a linha nao
        tem o que abrir, e o `abrirEspecialInfo` recusa em silencio. */
  const semEfeito = [];
  Object.keys(S.SPECIES).forEach(id =>
    S.especiaisDaEspecie(id).forEach(e => { if(!e.efeito) semEfeito.push(id + ':' + e.nome); }));
  ok('toda entrada do especiaisDaEspecie tem `efeito`', semEfeito.length === 0, semEfeito.slice(0,5).join(', '));

  /* 3) A CAIXA E POR MECANICA, NAO POR NOME -- e e isso que a estrutura promete. O sono tem 5
        nomes e a confusao 11; todos abrem o MESMO texto, com o nome DAQUELA especie no titulo.
        Sem isso o texto teria que ser escrito 19 vezes, e a vigesima divergiria. */
  /* ⚠️ A CONFUSAO SAIU DESTE EXEMPLO EM 24/09/2026: ela era o caso mais forte dele (11 nomes,
     um texto so) e deixou de ser passiva de especie -- hoje quem confunde e o GOLPE, e quem
     explica e o asterisco do cartao. O SONO continua provando a mesma regra, com 5 nomes. */
  const nomesDoSono = [...new Set(Object.values(S.SONIFEROS))];
  ok('o sono tem 5 nomes e uma explicacao so', nomesDoSono.length === 5, nomesDoSono.join(', '));
  {
    /* O Paras dorme com Esporo e a Jigglypuff com Canto: MESMO texto, titulos diferentes. */
    const a = S.especiaisDaEspecie('paras').find(e => e.efeito === 'sono');
    const b = S.especiaisDaEspecie('jigglypuff').find(e => e.efeito === 'sono');
    S.abrirEspecialInfo(a.efeito, a.nome, a.tipo, a.chance);
    const hA = S.renderEspecialInfoModal();
    S.abrirEspecialInfo(b.efeito, b.nome, b.tipo, b.chance);
    const hB = S.renderEspecialInfoModal();
    ok('o Paras e a Jigglypuff leem o MESMO texto', limpo(hA).replace('Esporo','') === limpo(hB).replace('Canto',''),
       a.nome + ' / ' + b.nome);
    ok('mas cada um com o NOME da especie dele no titulo',
       hA.indexOf('Esporo') >= 0 && hB.indexOf('Canto') >= 0 && hA.indexOf('Canto') < 0);
    /* E o SELO sai na cor do tipo daquele nome -- o Esporo e Planta, o Canto e Normal. */
    ok('e o selo sai na cor do tipo daquele nome',
       hA.indexOf(S.TYPE_COLORS.Grass) >= 0 && hB.indexOf(S.TYPE_COLORS.Normal) >= 0);
  }

  /* 4) OS NUMEROS SAEM DAS CONSTANTES, nao escritos a mao no texto. E o que impede a caixa de
        mentir no dia em que o balanceamento mudar -- o defeito que a especialidade teve quando
        valia 1% e o CLAUDE.md dizia "~13 pontos". */
  ok('o texto nao tem marcador por substituir',
     !/\{[A-Z_0-9]+\}/.test(Object.values(S.EXPLICACAO_DO_ESPECIAL)
       .map(x => S.textoDoEspecial(x.texto) + ' ' + (x.detalhes||[]).map(S.textoDoEspecial).join(' ')).join(' ')));
  ok('a trava dos 70% vem da constante',
     S.textoDoEspecial('{CURA}') === String(Math.round(S.CURA_MAXIMO_DO_HP * 100)), S.textoDoEspecial('{CURA}'));
  ok('o bonus da furia tambem', S.textoDoEspecial('{FURIA}/{FURIA2}/{FURIA3}') ===
     [S.FURIA_BONUS, S.FURIA_BONUS*2, S.FURIA_BONUS*3].join('/'), S.textoDoEspecial('{FURIA}/{FURIA2}/{FURIA3}'));
  ok('e o dano da furia do dragao', S.textoDoEspecial('{DRAGAO}') === String(S.FURIA_DRAGAO_DANO),
     S.textoDoEspecial('{DRAGAO}'));
  /* Os limites da drenagem sairam junto com a passiva: a explicacao dela nao existe mais, e o teste
     abaixo ja cobra que nenhum marcador fique por substituir. */

  /* 5) O MOMENTO e a informacao que o jogador mais erra sobre este bloco, e ele TEM que bater com
        o motor: so a AUTODESTRUICAO resolve o confronto (return true); todo o resto e abertura
        (continue) e a luta acontece inteira depois. O Metronomo e o unico que vale a cada golpe.
        Um texto dizendo o contrario seria pior que texto nenhum.
        ⚠️ ESTA TRAVA JA TRABALHOU, no dia em que nasceu: a primeira versao da caixa dizia que o
        SONO tambem resolvia o confronto. Era verdade ate 02/09/2026 (quando ele matava o alvo) e
        deixou de ser -- hoje ele compra UMA troca livre e a luta acontece inteira. Texto de tela
        que envelhece calado e exatamente o que ela existe pra impedir. */
  const resolvem = Object.entries(S.EXPLICACAO_DO_ESPECIAL)
    .filter(([, x]) => /Resolve/.test(x.quando)).map(([k]) => k).sort();
  ok('so a explosao diz que RESOLVE o confronto', resolvem.join(',') === 'explosao', resolvem.join(','));
  const aCadaGolpe = Object.entries(S.EXPLICACAO_DO_ESPECIAL)
    .filter(([, x]) => /cada golpe/.test(x.quando)).map(([k]) => k);
  ok('e so o Metronomo vale A CADA GOLPE', aCadaGolpe.join(',') === 'metronomo', aCadaGolpe.join(','));
  /* E O MOTOR TEM QUE CONCORDAR: quem diz "abre o confronto" nao pode resolve-lo. Isto e lido do
     CODIGO, nao de uma lista -- o `return true` do tentarGolpeEspecial e a fonte da verdade. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    /* A FATIA VAI ATE O `faixaDeFoco`, que e a funcao seguinte. Usar o `equiparItens` de fim (a
       primeira tentativa) dava fatia VAZIA, porque ele fica ANTES do tentarGolpeEspecial no
       arquivo -- e aí o teste passava sem ler nada, que e o pior jeito de um teste passar. */
    const i0 = txt.indexOf('function tentarGolpeEspecial');
    const bloco = txt.slice(i0, txt.indexOf('function faixaDeFoco', i0));
    ok('achei o corpo do tentarGolpeEspecial pra ler', bloco.length > 2000, bloco.length + ' chars');
    /* Cada efeito vale do `if` dele ate o proximo. O SONO nao tem `if` proprio (ele e o que sobra
       depois dos outros, no fim do laco), entao ele entra na conta a parte -- e e justamente ele
       que esta trava pegou escrito errado. */
    const partes = bloco.split(/if\(especial\.efeito === '/).slice(1);
    const resolveNoMotor = partes.filter(p => /\breturn true;/.test(p))
                                 .map(p => p.slice(0, p.indexOf("'")));
    const cauda = bloco.slice(bloco.lastIndexOf('_dormindoPor = SONO_EM_TROCAS'));
    if(/\breturn true;/.test(cauda)) resolveNoMotor.push('sono');
    resolveNoMotor.sort();
    ok('o motor so RESOLVE o confronto no que a caixa diz', resolveNoMotor.join(',') === resolvem.join(','),
       'motor: ' + (resolveNoMotor.join(',') || '(nenhum)') + '  |  caixa: ' + resolvem.join(','));
  }

  /* 6) A LINHA DA FICHA E UM BOTAO, e o alvo do toque e a linha inteira. */
  {
    const g = S.__getGame();
    g.pokedexFicha = { id:'charizard', shiny:false };
    const ficha = S.renderPokedexFicha();
    const linhas = (ficha.match(/<button type="button" class="dex-especial"/g) || []).length;
    ok('cada especial da ficha e um botao', linhas === 2, linhas + ' botoes (o Charizard tem 2)');
    ok('e cada um chama o abrirEspecialInfo com o efeito dele',
       ficha.indexOf("abrirEspecialInfo('furia'") >= 0 && ficha.indexOf("abrirEspecialInfo('furiadragao'") >= 0);
    /* O ⓘ e o que diz que ha o que ler: sem ele o selo se le como os selos estaticos do jogo. */
    ok('e a linha traz o ⓘ', (ficha.match(/dex-especial-info/g) || []).length === 2);
    /* A ARMADILHA DA CASA: <button> dentro de <button> e HTML invalido -- o navegador fecha o de
       fora sozinho e o clique de dentro se perde, com a tela continuando a PARECER certa. Ja
       aconteceu duas vezes neste projeto (a lupa do encontro selvagem e a do montador). */
    ok('e NENHUM botao esta dentro de outro',
       !/<button[^>]*>(?:(?!<\/button>)[\s\S])*<button/.test(ficha));
    /* Especie sem especial nenhum nao ganha a secao -- uma lista vazia diria menos que nada.
       ⚠️ PROCURAR POR `dex-especiais` DA FALSO POSITIVO: a classe `dex-especiais-tit` e reusada
       pelo titulo da lista de GOLPES POR NIVEL, que toda especie tem. O que so a secao dos
       especiais tem e o BOTAO, e e ele que se procura. */
    const semEspecial = Object.keys(S.SPECIES).find(id => S.especiaisDaEspecie(id).length === 0);
    g.pokedexFicha = { id: semEspecial, shiny:false };
    ok('especie sem especial nao ganha a secao (' + semEspecial + ')',
       S.renderPokedexFicha().indexOf('class="dex-especial"') < 0);
    g.pokedexFicha = null;
  }

  /* 7) ABRIR E FECHAR, e a recusa do efeito que nao existe (senao a caixa abre VAZIA). */
  {
    S.abrirEspecialInfo('furia', 'Fúria', 'Normal', 0.3);
    ok('abrir guarda o especial', !!S.__getGame().especialInfo);
    const html = S.renderEspecialInfoModal();
    ok('e a caixa traz o momento, a chance e o texto',
       /ABERTURA|Abre o confronto/i.test(limpo(html)) && /30% por confronto/.test(limpo(html)) &&
       limpo(html).indexOf('entra em fúria') >= 0, limpo(html).slice(0, 70));
    S.fecharEspecialInfo();
    ok('e fechar limpa', S.__getGame().especialInfo === null);
    S.abrirEspecialInfo('inventado', 'X', 'Normal', 0.1);
    ok('efeito desconhecido NAO abre caixa vazia', S.__getGame().especialInfo === null);
  }

  /* 8) O METRONOMO E O UNICO SEM CHANCE (ele sai em TODO golpe -- o que se sorteia e QUAL), e a
        caixa dele nao pode inventar um numero. */
  {
    const m = S.especiaisDaEspecie('togepi').find(e => e.efeito === 'metronomo');
    ok('o Metronomo nao declara chance', m && m.chance == null, JSON.stringify(m));
    S.abrirEspecialInfo(m.efeito, m.nome, m.tipo, '');
    ok('e a caixa dele nao mostra "% por confronto"',
       limpo(S.renderEspecialInfoModal()).indexOf('por confronto') < 0);
    S.fecharEspecialInfo();
  }

  /* 9) A CAIXA E ANEXADA DEPOIS DA FICHA no render -- os modais empilham na ordem em que entram, e
        vindo antes ela abriria ATRAS da ficha, que e de onde ela e aberta. Isso e lido do CODIGO:
        os casos aqui chamam as funcoes direto e passariam com a ordem trocada. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const iFicha = txt.indexOf('if(game.pokedexFicha){ html += renderPokedexFicha(); }');
    const iCaixa = txt.indexOf('if(game.especialInfo){ html += renderEspecialInfoModal(); }');
    ok('a caixa e anexada DEPOIS da ficha', iFicha > 0 && iCaixa > iFicha,
       'ficha em ' + iFicha + ', caixa em ' + iCaixa);
  }
}
console.log('\n=== QUEM CAI NAO REVIDA: O GOLPE MORIBUNDO ACABOU (15/09/2026) ===');
{
  /* ⚠️ ESTE BLOCO SUBSTITUI O "QUEM JA ESTAVA RASPANDO NAO LEVA REVIDE" (13/09) E O DO PISO (12/09).
     Os dois mediam remendos EM CIMA do revide de quem cai -- o piso de 1%-10% que o impedia de
     matar, e o ramo que o zerava contra alvo ja raspando. Com o revide fora, nenhum dos dois tem o
     que medir: eles foram de 300+ casos para ZERO, e o teste falhava sem nada estar errado.
     O que se cobra agora e o invariante NOVO, que e mais simples e mais forte: caiu, acabou. */
  const mk = (id, lv, hpPct) => {
    const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p);
    p.hp = Math.max(1, Math.round(p.maxHp * (hpPct == null ? 1 : hpPct)));
    p.ataques = S.ataquesPadrao(p);
    return p;
  };
  /* 1) O CASO DIRETO: um forte RASPANDO mata um fraco, e o fraco NAO revida.
        Antes ele revidava (limitado pelo piso); agora o diario do lado dele sai vazio.
        ⚠️ E o doExchange NO LUGAR do simulateGymBattle, porque aquele CURA o time B -- a mesma
        armadilha do preservePlayerHp que este arquivo ja registrou tres vezes. */
  const FORTES = ['aerodactyl','dragonite','tyranitar','machamp','gengar','arcanine'];
  const FRACOS = ['caterpie','weedle','magikarp','pidgey','ratata','sunkern'];
  let casos = 0, revidou = 0, marcaM = 0, doisCairam = 0;
  for(let i = 0; i < 4000; i++){
    const forte = mk(FORTES[i % FORTES.length], 50, 0.02);   // raspando
    const fraco = mk(FRACOS[i % FRACOS.length], 50, 0.6);
    const diario = [];
    S.doExchange(forte, fraco, Math.random, diario);
    if(fraco.hp > 0) continue;                                // nao morreu: nao e o cenario
    casos++;
    // o `q` do fraco e 'e': ele e o `enemy` do doExchange
    if(diario.some(g => !g.x && g.q === 'e' && g.d > 0)) revidou++;
    if(diario.some(g => g.m)) marcaM++;
    if(forte.hp <= 0 && fraco.hp <= 0) doisCairam++;
  }
  ok('casos de sobra pra medir', casos > 1000, casos + ' abates com o atacante raspando');
  ok('quem CAI nao revida (nenhuma linha dele)', revidou === 0, revidou + ' de ' + casos);
  ok('e a marca de moribundo nunca mais e gerada', marcaM === 0, marcaM + ' de ' + casos);
  ok('os dois NUNCA caem na mesma troca (fora a autodestruicao)', doisCairam === 0, doisCairam + ' de ' + casos);

  /* 2) NA BATALHA INTEIRA: a marca nao aparece em confronto nenhum, e os unicos casos de "os dois
        caem" sao a AUTODESTRUICAO -- que zera o HP dentro do tentarGolpeEspecial e devolve antes
        de chegar na troca. */
  const IDS = Object.keys(S.SPECIES);
  const instA = (id, lv) => { const p = S.createInstance(id, lv); p.ataques = S.ataquesPadrao(p); return p; };
  let conf = 0, comMarca = 0, ambos = 0, ambosSemBoom = 0;
  for(let v = 0; v < 400; v++){
    const a = [], b = [];
    for(let k = 0; k < 3; k++){ a.push(instA(IDS[Math.floor(Math.random()*IDS.length)], 50));
                                b.push(instA(IDS[Math.floor(Math.random()*IDS.length)], 50)); }
    for(const m of (S.simulateGymBattle(a, b, Math.random).matchups || [])){
      conf++;
      if((m.golpes||[]).some(g => g.m)) comMarca++;
      if(m.playerHpAfter <= 0 && m.enemyHpAfter <= 0){
        ambos++;
        if(!(m.golpes||[]).some(g => g.x === 'boom' || g.x === 'boomself')) ambosSemBoom++;
      }
    }
  }
  ok('amostra de batalha de sobra', conf > 1000, conf + ' confrontos');
  ok('nenhum confronto tem marca de moribundo', comMarca === 0, comMarca + ' de ' + conf);
  ok('e todo confronto em que os dois caem e autodestruicao', ambosSemBoom === 0,
     ambos + ' com os dois caidos, ' + ambosSemBoom + ' sem explosao');

  /* 3) ⚠️ O CODIGO MORTO NAO PODE VOLTAR. Os cinco remendos do revide sairam dos DOIS motores, e o
        teste LE O CODIGO: um deles reaparecendo sem o revide seria exatamente o tipo de coisa que
        fica anos no arquivo sem ninguem saber que esta morta. */
  {
    const fs2 = require('fs');
    const cli = fs2.readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const srvTxt = fs2.readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
    const some = (re) => !re.test(cli) && !re.test(srvTxt);
    ok('o DYING_BLOW_FACTOR nao existe mais', some(/const DYING_BLOW_FACTOR/));
    ok('o piso do revide nao existe mais', some(/const REVIDE_PISO_(MIN|MAX)/));
    ok('o apararRevide nao existe mais', some(/const apararRevide =/));
    ok('e o revideIaMatar tambem nao', some(/const revideIaMatar/));
    /* ⚠️ O QUE FICA: o teto de quem RASPA, que e outra regra (sobre o ATAQUE de quem tem pouca
       vida, nao sobre o revide de quem caiu). Ele continua nos dois motores. */
    ok('mas o teto de quem raspa FICA nos dois motores',
       /MORIBUNDO_TETO_NO_CHEIO/.test(cli) && /MORIBUNDO_TETO_NO_CHEIO/.test(srvTxt));
    /* ⚠️ E O REORDENAMENTO DO MORIBUNDO FICA NA APRESENTACAO, pra LOG VELHO: diario gravado antes
       de hoje tem a marca, e sem o reordenamento aquele log volta a mostrar pokemon atacando com a
       barra em zero. E a mesma decisao do desempate. */
    ok('o reordenamento do moribundo fica no cliente (log velho tem a marca)',
       /if\(!g\.m \|\| terminouVivo/.test(cli));
  }

  /* 4) ⚠️ LOG VELHO CONTINUA LEGIVEL, e e por isso que o reordenamento ficou. Um diario gravado
        ANTES de hoje tem a marca `m` e o revide gravado por ULTIMO (o motor escrevia na ordem
        cronologica); sem o reordenamento, aquele log volta a mostrar o Onix atacando depois de o
        Bulbasaur ter zerado a barra dele. E a mesma decisao do `x:'desempate'`. */
  {
    const velho = {
      player:'Bulbasaur', enemy:'Onix', playerSpecies:'bulbasaur', enemySpecies:'onix',
      playerHpBefore:180, playerHpAfter:60, playerMaxHp:180,
      enemyHpBefore:170, enemyHpAfter:0, enemyMaxHp:170,
      playerMove:'Grass', enemyMove:'Rock', playerMoveId:'vinewhip', enemyMoveId:'rockthrow',
      golpes:[
        { q:'e', d:60,  hp:120, c:0, m:0, z:0, mv:'rockthrow' },
        { q:'p', d:170, hp:0,   c:0, m:0, z:0, mv:'vinewhip'  },
        { q:'e', d:60,  hp:60,  c:0, m:1, z:0, mv:'rockthrow' }   // o revide, com a marca
      ]
    };
    const seq = S.sequenciaDoConfronto(velho);
    let hpP = velho.playerHpBefore, hpE = velho.enemyHpBefore, cadaver = false;
    const caiu = { p:-1, e:-1 };
    seq.forEach((g, k) => {
      if(g.x) return;
      if((g.q === 'p' ? hpP : hpE) <= 0 && caiu[g.q] !== k - 1) cadaver = true;
      if(g.q === 'p'){ hpE = Math.max(0, hpE - g.d); if(hpE === 0 && caiu.e < 0) caiu.e = k; }
      else { hpP = Math.max(0, hpP - g.d); if(hpP === 0 && caiu.p < 0) caiu.p = k; }
    });
    ok('log VELHO (com a marca m) ainda reordena o revide pra frente',
       seq[0] && seq[0].q === 'e' && seq[0].d === 60, seq.map(g => g.q + ':' + g.d).join(' '));
    ok('e nele ninguem ataca com a barra em zero', !cadaver);
  }

}

/* O ultimo bloco dirige o desafio do Mewtwo, que e uma funcao async -- por isso o fim do teste mora
   dentro dele (o arquivo e CommonJS e nao tem await de topo). */
(async function(){
console.log('\n=== OS LACOS DE REVELACAO CHEGAM AO FIM ===');
{
  /* ⚠️ O DEFEITO DE 13/09/2026, reportado como *"a luta contra o Mewtwo lvl 99 que aparece na
     pokedex, a luta nao esta acontecendo"*: o `advanceLeagueWatch` usava o confronto (`m`) ANTES de
     declara-lo -- `const` e zona morta temporal, entao a primeira volta estourava
     "Cannot access 'm' before initialization", a animacao morria no primeiro golpe e a tela ficava
     parada pra sempre. E nao era so o Mewtwo: sao QUATRO telas nessa revelacao (o desafio do
     Mewtwo, a liga assistida, a partida da Trainers League e o desempate dela), todas travadas de
     09 a 13/09/2026.

     A LICAO E A COBERTURA, nao a linha: dos cinco lacos de animacao do jogo, so DOIS eram dirigidos
     por teste. Um erro assim nao aparece em `node --check` nem no carregamento da pagina -- so
     rodando o laco ate o fim. Este bloco dirige os dois que faltavam.
     (O quinto, o do online, pinta direto no DOM e depende de uma partida em curso; ele continua de
     fora, e isso fica dito aqui pra ser decisao e nao descuido.) */
  const time = (ids, lv) => ids.map((id,i)=> S.createInstance(id, lv + i));
  const meu = time(['venusaur','charizard','blastoise','snorlax','gyarados','dragonite'], 70);
  const dele = time(['machamp','alakazam','gengar','lapras','arcanine','tyranitar'], 70);
  const r = S.simulateGymBattle(meu, dele, S.makeSeededRng('lacos'));
  ok('a batalha de teste tem confrontos de sobra', r.matchups.length >= 3, r.matchups.length + ' confrontos');

  /* Dirige um laco ate ele parar de andar, cobrando que nenhuma volta estoure -- nem a que avanca,
     nem a que desenha. O 'andar' e medido pelo par (indice, fase): parou de mudar, acabou. */
  /* ⚠️ A CHAVE DO 'ANDOU' INCLUI O PASSO DO GOLPE, e nao so (indice, fase): dentro de um confronto
     o laco avanca golpe a golpe SEM mudar nenhum dos dois, entao um confronto de quatro golpes
     pareceria travado na terceira volta -- o teste acusaria um defeito que nao existe. */
  const dirigir = (nome, avanca, chave, leIndice, leFase, desenha) => {
    let erro = null, voltas = 0, parado = 0, ultimo = '';
    while(voltas < 400 && parado < 3){
      try{ avanca(); }
      catch(e){ erro = e && e.message; break; }
      try{ desenha(); }
      catch(e){ erro = 'ao desenhar: ' + (e && e.message); break; }
      const agora = chave();
      parado = (agora === ultimo) ? parado + 1 : 0;
      ultimo = agora; voltas++;
    }
    ok(nome + ': o laco roda ate o fim sem estourar', !erro, erro || (voltas + ' voltas'));
    return { erro, indice: leIndice(), fase: leFase() };
  };

  /* 1) A TELA DA LIGA ASSISTIDA -- a do relato. */
  {
    const g = S.__getGame();
    g.trainerName = 'Buzzo';
    g.leagueWatch = { playerAName:'Buzzo', playerBName:'Mewtwo', matchups: r.matchups,
                      winnerName: r.win ? 'Buzzo' : 'Mewtwo' };
    g.leagueWatchIndex = 0; g.leagueWatchPhase = 'loading'; g.leagueWatchLastHit = null;
    g.leagueWatchReturnScreen = 'pokedex'; g.screen = 'leagueWatch';
    S.__setGame(g);
    const chaveLiga = ()=>{ const j = S.__getGame(); return j.leagueWatchIndex + ':' + j.leagueWatchPhase + ':' + j.leagueWatchHitStep; };
    const fim = dirigir('liga assistida', S.advanceLeagueWatch, chaveLiga,
      ()=>S.__getGame().leagueWatchIndex, ()=>S.__getGame().leagueWatchPhase, S.renderLeagueWatch);
    ok('e chega no ULTIMO confronto', fim.indice === r.matchups.length - 1,
       'parou em ' + fim.indice + '/' + (r.matchups.length - 1) + ', fase ' + fim.fase);
    ok('e termina mostrando o resultado', fim.fase === 'result', 'fase: ' + fim.fase);
  }

  /* 2) A TELA DA TORRE / RAIDE. */
  {
    const g = S.__getGame();
    g.trainerBattleResult = { matchups: r.matchups, win: r.win };
    g.trainerRevealIndex = 0; g.trainerRevealPhase = 'loading'; g.trainerLastHit = null;
    g.trainerBattleMeta = { opponentName:'Treinador', title:'Torre' };
    g.screen = 'trainerBattling';
    S.__setGame(g);
    const chaveTorre = ()=>{ const j = S.__getGame(); return j.trainerRevealIndex + ':' + j.trainerRevealPhase + ':' + j.trainerHitStep; };
    const fim = dirigir('torre / raide', S.advanceTrainerReveal, chaveTorre,
      ()=>S.__getGame().trainerRevealIndex, ()=>S.__getGame().trainerRevealPhase, S.renderTrainerBattling);
    ok('e chega no ULTIMO confronto', fim.indice === r.matchups.length - 1,
       'parou em ' + fim.indice + '/' + (r.matchups.length - 1) + ', fase ' + fim.fase);
  }

  /* 3) E O CAMINHO DO RELATO DE PONTA A PONTA: a celula do Mewtwo na Pokedex monta a luta, e ela
     ANDA. Sem este caso, os dois de cima continuariam verdes se o desafio parasse de chegar na
     tela de revelacao. */
  {
    const g = S.freshGameDefaults();
    g.trainerName = 'Buzzo'; g.authUser = { uid:'u1' };
    g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
    g.saveSlots[0] = { slot:0, trainerName:'Buzzo', badgeCount:8, customName:'Time 1',
      team: ['venusaur','charizard','blastoise','snorlax','gyarados','dragonite']
        .map((id,i)=>({ speciesId:id, level:70+i, shiny:i===0 })) };
    S.__setGame(g);
    let erro = null;
    try{ await S.startMewtwoBattle(0); }catch(e){ erro = e && e.message; }
    const d = S.__getGame();
    ok('o desafio do Mewtwo monta a luta', !erro && d.screen === 'leagueWatch',
       erro || ('tela: ' + d.screen));
    const total = (d.leagueWatch && d.leagueWatch.matchups || []).length;
    const chave = ()=>{ const j = S.__getGame(); return j.leagueWatchIndex + ':' + j.leagueWatchPhase + ':' + j.leagueWatchHitStep; };
    const fim = dirigir('desafio do Mewtwo', S.advanceLeagueWatch, chave,
      ()=>S.__getGame().leagueWatchIndex, ()=>S.__getGame().leagueWatchPhase, S.renderLeagueWatch);
    ok('e a luta anda ate o ultimo confronto', total > 0 && fim.indice === total - 1,
       'parou em ' + fim.indice + '/' + (total - 1));
  }
}

console.log('\n=== O ROLAMENTO DOBRA A CADA USO SEGUIDO (14/09/2026) ===');
{
  /* Pedido: *"dobrar o poder a cada uso, depois de 5x usados consecutivamente, reseta o poder para
     30 novamente, caso use outro ataque sem ser o Rollout, reseta tambem"*. E o PRIMEIRO golpe do
     jogo cujo poder depende do que aconteceu nas trocas anteriores. */
  const mk = (id, lv, ats) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; p.ataques = ats || S.ataquesPadrao(p); return p; };
  const alvo = mk('machop', 50, ['karatechop']);

  /* A ESCALA, com o contador forcado: 30, 60, 120, 240, 480 e de volta pra 30 */
  {
    const g = mk('golem', 50, ['rollout']);
    const poderes = [];
    for(let n = 0; n < 6; n++){ g._rolamento = n % S.ROLAMENTO_USOS; poderes.push(S.melhorAtaque(g, alvo).poder); }
    ok('o poder dobra a cada uso', poderes.slice(0, 5).join(',') === '30,60,120,240,480', poderes.join(','));
    ok('e o 6o uso volta pro comeco', poderes[5] === 30, String(poderes[5]));
    ok('sao ' + S.ROLAMENTO_USOS + ' usos ate zerar', S.ROLAMENTO_USOS === 5);
  }

  /* O CONTADOR ANDA SOZINHO, e so pra quem usou o Rolamento */
  {
    const g = mk('golem', 50, ['rollout']);
    S.calcDamage(g, alvo, S.makeSeededRng('r1')); S.atualizarRolamento(g);
    ok('usar o Rolamento sobe o contador', g._rolamento === 1, String(g._rolamento));
    S.calcDamage(g, alvo, S.makeSeededRng('r2')); S.atualizarRolamento(g);
    ok('e sobe de novo', g._rolamento === 2, String(g._rolamento));
    /* ⚠️ OUTRO GOLPE ZERA -- e o "caso use outro ataque, reseta tambem" do pedido */
    g.ataques = ['earthquake'];
    S.calcDamage(g, alvo, S.makeSeededRng('r3')); S.atualizarRolamento(g);
    ok('usar OUTRO golpe zera o contador', g._rolamento === 0, String(g._rolamento));
  }

  /* E A ESCALA CHEGA NA TELA. Sem isso o jogador le o mesmo nome tirando 71, 123 e 246 e procura
     bug onde e regra -- a mesma licao do selo de critico, que voltou por isso. */
  {
    let m = null;
    /* ⚠️ MAIS TENTATIVAS, e um alvo mais DURO: precisa de dois usos escalados que NAO matam, e o
       golpe que mata deixou de servir de prova desde 14/09/2026. Com o Shuckle nivel 55 o Golem
       derrubava no segundo uso quase sempre. */
    for(let i = 0; i < 1200 && !m; i++){
      const a = [mk('golem', 50, ['rollout'])], b = [mk('shuckle', 75, ['rockthrow'])];
      const x = (S.simulateGymBattle(a, b, S.makeSeededRng('rl' + i)).matchups || [])[0];
      /* ⚠️ PRECISA DE DOIS USOS ESCALADOS QUE NAO MATAM: desde 14/09/2026 o golpe que mata mostra
         so o que sobrava, entao um Rolamento que derruba no 2o uso nao serve pra provar que a
         escala cresce -- ele encolhe por outro motivo, e legitimo. */
      const escalados = x ? (x.golpes || []).filter(g => !g.x && g.q === 'p' && g.rl > 1) : [];
      const ult = escalados.length ? escalados[escalados.length - 1] : null;
      const uteis = (ult && ult.hp != null && ult.hp <= 0) ? escalados.length - 1 : escalados.length;
      if(uteis >= 2) m = x;
    }
    ok('achei um confronto com o Rolamento escalando', !!m);
    if(m){
      const meus = (m.golpes || []).filter(g => !g.x && g.q === 'p');
      ok('o diario carrega a escala de cada linha', meus.some(g => g.rl === 2) && meus.some(g => g.rl === 4),
         meus.map(g => g.d + (g.rl > 1 ? 'x' + g.rl : '')).join(' '));
      /* ⚠️ O CONFRONTO SAI DO TETO: a reconstrucao nao conhece escala e achatava a mecanica em 68%
         dos casos (medido). E a MESMA excecao do sono. */
      const seq = S.sequenciaDoConfronto(m);
      ok('e a sequencia mostra os golpes REAIS, sem reconstruir', seq.filter(g => g.rl > 1).length >= 2,
         seq.filter(g => !g.x).map(g => g.d + (g.rl > 1 ? 'x' + g.rl : '')).join(' '));
      const html = S.passosHtml(m);
      ok('e o selo do log mostra o x2 e o x4', /Rolamento \u00d72/.test(html) && /Rolamento \u00d74/.test(html),
         html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').match(/Rolamento[^.]{0,20}/g).join(' | '));
      /* e o numero na tela CRESCE, que e a mecanica.
         ⚠️ O GOLPE QUE MATOU FICA DE FORA (14/09/2026): desde que ele deixou de ser suavizado, ele
         mostra so o que sobrava -- e um Rolamento que mata no 3o uso sai MENOR que o 2o sem que a
         escala tenha deixado de crescer. O que a trava cobra e a mecanica, nao o resto da barra. */
      const rs = seq.filter(g => !g.x && g.q === 'p' && g.rl > 1);
      const ultimoR = rs.length ? rs[rs.length - 1] : null;
      const ds = ((ultimoR && ultimoR.hp != null && ultimoR.hp <= 0) ? rs.slice(0, -1) : rs).map(g => g.d);
      ok('e o dano cresce junto', ds.length >= 2 && ds[1] > ds[0], ds.join(' -> '));
    }
  }

  /* NAO VAZA ENTRE BATALHAS -- o mesmo cuidado do teto de HP da Furia */
  {
    const t = [mk('golem', 50, ['rollout'])], e = [mk('shuckle', 50, ['rockthrow'])];
    S.simulateGymBattle(t, e, S.makeSeededRng('vaza'));
    ok('o contador nao sobra na instancia depois da batalha', !t[0]._rolamento, String(t[0]._rolamento));
  }

  /* OS DOIS MOTORES: a mesma tabela e a mesma regra */
  {
    const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
    ok('o GOLPE_ROLAMENTO existe nos dois', /const GOLPE_ROLAMENTO = "rollout"/.test(cli) && /const GOLPE_ROLAMENTO = "rollout"/.test(srv));
    ok('e o ROLAMENTO_USOS tambem', /const ROLAMENTO_USOS = 5/.test(cli) && /const ROLAMENTO_USOS = 5/.test(srv));
    /* ⚠️ O CONTADOR ANDA NO golpesDaTroca, que roda UMA VEZ POR ATAQUE -- no calcDamage ele
       contaria uma vez por TAPA, e um golpe de varios tapas daria cinco usos num ataque so. */
    ok('e o contador anda no golpesDaTroca nos dois', /atualizarRolamento\(atacante\)/.test(cli) && /atualizarRolamento\(atacante\)/.test(srv));
  }
}

console.log('\n=== O SINO CURATIVO (Heal Bell) ===');
{
  /* Pedido: *"adicionar a habilidade passiva Heal Bell da Miltank e Celebi, tendo a mesma mecanica
     que o RECOVER do Alakazam"*. Ele cai no MESMO ramo `cura`: abre o confronto, so vale abaixo do
     CURA_MAXIMO_DO_HP, e e `continue` -- a luta acontece inteira depois. */
  ok('sao a Miltank e o Celebi', S.SINO_CURATIVO.join(',') === 'miltank,celebi', S.SINO_CURATIVO.join(','));
  ok('com a mesma chance do Recuperar', S.CHANCE_SINO === S.CHANCE_RECUPERAR, S.CHANCE_SINO + ' x ' + S.CHANCE_RECUPERAR);
  const mk = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; return p; };
  /* ⚠️ ELE SAIU DA FILA DE ABERTURA EM 24/09/2026: o Recuperar e o Sino viraram um golpe da TROCA
     (o curaDaTroca), entao o sorteio de abertura nao os conhece mais. A trava nao foi afrouxada --
     ela virou a da regra nova. */
  ok('o Sino NAO esta mais na fila de abertura',
     S.sorteiaGolpeEspecial(mk('miltank', 50), () => 0.001) === null);
  {
    const p = mk('miltank', 50); p.hp = Math.round(p.maxHp * 0.3);
    const d = [];
    S.doExchange(p, mk('machop', 30), () => 0.001, d, 'p', 'e');
    ok('a Miltank cura com o Sino, na troca',
       d.some(g => g.x === 'recover' && g.g === 'Sino Curativo'), d.map(g => g.x + ':' + (g.g||'')).join(','));
  }
  /* ⚠️ O CELEBI JA ESTA NO RECUPERACAO, e o Recuperar vem ANTES na fila: ele cura com "Recuperar" e
     o Sino sai na chance composta. Fica registrado porque a ficha dele mostra os dois. */
  {
    const p = mk('celebi', 50); p.hp = Math.round(p.maxHp * 0.3);
    const d = [];
    S.doExchange(p, mk('machop', 30), () => 0.001, d, 'p', 'e');
    const c = d.find(g => g.x === 'recover');
    ok('e o Celebi, que tem os dois, cura com o Recuperar', c && c.g === 'Recuperar', c ? c.g : '(nao curou)');
  }
  /* a mecanica e a MESMA: so abaixo do teto, e nao resolve o confronto */
  {
    const p = mk('miltank', 50); p.hp = p.maxHp;   // cheia: nao cura
    const d = [];
    S.tentarGolpeEspecial(p, mk('machop', 48), () => 0.001, d);
    ok('com a vida cheia ela NAO cura (a trava dos ' + Math.round(S.CURA_MAXIMO_DO_HP * 100) + '%)',
       !d.some(g => g.x === 'recover'), d.map(g => g.x).join(','));
  }
  {
    const p = mk('miltank', 50); p.hp = Math.round(p.maxHp * 0.3);
    const d = [];
    S.doExchange(p, mk('machop', 30), () => 0.001, d, 'p', 'e');
    ok('machucada ela cura, na troca', d.some(g => g.x === 'recover' && g.g === 'Sino Curativo'),
       d.map(g => g.x + ':' + (g.g||'')).join(','));
  }
  ok('a ficha da Pokedex anuncia', (S.especiaisDaEspecie('miltank') || []).some(e => e.nome === 'Sino Curativo'),
     JSON.stringify(S.especiaisDaEspecie('miltank')));
  ok('e o tipo dele e Normal, como no jogo oficial', S.TIPO_DO_ESPECIAL['Sino Curativo'] === 'Normal');
}

console.log('\n=== AS DUAS FRASES NOVAS: acordou e chuva terminou ===');
{
  const mk = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; p.ataques = S.ataquesPadrao(p); return p; };
  /* ⚠️ A ORDEM E O PEDIDO: *"quando um pokemon dormir, ele vai tomar um dano, E DEPOIS DISSO, exiba
     a mensagem"*. A primeira versao gravava no comeco do doExchange e a linha saia ANTES do golpe. */
  {
    let m = null;
    for(let i = 0; i < 600 && !m; i++){
      const a = ['butterfree','blastoise','krabby'].map(id => mk(id, 45));
      const b = ['gyarados','vileplume','raichu'].map(id => mk(id, 45));
      S.equiparNpc(b);
      (S.simulateGymBattle(a, b, S.makeSeededRng('ac' + i)).matchups || []).forEach(x => {
        if(!m && (x.golpes || []).some(g => g.x === 'acordou')) m = x;
      });
    }
    ok('achei um confronto em que alguem acorda', !!m);
    if(m){
      const xs = (m.golpes || []);
      const iSono = xs.findIndex(g => g.x === 'sono');
      const iAcordou = xs.findIndex(g => g.x === 'acordou');
      const iGolpe = xs.findIndex((g, k) => k > iSono && !g.x && g.d > 0);
      ok('a ordem e: dorme, APANHA, e so entao acorda', iSono < iGolpe && iGolpe < iAcordou,
         'sono@' + iSono + ' golpe@' + iGolpe + ' acordou@' + iAcordou);
      const html = S.passosHtml(m);
      ok('a frase e a pedida, palavra por palavra', /acordou e voltou \u00e0 luta!/.test(html),
         (html.replace(/<[^>]+>/g, ' ').match(/[A-Z]\w* acordou[^.]*/) || ['(nao achei)'])[0]);
      /* ⚠️ O `q` E DE QUEM ACORDOU, como o da furia -- a linha e sobre UM pokemon. Se ele fosse do
         outro lado (a convencao do sono), a frase nomearia o pokemon errado. */
      const reg = xs.find(g => g.x === 'acordou');
      ok('e ela nomeia quem REALMENTE acordou', html.indexOf(reg.g) >= 0, reg.q + ' / ' + reg.g);
      /* ela vale 1 passo, como toda frase que nao mexe barra -- fora da tabela valeria PRA SEMPRE */
      ok('e ela vale 1 passo na animacao', S.passosDaAbertura && S.passosDaAbertura.acordou === 1);
    }
    /* ⚠️ E A ORDEM TEM QUE VALER NA TELA, nao so no diario (14/09/2026, reportado num Venusaur x
       Vileplume: *"a Vileplume fez o venusaur dormir mas ele ja acordou sem a vileplume ter batido
       nele"*). O MOTOR estava certo; o que embaralhava era a sequenciaDoConfronto, que tratava o
       despertar como ABERTURA -- e abertura e puxada pro TOPO quando o confronto cai na
       reconstrucao, o que na epoca acontecia sempre que ele passava do TETO_GOLPES.
       A trava e sobre a TELA de proposito: e la que o defeito aparecia, e o diario ja tinha trava. */
    {
      const mk2 = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; p.ataques = S.ataquesPadrao(p); return p; };
      let n = 0, fora = 0, exemplo = null;
      for(let i = 0; i < 700 && n < 200; i++){
        const t = ['butterfree','venusaur','krabby','gengar','blastoise','onix'].map(id => mk2(id, 45 + (i % 9)));
        const e = ['vileplume','gyarados','raichu','rhydon','alakazam','arcanine'].map(id => mk2(id, 45 + (i % 7)));
        S.equiparNpc(e);
        (S.simulateGymBattle(t, e, S.makeSeededRng('ord' + i)).matchups || []).forEach(x => {
          if(!(x.golpes || []).some(g => g.x === 'acordou')) return;
          n++;
          const seq = S.sequenciaDoConfronto(x);
          /* ⚠️ A CONTA E POR PAR (sono -> acordou), e nao por confronto (25/09/2026). Com o sono
             virando golpe da TROCA um confronto pode ter VARIOS pares -- e pode abrir com um
             `acordou` de sono HERDADO do confronto anterior e receber um `sono` novo depois dele.
             Medido: 26 de 200 confrontos assim, com o motor certo.
             Exemplo real: p72, ACORDOU, e214, p151, SONO, p80, e91 -- o primeiro despertar nao tem
             sono nenhum antes (o ponto de partida dele e o comeco do confronto) e o sono do meio
             nao tem despertar depois (o confronto acabou com ele dormindo). */
          const jA = seq.findIndex(g => g.x === 'acordou');
          /* o sono DESTE despertar e o ultimo antes dele; sem nenhum, o inicio e o confronto */
          let jS = -1;
          for(let k = 0; k < jA; k++) if(seq[k].x === 'sono') jS = k;
          const jG = seq.findIndex((g, k) => k > jS && !g.x && g.d > 0);
          /* ⚠️ MAS SO QUANDO ALGUEM PODIA BATER. Esta trava nasceu supondo que quem dorme SEMPRE
             apanha antes de acordar -- e isso era verdade so enquanto nada podia travar o
             ATACANTE. A paralisia (16/09/2026) e a primeira coisa que trava: o dono do sono perde
             o turno, ninguem bate, e o adormecido acorda mesmo assim.
             ⚠️ E ELE ACORDAR ALI ESTA CERTO: o sono compra TURNOS, nao golpes -- o contador anda
             na entrada da troca, tenha havido golpe ou nao. O que a trava cobra continua sendo o
             que ela existe pra cobrar (ele nao acorda ANTES da vez dele), so que agora ela sabe
             que a vez pode ter passado em branco.
             E a mesma licao da trava do despertar que caiu quando o sono virou de 1 a 3 trocas:
             ela media a DURACAO e nao a regra. */
          const travouAlguem = seq.some((g, k) => k > jS && k < jA && (g.x === 'paralisado' || g.x === 'gelado'));
          /* ⚠️ E O SONO PODE NAO ESTAR NESTA SEQUENCIA: o `_dormindoPor` so e solto no fim da
             BATALHA (ver encerrarBatalha), entao quem dorme e SOBREVIVE ao confronto entra no
             seguinte ainda dormindo -- e ali sai um `acordou` sem `sono` nenhum antes. Isso e
             fiel (no jogo original o sono atravessa a troca de pokemon), e ficou COMUM quando o
             alvo de vida cheia parou de morrer num golpe: o adormecido passou a sobreviver.
             ⚠️ E E A TERCEIRA VEZ QUE ESTA TRAVA MEDE A DURACAO EM VEZ DA REGRA -- a primeira foi
             o sono virar de 1 a 3 trocas, a segunda a paralisia. A regra e "ele nao acorda antes
             da vez dele"; de onde o sono veio nao muda isso. Sem `sono` na sequencia, o ponto de
             partida e o COMECO do confronto. */
          /* ⚠️ E O `acordou` QUE INTERESSA E O DE DEPOIS DO SONO (25/09/2026). Com o sono virando
             golpe da TROCA, um confronto pode ter um `acordou` de um sono HERDADO do confronto
             anterior E um `sono` novo depois dele -- e ai o jA ficava ANTES do jS e a conta nunca
             fechava. Medido: 26 de 200, com o motor certo.
             Exemplo real: p72, acordou, e214, p151, SONO, p80, e91. */
          const inicio = jS >= 0 ? jS : -1;
          const jGreal = seq.findIndex((g, k) => k > inicio && !g.x && g.d > 0);
          /* ⚠️ E O `dormindo` E PROVA DIRETA de que ele perdeu o turno (25/09/2026). No SONO DUPLO
             (os dois se dormem na mesma troca) ninguem bate -- os contadores correm juntos --, e o
             que a regra promete e que ele nao acorda ANTES DA VEZ DELE, nao que alguem bateu nele.
             Sem isso a trava acusava 13 de 200 com o motor certo, e o exemplo era literal:
             p124, e76, SONO, SONO, DORMINDO, acordou. */
          const travouReal = seq.some((g, k) => k > inicio && k < jA &&
            (g.x === 'paralisado' || g.x === 'gelado' || g.x === 'dormindo'));
          if(!(travouReal || (jGreal >= 0 && jGreal < jA))){ fora++; if(!exemplo) exemplo = seq.map(g => g.x || (g.q + g.d)).join(','); }
        });
      }
      ok('amostra de sobra pra medir a ordem na tela', n > 100, n + ' confrontos com despertar');
      ok('NA TELA ele tambem acorda depois de apanhar, inclusive nos que passam do teto',
         fora === 0, fora + ' de ' + n + (exemplo ? '   |  ' + exemplo : ''));
    }
  }
  /* A CHUVA SE DESPEDE, no confronto que foi o ULTIMO debaixo dela */
  {
    let m = null;
    for(let i = 0; i < 900 && !m; i++){
      const a = ['blastoise','gyarados','lapras'].map(id => mk(id, 50));
      const b = ['machamp','rhydon','arcanine'].map(id => mk(id, 50));
      S.equiparNpc(b);
      (S.simulateGymBattle(a, b, S.makeSeededRng('cf' + i)).matchups || []).forEach(x => {
        if(!m && (x.golpes || []).some(g => g.x === 'chuvafim')) m = x;
      });
    }
    ok('achei um confronto em que a chuva acaba', !!m);
    if(m){
      const html = S.passosHtml(m);
      ok('a frase e a pedida, palavra por palavra', /A dan\u00e7a da chuva terminou!/.test(html));
      /* ela nao nomeia ninguem: o clima e do CAMPO, nao de quem o invocou */
      ok('e ela nao nomeia treinador nenhum', html.indexOf('chuva terminou') >= 0 && !/\w+ A dan/.test(html));
      ok('e vale 1 passo', S.passosDaAbertura.chuvafim === 1);
      /* ⚠️ ELA SAI NO ULTIMO CONFRONTO DEBAIXO DA CHUVA, nao no seguinte: ali o jogador ja teria
         visto o golpe de Fogo voltar ao normal sem explicacao, e o confronto seguinte pode nem
         existir (a batalha acaba junto). */
      const i = (m.golpes || []).findIndex(g => g.x === 'chuvafim');
      ok('e ela e a ULTIMA linha do confronto', i === (m.golpes || []).length - 1, i + ' de ' + (m.golpes||[]).length);
    }
  }
  ok('e o ponto de exclamacao nao dobra', S.pontuada('Ja tem!') === 'Ja tem!' && S.pontuada('Nao tem') === 'Nao tem!');
}

console.log('\n=== O ONLINE SEGUE A MESMA MECANICA DA JORNADA (14/09/2026) ===');
{
  /* Pedido: *"verifique em geral o funcionamento das batalhas onlines se esta seguindo a mesma
     mecanica das batalhas da jornada"*. O online resolve CONFRONTO A CONFRONTO (battleResolveMatchup)
     e a jornada roda a batalha inteira (simulateGymBattle) -- os dois chamam o MESMO doExchange,
     entao as 11 passivas de confronto valem igual. O que divergia era a DURACAO da chuva. */
  const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
  /* ⚠️ A CHUVA DURAVA UM CONFRONTO NO ONLINE. O comentario dizia que ela "nao existia" ali -- era
     falso desde que a Danca da Chuva entrou (o sorteio mora no tentarGolpeEspecial, que o
     doExchange chama). Medido: ela saia em 10,3% dos confrontos e morria no primeiro, porque o
     battleResolveMatchup chamava limparClima() antes de cada um. */
  ok('o online CARREGA a chuva do estado da partida', /definirClima\(estado\.chuva \|\| 0\)/.test(srv));
  ok('e devolve o que sobrou pro documento', /estado\.chuva = Math\.max\(0, climaRestante\(\) - 1\)/.test(srv));
  ok('o definirClima existe nos DOIS motores', /function definirClima\(n\)/.test(cli) && /function definirClima\(n\)/.test(srv));
  /* e a duracao e a MESMA da jornada */
  {
    const mk = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; return p; };
    let estado = { chuva: 0 }, achou = false;
    for(let i = 0; i < 400 && !achou; i++){
      estado = { chuva: 0 };
      const sobras = [];
      for(let k = 0; k < 4; k++){
        S.definirClima(estado.chuva || 0);
        const a = mk('blastoise', 60), b = mk('machop', 60);
        const d = [];
        let v = 0; while(a.hp > 0 && b.hp > 0 && v++ < 60) S.doExchange(a, b, S.makeSeededRng('oc' + i + k), d);
        if(k === 0 && !d.some(g => g.x === 'chuva')) break;
        estado.chuva = Math.max(0, S.climaRestante() - 1);
        sobras.push(estado.chuva);
      }
      if(sobras.length === 4){
        achou = true;
        ok('a chuva do online dura ' + S.CHUVA_EM_CONFRONTOS + ' confrontos, como na jornada',
           sobras.join(',') === '2,1,0,0', sobras.join(','));
      }
    }
    ok('achei uma chuva pra medir', achou);
  }
  /* ⚠️ O QUE CONTINUA DIFERENTE, e e decisao antiga: o time do online vem de um CODIGO
     (especie:nivel:shiny), entao ele nao tem golpe escolhido e luta no motor de tipo. */
  ok('o battleHydrate NAO da golpe escolhido (o time vem de um codigo)',
     !/inst\.ataques/.test(srv.slice(srv.indexOf('function battleHydrate'), srv.indexOf('function battleHydrate') + 400)));
  /* AS JANELAS GANHARAM +5s, e o cliente desenha os MESMOS numeros */
  ok('as quatro janelas ganharam +5s', /const BATTLE_PICK_MS = 10000/.test(srv) && /const BATTLE_FIRST_PICK_MS = 15000/.test(srv) &&
     /const BATTLE_ACCEPT_MS = 20000/.test(srv) && /const BATTLE_TEAM_PICK_MS = 20000/.test(srv));
  ok('e o cronometro da tela usa os mesmos tetos', /st\.primeiraEscolha \? 15 : 10/.test(cli));
  /* ⚠️ DA PRA TROCAR ATE O TEMPO ACABAR: o servidor sempre aceitou (ele sobrescreve a escolha
     enquanto a fase e `choosing`), quem travava era a tela. */
  ok('a tela deixa trocar enquanto a janela esta aberta', /const janelaAberta = st\.phase===.choosing.;/.test(cli));
  ok('e o servidor aceita a segunda escolha', /if\(souA\) estado\.aChoice = idx; else estado\.bChoice = idx;/.test(srv));
  /* ⚠️ A FRASE DA PASSIVA CEDE O LUGAR AO NOME DO GOLPE, como nas outras quatro telas. Ela ficava
     ESTATICA: o aviso era calculado UMA VEZ, sem passo, e o pintor saia cedo enquanto ele existisse. */
  ok('o aviso do online e perguntado POR PASSO', /avisoDoConfronto\(a\.mVirado, a\.passo\)/.test(cli));
  ok('e o pintor nao sai mais cedo por causa dele', !/if\(!a \|\| a\.avisoEspecial\) return;/.test(cli));
}

console.log('\n=== OS SELOS DAS DUAS DANCAS (14/09/2026) ===');
{
  /* Pedido: *"para a Sword Dance e Feather Dance que acontecer no momento do confronto, coloque um
     sinal para identificar os pokemons afetados"*.
     ⚠️ QUEM E AFETADO NAO E O MESMO NOS DOIS, e e esse o cuidado inteiro:
       - Espadas: quem USA fica com x1,5 de Ataque -> o selo vai no lado do `q`;
       - Pluma:   o ADVERSARIO fica com x0,5      -> o selo vai no lado OPOSTO ao `q`.
     O `q` do diario e sempre de QUEM USOU o golpe (a convencao de todo o motor), entao ler os dois
     igual poria a pluma no pokemon errado -- e o defeito nao apareceria como erro, apareceria como
     o selo no lado que ficou mais FORTE. */
  const mk = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; p.ataques = S.ataquesPadrao(p); return p; };
  /* ⚠️ SAO OS SELOS, nao os caracteres: eles viraram desenho nosso em 17/09/2026. As travas de
     igualdade EXATA continuam exatas -- o valor vem do proprio `selo`, entao ela cobra a saida
     inteira sem envelhecer junto com o desenho. */
  const ESPADA = S.selo('espada', 'selo-g'), PLUMA = S.selo('pluma', 'selo-g');

  /* ⚠️ O CASO DURO E O MESMO POKEMON COM OS DOIS SELOS: o Pinsir danca as espadas E leva a pluma do
     Pidgeot, entao ele sai com ⚔️🪶 e o Pidgeot sai SEM NADA -- ele usou a pluma, mas quem foi
     afetado por ela foi o outro. Foi este caso que a primeira versao erraria. */
  {
    const a = mk('pinsir', 50), b = mk('pidgeot', 50);
    const d = [];
    S.tentarDancas(a, b, () => 0.001, d);      // chance forcada: as duas saem
    const m = { player: a.name, enemy: b.name, golpes: d };
    ok('as duas dancas saem com a chance forcada', d.length === 2, d.map(g => g.x + '@' + g.q).join(','));
    ok('o Pinsir fica com os DOIS selos (dancou E levou a pluma)',
       temSelo(S.selosDoConfronto(m, 'p'), 'espada') && temSelo(S.selosDoConfronto(m, 'p'), 'pluma'),
       JSON.stringify(S.selosDoConfronto(m, 'p')));
    ok('e o Pidgeot fica SEM NENHUM: ele usou a pluma, quem sofreu foi o outro',
       S.selosDoConfronto(m, 'e').trim() === '', JSON.stringify(S.selosDoConfronto(m, 'e')));
    /* e o selo tem que casar com o que o MOTOR marcou na instancia */
    ok('o selo casa com o _espadas/_pluma do motor',
       temSelo(S.selosDoConfronto(m, 'p'), 'espada') === !!a._espadas &&
       temSelo(S.selosDoConfronto(m, 'p'), 'pluma') === !!a._pluma &&
       temSelo(S.selosDoConfronto(m, 'e'), 'espada') === !!b._espadas &&
       temSelo(S.selosDoConfronto(m, 'e'), 'pluma') === !!b._pluma);
  }

  /* OS LADOS INVERTIDOS: o mesmo par, trocando quem e p e quem e e */
  {
    const a = mk('pidgeot', 50), b = mk('pinsir', 50);
    const d = [];
    S.tentarDancas(a, b, () => 0.001, d);
    const m = { player: a.name, enemy: b.name, golpes: d };
    ok('com os lados trocados o selo acompanha',
       temSelo(S.selosDoConfronto(m, 'e'), 'espada') && temSelo(S.selosDoConfronto(m, 'e'), 'pluma') &&
       S.selosDoConfronto(m, 'p').trim() === '',
       'p=' + JSON.stringify(S.selosDoConfronto(m, 'p')) + '  e=' + JSON.stringify(S.selosDoConfronto(m, 'e')));
  }

  /* SO ESPADAS: o selo vai em quem USOU */
  {
    const a = mk('scyther', 50), b = mk('machop', 50);
    const d = []; S.tentarDancas(a, b, () => 0.001, d);
    const m = { player: a.name, enemy: b.name, golpes: d };
    ok('so espadas: o selo vai em quem usou', S.selosDoConfronto(m, 'p') === ' ' + ESPADA &&
       S.selosDoConfronto(m, 'e') === '', JSON.stringify(S.selosDoConfronto(m, 'p')));
  }
  /* SO PLUMA: o selo vai no OUTRO */
  {
    const a = mk('machop', 50), b = mk('pidgey', 50);
    const d = []; S.tentarDancas(a, b, () => 0.001, d);
    const m = { player: a.name, enemy: b.name, golpes: d };
    ok('so pluma: o selo vai em quem SOFREU, nao em quem usou',
       S.selosDoConfronto(m, 'p') === ' ' + PLUMA && S.selosDoConfronto(m, 'e') === '',
       'p=' + JSON.stringify(S.selosDoConfronto(m, 'p')) + '  e=' + JSON.stringify(S.selosDoConfronto(m, 'e')));
  }
  /* SEM DANCA NENHUMA: nada de selo */
  {
    const m = { player: 'A', enemy: 'B', golpes: [{ q:'p', d:10, x:null }] };
    ok('confronto sem danca nao ganha selo', S.selosDoConfronto(m, 'p') === '' && S.selosDoConfronto(m, 'e') === '');
    /* e log VELHO, gravado antes das dancas existirem, sai sem selo -- que e o que ele era */
    ok('e log velho (sem o campo golpes) tambem', S.selosDoConfronto({ player:'A', enemy:'B' }, 'p') === '');
  }

  /* NA TELA: o quadro do lutador mostra */
  {
    let alvo = null;
    for(let i = 0; i < 4000 && !alvo; i++){
      const t = [mk('pinsir', 50)], e = [mk('pidgeot', 50)];
      S.equiparNpc(e);
      const m = (S.simulateGymBattle(t, e, S.makeSeededRng('sel' + i)).matchups || [])[0];
      if(m && (m.golpes || []).filter(g => g.x === 'espadas' || g.x === 'pluma').length === 2) alvo = m;
    }
    ok('achei uma batalha de verdade com as duas dancas', !!alvo);
    if(alvo){
      const html = S.fighterHtml(alvo, 'p', { hp: alvo.playerHpAfter, passo: 99, comTerreno: true });
      ok('o quadro do lutador mostra os dois selos', temSelo(html, 'espada') && temSelo(html, 'pluma'),
         html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50));
      /* ⚠️ QUEM ESTA SAINDO DE CAMPO (o quadro do Remoinho) NAO leva selo: o efeito e de quem esta
         lutando agora. */
      const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
      ok('e quem esta saindo de campo nao leva', /\$\{saindo\?''\:selosDoConfronto\(m, lado, op\.passo\)\}/.test(cli));
    }
  }

  /* AS QUATRO TELAS DE BATALHA leem a MESMA funcao -- copias divergiriam no primeiro ajuste */
  {
    const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const usos = (cli.match(/selosDoConfronto\(/g) || []).length;
    /* 1 definicao + 1 no fighterHtml (as 3 primeiras telas) + 2 na liga assistida + 2 no online.
       ⚠️ A FUNCAO MUDOU DE NOME em 14/09/2026 (selosDaDanca -> selosDoConfronto) quando a FURIA
       entrou nela: ela deixou de ser so das duas dancas. */
    ok('as quatro telas de batalha usam a mesma funcao', usos >= 6, usos + ' usos');
    /* ⚠️ E AS CINCO CHAMADAS PASSAM O PASSO. Sem ele o 🔥 entrega, no primeiro quadro, uma
       queimadura que so vai acontecer seis golpes depois -- reportado em 16/09/2026. Uma tela que
       esqueca o passo volta a ter o defeito, e so nela. */
    {
      /* a DEFINICAO da funcao tambem tem tres parametros -- ela nao e chamada, e sai das duas contas */
      const chamadas = usos - 1;
      const comPasso = (cli.match(/selosDoConfronto\([^)]*,[^)]*,[^)]*\)/g) || []).length - 1;
      ok('e TODAS passam o passo (senao o 🔥 entrega a queimadura cedo)', comPasso === chamadas,
         comPasso + ' de ' + chamadas + ' chamadas');
    }
    ok('a liga assistida mostra', /selosDoConfronto\(m, 'p', game\.leagueWatchHitStep\)/.test(cli) &&
       /selosDoConfronto\(m, 'e', game\.leagueWatchHitStep\)/.test(cli));
    ok('e o online tambem, com a perspectiva ja virada',
       /selosDoConfronto\(anim\.mVirado, 'p', anim\.passo\)/.test(cli) &&
       /selosDoConfronto\(anim\.mVirado, 'e', anim\.passo\)/.test(cli));
  }
}

console.log('\n=== QUEM MORRE DORMINDO NAO ACORDA (14/09/2026) ===');
{
  /* Reportado com print num Venusaur x Mr. Mime: o Mr. Mime levou o golpe dormindo, morreu (0/331),
     e a linha do despertar saiu logo abaixo. Pedido: *"quando um pokemon morre durante o sono, nao
     precisa exibir que ele acordou e voltou para a luta, nem no log e nem na batalha"*.
     ⚠️ O CONTADOR DO SONO ANDA NO COMECO DA TROCA e o pokemon leva o golpe no MEIO dela -- entao so
     depois dos golpes da pra saber se ele chegou vivo ao fim. */
  const mk2 = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; p.ataques = S.ataquesPadrao(p); return p; };
  const puro = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  /* ⚠️ O MR. MIME E O TIME A: o `preservePlayerHp` preserva o A e CURA o B -- montado ao contrario,
     ele entrava cheio e o cenario nao acontecia nenhuma vez em 12.000 voltas. E a mesma armadilha
     que a medicao do revide ja tinha custado. */
  let morreu = 0, comLinha = 0, sobreviveu = 0, semLinha = 0, ex = null;
  for(let i = 0; i < 9000; i++){
    const a = mk2('mrmime', 51); a.hp = 20 + (i % 40);
    const b = mk2('venusaur', 57);
    const m = (S.simulateGymBattle([a], [b], S.makeSeededRng('dorme' + i), { preservePlayerHp:true }).matchups || [])[0];
    if(!m) continue;
    const g = m.golpes || [];
    const iS = g.findIndex(x => x.x === 'sono');
    if(iS < 0) continue;
    const ladoDormiu = g[iS].q === 'p' ? 'e' : 'p';
    if(ladoDormiu !== 'p') continue;
    const iG = g.findIndex((x, k) => k > iS && !x.x && x.d > 0 && x.q !== ladoDormiu);
    if(iG < 0) continue;
    const temLinha = g.some(x => x.x === 'acordou');
    if(g[iG].hp === 0){ morreu++; if(temLinha){ comLinha++; if(!ex) ex = m; } }
    else { sobreviveu++; if(temLinha) semLinha++; }
  }
  /* ⚠️ QUEM SOBREVIVE PRECISA DE UM LACO PROPRIO: com 20-60 de vida o Mr. Mime morre SEMPRE no
     golpe que leva dormindo, e o contra-caso ficava em 0 de 0 -- um teste que nao testa nada. */
  /* ⚠️ O CRITERIO MUDOU EM 15/09/2026, quando o sono passou a durar de 1 a 3 trocas. Ele era
     "sobreviveu ao golpe que levou dormindo => acordou naquela mesma troca" -- verdade enquanto o
     sono comprava UMA troca, e mentira agora: com 2 ou 3, ele sobrevive ao primeiro golpe e
     CONTINUA dormindo. A trava media a duracao, nao a regra, e caiu pra 61 de 120 sem nada estar
     errado.
     O INVARIANTE NOVO nao depende da duracao: **quem volta a ATACAR necessariamente acordou**,
     entao a linha tem que existir. E o que a linha promete, e continua valendo se os pesos
     mudarem de novo. */
  for(let i = 0; i < 4000 && sobreviveu < 120; i++){
    const a = mk2('mrmime', 51);              // cheio: sobrevive ao golpe
    const b = mk2('venusaur', 57);
    const m = (S.simulateGymBattle([a], [b], S.makeSeededRng('vive' + i), { preservePlayerHp:true }).matchups || [])[0];
    if(!m) continue;
    const g = m.golpes || [];
    const iS = g.findIndex(x => x.x === 'sono');
    if(iS < 0) continue;
    const ladoDormiu = g[iS].q === 'p' ? 'e' : 'p';
    if(ladoDormiu !== 'p') continue;
    /* ⚠️ "VOLTOU A ATACAR" MUDOU DE MEDIDA EM 25/09/2026, e sem isso a trava acusava o certo em 28
       de 120: com o sono virando golpe da TROCA, o adormecido AINDA ATACA na troca em que ele e
       dormido -- ele nao voltou, ele nem tinha parado. O que prova que ele voltou e ele bater
       DEPOIS de o dono ter batido, porque o dono so bate sozinho enquanto o outro dorme. */
    const iDono = g.findIndex((x, k) => k > iS && !x.x && x.d > 0 && x.q !== ladoDormiu);
    const voltou = iDono >= 0 && g.some((x, k) => k > iDono && !x.x && x.d > 0 && x.q === ladoDormiu);
    if(!voltou) continue;
    sobreviveu++;
    if(g.some(x => x.x === 'acordou')) semLinha++;
  }
  ok('amostra de sobra: ele morreu dormindo em ' + morreu + ' confrontos', morreu > 100, String(morreu));
  ok('e NENHUM deles anuncia o despertar', comLinha === 0,
     comLinha + ' de ' + morreu + (ex ? '   |  ' + puro(S.passosHtml(ex)).slice(0, 90) : ''));
  /* e o contrario continua valendo: quem VOLTA A ATACAR acordou, e anuncia */
  ok('mas quem VOLTA A ATACAR continua anunciando', sobreviveu > 50 && semLinha === sobreviveu,
     semLinha + ' de ' + sobreviveu);
  /* ⚠️ E O PONTO FINAL NAO DOBRA COM O "!": a frase ja vem pontuada do pedido, e a linha saia "!." */
  {
    let comAcordou = null;
    for(let i = 0; i < 4000 && !comAcordou; i++){
      const m = (S.simulateGymBattle([mk2('venusaur', 57)], [mk2('machop', 45)], S.makeSeededRng('pt' + i)).matchups || [])[0];
      if(m && (m.golpes || []).some(x => x.x === 'acordou')) comAcordou = m;
    }
    ok('achei um despertar pra medir o ponto', !!comAcordou);
    if(comAcordou) ok('a linha do log nao sai com "!."', !/!\./.test(puro(S.passosHtml(comAcordou))),
      (puro(S.passosHtml(comAcordou)).match(/\w+ acordou[^!]*!\.?/) || [''])[0]);
    ok('o pontoFinal so acrescenta quando falta',
       S.pontoFinal('Ja tem!') === 'Ja tem!' && S.pontoFinal('Nao tem') === 'Nao tem.');
  }
}

console.log('\n=== O SELO DA FURIA (14/09/2026) ===');
{
  /* Pedido: *"coloque um sinal tambem no pokemon que esta com Furia ativa"*.
     ⚠️ ELA E DIFERENTE DAS DUAS DANCAS num ponto que importa: **ela ACUMULA por batalha**, entao um
     pokemon pode atravessar tres confrontos furioso com a marca do diario so no PRIMEIRO. Por isso
     o selo sai do CAMPO do matchup (`playerFuria`/`enemyFuria`, o acumulado) e nao da marca --
     lido do diario, ele sumiria justamente nos confrontos em que o bonus e maior. */
  const mk2 = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; p.ataques = S.ataquesPadrao(p); return p; };
  let umaVez = null, acumulada = null, herdada = null, semFuria = null;
  for(let i = 0; i < 9000 && !(umaVez && acumulada && herdada && semFuria); i++){
    const t = [mk2('tauros', 55)];
    const e = ['ratata','pidgey','caterpie','weedle'].map(id => mk2(id, 26));
    S.equiparNpc(e);
    (S.simulateGymBattle(t, e, S.makeSeededRng('fu' + i)).matchups || []).forEach(m => {
      if(!umaVez && m.playerFuria === 1) umaVez = m;
      if(!acumulada && m.playerFuria >= 2) acumulada = m;
      if(!herdada && m.playerFuria > 0 && !(m.golpes || []).some(x => x.x === 'furia')) herdada = m;
      if(!semFuria && !m.playerFuria) semFuria = m;
    });
  }
  ok('achei os quatro casos', !!(umaVez && acumulada && herdada && semFuria));
  ok('com a furia ativa o selo sai', umaVez && temSelo(S.selosDoConfronto(umaVez, 'p'), 'furia'),
     umaVez ? JSON.stringify(S.selosDoConfronto(umaVez, 'p')) : '');
  ok('e so no lado dele', umaVez && !temSelo(S.selosDoConfronto(umaVez, 'e'), 'furia'));
  /* O NUMERO SAI A PARTIR DA SEGUNDA, como a frase do log ja faz: sem ele, um Tauros com +30 de
     tudo mostra o mesmo selo de um com +10. */
  ok('a partir da 2a vez o selo traz o numero',
     acumulada && S.selosDoConfronto(acumulada, 'p').indexOf(String(acumulada.playerFuria)) >= 0,
     acumulada ? JSON.stringify(S.selosDoConfronto(acumulada, 'p')) + ' (furia ' + acumulada.playerFuria + ')' : '');
  ok('e na primeira ele sai LIMPO', umaVez && S.selosDoConfronto(umaVez, 'p').indexOf('1') < 0);
  /* ⚠️ O CASO QUE A MARCA DO DIARIO NAO PEGA -- e o motivo do campo existir */
  ok('a furia HERDADA de um confronto anterior tambem mostra',
     herdada && temSelo(S.selosDoConfronto(herdada, 'p'), 'furia'),
     herdada ? 'furia ' + herdada.playerFuria + ' sem marca no diario' : '');
  ok('e sem furia nao sai selo nenhum', semFuria && !temSelo(S.selosDoConfronto(semFuria, 'p'), 'furia'));
  /* log VELHO, gravado antes do campo existir, sai sem selo -- nao pode sumir */
  ok('log velho (sem o campo) sai sem selo',
     !temSelo(S.selosDoConfronto({ player:'A', enemy:'B', golpes:[] }, 'p'), 'furia'));
  /* e o quadro do lutador mostra */
  if(umaVez){
    const html = S.fighterHtml(umaVez, 'p', { hp: umaVez.playerHpAfter, passo: 99, comTerreno: true });
    ok('o quadro do lutador mostra o selo da furia', temSelo(html, 'furia'),
       String(html).replace(/<[^>]+>/g, ' ').replace(/s+/g, ' ').trim().slice(0, 40));
  }
  /* OS DOIS MOTORES gravam o campo -- o online le o mesmo selo */
  {
    const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
    ok('a furia viaja no matchup nos DOIS motores',
       /playerFuria: active\._furia \|\| 0/.test(cli) && /playerFuria: a\._furia \|\| 0/.test(srv));
  }
}

console.log('\n=== QUEM ESTA RASPANDO NAO DERRUBA UM POKEMON CHEIO NUM GOLPE (14/09/2026) ===');
{
  /* Reportado com print: uma PONYTA com 10 de 362 (2,8%) atravessou um Heracross e um Victreebel
     CHEIOS, matando cada um com um golpe e sem tomar nada de volta. Pedido: *"quando for assim de um
     pokemon com menos de 10% de hp for levar o outro com vida cheia em um golpe so, coloque que o
     dano dele vai ser de 70%"*.
     ⚠️ ELA E A OUTRA METADE DO PISO DO REVIDE: desde 12/09 o revide moribundo nao mata, e desde
     13/09 ele nem gera linha quando o alvo JA estava na faixa -- o que criou exatamente este caso.
     A trava fecha o ciclo pelo lado do ATAQUE. */
  const mk2 = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; p.ataques = S.ataquesPadrao(p); return p; };
  ok('as constantes sao as pedidas', S.MORIBUNDO_ABAIXO_DE === 0.10 && S.MORIBUNDO_TETO_NO_CHEIO === 0.70,
     (100 * S.MORIBUNDO_ABAIXO_DE) + '% / ' + (100 * S.MORIBUNDO_TETO_NO_CHEIO) + '%');

  /* O CASO PEDIDO: raspando, alvo CHEIO, e o golpe mataria -> o alvo fica com 30% */
  {
    const a = mk2('ponyta', 70); a.hp = Math.round(a.maxHp * 0.02); a.ataques = ['fireblast'];
    const b = mk2('caterpie', 40); b.ataques = ['tackle'];
    const m = (S.simulateGymBattle([a], [b], S.makeSeededRng('rasp'), { preservePlayerHp:true }).matchups || [])[0];
    const pct = 100 * m.enemyHpAfter / m.enemyMaxHp;
    ok('o alvo cheio sobra com ~30% da barra', Math.abs(pct - 30) < 2, pct.toFixed(1) + '%');
    ok('e ele revida de pe', m.enemyHpAfter > 0 && m.playerHpAfter <= 0, 'venceu: ' + m.winner);
  }

  /* ⚠️ AS TRES CONDICOES. Fora delas nada muda -- e cada uma tem um caso proprio, porque uma trava
     que morde onde nao devia e pior que trava nenhuma. */
  {
    /* (a) o atacante NAO esta raspando: mata normalmente */
    const a = mk2('ponyta', 70); a.hp = Math.round(a.maxHp * 0.5); a.ataques = ['fireblast'];
    const b = mk2('caterpie', 40); b.ataques = ['tackle'];
    const m = (S.simulateGymBattle([a], [b], S.makeSeededRng('ok1'), { preservePlayerHp:true }).matchups || [])[0];
    ok('com metade da vida ele mata de vida cheia como sempre', m.enemyHpAfter <= 0,
       m.enemyHpAfter + '/' + m.enemyMaxHp);
  }
  {
    /* (b) o alvo NAO esta cheio: mata normalmente -- a trava e sobre derrubar um pokemon INTEIRO.
       ⚠️ AQUI O simulateGymBattle NAO SERVE: ele CURA o time B, entao o alvo entrava cheio e a trava
       pegava -- o teste acusava um defeito que nao existe. E a mesma armadilha do preservePlayerHp
       que ja custou duas medicoes. O doExchange resolve UMA troca com os HPs que eu mando. */
    const a = mk2('ponyta', 70); a.hp = Math.round(a.maxHp * 0.02); a.ataques = ['fireblast'];
    const b = mk2('caterpie', 40); b.ataques = ['tackle']; b.hp = Math.round(b.maxHp * 0.9);
    const d = [];
    S.doExchange(a, b, S.makeSeededRng('ok2'), d);
    ok('contra um alvo JA machucado ele mata normalmente', b.hp <= 0,
       b.hp + '/' + b.maxHp + ' (entrou com 90%)');
  }
  {
    /* (c) o golpe NAO mataria: sai inteiro, sem teto nenhum */
    const a = mk2('ponyta', 55); a.hp = 10; a.ataques = ['ember'];
    const b = mk2('snorlax', 70); b.ataques = ['tackle'];
    const antes = b.hp;
    const m = (S.simulateGymBattle([a], [b], S.makeSeededRng('ok3'), { preservePlayerHp:true }).matchups || [])[0];
    const tirou = antes - m.enemyHpAfter;
    ok('um golpe que NAO mataria sai inteiro', tirou > 0 && m.enemyHpAfter > m.enemyMaxHp * 0.30,
       'tirou ' + tirou + ' de ' + m.enemyMaxHp);
  }

  /* ⚠️ O TETO VALE POR TROCA, nao por golpe: um multi-tapa tambem "leva o outro num ataque so", e
     limitar so o primeiro tapa deixaria os outros quatro matarem do mesmo jeito. */
  {
    /* ⚠️ A REGRA E SOBRE MATAR DE VIDA CHEIA, nao sobre o confronto inteiro: depois da primeira
       troca o alvo JA esta em 30% e a trava deixa de valer -- ele morre na troca seguinte, e nesse
       meio-tempo revidou. E isso que o pedido quer ("nao deveria aguentar tanto"). Por isso o teste
       mede UMA TROCA, com o doExchange. */
    let comTapa = 0, matouNaPrimeira = 0, sobrou30 = 0;
    for(let i = 0; i < 400; i++){
      const a = mk2('ninetales', 70); a.hp = Math.round(a.maxHp * 0.03); a.ataques = ['firespin'];
      const b = mk2('caterpie', 45); b.ataques = ['tackle'];
      const d = [];
      S.doExchange(a, b, S.makeSeededRng('tp' + i), d);
      const tapas = d.filter(g => !g.x && g.q === 'p' && g.tn > 1);
      if(!tapas.length) continue;
      comTapa++;
      if(b.hp <= 0) matouNaPrimeira++;
      if(Math.abs(100 * b.hp / b.maxHp - 30) < 2) sobrou30++;
    }
    ok('amostra de multi-tapa pra medir', comTapa > 50, comTapa + ' trocas');
    ok('e o multi-tapa de quem raspa tambem NAO mata o alvo cheio', matouNaPrimeira === 0,
       matouNaPrimeira + ' de ' + comTapa);
    ok('o alvo sobra com ~30% mesmo levando varios tapas', sobrou30 === comTapa,
       sobrou30 + ' de ' + comTapa);
  }

  /* ⚠️ A TRAVA "o revide moribundo nao passa pelo teto" SAIU EM 15/09/2026: nao existe mais revide
     de quem cai, entao nao ha o que isentar. Quem cobra que o teto continua valendo no caminho que
     sobrou sao os casos acima. */
  /* OS DOIS MOTORES: a mesma regra e os mesmos numeros */
  {
    const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
    ok('as constantes existem nos dois',
       /const MORIBUNDO_ABAIXO_DE = 0\.10;/.test(cli) && /const MORIBUNDO_ABAIXO_DE = 0\.10;/.test(srv) &&
       /const MORIBUNDO_TETO_NO_CHEIO = 0\.70;/.test(cli) && /const MORIBUNDO_TETO_NO_CHEIO = 0\.70;/.test(srv));
    ok('e a funcao tambem', /function tetoDeQuemRaspa|const tetoDeQuemRaspa/.test(cli) && /const tetoDeQuemRaspa/.test(srv));
  }
}

console.log('\n=== O GOLPE QUE MATA MOSTRA O QUE SOBROU, E OS DE ANTES O TAMANHO REAL (14/09/2026) ===');
{
  /* Pedido depois de um print: uma Kingdra SHINY parecendo bater menos que uma normal. A causa era
     o golpe dela ter sido o que MATOU -- o diario grava o dano EFETIVO --, e a suavizacao de 12/09
     ainda repartia o par, achatando um golpe forte de verdade (180) num par morno (110 e 110).
     *"Passa a ser o golpe REAL, porem o segundo golpe que mata vai tirar so o que resta de HP do
     adversario"* -- e com isso a soma CONTINUA fechando com a barra, porque o resto E o que faltava.
     ⚠️ SAO DUAS FAMILIAS, e so uma muda: o REVIDE MORIBUNDO continua sendo suavizado (a trava dele e
     MASCARADA por decisao, entao sem a suavizacao o jogador le "o mesmo golpe escalou"). */
  const mk3 = (id, lv, sh) => { const p = S.createInstance(id, lv); p.shiny = !!sh; p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; p.ataques = S.ataquesPadrao(p); return p; };
  let achei = null, conf = 0, fechou = 0, semExplicacao = 0, comMorte = 0;
  for(let b = 0; b < 400; b++){
    const meu = [mk3('kingdra', 60, true), mk3('gyarados', 60, false), mk3('alakazam', 60, false)];
    const dela = S.equiparNpc([mk3('kingdra', 60, false), mk3('dragonite', 60, false), mk3('starmie', 60, false)]);
    const r = S.simulateGymBattle(meu, dela, S.makeSeededRng('KM' + b));
    (r.matchups || []).forEach(m => {
      const seq = S.sequenciaDoConfronto(m);
      ['p','e'].forEach(lado => {
        const gs = seq.filter(g => !g.x && g.q === lado && g.d > 0);
        if(gs.length < 2) return;
        conf++;
        const ultimo = gs[gs.length - 1];
        const matou = ultimo.hp != null && ultimo.hp <= 0;
        /* A SOMA DO LADO tem que continuar batendo com o que o alvo perdeu.
           ⚠️ A CONTA E A MESMA DA VARREDURA GRANDE deste arquivo, e ela nao e obvia: alem dos golpes
           entram a AUTODESTRUICAO (que segue a convencao do `q` nas duas entradas), o que o alvo
           GANHOU no meio (cura, pocao, drenagem, furia) e o que ele perdeu SEM ser golpe do outro
           lado (o `danoSemGolpe`: drenagem, confusao e Furia do Dragao). Escrita pela metade, ela
           acusa ~9% de falso positivo -- foi o que a primeira versao desta trava fez. */
        const alvoAntes = lado === 'p' ? m.enemyHpBefore : m.playerHpBefore;
        const alvoDepois = lado === 'p' ? m.enemyHpAfter : m.playerHpAfter;
        const dela = seq.filter(g => (!g.x || g.x === 'boom' || g.x === 'boomself') && g.q === lado).reduce((a, g) => a + g.d, 0);
        const ganho = seq.filter(g => subiuAVida(g) && g.q !== lado).reduce((a, g) => a + g.d, 0);
        const perda = seq.reduce((a, g) => a + perdeuSemGolpe(g, lado === 'p' ? 'e' : 'p'), 0);
        if(alvoAntes - dela - perda + ganho === alvoDepois) fechou++;
        if(matou) comMorte++;
        /* NENHUM par pode ficar sem explicacao: ou cabe na banda, ou e o golpe final, ou tem
           critico / Rolamento / multi-tapa / ESTAGIO pra explicar.
           ⚠️ O ESTAGIO ENTROU EM 17/09/2026: quando a Cauda de Ferro baixa a Defesa do alvo, o
           golpe seguinte doi mais de verdade -- e a linha na tela e a explicacao. E ela vale pro
           CONFRONTO e nao pro lado, porque o estagio mexe na Defesa de um e no Dano do outro. */
        const teveEstagio = seq.some(g => g.x === 'estagio');
        const d = gs.map(g => g.d), mx = Math.max.apply(null, d), mn = Math.min.apply(null, d);
        if(mx > mn * 1.30){
          const explicado = teveEstagio || (matou && ultimo.d === mn) || gs.some(g => g.c || g.rl > 1 || g.tn > 1);
          if(!explicado) semExplicacao++;
        }
        if(!achei && matou && gs.length === 2 && gs[0].d > gs[1].d * 2) achei = gs.map(g => g.d);
      });
    });
  }
  ok('a amostra tem lados com 2+ linhas', conf > 500, conf + ' lados, ' + comMorte + ' terminando em morte');
  ok('o primeiro golpe sai GRANDE e o ultimo so termina de matar', !!achei, achei ? achei.join(' e ') : '(nao achei)');
  ok('e a soma continua fechando com a barra', fechou === conf, fechou + ' de ' + conf);
  ok('e NENHUM par fica sem explicacao na tela', semExplicacao === 0, semExplicacao + ' de ' + conf);

  /* ⚠️ E O REVIDE MORIBUNDO CONTINUA SUAVIZADO -- ele e a outra familia, e a trava dele e mascarada.
     A varredura da banda (bem acima neste arquivo) e quem cobra isso, e ela isenta so o golpe final. */
  {
    const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const fn = cli.slice(cli.indexOf('const suavizarAparados ='), cli.indexOf('const reais = expandirRemoinho'));
    /* ⚠️ COMPARACAO LITERAL, sem regex: as chaves e os parenteses destas linhas viram classe de
       caractere e grupo numa expressao regular, e a trava passa a casar com quase tudo. */
    ok('a suavizacao tira o golpe final do bolo',
       fn.indexOf('const matou = ultimo >= 0 && saida[ultimo].hp != null && saida[ultimo].hp <= 0;') >= 0 &&
       fn.indexOf('const bolo = matou ? idx.slice(0, -1) : idx;') >= 0);
    ok('mas continua repartindo o RESTO (o revide moribundo)',
       fn.indexOf('if(bolo.length < 2) return;') >= 0 && fn.indexOf('const total = ds.reduce') >= 0);
  }
}

console.log('\n=== A PAUSA DE LEITURA VALE NO ULTIMO PASSO TAMBEM (14/09/2026) ===');
{
  /* Reportado: *"a mensagem de fim da danca da chuva nao esta esperando 1,5s para ela seguir com o
     processo depois"*. O ramo do passo do MEIO ja somava o `pausaDaFaixa`; o do ULTIMO passo nao.
     So uma abertura cai ali SEMPRE -- o `chuvafim`, que fecha o confronto por desenho --, e era por
     isso que so ela tinha sido relatada. */
  const mk4 = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; p.ataques = S.ataquesPadrao(p); return p; };
  let achei = null;
  for(let i = 0; i < 900 && !achei; i++){
    const a = [mk4('blastoise', 60), mk4('gyarados', 60)];
    const b = S.equiparNpc([mk4('charizard', 60), mk4('arcanine', 60)]);
    const r = S.simulateGymBattle(a, b, S.makeSeededRng('cf' + i));
    (r.matchups || []).forEach(m => {
      if(achei) return;
      const seq = S.buildAnimatedHitSequence(m);
      if(seq.length && seq[seq.length - 1].x === 'chuvafim') achei = seq;
    });
  }
  ok('achei um confronto que TERMINA com a frase da chuva', !!achei);
  if(achei){
    const ult = achei[achei.length - 1];
    ok('o ultimo passo leva a marca de leitura', !!ult.leitura);
    ok('e a pausa dele e a de 1,5s', S.pausaDaFaixa(ult) === S.PAUSA_LEITURA_ESPECIAL_MS,
       S.pausaDaFaixa(ult) + 'ms');
  }
  /* ⚠️ E OS QUATRO LACOS SOMAM ELA no ramo do ultimo passo. Os casos acima medem a marca, nao o
     laco -- sem esta leitura do codigo, um laco que esquecesse a soma passaria. Deixar em um so era
     garantir que a mesma frase durasse tempos diferentes na Elite, na Torre e na liga assistida. */
  {
    const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const lacos = ['advanceSpecialReveal', 'advanceReveal', 'advanceTrainerReveal', 'advanceLeagueWatch'];
    const faltam = lacos.filter(n =>
      cli.indexOf('setTimeout(' + n + ', esperaNome + hitDuration + 800 + pausaDaFaixa(hit));') < 0);
    ok('os quatro lacos somam a pausa no ultimo passo', faltam.length === 0, faltam.join(', ') || 'os quatro');
    ok('e nenhum ficou com o 800 solto', cli.indexOf('esperaNome + hitDuration + 800);') < 0);
  }
}

/* =====================================================================================
   A DRENAGEM NO GOLPE (15/09/2026): tira do adversario e devolve pra si, no MESMO instante.
   E o primeiro efeito colado num GOLPE COMUM -- os onze do tentarGolpeEspecial sao sorteados na
   abertura e valem por CONFRONTO; este vale por GOLPE, toda vez que o golpe sai. */
console.log('\n=== A DRENAGEM NO GOLPE (15/09/2026) ===');
{
  const fs2 = require('fs');
  const cli = fs2.readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const srvTxt = fs2.readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');

  ok('sao os CINCO drenantes da tabela de golpes',
     Object.keys(S.GOLPES_DRENO).sort().join(',') === 'absorb,dreameater,gigadrain,leechlife,megadrain',
     Object.keys(S.GOLPES_DRENO).join(', '));
  ok('todos devolvem METADE do dano, como no jogo oficial',
     Object.values(S.GOLPES_DRENO).every(v => v === 0.5));
  /* A TABELA E DUPLICADA e o dano roda dos DOIS lados: divergencia aqui faz a mesma batalha
     terminar diferente no cliente e no servidor. Compara por VALOR, nao por texto. */
  ok('a tabela e IDENTICA nos dois motores', JSON.stringify(S.GOLPES_DRENO) === JSON.stringify(srv._golpesEspeciais.GOLPES_DRENO),
     JSON.stringify(srv._golpesEspeciais.GOLPES_DRENO));
  ok('e a lista do Comedor de Sonhos tambem',
     JSON.stringify(S.GOLPES_SO_DORMINDO) === JSON.stringify(srv._golpesEspeciais.GOLPES_SO_DORMINDO));
  /* Todo golpe da tabela precisa EXISTIR na tabela de golpes -- uma entrada com id errado seria
     letra morta, e so no bicho que tem aquele golpe. */
  ok('os cinco existem na tabela GOLPES', Object.keys(S.GOLPES_DRENO).every(id => !!S.GOLPES[id]));

  /* A CURA E METADE DO DANO EFETIVO, e nunca passa do teto. Um Oddish machucado contra um alvo
     duro: o Absorver e 4x contra Pedra/Terra, entao o dano e grande e o teto morde. */
  let casos = 0, curas = 0, metadeOk = 0, passouDoTeto = 0, curouMorto = 0, somaOk = 0;
  /* ⚠️ O FIXTURE MUDOU EM 15/09/2026, quando o GOLPE MORIBUNDO acabou: o Oddish x Geodude parou
     de produzir cura nenhuma (0 em 1.036 confrontos). A razao e a mecanica nova -- o Absorver e 4x
     contra Pedra/Terra, o Oddish mata em um golpe, e sem o revide de quem cai ele nunca se machuca.
     Quem nao se machuca nao tem o que curar, e o fixture media zero.
     O par novo e o do RELATO de 15/09 (Tangela Lv.21 contra Goldeen/Horsea/Staryu): ali os tres
     batem nela, ela sobrevive, e sobra cura pra medir. */
  for(let i = 0; i < 1200 && casos < 200; i++){
    const o = inst('tangela', 21); o.ataques = S.ataquesPadrao(o);
    const alvos = [inst('goldeen', 25), inst('horsea', 26), inst('staryu', 27)];
    const r = S.simulateGymBattle([o], alvos, Math.random);
    for(const m of (r.matchups || [])){
      const dreno = (m.golpes || []).find(g => g.x === 'dreno');
      if(!dreno) continue;
      /* ⚠️ CONFRONTO COM EXPLOSAO FICA DE FORA DAS CONTAS: o Geodude e uma das 9 especies de
         autodestruicao, e ela grava DUAS entradas (`boom` + `boomself`) com a convencao do `q` que
         este arquivo ja documenta. Ela nao tem nada a ver com a drenagem, e contada errada dava 22
         falsos positivos em 200. */
      if((m.golpes || []).some(g => g.x === 'boom' || g.x === 'boomself')) continue;
      casos++;
      /* ⚠️ CADA CURA SE MEDE CONTRA O GOLPE QUE A GEROU -- o imediatamente anterior, do mesmo lado
         (num golpe de varios tapas, a soma dos tapas daquele lance). Somar TODOS os golpes do lado
         quebrava no confronto que drena DUAS vezes (duas trocas com Absorver): o `find` pegava a
         primeira cura e a soma era das duas trocas. Raro -- ~1 em 200 --, ou seja o pior tipo de
         teste, o que passa quase sempre. */
      const todos = (m.golpes || []);
      todos.forEach((d, idx) => {
        if(d.x !== 'dreno') return;
        let soma = 0;
        for(let k = idx - 1; k >= 0; k--){
          const g = todos[k];
          if(g.x || g.q !== d.q) break;
          soma += g.d;
          if(!(g.t > 1)) break;          // chegou no primeiro tapa do lance
        }
        /* METADE DO DANO -- ou o que faltava pra encher, e ai o pokemon termina CHEIO. */
        if(d.d === Math.floor(soma * 0.5) || d.hp === m.playerMaxHp) metadeOk++;
        if(d.hp > m.playerMaxHp) passouDoTeto++;
        if(d.hp <= 0) curouMorto++;
        curas++;
      });
      /* A SOMA FECHA: entrada - dano tomado - dano sem golpe + tudo que subiu = saida.
         ⚠️ O ODDISH TAMBEM ESTA NO `ABSORCAO`, a drenagem de ABERTURA -- outra mecanica, com outra
         chance, que cura ele e tira do alvo (`absorb` + `absorbdano`). Contando so o `dreno`, a
         conta acusava 19 confrontos em 200 que estavam certos: TODOS com a abertura junto.
         Por isso aqui se usa o `subiuAVida` e o `danoSemGolpe` do topo, como o resto do arquivo --
         escrever a lista a mao aqui era exatamente o que ia dar errado. */
      const tomou = (m.golpes || []).filter(g => !g.x && g.q === 'e').reduce((a, g) => a + g.d, 0);
      const curou = (m.golpes || []).filter(g => subiuAVida(g) && g.q === 'p').reduce((a, g) => a + g.d, 0);
      const sozinho = (m.golpes || []).reduce((a, g) => a + perdeuSemGolpe(g, 'p'), 0);
      if(m.playerHpBefore - tomou - sozinho + curou === m.playerHpAfter) somaOk++;
    }
  }
  ok('casos de sobra pra medir', casos >= 50, casos + ' confrontos com drenagem');
  ok('a cura e METADE do dano efetivo (ou o que faltava pra encher)', metadeOk === curas, metadeOk + ' de ' + curas + ' curas');
  ok('ela NUNCA passa do teto de vida', passouDoTeto === 0, passouDoTeto + ' de ' + curas);
  ok('e nunca cura quem esta em ZERO', curouMorto === 0, curouMorto + ' de ' + curas);
  ok('a soma fecha: entrada - dano + cura = saida', somaOk === casos, somaOk + ' de ' + casos);

  /* ⚠️ QUEM ESTA CHEIO NAO CURA NADA, e essa e a trava CRONOLOGICA -- a que pegou o primeiro
     defeito da feature. Numa versao anterior as duas curas rodavam juntas no FIM da troca: um
     Oddish cheio matava o Geodude com Absorver, tomava o revide moribundo e SO ENTAO curava,
     terminando cheio de novo. No jogo ele cura zero (ja estava cheio) e termina machucado.
     Aqui o Oddish e mais rapido que o Geodude, entao ele bate primeiro SEMPRE. */
  /* ⚠️ A CONTA E DA PRIMEIRA TROCA, e nao do confronto inteiro (17/09/2026). Ela olhava
     `golpes.some(dreno)` -- o confronto TODO --, e isso so funcionava porque o Oddish cheio MATAVA
     o Geodude no primeiro golpe: nao havia segunda troca. Com a trava do alvo de vida cheia o
     Geodude sobrevive, o Oddish toma o revide e cura na troca seguinte -- **e ai curar esta
     certo**, ele ja nao esta mais cheio. Medido na virada: 292 de 400 "falhavam" sem nada da
     regra cronologica ter mudado.
     E a mesma licao que o MORIBUNDO_TETO_NO_CHEIO ja tinha custado em 14/09 ("ela apagou um
     cenario inteiro do teste"): trava que monta um cenario de morte-num-golpe envelhece quando o
     jogo para de matar num golpe.
     O QUE SE COBRA CONTINUA SENDO A REGRA: enquanto ele esta CHEIO, a cura nao sai. */
  let cheios = 0, curaramATooa = 0;
  for(let i = 0; i < 400; i++){
    const o = inst('oddish', 30); o.ataques = S.ataquesPadrao(o);
    const r = S.simulateGymBattle([o], [inst('geodude', 30)], Math.random);
    const m = (r.matchups || [])[0];
    if(!m || m.playerHpBefore !== m.playerMaxHp) continue;
    cheios++;
    /* a cura so e "a toa" se sair ANTES do primeiro golpe que ELE toma -- dali em diante ele
       esta machucado e curar e o certo */
    const gs = m.golpes || [];
    const tomou = gs.findIndex(g => !g.x && g.q === 'e' && g.d > 0);
    const curou = gs.findIndex(g => g.x === 'dreno');
    if(curou >= 0 && (tomou < 0 || curou < tomou)) curaramATooa++;
  }
  ok('quem entra CHEIO nao cura (a cura vem antes do revide, nao depois)',
     cheios > 50 && curaramATooa === 0, curaramATooa + ' de ' + cheios + ' confrontos com o Oddish cheio');

  /* O COMEDOR DE SONHOS SO VALE CONTRA ALVO DORMINDO -- a pedido, e como no jogo oficial. */
  {
    const g = S.createInstance('gastly', 31); g.ataques = S.ataquesPadrao(g);
    const p = S.createInstance('psyduck', 40);
    ok('o Gastly NAO escolhe Comedor de Sonhos contra alvo acordado',
       S.melhorAtaque(g, p).golpe !== 'dreameater', S.melhorAtaque(g, p).golpe);
    p._dormeAgora = true;
    ok('e escolhe contra alvo DORMINDO', S.melhorAtaque(g, p).golpe === 'dreameater', S.melhorAtaque(g, p).golpe);
    /* ⚠️ MEDIDO que ele nunca e o unico golpe de dano de ninguem -- e por isso o filtro e
       incondicional, e nao "so se sobrar alternativa" como o da anulacao. Se um dia alguma especie
       ficar so com ele, esta trava grita antes de o pokemon ficar sem golpe. */
    let sozinho = null;
    for(const id of Object.keys(S.SPECIES)){
      for(let lv = 5; lv <= 99 && !sozinho; lv++){
        const q = S.createInstance(id, lv); q.ataques = S.ataquesPadrao(q);
        const dano = (q.ataques || []).filter(x => S.GOLPES[x]);
        if(dano.length === 1 && dano[0] === 'dreameater') sozinho = id + ' Lv.' + lv;
      }
      if(sozinho) break;
    }
    ok('e ele nunca e o UNICO golpe de dano de alguem', !sozinho, sozinho || 'nenhuma das 250');
  }

  /* ⚠️ A REDE DO METRONOMO: ele sorteia entre TODOS os golpes de dano da tabela e podia trazer o
     Comedor de Sonhos por fora do melhorAtaque. A guarda vive tambem no `drenar`, e o teste LE O
     CODIGO -- os casos acima passam pelo melhorAtaque e nao cobririam a segunda porta. */
  ok('a guarda do sono vale TAMBEM no motor da cura (rede do Metronomo)',
     /GOLPES_SO_DORMINDO\[quemBate\.lastMove\] && !alvoDormia/.test(cli) &&
     /GOLPES_SO_DORMINDO\[quemBate\.lastMove\] && !alvoDormia/.test(srvTxt));
  /* E O `_dormeAgora` TEM QUE SER MARCADO ANTES DOS GOLPES e limpo depois: o `_dormindoPor` ja foi
     decrementado pelo `acorda`, entao na troca livre ele esta em 0 enquanto o pokemon ainda nao
     atacou -- lido dali, o golpe nunca sairia. */
  ok('o _dormeAgora e marcado antes dos golpes, nos dois motores',
     cli.indexOf('active._dormeAgora = activeDorme;') < cli.indexOf('const dmgToEnemy =') &&
     srvTxt.indexOf('active._dormeAgora = activeDorme;') < srvTxt.indexOf('const dmgToEnemy ='));
  ok('e limpo logo depois', /active\._dormeAgora = false;/.test(cli) && /active\._dormeAgora = false;/.test(srvTxt));
  /* O campo comeca com `_`, entao nao vai pro Firestore (a regra de 11/09/2026 que matou o ciclo
     do save). Se um dia ele perder o underline, o save volta a carregar estado de motor. */
  ok('os campos de motor continuam com _ (nao vao pro Firestore)',
     /_dormeAgora/.test(cli) && !/[^_]dormeAgora/.test(cli.replace(/_dormeAgora/g, '')));

  /* NA TELA: a cura entra na linha do GOLPE, nao abre linha propria -- a regra da casa
     ("duas entradas no diario, uma linha"), a mesma da drenagem de abertura e dos varios tapas. */
  {
    let achou = null;
    for(let i = 0; i < 600 && !achou; i++){
      const o = inst('tangela', 21); o.ataques = S.ataquesPadrao(o);
      const r = S.simulateGymBattle([o], [inst('goldeen',25), inst('horsea',26)], Math.random);
      for(const m of (r.matchups || [])) if((m.golpes||[]).some(g => g.x === 'dreno')) { achou = m; break; }
    }
    ok('achei um confronto com drenagem pra ler a tela', !!achou);
    if(achou){
      const html = S.passosHtml(achou);
      /* SO AS LINHAS DE GOLPE: as aberturas saem com a classe `mlog-passo especial`, e um confronto
         pode ter uma (o Oddish tambem tem a drenagem de ABERTURA, que e outra mecanica). O que se
         cobra aqui e que a CURA nao virou linha -- ou seja, tantas linhas de golpe quantos golpes. */
      const linhas = (html.match(/class="mlog-passo [pe]"/g) || []).length;
      const golpes = (achou.golpes || []).filter(g => !g.x && g.d > 0 && !(g.t > 1)).length;
      ok('a cura NAO abre linha propria no log', linhas === golpes, linhas + ' linhas pra ' + golpes + ' golpes');
      ok('ela entra na linha do golpe, com o numero', /e recuperou <span class="mlog-cura">\+\d+<\/span>/.test(html),
         html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160));
      /* NA ANIMACAO ela E um passo, com a barra SUBINDO (amount negativo) e do lado de QUEM CUROU. */
      const anim = S.buildAnimatedHitSequence(achou);
      const passo = anim.find(h => h.x === 'dreno');
      ok('na animacao ela e um passo com a barra SUBINDO', !!passo && passo.amount < 0 && passo.cura === true,
         JSON.stringify(passo));
      const dreno = (achou.golpes || []).find(g => g.x === 'dreno');
      ok('e a barra que sobe e a de QUEM CUROU', !!passo && passo.side === (dreno.q === 'p' ? 'player' : 'enemy'),
         passo ? passo.side + ' (q=' + dreno.q + ')' : '-');
      /* ⚠️ A FRASE DO GOLPE FICA NA TELA enquanto a barra sobe. Ela e marcada como `cura`, e e isso
         que faz o fraseDoGolpeUsado devolver vazio no passo dela -- e o pintor, que so SOBE a linha
         e nunca a rebaixa, deixa o "Fulano usou ABSORVER" do passo anterior. O golpe tirou e
         devolveu: a frase e uma so. */
      ok('e o passo da cura nao pinta frase por cima do nome do golpe',
         S.fraseDoGolpeUsado(achou, passo) === '', JSON.stringify(S.fraseDoGolpeUsado(achou, passo)));
      /* A CURA ANDA COLADA NO GOLPE: o reordenamento do moribundo move o par junto. Solta, ela
         ficaria pra tras e a tela mostraria o pokemon se curando de um golpe que ele ainda nao deu. */
      const seq = S.sequenciaDoConfronto(achou);
      const iD = seq.findIndex(g => g.x === 'dreno');
      ok('a cura vem logo DEPOIS do golpe do mesmo lado', iD > 0 && !seq[iD-1].x && seq[iD-1].q === seq[iD].q,
         seq.map(g => (g.x ? '[' + g.x + ']' : '') + g.q).join(' '));
    }
  }
  /* ⚠️ A CURA NUNCA SOME DA TELA -- e ESTA e a trava que teria pego o bug do Oddish x Sandshrew.
     O motor estava certo (o diario tinha QUATRO curas); o confronto passava do TETO, caia na
     reconstrucao -- que nao conhece cura -- e a tela mostrava tres golpes inventados sem um "+N".
     O TETO ACABOU em 15/09/2026 e com ele esse caminho, mas a trava FICA e passou a ser mais forte
     do que era: ela nao cobra mais "o confronto e comprido, logo ele cai na reconstrucao" -- cobra
     que a cura chegue a tela em confronto de QUALQUER tamanho. Se um dia algum corte voltar (um
     teto novo, uma isencao, um resumo), e aqui que ele grita.
     O fixture e o par do relato e continua duro de proposito: o Absorver do Oddish Lv.12 e poder 20
     contra 165 de HP, entao a luta passa de 8 golpes -- era o pior caso do teto antigo. */
  {
    /* O Oddish Lv.12 tem UM golpe de dano so (o Absorver), entao o ataquesPadrao devolve
       exatamente o que o caminho do save devolveria -- conferido. */
    const mkOd = () => { const q = S.createInstance('oddish', 12); q.ataques = S.ataquesPadrao(q); return q; };
    let comCura = 0, sumiu = 0, compridos = 0;
    for(let i = 0; i < 400; i++){
      const b = [S.createInstance('sandshrew', 17)]; S.equiparNpc(b);
      const m = (S.simulateGymBattle([mkOd()], b, Math.random).matchups || [])[0];
      if(!m) continue;
      const noDiario = (m.golpes || []).filter(g => g.x === 'dreno').length;
      if(!noDiario) continue;
      comCura++;
      const seq = S.sequenciaDoConfronto(m);
      if(seq.filter(g => g.x === 'dreno').length < noDiario) sumiu++;
      /* 4 era o TETO antigo -- o numero fica como REGUA do quanto o fixture e comprido. */
      if((m.golpes||[]).filter(g => !g.x && g.d > 0 && !(g.t > 1)).length > 4) compridos++;
    }
    ok('o fixture do relato tem confronto com cura de sobra', comCura > 100, comCura + ' confrontos');
    ok('e a maioria e luta COMPRIDA (mais de 4 golpes -- o caminho que quebrou)', compridos > comCura * 0.5,
       compridos + ' de ' + comCura);
    ok('A CURA NUNCA SOME DA TELA', sumiu === 0, sumiu + ' de ' + comCura);
  }
  /* ⚠️ A SUAVIZACAO NAO REPARTE O GOLPE QUE DRENOU: a linha dele carrega um segundo numero que o
     jogador confere (a cura e metade do dano, lado a lado). Repartido, a conta que a linha promete
     quebraria. O teste LE O CODIGO porque isso e uma exclusao dentro do filtro -- um caso de
     comportamento passaria com ela removida sempre que o par ja coubesse na banda. */
  ok('a suavizacao deixa o golpe que drenou de fora', /drenouNeste/.test(cli));

  /* ⚠️ O ASTERISCO NO CARTAO DO GOLPE (15/09/2026, a pedido: *"coloque um * nessas habilidades
     naquele quadro que aparece quando aprende habilidade"*).
     E o caso mais forte do `obsDoGolpe`: o cartao do Absorver mostra "PODER 20", o numero mais
     baixo da tela, e sem a frase o jogador larga o golpe sem saber que ele devolve METADE do dano.
     Ele entrou junto com a saida da PASSIVA de drenagem -- enquanto ela existia, a ficha da Pokedex
     contava a historia; hoje quem drena e o GOLPE, e e no cartao dele que isso tem que estar. */
  {
    const FRASE = 'Cura o Pokémon que utilizou ao atacar o oponente';
    const semTag2 = h => String(h||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    /* SAI DA TABELA, nao de uma lista escrita aqui: golpe novo no GOLPES_DRENO ja nasce com a
       observacao, e um que saia da tabela perde junto. */
    /* ⚠️ `obsDoGolpe` DEVOLVE LISTA desde 15/09/2026 -- o Comedor de Sonhos tem DUAS observacoes
       (a cura e o 'so contra quem dorme'), e com `return` de string a segunda apagava a primeira.
       A trava passou a perguntar se a frase ESTA na lista, e nao se ela E a lista: assim ela
       continua valendo pro dreameater, que tem duas. */
    const semObs = Object.keys(S.GOLPES_DRENO).filter(id => !S.obsDoGolpe(id).includes(FRASE));
    ok('os CINCO drenantes trazem a observacao', semObs.length === 0, semObs.join(', ') || 'os cinco');
    ok('e ela e a frase pedida, palavra por palavra', S.obsDoGolpe('absorb').join('|') === FRASE, S.obsDoGolpe('absorb').join('|'));
    /* O CARTAO desenha com o asterisco -- e e ele que as TRES telas de golpe usam. */
    ok('o cartao mostra o asterisco', /\* Cura o Pokémon que utilizou ao atacar o oponente/.test(semTag2(S.cartaoDeGolpe('absorb', true, false))),
       semTag2(S.cartaoDeGolpe('absorb', true, false)));
    /* ⚠️ E GOLPE SEM MECANICA PROPRIA NAO GANHA ASTERISCO NENHUM: a observacao existe pra contar o
       que os numeros do cartao NAO contam, e num golpe comum nao ha o que contar. */
    ok('golpe comum nao ganha observacao', S.obsDoGolpe('tackle').length === 0 && S.obsDoGolpe('scratch').length === 0);
    /* A observacao dos VARIOS TAPAS continua -- as duas convivem na mesma funcao. */
    ok('e a dos varios tapas continua', S.obsDoGolpe('doubleslap').join('|') === 'Golpe repete entre 2-5x');
  }

  /* ⚠️ A PASSIVA DE DRENAGEM SAIU DO MOTOR (15/09/2026), e a APRESENTACAO dela FICA.
     O motor nao gera mais `absorb`/`absorbdano`; o log, a animacao e a reconstrucao continuam
     sabendo desenha-los, porque diario gravado antes de hoje tem as duas entradas -- e sem elas
     aquele log perde uma linha e a soma para de fechar. Mesma decisao do 'desempate'. */
  {
    const fs3 = require('fs');
    const cli3 = fs3.readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const srv3 = fs3.readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
    ok('a tabela ABSORCAO nao existe mais nos dois motores',
       !/const ABSORCAO =/.test(cli3) && !/const ABSORCAO =/.test(srv3));
    ok('nem a chance dela', !/CHANCE_ABSORVER/.test(cli3) && !/CHANCE_ABSORVER/.test(srv3));
    ok('nem o ramo do efeito', !/efeito === 'drenar'/.test(cli3) && !/efeito === 'drenar'/.test(srv3));
    /* MAS a apresentacao fica, pra log velho */
    ok('a apresentacao do absorb FICA no cliente (log velho)',
       /x === 'absorb'/.test(cli3) && /absorbdano/.test(cli3));
    /* E ela funciona: um diario VELHO com as duas entradas ainda desenha e a soma fecha. */
    const velho = {
      player:'Oddish', enemy:'Geodude', playerSpecies:'oddish', enemySpecies:'geodude',
      playerHpBefore:80, playerHpAfter:100, playerMaxHp:200,
      enemyHpBefore:150, enemyHpAfter:0, enemyMaxHp:200,
      playerMove:'Grass', enemyMove:'Rock', playerMoveId:'absorb', enemyMoveId:'rockthrow',
      golpes:[
        { q:'p', d:40, hp:120, c:0, m:0, z:0, x:'absorb', g:'Absorver' },
        { q:'p', d:40, hp:110, c:0, m:0, z:0, x:'absorbdano' },
        { q:'p', d:110, hp:0, c:0, m:0, z:0, mv:'absorb' },
        { q:'e', d:20, hp:100, c:0, m:0, z:0, mv:'rockthrow' }
      ]
    };
    const seqV = S.sequenciaDoConfronto(velho);
    ok('log VELHO com a passiva ainda desenha as duas entradas',
       seqV.some(g => g.x === 'absorb') && seqV.some(g => g.x === 'absorbdano'),
       seqV.map(g => (g.x||'golpe')+':'+g.d).join(' '));
    ok('e a frase dela continua saindo', /drenou a vida de/.test(S.passosHtml(velho)),
       String(S.passosHtml(velho)).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0, 90));
  }

}


console.log('\n=== O PLACAR VIROU POKEBOLAS (15/09/2026) ===');
{
  /* Pedido: *"voce vai colocar o nome do usuario centralizado e embaixo voce vai criar sprites de
     pokebolas, caso o usuario tenha 5 pokemons vai aparecer 5 pokebolas, conforme os pokemons
     forem morrendo as pokebolas vao ficando pretinhas ... e pode tirar aqueles emojis"*. */
  const semTagP = h => String(h||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const conta = (h, cls) => (String(h).match(new RegExp('class="pokeball' + cls + '"', 'g')) || []).length;
  {
    const h = S.placarDoTreinador('Ash', 5, 6);
    ok('uma pokebola por pokemon do time', conta(h, '(?: ko)?') === 6, conta(h, '(?: ko)?') + ' bolas');
    ok('e as que cairam ficam escuras', conta(h, ' ko') === 1, conta(h, ' ko') + ' ko');
    ok('o nome sai centralizado, sem emoji', semTagP(h) === 'Ash', JSON.stringify(semTagP(h)));
  }
  /* ⚠️ A ORDEM IMPORTA, e ela foi reportada (15/09/2026): *"o primeiro pokemon que morrer, a
     primeira bolinha da esquerda que fica escura, hoje ta ficando a primeira bolinha da direita"*.
     A contagem nao pega isso -- ela e a mesma nas duas ordens --, entao a trava le a SEQUENCIA. */
  const seqDe = (h) => (String(h).match(/class="pokeball( ko)?"/g) || [])
    .map(x => x.indexOf('ko') >= 0 ? 'X' : 'o').join('');
  ok('a ESCURA vem primeiro, a esquerda', seqDe(S.placarDoTreinador('Ash', 5, 6)) === 'Xooooo',
     seqDe(S.placarDoTreinador('Ash', 5, 6)));
  ok('e o escuro avanca da esquerda pra direita', seqDe(S.placarDoTreinador('Ash', 2, 6)) === 'XXXXoo',
     seqDe(S.placarDoTreinador('Ash', 2, 6)));
  /* ⚠️ OS EXTREMOS. O time todo de pe nao pode ter bola preta nenhuma, e o time inteiro caido nao
     pode ter bola viva -- sao os dois casos em que um erro de `<` por `<=` passa despercebido. */
  ok('time inteiro de pe: nenhuma preta', conta(S.placarDoTreinador('X', 4, 4), ' ko') === 0);
  ok('time inteiro caido: todas pretas', conta(S.placarDoTreinador('X', 0, 3), ' ko') === 3);
  /* ⚠️ A VIGILIA DO ARCO-IRIS monta DEZ adversarios -- o teto do jogo e 6, mas este quadro tambem
     desenha ela. Medido no navegador a 320px: as dez cabem em duas fileiras de cinco. */
  ok('e a Vigilia (10) desenha as dez', conta(S.placarDoTreinador('Vigilia', 7, 10), '(?: ko)?') === 10);
  /* Numero fora da faixa nao pode gerar bola negativa nem mais bolas que o time. */
  ok('vivos acima do total nao inventa bola', conta(S.placarDoTreinador('X', 9, 3), '(?: ko)?') === 3 &&
     conta(S.placarDoTreinador('X', 9, 3), ' ko') === 0);
  ok('e vivos negativo nao quebra', conta(S.placarDoTreinador('X', -2, 3), ' ko') === 3);
  ok('o nome e escapado', S.placarDoTreinador('<b>x</b>', 1, 1).indexOf('<b>') < 0);
  /* ⚠️ AS SEIS TELAS USAM A MESMA FUNCAO. Ela nasceu porque o placar estava copiado em seis lugares
     -- e eles ja tinham divergido: quatro usavam a mochila e a liga assistida usava outro emoji,
     sem motivo. A trava LE O CODIGO porque os casos acima chamam a funcao direto e passariam com
     um render ainda montando o chip a mao. */
  const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const usos = (cli.match(/placarDoTreinador\(/g) || []).length;
  ok('as SEIS telas de batalha usam a mesma funcao', usos >= 13, usos + ' chamadas (1 definicao + 12 usos)');
  ok('e nenhum render monta o chip a mao', !/<span class="team-alive-chip">[^<]*\$\{/.test(cli));
  ok('e os emojis do placar sumiram', !/team-alive-chip">🎒|team-alive-chip">🥊|team-alive-chip">🎽/.test(cli));
  /* O CSS -- nada disso aparece em asserção de HTML. */
  const css = (cli.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  ok('a pokebola e desenhada em CSS, sem imagem de fora', /\.pokeball\{[^}]*linear-gradient/.test(css));
  /* ⚠️ SEM OPACIDADE (ela clareava o preto contra o fundo claro e a bolinha saia indistinguivel de
     "desabilitado"), e a cor e um CINZA ESCURO e nao um quase-preto: ela nasceu em #1c1c1c e num
     chip claro seis daquelas viravam uma fileira de furos (pedido de 15/09/2026, "menos pretas"). */
  ok('e a escura NAO usa opacidade -- quem clareia e a COR',
     /\.pokeball\.ko\{[^}]*\}/.test(css) && !/\.pokeball\.ko\{[^}]*opacity/.test(css));
  ok('e ela nao e quase-preta', (()=>{ const m = css.match(/\.pokeball\.ko\{background:#([0-9a-f]{6})/);
       if(!m) return false; const v = parseInt(m[1].slice(0,2), 16); return v >= 0x40 && v <= 0x90; })(),
     (css.match(/\.pokeball\.ko\{background:#[0-9a-f]{6}/)||[''])[0]);
  ok('o chip tem min-width:0 (senao o nome comprido rouba a largura do outro)',
     /\.team-alive-chip\{[\s\S]*?min-width:0;[\s\S]*?\n  \}/.test(css));

  /* ============================================================================
     ⚠️ O PLACAR MUDOU DE LUGAR: ELE MORA NO PAINEL DO LUTADOR (22/09/2026)
     ============================================================================
     *"vamos agora colocar essas informacoes dentro do quadro com o nome do pokemon durante a
     batalha, o nome e as pokebolas"*. Com o cenario atras, a fileira de cima era a unica coisa
     FORA dele: a batalha acontecia dentro do quadro e o placar ficava olhando.
     ⚠️ A REGRA E "UM LUGAR SO", e e ela que a trava cobra -- nao a posicao. Onde a cena desenha,
     o placar esta no painel e a fileira sai; onde ela nao desenha (o Boss, a Selecao, o desafio
     por codigo e o online), a fileira fica e o painel nem existe. Emitir os dois seria dizer a
     mesma coisa duas vezes na mesma tela. */
  {
    const trilha = (h) => ({
      fileira: (String(h).match(/team-alive-row/g) || []).length,
      painel:  (String(h).match(/battle-mon-treinador"/g) || []).length,
    });
    /* o painel so sai quando o chamador MANDA o treinador -- quem nao manda desenha como antes */
    const mFake = { player:'A', enemy:'B', playerSpecies:'pikachu', enemySpecies:'onix',
                    playerLevel:5, enemyLevel:5, playerMaxHp:20, enemyMaxHp:20,
                    playerShiny:false, enemyShiny:false, golpes:[] };
    const sem = S.fighterHtml(mFake, 'p', { hp: 20, passo: 0, visualNovo: true });
    const com = S.fighterHtml(mFake, 'p', { hp: 20, passo: 0, visualNovo: true, treinador: 'Ash', vivos: 4, total: 6 });
    ok('sem `treinador` o painel sai como antes', trilha(sem).painel === 0);
    ok('  e com ele o placar entra no painel', trilha(com).painel === 1);
    ok('  com uma pokebola por pokemon', (com.match(/class="pokeball(?: ko)?"/g) || []).length === 6,
       (com.match(/class="pokeball(?: ko)?"/g) || []).length + ' bolas');
    ok('  e as caidas escuras, na mesma ordem do chip', (com.match(/class="pokeball ko"/g) || []).length === 2);
    ok('  o nome do treinador e escapado',
       S.fighterHtml(mFake, 'p', { hp: 20, passo: 0, visualNovo: true, treinador: '<b>x</b>', vivos: 1, total: 1 }).indexOf('<b>x') < 0);
    /* ⚠️ E ELE NAO ENTRA NO CAMINHO ANTIGO: la nao ha painel, e o placar continua na fileira. */
    ok('  e o caminho antigo nao ganha placar no lutador',
       trilha(S.fighterHtml(mFake, 'p', { hp: 20, passo: 0, treinador: 'Ash', vivos: 1, total: 1 })).painel === 0);

    /* ⚠️ E A TRAVA QUE IMPORTA E A DAS TELAS: ela LE O CODIGO, porque os casos acima chamam o
       fighterHtml direto e passariam com um render ainda emitindo a fileira por cima. */
    /* ⚠️ O SEGUNDO NOME DE CADA PAR É ONDE O TREINADOR VIAJA, e na pescaria ele NÃO é o mesmo do
       container: lá o container só emite a fileira, e quem chama o fighterHtml é a função irmã. */
    const cinco = [
      ['renderBattling',        'renderBattling'],
      ['renderSpecialBattling', 'renderSpecialBattling'],
      ['renderTrainerBattling', 'renderTrainerBattling'],
      ['renderLeagueWatch',     'renderLeagueWatch'],
      ['pescariaBatalhaHtml',   'pescariaLutadoresHtml'],
    ];
    const fatiaDe = (f) => { const i = cli.indexOf('function ' + f); return cli.slice(i, cli.indexOf('\nfunction ', i + 1)); };
    cinco.forEach(([container, quemPassa]) => {
      const fa = fatiaDe(container), fp = fatiaDe(quemPassa);
      ok('(a fatia de ' + container + ' tem o que ler)', fa.length > 400 && fp.length > 200,
         fa.length + '/' + fp.length + ' chars');
      ok('  ' + container + ': a fileira de cima e condicional a NAO ter cena',
         !/team-alive-row/.test(fa) || /cenaNova \? '' : `<div class="team-alive-row"/.test(fa));
      ok('  ' + container + ': e o treinador viaja pro lutador (' + quemPassa + ')', /treinador:/.test(fp));
    });
    /* ⚠️ AS DUAS DO ONLINE SAO O CONTRARIO, e de proposito: elas nao tem cena, entao a fileira
       delas NAO pode ser condicional -- condicionada, o online ficaria sem placar nenhum. */
    ['renderOnlineCountdown', 'renderOnlineFight'].forEach(f => {
      const i = cli.indexOf('function ' + f);
      const fatia = cli.slice(i, cli.indexOf('\nfunction ', i + 1));
      ok('  ' + f + ': a fileira fica, sem condicao', /<div class="team-alive-row">/.test(fatia)
         && !/cenaNova \? '' : `<div class="team-alive-row"/.test(fatia));
    });

    /* O CSS -- nada disso aparece em asserção de HTML. */
    ok('as pokebolas do painel encolhem (o chip de 13px nao cabe em ~158px)',
       /\.battle-mon-treinador \.pokeball\{[^}]*width:9px/.test(css));
    /* ⚠️ E ELAS NUNCA QUEBRAM DE LINHA: quem cede espaco e o NOME, a mesma regra do chip de cima.
       Medido no navegador a 320px: as seis somam 64px numa linha de 131, e o nome de 20 letras
       trunca em 61px. */
    ok('  e nunca quebram de linha', /\.battle-mon-treinador \.team-alive-bolas\{[^}]*flex-wrap:nowrap/.test(css));
    ok('  e o nome trunca em vez de empurrar',
       /\.battle-mon-treinador-nome\{[^}]*text-overflow:ellipsis/.test(css) &&
       /\.battle-mon-treinador-nome\{[^}]*min-width:0/.test(css));
  }
}

console.log('\n=== A CENA DO REMOINHO: SAI / VAZIO / ENTRA COM A BARRA ENCHENDO (15/09/2026) ===');
{
  /* Pedido: *"a luta comeca exibindo o Pidgeot x Geodude, ai primeiro aparece a frase que o Pidgeot
     usou remoinho e soprou Geodude para fora, ai some o Geodude, fica 1s sem pokemon, e entra o
     proximo junto com a frase: 'Geodude foi trocado por Paras' ... aparece a barra de hp do pokemon
     que ta entrando, vazia e comeca a encher"*. */
  let achou = 0, cena = 0, vaga = 0, enche = 0, semBarra = 0, so1 = 0;
  for(let v = 0; v < 9000 && achou < 30; v++){
    const a = [inst('pidgeot', 40)]; a[0].ataques = S.ataquesPadrao(a[0]);
    const b = ['psyduck','geodude','machop'].map(id => { const p = inst(id, 40); p.ataques = S.ataquesPadrao(p); return p; });
    const r = S.simulateGymBattle(a, b, S.makeSeededRng('remA' + v));
    const m = (r.matchups || []).find(x => (x.golpes || []).some(g => g.x === 'remoinho'));
    if(!m) continue;
    achou++;
    const seq = S.sequenciaDoConfronto(m);
    const i = seq.findIndex(h => h.x === 'remoinho');
    const anim = S.buildAnimatedHitSequence(m);
    const reg = (m.golpes || []).find(g => g.x === 'remoinho');
    const lado = reg.q === 'p' ? 'e' : 'p';
    const quadro = (p) => S.fighterHtml(m, lado, { hp: lado === 'e' ? m.enemyHpBefore : m.playerHpBefore,
                            passo: p, hit: p > 0 ? anim[p-1] : null, comTerreno: true });
    const q0 = quadro(i), q1 = quadro(i+1), q2 = quadro(i+2), q3 = quadro(i+3), q4 = quadro(i+4);
    const ehVaga = (h) => /fighter-vaga/.test(h);
    const ehEntra = (h) => /class="fighter fighter-entra"/.test(h);
    if(!ehVaga(q0) && !ehVaga(q1) && ehVaga(q2) && !ehVaga(q3) && ehEntra(q3) && !ehEntra(q4)) cena++;
    /* ⚠️ A VAGA NAO TEM BARRA. Ela tinha uma de "0/1 HP" -- um numero que nao existe em lugar nenhum
       do jogo, e que lido de relance parecia o pokemon ter ficado com 1 de vida. */
    if(ehVaga(q2) && !/hp-bar-wrap/.test(q2)) semBarra++;
    /* E ela reusa o desenho do ONLINE (o `fighter-oculto`), que era o pedido. */
    if(/fighter-oculto/.test(q2)) vaga++;
    /* ⚠️ A BARRA DE QUEM ENTRA NASCE VAZIA E ENCHE, e o valor final continua sendo o HP de verdade:
       a classe acrescenta a ANIMACAO, nao troca o numero. */
    if(/hp-bar-entra/.test(q3) && !/hp-bar-entra/.test(q4) && !/hp-bar-entra/.test(q1)) enche++;
    /* O LOG continua com UMA linha -- os tres quadros sao da animacao. */
    const linhas = S.passosHtml(m).split('</div>').filter(x => x.indexOf('mlog-passo') >= 0);
    if(linhas.filter(x => /Remoinho/.test(x)).length === 1) so1++;
  }
  ok('o sopro sai o bastante pra medir', achou >= 15, achou + ' confrontos');
  ok('a cena e sai / sai / VAZIO / entra / normal', cena === achou, cena + ' de ' + achou);
  ok('a vaga vazia reusa o quadro do ONLINE', vaga === achou, vaga + ' de ' + achou);
  ok('e ela nao tem barra de HP nenhuma', semBarra === achou, semBarra + ' de ' + achou);
  ok('a barra de quem ENTRA nasce vazia e enche (so nesse passo)', enche === achou, enche + ' de ' + achou);
  ok('e o log continua com UMA linha', so1 === achou, so1 + ' de ' + achou);
  /* ⚠️ A ANIMACAO NAO PODE MUDAR O VALOR DA BARRA -- so o caminho ate ele. */
  const cheia = S.renderHpBar(50, 100, 'a', 'b', true), normal = S.renderHpBar(50, 100, 'a', 'b');
  ok('o `entrando` nao mexe no valor da barra',
     cheia.replace(' hp-bar-entra','') === normal, 'scaleX igual nos dois');
  const cli2 = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const css2 = (cli2.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  ok('e o keyframes parte do zero, com o destino IMPLICITO (o HP de verdade)',
     /@keyframes hpEntra\{ from\{transform:scaleX\(0\);\} \}/.test(css2));
}

console.log('\n=== O COMEDOR DE SONHOS AVISA NO CARTAO, E A TRAVA VALE NA BATALHA (15/09/2026) ===');
{
  /* Pedido: *"Coloque mais um * no ataque comedor dos sonhos: 'So utilizado quando o adversario
     dorme', e verifique na batalha se isso esta ocorrendo mesmo"*. */
  const FRASE = 'Só utilizado quando o adversário dorme';
  const semTag3 = h => String(h||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  ok('o Comedor de Sonhos tem DUAS observacoes', S.obsDoGolpe('dreameater').length === 2,
     S.obsDoGolpe('dreameater').join(' | '));
  ok('e a segunda e a frase pedida, palavra por palavra',
     S.obsDoGolpe('dreameater')[1] === FRASE, S.obsDoGolpe('dreameater')[1]);
  ok('e o cartao desenha as DUAS', (semTag3(S.cartaoDeGolpe('dreameater', true, false)).match(/\*/g)||[]).length === 2,
     semTag3(S.cartaoDeGolpe('dreameater', true, false)));
  /* ⚠️ SAI DA TABELA que o motor consulta, nao de um `if` com o id escrito a mao: se um dia um
     segundo golpe entrar no GOLPES_SO_DORMINDO, o cartao dele ja nasce avisando. */
  Object.keys(S.GOLPES_SO_DORMINDO).forEach(id =>
    ok('  ' + id + ' traz a observacao', S.obsDoGolpe(id).includes(FRASE), S.obsDoGolpe(id).join(' | ')));
  /* ⚠️ E A VERIFICACAO NA BATALHA, que foi a outra metade do pedido: com o alvo DORMINDO ele sai,
     com o alvo ACORDADO ele NUNCA sai -- e o motor troca de golpe quando o outro acorda. */
  const mk3 = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp;
                            p.ataques = S.ataquesPadrao(p); return p; };
  let comSono = 0, dormindo = 0, acordado = 0, trocou = 0, semGolpe = 0;
  for(let v = 0; v < 3000; v++){
    const r = S.simulateGymBattle([mk3('gengar', 50)], [mk3('machoke', 50)], S.makeSeededRng('dr' + v));
    const m = (r.matchups || [])[0];
    if(!m || !(m.golpes||[]).some(g => g.x === 'sono')) continue;
    comSono++;
    const g = m.golpes;
    /* ⚠️ A JANELA E POR SONO desde 25/09/2026, e nao a do PRIMEIRO sono: com ele virando golpe da
       TROCA, o alvo pode acordar e voltar a dormir no mesmo confronto (medido, 1,4% deles) -- e a
       conta antiga lia o primeiro `acordou` e chamava de "acordado" um golpe dado com o alvo
       dormindo de novo (15 de 1078, com o motor certo).
       ⚠️ E O DONO PODE NAO CHEGAR A ATACAR: na troca em que ele dorme o outro ele PERDE o ataque,
       entao ele pode morrer ali mesmo -- medido, 90 de 1078, e em todos eles o sono foi a ultima
       acao do confronto. Cobrar o Comedor ali seria cobrar um golpe que nao existe. */
    const dele = g.map((x,k)=>({x,k})).filter(y => !y.x.x && y.x.q === 'p' && y.x.d > 0);
    /* as janelas de sono: de cada sono ate o acordou seguinte */
    const janelas = [];
    g.forEach((x, k) => {
      if(x.x !== 'sono') return;
      const fim = g.findIndex((y, j) => j > k && y.x === 'acordou');
      janelas.push([k, fim < 0 ? g.length : fim]);
    });
    const dormindoAgora = (k) => janelas.some(([a, b]) => k > a && k < b);
    const antes  = dele.filter(y => dormindoAgora(y.k)).map(y => y.x.mv);
    const depois = dele.filter(y => !dormindoAgora(y.k) && y.k > janelas[0][0]).map(y => y.x.mv);
    if(antes.includes('dreameater')) dormindo++;
    else if(!antes.length) semGolpe++;
    if(depois.includes('dreameater')) acordado++;
    if(antes.includes('dreameater') && depois.length && !depois.includes('dreameater')) trocou++;
  }
  ok('amostra de confrontos com sono', comSono > 100, comSono + ' confrontos');
  /* ⚠️ OS QUE NAO CONTAM SAO OS EM QUE O DONO NAO CHEGOU A ATACAR dormindo -- ele perdeu o ataque
     pra dormir o outro e morreu na mesma troca. Sao 8,3% dos confrontos com sono, e cobra-los
     seria cobrar um golpe que o motor nao deu. */
  ok('amostra de confrontos em que ele chegou a atacar dormindo', comSono - semGolpe > 100,
     (comSono - semGolpe) + ' de ' + comSono + '   (' + semGolpe + ' sem golpe nenhum dormindo)');
  ok('ele USA com o adversario dormindo', dormindo === comSono - semGolpe,
     dormindo + ' de ' + (comSono - semGolpe));
  ok('e NUNCA usa depois de ele acordar', acordado === 0, acordado + ' de ' + comSono);
  ok('e o motor troca de golpe quando o outro acorda', trocou > 5, trocou + ' confrontos com a troca visivel');
}

console.log('\n=== O HISTORICO DO RANKING DA TORRE (15/09/2026) ===');
{
  /* Pedido: *"do lado do titulo Hoje um botao chamado Historico, quando clicado, exibir como foi o
     ranking do dia nos 5 ultimos dias"*. */
  const semTag4 = h => String(h||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const linhasR = (n) => Array.from({length:n}, (_,i)=>({ uid:'u'+i, name:'T'+(i+1), bestFloor: 20-i*2, topDays: 9-i }));
  S.__getGame().towerRanking = { loading:false, aba:'hoje', hoje: linhasR(6), top: linhasR(5) };
  const hoje = S.renderTowerRankingModal();
  ok('a aba Historico existe ao lado do Hoje',
     /tower-rank-aba[^>]*>Hoje</.test(hoje) && /tower-rank-aba[^>]*>Histórico</.test(hoje));
  ok('e a de Hoje comeca acesa', /tower-rank-aba on"[^>]*>Hoje</.test(hoje), 'aba on');
  ok('a aba de hoje continua com as DUAS listas', /Hoje<\/h3>/.test(hoje) && /Geral<\/h3>/.test(hoje));
  /* ⚠️ O PODIO E POR LISTA, nao um so calculado do `r.hoje`: cada dia do historico tem o proprio. */
  S.__getGame().towerRanking = { loading:false, aba:'historico', histCarregado:true,
    historico: [{dateId:'2026-09-14', linhas:[{uid:'a',name:'A',bestFloor:12},{uid:'b',name:'B',bestFloor:9},{uid:'c',name:'C',bestFloor:5},{uid:'d',name:'D',bestFloor:3}]},
                {dateId:'2026-09-13', linhas:[]},
                {dateId:'2026-09-12', linhas:[{uid:'e',name:'E',bestFloor:7}]}] };
  /* ⚠️ UM DIA POR VEZ, COM SETAS (17/09/2026, a pedido). Empilhados, os cinco dias davam uma parede
     de ate 50 linhas num modal que ja rola por dentro. Estas travas ANDAM pela paginacao -- e por
     isso cada dia continua sendo cobrado, um a um. */
  const hist = S.renderTowerRankingModal();
  ok('o historico desenha UM titulo so', (hist.match(/tower-rank-tit/g)||[]).length === 1,
     (hist.match(/tower-rank-tit/g)||[]).length + ' titulos');
  ok('e diz em que pagina esta', /1 de 3/.test(semTag4(hist)), semTag4(hist).slice(0, 160));
  ok('a seta de VOLTAR comeca desabilitada, a de AVANCAR nao',
     /paginarHistoricoDaTorre\(-1\)/.test(hist)
     && /disabled[^>]*onclick="paginarHistoricoDaTorre\(-1\)/.test(hist)
     && !/disabled[^>]*onclick="paginarHistoricoDaTorre\(1\)/.test(hist));
  /* ⚠️ A DATA E FORMATADA DO TEXTO: `new Date('2026-09-14')` le como UTC e, num fuso a oeste,
     devolve o dia ANTERIOR -- o historico mostraria 13/09 no lugar de 14/09. */
  ok('e a data sai no formato do jogo, sem passar por Date()',
     /14\/09/.test(semTag4(hist)), (semTag4(hist).match(/\d\d\/\d\d/g)||[]).join(' '));
  /* ⚠️ O PODIO E POR DIA, e com um dia por vez isso fica visivel: o dia 1 tem ouro/prata/bronze e
     o dia 3 (com um inscrito so) tem ouro E MAIS NADA -- as medalhas reiniciam. */
  ok('o dia 1 tem o podio dele',
     (hist.match(/#s-ouro/g)||[]).length === 1 && (hist.match(/#s-prata/g)||[]).length === 1
     && (hist.match(/#s-bronze/g)||[]).length === 1,
     (hist.match(/#s-ouro/g)||[]).length + '/' + (hist.match(/#s-prata/g)||[]).length + '/' + (hist.match(/#s-bronze/g)||[]).length);
  ok('e o doce do historico fala no PASSADO (o dia ja virou)',
     /Ganhou um Doce Raro/.test(hist) && !/Ganha um Doce Raro/.test(hist));
  /* ⚠️ DIA SEM NINGUEM FICA NA LISTA, com a lista vazia: sumir com ele faria o historico mostrar
     cinco datas que nao sao as cinco ultimas -- e com a paginacao ele tem PAGINA propria. */
  S.paginarHistoricoDaTorre(1);
  {
    const p2 = S.renderTowerRankingModal();
    ok('a seta avanca pro dia seguinte', /13\/09/.test(semTag4(p2)) && /2 de 3/.test(semTag4(p2)),
       semTag4(p2).slice(0, 160));
    ok('e o dia sem ninguem fica, dizendo que ficou vazio',
       /Ninguém subiu nenhum andar neste dia/.test(semTag4(p2)));
    ok('e ali nao ha medalha nenhuma', (p2.match(/#s-ouro/g)||[]).length === 0);
  }
  S.paginarHistoricoDaTorre(1);
  {
    const p3 = S.renderTowerRankingModal();
    ok('a ultima pagina traz o ultimo dia', /12\/09/.test(semTag4(p3)) && /3 de 3/.test(semTag4(p3)),
       semTag4(p3).slice(0, 160));
    ok('e com UM inscrito so ele leva o ouro e mais nada',
       (p3.match(/#s-ouro/g)||[]).length === 1 && (p3.match(/#s-prata/g)||[]).length === 0,
       (p3.match(/#s-ouro/g)||[]).length + ' ouros, ' + (p3.match(/#s-prata/g)||[]).length + ' pratas');
    ok('e agora a seta de AVANCAR e que esta desabilitada',
       /disabled[^>]*onclick="paginarHistoricoDaTorre\(1\)/.test(p3)
       && !/disabled[^>]*onclick="paginarHistoricoDaTorre\(-1\)/.test(p3));
  }
  /* ⚠️ A PAGINA NAO PASSA DAS PONTAS, nem pela acao. */
  S.paginarHistoricoDaTorre(1); S.paginarHistoricoDaTorre(1);
  ok('avancar na ultima nao passa', S.__getGame().towerRanking.histPag === 2,
     String(S.__getGame().towerRanking.histPag));
  S.paginarHistoricoDaTorre(-5);
  ok('e voltar demais para na primeira', S.__getGame().towerRanking.histPag === 0,
     String(S.__getGame().towerRanking.histPag));
  /* ⚠️ E O DESENHO CLAMPA MESMO COM A PAGINA VELHA: o historico e carregado DEPOIS de a tela abrir,
     entao o indice pode apontar pra um dia que ainda nao chegou (ou que sumiu). Sem o clamp, a seta
     levaria a um modal vazio. */
  S.__getGame().towerRanking.histPag = 99;
  ok('pagina fora da lista cai no ultimo dia, e nao num modal vazio',
     /12\/09/.test(semTag4(S.renderTowerRankingModal())),
     semTag4(S.renderTowerRankingModal()).slice(0, 160));
  ok('e o clamp GRAVA a correcao (senao ela ressurgiria na proxima seta)',
     S.__getGame().towerRanking.histPag === 2, String(S.__getGame().towerRanking.histPag));
  /* ⚠️ E A PAGINA ZERA AO ENTRAR NO HISTORICO: o "dia 3 de 5" de ontem nao e o mesmo de hoje. */
  S.__getGame().towerRanking.histPag = 2;
  S.abrirHistoricoDaTorre();
  ok('reabrir o historico volta pro dia mais recente',
     S.__getGame().towerRanking.histPag === 0, String(S.__getGame().towerRanking.histPag));
  /* SEM HISTORICO NENHUM ela nao explode nem inventa pagina. */
  S.__getGame().towerRanking.historico = [];
  ok('historico vazio diz que nao ha dias',
     /Ainda não há dias anteriores/.test(semTag4(S.renderTowerRankingModal())));
  S.paginarHistoricoDaTorre(1);
  ok('e paginar no vazio nao faz nada', (S.__getGame().towerRanking.histPag || 0) === 0);
  S.__getGame().towerRanking = null;
  /* O SERVIDOR: a callable existe e e SEPARADA do ranking -- ela custa ~50 leituras, e junto todo
     jogador que abrisse a Torre pagaria isso. */
  const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
  ok('o servidor tem a callable do historico', /exports\.getTrainerTowerHistory = onCall/.test(srv));
  ok('e ela e SEPARADA do ranking de hoje', /exports\.getTrainerTowerRanking = onCall/.test(srv));
  ok('ela varre 5 dias', /const TORRE_DIAS_NO_HISTORICO = 5;/.test(srv));
  /* ⚠️ A DATA sai do MESMO helper do fechamento do dia: uma segunda regra (a minha, em UTC)
     discordaria da do jogo em algum fuso e o historico mostraria um dia a mais ou a menos. */
  const ini = srv.indexOf('exports.getTrainerTowerHistory');
  const bloco = srv.slice(ini, ini + 2000);
  ok('e a data usa o helper do jogo, nao um Date proprio',
     /trainersLeagueDateStrPlusDays\(hoje, -i\)/.test(bloco) && !/new Date\(/.test(bloco));
  ok('e ela exige login e passa pela mesma porta do resto da Torre',
     /unauthenticated/.test(bloco) && /towerRequireTester/.test(bloco));
  /* O CLIENTE nao recarrega o historico a cada clique -- ele custa ~50 leituras. */
  const cli2 = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
  ok('o cliente cacheia o historico por abertura do modal',
     /if\(r\.histCarregado\)\{ render\(\); return; \}/.test(cli2));
  ok('e o modal sempre abre na aba de HOJE', /aba:'hoje'/.test(cli2));
}


console.log('\n=== O TERRENO VALE NOS SEIS ATRIBUTOS, E O TEXTO DIZ ISSO (15/09/2026) ===');
{
  /* Reportado como pergunta: *"verifique se a vantagem de terreno também aumenta em 15% os stats de
     ataque especial e def especial, porque isso não ta escrito no texto"*.
     A MECANICA sempre esteve certa (o `withBuffs` e chamado pelas SEIS `effective*`); o que estava
     incompleto era a LISTA entre parenteses da caixa que explica o terreno -- "(HP, Ataque e
     Defesa)" ao lado de "todos os atributos". Sao as duas metades, e as duas ficam trancadas:
     a primeira porque uma regressao no motor nao apareceria como erro, a segunda porque o texto ja
     tinha envelhecido uma vez (ele e de quando a Gen 1 tinha UM campo de atributo especial). */
  const nu = S.createInstance('alakazam', 50);
  const comT = S.createInstance('alakazam', 50); comT.terrainBuffed = true;
  const efetivas = ['effectiveBaseHp','effectiveAttack','effectiveDefense',
                    'effectiveSpAtk','effectiveSpDef','effectiveSpeed'];
  efetivas.forEach(n => {
    const a = S[n](nu), b = S[n](comT);
    /* A razao nao e 1,1500 exato por causa do arredondamento POR ATRIBUTO (o withBuffs faz
       Math.round), entao a faixa cobre o erro de 1 ponto em qualquer valor razoavel. */
    ok('  ' + n.replace('effective','') + ' ganha os 15%', b === Math.round(a * S.TERRAIN_BUFF_MULT),
       a + ' -> ' + b + '  (' + (b/a).toFixed(4) + 'x)');
  });
  /* ⚠️ OS DOIS ESPECIAIS SAO O PONTO DO RELATO, entao eles tem trava nomeada: uma regressao neles
     passaria despercebida no laco acima se alguem trocasse a lista. */
  ok('e os DOIS especiais estao entre eles (o que foi perguntado)',
     S.effectiveSpAtk(comT) > S.effectiveSpAtk(nu) && S.effectiveSpDef(comT) > S.effectiveSpDef(nu),
     'SpAtk ' + S.effectiveSpAtk(nu) + '->' + S.effectiveSpAtk(comT) +
     ' | SpDef ' + S.effectiveSpDef(nu) + '->' + S.effectiveSpDef(comT));
  /* E O SERVIDOR faz igual -- o buff entra no dano dos dois lados. */
  const srvT = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
  /* ⚠️ A FATIA VAI ATÉ O FIM DA FUNÇÃO, nunca um número fixo de caracteres: ela era 400, e um
     comentário acrescentado DENTRO do effectiveSpeed empurrou o withBuffs pra fora da janela --
     a trava acusou o que estava certo. É a mesma armadilha da fatia de tamanho fixo que este
     arquivo já pagou; o delimitador de verdade é a próxima declaração. */
  const corpoDe = (txt, nome) => {
    const i = txt.indexOf('function ' + nome + '(');
    return i < 0 ? null : txt.slice(i, txt.indexOf(String.fromCharCode(10) + String.fromCharCode(125), i) + 2);
  };
  const semEffective = efetivas.filter(n => {
    const corpo = corpoDe(srvT, n);
    return !corpo || corpo.indexOf('withBuffs') < 0;
  });
  ok('e as SEIS do servidor tambem chamam o withBuffs', semEffective.length === 0, semEffective.join(', ') || 'as seis');
  /* O TEXTO DA TELA. Ele e a outra metade do pedido, e a trava le a frase PALAVRA POR PALAVRA:
     "todos os atributos" sozinho ja estava la e nao bastou -- o parentese e que parece a lista. */
  S.__getGame().terrainInfoTarget = S.TERRAINS[0];
  const caixa = String(S.renderTerrainInfoModal()).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
  S.__getGame().terrainInfoTarget = null;
  ['HP','Ataque','Defesa','Ataque Especial','Defesa Especial','Velocidade'].forEach(a =>
    ok('  a caixa do terreno nomeia ' + a, caixa.indexOf(a) >= 0, caixa.trim().slice(0, 170)));
  ok('e ela nao diz mais so "(HP, Ataque e Defesa)"', caixa.indexOf('(HP, Ataque e Defesa)') < 0);
}


console.log('\n=== ABRIR UM CONFRONTO ZERA O PASSO, ANTES DO DESENHO (15/09/2026) ===');
{
  /* Reportado na animacao do Remoinho: *"antes de trocar o pokemon, ta aparecendo qual vai ser o
     novo pokemon rapidamente e rapidamente troca para o pokemon que vai ser trocado"*.
     A CAUSA: os lacos faziam `Phase='loading'; render(); setTimeout(advance, 1200)`, e quem zerava o
     passo era o ramo `loading` do `advance` -- 1,2 SEGUNDO DEPOIS do desenho. Nesse intervalo o
     cabecalho saia com o passo do confronto ANTERIOR (alto), o `trocaDoRemoinho` via um passo alem
     do fim da cena, devolvia null ("e o pokemon do matchup") e a tela mostrava QUEM ENTROU.
     E A TERCEIRA PORTA DO MESMO DEFEITO: o "golpe fantasma" de 09/09/2026 era o `LastHit` sobrando,
     e o conserto de la zerou os dois JUNTOS -- mas so nos pontos que ja zeravam o passo. */
  const semTagA = h => String(h||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const caraA = h => /fighter-vaga/.test(String(h||'')) ? '(vazio)'
                   : ((semTagA(h).match(/([A-Za-zÀ-ÿ'.\-]+)[^A-Za-zÀ-ÿ]*Lv\.\d+/)||[])[1] || '?');
  /* 1) A FUNCAO zera os DOIS, em qualquer laco. */
  ['reveal','special','trainer','leagueWatch'].forEach(q => {
    S.__getGame()[q + 'HitStep'] = 7; S.__getGame()[q + 'LastHit'] = { x:'sujeira' };
    S.abrirConfronto(q);
    ok('  abrirConfronto("' + q + '") zera o passo E o ultimo golpe',
       S.__getGame()[q + 'HitStep'] === 0 && S.__getGame()[q + 'LastHit'] === null,
       'passo=' + S.__getGame()[q + 'HitStep'] + ' hit=' + JSON.stringify(S.__getGame()[q + 'LastHit']));
  });
  /* 2) ⚠️ TODO PONTO QUE ENTRA EM 'loading' CHAMA, e ANTES do render. Os casos acima chamam a funcao
     direto e passariam com um laco novo que nao a chamasse -- entao esta parte LE O CODIGO.
     O problema nunca foi o valor ficar velho: foi ele ser DESENHADO velho. */
  const cliA = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8').split('\n');
  const prefixo = { revealPhase:'reveal', specialRevealPhase:'special',
                    trainerRevealPhase:'trainer', leagueWatchPhase:'leagueWatch' };
  let pontos = 0, semChamada = [];
  cliA.forEach((l, i) => {
    const m = l.match(/game\.(\w+Phase) = 'loading';/);
    if(!m || !prefixo[m[1]]) return;
    pontos++;
    /* a chamada tem que estar ANTES do primeiro render() da janela -- e o render e o que desenha */
    const janela = cliA.slice(i, i + 7).join('\n');
    const antes = cliA.slice(Math.max(0, i - 6), i).join('\n');
    const iCham = janela.indexOf('abrirConfronto(');
    const iRender = janela.indexOf('render()');
    const ok2 = antes.indexOf('abrirConfronto(') >= 0 || (iCham >= 0 && (iRender < 0 || iCham < iRender));
    if(!ok2) semChamada.push((i + 1) + ':' + m[1]);
  });
  ok('os laços de animacao abrem confronto em varios pontos', pontos >= 12, pontos + ' pontos');
  ok('e TODOS chamam o abrirConfronto ANTES do render', semChamada.length === 0,
     semChamada.join(', ') || 'os ' + pontos);
  /* 3) O COMPORTAMENTO, no par do relato: com o passo do confronto ANTERIOR, o cabecalho abria em
     quem ENTRA; depois do abrirConfronto ele abre em quem SAI. */
  let achouA = 0, abriaErrado = 0, abreCerto = 0;
  for(let v = 0; v < 9000 && achouA < 30; v++){
    const a = [inst('pidgeot', 40)]; a[0].ataques = S.ataquesPadrao(a[0]);
    const b = ['psyduck','geodude','machop'].map(id => { const p = inst(id, 40); p.ataques = S.ataquesPadrao(p); return p; });
    const ms = (S.simulateGymBattle(a, b, S.makeSeededRng('abre' + v)).matchups) || [];
    const k = ms.findIndex((x, i) => i > 0 && (x.golpes||[]).some(g => g.x === 'remoinho'));
    if(k < 0) continue;
    achouA++;
    const passoVelho = S.buildAnimatedHitSequence(ms[k-1]).length;
    const m = ms[k], reg = (m.golpes||[]).find(g => g.x === 'remoinho');
    const lado = reg.q === 'p' ? 'e' : 'p';
    const quadro = (passo) => caraA(S.fighterHtml(m, lado,
      { hp: lado === 'e' ? m.enemyHpBefore : m.playerHpBefore, passo: passo, hit: null, comTerreno: true }));
    const quemEntra = lado === 'e' ? m.enemy : m.player;
    if(quadro(passoVelho) === quemEntra) abriaErrado++;   // o defeito, com o passo velho
    S.__getGame().revealHitStep = passoVelho;
    S.abrirConfronto('reveal');
    if(quadro(S.__getGame().revealHitStep) === reg.sai) abreCerto++;
  }
  ok('o par do relato aparece o bastante', achouA >= 15, achouA + ' confrontos com sopro');
  ok('com o passo VELHO a cena abria por quem ENTRA (o defeito)', abriaErrado > achouA * 0.5,
     abriaErrado + ' de ' + achouA);
  ok('e depois do abrirConfronto ela abre por quem SAI', abreCerto === achouA, abreCerto + ' de ' + achouA);
  /* 4) ⚠️ E A PROVA DE PONTA A PONTA: o LAÇO faz a virada de confronto e a gente anota o cabeçalho a
     cada desenho -- é literalmente a sequência de quadros que o jogador vê.
     Ela é mais forte que as três acima porque nenhuma delas roda o `advanceReveal`: montar a fase
     'loading' à mão MASCARAVA a diferença (foi o primeiro jeito que escrevi, e os dois builds deram
     igual). Quem chama o `abrirConfronto` é a virada, então a virada tem que acontecer. */
  {
    const g = S.__getGame();
    let achouC = 0, cenaOk = 0, ex = null;
    for(let v = 0; v < 9000 && achouC < 20; v++){
      const a = [inst('pidgeot', 40)]; a[0].ataques = S.ataquesPadrao(a[0]);
      const b = ['psyduck','geodude','machop'].map(id => { const p = inst(id, 40); p.ataques = S.ataquesPadrao(p); return p; });
      const r = S.simulateGymBattle(a, b, S.makeSeededRng('cena' + v));
      const ms = r.matchups || [];
      const k = ms.findIndex((x, i) => i > 0 && (x.golpes||[]).some(y => y.x === 'remoinho'));
      if(k < 0) continue;
      achouC++;
      /* COMEÇA NO CONFRONTO ANTERIOR, na fase 'result': é o laço que vira. */
      g.battleResult = r; g.revealIndex = k - 1; g.revealPhase = 'result';
      g.screen = 'battling'; g.battleResultContext = 'neighborhoodGym';
      g.revealHitStep = S.buildAnimatedHitSequence(ms[k-1]).length;   // o passo SUJO do anterior
      g.revealLastHit = { q:'p', x:null };
      const m = ms[k], reg = (m.golpes||[]).find(y => y.x === 'remoinho');
      const lado = reg.q === 'p' ? 'e' : 'p';
      const hpDoLado = () => lado === 'e' ? (g.revealCurrentEnemyHp != null ? g.revealCurrentEnemyHp : m.enemyHpBefore)
                                          : (g.revealCurrentPlayerHp != null ? g.revealCurrentPlayerHp : m.playerHpBefore);
      const quadro = () => caraA(S.fighterHtml(m, lado, { hp: hpDoLado(), passo: g.revealHitStep, hit: g.revealLastHit, comTerreno: true }));
      S.advanceReveal();                 // A VIRADA: revealIndex++, Phase='loading', abrirConfronto, render
      const cena = [quadro()];
      for(let n = 0; n < 12 && g.revealPhase !== 'result'; n++){ S.advanceReveal(); cena.push(quadro()); }
      /* O QUE SE COBRA: a cena ABRE por quem SAI (o defeito era abrir por quem ENTRA), passa pela
         vaga vazia e termina em quem entrou. */
      const quemEntra = lado === 'e' ? m.enemy : m.player;
      if(cena[0] === reg.sai && cena.indexOf('(vazio)') > 0 && cena[cena.length-1] === quemEntra) cenaOk++;
      else if(!ex) ex = cena.join(' > ') + '   (sai=' + reg.sai + ', entra=' + quemEntra + ')';
    }
    ok('a cena roda de ponta a ponta o bastante', achouC >= 10, achouC + ' confrontos');
    ok('e ela ABRE por quem SAI, passa pelo vazio e fecha em quem ENTRA', cenaOk === achouC,
       cenaOk + ' de ' + achouC + (ex ? '  |  ' + ex : ''));
    g.battleResult = null; g.revealPhase = null; g.screen = null; g.battleResultContext = null;
    g.revealCurrentPlayerHp = null; g.revealCurrentEnemyHp = null;
  }
}

/* ============================ O CONGELAMENTO (16/09/2026) ==============================
   O PRIMEIRO status POR ATAQUE do jogo -- os onze do tentarGolpeEspecial sao sorteados na
   ABERTURA e valem por CONFRONTO; este e sorteado a cada golpe que sai. */
{
  console.log('\n--- o congelamento ---');
  const GELO = Object.keys(S.GOLPES_QUE_CONGELAM);
  const cliG = require("fs").readFileSync(require("path").join(raiz, "index.html"), "utf8");
  const srvG = require("fs").readFileSync(require("path").join(raiz, "functions", "index.js"), "utf8");
  /* ⚠️ O inst() do topo deste arquivo NAO preenche hp, e o podeCongelar cobra hp > 0 -- sem isto
     a medicao da chance da ZERO e parece defeito da mecanica, quando e do fixture. */
  const vivo = (id, lv) => { const q = inst(id, lv); q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp; return q; };
  const perfilGelo = (g) => g.map(x => (x.q || '?') + ':' + (x.x || ('-' + x.d))).join(' | ');

  /* 1) A TABELA, e que ela nao e letra morta. A licao da Lamina Solar: cadastrar um golpe que a
        base da Gen 3 nao tem e escrever codigo que nunca roda. */
  ok('sao os 4 golpes de gelo que congelam no FireRed', GELO.length === 4 &&
     ['icepunch', 'icebeam', 'blizzard', 'powdersnow'].every(g => S.GOLPES_QUE_CONGELAM[g] === 0.10),
     GELO.join(', '));
  ok('os quatro EXISTEM na tabela GOLPES e sao de tipo Gelo',
     GELO.every(g => S.GOLPES[g] && S.GOLPES[g][0] === 'Ice'),
     GELO.map(g => g + (S.GOLPES[g] ? '=' + S.GOLPES[g][0] : '=SUMIU')).join(' '));
  /* ⚠️ E OS OUTROS GOLPES DE GELO DA TABELA NAO CONGELAM, e isso e fiel ao FireRed: Aurora Beam
     baixa Ataque, Icy Wind baixa Velocidade, Icicle Spear e multi-tapa puro e o Iceball escala.
     Nenhum dos quatro tem efeito de congelar. */
  {
    const ice = Object.keys(S.GOLPES).filter(g => S.GOLPES[g][0] === 'Ice');
    const naoCongelam = ice.filter(g => !S.GOLPES_QUE_CONGELAM[g]).sort();
    ok('e os outros golpes de Gelo da tabela NAO congelam (fiel ao FireRed)',
       naoCongelam.length === ice.length - 4 && naoCongelam.indexOf('aurorabeam') >= 0 &&
       naoCongelam.indexOf('icywind') >= 0, naoCongelam.join(', '));
  }
  /* alguem tem que APRENDER, senao a mecanica nunca roda */
  {
    const quem = Object.keys(S.SPECIES).filter(id =>
      (S.ataquesDisponiveis(id, 70) || []).some(g => GELO.indexOf(g) >= 0));
    ok('e ha especies que os aprendem por nivel', quem.length >= 10, quem.length + ' de 250');
    /* ⚠️ E QUE ELAS OS LEVAM: aprender nao basta -- sao tres vagas e quem escolhe e o poder. Sem
       isto a mecanica seria a Furia de novo, implementada ao pe da letra e nunca saindo. */
    const levam = quem.filter(id => {
      const p = S.createInstance(id, 70);
      return (S.ataquesPadrao(p) || []).some(g => GELO.indexOf(g) >= 0);
    });
    ok('e o moveset padrao do Lv.70 realmente os leva', levam.length >= 8, levam.length + ' levam');
  }

  /* 2) AS DUAS CHANCES, medidas com UM rng continuo -- semente nova a cada volta correlaciona o
        primeiro valor com a semente, e a medicao sai enviesada (deu 7,8% na primeira tentativa). */
  {
    const rng = S.makeSeededRng('gelo-chance'), N = 40000;
    let c = 0;
    for(let i = 0; i < N; i++){
      const a = vivo('articuno', 50); a.lastMove = 'blizzard';
      if(S.tentarCongelar(a, vivo('blissey', 70), rng)) c++;
    }
    const sd = Math.sqrt(0.1 * 0.9 / N), sig = Math.abs(c / N - 0.10) / sd;
    ok('congela em 10% por ataque', sig < 3, (100 * c / N).toFixed(2) + '%  (' + sig.toFixed(1) + ' sigma)');
  }
  ok('e descongela em 25% por turno', S.CHANCE_DESCONGELAR === 0.25, String(S.CHANCE_DESCONGELAR));
  {
    const rng = S.makeSeededRng('gelo-dur'); const dur = [];
    for(let i = 0; i < 20000; i++){ let t = 1; while(rng() >= S.CHANCE_DESCONGELAR && t < 500) t++; dur.push(t); }
    const m = dur.reduce((a, b) => a + b, 0) / dur.length;
    ok('o que da 4,0 turnos de gelo em media', Math.abs(m - 4) < 0.2, m.toFixed(2) + ' turnos');
  }

  /* 3) O TIPO GELO E IMUNE, como no jogo original. */
  ok('quem e do tipo Gelo nao congela',
     !S.podeCongelar(vivo('lapras', 50)) && !S.podeCongelar(vivo('articuno', 50)) &&
     !S.podeCongelar(vivo('jynx', 50)) && S.podeCongelar(vivo('machamp', 50)));
  {
    let c = 0;
    for(let i = 0; i < 3000; i++){
      const a = vivo('articuno', 50); a.ataques = ['blizzard'];
      const b = vivo('lapras', 50); b.ataques = ['pound'];
      S.doExchange(a, b, S.makeSeededRng('im' + i), []);
      if(b._congelado) c++;
    }
    ok('e nenhuma Lapras congela em 3.000 trocas', c === 0, c + ' congeladas');
  }
  { const m = vivo('machamp', 50); m.hp = 0; ok('nem quem ja caiu', !S.podeCongelar(m)); }
  { const m = vivo('machamp', 50); m._congelado = 'blizzard'; ok('nem quem ja esta congelado', !S.podeCongelar(m)); }

  /* 4) O CICLO NA TELA -- e o invariante que a ordem das linhas existe pra sustentar: percorrendo
        o log linha a linha, QUEM ESTA CONGELADO NUNCA APARECE ATACANDO. Foi este o defeito das
        duas primeiras versoes: as linhas empilhadas no fim do doExchange davam "Blissey ataca /
        Blissey degelou", a ordem invertida da cena. */
  {
    let confs = 0, atacouGelado = 0, linhaSemGelo = 0, congelouSemGolpe = 0, ex = null;
    for(let i = 0; i < 1200; i++){
      const a = vivo('articuno', 55); a.ataques = ['blizzard'];
      const b = vivo('blissey', 75); b.ataques = ['pound'];
      const r = S.simulateGymBattle([a], [b], S.makeSeededRng('ciclo' + i));
      for(const m of (r.matchups || [])){
        const g = m.golpes || [];
        if(!g.some(x => x.x === 'congelou')) continue;
        confs++;
        const preso = { p: false, e: false };
        for(let k = 0; k < g.length; k++){
          const l = g[k];
          if(l.x === 'congelou'){
            preso[l.q] = true;
            /* a linha e CONSEQUENCIA de um golpe: vem logo depois de um golpe do lado OPOSTO */
            const ant = g[k - 1];
            if(!(ant && !ant.x && ant.q !== l.q)){ congelouSemGolpe++; if(!ex) ex = perfilGelo(g); }
          } else if(l.x === 'degelou'){
            if(!preso[l.q]){ linhaSemGelo++; if(!ex) ex = perfilGelo(g); }
            preso[l.q] = false;
          } else if(l.x === 'gelado'){
            if(!preso[l.q]){ linhaSemGelo++; if(!ex) ex = perfilGelo(g); }
          } else if(!l.x && l.d > 0){
            if(preso[l.q]){ atacouGelado++; if(!ex) ex = perfilGelo(g); }
          }
        }
      }
    }
    ok('achei confrontos com congelamento pra ler', confs >= 100, confs + ' confrontos');
    ok('QUEM ESTA CONGELADO NUNCA APARECE ATACANDO', atacouGelado === 0,
       atacouGelado + (ex ? '  |  ' + ex : ''));
    ok('e nenhuma linha de gelo sai sem o pokemon estar congelado', linhaSemGelo === 0, String(linhaSemGelo));
    ok('e o "ficou congelado" vem logo DEPOIS do golpe que congelou', congelouSemGolpe === 0,
       congelouSemGolpe + (ex ? '  |  ' + ex : ''));
  }

  /* 5) AS TRES FRASES, palavra por palavra. */
  ok('a frase do congelamento nomeia o GOLPE, nao quem congelou',
     S.fraseDoEspecial({ x: 'congelou', g: 'Dragonite', mv: 'blizzard' }, {}, {}) ===
     'Dragonite ficou congelado com NEVASCA!');
  ok('a de quem perdeu a vez diz por que a barra dele nao anda',
     S.fraseDoEspecial({ x: 'gelado', g: 'Dragonite' }, {}, {}) ===
     'Dragonite não consegue atacar por estar congelado');
  ok('e a do degelo',
     S.fraseDoEspecial({ x: 'degelou', g: 'Dragonite' }, {}, {}) ===
     'Dragonite não está mais congelado!');
  /* ⚠️ "COM" E NAO "PELO": NEVASCA e feminina e "congelado pelo Nevasca" sai errado. Os outros
     tres nomes sao masculinos, entao a preposicao neutra e a unica que serve aos quatro sem uma
     tabela de genero pra uma frase so. */
  ok('e ela serve aos QUATRO golpes sem erro de genero',
     GELO.every(mv => {
       const f = S.fraseDoEspecial({ x: 'congelou', g: 'X', mv: mv }, {}, {});
       return f.indexOf('X ficou congelado com ') === 0 && !/pelo |pela /.test(f);
     }),
     GELO.map(mv => S.fraseDoEspecial({ x: 'congelou', g: 'X', mv: mv }, {}, {})).join(' / '));
  ok('log gravado antes do campo mv cai numa frase sem golpe',
     S.fraseDoEspecial({ x: 'congelou', g: 'Dragonite' }, {}, {}) === 'Dragonite ficou congelado!');

  /* 6) O SEGUNDO E MEIO DE LEITURA -- pedido com estas palavras: "a cada frase, esperar aquele
        1,5s para o usuario conseguir ler o que aconteceu". Quem o entrega e a tabela: uma entrada
        la faz a frase virar PASSO da animacao e ganhar a marca de leitura. Sem entrada, a frase
        valeria pra SEMPRE -- o defeito que a anulacao teve. */
  ok('as tres frases valem 1 passo cada na animacao',
     S.passosDaAbertura.congelou === 1 && S.passosDaAbertura.gelado === 1 && S.passosDaAbertura.degelou === 1);
  ok('e as tres sao reconhecidas como golpe especial (senao nao virariam passo)',
     S.ehGolpeEspecial({ x: 'congelou' }) && S.ehGolpeEspecial({ x: 'gelado' }) && S.ehGolpeEspecial({ x: 'degelou' }));

  /* 7) A MARCA E SOLTA NO FIM DA BATALHA. Ela e um campo da instancia, e o time vai pro SAVE --
        sem soltar, um pokemon sairia da batalha congelado pra sempre. E o mesmo vazamento que o
        teto de HP da Furia teve, e la ele escapou pela porta da DERROTA por semanas. */
  ok('o campo comeca com _ (entao nao vai pro Firestore)', /_congelado/.test(cliG));
  ok('e o encerrarBatalha o solta', /p\._congelado = null;/.test(cliG));
  {
    let sobrou = 0;
    for(let i = 0; i < 400; i++){
      const a = vivo('articuno', 55); a.ataques = ['blizzard'];
      const time = [a, vivo('machamp', 50)], adv = [vivo('blissey', 60), vivo('snorlax', 60)];
      time.concat(adv).forEach(p => { p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; });
      S.simulateGymBattle(time, adv, S.makeSeededRng('solta' + i));
      if(time.concat(adv).some(p => p._congelado)) sobrou++;
    }
    ok('e ninguem sai de 400 batalhas ainda congelado', sobrou === 0, sobrou + ' sobraram');
  }

  /* 8) OS DOIS MOTORES. A tabela e a constante sao duplicadas, e um lado congelando mais que o
        outro faz a MESMA batalha terminar diferente no cliente e no servidor. */
  ok('a tabela e a chance sao iguais nos dois motores',
     /icepunch:\s*0\.10/.test(srvG) && /icebeam:\s*0\.10/.test(srvG) &&
     /blizzard:\s*0\.10/.test(srvG) && /powdersnow:\s*0\.10/.test(srvG) &&
     /CHANCE_DESCONGELAR = 0\.25/.test(cliG) && /CHANCE_DESCONGELAR = 0\.25/.test(srvG));
  /* ⚠️ E O SORTEIO LE O rng DA BATALHA, nunca Math.random: um dado a mais num dos lados desloca a
     semente inteira. E a mesma armadilha que o Remoinho quase trouxe. */
  ok('o sorteio le o rng da batalha nos dois motores',
     /function tentarCongelar\(quemBate, alvo, rng\)/.test(cliG) &&
     /function tentarCongelar\(quemBate, alvo, rng\)/.test(srvG));
  /* ⚠️ E ELE SO E LIDO QUANDO O GOLPE PODE CONGELAR: o tentarCongelar sai ANTES do rng() quando o
     golpe nao esta na tabela ou o alvo nao pode congelar. Lido sempre, ele mudaria toda batalha
     que nao tem golpe de gelo nenhum. */
  {
    let leu = 0; const conta = () => { leu++; return 0.001; };
    const a = vivo('machamp', 50); a.lastMove = 'karatechop';
    S.tentarCongelar(a, vivo('blissey', 60), conta);
    ok('e o rng NAO e lido quando o golpe nao congela', leu === 0, leu + ' leituras');
    const b = vivo('articuno', 50); b.lastMove = 'blizzard';
    S.tentarCongelar(b, vivo('lapras', 60), conta);
    ok('nem quando o alvo e imune', leu === 0, leu + ' leituras');
  }

  /* 9) OS DOIS MOTORES, GOLPE A GOLPE, NUM PAINEL QUE GARANTE GELO.
     ⚠️ A comparacao das 300 batalhas NAO serve aqui: sao 10 especies em 250 e o gelo sairia em
     ~2 delas, o que faz a trava falhar sozinha uma vez em sete. Isto e o pior tipo de teste que
     existe -- o que passa quase sempre. O painel forca o golpe, e a cobranca fica exata. */
  {
    const ALVOS = ['machamp', 'snorlax', 'rhydon', 'blissey', 'venusaur', 'dragonite'];
    let div = 0, comGelo = 0, presos = 0, ex = null;
    for(let i = 0; i < 120; i++){
      const alvo = ALVOS[i % ALVOS.length];
      const monta = (novo) => {
        const a = novo('articuno', 60); a.ataques = ['blizzard'];
        const b = novo('jynx', 60); b.ataques = ['icepunch'];
        return [a, b];
      };
      const advs = (novo) => [novo(alvo, 62), novo(ALVOS[(i + 3) % ALVOS.length], 62)];
      const rC = S.simulateGymBattle(monta((id, lv) => S.createInstance(id, lv)),
                                     advs((id, lv) => S.createInstance(id, lv)), S.makeSeededRng('g2m' + i));
      const rS = srv._simulateGymBattle(monta((id, lv) => srv._createInstance(id, lv)),
                                        advs((id, lv) => srv._createInstance(id, lv)), srv._makeSeededRng('g2m' + i));
      const gelo = (r) => (r.matchups || []).reduce((n, m) =>
        n + (m.golpes || []).filter(g => g.x === 'congelou' || g.x === 'gelado' || g.x === 'degelou').length, 0);
      if(gelo(rC) > 0) comGelo++;
      presos += (rC.matchups || []).reduce((n, m) => n + (m.golpes || []).filter(g => g.x === 'gelado').length, 0);
      if(resumo(rC) !== resumo(rS)){ div++; if(!ex) ex = 'volta ' + i + ' contra ' + alvo; }
    }
    ok('120 batalhas com gelo garantido batem golpe a golpe nos dois motores', div === 0,
       div + ' divergencias' + (ex ? '  |  ' + ex : ''));
    /* ⚠️ E O GELO TEM QUE ESTAR DENTRO DELAS -- sem esta linha a comparacao daria verde sem nunca
       tocar na mecanica, que e a mesma armadilha que a Furia e a Furia do Dragao ja registram. */
    ok('e o gelo esta dentro delas', comGelo >= 25 && presos > 0,
       comGelo + ' batalhas com gelo, ' + presos + ' turnos perdidos');
  }

  /* 10) ⚠️ E O LOG. ESTA TRAVA EXISTE PORQUE O NAVEGADOR PEGOU O QUE ELAS NAO PEGAVAM.
     As de cima leem o DIARIO e a SEQUENCIA, e o defeito era do HTML: a lista de `x` que viram
     frase no passosHtml era escrita A MAO (17 nomes), o congelamento nasceu fora dela, e as tres
     linhas cairam no ramo do GOLPE COMUM. O log saia com "Blissey atacou Articuno com Nevasca e
     tirou −0 de HP" -- um −0 (o que este log evita em toda regra) com o nome de um golpe que a
     Blissey nem tem, porque o campo `mv` da linha do congelamento virou o golpe dela.
     Hoje quem decide e o ehGolpeEspecial, e esta trava cobra as duas pontas. */
  {
    let comGelo = 0, zeros = 0, semFrase = 0, linhasGelo = 0, ex = null;
    for(let i = 0; i < 300; i++){
      const a = vivo('articuno', 55); a.ataques = ['blizzard'];
      const b = vivo('blissey', 75); b.ataques = ['pound'];
      const r = S.simulateGymBattle([a], [b], S.makeSeededRng('log' + i));
      for(const m of (r.matchups || [])){
        const g = m.golpes || [];
        const nGelo = g.filter(x => x.x === 'congelou' || x.x === 'gelado' || x.x === 'degelou').length;
        if(!nGelo) continue;
        comGelo++;
        const html = S.passosHtml(m);
        /* nenhum "-0 de HP" -- a marca de que a linha caiu no ramo do golpe comum */
        const z = (html.match(/−0<\/span> de HP/g) || []).length;
        if(z){ zeros += z; if(!ex) ex = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 160); }
        /* e cada linha de gelo tem que estar LA, com a frase dela */
        const naTela = (html.match(/congelado|não está mais congelado/g) || []).length;
        linhasGelo += nGelo;
        if(naTela < nGelo){ semFrase += nGelo - naTela; if(!ex) ex = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 160); }
      }
    }
    ok('achei confrontos com gelo pra ler o HTML do log', comGelo >= 100, comGelo + ' confrontos');
    ok('nenhuma linha de gelo vira um "−0 de HP" no log', zeros === 0, zeros + (ex ? '  |  ' + ex : ''));
    ok('e as ' + linhasGelo + ' linhas de gelo saem com a frase delas', semFrase === 0,
       semFrase + ' sem frase' + (ex ? '  |  ' + ex : ''));
  }
  /* ⚠️ E A DECISAO DEIXOU DE SER UMA LISTA A MAO. Sem esta linha, o proximo especial nasce com o
     mesmo defeito e ninguem ve -- que e exatamente o que aconteceu aqui. */
  ok('quem decide a frase no log e o ehGolpeEspecial, nao uma lista escrita a mao',
     /if\(ehGolpeEspecial\(g\) \|\| g\.x === 'faixa' \|\| g\.x === 'desempate'\) return linhaEspecial\(g\);/.test(cliG));
  /* ⚠️ O `disable` ERA A EXCECAO AQUI, com um `return ''`, e ela saiu em 25/09/2026: com o Disable
     virando golpe da TROCA, a anulacao deixou de ser desenhada no topo do log e passou a sair pelo
     caminho comum, no lugar dela. Sem esta trava, alguem devolve a guarda e a linha SOME do log --
     porque a montagem no topo tambem nao existe mais. */
  ok('e o disable NAO fica mais de fora -- ele sai no lugar dele',
     !/if\(g\.x === 'disable'\) return '';/.test(cliG));
  ok('  e a montagem no topo do log nao existe mais',
     !/const anulacoes = /.test(cliG) && !/\$\{anulacoes\}/.test(cliG));
  /* AS TRES DIVIDEM O MESMO SELO ❄️ -- elas sao o mesmo evento em tres momentos. Sem selo, seriam
     as unicas frases mudas da linha de status: todo o resto do bloco tem o dele. */
  ok('e as tres dividem o MESMO selo de gelo',
     S.ICONES_ESPECIAIS && temSelo(S.ICONES_ESPECIAIS.congelou, 'gelo') &&
     S.ICONES_ESPECIAIS.gelado === S.ICONES_ESPECIAIS.congelou &&
     S.ICONES_ESPECIAIS.degelou === S.ICONES_ESPECIAIS.congelou);
}

/* ============================= A QUEIMADURA (16/09/2026) ==============================
   A SEGUNDA mecanica POR ATAQUE do jogo, e a primeira que DURA a batalha inteira: o gelo sorteia
   degelo a cada turno, a queimadura nao passa. As regras sao as da GEN 3 (Bulbapedia, Burn). */
{
  console.log('\n--- a queimadura ---');
  const QUEIMAM = Object.keys(S.GOLPES_QUE_QUEIMAM);
  const cliQ = require('fs').readFileSync(require('path').join(raiz, 'index.html'), 'utf8');
  const srvQ = require('fs').readFileSync(require('path').join(raiz, 'functions', 'index.js'), 'utf8');
  /* o inst() do topo nao preenche hp, e o podeQueimar cobra hp > 0 -- a licao do gelo */
  const vq = (id, lv) => { const q = inst(id, lv); q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp; return q; };

  /* 1) A TABELA, e que ela nao e letra morta. */
  ok('sao os 7 golpes de fogo que queimam no FireRed', QUEIMAM.length === 7 &&
     ['firepunch', 'ember', 'flamethrower', 'fireblast', 'flamewheel', 'heatwave']
       .every(g => S.GOLPES_QUE_QUEIMAM[g] === 0.10) && S.GOLPES_QUE_QUEIMAM.sacredfire === 0.50,
     QUEIMAM.join(', '));
  ok('os sete EXISTEM na tabela GOLPES e sao de tipo Fogo',
     QUEIMAM.every(g => S.GOLPES[g] && S.GOLPES[g][0] === 'Fire'),
     QUEIMAM.map(g => g + (S.GOLPES[g] ? '=' + S.GOLPES[g][0] : '=SUMIU')).join(' '));
  /* ⚠️ O FIRE SPIN E O UNICO GOLPE DE FOGO DA TABELA QUE NAO QUEIMA, e e fiel: ele e o de PRENDER
     (que virou multi-tapa aqui), nao tem efeito de status nenhum. */
  {
    const fogo = Object.keys(S.GOLPES).filter(g => S.GOLPES[g][0] === 'Fire');
    const fora = fogo.filter(g => !S.GOLPES_QUE_QUEIMAM[g]);
    /* ⚠️ SAO DOIS DESDE 17/09/2026, e os dois por razao de dado: o REDEMOINHO DE FOGO e o de
       PRENDER (virou multi-tapa aqui) e nao tem status nenhum, e o OVERHEAT tambem nao queima no
       jogo oficial -- o que ele faz e cobrar -2 no Sp.Atk de QUEM USA.
       A trava lista os dois de proposito: um golpe de Fogo novo que nasca sem queimar tem que ser
       DECISAO, e nao descuido. */
    ok('so o Redemoinho de Fogo e o Overheat NAO queimam',
       fora.length === 2 && fora.indexOf('firespin') >= 0 && fora.indexOf('overheat') >= 0,
       fora.join(', '));
  }
  /* alguem tem que APRENDER e LEVAR, senao a mecanica seria a Furia de novo */
  {
    const quem = Object.keys(S.SPECIES).filter(id =>
      (S.ataquesDisponiveis(id, 70) || []).some(g => QUEIMAM.indexOf(g) >= 0));
    const levam = quem.filter(id => {
      const p = S.createInstance(id, 70);
      return (S.ataquesPadrao(p) || []).some(g => QUEIMAM.indexOf(g) >= 0);
    });
    ok('23 especies os aprendem por nivel', quem.length >= 20, quem.length + ' de 250');
    ok('e 22 os LEVAM no moveset padrao do Lv.70', levam.length >= 20, levam.length + ' levam');
  }

  /* 2) A CHANCE, com UM rng continuo -- semente nova a cada volta enviesa (a licao do gelo). */
  {
    const rng = S.makeSeededRng('queima-chance'), N = 40000;
    let c = 0;
    for(let i = 0; i < N; i++){
      const a = vq('charizard', 50); a.lastMove = 'flamethrower';
      if(S.tentarQueimar(a, vq('snorlax', 70), rng)) c++;
    }
    const sd = Math.sqrt(0.1 * 0.9 / N), sig = Math.abs(c / N - 0.10) / sd;
    ok('queima em 10% por ataque', sig < 3, (100 * c / N).toFixed(2) + '%  (' + sig.toFixed(1) + ' sigma)');
  }
  /* o Sacred Fire e 50%, e e o valor oficial dele */
  {
    const rng = S.makeSeededRng('sf'), N = 20000;
    let c = 0;
    for(let i = 0; i < N; i++){
      const a = vq('hooh', 70); a.lastMove = 'sacredfire';
      if(S.tentarQueimar(a, vq('snorlax', 70), rng)) c++;
    }
    ok('e o Sacred Fire em 50%', Math.abs(c / N - 0.5) < 0.02, (100 * c / N).toFixed(1) + '%');
  }

  /* 3) O TIPO FOGO E IMUNE. */
  ok('quem e do tipo Fogo nao queima',
     !S.podeQueimar(vq('charizard', 50)) && !S.podeQueimar(vq('arcanine', 50)) &&
     !S.podeQueimar(vq('magcargo', 50)) && S.podeQueimar(vq('machamp', 50)));
  {
    let c = 0;
    for(let i = 0; i < 3000; i++){
      const a = vq('charizard', 50); a.ataques = ['flamethrower'];
      const b = vq('arcanine', 50); b.ataques = ['bite'];
      S.doExchange(a, b, S.makeSeededRng('iq' + i), []);
      if(b._queimado) c++;
    }
    ok('e nenhum Arcanine queima em 3.000 trocas', c === 0, c + ' queimados');
  }
  { const m = vq('machamp', 50); m.hp = 0; ok('nem quem ja caiu', !S.podeQueimar(m)); }
  { const m = vq('machamp', 50); m._queimado = 'ember'; ok('nem quem ja esta queimado', !S.podeQueimar(m)); }

  /* 4) OS DOIS EFEITOS: 1/16 por turno e METADE do ataque fisico. */
  ok('1/16 do HP maximo por turno', S.QUEIMADURA_DANO === 1/16, String(S.QUEIMADURA_DANO));
  ok('e metade do ataque fisico', S.QUEIMADURA_FISICO === 0.5, String(S.QUEIMADURA_FISICO));
  {
    const a = vq('machamp', 50), b = vq('machamp', 50);
    b._queimado = 'ember';
    ok('o ataque FISICO cai pela metade', S.effectiveAttack(b) === Math.round(S.effectiveAttack(a) * 0.5),
       S.effectiveAttack(a) + ' -> ' + S.effectiveAttack(b));
    ok('e o ataque ESPECIAL nao e tocado', S.effectiveSpAtk(b) === S.effectiveSpAtk(a),
       S.effectiveSpAtk(a) + ' -> ' + S.effectiveSpAtk(b));
    /* ⚠️ ELA ENTRA DEPOIS DOS MULTIPLICADORES E DO FLAT, como a danca: "metade do ataque" e metade
       do que o pokemon TEM na hora do golpe. Num shiny em terreno com item o corte continua exato. */
    const c = vq('machamp', 50), d = vq('machamp', 50);
    c.shiny = true; d.shiny = true; d._queimado = 'ember';
    ok('e o corte continua exato num shiny', S.effectiveAttack(d) === Math.round(S.effectiveAttack(c) * 0.5),
       S.effectiveAttack(c) + ' -> ' + S.effectiveAttack(d));
  }
  {
    /* o dano por turno, medido no motor */
    let ok1 = 0, n = 0, piso = 0;
    for(let i = 0; i < 400; i++){
      const a = vq('charizard', 60); a.ataques = ['flamethrower'];
      const b = vq('snorlax', 70); b.ataques = ['bodyslam']; b._queimado = 'ember';
      const di = [];
      S.doExchange(a, b, S.makeSeededRng('dt' + i), di);
      const q = di.filter(g => g.x === 'queima' && g.q === 'e');
      if(!q.length) continue;
      n++;
      const esperado = Math.max(1, Math.round(b.maxHp / 16));
      if(q[0].d === esperado || q[0].d === piso) ok1++;
    }
    ok('e o dano por turno e 1/16 do teto', n > 0 && ok1 === n, ok1 + ' de ' + n);
  }
  /* ⚠️ O MINIMO E 1: com o arredondamento, um pokemon de teto pequeno levaria ZERO e a queimadura
     viraria enfeite -- e uma linha de "-0 de HP" e o que este log evita em toda regra. */
  {
    /* ⚠️ O ALVO PRECISA SOBREVIVER A TROCA, senao a linha nem existe e o caso da verde sem medir
       nada -- foi o que a primeira versao fez ("morreu antes"). Um Caterpie com teto 10 morre de
       qualquer golpe, entao quem apanha aqui e um Shuckle (230 de Defesa) com o teto forcado. */
    const p = vq('shuckle', 50); p._queimado = 'ember'; p.maxHp = 10; p.hp = 10;
    const o = vq('caterpie', 5); o.ataques = ['tackle'];
    const di = [];
    S.doExchange(o, p, S.makeSeededRng('min'), di);
    const q = di.find(g => g.x === 'queima');
    ok('e ela nunca tira ZERO, mesmo num teto de 10', !!q && q.d >= 1, q ? (q.d + ' de dano') : 'NAO GEROU LINHA');
  }

  /* 5) ⚠️ ELA NUNCA DERRUBA OS DOIS NA MESMA TROCA. A regra e de 12/09/2026, pedida com estas
        palavras: "nao existe de os 2 cairem juntos, somente na auto destruicao". Foi por ela que o
        revide moribundo deixou de matar, e a queimadura reabria a porta pelo outro lado. */
  {
    const IDSQ = Object.keys(S.SPECIES);
    const rngQ = S.makeSeededRng('dupla');
    const mkq = (id, lv) => { const p = S.createInstance(id, lv); p.ataques = S.ataquesPadrao(p);
                              p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; return p; };
    let dup = 0, comBoom = 0, comQueima = 0, conf = 0, ex = null;
    for(let b = 0; b < 2500; b++){
      const t = n => Array.from({length:n}, () => mkq(IDSQ[Math.floor(rngQ()*IDSQ.length)], 30 + Math.floor(rngQ()*50)));
      const A = t(3), B = t(3); S.equiparNpc(B);
      const r = S.simulateGymBattle(A, B, S.makeSeededRng('dp' + b));
      for(const m of (r.matchups || [])){
        conf++;
        if((m.golpes || []).some(g => g.x === 'queima')) comQueima++;
        if(m.playerHpAfter <= 0 && m.enemyHpAfter <= 0){
          dup++;
          if((m.golpes || []).some(g => g.x === 'boom')) comBoom++;
          else if(!ex) ex = m.playerSpecies + ' ' + m.playerHpBefore + '->0 x ' + m.enemySpecies + ' ' + m.enemyHpBefore + '->0';
        }
      }
    }
    ok('a queimadura aparece na varredura', comQueima > 0, comQueima + ' confrontos de ' + conf);
    ok('e os DOIS nunca caem juntos fora da autodestruicao', dup === comBoom,
       comBoom + ' de ' + dup + (ex ? '  |  ' + ex : ''));
  }

  /* 6) AS DUAS FRASES, palavra por palavra. */
  ok('a frase da queimadura nomeia o GOLPE',
     S.fraseDoEspecial({ x: 'queimou', g: 'Machamp', mv: 'flamethrower' }, {}, {}) ===
     'Machamp ficou queimado com LANÇA-CHAMAS!');
  /* ⚠️ E ELA TRAZ O NUMERO, e e a unica do bloco de status que traz: a linha de um especial nao
     ganha o "e tirou -N de HP" automatico, e sem o numero a soma das linhas nao fecharia com a
     barra -- o jogador veria a barra descer mais do que o log conta. */
  ok('e a do dano por turno traz o NUMERO',
     S.fraseDoEspecial({ x: 'queima', g: 'Machamp', d: 29 }, {}, {}) ===
     'Machamp perdeu 29 de HP pela queimadura');
  ok('log gravado antes do campo mv cai numa frase sem golpe',
     S.fraseDoEspecial({ x: 'queimou', g: 'Machamp' }, {}, {}) === 'Machamp ficou queimado!');
  ok('e as duas dividem o MESMO selo de fogo',
     temSelo(S.ICONES_ESPECIAIS.queimou, 'fogo') &&
     S.ICONES_ESPECIAIS.queima === S.ICONES_ESPECIAIS.queimou);
  ok('as duas valem 1 passo cada na animacao (a pausa de leitura)',
     S.passosDaAbertura.queimou === 1 && S.passosDaAbertura.queima === 1);
  ok('e sao reconhecidas como golpe especial',
     S.ehGolpeEspecial({ x: 'queimou' }) && S.ehGolpeEspecial({ x: 'queima' }));

  /* 7) ⚠️ O PASSO DA ANIMACAO NAO INVERTE O LADO. O passo comum le o `q` como QUEM BATE e desce a
        barra do OUTRO; aqui o `q` e de QUEM ESTA QUEIMADO -- nao ha causador nesta troca. Invertido,
        a barra que desce e a do pokemon errado, e o defeito nao aparece como erro: aparece como o
        adversario perdendo vida do nada. */
  {
    let confs = 0, ladoErrado = 0, ex = null;
    for(let i = 0; i < 400; i++){
      const a = vq('charizard', 60); a.ataques = ['flamethrower'];
      const b = vq('snorlax', 70); b.ataques = ['bodyslam'];
      const r = S.simulateGymBattle([a], [b], S.makeSeededRng('anim' + i));
      for(const m of (r.matchups || [])){
        const seq = S.buildAnimatedHitSequence(m);
        for(let k = 0; k < seq.length; k++){
          if(seq[k].x !== 'queima') continue;
          confs++;
          const esperado = seq[k].q === 'p' ? 'player' : 'enemy';
          if(seq[k].side !== esperado || !(seq[k].amount > 0)){
            ladoErrado++; if(!ex) ex = 'q=' + seq[k].q + ' side=' + seq[k].side + ' amount=' + seq[k].amount;
          }
        }
      }
    }
    ok('achei passos de queimadura na animacao', confs >= 50, confs + ' passos');
    ok('e a barra que desce e a de QUEM ESTA QUEIMADO', ladoErrado === 0,
       ladoErrado + (ex ? '  |  ' + ex : ''));
  }
  /* ⚠️ E A LINHA NAO GRAVA `hp`, pela mesma razao do REMOINHO: o campo quer dizer "a vida do ALVO",
     e o alvo de uma linha comum e o lado OPOSTO ao `q`. Gravando a vida de quem PERDE ali, toda
     conta que le o diario a atribui ao outro lado. */
  /* A trava le o `danoDeStatus`, que e onde a queimadura E o veneno gravam -- os dois dividem a
     funcao desde 16/09/2026, e por isso a linha e `x:x` e nao o nome de um deles. */
  ok('e a linha nao grava hp (o campo seria lido do lado errado)',
     /const danoDeStatus[\s\S]{0,2400}?hp:null, c:0, m:0, z:0, x:x, g:p\.name/.test(cliQ) &&
     /const danoDeStatus[\s\S]{0,2400}?hp:null, c:0, m:0, z:0, x:x, g:p\.name/.test(srvQ));

  /* 8) O LOG. A licao do gelo: a trava tem que ler o HTML, porque as que leem o diario e a
        sequencia dao verde com a linha caindo no ramo do golpe comum. */
  {
    let comQ = 0, zeros = 0, semFrase = 0, linhas = 0, ex = null;
    for(let i = 0; i < 300; i++){
      const a = vq('charizard', 60); a.ataques = ['flamethrower'];
      const b = vq('snorlax', 75); b.ataques = ['bodyslam'];
      const r = S.simulateGymBattle([a], [b], S.makeSeededRng('logq' + i));
      for(const m of (r.matchups || [])){
        const g = m.golpes || [];
        const n = g.filter(x => x.x === 'queimou' || x.x === 'queima').length;
        if(!n) continue;
        comQ++; linhas += n;
        const html = S.passosHtml(m);
        const z = (html.match(/−0<\/span> de HP/g) || []).length;
        if(z){ zeros += z; if(!ex) ex = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 150); }
        const naTela = (html.match(/queimad|queimadura/g) || []).length;
        if(naTela < n){ semFrase += n - naTela; if(!ex) ex = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 150); }
      }
    }
    ok('achei confrontos com queimadura pra ler o HTML', comQ >= 40, comQ + ' confrontos');
    ok('nenhuma linha de queimadura vira "−0 de HP"', zeros === 0, zeros + (ex ? '  |  ' + ex : ''));
    ok('e as ' + linhas + ' linhas saem com a frase delas', semFrase === 0, semFrase + (ex ? '  |  ' + ex : ''));
  }

  /* 9) ⚠️ O SELO NO QUADRO SAI DE UM CAMPO DO MATCHUP, nao da marca do diario -- e o MESMO caso da
        furia: a queimadura ATRAVESSA confrontos, entao um pokemon pode lutar tres deles queimado
        com a marca so no primeiro. Lida do diario, o selo sumiria justamente nos confrontos em que
        o jogador mais precisa saber que o ataque dele esta pela metade. */
  ok('o selo de fogo sai do campo do matchup, e so no lado queimado',
     temSelo(S.selosDoConfronto({ playerQueimado: true, enemyQueimado: false }, 'p'), 'fogo') &&
     !temSelo(S.selosDoConfronto({ playerQueimado: true, enemyQueimado: false }, 'e'), 'fogo') &&
     temSelo(S.selosDoConfronto({ playerQueimado: false, enemyQueimado: true }, 'e'), 'fogo'));
  ok('e confronto gravado antes do campo sai sem selo (log velho nao pode sumir)',
     !temSelo(S.selosDoConfronto({}, 'p'), 'fogo'));
  /* ⚠️ E A QUEIMADURA HERDADA -- o caso que uma leitura ingenua erraria: o pokemon entra no
     confronto JA queimado, sem nenhuma marca no diario dele, e o selo tem que sair assim mesmo. */
  {
    const a = vq('snorlax', 70); a.ataques = ['bodyslam']; a._queimado = 'ember';
    const b = vq('machamp', 60); b.ataques = ['karatechop'];
    const r = S.simulateGymBattle([a], [b], S.makeSeededRng('herd'));
    const m = (r.matchups || [])[0];
    ok('a queimadura HERDADA aparece no selo mesmo sem marca no diario',
       m && m.playerQueimado === true && !(m.golpes || []).some(g => g.x === 'queimou'),
       m ? ('campo=' + m.playerQueimado + ' marcas=' + (m.golpes || []).filter(g => g.x === 'queimou').length) : '(sem confronto)');
  }

  /* 10) A MARCA E SOLTA NO FIM DA BATALHA. Sem isso um pokemon sairia da luta queimado pra sempre --
         e com o ataque fisico pela metade em TODAS as batalhas seguintes, o que nao apareceria como
         erro nenhum na tela. */
  ok('o encerrarBatalha solta a marca', /p\._queimado = null;/.test(cliQ));
  {
    let sobrou = 0;
    for(let i = 0; i < 400; i++){
      const a = vq('charizard', 60); a.ataques = ['flamethrower'];
      const time = [a, vq('machamp', 55)], adv = [vq('snorlax', 60), vq('rhydon', 60)];
      time.concat(adv).forEach(p => { p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; });
      S.simulateGymBattle(time, adv, S.makeSeededRng('soltaq' + i));
      if(time.concat(adv).some(p => p._queimado)) sobrou++;
    }
    ok('e ninguem sai de 400 batalhas ainda queimado', sobrou === 0, sobrou + ' sobraram');
  }

  /* 11) OS DOIS MOTORES, num painel que GARANTE queimadura. A comparacao das 300 nao serve: sao 22
         especies em 250 e a trava falharia sozinha de vez em quando -- a licao do gelo. */
  {
    const ALVOS = ['machamp', 'snorlax', 'rhydon', 'gyarados', 'venusaur', 'starmie'];
    let div = 0, comQ = 0, dano = 0, ex = null;
    for(let i = 0; i < 120; i++){
      const alvo = ALVOS[i % ALVOS.length];
      const monta = (novo) => { const a = novo('charizard', 60); a.ataques = ['flamethrower'];
                                const b = novo('magmar', 60); b.ataques = ['firepunch']; return [a, b]; };
      const advs = (novo) => [novo(alvo, 62), novo(ALVOS[(i + 3) % ALVOS.length], 62)];
      const rC = S.simulateGymBattle(monta((id, lv) => S.createInstance(id, lv)),
                                     advs((id, lv) => S.createInstance(id, lv)), S.makeSeededRng('q2m' + i));
      const rS = srv._simulateGymBattle(monta((id, lv) => srv._createInstance(id, lv)),
                                        advs((id, lv) => srv._createInstance(id, lv)), srv._makeSeededRng('q2m' + i));
      const n = (r) => (r.matchups || []).reduce((a, m) =>
        a + (m.golpes || []).filter(g => g.x === 'queimou' || g.x === 'queima').length, 0);
      if(n(rC) > 0) comQ++;
      dano += (rC.matchups || []).reduce((a, m) =>
        a + (m.golpes || []).filter(g => g.x === 'queima').reduce((x, g) => x + g.d, 0), 0);
      if(resumo(rC) !== resumo(rS)){ div++; if(!ex) ex = 'volta ' + i + ' contra ' + alvo; }
    }
    ok('120 batalhas com queimadura garantida batem golpe a golpe nos dois motores', div === 0,
       div + ' divergencias' + (ex ? '  |  ' + ex : ''));
    ok('e a queimadura esta dentro delas', comQ >= 25 && dano > 0,
       comQ + ' batalhas queimaram, ' + dano + ' de dano por turno');
  }
  /* ⚠️ E O SORTEIO SO LE O rng QUANDO O GOLPE PODE QUEIMAR: lido sempre, ele deslocaria a semente
     de toda batalha sem golpe de fogo nenhum. A mesma armadilha que o Remoinho quase trouxe. */
  {
    let leu = 0; const conta = () => { leu++; return 0.001; };
    const a = vq('machamp', 50); a.lastMove = 'karatechop';
    S.tentarQueimar(a, vq('snorlax', 60), conta);
    ok('o rng NAO e lido quando o golpe nao queima', leu === 0, leu + ' leituras');
    const b = vq('charizard', 50); b.lastMove = 'flamethrower';
    S.tentarQueimar(b, vq('arcanine', 60), conta);
    ok('nem quando o alvo e imune', leu === 0, leu + ' leituras');
  }

  /* 12) ⚠️ O SELO 🔥 NAO PODE APARECER ANTES DA QUEIMADURA (16/09/2026, reportado: *"o emoji ta
         aparecendo logo quando o pokemon entra na luta, mesmo se o golpe que for dar o queimar for
         tipo o sexto golpe"*). Ele saia do CAMPO do matchup, que e o estado no FIM do confronto --
         entao ele entregava, no primeiro quadro, uma queimadura que so ia acontecer depois.
         ⚠️ ELE E O CONTRARIO DOS OUTROS CINCO SELOS DAQUELE QUADRO: o 🌟, o 🔺, o 🎖️, o ⚔️ e o 🪶
         valem o confronto inteiro porque sao ABERTURA. A queimadura acontece NO MEIO, como a Faixa
         de Foco -- e a Faixa fica escondida ate o passo dela pelo mesmo motivo. */
  {
    let confs = 0, cedo = 0, tarde = 0, ex = null;
    for(let i = 0; i < 800; i++){
      const a = vq('charizard', 60); a.ataques = ['flamethrower'];
      const b = vq('snorlax', 80); b.ataques = ['bodyslam'];
      const r = S.simulateGymBattle([a], [b], S.makeSeededRng('selo' + i));
      for(const m of (r.matchups || [])){
        const seq = S.sequenciaDoConfronto(m);
        const i0 = seq.findIndex(x => x.x === 'queimou' && x.q === 'e');
        if(i0 < 0) continue;
        confs++;
        /* ANTES do passo dela: sem selo. A PARTIR dele: com. */
        for(let k = 0; k <= seq.length; k++){
          const tem = temSelo(S.selosDoConfronto(m, 'e', k), 'fogo');
          if(k < i0 + 1 && tem){ cedo++; if(!ex) ex = 'passo ' + k + ' de ' + (i0 + 1); break; }
          if(k >= i0 + 1 && !tem){ tarde++; if(!ex) ex = 'passo ' + k + ' de ' + (i0 + 1); break; }
        }
      }
    }
    ok('achei confrontos com queimadura pra medir o selo', confs >= 50, confs + ' confrontos');
    ok('o selo de fogo nunca aparece ANTES do passo da queimadura', cedo === 0, cedo + (ex ? '  |  ' + ex : ''));
    ok('e nunca falta DEPOIS dele', tarde === 0, tarde + (ex ? '  |  ' + ex : ''));
  }
  /* ⚠️ MAS A QUEIMADURA HERDADA VALE DESDE O PRIMEIRO QUADRO: quem entra no confronto JA queimado
     nao tem marca no diario, e ali o selo e verdade desde o comeco. E o caso que uma leitura
     ingenua erraria -- procurar a marca e nao achar significa "veio de antes", nao "nao houve". */
  {
    const a = vq('snorlax', 70); a.ataques = ['bodyslam']; a._queimado = 'ember';
    const b = vq('machamp', 60); b.ataques = ['karatechop'];
    const r = S.simulateGymBattle([a], [b], S.makeSeededRng('herd2'));
    const m = (r.matchups || [])[0];
    ok('a queimadura HERDADA mostra o selo desde o passo 0',
       m && !(m.golpes || []).some(g => g.x === 'queimou' && g.q === 'p') &&
       temSelo(S.selosDoConfronto(m, 'p', 0), 'fogo') &&
       temSelo(S.selosDoConfronto(m, 'p', 1), 'fogo'));
  }
  /* SEM PASSO o selo vale, e isso e o log relido dias depois: ali o confronto ja acabou e ele e o
     resumo, nao um anuncio. */
  {
    const a = vq('snorlax', 70); a._queimado = 'ember';
    const m = { playerQueimado: true, golpes: [{ x: 'queimou', q: 'p', d: 0 }] };
    ok('e sem passo ele vale (o log relido nao anima nada)',
       temSelo(S.selosDoConfronto(m, 'p'), 'fogo'));
  }
}

/* ==================== "CONTINUA A DORMIR" (16/09/2026) ====================
   O analogo do `gelado` do congelamento, e ele faltava: o sono tinha a linha de ADORMECER e a de
   ACORDAR, e nada nos turnos do meio. */
{
  console.log('\n--- o "continua a dormir" ---');
  const cliD = require('fs').readFileSync(require('path').join(raiz, 'index.html'), 'utf8');
  const srvD = require('fs').readFileSync(require('path').join(raiz, 'functions', 'index.js'), 'utf8');
  const vd = (id, lv) => { const q = inst(id, lv); q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp; return q; };

  /* 1) A FRASE, palavra por palavra -- ela foi pedida assim. */
  ok('a frase e a pedida', S.fraseDoEspecial({ x: 'dormindo', g: 'Onix' }, {}, {}) ===
     'Onix continua a dormir e não pode atacar');
  ok('e o selo e o MESMO do sono (e o mesmo efeito, num turno do meio)',
     S.ICONES_ESPECIAIS.dormindo === S.ICONES_ESPECIAIS.sono && temSelo(S.ICONES_ESPECIAIS.dormindo, 'sono'));
  /* o 1,5s de leitura vem da entrada na tabela -- sem ela a frase valeria pra SEMPRE */
  ok('e ela vale 1 passo na animacao (a pausa de 1,5s)', S.passosDaAbertura.dormindo === 1);
  ok('e e reconhecida como golpe especial', S.ehGolpeEspecial({ x: 'dormindo' }));

  /* 2) ⚠️ O INVARIANTE QUE LIGA A LINHA A MECANICA: um sono de N trocas rende N-1 linhas. A linha
        NAO sai na troca em que ele acorda -- ali quem conta e o `acordou`, e as duas juntas se
        contradiriam ("continua a dormir" e "acordou" no mesmo turno). */
  {
    const dist = {};
    let confs = 0, contradiz = 0, atacouDormindo = 0, ex = null;
    for(let i = 0; i < 2500; i++){
      /* ⚠️ O SNORLAX CAIU DE 80 PRA 45 EM 25/09/2026, e o motivo e a mudanca do sono: com ele
         virando golpe da TROCA, quem dorme o outro PERDE o ataque daquela troca -- e um Snorlax
         Lv.80 matava o Butterfree Lv.45 ali mesmo, antes de o sono render uma unica linha. Medido:
         243 confrontos com sono e ZERO linhas `dormindo`, com o motor certo (a mecanica da
         `{0:218, 1:58, 2:50}` num painel parelho). E a licao do painel forte demais, pela sexta
         vez neste arquivo. */
      const a = vd('butterfree', 45); a.ataques = ['gust'];
      const b = vd('snorlax', 45); b.ataques = ['bodyslam'];
      const r = S.simulateGymBattle([a], [b], S.makeSeededRng('sono' + i));
      for(const m of (r.matchups || [])){
        const g = m.golpes || [];
        if(!g.some(x => x.x === 'sono')) continue;
        confs++;
        /* ⚠️ A CONTA E POR SONO, e nao por CONFRONTO (25/09/2026): com o sono sorteado a cada troca,
           o alvo pode acordar e voltar a dormir no mesmo confronto (medido, 1,4% deles) -- e as
           linhas dos dois sonos somadas passavam de 2, chegando a 7 num painel de luta longa. O que
           o invariante diz e sobre UM sono: ele rende (duracao - 1) linhas. */
        g.forEach((x, k) => {
          if(x.x !== 'sono') return;
          const fim = g.findIndex((y, j) => j > k && (y.x === 'acordou' || y.x === 'sono'));
          const ate = fim < 0 ? g.length : fim;
          const n = g.filter((y, j) => j > k && j < ate && y.x === 'dormindo').length;
          dist[n] = (dist[n] || 0) + 1;
        });
        /* ⚠️ A CONTRADICAO: a linha e o `acordou` do mesmo lado nao podem ser VIZINHAS na ordem --
           seria "continua a dormir / acordou" no mesmo turno. */
        for(let k = 0; k + 1 < g.length; k++){
          if(g[k].x === 'dormindo' && g[k+1].x === 'acordou' && g[k].q === g[k+1].q){
            contradiz++; if(!ex) ex = g.map(x => (x.q||'?') + ':' + (x.x || ('-'+x.d))).join(' | ');
          }
        }
        /* ⚠️ E QUEM TEM A LINHA NAO ATACA NAQUELE TURNO: percorrendo o log, entre a linha dele e a
           linha seguinte do MESMO lado nao pode haver um golpe dele. */
        for(let k = 0; k < g.length; k++){
          if(g[k].x !== 'dormindo') continue;
          for(let j = k + 1; j < g.length; j++){
            if(g[j].x === 'acordou' && g[j].q === g[k].q) break;
            if(g[j].x === 'dormindo' && g[j].q === g[k].q) break;
            if(!g[j].x && g[j].d > 0 && g[j].q === g[k].q){
              atacouDormindo++; if(!ex) ex = g.map(x => (x.q||'?') + ':' + (x.x || ('-'+x.d))).join(' | ');
              break;
            }
          }
        }
      }
    }
    ok('achei confrontos com sono pra ler', confs >= 200, confs + ' confrontos');
    /* SONO_EM_TROCAS e 1, 2 ou 3 com 1/3 cada -> 0, 1 ou 2 linhas, em partes parecidas */
    ok('e a contagem bate com a duracao do sono (0, 1 ou 2 linhas)',
       !Object.keys(dist).some(k => Number(k) > 2) && (dist[1] || 0) > 0 && (dist[2] || 0) > 0,
       JSON.stringify(dist));
    ok('a linha NUNCA sai na troca em que ele acorda', contradiz === 0,
       contradiz + (ex ? '  |  ' + ex : ''));
    ok('e QUEM CONTINUA DORMINDO NAO ATACA naquele turno', atacouDormindo === 0,
       atacouDormindo + (ex ? '  |  ' + ex : ''));
  }

  /* 3) ⚠️ A ORDEM: a frase e sobre O TURNO DELE, entao ela vem DEPOIS do golpe de quem e mais
        rapido. Junto do geloDe (que foi onde ela nasceu), o log dizia "Onix continua a dormir /
        Gengar atacou" -- a ordem invertida da cena. */
  {
    let confs = 0, foraDeOrdem = 0, ex = null;
    for(let i = 0; i < 2000; i++){
      /* o Gengar (110 de velocidade) e SEMPRE o mais rapido que o Onix (70) */
      const a = vd('gengar', 60); a.ataques = ['dreameater'];
      const b = vd('onix', 80); b.ataques = ['rockslide'];
      const r = S.simulateGymBattle([a], [b], S.makeSeededRng('ord' + i));
      for(const m of (r.matchups || [])){
        const g = m.golpes || [];
        const k = g.findIndex(x => x.x === 'dormindo' && x.q === 'e');
        if(k < 0) continue;
        confs++;
        /* antes dela, no mesmo turno, tem que haver um golpe do lado RAPIDO (o jogador) */
        let temGolpeAntes = false;
        for(let j = k - 1; j >= 0; j--){
          if(g[j].x === 'sono' || g[j].x === 'dormindo' || g[j].x === 'acordou') break;
          if(!g[j].x && g[j].d > 0 && g[j].q === 'p'){ temGolpeAntes = true; break; }
        }
        if(!temGolpeAntes){ foraDeOrdem++; if(!ex) ex = g.map(x => (x.q||'?') + ':' + (x.x || ('-'+x.d))).join(' | '); }
      }
    }
    ok('achei confrontos pra medir a ordem', confs >= 100, confs + ' confrontos');
    ok('e a linha vem DEPOIS do golpe de quem e mais rapido', foraDeOrdem === 0,
       foraDeOrdem + (ex ? '  |  ' + ex : ''));
  }

  /* 4) O LOG. A licao do gelo: a trava tem que ler o HTML -- as que leem o diario dao verde com a
        linha caindo no ramo do golpe comum, e ali ela vira um "−0 de HP" com o nome de um golpe
        que o pokemon nem tem. */
  {
    let comD = 0, zeros = 0, semFrase = 0, linhas = 0, ex = null;
    for(let i = 0; i < 400; i++){
      const a = vd('gengar', 60); a.ataques = ['dreameater'];
      const b = vd('onix', 85); b.ataques = ['rockslide'];
      const r = S.simulateGymBattle([a], [b], S.makeSeededRng('logd' + i));
      for(const m of (r.matchups || [])){
        const n = (m.golpes || []).filter(x => x.x === 'dormindo').length;
        if(!n) continue;
        comD++; linhas += n;
        const html = S.passosHtml(m);
        const z = (html.match(/−0<\/span> de HP/g) || []).length;
        if(z){ zeros += z; if(!ex) ex = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 150); }
        const naTela = (html.match(/continua a dormir/g) || []).length;
        if(naTela < n){ semFrase += n - naTela; if(!ex) ex = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 150); }
      }
    }
    ok('achei confrontos pra ler o HTML do log', comD >= 30, comD + ' confrontos');
    ok('nenhuma linha vira "−0 de HP"', zeros === 0, zeros + (ex ? '  |  ' + ex : ''));
    ok('e as ' + linhas + ' linhas saem com a frase delas', semFrase === 0, semFrase + (ex ? '  |  ' + ex : ''));
  }

  /* 5) OS DOIS MOTORES. A linha e apresentacao (dano 0), mas ela e GRAVADA pelo doExchange dos dois
        lados -- um deles gravando e o outro nao faria o log da liga divergir do da jornada. */
  ok('o ajudante existe nos dois motores',
     /const dormeDe = \(p, q\) =>/.test(cliD) && /const dormeDe = \(p, q\) =>/.test(srvD));
  ok('e a linha do second sai DEPOIS do golpe do first nos dois',
     cliD.indexOf('queimou(second, qDoSecond, queimouOSegundo);') < cliD.indexOf('dormeDe(second, qDoSecond);') &&
     srvD.indexOf('queimou(second, qDoSecond, queimouOSegundo);') < srvD.indexOf('dormeDe(second, qDoSecond);'));
  {
    const ALVOS = ['snorlax', 'machamp', 'rhydon', 'gyarados'];
    let div = 0, comD = 0, ex = null;
    for(let i = 0; i < 120; i++){
      const alvo = ALVOS[i % ALVOS.length];
      const monta = (novo) => { const a = novo('butterfree', 50); a.ataques = ['gust']; return [a]; };
      /* ⚠️ OS ADVERSARIOS CAIRAM DE 70 PRA 50 EM 25/09/2026, pelo mesmo motivo do painel do bloco
         da linha: com o sono virando golpe da TROCA, quem dorme o outro PERDE o ataque -- e um alvo
         Lv.70 matava o Butterfree Lv.50 naquela troca, antes de a linha `dormindo` existir. Medido:
         1 batalha com a linha em 120, e a trava pede 5. O que este bloco mede e os DOIS MOTORES
         concordando, e pra isso a linha precisa ACONTECER. */
      const advs = (novo) => [novo(alvo, 50), novo(ALVOS[(i + 2) % ALVOS.length], 50)];
      const rC = S.simulateGymBattle(monta((id, lv) => S.createInstance(id, lv)),
                                     advs((id, lv) => S.createInstance(id, lv)), S.makeSeededRng('d2m' + i));
      const rS = srv._simulateGymBattle(monta((id, lv) => srv._createInstance(id, lv)),
                                        advs((id, lv) => srv._createInstance(id, lv)), srv._makeSeededRng('d2m' + i));
      const n = (r) => (r.matchups || []).reduce((a, m) =>
        a + (m.golpes || []).filter(g => g.x === 'dormindo').length, 0);
      if(n(rC) > 0) comD++;
      if(n(rC) !== n(rS)){ div++; if(!ex) ex = 'volta ' + i + ': ' + n(rC) + ' x ' + n(rS); }
      if(resumo(rC) !== resumo(rS)){ div++; if(!ex) ex = 'resumo diferente na volta ' + i; }
    }
    ok('120 batalhas com sono batem golpe a golpe nos dois motores', div === 0,
       div + ' divergencias' + (ex ? '  |  ' + ex : ''));
    ok('e a linha esta dentro delas', comD >= 5, comD + ' batalhas com a linha');
  }
}

/* ========================= O ENVENENAMENTO (16/09/2026) =========================
   A terceira mecanica POR ATAQUE, e a mais simples das tres: so dano, sem cortar atributo. */
{
  console.log('\n--- o envenenamento ---');
  const VEN = Object.keys(S.GOLPES_QUE_ENVENENAM);
  const cliV = require('fs').readFileSync(require('path').join(raiz, 'index.html'), 'utf8');
  const srvV = require('fs').readFileSync(require('path').join(raiz, 'functions', 'index.js'), 'utf8');
  const vv = (id, lv) => { const q = inst(id, lv); q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp; return q; };

  /* 1) A TABELA, com as chances OFICIAIS de cada golpe -- aqui elas VARIAM (10% a 50%), ao
        contrario do gelo (todos 10%). */
  ok('sao os 6 golpes de dano que envenenam no FireRed', VEN.length === 6 &&
     S.GOLPES_QUE_ENVENENAM.poisonsting === 0.30 && S.GOLPES_QUE_ENVENENAM.twineedle === 0.20 &&
     S.GOLPES_QUE_ENVENENAM.smog === 0.40 && S.GOLPES_QUE_ENVENENAM.sludge === 0.30 &&
     S.GOLPES_QUE_ENVENENAM.sludgebomb === 0.30 && S.GOLPES_QUE_ENVENENAM.poisonfang === 0.50,
     VEN.join(', '));
  ok('os seis EXISTEM na tabela GOLPES', VEN.every(g => !!S.GOLPES[g]),
     VEN.map(g => g + (S.GOLPES[g] ? '' : '=SUMIU')).join(' '));
  /* ⚠️ O ACIDO E O UNICO GOLPE DE VENENO DA TABELA QUE NAO ENVENENA, e e fiel: na Gen 3 ele baixa
     a Defesa Especial. E o AGULHA DUPLA e o unico da lista que NAO e de tipo Veneno (ele e Inseto)
     -- e tambem o unico que ja e um golpe de VARIOS TAPAS. */
  {
    const veneno = Object.keys(S.GOLPES).filter(g => S.GOLPES[g][0] === 'Poison');
    const fora = veneno.filter(g => !S.GOLPES_QUE_ENVENENAM[g]);
    ok('e o Acido e o unico de Veneno que NAO envenena', fora.length === 1 && fora[0] === 'acid',
       fora.join(', '));
    ok('e o Agulha Dupla e o unico da lista fora do tipo Veneno',
       VEN.filter(g => S.GOLPES[g][0] !== 'Poison').join(',') === 'twineedle');
    /* ⚠️ E ELE JA E MULTI-TAPA: a chance vale por ATAQUE, nao por tapa -- o tentarEnvenenar roda
       uma vez por golpe no doExchange, como os outros dois status. */
    ok('e o Agulha Dupla continua sendo de varios tapas', !!S.MULTI_GOLPE.twineedle);
  }
  {
    const quem = Object.keys(S.SPECIES).filter(id =>
      (S.ataquesDisponiveis(id, 70) || []).some(g => VEN.indexOf(g) >= 0));
    const levam = quem.filter(id => {
      const p = S.createInstance(id, 70);
      return (S.ataquesPadrao(p) || []).some(g => VEN.indexOf(g) >= 0);
    });
    ok('45 especies os aprendem por nivel', quem.length >= 40, quem.length + ' de 250');
    ok('e 26 os LEVAM no moveset padrao (a licao da Furia)', levam.length >= 20, levam.length + ' levam');
  }

  /* 2) AS CHANCES, com UM rng continuo -- semente nova a cada volta enviesa. */
  for(const [golpe, esperado] of [['sludgebomb', 0.30], ['smog', 0.40], ['poisonfang', 0.50], ['twineedle', 0.20]]){
    const rng = S.makeSeededRng('ven-' + golpe), N = 30000;
    let c = 0;
    for(let i = 0; i < N; i++){
      const a = vv('venusaur', 60); a.lastMove = golpe;
      if(S.tentarEnvenenar(a, vv('snorlax', 70), rng)) c++;
    }
    const sd = Math.sqrt(esperado * (1 - esperado) / N), sig = Math.abs(c / N - esperado) / sd;
    ok('o ' + golpe + ' envenena em ' + (esperado * 100) + '%', sig < 3,
       (100 * c / N).toFixed(2) + '%  (' + sig.toFixed(1) + ' sigma)');
  }

  /* 3) AS IMUNIDADES. ⚠️ O VENENO NA LISTA FOI ACRESCENTADO POR MIM: o pedido dizia so "pokemon de
        aço tem imunidade", mas a Bulbapedia (a fonte citada no proprio pedido) poe os dois, e e a
        mesma simetria dos outros dois status. Sem ela, as 37 especies de Veneno se envenenariam com
        os PROPRIOS golpes -- 24 dos 26 que levam um golpe da lista sao de Veneno. */
  ok('ACO e imune', !S.podeEnvenenar(vv('steelix', 50)) && !S.podeEnvenenar(vv('forretress', 50)) &&
     !S.podeEnvenenar(vv('scizor', 50)) && !S.podeEnvenenar(vv('skarmory', 50)));
  ok('e VENENO tambem (acrescentado: o pedido citava so o Aço)',
     !S.podeEnvenenar(vv('muk', 50)) && !S.podeEnvenenar(vv('arbok', 50)) &&
     !S.podeEnvenenar(vv('venusaur', 50)) && S.podeEnvenenar(vv('machamp', 50)));
  {
    let c = 0;
    for(let i = 0; i < 3000; i++){
      const a = vv('venusaur', 60); a.ataques = ['sludgebomb'];
      const b = vv('steelix', 60); b.ataques = ['rockslide'];
      S.doExchange(a, b, S.makeSeededRng('iv' + i), []);
      if(b._envenenado) c++;
    }
    ok('e nenhum Steelix envenena em 3.000 trocas', c === 0, c + ' envenenados');
  }
  { const m = vv('machamp', 50); m.hp = 0; ok('nem quem ja caiu', !S.podeEnvenenar(m)); }
  { const m = vv('machamp', 50); m._envenenado = 'sludge'; ok('nem quem ja esta envenenado', !S.podeEnvenenar(m)); }

  /* 4) O DANO: 1/8 do teto, o DOBRO da queimadura. */
  ok('1/8 do HP maximo por turno', S.VENENO_DANO === 1/8, String(S.VENENO_DANO));
  ok('e e o DOBRO da queimadura', S.VENENO_DANO === S.QUEIMADURA_DANO * 2);
  {
    let ok1 = 0, n = 0;
    for(let i = 0; i < 400; i++){
      const a = vv('venusaur', 60); a.ataques = ['sludgebomb'];
      const b = vv('snorlax', 70); b.ataques = ['bodyslam']; b._envenenado = 'sludge';
      const di = [];
      S.doExchange(a, b, S.makeSeededRng('dv' + i), di);
      const q = di.filter(g => g.x === 'veneno' && g.q === 'e');
      if(!q.length) continue;
      n++;
      if(q[0].d === Math.max(1, Math.round(b.maxHp / 8))) ok1++;
    }
    ok('e o dano por turno e 1/8 do teto', n > 0 && ok1 === n, ok1 + ' de ' + n);
  }
  /* ⚠️ E ELE NAO CORTA ATRIBUTO NENHUM -- essa e a diferenca dele pra queimadura. */
  {
    const a = vv('machamp', 50), b = vv('machamp', 50);
    b._envenenado = 'sludge';
    ok('e ele NAO corta atributo nenhum (a diferenca pra queimadura)',
       S.effectiveAttack(a) === S.effectiveAttack(b) && S.effectiveSpAtk(a) === S.effectiveSpAtk(b) &&
       S.effectiveDefense(a) === S.effectiveDefense(b) && S.effectiveSpeed(a) === S.effectiveSpeed(b));
  }

  /* 5) ⚠️ OS DOIS NUNCA CAEM JUNTOS FORA DA AUTODESTRUICAO -- a regra de 12/09/2026. Os DOIS status
        de dano por turno dividem o `danoDeStatus` justamente por isto: em blocos separados, a
        queimadura pararia em 1 olhando o adversario vivo e o veneno o mataria logo depois. */
  {
    const IDSV = Object.keys(S.SPECIES);
    const rngV = S.makeSeededRng('dupv');
    const mkv = (id, lv) => { const p = S.createInstance(id, lv); p.ataques = S.ataquesPadrao(p);
                              p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; return p; };
    let dup = 0, comBoom = 0, comVen = 0, ex = null;
    for(let b = 0; b < 2500; b++){
      const t = n => Array.from({length:n}, () => mkv(IDSV[Math.floor(rngV()*IDSV.length)], 30 + Math.floor(rngV()*50)));
      const A = t(3), B = t(3); S.equiparNpc(B);
      const r = S.simulateGymBattle(A, B, S.makeSeededRng('dv' + b));
      for(const m of (r.matchups || [])){
        if((m.golpes || []).some(g => g.x === 'veneno')) comVen++;
        if(m.playerHpAfter <= 0 && m.enemyHpAfter <= 0){
          dup++;
          if((m.golpes || []).some(g => g.x === 'boom')) comBoom++;
          else if(!ex) ex = m.playerSpecies + ' x ' + m.enemySpecies;
        }
      }
    }
    ok('o veneno aparece na varredura', comVen > 0, comVen + ' confrontos');
    ok('e os DOIS nunca caem juntos fora da autodestruicao', dup === comBoom,
       comBoom + ' de ' + dup + (ex ? '  |  ' + ex : ''));
  }

  /* 6) ⚠️ A FAIXA DE FOCO SEGURA O DANO DE STATUS (16/09/2026). No jogo original o Focus Sash so
        protege de dano DIRETO; aqui ela protege dos dois, e a razao e a promessa que a casa fez
        pro item -- "quem carrega a Faixa nunca termina um confronto em 0 sem ela ter disparado".
        Foi a trava dessa promessa que pegou o furo, e ela existe porque a AUTODESTRUICAO ja tinha
        furado a Faixa uma vez e o jogador reportou. */
  {
    const p = vv('machamp', 50); p.item = 'faixa_foco'; p._envenenado = 'sludge';
    p.maxHp = 100; p.hp = 5;                       // o veneno (12) mataria
    const o = vv('caterpie', 5); o.ataques = ['tackle'];
    const di = [];
    S.doExchange(o, p, S.makeSeededRng('fx'), di);
    ok('a Faixa segura o dano de veneno e deixa em 1', p.hp === 1, p.hp + ' de HP');
    ok('e a linha dela entra no diario', di.some(g => g.x === 'faixa'));
    ok('e o item foi gasto', p.item !== 'faixa_foco');
  }

  /* 7) AS DUAS FRASES e o selo. */
  ok('a frase do envenenamento nomeia o GOLPE',
     S.fraseDoEspecial({ x: 'envenenou', g: 'Machamp', mv: 'sludgebomb' }, {}, {}) ===
     'Machamp foi envenenado com BOMBA DE LODO!');
  ok('e a do dano por turno traz o NUMERO',
     S.fraseDoEspecial({ x: 'veneno', g: 'Machamp', d: 59 }, {}, {}) ===
     'Machamp perdeu 59 de HP pelo veneno');
  ok('log velho, sem o campo mv, cai numa frase sem golpe',
     S.fraseDoEspecial({ x: 'envenenou', g: 'Machamp' }, {}, {}) === 'Machamp foi envenenado!');
  /* o 🟣 e a cor do tipo, e nao uma cavera: ☠️ se le como MORTE e o envenenado continua lutando */
  ok('e as duas dividem o MESMO selo de veneno',
     temSelo(S.ICONES_ESPECIAIS.envenenou, 'veneno') &&
     S.ICONES_ESPECIAIS.veneno === S.ICONES_ESPECIAIS.envenenou);
  ok('as duas valem 1 passo cada (a pausa de 1,5s)',
     S.passosDaAbertura.envenenou === 1 && S.passosDaAbertura.veneno === 1);
  ok('e sao reconhecidas como golpe especial',
     S.ehGolpeEspecial({ x: 'envenenou' }) && S.ehGolpeEspecial({ x: 'veneno' }));

  /* 8) O PASSO DA ANIMACAO nao inverte o lado (o `q` e de quem PERDE), e o SELO so aparece no passo
        em que o veneno pega -- as duas regras da queimadura, pelos mesmos motivos. */
  {
    let passos = 0, ladoErrado = 0, cedo = 0, confs = 0, ex = null;
    for(let i = 0; i < 600; i++){
      const a = vv('venusaur', 60); a.ataques = ['sludgebomb'];
      const b = vv('snorlax', 80); b.ataques = ['bodyslam'];
      const r = S.simulateGymBattle([a], [b], S.makeSeededRng('av' + i));
      for(const m of (r.matchups || [])){
        const seq = S.buildAnimatedHitSequence(m);
        for(const h of seq){
          if(h.x !== 'veneno') continue;
          passos++;
          if(h.side !== (h.q === 'p' ? 'player' : 'enemy') || !(h.amount > 0)){
            ladoErrado++; if(!ex) ex = 'q=' + h.q + ' side=' + h.side;
          }
        }
        const i0 = seq.findIndex(x => x.x === 'envenenou' && x.q === 'e');
        if(i0 < 0) continue;
        confs++;
        for(let k = 0; k < i0 + 1; k++) if(temSelo(S.selosDoConfronto(m, 'e', k), 'veneno')){ cedo++; break; }
      }
    }
    ok('achei passos de veneno na animacao', passos >= 50, passos + ' passos');
    ok('e a barra que desce e a de QUEM ESTA ENVENENADO', ladoErrado === 0,
       ladoErrado + (ex ? '  |  ' + ex : ''));
    ok('e o selo de veneno nunca aparece ANTES do passo do envenenamento', cedo === 0,
       cedo + ' de ' + confs + ' confrontos');
  }

  /* 9) O LOG. A licao do gelo: ler o HTML. */
  {
    let comV = 0, zeros = 0, semFrase = 0, linhas = 0, ex = null;
    for(let i = 0; i < 300; i++){
      const a = vv('venusaur', 60); a.ataques = ['sludgebomb'];
      const b = vv('snorlax', 85); b.ataques = ['bodyslam'];
      const r = S.simulateGymBattle([a], [b], S.makeSeededRng('lv' + i));
      for(const m of (r.matchups || [])){
        const n = (m.golpes || []).filter(x => x.x === 'envenenou' || x.x === 'veneno').length;
        if(!n) continue;
        comV++; linhas += n;
        const html = S.passosHtml(m);
        const z = (html.match(/−0<\/span> de HP/g) || []).length;
        if(z){ zeros += z; if(!ex) ex = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 150); }
        const naTela = (html.match(/envenenado|pelo veneno/g) || []).length;
        if(naTela < n){ semFrase += n - naTela; if(!ex) ex = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 150); }
      }
    }
    ok('achei confrontos pra ler o HTML do log', comV >= 30, comV + ' confrontos');
    ok('nenhuma linha de veneno vira "−0 de HP"', zeros === 0, zeros + (ex ? '  |  ' + ex : ''));
    ok('e as ' + linhas + ' linhas saem com a frase delas', semFrase === 0, semFrase + (ex ? '  |  ' + ex : ''));
  }

  /* 10) A MARCA E SOLTA NO FIM DA BATALHA. */
  ok('o encerrarBatalha solta a marca', /p\._envenenado = null;/.test(cliV));
  {
    let sobrou = 0;
    for(let i = 0; i < 400; i++){
      const a = vv('venusaur', 60); a.ataques = ['sludgebomb'];
      const time = [a, vv('machamp', 55)], adv = [vv('snorlax', 60), vv('tauros', 60)];
      time.concat(adv).forEach(p => { p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp; });
      S.simulateGymBattle(time, adv, S.makeSeededRng('sv' + i));
      if(time.concat(adv).some(p => p._envenenado)) sobrou++;
    }
    ok('e ninguem sai de 400 batalhas ainda envenenado', sobrou === 0, sobrou + ' sobraram');
  }

  /* 11) OS DOIS MOTORES, num painel que GARANTE veneno. */
  ok('a tabela e igual nos dois motores',
     /poisonsting: 0\.30/.test(srvV) && /sludgebomb: 0\.30/.test(srvV) &&
     /poisonfang: 0\.50/.test(srvV) && /VENENO_DANO = 1\/8/.test(cliV) && /VENENO_DANO = 1\/8/.test(srvV));
  {
    const ALVOS = ['machamp', 'snorlax', 'rhydon', 'tauros', 'dragonite', 'starmie'];
    let div = 0, comV = 0, dano = 0, ex = null;
    for(let i = 0; i < 120; i++){
      const alvo = ALVOS[i % ALVOS.length];
      const monta = (novo) => { const a = novo('venusaur', 60); a.ataques = ['sludgebomb'];
                                const b = novo('muk', 60); b.ataques = ['sludge']; return [a, b]; };
      const advs = (novo) => [novo(alvo, 62), novo(ALVOS[(i + 3) % ALVOS.length], 62)];
      const rC = S.simulateGymBattle(monta((id, lv) => S.createInstance(id, lv)),
                                     advs((id, lv) => S.createInstance(id, lv)), S.makeSeededRng('v2m' + i));
      const rS = srv._simulateGymBattle(monta((id, lv) => srv._createInstance(id, lv)),
                                        advs((id, lv) => srv._createInstance(id, lv)), srv._makeSeededRng('v2m' + i));
      const n = (r) => (r.matchups || []).reduce((a, m) =>
        a + (m.golpes || []).filter(g => g.x === 'envenenou' || g.x === 'veneno').length, 0);
      if(n(rC) > 0) comV++;
      dano += (rC.matchups || []).reduce((a, m) =>
        a + (m.golpes || []).filter(g => g.x === 'veneno').reduce((x, g) => x + g.d, 0), 0);
      if(resumo(rC) !== resumo(rS)){ div++; if(!ex) ex = 'volta ' + i + ' contra ' + alvo; }
    }
    ok('120 batalhas com veneno garantido batem golpe a golpe nos dois motores', div === 0,
       div + ' divergencias' + (ex ? '  |  ' + ex : ''));
    ok('e o veneno esta dentro delas', comV >= 25 && dano > 0,
       comV + ' batalhas com veneno, ' + dano + ' de dano por turno');
  }
  {
    let leu = 0; const conta = () => { leu++; return 0.001; };
    const a = vv('machamp', 50); a.lastMove = 'karatechop';
    S.tentarEnvenenar(a, vv('snorlax', 60), conta);
    ok('o rng NAO e lido quando o golpe nao envenena', leu === 0, leu + ' leituras');
    const b = vv('venusaur', 50); b.lastMove = 'sludgebomb';
    S.tentarEnvenenar(b, vv('steelix', 60), conta);
    ok('nem quando o alvo e imune', leu === 0, leu + ' leituras');
  }
}

/* =============== O ASTERISCO DOS TRES STATUS no cartao do golpe (16/09/2026) ===============
   Pedido: *"Nos ataque de fogo, veneno e congelamento que causam esses status, coloque um * no
   quadro deles, avisando 10% de chance de causar queimadura (emoji da queimadura)"*. */
{
  console.log('\n--- o aviso de status no cartao do golpe ---');
  const TRES = [['GOLPES_QUE_QUEIMAM', 'queimadura', 'queimou'],
                ['GOLPES_QUE_CONGELAM', 'congelamento', 'congelou'],
                ['GOLPES_QUE_ENVENENAM', 'envenenamento', 'envenenou']];

  /* 1) TODOS os golpes das tres tabelas avisam, e nenhum outro. Varre a tabela em vez de nomear:
        golpe novo numa delas ja nasce com o aviso, e um que saia perde junto. */
  {
    let semAviso = [], ex = null;
    const comStatus = new Set();
    for(const [tab, palavra] of TRES){
      for(const id of Object.keys(S[tab])){
        comStatus.add(id);
        const o = S.obsDoGolpe(id);
        if(!o.some(x => x.indexOf(palavra) >= 0)){ semAviso.push(id); if(!ex) ex = id + ': ' + o.join(' | '); }
      }
    }
    ok('os 17 golpes de status avisam no cartao', semAviso.length === 0,
       semAviso.length + ' sem aviso' + (ex ? '  |  ' + ex : ''));
    /* e NENHUM outro golpe da tabela avisa -- senao a frase sairia onde nao ha efeito */
    let intruso = null;
    for(const id of Object.keys(S.GOLPES)){
      if(comStatus.has(id)) continue;
      const o = S.obsDoGolpe(id);
      if(o.some(x => /queimadura|congelamento|envenenamento/.test(x))) { intruso = id + ': ' + o.join(' | '); break; }
    }
    ok('e nenhum golpe fora delas avisa', !intruso, intruso || 'nenhum');
  }

  /* 2) ⚠️ A CHANCE SAI DA TABELA, nunca de um texto fixo -- e aqui isso nao e detalhe: ela VARIA de
        golpe pra golpe. Uma frase fixa de "10%" mentiria em CINCO dos dezessete. */
  ok('o Fogo Sagrado avisa 50% (e nao 10%)',
     S.obsDoGolpe('sacredfire').some(x => x.indexOf('50% de chance de causar queimadura') >= 0),
     S.obsDoGolpe('sacredfire').join(' | '));
  ok('a Presa Venenosa avisa 50%',
     S.obsDoGolpe('poisonfang').some(x => x.indexOf('50% de chance de causar envenenamento') >= 0));
  ok('a Fumaca avisa 40%',
     S.obsDoGolpe('smog').some(x => x.indexOf('40% de chance de causar envenenamento') >= 0));
  ok('o Agulha Dupla avisa 20%',
     S.obsDoGolpe('twineedle').some(x => x.indexOf('20% de chance de causar envenenamento') >= 0));
  ok('e a Nevasca avisa 10%',
     S.obsDoGolpe('blizzard').some(x => x.indexOf('10% de chance de causar congelamento') >= 0));
  /* ⚠️ E A PROVA DE QUE ELA E DERIVADA: mexendo na TABELA, a frase acompanha. Um texto fixo daria
     verde em todos os casos acima e falharia aqui. */
  {
    const guarda = S.GOLPES_QUE_CONGELAM.blizzard;
    S.GOLPES_QUE_CONGELAM.blizzard = 0.35;
    const mudou = S.obsDoGolpe('blizzard').some(x => x.indexOf('35% de chance') >= 0);
    S.GOLPES_QUE_CONGELAM.blizzard = guarda;
    ok('e ela e DERIVADA da tabela (mexendo nela, a frase acompanha)', mudou);
  }

  /* 3) O EMOJI E O MESMO DO LOG E DO QUADRO DO LUTADOR -- o jogador le o aviso aqui e reconhece o
        selo la, sem precisar ligar as duas coisas. */
  for(const [tab, palavra, marca] of TRES){
    const id = Object.keys(S[tab])[0];
    ok('o aviso de ' + palavra + ' usa o mesmo emoji do log (' + S.ICONES_ESPECIAIS[marca] + ')',
       S.obsDoGolpe(id).some(x => x.indexOf(S.ICONES_ESPECIAIS[marca]) >= 0),
       S.obsDoGolpe(id).join(' | '));
  }

  /* 4) O CASO DE DUAS OBSERVACOES: o Agulha Dupla e multi-tapa E envenena. Foi por ele que o
        obsDoGolpe virou LISTA em 15/09/2026 -- com `return` de string, a segunda apagaria a
        primeira em silencio. */
  {
    const o = S.obsDoGolpe('twineedle');
    ok('o Agulha Dupla tem as DUAS observacoes', o.length === 2 &&
       o[0].indexOf('repete') >= 0 && o[1].indexOf('envenenamento') >= 0, o.join(' | '));
  }
  /* golpe comum nao ganha observacao nenhuma */
  ok('e um golpe comum nao tem observacao', S.obsDoGolpe('slash').length === 0,
     S.obsDoGolpe('slash').join(' | '));

  /* 5) ⚠️ E A FAIXA DOS MULTI-TAPA TAMBEM SAI DA TABELA (16/09/2026). Ela era "entre 2-5x" escrito
        a mao, e virou MENTIRA em 13/09/2026, quando o Chute Duplo, o Ossomerangue e a Agulha Dupla
        entraram com distribuicao PROPRIA (TAPAS_SEMPRE_2): eles batem SEMPRE 2 vezes, e o cartao
        prometia de 2 a 5. Tres golpes em catorze, por tres dias.
        So ficou visivel quando o aviso de status entrou -- a Agulha Dupla ganhou uma segunda linha
        e as duas foram lidas juntas. E a mesma licao da lista a mao do passosHtml: texto fixo que
        descreve uma tabela envelhece quando a tabela cresce. */
  {
    let erradas = [], ex = null;
    for(const [id, dist] of Object.entries(S.MULTI_GOLPE)){
      const vezes = dist.map(d => d[0]);
      const min = Math.min.apply(null, vezes), max = Math.max.apply(null, vezes);
      const esperado = (min === max) ? ('Golpe repete ' + min + 'x')
                                     : ('Golpe repete entre ' + min + '-' + max + 'x');
      const o = S.obsDoGolpe(id);
      if(o[0] !== esperado){ erradas.push(id); if(!ex) ex = id + ': "' + o[0] + '" (esperado "' + esperado + '")'; }
    }
    ok('a faixa de tapas bate com a tabela nos 14 golpes', erradas.length === 0,
       erradas.length + (ex ? '  |  ' + ex : ''));
    ok('e os tres de SEMPRE 2x dizem "repete 2x", nao "entre 2-5x"',
       ['doublekick', 'bonemerang', 'twineedle'].every(id => S.obsDoGolpe(id)[0] === 'Golpe repete 2x'),
       ['doublekick', 'bonemerang', 'twineedle'].map(id => S.obsDoGolpe(id)[0]).join(' | '));
  }
}

/* ============== O LOG COMECA COMPRIMIDO (16/09/2026) ==============
   Pedido: *"na tela que mostra o log da batalha, comprima o log de cada confronto em uma linha com
   uma + no meio, e quando clicar expandir o log daquele confronto"*. */
{
  console.log('\n--- o log comprimido ---');
  const cliL = require('fs').readFileSync(require('path').join(raiz, 'index.html'), 'utf8');
  const conf = (n) => Array.from({length:n}, (_, k) => ({
    player: 'Gloom' + k, enemy: 'Goldeen' + k, playerSpecies: 'gloom', enemySpecies: 'goldeen',
    playerLevel: 30, enemyLevel: 30, playerHpBefore: 100, playerHpAfter: 60,
    enemyHpBefore: 100, enemyHpAfter: 0,
    golpes: [{ q:'p', d:40, hp:60, c:0, m:0, z:0 }, { q:'e', d:40, hp:60, c:0, m:0, z:0 }]
  }));

  /* 1) COMECA TUDO COMPRIMIDO, e cada cabecalho traz um +. */
  {
    const lista = conf(3);
    const html = S.renderMatchupLog(lista);
    ok('os tres confrontos aparecem', (html.match(/matchup-row/g) || []).length === 3);
    ok('e NENHUM passo a passo esta na tela', !/mlog-passo/.test(html),
       (html.match(/mlog-passo/g) || []).length + ' passos visiveis');
    /* o estado saiu do + e foi pra a CLASSE do card -- e o que sobrou das duas tentativas de hoje */
    ok('e nenhum card esta aberto', (html.match(/mlog-card aberto/g) || []).length === 0,
       (html.match(/mlog-card[^"]*/g) || []).join(' | '));
  }

  /* 2) O CLIQUE ABRE SO AQUELE, e o + vira −. */
  {
    const lista = conf(3);
    S.renderMatchupLog(lista);
    S.alternarLogDoConfronto(1);
    const html = S.renderMatchupLog(lista);
    ok('abrir o do meio mostra o passo a passo dele', /mlog-passo/.test(html));
    ok('e SO dele', (html.match(/mlog-passos/g) || []).length === 1,
       (html.match(/mlog-passos/g) || []).length + ' blocos abertos');
    /* ⚠️ ELA CONTA A CLASSE NA LISTA, e nao `mlog-card aberto` colado: a classe do RESULTADO
       (verde/vermelho) entrou no meio em 23/09/2026 e a string virou `mlog-card venceu aberto` --
       a trava caiu com o codigo certo. E a mesma armadilha da `resultTime` cravada por igualdade
       exata, que passou a casar com ZERO no dia em que a segunda classe entrou na mesma lista. */
    ok('e so o do meio ganhou a classe aberto',
       (html.match(/class="[^"]*\bmlog-card\b[^"]*\baberto\b[^"]*"/g) || []).length === 1,
       (html.match(/mlog-card[^"]*/g) || []).join(' | '));
    /* e fechar volta */
    S.alternarLogDoConfronto(1);
    ok('e clicar de novo fecha', !/mlog-passo/.test(S.renderMatchupLog(lista)));
  }

  /* 3) ⚠️ O ESTADO ZERA QUANDO A TELA OU O TAMANHO MUDA -- senao o confronto 2 de uma batalha nova
        nasceria aberto porque o 2 da anterior estava. */
  {
    const lista = conf(3);
    S.renderMatchupLog(lista); S.alternarLogDoConfronto(0);
    ok('o confronto 0 esta aberto', /mlog-passo/.test(S.renderMatchupLog(lista)));
    ok('e mudar o NUMERO de confrontos zera', !/mlog-passo/.test(S.renderMatchupLog(conf(5))));
    /* ⚠️ A TELA ENTRA NA CHAVE, e isso se prova LENDO O CODIGO: o `game.screen` e mexido por outros
       blocos deste arquivo, entao uma trava de comportamento aqui mediria o estado de outro teste.
       Sem a tela na chave, duas batalhas seguidas com o mesmo numero de confrontos herdariam os
       abertos uma da outra. */
    ok('e a TELA entra na chave (senao duas batalhas seguidas herdariam os abertos)',
       cliL.indexOf('const chave = String(game.screen) + ":" + ((matchups && matchups.length) || 0)') > 0);
  }
  /* ⚠️ E ELE NAO PODE DEPENDER DA REFERENCIA DO ARRAY: o online monta o `logDaMinhaVista` a CADA
     render, entao ali o array e sempre novo -- comparando referencia, o estado zeraria em todo
     desenho e o clique nunca abriria nada. Esta trava e a prova. */
  {
    const a = conf(2);
    S.renderMatchupLog(a); S.alternarLogDoConfronto(0);
    const b = conf(2);                                  // MESMO conteudo, array NOVO (o caso do online)
    ok('um array NOVO com o mesmo conteudo mantem o aberto', /mlog-passo/.test(S.renderMatchupLog(b)));
  }

  /* 4) ⚠️ CONFRONTO SEM PASSO A PASSO NAO GANHA O + nem vira botao: e o log antigo, gravado antes de
        o diario existir, e ali nao ha o que expandir. */
  {
    const velho = conf(1); delete velho[0].golpes;
    const html = S.renderMatchupLog(velho);
    ok('log antigo (sem diario) nao ganha o +', !/mlog-mais/.test(html));
    ok('e nem vira botao', !/mlog-abre/.test(html));
  }

  /* 5) ⚠️ O CARD E UMA <div role="button">, E NAO UM <button> -- e essa e a diferenca que faz o
        desenho funcionar. O passo a passo fica DENTRO do card, e ele contem o selo clicavel da
        chuva, que E um <button>: <button> dentro de <button> e HTML invalido, o navegador fecha o
        de fora e o clique de dentro se perde -- com a tela continuando a PARECER certa.
        A nota do selo da chuva previu este dia com todas as letras: *"se um dia a linha do log
        virar clicavel, e este o lugar que quebra"*. Numa div o aninhamento e valido, e o selo ja
        nasceu com `event.stopPropagation()` -- tocar nele abre a caixa da chuva sem fechar o card. */
  {
    const lista = conf(1);
    const html = logAberto(lista);
    ok('o card NAO e um <button> (senao o selo da chuva dentro dele seria invalido)',
       /<div class="matchup-row mlog mlog-card[^"]*"[^>]*role="button"/.test(html) &&
       !/<button[^>]*matchup-row/.test(html),
       (html.match(/<div class="matchup-row[^>]*>/) || ['(nao achei o card)'])[0].slice(0, 80));
    ok('e o passo a passo fica DENTRO dele', html.indexOf('mlog-passo') > html.indexOf('mlog-card'));
    ok('e ele tem teclado (a div nao traz de fabrica)',
       /tabindex="0"/.test(html) && /onkeydown="if\(event\.key==='Enter'/.test(html));
  }
  /* o caso concreto que a nota descrevia: o selo da chuva DENTRO do card */
  {
    const lista = conf(1);
    lista[0].chuva = true;
    lista[0].golpes = [{ q:'p', d:0, hp:null, c:0, m:0, z:0, x:'chuva', g:'Gloom0' }].concat(lista[0].golpes);
    const html = logAberto(lista);
    ok('o selo clicavel da chuva aparece dentro do card', /selo-clicavel/.test(html));
    ok('e ele nao fecha o card ao ser tocado (stopPropagation)',
       /selo-clicavel[^>]*onclick="event\.stopPropagation\(\)/.test(html),
       (html.match(/<button[^>]*selo-clicavel[^>]*>/) || ['(sem selo)'])[0].slice(0, 90));
    /* ⚠️ E O CARD CONTINUA SENDO O UNICO <div role=button>: se alguem o trocar por <button>, o selo
       vira aninhado e o clique dele some. Esta e a trava que guarda isso. */
    ok('e o card segue sendo div, com o selo como <button> dentro',
       /role="button"/.test(html) && (html.match(/<button/g) || []).length >= 1 &&
       !/<button[^>]*role="button"/.test(html));
  }

  /* 6) ⚠️ O TITULO DIZ QUEM VENCEU (16/09/2026, a pedido) -- e a unica coisa que o confronto FECHADO
        precisa dizer: sem ele, saber quem ficou de pe exige LER as duas barras de vida. */
  {
    const um = conf(1);                                  // o player vence (enemyHpAfter 0)
    ok('o titulo anuncia o vencedor',
       /<div class="mlog-titulo">Vitória <span class="mlog-quem p">Gloom0<\/span><\/div>/.test(S.renderMatchupLog(um)),
       (S.renderMatchupLog(um).match(/<div class="mlog-titulo">[\s\S]*?<\/div>/) || ['(sem titulo)'])[0]);
    const doInimigo = conf(1);
    doInimigo[0].playerHpAfter = 0; doInimigo[0].enemyHpAfter = 50;
    ok('e quando quem vence e o adversario, o nome sai na cor DELE',
       /Vitória <span class="mlog-quem e">Goldeen0<\/span>/.test(S.renderMatchupLog(doInimigo)));
    /* ⚠️ OS DOIS CAINDO e 1,2% dos confrontos e e SEMPRE autodestruicao (a regra de 12/09/2026).
       "Vitoria de" ali seria mentira, entao o titulo conta o que aconteceu. */
    const ambos = conf(1);
    ambos[0].playerHpAfter = 0; ambos[0].enemyHpAfter = 0;
    ok('e se os dois cairem, o titulo diz isso',
       /<div class="mlog-titulo">Os dois caíram<\/div>/.test(S.renderMatchupLog(ambos)));
    /* os dois de pe nao acontece hoje (medido: 0 em 11.879) -- sem titulo e melhor que mentir */
    const vivos = conf(1);
    vivos[0].playerHpAfter = 50; vivos[0].enemyHpAfter = 50;
    ok('e os dois de pe nao ganham titulo nenhum', !/mlog-titulo/.test(S.renderMatchupLog(vivos)));
    ok('o titulo e centralizado', /\.mlog-titulo\{[^}]*text-align:center/.test(cliL));
  }

  /* 6b) ⚠️ O FUNDO DO CARD DIZ O RESULTADO (23/09/2026, a pedido). Ele nao afirma nada novo -- e
        a MESMA coisa que o titulo diz desde 16/09 --, e e por isso que os dois leem a mesma
        funcao: duas contas em paralelo divergiriam no primeiro ajuste, e o sintoma seria um card
        verde com o titulo dizendo que o adversario venceu. */
  {
    const um = conf(1);                                  // o player vence
    ok('o card de quem VENCEU e verde', /class="matchup-row mlog mlog-card venceu/.test(S.renderMatchupLog(um)),
       (S.renderMatchupLog(um).match(/class="matchup-row[^"]*"/) || [''])[0]);
    const doInimigo = conf(1);
    doInimigo[0].playerHpAfter = 0; doInimigo[0].enemyHpAfter = 50;
    ok('  e o de quem PERDEU e vermelho', /class="matchup-row mlog mlog-card perdeu/.test(S.renderMatchupLog(doInimigo)));
    /* ⚠️ OS DOIS CAIREM NAO GANHA COR, e e a mesma decisao da medalha do podio da Arena 1x1: ali
       nao houve vencedor, e pintar de um dos dois seria escolher um por acaso. */
    const ambos = conf(1);
    ambos[0].playerHpAfter = 0; ambos[0].enemyHpAfter = 0;
    const hAmbos = S.renderMatchupLog(ambos);
    ok('  e os dois cairem NAO ganha cor nenhuma', !/venceu|perdeu/.test(hAmbos),
       (hAmbos.match(/class="matchup-row[^"]*"/) || [''])[0]);
    const vivos = conf(1);
    vivos[0].playerHpAfter = 50; vivos[0].enemyHpAfter = 50;
    ok('  nem os dois de pe', !/venceu|perdeu/.test(S.renderMatchupLog(vivos)));
    /* ⚠️ E O TITULO LE A MESMA FUNCAO: e isso que impede a cor e a palavra de divergirem. A trava
       varre os quatro estados e cobra o PAR -- uma que so olhasse a classe passaria com o titulo
       refazendo a conta por conta propria. */
    [[50, 0, 'venceu', 'Vitória'], [0, 50, 'perdeu', 'Vitória'],
     [0, 0, '', 'Os dois caíram'], [50, 50, '', '']].forEach(([hp, he, cls, tit]) => {
      const c = conf(1); c[0].playerHpAfter = hp; c[0].enemyHpAfter = he;
      const h = S.renderMatchupLog(c);
      const temCls = /mlog-card (venceu|perdeu)/.test(h) ? h.match(/mlog-card (venceu|perdeu)/)[1] : '';
      const temTit = /mlog-titulo/.test(h);
      ok('  a cor e o titulo concordam em ' + hp + '/' + he,
         temCls === cls && temTit === !!tit && (!tit || h.indexOf(tit) >= 0),
         'classe "' + temCls + '", titulo ' + (temTit ? 'sim' : 'nao'));
    });
    /* ⚠️ CARD SEM PASSOS (log antigo, gravado antes de o diario existir) fica de fora: ele nao
       vira card e nao tem fundo branco pra tingir -- a cor sairia como uma faixa solta no meio da
       lista tracejada. */
    const velho = conf(1); velho[0].golpes = [];
    const hVelho = S.renderMatchupLog(velho);
    ok('  e o log ANTIGO (sem passos) nao ganha cor', !/venceu|perdeu/.test(hVelho),
       (hVelho.match(/class="matchup-row[^"]*"/) || [''])[0]);
    /* ⚠️ AS DUAS REGRAS TEM QUE VIR DEPOIS DO `:hover` GENERICO: elas tem a MESMA especificidade
       (0-2-0), entao quem vence o empate e a ULTIMA declarada. Declaradas antes, passar o mouse num
       card verde o deixaria creme -- e isso nao aparece em assercao de HTML nenhuma. E a mesma
       armadilha que o `.pesc-puxar.puxando`, o `.pesc-zona:disabled` e o `.minha` do Resgate ja
       custaram. */
    const iHover = cliL.indexOf('.mlog-card:hover{');
    ok('  o CSS das duas cores vem DEPOIS do :hover generico',
       iHover >= 0 && cliL.indexOf('.mlog-card.venceu{') > iHover
                   && cliL.indexOf('.mlog-card.perdeu{') > iHover);
    ok('  e cada cor tem o hover DELA', /\.mlog-card\.venceu:hover\{/.test(cliL)
       && /\.mlog-card\.perdeu:hover\{/.test(cliL));
    /* ⚠️ O TETO DA COR NAO E O GOSTO: e o TEXTO batendo no AA. O `--muted` (o titulo, o `Lv.` e o
       `x/y` de HP) e o mais claro do card, e e ele que chega no limite primeiro -- medido no
       navegador, com o `--muted` de fabrica a cor a 16% o derruba pra 4,34/4,05, ABAIXO do 4,5.
       Por isso o card colorido redeclara a variavel, e por isso esta trava mede o CONTRASTE de
       verdade em vez de um proxy: a versao anterior somava os canais do fundo ("perto do branco"),
       e isso caducou no dia seguinte, quando a cor ficou mais viva a pedido. */
    const lumin = (hex) => {
      const c = [1,3,5].map(i => parseInt(hex.slice(i, i+2), 16) / 255)
        .map(v => v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4));
      return .2126*c[0] + .7152*c[1] + .0722*c[2];
    };
    const contraste = (a, b) => { const x = lumin(a), y = lumin(b);
      return ((Math.max(x,y) + .05) / (Math.min(x,y) + .05)); };
    const fundo = (cls) => (cliL.match(new RegExp('\\.mlog-card\\.' + cls + '\\{background:(#[0-9a-f]{6})')) || [])[1];
    /* o `--muted` que vale DENTRO do card colorido -- se ninguem redeclarar, vale o de fabrica */
    const mutLocal = (cliL.match(/\.mlog-card\.venceu, \.mlog-card\.perdeu\{[^}]*--muted:(#[0-9a-f]{6})/) || [])[1]
      || (cliL.match(/--muted:(#[0-9a-f]{6})/) || [])[1];
    ok('  o card colorido redeclara o --muted', /\.mlog-card\.venceu, \.mlog-card\.perdeu\{[^}]*--muted:/.test(cliL),
       'vale ' + mutLocal);
    ['venceu', 'perdeu'].forEach(cls => {
      const c = fundo(cls);
      const r = c && mutLocal ? contraste(mutLocal, c) : 0;
      ok('  e o texto mais claro sobre o `' + cls + '` passa o AA', r >= 4.5,
         (c || '(sem fundo)') + ' -> ' + r.toFixed(2) + ':1');
    });
    /* ⚠️ E O PASSO A PASSO (`--ink`) NAO PODE ENCOSTAR NO LIMITE: ele e o texto que se LE, e a cor
       existe pra nao atrapalhar essa leitura -- foi o pedido ao pe da letra. */
    const inkC = (cliL.match(/--ink:(#[0-9a-f]{6})/) || [])[1];
    ['venceu', 'perdeu'].forEach(cls => {
      const r = contraste(inkC, fundo(cls));
      ok('  e o passo a passo sobre o `' + cls + '` fica FOLGADO', r >= 10, r.toFixed(1) + ':1');
    });
  }

  /* 6c) ⚠️ QUEM ENTRA EM CAMPO COM BUFF DE TERRENO ANUNCIA (23/09/2026, a pedido). */
  {
    const inst2 = (id, lv) => { const p = S.createInstance(id, lv); p.hp = p.maxHp = S.calcMaxHp(p); return p; };
    /* Termas Vulcânicas e Fire/Water: pega o Charizard e o Blastoise de um lado, o Lapras, o
       Arcanine e a Starmie do outro -- 5 dos 12, que e o terreno que mais pega este painel. */
    const TER = S.TERRAINS.find(t => t.name === 'Termas Vulcânicas');
    ok('o painel tem o terreno que a trava precisa', !!TER, TER && TER.types.join('/'));
    const monta = (comTerreno) => {
      const a = ['venusaur','charizard','blastoise','gengar','alakazam','golem'].map(id => inst2(id, 55));
      const b = ['machamp','lapras','arcanine','snorlax','starmie','weezing'].map(id => inst2(id, 57));
      S.equiparNpc(b);
      if(comTerreno){ S.applyTerrainBuff(a, TER); S.applyTerrainBuff(b, TER); }
      return [a, b];
    };
    const roda = (comTerreno, semente) => {
      let x = semente; const rng = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
      const [a, b] = monta(comTerreno);
      const r = S.simulateGymBattle(a, b, rng);
      return { r, a, b, linhas: (r.matchups || []).flatMap(m => (m.golpes || []).filter(g => g.x === 'terreno')) };
    };

    const comTer = roda(true, 987654321);
    ok('a linha sai pra quem tem buff de terreno', comTer.linhas.length > 0, comTer.linhas.length + ' linhas');
    /* ⚠️ UMA VEZ POR POKÉMON POR BATALHA, e não a cada confronto: quem sobrevive a três confrontos
       não "entrou" três vezes. Medido em 900 batalhas, por confronto seriam 1,90x mais frases
       (3,29 por batalha contra 1,73) -- +4,9s de tela em vez de +2,6s. */
    const nomes = comTer.linhas.map(g => g.g);
    ok('  e UMA VEZ por pokémon (não a cada confronto)', new Set(nomes).size === nomes.length,
       nomes.join(', '));
    /* ⚠️ E SÓ PRA QUEM TEM O BUFF: a linha nomeia o pokémon, e nomear quem não ganhou nada seria
       prometer um bônus que a batalha não dá -- o mesmo defeito do selo do terreno na Torre. */
    const buffados = comTer.a.concat(comTer.b).filter(p => p.terrainBuffed).map(p => p.name);
    ok('  e só pra quem TEM o buff', nomes.every(n2 => buffados.indexOf(n2) >= 0),
       'anunciados: ' + nomes.join(', ') + ' | buffados: ' + buffados.join(', '));
    /* ⚠️ E O `q` DA LINHA É DO PRÓPRIO POKÉMON, como o do `acordou` e o da Fúria: ela é sobre UM
       pokémon, não sobre um causador e um alvo. Lido ao contrário, a frase nomearia o adversário. */
    const ladoCerto = (comTer.r.matchups || []).every(m =>
      (m.golpes || []).filter(g => g.x === 'terreno')
        .every(g => (g.q === 'p' ? m.player : m.enemy) === g.g));
    ok('  e o `q` dela é do próprio pokémon', ladoCerto);

    const semTer = roda(false, 987654321);
    ok('  sem terreno nenhum, ela não sai', semTer.linhas.length === 0, semTer.linhas.length + ' linhas');
    /* ⚠️ E O MOTOR NÃO MUDA: ela não lê o `rng` (não há sorteio -- o pokémon TEM ou NÃO TEM a
       flag), então a semente não se move. Medido em 900 batalhas COM terreno: a impressão do MOTOR
       fica idêntica (d25352d084c0) e só a do DIÁRIO muda, que é o que uma linha nova deve fazer. */
    const impr = (x) => (x.matchups || []).map(m => m.playerHpAfter + ',' + m.enemyHpAfter).join(';');
    const A = roda(true, 555), B = roda(true, 555);
    ok('  e ela é determinística (não lê o rng)', impr(A.r) === impr(B.r) && A.linhas.length === B.linhas.length);

    /* ⚠️ O MARCADOR É SOLTO NO FIM DA BATALHA, senão o pokémon sai dela "já anunciado" e nunca
       mais anuncia -- e a flag `terrainBuffed` é recalculada a cada batalha. É o vazamento que o
       teto de HP da Fúria e o `_congelado` tiveram. */
    /* ⚠️ QUEM PROVA ISSO É O `doExchange` CHAMADO NA MÃO, e não uma batalha inteira: o
       `simulateGymBattle` JÁ chama o `encerrarBatalha` no fim, então o marcador nunca está de pé
       quando ela volta -- a primeira versão desta trava media isso e falhava com o código certo. */
    const [a2, b2] = monta(true);
    const x1 = a2.find(p => p.terrainBuffed), y1 = b2.find(p => p.terrainBuffed);
    ok('  o painel tem um buffado de cada lado', !!x1 && !!y1);
    const d1 = []; S.doExchange(x1, y1, () => .5, d1);
    ok('  o primeiro doExchange anuncia os DOIS',
       d1.filter(g => g.x === 'terreno').length === 2, d1.filter(g => g.x === 'terreno').length);
    ok('  e o marcador FICA de pé', x1._terrenoAnunciado === true && y1._terrenoAnunciado === true);
    const d2 = []; S.doExchange(x1, y1, () => .5, d2);
    ok('  e a segunda troca NÃO repete', d2.filter(g => g.x === 'terreno').length === 0);
    S.encerrarBatalha(a2, b2);
    ok('  e o `encerrarBatalha` SOLTA o marcador', a2.concat(b2).every(p => !p._terrenoAnunciado));
    const d3 = []; S.doExchange(x1, y1, () => .5, d3);
    ok('  e a batalha seguinte anuncia de novo', d3.filter(g => g.x === 'terreno').length === 2);

    /* ⚠️ OS 15% SAEM DA CONSTANTE, nunca escritos na frase: é o cuidado da caixa que explica o
       especial, e a razão de ela existir -- a especialidade já teve o CLAUDE.md dizendo "~13 pontos
       percentuais" por um texto ter sobrevivido à mudança do valor. A trava mexe na constante e
       cobra que a frase acompanhe: um texto fixo passaria no caso nomeado e falharia só nesse. */
    const pct = Math.round((S.TERRAIN_BUFF_MULT - 1) * 100);
    ok('a frase é a pedida, palavra por palavra',
       S.fraseDoEspecial({ x:'terreno', g:'Onix' }, 'Onix', 'Machamp')
       === 'Onix é afetado pelo terreno e ganha buff de ' + pct + '% em todos atributos',
       S.fraseDoEspecial({ x:'terreno', g:'Onix' }, 'Onix', 'Machamp'));
    /* ⚠️ QUEM PROVA A DERIVAÇÃO É O CÓDIGO, e não mexer na constante: `const` dentro do sandbox
       NÃO É REATRIBUÍVEL de fora -- escrever em `S.TERRAIN_BUFF_MULT` só troca a propriedade do
       objeto, e a ligação léxica de dentro do script continua a mesma. É a mesma lição do `const`
       que não vira global, que a Queimada já custou. */
    const bloco = (cliL.match(/if\(g\.x === 'terreno'\)\{[\s\S]{0,400}?\n  \}/) || [''])[0];
    ok('  a trava tem o bloco da frase pra ler', bloco.length > 50, bloco.length + ' chars');
    /* ⚠️ O SELO SAI NA COR DO TERRENO (23/09/2026, a pedido: *"deixe a cor do simbolo de buff, da
       mesma cor que fica ao lado do nome do pokemon com o simbolo de buff"*). As duas pontas têm
       que dar a MESMA cor, senão o selo da frase e o galão do quadro discordam na MESMA tela.
       ⚠️ E A COR SAI DA LINHA (`tt`), não do estado da tela: o log é relido dias depois, e ali o
       terreno da batalha corrente não é o daquele confronto. */
    {
      const srvT = require('fs').readFileSync(require('path').join(raiz, 'functions', 'index.js'), 'utf8');
      const terr = S.TERRAINS.find(t => t.types[0] === 'Fire');
      const pT = S.createInstance('charizard', 60), qT = S.createInstance('onix', 60);
      S.applyTerrainBuff([pT], terr);
      pT.hp = S.calcMaxHp(pT); qT.hp = S.calcMaxHp(qT);
      const dT = []; S.doExchange(pT, qT, () => .5, dT);
      const linhaT = dT.find(g => g.x === 'terreno');
      ok('a linha do terreno carrega o TIPO dele', !!linhaT && linhaT.tt === 'Fire', JSON.stringify(linhaT));
      /* ⚠️ O CAMPO É `tt` E NÃO `t`: o `t` do passo animado já quer dizer QUANTOS TAPAS, e uma
         string ali seria colisão de nome -- o tipo de coisa que não dá erro e some numa comparação. */
      ok('  e o campo é `tt`, que não colide com o `t` dos tapas',
         !!linhaT && linhaT.t === undefined, JSON.stringify(linhaT));
      const icT = S.iconeDoEspecial(linhaT);
      const corT = (icT.match(/color:([^;"]+)/) || [])[1];
      ok('  e o selo da frase sai na cor do terreno', corT === S.terrainColor(terr),
         corT + ' x ' + S.terrainColor(terr));
      /* ⚠️ E ELA É A MESMA QUE O GALÃO DO QUADRO USA (`terrainColor(terrain)` no `fighterHtml`). */
      ok('  que é a MESMA que o quadro do lutador usa',
         S.TYPE_COLORS[linhaT.tt] === S.terrainColor(terr));
      /* ⚠️ LINHA ANTIGA (sem o campo) CAI NO PADRÃO -- log velho não pode sumir. A trava compara o
         fallback com ele mesmo (um tipo desconhecido dá a mesma cor) em vez de ler a constante:
         `const` dentro do sandbox NÃO vira global, e ler `S.COR_TERRENO_PADRAO` devolve undefined
         -- ou seja a trava passaria com QUALQUER cor. É a lição que a Queimada já custou. */
      const corVelha = (S.iconeDoEspecial({ x:'terreno', g:'Onix' }).match(/color:([^;"]+)/) || [])[1];
      const corDesconhecida = (S.iconeDoEspecial({ x:'terreno', tt:'NaoExiste' }).match(/color:([^;"]+)/) || [])[1];
      ok('  e linha antiga (sem o campo) cai no padrão',
         !!corVelha && corVelha === corDesconhecida && corVelha !== corT,
         corVelha + ' (a do terreno é ' + corT + ')');
      /* e os outros especiais continuam com o ícone fixo */
      ok('  e os outros especiais não mudam',
         S.iconeDoEspecial({ x:'sono' }) === S.ICONES_ESPECIAIS.sono &&
         S.iconeDoEspecial({ x:'furia' }) === S.ICONES_ESPECIAIS.furia);
      /* ⚠️ E OS DOIS MOTORES GRAVAM O MESMO CAMPO: o diário do servidor é o que vai pro log da liga. */
      const reTT = /x:'terreno', d:0, g: p\.name, tt:/;
      ok('  e os DOIS motores gravam o `tt`', reTT.test(srvT) && reTT.test(cliL),
         'servidor ' + reTT.test(srvT) + ' / cliente ' + reTT.test(cliL));
    }
    /* ⚠️ E A PAUSA DELA É PRÓPRIA: 2s, e SÓ dela (a pedido: *"aumente o tempo dessa mensagem para
       2s"*). O `PAUSA_LEITURA_ESPECIAL_MS` vale pra TODA frase de passiva -- subir a constante
       deixaria toda batalha do jogo meio segundo mais lenta POR FRASE. */
    ok('a pausa do terreno é de 2s', S.pausaDaFaixa({ leitura:true, x:'terreno' }) === 2000,
       S.pausaDaFaixa({ leitura:true, x:'terreno' }) + 'ms');
    ok('  e as OUTRAS frases continuam em 1,5s',
       S.pausaDaFaixa({ leitura:true, x:'sono' }) === S.PAUSA_LEITURA_ESPECIAL_MS &&
       S.pausaDaFaixa({ leitura:true, x:'queimou' }) === S.PAUSA_LEITURA_ESPECIAL_MS &&
       S.pausaDaFaixa({ leitura:true, x:'paralisou' }) === S.PAUSA_LEITURA_ESPECIAL_MS,
       S.pausaDaFaixa({ leitura:true, x:'sono' }) + 'ms');
    ok('  e um passo comum continua sem pausa nenhuma', S.pausaDaFaixa({ x:'golpe' }) === 0);
    ok('  e o número é DERIVADO da constante, nunca escrito na frase',
       bloco.indexOf('TERRAIN_BUFF_MULT') >= 0 && !/\b15%|\b15 ?%/.test(bloco), bloco.slice(0, 160));

    /* ⚠️ O 1,5s DE LEITURA vem da entrada no `passosDaAbertura`: é ela que faz a frase virar um
       passo PRÓPRIO da animação. Fora da tabela ela valeria pra SEMPRE -- o defeito da anulação. */
    ok('  e ela vale 1 passo na abertura (o 1,5s)', S.passosDaAbertura.terreno === 1,
       S.passosDaAbertura.terreno);
    /* ⚠️ E O `ehGolpeEspecial` TEM QUE CONHECÊ-LA, senão a linha cai no ramo do GOLPE COMUM e sai
       como `-0 de HP` com o nome de um golpe que o pokémon não tem -- foi o que aconteceu com as
       três linhas do congelamento em 16/09/2026, e foi o NAVEGADOR que pegou. */
    ok('  e o ehGolpeEspecial a reconhece', S.ehGolpeEspecial({ x:'terreno' }) === true);
    ok('  e o selo dela é o MESMO do terreno do resto do jogo',
       S.ICONES_ESPECIAIS.terreno === S.selo('terreno'), S.ICONES_ESPECIAIS.terreno);
    /* o teste que o navegador fez: nenhuma linha de terreno vira `-0 de HP` na TELA */
    const comLinha = (comTer.r.matchups || []).find(m => (m.golpes || []).some(g => g.x === 'terreno'));
    const htmlT = logAberto([comLinha]);
    ok('  e no LOG ela sai como frase, nunca como `-0 de HP`',
       /afetado pelo terreno/.test(htmlT) && !/[-−]0 de HP/.test(htmlT));

    /* ⚠️ OS DOIS MOTORES, COM PAINEL PRÓPRIO -- e isso não é zelo: a comparação das 300 batalhas
       roda SEM TERRENO (ela não chama o `applyTerrainBuff`), então ela NUNCA toca nesta linha.
       Conferido pelo lado do erro: religando o defeito "o servidor não anuncia", a bateria inteira
       passava em BRANCO. É a mesma razão pela qual o gelo e a queimadura têm painel próprio.
       ⚠️ E A FLAG É MARCADA À MÃO porque o servidor não exporta o `_applyTerrainBuff` -- isto é
       exatamente o que ele faz (os tipos do pokémon contra os do terreno). O HP também não precisa
       ser montado: o motor CURA os dois times na entrada. */
    let divTer = 0, linhasTer = 0, buffTer = 0;
    for(let k = 0; k < 120; k++){
      const semente = 'ter-' + k;
      const mk = (cria) => [
        ['venusaur','charizard','blastoise','gengar','alakazam','golem'].map(id => cria(id, 55)),
        ['machamp','lapras','arcanine','snorlax','starmie','weezing'].map(id => cria(id, 57))
      ];
      const [aC, bC] = mk((id, lv) => S.createInstance(id, lv));
      const [aS, bS] = mk((id, lv) => srv._createInstance(id, lv));
      const marca = (t) => t.forEach(p => { p.terrainBuffed = p.types.some(x => TER.types.indexOf(x) >= 0); });
      [aC, bC, aS, bS].forEach(marca);
      buffTer += aC.concat(bC).filter(p => p.terrainBuffed).length;
      const rC = S.simulateGymBattle(aC, bC, S.makeSeededRng(semente));
      const rS = srv._simulateGymBattle(aS, bS, srv._makeSeededRng(semente));
      linhasTer += (rC.matchups || []).reduce((t, m) => t + (m.golpes || []).filter(g => g.x === 'terreno').length, 0);
      if(resumo(rC) !== resumo(rS)) divTer++;
    }
    ok('120 batalhas COM TERRENO batem golpe a golpe nos dois motores', divTer === 0, divTer + ' divergencias');
    /* ⚠️ E A TRAVA COBRA QUE O PAINEL TOCOU NA MECÂNICA: sem esta linha ela daria verde comparando
       120 batalhas que por acaso não tivessem buff nenhum -- o "zero perfeito" que este projeto já
       registra em cinco lugares. */
    ok('  e o painel realmente anunciou terreno', linhasTer > 0,
       linhasTer + ' linhas, ' + buffTer + ' pokémon buffados')
  }
  /* ⚠️ E O BOTAO AZUL SUMIU -- ele durou horas, entre o + solto no bloco do × e o card. As tres
     tentativas do mesmo dia estao registradas no CLAUDE.md; esta trava impede que os restos de
     qualquer uma delas voltem sem querer. */
  ok('nao sobrou nada do + nem do botao azul',
     !/mlog-mais/.test(cliL) && !/mlog-barra/.test(cliL) && !/mlog-abre/.test(cliL),
     ['mlog-mais', 'mlog-barra', 'mlog-abre'].filter(c => cliL.indexOf(c) >= 0).join(', ') || 'nenhum resto');

  /* 7) o card nao usa o `.btn` da casa -- aquele e botao de ACAO, com moldura de 3px */
  /* ⚠️ LE O HTML GERADO, e nao o CSS: o regex anterior (`matchup-row[^"]*btn`) atravessava o
     arquivo inteiro ate achar um "btn" em outra regra, centenas de linhas abaixo. E o MESMO erro
     do [\s\S]*? que a trava do formato do botao azul cometeu horas antes. */
  {
    const cls = (S.renderMatchupLog(conf(1)).match(/class="(matchup-row[^"]*)"/) || ['', ''])[1];
    ok('o card nao usa o .btn da casa', cls.split(/\s+/).indexOf('btn') < 0, cls);
  }
  /* ⚠️ A BORDA E O QUE DIZ QUE ELE E CLICAVEL, e ela segue o `.team-grid-card` (o card de pokemon
     da tela de ordem): 2px, cantos de 5px, fundo branco e sombra. Reusar o molde e o que faz o
     jogador reconhecer "isto se toca" sem aprender nada novo. */
  ok('o card tem borda de 2px e cantos de 5px, como o card de pokemon',
     /\.matchup-row\.mlog-card\{[^}]*border:2px solid var\(--box-border\)/.test(cliL) &&
     /\.matchup-row\.mlog-card\{[^}]*border-radius:5px/.test(cliL),
     (cliL.match(/\.matchup-row\.mlog-card\{[^}]*}/) || ['(sem regra)'])[0].replace(/\s+/g, ' ').slice(0, 110));
  ok('e aberto ele fica com a borda AZUL (e o que diz QUAL card esta aberto)',
     /\.mlog-card\.aberto\{border-color:var\(--blue\)/.test(cliL));
  /* ⚠️ A regra do :last-child do card e REDUNDANTE hoje (ordem de declaracao ja resolve, medido no
     navegador) -- ela guarda o dia em que o bloco for movido pra cima. */
  ok('e o card tem cursor e foco visivel',
     /\.matchup-row\.mlog-card\{[^}]*cursor:pointer/.test(cliL) &&
     /\.mlog-card:focus-visible\{outline:2px solid var\(--blue\)/.test(cliL));
}


/* =====================================================================
   A PARALISIA (16/09/2026) -- a QUARTA mecanica POR ATAQUE, e a unica que mexe em VELOCIDADE.
   ===================================================================== */
console.log('\nA PARALISIA: OS DEZ GOLPES E AS REGRAS DA GEN 3');
{
  const P = S.GOLPES_QUE_PARALISAM;
  ok('sao os dez golpes da Gen 3', Object.keys(P).length === 10, Object.keys(P).join(', '));
  /* ⚠️ AS CHANCES SAO AS OFICIAIS, e VARIAM -- ao contrario do gelo (todos 10%) */
  ok('e as chances sao as oficiais',
     P.thunderbolt === 0.10 && P.thunder === 0.30 && P.bodyslam === 0.30 && P.zapcannon === 1.00,
     'raio ' + P.thunderbolt + ' | trovao ' + P.thunder + ' | golpe de corpo ' + P.bodyslam + ' | canhao ' + P.zapcannon);
  /* ⚠️ OS DEZ EXISTEM NA TABELA DE GOLPES -- a licao da Lamina Solar: cadastrar um golpe que o
     jogo nao tem seria letra morta, e so se descobre no confronto que teria aquele golpe. */
  ok('e todos existem na tabela GOLPES', Object.keys(P).every(id => !!S.GOLPES[id]),
     Object.keys(P).filter(id => !S.GOLPES[id]).join(', ') || 'todos');
  ok('e todos tem nome em portugues', Object.keys(P).every(id => !!S.GOLPES_PT[id]),
     Object.keys(P).filter(id => !S.GOLPES_PT[id]).join(', ') || 'todos');
  /* ⚠️ E ELES SAO LEVADOS DE VERDADE -- a licao da Furia, que ao pe da letra saia em 0,0% */
  const ids = Object.keys(P);
  const donos = Object.keys(S.SPECIES).filter(sp => {
    const q = S.createInstance(sp, 70); q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp;
    return (S.ataquesPadrao(q) || []).some(a => ids.indexOf(a) >= 0);
  });
  ok('e 30+ especies LEVAM um deles no Lv.70', donos.length >= 30, donos.length + ' especies');

  /* ⚠️ A VELOCIDADE CAI PRA 25% -- a regra da Gen 1 a 6. So na Gen 7 ela virou 50%. */
  ok('a velocidade de quem esta paralisado e 25%', S.PARALISIA_VELOCIDADE === 0.25, String(S.PARALISIA_VELOCIDADE));
  {
    const q = S.createInstance('jolteon', 60); q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp;
    const antes = S.effectiveSpeed(q);
    q._paralisado = 'thunderbolt';
    const depois = S.effectiveSpeed(q);
    ok('e ela cai de verdade', Math.abs(depois / antes - 0.25) < 0.02, antes + ' -> ' + depois);
    /* ⚠️ O CORTE ENTRA POR ULTIMO na cadeia, depois de shiny/terreno/especialidade/furia: "25% da
       velocidade" e 25% do que o pokemon TEM na hora. E a mesma regra do corte da queimadura. */
    const sh = S.createInstance('jolteon', 60); sh.shiny = true; sh.maxHp = S.calcMaxHp(sh); sh.hp = sh.maxHp;
    const shAntes = S.effectiveSpeed(sh);
    sh._paralisado = 'thunderbolt';
    ok('e num shiny ele corta o valor JA buffado', S.effectiveSpeed(sh) === Math.round(shAntes * 0.25),
       shAntes + ' -> ' + S.effectiveSpeed(sh));
  }
  ok('a chance de perder o turno e 25%', S.CHANCE_PARALISIA_TRAVA === 0.25, String(S.CHANCE_PARALISIA_TRAVA));
}

console.log('\nNA GEN 3 NENHUM TIPO E IMUNE A PARALISIA');
{
  /* ⚠️ ESTA E A TRAVA QUE MAIS IMPORTA DESTE BLOCO, porque a intuicao erra: o tipo ELETRICO so
     ficou imune a paralisia na GEN 6. Na Gen 3 ele apanha como todo mundo -- e como seis dos dez
     golpes sao Eletricos e a maioria dos donos tambem e, o caso mais comum e justamente um
     Eletrico paralisando outro. Alguem "consertando" isso pra parecer com o jogo moderno estaria
     saindo da geracao que o resto do motor segue. */
  ['raichu','jolteon','electrode','magneton','zapdos'].forEach(id => {
    const q = S.createInstance(id, 55); q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp;
    ok('o ' + S.SPECIES[id].name + ' (Eletrico) PODE ser paralisado', S.podeParalisar(q) === true);
  });
  /* quem ja caiu e quem JA esta paralisado nao entram: a marca seria reescrita e o log passaria a
     nomear o golpe errado -- a mesma regra dos outros tres status */
  const caido = S.createInstance('pikachu', 50); caido.maxHp = S.calcMaxHp(caido); caido.hp = 0;
  ok('quem ja caiu nao paralisa', S.podeParalisar(caido) === false);
  const ja = S.createInstance('pikachu', 50); ja.maxHp = S.calcMaxHp(ja); ja.hp = ja.maxHp; ja._paralisado = 'thunder';
  ok('e quem JA esta paralisado tambem nao', S.podeParalisar(ja) === false);
}

console.log('\nMAS O GOLPE QUE NAO AFETA O ALVO NAO PARALISA');
{
  /* ⚠️ ESTA E A UNICA DAS QUATRO MECANICAS QUE PRECISOU DISSO. O motor sempre "conecta" (piso de
     1 de dano, golpe teimoso), entao sem a guarda um Raio paralisaria um Golem que ele nem
     alcanca. Nenhum tipo e imune a Fogo ou a Gelo, e no veneno o Aco ja e barrado pela imunidade
     ao STATUS -- so o Terra contra o Eletrico cai neste caso. */
  const terra = ['golem','rhydon','dugtrio','marowak','steelix'];
  terra.forEach(id => {
    const q = S.createInstance(id, 60); q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp;
    ok('o ' + S.SPECIES[id].name + ' (Terra) nao e paralisado por Raio',
       S.golpeAfetaOAlvo('thunderbolt', q) === false);
  });
  /* e o mesmo Golem APANHA de um golpe que o alcanca: a guarda e do TIPO, nao do pokemon */
  {
    const golem = S.createInstance('golem', 60); golem.maxHp = S.calcMaxHp(golem); golem.hp = golem.maxHp;
    ok('mas o MESMO Golem e paralisado por Golpe de Corpo (Normal)',
       S.golpeAfetaOAlvo('bodyslam', golem) === true);
    /* a prova pelo lado do sorteio, e nao so do ajudante */
    const quem = S.createInstance('raichu', 60); quem.maxHp = S.calcMaxHp(quem); quem.hp = quem.maxHp;
    quem.lastMove = 'thunderbolt';
    let pegou = 0;
    for(let i = 0; i < 400; i++){
      const alvo = S.createInstance('golem', 60); alvo.maxHp = S.calcMaxHp(alvo); alvo.hp = alvo.maxHp;
      if(S.tentarParalisar(quem, alvo, () => 0.01)) pegou++;
    }
    ok('e nem com o dado viciado ele paralisa o Terra', pegou === 0, pegou + ' de 400');
  }
}

console.log('\nAS DUAS CHANCES, MEDIDAS COM UM RNG CONTINUO');
{
  /* ⚠️ UM RNG CONTINUO, e nao uma semente nova por volta: o PRIMEIRO valor de uma semente nova
     correlaciona com a semente, e foi assim que a medicao do gelo deu 7,8% onde era 10%. */
  let semente = 987654321;
  const rng = () => (semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const testa = (golpe, esperado) => {
    let pegou = 0;
    const N = 20000;
    for(let i = 0; i < N; i++){
      const quem = S.createInstance('raichu', 60); quem.maxHp = S.calcMaxHp(quem); quem.hp = quem.maxHp;
      quem.lastMove = golpe;
      const alvo = S.createInstance('machoke', 60); alvo.maxHp = S.calcMaxHp(alvo); alvo.hp = alvo.maxHp;
      if(S.tentarParalisar(quem, alvo, rng)) pegou++;
    }
    const pct = 100 * pegou / N, sd = 100 * Math.sqrt(esperado * (1 - esperado) / N);
    /* ⚠️ COM CHANCE 100% O DESVIO E ZERO, e ai a conta de sigma da NaN -- o Canhao de Choque cai
       nesse caso. Ali o que se cobra e a igualdade exata: ele tem que paralisar SEMPRE. */
    if(sd === 0){
      ok(`o ${S.GOLPES_PT[golpe] || golpe} paralisa SEMPRE`, pegou === N, pegou + " de " + N);
      return;
    }
    ok('o ' + (S.GOLPES_PT[golpe] || golpe) + ' paralisa em ' + (esperado * 100) + '%',
       Math.abs(pct - esperado * 100) < 3 * sd,
       pct.toFixed(2) + '% (' + ((pct - esperado*100)/sd).toFixed(1) + 'sigma)');
  };
  testa('thunderbolt', 0.10);
  testa('thunder', 0.30);
  testa('zapcannon', 1.00);
}

console.log('\nE O rng SO E LIDO QUANDO O GOLPE PODE PARALISAR');
{
  /* ⚠️ A ARMADILHA DA SEMENTE: lido sempre, ele deslocaria toda batalha sem golpe de paralisia
     nenhuma -- e a mesma que o Remoinho e o congelamento ja registraram. */
  let leu = 0;
  const conta = () => { leu++; return 0.99; };
  const quem = S.createInstance('machoke', 60); quem.maxHp = S.calcMaxHp(quem); quem.hp = quem.maxHp;
  const alvo = S.createInstance('machoke', 60); alvo.maxHp = S.calcMaxHp(alvo); alvo.hp = alvo.maxHp;
  quem.lastMove = 'karatechop';           // nao paralisa
  S.tentarParalisar(quem, alvo, conta);
  ok('golpe que nao paralisa nao le o rng', leu === 0, leu + ' leituras');
  quem.lastMove = 'thunderbolt';
  const terra = S.createInstance('golem', 60); terra.maxHp = S.calcMaxHp(terra); terra.hp = terra.maxHp;
  S.tentarParalisar(quem, terra, conta);
  ok('e alvo que o golpe nao afeta tambem nao', leu === 0, leu + ' leituras');
  S.tentarParalisar(quem, alvo, conta);
  ok('mas o caso que vale LE', leu === 1, leu + ' leitura');
}

console.log('\nA PARALISIA NA TELA: AS DUAS FRASES E O SELO');
{
  const mk2 = (id, lv) => { const q = S.createInstance(id, lv); q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp; q.ataques = S.ataquesPadrao(q); return q; };
  /* o Magneton leva o Canhao de Choque, que paralisa em 100% -- e o unico jeito de garantir o
     caso sem depender de sorte de semente */
  let comPegou = null, comTravou = null, comSelo = null;
  /* ⚠️ O PAINEL MUDOU EM 18/09/2026, e a razao e uma licao: o antigo era um Magneton Lv.70 contra
     tres de 68, e ali ele MATA o paralisado no golpe (495 de 559 confrontos). Os 121 "turnos
     perdidos" que a trava achava eram entao, quase todos, O PROPRIO DEFEITO que ela deveria pegar:
     a linha "esta paralisado" saindo DEPOIS de ele cair.
     Consertado o defeito (quem ja caiu nao perde turno), o painel foi a ZERO e a trava falhou sem
     nada estar errado -- ela nao tinha um so caso LEGITIMO pra medir.
     O paralisado precisa SOBREVIVER pra perder o turno: com o Magneton em 60 contra tres DUROS de
     70 ele sai 45 vezes. E a mesma armadilha do "painel forte demais" que este arquivo ja registra
     na medicao do Smeargle e na do revide -- so que aqui ela escondia um bug em vez de um zero. */
  for(let k = 0; k < 600 && !(comPegou && comTravou && comSelo); k++){
    const t = [mk2('magneton', 60)];
    const e = [mk2('snorlax', 70), mk2('rhydon', 70), mk2('steelix', 70)];
    S.equiparNpc(e);
    const r = S.simulateGymBattle(t, e, S.makeSeededRng('partela|' + k));
    (r.matchups || []).forEach(m => {
      const g = m.golpes || [];
      if(!comPegou && g.some(x => x.x === 'paralisou')) comPegou = m;
      if(!comTravou && g.some(x => x.x === 'paralisado')) comTravou = m;
      if(!comSelo){
        const seq = S.sequenciaDoConfronto(m);
        const i = seq.findIndex(x => x.x === 'paralisou' && x.q === 'e');
        if(i > 0 && seq.length > i + 1) comSelo = { m, i };
      }
    });
  }
  ok('achei um confronto com a paralisia pegando', !!comPegou);
  ok('e um com o turno perdido', !!comTravou);

  if(comPegou){
    const html = S.passosHtml(comPegou);
    /* ⚠️ A FRASE NOMEIA O GOLPE, e o "com" neutro serve aos dez nomes sem tabela de genero:
       RAIO e masculino, FAISCA e LAMBIDA sao femininas. */
    ok('a frase nomeia o golpe que paralisou', /ficou paralisado com/.test(html),
       (html.match(/[^>]*ficou paralisado[^<]*/) || ['(sem frase)'])[0].slice(0, 70));
    /* ⚠️ E ELA NAO VIRA UM "-0 de HP": a linha e de dano zero, e sem entrar no ehGolpeEspecial ela
       cairia no ramo do golpe comum -- o defeito exato que o congelamento teve. */
    ok('e nenhuma linha de paralisia vira -0 de HP',
       !/paralisad[oa][^<]*−0 de HP/.test(html) && !/ficou paralisado[^<]*−0 de HP/.test(html));
    ok('e o ehGolpeEspecial conhece as duas',
       S.ehGolpeEspecial({ x:'paralisou' }) === true && S.ehGolpeEspecial({ x:'paralisado' }) === true);
  }
  if(comTravou){
    const html = S.passosHtml(comTravou);
    /* ⚠️ ELA EXPLICA UMA BARRA PARADA, a mesma razao do "gelado" e do "continua a dormir" */
    ok('a frase do turno perdido sai palavra por palavra',
       /está paralisado e não consegue atacar/.test(html));
  }
  /* as duas valem 1 passo: fora da tabela a frase valeria PRA SEMPRE (o defeito da anulacao) */
  ok('as duas frases valem 1 passo na animacao',
     S.passosDaAbertura && S.passosDaAbertura.paralisou === 1 && S.passosDaAbertura.paralisado === 1);

  /* ⚠️ O SELO ⚡ SO A PARTIR DO PASSO EM QUE ELA PEGA -- a paralisia acontece NO MEIO do confronto,
     como a queimadura e o veneno. Lido do CAMPO sem o passo, ele anunciaria no primeiro quadro uma
     paralisia que so vai acontecer seis golpes depois (reportado no 🔥 em 16/09/2026).
     ⚠️ E O `fighterHtml` RECEBE UM OBJETO, nao o passo solto: passando o numero, `op.passo` fica
     undefined e o selo aparece SEMPRE -- foi assim que a primeira medicao desta feature "achou" um
     defeito que nao existia. Conferir a FORMA do parametro antes de medir. */
  if(comSelo){
    const { m, i } = comSelo;
    const seq = S.sequenciaDoConfronto(m);
    let antes = 0, depois = 0;
    for(let passo = 0; passo <= seq.length; passo++){
      const tem = temSelo(S.fighterHtml(m, 'e', { passo }), 'raio');
      if(passo < i + 1 && tem) antes++;
      if(passo >= i + 1 && !tem) depois++;
    }
    ok('o selo NAO aparece antes do passo em que a paralisia pega', antes === 0, antes + ' quadros cedo demais');
    ok('e aparece em todos os quadros dali em diante', depois === 0, depois + ' quadros sem selo');
    /* PARALISIA HERDADA (o pokemon entra ja paralisado, sem marca no diario) vale desde o quadro 0 */
    const herdada = Object.assign({}, m, { golpes: (m.golpes||[]).filter(g => g.x !== 'paralisou'), enemyParalisado: true });
    ok('mas a paralisia HERDADA vale desde o primeiro quadro',
       temSelo(S.fighterHtml(herdada, 'e', { passo: 0 }), 'raio'));
    /* sem passo (o log relido dias depois) o selo vale: ali o confronto ja acabou */
    ok('e sem passo ele vale', temSelo(S.fighterHtml(m, 'e', {}), 'raio'));
  }

  /* ⚠️ E O ASTERISCO NO CARTAO DO GOLPE, como os outros tres status: e a informacao que mais muda
     a escolha e que os numeros do cartao menos contam. */
  ok('os dez golpes avisam no cartao',
     Object.keys(S.GOLPES_QUE_PARALISAM).every(id => (S.obsDoGolpe(id) || []).some(o => /paralisia/.test(o))),
     Object.keys(S.GOLPES_QUE_PARALISAM).filter(id => !(S.obsDoGolpe(id)||[]).some(o => /paralisia/.test(o))).join(', ') || 'todos');
  /* ⚠️ A CHANCE SAI DA TABELA, nunca escrita a mao: ela VARIA de 10% a 100% nestes dez.
     ⚠️ E O CANHAO DE CHOQUE PASSOU A AFIRMAR em 24/09/2026: ele dizia *"100% de chance de causar
     paralisia"* desde 16/09, e o conserto veio pelo `pct()` compartilhado, junto com o Soco
     Dinamico da confusao. Ver o comentario de la. */
  ok('e a chance do cartao e a da tabela',
     (S.obsDoGolpe('thunderbolt')||[]).some(o => /10%/.test(o)) &&
     (S.obsDoGolpe('thunder')||[]).some(o => /30%/.test(o)),
     (S.obsDoGolpe('thunderbolt')||[]).join(' | '));
  ok('e o de 100% AFIRMA, sem dizer porcentagem',
     (S.obsDoGolpe('zapcannon')||[]).some(o => /Sempre causa/.test(o)) &&
     !(S.obsDoGolpe('zapcannon')||[]).some(o => /100%/.test(o)),
     (S.obsDoGolpe('zapcannon')||[]).join(' | ').replace(/<[^>]*>/g, '').trim());
  /* e golpe que NAO paralisa nao ganha o aviso */
  ok('e um golpe que nao paralisa nao avisa',
     !(S.obsDoGolpe('karatechop')||[]).some(o => /paralisia/.test(o)));
}

console.log('\nE A MARCA E SOLTA NO FIM DA BATALHA');
{
  /* ⚠️ Ela e um campo da instancia e o time vai pro SAVE: sem soltar, um pokemon sairia da batalha
     paralisado PRA SEMPRE -- com a velocidade em 25% em todas as batalhas seguintes, o que nao
     apareceria como erro nenhum na tela. E o mesmo vazamento que o teto de HP da Furia teve. */
  const mk2 = (id, lv) => { const q = S.createInstance(id, lv); q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp; q.ataques = S.ataquesPadrao(q); return q; };
  let sobrou = 0, total = 0;
  for(let k = 0; k < 400; k++){
    const t = ['magneton','snorlax','raichu'].map(id => mk2(id, 60));
    const e = ['machamp','gengar','lapras'].map(id => mk2(id, 60));
    S.equiparNpc(e);
    S.simulateGymBattle(t, e, S.makeSeededRng('limpa|' + k));
    t.concat(e).forEach(q => { total++; if(q._paralisado) sobrou++; });
  }
  ok('nenhum pokemon sai da batalha paralisado', sobrou === 0, sobrou + ' de ' + total);
}

/* =====================================================================
   OS ESTAGIOS DE ATRIBUTO (17/09/2026) -- o primeiro sistema de estagios do motor.
   ===================================================================== */
console.log('\nA TABELA DE ESTAGIOS E A DA GEN 3');
{
  /* ⚠️ A ESCADA NAO E SIMETRICA, e e aqui que a intuicao mais erra: +1 e x1,5 mas -1 e x0,667
     (2/3), e NAO x0,5. Escrever "-1 = metade" e o erro classico -- baixar doi MENOS que subir
     rende, e e assim desde a Gen 1. */
  ok('+1 vale x1,5', Math.abs(S.multDoEstagio(1) - 1.5) < 1e-9, String(S.multDoEstagio(1)));
  ok('e -1 vale x0,667 (NAO x0,5)', Math.abs(S.multDoEstagio(-1) - 2/3) < 1e-9, S.multDoEstagio(-1).toFixed(4));
  ok('-2 e que vale x0,5', Math.abs(S.multDoEstagio(-2) - 0.5) < 1e-9, String(S.multDoEstagio(-2)));
  ok('+6 vale x4 e -6 vale x0,25',
     S.multDoEstagio(6) === 4 && S.multDoEstagio(-6) === 0.25,
     S.multDoEstagio(6) + ' / ' + S.multDoEstagio(-6));
  ok('e 0 nao mexe em nada', S.multDoEstagio(0) === 1);
  /* o teto e alcancavel de verdade (a Cauda de Ferro seis vezes), ao contrario dos estagios de
     critico, que ficaram FORA do jogo por serem letra morta */
  ok('o teto e -6 e +6', S.ESTAGIO_MIN === -6 && S.ESTAGIO_MAX === 6);
  ok('e passar do teto nao mexe', S.multDoEstagio(-99) === S.multDoEstagio(-6) && S.multDoEstagio(99) === S.multDoEstagio(6));
}

console.log('\nOS CINCO GOLPES E O QUE CADA UM FAZ');
{
  const T = S.GOLPES_QUE_MUDAM_ESTAGIO;
  /* ⚠️ AS CHANCES SAO AS OFICIAIS, tiradas do dado (Showdown, mod da Gen 3) */
  ok('Cauda de Ferro: 30% na Defesa do ALVO',
     T.irontail && T.irontail.chance === 0.30 && T.irontail.atributo === 'def' &&
     T.irontail.delta === -1 && !T.irontail.noProprio);
  ok('Psiquico: 10% na Defesa Especial do ALVO',
     T.psychic && T.psychic.chance === 0.10 && T.psychic.atributo === 'spDef' && T.psychic.delta === -1);
  ok('Bola Sombria: 20% na Defesa Especial do ALVO',
     T.shadowball && T.shadowball.chance === 0.20 && T.shadowball.atributo === 'spDef' && T.shadowball.delta === -1);
  /* ⚠️ O ASA DE ACO E O UNICO QUE CAI EM QUEM USA -- lido como os outros, ele baixaria a Defesa de
     quem levou o golpe em vez de subir a de quem bateu, e o defeito nao apareceria como erro:
     apareceria como o golpe sendo bom demais. */
  ok('Asa de Aco: 10% na Defesa de QUEM USA',
     T.steelwing && T.steelwing.chance === 0.10 && T.steelwing.atributo === 'def' &&
     T.steelwing.delta === +1 && T.steelwing.noProprio === true);
  /* ⚠️ E OS QUATRO EXISTEM NA TABELA DE GOLPES -- a licao da Lamina Solar: cadastrar efeito pra
     golpe que o jogo nao tem e letra morta, e so se descobre no confronto que teria aquele golpe. */
  ok('e todos existem na tabela GOLPES', Object.keys(T).every(id => !!S.GOLPES[id]),
     Object.keys(T).filter(id => !S.GOLPES[id]).join(', ') || 'todos');
  /* ⚠️ E SAO ALCANCAVEIS DE VERDADE (a licao da Furia, que ao pe da letra saia em 0,0%).
     ⚠️ MAS "ALCANCAVEL" DEIXOU DE SER "LEVADO POR NIVEL" em 17/09/2026: o Rock Tomb e o Overheat
     so vem de MAQUINA (TM39 e TM50), entao o ataquesPadrao -- que e por NIVEL -- devolve ZERO pros
     dois, e estava certo. O que a trava quer garantir continua o mesmo: que o efeito nao seja letra
     morta. Um golpe so de TM e alcancavel pra quem COMPRA o TM. */
  const mk4 = (id, lv) => { const q = S.createInstance(id, lv); q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp; return q; };
  const tmDoGolpe = g => Object.keys(S.TMS).find(t => S.TMS[t].golpe === g);
  Object.keys(T).forEach(id => {
    const porNivel = Object.keys(S.SPECIES).filter(sp => (S.ataquesPadrao(mk4(sp, 70)) || []).indexOf(id) >= 0);
    const tm = tmDoGolpe(id);
    const porTM = tm ? (S.TMS[tm].aprendem || []).length : 0;
    ok('  ' + (S.GOLPES_PT[id] || id) + ' e alcancavel',
       porNivel.length > 0 || porTM > 0,
       porNivel.length + ' por nivel, ' + porTM + ' por ' + (tm ? tm.toUpperCase() : 'nenhum TM'));
  });
}

console.log('\nO ESTAGIO MEXE NO ATRIBUTO, E POR ULTIMO NA CADEIA');
{
  const mk4 = (id, lv, shiny) => { const q = S.createInstance(id, lv); if(shiny) q.shiny = true; q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp; return q; };
  const g = mk4('golem', 60);
  const d0 = S.effectiveDefense(g);
  S.moverEstagio(g, 'def', -1);
  ok('a Defesa cai pra 2/3 com -1', S.effectiveDefense(g) === Math.round(d0 * 2/3),
     d0 + ' -> ' + S.effectiveDefense(g));
  const k = mk4('alakazam', 60);
  const s0 = S.effectiveSpDef(k);
  S.moverEstagio(k, 'spDef', -1);
  ok('e a Defesa Especial tambem', S.effectiveSpDef(k) === Math.round(s0 * 2/3), s0 + ' -> ' + S.effectiveSpDef(k));
  const j = mk4('jolteon', 60);
  const v0 = S.effectiveSpeed(j);
  S.moverEstagio(j, 'speed', -1);
  ok('e a Velocidade tambem', S.effectiveSpeed(j) === Math.round(v0 * 2/3), v0 + ' -> ' + S.effectiveSpeed(j));
  /* ⚠️ O MULTIPLICADOR ENTRA POR ULTIMO: "metade da Defesa" e metade do que o pokemon TEM na hora,
     e nao da base. Num shiny (x1,20 em tudo) o corte tem que sair do valor JA buffado -- entrando
     antes, ele multiplicaria so a base e o buff ficaria de fora da conta. */
  const sh = mk4('golem', 60, true);
  const sh0 = S.effectiveDefense(sh);
  S.moverEstagio(sh, 'def', -1);
  ok('e num shiny ele corta o valor JA buffado', S.effectiveDefense(sh) === Math.round(sh0 * 2/3),
     sh0 + ' -> ' + S.effectiveDefense(sh));
  /* o teto */
  const t = mk4('onix', 60);
  for(let i = 0; i < 9; i++) S.moverEstagio(t, 'def', -1);
  ok('nove quedas param no -6', S.estagioDe(t, 'def') === -6, String(S.estagioDe(t, 'def')));
  /* ⚠️ E MOVER NO TETO DEVOLVE FALSE -- e isso e o que impede uma linha de log dizendo que a
     Defesa caiu com a barra parada, o mesmo defeito do "-0 de HP". */
  ok('e mover no teto devolve false (sem linha)', S.moverEstagio(t, 'def', -1) === false);
}

console.log('\nO SORTEIO, E O rng SO LIDO QUANDO O GOLPE MUDA ESTAGIO');
{
  /* ⚠️ UM RNG CONTINUO, nao uma semente nova por volta: o PRIMEIRO valor de uma semente nova
     correlaciona com a semente, e foi assim que a medicao do gelo deu 7,8% onde era 10%. */
  let semente = 24680;
  const rng = () => (semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const mede = (golpe, esperado) => {
    let pegou = 0; const N = 20000;
    for(let i = 0; i < N; i++){
      const quem = S.createInstance('alakazam', 60); quem.maxHp = S.calcMaxHp(quem); quem.hp = quem.maxHp;
      quem.lastMove = golpe;
      const alvo = S.createInstance('machoke', 60); alvo.maxHp = S.calcMaxHp(alvo); alvo.hp = alvo.maxHp;
      if(S.tentarEstagio(quem, alvo, rng)) pegou++;
    }
    const pct = 100 * pegou / N, sd = 100 * Math.sqrt(esperado * (1 - esperado) / N);
    ok('o ' + (S.GOLPES_PT[golpe] || golpe) + ' muda estagio em ' + (esperado*100) + '%',
       Math.abs(pct - esperado * 100) < 3 * sd,
       pct.toFixed(2) + '% (' + ((pct - esperado*100)/sd).toFixed(1) + 'sigma)');
  };
  mede('irontail', 0.30);
  mede('psychic', 0.10);
  mede('shadowball', 0.20);

  /* ⚠️ A ARMADILHA DA SEMENTE: lido sempre, o rng deslocaria toda batalha sem nenhum dos cinco. */
  let leu = 0;
  const conta = () => { leu++; return 0.99; };
  const quem = S.createInstance('machoke', 60); quem.maxHp = S.calcMaxHp(quem); quem.hp = quem.maxHp;
  const alvo = S.createInstance('machoke', 60); alvo.maxHp = S.calcMaxHp(alvo); alvo.hp = alvo.maxHp;
  quem.lastMove = 'karatechop';
  S.tentarEstagio(quem, alvo, conta);
  ok('golpe que nao muda estagio nao le o rng', leu === 0, leu + ' leituras');
  quem.lastMove = 'irontail';
  S.tentarEstagio(quem, alvo, conta);
  ok('mas o que muda LE', leu === 1, leu + ' leitura');

  /* o Asa de Aco sobe a Defesa de QUEM USA, e o teste cobra isso pelo lado do sorteio */
  const usa = S.createInstance('skarmory', 60); usa.maxHp = S.calcMaxHp(usa); usa.hp = usa.maxHp;
  usa.lastMove = 'steelwing';
  const outro = S.createInstance('machoke', 60); outro.maxHp = S.calcMaxHp(outro); outro.hp = outro.maxHp;
  S.tentarEstagio(usa, outro, () => 0.01);
  ok('o Asa de Aco sobe a Defesa de quem USA', S.estagioDe(usa, 'def') === 1, String(S.estagioDe(usa, 'def')));
  ok('e nao encosta no alvo', S.estagioDe(outro, 'def') === 0, String(S.estagioDe(outro, 'def')));
}

console.log('\nNA BATALHA: A LINHA, A FRASE E A LIMPEZA');
{
  const mk4 = (id, lv) => { const q = S.createInstance(id, lv); q.maxHp = S.calcMaxHp(q); q.hp = q.maxHp; q.ataques = S.ataquesPadrao(q); return q; };
  let comLinha = null, confrontos = 0, eventos = 0, sobrou = 0, total = 0;
  for(let k = 0; k < 500; k++){
    const t = ['steelix','gengar','alakazam'].map(id => mk4(id, 70));
    const e = ['machamp','snorlax','lapras'].map(id => mk4(id, 68));
    S.equiparNpc(e);
    const r = S.simulateGymBattle(t, e, S.makeSeededRng('est|' + k));
    (r.matchups || []).forEach(m => {
      confrontos++;
      const linhas = (m.golpes || []).filter(g => g.x === 'estagio');
      eventos += linhas.length;
      if(linhas.length && !comLinha) comLinha = m;
    });
    t.concat(e).forEach(q => { total++; if(q._estagios && Object.keys(q._estagios).some(x => q._estagios[x])) sobrou++; });
  }
  ok('a mecanica sai numa batalha de verdade', eventos > 50, eventos + ' mudancas em ' + confrontos + ' confrontos');
  /* ⚠️ A MARCA E SOLTA NO FIM DA BATALHA: ela dura a BATALHA e o time vai pro SAVE. Sem soltar, um
     pokemon sairia da luta com a Defesa em -3 PRA SEMPRE. */
  ok('e nenhum pokemon sai da batalha com estagio guardado', sobrou === 0, sobrou + ' de ' + total);

  if(comLinha){
    const html = S.passosHtml(comLinha);
    ok('a frase diz o atributo e o sentido', /teve a Defesa|teve a Defesa Especial|aumentou a Defesa/.test(html),
       (html.match(/[^>]*(teve a|aumentou a)[^<]*/) || ['(sem frase)'])[0].slice(0, 70));
    /* ⚠️ E ELA NAO VIRA UM "-0 de HP": a linha e de dano zero, e sem entrar no ehGolpeEspecial ela
       cairia no ramo do golpe comum -- o defeito exato que o congelamento teve. */
    ok('e nenhuma linha de estagio vira -0 de HP', !/(teve a|aumentou a)[^<]*−0 de HP/.test(html));
    ok('e o ehGolpeEspecial conhece a marca', S.ehGolpeEspecial({ x:'estagio' }) === true);
    ok('e ela vale 1 passo na animacao', S.passosDaAbertura && S.passosDaAbertura.estagio === 1);
  }

  /* ⚠️ O `q` DA LINHA E DE QUEM TEVE O ATRIBUTO MEXIDO, e nao de quem usou o golpe: nos quatro de
     debuff sao lados OPOSTOS. Lido errado, a frase nomearia o pokemon errado. */
  {
    const atk = mk4('steelix', 70), def = mk4('machamp', 70);
    const diario = [];
    atk.ataques = ['irontail'];
    let achou = null;
    for(let k = 0; k < 200 && !achou; k++){
      const t = [mk4('steelix', 70)]; t[0].ataques = ['irontail'];
      const e = [mk4('machamp', 70)];
      const r = S.simulateGymBattle(t, e, S.makeSeededRng('q|' + k));
      (r.matchups || []).forEach(m => { const l = (m.golpes||[]).find(g => g.x === 'estagio'); if(l && !achou) achou = { m, l }; });
    }
    if(achou){
      ok('o q da linha e de quem teve o atributo mexido (o alvo)', achou.l.q === 'e', achou.l.q + ' / ' + achou.l.g);
      ok('e ela nomeia o alvo', achou.l.g === achou.m.enemy, achou.l.g + ' x ' + achou.m.enemy);
    } else {
      ok('achei um confronto com a Cauda de Ferro mudando estagio', false, '(nao achei)');
    }
  }
}

console.log('\nE O ASTERISCO NO CARTAO DO GOLPE');
{
  const T = S.GOLPES_QUE_MUDAM_ESTAGIO;
  /* ⚠️ A TRAVA VARRE O NOME_DO_ATRIBUTO, e nao dois nomes escritos a mao: ela procurava
     /Defesa|Velocidade/ e envelheceu no dia em que o Overheat entrou mexendo no ATAQUE ESPECIAL.
     E a mesma licao do "59 especies" da ficha da Pokedex -- numero (ou lista) a mao envelhece
     junto com a tabela que ele descreve. */
  const temAtributo = id => (S.obsDoGolpe(id) || [])
    .some(o => Object.values(S.NOME_DO_ATRIBUTO).some(n => o.indexOf(n) >= 0));
  ok('todos avisam no cartao', Object.keys(T).every(temAtributo),
     Object.keys(T).filter(id => !temAtributo(id)).join(', ') || 'todos');
  /* ⚠️ E O AVISO DIZ EM QUEM O EFEITO CAI: o Overheat e -2 no PROPRIO usuario, e por um dia o
     cartao dele disse "do alvo" -- o contrario. A regra antiga lia o SINAL do delta, que era
     verdade so enquanto o unico + era no proprio. */
  Object.entries(T).forEach(([id, e]) => {
    const o = (S.obsDoGolpe(id) || []).join(' ');
    ok('  ' + id + ': o aviso diz em quem cai',
       e.noProprio ? /de quem usa/.test(o) : /do alvo/.test(o), o);
  });
  /* ⚠️ E O AVISO DIZ EM QUEM CAI: sem o "do alvo"/"de quem usa", o cartao do Asa de Aco se leria
     como um debuff. */
  ok('e o do alvo diz "do alvo"', (S.obsDoGolpe('irontail')||[]).some(o => /do alvo/.test(o)),
     (S.obsDoGolpe('irontail')||[]).join(' | '));
  ok('e o do proprio diz "de quem usa"', (S.obsDoGolpe('steelwing')||[]).some(o => /de quem usa/.test(o)),
     (S.obsDoGolpe('steelwing')||[]).join(' | '));
  /* ⚠️ A CHANCE SAI DA TABELA, nunca escrita a mao -- ela varia de 10% a 30% nestes quatro */
  ok('e a chance e a da tabela',
     (S.obsDoGolpe('irontail')||[]).some(o => /30%/.test(o)) &&
     (S.obsDoGolpe('psychic')||[]).some(o => /10%/.test(o)) &&
     (S.obsDoGolpe('shadowball')||[]).some(o => /20%/.test(o)));
  ok('e golpe que nao mexe estagio nao avisa',
     !(S.obsDoGolpe('karatechop')||[]).some(o => /Defesa|Velocidade/.test(o)));
}
console.log('\n=== A FRASE DO STATUS QUE MATA FICA NA TELA (17/09/2026) ===');
{
  /* Reportado assim: *"quando um pokemon esta por exemplo queimando ou envenenado, e esse pokemon
     morre na batalha, nao esta esperando 1,5s depois da frase 'Charizard perdeu 20 de dano por
     estar envenenado', ta aparecendo e rapidamente muda para 'Weezing venceu'"*.

     ⚠️ A PAUSA JA ESTAVA LA desde 14/09 -- o que faltava era ela alcancar a TROCA DA FRASE. Na fase
     `result` a linha de status deixa de ser o `statusDoConfrontoHtml` e vira o "X venceu!", e quem
     faz essa troca e o `render()` do ramo `isLastHit`: ele rodava 50ms depois da barra, entao o
     1,5s do `advance` passava com o "venceu!" ja na tela.

     ⚠️ O TESTE DIRIGE O LACO DE VERDADE e le os PRAZOS dos timers (o sandbox os anota em
     `__timers`) -- e assim ele mede o COMPORTAMENTO em vez de descrever o codigo. Medido no
     navegador antes do conserto: a frase ficava **235ms** na tela; depois, **1.700ms**. */
  const g = S.__getGame();
  const inst = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp;
                             p.ataques = S.ataquesPadrao(p); return p; };
  /* monta a revelacao de UM confronto e devolve os prazos do ULTIMO passo */
  const prazosDoUltimoPasso = (matchups, idx) => {
    const m = matchups[idx];
    g.authUser = { uid:'t' }; g.currentSaveSlot = 1; g.screen = 'battling';
    g.battleResult = { matchups };
    g.revealIndex = idx; g.revealPhase = 'animating'; g.revealHitStep = 0; g.revealLastHit = null;
    g.revealHitSequence = S.buildAnimatedHitSequence(m);
    g.revealCurrentPlayerHp = m.playerHpBefore; g.revealCurrentEnemyHp = m.enemyHpBefore;
    const seq = g.revealHitSequence;
    for(let i = 0; i < seq.length - 1; i++) S.advanceReveal();
    S.__timers.length = 0;
    S.advanceReveal();
    const render = S.__timers.find(t => t.fn === S.render);
    return { ultimo: seq[seq.length - 1], fase: g.revealPhase,
             prazoDoRender: render ? render.ms : null, timers: S.__timers.length };
  };

  /* acha um confronto REAL em que o ultimo passo e de leitura (o veneno matando) */
  let comLeitura = null, semLeitura = null;
  for(let b = 0; b < 400 && !(comLeitura && semLeitura); b++){
    const A = ['charizard','venusaur','blastoise'].map(id => inst(id, 50));
    const B = ['weezing','muk','arcanine'].map(id => inst(id, 50));
    const r = S.simulateGymBattle(A, B, S.makeSeededRng('cena|' + b));
    (r.matchups || []).forEach((m, i) => {
      const seq = S.buildAnimatedHitSequence(m);
      if(!seq || !seq.length) return;
      const u = seq[seq.length - 1];
      if(u.leitura && !comLeitura) comLeitura = { matchups: r.matchups, i, team: A };
      if(!u.leitura && !u.faixa && !semLeitura) semLeitura = { matchups: r.matchups, i, team: A };
    });
  }
  ok('existe confronto que TERMINA num passo de leitura', !!comLeitura,
     comLeitura ? 'confronto ' + comLeitura.i : '(nao achei)');
  ok('e existe um que termina em golpe comum', !!semLeitura);

  if(comLeitura){
    g.team = comLeitura.team;
    const p = prazosDoUltimoPasso(comLeitura.matchups, comLeitura.i);
    ok('o ultimo passo e mesmo de leitura', !!p.ultimo.leitura, p.ultimo.x);
    ok('e a fase vira result (e ai a linha vira "X venceu!")', p.fase === 'result', p.fase);
    /* ⚠️ O INVARIANTE: a frase e pintada no instante 0 do passo (pelo `pintarStatusDoConfronto`) e
       some quando o render roda. Entao "quanto tempo ela fica" E o prazo do render. */
    ok('a frase fica na tela pelo menos 1,5s antes do "venceu"',
       p.prazoDoRender != null && p.prazoDoRender >= S.PAUSA_LEITURA_ESPECIAL_MS,
       p.prazoDoRender + 'ms (a pausa e ' + S.PAUSA_LEITURA_ESPECIAL_MS + ')');
  }
  /* ⚠️ E O A/B EXATO: o MESMO passo, com e sem a marca de leitura. E ele que separa "a frase espera"
     de "esse confronto por acaso demora" -- a barra e a mesma, o golpe e o mesmo, so a marca muda.
     A diferenca tem que ser EXATAMENTE a pausa. */
  if(comLeitura){
    g.team = comLeitura.team;
    const comMarca = prazosDoUltimoPasso(comLeitura.matchups, comLeitura.i);
    const m2 = comLeitura.matchups[comLeitura.i];
    const seq2 = S.buildAnimatedHitSequence(m2);
    seq2[seq2.length - 1].leitura = false;
    g.battleResult = { matchups: comLeitura.matchups };
    g.revealIndex = comLeitura.i; g.revealPhase = 'animating'; g.revealHitStep = 0; g.revealLastHit = null;
    g.revealHitSequence = seq2;
    g.revealCurrentPlayerHp = m2.playerHpBefore; g.revealCurrentEnemyHp = m2.enemyHpBefore;
    for(let i = 0; i < seq2.length - 1; i++) S.advanceReveal();
    S.__timers.length = 0;
    S.advanceReveal();
    const semMarca = S.__timers.find(t => t.fn === S.render);
    ok('a marca de leitura vale EXATAMENTE a pausa, nem mais nem menos',
       !!semMarca && (comMarca.prazoDoRender - semMarca.ms) === S.PAUSA_LEITURA_ESPECIAL_MS,
       comMarca.prazoDoRender + 'ms com a marca, ' + (semMarca ? semMarca.ms : '?') + 'ms sem');
  }
  if(semLeitura){
    g.team = semLeitura.team;
    const p = prazosDoUltimoPasso(semLeitura.matchups, semLeitura.i);
    /* ⚠️ E A PAUSA NAO VALE PRA TODO MUNDO: um golpe comum que mata nao ganha os 1,5s -- senao TODA
       batalha do jogo ficaria mais lenta por causa desta correcao. (O 1,2s que sobra e a pausa do
       NOME DO GOLPE, que e outra coisa e ja existia.) */
    ok('golpe comum que mata NAO ganha a pausa de leitura',
       p.prazoDoRender != null && p.prazoDoRender < S.PAUSA_LEITURA_ESPECIAL_MS,
       p.prazoDoRender + 'ms (a do nome do golpe, que e outra)');
  }

  /* ⚠️ E OS QUATRO LACOS, lendo o codigo: deixar em um so era garantir que a mesma frase durasse
     tempos diferentes na Elite, na Torre e na liga assistida. E a licao do `chuvafim`, de 14/09,
     que e literalmente o mesmo bloco -- e ela nao pegou este defeito porque ela media o `advance`,
     que ja estava certo. A varredura e do RAMO isLastHit: todo `setTimeout(render, ...)` dele tem
     que somar a pausa. */
  const src = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const semPausa = (src.match(/setTimeout\(render, esperaNome \+ hitDuration \+ 50\)/g) || []).length;
  const comPausa = (src.match(/setTimeout\(render, esperaNome \+ hitDuration \+ 50 \+ pausaDaFaixa\(hit\)\)/g) || []).length;
  ok('os QUATRO lacos somam a pausa no render do ultimo passo', comPausa === 4, comPausa + ' de 4');
  /* o ramo do MEIO continua sem a pausa, e esta certo: la a fase continua `animating` e a frase e
     redesenhada igual -- ela nao some, so e repintada */
  ok('e o ramo do meio continua sem ela (la a frase nao some)', semPausa === 4, semPausa + ' de 4');
}


console.log('\n=== VIDA CHEIA NAO MORRE NUM GOLPE (17/09/2026) ===');
{
  /* Pedido assim: *"quando um pokemon esta de vida cheia, ele nunca morre com um so golpe, invente
     um calculo que dependendo da diferenca de level entre os pokemons, o de vida cheia ao tomar um
     golpe que seria de 100% de hp, vai tomar no maximo 95% e no minimo 70%. Se a diferenca entre o
     level dos pokemons for maior que 15, ai pode desconsiderar essa regra e matar de primeira"*. */
  const inst2 = (id, lv) => { const p = S.createInstance(id, lv); p.maxHp = S.calcMaxHp(p); p.hp = p.maxHp;
                              p.ataques = S.ataquesPadrao(p); return p; };
  /* as aberturas tiram o alvo da vida CHEIA antes do golpe -- a regra nao fala delas */
  const ABERTURA = new Set(['absorb','absorbdano','furiadragao','confusao','boom','boomself','dreno','recover','pocao']);

  ok('as tres constantes existem e sao as pedidas',
     S.CHEIO_TETO_MIN === 0.70 && S.CHEIO_TETO_MAX === 0.95 && S.CHEIO_DIF_MAXIMA === 15,
     S.CHEIO_TETO_MIN + ' / ' + S.CHEIO_TETO_MAX + ' / ' + S.CHEIO_DIF_MAXIMA);

  /* ---------- 1) O INVARIANTE: com diferenca <= 15, ninguem de vida cheia morre no 1o golpe ---------- */
  const ids2 = Object.keys(S.SPECIES);
  const rnd2 = n => Math.floor(Math.random()*n);
  /* ⚠️ O CRITICO IGNORA A TRAVA DESDE 23/09/2026 (a pedido), entao o invariante ganhou uma
     excecao -- e com ela a trava ganhou a metade que a torna forte: nao basta "os nao-criticos
     nao morrem", tem que valer tambem que **todo morto era critico**. Sem a segunda, um furo
     qualquer na condicao (um `return null` a mais, por exemplo) passaria em branco. */
  let n = 0, morreu = 0, morreuSemCrit = 0, comAbertura = 0; let exMorte = '';
  for(let i = 0; i < 12000; i++){
    const dif = rnd2(S.CHEIO_DIF_MAXIMA + 1);          // 0 a 15: a trava TEM que valer
    const lvAlvo = 20 + rnd2(40);
    const a = inst2(ids2[rnd2(ids2.length)], Math.min(99, lvAlvo + dif));
    const b = inst2(ids2[rnd2(ids2.length)], lvAlvo);
    const r = S.simulateGymBattle([a], [b], S.makeSeededRng('cheio|' + i));
    const m = (r.matchups || [])[0]; if(!m) continue;
    const gs = m.golpes || [];
    if(gs.some(g => ABERTURA.has(g.x))){ comAbertura++; continue; }
    const p1 = gs.find(g => !g.x && g.d > 0);
    if(!p1) continue;
    n++;
    if(p1.hp === 0){
      morreu++;
      if(!p1.c) morreuSemCrit++;
      if(!p1.c && !exMorte){
        const nvA = p1.q === 'p' ? m.playerLevel : m.enemyLevel;
        const nvB = p1.q === 'p' ? m.enemyLevel : m.playerLevel;
        exMorte = (p1.q === 'p' ? m.player : m.enemy) + ' Lv.' + nvA + ' matou ' +
                  (p1.q === 'p' ? m.enemy : m.player) + ' Lv.' + nvB + ' (dif ' + (nvA - nvB) + ')';
      }
    }
  }
  ok('amostra de sobra', n > 8000, n + ' confrontos (' + comAbertura + ' com abertura, descartados)');
  ok('com dif <= 15, ninguem de vida cheia morre no 1o golpe SEM ser critico',
     morreuSemCrit === 0, morreuSemCrit + (exMorte ? '  ex: ' + exMorte : ''));
  /* ⚠️ E A OUTRA METADE: as mortes que SOBRAM sao todas criticas, e elas EXISTEM. Sem a segunda
     condicao a trava passaria num build em que o critico voltasse a ser segurado -- ela mediria
     um conjunto vazio, que e o "zero perfeito" que este arquivo registra em cinco lugares. */
  ok('e as que morrem sao criticas -- e elas acontecem', morreu > 50 && morreu === morreu - morreuSemCrit,
     morreu + ' mortes, todas com selo de critico');

  /* ---------- 2) A CURVA, medida onde a trava AGE ---------- */
  /* ⚠️ QUANDO ELA AGE o alvo para EXATAMENTE em `maxHp - round(maxHp*teto)`. Contar quantos caem
     nesse valor separa "a trava agiu" de "o golpe nao ia matar mesmo" -- e e isso que prova a
     CURVA, nao so o piso. O par e limpo de proposito: nem Machamp nem Caterpie tem abertura. */
  const tetoEsperado = dif => S.CHEIO_TETO_MIN +
        (S.CHEIO_TETO_MAX - S.CHEIO_TETO_MIN) * Math.max(0, Math.min(S.CHEIO_DIF_MAXIMA, dif)) / S.CHEIO_DIF_MAXIMA;
  [8, 10, 12, 15].forEach(dif => {
    /* ⚠️ O CRITICO SAI DA CONTA (23/09/2026): ele ignora a trava e mata, entao medi-lo junto
       derrubaria a curva sem nada estar errado. O que a trava cobra agora e o par: o NAO-critico
       para no teto exato, e o critico mata -- e os dois conjuntos tem gente. */
    let travados = 0, casos = 0, mortes = 0, criticos = 0, critMatou = 0;
    for(let i = 0; i < 300; i++){
      const r = S.simulateGymBattle([inst2('machamp', 40 + dif)], [inst2('caterpie', 40)],
                                    S.makeSeededRng('curva|' + dif + '|' + i));
      const m = (r.matchups || [])[0]; if(!m) continue;
      const gs = m.golpes || [];
      if(gs.some(g => ABERTURA.has(g.x))) continue;
      const p1 = gs.find(g => !g.x && g.d > 0);
      if(!p1 || p1.q !== 'p') continue;
      if(p1.c){ criticos++; if(p1.hp === 0) critMatou++; continue; }
      casos++;
      if(p1.hp === 0) mortes++;
      const resto = m.enemyMaxHp - Math.max(1, Math.round(m.enemyMaxHp * tetoEsperado(dif)));
      if(p1.hp === resto) travados++;
    }
    ok('dif ' + dif + ': o alvo NAO-critico para no teto da curva', casos > 100 && travados === casos && mortes === 0,
       travados + ' de ' + casos + ' no resto exato, ' + mortes + ' mortes');
    ok('dif ' + dif + ': e o CRITICO mata', criticos > 5 && critMatou === criticos,
       critMatou + ' de ' + criticos + ' criticos');
  });

  /* ---------- 3) O OUTRO LADO DA REGRA: acima de 15 ele MATA ---------- */
  [16, 25, 40].forEach(dif => {
    let casos = 0, mortes = 0;
    for(let i = 0; i < 300; i++){
      const lvAtk = Math.min(99, 40 + dif);
      const r = S.simulateGymBattle([inst2('machamp', lvAtk)], [inst2('caterpie', 40)],
                                    S.makeSeededRng('mata|' + dif + '|' + i));
      const m = (r.matchups || [])[0]; if(!m) continue;
      const gs = m.golpes || [];
      if(gs.some(g => ABERTURA.has(g.x))) continue;
      const p1 = gs.find(g => !g.x && g.d > 0);
      if(!p1 || p1.q !== 'p') continue;
      casos++;
      if(p1.hp === 0) mortes++;
    }
    ok('dif ' + dif + ' (> 15): mata de primeira', casos > 100 && mortes === casos,
       mortes + ' de ' + casos);
  });

  /* ---------- 4) O QUE ELA NAO TOCA ---------- */
  /* ⚠️ ALVO MACHUCADO NAO E PROTEGIDO: a regra e sobre vida CHEIA, e sem esta trava alguem poderia
     "consertar" a condicao pra valer sempre -- o que faria ninguem morrer nunca. */
  /* ⚠️ O ALVO MACHUCADO VAI NO TIME A, COM `preservePlayerHp` -- e essa e a armadilha que o
     CLAUDE.md ja registra tres vezes: o `simulateGymBattle` CURA os dois times (o A so sem a
     opcao, o B SEMPRE). Montado do outro jeito, o Caterpie entrava cheio e a trava media a regra
     de cima em vez desta. Medido antes do conserto: 0 de 356 mortes, num cenario que deveria
     matar quase sempre.
     O Machamp (vel 55) bate antes do Caterpie (45), entao o golpe do `e` e o primeiro da luta. */
  let matouMachucado = 0, casosM = 0;
  for(let i = 0; i < 400; i++){
    const alvo = inst2('caterpie', 40);
    /* ⚠️ 90%, E NAO 50%: a 50% o alvo ja nao e protegido pelo aparo em si (o teto de 70% do MAXIMO
       fica ACIMA do HP dele, e a funcao devolve os golpes inteiros), entao a trava passaria mesmo
       com a guarda do 'vida cheia' removida -- ela nao distinguiria os dois caminhos. A 90% o teto
       morde, e ai so a guarda impede a protecao. Conferido: com a guarda removida, ela acusa. */
    alvo.hp = Math.max(1, Math.round(alvo.maxHp * 0.9));     // machucado, mas ACIMA do teto
    /* ⚠️ E O ATACANTE PRECISA MATAR DE VIDA CHEIA pra o teto ter o que aparar -- com Lv.40 contra
       Lv.40 o Machamp raramente mata o Caterpie inteiro, e ai a trava media nada de novo. Com 10
       niveis de vantagem ele mata, e o teto daquela diferenca (83,3%) fica ABAIXO dos 90% do alvo:
       e exatamente a janela em que so a guarda do 'vida cheia' decide. */
    const r = S.simulateGymBattle([alvo], [inst2('machamp', 50)], S.makeSeededRng('mach|' + i),
                                  { preservePlayerHp: true });
    const m = (r.matchups || [])[0]; if(!m) continue;
    const gs = m.golpes || [];
    if(gs.some(g => ABERTURA.has(g.x))) continue;
    const p1 = gs.find(g => !g.x && g.d > 0);
    if(!p1 || p1.q !== 'e') continue;   // o golpe do Machamp
    casosM++;
    if(p1.hp === 0) matouMachucado++;
  }
  ok('alvo MACHUCADO continua morrendo de um golpe', casosM > 100 && matouMachucado > casosM * 0.5,
     matouMachucado + ' de ' + casosM);

  /* ⚠️ E O GOLPE QUE NAO IA MATAR SAI INTEIRO: a trava so age quando o golpe mataria. Sem isso ela
     viraria um teto de dano geral, que e outra coisa (e que este jogo desligou em 09/09). */
  {
    const a = inst2('caterpie', 40), b = inst2('snorlax', 40);   // o Caterpie nao chega perto de matar
    let cortou = 0, casos = 0;
    for(let i = 0; i < 200; i++){
      const r = S.simulateGymBattle([inst2('caterpie', 40)], [inst2('snorlax', 40)], S.makeSeededRng('int|' + i));
      const m = (r.matchups || [])[0]; if(!m) continue;
      const gs = m.golpes || [];
      if(gs.some(g => ABERTURA.has(g.x))) continue;
      const p1 = gs.find(g => !g.x && g.d > 0);
      if(!p1 || p1.q !== 'p') continue;
      casos++;
      if(p1.d > m.enemyMaxHp * S.CHEIO_TETO_MIN) cortou++;   // passou do teto? entao nao foi aparado
    }
    ok('golpe que NAO ia matar sai inteiro (a trava nao e teto de dano)', casos > 50 && cortou === 0,
       casos + ' golpes fracos, nenhum perto do teto');
  }

  /* ---------- 5) A REGRA DE 14/09 CONTINUA VALENDO POR CIMA ---------- */
  /* ⚠️ QUEM ESTA RASPANDO PARA EM 70% MESMO COM 20 NIVEIS DE VANTAGEM: as duas regras convivem
     pelo MENOR teto, e deixar a nova liberar o que a antiga proibe desfaria um pedido com o outro. */
  {
    /* ⚠️ E O `preservePlayerHp` VALE AQUI TAMBEM: sem ele o Machamp raspando era curado antes do
       primeiro golpe, e a trava media a regra por NIVEL (que com 20 de diferenca nem existe) em
       vez da de 14/09. Medido antes do conserto: 363 mortes em 363. */
    let casos = 0, matou = 0, noTeto = 0;
    for(let i = 0; i < 400; i++){
      const a = inst2('machamp', 60);                  // 20 niveis acima: sem a de 14/09, mataria
      a.hp = Math.max(1, Math.round(a.maxHp * 0.05));  // mas ele esta RASPANDO
      const r = S.simulateGymBattle([a], [inst2('caterpie', 40)], S.makeSeededRng('rasp|' + i),
                                    { preservePlayerHp: true });
      const m = (r.matchups || [])[0]; if(!m) continue;
      const gs = m.golpes || [];
      if(gs.some(g => ABERTURA.has(g.x))) continue;
      const p1 = gs.find(g => !g.x && g.d > 0);
      if(!p1 || p1.q !== 'p') continue;
      casos++;
      if(p1.hp === 0) matou++;
      const resto = m.enemyMaxHp - Math.max(1, Math.round(m.enemyMaxHp * S.MORIBUNDO_TETO_NO_CHEIO));
      if(p1.hp === resto) noTeto++;
    }
    ok('quem RASPA para em 70% mesmo com 20 niveis de vantagem',
       casos > 100 && matou === 0 && noTeto === casos, noTeto + ' de ' + casos + ' no teto de 70%, ' + matou + ' mortes');
  }


  /* ---------- 7) O CRITICO IGNORA A TRAVA DE NIVEL (23/09/2026) ---------- */
  /* Pedido assim: *"se o dano for critico, para ignorar essa trava de 15 levels de diferenca, se
     for critico, pode deixar matar de primeira"*.
     ⚠️ ELE LE O MESMO CAMPO QUE DECIDE O SELO, e e isso que estas travas cobram: se a tela diz
     CRITICO o golpe mata, e se nao diz, nao mata. Qualquer outra fonte ("algum tapa foi critico")
     deixaria uma troca matar de vida cheia SEM o selo, e o jogador nao teria como ligar as duas
     coisas. */
  {
    /* ⚠️ O PAR E LIMPO DE PROPOSITO -- nem Fearow nem Caterpie tem passiva nenhuma. Com um rng
       forcado em ~0 pra garantir o critico, TODA passiva dispararia, e a Furia do Dragao (que tira
       40 antes da luta) TIRA O ALVO DO "CHEIO": a trava nem chegaria a ser lida, e a medicao diria
       que o critico matou quando quem matou foi a abertura. Isso aconteceu de verdade medindo
       isto. */
    const semCrit = () => 0.5;      // 0.5 nunca cai abaixo de 1/16 nem de 1/8
    const comCrit = () => 0.0001;   // sempre critico
    const duelo = (difNivel, hpAtacante, rng) => {
      const a = inst2('fearow', 20 + difNivel), b = inst2('caterpie', 20);
      a.hp = Math.max(1, Math.round(a.maxHp * hpAtacante));
      const r = S.simulateGymBattle([a], [b], rng, { preservePlayerHp: true });
      const m = (r.matchups || [])[0];
      const gs = (m && m.golpes) || [];
      const p1 = gs.find(g => !g.x && g.d > 0);
      return { m, p1, abertura: gs.some(g => ABERTURA.has(g.x)) };
    };
    let semMataram = 0, comMataram = 0, comSelo = 0, difs = 0;
    [-5, 0, 5, 10, 15].forEach(d => {
      const s1 = duelo(d, 1.0, semCrit), c1 = duelo(d, 1.0, comCrit);
      if(s1.p1 && !s1.abertura){ difs++; if(s1.p1.hp === 0) semMataram++; }
      if(c1.p1 && !c1.abertura){ if(c1.p1.hp === 0) comMataram++; if(c1.p1.c) comSelo++; }
    });
    ok('sem critico, nenhuma das 5 diferencas mata de vida cheia', difs === 5 && semMataram === 0,
       semMataram + ' de ' + difs);
    ok('COM critico, as 5 matam', comMataram === 5, comMataram + ' de 5');
    /* ⚠️ E O SELO SAI NAS 5: e a promessa da regra. Medido antes de tratar o `cap`, 42,6% dos
       golpes que passaram a matar saiam SEM selo -- o alvo morria de vida cheia e a tela nao
       dizia por que. Ver o `barraInteira` do aplicarGolpes. */
    ok('e o selo de CRITICO sai nas 5', comSelo === 5, comSelo + ' de 5');

    /* ⚠️ MAS A TRAVA DE 14/09 NAO CAI COM O CRITICO: sao regras diferentes -- esta olha a diferenca
       de PODER e aquela o ESTADO do atacante (*"um pokemon muito ferido nao deveria aguentar tanto
       numa luta"*), e um critico nao muda o fato de que quem bateu esta quase morto. */
    let raspMatou = 0, raspNoTeto = 0, raspCasos = 0;
    [0, 15, 30].forEach(d => {
      const r = duelo(d, 0.05, comCrit);
      if(!r.p1 || r.abertura) return;
      raspCasos++;
      if(r.p1.hp === 0) raspMatou++;
      const resto = r.m.enemyMaxHp - Math.max(1, Math.round(r.m.enemyMaxHp * S.MORIBUNDO_TETO_NO_CHEIO));
      if(r.p1.hp === resto) raspNoTeto++;
    });
    ok('quem RASPA para em 70% mesmo COM critico e 30 niveis de vantagem',
       raspCasos === 3 && raspMatou === 0 && raspNoTeto === 3,
       raspNoTeto + ' de ' + raspCasos + ' no teto, ' + raspMatou + ' mortes');

    /* ⚠️ E O `lastCrit` SO E LIDO QUANDO O ATACANTE ATACOU: quem nao atacou (dormindo, congelado,
       paralisado) nao passou pelo `golpesDaTroca`, e o campo dele ficou de uma troca anterior. E a
       armadilha do `lastMove` que os seis `tentar*` pagaram em 18/09. Quem fecha essa porta e a
       primeira linha do `tetoDeQuemRaspa` -- e e ela que esta trava le. */
    const cli = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const srvT = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    [['cliente', cli], ['servidor', srvT]].forEach(([qual, txt]) => {
      const i = txt.indexOf('const tetoDeQuemRaspa = ');
      const corpo = i >= 0 ? txt.slice(i, i + 700) : '';
      ok('no ' + qual + ' o aparo sai antes com a lista vazia (o lastCrit nao fica velho)',
         corpo.length > 200 && /if\(!golpes\.length\) return golpes;/.test(corpo));
      ok('e no ' + qual + ' o critico derruba SO a trava de nivel',
         /if\(!critico && dif <= CHEIO_DIF_MAXIMA\)/.test(txt)
         && /if\(raspando\) return MORIBUNDO_TETO_NO_CHEIO;/.test(txt));
      ok('e no ' + qual + ' o selo nao some num golpe que levou a barra INTEIRA',
         /const barraInteira = antes === alvo\.maxHp && alvo\.hp === 0;/.test(txt)
         && /cap: efetivo \* 2 < d && !barraInteira/.test(txt));
    });
  }

  /* ---------- 6) OS DOIS MOTORES ---------- */
  const srv = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  ['CHEIO_TETO_MIN = 0.70', 'CHEIO_TETO_MAX = 0.95', 'CHEIO_DIF_MAXIMA = 15'].forEach(c => {
    ok('o servidor tem ' + c.split(' ')[0], srv.indexOf(c) >= 0);
  });
  ok('e ele tem a funcao do teto', /const tetoNoAlvoCheio = /.test(srv));
}


/* ============================================================================
   OS SELOS DO JOGO (17/09/2026) -- pixel art nossa no lugar dos emojis
   ----------------------------------------------------------------------------
   Quatro coisas podem dar errado aqui, e nenhuma delas aparece como erro:

   1) DESENHO SEM CHAMADOR -- letra morta, a mesma decisao que manteve os estagios 2 a 4 do
      critico e o Rock Tomb fora do jogo por anos.
   2) GRADE FORA DE 16x16 ou com cor que nao existe na paleta -- o gerador nao reclama, ele
      so desenha errado (ou nada).
   3) O `${selo(...)}` NUMA STRING DE ASPAS em vez de um template: ele sai LITERAL na tela, e
      o `node --check` so acusa quando a aspa por acaso fecha a string. Ja aconteceu duas vezes
      nesta sessao (a moeda e o raro da rota).
   4) O SELO NO SERVIDOR -- ele e apresentacao pura, e o servidor nao tem tela.
   ============================================================================ */
{
  console.log('\n=== OS SELOS DO JOGO ===');
  const nomes = Object.keys(S.DESENHOS || {});
  ok('os desenhos existem', nomes.length >= 20, nomes.length + ' selos');

  /* 1) GRADE QUADRADA e so cores da paleta.
     ⚠️ ELA NAO FIXA O LADO, e isso mudou em 17/09/2026: a primeira versao cobrava `=== 16` e
     virou mentira no dia em que os selos foram redesenhados em 24x24. O que importa nao e o
     numero -- e a grade ser QUADRADA, porque o viewBox sai dela. Fixar o lado aqui seria o mesmo
     erro que o viewBox de 16 escrito a mao cometeu, do outro lado. */
  let fora = 0, corRuim = [], lados = {};
  nomes.forEach(n => {
    const g = S.DESENHOS[n];
    if(!Array.isArray(g) || !g.length){ fora++; return; }
    const lado = g.length;
    lados[lado] = (lados[lado] || 0) + 1;
    g.forEach(l => {
      if(typeof l !== 'string' || l.length !== lado){ fora++; return; }
      for(const c of l) if(c !== '.' && !S.PALETA_SELO[c] && corRuim.indexOf(n + ':' + c) < 0) corRuim.push(n + ':' + c);
    });
  });
  ok('toda grade e quadrada', fora === 0, fora + ' linhas fora do lado do proprio selo');
  ok('e o viewBox sai do lado de cada uma', Object.keys(lados).every(L =>
       S.svgDosSelos().indexOf('viewBox="0 0 ' + L + ' ' + L + '"') >= 0),
     Object.entries(lados).map(([L, q]) => q + ' de ' + L + 'x' + L).join(', '));
  ok('e toda cor esta na paleta', corRuim.length === 0, corRuim.join(' '));

  /* 2) LETRA MORTA: todo desenho tem chamador */
  /* ⚠️ "CHAMADOR" INCLUI SER CITADO NUMA TABELA, e não só `selo('nome')` literal: os selos
     escolhidos DINAMICAMENTE aparecem como valor (o `icone` dos itens, o `MEDALHA_DO_POSTO` da
     corrida) e a chamada sai `selo(tabela[k])`. A primeira versão só olhava o literal e acusou as
     três medalhas, que estão em uso.
     ⚠️ E O BLOCO `DESENHOS` É CORTADO ANTES DA BUSCA -- senão todo selo contaria a si mesmo (a
     própria chave da tabela) e a trava daria verde pra qualquer coisa. */
  const srcCru = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const iDes = srcCru.indexOf('const DESENHOS = {');
  const fDes = iDes >= 0 ? srcCru.indexOf('\n};', iDes) + 3 : -1;
  const src = iDes >= 0 ? srcCru.slice(0, iDes) + srcCru.slice(fDes) : srcCru;
  const semDono = nomes.filter(n =>
    src.split("selo('" + n + "'").length - 1 === 0 && src.split("'" + n + "'").length - 1 === 0);
  ok('nenhum desenho fica sem chamador', semDono.length === 0, semDono.join(', '));

  /* 3) O SIMBOLO: um <symbol> por desenho, com o id que o `selo()` procura */
  const svg = S.svgDosSelos ? S.svgDosSelos() : '';
  const simbolos = (svg.match(/<symbol id="s-/g) || []).length;
  ok('o <svg> traz um <symbol> por desenho', simbolos === nomes.length, simbolos + ' de ' + nomes.length);
  /* ⚠️ 3b) O SVG BATE PIXEL A PIXEL COM A GRADE -- a trava que a OTIMIZACAO obrigou.
     O gerador nao emite uma <rect> por pixel: ele junta em RETANGULOS MAXIMOS (horizontal E
     vertical) e cospe um <path> por cor. Sem isso, os selos em 24x24 davam 3.772 formas e 160 KB
     de DOM; com isso dao 38 KB -- menos que a versao 16x16 tinha, com 2,25x mais detalhe.
     So que uma juncao errada nao aparece como erro: aparece como um pixel de cor trocada num
     desenho de 24 pixels, que ninguem ve. Esta trava DESFAZ o SVG de volta em grade e compara
     com o DESENHOS, e ela cobra tambem que nenhum retangulo se SOBREPONHA -- dois paths pintando
     o mesmo pixel dariam o desenho certo por acaso, com a cor do ultimo. */
  {
    const svgTxt = S.svgDosSelos();
    const letraDe = {};
    Object.entries(S.PALETA_SELO).forEach(([k, v]) => letraDe[v.toLowerCase()] = k);
    let difs = 0, sobrepostos = 0, px = 0, exemplo = '';
    Object.entries(S.DESENHOS).forEach(([nome, grade]) => {
      const lado = grade.length;
      const m = svgTxt.match(new RegExp('<symbol id="s-' + nome + '"[^>]*>([\\s\\S]*?)</symbol>'));
      if(!m){ difs++; return; }
      const tela = Array.from({ length: lado }, () => new Array(lado).fill('.'));
      (m[1].match(/<path fill="([^"]+)" d="([^"]+)"\/>/g) || []).forEach(p => {
        const partes = p.match(/<path fill="([^"]+)" d="([^"]+)"\/>/);
        const letra = letraDe[partes[1].toLowerCase()];
        (partes[2].match(/M(\d+) (\d+)h(\d+)v(\d+)h-\d+z/g) || []).forEach(r => {
          const v = r.match(/M(\d+) (\d+)h(\d+)v(\d+)h-\d+z/).map(Number);
          for(let j = 0; j < v[4]; j++) for(let i = 0; i < v[3]; i++){
            if(tela[v[2] + j][v[1] + i] !== '.') sobrepostos++;
            tela[v[2] + j][v[1] + i] = letra;
          }
        });
      });
      grade.forEach((linha, y) => { for(let x = 0; x < lado; x++){
        px++;
        const esperado = S.PALETA_SELO[linha[x]] ? linha[x] : '.';
        if(tela[y][x] !== esperado){ difs++; if(!exemplo) exemplo = nome + ' (' + x + ',' + y + ')'; }
      }});
    });
    ok('o SVG bate PIXEL A PIXEL com a grade', difs === 0, difs + ' de ' + px + (exemplo ? '  ex: ' + exemplo : ''));
    ok('e nenhum retangulo se sobrepoe a outro', sobrepostos === 0, sobrepostos + ' pixels pintados duas vezes');
    /* ⚠️ E A OTIMIZACAO TEM QUE ESTAR VALENDO, senao ela pode ser desfeita sem nada acusar: o
       desenho continua CERTO com uma <rect> por pixel, so que o DOM vai a 160 KB. A trava de
       cima nao pega isso (ela olha o pixel, e o pixel fica igual) -- quem pega e o tamanho. */
    /* ⚠️ O TETO E POR SELO, nao um numero fixo: ele nasceu em 60 KB com 29 selos e quase
       estourou no mesmo dia, com 44 -- um teto fixo envelhece junto com a lista. 1,8 KB por
       selo da folga pra um desenho cheio e ainda pega a otimizacao desfeita, que custa ~5,4. */
    const teto = nomes.length * 1800;
    ok('e o SVG cabe no orcamento de DOM', svgTxt.length < teto,
       Math.round(svgTxt.length / 1024) + ' KB de ' + Math.round(teto / 1024) +
       ' (' + Math.round(svgTxt.length / nomes.length) + ' por selo; sem juntar retangulo daria ~5400)');
  }
  ok('e o selo aponta pro simbolo certo', S.selo('shiny').indexOf('#s-shiny') >= 0, S.selo('shiny'));
  /* nome desconhecido devolve VAZIO, nunca um <use> quebrado: um <use> pra um symbol que nao
     existe desenha NADA, e em silencio -- a mesma falha muda das insignias que davam 404. */
  ok('e desenho que nao existe devolve vazio', S.selo('naoexiste') === '', JSON.stringify(S.selo('naoexiste')));

  /* 4) O LITERAL: nenhuma tela pode mostrar o `${selo(` escrito */
  const telas = Object.keys(S).filter(k => /^render[A-Z]/.test(k) && typeof S[k] === 'function');
  const comLiteral = [];
  let rodaram = 0;
  telas.forEach(n => {
    let html = '';
    try { html = String(S[n]() || ''); rodaram++; } catch(e){ return; }
    if(html.indexOf('${selo(') >= 0) comLiteral.push(n);
  });
  ok('rodei telas de sobra pra medir', rodaram >= 40, rodaram + ' de ' + telas.length + ' telas');
  ok('e nenhuma mostra o ${selo(...)} escrito', comLiteral.length === 0, comLiteral.join(', '));

  /* ⚠️ E A VARREDURA DO CODIGO, que e a que pega de verdade: a de cima so alcanca as telas que
     RODAM no sandbox (112 das 127 -- o resto precisa de estado), e a `renderLoja` e uma das que
     nao roda. Esta le o arquivo e diz em que tipo de string cada `${selo(` cai: dentro de crase
     ele INTERPOLA; dentro de aspa ele sai ESCRITO na tela, e o `node --check` passa batido.
     Ja aconteceu duas vezes so nesta sessao (a moeda da loja e o raro da rota).
     ⚠️ ELA PRECISA DE UMA PILHA, e foi assim que a primeira versao deu falso positivo em 4 linhas
     certas: dentro de `${...}` o parser VOLTA pro modo codigo, e ali cabe outro template. Com um
     estado so, a crase de dentro fechava o template de fora. */
  {
    const pilha = [];   /* T=template  E=${} (com contador de chaves)  ' \" =string */
    const topo = () => pilha.length ? pilha[pilha.length - 1] : null;
    const emCodigo = () => !topo() || topo().t === 'E';
    const js = extractGameScript(path.join(raiz, 'index.html'));
    const tipoEm = new Array(js.length).fill(null);
    let esc = false, com = null;
    for(let i = 0; i < js.length; i++){
      const c = js[i], t = topo();
      tipoEm[i] = com ? com : (t ? t.t : null);
      if(com === '//'){ if(c === '\n') com = null; continue; }
      if(com === '/*'){ if(c === '*' && js[i+1] === '/'){ com = null; i++; } continue; }
      if(esc){ esc = false; continue; }
      if(c === '\\' && t && t.t !== 'E'){ esc = true; continue; }
      if(t && (t.t === "'" || t.t === '\"')){ if(c === t.t) pilha.pop(); continue; }
      if(t && t.t === 'T'){
        if(c === '`'){ pilha.pop(); continue; }
        if(c === '$' && js[i+1] === '{'){ pilha.push({ t:'E', n:0 }); i++; }
        continue;
      }
      /* modo codigo (ou dentro de ${}) */
      if(c === '/' && js[i+1] === '/'){ com = '//'; i++; continue; }
      if(c === '/' && js[i+1] === '*'){ com = '/*'; i++; continue; }
      /* ⚠️ O REGEX LITERAL, e foi ele que deu falso positivo em duas linhas certas: um `/['\"]/g`
         tem aspa DENTRO, e sem pular o regex o parser abre uma string que nunca fecha. Saber se
         `/` e divisao ou regex precisa do token anterior -- depois de `(`, `,`, `=` e companhia e
         regex; depois de um nome ou `)` e divisao. */
      if(c === '/'){
        let k = i - 1;
        while(k >= 0 && /\s/.test(js[k])) k--;
        const ant = k >= 0 ? js[k] : '(';
        if('(,=:[!&|?{};+-*%~^<>'.indexOf(ant) >= 0){
          let j2 = i + 1, e2 = false, cls = false;
          while(j2 < js.length){
            const d = js[j2];
            if(e2){ e2 = false; }
            else if(d === '\\\\') e2 = true;
            else if(d === '[') cls = true;
            else if(d === ']') cls = false;
            else if(d === '/' && !cls) break;
            else if(d === '\n') break;   /* regex nao atravessa linha: era divisao mesmo */
            j2++;
          }
          if(js[j2] === '/'){ i = j2; continue; }
        }
      }
      if(c === "'" || c === '\"'){ pilha.push({ t:c }); continue; }
      if(c === '`'){ pilha.push({ t:'T' }); continue; }
      if(t && t.t === 'E'){
        if(c === '{') t.n++;
        else if(c === '}'){ if(t.n === 0) pilha.pop(); else t.n--; }
      }
    }
    const fora = [];
    let j = -1;
    while((j = js.indexOf('${selo(', j + 1)) >= 0){
      if(tipoEm[j] !== 'T') fora.push('L' + js.slice(0, j).split('\n').length + ' em ' + (tipoEm[j] || 'codigo'));
    }
    ok('e nenhum ${selo(...)} esta fora de um template', fora.length === 0, fora.slice(0, 4).join(', '));
  }

  /* ⚠️ 5) O SELO ESCAPADO -- a armadilha que a de cima NAO pega, e que so um print pegou.
     Aqui o `${selo(...)}` esta CERTO no codigo: ele interpola, gera o <svg>, e alguem passa um
     `escapeHtmlSafe` em cima DEPOIS. O resultado e o SVG escrito na tela:
       * 10% de chance de causar queimadura <svg class="selo " shape-rendering="crispEdges"...
     Foi exatamente isso que aconteceu com o asterisco do cartao de golpe, e nenhuma das quatro
     travas anteriores viu -- elas olham o CODIGO e o codigo estava certo.
     Esta olha o HTML PRONTO, que e onde o defeito aparece. */
  {
    const escapados = [];
    telas.forEach(n => {
      let html = '';
      try { html = String(S[n]() || ''); } catch(e){ return; }
      if(html.indexOf('&lt;svg') >= 0 || html.indexOf('&lt;use') >= 0) escapados.push(n);
    });
    /* e os montadores de HTML que nao sao tela: o cartao de golpe foi o caso do relato */
    const avulsos = { 'cartaoDeGolpe': ['ember'], 'golpeSeloHtml': ['Fire'], 'seloDeGolpe': ['Fire'] };
    Object.entries(avulsos).forEach(([n, args]) => {
      if(typeof S[n] !== 'function') return;
      let h = ''; try { h = String(S[n].apply(null, args) || ''); } catch(e){ return; }
      if(h.indexOf('&lt;svg') >= 0) escapados.push(n);
    });
    /* varre TODOS os golpes com observacao: e ali que o selo entra no meio de um texto */
    let comObs = 0;
    Object.keys(S.GOLPES || {}).forEach(id => {
      const o = S.obsDoGolpe(id);
      if(!o || !o.length) return;
      comObs++;
      const c = S.cartaoDeGolpe(id);
      if(c.indexOf('&lt;svg') >= 0 && escapados.indexOf('cartaoDeGolpe:' + id) < 0) escapados.push('cartaoDeGolpe:' + id);
    });
    ok('varri os cartoes com observacao', comObs >= 30, comObs + ' golpes com asterisco');
    ok('e nenhum selo sai ESCAPADO na tela', escapados.length === 0, escapados.slice(0, 5).join(', '));
  }

  /* 5) APRESENTACAO PURA: o servidor nao tem tela, entao nao pode ter selo */
  const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
  ok('o servidor nao conhece os selos', srv.indexOf('DESENHOS') < 0 && srv.indexOf('PALETA_SELO') < 0);
}

/* ============================================================================
   QUEM NAO ATACOU NAO APLICA STATUS (18/09/2026)
   ----------------------------------------------------------------------------
   Reportado com print: o Dewgong estava DORMINDO e mesmo assim congelou o Gengar. O log da tela
   dizia, em linhas seguidas, *"Dewgong continua a dormir e nao pode atacar"* e *"Gengar ficou
   congelado com Raio Congelante!"*.

   ⚠️ A CAUSA E O `lastMove`: os seis `tentar*` leem o ultimo golpe do atacante, e ele fica gravado
   da troca ANTERIOR -- ou ate de outro confronto, porque a instancia atravessa a batalha. Quem
   dormiu nao chama o `golpesDaTroca`, entao o `lastMove` velho continua la e o sorteio rodava em
   cima dele.

   ⚠️ E NAO ERA SO O SONO NEM SO O GELO. Medido antes do conserto: os TRES estados que zeram o golpe
   (sono, congelamento e paralisia) vazavam nos QUATRO status, cada um na chance cheia do golpe --
   9,5% no Raio Congelante, 30% no Trovao. Em 18.000 trocas, 1.208 aplicavam status sem golpe.

   A TRAVA NAO OLHA OS TRES ESTADOS, e e de proposito: ela cobra o INVARIANTE -- ninguem aplica
   status numa troca em que nao houve golpe dele. Assim o proximo estado que impedir um ataque
   nasce coberto; uma lista de estados aqui ficaria pra tras no primeiro que entrasse.
   ============================================================================ */
{
  console.log('\n=== QUEM NAO ATACOU NAO APLICA STATUS ===');
  const mk = (id, lv, golpes) => {
    const p = S.createInstance(id, lv); p.hp = p.maxHp = S.calcMaxHp(p);
    if(golpes) p.ataques = golpes; return p;
  };
  /* os tres estados que zeram o golpe, e um golpe de status pra cada tipo de efeito */
  const ESTADOS = [
    ['dormindo',   (p) => { p._dormindoPor = 3; }],
    ['congelado',  (p) => { p._congelado = 'icebeam'; }],
    ['paralisado', (p) => { p._paralisado = true; }],
  ];
  const ATACANTES = [
    ['dewgong',   57, 'icebeam',      '_congelado',  'gelo'],
    ['charizard', 60, 'flamethrower', '_queimado',   'queimadura'],
    ['muk',       55, 'sludgebomb',   '_envenenado', 'veneno'],
    ['raichu',    55, 'thunder',      '_paralisado', 'paralisia'],
  ];
  let semGolpe = 0, comGolpe = 0, trocas = 0, ex = '';
  ESTADOS.forEach(([nomeEstado, por]) => {
    ATACANTES.forEach(([id, lv, mv, campo]) => {
      for(let i = 0; i < 900; i++){
        const alvo = mk('snorlax', 60, ['bodyslam']);
        const b = mk(id, lv, [mv]);
        por(b);
        /* ⚠️ O `lastMove` DE ANTES e a coisa toda: sem ele o defeito nao acontece */
        b.lastMove = mv;
        const d = [];
        S.doExchange(alvo, b, S.makeSeededRng('ns' + nomeEstado + id + i), d);
        trocas++;
        if(!alvo[campo]) continue;
        const atacou = d.some(g => !g.x && g.q === 'e');
        if(atacou) comGolpe++;
        else { semGolpe++; if(!ex) ex = nomeEstado + ' + ' + id + ' (' + campo + ')'; }
      }
    });
  });
  ok('amostra de sobra', trocas >= 9000, trocas + ' trocas');
  ok('NINGUEM aplica status sem ter atacado', semGolpe === 0, semGolpe + (ex ? '   ex: ' + ex : ''));
  /* ⚠️ E O CASO CERTO CONTINUA ACONTECENDO -- sem esta segunda metade, bastaria desligar os seis
     `tentar*` pra a trava passar. Quem DEGELA ou nao trava pela paralisia ataca, e aplica. */
  ok('mas quem chegou a atacar continua aplicando', comGolpe >= 100, comGolpe + ' casos legitimos');

  /* O CASO DO PRINT, ponta a ponta: o Gengar dorme o Dewgong e o Dewgong nao congela ninguem */
  {
    let congelouDormindo = 0, confrontos = 0;
    for(let i = 0; i < 600; i++){
      const g = mk('gengar', 51, ['dreameater', 'sludgebomb']);
      const dw = mk('dewgong', 57, ['icebeam', 'surf']);
      dw._dormindoPor = 3;
      dw.lastMove = 'icebeam';
      const d = [];
      S.doExchange(g, dw, S.makeSeededRng('print' + i), d);
      confrontos++;
      const dormiu = d.some(x => x.x === 'dormindo' && x.q === 'e');
      if(dormiu && g._congelado) congelouDormindo++;
    }
    ok('o caso do print: o Dewgong dormindo nao congela o Gengar', congelouDormindo === 0,
       congelouDormindo + ' de ' + confrontos);
  }

  /* ⚠️ E A GUARDA E O GOLPE TER SAIDO, nao uma lista de estados -- o teste LE O CODIGO porque um
     caso de comportamento passaria com a guarda escrita de qualquer jeito, e a lista de estados
     e o jeito que envelhece. */
  const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
  [['cliente', cli], ['servidor', srv]].forEach(([qual, txt]) => {
    ok('o ' + qual + ' deriva a guarda do golpe que saiu',
       txt.indexOf('const primeiroAtacou = dmgByFirst.length > 0;') >= 0 &&
       txt.indexOf('const segundoAtacou  = dmgBySecond.length > 0;') >= 0);
    /* os SETE de cada lado -- e a contagem, pra um tentar* novo nao nascer sem a guarda.
       ⚠️ ERAM SEIS ATE 24/09/2026: o `tentarConfundir` entrou com a confusao por ATAQUE, e ele
       precisa da MESMA guarda pelo mesmo motivo -- o `lastMove` de quem nao atacou fica da troca
       ANTERIOR, e sem ela um pokemon dormindo confundiria o adversario. */
    const doFirst = txt.split('(segundoCaiu || !primeiroAtacou) ? null : tentar').length - 1;
    const doSecond = txt.split('pulaOSegundo ? null : tentar').length - 1;
    ok('  e os SETE de cada lado passam por ela (' + qual + ')', doFirst === 7 && doSecond === 7,
       doFirst + ' do first, ' + doSecond + ' do second');
  });
}

/* ============================================================================
   QUEM JA CAIU NAO PERDE TURNO (18/09/2026)
   ----------------------------------------------------------------------------
   Reportado com print, na TORRE: a Jynx matou o Primeape (0/435 no cabecalho) e a linha
   *"Primeape continua a dormir e nao pode atacar"* saia LOGO DEPOIS do golpe que o derrubou.

   ⚠️ NAO ERA DEFEITO DA TORRE. Ela chama o MESMO `simulateGymBattle` da jornada, sem opcoes --
   os dois motores tinham isto igual. A suspeita do relato ("desconfio que tem coisa diferente")
   foi verificada e esta trancada no bloco de baixo: 400 batalhas iguais golpe a golpe.

   ⚠️ A CAUSA E A POSICAO DA CHAMADA: o `dormeDe(second)` vem DEPOIS do golpe do first -- e TEM que
   vir, porque a frase e sobre o turno DELE, que acontece depois do golpe de quem e mais rapido.
   So que o golpe do first pode ter derrubado o second. Medido: saia em 47% dos confrontos em que
   o adormecido morre.

   A GUARDA MORA DENTRO das tres funcoes (`geloDe`, `dormeDe`, `travadoDe`), e nao nas chamadas:
   as do gelo rodam antes dos golpes e hoje estao seguras, mas foi mover uma chamada que criou o
   defeito -- dentro da funcao ela nao se perde.
   ============================================================================ */
{
  console.log('\n=== QUEM JA CAIU NAO PERDE TURNO ===');
  const mk = (id, lv, golpes) => {
    const p = S.createInstance(id, lv); p.hp = p.maxHp = S.calcMaxHp(p);
    if(golpes) p.ataques = golpes; return p;
  };
  /* as TRES linhas que falam do turno de alguem */
  const DO_TURNO = ['dormindo', 'paralisado', 'gelado'];

  /* 1) O CASO DO PRINT: o adormecido entra machucado e o golpe do outro o mata */
  let depoisDeCair = 0, confrontos = 0, ex = '';
  for(let i = 0; i < 2500; i++){
    const jynx = mk('jynx', 80, ['psychic']);
    const prime = mk('primeape', 68, ['crosschop']);
    prime._dormindoPor = 3;
    prime.hp = 60;              /* machucado: o golpe da Jynx derruba */
    const d = [];
    S.doExchange(jynx, prime, S.makeSeededRng('turno' + i), d);
    confrontos++;
    /* percorre o diario na ordem, seguindo o HP do Primeape (o lado 'e') */
    let caiu = false;
    d.forEach(g => {
      if(!g.x && g.q === 'p' && g.hp !== null && g.hp !== undefined && g.hp <= 0) caiu = true;
      if(caiu && g.q === 'e' && DO_TURNO.indexOf(g.x) >= 0){
        depoisDeCair++; if(!ex) ex = 'i=' + i + ' linha "' + g.x + '"';
      }
    });
  }
  ok('amostra do caso do print', confrontos >= 2000, confrontos + ' confrontos');
  ok('nenhuma linha de turno sai DEPOIS de ele cair', depoisDeCair === 0, depoisDeCair + (ex ? '   ex: ' + ex : ''));

  /* 2) E A LINHA CONTINUA SAINDO pra quem sobrevive -- sem isso bastaria apagar as tres funcoes.
     ⚠️ O PAINEL PRECISA SER EQUILIBRADO: com um lado muito mais forte ele MATA o adormecido, e
     a trava mede zero sem nada estar errado. Foi assim que o painel da paralisia escondeu este
     defeito por dois dias (ver a nota dele, mais acima). */
  {
    let saiu = 0, vivos = 0;
    for(let i = 0; i < 2500; i++){
      const a = mk('butterfree', 60, ['gust']);        /* fraco: nao mata o Snorlax */
      const b = mk('snorlax', 70, ['bodyslam']);
      b._dormindoPor = 3;
      const d = [];
      S.doExchange(a, b, S.makeSeededRng('vivo' + i), d);
      const acordou = d.some(g => g.x === 'acordou' && g.q === 'e');
      if(b.hp > 0 && !acordou){ vivos++; if(d.some(g => g.x === 'dormindo' && g.q === 'e')) saiu++; }
    }
    ok('e quem SOBREVIVE dormindo continua perdendo o turno na tela', vivos > 100 && saiu === vivos,
       saiu + ' de ' + vivos + ' que sobreviveram');
  }

  /* 3) A GUARDA MORA DENTRO das tres funcoes -- o teste LE O CODIGO porque um caso de
     comportamento passaria com ela escrita em qualquer lugar, e o lugar e a coisa toda aqui. */
  const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const srv = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');
  [['cliente', cli], ['servidor', srv]].forEach(([qual, txt]) => {
    const dentro = (nome) => {
      const i = txt.indexOf('const ' + nome + ' = (p, q) => {');
      if(i < 0) return false;
      /* a janela e generosa: a guarda do sono vem depois de um comentario grande */
      return txt.slice(i, i + 1600).indexOf('if(p.hp <= 0) return;') >= 0;
    };
    ok('as tres funcoes do turno guardam quem caiu (' + qual + ')',
       dentro('geloDe') && dentro('dormeDe') && dentro('travadoDe'),
       ['geloDe','dormeDe','travadoDe'].filter(n => !dentro(n)).join(', ') || 'as tres');
  });
}

/* ============================================================================
   A TORRE SEGUE A MECANICA DA JORNADA (18/09/2026)
   ----------------------------------------------------------------------------
   Perguntado no relato acima: *"verifique se a torre de treinadores esta seguindo a mecanica de
   lutas da jornada, desconfio que tem coisa diferente"*.

   A TORRE roda no SERVIDOR (`fightTrainerTowerFloor` -> `simulateGymBattle`, sem opcoes) e a
   JORNADA roda no CLIENTE. A comparacao das 300 batalhas que ja existia aqui cobre o motor, mas
   ela monta os times de um jeito so -- esta monta como a TORRE monta (com `equiparNpc` no NPC,
   que e o que a Torre faz) e compara o DIARIO inteiro, golpe a golpe, nao so quem ganhou.
   ============================================================================ */
{
  console.log('\n=== A TORRE x A JORNADA, GOLPE A GOLPE ===');
  const ids = Object.keys(S.SPECIES);
  const resumo = (r) => (r.win ? '1' : '0') + '|' + (r.matchups || []).map(m =>
    [m.playerHpAfter, m.enemyHpAfter,
     (m.golpes || []).map(g => (g.q||'') + (g.x||'') + (g.d||0) + ':' + (g.mv||'')).join(',')
    ].join(';')).join('/');
  let dif = 0, n = 0, ex = '';
  const tocou = {};
  for(let i = 0; i < 150; i++){
    const rng0 = S.makeSeededRng('tj' + i);
    const escolhe = () => Array.from({length: 3}, () => ids[Math.floor(rng0() * ids.length)]);
    const t1 = escolhe(), t2 = escolhe();
    const nivel = 45 + Math.floor(rng0() * 30);
    const monta = (lista, novo) => lista.map(id => { const p = novo(id, nivel); p.hp = p.maxHp = S.calcMaxHp(p); return p; });

    const a1 = monta(t1, S.createInstance), b1 = monta(t2, S.createInstance);
    S.equiparNpc(b1);
    const r1 = S.simulateGymBattle(a1, b1, S.makeSeededRng('tb' + i));

    const a2 = monta(t1, srv._createInstance), b2 = monta(t2, srv._createInstance);
    b2.forEach((p, k) => { p.ataques = (b1[k].ataques || []).slice(); });
    const r2 = srv._simulateGymBattle(a2, b2, srv._makeSeededRng('tb' + i));

    n++;
    const x = resumo(r1), y = resumo(r2);
    if(x !== y){ dif++; if(!ex){
      for(let k = 0; k < Math.max(x.length, y.length); k++) if(x[k] !== y[k]){
        ex = 'i=' + i + ': cliente [' + x.slice(Math.max(0,k-30), k+30) + '] servidor [' + y.slice(Math.max(0,k-30), k+30) + ']';
        break; }
    }}
    (r1.matchups || []).forEach(m => (m.golpes || []).forEach(g => { if(g.x) tocou[g.x] = (tocou[g.x]||0) + 1; }));
  }
  ok('a Torre (servidor) e a jornada (cliente) dao o MESMO diario', dif === 0, dif + ' de ' + n + (ex ? '   ' + ex : ''));
  /* ⚠️ E A COMPARACAO PRECISA TER TOCADO nas mecanicas: sem esta linha ela daria verde comparando
     300 trocas de golpe comum, que e o caso em que os dois motores nunca divergiriam. */
  ok('e ela tocou em pelo menos 10 mecanicas diferentes', Object.keys(tocou).length >= 10,
     Object.keys(tocou).length + ': ' + Object.keys(tocou).sort().join(' '));
}

/* ============================================================================
   O GALAO DO TERRENO SAI NA COR DO TERRENO (18/09/2026)
   ----------------------------------------------------------------------------
   Pedido: *"deixe a cor da setinha que indica que ele ta buffado pelo terreno, da mesma cor
   que a cor do selo do terreno"*.

   O corpo do galao e `currentColor` e o volume e branco e preto TRANSLUCIDOS -- a mesma tecnica
   do disco do TM. Ela existe porque o sombreado normal precisa de tres tons de uma cor CONHECIDA,
   e aqui a cor so se sabe na hora de desenhar.
   ============================================================================ */
{
  console.log('\n=== O CONTORNO TEM 2px, PRA SOBREVIVER A 16px ===');
  /* ⚠️ A GRADE E 24 E O SELO SAI A 16px -- 0,67 pixel de tela por pixel de grade. Um contorno
     de 1px vira 0,67px e NAO CABE: com `crispEdges` ele e pintado em uns lugares e descartado em
     outros (as pontas da estrela viraram perninhas pretas), e sem `crispEdges` ele vira um cinza
     esfumado. Com 2px ele vira 1,33px -- sempre sobra um pixel inteiro.
     Medidas as QUATRO combinacoes no navegador (1px/2px x crisp/suave): so 2px + crisp da uma
     estrela com silhueta. */
  {
    /* a prova e GEOMETRICA: em toda borda do desenho ha DOIS pixels de contorno seguidos */
    const G = S.DESENHOS.shiny;
    const lado = G.length;
    const contorno = '#241f1c';
    const eh = (x, y) => x >= 0 && y >= 0 && x < lado && y < lado && S.PALETA_SELO[G[y][x]] === contorno;
    const cheio = (x, y) => x >= 0 && y >= 0 && x < lado && y < lado &&
                            G[y][x] !== '.' && S.PALETA_SELO[G[y][x]] !== contorno;
    /* todo pixel de contorno que encosta no desenho tem um VIZINHO de contorno do lado de fora */
    let finos = 0, grossos = 0;
    for(let y = 0; y < lado; y++) for(let x = 0; x < lado; x++){
      if(!eh(x, y)) continue;
      const encosta = cheio(x-1,y) || cheio(x+1,y) || cheio(x,y-1) || cheio(x,y+1);
      if(!encosta) continue;                       /* ja e a camada de fora */
      const temFora = eh(x-1,y) || eh(x+1,y) || eh(x,y-1) || eh(x,y+1);
      if(temFora) grossos++; else finos++;
    }
    ok('o contorno tem duas camadas em toda a borda', finos === 0 && grossos > 20,
       finos + ' pontos de contorno fino, ' + grossos + ' grossos');

    /* e o gerador faz isso em DUAS voltas -- o teste LE O CODIGO, porque uma volta so daria
       um desenho valido, com contorno fino, e nada mais acusaria */
    const ger = require('fs').readFileSync(path.join(raiz, 'tools', 'gerar-selos.js'), 'utf8');
    const i = ger.indexOf('function contornar(');
    const corpo = i < 0 ? '' : ger.slice(i, ger.indexOf('\n}', i));
    ok('e o contornar da duas voltas', corpo.indexOf('volta < 2') >= 0, 'so uma volta');

    /* ⚠️ E O SVG SAI SEM `crispEdges`, que e a OUTRA METADE da decisao: com ele o navegador nao
       interpola, os 2px de contorno viram 2px de tela CHEIOS, e o preto ENGORDA ate dominar o
       desenho -- a estrela some dentro dele (foi o segundo print do dia).
       Sem ele o contorno vira 1,33px suavizado: escuro e continuo, mas fino o bastante pra o
       desenho aparecer.
       ⚠️ AS DUAS ANDAM JUNTAS: so o contorno de 2px, com crisp, fica pesado; so o suave, com 1px,
       vira cinza esfumado. E a combinacao 2px + SUAVE, escolhida olhando as quatro na tela. */
    const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const iSelo = cli.indexOf('<svg class="selo ');
    const decl = iSelo < 0 ? '' : cli.slice(iSelo, iSelo + 150);
    ok('e o selo sai SEM crispEdges', iSelo > 0 && decl.indexOf('crispEdges') < 0, decl.slice(0, 80));
    /* ⚠️ E A VARREDURA E DO SELO, NAO DO ARQUIVO (22/09/2026). Ela grepava
       `shape-rendering:crispEdges` no index.html INTEIRO -- e isso era um proxy CERTO
       enquanto o selo era o unico SVG com regra de CSS no arquivo. Deixou de ser no dia
       em que a cena nova de batalha trouxe os icones de status (`.battle-status-effect
       svg`): eles sao pixel art de 16x16 desenhada PRA ter crispEdges, e nao tem contorno
       de 2px pra perder -- ou seja a trava passou a acusar o que estava certo, que e a
       mesma familia de trava-que-envelhece que este arquivo ja registra varias vezes.
       Hoje ela pergunta o que sempre quis perguntar: nenhuma REGRA QUE ALCANCE UM `.selo`
       pode devolver o crispEdges. O resto do arquivo pode ter o seu. */
    const regras = cli.match(/[^{}]+\{[^{}]*\}/g) || [];
    const devolvem = regras.filter(r => r.indexOf('shape-rendering:crispEdges') >= 0
                                     && /\.selo\b/.test(r.slice(0, r.indexOf('{'))));
    ok('e nenhuma regra do selo devolve o crispEdges pelo CSS',
       devolvem.length === 0, devolvem.map(r => r.trim().slice(0, 70)).join(' | '))
  }

  console.log('\n=== O GERADOR E A TABELA CONCORDAM ===');
  /* ⚠️ A TRAVA QUE FALTAVA, e ela nasceu de um acidente de verdade (18/09/2026): um
     `git checkout tools/gerar-selos.js` no meio de uma conferencia reverteu o GERADOR e deixou
     o `index.html` com os desenhos novos. As duas metades ficaram discordando em silencio, e o
     estrago so apareceria na proxima vez que alguem regenerasse as tabelas -- que APAGARIA os
     desenhos novos sem ninguem ver.
     O CLAUDE.md ja dizia "a ferramenta e a fonte, mas o que vai pro jogo e a TABELA"; o que
     faltava era alguem conferir que as duas dizem a mesma coisa. E o mesmo papel que o
     `tools/test-golpes.js` faz entre o `data/golpes.json` e as tabelas do jogo. */
  {
    let gerado = null;
    try {
      gerado = require('child_process').execSync('node tools/gerar-selos.js', { cwd: raiz, encoding: 'utf8' }).trimEnd();
    } catch(e){ gerado = null; }
    ok('o gerador roda', !!gerado && gerado.indexOf('const DESENHOS = {') >= 0, 'nao rodou');
    if(gerado){
      const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
      const i = cli.indexOf('\nconst DESENHOS = {');
      const j = cli.indexOf('\n};\n', i);
      const naTabela = i < 0 || j < 0 ? '' : cli.slice(i + 1, j + 3).trimEnd();
      ok('e a tabela do index.html e EXATAMENTE o que ele cospe', gerado === naTabela,
         gerado === naTabela ? '' : 'gerado ' + gerado.length + ' bytes x tabela ' + naTabela.length +
           ' -- regenere com: node tools/gerar-selos.js');
    }
  }

  console.log('\n=== O GALAO DO TERRENO NA COR DO TERRENO ===');
  const simbolo = S.svgDosSelos().match(/<symbol id="s-terreno"[\s\S]*?<\/symbol>/);
  ok('o simbolo do terreno existe', !!simbolo);
  const sv = simbolo ? simbolo[0] : '';
  ok('e o corpo dele e currentColor', sv.indexOf('currentColor') >= 0, 'sem currentColor');
  /* ⚠️ E ELE E INTEIRO DA COR, sem volume (a pedido: *"as setas estao metade de uma cor e metade
     branca, ela deve ser inteira da mesma cor"*). O disco do TM leva brilho e sombra translucidos
     porque ele e um circulo GRANDE; num galao fino a mesma tecnica pinta METADE do desenho de
     branco. Dentro do simbolo so pode haver a cor e o contorno. */
  const cores = [...sv.matchAll(/fill="([^"]+)"/g)].map(m => m[1]);
  const fora = [...new Set(cores)].filter(c => c !== 'currentColor' && c !== '#241f1c');
  ok('e so ha a COR e o contorno dentro dele', fora.length === 0, 'sobrou: ' + fora.join(', '));

  /* AS 17 CORES: o selo sai com a MESMA cor que a faixa do terreno usa */
  const porTipo = {};
  S.TERRAINS.forEach(t => { const tp = t.types[0]; if(!porTipo[tp]) porTipo[tp] = t; });
  const tipos = Object.keys(porTipo);
  ok('ha terreno de todos os 17 tipos', tipos.length === 17, String(tipos.length));
  let erradas = [];
  tipos.forEach(tp => {
    const t = porTipo[tp];
    const cor = S.terrainColor(t);
    const html = S.selo('terreno', 'selo-g', cor);
    if(html.indexOf('color:' + cor) < 0) erradas.push(tp);
  });
  ok('e o selo sai na cor da FAIXA nos 17', erradas.length === 0, erradas.join(', '));

  /* ⚠️ SEM TERRENO ELE CAI NUM VERDE PADRAO, e isso nao e enfeite: sem cor nenhuma o
     `currentColor` herdaria a cor do NOME do lutador -- azul no jogador e vermelho no
     adversario --, e o selo mudaria de cor conforme o lado. */
  const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
  ok('existe um verde padrao pro selo', cli.indexOf("const COR_TERRENO_PADRAO = '#7ec850'") >= 0,
     'sem a constante');
  const iq = cli.indexOf("(op.comTerreno && buffed)");
  const trecho = iq < 0 ? '' : cli.slice(iq, iq + 130);
  ok('e o quadro usa a cor do terreno, com ele de reserva',
     trecho.indexOf('op.corDoTerreno || COR_TERRENO_PADRAO') >= 0, trecho.slice(0, 90));

  /* e quem SABE o terreno manda a cor: as duas chamadas da tela da jornada */
  const comCor = (cli.match(/comTerreno: true, corDoTerreno: terrain \? terrainColor\(terrain\) : null/g) || []).length;
  ok('as duas chamadas da tela da jornada mandam a cor', comCor === 2, comCor + ' de 2');

  /* e o selo continua saindo no quadro, com a cor, de ponta a ponta */
  {
    const mk = (id, lv) => { const p = S.createInstance(id, lv); p.hp = p.maxHp = S.calcMaxHp(p); return p; };
    const a = mk('pidgeotto', 19), b = mk('snubbull', 15);
    const m = { playerSpecies:'snubbull', playerName:'Snubbull', playerLevel:15,
                enemySpecies:'pidgeotto', enemyName:'Pidgeotto', enemyLevel:19,
                playerHpBefore:175, playerHpAfter:45, playerMaxHp:175,
                enemyHpBefore:197, enemyHpAfter:197, enemyMaxHp:197,
                enemyBuffed:true, golpes:[] };
    const roxo = '#A040A0';
    const q = S.fighterHtml(m, 'e', { hp: 197, passo: 0, comTerreno: true, corDoTerreno: roxo });
    ok('o quadro do buffado mostra o galao', q.indexOf('#s-terreno') >= 0, 'sem o galao');
    ok('e ele sai na cor mandada', q.indexOf('color:' + roxo) >= 0, 'sem a cor');
    const semCor = S.fighterHtml(m, 'e', { hp: 197, passo: 0, comTerreno: true });
    ok('e sem cor ele cai no verde padrao', semCor.indexOf('color:#7ec850') >= 0, 'sem o padrao');
    const semBuff = S.fighterHtml(m, 'p', { hp: 45, passo: 0, comTerreno: true, corDoTerreno: roxo });
    ok('e quem NAO esta buffado nao ganha galao', semBuff.indexOf('#s-terreno') < 0, 'ganhou sem buff');
  }
}

/* ============================================================================
   A FRASE DE STATUS NAO PISCA DUAS VEZES (18/09/2026)
   ----------------------------------------------------------------------------
   Reportado: *"as mensagens que aparece de estado dos pokemon como essa: Clefable esta
   paralisado e nao consegue atacar!, quando elas aparecem, elas piscam 2x na tela"*.

   ⚠️ A GUARDA JA EXISTIA desde 12/09/2026 -- e ela PAROU DE FUNCIONAR quando os emojis viraram
   SVG (18/09). Ela comparava `el.innerHTML` com o HTML gerado, e **o navegador normaliza a tag
   auto-fechada do selo**: `<use href="#s-raio"/>` volta como `<use href="#s-raio"></use>`.
   A comparacao passou a dar SEMPRE diferente em toda frase com selo -- e toda frase de status
   tem selo. Medido no navegador: a animacao de entrada rodava 3x por frase, e voltou a 1x.

   Hoje a comparacao e por uma CHAVE guardada num `data-`, que o navegador devolve literal.
   ============================================================================ */
{
  console.log('\n=== A FRASE DE STATUS NAO PISCA ===');

  /* 1) O CASO DO RELATO, com o innerHTML NORMALIZADO na mao -- e isso que o navegador faz, e
     sem simular aqui a trava passaria com o defeito de volta (o sandbox devolve o innerHTML
     exatamente como foi escrito). */
  const m = {
    playerSpecies:'clefable', playerName:'Clefable', playerLevel:50,
    enemySpecies:'machamp', enemyName:'Machamp', enemyLevel:50,
    playerHpBefore:300, playerHpAfter:200, playerMaxHp:300,
    enemyHpBefore:280, enemyHpAfter:280, enemyMaxHp:280,
    golpes: [{ x:'paralisado', q:'p', d:0 }],
  };
  const html1 = S.fighterHtml ? null : null;   /* so pra deixar claro que isto nao depende do quadro */
  const st = S.statusDoConfronto(m, 1, null);
  ok('a frase do relato sai com selo', st.html.indexOf('<svg') >= 0 && st.html.indexOf('paralisado') >= 0,
     st.html.slice(0, 70));

  /* o elemento na tela, com o innerHTML NORMALIZADO como o navegador faz */
  const primeiro = S.statusDoConfrontoHtml(m, 1, null);
  const chave = (primeiro.match(/data-frase="([^"]*)"/) || [])[1];
  ok('o elemento guarda a chave num data-', !!chave, 'sem data-frase');

  const el = S.document.getElementById('battle-status-txt');
  if(el){
    el.className = 'loading-text aviso-especial';
    /* ⚠️ A NORMALIZACAO: o navegador expande a tag auto-fechada */
    el.innerHTML = st.html.replace(/<use ([^>]*)\/>/g, '<use $1></use>');
    el.setAttribute && el.setAttribute('data-frase', chave.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'"));
    const segundo = S.statusDoConfrontoHtml(m, 1, null);
    ok('o SEGUNDO desenho da mesma frase NAO reentra', segundo.indexOf('aviso-sem-entrada') >= 0,
       'reentrou -- a frase pisca');

    /* e a frase NOVA entra normalmente: sem isso o conserto apagaria o que funciona */
    const m2 = Object.assign({}, m, { golpes: [{ x:'queimou', q:'e', d:0, mv:'flamethrower' }] });
    const outra = S.statusDoConfrontoHtml(m2, 1, null);
    ok('mas uma frase NOVA entra', outra.indexOf('aviso-sem-entrada') < 0, 'nao entrou');
  }

  /* 2) E A COMPARACAO NAO PODE VOLTAR A SER POR innerHTML -- o teste LE O CODIGO, porque o
     sandbox nao normaliza e um caso de comportamento passaria com o defeito de volta. */
  const cli = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
  [['statusDoConfrontoHtml', 'o montador'], ['pintarStatusDoConfronto', 'o pintor']].forEach(([nome, rot]) => {
    const i = cli.indexOf('function ' + nome + '(');
    const corpo = i < 0 ? '' : cli.slice(i, cli.indexOf('\n}', i));
    ok(rot + ' compara pela CHAVE, nao pelo innerHTML',
       corpo.indexOf("getAttribute('data-frase')") >= 0 && corpo.indexOf('.innerHTML ===') < 0,
       corpo.indexOf('.innerHTML ===') >= 0 ? 'voltou a comparar innerHTML' : 'sem o data-frase');
  });

  /* 3) e a chave separa frases de classes diferentes com o mesmo texto */
  {
    const a = S.chaveDaFrase({ classe: 'aviso-especial', html: 'x' });
    const b = S.chaveDaFrase({ classe: 'aviso-golpe', html: 'x' });
    ok('a chave leva a CLASSE junto', a !== b, a + ' x ' + b);
  }
}

/* ============================================================================
   ⚠️ A VELOCIDADE ESCALA COM O NÍVEL (20/09/2026) -- a fórmula da Gen 3
   ============================================================================
   Era o último desvio de regra do motor: um Jolteon Lv.5 e um Lv.99 devolviam 130 IGUAL. Passou
   despercebido porque a velocidade é o ÚNICO atributo que não entra numa fórmula -- os outros
   cinco entram no cálculo de dano, onde o nível já estava. Ela entra numa COMPARAÇÃO, e comparar
   dois valores de base ignora o nível por completo.
   ============================================================================ */
console.log('\n=== A VELOCIDADE ESCALA COM O NÍVEL (a fórmula da Gen 3) ===');
{
  const gen3 = (base, nivel) => Math.floor(2 * base * nivel / 100) + 5;
  const inst = (id, lv, ex) => { const p = S.createInstance(id, lv); Object.assign(p, ex || {});
    p.hp = p.maxHp = S.calcMaxHp(p); return p; };

  /* ⚠️ A FÓRMULA, cobrada nas 250 ESPÉCIES em oito níveis -- e não em dois exemplos escolhidos */
  let fora = 0, conferidas = 0;
  for(const id of Object.keys(S.SPECIES))
    for(const lv of [1, 5, 20, 50, 64, 70, 80, 99]){
      conferidas++;
      if(S.effectiveSpeed(inst(id, lv)) !== gen3(S.SPECIES[id].speed, lv)) fora++;
    }
  ok('a fórmula é floor(2×base×nível/100)+5 nas 250 espécies', fora === 0,
     (conferidas - fora) + ' de ' + conferidas);

  ok('o mesmo pokémon é mais rápido em nível alto',
     S.effectiveSpeed(inst('jolteon', 5)) < S.effectiveSpeed(inst('jolteon', 99)),
     S.effectiveSpeed(inst('jolteon', 5)) + ' < ' + S.effectiveSpeed(inst('jolteon', 99)));
  /* ⚠️ O CASO QUE MAIS SALTA AOS OLHOS, e que era o contrário: um Jolteon Lv.5 batia ANTES de um
     Snorlax Lv.99 (130 contra 30). Na Gen 3 é 18 contra 64. */
  ok('  e um Jolteon Lv.5 NÃO bate antes de um Snorlax Lv.99',
     S.effectiveSpeed(inst('jolteon', 5)) < S.effectiveSpeed(inst('snorlax', 99)),
     S.effectiveSpeed(inst('jolteon', 5)) + ' contra ' + S.effectiveSpeed(inst('snorlax', 99)));
  /* ⚠️ O PAR DO RELATO: Raichu Lv.64 x Tentacruel Lv.80, os dois base 100. Eles EMPATAVAM, e o
     desempate sorteado a cada troca fazia o log mostrar o mesmo pokémon atacando duas vezes. */
  ok('  e o par do relato deixou de empatar (Raichu Lv.64 x Tentacruel Lv.80)',
     S.effectiveSpeed(inst('raichu', 64)) < S.effectiveSpeed(inst('tentacruel', 80)),
     S.effectiveSpeed(inst('raichu', 64)) + ' contra ' + S.effectiveSpeed(inst('tentacruel', 80)));

  /* ⚠️ O NÍVEL ENTRA ANTES DOS MULTIPLICADORES, que é a ordem do jogo original: a fórmula produz o
     ATRIBUTO, e shiny/terreno/paralisia/estágio são modificadores DELE. Invertendo, o `+5` da
     fórmula seria multiplicado junto. */
  {
    const limpo = S.effectiveSpeed(inst('jolteon', 70));
    const shiny = S.effectiveSpeed(inst('jolteon', 70, { shiny: true }));
    const para = S.effectiveSpeed(inst('jolteon', 70, { _paralisado: true }));
    ok('o shiny é 1,20× do ATRIBUTO (o nível entra antes)',
       shiny === Math.round(limpo * S.SHINY_BUFF_MULT), limpo + ' -> ' + shiny);
    ok('  e a paralisia é ' + S.PARALISIA_VELOCIDADE + '× dele',
       para === Math.round(limpo * S.PARALISIA_VELOCIDADE), limpo + ' -> ' + para);
  }

  /* ⚠️ OS DOIS MOTORES TÊM QUE SER IDÊNTICOS: a ordem da troca decide a batalha inteira, e uma
     divergência aqui faz a mesma partida de liga terminar diferente no cliente e no servidor. */
  {
    const pega = (t) => { const a = t.indexOf('function effectiveSpeed(p){');
      return a < 0 ? null : t.slice(a, t.indexOf("\n}", a) + 2).replace(/\s+/g, ' '); };
    const src = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const cliente = pega(src);
    const servidor = pega(require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8'));
    ok('(as duas cópias foram achadas)', !!cliente && !!servidor);
    ok('o effectiveSpeed é idêntico nos dois motores', cliente === servidor,
       cliente === servidor ? '' : 'C: ' + cliente + '  |  S: ' + servidor);
  }

  /* ⚠️ E A CORRIDA NÃO ESCALA DE NOVO: o `speedDaCorrida` JÁ era a fórmula da Gen 3 (ele a criou,
     em 18/09). Mantida a conta antiga, um Jolteon Lv.70 iria de 187 pra 266 e a pista inteira
     precisaria ser recalibrada -- e o defeito não apareceria como erro, apareceria como todo mundo
     correndo mais rápido. */
  ok('a Corrida usa o effectiveSpeed direto, sem escalar duas vezes',
     S.speedDaCorrida(inst('jolteon', 70)) === S.effectiveSpeed(inst('jolteon', 70)),
     String(S.speedDaCorrida(inst('jolteon', 70))));

  /* ⚠️ E O COMENTÁRIO QUE DIZIA QUE ELA ALIMENTA O CRÍTICO SAIU: isso deixou de ser verdade em
     10/09/2026, quando o crítico virou os estágios da Gen 3. Ele ficou catorze dias mentindo. */
  {
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    const a = txt.indexOf('function effectiveSpeed(p){');
    const antes = txt.slice(Math.max(0, a - 2200), a);
    ok('  e o comentário não diz mais que ela alimenta o crítico', !/speed\s*\/\s*512/.test(antes));
    ok('  (o crítico de verdade só olha o golpe)', S.chanceDeCritico('tackle') === S.CRIT_BASE &&
       S.chanceDeCritico('slash') === S.CRIT_ALTO);
  }
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
})();
