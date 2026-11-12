import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataValida, deIso, hoje, horaValida, isoLocal, somaDias } from '../../www/js/nucleo/datas.js';

test('isoLocal formata com zeros à esquerda', () => {
  assert.equal(isoLocal(new Date(2026, 0, 5)), '2026-01-05');
});

test('isoLocal usa o fuso local e não vira o dia à noite', () => {
  assert.equal(isoLocal(new Date(2026, 10, 12, 23, 30)), '2026-11-12');
  assert.equal(isoLocal(new Date(2026, 10, 12, 0, 5)), '2026-11-12');
});

test('hoje devolve a data local de agora', () => {
  assert.equal(hoje(), isoLocal(new Date()));
  assert.equal(dataValida(hoje()), true);
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

test('dataValida aceita só datas reais no formato AAAA-MM-DD', () => {
  for (const boa of ['2026-11-12', '2028-02-29', '2026-01-01', '2026-12-31']) {
    assert.equal(dataValida(boa), true, boa);
  }
  const ruins = [
    '2026-02-30', // dia que não existe
    '2027-02-29', // ano não bissexto
    '2026-13-01',
    '2026-00-10',
    '2026-1-5',
    '26-11-12',
    '2026/11/12',
    '2026-11-12T10:00',
    ' 2026-11-12',
    '',
    null,
    undefined,
    20261112,
    new Date(2026, 10, 12),
  ];
  for (const ruim of ruins) assert.equal(dataValida(ruim), false, String(ruim));
});

test('horaValida aceita só 00:00 a 23:59 com dois dígitos', () => {
  for (const boa of ['00:00', '06:30', '19:59', '23:59']) assert.equal(horaValida(boa), true, boa);
  for (const ruim of ['24:00', '7:00', '12:60', '12:5', '1230', '12:30:00', '', null, undefined, 1230]) {
    assert.equal(horaValida(ruim), false, String(ruim));
  }
});
