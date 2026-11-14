import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ABAS,
  LIMITES,
  ORDENS_TAREFAS,
  VISAO_ESTRELA,
  ehObjeto,
  sanear,
} from '../../www/js/nucleo/esquema.js';
import { VERSAO } from '../../www/js/nucleo/migracao.js';

const HOJE = '2026-11-12';
const contexto = () => ({ dia: HOJE, gerarId: () => 'id-gerado' });
const limpar = (dados) => sanear(dados, contexto());

// Um estado completo e correto, usado como ponto de partida dos testes.
function valido() {
  return {
    versao: VERSAO,
    aba: 'habitos',
    rotinas: [
      {
        id: 'r1',
        nome: 'Home Office',
        itens: [
          { id: 'i1', tipo: 'secao', texto: 'MANHÃ', hora: null, habitoId: null },
          { id: 'i2', tipo: 'item', texto: 'Acordar', hora: '06:30', habitoId: null },
          { id: 'i3', tipo: 'item', texto: 'Arrumar a cama', hora: null, habitoId: 'h1' },
        ],
      },
    ],
    rotinaAtiva: 'r1',
    marcasRotina: { data: HOJE, porRotina: { r1: ['i2'] } },
    marcadosNoFim: false,
    habitos: [
      {
        id: 'h1',
        nome: 'Leitura',
        cor: 'lilas',
        tipo: 'simnao',
        unidade: null,
        meta: null,
        arquivado: false,
      },
      { id: 'h2', nome: 'Água', cor: 'azul', tipo: 'numero', unidade: 'copos', meta: 2, arquivado: true },
    ],
    registros: { h1: { '2026-11-12': 'feito', '2026-11-11': 'pulado' }, h2: { '2026-11-12': 1.5 } },
    notasHabito: { h1: { '2026-11-11': 'Viagem, sem livro' } },
    ocultarConcluidos: true,
    ocultarArquivados: false,
    listas: [
      { id: 'l1', nome: 'Faculdade' },
      { id: 'l2', nome: 'Pessoal' },
    ],
    listaAtiva: 'l2',
    tarefas: [
      {
        id: 't1',
        listaId: 'l1',
        titulo: 'Prova',
        notas: 'Capítulos 1 a 3',
        prazo: '2026-11-26',
        hora: '19:30',
        repeticao: { cada: 2, unidade: 'semana' },
        estrela: true,
        feita: false,
        criadaEm: 1000,
        feitaEm: null,
      },
      {
        id: 't2',
        listaId: 'l2',
        titulo: 'Mercado',
        notas: '',
        prazo: null,
        hora: null,
        repeticao: null,
        estrela: false,
        feita: true,
        criadaEm: 2000,
        feitaEm: 3000,
      },
    ],
    ordemTarefas: 'titulo',
    lembretes: false,
  };
}

test('estado correto passa sem aviso e sem alteração', () => {
  const { estado, avisos } = limpar(valido());
  assert.deepEqual(estado, valido());
  assert.deepEqual(avisos, []);
});

test('sanear é idempotente', () => {
  const sujo = { ...valido(), aba: 'x', tarefas: [{ id: 't', listaId: 'nao-existe', titulo: '  ' }] };
  const uma = limpar(sujo).estado;
  assert.deepEqual(limpar(uma).estado, uma);
  assert.deepEqual(limpar(uma).avisos, []);
});

