import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAXIMO_DE_INTERVALOS,
  UNIDADES,
  descrever,
  proximaData,
  repeticaoValida,
} from '../../www/js/nucleo/repeticao.js';

const HOJE = '2026-11-12';
const cada = (n, unidade) => ({ cada: n, unidade });

test('repetição válida: unidade conhecida e intervalo inteiro de 1 ao máximo', () => {
  for (const unidade of UNIDADES) assert.equal(repeticaoValida(cada(1, unidade)), true);
  assert.equal(repeticaoValida(cada(MAXIMO_DE_INTERVALOS, 'dia')), true);

  const invalidas = [
    null,
    undefined,
    'toda semana',
    7,
    [],
    {},
    cada(1, 'quinzena'),
    cada(0, 'dia'),
    cada(-1, 'dia'),
    cada(1.5, 'dia'),
    cada('2', 'dia'),
    cada(MAXIMO_DE_INTERVALOS + 1, 'dia'),
  ];
  for (const valor of invalidas) assert.equal(repeticaoValida(valor), false, JSON.stringify(valor));
  assert.ok(Object.isFrozen(UNIDADES));
});

test('próxima data, concluída no dia: soma um intervalo', () => {
  assert.equal(proximaData(HOJE, cada(1, 'dia'), HOJE), '2026-11-13');
  assert.equal(proximaData(HOJE, cada(3, 'dia'), HOJE), '2026-11-15');
  assert.equal(proximaData(HOJE, cada(1, 'semana'), HOJE), '2026-11-19');
  assert.equal(proximaData(HOJE, cada(2, 'semana'), HOJE), '2026-11-26');
  assert.equal(proximaData(HOJE, cada(1, 'mes'), HOJE), '2026-12-12');
  assert.equal(proximaData(HOJE, cada(1, 'ano'), HOJE), '2027-11-12');
});

test('próxima data, concluída adiantada: ainda é o intervalo seguinte ao prazo', () => {
  assert.equal(proximaData('2026-11-20', cada(1, 'semana'), HOJE), '2026-11-27');
});

test('próxima data, concluída com atraso: pula as ocorrências que ficaram para trás', () => {
  // diária com um dia de atraso: a de hoje ainda vale
  assert.equal(proximaData('2026-11-11', cada(1, 'dia'), HOJE), HOJE);
  // diária com dez dias de atraso: também reaparece hoje, não nove vezes
  assert.equal(proximaData('2026-11-02', cada(1, 'dia'), HOJE), HOJE);
  // semanal de quinta, três semanas atrasada: a quinta de hoje
  assert.equal(proximaData('2026-10-22', cada(1, 'semana'), HOJE), HOJE);
  // semanal de terça, atrasada: a próxima terça
  assert.equal(proximaData('2026-11-03', cada(1, 'semana'), HOJE), '2026-11-17');
});

test('próxima data mensal e anual: mês mais curto fica no último dia', () => {
  assert.equal(proximaData('2027-01-31', cada(1, 'mes'), '2027-01-31'), '2027-02-28');
  assert.equal(proximaData('2028-01-31', cada(1, 'mes'), '2028-01-31'), '2028-02-29');
  assert.equal(proximaData('2026-10-31', cada(1, 'mes'), '2026-10-31'), '2026-11-30');
  assert.equal(proximaData('2026-12-15', cada(2, 'mes'), '2026-12-15'), '2027-02-15');
  assert.equal(proximaData('2028-02-29', cada(1, 'ano'), '2028-02-29'), '2029-02-28');
});

test('descrever: uma vez tem nome próprio, várias usa "a cada"', () => {
  assert.equal(descrever(cada(1, 'dia')), 'todo dia');
  assert.equal(descrever(cada(1, 'semana')), 'toda semana');
  assert.equal(descrever(cada(1, 'mes')), 'todo mês');
  assert.equal(descrever(cada(1, 'ano')), 'todo ano');
  assert.equal(descrever(cada(2, 'dia')), 'a cada 2 dias');
  assert.equal(descrever(cada(3, 'semana')), 'a cada 3 semanas');
  assert.equal(descrever(cada(6, 'mes')), 'a cada 6 meses');
  assert.equal(descrever(cada(2, 'ano')), 'a cada 2 anos');
});
