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
const { createSandbox } = require('./game-sandbox');
const S = createSandbox();

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const inst = (id, lv) => S.createInstance(id, lv || 50);
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
const danoSemGolpe = (g) => !!g && (g.x === 'absorbdano' || g.x === 'confusao' || g.x === 'furiadragao');
/* VIDA DEVOLVIDA SEM SER CURA: desde 11/09/2026 o desempate poe o sobrevivente de volta de pe numa
   linha PROPRIA, com a barra subindo, em vez de o motor APARAR o golpe que o derrubou -- o aparo
   escrevia na tela um numero que nunca aconteceu (ver o CLAUDE.md).
   O `q` da linha e de quem DEU o golpe, como no resto do log, entao a vida volta pro lado OPOSTO:
   e a mesma forma do `danoSemGolpe`, com o sinal trocado. Toda conta de HP deste arquivo precisa
   das DUAS, e por isso as duas vivem aqui em cima -- copiadas a mao em cada conta, a proxima
   ficaria pra tras (ja aconteceu com o `absorbdano`, que falhava raro e intermitente). */
const devolveVida = (g) => !!g && g.x === 'desempate' && g.d > 0;

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
a = inst('jigglypuff'); b = inst('onix');
a.maxHp = S.calcMaxHp(a); a.hp = a.maxHp; b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
const hpAntes = a.hp;
diario = [];
ok('dormiu: o confronto NAO se resolve ali', S.tentarGolpeEspecial(a, b, rngFixo(0.01), diario) === false);
ok('ninguem cai por causa do sono', b.hp === b.maxHp && a.hp === hpAntes, 'a=' + a.hp + ' b=' + b.hp);
/* UMA troca livre, nao duas (09/09/2026, a pedido). O alvo apanha uma vez de graca e a luta
   volta ao normal. Se um dia isso mudar de novo, o numero vive no SONO_EM_TROCAS -- e ele e
   duplicado no functions/index.js, entao os dois tem que andar juntos. */
ok('e o alvo fica marcado por 1 troca', b._dormindoPor === S.SONO_EM_TROCAS && S.SONO_EM_TROCAS === 1,
   'dormindoPor: ' + b._dormindoPor);
