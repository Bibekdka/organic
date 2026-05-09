import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*']
  },
  {
    files: ['**/*.js', '**/*.ts', '**/*.tsx'],
    ...js.configs.recommended,
  },
  {
    files: ['**/*.js', '**/*.ts', '**/*.tsx'],
    ...tseslint.configs.recommended[0], // Simplified to avoid spread issues if it's an array
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
