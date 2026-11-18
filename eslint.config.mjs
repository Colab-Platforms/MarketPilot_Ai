import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const moduleNames = [
  'identity',
  'brand',
  'memory',
  'profile',
  'ai',
  'studio',
  'assets',
  'calendar',
  'publishing',
  'analytics',
  'agents',
  'billing',
  'notifications',
  'admin',
];

const modulePatterns = moduleNames.map((name) => ({
  group: [`@/modules/${name}/*`],
  message: `Import ${name} through '@/modules/${name}' only.`,
}));

// ADR 0005: LangGraph orchestrates; it never reaches models, and only the runtime and graphs use it.
const langchainPattern = {
  group: ['@langchain/*'],
  message: 'LangGraph is used only in modules/agents/runtime and modules/agents/*/graph (ADR 0005).',
};

const providerPaths = ['openai', '@anthropic-ai/sdk', '@google/generative-ai'].map((name) => ({
  name,
  message: 'Model providers are reachable only through modules/ai.',
}));

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/.turbo/**', '**/next-env.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly', process: 'readonly' },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-restricted-imports': ['error', { patterns: [...modulePatterns, langchainPattern], paths: providerPaths }],
    },
  },
  {
    files: ['apps/api/src/modules/agents/runtime/**/*.ts', 'apps/api/src/modules/agents/*/graph/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: modulePatterns, paths: providerPaths }],
    },
  },
  {
    files: ['apps/api/src/modules/ai/**/*.ts', 'apps/api/src/infra/llm-providers/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-restricted-imports': ['error', { patterns: modulePatterns }],
    },
  },
);
