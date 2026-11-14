// Aba Rotinas: checklists do dia, com seções e horários.
// As marcas valem para o dia corrente e zeram sozinhas no dia seguinte.

import { estado, salvar, marcasDeHoje } from './store.js';
import { uid } from './nucleo/ids.js';
import { hoje } from './nucleo/datas.js';
import { registroAposItem, sugerirHabito } from './nucleo/ligacao.js';
import { LIMITES } from './nucleo/esquema.js';
import { textoParaItens, itensParaTexto } from './nucleo/rotina-texto.js';
import { desmarcarBloco, emAreas, marcarBloco, semAsUltimas } from './nucleo/rotina-ordem.js';
import {
  campoDoNome,
  desfazerEdicao,
  emEdicao,
  entrarNaEdicao,
  refazerEdicao,
  listaEmEdicao,
  sairDaEdicao,
  terminarEdicaoAberta,
} from './rotina-edicao.js';
import {
  h,
  icone,
  abrirFolha,
  abrirMenu,
  avisar,
  confirmar,
  campo,
  estadoVazio,
  redesenhar,
  vibrar,
} from './ui.js';

// ---------------------------------------------------------------- ações

// Quantos outros itens ligados ao mesmo hábito estão marcados hoje, em qualquer rotina.
function outrosMarcadosDoHabito(item) {
  const marcas = marcasDeHoje();
  let quantos = 0;
  for (const rotina of estado.rotinas) {
    const marcadas = new Set(marcas[rotina.id] ?? []);
    for (const outro of rotina.itens) {
      if (outro.id !== item.id && outro.habitoId === item.habitoId && marcadas.has(outro.id)) quantos += 1;
    }
  }
  return quantos;
}

// Item ligado a um hábito: marcar ou desmarcar o item acerta o registro de hoje do hábito.
// Chamar depois de atualizar as marcas do dia.
function acertarHabitoLigado(item, marcou) {
  const habito = item.habitoId ? estado.habitos.find((x) => x.id === item.habitoId) : null;
  if (!habito) return;
  const dia = hoje();
  const registro = (estado.registros[habito.id] ??= {});
  const novo = registroAposItem(habito, registro[dia], marcou, outrosMarcadosDoHabito(item));
  if (novo === null) delete registro[dia];
  else registro[dia] = novo;
  if (!Object.keys(registro).length) delete estado.registros[habito.id];
}

// Desfazer por lotes: marcar um item é um lote de 1; marcar a seção inteira é um lote do
// tamanho dela. Os lotes valem enquanto o app está aberto; sem eles (app reaberto, ou
// depois de desmarcar algo à mão), o desfazer volta uma marca por vez.
const lotes = new Map(); // id da rotina -> tamanhos dos lotes, do mais antigo ao mais novo
const anotarLote = (rotina, tamanho) => lotes.set(rotina.id, [...(lotes.get(rotina.id) ?? []), tamanho]);

// A área de marcados pode ser recolhida; começa aberta.
let marcadosAbertos = true;

// Resposta ao marcar, como no Keep: a caixa preenche e o texto risca no lugar; um instante
// depois a linha desliza para fora e a lista é redesenhada, com o item na outra área.
// A marca é gravada na hora: nada depende de a animação terminar.
const MOSTRAR_MARCA_MS = 380;
const SAIR_MS = 260;
let esperaRedesenho = null;
let recemMovido = null; // id do item que acabou de mudar de área: chega com animação
let pulsarContador = false; // o contador de marcados reage quando ganha um item
const semMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Item que vai mudar de área: marca no lugar, espera e sai. "botao" é a linha tocada.
function animarMudanca(botao, marcou) {
  botao.classList.toggle('feito', marcou);
  botao.setAttribute('aria-checked', String(marcou));
  botao.classList.add('marcando');
  const li = botao.closest('li');
  li.style.setProperty('height', `${li.offsetHeight}px`);
  li.classList.add('mudando-de-area');
  setTimeout(() => li.classList.add('saindo'), MOSTRAR_MARCA_MS);
  // Um só redesenho, depois do último toque: marcar vários seguidos não corta a animação.
  clearTimeout(esperaRedesenho);
  esperaRedesenho = setTimeout(redesenhar, MOSTRAR_MARCA_MS + SAIR_MS);
}

