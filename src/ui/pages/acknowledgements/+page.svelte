<script lang="ts">
  import { onMount } from 'svelte';

  interface LicenseInfo {
    licenses: string;
    repository: string;
    licenseUrl?: string; // Make optional and correct name
    licenseText?: string; // Make optional
    parents?: string; // Make optional
    // The 'url' property was incorrect, it should be licenseUrl
  }

  let isLoading = false;
  let error: string | null = null;
  let licenses: Record<string, LicenseInfo> = {
    "better-sqlite3@12.2.0": {
        "licenses": "MIT",
        "repository": "https://github.com/WiseLibs/better-sqlite3",
        "licenseUrl": "https://github.com/WiseLibs/better-sqlite3/raw/master/LICENSE",
        "parents": "heartstring"
    },
    "lucide-svelte@0.525.0": {
        "licenses": "ISC",
        "repository": "https://github.com/lucide-icons/lucide",
        "licenseUrl": "https://github.com/lucide-icons/lucide/raw/master/LICENSE",
        "parents": "heartstring"
    },
    "music-metadata@11.6.0": {
        "licenses": "MIT",
        "repository": "github:Borewit/music-metadata",
        "licenseUrl": "github:Borewit/music-metadata",
        "parents": "heartstring"
    },
    "play-sound@1.1.6": {
        "licenses": "MIT",
        "repository": "https://github.com/shime/play-sound",
        "licenseUrl": "https://github.com/shime/play-sound/raw/master/LICENSE",
        "parents": "heartstring"
    }
  };

  // let licenses: Record<string, LicenseInfo> = {};

  // onMount(async () => {
  //   try {
  //     // 确保 window.electronAPI 可用
  //     await new Promise<void>(resolve => {
  //       const checkApi = () => {
  //         if (window.electronAPI) {
  //           resolve();
  //         } else {
  //           setTimeout(checkApi, 50);
  //         }
  //       };
  //       checkApi();
  //     });

  //     const data = await window.electronAPI.getLicenses();
  //     if (data.error) {
  //       throw new Error(data.error);
  //     }
  //     licenses = data;
  //     console.log('Licenses fetched:', licenses);
  //   } catch (e: any) {
  //     console.error('Failed to load licenses:', e);
  //     error = e.message || 'An unknown error occurred';
  //   } finally {
  //     isLoading = false;
  //   }
  // });
</script>

<div class="p-8 bg-slate-900 text-slate-100 min-h-screen">
  <div class="text-center mb-8">
    <a href="/" class="text-blue-400 hover:underline">&larr; 返回主页</a>
  </div>
  <h1 class="text-4xl font-bold text-center my-8 text-blue-400">鸣谢与许可证</h1>

  {#if isLoading}
    <p class="text-center text-slate-400">加载许可证信息中...</p>
  {:else if error}
    <p class="text-center text-red-500">加载许可证信息失败: {error}</p>
  {:else if Object.keys(licenses).length > 0}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each Object.entries(licenses) as [packageName, info]}
        <div class="bg-slate-800 p-6 rounded-lg shadow-lg">
          <h2 class="text-2xl font-semibold text-blue-300 mb-2">{packageName}</h2>
          <p class="text-slate-300 mb-1">许可证: <span class="font-medium text-green-400">{info.licenses}</span></p>
          {#if info.repository}
            <p class="text-slate-300 mb-1">仓库: <a href={info.repository} target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">{info.repository}</a></p>
          {/if}
          {#if info.licenseUrl}
            <p class="text-slate-300 mb-4">URL: <a href={info.licenseUrl} target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">{info.licenseUrl}</a></p>
          {/if}
          {#if info.licenseText}
            <details class="text-slate-400">
              <summary class="cursor-pointer hover:text-slate-300">查看许可证全文</summary>
              <pre class="bg-slate-700 p-4 rounded-md mt-2 text-sm overflow-auto max-h-64">{info.licenseText}</pre>
            </details>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <p class="text-center text-slate-400">未找到许可证信息。</p>
  {/if}
</div>
