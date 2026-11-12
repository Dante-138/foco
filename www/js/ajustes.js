// Folha de ajustes do app. Por enquanto, só a aparência.

import { h, abrirFolha } from './ui.js';
import { temaEscolhido, definirTema } from './tema.js';

const TEMAS = [
  ['escuro', 'Escuro'],
  ['claro', 'Claro'],
  ['sistema', 'Sistema'],
];

export function abrirAjustes() {
  const segmentos = h('div', { class: 'segmentos', role: 'radiogroup', 'aria-label': 'Aparência' });
  const desenhar = () => {
    segmentos.replaceChildren(
      ...TEMAS.map(([valor, rotulo]) =>
        h(
          'button',
          {
            type: 'button',
            class: `segmento${temaEscolhido() === valor ? ' ativo' : ''}`,
            role: 'radio',
            'aria-checked': String(temaEscolhido() === valor),
            onclick: () => {
              definirTema(valor);
              desenhar();
            },
          },
          rotulo,
        ),
      ),
    );
  };
  desenhar();

  const fechar = abrirFolha({
    titulo: 'Ajustes',
    corpo: h(
      'div',
      { class: 'folha-form' },
      h('div', { class: 'rotulo' }, 'Aparência', segmentos),
      h(
        'div',
        { class: 'linha-botoes' },
        h('button', { type: 'button', class: 'botao', onclick: () => fechar() }, 'Fechar'),
      ),
    ),
  });
}
