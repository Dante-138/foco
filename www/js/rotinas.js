// Aba Rotinas: checklists do dia, com seções e horários.
// As marcas valem para o dia corrente e zeram sozinhas no dia seguinte.

import { estado, salvar, marcasDeHoje } from './store.js';
import { uid } from './nucleo/ids.js';
import { hoje } from './nucleo/datas.js';
import { registroAposItem, sugerirHabito } from './nucleo/ligacao.js';
import { LIMITES } from './nucleo/esquema.js';
import { textoParaItens, itensParaTexto } from './nucleo/rotina-texto.js';
import { emOrdemDeExibicao, semAUltimaMarca } from './nucleo/rotina-ordem.js';
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

function alternarItem(rotina, item) {
  const marcas = marcasDeHoje();
  const atuais = new Set(marcas[rotina.id] ?? []);
  const marcou = !atuais.has(item.id);
  if (marcou) atuais.add(item.id);
  else atuais.delete(item.id);
  marcas[rotina.id] = [...atuais]; // a ordem da lista é a ordem em que os itens foram marcados
  acertarHabitoLigado(item, marcou);
  vibrar('toque');
  salvar();
  redesenhar();
}

// Desfazer: desmarca o último item marcado. Tocar de novo volta mais um, e assim por diante.
function desfazerUltimaMarca(rotina) {
  const marcas = marcasDeHoje();
  const atuais = marcas[rotina.id] ?? [];
  const desfeito = rotina.itens.find((i) => i.id === atuais.at(-1));
  marcas[rotina.id] = semAUltimaMarca(atuais);
  if (desfeito) acertarHabitoLigado(desfeito, false);
  salvar();
  redesenhar();
}

function desmarcarTudo(rotina) {
  const marcas = marcasDeHoje();
  const marcadas = new Set(marcas[rotina.id] ?? []);
  delete marcas[rotina.id];
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

function menuRotina(rotina) {
  abrirMenu(rotina.nome, [
    { rotulo: 'Editar rotina', acao: () => editarRotina(rotina) },
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
    { rotulo: 'Desmarcar tudo', acao: () => desmarcarTudo(rotina) },
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

// comHoras: a rotina tem algum item com horário. Nesse caso todo item reserva a
// coluna do horário, para os textos ficarem alinhados uns com os outros.
function linha(rotina, item, marcadas, comHoras) {
  if (item.tipo === 'secao') return h('li', { class: 'rotina-secao' }, item.texto);

  const feito = marcadas.has(item.id);
  return h(
    'li',
    {},
    h(
      'button',
      {
        type: 'button',
        class: `rotina-item${feito ? ' feito' : ''}`,
        role: 'checkbox',
        'aria-checked': String(feito),
        onclick: () => alternarItem(rotina, item),
      },
      h('span', { class: 'caixa' }, icone('check', { tam: 16 })),
      comHoras ? h('span', { class: 'hora' }, item.hora ?? '') : null,
      h('span', { class: 'rotina-texto' }, item.texto),
      eloDoHabito(item),
    ),
  );
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
            estado.rotinaAtiva = r.id;
            salvar();
            redesenhar();
          },
        },
        r.nome,
      ),
    ),
  );

  raiz.replaceChildren(
    faixa,
    h(
      'div',
      { class: 'cabecalho' },
      h(
        'div',
        {},
        h('h2', {}, ativa.nome),
        h('p', { class: 'sub' }, itens.length ? `${feitos} de ${itens.length} hoje` : 'Sem itens'),
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'botao-icone',
          'aria-label': 'Desfazer a última marca',
          disabled: feitos === 0,
          onclick: () => desfazerUltimaMarca(ativa),
        },
        icone('desfazer'),
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
    ),
    h(
      'div',
      { class: 'progresso' },
      h('div', { class: 'progresso-barra', style: { width: `${porcento}%` } }),
    ),
    itens.length
      ? h(
          'ul',
          { class: 'cartao' },
          emOrdemDeExibicao(ativa.itens, marcadas, estado.marcadosNoFim).map((item) =>
            linha(ativa, item, marcadas, comHoras),
          ),
        )
      : estadoVazio('Rotina vazia', 'Abra o menu e toque em Editar rotina.'),
  );
  faixa.scrollLeft = rolagemFaixa;
}

export const rotinas = {
  id: 'rotinas',
  titulo: 'Rotinas',
  rotuloAdicionar: 'Nova rotina',
  render,
  aoAdicionar: () => editarRotina(null),
};
