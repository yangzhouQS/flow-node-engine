import { defineConfig } from 'vitest/config';
import path from 'path';
import swc from 'unplugin-swc';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['test/e2e/**/*.e2e-spec.ts', 'test/e2e/**/*.e2e.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'src/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/e2e',
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
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'threads',
    /*poolOptions: {
      threads: {
        singleThread: true, // E2E tests should run sequentially
        minThreads: 1,
        maxThreads: 1,
      },
    },*/
    reporters: ['default', 'html'],
    outputFile: {
      html: './coverage/e2e-test-report.html',
    },
    setupFiles: ['./test/e2e-setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Global setup for database connection
    globalSetup: ['./test/global-setup.ts'],
  },
  plugins: [
    swc.vite({
      module: { type: 'commonjs' },
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
