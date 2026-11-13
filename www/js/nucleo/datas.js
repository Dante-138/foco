// Datas do app: sempre no fuso local, no formato AAAA-MM-DD.
// toISOString() devolve UTC e viraria o dia às 21h no horário de Brasília.

const FORMATO_ISO = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

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

// Dias corridos de "de" até "ate" (negativo se "ate" vem antes). O arredondamento
// absorve a hora a mais ou a menos dos dias de mudança de horário de verão.
export function diasEntre(de, ate) {
  return Math.round((deIso(ate) - deIso(de)) / 86_400_000);
}

// Aceita só datas reais no formato AAAA-MM-DD: "2026-02-30" e "2026-1-5" são recusadas.
export function dataValida(valor) {
  return typeof valor === 'string' && FORMATO_ISO.test(valor) && isoLocal(deIso(valor)) === valor;
}

// Aceita só horários de 00:00 a 23:59, com dois dígitos em cada parte.
export function horaValida(valor) {
  return typeof valor === 'string' && FORMATO_HORA.test(valor);
}
