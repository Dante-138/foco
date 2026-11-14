import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inserirDepois,
  inserirNoFimDoBloco,
  limparVazios,
  naOrdem,
  remover,
} from '../../www/js/nucleo/rotina-edicao.js';

const secao = (id, texto = id) => ({ id, tipo: 'secao', texto, hora: null, habitoId: null });
const item = (id, texto = id) => ({ id, tipo: 'item', texto, hora: null, habitoId: null });
const ids = (lista) => lista.map((i) => i.id);

const ROTINA = [item('solto'), secao('MANHÃ'), item('a'), item('b'), secao('NOITE'), item('c')];
const NOVO = item('novo', '');

test('inserir depois de um item, de uma seção ou do último; sem a referência, no fim', () => {
  assert.deepEqual(ids(inserirDepois(ROTINA, 'a', NOVO)), ['solto', 'MANHÃ', 'a', 'novo', 'b', 'NOITE', 'c']);
  assert.deepEqual(ids(inserirDepois(ROTINA, 'MANHÃ', NOVO)), [
    'solto',
    'MANHÃ',
    'novo',
    'a',
    'b',
    'NOITE',
    'c',
  ]);
  assert.deepEqual(ids(inserirDepois(ROTINA, 'c', NOVO)), [...ids(ROTINA), 'novo']);
  assert.deepEqual(ids(inserirDepois(ROTINA, 'nao-existe', NOVO)), [...ids(ROTINA), 'novo']);
});

test('inserir no fim do bloco: antes da seção seguinte, ou no fim da rotina na última seção', () => {
  assert.deepEqual(ids(inserirNoFimDoBloco(ROTINA, 'MANHÃ', NOVO)), [
    'solto',
    'MANHÃ',
    'a',
    'b',
    'novo',
    'NOITE',
    'c',
  ]);
  assert.deepEqual(ids(inserirNoFimDoBloco(ROTINA, 'NOITE', NOVO)), [...ids(ROTINA), 'novo']);
  // seção vazia no meio
  const comVazia = [secao('A'), secao('B'), item('x')];
  assert.deepEqual(ids(inserirNoFimDoBloco(comVazia, 'A', NOVO)), ['A', 'novo', 'B', 'x']);
});

test('inserir no bloco dos itens soltos: antes da primeira seção; sem seção, no fim', () => {
  assert.deepEqual(ids(inserirNoFimDoBloco(ROTINA, null, NOVO)), [
    'solto',
    'novo',
    'MANHÃ',
    'a',
    'b',
    'NOITE',
    'c',
  ]);
  assert.deepEqual(ids(inserirNoFimDoBloco([item('x')], null, NOVO)), ['x', 'novo']);
  assert.deepEqual(ids(inserirNoFimDoBloco([], null, NOVO)), ['novo']);
  assert.deepEqual(ids(inserirNoFimDoBloco(ROTINA, 'nao-existe', NOVO)), [...ids(ROTINA), 'novo']);
});

test('remover tira só o item pedido; seção removida deixa os itens dela para o bloco anterior', () => {
  assert.deepEqual(ids(remover(ROTINA, 'b')), ['solto', 'MANHÃ', 'a', 'NOITE', 'c']);
  assert.deepEqual(ids(remover(ROTINA, 'NOITE')), ['solto', 'MANHÃ', 'a', 'b', 'c']);
  assert.deepEqual(ids(remover(ROTINA, 'nao-existe')), ids(ROTINA));
});

test('limpar vazios apara e corta o texto e tira item ou seção sem texto, mantendo o resto do item', () => {
  const sujo = [
    { ...item('a', '  Levantar  '), hora: '06:30', habitoId: 'h' },
    item('vazio', '   '),
    secao('s', ''),
    secao('t', ' NOITE '),
    item('longo', 'x'.repeat(12)),
  ];
  assert.deepEqual(limparVazios(sujo, 10), [
    { id: 'a', tipo: 'item', texto: 'Levantar', hora: '06:30', habitoId: 'h' },
    { id: 't', tipo: 'secao', texto: 'NOITE', hora: null, habitoId: null },
    { id: 'longo', tipo: 'item', texto: 'x'.repeat(10), hora: null, habitoId: null },
  ]);
});

test('nenhuma função altera a lista recebida', () => {
  const copia = structuredClone(ROTINA);
  inserirDepois(ROTINA, 'a', NOVO);
  inserirNoFimDoBloco(ROTINA, 'MANHÃ', NOVO);
  remover(ROTINA, 'a');
  limparVazios(ROTINA, 300);
  assert.deepEqual(ROTINA, copia);
});

test('na ordem dos ids: segue a tela, ignora id desconhecido e não perde item', () => {
  assert.deepEqual(ids(naOrdem(ROTINA, ['c', 'NOITE', 'solto', 'MANHÃ', 'a', 'b'])), [
    'c',
    'NOITE',
    'solto',
    'MANHÃ',
    'a',
    'b',
  ]);
  assert.deepEqual(ids(naOrdem(ROTINA, ['b', 'fantasma', 'a'])), ['b', 'a', 'solto', 'MANHÃ', 'NOITE', 'c']);
  assert.deepEqual(naOrdem([], ['x']), []);
});
