module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true
  },
  extends: [
    'standard',
    'plugin:react/recommended',
    'plugin:jsx-a11y/recommended'
  ],
  plugins: [
    'jsx-a11y',
    'react'
  ],
  overrides: [
    {
      files: ['*.jsx', '*.js']
    }
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    ecmaFeatures: {
      jsx: true
    }
  },
  rules: {
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
}
