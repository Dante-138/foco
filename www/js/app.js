// Ponto de entrada: navegação entre as três abas e redesenho.

import { estado, salvar } from './store.js';
import { hoje } from './datas.js';
import { h, icone, avisar } from './ui.js';
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

fab.append(icone('mais', { tam: 28 }));
fab.addEventListener('click', () => abaAtual().aoAdicionar());

const botaoAjustes = document.getElementById('ajustes');
botaoAjustes.append(icone('ajustes'));
botaoAjustes.addEventListener('click', abrirAjustes);

aplicarTema(); // tema-inicial.js já definiu o tema; aqui acerta a cor da barra do sistema

document.addEventListener('foco:redesenhar', () => desenhar({ manterRolagem: true }));

window.addEventListener('foco:falha-ao-salvar', () => {
  avisar('Não foi possível salvar. Confira o armazenamento do navegador.');
});

// Virou o dia com o app aberto: as colunas de hábitos, as marcas das rotinas
// e os grupos de prazo dependem da data, então redesenha.
let diaVisto = hoje();
function conferirDia() {
  if (hoje() === diaVisto) return;
  diaVisto = hoje();
  desenhar({ manterRolagem: true });
}
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
