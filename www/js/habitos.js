// Aba Hábitos: grade no estilo do Loop.
// Uma linha por hábito, uma coluna por dia, o dia mais recente à esquerda.

import { estado, salvar } from './store.js';
import { uid } from './nucleo/ids.js';
import { hoje, deIso, somaDias } from './nucleo/datas.js';
import { LIMITES } from './nucleo/esquema.js';
import { CORES, COR_PADRAO, corValida } from './nucleo/paleta.js';
import { formatar, lerNumero, metaDe, cumprido, proximaMarca, taxa } from './nucleo/habito-calculo.js';
import { h, svg, icone, abrirFolha, confirmar, campo, estadoVazio, redesenhar, vibrar } from './ui.js';

const corCss = (chave) => `var(--cor-${corValida(chave) ? chave : COR_PADRAO})`;

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// A célula que acabou de ser marcada, para o próximo desenho animar só ela:
// { habitoId, dia, concluiu }. O desenho consome e zera.
let recemMarcada = null;

const acabouDeConcluir = (habito) => recemMarcada?.habitoId === habito.id && recemMarcada.concluiu;

// Classe de animação para a célula que acabou de ser marcada; vazio para as outras.
function respostaAoToque(habito, dia) {
  if (recemMarcada?.habitoId !== habito.id || recemMarcada.dia !== dia) return '';
  return recemMarcada.concluiu ? ' concluiu' : ' marcou';
}

// Anel de progresso: fração de dias cumpridos na última semana.
function anel(habito, diaHoje) {
  const raio = 7;
  const volta = 2 * Math.PI * raio;
  const fracao = taxa(habito, estado.registros[habito.id] ?? {}, diaHoje);
  const circulo = { cx: 10, cy: 10, r: raio, fill: 'none', stroke: 'currentColor', 'stroke-width': 3 };
  return h(
    'span',
    { class: `anel${acabouDeConcluir(habito) ? ' pulsa' : ''}` },
    svg(
      'svg',
      { viewBox: '0 0 20 20', width: 20, height: 20, 'aria-hidden': 'true' },
      svg('circle', { ...circulo, 'stroke-opacity': 0.22 }),
      svg('circle', {
        ...circulo,
        'stroke-linecap': 'round',
        'stroke-dasharray': `${(fracao * volta).toFixed(2)} ${volta.toFixed(2)}`,
        transform: 'rotate(-90 10 10)',
      }),
    ),
  );
}

// ---------------------------------------------------------------- ações

function gravar(habito, dia, valor) {
  const registro = (estado.registros[habito.id] ??= {});
  if (valor == null) delete registro[dia];
  else registro[dia] = valor;
  salvar();

  // Resposta ao toque: a marca nova dá um pulo; cumprir o hábito ganha destaque e vibração própria.
  const concluiu = cumprido(habito, valor);
  recemMarcada = { habitoId: habito.id, dia, concluiu };
  vibrar(concluiu ? 'concluido' : 'toque');
  redesenhar();
}

function alternar(habito, dia) {
  gravar(habito, dia, proximaMarca(estado.registros[habito.id]?.[dia]));
}

function rotuloDia(dia, diaHoje) {
  if (dia === diaHoje) return 'hoje';
  const data = deIso(dia);
  return `${DIAS_SEMANA[data.getDay()]}., dia ${data.getDate()}`;
}

function pedirValor(habito, dia) {
  const atual = estado.registros[habito.id]?.[dia];
  const entrada = h('input', {
    class: 'entrada',
    type: 'text',
    inputMode: 'decimal',
    value: typeof atual === 'number' ? formatar(atual) : '',
    placeholder: '0',
    autocomplete: 'off',
  });

  const aoSalvar = (e) => {
    e.preventDefault();
    const texto = entrada.value.trim();
    const valor = texto ? lerNumero(texto) : null;
    if (texto && valor == null) {
      entrada.select();
      return;
    }
    fechar();
    gravar(habito, dia, valor);
  };

  const unidade = habito.unidade ? ` ${habito.unidade}` : '';
  const fechar = abrirFolha({
    titulo: `${habito.nome} (${rotuloDia(dia, hoje())})`,
    corpo: h(
      'form',
      { class: 'folha-form', onsubmit: aoSalvar },
      campo(
        `Quantidade${unidade ? ` em${unidade}` : ''}, meta ${formatar(metaDe(habito))}${unidade}`,
        entrada,
      ),
      h(
        'div',
        { class: 'linha-botoes' },
        h(
          'button',
          {
            type: 'button',
            class: 'botao',
            onclick: () => {
              fechar();
              gravar(habito, dia, 'pulado');
            },
          },
          'Pular o dia',
        ),
        h('span', { class: 'espaco' }),
        h('button', { type: 'button', class: 'botao', onclick: () => fechar() }, 'Cancelar'),
        h('button', { type: 'submit', class: 'botao cheio' }, 'Salvar'),
      ),
    ),
  });
  entrada.focus();
  entrada.select();
}

