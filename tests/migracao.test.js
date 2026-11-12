import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSAO, migrar } from '../www/js/migracao.js';

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
  assert.equal(dados.versao, 2);
});

test('cor desconhecida da v1 vira azul', () => {
  const dados = migrar({ versao: 1, habitos: [{ id: 'a', cor: '#123456' }] });
  assert.equal(dados.habitos[0].cor, 'azul');
});

test('dados já na versão atual não são alterados', () => {
  const dados = { versao: VERSAO, habitos: [{ id: 'a', cor: 'rosa' }] };
  assert.deepEqual(migrar(structuredClone(dados)), dados);
});

test('migrar duas vezes dá o mesmo resultado', () => {
  const uma = migrar({ versao: 1, habitos: [{ id: 'a', cor: '#f472a6' }] });
  const duas = migrar(structuredClone(uma));
  assert.deepEqual(duas, uma);
});

test('a migração termina sempre na versão atual', () => {
  assert.equal(migrar({ versao: 1, habitos: [] }).versao, VERSAO);
});
