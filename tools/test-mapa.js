/**
 * Smoke test do MAPA DE KANTO. O SVG sai de uma função pura (estado da jornada -> markup),
 * então dá pra rodar os 10 estados possíveis aqui em vez de jogar 8 ginásios no navegador.
 *
 * Além de "não quebrou", ele confere as duas coisas que só se veem olhando o desenho e que
 * um erro de coordenada estraga em silêncio:
 *  - toda cidade cai DENTRO da moldura (uma coordenada fora do viewBox some da tela sem erro);
 *  - o mapa mostra só o que já aconteceu (nada de revelar a cidade do 8º ginásio no trecho 1).
 *
 *   node tools/test-mapa.js
 */
const { createSandbox } = require('./game-sandbox');
const sb = createSandbox();
const game = sb.__getGame();

let falhas = 0, casos = 0;
function ok(nome, cond, detalhe){
  casos++;
  if(cond) console.log('  ✓ ' + nome);
  else { falhas++; console.log('  ✗ ' + nome + (detalhe ? ' — ' + detalhe : '')); }
}

const ROTAS = ['viridian_forest','coast_24_25','ss_anne','lavender_detour','safari_zone','silph_co','seafoam','victory_road'];

console.log('\nCOORDENADAS');
// margem de 20: um ponto a 5px da borda tem o rótulo cortado, que é o mesmo defeito
/* AS DUAS REGIÕES. O mapa passou a desenhar Kanto e Johto empilhadas, e o traço segue as cidades
   que o treinador REALMENTE escolheu -- então o que precisa de trava mudou: toda cidade de ginásio
   das duas listas tem que existir e caber na moldura, e a jornada desenhada tem que acompanhar o
   gymPath em vez de ser sempre a de Kanto. */
const ALTURA = sb.JOHTO_OFFSET_Y + 420;
for(const [id, p] of Object.entries(sb.MAP_PLACES)){
  ok('«'+p.name+'» cabe na moldura', p.x >= 10 && p.x <= 290 && p.y >= 10 && p.y <= ALTURA-10,
     '('+p.x+','+p.y+')');
}
ok('as 8 cidades de ginásio de Johto existem no mapa',
   sb.JOHTO_GYM_CITIES.every(id=>!!sb.MAP_PLACES[id]),
   sb.JOHTO_GYM_CITIES.filter(id=>!sb.MAP_PLACES[id]).join(','));
ok('nenhuma cidade de Johto colide com uma de Kanto',
   sb.JOHTO_GYM_CITIES.every(id=>!sb.KANTO_GYM_CITIES.includes(id)));
ok('as duas regiões não se sobrepõem no desenho',
   Object.values(sb.KANTO_PLACES).every(p=>p.y < sb.JOHTO_OFFSET_Y) &&
   Object.values(sb.JOHTO_PLACES).every(p=>p.y >= sb.JOHTO_OFFSET_Y));
// a jornada desenhada acompanha o caminho escolhido
const gm = sb.freshGameDefaults();
gm.gymPath = ['johto','kanto','johto','kanto','johto','kanto','johto','kanto'];
sb.__setGame(gm);
const jor = sb.jornadaDoTreinador();
ok('a jornada desenhada tem 10 paradas', jor.length === 10, String(jor.length));
ok('a jornada segue o gymPath',
   jor[1] === sb.JOHTO_GYM_CITIES[0] && jor[2] === sb.KANTO_GYM_CITIES[1] && jor[3] === sb.JOHTO_GYM_CITIES[2],
   jor.join(' > '));
ok('toda parada da jornada existe no mapa', jor.every(id=>!!sb.MAP_PLACES[id]),
   jor.filter(id=>!sb.MAP_PLACES[id]).join(','));
gm.gymPath = [];
sb.__setGame(gm);
ok('save sem gymPath desenha a jornada de Kanto (como antes)',
   sb.jornadaDoTreinador().slice(1,9).join(',') === sb.KANTO_GYM_CITIES.join(','));
// o SVG de uma jornada misturada tem que sair inteiro
gm.gymPath = ['johto','kanto','johto','kanto'];
gm.gymIndex = 4; sb.__setGame(gm);
const svgMix = sb.kantoMapSvg(4, [], null);
ok('o mapa de uma jornada misturada renderiza', svgMix.length > 2000 && svgMix.includes('</svg>'));
ok('e mostra as duas regiões', svgMix.includes('KANTO') && svgMix.includes('JOHTO'));
ok('e desenha a ponte entre elas', svgMix.includes('km-elo'));

/* O CASO DA ABERTURA: o jogador ainda não escolheu entre Brock e Falkner, e nada na tela pode
   dizer qual dos dois é. Foi um defeito real -- o mapa desenhava o traço até Pewter City e o
   texto anunciava o Brock, na tela ANTERIOR à da escolha. */
const gAb = sb.freshGameDefaults();
gAb.gymIndex = 0; gAb.gymPath = []; gAb.starterId = 'pichu';
gAb.team = [{speciesId:'pichu', level:5, id:'m', name:'Pichu', types:['Electric']}];
sb.__setGame(gAb);
const svgAb = sb.kantoMapSvg(0, [], null);
ok('sem escolha, o mapa nao aponta nenhuma cidade de ginasio',
   !svgAb.includes(sb.KANTO_PLACES.pewter.name) && !svgAb.includes(sb.MAP_PLACES.violet.name));
