import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

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

    // (可选) 如果你需要测试UI组件，需要安装 @testing-library/svelte 并取消下面的注释
    // setupFiles: './src/setupTests.js', 
  },
});