// Aba Tarefas: listas com prazo, no estilo do Google Tasks.
// As tarefas aparecem agrupadas por data; as sem data ficam no fim.

import { estado, salvar } from './store.js';
import { uid } from './nucleo/ids.js';
import { hoje, somaDias } from './nucleo/datas.js';
import { LIMITES, ORDENS_TAREFAS, VISAO_ESTRELA as ESTRELA } from './nucleo/esquema.js';
import { agrupar, ordenar, rotuloData } from './nucleo/prazos.js';
import { h, icone, abrirFolha, abrirMenu, confirmar, campo, estadoVazio, redesenhar, vibrar } from './ui.js';

let concluidasAbertas = false;

// Tempo da resposta ao concluir: a marca aparece, a linha se recolhe e só então a lista é redesenhada.
const MOSTRAR_MARCA_MS = 380;
const RECOLHER_MS = 240;
let esperaRedesenho = null;

// ---------------------------------------------------------------- ações

function alternarFeita(tarefa, check) {
  tarefa.feita = !tarefa.feita;
  tarefa.feitaEm = tarefa.feita ? Date.now() : null;
  salvar();

  const linhaNaTela = check.closest('.tarefa');
  if (!tarefa.feita) {
    redesenhar(); // reabrir é imediato
    return;
  }

  // Concluir: a tarefa já está salva como feita. A linha fica um instante na tela,
  // com a marca e o título riscado, e se recolhe; antes ela simplesmente sumia.
  vibrar('concluido');
  check.replaceChildren(icone('check'));
  check.setAttribute('aria-checked', 'true');
  linhaNaTela.style.setProperty('height', `${linhaNaTela.offsetHeight}px`);
  linhaNaTela.classList.add('concluindo');
  setTimeout(() => linhaNaTela.classList.add('saindo'), MOSTRAR_MARCA_MS);

  // Um só redesenho, depois da última conclusão: tocar em várias seguidas não corta a animação.
  clearTimeout(esperaRedesenho);
  esperaRedesenho = setTimeout(redesenhar, MOSTRAR_MARCA_MS + RECOLHER_MS);
}

function alternarEstrela(tarefa) {
  tarefa.estrela = !tarefa.estrela;
  salvar();
  redesenhar();
}

function editarTarefa(tarefa) {
  const naEstrela = estado.listaAtiva === ESTRELA;
  const listaPadrao = tarefa?.listaId ?? (naEstrela ? estado.listas[0].id : estado.listaAtiva);

  const titulo = h('input', {
    class: 'entrada',
    type: 'text',
    value: tarefa?.titulo ?? '',
    placeholder: 'Nova tarefa',
    maxLength: LIMITES.tituloTarefa,
    required: true,
    autocomplete: 'off',
  });
  const notas = h('textarea', {
    class: 'entrada',
    rows: 2,
    value: tarefa?.notas ?? '',
    placeholder: 'Detalhes (opcional)',
    maxLength: LIMITES.notasTarefa,
  });
  const prazo = h('input', { class: 'entrada', type: 'date', value: tarefa?.prazo ?? '' });
  const lista = h(
    'select',
    { class: 'entrada' },
    estado.listas.map((l) => h('option', { value: l.id }, l.nome)),
  );
  lista.value = listaPadrao; // depois de criar as opções

  const atalho = (rotulo, valor) =>
    h(
      'button',
      {
        type: 'button',
        class: 'chip',
        onclick: () => {
          prazo.value = valor;
        },
      },
      rotulo,
    );

  const aoSalvar = (e) => {
    e.preventDefault();
    const tituloFinal = titulo.value.trim();
    if (!tituloFinal) {
      titulo.value = '';
      titulo.reportValidity();
      return;
    }

    const dados = {
      titulo: tituloFinal,
      notas: notas.value.trim(),
      prazo: prazo.value || null,
      // Sem opção selecionada (lista da tarefa não existe mais), cai na primeira lista.
      listaId: lista.value || estado.listas[0].id,
    };
    if (tarefa) {
      Object.assign(tarefa, dados);
    } else {
      estado.tarefas.push({
        id: uid(),
        ...dados,
        estrela: naEstrela,
        feita: false,
        criadaEm: Date.now(),
        feitaEm: null,
      });
    }
    salvar();
    fechar();
    redesenhar();
  };

  const excluir = async () => {
    if (!(await confirmar(`Excluir a tarefa "${tarefa.titulo}"?`))) return;
    estado.tarefas = estado.tarefas.filter((t) => t.id !== tarefa.id);
    salvar();
    fechar();
    redesenhar();
  };

  const fechar = abrirFolha({
    titulo: tarefa ? 'Editar tarefa' : 'Nova tarefa',
    corpo: h(
      'form',
      { class: 'folha-form', onsubmit: aoSalvar },
      campo('Título', titulo),
      campo('Detalhes', notas),
      campo('Prazo', prazo),
      h(
        'div',
        { class: 'atalhos' },
        atalho('Hoje', hoje()),
        atalho('Amanhã', somaDias(hoje(), 1)),
        atalho('Sem data', ''),
      ),
      estado.listas.length > 1 ? campo('Lista', lista) : null,
      h(
        'div',
        { class: 'linha-botoes' },
        tarefa ? h('button', { type: 'button', class: 'botao perigo', onclick: excluir }, 'Excluir') : null,
        h('span', { class: 'espaco' }),
        h('button', { type: 'button', class: 'botao', onclick: () => fechar() }, 'Cancelar'),
        h('button', { type: 'submit', class: 'botao cheio' }, 'Salvar'),
      ),
    ),
  });

  if (!tarefa) titulo.focus();
}