function mover(habito, passo) {
  const de = estado.habitos.indexOf(habito);
  const para = de + passo;
  if (de < 0 || para < 0 || para >= estado.habitos.length) return;
  estado.habitos.splice(de, 1);
  estado.habitos.splice(para, 0, habito);
  salvar();
  redesenhar();
}

function editarHabito(habito) {
  let cor = habito?.cor ?? CORES[0].chave;
  let tipo = habito?.tipo ?? 'simnao';

  const nome = h('input', {
    class: 'entrada',
    type: 'text',
    value: habito?.nome ?? '',
    placeholder: 'Ex.: Leitura - 1h',
    maxLength: LIMITES.nomeHabito,
    required: true,
  });
  const unidade = h('input', {
    class: 'entrada',
    type: 'text',
    value: habito?.unidade ?? '',
    placeholder: 'copos',
    maxLength: LIMITES.unidade,
  });
  const meta = h('input', {
    class: 'entrada',
    type: 'text',
    inputMode: 'decimal',
    value: habito?.meta != null ? formatar(habito.meta) : '',
    placeholder: '1',
  });

  const amostras = h('div', { class: 'amostras', role: 'radiogroup', 'aria-label': 'Cor' });
  const desenharCores = () => {
    amostras.replaceChildren(
      ...CORES.map((c) =>
        h('button', {
          type: 'button',
          class: `amostra${c.chave === cor ? ' ativa' : ''}`,
          style: { '--cor': corCss(c.chave) },
          role: 'radio',
          'aria-checked': String(c.chave === cor),
          'aria-label': c.nome,
          onclick: () => {
            cor = c.chave;
            desenharCores();
          },
        }),
      ),
    );
  };

  const camposNumero = h('div', { class: 'dupla' }, campo('Unidade', unidade), campo('Meta por dia', meta));
  const segmentos = h('div', { class: 'segmentos' });
  const desenharTipo = () => {
    segmentos.replaceChildren(
      ...[
        ['simnao', 'Sim ou não'],
        ['numero', 'Numérico'],
      ].map(([valor, rotulo]) =>
        h(
          'button',
          {
            type: 'button',
            class: `segmento${tipo === valor ? ' ativo' : ''}`,
            'aria-pressed': String(tipo === valor),
            onclick: () => {
              tipo = valor;
              desenharTipo();
            },
          },
          rotulo,
        ),
      ),
    );
    camposNumero.hidden = tipo !== 'numero';
  };

  desenharCores();
  desenharTipo();

  const aoSalvar = (e) => {
    e.preventDefault();
    const nomeFinal = nome.value.trim();
    if (!nomeFinal) {
      nome.value = '';
      nome.reportValidity();
      return;
    }

    const dados = { nome: nomeFinal, cor, tipo, unidade: null, meta: null };
    if (tipo === 'numero') {
      dados.unidade = unidade.value.trim() || null;
      dados.meta = lerNumero(meta.value) || 1;
    }

    if (habito) Object.assign(habito, dados);
    else estado.habitos.push({ id: uid(), ...dados });
    salvar();
    fechar();
    redesenhar();
  };

  const excluir = async () => {
    if (!(await confirmar(`Excluir o hábito "${habito.nome}" e todo o histórico dele?`))) return;
    estado.habitos = estado.habitos.filter((x) => x.id !== habito.id);
    delete estado.registros[habito.id];
    salvar();
    fechar();
    redesenhar();
  };

  const fechar = abrirFolha({
    titulo: habito ? 'Editar hábito' : 'Novo hábito',
    corpo: h(
      'form',
      { class: 'folha-form', onsubmit: aoSalvar },
      campo('Nome', nome),
      h('div', { class: 'rotulo' }, 'Cor', amostras),
      h('div', { class: 'rotulo' }, 'Tipo', segmentos),
      camposNumero,
      habito
        ? h(
            'div',
            { class: 'linha-botoes' },
            h(
              'button',
              { type: 'button', class: 'botao com-icone', onclick: () => mover(habito, -1) },
              icone('cima', { tam: 20 }),
              'Subir',
            ),
            h(
              'button',
              { type: 'button', class: 'botao com-icone', onclick: () => mover(habito, 1) },
              icone('baixo', { tam: 20 }),
              'Descer',
            ),
            h('span', { class: 'espaco' }),
          )
        : null,
      h(
        'div',
        { class: 'linha-botoes' },
        habito ? h('button', { type: 'button', class: 'botao perigo', onclick: excluir }, 'Excluir') : null,
        h('span', { class: 'espaco' }),
        h('button', { type: 'button', class: 'botao', onclick: () => fechar() }, 'Cancelar'),
        h('button', { type: 'submit', class: 'botao cheio' }, 'Salvar'),
      ),
    ),
  });

  if (!habito) nome.focus();
}