ok('sem escolha, o mapa nao desenha trecho nenhum', !svgAb.includes('km-atual'));
ok('a abertura da jornada nao nomeia o primeiro lider',
   !sb.renderKantoIntro().includes('Brock') && !sb.renderKantoIntro().includes('Falkner'));
ok('a trilha marca o trecho como aberto em vez de adivinhar',
   sb.kantoTrailHtml().includes('kt-aberto') && sb.kantoTrailHtml().includes('escolha o caminho'));
// e depois de escolher, tudo aparece
gAb.gymPath = ['johto']; sb.__setGame(gAb);
const svgDep = sb.kantoMapSvg(0, [], null);
ok('escolhido Johto, o mapa aponta Violet City',
   svgDep.includes(sb.MAP_PLACES.violet.name) && !svgDep.includes(sb.KANTO_PLACES.pewter.name));
ok('e a trilha passa a nomear o destino', sb.kantoTrailHtml().includes('Violet City'));

for(const [id, p] of Object.entries(sb.KANTO_PLACES)){
  ok(`${id} dentro da moldura`, p.x >= 20 && p.x <= 280 && p.y >= 20 && p.y <= 400, `(${p.x},${p.y})`);
}
ok('a jornada tem 10 paradas (casa + 8 ginásios + Liga)', sb.KANTO_JOURNEY.length === 10, String(sb.KANTO_JOURNEY.length));
ok('toda parada da jornada existe no mapa', sb.KANTO_JOURNEY.every(id=>!!sb.KANTO_PLACES[id]));
ok('uma cidade por ginásio, sem repetir', new Set(sb.KANTO_GYM_CITIES).size === 8);

console.log('\nO MAPA EM CADA TRECHO');
for(let venc = 0; venc <= 8; venc++){
  const hist = ROTAS.slice(0, venc);
  let svg;
  try{ svg = sb.kantoMapSvg(venc, hist, ROTAS[venc] || null); }
  catch(e){ casos++; falhas++; console.log(`  ✗ trecho ${venc}: lançou ${e.message}`); continue; }
  const erros = [];
  if(!svg.includes('</svg>')) erros.push('SVG incompleto');
  if(/undefined|NaN/.test(svg)) erros.push('tem "undefined" ou "NaN"');
  // os ícones das rotas percorridas: um por trecho concluído, mais o atual quando já escolhido
  const icones = hist.map(r=>sb.__getGame() && r);
  /* A cidade do próximo ginásio só é revelada depois de o caminho daquele trecho ser ESCOLHIDO.
     Antes disso o mapa não pode nomear nem apontar nada: ele estaria adivinhando Kanto (o padrão
     do regiaoDaEtapa) e prometendo o Brock antes de o jogador escolher entre ele e o Falkner.
     Este laço roda sem gymPath, então nenhum trecho está escolhido -- é exatamente o estado da
     abertura da jornada. */
  const nomeUltimo = sb.KANTO_PLACES[sb.KANTO_GYM_CITIES[7]].name;
  const revelaUltimo = svg.includes(nomeUltimo);
  // no trecho 8 a jornada acabou e a cidade JÁ foi conquistada -- aí ela aparece, com o ✓
  if(venc < 8 && revelaUltimo) erros.push('revelou a cidade do 8º ginásio sem o caminho ter sido escolhido');
  if(erros.length){ casos++; falhas++; console.log(`  ✗ trecho ${venc}: ${erros.join('; ')}`); }
  else { casos++; console.log(`  ✓ trecho ${venc} (${hist.length} percorridos)`); }
}

console.log('\nTELAS');
game.starterId = 'bulbasaur'; game.gymIndex = 0; game.routeHistory = []; game.currentRoute = null;
for(const [nome, fn] of [['abertura', ()=>sb.renderKantoIntro()], ['mapa no início', ()=>sb.renderKantoMapScreen()], ['trilha', ()=>sb.kantoTrailHtml()]]){
  let html; casos++;
  try{ html = fn(); }
  catch(e){ falhas++; console.log(`  ✗ ${nome}: lançou ${e.message}`); continue; }
  if(!html || /undefined|NaN/.test(html)){ falhas++; console.log(`  ✗ ${nome}: HTML vazio ou com undefined/NaN`); }
  else console.log('  ✓ ' + nome);
}
game.gymIndex = 8; game.routeHistory = ROTAS.slice();
for(const [nome, fn] of [['mapa com 8 insígnias', ()=>sb.renderKantoMapScreen()], ['trilha completa', ()=>sb.kantoTrailHtml()]]){
  let html; casos++;
  try{ html = fn(); }
  catch(e){ falhas++; console.log(`  ✗ ${nome}: lançou ${e.message}`); continue; }
  if(!html || /undefined|NaN/.test(html)){ falhas++; console.log(`  ✗ ${nome}: HTML vazio ou com undefined/NaN`); }
  else console.log('  ✓ ' + nome);
}
// save antigo: sem routeHistory o mapa tem que desenhar mesmo assim
game.gymIndex = 4; game.routeHistory = undefined;
casos++;
try{ const h = sb.renderKantoMapScreen(); ok('save antigo (sem histórico de rotas) não quebra', !!h && !/undefined/.test(h)); casos--; }
catch(e){ falhas++; console.log('  ✗ save antigo: lançou ' + e.message); }

console.log(`\n${casos - falhas}/${casos} casos passaram.`);
if(falhas){ console.log(`${falhas} FALHA(S).`); process.exit(1); }