function editarLista(lista) {
  const nome = h('input', {
    class: 'entrada',
    type: 'text',
    value: lista?.nome ?? '',
    placeholder: 'Ex.: Faculdade',
    maxLength: LIMITES.nomeLista,
    required: true,
  });

  const aoSalvar = (e) => {
    e.preventDefault();
    const nomeFinal = nome.value.trim();
    if (!nomeFinal) {
      nome.value = '';
      nome.reportValidity();
      return;
    }
    if (lista) {
      lista.nome = nomeFinal;
    } else {
      const nova = { id: uid(), nome: nomeFinal };
      estado.listas.push(nova);
      estado.listaAtiva = nova.id;
    }
    salvar();
    fechar();
    redesenhar();
  };

  const fechar = abrirFolha({
    titulo: lista ? 'Renomear lista' : 'Nova lista',
    corpo: h(
      'form',
      { class: 'folha-form', onsubmit: aoSalvar },
      campo('Nome', nome),
      h(
        'div',
        { class: 'linha-botoes' },
        h('button', { type: 'button', class: 'botao', onclick: () => fechar() }, 'Cancelar'),
        h('button', { type: 'submit', class: 'botao cheio' }, 'Salvar'),
      ),
    ),
  });
  nome.focus();
  nome.select();
}

async function excluirLista(lista) {
  const quantas = estado.tarefas.filter((t) => t.listaId === lista.id).length;
  const complemento =
    quantas === 0 ? '' : quantas === 1 ? ' e a tarefa dela' : ` e as ${quantas} tarefas dela`;
  if (!(await confirmar(`Excluir a lista "${lista.nome}"${complemento}?`))) return;

  estado.listas = estado.listas.filter((l) => l.id !== lista.id);
  estado.tarefas = estado.tarefas.filter((t) => t.listaId !== lista.id);
  estado.listaAtiva = estado.listas[0].id;
  salvar();
  redesenhar();
}

// Ordem das tarefas pendentes. Vale para todas as listas e para a visão "com estrela".
const ROTULO_DA_ORDEM = {
  data: 'Data',
  estrela: 'Com estrela primeiro',
  titulo: 'Título',
  criacao: 'Mais recentes primeiro',
};

function escolherOrdem() {
  abrirMenu(
    'Ordenar por',
    ORDENS_TAREFAS.map((ordem) => ({
      rotulo: ROTULO_DA_ORDEM[ordem],
      atual: estado.ordemTarefas === ordem,
      acao: () => {
        estado.ordemTarefas = ordem;
        salvar();
        redesenhar();
      },
    })),
  );
}