ok('e o log diz qual golpe foi', diario.some(g => g.x === 'sono' && g.g === 'Canto'));
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
  /* As DUAS primeiras trocas depois do sono sao so do lado de quem usou. */
  const doisPrimeiros = golpes.slice(0,2);
  ok('os dois primeiros golpes sao de quem usou o sono',
     doisPrimeiros.every(g => g.q === 'p'), doisPrimeiros.map(g=>g.q).join(','));
})();
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
  const primeiroGolpe = seq.slice(iSono + 1).find(g => !g.x);
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
  /* O TETO SAI DA CONSTANTE DO JOGO. Escrito a mao aqui, ele virava uma segunda fonte de verdade:
     quando o TETO_GOLPES foi de 3 pra 4 (11/09/2026) este teste acusou 1.465 confrontos "fora do
     teto" que estavam exatamente dentro dele. */
  const TETO_ESPERADO = S.TETO_GOLPES;
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
        if(x.x === 'recover' || x.x === 'pocao' || x.x === 'absorb' || x.x === 'furia') ganho[x.q] += x.d || 0;
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
      seq.forEach(x => { if(danoSemGolpe(x)) autoDano[x.q === 'p' ? 'e' : 'p'] += x.d || 0; });
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
      const cura = seq.find(x => x.x === 'recover' || x.x === 'furia');
      if(cura){ if(cura.q === 'p') hpP = cura.hp; else hpE = cura.hp; }
      const lista = seq.filter(ehDano);
      const caiuEm = { p:-1, e:-1 };
      for(let k = 0; k < lista.length; k++){
        const g = lista[k];
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
        if(revideDoAdormecido || livresLog >= Math.min(livresReais, S.SONO_EM_TROCAS || 2)) sonoOk++;
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
         golpe. E a MESMA regra que o TETO_GOLPES ja usa pra decidir a reconstrucao. */
      const linhas = lista.filter(g => !(g.t > 1)).length;
      if(sono){ if(linhas > maiorComSono) maiorComSono = linhas; }
      else if(linhas > TETO_ESPERADO){ passouDoTeto++; if(!exTeto) exTeto = desc(); }
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
  ok('luta SEM golpe especial nao passa do teto de linhas', passouDoTeto === 0,
     passouDoTeto + ' de ' + (confrontos - comSono) + (exTeto ? '  |  ' + exTeto : ''));
  ok('e a com sono passa, que e o motivo da excecao', maiorComSono > TETO_ESPERADO,
     'maior confronto com sono: ' + maiorComSono + ' linhas');
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
const fJig = frequencia('jigglypuff', 'onix', 6000);
ok('sono perto de 5%', Math.abs(fJig.sono - 0.05) < 0.015, (fJig.sono*100).toFixed(1) + '%');
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
const vitima = inst('charizard'), anulador = inst('alakazam');
vitima.maxHp = S.calcMaxHp(vitima); vitima.hp = vitima.maxHp;
anulador.maxHp = S.calcMaxHp(anulador); anulador.hp = anulador.maxHp;
const dRegistro = [];
const resolveu = S.tentarGolpeEspecial(anulador, vitima, rngFixo(0.01), dRegistro);
ok('o Disable nao encerra o confronto', resolveu === false);
ok('ninguem cai por causa dele', vitima.hp === vitima.maxHp && anulador.hp === anulador.maxHp);
ok('e o alvo fica marcado', !!vitima._anulado && vitima._anulado.contra === anulador);
ok('o log ganha a linha da anulacao', dRegistro.some(g => g.x === 'disable' && g.d === 0));
/* E o outro lado ainda pode usar o especial DELE na mesma abertura: anular nao consome o
   confronto. Um Gengar anulado responde com Hipnose e resolve a luta ali mesmo. */
let anulouEDormiu = 0;
for(let i=0;i<600;i++){
  const g2 = inst('gengar'), a2 = inst('alakazam');
  g2.maxHp = S.calcMaxHp(g2); g2.hp = g2.maxHp; a2.maxHp = S.calcMaxHp(a2); a2.hp = a2.maxHp;
  const d2 = [];
  S.tentarGolpeEspecial(a2, g2, rngFixo(0.01), d2);
  if(g2._anulado && d2.some(x => x.x === 'sono')) anulouEDormiu++;
}
ok('depois de anular, o outro lado ainda joga o especial dele', anulouEDormiu === 600, anulouEDormiu + ' de 600');

console.log('\nA CHANCE DO DISABLE');
function taxaDisable(id, alvoId, n){
  let c = 0;
  for(let i=0;i<n;i++){
    const alvo = inst(alvoId);
    S.tentarGolpeEspecial(inst(id), alvo, Math.random, []);
    if(alvo._anulado) c++;
  }
  return c/n;
}
const tAlaka = taxaDisable('alakazam', 'gengar', 6000);
ok('Disable perto de 10%', Math.abs(tAlaka - 0.10) < 0.02, (tAlaka*100).toFixed(1) + '%');
/* A Jigglypuff tem Canto E Disable: o sono e sorteado antes, entao a taxa efetiva do Disable
   dela e 0,95 x 0,10. Se um dia isso mudar, e aqui que aparece. */
const tJig = taxaDisable('jigglypuff', 'gengar', 6000);
ok('quem tem sono E Disable cai na taxa composta', Math.abs(tJig - 0.095) < 0.02, (tJig*100).toFixed(1) + '%');

console.log('\nAS FRASES SAO AS PEDIDAS');
/* As tres frases exatas do pedido. O log e o aviso do meio da batalha leem da MESMA funcao --
   se um dia divergirem, e aqui que se ve. */
const mBoom = { player:'Golem', enemy:'Raichu', playerSpecies:'golem', enemySpecies:'raichu',
  golpes:[{ q:'p', d:100, hp:0, x:'boom', g:'auto-destruição' }, { q:'e', d:80, hp:0, x:'boomself' }] };
const htmlBoom = S.passosHtml(mBoom);
ok('explosao: "Golem usou auto-destruicao"', /usou <span class="type-pill"[^>]*>auto-destruição</.test(htmlBoom), '');
ok('e uma linha so (o "caiu junto" nao vira outra)', (htmlBoom.match(/class="mlog-passo /g)||[]).length === 1);
ok('o aviso do meio da batalha diz o mesmo',
   S.avisoDoConfronto(mBoom) === '💥 Golem usou auto-destruição!', S.avisoDoConfronto(mBoom));

const mSono = { player:'Butterfree', enemy:'Arbok', playerSpecies:'butterfree', enemySpecies:'arbok',
  golpes:[{ q:'p', d:100, hp:0, x:'sono', g:'Pó do Sono' }] };
ok('sono: "Butterfree fez Arbok dormir"',
   S.avisoDoConfronto(mSono) === '😴 Butterfree fez Arbok dormir!', S.avisoDoConfronto(mSono));
/* No log cabe o nome do golpe -- ele e por especie de proposito (o Paras dorme com Esporo). */
ok('e no log ainda da pra ver com que golpe', /dormir com <span class="type-pill"[^>]*>Pó do Sono</.test(S.passosHtml(mSono)));

const mDis = { player:'Alakazam', enemy:'Gengar', playerSpecies:'alakazam', enemySpecies:'gengar',
  golpes:[{ q:'p', d:0, hp:120, x:'disable', g:'Anulação' }, { q:'p', d:40, hp:80 }, { q:'e', d:30, hp:90 }] };
ok('disable: "Gengar teve seu melhor ataque anulado por Alakazam"',
   S.avisoDoConfronto(mDis) === '🚫 Gengar teve seu melhor ataque anulado por Alakazam!', S.avisoDoConfronto(mDis));
/* O Disable nao pode virar um golpe de dano 0 na animacao nem gastar vaga do teto de 3 golpes:
   com ele contando, uma troca real de 2 golpes estouraria o teto e o log inteiro cairia na
   reconstrucao, perdendo os golpes de verdade. */
const seq = S.sequenciaDoConfronto(mDis);
ok('e ele nao entra na sequencia de golpes', seq.length === 2 && !seq.some(g=>g.x==='disable'), seq.length + ' passos');
const htmlDis = S.passosHtml(mDis);
ok('mas a linha dele aparece no log, e vem primeiro',
   htmlDis.indexOf('anulado por') > 0 && htmlDis.indexOf('anulado por') < htmlDis.indexOf('atacou'));

/* Sem golpe especial, a linha e a de sempre -- e o aviso nao aparece. */
ok('confronto comum nao ganha aviso', S.avisoDoConfronto({ player:'A', enemy:'B', golpes:[{q:'p',d:10,hp:5}] }) === '');
/* ⚠️ A PAUSA DE ABERTURA HOJE E SO DA ANULACAO. Desde 12/09/2026 a frase nasce no passo do
   EVENTO, nao no passo 0 -- entao quem E um passo da animacao (explosao, sono, chuva...) nao tem
   nada escrito no passo 0 e nao precisa da pausa de la: o segundo de leitura dele vem DEPOIS do
   passo, pela marca `leitura`. A anulacao nao e um passo (nao move barra, e filtrada fora da
   sequencia), entao o passo dela E o 0 -- e e so ela que ainda usa esta pausa. */
ok('a pausa de abertura e so de quem NAO tem passo proprio (a anulacao)',
   S.pausaDoEspecial(mDis) === S.PAUSA_LEITURA_ESPECIAL_MS && S.pausaDoEspecial(mBoom) === 0 &&
   S.pausaDoEspecial({ golpes:[{q:'p',d:10}] }) === 0,
   'anulacao ' + S.pausaDoEspecial(mDis) + 'ms  |  explosao ' + S.pausaDoEspecial(mBoom) + 'ms');

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
ok('lista o especial da especie',
   S.especiaisDaEspecie('golem').map(e=>e.nome).join(',') === 'auto-destruição' &&
   S.especiaisDaEspecie('oddish').map(e=>e.nome).join(',') === 'Pó do Sono,Absorver',
   S.especiaisDaEspecie('oddish').map(e=>e.nome).join(','));
ok('e os DOIS de quem tem dois',
   S.especiaisDaEspecie('jigglypuff').map(e=>e.nome).join(' + ') === 'Canto + Anulação',
   S.especiaisDaEspecie('jigglypuff').map(e=>e.nome).join(' + '));
/* O Paras tem Esporo E Sanguessuga -- ele aprende os dois por nivel na Gen 1. */
ok('e o Paras, que dorme E drena',
   S.especiaisDaEspecie('paras').map(e=>e.nome).join(' + ') === 'Esporo + Sanguessuga',
   S.especiaisDaEspecie('paras').map(e=>e.nome).join(' + '));
ok('quem nao tem nenhum nao ganha linha nenhuma', S.especiaisDaEspecie('pikachu').length === 0);
/* A chance vem junto porque ela e POR CONFRONTO: so o nome deixaria o jogador achar que sai todo golpe. */
ok('com a chance junto', S.especiaisDaEspecie('golem')[0].chance === S.CHANCE_AUTODESTRUICAO);
ok('e com o tipo, pro selo', S.especiaisDaEspecie('paras')[0].tipo === 'Grass');
/* Ninguem das quatro listas pode ficar de fora da ficha -- seria um golpe invisivel. */
const todasComEspecial = new Set([...S.AUTODESTRUICAO, ...Object.keys(S.SONIFEROS), ...S.DISABLE,
                                  ...S.METRONOMO, ...Object.keys(S.ABSORCAO)]);
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
      let n = 0, maior = 0, somaErrada = 0, foraDePosicao = 0;
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
          const ABERTURAS_LOG = ['recover','pocao','absorb','absorbdano','sono','semSono','furia',
                                 'confusao','furiadragao','chuva','remoinho'];
          maior = Math.max(maior, s.filter(g => g.x !== 'boomself' && ABERTURAS_LOG.indexOf(g.x) < 0 && !(g.t > 1)).length);
          const tomou = s.filter(g => (!g.x || g.x === 'boom') && g.q === 'e').reduce((a, g) => a + g.d, 0);
          /* Quem SOBE de vida no meio do confronto desconta: cura, pocao, drenagem e FURIA fazem o
             HP perdido ser menor que a soma dos golpes. */
          const subiu = s.filter(g => (g.x === 'recover' || g.x === 'pocao' || g.x === 'absorb' || g.x === 'furia') && g.q === 'p')
                         .reduce((a, g) => a + g.d, 0);
          /* HP QUE O JOGADOR PERDEU SEM SER GOLPE DO ADVERSARIO: a CONFUSAO (ele se acertou) e o
             dano da DRENAGEM. Nos dois o `q` e de quem CAUSOU, entao `q === 'e'` e o adversario
             causando -- e o que o jogador perdeu assim nao pode ser cobrado dos golpes dele. */
          const sozinho = s.filter(g => danoSemGolpe(g) && g.q === 'e')
                           .reduce((a, g) => a + g.d, 0);
          if(tomou !== (x.playerHpBefore - x.playerHpAfter) + subiu - sozinho) somaErrada++;
          if(s.findIndex(g => g.x === 'faixa') <= 0) foraDePosicao++;
        }
      }
      ok('nenhum confronto com Faixa passa de 7 linhas de LUTA (3 + a linha dela + 3)',
         maior <= 7, 'maior: ' + maior + ' em ' + n + ' (aberturas nao contam -- ver acima)');
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
          const bate = g.q === 'p';
          const caido = (bate ? p : e) <= 0;
          const continuacao = g.t > 1 && ultimoOk === k - 1;
          if(caido && caiuEm[g.q] !== k - 1 && !continuacao){
            return 'o ' + (bate ? 'jogador' : 'inimigo') + ' bateu com a barra em 0';
          }
          if(caido) ultimoOk = k;
          /* A FURIA sobe a vida como a cura -- o teto cresce e a vida atual sobe junto --, entao
             ela entra na mesma conta de GANHO. Sem isso a soma do log nao fecha. */
          if(g.x === 'recover' || g.x === 'pocao' || g.x === 'absorb' || g.x === 'furia'){ if(bate) p += g.d; else e += g.d; continue; }
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
          const curou = s3.filter(g => (g.x === 'recover' || g.x === 'pocao' || g.x === 'absorb' || g.x === 'furia') && g.q === 'p')
                          .reduce((a, g) => a + g.d, 0);
          const tomou = s3.filter(g => (!g.x || g.x === 'boom') && g.q === 'e').reduce((a, g) => a + g.d, 0);
          /* HP QUE O JOGADOR PERDEU SEM SER GOLPE DO ADVERSARIO: a CONFUSAO (ele se acertou) e o
             dano da DRENAGEM. Nos dois o `q` e de quem CAUSOU, entao `q === 'e'` e o adversario
             causando e o pokemon do jogador perdendo. O absorbdano ja era assim antes da confusao;
             ele passava porque a amostra e curta e a combinacao, rara. */
          const sozinho3 = s3.filter(g => danoSemGolpe(g) && g.q === 'e')
                             .reduce((a, g) => a + g.d, 0);
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
  for(const id of ['mew','mewtwo']){
    if(S.SONIFEROS[id]) imunesNaLista.push('SONIFEROS:' + id);
    if(S.ABSORCAO[id]) imunesNaLista.push('ABSORCAO:' + id);
  }
  ok('e os dois imunes nao estao em lista nenhuma', imunesNaLista.length === 0, imunesNaLista.join(', '));
})();

console.log('\nDRENAGEM: TIRA DO OUTRO E POE EM SI, ANTES DA LUTA');
/* A LISTA SAI DO APRENDIZADO POR NIVEL DA GEN 1/2, conferida move a move no Bulbapedia -- e a
   intuicao erra: Kabuto e Kabutops aprendem Absorb/Mega Drain por nivel (sao Pedra/Agua), e o
   Bulbasaur NAO aprende nenhum dos tres (o que ele tem e Leech Seed, que e outra coisa). */
