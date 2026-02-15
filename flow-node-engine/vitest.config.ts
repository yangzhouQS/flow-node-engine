import { defineConfig } from 'vitest/config';
import path from 'path';
import swc from 'unplugin-swc';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'test/e2e/**',
      '**/*.e2e-spec.ts',
      '**/*.e2e.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/*.interface.ts',
        'src/**/*.dto.ts',
        'src/**/*.entity.ts',
        'src/**/*.module.ts',
        'src/**/*.constants.ts',
        'src/main.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: 'threads',
    /*poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4,
      },
    },*/
    reporters: ['default', 'html'],
    outputFile: {
      html: './coverage/test-report.html',
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
          dynamicImport: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: 'es2020',
      },
    }),
  ],
});