async function excluirConcluidas(lista) {
  const daLista = (t) => t.listaId === lista.id && t.feita;
  const quantas = estado.tarefas.filter(daLista).length;
  const quais = quantas === 1 ? 'a tarefa concluída' : `as ${quantas} tarefas concluídas`;
  if (!(await confirmar(`Excluir ${quais} da lista "${lista.nome}"?`))) return;

  estado.tarefas = estado.tarefas.filter((t) => !daLista(t));
  salvar();
  redesenhar();
}

function menuLista(lista) {
  abrirMenu(lista.nome, [
    { rotulo: `Ordenar por: ${ROTULO_DA_ORDEM[estado.ordemTarefas]}`, acao: escolherOrdem },
    { rotulo: 'Renomear lista', acao: () => editarLista(lista) },
    {
      rotulo: 'Excluir concluídas',
      perigo: true,
      desativado: !estado.tarefas.some((t) => t.listaId === lista.id && t.feita),
      acao: () => excluirConcluidas(lista),
    },
    {
      rotulo: 'Excluir lista',
      perigo: true,
      desativado: estado.listas.length === 1, // sempre sobra uma lista
      acao: () => excluirLista(lista),
    },
  ]);
}

// --------------------------------------------------------------- desenho

// comPrazo: mostra a data na linha. Na ordem por data não precisa, porque o grupo já diz o dia.
function linha(tarefa, { atrasada = false, mostrarLista = false, comPrazo = false } = {}) {
  const detalhes = [];
  if (atrasada || tarefa.feita || comPrazo) {
    if (tarefa.prazo) {
      detalhes.push(
        h('span', { class: `tarefa-sub${atrasada ? ' atrasada' : ''}` }, rotuloData(tarefa.prazo, hoje())),
      );
    }
  }
  if (mostrarLista) {
    const nomeLista = estado.listas.find((l) => l.id === tarefa.listaId)?.nome;
    if (nomeLista) detalhes.push(h('span', { class: 'tarefa-sub' }, nomeLista));
  }
  // Na lista, a nota aparece resumida em até duas linhas; o texto inteiro fica na edição.
  if (tarefa.notas) detalhes.push(h('span', { class: 'tarefa-sub nota' }, tarefa.notas.split('\n')[0]));

  return h(
    'li',
    { class: `tarefa${tarefa.feita ? ' feita' : ''}` },
    h(
      'button',
      {
        type: 'button',
        class: 'tarefa-check',
        role: 'checkbox',
        'aria-checked': String(tarefa.feita),
        'aria-label': `${tarefa.feita ? 'Reabrir' : 'Concluir'}: ${tarefa.titulo}`,
        onclick: (e) => alternarFeita(tarefa, e.currentTarget),
      },
      tarefa.feita ? icone('check') : h('span', { class: 'circulo' }),
    ),
    h(
      'button',
      { type: 'button', class: 'tarefa-corpo', onclick: () => editarTarefa(tarefa) },
      h('span', { class: 'tarefa-titulo' }, tarefa.titulo),
      detalhes,
    ),
    h(
      'button',
      {
        type: 'button',
        class: `tarefa-estrela${tarefa.estrela ? ' ativa' : ''}`,
        'aria-pressed': String(tarefa.estrela),
        'aria-label': `Estrela: ${tarefa.titulo}`,
        onclick: () => alternarEstrela(tarefa),
      },
      icone('estrela', { cheio: tarefa.estrela, tam: 22 }),
    ),
  );
}

// Pendentes na ordem escolhida. Por data: um cartão por grupo (Atrasadas, Hoje, Amanhã,
// cada data, Sem data). Nas outras ordens: um cartão só, com a data em cada linha.
function cartoesDasPendentes(pendentes, naEstrela) {
  const diaHoje = hoje();
  if (estado.ordemTarefas === 'data') {
    return agrupar(pendentes, diaHoje).map((g) =>
      h(
        'section',
        { class: `cartao grupo${g.atrasado ? ' atrasado' : ''}` },
        h('h3', { class: 'grupo-titulo' }, g.rotulo),
        h(
          'ul',
          {},
          g.tarefas.map((t) => linha(t, { atrasada: g.atrasado, mostrarLista: naEstrela })),
        ),
      ),
    );
  }
  if (!pendentes.length) return [];
  return [
    h(
      'section',
      { class: 'cartao' },
      h(
        'ul',
        {},
        ordenar(pendentes, estado.ordemTarefas).map((t) =>
          linha(t, {
            atrasada: Boolean(t.prazo) && t.prazo < diaHoje,
            mostrarLista: naEstrela,
            comPrazo: true,
          }),
        ),
      ),
    ),
  ];
}

