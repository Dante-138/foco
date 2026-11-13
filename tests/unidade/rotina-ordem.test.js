import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emOrdemDeExibicao, semAUltimaMarca } from '../../www/js/nucleo/rotina-ordem.js';

const secao = (id) => ({ id, tipo: 'secao', texto: id });
const item = (id) => ({ id, tipo: 'item', texto: id });
const ids = (lista) => lista.map((i) => i.id);

const ROTINA = [
  item('solto1'),
  item('solto2'),
  secao('MANHÃ'),
  item('a'),
  item('b'),
  item('c'),
  secao('NOITE'),
  item('d'),
];

test('com a opção desligada, a ordem é a que foi escrita', () => {
  assert.equal(emOrdemDeExibicao(ROTINA, new Set(['a']), false), ROTINA);
});

test('marcados descem para o fim da própria seção, sem trocar a ordem entre si', () => {
  const ordem = emOrdemDeExibicao(ROTINA, new Set(['a', 'b', 'solto1']), true);
  assert.deepEqual(ids(ordem), ['solto2', 'solto1', 'MANHÃ', 'c', 'a', 'b', 'NOITE', 'd']);
});

test('sem nada marcado, ou com tudo marcado, a ordem não muda', () => {
  assert.deepEqual(ids(emOrdemDeExibicao(ROTINA, new Set(), true)), ids(ROTINA));
  const tudo = new Set(ROTINA.filter((i) => i.tipo === 'item').map((i) => i.id));
  assert.deepEqual(ids(emOrdemDeExibicao(ROTINA, tudo, true)), ids(ROTINA));
});

test('a ordenação não altera a lista recebida, e rotina vazia continua vazia', () => {
  const copia = structuredClone(ROTINA);
  emOrdemDeExibicao(ROTINA, new Set(['a']), true);
  assert.deepEqual(ROTINA, copia);
  assert.deepEqual(emOrdemDeExibicao([], new Set(), true), []);
});

test('desfazer tira a última marca feita e não altera a lista recebida', () => {
  const marcas = ['a', 'c', 'b'];
  assert.deepEqual(semAUltimaMarca(marcas), ['a', 'c']);
  assert.deepEqual(marcas, ['a', 'c', 'b']);
  assert.deepEqual(semAUltimaMarca([]), []);
});
