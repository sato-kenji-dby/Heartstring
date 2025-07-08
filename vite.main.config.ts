import { defineConfig } from 'vite';
import path from 'path';
import { builtinModules } from 'module';
import tsconfigPaths from 'vite-tsconfig-paths';
import commonjs from '@rollup/plugin-commonjs'; // 导入 commonjs 插件
import typescript from '@rollup/plugin-typescript'; // 导入 typescript 插件

export default defineConfig({
  plugins: [
    tsconfigPaths(),
  ],
  build: {
    target: 'node18',
    // Electron Main Process
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'electron.cjs'),
        preload: path.resolve(__dirname, 'preload.ts'),
      },
      output: {
        format: 'cjs',
        dir: 'dist-electron',
        entryFileNames: '[name].cjs',
        chunkFileNames: '[name]-[hash].cjs',
        manualChunks: undefined,
      },
      external: [
        'electron',
        'better-sqlite3',
        'music-metadata',
        ...builtinModules,
      ],
      plugins: [ // 在这里添加 Rollup 插件
        commonjs(),
        typescript({
          tsconfig: './tsconfig.json', // 指定 tsconfig 文件
          sourceMap: true,
          inlineSources: true,
        }),
      ],
    },
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      '$api': path.resolve('./src/api'),
      '$core': path.resolve('./src/core'),
      '$services': path.resolve('./src/services'),
      '$stores': path.resolve('./src/stores'),
      '$types': path.resolve('./src/types'),
      '$ui': path.resolve('./src/ui'),
      '$lib': path.resolve('./src/lib'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.svelte', '.cjs'],
  },
});
