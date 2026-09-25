/**
 * TERRENOS -- a contagem por tipo.
 *
 * O terreno da partida e sorteado da lista, e quem for do tipo dele ganha 1,15x em TODOS os
 * atributos (~15 niveis de vantagem, ver CLAUDE.md). Entao a quantidade de terrenos de cada tipo
 * E balanceamento: um tipo com mais terrenos que os outros ganha o buff com mais frequencia.
 *
 * Isso ja falhou de um jeito silencioso: quando Sombrio e Aco entraram no jogo com Johto, eles
 * ficaram com ZERO terrenos -- um Umbreon ou um Steelix nunca ganhava o bonus, em partida nenhuma,
 * e nada no jogo indicava isso.
 *
 *   node tools/test-terrenos.js
 */
const path = require('path');
const fs = require('fs');
const { createSandbox } = require('./game-sandbox');
const S = createSandbox(path.join(__dirname, '..', 'index.html'));

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const T = S.TERRAINS;
const TIPOS = Object.keys(S.TYPE_CHART);
const conta = {};
TIPOS.forEach(t => conta[t] = 0);
T.forEach(ter => ter.types.forEach(t => { conta[t] = (conta[t] || 0) + 1; }));

console.log('\nCOBERTURA');
ok('todo tipo do TYPE_CHART tem terreno', TIPOS.every(t => conta[t] > 0),
   TIPOS.filter(t => !conta[t]).join(',') || '');
const tipoDesconhecido = [...new Set(T.flatMap(t => t.types))].filter(t => !S.TYPE_CHART[t]);
ok('nenhum terreno usa tipo que nao existe', tipoDesconhecido.length === 0, tipoDesconhecido.join(','));

console.log('\nEQUILIBRIO (o buff de terreno vale ~15 niveis -- ninguem pode ter mais chance)');
const valores = [...new Set(TIPOS.map(t => conta[t]))];
ok('todos os tipos tem a MESMA quantidade de terrenos', valores.length === 1,
   valores.length === 1 ? valores[0] + ' cada' :
   TIPOS.map(t => t + '=' + conta[t]).join(' '));
TIPOS.sort().forEach(t => console.log('         ' + t.padEnd(10) + conta[t]));

console.log('\nAS TRES TABELAS DE TIPO ANDAM JUNTAS');
/* TYPE_CHART decide a batalha; TYPE_NAMES_PT e TYPE_COLORS decidem o selo na tela. Quando Sombrio
   e Aço entraram no chart e não nas outras duas, o selo de um Umbreon saía escrito "Dark", em
   inglês, num cinza genérico -- e nada quebrava. */
const semNome = TIPOS.filter(t => !S.TYPE_NAMES_PT[t]);
const semCor  = TIPOS.filter(t => !S.TYPE_COLORS[t]);
ok('todo tipo tem nome em portugues', semNome.length === 0, semNome.join(','));
ok('todo tipo tem cor', semCor.length === 0, semCor.join(','));
const sobrandoNome = Object.keys(S.TYPE_NAMES_PT).filter(t => !S.TYPE_CHART[t]);
ok('nenhum nome sobrando de tipo que nao existe', sobrandoNome.length === 0, sobrandoNome.join(','));
/* O `terrenoDoGinasio` traduz o nome do ginasio (em portugues) de volta pro ingles pra achar o
   terreno. Sem o tipo no TYPE_NAMES_PT ele devolve null e o ginasio fica SEM terreno. */
const semTraducao = S.KANTO_GYMS.concat(S.JOHTO_GYMS)
  .filter(g => !S.englishTypeFromPortuguese(g.gymTypeName));
ok('o tipo de todo ginasio volta do portugues pro ingles', semTraducao.length === 0,
   semTraducao.map(g => g.leaderName + ' (' + g.gymTypeName + ')').join(', '));

console.log('\nOS TERRENOS DE GINASIO (25/09/2026)');
/* ⚠️ ANTES DE 25/09/2026 O GINASIO SORTEAVA entre os 6 terrenos do tipo do lider, e a trava aqui
   era *'todo ginasio tem terreno do dominio dele'*. Hoje o terreno e FIXO e de UM TIPO SO -- ela
   nao foi afrouxada, virou a da regra nova. */
const G = S.GYM_TERRAINS;
const gyms = S.KANTO_GYMS.concat(S.JOHTO_GYMS);
ok('sao 16 terrenos de ginasio', G.length === 16, String(G.length));
/* ⚠️ A COBERTURA E A TRAVA QUE IMPORTA: um ginasio de tipo novo sem terreno cadastrado lutaria SEM
   terreno, e o sintoma e mudo (some o selo, e o buff do lider some junto). */
const ginSemTerreno = gyms.filter(g => !S.terrenoDoGinasio(g));
ok('todo ginasio tem terreno proprio', ginSemTerreno.length === 0,
   ginSemTerreno.map(g => g.gymTypeName).join(', '));
/* ⚠️ E O TERRENO TEM QUE SER DO TIPO DO LIDER -- errar isto daria o buff ao tipo errado, e o selo
   na tela continuaria dizendo o nome certo. */
const tipoErrado = gyms.filter(g => {
  const t = S.terrenoDoGinasio(g);
  return !t || t.types[0] !== S.englishTypeFromPortuguese(g.gymTypeName);
});
ok('e o buff dele e do tipo do lider', tipoErrado.length === 0,
   tipoErrado.map(g => g.gymTypeName).join(', '));
/* ⚠️ UM TIPO SO: e o pedido ao pe da letra (*'vai dar o buff apenas para pokemons de pedra'*). Um
   segundo tipo aqui devolveria em silencio o que a mudanca veio tirar -- o buff de graca pro time
   do jogador, que hoje sai em 94,8% dos terrenos comuns. */
const maisDeUm = G.filter(t => t.types.length !== 1);
ok('cada terreno de ginasio tem UM tipo so', maisDeUm.length === 0,
   maisDeUm.map(t => t.name + ' (' + t.types.join('/') + ')').join(', '));
ok('e o nome de todos comeca com "Ginásio"', G.every(t => /^Ginásio/.test(t.name)),
   G.filter(t => !/^Ginásio/.test(t.name)).map(t => t.name).join(', '));
ok('e cada um tem id, nome e icone', G.every(t => t.id && t.name && t.icon));
ok('nenhum id repetido', new Set(G.map(t => t.id)).size === G.length);
ok('nenhum nome repetido', new Set(G.map(t => t.name)).size === G.length);
/* ⚠️ ELES NAO PODEM ENTRAR NO `TERRAINS`: aquela tabela e SORTEADA pela liga, oferecida ao lider do
   ginasio do bairro e listada na tela de terrenos. E ela tem 6 terrenos por tipo de proposito -- a
   conta que faz o buff sair com a mesma frequencia pros 17 tipos. */
const vazou = G.filter(t => T.some(x => x.id === t.id));
ok('nenhum deles entrou no TERRAINS da liga', vazou.length === 0,
   vazou.map(t => t.id).join(', '));
ok('e o TERRAINS da liga continua com os 51', T.length === 51, T.length + ' terrenos');
/* ⚠️ E O `terrenoPorId` ACHA OS DOIS -- e o selo do ginasio chama ele. Com o `TERRAINS.find` direto
   o clique no selo nao abria nada, sem erro nenhum. */
ok('o terrenoPorId acha terreno de ginasio', (S.terrenoPorId('ginasio_pedra')||{}).name === 'Ginásio de Pedra');
ok('  e continua achando os da liga', (S.terrenoPorId('vulcao')||{}).name === 'Vulcão');
ok('  e devolve null no que nao existe', S.terrenoPorId('nao_existe') === null);
/* ⚠️ E A LIGA NAO PODE ACEITAR TERRENO DE GINASIO: la o `TERRAINS.find` e uma VALIDACAO implicita,
   e e por isso que os 5 finds da Trainers League e da Classica ficaram como estavam. */
ok('a liga NAO acha terreno de ginasio', !T.some(t => t.id === 'ginasio_pedra'));