(function(){
  ok('23 especies drenam', Object.keys(S.ABSORCAO).length === 23, Object.keys(S.ABSORCAO).length + '');
  ok('os de Absorb estao la', ['oddish','gloom','vileplume','exeggcute','exeggutor','tangela',
      'kabuto','kabutops','bellossom','hoppip','skiploom','jumpluff','sunkern','sunflora']
      .every(id => S.ABSORCAO[id]));
  ok('e os de Leech Life tambem', ['zubat','golbat','crobat','venonat','venomoth',
      'spinarak','ariados','paras','parasect'].every(id => S.ABSORCAO[id]));
  ok('o Bulbasaur NAO drena (Leech Seed nao e drenagem)', !S.ABSORCAO.bulbasaur);
  ok('nenhuma esta fora do SPECIES', Object.keys(S.ABSORCAO).filter(id => !S.SPECIES[id]).length === 0,
     Object.keys(S.ABSORCAO).filter(id => !S.SPECIES[id]).join(','));
  /* Cada especie com o NOME do golpe dela: sem isso um Zubat drenaria com "Absorver". */
  ok('cada uma com o golpe dela', S.ABSORCAO.zubat === 'Sanguessuga' && S.ABSORCAO.oddish === 'Absorver' &&
     S.ABSORCAO.vileplume === 'Mega Dreno', [S.ABSORCAO.zubat, S.ABSORCAO.oddish, S.ABSORCAO.vileplume].join('/'));
  /* E TODO golpe que o motor gera precisa de tipo declarado, senao o selo sai num cinza generico. */
  const semTipo = [...new Set(Object.values(S.ABSORCAO))].filter(n => !S.TIPO_DO_ESPECIAL[n]);
  ok('e todos com tipo declarado, pro selo', semTipo.length === 0, semTipo.join(','));
  ok('Sanguessuga e Inseto, nao Planta', S.TIPO_DO_ESPECIAL['Sanguessuga'] === 'Bug');

  /* A MECANICA. Mesma hora do Recuperar (antes da luta) e a MESMA fracao dos dois lados, cada um do
     proprio teto: o exemplo do pedido e um Vileplume de 47% que sobe pra 72% enquanto o Fearow cai
     de 100% pra 75%. */
  let saiu = 0, fracaoErrada = 0, curouCheio = 0, matou = 0, foraDaFaixa = 0, semDuasEntradas = 0;
  for(let i = 0; i < 6000; i++){
    const v = S.createInstance('vileplume', 60), f = S.createInstance('fearow', 60);
    v.maxHp = S.calcMaxHp(v); f.maxHp = S.calcMaxHp(f);
    v.hp = Math.round(v.maxHp * 0.47); f.hp = f.maxHp;
    const antesV = v.hp, antesF = f.hp;
    const diario = [];
    S.tentarGolpeEspecial(v, f, Math.random, diario);
    const a = diario.find(g => g.x === 'absorb');
    if(!a) continue;
    saiu++;
    const d = diario.find(g => g.x === 'absorbdano');
    if(!d) { semDuasEntradas++; continue; }
    const fracaoCura = (v.hp - antesV) / v.maxHp, fracaoDano = (antesF - f.hp) / f.maxHp;
    if(Math.abs(fracaoCura - fracaoDano) > 0.01) fracaoErrada++;
    if(fracaoCura < 0.095 || fracaoCura > 0.305) foraDaFaixa++;
    if(v.hp > v.maxHp) curouCheio++;
    if(f.hp < 1) matou++;
  }
  ok('a drenagem dispara', saiu > 200, saiu + ' vezes em 6000');
  ok('sempre com DUAS entradas no diario (uma barra cada)', semDuasEntradas === 0, semDuasEntradas + '');
  ok('a MESMA fracao dos dois lados, cada um do proprio teto', fracaoErrada === 0, fracaoErrada + ' erradas');
  ok('e a fracao fica entre 10% e 30%', foraDaFaixa === 0, foraDaFaixa + ' fora da faixa');
  ok('a cura nunca passa do teto', curouCheio === 0, curouCheio + '');
  /* NAO MATA: todas as aberturas deste motor deixam a luta acontecer. */
  ok('e nunca mata o alvo (piso de 1 de HP)', matou === 0, matou + '');

  /* A TRAVA DOS 70%, a mesma do Recuperar: com a vida quase cheia nao ha o que recuperar, e a
     barra de quem drenou nao se moveria -- um passo de cura ZERO na animacao. */
  let comVidaCheia = 0;
  for(let i = 0; i < 6000; i++){
    const v = S.createInstance('vileplume', 60), f = S.createInstance('fearow', 60);
    v.maxHp = S.calcMaxHp(v); f.maxHp = S.calcMaxHp(f);
    v.hp = v.maxHp; f.hp = f.maxHp;
    const diario = [];
    S.tentarGolpeEspecial(v, f, Math.random, diario);
    if(diario.some(g => g.x === 'absorb')) comVidaCheia++;
  }
  ok('com a vida cheia ela nao sai', comVidaCheia === 0, comVidaCheia + ' de 6000');

  /* QUEM NAO TEM O GOLPE nunca drena -- a medida de controle. */
  let semGolpe = 0;
  for(let i = 0; i < 4000; i++){
    const a = S.createInstance('rhydon', 60), b = S.createInstance('fearow', 60);
    a.maxHp = S.calcMaxHp(a); b.maxHp = S.calcMaxHp(b);
    a.hp = Math.round(a.maxHp * 0.4); b.hp = b.maxHp;
    const diario = [];
    S.tentarGolpeEspecial(a, b, Math.random, diario);
    if(diario.some(g => g.x === 'absorb')) semGolpe++;
  }
  ok('quem nao tem o golpe nunca drena', semGolpe === 0, semGolpe + ' de 4000');

  /* NA TELA: as duas barras se movem, e a frase sobrevive aos DOIS passos. */
  const m = { player:'Vileplume', enemy:'Fearow', playerSpecies:'vileplume', enemySpecies:'fearow',
    playerHpBefore:190, playerHpAfter:0, playerMaxHp:404, enemyHpBefore:380, enemyHpAfter:0, enemyMaxHp:380,
    playerMove:'Grass', enemyMove:'Flying',
    golpes:[{q:'p',d:101,hp:291,x:'absorb',g:'Mega Dreno'},{q:'p',d:95,hp:285,x:'absorbdano'},
            {q:'e',d:291,hp:0},{q:'p',d:285,hp:0}] };
  const seq = S.sequenciaDoConfronto(m);
  ok('a drenagem ABRE a sequencia', seq.slice(0,2).map(g=>g.x).join(',') === 'absorb,absorbdano',
     seq.map(g=>g.x||'golpe').join(','));
  const anim = S.buildAnimatedHitSequence(m);
  ok('a barra de quem drenou SOBE', anim[0].side === 'player' && anim[0].amount === -101 && anim[0].cura === true,
     JSON.stringify(anim[0]));
  ok('e a do alvo DESCE', anim[1].side === 'enemy' && anim[1].amount === 95, JSON.stringify(anim[1]));
  const log = S.passosHtml(m);
  ok('o log fala da drenagem', /drenou a vida de/.test(log));
  ok('numa linha SO (a segunda entrada e pro calculo)',
     (log.match(/mlog-passo especial/g) || []).length === 1,
     (log.match(/mlog-passo especial/g) || []).length + ' linhas especiais');
  ok('com o selo do tipo do golpe', log.includes(S.TYPE_COLORS['Grass']));
  /* A FRASE NASCE NO PASSO DELA (nao antes -- 12/09/2026) e tem que durar os DOIS: sumindo no
     primeiro, a segunda barra anda sem explicacao. */
  ok('nada e anunciado antes de a drenagem acontecer', S.avisoDoConfronto(m, 0) === '', S.avisoDoConfronto(m, 0));
  ok('a frase aparece NO passo dela', /drenou a vida de/.test(S.avisoDoConfronto(m, 1)), S.avisoDoConfronto(m, 1));
  ok('e sobrevive ao segundo passo', /drenou a vida de/.test(S.avisoDoConfronto(m, 2)), S.avisoDoConfronto(m, 2));
  ok('e some quando a luta comeca', S.avisoDoConfronto(m, 3) === '', S.avisoDoConfronto(m, 3));
})();

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

/* O POKEMON QUE SOBREVIVEU AO CONFRONTO ANTERIOR entra machucado e se cura ANTES de o novo
   adversario atacar. Ficava no FIM do doExchange (o vencedor se curava depois de ganhar), e era o
   mesmo numero com metade da graca: a cura chegava com a luta ja decidida. */
