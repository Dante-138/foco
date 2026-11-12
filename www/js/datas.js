// Datas do app: sempre no fuso local, no formato AAAA-MM-DD.
// toISOString() devolve UTC e viraria o dia às 21h no horário de Brasília.

export function isoLocal(data = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

export const hoje = () => isoLocal();

export function deIso(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

export function somaDias(iso, n) {
  const data = deIso(iso);
  data.setDate(data.getDate() + n);
  return isoLocal(data);
}
