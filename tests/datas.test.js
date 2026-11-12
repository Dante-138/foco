import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoLocal, deIso, somaDias } from '../www/js/datas.js';

test('isoLocal formata com zeros à esquerda', () => {
  assert.equal(isoLocal(new Date(2026, 0, 5)), '2026-01-05');
});

test('isoLocal usa o fuso local e não vira o dia à noite', () => {
  assert.equal(isoLocal(new Date(2026, 10, 12, 23, 30)), '2026-11-12');
  assert.equal(isoLocal(new Date(2026, 10, 12, 0, 5)), '2026-11-12');
});

test('deIso e isoLocal são inversos', () => {
  for (const iso of ['2026-01-01', '2026-11-12', '2028-02-29', '2026-12-31']) {
    assert.equal(isoLocal(deIso(iso)), iso);
  }
});

test('somaDias atravessa mês, ano e 29 de fevereiro', () => {
  assert.equal(somaDias('2026-11-12', 0), '2026-11-12');
  assert.equal(somaDias('2026-11-30', 1), '2026-12-01');
  assert.equal(somaDias('2026-12-31', 1), '2027-01-01');
  assert.equal(somaDias('2028-02-28', 1), '2028-02-29');
  assert.equal(somaDias('2026-03-01', -1), '2026-02-28');
  assert.equal(somaDias('2026-11-12', -7), '2026-11-05');
});
