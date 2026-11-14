import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROXIMOS_DA_ROTINA, TAREFAS_NO_PAINEL, resumoDoDia } from '../../www/js/nucleo/painel.js';

const HOJE = '2026-11-13';
const item = (id) => ({ id, tipo: 'item', texto: id, hora: null });
const secao = (id) => ({ id, tipo: 'secao', texto: id, hora: null });
const vazio = { rotina: null, marcadas: new Set(), habitos: [], registros: {}, tarefas: [], dia: HOJE };

test('sem nada, tudo zera', () => {
  assert.deepEqual(resumoDoDia(vazio), {
    rotina: { feitos: 0, total: 0, proximos: [] },
    habitos: { feitos: 0, total: 0 },
    tarefas: { total: 0, atrasadas: 0, primeiras: [] },
  });
});

test('rotina: conta só itens, e os próximos são os que faltam, na ordem, até o limite', () => {
  const rotina = { itens: [secao('MANHÃ'), item('a'), item('b'), item('c'), item('d'), item('e')] };
  const { rotina: resumo } = resumoDoDia({ ...vazio, rotina, marcadas: new Set(['b']) });
  assert.equal(PROXIMOS_DA_ROTINA, 3);
  assert.deepEqual([resumo.feitos, resumo.total], [1, 5]);
  assert.deepEqual(
    resumo.proximos.map((i) => i.id),
    ['a', 'c', 'd'],
  );
});

test('hábitos: arquivado e dia pulado saem da conta; numérico conta quando bate a meta', () => {
  const habitos = [
    { id: 'feito', tipo: 'simnao', arquivado: false },
    { id: 'falta', tipo: 'simnao', arquivado: false },
    { id: 'pulado', tipo: 'simnao', arquivado: false },
    { id: 'velho', tipo: 'simnao', arquivado: true },
    { id: 'agua', tipo: 'numero', meta: 2, arquivado: false },
    { id: 'pouca', tipo: 'numero', meta: 2, arquivado: false },
  ];
  const registros = {
    feito: { [HOJE]: 'feito' },
    pulado: { [HOJE]: 'pulado' },
    velho: { [HOJE]: 'feito' },
    agua: { [HOJE]: 3 },
    pouca: { [HOJE]: 1, '2026-11-12': 5 },
  };
  assert.deepEqual(resumoDoDia({ ...vazio, habitos, registros }).habitos, { feitos: 2, total: 4 });
});

test('tarefas: pendentes com prazo até hoje, atrasadas primeiro, até o limite', () => {
  let n = 0;
  const tarefa = (titulo, prazo, extra = {}) => {
    n += 1;
    return { titulo, prazo, hora: null, feita: false, criadaEm: n, ...extra };
  };
  const tarefas = [
    tarefa('amanhã', '2026-11-14'),
    tarefa('sem data', null),
    tarefa('feita hoje', HOJE, { feita: true }),
    tarefa('hoje à tarde', HOJE, { hora: '15:00' }),
    tarefa('hoje sem hora', HOJE),
    tarefa('atrasada', '2026-11-10'),
    ...Array.from({ length: 4 }, (_, i) => tarefa(`mais ${i}`, HOJE)),
  ];
  const { tarefas: resumo } = resumoDoDia({ ...vazio, tarefas });
  assert.equal(TAREFAS_NO_PAINEL, 5);
  assert.deepEqual([resumo.total, resumo.atrasadas], [7, 1]);
  assert.deepEqual(
    resumo.primeiras.map((t) => t.titulo),
    ['atrasada', 'hoje à tarde', 'hoje sem hora', 'mais 0', 'mais 1'],
  );
});