// --------------------------------------------------------------- desenho

function celula(habito, dia, diaHoje) {
  const valor = estado.registros[habito.id]?.[dia];
  const base = { type: 'button' };
  const resposta = respostaAoToque(habito, dia);

  if (habito.tipo === 'numero') {
    const pulado = valor === 'pulado';
    const numero = typeof valor === 'number' ? valor : null;
    const estadoTexto = pulado ? 'pulado' : `${formatar(numero ?? 0)} ${habito.unidade ?? ''}`.trim();
    return h(
      'button',
      {
        ...base,
        class: `cel num${numero == null && !pulado ? ' vazio' : ''}${numero != null && !cumprido(habito, numero) ? ' parcial' : ''}${resposta}`,
        'aria-label': `${habito.nome}, ${rotuloDia(dia, diaHoje)}: ${estadoTexto}`,
        onclick: () => pedirValor(habito, dia),
      },
      pulado
        ? icone('menos', { tam: 20 })
        : [h('b', {}, formatar(numero ?? 0)), habito.unidade ? h('small', {}, habito.unidade) : null],
    );
  }

  const marca = valor === 'feito' ? 'check' : valor === 'pulado' ? 'menos' : 'x';
  const estadoTexto = valor === 'feito' ? 'feito' : valor === 'pulado' ? 'pulado' : 'não feito';
  return h(
    'button',
    {
      ...base,
      class: `cel${marca === 'x' ? ' vazio' : ''}${resposta}`,
      'aria-label': `${habito.nome}, ${rotuloDia(dia, diaHoje)}: ${estadoTexto}`,
      onclick: () => alternar(habito, dia),
    },
    icone(marca, { tam: marca === 'x' ? 16 : 20 }),
  );
}

function render(raiz) {
  if (!estado.habitos.length) {
    raiz.replaceChildren(estadoVazio('Nenhum hábito ainda', 'Toque em + para criar o primeiro.'));
    return;
  }

  // Quantos dias cabem: célula de 44 px (igual ao --cel do CSS), e o nome do
  // hábito fica com pelo menos 44% da largura. No Galaxy A36 isso dá 6 dias.
  const largura = (raiz.clientWidth || window.innerWidth) - 18;
  const n = Math.max(3, Math.min(10, Math.floor((largura * 0.56) / 44)));
  const diaHoje = hoje(); // uma leitura do relógio por desenho: cabeçalho e células usam o mesmo dia
  const dias = Array.from({ length: n }, (_, i) => somaDias(diaHoje, -i));

  raiz.replaceChildren(
    h(
      'div',
      { class: 'grade', style: { '--n': String(n) } },
      h(
        'div',
        { class: 'grade-cab' },
        h('span'),
        dias.map((dia) => {
          const data = deIso(dia);
          return h(
            'div',
            { class: `dia${dia === diaHoje ? ' hoje' : ''}` },
            h('span', {}, DIAS_SEMANA[data.getDay()]),
            h('b', {}, data.getDate()),
          );
        }),
      ),
      estado.habitos.map((habito) =>
        h(
          'div',
          { class: 'habito', style: { '--cor': corCss(habito.cor) } },
          h(
            'button',
            {
              type: 'button',
              class: 'habito-nome',
              'aria-label': `Editar ${habito.nome}`,
              onclick: () => editarHabito(habito),
            },
            anel(habito, diaHoje),
            h('span', {}, habito.nome),
          ),
          dias.map((dia) => celula(habito, dia, diaHoje)),
        ),
      ),
    ),
  );
  recemMarcada = null; // a animação é só do desenho logo depois do toque
}

export const habitos = {
  id: 'habitos',
  titulo: 'Hábitos',
  rotuloAdicionar: 'Novo hábito',
  render,
  aoAdicionar: () => editarHabito(null),
};
