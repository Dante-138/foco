<!--
Título: Conventional Commits em inglês, até 72 caracteres, sem ponto final.
Com o merge por squash, é o título que vira o commit na main.
Base: sempre a main. Uma mudança por PR.
Repositório público: nenhum nome de pessoa e nenhum dado pessoal no texto, nos commits ou nos prints.
-->

<!-- Comece com uma ou duas frases: o que muda para quem usa o app. -->

## O que entra

- ...

## Fora do escopo

<!-- O que ficou de fora de propósito, para a revisão não procurar. Apague a seção se não houver. -->

## Formato dos dados

<!--
Se não muda, deixe só a frase abaixo.
Se muda: versão de X para Y, cada campo novo com o valor padrão, o que a migração faz com os
dados antigos e se um app mais antigo recusa o dado novo.
-->

Sem mudança no formato dos dados.

## O que testar no celular

<!-- Passos que alguém segue no aparelho, cada um com o resultado esperado. -->

- [ ] ...

## Prints

<!--
Antes e depois, quando a mudança aparece na tela.
Só com dados de demonstração: nunca hábitos, tarefas ou rotinas reais.
-->

## Riscos

<!-- O que pode quebrar e como voltar atrás. "Nenhum conhecido" vale, se for verdade. -->

## Verificação feita

<!-- O que foi rodado e o que não foi. "Não testado no aparelho" é melhor do que silêncio. -->

- [ ] `npm run check` verde
- [ ] Testado no aparelho
