import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      fallback: 'index.html'
    }),
    alias: {
      $api: './src/api',
      $core: './src/core',
      $services: './src/services',
      $stores: './src/stores',
      $ui: './src/ui',
      $types: './src/types',
    },
    files: {
      routes: 'src/ui/pages',
    },
    paths: {
      assets: '' // 让静态资源路径变成相对路径，适配 Electron file://
    }
  },
};

export default config;