// Marcar ou desmarcar um item. Pela aba Rotinas vem "botao" (a linha tocada) e há animação;
// pelo painel não vem, e a lista é redesenhada na hora.
function alternarItem(rotina, item, botao = null) {
  const marcas = marcasDeHoje();
  const atuais = new Set(marcas[rotina.id] ?? []);
  const marcou = !atuais.has(item.id);
  if (marcou) atuais.add(item.id);
  else atuais.delete(item.id);
  if (marcou) anotarLote(rotina, 1);
  else lotes.delete(rotina.id);
  marcas[rotina.id] = [...atuais]; // a ordem da lista é a ordem em que os itens foram marcados
  acertarHabitoLigado(item, marcou);
  // Fechar a rotina do dia ganha o efeito de sucesso; as outras marcas, um toque leve.
  const totalDeItens = rotina.itens.filter((i) => i.tipo === 'item').length;
  if (!marcou) vibrar('desmarcar');
  else vibrar(atuais.size === totalDeItens ? 'concluido' : 'marcar');
  salvar();

  if (!botao) {
    redesenhar();
    return;
  }
  recemMovido = item.id;
  pulsarContador = marcou;
  if (estado.marcadosNoFim && !semMovimento()) animarMudanca(botao, marcou);
  else redesenhar();
}

// Desfazer: volta a última marca, ou a seção inteira quando ela foi marcada de uma vez.
// Tocar de novo volta mais uma, e assim por diante.
function desfazerUltimaMarca(rotina) {
  const marcas = marcasDeHoje();
  const atuais = marcas[rotina.id] ?? [];
  const quantas = Math.min(lotes.get(rotina.id)?.pop() ?? 1, atuais.length);
  const desfeitas = atuais.slice(atuais.length - quantas).reverse();
  marcas[rotina.id] = semAsUltimas(atuais, quantas);
  for (const id of desfeitas) {
    const item = rotina.itens.find((i) => i.id === id);
    if (item) acertarHabitoLigado(item, false);
  }
  vibrar('desmarcar');
  salvar();
  redesenhar();
}

// Caixa do título da seção: marca de uma vez os itens do bloco, ou desmarca todos.
// "bloco" traz os itens que a ação alcança: os que faltam, ao marcar; os marcados, ao desmarcar.
function alternarSecao(rotina, bloco, marcar) {
  const marcas = marcasDeHoje();
  const atuais = marcas[rotina.id] ?? [];
  const antes = new Set(atuais);
  const mudam = bloco.itens.filter((item) => antes.has(item.id) !== marcar);
  marcas[rotina.id] = marcar ? marcarBloco(atuais, bloco) : desmarcarBloco(atuais, bloco);
  for (const item of mudam) acertarHabitoLigado(item, marcar);
  if (marcar && mudam.length) anotarLote(rotina, mudam.length);
  if (!marcar) lotes.delete(rotina.id);
  vibrar(marcar ? 'concluido' : 'desmarcar');
  salvar();
  redesenhar();
}

// Item que vai ser tirado da rotina: a marca do dia dele sai junto. O hábito ligado
// continua como está: tirar o item da lista não desfaz o que já foi feito.
function esquecerMarca(rotina, item) {
  const marcas = marcasDeHoje();
  const atuais = marcas[rotina.id] ?? [];
  if (!atuais.includes(item.id)) return;
  marcas[rotina.id] = atuais.filter((id) => id !== item.id);
  lotes.delete(rotina.id);
}

// "Excluir itens marcados", como no Keep: tira da rotina os itens marcados hoje.
async function excluirMarcados(rotina) {
  const marcadas = new Set(marcasDeHoje()[rotina.id] ?? []);
  const n = rotina.itens.filter((i) => marcadas.has(i.id)).length;
  if (!n) return;
  if (!(await confirmar(`Excluir ${n} ${n === 1 ? 'item marcado' : 'itens marcados'} desta rotina?`))) return;
  rotina.itens = rotina.itens.filter((i) => !marcadas.has(i.id));
  delete marcasDeHoje()[rotina.id];
  lotes.delete(rotina.id);
  salvar();
  redesenhar();
}

function desmarcarTudo(rotina) {
  const marcas = marcasDeHoje();
  const marcadas = new Set(marcas[rotina.id] ?? []);
  delete marcas[rotina.id];
  lotes.delete(rotina.id);
  for (const item of rotina.itens) if (marcadas.has(item.id)) acertarHabitoLigado(item, false);
  salvar();
  redesenhar();
}