console.log('\nO TERRENO DA ROCKET E DO RIVAL (25/09/2026)');
/* ⚠️ SAO QUATRO CONTEXTOS E NAO DOIS: o esconderijo (`hideout1`/`hideout2`) E a Equipe Rocket -- o
   guarda e o chefe. Nomear so `rocket` deixaria as duas lutas mais longas da linha SEM terreno, e
   o jogador veria o selo sumir no meio da sequencia. */
const COM = S.CONTEXTOS_COM_TERRENO;
ok('os quatro contextos da Rocket e do rival sorteiam',
   ['rocket','hideout1','hideout2','rival'].every(c => COM.indexOf(c) >= 0), JSON.stringify(COM));
/* ⚠️ E A ELITE FICA DE FORA porque ela ja tem o dela (um por membro, do chaveamento) -- se ela
   entrasse aqui, o sorteado sobrescreveria o do membro e o selo da tela mentiria. A montanha e a
   vigilia ficam de fora porque sao batalhas de PREMIO, com recompensa calibrada. */
ok('  e a elite, a montanha e a vigilia NAO',
   ['elite','montanha','montanhaLendarios','vigilia'].every(c => COM.indexOf(c) < 0), JSON.stringify(COM));

/* ⚠️ A TRAVA QUE IMPORTA: o que a TELA mostra tem que ser o que o MOTOR aplica. Sao dois leitores
   do mesmo terreno (o `runSpecialBattle` e o selo), e divergindo a tela promete um buff que a luta
   nao da -- o defeito mais caro que este projeto colecionou. */
['rocket','hideout1','hideout2','rival'].forEach(ctx => {
  S.startSpecialBattle(ctx, [{ speciesId:'onix', level:20 }], {});
  const t = S.terrenoDaBatalhaEspecial();
  ok('  ' + ctx + ' entra com terreno', !!t, t ? t.name : '(nenhum)');
  ok('    e ele e um terreno da LIGA (nao de ginasio)',
     !!t && T.some(x => x.id === t.id), t ? t.id : '');
  /* ⚠️ E ELE NAO PODE MUDAR ENTRE A ABERTURA E A LUTA: por isso o sorteio mora no
     `startSpecialBattle` e nao no `runSpecialBattle`, que roda de novo a cada tentativa. */
  ok('    e nao muda quando a tela e lida de novo',
     S.terrenoDaBatalhaEspecial() === t);
});
['montanha','vigilia'].forEach(ctx => {
  S.startSpecialBattle(ctx, [{ speciesId:'onix', level:20 }], {});
  ok('  ' + ctx + ' continua sem terreno', S.terrenoDaBatalhaEspecial() === null,
     String(S.terrenoDaBatalhaEspecial()));
});
/* ⚠️ E ELE NAO VAZA DE UMA BATALHA PRA OUTRA: o campo e reescrito em TODA abertura, entao uma luta
   sem terreno depois de uma com nao pode herdar o buff -- o `terrainBuffed` do time e limpo no
   `runSpecialBattle`, mas o SELO sai deste campo. */
S.startSpecialBattle('rival', [{ speciesId:'onix', level:20 }], {});
const terRival = S.terrenoDaBatalhaEspecial();
S.startSpecialBattle('vigilia', [{ speciesId:'onix', level:20 }], {});
ok('  e o terreno de uma nao vaza pra a seguinte',
   !!terRival && S.terrenoDaBatalhaEspecial() === null);
/* ⚠️ E ESTA E A TRAVA QUE IMPORTA: ela roda o `runSpecialBattle` DE VERDADE e confere que o time
   saiu com o buff. Foi a conferencia de acusacao que a cobrou -- religando o motor pra ignorar o
   `specialTerrain` (o defeito MAIS GRAVE da lista: a tela mostra o selo e a luta nao da o buff),
   todas as travas acima continuavam VERDES, porque elas leem so o lado da TELA.
   ⚠️ E ela cobra o PAR: com terreno o time e marcado, sem terreno nao. Uma metade so passaria com
   um motor que marcasse SEMPRE. */
(function(){
  const g = S.__getGame();
  const montaTime = () => [S.createInstance('pikachu', 30), S.createInstance('onix', 30)]
    .map(p => { p.hp = S.calcMaxHp(p); p.maxHp = p.hp; return p; });
  /* ⚠️ ELA ESPIA O `simulateGymBattle` EM VEZ DE OLHAR DEPOIS, e a razao e que as duas travas
     seriam CONTRADITORIAS: o buff tem que estar LIGADO durante a luta e DESLIGADO depois dela
     (senao vaza pra jornada). Olhando so o estado final, uma das duas sempre falha.
     O dublê anota o time no INSTANTE da chamada e repassa pro original -- a luta acontece igual. */
  const rodou = (ctx) => {
    g.team = montaTime();
    g.equipados = {}; g.currentSaveSlot = 0;
    S.startSpecialBattle(ctx, [{ speciesId:'pidgey', level:28 }], {});
    const t = S.terrenoDaBatalhaEspecial();
    const original = S.simulateGymBattle;
    let duranteALuta = null;
    S.simulateGymBattle = function(meu, dele, rng, op){
      duranteALuta = meu.filter(p => p.terrainBuffed).length;
      return original.apply(this, arguments);
    };
    try { S.runSpecialBattle(); } finally { S.simulateGymBattle = original; }
    return { t, marcados: duranteALuta,
             depois: g.team.filter(p => p.terrainBuffed).length,
             doTipo: t ? g.team.filter(p => (S.SPECIES[p.speciesId].types||[]).some(ty => t.types.indexOf(ty) >= 0)).length : 0 };
  };
  /* sorteia ate cair um terreno que alcance o time -- senao a trava mede o conjunto vazio, que e
     o falso verde mais comum deste arquivo */
  let r = null;
  for(let i = 0; i < 60 && !(r && r.doTipo > 0); i++) r = rodou('rival');
  ok('o MOTOR aplica o terreno da batalha do rival', !!r && r.doTipo > 0 && r.marcados === r.doTipo,
     r ? (r.t ? r.t.name : '(sem terreno)') + ': ' + r.marcados + ' marcados de ' + r.doTipo + ' do tipo' : '(nao rodou)');
  const semTerreno = rodou('vigilia');
  ok('  e NAO aplica onde nao ha terreno', semTerreno.marcados === 0,
     semTerreno.marcados + ' marcados');
  /* ⚠️ E O BUFF NAO PODE SAIR DA BATALHA (25/09/2026). Ele vale 1,15x nos SEIS atributos, teto de
     HP incluido, e a flag ficava LIGADA depois da luta -- o time levava o bonus do terreno do
     rival pra a jornada inteira. Medido no A/B: a conclusao ia a +4,83 pontos (5,3 sigma, 8 de 8
     blocos) enquanto a medicao ISOLADA da batalha dava −0,63. Foram os dois numeros discordando
     que denunciaram.
     ⚠️ E A TRAVA OLHA DEPOIS DA LUTA, nao durante: durante ela TEM que estar ligada. */
  /* ⚠️ ELA REUSA O `rodou`, que sorteia ate cair um terreno que ALCANCE o time -- sem isso ela
     mede o conjunto vazio: com um terreno que nao alcanca ninguem, a flag fica falsa de qualquer
     jeito e a trava passa com o vazamento religado. Foi a conferencia de acusacao que pegou. */
  ok('  e o buff NAO sai da batalha especial', r.depois === 0,
     r.depois + ' com a flag ligada depois da luta (e ' + r.marcados + ' durante)');
})();

/* ⚠️ E O SORTEIO LE O `TERRAINS`, nunca uma lista propria: um terreno novo na tabela entra aqui
   de graca, e um que saia nao fica orfao. Medido: 400 sorteios cobrem mais de um terco da tabela. */
const vistos = new Set();
for(let i = 0; i < 400; i++){
  S.startSpecialBattle('rocket', [{ speciesId:'onix', level:20 }], {});
  vistos.add(S.terrenoDaBatalhaEspecial().id);
}
ok('  e o sorteio varre a tabela da liga', vistos.size > T.length / 3,
   vistos.size + ' terrenos distintos em 400 sorteios, de ' + T.length);

