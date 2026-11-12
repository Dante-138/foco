// A cobertura só enxerga os arquivos que algum teste carrega. Este teste
// importa todos os módulos de www/js/nucleo, então um módulo novo sem teste
// derruba o limite de 100% em vez de passar despercebido.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';

const pasta = new URL('../../www/js/nucleo/', import.meta.url);

test('todos os módulos do núcleo carregam em Node, sem navegador', async () => {
  const arquivos = (await readdir(pasta)).filter((nome) => nome.endsWith('.js'));
  assert.ok(arquivos.length >= 9, `esperava os módulos do núcleo, achei ${arquivos.length}`);

  for (const nome of arquivos) {
    const modulo = await import(new URL(nome, pasta));
    assert.ok(Object.keys(modulo).length > 0, `${nome} não exporta nada`);
  }
});

test('a pasta do núcleo só tem módulos JavaScript', async () => {
  const entradas = await readdir(pasta, { withFileTypes: true });
  for (const entrada of entradas) {
    assert.ok(entrada.isFile() && entrada.name.endsWith('.js'), `entrada inesperada: ${entrada.name}`);
  }
});