// Folha "Ligar itens a hábitos": um seletor de hábito para cada item da rotina.
function abrirLigacoes(rotina) {
  const itens = rotina.itens.filter((i) => i.tipo === 'item');
  // Hábitos arquivados só aparecem se já estiverem ligados a algum item desta rotina.
  const emUso = new Set(itens.map((i) => i.habitoId));
  const habitos = estado.habitos.filter((x) => !x.arquivado || emUso.has(x.id));
  if (!habitos.length || !itens.length) {
    avisar(habitos.length ? 'Esta rotina não tem itens.' : 'Crie um hábito na aba Hábitos para poder ligar.');
    return;
  }

  const seletores = new Map();
  const linhas = itens.map((item) => {
    const seletor = h(
      'select',
      { class: 'entrada', 'aria-label': `Hábito de ${item.texto}` },
      h('option', { value: '' }, 'Sem hábito'),
      habitos.map((x) => h('option', { value: x.id }, x.nome)),
    );
    seletor.value = habitos.some((x) => x.id === item.habitoId) ? item.habitoId : '';
    seletores.set(item.id, seletor);
    return h(
      'div',
      { class: 'ligacao' },
      h('span', {}, item.hora ? `${item.hora} ${item.texto}` : item.texto),
      seletor,
    );
  });

  const sugerir = () => {
    let novas = 0;
    for (const item of itens) {
      const seletor = seletores.get(item.id);
      const sugestao = seletor.value ? null : sugerirHabito(item.texto, habitos);
      if (sugestao) {
        seletor.value = sugestao;
        novas += 1;
      }
    }
    avisar(
      novas
        ? `${novas} ${novas === 1 ? 'sugestão' : 'sugestões'}. Confira e salve.`
        : 'Nenhum nome parecido.',
    );
  };

  const aoSalvar = (e) => {
    e.preventDefault();
    for (const item of itens) item.habitoId = seletores.get(item.id).value || null;
    salvar();
    fechar();
    redesenhar();
  };

  const fechar = abrirFolha({
    titulo: 'Ligar itens a hábitos',
    fecharNoFundo: false,
    corpo: h(
      'form',
      { class: 'folha-form', onsubmit: aoSalvar },
      h(
        'p',
        { class: 'dica' },
        'Marcar um item ligado marca o hábito no dia; desmarcar desfaz. Em hábito numérico, cada item marcado soma 1.',
      ),
      h(
        'div',
        { class: 'linha-botoes inicio' },
        h('button', { type: 'button', class: 'botao contorno', onclick: sugerir }, 'Sugerir pelo nome'),
      ),
      h('div', { class: 'ligacoes' }, linhas),
      h(
        'div',
        { class: 'linha-botoes' },
        h('button', { type: 'button', class: 'botao', onclick: () => fechar() }, 'Cancelar'),
        h('button', { type: 'submit', class: 'botao cheio' }, 'Salvar'),
      ),
    ),
  });
}

function editarRotina(rotina) {
  const nome = h('input', {
    class: 'entrada',
    type: 'text',
    value: rotina?.nome ?? '',
    placeholder: 'Ex.: Home Office',
    maxLength: LIMITES.nomeRotina,
    required: true,
  });
  const texto = h('textarea', {
    class: 'entrada editor',
    value: rotina ? itensParaTexto(rotina.itens) : '',
    placeholder: '# MANHÃ\n06:30 Acordar\n06:35 Arrumar a cama\n\n# TRABALHO\n09:00 Bater o ponto',
    spellcheck: false,
    autocapitalize: 'sentences',
  });

  const aoSalvar = (e) => {
    e.preventDefault();
    const nomeFinal = nome.value.trim();
    if (!nomeFinal) {
      nome.value = '';
      nome.reportValidity();
      return;
    }

    const itens = textoParaItens(texto.value, rotina?.itens ?? []);
    if (rotina) {
      rotina.nome = nomeFinal;
      rotina.itens = itens;
      // Descarta marcas de itens que deixaram de existir.
      const marcas = marcasDeHoje();
      const existentes = new Set(itens.map((i) => i.id));
      if (marcas[rotina.id]) marcas[rotina.id] = marcas[rotina.id].filter((id) => existentes.has(id));
    } else {
      const nova = { id: uid(), nome: nomeFinal, itens };
      estado.rotinas.push(nova);
      estado.rotinaAtiva = nova.id;
    }
    salvar();
    fechar();
    redesenhar();
  };

  // O texto pode ser longo: sair sem salvar pede confirmação se algo mudou.
  const original = { nome: nome.value, texto: texto.value };
  const tentarFechar = async () => {
    const mudou = nome.value !== original.nome || texto.value !== original.texto;
    if (!mudou || (await confirmar('Descartar as alterações?', 'Descartar'))) fechar();
  };

  const fechar = abrirFolha({
    titulo: rotina ? 'Editar rotina' : 'Nova rotina',
    fecharNoFundo: false,
    aoTentarFechar: tentarFechar,
    corpo: h(
      'form',
      { class: 'folha-form', onsubmit: aoSalvar },
      campo('Nome', nome),
      campo('Itens', texto),
      h(
        'p',
        { class: 'dica' },
        'Uma linha por item. ',
        h('code', {}, '# Nome'),
        ' abre uma seção. Horário no começo é opcional: ',
        h('code', {}, '22:30 Chegar em casa'),
        '.',
      ),
      h(
        'div',
        { class: 'linha-botoes' },
        h('button', { type: 'button', class: 'botao', onclick: tentarFechar }, 'Cancelar'),
        h('button', { type: 'submit', class: 'botao cheio' }, 'Salvar'),
      ),
    ),
  });

  if (!rotina) nome.focus();
}

