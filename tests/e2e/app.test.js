// Testes de ponta a ponta: o app de verdade, servido pelo servidor do projeto,
// aberto em um Chrome real (o que estiver instalado na máquina; não baixa navegador).
// Cada teste usa um contexto novo, com armazenamento vazio, e falha se a página
// registrar qualquer erro de console ou exceção que o teste não esperava.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { iniciarServidor } from '../../tools/serve.mjs';

const CHAVE = 'foco:v1';
const CHAVE_COPIA = 'foco:v1:copia';
const ESPERA = { timeout: 5000 };

let servidor;
let url;
let navegador;

before(async () => {
  const iniciado = await iniciarServidor(0);
  servidor = iniciado.servidor;
  url = iniciado.url;
  navegador = await chromium.launch({ channel: 'chrome' });
});

after(async () => {
  await navegador?.close();
  servidor?.close();
});

// Abre o app em um contexto isolado. "salvo" é o texto gravado no
// armazenamento antes de o app carregar (undefined = nada salvo).
async function abrir(t, { salvo, esquemaDeCor = 'dark' } = {}) {
  const contexto = await navegador.newContext({
    viewport: { width: 500, height: 1000 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: esquemaDeCor,
  });
  t.after(() => contexto.close());

  const erros = [];
  const novaPagina = async () => {
    const pagina = await contexto.newPage();
    pagina.on('pageerror', (erro) => erros.push(`exceção: ${erro.message}`));
    pagina.on('console', (mensagem) => {
      if (mensagem.type() === 'error') erros.push(`console: ${mensagem.text()}`);
    });
    return pagina;
  };

  if (salvo !== undefined) {
    // Grava o armazenamento antes de qualquer script do app, só na primeira
    // abertura da aba: o sessionStorage marca que já foi feito, então recarregar
    // a página não repõe o valor original.
    await contexto.addInitScript(
      ([chave, valor]) => {
        if (sessionStorage.getItem('teste:semeado')) return;
        sessionStorage.setItem('teste:semeado', '1');
        localStorage.setItem(chave, valor);
      },
      [CHAVE, salvo],
    );
  }

  const pagina = await novaPagina();
  await pagina.goto(url);
  return { pagina, erros, novaPagina };
}

const visivel = (alvo) => alvo.waitFor({ state: 'visible', ...ESPERA });
const botao = (pagina, nome) => pagina.getByRole('button', { name: nome, exact: true });
const tema = (pagina) => pagina.evaluate(() => document.documentElement.dataset.tema);
const lerSalvo = (pagina, chave) => pagina.evaluate((k) => localStorage.getItem(k), chave);

async function esperarTema(pagina, esperado) {
  await pagina.waitForFunction((valor) => document.documentElement.dataset.tema === valor, esperado, ESPERA);
}

// ------------------------------------------------------------------ abertura

test('abre sem erros, no tema escuro, com as três abas e nada salvo', async (t) => {
  const { pagina, erros } = await abrir(t);

  await visivel(pagina.getByText('Nenhuma rotina ainda'));
  assert.equal(await pagina.title(), 'Rotinas - Foco');
  assert.equal(await tema(pagina), 'escuro');
  for (const nome of ['Rotinas', 'Hábitos', 'Tarefas']) await visivel(botao(pagina, nome));

  // Abrir o app sem tocar em nada não grava nada.
  assert.equal(await lerSalvo(pagina, CHAVE), null);
  assert.deepEqual(erros, []);
});

// ------------------------------------------------------------------- rotinas

test('rotina: cria pelo texto, marca um item e mantém depois de recarregar', async (t) => {
  const { pagina, erros } = await abrir(t);

  await botao(pagina, 'Nova rotina').click();
  await pagina.getByLabel('Nome').fill('Manhã');
  await pagina.getByLabel('Itens').fill('# ACORDAR\n- [ ] 06:30 Levantar\nArrumar a cama');
  await botao(pagina, 'Salvar').click();

  await visivel(pagina.getByText('0 de 2 hoje'));
  await visivel(pagina.getByText('ACORDAR'));

  await pagina.getByRole('checkbox', { name: /Levantar/ }).click();
  await visivel(pagina.getByText('1 de 2 hoje'));

  await pagina.reload();
  await visivel(pagina.getByText('1 de 2 hoje'));
  assert.equal(await pagina.getByRole('checkbox', { name: /Levantar/ }).getAttribute('aria-checked'), 'true');
  assert.equal(await pagina.getByRole('checkbox', { name: /Arrumar/ }).getAttribute('aria-checked'), 'false');

  const salvo = JSON.parse(await lerSalvo(pagina, CHAVE));
  assert.equal(salvo.versao, 2);
  assert.deepEqual(
    salvo.rotinas[0].itens.map((i) => [i.tipo, i.hora, i.texto]),
    [
      ['secao', null, 'ACORDAR'],
      ['item', '06:30', 'Levantar'],
      ['item', null, 'Arrumar a cama'],
    ],
  );
  assert.deepEqual(erros, []);
});

test('rotina: sair da edição com texto alterado pede confirmação', async (t) => {
  const { pagina, erros } = await abrir(t);

  await botao(pagina, 'Nova rotina').click();
  await pagina.getByLabel('Itens').fill('texto que não foi salvo');
  await botao(pagina, 'Cancelar').click();
  await visivel(pagina.getByText('Descartar as alterações?'));

  await botao(pagina, 'Descartar').click();
  await visivel(pagina.getByText('Nenhuma rotina ainda'));
  assert.equal(await pagina.locator('dialog').count(), 0);
  assert.deepEqual(erros, []);
});

// ------------------------------------------------------------------- hábitos

test('hábito de sim ou não: o toque alterna feito, pulado e não feito', async (t) => {
  const { pagina, erros } = await abrir(t);

  await botao(pagina, 'Hábitos').click();
  await botao(pagina, 'Novo hábito').click();
  await pagina.getByLabel('Nome').fill('Leitura');
  await botao(pagina, 'Salvar').click();

  for (const [antes, depois] of [
    ['não feito', 'feito'],
    ['feito', 'pulado'],
    ['pulado', 'não feito'],
  ]) {
    await botao(pagina, `Leitura, hoje: ${antes}`).click();
    await visivel(botao(pagina, `Leitura, hoje: ${depois}`));
  }
  assert.deepEqual(erros, []);
});

test('hábito numérico: aceita milhar no costume brasileiro e recusa texto que não é número', async (t) => {
  const { pagina, erros } = await abrir(t);

  await botao(pagina, 'Hábitos').click();
  await botao(pagina, 'Novo hábito').click();
  await pagina.getByLabel('Nome').fill('Passos');
  await botao(pagina, 'Numérico').click();
  await pagina.getByLabel('Unidade').fill('passos');
  await pagina.getByLabel('Meta por dia').fill('10.000');
  await botao(pagina, 'Salvar').click();

  await botao(pagina, 'Passos, hoje: 0 passos').click();
  const quantidade = pagina.getByLabel(/Quantidade em passos, meta 10000 passos/);
  await quantidade.fill('2abc');
  await botao(pagina, 'Salvar').click();
  assert.equal(await pagina.locator('dialog[open]').count(), 1, 'valor inválido não fecha a folha');

  await quantidade.fill('12.500');
  await botao(pagina, 'Salvar').click();
  await visivel(botao(pagina, 'Passos, hoje: 12500 passos'));

  const salvo = JSON.parse(await lerSalvo(pagina, CHAVE));
  assert.equal(salvo.habitos[0].meta, 10000);
  assert.deepEqual(Object.values(salvo.registros[salvo.habitos[0].id]), [12500]);
  assert.deepEqual(erros, []);
});

// ------------------------------------------------------------------- tarefas

test('tarefa: cria com prazo de hoje, marca estrela, conclui e reabre', async (t) => {
  const { pagina, erros } = await abrir(t);

  await botao(pagina, 'Tarefas').click();
  await botao(pagina, 'Nova tarefa').click();
  await pagina.getByLabel('Título').fill('Estudar para a prova');
  await botao(pagina, 'Hoje').click();
  await botao(pagina, 'Salvar').click();

  await visivel(pagina.getByRole('heading', { name: 'Hoje', exact: true }));
  await visivel(pagina.getByText('1 pendente', { exact: true }));

  await botao(pagina, 'Estrela: Estudar para a prova').click();
  await botao(pagina, 'Com estrela').click();
  await visivel(pagina.getByText('Estudar para a prova'));
  await botao(pagina, 'Minhas tarefas').click();

  await pagina.getByRole('checkbox', { name: 'Concluir: Estudar para a prova' }).click();
  await visivel(pagina.getByText('0 pendentes', { exact: true }));
  await botao(pagina, 'Concluídas (1)').click();

  await pagina.getByRole('checkbox', { name: 'Reabrir: Estudar para a prova' }).click();
  await visivel(pagina.getByText('1 pendente', { exact: true }));
  assert.deepEqual(erros, []);
});

// ---------------------------------------------------------------------- tema

test('tema: começa escuro mesmo com o sistema em claro, e a escolha persiste', async (t) => {
  const { pagina, erros } = await abrir(t, { esquemaDeCor: 'light' });
  assert.equal(await tema(pagina), 'escuro');

  await botao(pagina, 'Ajustes').click();
  await pagina.getByRole('radio', { name: 'Claro' }).click();
  await esperarTema(pagina, 'claro');

  await pagina.reload();
  await visivel(botao(pagina, 'Rotinas'));
  assert.equal(await tema(pagina), 'claro');

  // "Sistema" acompanha a preferência do aparelho, inclusive quando ela muda.
  await botao(pagina, 'Ajustes').click();
  await pagina.getByRole('radio', { name: 'Sistema' }).click();
  await esperarTema(pagina, 'claro');
  await pagina.emulateMedia({ colorScheme: 'dark' });
  await esperarTema(pagina, 'escuro');
  assert.deepEqual(erros, []);
});

// ------------------------------------------------- dados salvos com problema

test('dados inválidos: o app abre, corrige e guarda uma cópia do original', async (t) => {
  const salvo = JSON.stringify({
    versao: 2,
    aba: 'tarefas',
    tarefas: null,
    listas: [],
    habitos: [{ id: 'h', nome: 'Leitura', cor: '#zzzzzz', tipo: 'simnao' }],
  });
  const { pagina, erros } = await abrir(t, { salvo });

  await visivel(pagina.getByText('Alguns dados salvos estavam inválidos e foram corrigidos.'));
  await visivel(botao(pagina, 'Minhas tarefas')); // a lista padrão foi recriada
  assert.equal(await lerSalvo(pagina, CHAVE_COPIA), salvo);

  await botao(pagina, 'Hábitos').click();
  await visivel(botao(pagina, 'Leitura, hoje: não feito'));
  assert.deepEqual(erros, []);
});

test('texto ilegível: o app começa do zero e guarda uma cópia', async (t) => {
  const { pagina, erros } = await abrir(t, { salvo: '{quebrado' });

  await visivel(pagina.getByText(/Os dados salvos estavam ilegíveis/));
  await visivel(pagina.getByText('Nenhuma rotina ainda'));
  assert.equal(await lerSalvo(pagina, CHAVE_COPIA), '{quebrado');
  assert.deepEqual(erros, []);
});

test('dados de uma versão mais nova: o app não abre e não grava nada', async (t) => {
  const salvo = JSON.stringify({ versao: 99, formatoFuturo: { tarefas: ['x'] } });
  const { pagina, erros } = await abrir(t, { salvo });

  await visivel(pagina.getByText('Atualize o app'));
  assert.equal(await pagina.locator('#fab').isVisible(), false);
  assert.equal(await pagina.locator('#abas').isVisible(), false);

  await botao(pagina, 'Ajustes').count(); // dá tempo de qualquer gravação indevida acontecer
  assert.equal(await lerSalvo(pagina, CHAVE), salvo);
  assert.equal(await lerSalvo(pagina, CHAVE_COPIA), null);
  assert.deepEqual(erros, []);
});

// ---------------------------------------------------------------- duas abas

test('duas abas: o que uma grava aparece na outra, sem sobrescrever', async (t) => {
  const { pagina: abaA, erros, novaPagina } = await abrir(t);
  const abaB = await novaPagina();
  await abaB.goto(url);
  await visivel(abaB.getByText('Nenhuma rotina ainda'));

  // Aba A cria um hábito.
  await botao(abaA, 'Hábitos').click();
  await botao(abaA, 'Novo hábito').click();
  await abaA.getByLabel('Nome').fill('Leitura');
  await botao(abaA, 'Salvar').click();
  await visivel(botao(abaA, 'Leitura, hoje: não feito'));

  // Aba B recarrega sozinha e passa a ver o hábito; então cria uma tarefa.
  await visivel(botao(abaB, 'Leitura, hoje: não feito'));
  await botao(abaB, 'Tarefas').click();
  await botao(abaB, 'Nova tarefa').click();
  await abaB.getByLabel('Título').fill('Tarefa da aba B');
  await botao(abaB, 'Salvar').click();
  await visivel(abaB.getByText('Tarefa da aba B'));

  // O hábito criado na aba A continua salvo depois da gravação da aba B.
  const salvo = JSON.parse(await lerSalvo(abaB, CHAVE));
  assert.deepEqual(
    salvo.habitos.map((h) => h.nome),
    ['Leitura'],
  );
  assert.deepEqual(
    salvo.tarefas.map((x) => x.titulo),
    ['Tarefa da aba B'],
  );
  assert.deepEqual(erros, []);
});

// --------------------------------------------------------------- botão voltar

test('voltar fecha a folha aberta em vez de sair do app', async (t) => {
  const { pagina, erros } = await abrir(t);
  const folhas = () => pagina.locator('dialog[open]').count();

  await botao(pagina, 'Hábitos').click();
  await botao(pagina, 'Novo hábito').click();
  await visivel(pagina.getByText('Novo hábito', { exact: true }));
  await pagina.goBack();
  await pagina.waitForFunction(() => document.querySelectorAll('dialog').length === 0, null, ESPERA);

  // O app continua aberto, na mesma aba, e a folha abre de novo normalmente.
  await visivel(pagina.getByText('Nenhum hábito ainda'));
  await botao(pagina, 'Novo hábito').click();
  await pagina.getByLabel('Nome').fill('Leitura');
  await botao(pagina, 'Salvar').click();
  await visivel(botao(pagina, 'Leitura, hoje: não feito'));
  assert.equal(await folhas(), 0);
  assert.deepEqual(erros, []);
});

test('voltar com texto não salvo na rotina pergunta antes de descartar', async (t) => {
  const { pagina, erros } = await abrir(t);
  const folhas = () => pagina.locator('dialog[open]').count();

  await botao(pagina, 'Nova rotina').click();
  await pagina.getByLabel('Itens').fill('texto que não foi salvo');

  // Primeiro voltar: a edição continua aberta e aparece a pergunta.
  await pagina.goBack();
  await visivel(pagina.getByText('Descartar as alterações?'));
  assert.equal(await folhas(), 2);

  // Segundo voltar: fecha só a pergunta; o texto continua lá.
  await pagina.goBack();
  await pagina.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 1, null, ESPERA);
  assert.equal(await pagina.getByLabel('Itens').inputValue(), 'texto que não foi salvo');

  // Terceiro voltar pergunta de novo; desta vez descarta.
  await pagina.goBack();
  await botao(pagina, 'Descartar').click();
  await pagina.waitForFunction(() => document.querySelectorAll('dialog').length === 0, null, ESPERA);
  await visivel(pagina.getByText('Nenhuma rotina ainda'));

  // A conta do histórico fechou: um voltar a mais não reabre nem quebra nada.
  await botao(pagina, 'Nova rotina').click();
  await pagina.goBack();
  await pagina.waitForFunction(() => document.querySelectorAll('dialog').length === 0, null, ESPERA);
  assert.deepEqual(erros, []);
});

