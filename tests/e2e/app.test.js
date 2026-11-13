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
// armazenamento antes de o app carregar (undefined = nada salvo). "toque" liga a
// tela de toque no navegador, para os testes de gesto.
async function abrir(t, { salvo, esquemaDeCor = 'dark', toque = false } = {}) {
  const contexto = await navegador.newContext({
    viewport: { width: 500, height: 1000 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: esquemaDeCor,
    hasTouch: toque,
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

// Volta uma entrada do histórico, depois de conferir que a guarda da folha aberta existe.
async function voltar(pagina) {
  await pagina.waitForFunction(() => window.history.state?.folha === true, null, ESPERA);
  await pagina.goBack();
}

async function esperarTema(pagina, esperado) {
  await pagina.waitForFunction((valor) => document.documentElement.dataset.tema === valor, esperado, ESPERA);
}

async function esperarTitulo(pagina, esperado) {
  await pagina.waitForFunction((valor) => document.title === valor, esperado, ESPERA);
}

// Um dedo de verdade na tela (pela interface de depuração do Chrome), de um ponto a outro.
// Precisa do contexto aberto com toque: true.
async function deslizar(pagina, de, para) {
  const cdp = await pagina.context().newCDPSession(pagina);
  const dedo = ([x, y]) => [{ x, y }];
  const meio = [(de[0] + para[0]) / 2, (de[1] + para[1]) / 2];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: dedo(de) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: dedo(meio) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: dedo(para) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
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
  assert.equal(salvo.versao, 3);
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

test('hábito: cumprir destaca a célula e o anel; as outras marcas só dão o pulo curto', async (t) => {
  const { pagina, erros } = await abrir(t);
  const classes = (alvo) => alvo.evaluate((el) => [...el.classList]);

  await botao(pagina, 'Hábitos').click();
  await botao(pagina, 'Novo hábito').click();
  await pagina.getByLabel('Nome').fill('Leitura');
  await botao(pagina, 'Salvar').click();

  await botao(pagina, 'Leitura, hoje: não feito').click();
  const feita = botao(pagina, 'Leitura, hoje: feito');
  await visivel(feita);
  assert.ok((await classes(feita)).includes('concluiu'));
  assert.equal(await pagina.locator('.anel.pulsa').count(), 1);

  await feita.click();
  const pulada = botao(pagina, 'Leitura, hoje: pulado');
  await visivel(pulada);
  assert.ok((await classes(pulada)).includes('marcou'));
  assert.ok(!(await classes(pulada)).includes('concluiu'));
  assert.equal(await pagina.locator('.anel.pulsa').count(), 0);

  // Um redesenho que não veio de um toque (aqui, a largura da tela mudou) não repete a animação.
  await pagina.setViewportSize({ width: 640, height: 1000 });
  await pagina.waitForFunction(() => !document.querySelector('.cel.marcou, .cel.concluiu'), null, ESPERA);
  await visivel(pulada);
  assert.deepEqual(erros, []);
});

test('hábitos: ocultar concluídos esconde o que já foi resolvido hoje, e o filtro traz de volta', async (t) => {
  const habito = (id, nome) => ({
    id,
    nome,
    cor: 'azul',
    tipo: 'simnao',
    unidade: null,
    meta: null,
    arquivado: false,
  });
  const salvo = JSON.stringify({
    versao: 3,
    aba: 'habitos',
    habitos: [habito('a', 'Leitura'), habito('b', 'Água')],
  });
  const { pagina, erros } = await abrir(t, { salvo });
  const filtro = pagina.locator('.filtro');
  const sumiu = (nome) =>
    pagina.waitForFunction((n) => !document.querySelector(`[aria-label^="${n}, hoje"]`), nome, ESPERA);

  await filtro.click();
  await pagina.getByRole('switch', { name: 'Ocultar concluídos' }).click();
  assert.equal(JSON.parse(await lerSalvo(pagina, CHAVE)).ocultarConcluidos, true);

  // Marcado como feito, o hábito ainda mostra a resposta ao toque e só depois sai da grade.
  await botao(pagina, 'Leitura, hoje: não feito').click();
  await visivel(botao(pagina, 'Leitura, hoje: feito'));
  await sumiu('Leitura');
  await visivel(botao(pagina, 'Água, hoje: não feito'));
  assert.equal(await filtro.textContent(), 'Filtro: 1 oculto');

  // Com todos resolvidos, a grade avisa e o filtro continua ao alcance.
  await botao(pagina, 'Água, hoje: não feito').click();
  await sumiu('Água');
  await visivel(pagina.getByText('Tudo feito por hoje'));
  assert.equal(await filtro.textContent(), 'Filtro: 2 ocultos');

  // Desligar o filtro traz os dois de volta, e a escolha fica salva.
  await filtro.click();
  const interruptor = pagina.getByRole('switch', { name: 'Ocultar concluídos' });
  assert.equal(await interruptor.getAttribute('aria-checked'), 'true');
  await interruptor.click();
  await visivel(botao(pagina, 'Leitura, hoje: feito'));
  await visivel(botao(pagina, 'Água, hoje: feito'));
  assert.equal(await filtro.textContent(), 'Filtro');
  assert.equal(JSON.parse(await lerSalvo(pagina, CHAVE)).ocultarConcluidos, false);
  assert.deepEqual(erros, []);
});

test('hábitos: arquivar tira da grade sem apagar; o filtro mostra e dá para desarquivar', async (t) => {
  const { pagina, erros } = await abrir(t);

  await botao(pagina, 'Hábitos').click();
  await botao(pagina, 'Novo hábito').click();
  await pagina.getByLabel('Nome').fill('Leitura');
  await botao(pagina, 'Salvar').click();
  await botao(pagina, 'Leitura, hoje: não feito').click();
  await visivel(botao(pagina, 'Leitura, hoje: feito'));

  await botao(pagina, 'Editar Leitura').click();
  await botao(pagina, 'Arquivar').click();
  await visivel(pagina.getByText('Nenhum hábito ativo'));
  await visivel(pagina.getByText(/Hábito arquivado/));
  const salvo = JSON.parse(await lerSalvo(pagina, CHAVE));
  assert.equal(salvo.habitos[0].arquivado, true);
  assert.deepEqual(Object.values(salvo.registros[salvo.habitos[0].id]), ['feito']); // o histórico fica

  await pagina.locator('.filtro').click();
  await pagina.getByRole('switch', { name: 'Ocultar arquivados' }).click();
  await visivel(pagina.locator('.habito.arquivado'));
  await visivel(pagina.getByText('arquivado', { exact: true }));

  await botao(pagina, 'Editar Leitura').click();
  await botao(pagina, 'Desarquivar').click();
  await visivel(botao(pagina, 'Leitura, hoje: feito'));
  assert.equal(await pagina.locator('.habito.arquivado').count(), 0);
  assert.equal(JSON.parse(await lerSalvo(pagina, CHAVE)).habitos[0].arquivado, false);
  assert.deepEqual(erros, []);
});

// ------------------------------------------------------------------- tarefas

test('tarefas: ordenar por data, estrela, título e criação; a escolha vale para todas as listas', async (t) => {
  const tarefa = (id, titulo, extra) => ({
    id,
    listaId: 'l',
    titulo,
    notas: '',
    prazo: null,
    estrela: false,
    feita: false,
    feitaEm: null,
    ...extra,
  });
  const salvo = JSON.stringify({
    versao: 3,
    aba: 'tarefas',
    listas: [
      { id: 'l', nome: 'Faculdade' },
      { id: 'outra', nome: 'Outra' },
    ],
    listaAtiva: 'l',
    tarefas: [
      tarefa('1', 'Zebra', { criadaEm: 1, prazo: '2030-01-10' }),
      tarefa('2', 'abacaxi', { criadaEm: 2, estrela: true }),
      tarefa('3', 'Maçã', { criadaEm: 3, prazo: '2030-01-05' }),
    ],
  });
  const { pagina, erros } = await abrir(t, { salvo });
  const titulos = () => pagina.locator('.tarefa-titulo').allTextContents();
  const ordenarPor = async (rotulo) => {
    await botao(pagina, 'Opções da lista').click();
    await pagina.getByRole('button', { name: /^Ordenar por:/ }).click();
    await botao(pagina, rotulo).click();
    await pagina.waitForFunction(() => !document.querySelector('dialog'), null, ESPERA);
  };

  // Padrão: por data, em grupos, com as sem data no fim.
  await visivel(pagina.getByRole('heading', { name: 'Sem data' }));
  assert.deepEqual(await titulos(), ['Maçã', 'Zebra', 'abacaxi']);

  await ordenarPor('Título');
  assert.deepEqual(await titulos(), ['abacaxi', 'Maçã', 'Zebra']);
  assert.equal(await pagina.getByRole('heading', { name: 'Sem data' }).count(), 0); // lista única, sem grupos
  await visivel(pagina.getByText(/5 de jan\. de 2030/)); // sem o grupo, a data vai na linha

  await ordenarPor('Com estrela primeiro');
  assert.deepEqual(await titulos(), ['abacaxi', 'Maçã', 'Zebra']);
  await ordenarPor('Mais recentes primeiro');
  assert.deepEqual(await titulos(), ['Maçã', 'abacaxi', 'Zebra']);

  // A opção escolhida aparece marcada no menu e fica salva.
  await botao(pagina, 'Opções da lista').click();
  await visivel(botao(pagina, 'Ordenar por: Mais recentes primeiro'));
  await botao(pagina, 'Ordenar por: Mais recentes primeiro').click();
  assert.equal(await botao(pagina, 'Mais recentes primeiro').getAttribute('aria-current'), 'true');
  assert.equal(await botao(pagina, 'Data').getAttribute('aria-current'), null);
  await botao(pagina, 'Data').click();
  await visivel(pagina.getByRole('heading', { name: 'Sem data' }));
  assert.equal(JSON.parse(await lerSalvo(pagina, CHAVE)).ordemTarefas, 'data');

  // A visão "com estrela" tem o mesmo menu de ordem.
  await botao(pagina, 'Com estrela').click();
  await botao(pagina, 'Ordenar por').click();
  await visivel(botao(pagina, 'Título'));
  assert.deepEqual(erros, []);
});

test('tarefas: lista só com concluídas mostra a mensagem no alto, com folga até as concluídas', async (t) => {
  const salvo = JSON.stringify({
    versao: 2,
    aba: 'tarefas',
    listas: [
      { id: 'feitas', nome: 'Feitas' },
      { id: 'vazia', nome: 'Vazia' },
    ],
    listaAtiva: 'feitas',
    tarefas: [
      {
        id: 't1',
        listaId: 'feitas',
        titulo: 'Pagar o boleto',
        notas: '',
        prazo: null,
        estrela: false,
        feita: true,
        criadaEm: 1,
        feitaEm: 2,
      },
    ],
  });
  const { pagina, erros } = await abrir(t, { salvo });

  await visivel(pagina.getByText('Tudo concluído'));
  await visivel(botao(pagina, 'Concluídas (1)'));
  const medidas = await pagina.evaluate(() => {
    const dica = document.querySelector('.sem-conteudo.compacto p:last-child').getBoundingClientRect();
    const concluidas = document.querySelector('.concluidas-topo').getBoundingClientRect();
    return { folga: concluidas.top - dica.bottom, topoDaDica: dica.top, alturaDaTela: window.innerHeight };
  });
  assert.ok(medidas.folga >= 24, `folga de ${medidas.folga}px entre a mensagem e as concluídas`);
  assert.ok(medidas.topoDaDica < medidas.alturaDaTela * 0.4, 'a mensagem não vai para o meio da tela');

  // Lista sem nenhuma tarefa: não há nada abaixo, então a mensagem continua no meio da tela.
  await botao(pagina, 'Vazia').click();
  await visivel(pagina.getByText('Nenhuma tarefa aqui'));
  assert.equal(await pagina.locator('.sem-conteudo.compacto').count(), 0);
  assert.deepEqual(erros, []);
});

test('tarefas: excluir concluídas apaga só as concluídas da lista, depois de confirmar', async (t) => {
  const tarefa = (id, listaId, titulo, feita) => ({
    id,
    listaId,
    titulo,
    notas: '',
    prazo: null,
    estrela: false,
    feita,
    criadaEm: 1,
    feitaEm: feita ? 2 : null,
  });
  const salvo = JSON.stringify({
    versao: 3,
    aba: 'tarefas',
    listas: [
      { id: 'a', nome: 'Faculdade' },
      { id: 'b', nome: 'Pessoal' },
    ],
    listaAtiva: 'a',
    tarefas: [
      tarefa('1', 'a', 'Pendente da faculdade', false),
      tarefa('2', 'a', 'Feita da faculdade', true),
      tarefa('3', 'a', 'Outra feita da faculdade', true),
      tarefa('4', 'b', 'Feita pessoal', true),
    ],
  });
  const { pagina, erros } = await abrir(t, { salvo });
  const titulosSalvos = async () => JSON.parse(await lerSalvo(pagina, CHAVE)).tarefas.map((x) => x.titulo);

  // Cancelar não apaga nada.
  await botao(pagina, 'Opções da lista').click();
  await botao(pagina, 'Excluir concluídas').click();
  await visivel(pagina.getByText('Excluir as 2 tarefas concluídas da lista "Faculdade"?'));
  await botao(pagina, 'Cancelar').click();
  await visivel(botao(pagina, 'Concluídas (2)'));

  await botao(pagina, 'Opções da lista').click();
  await botao(pagina, 'Excluir concluídas').click();
  await botao(pagina, 'Excluir').click();
  await pagina.waitForFunction(() => !document.querySelector('.concluidas-topo'), null, ESPERA);
  assert.deepEqual(await titulosSalvos(), ['Pendente da faculdade', 'Feita pessoal']);

  // Sem concluídas na lista, a opção fica desativada.
  await botao(pagina, 'Opções da lista').click();
  assert.equal(await botao(pagina, 'Excluir concluídas').isDisabled(), true);
  assert.deepEqual(erros, []);
});

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

test('tarefa: ao concluir, a linha mostra a marca e o risco antes de sair da lista', async (t) => {
  const { pagina, erros } = await abrir(t);

  await botao(pagina, 'Tarefas').click();
  await botao(pagina, 'Nova tarefa').click();
  await pagina.getByLabel('Título').fill('Pagar o boleto');
  await botao(pagina, 'Salvar').click();
  await visivel(pagina.getByText('1 pendente', { exact: true }));

  // O toque e a leitura acontecem no mesmo passo, para ver a tela logo depois do toque.
  const logoDepois = await pagina.evaluate((chave) => {
    const check = document.querySelector('.tarefa-check');
    check.click();
    const linha = check.closest('.tarefa');
    return {
      naTela: linha.isConnected,
      classes: [...linha.classList],
      marcado: check.getAttribute('aria-checked'),
      salvaComoFeita: JSON.parse(localStorage.getItem(chave)).tarefas[0].feita,
    };
  }, CHAVE);
  assert.deepEqual(logoDepois, {
    naTela: true,
    classes: ['tarefa', 'concluindo'],
    marcado: 'true',
    salvaComoFeita: true,
  });

  // Depois da animação a lista é redesenhada e a tarefa passa para as concluídas.
  await visivel(pagina.getByText('0 pendentes', { exact: true }));
  await visivel(botao(pagina, 'Concluídas (1)'));
  assert.equal(await pagina.locator('.tarefa.concluindo').count(), 0);
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

// --------------------------------------------------------------------- backup

test('backup: os dados copiados em um aparelho são restaurados em outro', async (t) => {
  // Aparelho de origem: um hábito, e a cópia dos dados para a área de transferência.
  const origem = await abrir(t);
  await origem.pagina.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: url });
  await botao(origem.pagina, 'Hábitos').click();
  await botao(origem.pagina, 'Novo hábito').click();
  await origem.pagina.getByLabel('Nome').fill('Leitura');
  await botao(origem.pagina, 'Salvar').click();
  await botao(origem.pagina, 'Leitura, hoje: não feito').click();
  await visivel(botao(origem.pagina, 'Leitura, hoje: feito'));

  await botao(origem.pagina, 'Ajustes').click();
  await botao(origem.pagina, 'Copiar dados').click();
  await visivel(origem.pagina.getByText('Dados copiados: 0 rotinas, 1 hábito, 0 tarefas.'));
  const copiado = await origem.pagina.evaluate(() => navigator.clipboard.readText());
  assert.equal(JSON.parse(copiado).habitos[0].nome, 'Leitura');

  // Aparelho de destino: vazio, restaura colando o texto.
  const destino = await abrir(t);
  await botao(destino.pagina, 'Ajustes').click();
  await botao(destino.pagina, 'Colar para restaurar').click();
  await destino.pagina.getByLabel('Texto do backup').fill(copiado);
  await botao(destino.pagina, 'Conferir').click();
  await visivel(
    destino.pagina.getByText('Substituir os dados deste aparelho por 0 rotinas, 1 hábito, 0 tarefas?'),
  );
  await botao(destino.pagina, 'Substituir').click();

  await visivel(destino.pagina.getByText('Dados restaurados.'));
  await visivel(botao(destino.pagina, 'Leitura, hoje: feito')); // abriu na aba que estava no backup
  assert.equal(await destino.pagina.locator('dialog').count(), 0);

  await destino.pagina.reload();
  await visivel(botao(destino.pagina, 'Leitura, hoje: feito'));
  assert.deepEqual([...origem.erros, ...destino.erros], []);
});

test('restaurar recusa texto que não é backup e não mexe nos dados', async (t) => {
  const { pagina, erros } = await abrir(t);
  await botao(pagina, 'Hábitos').click();
  await botao(pagina, 'Novo hábito').click();
  await pagina.getByLabel('Nome').fill('Leitura');
  await botao(pagina, 'Salvar').click();
  const antes = await lerSalvo(pagina, CHAVE);

  await botao(pagina, 'Ajustes').click();
  await botao(pagina, 'Colar para restaurar').click();
  const campoDeTexto = pagina.getByLabel('Texto do backup');

  for (const [texto, recusa] of [
    ['', 'Cole o texto do backup no campo acima.'],
    ['isto não é json', 'Não consegui ler este texto. Confira se ele foi copiado inteiro.'],
    ['{}', 'Este texto não tem dados do Foco (rotinas, hábitos ou tarefas).'],
    ['{"versao":99,"habitos":[]}', /versão mais nova do app/],
  ]) {
    await campoDeTexto.fill(texto);
    await botao(pagina, 'Conferir').click();
    await visivel(pagina.getByRole('alert').filter({ hasText: recusa }));
  }

  // Backup válido, mas a pessoa desiste na confirmação: nada muda.
  await campoDeTexto.fill('{"habitos":[{"id":"x","nome":"Outro","cor":"rosa","tipo":"simnao"}]}');
  await botao(pagina, 'Conferir').click();
  await visivel(pagina.getByText(/Substituir os dados deste aparelho por/));
  await pagina.locator('dialog[open]').last().getByRole('button', { name: 'Cancelar', exact: true }).click();

  assert.equal(await lerSalvo(pagina, CHAVE), antes);
  assert.equal(await lerSalvo(pagina, CHAVE_COPIA), null);
  assert.deepEqual(erros, []);
});

test('restaurar guarda os dados anteriores na cópia de segurança', async (t) => {
  const { pagina, erros } = await abrir(t);
  await botao(pagina, 'Hábitos').click();
  await botao(pagina, 'Novo hábito').click();
  await pagina.getByLabel('Nome').fill('Vai ser substituído');
  await botao(pagina, 'Salvar').click();
  const antes = await lerSalvo(pagina, CHAVE);

  await botao(pagina, 'Ajustes').click();
  await botao(pagina, 'Colar para restaurar').click();
  await pagina
    .getByLabel('Texto do backup')
    .fill('{"aba":"habitos","habitos":[{"id":"x","nome":"Novo","cor":"rosa","tipo":"simnao"}]}');
  await botao(pagina, 'Conferir').click();
  await botao(pagina, 'Substituir').click();

  await visivel(botao(pagina, 'Novo, hoje: não feito'));
  assert.equal(await lerSalvo(pagina, CHAVE_COPIA), antes);
  assert.deepEqual(erros, []);
});

// --------------------------------------------------------------- botão voltar

test('voltar fecha a folha aberta em vez de sair do app', async (t) => {
  const { pagina, erros } = await abrir(t);
  const folhas = () => pagina.locator('dialog[open]').count();

  await botao(pagina, 'Hábitos').click();
  await botao(pagina, 'Novo hábito').click();
  await visivel(pagina.getByText('Novo hábito', { exact: true }));
  await voltar(pagina);
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
  await voltar(pagina);
  await visivel(pagina.getByText('Descartar as alterações?'));
  assert.equal(await folhas(), 2);

  // Segundo voltar: fecha só a pergunta; o texto continua lá.
  await voltar(pagina);
  await pagina.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 1, null, ESPERA);
  assert.equal(await pagina.getByLabel('Itens').inputValue(), 'texto que não foi salvo');

  // Terceiro voltar pergunta de novo; desta vez descarta.
  await voltar(pagina);
  await botao(pagina, 'Descartar').click();
  await pagina.waitForFunction(() => document.querySelectorAll('dialog').length === 0, null, ESPERA);
  await visivel(pagina.getByText('Nenhuma rotina ainda'));

  // A conta do histórico fechou: um voltar a mais não reabre nem quebra nada.
  await botao(pagina, 'Nova rotina').click();
  await voltar(pagina);
  await pagina.waitForFunction(() => document.querySelectorAll('dialog').length === 0, null, ESPERA);
  assert.deepEqual(erros, []);
});

test('fechar uma folha e abrir outra em seguida não tira o app do lugar', async (t) => {
  // Regressão: o menu fecha e a edição abre no mesmo instante. Com o histórico
  // desalinhado, o fechamento seguinte voltava uma página a mais e saía do app.
  const { pagina, erros } = await abrir(t);
  const noApp = () =>
    pagina.evaluate(() => location.pathname === '/' && Boolean(document.getElementById('abas')));

  await botao(pagina, 'Nova rotina').click();
  await pagina.getByLabel('Nome').fill('Manhã');
  await pagina.getByLabel('Itens').fill('Acordar');
  await botao(pagina, 'Salvar').click();

  for (let volta = 0; volta < 3; volta += 1) {
    await botao(pagina, 'Opções da rotina').click();
    await botao(pagina, 'Editar rotina').click(); // fecha o menu e abre a edição
    await visivel(pagina.getByText('Editar rotina', { exact: true }));
    await botao(pagina, 'Salvar').click();
    await pagina.waitForFunction(() => document.querySelectorAll('dialog').length === 0, null, ESPERA);
  }
  await pagina.waitForTimeout(200); // dá tempo de qualquer volta indevida acontecer
  assert.equal(await noApp(), true);
  await visivel(pagina.getByText('0 de 1 hoje'));

  // Com tudo fechado não sobra entrada de guarda: o voltar seguinte fecha uma folha nova, e só ela.
  await botao(pagina, 'Opções da rotina').click();
  await visivel(botao(pagina, 'Editar rotina'));
  await voltar(pagina);
  await pagina.waitForFunction(() => document.querySelectorAll('dialog').length === 0, null, ESPERA);
  assert.equal(await noApp(), true);
  assert.deepEqual(erros, []);
});

// --------------------------------------------------------------------- gestos

test('deslizar o dedo para o lado troca de aba e para nas pontas', async (t) => {
  const { pagina, erros } = await abrir(t, { toque: true });
  await visivel(pagina.getByText('Nenhuma rotina ainda'));

  // Dedo para a esquerda: vai para a aba da direita.
  await deslizar(pagina, [400, 500], [120, 510]);
  await esperarTitulo(pagina, 'Hábitos - Foco');
  await deslizar(pagina, [400, 500], [120, 510]);
  await esperarTitulo(pagina, 'Tarefas - Foco');

  // Na última aba não há para onde avançar.
  await deslizar(pagina, [400, 500], [120, 510]);
  await visivel(pagina.getByText('Nenhuma tarefa aqui'));
  assert.equal(await pagina.title(), 'Tarefas - Foco');

  // Dedo para a direita: volta. A aba em que a pessoa parou fica salva.
  await deslizar(pagina, [120, 500], [400, 490]);
  await esperarTitulo(pagina, 'Hábitos - Foco');
  assert.equal(JSON.parse(await lerSalvo(pagina, CHAVE)).aba, 'habitos');
  assert.equal(await botao(pagina, 'Hábitos').getAttribute('aria-current'), 'page');

  // Rolar a lista (movimento vertical) e um toque curto não trocam de aba.
  await deslizar(pagina, [250, 700], [270, 300]);
  await deslizar(pagina, [250, 500], [280, 500]);
  await visivel(pagina.getByText('Nenhum hábito ainda'));
  assert.equal(await pagina.title(), 'Hábitos - Foco');
  assert.deepEqual(erros, []);
});

test('deslizar sobre a faixa de rotinas rola a faixa e não troca de aba', async (t) => {
  const nomes = ['Home office', 'Presencial', 'Fim de semana', 'Viagem', 'Férias', 'Plantão'];
  const salvo = JSON.stringify({
    versao: 2,
    rotinas: nomes.map((nome, i) => ({
      id: `r${i}`,
      nome,
      itens: [{ id: `i${i}`, tipo: 'item', texto: 'Acordar', hora: null }],
    })),
  });
  const { pagina, erros } = await abrir(t, { salvo, toque: true });

  const faixa = pagina.locator('.faixa');
  await visivel(faixa);
  const caixa = await faixa.boundingBox();
  const y = caixa.y + caixa.height / 2;
  await deslizar(pagina, [400, y], [120, y]);
  await pagina.waitForFunction(() => document.querySelector('.faixa').scrollLeft > 0, null, ESPERA);
  assert.equal(await pagina.title(), 'Rotinas - Foco');

  // O mesmo gesto fora da faixa troca de aba.
  await deslizar(pagina, [400, 600], [120, 600]);
  await esperarTitulo(pagina, 'Hábitos - Foco');
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
