module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true
  },
  extends: [
    'standard',
    'plugin:react/recommended'
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
    'jsx-a11y/click-events-have-key-events': 'warn'
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
}
