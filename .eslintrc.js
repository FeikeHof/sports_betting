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
    'max-len': ['error', { code: 120 }],
    'no-param-reassign': ['error', { props: false }],

    // CSS classes often use dashes which camelCase would make harder to read
    camelcase: ['error', { properties: 'never', ignoreDestructuring: true }],

    // Customize as needed for your coding style
    'comma-dangle': ['error', 'only-multiline'],
  },
  // Add directories/files to ignore during linting
  ignorePatterns: [
    'node_modules/',
    'legacy-app.js'
  ],
};