async function excluirRotina(rotina) {
  if (!(await confirmar(`Excluir a rotina "${rotina.nome}"?`))) return;
  estado.rotinas = estado.rotinas.filter((r) => r.id !== rotina.id);
  delete marcasDeHoje()[rotina.id];
  estado.rotinaAtiva = estado.rotinas[0]?.id ?? null;
  salvar();
  redesenhar();
}

// "Fazer uma cópia", como no Keep: mesmos itens e ligações, ids novos, sem as marcas do dia.
// A cópia entra logo depois da original e já fica aberta.
function copiarRotina(rotina) {
  const nome = `${rotina.nome} (cópia)`.slice(0, LIMITES.nomeRotina);
  const copia = { id: uid(), nome, itens: rotina.itens.map((item) => ({ ...item, id: uid() })) };
  estado.rotinas.splice(estado.rotinas.indexOf(rotina) + 1, 0, copia);
  estado.rotinaAtiva = copia.id;
  salvar();
  redesenhar();
}

// A ordem das rotinas na faixa do topo é a ordem em que estão guardadas.
function moverRotina(rotina, passo) {
  const de = estado.rotinas.indexOf(rotina);
  const para = de + passo;
  if (de < 0 || para < 0 || para >= estado.rotinas.length) return;
  estado.rotinas.splice(de, 1);
  estado.rotinas.splice(para, 0, rotina);
  salvar();
  redesenhar();
}

function menuRotina(rotina) {
  const posicao = estado.rotinas.indexOf(rotina);
  const temMarcados = Boolean(marcasDeHoje()[rotina.id]?.length);
  abrirMenu(rotina.nome, [
    { rotulo: 'Editar como texto', acao: () => editarRotina(rotina) },
    { rotulo: 'Fazer uma cópia', acao: () => copiarRotina(rotina) },
    { rotulo: 'Mover para a esquerda', desativado: posicao === 0, acao: () => moverRotina(rotina, -1) },
    {
      rotulo: 'Mover para a direita',
      desativado: posicao === estado.rotinas.length - 1,
      acao: () => moverRotina(rotina, 1),
    },
    {
      rotulo: 'Marcados no fim',
      marcado: estado.marcadosNoFim,
      acao: () => {
        estado.marcadosNoFim = !estado.marcadosNoFim;
        salvar();
        redesenhar();
      },
    },
    { rotulo: 'Ligar itens a hábitos', acao: () => abrirLigacoes(rotina) },
    { rotulo: 'Desmarcar todos', desativado: !temMarcados, acao: () => desmarcarTudo(rotina) },
    {
      rotulo: 'Excluir itens marcados',
      perigo: true,
      desativado: !temMarcados,
      acao: () => excluirMarcados(rotina),
    },
    { rotulo: 'Excluir rotina', perigo: true, acao: () => excluirRotina(rotina) },
  ]);
}

// --------------------------------------------------------------- desenho

// Marca visual do item ligado a um hábito: um elo na cor do hábito.
function eloDoHabito(item) {
  const habito = item.habitoId ? estado.habitos.find((x) => x.id === item.habitoId) : null;
  if (!habito) return null;
  return h(
    'span',
    {
      class: 'elo',
      style: { '--cor': `var(--cor-${habito.cor})` },
      title: `Ligado ao hábito ${habito.nome}`,
    },
    icone('elo', { tam: 16 }),
  );
}