/* ⚠️ E ESTA TRAVA EXERCITA O CAMINHO, nao a funcao -- foi a conferencia de acusacao que cobrou:
   com o `openTerrainInfoModal` voltando ao `TERRAINS.find`, TODAS as travas acima continuavam
   verdes, porque elas chamam o `terrenoPorId` na mao. O modal e quem o selo do ginasio chama, e
   o sintoma de errar la e MUDO: o selo fica na tela e o clique nao abre nada.
   ⚠️ E ela cobra o PAR -- o de ginasio abre E o da liga continua abrindo. */
S.openTerrainInfoModal('ginasio_pedra');
const alvoGin = S.__getGame().terrainInfoTarget;
ok('o SELO do ginasio abre a caixa do terreno',
   !!alvoGin && alvoGin.name === 'Ginásio de Pedra', alvoGin ? alvoGin.name : '(nao abriu)');
S.openTerrainInfoModal('vulcao');
const alvoLiga = S.__getGame().terrainInfoTarget;
ok('  e o selo de um terreno da liga tambem',
   !!alvoLiga && alvoLiga.name === 'Vulcão', alvoLiga ? alvoLiga.name : '(nao abriu)');
S.closeTerrainInfoModal();

/* ⚠️ SAVE ANTIGO NAO QUEBRA E NAO MUDA NO MEIO: o `gymTerrain` e serializado, entao quem parou
   dentro de um ginasio com um terreno SORTEADO continua com ele ate aquele ginasio acabar. O que
   nao pode e a tela deixar de achar aquele terreno -- o selo ficaria mudo. */
S.openTerrainInfoModal('caverna_cristais');
const alvoVelho = S.__getGame().terrainInfoTarget;
ok('um terreno SORTEADO de save antigo continua sendo achado',
   !!alvoVelho && alvoVelho.name === 'Caverna de Cristais', alvoVelho ? alvoVelho.name : '(nao abriu)');
S.closeTerrainInfoModal();

/* ⚠️ O `--battle-scene-id` SAI COM O ID DO GINASIO, e e por esse seletor de atributo que a imagem
   entra -- foi ele que permitiu o cenario do Brock ser UMA LINHA de CSS em 25/09/2026. */
const estGin = S.terrainBattleSceneStyle(G[0]);
ok('o scene-id e o do proprio ginasio', /--battle-scene-id:ginasio_pedra;/.test(estGin));

/* ⚠️ OS 16 GINASIOS TEM CENA PROPRIA desde 25/09/2026, e a trava cobra o CONJUNTO, nunca um nome:
   ela varre a TABELA e exige que cada id tenha a regra de CSS. Nomeando os 16 a mao, o proximo
   ginasio que nascer entraria sem cena e ninguem veria -- ele cairia no `campo_aberto` e a batalha
   continuaria funcionando, que e o jeito mudo de falhar.
   ⚠️ E A DIRECAO IMPORTA: esta olha da TABELA pro CSS. A do bloco 'CENA DE BATALHA' mais abaixo
   olha do CSS pro DISCO (toda imagem pedida existe) -- as duas juntas fecham o circuito, e por
   isso esta aqui NAO confere arquivo: seria a mesma conta, pior feita. */
const RAIZ = path.join(__dirname, '..');
const _srcT = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const semRegra = G.filter(t =>
  _srcT.indexOf('--battle-scene-id:' + t.id + ';"]{background-image:url("assets/batalha/cena-' + t.id + '.webp")') < 0);
ok('os ' + G.length + ' ginasios tem cena propria no CSS', semRegra.length === 0,
   semRegra.map(t => t.id).join(', '));
/* ⚠️ E NENHUMA PODE SER UM PNG DE 2 MB: a raiz e publicada e o jogo ja baixa 2,7 MB de HTML.
   O teto e generoso (600 KB) porque a maior hoje tem 401 KB -- ele existe pra pegar um arquivo
   que entre SEM passar pela conversao, nao pra apertar a arte. */
const cenasPesadas = G.map(t => ({ id:t.id, arq: path.join(RAIZ,'assets','batalha','cena-'+t.id+'.webp') }))
  .filter(x => fs.existsSync(x.arq))
  .map(x => ({ id:x.id, kb: Math.round(fs.statSync(x.arq).size/1024) }))
  .filter(x => x.kb > 600);
ok('  e nenhuma passa de 600 KB', cenasPesadas.length === 0,
   cenasPesadas.map(x => x.id + ' ' + x.kb + 'KB').join(', '));
/* ⚠️ E A PASTA DAS ARTES NAO PODE IR AO AR: a raiz inteira e publicada, e `ginasios-cenarios/`
   tem 34 MB de PNG. E a mesma licao que a `previa-confusao.html` e o `preview-telas.html` ja
   custaram -- lixo publicado, achado depois do deploy. */
const _fb = JSON.parse(fs.readFileSync(path.join(RAIZ, 'firebase.json'), 'utf8'));
ok('a pasta das artes esta no hosting.ignore',
   (_fb.hosting.ignore || []).indexOf('ginasios-cenarios/**') >= 0,
   JSON.stringify(_fb.hosting.ignore));

console.log('\nIDENTIDADE');
ok('nenhum id de terreno repetido', new Set(T.map(t => t.id)).size === T.length, String(T.length));
ok('nenhum nome de terreno repetido', new Set(T.map(t => t.name)).size === T.length);
ok('todo terreno tem nome, icone e ao menos um tipo',
   T.every(t => t.id && t.name && t.icon && Array.isArray(t.types) && t.types.length >= 1));

console.log('\nAS DUAS COPIAS (a tabela e duplicada no servidor)');
const bloco = arq => {
  const t = fs.readFileSync(path.join(__dirname, '..', arq), 'utf8');
  const i = t.indexOf('const TERRAINS = [');
  return t.slice(i, t.indexOf('\n];', i) + 3);
};
ok('TERRAINS identica em index.html e functions/index.js',
   bloco('index.html') === bloco('functions/index.js'));

console.log('\nTODA ESPECIE PODE PEGAR TERRENO');
const semTerreno = Object.keys(S.SPECIES).filter(id =>
  !S.SPECIES[id].types.some(t => conta[t] > 0));
ok('nenhuma especie fica sem terreno possivel', semTerreno.length === 0,
   semTerreno.slice(0,8).join(','));


/* ============================================================================
   A CENA DE BATALHA: o fundo de cada terreno e onde cada lutador poe o pe.

   ⚠️ O QUE ESTE BLOCO EXISTE PRA PEGAR E O DEFEITO QUE NAO DA ERRO: o fundo da cena sai de um
   SELETOR DE ATRIBUTO (`[style*="--battle-atlas:0;"]`), entao um espaco a mais depois dos
   dois-pontos, um ponto-e-virgula que sumiu ou um arquivo com o nome trocado fazem o cenario sair
   VAZIO -- sem erro no console, sem quebrar teste nenhum, e a tela continua desenhando os dois
   lutadores sobre a cor de espera. E o mesmo tipo de armadilha da classe fantasma e do
   `[hidden]` que nao vence o display.
   ============================================================================ */
console.log('\nCENA DE BATALHA -- o fundo');
const htmlCena = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const dirAssets = path.join(__dirname, '..', 'assets', 'batalha');

