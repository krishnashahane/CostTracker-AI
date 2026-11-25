const js = require('@eslint/js');
const globals = require('globals');
const noUnsanitized = require('eslint-plugin-no-unsanitized');

module.exports = [
  { ignores: ['node_modules/**', 'vendor/**'] },
  js.configs.recommended,
  {
    files: ['app.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, Chart: 'readonly' }
    },
    plugins: { 'no-unsanitized': noUnsanitized },
    rules: {
      'no-unused-vars': ['error', { vars: 'local' }],
      // Block HTML-string sinks: all user data must go through textContent / DOM APIs.
      'no-unsanitized/method': 'error',
      'no-unsanitized/property': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error'
    }
  },
  {
    files: ['tests/**/*.js', 'eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node }
    }
  }
];
