import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { descreverBuild } from '../../www/js/nucleo/build.js';
import { BUILD } from '../../www/js/build-info.js';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
const SCRIPT = join(RAIZ, 'tools', 'carimbar-build.mjs');
const rodar = (...argumentos) => spawnSync(process.execPath, [SCRIPT, ...argumentos], { encoding: 'utf8' });

test('carimbo do build: versão, commit e data; sem commit, é desenvolvimento', () => {
  assert.equal(
    descreverBuild({ versao: '0.1.0', commit: 'abc1234', data: '2026-11-14T03:05' }),
    'Versão 0.1.0 · abc1234 · 14/11/2026 03:05',
  );
  assert.equal(
    descreverBuild({ versao: '0.1.0', commit: 'abc1234+', data: null }),
    'Versão 0.1.0 · abc1234+',
  );
  assert.equal(
    descreverBuild({ versao: '0.1.0', commit: null, data: null }),
    'Versão 0.1.0 · desenvolvimento',
  );
  assert.equal(
    descreverBuild({ versao: '0.1.0', commit: null, data: '2026-11-14T03:05' }),
    'Versão 0.1.0 · desenvolvimento',
  );
});

test('o carimbo do repositório não tem commit nem data, e a versão é a do package.json', () => {
  const { version } = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
  assert.deepEqual({ ...BUILD }, { versao: version, commit: null, data: null });
});

test('carimbar o build: regrava o arquivo de destino com versão, commit e data', async (t) => {
  const pasta = mkdtempSync(join(tmpdir(), 'foco-build-'));
  t.after(() => rmSync(pasta, { recursive: true, force: true, maxRetries: 3 }));
  const destino = join(pasta, 'build-info.mjs');
  writeFileSync(destino, readFileSync(join(RAIZ, 'www', 'js', 'build-info.js')));

  const { status, stdout } = rodar(destino);
  assert.equal(status, 0);
  assert.match(stdout, /^Carimbo do build: /);
  const { BUILD: carimbado } = await import(pathToFileURL(destino).href);
  assert.equal(carimbado.versao, BUILD.versao);
  assert.match(carimbado.commit, /^[0-9a-f]{7,}\+?$/);
  assert.match(carimbado.data, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.match(descreverBuild(carimbado), /^Versão \S+ · [0-9a-f]{7,}\+? · \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
});

test('carimbar o build: sem o arquivo de destino, avisa e sai com 1', () => {
  const { status, stderr } = rodar(join(tmpdir(), 'foco-build-nao-existe', 'build-info.js'));
  assert.equal(status, 1);
  assert.match(stderr, /Rode "npx cap sync android" antes\./);
});
