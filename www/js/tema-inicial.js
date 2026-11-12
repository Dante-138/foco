// Aplica o tema antes do primeiro desenho da página, para não piscar o tema errado.
// Script clássico e síncrono no <head>; a mesma regra está em tema.js (aplicarTema).
(function () {
  let escolhido = null;
  try {
    escolhido = localStorage.getItem('foco:tema');
  } catch {
    /* armazenamento indisponível: fica o tema padrão */
  }
  const claro =
    escolhido === 'claro' ||
    (escolhido === 'sistema' && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.tema = claro ? 'claro' : 'escuro';
})();
