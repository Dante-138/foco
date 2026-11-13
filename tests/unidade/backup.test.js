import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOTIVO, gerarBackup, lerBackup, resumir } from '../../www/js/nucleo/backup.js';
import { estadoInicial } from '../../www/js/nucleo/estado.js';
import { VERSAO } from '../../www/js/nucleo/migracao.js';

const HOJE = '2026-11-12';
const contexto = () => ({ dia: HOJE, gerarId: () => 'id-gerado' });
const ler = (texto) => lerBackup(texto, contexto());

function comDados() {
  return {
    ...estadoInicial(contexto()),
    rotinas: [
      { id: 'r', nome: 'Manhã', itens: [{ id: 'i', tipo: 'item', texto: 'Acordar', hora: '06:30' }] },
    ],
    rotinaAtiva: 'r',
    habitos: [
      { id: 'h', nome: 'Leitura', cor: 'lilas', tipo: 'simnao', unidade: null, meta: null, arquivado: true },
    ],
    registros: { h: { '2026-11-12': 'feito', '2026-11-11': 'pulado' } },
    listas: [{ id: 'l', nome: 'Faculdade' }],
    listaAtiva: 'l',
    tarefas: [
      {
        id: 't',
        listaId: 'l',
        titulo: 'Prova',
        notas: '',
        prazo: '2026-11-26',
        estrela: false,
        feita: false,
        criadaEm: 1,
        feitaEm: null,
      },
    ],
  };
}

test('o backup gerado é lido de volta sem perder nada', () => {
  const estado = comDados();
  const leitura = ler(gerarBackup(estado));
  assert.equal(leitura.ok, true);
  assert.deepEqual(leitura.estado, estado);
  assert.equal(leitura.correcoes, 0);
});

test('resumir conta rotinas, hábitos, registros, listas e tarefas', () => {
  assert.deepEqual(resumir(comDados()), { rotinas: 1, habitos: 1, registros: 2, listas: 1, tarefas: 1 });
  assert.deepEqual(resumir(estadoInicial(contexto())), {
    rotinas: 0,
    habitos: 0,
    registros: 0,
    listas: 1,
    tarefas: 0,
  });
});

test('o resumo da leitura descreve o que viria no backup', () => {
  assert.deepEqual(ler(gerarBackup(comDados())).resumo, {
    rotinas: 1,
    habitos: 1,
    registros: 2,
    listas: 1,
    tarefas: 1,
  });
});

test('texto vazio ou que não é texto é recusado como vazio', () => {
  for (const entrada of ['', '   ', '\n\t', null, undefined, 42, {}]) {
    assert.deepEqual(ler(entrada), { ok: false, motivo: MOTIVO.VAZIO });
  }
});

test('texto que não é JSON de um objeto é recusado como ilegível', () => {
  for (const entrada of ['{quebrado', 'oi', '42', '"texto"', '[1,2]', 'null', 'true']) {
    assert.deepEqual(ler(entrada), { ok: false, motivo: MOTIVO.ILEGIVEL }, entrada);
  }
});

test('JSON sem nenhuma coleção do Foco não é aceito como backup', () => {
  // Sem esta barreira, restaurar "{}" apagaria todos os dados.
  for (const entrada of [
    '{}',
    '{"versao":2}',
    '{"nome":"outro app","itens":[]}',
    '{"tarefas":"x","habitos":null}',
  ]) {
    assert.deepEqual(ler(entrada), { ok: false, motivo: MOTIVO.NAO_E_BACKUP }, entrada);
  }
});

test('basta uma coleção do Foco para o texto ser tratado como backup', () => {
  const leitura = ler('{"habitos":[{"id":"h","nome":"Leitura","cor":"azul","tipo":"simnao"}]}');
  assert.equal(leitura.ok, true);
  assert.equal(leitura.resumo.habitos, 1);
  assert.equal(leitura.resumo.listas, 1); // a lista padrão é recriada
});

test('backup de versão mais nova é recusado', () => {
  const futuro = JSON.stringify({ ...comDados(), versao: VERSAO + 1 });
  assert.deepEqual(ler(futuro), { ok: false, motivo: MOTIVO.VERSAO_MAIS_NOVA });
});

test('backup da v1 é migrado ao ser lido', () => {
  const v1 = JSON.stringify({ versao: 1, habitos: [{ id: 'h', nome: 'H', cor: '#f472a6', tipo: 'simnao' }] });
  const leitura = ler(v1);
  assert.equal(leitura.ok, true);
  assert.equal(leitura.estado.versao, VERSAO);
  assert.equal(leitura.estado.habitos[0].cor, 'rosa');
});

test('dados inválidos dentro do backup são corrigidos e contados', () => {
  const sujo = { ...comDados(), tarefas: [{ id: 't', listaId: 'nao-existe', titulo: 'Solta' }] };
  const leitura = ler(JSON.stringify(sujo));
  assert.equal(leitura.ok, true);
  assert.equal(leitura.correcoes, 1);
  assert.equal(leitura.estado.tarefas[0].listaId, 'l');
});

test('espaços e quebras de linha em volta do texto colado são ignorados', () => {
  assert.equal(ler(`\n  ${gerarBackup(comDados())}  \n`).ok, true);
});

test('as marcas de rotina só voltam se o backup for do mesmo dia', () => {
  const estado = { ...comDados(), marcasRotina: { data: HOJE, porRotina: { r: ['i'] } } };
  assert.deepEqual(ler(gerarBackup(estado)).estado.marcasRotina.porRotina, { r: ['i'] });

  const deOntem = { ...estado, marcasRotina: { data: '2026-11-11', porRotina: { r: ['i'] } } };
  assert.deepEqual(ler(gerarBackup(deOntem)).estado.marcasRotina, { data: HOJE, porRotina: {} });
});
