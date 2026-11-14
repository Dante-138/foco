// Resumo do dia para a aba Painel: rotina aberta, hábitos e tarefas de hoje.
// Lógica pura: recebe os dados e a data, devolve só números e listas curtas.

import { cumprido } from './habito-calculo.js';
import { porPrazo } from './prazos.js';

export const PROXIMOS_DA_ROTINA = 3;
export const TAREFAS_NO_PAINEL = 5;

// rotina: a rotina aberta (ou null); marcadas: Set com os ids marcados hoje nela.
// dia: hoje, 'AAAA-MM-DD'.
//   rotina:  itens feitos e total, e os próximos itens que faltam, na ordem da rotina
//   habitos: os não arquivados; pular o dia tira o hábito da conta
//   tarefas: pendentes com prazo até hoje (as atrasadas primeiro), e quantas estão atrasadas
export function resumoDoDia({ rotina, marcadas, habitos, registros, tarefas, dia }) {
  const itens = rotina ? rotina.itens.filter((item) => item.tipo === 'item') : [];
  const contam = habitos.filter((x) => !x.arquivado && registros[x.id]?.[dia] !== 'pulado');
  const paraHoje = tarefas.filter((t) => !t.feita && t.prazo && t.prazo <= dia).sort(porPrazo);

  return {
    rotina: {
      feitos: itens.filter((item) => marcadas.has(item.id)).length,
      total: itens.length,
      proximos: itens.filter((item) => !marcadas.has(item.id)).slice(0, PROXIMOS_DA_ROTINA),
    },
    habitos: {
      feitos: contam.filter((x) => cumprido(x, registros[x.id]?.[dia])).length,
      total: contam.length,
    },
    tarefas: {
      total: paraHoje.length,
      atrasadas: paraHoje.filter((t) => t.prazo < dia).length,
      primeiras: paraHoje.slice(0, TAREFAS_NO_PAINEL),
    },
  };
}
