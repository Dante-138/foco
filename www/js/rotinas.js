// Aba Rotinas: checklists do dia, com seções e horários.
// As marcas valem para o dia corrente e zeram sozinhas no dia seguinte.

import { estado, salvar, marcasDeHoje } from './store.js';
import { uid } from './nucleo/ids.js';
import { LIMITES } from './nucleo/esquema.js';
import { textoParaItens, itensParaTexto } from './nucleo/rotina-texto.js';
import { h, icone, abrirFolha, abrirMenu, confirmar, campo, estadoVazio, redesenhar } from './ui.js';

// ---------------------------------------------------------------- ações

function alternarItem(rotina, item) {
  const marcas = marcasDeHoje();
  const atuais = new Set(marcas[rotina.id] ?? []);
  if (atuais.has(item.id)) atuais.delete(item.id);
  else atuais.add(item.id);
  marcas[rotina.id] = [...atuais];
  salvar();
  redesenhar();
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
      rotulo: 'Desmarcar tudo',
      acao: () => {
        delete marcasDeHoje()[rotina.id];
        salvar();
        redesenhar();
      },
    },
    { rotulo: 'Excluir rotina', perigo: true, acao: () => excluirRotina(rotina) },
  ]);
}

// --------------------------------------------------------------- desenho

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
          ativa.itens.map((item) => linha(ativa, item, marcadas, comHoras)),
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
