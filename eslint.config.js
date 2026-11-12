// Lint rígido: o código inteiro passa sem avisos (--max-warnings 0) e sem
// comentários de exceção (noInlineConfig). Além das regras de erro comum, o
// lint impõe a estrutura do projeto:
//
//   www/js/nucleo/   lógica pura: sem DOM, sem armazenamento, sem importar a interface
//   www/js/          interface: sem HTML em texto, sem acesso direto ao armazenamento
//                    (só store.js e os dois módulos de tema)

import js from '@eslint/js';
import globals from 'globals';

const HTML_EM_TEXTO = [
  {
    selector: 'MemberExpression[property.name=/^(innerHTML|outerHTML)$/]',
    message: 'Monte o DOM com h() ou svg(); HTML em texto é proibido.',
  },
  {
    selector:
      'CallExpression[callee.property.name=/^(insertAdjacentHTML|write|writeln|createContextualFragment|parseFromString)$/]',
    message: 'Monte o DOM com h() ou svg(); HTML em texto é proibido.',
  },
];

const ARMAZENAMENTO = ['localStorage', 'sessionStorage', 'indexedDB'].map((name) => ({
  name,
  message: 'Só store.js e os módulos de tema acessam o armazenamento.',
}));

export default [
  // android/ é o projeto nativo gerado pelo Capacitor (inclui uma cópia de www/).
  { ignores: ['node_modules/', 'referencias/', 'dist/', 'android/'] },

  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
  },

  js.configs.recommended,

  // ------------------------------------------------------- regras gerais
  {
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
    rules: {
      // Erros prováveis
      'array-callback-return': ['error', { checkForEach: true }],
      'no-constructor-return': 'error',
      'no-duplicate-imports': 'error',
      'no-promise-executor-return': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-unused-vars': ['error', { args: 'all', argsIgnorePattern: '^_', caughtErrors: 'all' }],
      'require-atomic-updates': 'error',

      // Código que esconde erro
      'consistent-return': 'error',
      'default-case-last': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-eval': 'error',
      'no-extend-native': 'error',
      'no-implicit-coercion': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-param-reassign': 'error',
      'no-return-assign': ['error', 'always'],
      'no-script-url': 'error',
      'no-sequences': 'error',
      'no-shadow': 'error',
      'no-throw-literal': 'error',
      'no-unused-expressions': 'error',
      'no-useless-concat': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-promise-reject-errors': 'error',
      radix: 'error',
      'require-await': 'error',

      // Tamanho: função grande demais vira candidata a dividir
      complexity: ['error', 20],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
    },
  },

  // ------------------------------------------------- interface (navegador)
  {
    files: ['www/js/*.js'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': ['error', ...HTML_EM_TEXTO],
      'no-restricted-globals': ['error', ...ARMAZENAMENTO],
    },
  },
  {
    files: ['www/js/store.js', 'www/js/tema.js', 'www/js/tema-inicial.js'],
    rules: { 'no-restricted-globals': 'off' },
  },
  // Exceção: script clássico carregado no <head>
  {
    files: ['www/js/tema-inicial.js'],
    languageOptions: { sourceType: 'script' },
  },

  // ---------------------------------------------------- núcleo (lógica pura)
  // Sem os globais do navegador, qualquer uso de document, window ou
  // localStorage aqui dentro falha em no-undef.
  {
    files: ['www/js/nucleo/**/*.js'],
    rules: {
      'no-console': 'error',
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['../*'], message: 'O núcleo não importa nada de fora dele.' }] },
      ],
    },
  },

  // ---------------------------------------- ferramentas, testes e config (Node)
  {
    files: ['tools/**/*.mjs', 'tests/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
  // Nos testes de ponta a ponta, as funções passadas a pagina.evaluate() rodam no navegador.
  {
    files: ['tests/e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
