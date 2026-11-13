// Ponto de entrada: navegação entre as três abas e redesenho.

import { CHAVE, estado, salvar, problemaDeCarga, correcoesNaCarga } from './store.js';
import { hoje } from './nucleo/datas.js';
import { PROBLEMA } from './nucleo/estado.js';
import { passoDoDeslize, vizinha } from './nucleo/gesto.js';
import { h, icone, avisar, estadoVazio } from './ui.js';
import { rotinas } from './rotinas.js';
import { habitos } from './habitos.js';
import { tarefas } from './tarefas.js';
import { aplicarTema } from './tema.js';
import { abrirAjustes } from './ajustes.js';
import { agendarSincronia } from './lembretes.js';

// Cada aba expõe: id, titulo, rotuloAdicionar, render(raiz), aoAdicionar() e, se quiser,
// flutuante(): devolve { icone, rotulo, acao } para o botão flutuante menor, ou null.
const ABAS = [rotinas, habitos, tarefas];

const titulo = document.getElementById('titulo');
const conteudo = document.getElementById('conteudo');
const fab = document.getElementById('fab');
const fabSecundario = document.getElementById('fab-secundario');
let acaoSecundaria = null;
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

  const flutuante = aba.flutuante?.() ?? null;
  acaoSecundaria = flutuante?.acao ?? null;
  fabSecundario.hidden = !flutuante;
  if (flutuante) {
    fabSecundario.setAttribute('aria-label', flutuante.rotulo);
    fabSecundario.replaceChildren(icone(flutuante.icone, { tam: 22 }));
  }

  nav.replaceChildren(
    ...ABAS.map((a) =>
      h(
        'button',
        {
          type: 'button',
          class: `aba${a.id === aba.id ? ' ativa' : ''}`,
          'aria-current': a.id === aba.id ? 'page' : null,
          onclick: () => irParaAba(a.id),
        },
        h('span', { class: 'pilula' }, icone(a.id)),
        a.titulo,
      ),
    ),
  );
}

// Troca de aba, pelo toque na barra ou pelo deslize. O conteúdo novo entra do
// lado para onde a pessoa foi: da direita ao avançar, da esquerda ao voltar.
function irParaAba(id) {
  const de = ABAS.indexOf(abaAtual());
  const para = ABAS.findIndex((a) => a.id === id);
  if (para < 0 || para === de) return;

  estado.aba = id;
  salvar();
  desenhar();

  conteudo.classList.remove('entra-da-direita', 'entra-da-esquerda');
  void conteudo.offsetWidth; // recomeça a animação se a troca anterior ainda não tinha terminado
  conteudo.classList.add(para > de ? 'entra-da-direita' : 'entra-da-esquerda');
}

// Deslizar o dedo para o lado troca de aba, como virar a página: para a
// esquerda vai à aba da direita, para a direita volta à da esquerda.
function ligarDeslize() {
  let inicio = null;

  conteudo.addEventListener(
    'touchstart',
    (e) => {
      // Com dois dedos não é deslize. Dentro de uma faixa que rola para os lados
      // (rotinas, listas), o gesto é da faixa.
      const vale = e.touches.length === 1 && !e.target.closest('.faixa');
      inicio = vale ? { x: e.touches[0].clientX, y: e.touches[0].clientY, quando: e.timeStamp } : null;
    },
    { passive: true },
  );

  conteudo.addEventListener(
    'touchend',
    (e) => {
      if (!inicio) return;
      const fim = e.changedTouches[0];
      const passo = passoDoDeslize({
        dx: fim.clientX - inicio.x,
        dy: fim.clientY - inicio.y,
        ms: e.timeStamp - inicio.quando,
      });
      inicio = null;
      if (passo) irParaAba(ABAS[vizinha(ABAS.indexOf(abaAtual()), passo, ABAS.length)].id);
    },
    { passive: true },
  );

  conteudo.addEventListener(
    'touchcancel',
    () => {
      inicio = null;
    },
    { passive: true },
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
  fabSecundario.addEventListener('click', () => acaoSecundaria?.());

  botaoAjustes.append(icone('ajustes'));
  botaoAjustes.addEventListener('click', abrirAjustes);

  ligarDeslize();
  conteudo.addEventListener('animationend', (e) => {
    if (e.target === conteudo) conteudo.classList.remove('entra-da-direita', 'entra-da-esquerda');
  });

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
    if (document.hidden) return;
    conferirDia();
    agendarSincronia(); // lembrete que já passou sai do plano
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

  // Lembretes: o que está agendado no sistema acompanha os dados salvos.
  window.addEventListener('foco:salvo', agendarSincronia);
  agendarSincronia();

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
