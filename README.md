# Foco

App de organização pessoal que junta em um lugar só o que costuma ficar espalhado em três:
rotinas do dia, hábitos e tarefas com prazo.

> Nome provisório. Projeto em desenvolvimento.

## O que tem hoje

- **Rotinas**: checklists do dia com seções e horários. As marcas zeram sozinhas no dia seguinte.
- **Hábitos**: grade com um hábito por linha e um dia por coluna (feito, não feito, pulado),
  além de hábitos numéricos com meta diária.
- **Tarefas**: listas com prazo, agrupadas em Atrasadas, Hoje, Amanhã, datas e Sem data.

Os dados ficam só no aparelho (`localStorage`). Nada é enviado para servidor.

## Como rodar

Requer Node.js 18 ou mais novo. Não há dependências nem etapa de build.

```bash
node tools/serve.mjs
```

Abra `http://localhost:8137`.

Para abrir em um celular Android ligado por USB, com a depuração ativada:

```bash
adb reverse tcp:8137 tcp:8137
```

Depois acesse `http://localhost:8137` no Chrome do celular.

## Estrutura

```text
www/                 app em HTML, CSS e JavaScript puro (módulos ES)
  index.html
  css/app.css
  js/app.js          navegação entre as abas
  js/store.js        estado e persistência
  js/ui.js           elementos, ícones e folhas
  js/rotinas.js
  js/habitos.js
  js/tarefas.js
tools/serve.mjs      servidor estático de desenvolvimento
```

## Próximos passos

- Tema claro
- Casca Android (APK) com lembrete de prazo
- Backup e restauração dos dados