// --------------------------------------------------------- barras do sistema

test('barras do sistema: o topo e a barra de abas respeitam a área segura', async (t) => {
  const { pagina, erros } = await abrir(t);
  await visivel(pagina.getByText('Nenhuma rotina ainda'));

  const medir = () =>
    pagina.evaluate(() => ({
      alturaDoTopo: document.querySelector('.topo').getBoundingClientRect().height,
      inicioDoTitulo: document.getElementById('titulo').getBoundingClientRect().top,
      alturaDasAbas: document.getElementById('abas').getBoundingClientRect().height,
    }));

  // No navegador de mesa não há barra do sistema sobre a página.
  const antes = await medir();

  // No Android a página vai de borda a borda e o Capacitor informa o espaço das
  // barras nestas variáveis. Simula 40 px de barra de status e 24 px de navegação.
  await pagina.evaluate(() => {
    document.documentElement.style.setProperty('--safe-area-inset-top', '40px');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', '24px');
  });
  const depois = await medir();

  assert.equal(depois.alturaDoTopo, antes.alturaDoTopo + 40);
  assert.ok(depois.inicioDoTitulo >= 40, `o título começa em ${depois.inicioDoTitulo}, sob a barra`);
  assert.equal(depois.alturaDasAbas, antes.alturaDasAbas + 24);
  assert.deepEqual(erros, []);
});

// ----------------------------------------------------------------- segurança

test('política de segurança: HTML em texto e conexão de rede são bloqueados', async (t) => {
  const { pagina, erros } = await abrir(t);
  await visivel(pagina.getByText('Nenhuma rotina ainda'));

  const resultado = await pagina.evaluate(async () => {
    const tentativa = {};
    try {
      document.createElement('div').innerHTML = '<img src=x onerror=alert(1)>';
      tentativa.html = 'aceitou';
    } catch (erro) {
      tentativa.html = erro.name;
    }
    try {
      await fetch('https://example.invalid/coleta');
      tentativa.rede = 'aceitou';
    } catch (erro) {
      tentativa.rede = erro.name;
    }
    return tentativa;
  });

  assert.deepEqual(resultado, { html: 'TypeError', rede: 'TypeError' });
  // As duas tentativas precisam aparecer como violação da política, e nada além delas.
  assert.equal(erros.length >= 2, true, `esperava as violações no console, veio: ${erros.join(' | ')}`);
  assert.ok(
    erros.some((e) => /TrustedHTML|Trusted Type/i.test(e)),
    erros.join(' | '),
  );
  assert.ok(
    erros.some((e) => /Content Security Policy/i.test(e)),
    erros.join(' | '),
  );
});
