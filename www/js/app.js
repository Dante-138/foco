// Ponto de entrada: navegação entre as três abas e redesenho.

import { CHAVE, estado, salvar, problemaDeCarga, correcoesNaCarga } from './store.js';
import { hoje } from './nucleo/datas.js';
import { PROBLEMA } from './nucleo/estado.js';
import { h, icone, avisar, estadoVazio } from './ui.js';
import { rotinas } from './rotinas.js';
import { habitos } from './habitos.js';
import { tarefas } from './tarefas.js';
import { aplicarTema } from './tema.js';
import { abrirAjustes } from './ajustes.js';

// Cada aba expõe: id, titulo, rotuloAdicionar, render(raiz), aoAdicionar().
const ABAS = [rotinas, habitos, tarefas];

const titulo = document.getElementById('titulo');
const conteudo = document.getElementById('conteudo');
const fab = document.getElementById('fab');
const nav = document.getElementById('abas');
const botaoAjustes = document.getElementById('ajustes');

const abaAtual = () => ABAS.find((a) => a.id === estado.aba) ?? ABAS[0];

function desenhar({ manterRolagem = false } = {}) {
  const aba = abaAtual();
  const rolagem = conteudo.scrollTop;

  titulo.textContent = aba.titulo;
  document.title = `${aba.titulo} - Foco`;
  fab.setAttribute('aria-label', aba.rotuloAdicionar);
  aba.render(conteudo);
  conteudo.scrollTop = manterRolagem ? rolagem : 0;

  nav.replaceChildren(
    ...ABAS.map((a) =>
      h(
        'button',
        {
          type: 'button',
          class: `aba${a.id === aba.id ? ' ativa' : ''}`,
          'aria-current': a.id === aba.id ? 'page' : null,
          onclick: () => {
            if (estado.aba === a.id) return;
            estado.aba = a.id;
            salvar();
            desenhar();
          },
        },
        h('span', { class: 'pilula' }, icone(a.id)),
        a.titulo,
      ),
    ),
  );
}

// Dados gravados por uma versão mais nova: o app não abre nem grava nada,
// para não estragar o que este código não entende.
function bloquear() {
  titulo.textContent = 'Foco';
  fab.hidden = true;
  nav.hidden = true;
  conteudo.replaceChildren(
    estadoVazio(
      'Atualize o app',
      'Os dados deste aparelho foram gravados por uma versão mais nova do Foco. Nada foi alterado.',
    ),
  );
}

function iniciar() {
  fab.append(icone('mais', { tam: 28 }));
  fab.addEventListener('click', () => abaAtual().aoAdicionar());

  botaoAjustes.append(icone('ajustes'));
  botaoAjustes.addEventListener('click', abrirAjustes);

  document.addEventListener('foco:redesenhar', () => desenhar({ manterRolagem: true }));

  window.addEventListener('foco:falha-ao-salvar', () => {
    avisar('Não foi possível salvar. Confira o armazenamento do navegador.');
  });

  // Outra aba do navegador gravou os dados: recarrega para não trabalhar com
  // uma cópia antiga e sobrescrever o que a outra aba salvou.
  window.addEventListener('storage', (e) => {
    if (e.key === CHAVE || e.key === null) window.location.reload();
  });

  // Virou o dia com o app aberto: as colunas de hábitos, as marcas das rotinas
  // e os grupos de prazo dependem da data, então redesenha.
  let diaVisto = hoje();
  const conferirDia = () => {
    if (hoje() === diaVisto) return;
    diaVisto = hoje();
    desenhar({ manterRolagem: true });
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) conferirDia();
  });
  setInterval(conferirDia, 60_000);

  // A grade de hábitos calcula quantos dias cabem na largura.
  let larguraVista = window.innerWidth;
  let esperaLargura;
  window.addEventListener('resize', () => {
    if (window.innerWidth === larguraVista) return; // teclado abrindo muda só a altura
    larguraVista = window.innerWidth;
    clearTimeout(esperaLargura);
    esperaLargura = setTimeout(() => desenhar({ manterRolagem: true }), 150);
  });

  desenhar();

  if (problemaDeCarga === PROBLEMA.ILEGIVEL) {
    avisar('Os dados salvos estavam ilegíveis. Uma cópia foi guardada e o app começou do zero.');
  } else if (correcoesNaCarga > 0) {
    avisar('Alguns dados salvos estavam inválidos e foram corrigidos.');
  }
}

aplicarTema(); // tema-inicial.js já definiu o tema; aqui acerta a cor da barra do sistema

if (problemaDeCarga === PROBLEMA.VERSAO_MAIS_NOVA) bloquear();
else iniciar();
