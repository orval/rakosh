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
      files: ['*.jsx', '*.js', '*.mjs']
    }
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    ecmaFeatures: {
      jsx: true
    }
  },
  rules: {
    'import/order': ['error', {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      'newlines-between': 'always'
    }]
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
}
