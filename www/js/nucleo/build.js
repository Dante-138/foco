// Texto do carimbo do build mostrado em Ajustes: versão, commit e data.
// Sem commit, o app está rodando direto do repositório (servidor de desenvolvimento).

// data: 'AAAA-MM-DDTHH:MM' no horário de quem compilou; vira 'DD/MM/AAAA HH:MM'.
function dataLegivel(data) {
  const [dia, hora] = data.split('T');
  const [ano, mes, diaDoMes] = dia.split('-');
  return `${diaDoMes}/${mes}/${ano} ${hora}`;
}

export function descreverBuild({ versao, commit, data }) {
  const partes = [`Versão ${versao}`, commit ?? 'desenvolvimento'];
  if (commit && data) partes.push(dataLegivel(data));
  return partes.join(' · ');
}