function render(raiz) {
  const rolagemFaixa = raiz.querySelector('.faixa')?.scrollLeft ?? 0;

  const naEstrela = estado.listaAtiva === ESTRELA;
  let ativa = naEstrela ? null : estado.listas.find((l) => l.id === estado.listaAtiva);
  if (!naEstrela && !ativa) {
    ativa = estado.listas[0];
    estado.listaAtiva = ativa.id;
  }

  const daVisao = estado.tarefas.filter((t) => (naEstrela ? t.estrela : t.listaId === ativa.id));
  const pendentes = daVisao.filter((t) => !t.feita);
  const concluidas = naEstrela ? [] : daVisao.filter((t) => t.feita).sort((a, b) => b.feitaEm - a.feitaEm);

  const irPara = (id) => {
    estado.listaAtiva = id;
    salvar();
    redesenhar();
  };

  const faixa = h(
    'div',
    { class: 'faixa' },
    h(
      'button',
      {
        type: 'button',
        class: `chip${naEstrela ? ' ativo' : ''}`,
        'aria-label': 'Com estrela',
        onclick: () => irPara(ESTRELA),
      },
      icone('estrela', { cheio: true, tam: 18 }),
    ),
    estado.listas.map((l) =>
      h(
        'button',
        { type: 'button', class: `chip${ativa?.id === l.id ? ' ativo' : ''}`, onclick: () => irPara(l.id) },
        l.nome,
      ),
    ),
    h(
      'button',
      { type: 'button', class: 'chip fantasma', onclick: () => editarLista(null) },
      icone('mais', { tam: 18 }),
      'Nova lista',
    ),
  );

  const blocos = cartoesDasPendentes(pendentes, naEstrela);

  if (!pendentes.length) {
    blocos.push(
      naEstrela
        ? estadoVazio('Nenhuma tarefa com estrela', 'Toque na estrela de uma tarefa para ela aparecer aqui.')
        : estadoVazio(
            concluidas.length ? 'Tudo concluído' : 'Nenhuma tarefa aqui',
            'Toque em + para adicionar uma tarefa.',
            { compacto: concluidas.length > 0 },
          ),
    );
  }

  if (concluidas.length) {
    blocos.push(
      h(
        'section',
        { class: 'cartao' },
        h(
          'button',
          {
            type: 'button',
            class: 'concluidas-topo',
            'aria-expanded': String(concluidasAbertas),
            onclick: () => {
              concluidasAbertas = !concluidasAbertas;
              redesenhar();
            },
          },
          `Concluídas (${concluidas.length})`,
          icone(concluidasAbertas ? 'cima' : 'baixo'),
        ),
        concluidasAbertas
          ? h(
              'ul',
              {},
              concluidas.map((t) => linha(t)),
            )
          : null,
      ),
    );
  }

  raiz.replaceChildren(
    faixa,
    h(
      'div',
      { class: 'cabecalho' },
      h(
        'div',
        {},
        h('h2', {}, naEstrela ? 'Com estrela' : ativa.nome),
        h('p', { class: 'sub' }, pendentes.length === 1 ? '1 pendente' : `${pendentes.length} pendentes`),
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'botao-icone',
          'aria-label': naEstrela ? 'Ordenar por' : 'Opções da lista',
          onclick: () => (naEstrela ? escolherOrdem() : menuLista(ativa)),
        },
        icone('pontos'),
      ),
    ),
    ...blocos,
  );
  faixa.scrollLeft = rolagemFaixa;
}

export const tarefas = {
  id: 'tarefas',
  titulo: 'Tarefas',
  rotuloAdicionar: 'Nova tarefa',
  render,
  aoAdicionar: () => editarTarefa(null),
};
