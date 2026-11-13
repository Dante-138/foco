import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROBLEMA, estadoInicial, lerEstado } from '../../www/js/nucleo/estado.js';
import { VERSAO } from '../../www/js/nucleo/migracao.js';

const HOJE = '2026-11-12';
const contexto = () => ({ dia: HOJE, gerarId: () => 'id-gerado' });
const ler = (bruto) => lerEstado(bruto, contexto());
const inicial = () => estadoInicial(contexto());

test('estado inicial tem uma lista, nenhuma rotina e a data de hoje nas marcas', () => {
  assert.deepEqual(inicial(), {
    versao: VERSAO,
    aba: 'rotinas',
    rotinas: [],
    rotinaAtiva: null,
    marcasRotina: { data: HOJE, porRotina: {} },
    marcadosNoFim: true,
    habitos: [],
    registros: {},
    notasHabito: {},
    ocultarConcluidos: false,
    ocultarArquivados: true,
    listas: [{ id: 'id-gerado', nome: 'Minhas tarefas' }],
    listaAtiva: 'id-gerado',
    tarefas: [],
    ordemTarefas: 'data',
    lembretes: true,
  });
});

test('sem nada salvo, começa do estado inicial e sem problema', () => {
  for (const bruto of [null, undefined, '']) {
    assert.deepEqual(ler(bruto), { estado: inicial(), problema: null, avisos: [] });
  }
});

test('texto que não é JSON de um objeto é tratado como ilegível', () => {
  for (const bruto of ['{quebrado', 'null', '42', '"texto"', '[1,2]', 'true']) {
    assert.deepEqual(ler(bruto), { estado: inicial(), problema: PROBLEMA.ILEGIVEL, avisos: [] });
  }
});

test('dados de uma versão mais nova não são interpretados', () => {
  const bruto = JSON.stringify({ versao: VERSAO + 1, tarefas: [{ id: 't', titulo: 'do futuro' }] });
  assert.deepEqual(ler(bruto), { estado: inicial(), problema: PROBLEMA.VERSAO_MAIS_NOVA, avisos: [] });
});

test('dados da v1 são migrados e validados', () => {
  const bruto = JSON.stringify({
    versao: 1,
    aba: 'habitos',
    habitos: [{ id: 'h', nome: 'Leitura', cor: '#b09cf2', tipo: 'simnao', unidade: null, meta: null }],
    listas: [{ id: 'l', nome: 'Faculdade' }],
    listaAtiva: 'l',
  });
  const { estado, problema, avisos } = ler(bruto);
  assert.equal(problema, null);
  assert.deepEqual(avisos, []);
  assert.equal(estado.versao, VERSAO);
  assert.equal(estado.aba, 'habitos');
  assert.equal(estado.habitos[0].cor, 'lilas');
  assert.deepEqual(estado.listas, [{ id: 'l', nome: 'Faculdade' }]);
});

test('versão ausente ou inválida é tratada como a mais antiga', () => {
  for (const versao of [undefined, null, 0, -2, 1.5, '2', {}]) {
    const bruto = JSON.stringify({
      versao,
      habitos: [{ id: 'h', nome: 'H', cor: '#ffd95a', tipo: 'simnao' }],
    });
    const { estado, problema } = ler(bruto);
    assert.equal(problema, null);
    assert.equal(estado.habitos[0].cor, 'amarelo');
    assert.equal(estado.versao, VERSAO);
  }
});

test('campo malformado não derruba a leitura nem descarta o resto', () => {
  const bruto = JSON.stringify({
    versao: 1,
    habitos: null,
    tarefas: 'x',
    listas: [{ id: 'l', nome: 'Faculdade' }],
    rotinas: [
      { id: 'r', nome: 'Manhã', itens: [{ id: 'i', tipo: 'item', texto: 'Acordar', hora: '06:30' }] },
    ],
  });
  const { estado, problema, avisos } = ler(bruto);
  assert.equal(problema, null);
  assert.equal(avisos.length, 2);
  assert.equal(estado.rotinas[0].itens[0].texto, 'Acordar');
  assert.deepEqual(estado.habitos, []);
  assert.deepEqual(estado.tarefas, []);
});

test('lerEstado não altera o texto de entrada nem compartilha objetos entre leituras', () => {
  const bruto = JSON.stringify({ versao: VERSAO, listas: [{ id: 'l', nome: 'A' }] });
  const a = ler(bruto).estado;
  const b = ler(bruto).estado;
  a.listas[0].nome = 'alterado';
  assert.equal(b.listas[0].nome, 'A');
});
