/**
 * SEMEIA O `Math.random` DE UM TESTE, pra ele poder ser COMPARADO entre dois builds.
 *
 * ⚠️ POR QUE ELE EXISTE (20/09/2026). Vários testes da casa sorteiam confronto (`simulateGymBattle`
 * sem rng) e por isso têm travas que falham de vez em quando -- o `test-especiais.js` tem uma
 * conhecida desde 17/09. Medir esse flake SEM semente, rodando N vezes de cada lado, **não é
 * medição**: eu tive 0 de 17 no HEAD e 6 de 12 num build meu, o que parecia uma regressão clara e
 * era sorte. Com a semente fixa, os dois builds dão o MESMO resultado semente por semente, e a
 * diferença (ou a ausência dela) fica provada em oito rodadas em vez de sessenta.
 *
 * É a mesma lição do σ binomial que o CLAUDE.md já registra, do lado do teste em vez do simulador.
 *
 *   SEMENTE=7919 node -r ./tools/semear-random.js tools/test-especiais.js
 *
 * ⚠️ ELE NÃO ENTRA EM BATERIA NENHUMA: semeado, o teste passa a varrer sempre os MESMOS confrontos,
 * e é justamente a variedade que faz uma trava de invariante valer alguma coisa. Ele serve pra
 * COMPARAR dois builds, e só.
 */
let s = Number(process.env.SEMENTE || 1) >>> 0 || 1;
Math.random = function(){ s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
