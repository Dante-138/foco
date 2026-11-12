// Auxiliares de interface: criação de elementos, ícones, folhas e avisos.

// Cria um elemento. Texto entra sempre como nó de texto, nunca como HTML,
// então o que o usuário digita ou cola não é interpretado.
export function h(tag, props, ...filhos) {
  const el = document.createElement(tag);
  for (const [chave, valor] of Object.entries(props ?? {})) {
    if (valor == null || valor === false) continue;
    if (chave === 'class') {
      el.className = valor;
    } else if (chave === 'style') {
      for (const [prop, v] of Object.entries(valor)) el.style.setProperty(prop, v);
    } else if (chave.startsWith('on')) {
      el.addEventListener(chave.slice(2), valor);
    } else if (chave in el) {
      el[chave] = valor;
    } else {
      el.setAttribute(chave, valor === true ? '' : valor);
    }
  }
  for (const filho of filhos.flat(Infinity)) {
    if (filho == null || filho === false) continue;
    el.append(filho.nodeType ? filho : document.createTextNode(String(filho)));
  }
  return el;
}

// Pede ao app para redesenhar a aba atual mantendo a rolagem.
export function redesenhar() {
  document.dispatchEvent(new Event('foco:redesenhar'));
}

// ------------------------------------------------------------------ SVG

const SVG_NS = 'http://www.w3.org/2000/svg';

// Cria um elemento SVG. Como em h(), nada é interpretado como HTML: o app não
// usa innerHTML em lugar nenhum (o lint e a política de segurança da página proíbem).
export function svg(tag, atributos = {}, ...filhos) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [nome, valor] of Object.entries(atributos)) el.setAttribute(nome, String(valor));
  el.append(...filhos);
  return el;
}

const ponto = (cy) => ['circle', { cx: 12, cy, r: 1.7, fill: 'currentColor', stroke: 'none' }];

// Cada ícone é uma lista de formas [tag, atributos] em uma área de 24 x 24.
const ICONES = {
  check: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
  x: [['path', { d: 'M7 7l10 10M17 7L7 17' }]],
  menos: [['path', { d: 'M7 12h10' }]],
  mais: [['path', { d: 'M12 5v14M5 12h14' }]],
  pontos: [ponto(5.5), ponto(12), ponto(18.5)],
  estrela: [['path', { d: 'M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.8l-5.1 2.7 1-5.7-4.1-4 5.7-.8z' }]],
  cima: [['path', { d: 'M6 14.5l6-6 6 6' }]],
  baixo: [['path', { d: 'M6 9.5l6 6 6-6' }]],
  ajustes: [
    ['path', { d: 'M4 7h8M18 7h2M4 17h2M12 17h8' }],
    ['circle', { cx: 15, cy: 7, r: 2.5 }],
    ['circle', { cx: 9, cy: 17, r: 2.5 }],
  ],
  rotinas: [
    ['circle', { cx: 12, cy: 12, r: 8.5 }],
    ['path', { d: 'M12 7.5V12l3 2' }],
  ],
  habitos: [
    ['circle', { cx: 12, cy: 12, r: 8.5 }],
    ['path', { d: 'M8.3 12.3l2.5 2.5 4.9-5.3' }],
  ],
  tarefas: [
    [
      'path',
      {
        d: 'M3.5 6.5L5 8l2.5-3M3.5 12.5L5 14l2.5-3M3.5 18.5L5 20l2.5-3M11 6.5h9.5M11 12.5h9.5M11 18.5h9.5',
      },
    ],
  ],
};

export function icone(nome, { cheio = false, tam = 24 } = {}) {
  const formas = ICONES[nome];
  if (!formas) throw new Error(`Ícone desconhecido: ${nome}`);
  return h(
    'span',
    { class: `icone${cheio ? ' cheio' : ''}` },
    svg(
      'svg',
      {
        viewBox: '0 0 24 24',
        width: tam,
        height: tam,
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
      },
      ...formas.map(([tag, atributos]) => svg(tag, atributos)),
    ),
  );
}

// --------------------------------------------------------------- folhas

// Botão voltar. Enquanto houver folha aberta, o app mantém UMA entrada de guarda
// no histórico do navegador. O voltar (gesto ou botão do Android, ou o do
// navegador) consome essa entrada e fecha a folha de cima em vez de sair do app.
//
// O histórico nunca é mexido na hora em que uma folha abre ou fecha: isso só
// marca que é preciso conferir. A conferência roda depois, uma vez, e compara o
// que deveria existir com o que existe. Assim "fechar uma folha e abrir outra em
// seguida" não gera um vai e volta no histórico, e uma volta pedida pelo app
// nunca corre junto com uma entrada nova.
const folhasAbertas = []; // pilha: a última é a folha de cima
let guardaNoHistorico = false; // a entrada de guarda existe
let voltaEmAndamento = false; // o app pediu history.back() e o popstate ainda não chegou
let acertoAgendado = false;