test('objeto vazio vira um estado utilizável, com a lista padrão', () => {
  const { estado, avisos } = limpar({});
  assert.deepEqual(estado, {
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
  assert.deepEqual(avisos, []);
});

test('coleção que não é lista vira lista vazia, com aviso', () => {
  for (const errado of [null, 'texto', 42, { a: 1 }]) {
    const { estado, avisos } = limpar({ rotinas: errado, habitos: errado, listas: errado, tarefas: errado });
    assert.deepEqual([estado.rotinas, estado.habitos, estado.tarefas], [[], [], []]);
    assert.equal(estado.listas.length, 1);
    assert.equal(avisos.length, 4);
  }
});

test('entradas sem id válido, repetidas ou que não são objeto são descartadas', () => {
  const { estado, avisos } = limpar({
    listas: [
      { id: 'l1', nome: 'A' },
      { id: 'l1', nome: 'repetida' },
      { id: '', nome: 'id vazio' },
      { id: 'x'.repeat(LIMITES.id + 1), nome: 'id longo' },
      { id: 7, nome: 'id numérico' },
      { nome: 'sem id' },
      null,
      'texto',
      ['lista'],
    ],
  });
  assert.deepEqual(estado.listas, [{ id: 'l1', nome: 'A' }]);
  assert.equal(avisos.length, 8);
});

test('campos desconhecidos são removidos', () => {
  const dados = valido();
  dados.lixo = 1;
  dados.tarefas[0].extra = 'x';
  dados.habitos[0].extra = 'x';
  dados.rotinas[0].itens[1].extra = 'x';
  assert.deepEqual(limpar(dados).estado, valido());
});

test('a versão devolvida é sempre a atual', () => {
  assert.equal(limpar({ versao: 1 }).estado.versao, VERSAO);
});

// ---------------------------------------------------------------- rotinas

test('nome de rotina é aparado, cortado no limite e nunca fica vazio', () => {
  const { estado } = limpar({
    rotinas: [
      { id: 'a', nome: `  ${'n'.repeat(LIMITES.nomeRotina + 10)}  `, itens: [] },
      { id: 'b', nome: '   ', itens: [] },
      { id: 'c', nome: 99 },
    ],
  });
  assert.equal(estado.rotinas[0].nome, 'n'.repeat(LIMITES.nomeRotina));
  assert.equal(estado.rotinas[1].nome, 'Rotina');
  assert.deepEqual(estado.rotinas[2], { id: 'c', nome: 'Rotina', itens: [] });
});

test('item sem texto sai sem aviso; tipo desconhecido vira item; seção não tem hora', () => {
  const { estado, avisos } = limpar({
    rotinas: [
      {
        id: 'r',
        nome: 'R',
        itens: [
          { id: '1', tipo: 'item', texto: '   ' },
          { id: '2', tipo: 'outro', texto: 'Tipo errado', hora: '07:00' },
          { id: '3', tipo: 'secao', texto: 'Seção', hora: '08:00' },
          { id: '4', tipo: 'item', texto: 'x'.repeat(LIMITES.textoItem + 5) },
        ],
      },
    ],
  });
  assert.deepEqual(estado.rotinas[0].itens, [
    { id: '2', tipo: 'item', texto: 'Tipo errado', hora: '07:00', habitoId: null },
    { id: '3', tipo: 'secao', texto: 'Seção', hora: null, habitoId: null },
    { id: '4', tipo: 'item', texto: 'x'.repeat(LIMITES.textoItem), hora: null, habitoId: null },
  ]);
  assert.equal(avisos.length, 1); // só o do tipo desconhecido
});

test('hora inválida do item vira null', () => {
  const horas = ['24:00', '7:00', '12:60', 'meio-dia', 1230, null, undefined];
  const { estado } = limpar({
    rotinas: [
      {
        id: 'r',
        nome: 'R',
        itens: horas.map((hora, n) => ({ id: `i${n}`, tipo: 'item', texto: 't', hora })),
      },
    ],
  });
  assert.deepEqual(
    estado.rotinas[0].itens.map((i) => i.hora),
    horas.map(() => null),
  );
});

test('rotina respeita o limite de itens', () => {
  const itens = Array.from({ length: LIMITES.itensPorRotina + 20 }, (_, n) => ({
    id: `i${n}`,
    tipo: 'item',
    texto: 't',
  }));
  const { estado } = limpar({ rotinas: [{ id: 'r', nome: 'R', itens }] });
  assert.equal(estado.rotinas[0].itens.length, LIMITES.itensPorRotina);
});

test('rotinaAtiva inexistente cai na primeira rotina, ou em null se não houver', () => {
  assert.equal(limpar({ ...valido(), rotinaAtiva: 'nao-existe' }).estado.rotinaAtiva, 'r1');
  assert.equal(limpar({ rotinaAtiva: 'nao-existe' }).estado.rotinaAtiva, null);
});

test('marcas: só do dia corrente, só de itens existentes, sem repetição', () => {
  const dados = valido();
  dados.marcasRotina = { data: HOJE, porRotina: { r1: ['i2', 'i2', 'i1', 'fantasma', 5], outra: ['i2'] } };
  assert.deepEqual(limpar(dados).estado.marcasRotina, { data: HOJE, porRotina: { r1: ['i2'] } });
});

test('marcas de outro dia ou malformadas são zeradas', () => {
  const zerado = { data: HOJE, porRotina: {} };
  const casos = [
    { data: '2026-11-11', porRotina: { r1: ['i2'] } },
    { data: HOJE, porRotina: 'x' },
    { data: HOJE, porRotina: { r1: 'i2' } },
    { data: HOJE, porRotina: { r1: ['i1'] } }, // i1 é seção
    'texto',
    null,
    undefined,
  ];
  for (const marcasRotina of casos) {
    assert.deepEqual(limpar({ ...valido(), marcasRotina }).estado.marcasRotina, zerado);
  }
});

// ---------------------------------------------------------------- hábitos

test('hábito: cor desconhecida vira a padrão, com aviso', () => {
  const { estado, avisos } = limpar({ habitos: [{ id: 'h', nome: 'H', cor: '#ff0000', tipo: 'simnao' }] });
  assert.equal(estado.habitos[0].cor, 'azul');
  assert.equal(avisos.length, 1);
});

test('hábito de sim ou não nunca guarda unidade nem meta; tipo desconhecido vira sim ou não', () => {
  const { estado } = limpar({
    habitos: [
      { id: 'a', nome: 'A', cor: 'rosa', tipo: 'simnao', unidade: 'km', meta: 5 },
      { id: 'b', nome: '', cor: 'rosa', tipo: 'outro' },
    ],
  });
  assert.deepEqual(estado.habitos, [
    { id: 'a', nome: 'A', cor: 'rosa', tipo: 'simnao', unidade: null, meta: null, arquivado: false },
    { id: 'b', nome: 'Hábito', cor: 'rosa', tipo: 'simnao', unidade: null, meta: null, arquivado: false },
  ]);
});

test('hábito numérico: unidade cortada ou nula, meta inválida vira 1', () => {
  const numerico = (extra) => ({
    id: String(Math.random()),
    nome: 'N',
    cor: 'verde',
    tipo: 'numero',
    ...extra,
  });
  const { estado } = limpar({
    habitos: [
      numerico({ unidade: '  quilômetros por dia  ', meta: 2.5 }),
      numerico({ unidade: '   ', meta: 0 }),
      numerico({ unidade: 7, meta: -3 }),
      numerico({ meta: '2' }),
      numerico({ meta: Number.NaN }),
      numerico({ meta: Number.POSITIVE_INFINITY }),
    ],
  });
  assert.deepEqual(
    estado.habitos.map((h) => [h.unidade, h.meta]),
    [
      ['quilômetros', 2.5],
      [null, 1],
      [null, 1],
      [null, 1],
      [null, 1],
      [null, 1],
    ],
  );
});

test('registros: só de hábitos existentes, com data real e marca reconhecida', () => {
  const dados = valido();
  dados.registros = {
    h1: {
      '2026-11-12': 'feito',
      '2026-02-30': 'feito', // data que não existe
      '2026-1-5': 'feito', // formato errado
      '2026-11-10': 'talvez',
      '2026-11-09': -1,
      '2026-11-08': Number.NaN,
      '2026-11-07': true,
      '2026-11-06': 0,
    },
    h2: 'nao-e-objeto',
    fantasma: { '2026-11-12': 'feito' },
  };
  const { estado, avisos } = limpar(dados);
  assert.deepEqual(estado.registros, { h1: { '2026-11-12': 'feito', '2026-11-06': 0 } });
  assert.equal(avisos.length, 1);
});

test('registros malformados ou vazios não deixam chave sobrando', () => {
  for (const registros of [null, 'x', [], { h1: {} }, { h1: { 'data-ruim': 'feito' } }]) {
    assert.deepEqual(limpar({ ...valido(), registros }).estado.registros, {});
  }
});

// ---------------------------------------------------------------- tarefas

test('lista com nome vazio recebe um nome; listaAtiva inválida cai na primeira', () => {
  const { estado } = limpar({ listas: [{ id: 'l1', nome: '  ' }], listaAtiva: 'nao-existe' });
  assert.deepEqual(estado.listas, [{ id: 'l1', nome: 'Lista' }]);
  assert.equal(estado.listaAtiva, 'l1');
});

test('a visão "com estrela" é uma listaAtiva válida', () => {
  assert.equal(limpar({ ...valido(), listaAtiva: VISAO_ESTRELA }).estado.listaAtiva, VISAO_ESTRELA);
});

test('tarefa de lista inexistente vai para a primeira lista, com aviso', () => {
  const dados = valido();
  dados.tarefas[0].listaId = 'apagada';
  const { estado, avisos } = limpar(dados);
  assert.equal(estado.tarefas[0].listaId, 'l1');
  assert.equal(avisos.length, 1);
});

test('tarefa: cada campo inválido recebe um valor seguro', () => {
  const { estado } = limpar({
    listas: [{ id: 'l1', nome: 'L' }],
    tarefas: [
      {
        id: 't',
        listaId: 'l1',
        titulo: 42,
        notas: { a: 1 },
        prazo: '2026-13-01',
        hora: '19:30',
        estrela: 'sim',
        feita: 1,
        criadaEm: 'ontem',
        feitaEm: 99,
      },
    ],
  });
  assert.deepEqual(estado.tarefas, [
    {
      id: 't',
      listaId: 'l1',
      titulo: 'Sem título',
      notas: '',
      prazo: null,
      hora: null,
      repeticao: null,
      estrela: false,
      feita: false,
      criadaEm: 0,
      feitaEm: null,
    },
  ]);
});

test('tarefa concluída sem data de conclusão válida usa a data de criação', () => {
  const base = { id: 't', listaId: 'l1', titulo: 'T', feita: true, criadaEm: 500 };
  const feitaEm = (extra) =>
    limpar({ listas: [{ id: 'l1', nome: 'L' }], tarefas: [{ ...base, ...extra }] }).estado.tarefas[0].feitaEm;
  assert.equal(feitaEm({}), 500);
  assert.equal(feitaEm({ feitaEm: -1 }), 500);
  assert.equal(feitaEm({ feitaEm: 900 }), 900);
});

test('título e notas respeitam os limites', () => {
  const { estado } = limpar({
    listas: [{ id: 'l1', nome: 'L' }],
    tarefas: [
      {
        id: 't',
        listaId: 'l1',
        titulo: 't'.repeat(LIMITES.tituloTarefa + 1),
        notas: 'n'.repeat(LIMITES.notasTarefa + 1),
      },
    ],
  });
  assert.equal(estado.tarefas[0].titulo.length, LIMITES.tituloTarefa);
  assert.equal(estado.tarefas[0].notas.length, LIMITES.notasTarefa);
});

// ----------------------------------------------------------------- gerais

test('aba desconhecida volta para a primeira', () => {
  assert.equal(limpar({ aba: 'config' }).estado.aba, ABAS[0]);
  assert.equal(limpar({ aba: 'tarefas' }).estado.aba, 'tarefas');
});

test('ehObjeto recusa null, listas e valores simples', () => {
  assert.equal(ehObjeto({}), true);
  for (const v of [null, undefined, [], 'a', 1, true]) assert.equal(ehObjeto(v), false);
});

test('LIMITES, ABAS e ORDENS_TAREFAS não podem ser alterados', () => {
  assert.ok(Object.isFrozen(LIMITES));
  assert.ok(Object.isFrozen(ABAS));
  assert.ok(Object.isFrozen(ORDENS_TAREFAS));
});

// ------------------------------------------------- campos da versão 3

test('hábito: arquivado só vale quando é verdadeiro de fato', () => {
  const { estado, avisos } = limpar({
    habitos: [
      { id: 'a', nome: 'A', cor: 'rosa', tipo: 'simnao', arquivado: true },
      { id: 'b', nome: 'B', cor: 'rosa', tipo: 'simnao', arquivado: 'sim' },
      { id: 'c', nome: 'C', cor: 'rosa', tipo: 'simnao' },
    ],
  });
  assert.deepEqual(
    estado.habitos.map((h) => h.arquivado),
    [true, false, false],
  );
  assert.deepEqual(avisos, []);
});

test('filtros dos hábitos e ordem das tarefas: valor inválido volta ao padrão', () => {
  for (const errado of [undefined, null, 1, 'true', {}]) {
    const { estado } = limpar({ ocultarConcluidos: errado, ocultarArquivados: errado, ordemTarefas: errado });
    assert.equal(estado.ocultarConcluidos, false);
    assert.equal(estado.ocultarArquivados, true);
    assert.equal(estado.ordemTarefas, ORDENS_TAREFAS[0]);
  }

  const { estado } = limpar({ ocultarConcluidos: true, ocultarArquivados: false, ordemTarefas: 'criacao' });
  assert.deepEqual(
    [estado.ocultarConcluidos, estado.ocultarArquivados, estado.ordemTarefas],
    [true, false, 'criacao'],
  );
});

test('marcados no fim: só o valor falso desliga; qualquer outro vale o padrão, ligado', () => {
  for (const valor of [undefined, null, 0, 'false', {}, true]) {
    assert.equal(limpar({ marcadosNoFim: valor }).estado.marcadosNoFim, true);
  }
  assert.equal(limpar({ marcadosNoFim: false }).estado.marcadosNoFim, false);
});

test('tarefa: horário só vale no formato HH:MM e junto de um prazo', () => {
  const tarefa = (id, prazo, hora) => ({ id, listaId: 'l1', titulo: id, prazo, hora });
  const { estado } = limpar({
    listas: [{ id: 'l1', nome: 'L' }],
    tarefas: [
      tarefa('com-os-dois', '2026-11-26', '07:05'),
      tarefa('hora-invalida', '2026-11-26', '25:00'),
      tarefa('hora-que-nao-e-texto', '2026-11-26', 730),
      tarefa('sem-prazo', null, '07:05'),
      tarefa('sem-hora', '2026-11-26', undefined),
    ],
  });
  assert.deepEqual(
    estado.tarefas.map((t) => [t.id, t.prazo, t.hora]),
    [
      ['com-os-dois', '2026-11-26', '07:05'],
      ['hora-invalida', '2026-11-26', null],
      ['hora-que-nao-e-texto', '2026-11-26', null],
      ['sem-prazo', null, null],
      ['sem-hora', '2026-11-26', null],
    ],
  );
});

test('tarefa: repetição só vale bem formada e junto de um prazo; campos a mais são descartados', () => {
  const tarefa = (id, prazo, repeticao) => ({ id, listaId: 'l1', titulo: id, prazo, repeticao });
  const { estado } = limpar({
    listas: [{ id: 'l1', nome: 'L' }],
    tarefas: [
      tarefa('boa', '2026-11-26', { cada: 2, unidade: 'semana', lixo: 1 }),
      tarefa('unidade-errada', '2026-11-26', { cada: 1, unidade: 'quinzena' }),
      tarefa('sem-prazo', null, { cada: 1, unidade: 'dia' }),
      tarefa('texto', '2026-11-26', 'toda semana'),
    ],
  });
  assert.deepEqual(
    estado.tarefas.map((t) => [t.id, t.repeticao]),
    [
      ['boa', { cada: 2, unidade: 'semana' }],
      ['unidade-errada', null],
      ['sem-prazo', null],
      ['texto', null],
    ],
  );
});

test('item de rotina: a ligação só vale para hábito que existe, e seção nunca tem ligação', () => {
  const { estado, avisos } = limpar({
    habitos: [{ id: 'h', nome: 'H', cor: 'azul', tipo: 'simnao' }],
    rotinas: [
      {
        id: 'r',
        nome: 'R',
        itens: [
          { id: '1', tipo: 'item', texto: 'ligado', habitoId: 'h' },
          { id: '2', tipo: 'item', texto: 'hábito excluído', habitoId: 'nao-existe' },
          { id: '3', tipo: 'item', texto: 'ligação que não é texto', habitoId: 7 },
          { id: '4', tipo: 'secao', texto: 'SEÇÃO', habitoId: 'h' },
          { id: '5', tipo: 'item', texto: 'sem ligação' },
        ],
      },
    ],
  });
  assert.deepEqual(
    estado.rotinas[0].itens.map((i) => [i.id, i.habitoId]),
    [
      ['1', 'h'],
      ['2', null],
      ['3', null],
      ['4', null],
      ['5', null],
    ],
  );
  assert.deepEqual(avisos, []); // ligação solta some sem aviso
});

test('lembretes: só o valor falso desliga; qualquer outro vale o padrão, ligado', () => {
  for (const valor of [undefined, null, 0, 'false', {}, true]) {
    assert.equal(limpar({ lembretes: valor }).estado.lembretes, true);
  }
  assert.equal(limpar({ lembretes: false }).estado.lembretes, false);
});

test('notas dos hábitos: só de hábito existente, com data real e texto; vazia some sem aviso', () => {
  const { estado, avisos } = limpar({
    habitos: [{ id: 'h', nome: 'H', cor: 'azul', tipo: 'simnao' }],
    notasHabito: {
      h: {
        '2026-11-10': '  Viagem  ',
        '2026-11-11': '   ',
        '2026-02-30': 'data que não existe',
        '2026-11-12': 42,
        '2026-11-09': 'x'.repeat(LIMITES.notaHabito + 10),
      },
      excluido: { '2026-11-10': 'de hábito que não existe' },
      vazio: 'não é objeto',
    },
  });
  assert.deepEqual(estado.notasHabito, {
    h: { '2026-11-10': 'Viagem', '2026-11-09': 'x'.repeat(LIMITES.notaHabito) },
  });
  assert.equal(avisos.length, 1); // um aviso pelo hábito com entradas inválidas

  for (const errado of [undefined, null, 'texto', [], 7]) {
    assert.deepEqual(limpar({ notasHabito: errado }).estado.notasHabito, {});
  }
  assert.deepEqual(
    limpar({ habitos: [{ id: 'h', nome: 'H', cor: 'azul' }], notasHabito: { h: { '2026-11-11': ' ' } } })
      .estado.notasHabito,
    {},
  );
});