/* toda imagem que o CSS pede, com o seletor que a pede */
const regrasImg = [];
htmlCena.replace(/\.battle-vs\.battle-scene([^{]*)\{([^}]*background-image:url\("([^"]+)"\)[^}]*)\}/g,
  (t, sel, corpo, url) => { regrasImg.push({ sel: sel.trim(), corpo, url, pos: htmlCena.indexOf(t) }); return t; });

ok('o CSS pede imagem de fundo pra cena', regrasImg.length >= 7, regrasImg.length + ' regras');
const semArquivo = regrasImg.filter(r => !fs.existsSync(path.join(__dirname, '..', r.url)));
ok('toda imagem pedida pelo CSS existe em disco', semArquivo.length === 0,
   semArquivo.map(r => r.url).join(', '));

/* ⚠️ AS TRES CENAS DEDICADAS sao a cena INTEIRA, nao um slot da folha 3x3 -- elas PRECISAM
   sobrescrever o background-size, senao sairiam recortadas em 1/9. E elas tem que vir DEPOIS das
   do atlas: as duas alcancam a mesma cena com a mesma especificidade, entao quem vence e a
   ultima. */
const dedicadas = regrasImg.filter(r => r.sel.indexOf('--battle-scene-id:') >= 0);
const doAtlas   = regrasImg.filter(r => r.sel.indexOf('--battle-atlas:') >= 0);
ok('ha regra de atlas e regra de cena dedicada', doAtlas.length >= 6 && dedicadas.length >= 1,
   doAtlas.length + ' atlas / ' + dedicadas.length + ' dedicadas');
ok('toda cena dedicada sobrescreve o background-size',
   dedicadas.every(r => /background-size:100% 100%/.test(r.corpo)),
   dedicadas.filter(r => !/background-size:100% 100%/.test(r.corpo)).map(r => r.url).join(', '));
ok('as dedicadas vem DEPOIS das do atlas no arquivo',
   dedicadas.length === 0 || Math.min.apply(null, dedicadas.map(r => r.pos)) >
                             Math.max.apply(null, doAtlas.map(r => r.pos)));

/* ⚠️ O FORMATO DA VARIAVEL E O QUE O SELETOR LE. Um `--battle-atlas: 3;` (com espaco) nao casa
   com `[style*="--battle-atlas:3;"]`, e o fundo some. */
console.log('\nCENA DE BATALHA -- o estilo inline casa com o seletor');
const estilos = T.map(t => ({ id: t.id, st: S.terrainBattleSceneStyle(t) }));
ok('todo terreno declara --battle-scene-id no formato do seletor',
   estilos.every(e => e.st.indexOf('--battle-scene-id:' + e.id + ';') >= 0),
   estilos.filter(e => e.st.indexOf('--battle-scene-id:' + e.id + ';') < 0).map(e => e.id).slice(0,5).join(', '));
ok('todo terreno declara --battle-atlas no formato do seletor',
   estilos.every(e => /--battle-atlas:\d+;/.test(e.st)));

/* ⚠️ A TRAVA QUE IMPORTA: cada um dos 51 casa com EXATAMENTE UMA regra de imagem. Zero = cenario
   vazio; duas do mesmo tipo = a arte de um terreno aparecendo noutro. */
/* ⚠️ O `:not(...)` TEM QUE SAIR ANTES, e foi ele que derrubou a primeira versao desta trava: a
   regra do atlas 1 e DUPLA -- ela vale pra quem tem `--battle-atlas:1;` E pra quem NAO tem a
   variavel nenhuma (a cena desenhada sem o estilo). Lido cru, o `[style*="--battle-atlas:"]` de
   dentro do `:not` e substring de TODOS os 51, e a trava acusava os 42 de uma vez. */
function casa(sel, st){
  const limpo = sel.replace(/:not\([^)]*\)/g, '');
  const m = limpo.match(/\[style\*="([^"]+)"\]/g) || [];
  return m.some(p => st.indexOf(p.slice(9, -3)) >= 0);
}
const semFundo = [], comDois = [];
estilos.forEach(e => {
  const ded = dedicadas.filter(r => casa(r.sel, e.st));
  const atl = doAtlas.filter(r => casa(r.sel, e.st));
  if(ded.length + atl.length === 0) semFundo.push(e.id);
  if(ded.length > 1 || atl.length > 1) comDois.push(e.id);
});
ok('nenhum terreno fica sem regra de fundo', semFundo.length === 0, semFundo.join(', '));
ok('nenhum terreno casa com duas regras do mesmo tipo', comDois.length === 0, comDois.join(', '));

/* ============================================================================
   ONDE CADA UM POE O PE.

   ⚠️ ATE 22/09/2026 AS DUAS POSICOES ERAM FIXAS pros 51 -- (22%,84%) e (78%,64%) --, e o CENARIO
   e que tinha de ter chao ali. O SUBMARINO AFUNDADO nao tinha: o piso dele so comeca em 68% da
   altura, e o adversario nascia dentro da parede. Hoje a posicao e POR CENARIO.
   ============================================================================ */
console.log('\nCENA DE BATALHA -- o pe de cada lutador');
const iTab = htmlCena.indexOf('const TERRAIN_BATTLE_FOOTING = {');
const tabela = htmlCena.slice(iTab, htmlCena.indexOf('\n};', iTab));
ok('a tabela do pe existe no arquivo', iTab > 0, String(tabela.length) + ' chars');
const semPe = T.filter(t => tabela.indexOf('"' + t.id + '"') < 0 && tabela.indexOf('\n  ' + t.id + ':') < 0);
ok('todo terreno tem posicao PROPRIA na tabela (nenhum cai no padrao)',
   semPe.length === 0, semPe.map(t => t.id).slice(0,8).join(', '));

function pes(st){
  const n = k => parseFloat((st.match(new RegExp('--battle-' + k + ':([\\d.]+)%')) || [])[1]);
  return { px: n('player-x'), py: n('player-y'), ex: n('enemy-x'), ey: n('enemy-y') };
}
const fora = estilos.filter(e => {
  const p = pes(e.st);
  return ![p.px, p.py, p.ex, p.ey].every(v => v > 0 && v < 100);
});
ok('as quatro posicoes de todo terreno sao porcentagens dentro da cena', fora.length === 0,
   fora.map(e => e.id).join(', '));

/* ⚠️ O ADVERSARIO FICA MAIS LONGE -- e a camera e frontal, entao o pe dele e sempre MAIS ALTO na
   tela que o do jogador. Invertido, os dois trocam de profundidade e o de tras desenha na frente. */
const invertidos = estilos.filter(e => { const p = pes(e.st); return p.ey >= p.py; });
ok('o pe do adversario fica ACIMA do pe do jogador nos 51', invertidos.length === 0,
   invertidos.map(e => e.id).join(', '));

/* ⚠️ E O SUBMARINO E O CASO QUE TROUXE A TABELA: ele nao pode voltar pro 64% fixo de antes, que
   era o que o punha dentro da parede. */
const sub = estilos.find(e => e.id === 'submarino_afundado');
ok('o submarino tem cena dedicada',
   dedicadas.some(r => r.sel.indexOf('submarino_afundado') >= 0));
/* ⚠️ ELA MEDIA O NUMERO ATE 23/09/2026 ("desceu do 64% fixo de antes") e caiu quando a tabela
   INTEIRA subiu 4 pontos -- sem nada estar errado. Hoje ela mede a REGRA: o submarino foi AFINADO
   a parte, e e isso que o protege de alguem normalizar a tabela e devolve-lo pra dentro da parede. */
const generico = estilos.find(e => e.id === 'campo_aberto');
ok('o submarino tem posicao propria, diferente da generica',
   !!sub && !!generico && pes(sub.st).ey !== pes(generico.st).ey,
   sub && generico ? 'submarino ' + pes(sub.st).ey + '% x campo_aberto ' + pes(generico.st).ey + '%' : '-');

/* ⚠️ E O CSS LE AS QUATRO COMO VARIAVEL COM PADRAO: terreno que saia da tabela um dia volta ao
   comportamento antigo em vez de ficar sem chao. */
const leituras = htmlCena.match(/var\(--battle-(?:player|enemy)-[xy][^)]*\)/g) || [];
const semPadrao = leituras.filter(v => !/,\s*[\d.]+%/.test(v));
ok('TODA leitura das quatro posicoes no CSS tem valor padrao',
   leituras.length >= 4 && semPadrao.length === 0,
   leituras.length + ' leituras' + (semPadrao.length ? ' -- sem padrao: ' + semPadrao.join(', ') : ''));


