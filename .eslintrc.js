module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Allow console statements in this application since it's for personal use
    'no-console': 'off',

    // Make some rules more lenient for easier development
    'import/extensions': ['error', 'ignorePackages'],
    'max-len': ['warn', { code: 200 }],
    'no-param-reassign': ['error', { props: false }],

    // CSS classes often use dashes which camelCase would make harder to read
    camelcase: ['error', { properties: 'never', ignoreDestructuring: true }],

    // Customize as needed for your coding style
    'comma-dangle': ['error', 'only-multiline'],

    // Additional rules to fit this codebase structure
    'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
    'import/no-cycle': 'warn',
    'no-plusplus': 'warn',
    'func-names': 'warn',
    'no-alert': 'warn',
    'no-nested-ternary': 'warn',
    'no-shadow': 'warn',
    'no-case-declarations': 'warn',
    'import/no-unresolved': ['warn', { ignore: ['https://cdn.jsdelivr.net/'] }],
    'import/order': 'warn',
    'eol-last': 'warn',
    'no-unused-vars': 'warn',
    'no-undef': 'warn',
    'no-new': 'warn',
    'no-promise-executor-return': 'warn',
    'import/prefer-default-export': 'warn'
  },
  // Add directories/files to ignore during linting
  ignorePatterns: [
    'node_modules/',
    'legacy-app.js'
  ],
};
