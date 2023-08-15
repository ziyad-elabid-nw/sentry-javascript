module.exports = {
  extends: ['../../.eslintrc.js'],
  ignorePatterns: ['test-apps'],
  overrides: [
    {
      files: ['*.ts'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'import/no-unresolved': 'off',
        '@sentry-internal/sdk/no-optional-chaining': 'off',
        '@sentry-internal/sdk/no-nullish-coalescing': 'off',
        '@sentry-internal/sdk/no-unsupported-es6-methods': 'off',
        '@sentry-internal/sdk/no-class-field-initializers': 'off',
        'jsdoc/require-jsdoc': 'off',
      },
    },
  ],
};