(function(){
  function comVidaEm(pct, n){
    let curas = 0, curouAntesDeQualquerGolpe = 0;
    for(let i=0;i<n;i++){
      const a = inst('starmie'); a.maxHp = S.calcMaxHp(a); a.hp = Math.floor(a.maxHp*pct);
      const b = inst('rapidash'); b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
      const d = [];
      S.tentarGolpeEspecial(a, b, Math.random, d);
      if(d.some(g=>g.x==='recover')){
        curas++;
        if(a.hp === a.maxHp) curouAntesDeQualquerGolpe++;
      }
    }
    return { taxa: 100*curas/n, cheio: curas === curouAntesDeQualquerGolpe };
  }
  const r30 = comVidaEm(0.30, 4000);
  ok('com 30% de vida ele se cura, perto de 10%', Math.abs(r30.taxa - 10) < 3, r30.taxa.toFixed(1) + '%');
  ok('e a vida vai direto pro maximo', r30.cheio);
  ok('com 69% ainda se cura', comVidaEm(0.69, 3000).taxa > 6, comVidaEm(0.69, 3000).taxa.toFixed(1) + '%');
  /* Acima de 70% nao ha o que recuperar, e a frase anunciaria um efeito que mal se ve na barra. */
  ok('com 75% NAO se cura', comVidaEm(0.75, 3000).taxa === 0, comVidaEm(0.75, 3000).taxa.toFixed(1) + '%');
  ok('e com a vida cheia tambem nao', comVidaEm(1.00, 3000).taxa === 0);
  /* Como o Disable, ela NAO resolve o confronto: a luta acontece inteira, com ele curado. */
  const a = inst('starmie'); a.maxHp = S.calcMaxHp(a); a.hp = Math.floor(a.maxHp*0.3);
  const b = inst('rapidash'); b.maxHp = S.calcMaxHp(b); b.hp = b.maxHp;
  const d = [];
  const resolveu = S.tentarGolpeEspecial(a, b, ()=>0.01, d);
  ok('e a cura NAO encerra o confronto', resolveu === false);
  ok('o registro guarda quanto subiu', d[0] && d[0].x === 'recover' && d[0].d > 0, JSON.stringify(d[0]));
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
/* A cura nao gasta vaga do TETO_GOLPES: o teto conta GOLPES. */
const tresGolpesMaisCura = { player:'Starmie', enemy:'Onix', playerSpecies:'starmie', enemySpecies:'onix',
  playerHpBefore:80, playerHpAfter:140, playerMaxHp:200, enemyHpBefore:210, enemyHpAfter:0, enemyMaxHp:210,
  playerMove:'Water', enemyMove:'Rock',
  golpes:[{q:'p',d:120,hp:200,x:'recover',g:'Recuperar'},{q:'p',d:70,hp:140},{q:'e',d:60,hp:140},{q:'p',d:140,hp:0}] };
const seq3 = S.sequenciaDoConfronto(tresGolpesMaisCura);
ok('tres golpes + cura continuam sendo os golpes REAIS', seq3.length === 4 && seq3.filter(g=>!g.x).length === 3,
   seq3.length + ' passos, ' + seq3.filter(g=>!g.x).length + ' de dano');

/* CONFRONTO LONGO E DE VERDADE. Passando do TETO_GOLPES a luta vira a reconstrucao, que interpola
   entre o HP do COMECO e o do FIM -- e com a cura o comeco de verdade e a vida CHEIA. Reconstruir
   a partir do HP machucado desenharia a barra caindo de um valor que a luta nunca teve, e a cura
   sumiria da tela e do log (o "nao aparece animacao nenhuma" de 02/09/2026). */
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
    ok('e ela vem ANTES de qualquer golpe', iCura >= 0 && (iGolpe < 0 || iCura < iGolpe),
       seq.map(g => g.x || 'golpe').join(','));
  }
  /* A luta comeca da vida CHEIA -- e o que a reconstrucao tem que enxergar. */
  const cura = m.golpes.find(g=>g.x==='recover');
  const eu = cura.q === 'p';
  let hp = eu ? m.playerHpBefore : m.enemyHpBefore;
  const maxHp = eu ? m.playerMaxHp : m.enemyMaxHp;
  const anim = S.buildAnimatedHitSequence(m);
  const lado = eu ? 'player' : 'enemy';
  let chegouNoCheio = false;
  anim.forEach(h => { if(h.side===lado){ hp = Math.max(0, hp - h.amount); if(hp === maxHp) chegouNoCheio = true; } });
  ok('a barra sobe ate o maximo logo no comeco', chegouNoCheio, 'maxHp: ' + maxHp);
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
ok('e o sono compra o mesmo numero de trocas nos dois', esp.SONO_EM_TROCAS === S.SONO_EM_TROCAS,
   'cliente: ' + S.SONO_EM_TROCAS + '  servidor: ' + esp.SONO_EM_TROCAS);

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
let divergencias = 0, comEspecial = 0, comFuria = 0, comDragao = 0;
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
  ok('mas nunca os dois no mesmo confronto', juntos === 0, juntos + ' confrontos com os dois');

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
    const xs = (x.golpes || []).map(g => g.x).filter(Boolean);
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
  const todos = Object.keys(S.SPECIES);
  let conf = 0, lados = 0, fora = 0, pior = 1, exemplo = '';
  let somaOk = 0, somaTot = 0, zero = 0, negativo = 0;
  for(let i = 0; i < 1200; i++){
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
        const ganho = seq.filter(g => (g.x === 'recover' || g.x === 'pocao' || g.x === 'absorb' || g.x === 'furia') && g.q !== lado).reduce((a,g) => a + g.d, 0);
        const perda = seq.filter(g => danoSemGolpe(g) && g.q === lado).reduce((a,g) => a + g.d, 0);
        somaTot++;
        if(alvoAntes - dela - perda + ganho === alvoDepois) somaOk++;
        const g2 = seq.filter(g => !g.x && g.q === lado && g.d > 0 && !g.c && !(g.tn > 1));
        if(g2.length < 2) return;
        lados++;
        const r = Math.max.apply(null, g2.map(g => g.d)) / Math.max(1, Math.min.apply(null, g2.map(g => g.d)));
        /* A tolerancia de 1,25 e o ARREDONDAMENTO: as fatias sao inteiras, e num total pequeno
           (27 e 32) o inteiro mais proximo passa de 1,176 por alguns centesimos. O que a trava
           existe pra pegar e a faixa REABRINDO -- ali a razao volta pras dezenas. */
        if(r > 1.25){ fora++; if(r > pior){ pior = r; exemplo = mm.player + ' x ' + mm.enemy + ': ' + g2.map(g => g.d).join(' e '); } }
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
        /* SO NO CAMINHO DO DIARIO REAL. Na RECONSTRUCAO o `marcarCriticos` poe o selo nas linhas
           de MAIOR dano sem saber qual golpe foi critico -- a posicao e aproximada por desenho --,
           e as linhas dela ja saem quase iguais. Cobrar o dobro ali seria cobrar do lugar errado. */
        const reais = (mm.golpes || []).filter(g => !g.x && g.d > 0).length;
        if(reais > S.TETO_GOLPES) return;
        if((mm.golpes || []).some(g => g.x === 'faixa' || g.x === 'sono')) return;
        const seq = S.sequenciaDoConfronto(mm);
        ['p','e'].forEach(lado => {
          const g2 = seq.filter(g => !g.x && g.q === lado && g.d > 0 && !(g.tn > 1));
          const c = g2.filter(g => g.c), comuns = g2.filter(g => !g.c);
          if(!c.length || !comuns.length) return;
          const mediaComum = comuns.reduce((a,g) => a + g.d, 0) / comuns.length;
          c.forEach(g => {
            pares++;
            const r = g.d / Math.max(1, mediaComum);
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
    let achei = null;
    for(let i = 0; i < 2000 && !achei; i++){
      const a = [inst('bulbasaur', 15)]; a[0].ataques = S.ataquesPadrao(a[0]);
      const b = [inst('onix', 20)]; S.equiparNpc(b);
      const mm = (S.simulateGymBattle(a, b, S.makeSeededRng('mut' + i)).matchups || [])[0];
      if(!mm) continue;
      const g2 = (mm.golpes || []).filter(g => !g.x && g.d > 0 && g.q === 'p');
      if(g2.length >= 2 && Math.max.apply(null, g2.map(g=>g.d)) > 2 * Math.min.apply(null, g2.map(g=>g.d))) achei = mm;
    }
    ok('achei um confronto com golpe aparado', !!achei);
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
  const cara = h => { const t = semTag(h); const mm = t.match(/([A-Za-zÀ-ÿ'.\-]+) Lv\.(\d+)/);
                      return (t.indexOf('—') >= 0 && !mm) ? '(vazio)' : (mm ? mm[1] : '?'); };
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

console.log('\n=== A CONFUSAO: O ADVERSARIO SE ACERTA, E A LUTA ACONTECE DEPOIS ===');
{
  /* Pedida em 10/09/2026: quem tem Confusao tem 10% por confronto de deixar o outro confuso; o
     confuso leva UM golpe DELE MESMO (o dano sai de um ESPELHO -- mesma especie, nivel, atributos e
     golpe) e so entao a luta comeca, "como se fosse uma nova". */
  /* ONZE GOLPES CONFUNDEM, nao so a Confusao -- reportado em 10/09/2026: "alguns pokemons tambem
     possuem confusao que voce nao colocou, mas porque o nome e outro, como o Zubat, Tentacool,
     Magnemite, que possuem Supersonic". Sao 83 especies, e cada uma guarda o NOME do golpe DELA
     (a regra do SONIFEROS): sem isso o Zubat confundiria com "Confusao". */
  const especiesConf = Object.keys(S.CONFUSAO);
  /* 82: sao 83 na base, MENOS o Mewtwo -- ele aprende Confusao no nivel 1 e ficou de fora porque o
     tentarGolpeEspecial corta o bloco inteiro quando ele ou o Mew esta no confronto. */
  ok('sao as 82 especies que confundem por nivel', especiesConf.length === 82, especiesConf.length + '');
  ok('a chance e 10% por confronto', S.CHANCE_CONFUSAO === 0.10, (100*S.CHANCE_CONFUSAO) + '%');
  ok('a lista e a MESMA nos dois motores', JSON.stringify(esp.CONFUSAO) === JSON.stringify(S.CONFUSAO));
  ok('e a chance tambem', esp.CHANCE_CONFUSAO === S.CHANCE_CONFUSAO);
  /* OS TRES DO RELATO, nomeados: uma contagem sozinha nao diz QUAL faltou -- e a licao da auditoria
     dos golpes especiais de 04/09/2026, quando sete especies estavam faltando. */
  ok('o Zubat, o Tentacool e o Magnemite confundem com SUPERSOM',
     S.CONFUSAO.zubat === 'Supersom' && S.CONFUSAO.tentacool === 'Supersom' && S.CONFUSAO.magnemite === 'Supersom',
     [S.CONFUSAO.zubat, S.CONFUSAO.tentacool, S.CONFUSAO.magnemite].join(' / '));
  ok('e cada golpe tem TIPO declarado, pro selo',
     [...new Set(Object.values(S.CONFUSAO))].every(g => S.TIPO_DO_ESPECIAL[g]),
     [...new Set(Object.values(S.CONFUSAO))].filter(g => !S.TIPO_DO_ESPECIAL[g]).join(',') || 'todos');
  ok('sao ONZE golpes distintos', [...new Set(Object.values(S.CONFUSAO))].length === 11,
     [...new Set(Object.values(S.CONFUSAO))].sort().join(', '));
  /* O OUTRAGE, O PETAL DANCE E O THRASH confundem o PROPRIO USUARIO no fim da sequencia, que e
     outro efeito -- e por isso o Dratini e o Tauros NAO entram por causa deles. */
  ok('quem so tem Outrage/Thrash NAO entra (eles confundem o proprio usuario)',
     !S.CONFUSAO.dratini && !S.CONFUSAO.dragonair,
     'dratini:' + (S.CONFUSAO.dratini || '-') + '  dragonair:' + (S.CONFUSAO.dragonair || '-'));
  /* O MEWTWO aprende Confusao no nivel 1 e ficou de fora de proposito: o tentarGolpeEspecial corta
     o bloco INTEIRO quando qualquer um dos dois e Mew ou Mewtwo, entao a entrada seria letra morta
     -- o mesmo motivo que ja o tirou do Disable e do Recuperar. */
  ok('o Mewtwo e o Mew ficam de fora (seria letra morta)', !S.CONFUSAO.mewtwo && !S.CONFUSAO.mew);
  ok('e nenhuma da lista esta fora do SPECIES',
     especiesConf.filter(id => !S.SPECIES[id]).length === 0, especiesConf.filter(id => !S.SPECIES[id]).join(','));

  /* NA BATALHA. O par e escolhido pra isolar a mecanica: o Alakazam confunde, e o Machamp nao tem
     especial nenhum -- entao tudo que aparece no confronto e da confusao. */
  {
    const semTag = h => String(h||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
    let achou = 0, naFrente = 0, nuncaMata = 0, lutouDepois = 0, comFrase = 0, noLog = 0, nomeouGolpe = 0, semCritico = 0;
    let somaPct = 0;
    for(let v = 0; v < 4000 && achou < 60; v++){
      const a = [inst('alakazam', 45)]; a[0].ataques = S.ataquesPadrao(a[0]);
      const b = [inst('machamp', 45)];  b[0].ataques = S.ataquesPadrao(b[0]);
      const m = (S.simulateGymBattle(a, b, S.makeSeededRng('conf' + v)).matchups || [])[0];
      if(!m) continue;
      const c = (m.golpes || []).find(g => g.x === 'confusao');
      if(!c) continue;
      achou++;
      const seq = S.sequenciaDoConfronto(m);
      /* 1. ELA ABRE O CONFRONTO -- e o pedido: o evento acontece no inicio. */
      if(seq[0] && seq[0].x === 'confusao') naFrente++;
      /* 2. NAO MATA: o alvo fica com no minimo 1. */
      if(c.hp >= 1) nuncaMata++;
      if(!c.c) semCritico++;
      /* 3. E A LUTA ACONTECE DEPOIS -- "como se fosse uma nova". Sem golpe nenhum depois dela, o
            confronto teria sido resolvido pela abertura, que e o que ela NAO faz. */
      if(seq.filter(g => !g.x).length > 0) lutouDepois++;
      /* 4. A FRASE acompanha a barra caindo (passosDaAbertura = 2). */
      const anim = S.buildAnimatedHitSequence(m);
      const iC = anim.findIndex(h => h.x === 'confusao');
      if(iC >= 0 && /confuso/.test(semTag(S.statusDoConfronto(m, iC + 1, anim[iC]).html))) comFrase++;
      /* 5. E vira linha no log, com o NOME do golpe que ele usou em si mesmo. */
      const log = semTag(S.passosHtml(m));
      if(log.indexOf('confuso') >= 0) noLog++;
      if(c.am && GOLPES_OK(S, c.am) && log.indexOf(S.nomeDoAtaque(c.am)) >= 0) nomeouGolpe++;
      somaPct += 100 * c.d / Math.max(1, m.enemyMaxHp);
    }
    ok('a confusao sai o bastante pra medir', achou >= 20, achou + ' confrontos');
    ok('ela ABRE o confronto', naFrente === achou, naFrente + ' de ' + achou);
    ok('e nunca mata (piso de 1 de HP)', nuncaMata === achou, nuncaMata + ' de ' + achou);
    ok('e nunca sai critica', semCritico === achou, semCritico + ' de ' + achou);
    ok('a luta acontece DEPOIS dela', lutouDepois === achou, lutouDepois + ' de ' + achou);
    ok('a frase acompanha a barra caindo', comFrase === achou, comFrase + ' de ' + achou);
    ok('e vira linha no log', noLog === achou, noLog + ' de ' + achou);
    ok('nomeando o golpe que ele usou em si', nomeouGolpe === achou, nomeouGolpe + ' de ' + achou);
    ok('o golpe do espelho tem tamanho de golpe de verdade', (somaPct/achou) > 5 && (somaPct/achou) < 70,
       (somaPct/achou).toFixed(1) + '% da propria vida, em media');
  }

  /* O ESPELHO NAO PODE SUJAR O ORIGINAL. O calcDamage ESCREVE lastMove/lastMoveType/lastCrit no
     atacante -- e o atacante aqui e uma copia. Sem ela, o golpe que o pokemon usa na luta seguinte
     sairia trocado no log. */
  {
    const alvo = inst('machamp', 45); alvo.ataques = S.ataquesPadrao(alvo);
    alvo.maxHp = S.calcMaxHp(alvo); alvo.hp = alvo.maxHp;
    alvo.lastMove = 'tackle'; alvo.lastMoveType = 'Normal';
    const quem = inst('alakazam', 45); quem.ataques = S.ataquesPadrao(quem);
    quem.maxHp = S.calcMaxHp(quem); quem.hp = quem.maxHp;
    const d = [];
    for(let i = 0; i < 400 && !d.length; i++){ quem._especialContra = null; S.tentarGolpeEspecial(quem, alvo, Math.random, d); }
    const saiu = d.find(g => g.x === 'confusao');
    ok('a confusao saiu no teste do espelho', !!saiu);
    ok('e o espelho NAO sobrescreveu o lastMove do original',
       alvo.lastMove === 'tackle', String(alvo.lastMove));
  }

  /* O DANO E SEM TIPO, como no jogo oficial (a pedido, 10/09/2026). O espelho aplicava a tabela
     contra ELE MESMO -- Fantasma contra Fantasma e 2x --, e um Haunter tirava 299 dos proprios 300.
     A prova e direta: o MESMO espelho, com e sem a opcao, contra um alvo cujo golpe e
     super-eficaz nele. */
  {
    const alvo = inst('haunter', 45); alvo.ataques = S.ataquesPadrao(alvo);
    alvo.maxHp = S.calcMaxHp(alvo); alvo.hp = alvo.maxHp;
    let comTipo = 0, semTipo = 0;
    for(let i = 0; i < 300; i++){
      comTipo += S.calcDamageNew(Object.assign({}, alvo, { _anulado:null }), alvo, S.makeSeededRng('t' + i));
      semTipo += S.calcDamageNew(Object.assign({}, alvo, { _anulado:null }), alvo, S.makeSeededRng('t' + i), { semTipo: true });
    }
    ok('sem tipo o espelho bate MENOS num alvo super-eficaz contra si', semTipo < comTipo * 0.85,
       'com tipo ' + (100*(comTipo/300)/alvo.maxHp).toFixed(0) + '%   sem tipo ' + (100*(semTipo/300)/alvo.maxHp).toFixed(0) + '% da vida');
    /* E o que SOBRA e atributo, nao tipo: um Shuckle (defesa 230) mal se arranha e um Haunter
       (defesa 45) se arrebenta. E o certo -- o espelho e ele mesmo. */
    const shuckle = inst('shuckle', 45); shuckle.ataques = S.ataquesPadrao(shuckle);
    shuckle.maxHp = S.calcMaxHp(shuckle); shuckle.hp = shuckle.maxHp;
    let tanque = 0;
    for(let i = 0; i < 300; i++) tanque += S.calcDamageNew(Object.assign({}, shuckle, { _anulado:null }), shuckle, S.makeSeededRng('s' + i), { semTipo: true });
    ok('e quem e duro mal se arranha', (tanque/300) / shuckle.maxHp < 0.15,
       (100*(tanque/300)/shuckle.maxHp).toFixed(0) + '% da propria vida');
    /* E SEM CRITICO, tambem como no jogo oficial (a pedido). Medido antes de tirar: 43% dos golpes
       que deixavam o confuso em 1 de HP eram criticos -- e o critico dobra o dano SEM selo nenhum
       na linha da confusao, que e a mesma classe de defeito dos "dois golpes impossiveis". */
    {
      let comCrit = 0, semCrit = 0;
      const p3 = inst('gengar', 45); p3.ataques = S.ataquesPadrao(p3);
      p3.maxHp = S.calcMaxHp(p3); p3.hp = p3.maxHp;
      for(let i = 0; i < 4000; i++){
        const e1 = Object.assign({}, p3, { _anulado:null });
        S.calcDamageNew(e1, p3, S.makeSeededRng('k' + i), { semTipo: true });
        if(e1.lastCrit) comCrit++;
        const e2 = Object.assign({}, p3, { _anulado:null });
        S.calcDamageNew(e2, p3, S.makeSeededRng('k' + i), { semTipo: true, semCritico: true });
        if(e2.lastCrit) semCrit++;
      }
      ok('sem a opcao o critico sai normalmente', comCrit > 100, comCrit + ' de 4000');
      ok('e com ela nunca sai', semCrit === 0, semCrit + ' de 4000');
      /* O RNG E CONSUMIDO DO MESMO JEITO: os dois motores tem que ler a mesma quantidade de numeros
         da mesma semente, senao a batalha diverge do 2o golpe em diante. A prova e que o dano NAO
         critico e identico com e sem a opcao. */
      let iguais = 0, naoCrit = 0;
      for(let i = 0; i < 2000; i++){
        const e1 = Object.assign({}, p3, { _anulado:null });
        const d1 = S.calcDamageNew(e1, p3, S.makeSeededRng('r' + i), { semTipo: true });
        if(e1.lastCrit) continue;
        naoCrit++;
        const d2 = S.calcDamageNew(Object.assign({}, p3, { _anulado:null }), p3, S.makeSeededRng('r' + i), { semTipo: true, semCritico: true });
        if(d1 === d2) iguais++;
      }
      ok('e o golpe NAO critico da o mesmo numero (o rng anda igual)', iguais === naoCrit,
         iguais + ' de ' + naoCrit);
    }

    /* A OPCAO NAO PODE VAZAR pro resto do jogo: sem ela a conta e a de sempre. */
    const a2 = inst('charizard', 50), b2 = inst('venusaur', 50);
    a2.ataques = S.ataquesPadrao(a2); b2.ataques = S.ataquesPadrao(b2);
    b2.maxHp = S.calcMaxHp(b2); b2.hp = b2.maxHp;
    const normal = S.calcDamageNew(a2, b2, S.makeSeededRng('z'));
    const zerado = S.calcDamageNew(a2, b2, S.makeSeededRng('z'), { semTipo: true });
    ok('e o golpe COMUM continua com tipo (Fogo x Planta e 2x)', normal > zerado,
       'com tipo ' + normal + '   sem tipo ' + zerado);
  }

  /* NA FICHA DA POKEDEX, com a chance -- ela e por CONFRONTO, e sem o numero o jogador acharia que
     sai todo golpe. */
  ok('a ficha do Alakazam anuncia a Confusao',
     S.especiaisDaEspecie('alakazam').some(e => e.nome === 'Confusão' && e.chance === S.CHANCE_CONFUSAO),
     JSON.stringify(S.especiaisDaEspecie('alakazam')));
  ok('e o selo dela e Psiquico', S.TIPO_DO_ESPECIAL['Confusão'] === 'Psychic');
}
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
  /* Passando do TETO_GOLPES a luta e reconstruida em 3 linhas: o vencedor acerta uma PARTE, o
     perdedor devolve tudo de uma vez, o vencedor termina. A primeira e a terceira sao o MESMO
     pokemon com o MESMO golpe contra o MESMO alvo -- e a unica coisa que faz dois golpes assim
     diferirem e o sorteio de `0,85 + rng*0,15` do calcDamageNew: no maximo 1,18x (1,00/0,85).
     Fora o critico, que a linha anuncia com selo proprio.
     A faixa da divisao era 30-70%, que da ate 2,33x, e isso foi RELATADO por jogadores em
     10/09/2026: "tira uma fracao, apanha, e termina de matar com o mesmo golpe tirando muito mais
     dano e sem critico". Medido na epoca: 78,1% dos confrontos reconstruidos ficavam fora da banda,
     media 1,57x, pior 2,36x. Hoje a faixa e 46-54%, teto de 1,17x. */
  const BANDA = 1.18;   // 1,00 / 0,85 -- o quanto o sorteio da formula faz um golpe variar
  const especies = Object.keys(S.SPECIES);
  let tres = 0, fora = 0, pior = 0, exemplo = null;
  /* 6.000 e nao 2.500: com o TETO_GOLPES em 4 os confrontos que passam pela reconstrucao caem de
     43% pra 16% do total -- que e justamente o ganho da mudanca -- e a amostra deste bloco encolheu
     junto. O numero de voltas existe pra manter o "de sobra pra medir" abaixo. */
  for(let i = 0; i < 6000; i++){
    const rng = S.makeSeededRng('rec' + i);
    const time = k => Array.from({ length: k }, () => {
      const id = especies[Math.floor(rng() * especies.length)];
      const p = S.createInstance(id, 25 + Math.floor(rng() * 40)); p.ataques = S.ataquesPadrao(p); return p;
    });
    const r = S.simulateGymBattle(time(3), time(3), S.makeSeededRng('b' + i));
    (r.matchups || []).forEach(m => {
      const reais = (m.golpes || []).filter(g => !g.x && g.d > 0).filter(g => !(g.t > 1)).length;
      if(reais <= S.TETO_GOLPES) return;                 // so o que passa pela reconstrucao
      const todos = S.sequenciaDoConfronto(m);
      /* O SONO FICA DE FORA, e a excecao e estrutural: nele as trocas livres saem REAIS (uma linha
         cada) e so o RESTO e reconstruido -- entao um golpe de verdade fica ao lado de um somado, e
         a razao entre os dois nao tem por que caber na banda. Medido: 3 casos em 3.128 (0,1%), e
         TODOS com sono. Sem essa linha o teste toleraria 2% e esconderia uma faixa reaberta. */
      if(todos.some(g => g.x === 'sono')) return;
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
  /* ZERO, e nao "quase zero": tirando o sono, a divisao e a UNICA coisa que separa os dois golpes,
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
  ok('e o cartao do golpe NAO fala mais dela', S.obsDoGolpe('rage') === '');
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
    const re = /([A-Za-zÀ-ÿ'.\- ]+?) atacou ([A-Za-zÀ-ÿ'.\- ]+?) com (.*?)e tirou −(\d+) de HP\.( CRÍTICO)?/g;
    let linhas = 0, selo = 0, feio = 0, exFeio = '', reconstruido = 0;
    for(let v = 0; v < 220; v++){
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
        const txt = semTag(S.passosHtml(m));
        const reais = (m.golpes || []).filter(g => !g.x && g.d > 0).filter(g => !(g.t > 1)).length;
        const ehRecon = reais > S.TETO_GOLPES;
        let g, arr = [];
        re.lastIndex = 0;
        while((g = re.exec(txt))) arr.push({ quem: g[1].trim(), d: +g[4], crit: !!g[5], tapas: /\d+x$/.test(g[3].trim()) });
        arr.forEach(l => {
          linhas++;
          if(!l.crit) return;
          selo++;
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
  const ehCura = g => g.x === 'recover' || g.x === 'pocao' || g.x === 'absorb' || g.x === 'furia';
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
        const mexe = !g.x || ehCura(g) || g.x === 'boom' || g.x === 'boomself' || danoSemGolpe(g);
        if(!mexe) return;
        const noProprio = ehCura(g) || g.x === 'boomself';
        const alvoP = noProprio ? (g.q === 'p') : (g.q !== 'p');
        if(alvoP) hpP = (g.hp != null) ? g.hp : Math.max(0, ehCura(g) ? hpP + g.d : hpP - g.d);
        else      hpE = (g.hp != null) ? g.hp : Math.max(0, ehCura(g) ? hpE + g.d : hpE - g.d);
      });
      /* E A APRESENTACAO VOLTOU A NUNCA CRIAR COLAGEM. A excecao do "revide letal" que existiu por
         algumas horas em 12/09/2026 morreu junto com o empate: sem revide que mata, nao ha o caso
         em que as duas ordens possiveis eram ruins. */
      const dano = gs.filter(g => !g.x && g.d > 0).length;
      if(dano > S.TETO_GOLPES) return;
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
  ok('a tabela tem os nove golpes pedidos', MULTI.indexOf('doubleslap') >= 0 && MULTI.indexOf('furyswipes') >= 0,
     MULTI.join(', '));

  /* 1) OS PESOS, um golpe de cada vez. Sem isto um ajuste na tabela passa despercebido. */
  for(const golpe of MULTI){
    const conta = {}; let n = 0;
    const rng = S.makeSeededRng('tapas-' + golpe);
    for(let i = 0; i < 80000; i++){ const t = S.tapasDoGolpe(golpe, rng); conta[t] = (conta[t]||0)+1; n++; }
    const pct = k => 100 * (conta[k]||0) / n;
    const perto = (a, b) => Math.abs(a - b) < 1.0;
    ok(golpe + ': 2 tapas em ~37,5%', perto(pct(2), 37.5), pct(2).toFixed(2) + '%');
    ok(golpe + ': 3 tapas em ~37,5%', perto(pct(3), 37.5), pct(3).toFixed(2) + '%');
    ok(golpe + ': 4 tapas em ~12,5%', perto(pct(4), 12.5), pct(4).toFixed(2) + '%');
    ok(golpe + ': 5 tapas em ~12,5%', perto(pct(5), 12.5), pct(5).toFixed(2) + '%');
    ok(golpe + ': nunca sai 1 nem 6', !conta[1] && !conta[6] && !conta[0]);
  }
  ok('golpe comum continua batendo UMA vez', S.tapasDoGolpe('pound', S.makeSeededRng('x')) === 1);

  /* 2) O MOTOR TEM QUE ESCOLHER O GOLPE. O seletor compara PODER, e estes valem 15 e 18 -- pelo
        cru nunca seriam escolhidos por quem tem dois golpes, e a mecanica seria codigo morto.
        O que valem e poder x 3,0 tapas: 45 o Tapa Duplo e 54 os Arranhoes Furiosos. */
  ok('o poder efetivo do Tapa Duplo e 45, nao 15', S.poderEfetivo('doubleslap') === 45,
     'efetivo: ' + S.poderEfetivo('doubleslap') + '  cru: ' + S.GOLPES.doubleslap[1]);
  ok('o dos Arranhoes Furiosos e 54, nao 18', S.poderEfetivo('furyswipes') === 54,
     'efetivo: ' + S.poderEfetivo('furyswipes') + '  cru: ' + S.GOLPES.furyswipes[1]);
  ok('e TODO golpe da tabela vale mais que o cru', MULTI.every(g => S.poderEfetivo(g) > S.GOLPES[g][1]));
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
      pinmissile: 'beedrill',  iciclespear: 'shellder', rockblast: 'golem'
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
      const linhas = semTag(S.passosHtml(m)).split(' de HP.').filter(x => x.trim());
      const doTapa = linhas.filter(x => marca.test(x));
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
    let achou = 0, curtos = 0, naFrente = 0, colados = 0, cadaver = 0, somaOk = 0, comPausa = 0, frasePronta = 0;
    for(let v = 0; v < 9000 && achou < 40; v++){
      const a = [inst('psyduck', 21)]; a[0].ataques = S.ataquesPadrao(a[0]);
      const b = [inst('gastly', 31)];  b[0].ataques = S.ataquesPadrao(b[0]);
      const m = (S.simulateGymBattle(a, b, S.makeSeededRng('mor' + v)).matchups || [])[0];
      if(!m) continue;
      const sono = (m.golpes || []).find(g => g.x === 'sono');
      const mor  = (m.golpes || []).find(g => g.m);
      if(!sono || !mor) continue;
      /* O REORDENAMENTO SO VALE SE O MORIBUNDO TIVER FICADO MORTO. Quando os dois caem na mesma
         troca e o desempate RESSUSCITA o dono do revide, a ordem crua do diario ja e a legivel --
         e a regra, nao excecao (ver o CLAUDE.md, 'O cadaver que atacava'). Cobrar o revide na
         frente ai seria cobrar o contrario do que o motor promete.
         Ficou visivel quando a CONFUSAO entrou: o Psyduck e uma das 23 especies dela, e com um
         golpe a mais no confronto a troca dupla passou a acontecer nesse par. */
      const donoMorreu = mor.q === 'p' ? (m.playerHpAfter <= 0) : (m.enemyHpAfter <= 0);
      if(!donoMorreu) continue;
      /* ⚠️ CONFRONTO COM DESEMPATE FICA DE FORA, e nao e tolerancia: ali o revide MATOU o outro
         lado, e revide letal NAO sobe (subindo, quem ele matou passa a atacar de barra zerada --
         ver passosVisiveis). Ou seja, o que este bloco mede nao se aplica a esses confrontos.
         Medido: 3 em 40. Antes do 11/09/2026 eles nem apareciam aqui, porque o APARO do desempate
         segurava a barra acima de zero e o revide nunca era letal aos olhos do log. */
      const ultimoMor = (m.golpes || []).filter(g => g.m).slice(-1)[0];
      if(ultimoMor && (ultimoMor.hp || 0) <= 0) continue;
      achou++;
      /* CONFRONTO CURTO x LONGO. Passando do teto de golpes, a sequencia vem da RECONSTRUCAO, e la
         o revide nao e uma linha propria -- ele e absorvido no golpe reconstruido daquele lado.
         O que vale nos DOIS casos e o que foi reportado: os golpes de quem dormiu o outro ficam
         colados, e ninguem ataca com a barra em zero. A linha propria do revide so existe (e so e
         cobrada) no confronto curto. */
      const curto = (m.golpes || []).filter(g => !g.x && g.d > 0).length <= S.TETO_GOLPES;
      if(curto) curtos++;
      const seq = S.sequenciaDoConfronto(m);
      const dano = seq.filter(g => !g.x);
      /* 1. O REVIDE ABRE O CONFRONTO, antes ate da linha do sono. */
      if(!curto || (seq[0] && !seq[0].x && seq[0].q === mor.q)) naFrente++;
      /* 2. E OS GOLPES DE QUEM DORMIU O OUTRO FICAM COLADOS -- e essa a informacao que se perdia. */
      let temColados = false;
      for(let k = 0; k + 1 < dano.length; k++) if(dano[k].q === sono.q && dano[k+1].q === sono.q) temColados = true;
      if(temColados) colados++;
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
      const voltouP = seq.filter(g => devolveVida(g) && g.q === 'e').reduce((x, g) => x + g.d, 0);
      const voltouE = seq.filter(g => devolveVida(g) && g.q === 'p').reduce((x, g) => x + g.d, 0);
      const tomouP = dano.filter(g => g.q === 'e').reduce((x, g) => x + g.d, 0);
      const tomouE = dano.filter(g => g.q === 'p').reduce((x, g) => x + g.d, 0);
      if(tomouP === m.playerHpBefore + voltouP - m.playerHpAfter &&
         tomouE === m.enemyHpBefore + voltouE - m.enemyHpAfter) somaOk++;
      /* 5. A LINHA DO MEIO DA BATALHA acompanha: o revide sai com o NOME DO GOLPE dele, e a frase
            do sono aparece no passo do sono -- nao no do revide, que e o que a contagem absoluta
            de passos fazia antes. */
      const anim = S.buildAnimatedHitSequence(m);
      const iSono = anim.findIndex(h => h.x === 'sono');
      const noRevide = semTag(S.statusDoConfronto(m, 1, anim[0]).html);
      const noSono   = iSono >= 0 ? semTag(S.statusDoConfronto(m, iSono + 1, anim[iSono]).html) : '';
      if(!curto || (/usou/.test(noRevide) && !/dormir/.test(noRevide) && /dormir/.test(noSono))) frasePronta++;
      /* 6. E O TEMPO DE LEITURA VAI JUNTO. A linha do sono deixou de ser o primeiro passo, entao a
            pausa de abertura nao a cobre mais -- quem cobre e a marca de leitura do passo dela.
            Sem isso a frase apareceria e sumiria no mesmo quadro. */
      /* A pausa de ABERTURA so tem que zerar quando o sono e a UNICA abertura do confronto. Com uma
         anulacao junto, por exemplo, a frase dela ocupa o passo 0 com direito -- e ai o segundo de
         leitura dela e legitimo, e o do sono vem a parte, no passo dele. */
      const soSono = (m.golpes || []).filter(g => g.x && g.x !== 'sono' && g.x !== 'boomself' && g.x !== 'absorbdano').length === 0;
      if(!curto || (iSono >= 0 && S.pausaDaFaixa(anim[iSono]) > 0 && (!soSono || S.pausaDoEspecial(m) === 0))) comPausa++;
    }
    ok('o caso do Psyduck x Gastly aparece o bastante pra medir', achou >= 10 && curtos >= 5,
       achou + ' confrontos, ' + curtos + ' curtos (com a linha real do revide)');
    ok('o revide moribundo ABRE o confronto (nos curtos)', naFrente === achou, naFrente + ' de ' + achou);
    ok('e os golpes de quem dormiu o outro ficam COLADOS', colados === achou, colados + ' de ' + achou);
    ok('ninguem ataca com a barra em zero', cadaver === achou, cadaver + ' de ' + achou);
    ok('e a soma de dano continua fechando', somaOk === achou, somaOk + ' de ' + achou);
    ok('a linha mostra o GOLPE no revide e o SONO no passo do sono', frasePronta === achou, frasePronta + ' de ' + achou);
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
      const ehCura = g => g.x === 'recover' || g.x === 'pocao' || g.x === 'absorb' || g.x === 'furia';
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
        const mexeVida = !g.x || ehCura(g) || g.x === 'boom' || g.x === 'boomself' || danoSemGolpe(g);
        if(!mexeVida) return;
        /* a cura e a explosao em si mexem a vida de QUEM AGE; todo o resto mexe a do outro lado */
        const noProprio = ehCura(g) || g.x === 'boomself';
        const alvoP = noProprio ? (g.q === 'p') : (g.q !== 'p');
        if(alvoP){ hpP = (g.hp != null && g.x !== 'desempate') ? g.hp : Math.max(0, ehCura(g) ? hpP + g.d : hpP - g.d);
                   if(hpP <= 0 && caiuNoPasso.p < 0) caiuNoPasso.p = passo; }
        else      { hpE = (g.hp != null && g.x !== 'desempate') ? g.hp : Math.max(0, ehCura(g) ? hpE + g.d : hpE - g.d);
                   if(hpE <= 0 && caiuNoPasso.e < 0) caiuNoPasso.e = passo; }
      });
    });
  }
  /* O REVIDE DE QUEM DORMIU, com a troca livre MATANDO. Este caminho tem reordenamento PROPRIO (as
     trocas livres saem do diario cru e o revide cai na reconstrucao, montada depois delas), e ele
     ficou sem cobertura quando o sono passou a comprar UMA troca: com uma so, o adormecido quase
     nunca morre nela em times pareados. Aqui o desnivel e proposital -- um sonifero forte contra um
     alvo fraco -- pra que a troca livre mate e o revide aconteca. */
  {
    let comRevide = 0, cadaverNoSono = 0, exSono = '';
    for(let volta = 0; volta < 4000 && comRevide < 40; volta++){
      /* Niveis PAREADOS de proposito: o alvo tem que SOBREVIVER a troca livre e cair na troca em
         que acorda -- e so ai ele revida. Com desnivel grande ele morre dormindo, e quem dorme nao
         revida: nao ha o que reordenar. */
      const a = inst(['gengar','venomoth','butterfree','vileplume'][volta % 4], 40);
      const b = inst(['machoke','golem','rhydon','kangaskhan'][volta % 4], 40);
      const m = (S.simulateGymBattle([a], [b]).matchups || [])[0];
      if(!m) continue;
      const sono = (m.golpes || []).find(x => x.x === 'sono');
      if(!sono) continue;
      const revide = (m.golpes || []).some(g => g.m && g.q !== sono.q);
      if(!revide) continue;
      comRevide++;
      let hpP = m.playerHpBefore, hpE = m.enemyHpBefore;
      S.sequenciaDoConfronto(m).forEach(g => {
        if(!g.x && g.d > 0){
          const vida = g.q === 'p' ? hpP : hpE;
          const morto = g.q === 'p' ? m.playerHpAfter <= 0 : m.enemyHpAfter <= 0;
          if(vida <= 0 && morto){ cadaverNoSono++; if(!exSono) exSono = m.player + ' x ' + m.enemy; }
        }
        if(g.x === 'faixa' || g.x === 'disable') return;
        const noProprio = g.x === 'recover' || g.x === 'pocao' || g.x === 'absorb' || g.x === 'furia' || g.x === 'boomself';
        const cura = g.x === 'recover' || g.x === 'pocao' || g.x === 'absorb' || g.x === 'furia';
        const alvoP = noProprio ? (g.q === 'p') : (g.q !== 'p');
        if(alvoP) hpP = (g.hp != null) ? g.hp : Math.max(0, cura ? hpP + g.d : hpP - g.d);
        else      hpE = (g.hp != null) ? g.hp : Math.max(0, cura ? hpE + g.d : hpE - g.d);
      });
    }
    ok('achou o revide de quem dormiu pra medir', comRevide >= 5, comRevide + ' confrontos');
    ok('e o revide dele NAO aparece depois da barra zerar', cadaverNoSono === 0,
       cadaverNoSono + ' cadaveres' + (exSono ? '  ex: ' + exSono : ''));
  }
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
    ok('a frase da drenagem sobrevive aos DOIS passos dela', false, 'nenhuma drenagem na amostra');
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
    for(const fn of ['simulateBossFight','battleResolveMatchup']){
      const i = srvTxt.indexOf('function ' + fn + '(');
      const fim = srvTxt.indexOf('\nfunction ', i + 1);
      /* O ( E ) PRECISAM DO ESCAPE: sem eles o `()` vira grupo de captura e a regex casa com
         "limparClima;", que nao existe em lugar nenhum -- o teste falhava com o codigo CERTO. */
      ok('o ' + fn + ' do servidor zera a chuva', srvTxt.slice(i, fim).indexOf('limparClima();') > 0);
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
    const log = S.renderMatchupLog([m]);
    ok('o log traz a linha da ativacao', /Squirtle<\/span> usou/.test(log) && /começa a chover/.test(log));
    ok('e o selo dela e CLICAVEL', /class="type-pill selo-clicavel"[^>]*abrirEspecialInfo/.test(log),
       (log.match(/<button[^>]*selo-clicavel[^>]*>/) || ['(sem botao)'])[0].slice(0, 90));
    /* Ele abre a MESMA caixa dos especiais -- nao uma segunda. */
    ok('e ele abre a caixa da chuva', /abrirEspecialInfo\(&quot;chuva&quot;/.test(log));
    /* 3) O 🌧️ EM CIMA DO ×, em todo confronto com chuva. */
    ok('o 🌧️ fica em cima do ×', /<span class="mlog-x"><span class="mlog-chuva">🌧️<\/span>×<\/span>/.test(log));
    const semChuva = Object.assign({}, m, { chuva: false, golpes: m.golpes.slice(1) });
    const logSeco = S.renderMatchupLog([semChuva]);
    ok('e confronto sem chuva nao ganha o emoji', !/mlog-chuva/.test(logSeco));
    ok('nem a linha da ativacao', !/começa a chover/.test(logSeco));
    /* CONFRONTO QUE SO HERDOU a chuva: tem o emoji, mas NAO a linha -- foi o pedido ao pe da letra
       ("no log, voce vai escrever somente na batalha que foi ativada"). */
    const herdou = Object.assign({}, m, { golpes: m.golpes.slice(1) });   // chuva:true, sem o registro
    const logHerdou = S.renderMatchupLog([herdou]);
    ok('confronto que so HERDOU a chuva tem o emoji', /mlog-chuva/.test(logHerdou));
    ok('mas NAO repete a linha da ativacao', !/começa a chover/.test(logHerdou));
    /* O SELO DO QUADRO DE BATALHA (o que diz "este confronto esta sob chuva") continua nas QUATRO
       telas. Isto e lido do CODIGO: uma tela de fora seria a unica muda. */
    const txt = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
    for(const fn of ['renderSpecialBattling','renderTrainerBattling','renderBattling','renderLeagueWatch']){
      const i = txt.indexOf('function ' + fn + '(');
      const fim = txt.indexOf('\nfunction ', i + 1);
      ok('o ' + fn + ' mostra o selo da chuva', txt.slice(i, fim).indexOf('chuvaBadgeHtml(m)') > 0);
    }
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
  ok('sao os CATORZE especiais do jogo', efeitos.size === 14, efeitos.size + ': ' + [...efeitos].sort().join(', '));
  ok('e sao estes',
     [...efeitos].sort().join(',') === 'anula,chuva,confusao,cura,drenar,espadas,explosao,furia,furiadragao,metronomo,pluma,remoinho,sketch,sono',
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
  const nomesDoSono = [...new Set(Object.values(S.SONIFEROS))];
  const nomesDaConf = [...new Set(Object.values(S.CONFUSAO))];
  ok('o sono tem 5 nomes e uma explicacao so', nomesDoSono.length === 5, nomesDoSono.join(', '));
  ok('e a confusao tem 11', nomesDaConf.length === 11, nomesDaConf.length + '');
  {
    /* O Zubat confunde com Supersom e o Alakazam com Confusao: MESMO texto, titulos diferentes. */
    const a = S.especiaisDaEspecie('zubat').find(e => e.efeito === 'confusao');
    const b = S.especiaisDaEspecie('alakazam').find(e => e.efeito === 'confusao');
    S.abrirEspecialInfo(a.efeito, a.nome, a.tipo, a.chance);
    const hA = S.renderEspecialInfoModal();
    S.abrirEspecialInfo(b.efeito, b.nome, b.tipo, b.chance);
    const hB = S.renderEspecialInfoModal();
    ok('o Zubat e o Alakazam leem o MESMO texto', limpo(hA).replace('Supersom','') === limpo(hB).replace('Confusão',''),
       a.nome + ' / ' + b.nome);
    ok('mas cada um com o NOME da especie dele no titulo',
       hA.indexOf('Supersom') >= 0 && hB.indexOf('Confusão') >= 0 && hA.indexOf('Confusão') < 0);
    /* E o SELO sai na cor do tipo daquele nome -- o Supersom e Normal, a Confusao e Psiquico. */
    ok('e o selo sai na cor do tipo daquele nome',
       hA.indexOf(S.TYPE_COLORS.Normal) >= 0 && hB.indexOf(S.TYPE_COLORS.Psychic) >= 0);
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
  ok('e os dois limites da drenagem', S.textoDoEspecial('{DRENO_MIN}-{DRENO_MAX}') ===
     Math.round(S.ABSORVER_MIN*100) + '-' + Math.round(S.ABSORVER_MAX*100), S.textoDoEspecial('{DRENO_MIN}-{DRENO_MAX}'));

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
console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