// Título de seção, com a caixa que marca ou desmarca o bloco inteiro.
function tituloDaSecao(rotina, bloco, marcadas) {
  const marcada = bloco.itens.length > 0 && bloco.itens.every((item) => marcadas.has(item.id));
  return h(
    'li',
    { class: `rotina-secao${marcada ? ' marcada' : ''}` },
    h(
      'button',
      {
        type: 'button',
        class: `secao-caixa${marcada ? ' feito' : ''}`,
        role: 'checkbox',
        'aria-checked': String(marcada),
        'aria-label': `${marcada ? 'Desmarcar' : 'Marcar'} a seção ${bloco.secao.texto}`,
        disabled: !bloco.itens.length,
        onclick: () => alternarSecao(rotina, bloco, !marcada),
      },
      h('span', { class: 'caixa' }, icone('check', { tam: 14 })),
    ),
    h('span', { class: 'secao-nome' }, bloco.secao.texto),
  );
}

// comHoras: a rotina tem algum item com horário. Nesse caso todo item reserva a
// coluna do horário, para os textos ficarem alinhados uns com os outros.
function linha(rotina, item, marcadas, comHoras) {
  const feito = marcadas.has(item.id);
  return h(
    'li',
    {},
    h(
      'button',
      {
        type: 'button',
        class: `rotina-item${feito ? ' feito' : ''}${item.id === recemMovido ? ' chegou' : ''}`,
        role: 'checkbox',
        'aria-checked': String(feito),
        onclick: (e) => alternarItem(rotina, item, e.currentTarget),
      },
      h('span', { class: 'caixa' }, icone('check', { tam: 16 })),
      comHoras ? h('span', { class: 'hora' }, item.hora ?? '') : null,
      h('span', { class: 'rotina-texto' }, item.texto),
      eloDoHabito(item),
    ),
  );
}

// As duas áreas da rotina, como no Google Keep: o que falta em cima e, embaixo, a área
// "Marcados", que pode ser recolhida. Devolve os elementos a pôr na tela.
function areasDaRotina(rotina, marcadas, comHoras) {
  const { pendentes, marcados } = emAreas(rotina.itens, marcadas, estado.marcadosNoFim);
  const linhasDe = (blocos) =>
    blocos.flatMap((bloco) => [
      bloco.secao ? tituloDaSecao(rotina, bloco, marcadas) : null,
      ...bloco.itens.map((item) => linha(rotina, item, marcadas, comHoras)),
    ]);
  const quantos = marcados.reduce((n, bloco) => n + bloco.itens.length, 0);

  return [
    pendentes.length
      ? h('ul', { class: 'cartao area-pendentes' }, linhasDe(pendentes))
      : estadoVazio('Rotina concluída', 'Tudo marcado por hoje.', { compacto: true }),
    marcados.length
      ? h(
          'section',
          { class: 'cartao area-marcados' },
          h(
            'button',
            {
              type: 'button',
              class: `concluidas-topo${pulsarContador ? ' pulsa' : ''}`,
              'aria-expanded': String(marcadosAbertos),
              onclick: () => {
                marcadosAbertos = !marcadosAbertos;
                redesenhar();
              },
            },
            `${quantos} ${quantos === 1 ? 'item marcado' : 'itens marcados'}`,
            icone(marcadosAbertos ? 'cima' : 'baixo'),
          ),
          marcadosAbertos ? h('ul', {}, linhasDe(marcados)) : null,
        )
      : null,
  ].filter(Boolean); // a lista vai direto para a tela, sem passar por h(): não pode ter null
}

// Botão flutuante da aba: desfazer, sempre ao alcance enquanto houver marca hoje.
function acaoFlutuante() {
  const ativa = estado.rotinas.find((r) => r.id === estado.rotinaAtiva);
  if (!ativa || emEdicao(ativa) || !marcasDeHoje()[ativa.id]?.length) return null;
  return { icone: 'desfazer', rotulo: 'Desfazer a última marca', acao: () => desfazerUltimaMarca(ativa) };
}

function cabecalhoDaRotina(ativa, totalDeItens, feitos) {
  return h(
    'div',
    { class: 'cabecalho' },
    h(
      'div',
      {},
      h('h2', {}, ativa.nome),
      h('p', { class: 'sub' }, totalDeItens ? `${feitos} de ${totalDeItens} hoje` : 'Sem itens'),
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'botao-icone',
        'aria-label': 'Editar itens',
        onclick: () => entrarNaEdicao(ativa),
      },
      icone('lapis'),
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'botao-icone',
        'aria-label': 'Opções da rotina',
        onclick: () => menuRotina(ativa),
      },
      icone('pontos'),
    ),
  );
}

