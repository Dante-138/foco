import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSAO, migrar } from '../../www/js/nucleo/migracao.js';

test('v1 -> v2 troca a cor hexadecimal do hábito pela chave da paleta', () => {
  const dados = migrar({
    versao: 1,
    habitos: [
      { id: 'a', cor: '#ffd95a' },
      { id: 'b', cor: '#5aaaf5' },
      { id: 'c', cor: '#f2f2f2' },
    ],
  });
  assert.deepEqual(
    dados.habitos.map((h) => h.cor),
    ['amarelo', 'azul', 'neutro'],
  );
  assert.equal(dados.versao, VERSAO);
});

test('cor fora da tabela da v1 fica como está, para a validação decidir', () => {
  const dados = migrar({ versao: 1, habitos: [{ id: 'a', cor: '#123456' }, { id: 'b' }] });
  assert.equal(dados.habitos[0].cor, '#123456');
  assert.equal(Object.hasOwn(dados.habitos[1], 'cor'), false);
});

test('nome de propriedade herdada não é confundido com cor da tabela', () => {
  const dados = migrar({
    versao: 1,
    habitos: [
      { id: 'a', cor: 'toString' },
      { id: 'b', cor: 'constructor' },
    ],
  });
  assert.deepEqual(
    dados.habitos.map((h) => h.cor),
    ['toString', 'constructor'],
  );
});

test('habitos ausente, nulo ou com entradas inválidas não derruba a migração', () => {
  for (const habitos of [undefined, null, 'x', 7, {}]) {
    assert.equal(migrar({ versao: 1, habitos }).versao, VERSAO);
  }
  const misto = migrar({ versao: 1, habitos: [null, 'x', 3, { id: 'a', cor: '#f472a6' }] });
  assert.equal(misto.habitos[3].cor, 'rosa');
});

test('dados já na versão atual não são alterados', () => {
  const dados = { versao: VERSAO, habitos: [{ id: 'a', cor: '#ffd95a' }] };
  assert.deepEqual(migrar(structuredClone(dados)), dados);
});

test('migrar duas vezes dá o mesmo resultado', () => {
  const uma = migrar({ versao: 1, habitos: [{ id: 'a', cor: '#f472a6' }] });
  const duas = migrar(structuredClone(uma));
  assert.deepEqual(duas, uma);
});

test('a migração termina sempre na versão atual e devolve o mesmo objeto', () => {
  const dados = { versao: 1, habitos: [] };
  assert.equal(migrar(dados), dados);
  assert.equal(dados.versao, VERSAO);
});

test('v2 -> v3 só sobe o número: os campos novos nascem na validação', () => {
  const dados = migrar({ versao: 2, habitos: [{ id: 'a', cor: 'rosa' }], tarefas: [] });
  assert.deepEqual(dados, { versao: 3, habitos: [{ id: 'a', cor: 'rosa' }], tarefas: [] });
});
