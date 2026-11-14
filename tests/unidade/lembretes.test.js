import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HORA_PADRAO,
  MAXIMO_DE_LEMBRETES,
  idDaNotificacao,
  planejar,
} from '../../www/js/nucleo/lembretes.js';

const AGORA = '2026-11-12T10:00';
const LISTAS = [
  { id: 'fac', nome: 'Faculdade' },
  { id: 'casa', nome: 'Casa' },
];

let relogio = 0;
function tarefa(id, extra = {}) {
  relogio += 1;
  return {
    id,
    listaId: 'fac',
    titulo: `Tarefa ${id}`,
    notas: '',
    prazo: '2026-11-13',
    hora: null,
    feita: false,
    criadaEm: relogio,
    ...extra,
  };
}

test('id da notificação: inteiro de 1 a 2^30, estável e diferente entre tarefas', () => {
  const ids = ['a', 'b', 'mhx3k2p0001abcd', 'mhx3k2p0002abcd', ''].map(idDaNotificacao);
  for (const id of ids) {
    assert.ok(Number.isInteger(id) && id > 0 && id <= 2 ** 30, String(id));
  }
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(idDaNotificacao('mhx3k2p0001abcd'), idDaNotificacao('mhx3k2p0001abcd'));
});

test('tarefa com horário avisa na hora; só com data, de manhã', () => {
  const plano = planejar([tarefa('com-hora', { hora: '14:30' }), tarefa('sem-hora')], LISTAS, AGORA);
  assert.equal(HORA_PADRAO, '09:00');
  assert.deepEqual(
    plano.map((l) => [l.tarefaId, l.quando]),
    [
      ['sem-hora', '2026-11-13T09:00'],
      ['com-hora', '2026-11-13T14:30'],
    ],
  );
  assert.equal(plano[0].id, idDaNotificacao('sem-hora'));
  assert.equal(plano[0].titulo, 'Tarefa sem-hora');
});

test('ficam de fora: concluída, sem data e a que já passou', () => {
  const plano = planejar(
    [
      tarefa('feita', { feita: true }),
      tarefa('sem-data', { prazo: null }),
      tarefa('ontem', { prazo: '2026-11-11' }),
      tarefa('hoje-cedo', { prazo: '2026-11-12', hora: '09:59' }),
      tarefa('hoje-agora', { prazo: '2026-11-12', hora: '10:00' }),
      tarefa('hoje-sem-hora', { prazo: '2026-11-12' }), // o aviso das 9h já passou
      tarefa('hoje-tarde', { prazo: '2026-11-12', hora: '10:01' }),
    ],
    LISTAS,
    AGORA,
  );
  assert.deepEqual(
    plano.map((l) => l.tarefaId),
    ['hoje-tarde'],
  );
});

test('a ordem é a do relógio; no mesmo momento, a criada antes vem primeiro', () => {
  const plano = planejar(
    [
      tarefa('c', { prazo: '2026-11-20' }),
      tarefa('b', { prazo: '2026-11-13', hora: '08:00' }),
      tarefa('a2', { prazo: '2026-11-12', hora: '18:00' }),
      tarefa('a1', { prazo: '2026-11-12', hora: '18:00', criadaEm: 0 }),
    ],
    LISTAS,
    AGORA,
  );
  assert.deepEqual(
    plano.map((l) => l.tarefaId),
    ['a1', 'a2', 'b', 'c'],
  );
});

test('o corpo junta a lista e a primeira linha da nota, cortada com reticências', () => {
  const longa = 'x'.repeat(200);
  const [simples, comNota, semLista, cortada] = planejar(
    [
      tarefa('1'),
      tarefa('2', { listaId: 'casa', notas: '  Levar o certificado  \nsegunda linha' }),
      tarefa('3', { listaId: 'apagada', notas: 'Só a nota' }),
      tarefa('4', { notas: longa }),
    ],
    LISTAS,
    AGORA,
  ).map((l) => l.corpo);
  assert.equal(simples, 'Faculdade');
  assert.equal(comNota, 'Casa · Levar o certificado');
  assert.equal(semLista, 'Só a nota');
  assert.equal(cortada, `Faculdade · ${'x'.repeat(119)}…`);
});

test('o plano fica com os lembretes mais próximos, até o máximo', () => {
  const muitas = Array.from({ length: MAXIMO_DE_LEMBRETES + 5 }, (_, i) =>
    tarefa(`t${i}`, {
      prazo: '2026-12-01',
      hora: `${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
    }),
  );
  const plano = planejar([...muitas].reverse(), LISTAS, AGORA);
  assert.equal(plano.length, MAXIMO_DE_LEMBRETES);
  assert.equal(plano[0].tarefaId, 't0');
  assert.equal(plano.at(-1).tarefaId, `t${MAXIMO_DE_LEMBRETES - 1}`);
});

test('duas tarefas com o mesmo número de notificação: fica só o lembrete mais próximo', () => {
  // mesmo id de tarefa repetido força a coincidência do número
  const plano = planejar(
    [tarefa('igual', { prazo: '2026-11-20' }), tarefa('igual', { prazo: '2026-11-14' })],
    LISTAS,
    AGORA,
  );
  assert.deepEqual(
    plano.map((l) => l.quando),
    ['2026-11-14T09:00'],
  );
});

test('sem tarefas, o plano é vazio', () => {
  assert.deepEqual(planejar([], LISTAS, AGORA), []);
});
