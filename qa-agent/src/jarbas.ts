import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Scenario = {
  testFile: string;
  plan: string[];
};

const qaRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playwrightCli = resolve(qaRoot, 'node_modules', '@playwright', 'test', 'cli.js');
const request = process.argv.slice(2).join(' ').trim();

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function runPlaywright(testFile: string, headed: boolean): Promise<number> {
  const args = [
    playwrightCli,
    'test',
    testFile,
    '--project=chromium',
    ...(headed ? ['--headed'] : []),
  ];

  return new Promise((resolveExitCode, reject) => {    const child = spawn(process.execPath, args, {
      cwd: qaRoot,
      env: process.env,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code) => resolveExitCode(code ?? 1));
  });
}

if (!request) {
  console.error('Uso: npm run jarbas -- "teste se a Jornada Kanto abre"');
  process.exitCode = 1;
} else {
  const normalizedRequest = normalize(request);
  const asksForSleep = /sono|dormir|dorme|dormindo/.test(normalizedRequest);
  const asksForSmoke = /smoke|abrir|abre|carregar|pagina inicial|tela inicial|\bhome\b|\bsite\b/.test(
    normalizedRequest,
  );

  let scenario: Scenario | null = null;
  if (asksForSleep) {
    scenario = {
      testFile: 'tests/sono-jynx-onix.spec.ts',
      plan: [
        'Testar Jynx/Onix e reproduzir Jumpluff/Dugtrio da captura.',
        'Quando quem usa sono é mais rápido, bloquear o ataque imediatamente.',
        'Quando o alvo é mais rápido, registrar o ataque antes da linha do sono.',
        'Confirmar que ninguém ataca nas trocas seguintes enquanto dorme.',
      ],
    };
  } else if (asksForSmoke) {
    scenario = {
      testFile: 'tests/smoke.spec.ts',
      plan: [
        'Iniciar a Jornada Kanto em um servidor local.',
        'Bloquear acessos externos, inclusive Firebase real.',
        'Validar resposta HTTP, título, container principal e URL.',
      ],
    };
  }

  if (!scenario) {
    console.error(`\nJARBAS QA — cenário ainda não implementado\nPedido: ${request}`);
    console.error('\nDisponível agora: abertura local e sono de Jynx contra Onix.');
    process.exitCode = 2;
  } else {
    const headed = /visual|com navegador|headed/.test(normalizedRequest);
    console.log('\nJARBAS QA — PLANO DE TESTE');
    console.log(`Pedido: ${request}`);
    scenario.plan.forEach((step, index) => console.log(`${index + 1}. ${step}`));
    console.log('');

    try {
      const exitCode = await runPlaywright(scenario.testFile, headed);
      if (exitCode === 0) {
        console.log('\nJARBAS QA — APROVADO');
        console.log(`Relatório: ${resolve(qaRoot, 'playwright-report', 'index.html')}`);      } else {
        console.error(`\nJARBAS QA — REPROVADO (código ${exitCode})`);
        console.error(`Evidências: ${resolve(qaRoot, 'test-results')}`);
      }
      process.exitCode = exitCode;
    } catch (error) {
      console.error('\nJARBAS QA — ERRO AO EXECUTAR');
      console.error(error);
      process.exitCode = 1;
    }
  }
}