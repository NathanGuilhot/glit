import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import i18next from 'eslint-plugin-i18next'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist/**', 'release/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'src/shared/**/*.ts'],
    ignores: ['**/*.d.ts'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    ignores: ['**/*.d.ts'],
    plugins: { react, 'react-hooks': reactHooks, i18next },
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        project: './tsconfig.renderer.json',
      },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            include: ['label', 'placeholder', 'title', 'aria-label', 'loadingText'],
          },
        },
      ],
    },
  },
)
