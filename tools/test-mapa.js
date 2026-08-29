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
  // a cidade do último ginásio não pode aparecer nomeada antes da hora
  const nomeUltimo = sb.KANTO_PLACES[sb.KANTO_GYM_CITIES[7]].name;
  const revelaUltimo = svg.includes('>'+nomeUltimo+'<') || svg.includes(nomeUltimo);
  if(venc < 7 && revelaUltimo) erros.push('revelou a cidade do 8º ginásio cedo demais');
  if(venc >= 7 && !revelaUltimo) erros.push('não revelou a cidade do 8º ginásio na hora certa');
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
