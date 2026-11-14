// Ligação entre item de rotina e hábito: marcar o item marca o hábito no dia.
// Vale em um sentido só, da rotina para o hábito.

// Valor novo do registro de hoje do hábito quando um item ligado a ele é marcado ou
// desmarcado. Devolve null quando o dia fica sem registro.
//   sim ou não: marcar vira "feito"; desmarcar tira o "feito", a não ser que outro
//               item ligado ao mesmo hábito continue marcado (outrosMarcados > 0).
//   numérico:   cada item marcado soma 1; desmarcar tira 1, sem ficar negativo.
// Dia pulado só é desfeito por uma marca nova; desmarcar não mexe nele.
export function registroAposItem(habito, atual, marcou, outrosMarcados) {
  const semMudar = atual ?? null;

  if (habito.tipo === 'numero') {
    if (!marcou && typeof atual !== 'number') return semMudar;
    const novo = (typeof atual === 'number' ? atual : 0) + (marcou ? 1 : -1);
    return novo > 0 ? novo : null;
  }

  if (marcou) return 'feito';
  if (outrosMarcados > 0 || atual !== 'feito') return semMudar;
  return null;
}

// Para comparar nomes: sem acentos, sem diferença de maiúsculas, espaços simples.
const normalizar = (texto) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Hábito que parece ser o mesmo do item, pelo nome: igual, ou o nome do hábito começa
// com o texto do item e continua com espaço ou pontuação ("Arrumar a Cama" e
// "Arrumar a Cama - <8h"). Devolve o id só quando há exatamente um candidato; hábito
// arquivado não entra. É uma sugestão: quem decide a ligação é a pessoa.
export function sugerirHabito(textoDoItem, habitos) {
  const alvo = normalizar(textoDoItem);
  if (!alvo) return null;
  const candidatos = habitos.filter((habito) => {
    if (habito.arquivado) return false;
    const nome = normalizar(habito.nome);
    return nome.startsWith(alvo) && !/[a-z0-9]/.test(nome.charAt(alvo.length));
  });
  return candidatos.length === 1 ? candidatos[0].id : null;
}
