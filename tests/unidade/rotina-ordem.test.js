import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  desmarcarBloco,
  emAreas,
  emBlocos,
  marcarBloco,
  semAsUltimas,
} from '../../www/js/nucleo/rotina-ordem.js';

const secao = (id) => ({ id, tipo: 'secao', texto: id });
const item = (id) => ({ id, tipo: 'item', texto: id });
const ids = (lista) => lista.map((i) => i.id);
// Bloco em forma curta: [idDaSecao ou null, [ids dos itens]]
const curto = (blocos) => blocos.map((b) => [b.secao?.id ?? null, ids(b.itens)]);

const ROTINA = [
  item('solto1'),
  item('solto2'),
  secao('MANHÃ'),
  item('a'),
  item('b'),
  item('c'),
  secao('VAZIA'),
  secao('NOITE'),
  item('d'),
];

test('blocos: cada seção com os itens dela; itens antes da primeira seção formam um bloco sem seção', () => {
  assert.deepEqual(curto(emBlocos(ROTINA)), [
    [null, ['solto1', 'solto2']],
    ['MANHÃ', ['a', 'b', 'c']],
    ['VAZIA', []],
    ['NOITE', ['d']],
  ]);
  assert.deepEqual(curto(emBlocos([secao('S'), item('x')])), [['S', ['x']]]);
  assert.deepEqual(emBlocos([]), []);
});

test('áreas, opção desligada: tudo em pendentes, na ordem escrita', () => {
  const { pendentes, marcados } = emAreas(ROTINA, new Set(['a']), false);
  assert.deepEqual(curto(pendentes), curto(emBlocos(ROTINA)));
  assert.deepEqual(marcados, []);
});

test('áreas, como no Keep: os marcados saem da seção e vão para a área de marcados, com a seção repetida', () => {
  const { pendentes, marcados } = emAreas(ROTINA, new Set(['a', 'c', 'solto1']), true);
  assert.deepEqual(curto(pendentes), [
    [null, ['solto2']],
    ['MANHÃ', ['b']],
    ['VAZIA', []],
    ['NOITE', ['d']],
  ]);
  assert.deepEqual(curto(marcados), [
    [null, ['solto1']],
    ['MANHÃ', ['a', 'c']],
  ]);
});

test('áreas: seção toda marcada some de pendentes; seção sem itens continua lá', () => {
  const { pendentes, marcados } = emAreas(ROTINA, new Set(['a', 'b', 'c', 'd', 'solto1', 'solto2']), true);
  assert.deepEqual(curto(pendentes), [['VAZIA', []]]);
  assert.deepEqual(curto(marcados), [
    [null, ['solto1', 'solto2']],
    ['MANHÃ', ['a', 'b', 'c']],
    ['NOITE', ['d']],
  ]);
});

test('áreas: nada marcado deixa a área de marcados vazia, e a rotina não é alterada', () => {
  const copia = structuredClone(ROTINA);
  const { pendentes, marcados } = emAreas(ROTINA, new Set(), true);
  assert.deepEqual(curto(pendentes), curto(emBlocos(ROTINA)));
  assert.deepEqual(marcados, []);
  assert.deepEqual(ROTINA, copia);
});

test('marcar a seção inteira põe no fim só os itens que faltavam, na ordem da rotina', () => {
  const [, manha] = emBlocos(ROTINA);
  const marcas = ['d', 'b'];
  assert.deepEqual(marcarBloco(marcas, manha), ['d', 'b', 'a', 'c']);
  assert.deepEqual(marcarBloco(['a', 'b', 'c'], manha), ['a', 'b', 'c']);
  assert.deepEqual(marcas, ['d', 'b']);
});

test('desmarcar a seção inteira tira só as marcas dela', () => {
  const [, manha] = emBlocos(ROTINA);
  const marcas = ['a', 'd', 'c', 'solto1'];
  assert.deepEqual(desmarcarBloco(marcas, manha), ['d', 'solto1']);
  assert.deepEqual(marcas, ['a', 'd', 'c', 'solto1']);
});

test('desfazer tira a última marca, ou o lote inteiro, sem passar do começo', () => {
  const marcas = ['a', 'c', 'b'];
  assert.deepEqual(semAsUltimas(marcas), ['a', 'c']);
  assert.deepEqual(semAsUltimas(marcas, 2), ['a']);
  assert.deepEqual(semAsUltimas(marcas, 9), []);
  assert.deepEqual(semAsUltimas([], 1), []);
  assert.deepEqual(marcas, ['a', 'c', 'b']);
});
