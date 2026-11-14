# Foco

App de organização pessoal que junta em um lugar só o que costuma ficar espalhado em três:
rotinas do dia, hábitos e tarefas com prazo.

> Nome provisório. Projeto em desenvolvimento.

## O que tem hoje

- **Rotinas**: checklists do dia com seções e horários. As marcas zeram sozinhas no dia seguinte.
  O item marcado desce para o fim da seção, e um botão desfaz a última marca. Um item pode ser
  ligado a um hábito: marcar o item marca o hábito no dia.
- **Hábitos**: grade com um hábito por linha e um dia por coluna (feito, não feito, pulado),
  além de hábitos numéricos com meta diária. O anel mostra a pontuação do hábito, e a edição
  mostra as sequências. Um filtro esconde os já resolvidos no dia e os arquivados.
- **Tarefas**: listas com prazo e horário, agrupadas em Atrasadas, Hoje, Amanhã, datas e Sem data,
  ou em outra ordem (estrela, título, mais recentes). Uma tarefa pode se repetir a cada N dias,
  semanas, meses ou anos.
- **Lembretes**: no app Android, a tarefa com prazo avisa por notificação, na hora marcada ou
  às 9h quando só tem a data.
- **Gestos**: deslizar o dedo para o lado troca de aba.
- **Tema**: escuro (padrão), claro ou o do sistema, em Ajustes.
- **Backup**: em Ajustes, copiar todos os dados como texto e restaurar colando esse texto.
  O app confere o que foi colado e pede confirmação antes de substituir.

## Como rodar

Requer Node.js 22.8 ou mais novo. No navegador o app não tem dependências nem etapa de build;
o app Android usa o Capacitor e o plugin de notificações locais dele.

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

Fora o Capacitor, as dependências são só de desenvolvimento (ESLint, Prettier e playwright-core). Os testes usam
o executor nativo do Node; os de ponta a ponta abrem o Google Chrome instalado na máquina.

```bash
npm install         # uma vez
npm run dev         # servidor local em http://localhost:8137
npm run check       # lint, formatação, testes de unidade e de ponta a ponta
npm run commits     # confere as mensagens de commit do branch contra a main
npm run format      # formata o código com o Prettier
```

## APK Android

O app é empacotado com o Capacitor (pasta `android/`). O APK é compilado dentro do Docker:
não é preciso instalar Java nem Android Studio.

A assinatura usa uma chave fixa, criada uma vez e guardada fora do repositório, em uma pasta
com dois arquivos: `foco.jks` (a keystore) e `assinatura.properties` (modelo em
`docker/android/assinatura.properties.exemplo`). Um APK assinado com outra chave só instala
depois de desinstalar o app, e isso apaga os dados. Por isso a chave nunca muda e precisa de
cópia de segurança.

```bash
pwsh tools/apk.ps1 -AceitoLicencaAndroid
```

- `-AceitoLicencaAndroid` declara o aceite da
  [licença do Android SDK](https://developer.android.com/studio/terms), exigido para baixá-lo.
- O APK sai em `saida/foco.apk`. Para instalar com o celular ligado por USB:
  `adb install -r saida/foco.apk`.
- No fim o script apaga do Docker tudo o que criou (imagem, volume e construtor de build) e
  nada além disso. Para vários builds seguidos, use `-Manter` e termine com `-Limpar`.
- `-Simular` mostra os comandos sem executar.
- `-Tipo debug` gera `saida/foco-debug.apk`: o mesmo app, com a mesma chave, mas
  inspecionável pelo cabo USB. Um instala por cima do outro sem apagar os dados.

## Portão de qualidade

Nada entra na `main` sem pull request, e o merge só é liberado com o job `Gate` do CI verde.
A regra vale também para o dono do repositório. O portão confere, nesta ordem:

1. **Mensagens de commit e título do PR** no padrão Conventional Commits, com até 72 caracteres
   e sem linha de coautoria.
2. **Lint sem nenhum aviso**, e sem comentário de exceção: o `eslint-disable` é proibido.
   Além dos erros comuns, o lint impõe a estrutura descrita abaixo.
3. **Formatação** conferida pelo Prettier.
4. **Testes de unidade** com cobertura de 100% de linhas, desvios e funções do núcleo.
   Um módulo novo no núcleo sem teste reprova.
5. **Testes de ponta a ponta** em um Chrome real: os fluxos das três abas, o tema, dados
   salvos com problema, duas abas abertas e a política de segurança. Qualquer erro no console
   da página reprova.

O merge é sempre por squash: cada pull request vira um commit na `main`, com o título do PR.

## Estrutura

O código tem duas camadas, e o lint impede que elas se misturem.

```text
www/js/nucleo/          lógica pura: roda sem navegador, não toca DOM nem armazenamento
  esquema.js            formato dos dados e a validação que impõe esse formato
  estado.js             leitura do estado salvo: JSON, migração e validação
  backup.js             conferência do texto de backup antes de restaurar
  migracao.js           atualização de dados de versões anteriores
  rotina-texto.js       conversão entre o texto do editor e os itens da rotina
  rotina-ordem.js       ordem de exibição dos itens (marcados no fim) e o desfazer
  ligacao.js            item de rotina ligado a hábito
  prazos.js             ordenação e agrupamento das tarefas por prazo
  repeticao.js          tarefas que se repetem: próxima data
  lembretes.js          plano de notificações das tarefas com prazo
  habito-calculo.js     leitura de números, metas, pontuação, sequências e filtros
  gesto.js              deslize do dedo para trocar de aba
  datas.js              datas no fuso local
  paleta.js             cores dos hábitos
  ids.js                identificadores

www/js/                 interface: monta o DOM e chama o núcleo
  app.js                ponto de entrada e navegação entre as abas
  store.js              único módulo de dados que acessa o armazenamento
  ui.js                 elementos, ícones e folhas
  rotinas.js, habitos.js, tarefas.js
  lembretes.js          agenda as notificações pelo plugin do Capacitor
  ajustes.js, tema.js, tema-inicial.js

tests/unidade/          testes do núcleo e das ferramentas (node --test)
tests/e2e/              testes de ponta a ponta no Chrome
tools/                  servidor de desenvolvimento e portão de commits
```

## Dados e segurança

- Os dados ficam só no aparelho (`localStorage`). O app não faz nenhuma conexão de rede, e a
  política de segurança da página (CSP) bloqueia qualquer tentativa.
- Todo dado lido do armazenamento passa por migração e validação antes de chegar à interface.
  O que dá para aproveitar é corrigido, o resto é descartado, e uma cópia do conteúdo original
  fica guardada quando há correção.
- Dados gravados por uma versão mais nova do app nunca são sobrescritos: o app avisa e não abre.
- A interface não usa HTML em texto. O DOM é montado elemento por elemento, o lint proíbe
  `innerHTML` e a página exige Trusted Types.
- Permissões do app Android: notificações (a única que o Android pergunta, para os lembretes das
  tarefas), vibrar (resposta ao toque), iniciar com o aparelho e manter o processador acordado
  (o plugin reagenda os lembretes depois de reiniciar) e internet (vem da casca do Capacitor; a
  página não faz conexões). Os lembretes são agendados no próprio aparelho, sem servidor, e como
  alarmes não exatos: podem atrasar alguns minutos, e a permissão de alarme exato é retirada.

## Próximos passos

O roteiro está nas [issues](https://github.com/Dante-138/foco/issues) e nos
[milestones](https://github.com/Dante-138/foco/milestones) do repositório.
