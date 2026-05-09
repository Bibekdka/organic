import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'firestore.rules']
  },
  {
    files: ['**/*.js', '**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        process: 'readonly'
      }
    }
  },
  {
    files: ['**/*.js', '**/*.ts', '**/*.tsx'],
    ...js.configs.recommended,
  },
  {
    files: ['**/*.js', '**/*.ts', '**/*.tsx'],
    ...tseslint.configs.recommended[0],
  },
  {
    files: ['**/*.rules'],
    plugins: {
      '@firebase/security-rules': firebaseRulesPlugin
    },
    rules: {
      ...firebaseRulesPlugin.configs['flat/recommended'].rules
    }
  }
];
