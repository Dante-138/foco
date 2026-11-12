// Tema do app: escuro (padrão), claro ou o do sistema.
// É preferência do aparelho, não dado do usuário, então fica em chave própria
// e pode ser lida cedo por tema-inicial.js.

const CHAVE = 'foco:tema';
const VALIDOS = ['escuro', 'claro', 'sistema'];
const sistemaClaro = window.matchMedia('(prefers-color-scheme: light)');

function lerSalvo() {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (VALIDOS.includes(salvo)) return salvo;
  } catch {
    /* armazenamento indisponível */
  }
  return 'escuro';
}

let escolhido = lerSalvo();

export const temaEscolhido = () => escolhido;

export function aplicarTema() {
  const claro = escolhido === 'claro' || (escolhido === 'sistema' && sistemaClaro.matches);
  document.documentElement.dataset.tema = claro ? 'claro' : 'escuro';

  // A barra de status do sistema acompanha a cor de fundo do tema.
  const fundo = getComputedStyle(document.documentElement).getPropertyValue('--fundo').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', fundo);
}

export function definirTema(valor) {
  if (!VALIDOS.includes(valor)) return;
  escolhido = valor;
  try {
    localStorage.setItem(CHAVE, valor);
  } catch {
    /* sem armazenamento, vale só nesta sessão */
  }
  aplicarTema();
}

// Com "sistema" escolhido, acompanha a troca de tema do aparelho.
sistemaClaro.addEventListener('change', aplicarTema);
