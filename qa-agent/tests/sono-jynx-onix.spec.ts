import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

type BattleStep = {
  q?: 'p' | 'e';
  d?: number;
  x?: string;
  g?: string;
};

const require = createRequire(import.meta.url);
const { createSandbox } = require('../../tools/game-sandbox.js');
const S = createSandbox();
const fixedRng = (value: number) => () => value;

function pokemon(speciesId: string, level = 50) {
  const instance = S.createInstance(speciesId, level);
  instance.maxHp = 10_000;
  instance.hp = instance.maxHp;
  return instance;
}

test('Onix nao ataca na mesma troca nem nas seguintes depois de Jynx faze-lo dormir', async ({}, testInfo) => {
  const jynx = pokemon('jynx');
  const onix = pokemon('onix');
  jynx._especialContra = onix;

  const sleepTurn: BattleStep[] = [];
  S.doExchange(jynx, onix, fixedRng(0.01), sleepTurn);
  const sleepIndex = sleepTurn.findIndex((step) => step.x === 'sono');
  const sleep = sleepTurn[sleepIndex];
  expect(sleep?.g).toBe('Beijo Adorável');
  expect(onix._dormindoPor).toBeGreaterThan(0);

  const immediateOnixAttacks = sleepTurn.slice(sleepIndex + 1).filter(
    (step) => !step.x && step.q === 'e' && (step.d ?? 0) > 0,
  );
  expect(
    immediateOnixAttacks,
    'Onix nao pode atacar logo depois de ser colocado para dormir',
  ).toHaveLength(0);
  expect(
    jynx.hp,
    'Jynx nao pode perder HP logo depois de colocar Onix para dormir',
  ).toBe(jynx.maxHp);

  const jynxHpBefore = jynx.hp;
  const onixHpBefore = onix.hp;
  const nextTurn: BattleStep[] = [];
  S.doExchange(jynx, onix, fixedRng(0.99), nextTurn);

  const onixAttacks = nextTurn.filter(
    (step) => !step.x && step.q === 'e' && (step.d ?? 0) > 0,
  );

  expect(onixAttacks, 'Onix dormindo nao pode gerar golpe de dano').toHaveLength(0);
  expect(jynx.hp, 'Jynx nao pode receber dano do Onix dormindo').toBe(jynxHpBefore);
  expect(onix.hp, 'A troca seguinte deve acontecer normalmente para Jynx').toBeLessThan(onixHpBefore);

  await testInfo.attach('diario-sono-jynx-onix.json', {
    body: JSON.stringify({ sleepTurn, nextTurn }, null, 2),
    contentType: 'application/json',
  });
});
test('o log respeita a velocidade no caso Jumpluff contra Dugtrio da captura', () => {
  const jumpluff = pokemon('jumpluff', 56);
  const dugtrio = pokemon('dugtrio', 57);
  jumpluff._especialContra = dugtrio;

  const turn: BattleStep[] = [];
  S.doExchange(jumpluff, dugtrio, fixedRng(0.01), turn);

  const attackIndex = turn.findIndex(
    (step) => !step.x && step.q === 'e' && (step.d ?? 0) > 0,
  );
  const sleepIndex = turn.findIndex((step) => step.x === 'sono');
  expect(turn[sleepIndex]?.g).toBe('Pó do Sono');
  expect(dugtrio._dormindoPor).toBeGreaterThan(0);
  expect(attackIndex, 'Dugtrio mais rapido ataca antes do sono').toBeGreaterThanOrEqual(0);
  expect(attackIndex, 'o ataque deve aparecer antes do Pó do Sono').toBeLessThan(sleepIndex);

  const visible = S.sequenciaDoConfronto({
    golpes: turn,
    playerHpBefore: jumpluff.maxHp,
    enemyHpBefore: dugtrio.maxHp,
    playerHpAfter: jumpluff.hp,
    enemyHpAfter: dugtrio.hp,
  });
  const visibleAttack = visible.findIndex(
    (step: BattleStep) => !step.x && step.q === 'e' && (step.d ?? 0) > 0,
  );
  const visibleSleep = visible.findIndex((step: BattleStep) => step.x === 'sono');
  expect(visibleAttack, 'o log visual deve manter o ataque antes do sono').toBeLessThan(visibleSleep);
});