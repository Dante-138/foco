import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uid } from '../../www/js/nucleo/ids.js';
import { CORES, COR_PADRAO, corValida } from '../../www/js/nucleo/paleta.js';
import { LIMITES } from '../../www/js/nucleo/esquema.js';

test('uid gera ids diferentes mesmo no mesmo milissegundo', () => {
  const ids = Array.from({ length: 20000 }, () => uid());
  assert.equal(new Set(ids).size, ids.length);
});

test('uid usa só letras minúsculas e dígitos e cabe no limite de id', () => {
  for (let i = 0; i < 100; i += 1) {
    const id = uid();
    assert.match(id, /^[0-9a-z]+$/);
    assert.ok(id.length <= LIMITES.id);
  }
});

test('a cor padrão faz parte da paleta', () => {
  assert.equal(corValida(COR_PADRAO), true);
});

test('corValida aceita só as chaves da paleta', () => {
  for (const { chave } of CORES) assert.equal(corValida(chave), true);
  for (const errada of ['#5aaaf5', 'Azul', '', null, undefined, 7]) assert.equal(corValida(errada), false);
});

test('as chaves da paleta são únicas e servem em nome de variável CSS', () => {
  const chaves = CORES.map((c) => c.chave);
  assert.equal(new Set(chaves).size, chaves.length);
  for (const chave of chaves) assert.match(chave, /^[a-z]+$/);
});
