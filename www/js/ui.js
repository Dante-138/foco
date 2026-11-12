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

// Botão voltar. Cada folha aberta ocupa uma entrada no histórico do navegador:
// assim o voltar (gesto ou botão do Android, ou o do navegador) fecha a folha
// de cima em vez de sair do app. A conta é sempre uma entrada por folha aberta.
const folhasAbertas = []; // pilha: a última é a folha de cima
let voltasPorCodigo = 0; // history.back() chamados ao fechar pelo app, que o ouvinte deve ignorar

window.addEventListener('popstate', () => {
  if (voltasPorCodigo > 0) {
    voltasPorCodigo -= 1;
    return;
  }
  const topo = folhasAbertas.at(-1);
  if (!topo) return;
  if (topo.aoTentarFechar) {
    // A folha vai perguntar antes de fechar: devolve a entrada que o voltar consumiu.
    window.history.pushState({ folha: true }, '');
    topo.aoTentarFechar();
  } else {
    topo.fecharPeloVoltar();
  }
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
  const registro = { aoTentarFechar, fecharPeloVoltar: null };
  let finalizado = false;
  // peloVoltar: o histórico já andou sozinho; nos outros casos quem anda é o app.
  const finalizar = (peloVoltar) => {
    if (finalizado) return;
    finalizado = true;
    const posicao = folhasAbertas.indexOf(registro);
    if (posicao >= 0) folhasAbertas.splice(posicao, 1);
    if (!peloVoltar) {
      voltasPorCodigo += 1;
      window.history.back();
    }
    dialogo.remove();
    aoFechar?.();
  };
  const fechar = () => {
    if (dialogo.open) dialogo.close();
    finalizar(false);
  };
  registro.fecharPeloVoltar = () => {
    if (dialogo.open) dialogo.close();
    finalizar(true);
  };
  dialogo.addEventListener('close', () => finalizar(false));

  folhasAbertas.push(registro);
  window.history.pushState({ folha: true }, '');

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
