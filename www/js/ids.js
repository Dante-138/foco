// Identificadores curtos e únicos para rotinas, itens, hábitos, listas e tarefas.

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
