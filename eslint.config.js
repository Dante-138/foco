import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'referencias/', 'dist/'] },

  js.configs.recommended,

  // App: módulos ES rodando no navegador
  {
    files: ['www/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.browser },
  },
  // Exceção: script clássico carregado no <head>
  {
    files: ['www/js/tema-inicial.js'],
    languageOptions: { sourceType: 'script' },
  },
  // Ferramentas, testes e configuração: Node
  {
    files: ['tools/**/*.mjs', 'tests/**/*.js', '*.config.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.node },
  },

  {
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
];
