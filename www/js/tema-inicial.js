// Aplica o tema antes do primeiro desenho da página, para não piscar o tema errado.
// Script clássico e síncrono no <head>; a mesma regra está em tema.js (aplicarTema).
(function () {
  var escolhido = null;
  try {
    escolhido = localStorage.getItem('foco:tema');
  } catch (erro) {
    /* armazenamento indisponível: fica o tema padrão */
  }
  var claro =
    escolhido === 'claro' ||
    (escolhido === 'sistema' && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.tema = claro ? 'claro' : 'escuro';
})();
