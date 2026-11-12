// Aba Rotinas: checklists do dia, com seções e horários.
// As marcas valem para o dia corrente e zeram sozinhas no dia seguinte.

import { estado, salvar, uid, marcasDeHoje } from './store.js';
import { h, icone, abrirFolha, abrirMenu, confirmar, campo, estadoVazio, redesenhar } from './ui.js';

// ------------------------------------------------------- texto <-> itens
// A rotina é editada como texto puro, igual a uma nota: uma linha por item,
// "# Nome" abre uma seção e um horário no começo da linha (22:30) é opcional.

const MARCADOR = /^(\[[ xX]?\]|[-*•☐☑✓✔])\s*/; // restos de checklist colado de outro app
const HORARIO = /^(\d{1,2}):(\d{2})\s+(.+)$/;

function linhaParaItem(linha) {
  let texto = linha.trim().replace(MARCADOR, '');
  if (!texto) return null;

  if (texto.startsWith('#')) {
    texto = texto.replace(/^#+\s*/, '');
    return texto ? { tipo: 'secao', texto, hora: null } : null;
  }

  const m = texto.match(HORARIO);
  if (m && Number(m[1]) < 24 && Number(m[2]) < 60) {
    const resto = m[3].replace(/^[-–—]\s*/, '').trim();
    if (resto) return { tipo: 'item', texto: resto, hora: `${m[1].padStart(2, '0')}:${m[2]}` };
  }
  return { tipo: 'item', texto, hora: null };
}

// Reaproveita o id de quem manteve o mesmo texto, para a edição não apagar
// as marcas de hoje. Mudar só o horário de um item preserva a marca.
function textoParaItens(texto, antigos) {
  const chave = (i) => `${i.tipo}|${i.texto}`;
  const livres = new Map();
  for (const antigo of antigos) {
    const fila = livres.get(chave(antigo)) ?? [];
    fila.push(antigo.id);
    livres.set(chave(antigo), fila);
  }
  return texto
    .split(/\r?\n/)
    .map(linhaParaItem)
    .filter(Boolean)
    .map((item) => ({ id: livres.get(chave(item))?.shift() ?? uid(), ...item }));
}

function itensParaTexto(itens) {
  return itens
    .map((i, n) => {
      if (i.tipo === 'secao') return `${n ? '\n' : ''}# ${i.texto}`;
      return i.hora ? `${i.hora} ${i.texto}` : i.texto;
    })
    .join('\n');
}

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
    maxLength: 60,
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

function linha(rotina, item, marcadas) {
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
      item.hora ? h('span', { class: 'hora' }, item.hora) : null,
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
        { type: 'button', class: 'botao-icone', 'aria-label': 'Opções da rotina', onclick: () => menuRotina(ativa) },
        icone('pontos'),
      ),
    ),
    h('div', { class: 'progresso' }, h('div', { class: 'progresso-barra', style: { width: `${porcento}%` } })),
    itens.length
      ? h('ul', { class: 'cartao' }, ativa.itens.map((item) => linha(ativa, item, marcadas)))
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
