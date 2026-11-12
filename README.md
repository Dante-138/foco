# Foco

App de organização pessoal que junta em um lugar só o que costuma ficar espalhado em três:
rotinas do dia, hábitos e tarefas com prazo.

> Nome provisório. Projeto em desenvolvimento.

## O que tem hoje

- **Rotinas**: checklists do dia com seções e horários. As marcas zeram sozinhas no dia seguinte.
- **Hábitos**: grade com um hábito por linha e um dia por coluna (feito, não feito, pulado),
  além de hábitos numéricos com meta diária.
- **Tarefas**: listas com prazo, agrupadas em Atrasadas, Hoje, Amanhã, datas e Sem data.
- **Tema**: escuro (padrão), claro ou o do sistema, em Ajustes.

Os dados ficam só no aparelho (`localStorage`). Nada é enviado para servidor.

## Como rodar

Requer Node.js 22 ou mais novo. O app em si não tem dependências nem etapa de build.

```bash
node tools/serve.mjs
```

Abra `http://localhost:8137`.

Para abrir em um celular Android ligado por USB, com a depuração ativada:

```bash
adb reverse tcp:8137 tcp:8137
```

Depois acesse `http://localhost:8137` no Chrome do celular.

## Desenvolvimento

As dependências são só de desenvolvimento (ESLint e Prettier). Os testes usam o executor
nativo do Node.

```bash
npm install       # uma vez
npm run dev       # servidor local em http://localhost:8137
npm run check     # lint, formatação e testes: o mesmo que o CI roda
npm run format    # formata o código com o Prettier
```

Cada mudança entra por pull request, e o CI precisa passar antes do merge.
As mensagens de commit seguem o padrão Conventional Commits.

## Estrutura

```text
www/                    app em HTML, CSS e JavaScript puro (módulos ES)
  index.html
  css/app.css
  js/app.js             navegação entre as abas
  js/store.js           estado e persistência
  js/migracao.js        atualização de dados de versões anteriores
  js/ui.js              elementos, ícones e folhas
  js/tema.js            tema claro, escuro ou do sistema
  js/tema-inicial.js    aplica o tema antes do primeiro desenho
  js/ajustes.js         folha de ajustes
  js/rotinas.js         aba Rotinas
  js/rotina-texto.js    conversão entre o texto do editor e os itens
  js/habitos.js         aba Hábitos
  js/habito-calculo.js  metas e taxa de cumprimento
  js/tarefas.js         aba Tarefas
  js/prazos.js          ordenação e agrupamento por prazo
  js/datas.js           datas no fuso local
  js/ids.js             identificadores
tests/                  testes da lógica (node --test)
tools/serve.mjs         servidor estático de desenvolvimento
```

## Próximos passos

O roteiro está nas [issues](https://github.com/Dante-138/foco/issues) e nos
[milestones](https://github.com/Dante-138/foco/milestones) do repositório.