function cabecalhoEmEdicao(ativa) {
  return h(
    'div',
    { class: 'cabecalho' },
    h('div', {}, campoDoNome(ativa)),
    h(
      'button',
      {
        type: 'button',
        class: 'botao-icone',
        'aria-label': 'Desfazer edição',
        onclick: () => desfazerEdicao(ativa),
      },
      icone('desfazer'),
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'botao-icone',
        'aria-label': 'Refazer edição',
        onclick: () => refazerEdicao(ativa),
      },
      icone('refazer'),
    ),
    h(
      'button',
      { type: 'button', class: 'botao cheio', onclick: () => sairDaEdicao(ativa) },
      'Concluir edição',
    ),
  );
}

function corpoDaRotina(ativa, { editando, marcadas, comHoras, temItens }) {
  if (editando) return [listaEmEdicao(ativa, { aoRemoverItem: (item) => esquecerMarca(ativa, item) })];
  if (temItens) return areasDaRotina(ativa, marcadas, comHoras);
  return [estadoVazio('Rotina vazia', 'Toque em + para adicionar o primeiro item.')];
}

function render(raiz) {
  const rolagemFaixa = raiz.querySelector('.faixa')?.scrollLeft ?? 0;

  if (!estado.rotinas.length) {
    raiz.replaceChildren(estadoVazio('Nenhuma rotina ainda', 'Toque em + para criar a primeira.'));
    return;
  }

  const ativa = estado.rotinas.find((r) => r.id === estado.rotinaAtiva) ?? estado.rotinas[0];
  estado.rotinaAtiva = ativa.id;

  const marcadas = new Set(marcasDeHoje()[ativa.id] ?? []);
  const itens = ativa.itens.filter((i) => i.tipo === 'item');
  const feitos = itens.filter((i) => marcadas.has(i.id)).length;
  const porcento = itens.length ? Math.round((feitos / itens.length) * 100) : 0;
  const comHoras = itens.some((i) => i.hora);

  const faixa = h(
    'div',
    { class: 'faixa' },
    estado.rotinas.map((r) =>
      h(
        'button',
        {
          type: 'button',
          class: `chip${r.id === ativa.id ? ' ativo' : ''}`,
          onclick: () => {
            terminarEdicaoAberta();
            estado.rotinaAtiva = r.id;
            salvar();
            redesenhar();
          },
        },
        r.nome,
      ),
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'chip fantasma',
        onclick: () => {
          terminarEdicaoAberta();
          editarRotina(null);
        },
      },
      icone('mais', { tam: 18 }),
      'Nova rotina',
    ),
  );

  const editando = emEdicao(ativa);
  raiz.replaceChildren(
    faixa,
    editando ? cabecalhoEmEdicao(ativa) : cabecalhoDaRotina(ativa, itens.length, feitos),
    editando
      ? null
      : h(
          'div',
          { class: 'progresso' },
          h('div', { class: 'progresso-barra', style: { width: `${porcento}%` } }),
        ),
    ...corpoDaRotina(ativa, { editando, marcadas, comHoras, temItens: itens.length > 0 }),
  );
  faixa.scrollLeft = rolagemFaixa;
  // As animações de chegada e do contador são só do desenho logo depois do toque.
  recemMovido = null;
  pulsarContador = false;
  // A rotina aberta fica sempre à vista na faixa (ela pode ter mudado de lugar ou ser uma cópia nova).
  faixa.querySelector('.chip.ativo')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// O painel marca itens da rotina pelo mesmo caminho da aba (marca, hábito ligado e desfazer).
export { alternarItem as alternarItemDaRotina };

const rotinaAtiva = () => estado.rotinas.find((r) => r.id === estado.rotinaAtiva) ?? estado.rotinas[0];

export const rotinas = {
  id: 'rotinas',
  titulo: 'Rotinas',
  // Com rotina, o "+" adiciona um item nela, como no Keep; sem nenhuma, cria a primeira.
  get rotuloAdicionar() {
    return estado.rotinas.length ? 'Novo item' : 'Nova rotina';
  },
  render,
  aoAdicionar: () => {
    const ativa = rotinaAtiva();
    if (ativa) entrarNaEdicao(ativa, { adicionar: true });
    else editarRotina(null);
  },
  flutuante: acaoFlutuante,
};
