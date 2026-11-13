import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESLIZE, passoDoDeslize, vizinha } from '../../www/js/nucleo/gesto.js';

test('dedo para a esquerda avança e dedo para a direita volta', () => {
  assert.equal(passoDoDeslize({ dx: -120, dy: 8, ms: 180 }), 1);
  assert.equal(passoDoDeslize({ dx: 120, dy: -8, ms: 180 }), -1);
});

test('deslocamento curto é toque, não deslize', () => {
  const quase = DESLIZE.distanciaMinima - 1;
  assert.equal(passoDoDeslize({ dx: quase, dy: 0, ms: 100 }), 0);
  assert.equal(passoDoDeslize({ dx: -quase, dy: 0, ms: 100 }), 0);
  assert.equal(passoDoDeslize({ dx: DESLIZE.distanciaMinima, dy: 0, ms: 100 }), -1);
});

test('movimento mais vertical que horizontal é rolagem da lista', () => {
  assert.equal(passoDoDeslize({ dx: -100, dy: 51, ms: 150 }), 0);
  assert.equal(passoDoDeslize({ dx: -100, dy: -51, ms: 150 }), 0);
  assert.equal(passoDoDeslize({ dx: -100, dy: 50, ms: 150 }), 1);
  assert.equal(passoDoDeslize({ dx: 60, dy: 400, ms: 150 }), 0);
});

test('arrasto lento não troca de aba', () => {
  assert.equal(passoDoDeslize({ dx: -200, dy: 0, ms: DESLIZE.duracaoMaxima + 1 }), 0);
  assert.equal(passoDoDeslize({ dx: -200, dy: 0, ms: DESLIZE.duracaoMaxima }), 1);
});

test('medida que não é número não vira deslize', () => {
  assert.equal(passoDoDeslize({ dx: Number.NaN, dy: 0, ms: 100 }), 0);
  assert.equal(passoDoDeslize({ dx: -200, dy: undefined, ms: 100 }), 0);
  assert.equal(passoDoDeslize({ dx: -200, dy: 0, ms: Number.POSITIVE_INFINITY }), 0);
});

test('a aba vizinha para nas pontas, sem dar a volta', () => {
  assert.equal(vizinha(0, 1, 3), 1);
  assert.equal(vizinha(1, 1, 3), 2);
  assert.equal(vizinha(2, 1, 3), 2);
  assert.equal(vizinha(1, -1, 3), 0);
  assert.equal(vizinha(0, -1, 3), 0);
});