/* ============================================================================
   TODO ADVERSARIO NA MESMA ALTURA (23/09/2026).

   ⚠️ REPORTADO: *"o gyarados tava mais pra cima, ele morreu e entrou um raichu, e ai o raichu
   ficou mais pra baixo"*. O estilo da cena era IDENTICO nos 11 confrontos -- quem mudava era a
   ESPECIE: quem VOA leva `padding-bottom:10px` no wrap, e como o sprite do adversario e ampliado
   1,55x esses 10px viram 15,5px. Sao 37 das 250 que voam, entao a diferenca ia e vinha de
   confronto pra confronto sem nada na tela explicando.

   Estas travas leem o CSS porque o defeito e de CSS: o HTML das duas especies e legitimamente
   diferente (a classe do ground-base muda, e ela decide a FORMA da sombra) -- o que nao pode
   diferir e a ALTURA.
   ============================================================================ */
console.log('\nCENA DE BATALHA -- todo adversario na mesma altura');
/* ⚠️ A REGRA GENERICA E ANCORADA NO COMECO DA LINHA: sem isso o padrao casa tambem com a do
   ADVERSARIO (que a CONTEM por inteiro), e a trava passa a medir a regra errada -- ela reportou
   "padding-bottom:0" como se fosse o levantamento. E a familia do padrao largo demais. */
