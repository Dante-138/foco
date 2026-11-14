import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  devolver,
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
  devolver(ROTINA.slice(2), ROTINA, ['solto', 'MANHÃ']);
  assert.deepEqual(ROTINA, copia);
});

test('devolver: os itens excluídos voltam ao lugar que tinham', () => {
  const sem = (...fora) => ROTINA.filter((i) => !fora.includes(i.id));
  // Do começo, do meio e do fim de uma vez.
  assert.deepEqual(ids(devolver(sem('solto', 'b', 'c'), ROTINA, ['solto', 'b', 'c'])), ids(ROTINA));
  // Dois seguidos voltam na ordem de antes.
  assert.deepEqual(ids(devolver(sem('a', 'b'), ROTINA, ['a', 'b'])), ids(ROTINA));
  // Lista vazia recebe tudo de volta; id que já está na lista não duplica.
  assert.deepEqual(ids(devolver([], ROTINA, ids(ROTINA))), ids(ROTINA));
  assert.deepEqual(ids(devolver(ROTINA, ROTINA, ['a'])), ids(ROTINA));
});

test('devolver: respeita o que mudou na lista depois da exclusão', () => {
  const semB = remover(ROTINA, 'b');
  // Entrou um item novo depois de "a": "b" volta logo depois de "a", e o novo fica.
  assert.deepEqual(ids(devolver(inserirDepois(semB, 'a', NOVO), ROTINA, ['b'])), [
    'solto',
    'MANHÃ',
    'a',
    'b',
    'novo',
    'NOITE',
    'c',
  ]);
  // O vizinho "a" foi apagado por outro caminho: ele não volta, e "b" entra depois de quem sobrou.
  assert.deepEqual(ids(devolver(remover(semB, 'a'), ROTINA, ['b'])), ['solto', 'MANHÃ', 'b', 'NOITE', 'c']);
  // A ordem dos que ficaram mudou: vale a posição de agora do vizinho.
  const trocada = naOrdem(semB, ['NOITE', 'c', 'solto', 'MANHÃ', 'a']);
  assert.deepEqual(ids(devolver(trocada, ROTINA, ['b'])), ['NOITE', 'c', 'solto', 'MANHÃ', 'a', 'b']);
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
