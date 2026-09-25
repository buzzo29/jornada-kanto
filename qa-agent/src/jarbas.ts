import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const qaRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playwrightCli = resolve(qaRoot, 'node_modules', '@playwright', 'test', 'cli.js');
const request = process.argv.slice(2).join(' ').trim();

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function runSmokeTest(headed: boolean): Promise<number> {
  const args = [
    playwrightCli,
    'test',
    'tests/smoke.spec.ts',
    '--project=chromium',
    ...(headed ? ['--headed'] : []),
  ];

  return new Promise((resolveExitCode, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: qaRoot,      env: process.env,
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
  const asksForSmoke = /smoke|abrir|abre|carregar|pagina inicial|tela inicial|\bhome\b|\bsite\b/.test(
    normalizedRequest,
  );

  if (!asksForSmoke) {
    console.error(`\nJARBAS QA — cenário ainda não implementado\nPedido: ${request}`);
    console.error('\nDisponível agora: testar se a Jornada Kanto abre localmente.');
    console.error('Exemplo: npm run jarbas -- "teste se a Jornada Kanto abre"');
    process.exitCode = 2;
  } else {
    const headed = /visual|com navegador|headed/.test(normalizedRequest);

    console.log('\nJARBAS QA — PLANO DE TESTE');    console.log(`Pedido: ${request}`);
    console.log('1. Iniciar a Jornada Kanto em um servidor local.');
    console.log('2. Bloquear acessos externos, inclusive Firebase real.');
    console.log('3. Validar resposta HTTP, título, container principal e URL.');
    console.log(`4. Executar no Chromium${headed ? ' com a janela visível' : ''}.\n`);

    try {
      const exitCode = await runSmokeTest(headed);

      if (exitCode === 0) {
        console.log('\nJARBAS QA — APROVADO');
        console.log(`Relatório: ${resolve(qaRoot, 'playwright-report', 'index.html')}`);
      } else {
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