function acertarHistorico() {
  acertoAgendado = false;
  if (voltaEmAndamento) return; // o popstate dessa volta chama de novo
  const precisaDeGuarda = folhasAbertas.length > 0;
  if (precisaDeGuarda && !guardaNoHistorico) {
    window.history.pushState({ folha: true }, '');
    guardaNoHistorico = true;
  } else if (!precisaDeGuarda && guardaNoHistorico) {
    guardaNoHistorico = false;
    voltaEmAndamento = true;
    window.history.back();
  }
}

function agendarAcerto() {
  if (acertoAgendado) return;
  acertoAgendado = true;
  setTimeout(acertarHistorico, 0);
}

window.addEventListener('popstate', () => {
  if (voltaEmAndamento) {
    // Volta pedida pelo app para retirar a guarda: nada a fechar.
    voltaEmAndamento = false;
    acertarHistorico();
    return;
  }
  // Voltar da pessoa: a guarda foi consumida. Fecha a folha de cima, ou deixa
  // que ela pergunte antes. Se sobrar folha aberta, o acerto repõe a guarda.
  guardaNoHistorico = false;
  const topo = folhasAbertas.at(-1);
  if (topo?.aoTentarFechar) topo.aoTentarFechar();
  else topo?.fechar();
  agendarAcerto();
});

// Folha que sobe do rodapé (bottom sheet). Devolve a função que a fecha.
// aoTentarFechar: chamado no Esc ou no botão voltar, no lugar de fechar direto.
// Serve para a folha perguntar antes de descartar o que foi digitado.
export function abrirFolha({ titulo, corpo, fecharNoFundo = true, aoFechar, aoTentarFechar }) {
  const dialogo = h(
    'dialog',
    { class: 'folha' },
    h(
      'div',
      { class: 'folha-dentro' },
      h('div', { class: 'folha-pega' }),
      titulo ? h('h2', { class: 'folha-titulo' }, titulo) : null,
      corpo,
    ),
  );
  document.body.append(dialogo);

  // A limpeza roda na hora em que fechar() é chamado. O evento "close" do
  // navegador só é entregue no próximo quadro desenhado (e não chega com a
  // página em segundo plano), então fica apenas como rede de segurança.
  const registro = { aoTentarFechar, fechar: null };
  let finalizado = false;
  const finalizar = () => {
    if (finalizado) return;
    finalizado = true;
    const posicao = folhasAbertas.indexOf(registro);
    if (posicao >= 0) folhasAbertas.splice(posicao, 1);
    agendarAcerto();
    dialogo.remove();
    aoFechar?.();
  };
  const fechar = () => {
    if (dialogo.open) dialogo.close();
    finalizar();
  };
  registro.fechar = fechar;
  dialogo.addEventListener('close', finalizar);

  folhasAbertas.push(registro);
  agendarAcerto();

  // Tecla Esc: fechamos nós mesmos, na hora.
  dialogo.addEventListener('cancel', (e) => {
    if (e.target !== dialogo) return;
    e.preventDefault();
    if (aoTentarFechar) aoTentarFechar();
    else fechar();
  });

  if (fecharNoFundo) {
    // Fecha só se o toque começou e terminou no fundo escuro. Sem isso, soltar
    // uma seleção de texto fora da folha fecharia e perderia o que foi digitado.
    let comecouNoFundo = false;
    dialogo.addEventListener('pointerdown', (e) => {
      comecouNoFundo = e.target === dialogo;
    });
    dialogo.addEventListener('click', (e) => {
      if (comecouNoFundo && e.target === dialogo) fechar();
    });
  }

  dialogo.showModal();
  return fechar;
}

export function abrirMenu(titulo, opcoes) {
  const fechar = abrirFolha({
    titulo,
    corpo: h(
      'div',
      { class: 'menu' },
      opcoes.map((o) =>
        h(
          'button',
          {
            type: 'button',
            class: `menu-item${o.perigo ? ' perigo' : ''}`,
            disabled: Boolean(o.desativado),
            onclick: () => {
              fechar();
              o.acao();
            },
          },
          o.rotulo,
        ),
      ),
    ),
  });
}

export function confirmar(mensagem, rotuloSim = 'Excluir') {
  return new Promise((resolver) => {
    let resposta = false;
    const fechar = abrirFolha({
      titulo: mensagem,
      corpo: h(
        'div',
        { class: 'linha-botoes' },
        h('button', { type: 'button', class: 'botao', onclick: () => fechar() }, 'Cancelar'),
        h(
          'button',
          {
            type: 'button',
            class: 'botao perigo',
            onclick: () => {
              resposta = true;
              fechar();
            },
          },
          rotuloSim,
        ),
      ),
      aoFechar: () => resolver(resposta),
    });
  });
}

// ------------------------------------------------------------- diversos

export function campo(rotulo, entrada) {
  return h('label', { class: 'rotulo' }, rotulo, entrada);
}

export function estadoVazio(titulo, dica) {
  return h(
    'div',
    { class: 'sem-conteudo' },
    h('p', { class: 'sem-conteudo-titulo' }, titulo),
    h('p', {}, dica),
  );
}

export function avisar(texto) {
  const el = h('div', { class: 'aviso', role: 'status' }, texto);
  document.body.append(el);
  setTimeout(() => el.remove(), 4000);
}
