import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [
    // 确保Vitest能理解Svelte组件
    svelte({ hot: !process.env.VITEST }),
  ],
  test: {
    // 在Node.js环境中运行测试，因为我们的应用是桌面应用
    // 如果要测试UI组件，可以改为 'jsdom' 或 'happy-dom'
    environment: 'node',

    // 在项目根目录的 'src' 文件夹下寻找测试文件
    include: ['src/**/*.{test,spec}.{js,ts}'],

    // 全局变量，这样就不用在每个测试文件中都 import { describe, it, expect }
    globals: true,

    setupFiles: './setupTests.ts', // 启用并指向 setupTests.ts
  },
  resolve: {
    alias: {
      $api: path.resolve('./src/api'),
      $core: path.resolve('./src/core'),
      $services: path.resolve('./src/services'),
      $stores: path.resolve('./src/stores'),
      $types: path.resolve('./src/types'),
      $ui: path.resolve('./src/ui'),
    },
  },
});
