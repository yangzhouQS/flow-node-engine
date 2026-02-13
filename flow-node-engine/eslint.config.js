// eslint.config.js
// ESLint 9+ Flat Config for NestJS Project
const js = require('@eslint/js');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const importPlugin = require('eslint-plugin-import');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  // 全局忽略配置
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js',
      '*.config.ts',
      'bin/**',
      'obj/**',
      'test/**',
    ],
  },

  // 基础JavaScript推荐配置
  js.configs.recommended,

  // TypeScript文件配置
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
        ecmaVersion: 2022,
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'writable',
        global: 'readonly',
        Buffer: 'readonly',
        setImmediate: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        // Node.js 全局类型
        NodeJS: 'readonly',
        // fetch API (Node.js 18+)
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      import: importPlugin,
    },
    rules: {
      // ESLint基础规则
      'no-console': 'off',
      'no-debugger': 'warn',
      'no-unused-vars': 'off', // 使用TypeScript的规则
      'no-undef': 'off', // TypeScript编译器会处理这个

      // TypeScript规则
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off', // 关闭any类型警告，工作流引擎需要灵活类型
      '@typescript-eslint/no-unused-vars': [
        'warn', // 改为warn级别
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-empty-function': 'off', // 关闭空函数警告
      '@typescript-eslint/no-inferrable-types': 'warn',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/consistent-type-assertions': 'warn',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off', // 关闭非空断言警告
      '@typescript-eslint/prefer-nullish-coalescing': 'off', // 关闭，因为需要strictNullChecks
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/unbound-method': 'warn',

      // Import规则
      'import/order': [
        'warn', // 改为warn级别
        {
          groups: [
            'builtin', // Node.js内置模块
            'external', // 第三方库
            'internal', // 项目内部模块
            'parent', // 父级目录模块
            'sibling', // 同级目录模块
            'index', // 当前目录index
            'object',
            'type',
          ],
          'newlines-between': 'ignore', // 改为ignore，避免空行问题
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          pathGroups: [
            {
              pattern: '@nestjs/**',
              group: 'external',
              position: 'before',
            },
            {
              pattern: 'typeorm',
              group: 'external',
              position: 'before',
            },
          ],
        },
      ],
      'import/no-unresolved': 'off', // 关闭，TypeScript编译器会处理
      'import/no-duplicates': 'warn',
      'import/first': 'warn',
      'import/newline-after-import': 'warn',
      'import/no-cycle': 'off', // 关闭循环依赖检查，由TypeScript处理
      'import/no-self-import': 'error',
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },
  },

  // 类型定义文件规则
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // 测试文件规则（放宽限制）
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'import/no-unresolved': 'off',
    },
  },

  // Prettier配置（必须放在最后以覆盖冲突规则）
  prettierConfig,
];
