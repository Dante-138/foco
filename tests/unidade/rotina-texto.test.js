import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoParaItens, itensParaTexto } from '../../www/js/nucleo/rotina-texto.js';
import { LIMITES } from '../../www/js/nucleo/esquema.js';

// Gerador de ids previsível: n1, n2, n3...
function contador() {
  let n = 0;
  return () => {
    n += 1;
    return `n${n}`;
  };
}

const ler = (texto, antigos = []) => textoParaItens(texto, antigos, contador());
const semId = (itens) => itens.map(({ tipo, texto, hora }) => ({ tipo, texto, hora }));
const textos = (entrada) => ler(entrada).map((i) => i.texto);

test('linhas viram itens, "#" abre seção e linhas em branco são ignoradas', () => {
  const itens = ler('# MANHÃ\n\nAcordar\n   \nArrumar a cama');
  assert.deepEqual(semId(itens), [
    { tipo: 'secao', texto: 'MANHÃ', hora: null },
    { tipo: 'item', texto: 'Acordar', hora: null },
    { tipo: 'item', texto: 'Arrumar a cama', hora: null },
  ]);
});

test('sem gerador informado, os ids vêm do gerador padrão e são únicos', () => {
  const itens = textoParaItens('Um\nDois\nTrês');
  assert.equal(new Set(itens.map((i) => i.id)).size, 3);
});

test('horário no começo da linha vira o campo hora, com zero à esquerda', () => {
  assert.deepEqual(semId(ler('22:30 Chegar em casa\n9:05 Bater o ponto')), [
    { tipo: 'item', texto: 'Chegar em casa', hora: '22:30' },
    { tipo: 'item', texto: 'Bater o ponto', hora: '09:05' },
  ]);
});

test('hífen entre o horário e o texto é descartado', () => {
  assert.deepEqual(semId(ler('22:31 - Guardar a chave')), [
    { tipo: 'item', texto: 'Guardar a chave', hora: '22:31' },
  ]);
});

test('horário impossível fica como texto comum', () => {
  assert.deepEqual(semId(ler('25:00 Dormir\n10:75 Almoçar')), [
    { tipo: 'item', texto: '25:00 Dormir', hora: null },
    { tipo: 'item', texto: '10:75 Almoçar', hora: null },
  ]);
});

test('horário sem texto depois não vira item vazio', () => {
  assert.deepEqual(semId(ler('22:30\n22:31 -')), [
    { tipo: 'item', texto: '22:30', hora: null },
    { tipo: 'item', texto: '22:31 -', hora: null },
  ]);
});

test('marcadores de checklist colado de outro app são removidos', () => {
  const itens = ler('[ ] Leitura\n[x] 22:00 Sair\n- Banho\n• Jantar\n☐ Dormir\n[] Estudar\n* Treinar');
  assert.deepEqual(
    itens.map((i) => [i.hora, i.texto]),
    [
      [null, 'Leitura'],
      ['22:00', 'Sair'],
      [null, 'Banho'],
      [null, 'Jantar'],
      [null, 'Dormir'],
      [null, 'Estudar'],
      [null, 'Treinar'],
    ],
  );
});

test('lista de tarefas em Markdown ("- [ ] item") perde o hífen e a caixa', () => {
  assert.deepEqual(semId(ler('- [ ] 22:30 Chegar em casa\n- [x] Leitura\n* [ ] Banho')), [
    { tipo: 'item', texto: 'Chegar em casa', hora: '22:30' },
    { tipo: 'item', texto: 'Leitura', hora: null },
    { tipo: 'item', texto: 'Banho', hora: null },
  ]);
});

test('hífen ou asterisco sem espaço depois faz parte do texto', () => {
  assert.deepEqual(textos('-5 graus lá fora\n*importante*'), ['-5 graus lá fora', '*importante*']);
});

test('linha só com marcadores é ignorada', () => {
  assert.deepEqual(textos('- \n[ ]\n- [ ] \nItem'), ['Item']);
});

