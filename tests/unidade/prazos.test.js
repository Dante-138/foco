import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agrupar, ordenar, porPrazo, rotuloData } from '../../www/js/nucleo/prazos.js';

const HOJE = '2026-11-12';

let relogio = 0;
function tarefa(titulo, prazo = null) {
  relogio += 1;
  return { titulo, prazo, criadaEm: relogio };
}

test('grupos saem na ordem: Atrasadas, Hoje, Amanhã, datas futuras, Sem data', () => {
  const grupos = agrupar(
    [
      tarefa('sem data'),
      tarefa('prova', '2026-11-26'),
      tarefa('amanhã', '2026-11-13'),
      tarefa('hoje', '2026-11-12'),
      tarefa('atrasada', '2026-11-11'),
      tarefa('projeto', '2026-11-15'),
    ],
    HOJE,
  );
  assert.deepEqual(
    grupos.map((g) => g.chave),
    ['atrasadas', 'hoje', 'amanha', '2026-11-15', '2026-11-26', 'sem-data'],
  );
  assert.deepEqual(
    grupos.map((g) => g.atrasado),
    [true, false, false, false, false, false],
  );
});

test('todas as atrasadas ficam em um grupo só, da mais antiga para a mais recente', () => {
  const [grupo] = agrupar([tarefa('b', '2026-11-10'), tarefa('a', '2026-10-01')], HOJE);
  assert.equal(grupo.rotulo, 'Atrasadas');
  assert.deepEqual(
    grupo.tarefas.map((t) => t.titulo),
    ['a', 'b'],
  );
});

test('tarefas do mesmo dia e as sem data ficam na ordem de criação', () => {
  const primeira = tarefa('primeira', '2026-11-20');
  const segunda = tarefa('segunda', '2026-11-20');
  const solta1 = tarefa('solta 1');
  const solta2 = tarefa('solta 2');
  const grupos = agrupar([solta2, segunda, solta1, primeira], HOJE);
  assert.deepEqual(
    grupos.map((g) => g.tarefas.map((t) => t.titulo)),
    [
      ['primeira', 'segunda'],
      ['solta 1', 'solta 2'],
    ],
  );
});

test('agrupar não altera a lista recebida', () => {
  const lista = [tarefa('z'), tarefa('a', '2026-11-12')];
  const copia = [...lista];
  agrupar(lista, HOJE);
  assert.deepEqual(lista, copia);
});

test('lista vazia não gera grupos', () => {
  assert.deepEqual(agrupar([], HOJE), []);
});

test('porPrazo coloca tarefa com prazo antes de tarefa sem data', () => {
  const comPrazo = tarefa('com', '2027-01-01');
  const semPrazo = tarefa('sem');
  assert.ok(porPrazo(comPrazo, semPrazo) < 0);
  assert.ok(porPrazo(semPrazo, comPrazo) > 0);
});

test('rotuloData mostra dia da semana no ano corrente e o ano quando é outro', () => {
  assert.match(rotuloData('2026-11-13', HOJE), /sex.*13 de nov/);
  assert.doesNotMatch(rotuloData('2026-11-13', HOJE), /2026/);
  assert.match(rotuloData('2027-02-10', HOJE), /10 de fev.*2027/);
});

test('virada do ano: 1º de janeiro é "Amanhã" em 31 de dezembro', () => {
  const grupos = agrupar([tarefa('ano novo', '2027-01-01')], '2026-12-31');
  assert.equal(grupos[0].chave, 'amanha');
});

// ------------------------------------------------------------- ordenar

const titulos = (lista) => lista.map((t) => t.titulo);

test('ordenar por estrela: as com estrela primeiro; dentro de cada parte, por prazo', () => {
  const lista = [
    { titulo: 'sem estrela, dia 20', prazo: '2026-11-20', estrela: false, criadaEm: 1 },
    { titulo: 'com estrela, sem data', prazo: null, estrela: true, criadaEm: 2 },
    { titulo: 'com estrela, dia 30', prazo: '2026-11-30', estrela: true, criadaEm: 3 },
    { titulo: 'sem estrela, dia 13', prazo: '2026-11-13', estrela: false, criadaEm: 4 },
  ];
  assert.deepEqual(titulos(ordenar(lista, 'estrela')), [
    'com estrela, dia 30',
    'com estrela, sem data',
    'sem estrela, dia 13',
    'sem estrela, dia 20',
  ]);
});

test('ordenar por título: alfabética, sem diferenciar maiúsculas nem acentos; empate pela criação', () => {
  const lista = [
    { titulo: 'zebra', criadaEm: 1 },
    { titulo: 'Água', criadaEm: 2 },
    { titulo: 'abacaxi', criadaEm: 3 },
    { titulo: 'Tarefa 10', criadaEm: 4 },
    { titulo: 'Tarefa 2', criadaEm: 5 },
    { titulo: 'agua', criadaEm: 6 },
  ];
  assert.deepEqual(titulos(ordenar(lista, 'titulo')), [
    'abacaxi',
    'Água',
    'agua',
    'Tarefa 2',
    'Tarefa 10',
    'zebra',
  ]);
});

test('ordenar por criação: as mais novas primeiro', () => {
  const lista = [
    { titulo: 'velha', criadaEm: 10 },
    { titulo: 'nova', criadaEm: 30 },
    { titulo: 'do meio', criadaEm: 20 },
  ];
  assert.deepEqual(titulos(ordenar(lista, 'criacao')), ['nova', 'do meio', 'velha']);
});

test('ordenar com ordem desconhecida usa o prazo, e nunca altera a lista recebida', () => {
  const lista = [
    { titulo: 'sem data', prazo: null, criadaEm: 1 },
    { titulo: 'dia 20', prazo: '2026-11-20', criadaEm: 2 },
  ];
  const copia = structuredClone(lista);
  assert.deepEqual(titulos(ordenar(lista, 'data')), ['dia 20', 'sem data']);
  assert.deepEqual(titulos(ordenar(lista, 'qualquer coisa')), ['dia 20', 'sem data']);
  assert.deepEqual(lista, copia);
});
