module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    project: undefined,
  },
  env: { node: true, es2021: true },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': ['warn'],
    '@typescript-eslint/ban-ts-comment': ['off'],
    'prettier/prettier': ['warn'],
  },
  ignorePatterns: ['dist/', 'node_modules/', 'sessions_data/', 'sessions_config/'],
};