test('quebra de linha do Windows (CRLF) é aceita', () => {
  assert.equal(ler('Um\r\nDois\r\n').length, 2);
});

test('"#" sozinho não cria seção sem nome', () => {
  assert.deepEqual(textos('#\n##   \nItem'), ['Item']);
});

test('texto de item e de seção é cortado no limite', () => {
  const longo = 'a'.repeat(LIMITES.textoItem + 50);
  const itens = ler(`${longo}\n# ${longo}\n10:00 ${longo}`);
  assert.deepEqual(
    itens.map((i) => i.texto.length),
    [LIMITES.textoItem, LIMITES.textoItem, LIMITES.textoItem],
  );
});

test('linhas além do limite de itens da rotina são descartadas', () => {
  const texto = Array.from({ length: LIMITES.itensPorRotina + 30 }, (_, n) => `Item ${n}`).join('\n');
  assert.equal(ler(texto).length, LIMITES.itensPorRotina);
});

test('editar preserva o id de quem manteve o texto, mesmo mudando o horário', () => {
  const antes = ler('# NOITE\n22:00 Sair\n22:30 Chegar');
  const depois = textoParaItens('# NOITE\n22:05 Sair\nItem novo\n22:30 Chegar', antes, () => 'novo');
  assert.deepEqual(
    depois.map((i) => i.id),
    [antes[0].id, antes[1].id, 'novo', antes[2].id],
  );
  assert.equal(depois[1].hora, '22:05');
});

test('editar preserva a ligação com o hábito de quem manteve o texto; item novo nasce sem ligação', () => {
  const antigos = [
    { id: 'a', tipo: 'item', texto: 'Arrumar a cama', hora: '06:35', habitoId: 'cama' },
    { id: 'b', tipo: 'item', texto: 'Beber água', hora: null, habitoId: null },
  ];
  const itens = textoParaItens('07:00 Arrumar a cama\nBeber água\nItem novo', antigos, contador());
  assert.deepEqual(
    itens.map((i) => [i.id, i.hora, i.habitoId]),
    [
      ['a', '07:00', 'cama'],
      ['b', null, null],
      ['n1', null, null],
    ],
  );

  // Mudar o texto faz um item novo: a ligação não acompanha.
  const renomeado = textoParaItens('Fazer a cama', antigos, contador());
  assert.deepEqual([renomeado[0].id, renomeado[0].habitoId], ['n1', null]);
});

test('itens com o mesmo texto recebem ids diferentes e são reaproveitados em ordem', () => {
  const antes = ler('Escovar os dentes\nAlmoço\nEscovar os dentes');
  assert.notEqual(antes[0].id, antes[2].id);

  const depois = textoParaItens(
    'Escovar os dentes\nEscovar os dentes\nEscovar os dentes',
    antes,
    () => 'novo',
  );
  assert.deepEqual(
    depois.map((i) => i.id),
    [antes[0].id, antes[2].id, 'novo'],
  );
});

test('seção e item com o mesmo texto não trocam de id entre si', () => {
  const antes = ler('# Estudo\nEstudo');
  const depois = textoParaItens('Estudo\n# Estudo', antes, () => 'novo');
  assert.deepEqual(
    depois.map((i) => i.id),
    [antes[1].id, antes[0].id],
  );
});

test('itensParaTexto separa as seções com linha em branco', () => {
  const texto = '# MANHÃ\n06:30 Acordar\nArrumar a cama\n\n# TRABALHO\n09:00 Bater o ponto';
  assert.equal(itensParaTexto(ler(texto)), texto);
});

test('texto -> itens -> texto -> itens mantém o conteúdo', () => {
  const itens = ler('- [ ] 7:00 Café\n# TARDE\n- Estudar\n25:00 Hora inválida\n-5 graus');
  assert.deepEqual(semId(ler(itensParaTexto(itens))), semId(itens));
});