const regraAr = htmlCena.match(/\n\s*\.battle-ground-base\.air \+ \.battle-sprite-stage \.battle-sprite-wrap\{([^}]*)\}/);
ok('a regra que levanta quem voa existe', !!regraAr, regraAr ? regraAr[1] : '-');
const zeraAr = htmlCena.match(/\.battle-fighter\.enemy[^{]*\.battle-sprite-wrap\{padding-bottom:0;?\}/);
ok('no lado do ADVERSARIO ela e zerada', !!zeraAr,
   zeraAr ? zeraAr[0].slice(0, 70) : 'quem voa voltaria a ficar 15px acima de quem nao voa');
/* ⚠️ E A COMPENSACAO DA SOMBRA TEM QUE TER SAIDO JUNTO: ela existia SO por causa do levantamento
   (a sombra subia 15px pra alcancar o pe). Com o levantamento fora, ela poria a sombra 15px ACIMA
   do pe -- ou seja, os dois andam juntos nos dois sentidos. */
ok('a compensacao de 15px da sombra saiu junto',
   htmlCena.indexOf('.battle-fighter.enemy .battle-ground-base.air{margin-top:') < 0);
/* o levantamento continua valendo do lado do JOGADOR -- ali ele nunca foi reportado, e e o que
   faz quem voa parecer que voa */
ok('do lado do JOGADOR o levantamento continua',
   !/\.battle-fighter\.player[^{]*\.battle-sprite-wrap\{padding-bottom:0/.test(htmlCena));

/* ============================================================================
   A SOMBRA CRESCE COM O POKEMON (23/09/2026).

   ⚠️ ATE AQUI ELA TINHA TAMANHO FIXO -- 42px pra todo mundo --, e o sprite DESENHADO varia 1,8x
   (medido em 20 especies a 320px: 56px no Caterpie, 100px no Onix). A razao sombra/sprite ia de
   0,75 a 0,42.

   ⚠️ ESTAS TRAVAS LEEM O CSS porque o defeito e de CSS -- e porque o que sustenta a mecanica nao
   aparece em asserção de HTML nenhuma: a sombra so e proporcional se ela morar DENTRO do sprite.
   ============================================================================ */
console.log('\nCENA DE BATALHA -- a sombra cresce com o pokemon');

/* ⚠️ A REGRA TEM QUE SER DO `.battle-sprite-wrap`, e nao do palco nem do ground-base: o wrap e o
   UNICO elemento da cena que tem a largura do POKEMON (o palco e 40% fixo da cena e o ground-base
   e irmao dele). Movida pra qualquer um dos dois, a sombra volta a ter tamanho fixo -- e continua
   aparecendo na tela, que e o que faz isso passar despercebido. */
const regraSombra = htmlCena.match(/\.battle-scene \.battle-sprite-wrap::after\{([^}]*)\}/);
ok('a sombra e um ::after do .battle-sprite-wrap (onde existe a largura do pokemon)',
   !!regraSombra, regraSombra ? regraSombra[1].replace(/\s+/g, ' ').slice(0, 90) : 'nao achei a regra');
const corpoSombra = regraSombra ? regraSombra[1] : '';

/* ⚠️ A LARGURA E EM %, nunca em px: em px ela volta a ser a mesma pra todo bicho, que e o defeito. */
ok('a largura sai de left/right em % (nao de um px fixo)',
   /left:calc\(\s*[\d.]+%/.test(corpoSombra) && /right:calc\(\s*[\d.]+%/.test(corpoSombra)
   && !/width:\s*\d+px/.test(corpoSombra),
   corpoSombra.replace(/\s+/g, ' ').slice(0, 70));

/* ⚠️ E A ALTURA SAI DO `aspect-ratio`: uma altura em % resolveria contra a ALTURA do wrap, e ai um
   sprite alto e fino ganharia uma sombra alta. Uma em px nao cresceria com o bicho. */
ok('a altura sai do aspect-ratio (nao de px nem de %)',
   /aspect-ratio:/.test(corpoSombra) && !/height:\s*[\d.]+(px|%)/.test(corpoSombra),
   (corpoSombra.match(/aspect-ratio:[^;]*/) || ['-'])[0]);

/* ⚠️ E O `translateY(50%)` CENTRA ELA NA LINHA DO PE -- e onde as tres variantes antigas ficavam
   (todas tinham margin-top de metade da propria altura). Sem ele a sombra fica inteira ACIMA. */
ok('ela e centrada na linha do pe (translateY 50%)', /transform:translateY\(50%\)/.test(corpoSombra));

/* ⚠️ E ELA E ESCOPADA NA CENA: o `battleAnimatedSpriteHtml` e exclusivo dela hoje, mas ele e uma
   FUNCAO -- reusado noutra tela, um ::after sem escopo poria uma sombra la sem ninguem ver. */
ok('a regra e escopada na .battle-scene',
   htmlCena.indexOf('.battle-scene .battle-sprite-wrap::after') >= 0
   && !/\n\s*\.battle-sprite-wrap::after\{/.test(htmlCena));

/* ⚠️ E AS TRES VARIANTES DESENHADAS TEM QUE TER SAIDO DO `.battle-ground-base`: elas tinham
   tamanho fixo (18% e 24% da CENA), entao uma que sobrasse desenharia uma segunda sombra --
   daquelas que nao crescem -- por cima da nova. Ele hoje e so o portador da classe. */
ok('o .battle-ground-base nao desenha mais nada',
   /\.battle-ground-base\{display:none;\}/.test(htmlCena)
   && !/\.battle-ground-base\.(air|water)\{[^}]*border-radius/.test(htmlCena));
/* ⚠️ MAS ELE CONTINUA NO HTML: e ele que diz, pelo combinador `+`, se a especie voa ou nada. */
ok('mas ele continua sendo emitido (as regras de + dependem dele)',
   htmlCena.indexOf('class="battle-ground-base ${battleGroundBaseClass(') >= 0);

/* ⚠️ E A SOMBRA DE CONTATO TEM QUE TER SAIDO DO PALCO pelo mesmo motivo: `left:28%;right:28%` dele
   e 42px pra todo bicho, e duas sombras empilhadas nao se leem como defeito -- se leem como uma
   sombra que nao cresce. */
ok('a sombra de contato saiu do palco',
   !/\.battle-sprite-stage::after\{[^}]*border-radius/.test(htmlCena));

/* ⚠️ A ONDINHA DE QUEM NADA REUSA A MESMA CAIXA -- se ela voltar a ter largura propria, ela volta a
   ser fixa. O que ela pode ter de proprio e a PINTURA e a razao (ela sempre foi mais gorda). */
const regraAgua = htmlCena.match(/\.battle-ground-base\.water \+ \.battle-sprite-stage \.battle-sprite-wrap::after\{([^}]*)\}/);
ok('a ondinha da agua reusa a caixa da sombra (so troca a pintura)',
   !!regraAgua && !/(left|right|width):/.test(regraAgua[1]),
   regraAgua ? regraAgua[1].replace(/\s+/g, ' ').slice(0, 70) : 'nao achei a regra');

/* ⚠️ E O EMPURRAO PRA ESQUERDA DO ADVERSARIO E EM % DO SPRITE, que e a unidade em que ele foi
   MEDIDO (o pe desvia -4,6% da largura do QUADRO, e ele e metade disso). Em % da cena, cada
   tamanho de sprite recebia um empurrao diferente do que a medicao diz. */
const dx = htmlCena.match(/\.battle-scene \.battle-fighter\.enemy \.battle-sprite-wrap\{--sombra-dx:(-[\d.]+)%;\}/);
ok('o empurrao do adversario e uma variavel em % do SPRITE', !!dx, dx ? dx[1] + '%' : '-');
ok('e a sombra LE essa variavel com padrao 0 (o jogador nao anda)',
   /var\(--sombra-dx,\s*0%\)/.test(corpoSombra));

/* ============================================================================
   AS ESPADINHAS NAO APARECEM NA CENA (23/09/2026).
   ⚠️ Reportado: *"no fundo dos cenarios ainda esta exibindo aquele simbolos de espadinhas que
   exibia no modo antigo"*. Elas vinham do arquivo de referencia como marca d agua no centro.
   ============================================================================ */
console.log('\nCENA DE BATALHA -- as espadinhas');
ok('a cena esconde as espadinhas',
   /\.battle-vs\.battle-scene \.vs-swords\{display:none;\}/.test(htmlCena));
/* ⚠️ E A REGRA E ESCOPADA NA CENA: no caminho ANTIGO o `.vs-swords` e o **x entre os dois
   lutadores** (e e nele que o 🌧️ da chuva se pendura), e o Boss, a Selecao, o desafio por codigo e
   o online seguem naquele desenho. Escondido sem escopo, quatro telas perdem o x. */
ok('e ela NAO alcanca o caminho antigo',
   !/\n\s*\.vs-swords\{[^}]*display:none/.test(htmlCena)
   && htmlCena.indexOf('.vs-swords{font-size:1.4rem;display:inline-block;}') >= 0);

/* ============================================================================
   A CHUVA CAINDO NA CENA (24/09/2026, a pedido).
   ⚠️ O QUE ELAS EXISTEM PRA PEGAR nao e o desenho -- e a ARITMETICA que faz o desenho funcionar,
   e ela nao aparece em print nenhum:
     1) o passo tem que ser um numero INTEIRO de ladrilhos em TODA camada, senao o recomeco da
        animacao (o render() recria o innerHTML e toda animacao de CSS reinicia junto) da um PULO;
     2) e NENHUM sub-passo pode repetir o padrao, senao a chuva desliza sobre si mesma e parece
        PARADA -- a armadilha da linha infinita, o primeiro desenho a ser descartado.
   Um padrao ladrilhado (w,h) so e invariante pelas translacoes da rede {(a*w, b*h)}, entao as duas
   coisas sao uma CONTA e nao uma opiniao. ⚠️ E ela ja pegou um defeito real: a 2a camada da FRENTE
   tinha ladrilho 56x42 com passo (-28,84) -- 28/56 nao e inteiro, e so ELA pularia.
   ⚠️ E OS NUMEROS SAO LIDOS DO index.html: escritos aqui, a trava mediria a si mesma. */
console.log('\nCENA DE BATALHA -- a chuva');
{
  const blocoChuva = (cls) => {
    const i = htmlCena.indexOf('.battle-chuva.' + cls + '{');
    return i < 0 ? '' : htmlCena.slice(i, htmlCena.indexOf('}', i));
  };
  const passoDe = (nome) => {
    const m = htmlCena.match(new RegExp('@keyframes battle-chuva-' + nome +
      '\\{ to\\{ transform:translate3d\\((-?\\d+)px,(-?\\d+)px,0\\); \\} \\}'));
    return m ? [Number(m[1]), Number(m[2])] : null;
  };
  const ladrilhosDe = (b) => {
    const m = b.match(/background-size:([^;]+);/);
    return m ? m[1].split(',').map(s => s.trim().split(/\s+/)
                                    .map(v => Number(v.replace('px', '')))) : [];
  };
  const svgDe = (b) => {
    const m = b.match(/background-image:url\("data:image\/svg\+xml,([^"]+)"\)/);
    return m ? decodeURIComponent(m[1]) : '';
  };
  const gotasDe = (svg) => [...svg.matchAll(/M(-?\d+) (-?\d+)l(-?\d+) (-?\d+)/g)]
    .map(m => ({ x: +m[1], y: +m[2], dx: +m[3], dy: +m[4] }));
  ok('as duas camadas existem (a de tras e a da frente)',
     !!blocoChuva('atras') && !!blocoChuva('frente'));
  /* ⚠️ A REGRESSAO LITERAL DO RELATO: `linear-gradient` so produz listra INFINITA, que atravessa o
     ladrilho e emenda com a do vizinho -- foi assim que a chuva nasceu e foi por isso que ela foi
     reportada ("os tracos tao muito continuo"). O desenho tem que ser o ladrilho de gotas. */
  ok('o desenho sao GOTAS, nunca listras de linear-gradient',
     !/\.battle-chuva[^}]*linear-gradient/.test(htmlCena)
     && gotasDe(svgDe(blocoChuva('atras'))).length > 0);
  [['atras', 2], ['frente', 7]].forEach(([cls, zEsperado]) => {
    const b = blocoChuva(cls), passo = passoDe(cls), tiles = ladrilhosDe(b);
    ok('  ' + cls + ': tem passo e ladrilhos pra ler', !!passo && tiles.length >= 1);
    if(!passo || !tiles.length) return;
    const [dx, dy] = passo;
    ok('  ' + cls + ': o passo e um numero INTEIRO de ladrilhos em TODA camada',
       tiles.every(([w, h]) => Math.abs(dx) % w === 0 && dy % h === 0),
       tiles.map(([w, h]) => (Math.abs(dx) / w) + 'x' + (dy / h)).join(' e '));
    let invariantes = 0;
    for(let k = 2; k <= 400; k++){
      if(dx % k || dy % k) continue;
      if(tiles.every(([w, h]) => (Math.abs(dx) / k) % w === 0 && (dy / k) % h === 0)) invariantes++;
    }
    ok('  ' + cls + ': e NENHUM sub-passo repete o padrao (ela nao parece parada)',
       invariantes === 0, invariantes + ' sub-passos invariantes');
    /* ⚠️ AS GOTAS CAEM NA MESMA DIRECAO DO PASSO: desenhadas noutra inclinacao, o risco atravessa
       a trajetoria em vez de segui-la -- a gota andaria de lado. */
    const gs = gotasDe(svgDe(b)), incl = dy / Math.abs(dx);
    const fora = gs.filter(g => Math.abs((g.dy / Math.abs(g.dx)) - incl) > 0.25);
    ok('  ' + cls + ': toda gota cai na MESMA inclinacao do passo', gs.length > 0 && !fora.length,
       gs.length + ' gotas, ' + fora.length + ' fora da inclinacao ' + incl);
    /* ⚠️ E ELA E CURTA: a gota que atravessa o ladrilho EMENDA com a do vizinho e vira listra --
       o criterio e estrutural, nao um limiar de gosto. */
    const [w0, h0] = tiles[0];
    const comp = gs.map(g => Math.max(Math.abs(g.dx) / w0, Math.abs(g.dy) / h0));
    ok('  ' + cls + ': e nenhuma gota atravessa o ladrilho (senao ela emenda e vira listra)',
       comp.every(c => c < 1),
       'a maior ocupa ' + Math.round(Math.max.apply(null, comp) * 100) + '% do ladrilho');
    /* ⚠️ E O WRAP: a gota que sai por uma borda tem que REENTRAR pela oposta, senao sobra uma faixa
       vazia em volta do ladrilho e a repeticao vira uma GRADE de corredores -- o padrao que este
       desenho existe pra tirar. */
    const tem = (g) => gs.some(o => o.dx === g.dx && o.dy === g.dy && o.x === g.x && o.y === g.y);
    const semVolta = gs.filter(g => {
      const oxs = [], oys = [];
      if(Math.min(g.x, g.x + g.dx) < 0) oxs.push(w0);
      if(Math.max(g.x, g.x + g.dx) > w0) oxs.push(-w0);
      if(Math.min(g.y, g.y + g.dy) < 0) oys.push(h0);
      if(Math.max(g.y, g.y + g.dy) > h0) oys.push(-h0);
      if(!oxs.length && !oys.length) return false;
      return !oxs.concat(0).some(ox => oys.concat(0).some(oy =>
        (ox || oy) && tem({ x: g.x + ox, y: g.y + oy, dx: g.dx, dy: g.dy })));
    });
    ok('  ' + cls + ': a gota que sai por uma borda REENTRA pela oposta (sem corredor vazio)',
       !semVolta.length, gs.length + ' gotas, ' + semVolta.length + ' sem a volta');
    /* a folga do inset cobre o caminho de um ciclo, senao a borda de cima fica VAZIA no fim dele */
    const ins = (b.match(/inset:(-?\d+)px (-?\d+)px/) || []).slice(1).map(Number);
    ok('  ' + cls + ': a folga do inset cobre o ciclo inteiro',
       ins.length === 2 && -ins[0] >= dy && -ins[1] >= Math.abs(dx),
       'topo ' + (-ins[0]) + '>=' + dy + ', direita ' + (-ins[1]) + '>=' + Math.abs(dx));
    ok('  ' + cls + ': fica no z-index ' + zEsperado + ' (' +
       (zEsperado < 5 ? 'atras do pokemon' : 'na frente dele, e atras do dano e do painel') + ')',
       new RegExp('z-index:' + zEsperado + ';').test(b));
  });
  /* ⚠️ E O MOVIMENTO E `transform`, nunca `background-position`: aquele e composto na GPU e este
     REPINTA a camada inteira a 60fps, num celular, do tamanho da cena. */
  ok('o movimento e transform (composto na GPU), nao background-position',
     /@keyframes battle-chuva-atras\{ to\{ transform:/.test(htmlCena)
     && !/@keyframes battle-chuva-\w+\{ to\{ background-position:/.test(htmlCena));
  /* as duas caem com o MESMO vento, e a de tras mais devagar -- e a que esta longe */
  const pa = passoDe('atras'), pf = passoDe('frente');
  ok('as duas caem com a MESMA inclinacao (e o mesmo vento)',
     !!pa && !!pf && Math.abs((pa[1] / Math.abs(pa[0])) - (pf[1] / Math.abs(pf[0]))) < 0.01,
     pa && pf ? (pa[1] / Math.abs(pa[0])).toFixed(2) + ' e ' + (pf[1] / Math.abs(pf[0])).toFixed(2) : '');
  const durDe = (cls) => Number((blocoChuva(cls).match(/animation:battle-chuva-\w+ ([\d.]+)s/) || [])[1]);
  ok('e a de TRAS cai mais devagar que a da FRENTE (paralaxe)',
     !!pa && !!pf && (pa[1] / durDe('atras')) < (pf[1] / durDe('frente')),
     pa && pf ? Math.round(pa[1] / durDe('atras')) + ' px/s contra ' + Math.round(pf[1] / durDe('frente')) : '');
  ok('e ela nao recebe toque (pointer-events:none)',
     /\.battle-chuva\{[^}]*pointer-events:none/.test(htmlCena));

  /* ⚠️ ELA VEM DO MATCHUP, nunca de estado global: o log e relido dias depois e ali o
     `chuvaRestante` ja nao existe. Confronto gravado antes do campo sai SEM chuva. */
  ok('so chove quando o CONFRONTO diz que choveu',
     S.chuvaDaCenaHtml({ chuva: true }).length > 0
     && S.chuvaDaCenaHtml({ chuva: false }) === ''
     && S.chuvaDaCenaHtml({}) === '' && S.chuvaDaCenaHtml(null) === '');
  ok('e ela desenha as DUAS camadas',
     (S.chuvaDaCenaHtml({ chuva: true }).match(/class="battle-chuva /g) || []).length === 2,
     S.chuvaDaCenaHtml({ chuva: true }));
  /* ⚠️ TODA TELA QUE DESENHA A CENA TEM QUE CHAMAR: escrita em cada uma, a que ficasse pra tras
     nao teria chuva nenhuma -- e a que ninguem olha e a do log relido. A conta e contra o NUMERO
     de cenas, e nao um 5 escrito aqui, que envelheceria na sexta. */
  const cenas = (htmlCena.match(/battle-scene-grid"><\/div>/g) || []).length;
  const chamadas = (htmlCena.match(/chuvaDaCenaHtml\(m\)/g) || []).length - 1; /* menos a declaracao */
  ok('TODA tela que desenha a cena chama a chuva', cenas > 0 && chamadas === cenas,
     cenas + ' cenas, ' + chamadas + ' chamadas');
}

/* ============================================================================
   A CHUVA DA CENA SEGUE A DANCA DA CHUVA (24/09/2026, a pedido: "garanta que o efeito de chuva so
   comeca quando tem danca da chuva e quando acabar o efeito da danca, tambem acaba no cenario").
   ⚠️ ELAS NAO LEEM O CODIGO: rodam batalhas de verdade e comparam o campo `m.chuva` -- de onde a
   cena sai -- com as MARCAS DO DIARIO (`x:'chuva'` = comecou aqui, `x:'chuvafim'` = este foi o
   ultimo debaixo dela). Ou seja a fonte da tela e conferida contra a fonte do motor.
   ⚠️ E A LISTA SAI DO ARQUIVO: `const CHUVA` nao vira propriedade global do sandbox, entao
   `S.CHUVA` volta undefined -- e a trava mediria o nada. */
console.log('\nCENA DE BATALHA -- a chuva segue a Danca da Chuva');
{
  const DANCA = (htmlCena.match(/const CHUVA = \[([\s\S]*?)\];/) || [])[1]
    .split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  const TETO = Number((htmlCena.match(/const CHUVA_EM_CONFRONTOS = (\d+)/) || [])[1]);
  ok('a lista da Danca da Chuva e o teto foram lidos do arquivo', DANCA.length > 5 && TETO > 0,
     DANCA.length + ' especies, teto ' + TETO);
  /* ⚠️ o hp/maxHp nao e setado a mao: o simulateGymBattle CURA os dois times na entrada, e o
     createInstance devolve 0/0 -- a armadilha que este projeto ja registra em quatro medicoes. */
  const mk = (id, lv) => { const p = S.createInstance(id, lv); p.ataques = S.ataquesPadrao(p); return p; };
  const semDanca = ['machamp', 'onix', 'rhydon', 'tauros', 'hitmonlee', 'kangaskhan']
    .filter(id => DANCA.indexOf(id) < 0);
  /* os trechos em que a chuva viveu, lidos do DIARIO */
  const trechos = (ms) => {
    const t = [];
    ms.forEach((m, i) => {
      const d = m.golpes || [];
      if(d.some(g => g.x === 'chuva')) t.push({ ini: i, fim: null });
      if(d.some(g => g.x === 'chuvafim') && t.length) t[t.length - 1].fim = i;
    });
    return t;
  };

  /* ===== 1) com Danca da Chuva no time: o campo casa com os trechos, confronto a confronto ===== */
  let erros = [], conf = 0, chovendo = 0, comTrecho = 0;
  for(let n = 0; n < 300; n++){
    const meu = [DANCA[n % DANCA.length], 'machamp', 'onix'].map(id => mk(id, 55));
    const dele = [DANCA[(n + 3) % DANCA.length], 'rhydon', 'tauros'].map(id => mk(id, 54));
    const ms = (S.simulateGymBattle(meu, dele, S.makeSeededRng('segue-' + n)).matchups) || [];
    const t = trechos(ms);
    if(t.length) comTrecho++;
    conf += ms.length;
    chovendo += ms.filter(m => m.chuva).length;
    /* A) quem mostra chuva esta DENTRO de um trecho */
    ms.forEach((m, i) => {
      if(m.chuva && !t.some(x => i >= x.ini && (x.fim === null || i <= x.fim)))
        erros.push(n + ':' + i + ' mostra chuva fora do trecho');
    });
    /* B) e quem esta dentro MOSTRA */
    t.forEach(x => { const ate = x.fim === null ? ms.length - 1 : x.fim;
      for(let i = x.ini; i <= ate; i++) if(!ms[i].chuva) erros.push(n + ':' + i + ' dentro do trecho e seco'); });
    /* C) ⚠️ O PEDIDO LITERAL: o confronto DEPOIS do `chuvafim` nao chove (a nao ser que outro
       trecho comece nele -- a chuva pode sair mais de uma vez na mesma batalha). */
    t.forEach(x => { if(x.fim === null) return;
      const dep = x.fim + 1;
      if(dep < ms.length && ms[dep].chuva && !t.some(y => y.ini === dep))
        erros.push(n + ':' + dep + ' continua chovendo depois do fim'); });
    /* D) o trecho nao passa do teto sem outro trecho pra explicar */
    t.forEach(x => { const ate = x.fim === null ? ms.length - 1 : x.fim;
      if(ate - x.ini + 1 > TETO && !t.some(y => y !== x && y.ini > x.ini && y.ini <= ate))
        erros.push(n + ': trecho de ' + (ate - x.ini + 1) + ' confrontos'); });
    /* E) e a CENA desenha exatamente onde o campo diz */
    ms.forEach((m, i) => {
      if((S.chuvaDaCenaHtml(m).length > 0) !== !!m.chuva) erros.push(n + ':' + i + ' a cena discorda do campo');
    });
  }
  ok('a chuva da cena casa com a Danca da Chuva, confronto a confronto', erros.length === 0,
     erros.slice(0, 3).join(' | ') || conf + ' confrontos em 300 batalhas');
  ok('e ela ACONTECE no painel (senao a trava nao mediu nada)', comTrecho > 10 && chovendo > 20,
     comTrecho + ' batalhas com chuva, ' + chovendo + ' confrontos chovendo');

  /* ===== 2) sem ninguem que dance: NUNCA chove ===== */
  let semChuva = 0, confSem = 0;
  for(let n = 0; n < 300; n++){
    const meu = [semDanca[n % 3], semDanca[(n + 1) % 3], semDanca[(n + 2) % 3]].map(id => mk(id, 55));
    const dele = [semDanca[(n + 3) % 6], semDanca[(n + 4) % 6], semDanca[(n + 5) % 6]].map(id => mk(id, 54));
    const ms = (S.simulateGymBattle(meu, dele, S.makeSeededRng('seco-' + n)).matchups) || [];
    confSem += ms.length;
    semChuva += ms.filter(m => m.chuva).length;
  }
  ok('sem ninguem que dance, NENHUM confronto chove', semChuva === 0 && confSem > 100,
     semChuva + ' de ' + confSem + ' confrontos');

  /* ⚠️ E O CAMPO E SEMPRE UM BOOLEANO, nunca `comChuva || undefined` (que foi como ele nasceu).
     No cliente o undefined e inofensivo pro Firestore (o JSON.stringify some com a chave), mas o
     SERVIDOR grava o log da liga -- e o Admin SDK recusa a gravacao INTEIRA. Isso matou as duas
     ligas de 11 a 13/09/2026. Do lado do servidor quem cobra e o test-liga-treinadores; aqui se
     cobra o do cliente, que e o que vai pro save. */
  let foraDeBool = 0, checados = 0;
  for(let n = 0; n < 120; n++){
    const ms = (S.simulateGymBattle(
      [DANCA[n % DANCA.length], 'onix'].map(id => mk(id, 55)),
      ['machamp', 'rhydon'].map(id => mk(id, 54)),
      S.makeSeededRng('bool-' + n)).matchups) || [];
    ms.forEach(m => { checados++; if(typeof m.chuva !== 'boolean') foraDeBool++; });
  }
  ok('e o campo `chuva` e sempre um BOOLEANO', foraDeBool === 0 && checados > 100,
     foraDeBool + ' de ' + checados + ' matchups fora de booleano');

  /* ===== 3) o caso DELICADO: a chuva sai DUAS vezes na mesma batalha =====
     ⚠️ O painel comum quase nao produz isso (0 em 900 batalhas), entao ele e FORCADO: seis
     dancarinos de cada lado. Entre os dois trechos tem que haver confronto SECO -- e e nele que
     um "acabou mas continua chovendo" apareceria. */
  let comDois = 0, buracos = 0, errosDois = [];
  for(let n = 0; n < 250; n++){
    const time = (off) => Array.from({ length: 6 }, (_, i) => mk(DANCA[(off + i) % DANCA.length], 60));
    const ms = (S.simulateGymBattle(time(n), time(n + 5), S.makeSeededRng('dois-' + n)).matchups) || [];
    const t = trechos(ms);
    if(t.length < 2) continue;
    comDois++;
    for(let k = 0; k + 1 < t.length; k++){
      if(t[k].fim === null) continue;
      for(let i = t[k].fim + 1; i < t[k + 1].ini; i++){
        buracos++;
        if(ms[i].chuva || S.chuvaDaCenaHtml(ms[i]).length)
          errosDois.push(n + ':' + i + ' chove no buraco entre dois trechos');
      }
      const volta = t[k + 1].ini;
      if(!ms[volta].chuva || !S.chuvaDaCenaHtml(ms[volta]).length)
        errosDois.push(n + ':' + volta + ' o 2o trecho comeca seco');
    }
  }
  ok('o painel forcado produziu o caso de DOIS trechos', comDois > 3 && buracos > 3,
     comDois + ' batalhas, ' + buracos + ' confrontos secos entre os trechos');
  ok('a chuva PARA no buraco entre dois trechos e VOLTA no seguinte', errosDois.length === 0,
     errosDois.slice(0, 3).join(' | ') || comDois + ' batalhas conferidas');

  /* ===== 4) o clima nao vaza de uma batalha pra outra =====
     ⚠️ o `chuvaRestante` e variavel de MODULO, e no servidor a instancia e reaproveitada entre
     invocacoes: uma batalha cortada com chuva no ar deixaria a proxima comecando debaixo dela --
     sem Danca da Chuva nenhuma. Quem fecha isso e o `limparClima()`. */
  let vazou = 0, casos = 0;
  for(let n = 0; n < 200 && casos < 40; n++){
    const ms1 = (S.simulateGymBattle(
      [DANCA[n % DANCA.length], 'machamp'].map(id => mk(id, 55)),
      [DANCA[(n + 2) % DANCA.length], 'onix'].map(id => mk(id, 54)),
      S.makeSeededRng('vaza-a-' + n)).matchups) || [];
    const ult = ms1[ms1.length - 1];
    if(!ult || !ult.chuva) continue;
    if((ult.golpes || []).some(g => g.x === 'chuvafim')) continue;   /* ela fechou sozinha */
    casos++;
    const ms2 = (S.simulateGymBattle(
      [semDanca[0], semDanca[1]].map(id => mk(id, 55)),
      [semDanca[2], semDanca[3]].map(id => mk(id, 54)),
      S.makeSeededRng('vaza-b-' + n)).matchups) || [];
    if(ms2.some(m => m.chuva)) vazou++;
  }
  ok('a chuva que sobra de uma batalha nao vaza pra a seguinte', vazou === 0,
     vazou + ' vazamentos');
  ok('e o painel do vazamento tem caso (senao ele nao mediu nada)', casos > 3,
     casos + ' batalhas cortadas com chuva no ar');
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
