// Gesto de deslizar o dedo para o lado.
// Lógica pura: recebe o deslocamento do toque, em pixels, e a duração, em milissegundos.

export const DESLIZE = {
  distanciaMinima: 56, // menos que isso é toque ou tremor do dedo
  inclinacaoMaxima: 0.5, // mais vertical que isso é rolagem da lista
  duracaoMaxima: 600, // mais lento que isso é arrastar, não deslizar
};

// +1: o dedo foi para a esquerda (avança, como virar a página).
// -1: o dedo foi para a direita (volta).
//  0: não foi um deslize para o lado.
export function passoDoDeslize({ dx, dy, ms }) {
  if (![dx, dy, ms].every(Number.isFinite)) return 0;
  if (ms > DESLIZE.duracaoMaxima) return 0;
  if (Math.abs(dx) < DESLIZE.distanciaMinima) return 0;
  if (Math.abs(dy) > Math.abs(dx) * DESLIZE.inclinacaoMaxima) return 0;
  return dx < 0 ? 1 : -1;
}

// Índice da aba de destino: anda um passo e para nas pontas (não dá a volta).
export function vizinha(atual, passo, total) {
  return Math.min(Math.max(atual + passo, 0), total - 1);
}
