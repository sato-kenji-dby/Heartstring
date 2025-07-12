<script lang="ts">
  import { onMount } from 'svelte';
  import { playerStore } from '$stores/playerStore'; // 导入 playerStore
  import type { Track } from '$types'; // 导入 Track 类型
  import PlayerControls from '../components/PlayerControls.svelte'; // 导入 PlayerControls 组件
  import { Play, Plus } from 'lucide-svelte'; // 导入 Lucide 图标

  let tracks: Track[] = []; // 音乐库列表

  // 订阅 playerStore，以便在 UI 中使用其状态
  $: playerState = $playerStore;
  $: queue = playerState.queue; // 从 playerStore 获取队列

  async function fetchTracks() {
    tracks = await window.electronAPI.getAllTracks();
  }

  async function playTrack(track: Track) {
    playerStore.play(track);
  }

  async function addToQueue(track: Track) {
    playerStore.addToQueue(track);
  }

  onMount(async () => {
    // 等待 window.electronAPI 可用
    await new Promise<void>(resolve => {
      const checkApi = () => {
        if (window.electronAPI) {
          resolve();
        } else {
          setTimeout(checkApi, 50); // 每 50ms 检查一次
        }
      };
      checkApi();
    });

    await fetchTracks();
    console.log('Page mounted and tracks fetched.');
  });

  async function handleSelectFolder() {
    await window.electronAPI.openDirectoryDialog();
    await fetchTracks();
  }
</script>

<div class="flex flex-col h-screen p-4 bg-slate-900 text-slate-100">
  <h1 class="text-4xl font-bold text-center my-4 text-blue-400">Heartstring Music Player</h1>

  <PlayerControls />

  <button on:click={handleSelectFolder} class="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors duration-200 block mx-auto my-4">
    扫描音乐文件夹
  </button>

  <div class="flex flex-1 overflow-hidden">
    <div class="flex flex-col w-1/3 pr-2">
      <h2 class="text-2xl font-semibold mt-4 mb-2 text-blue-300">播放队列</h2>
      {#if queue.length > 0}
        <div class="flex-1 overflow-y-auto">
          <table class="w-full table-auto border-collapse shadow-lg rounded-lg overflow-hidden">
            <thead>
              <tr class="bg-slate-700 text-slate-100 uppercase text-sm leading-normal">
                <th class="py-3 px-6 text-left">Title</th>
                <th class="py-3 px-6 text-left">Artist</th>
                <th class="py-3 px-6 text-left">Album</th>
              </tr>
            </thead>
            <tbody>
              {#each queue as track (track.id)}
          <tr class="border-b border-slate-600 hover:bg-slate-700 even:bg-slate-800">
            <td class="py-3 px-6 text-left truncate max-w-xs">{track.title || '未知标题'}</td>
            <td class="py-3 px-6 text-left truncate max-w-xs">{track.artist || '未知艺术家'}</td>
            <td class="py-3 px-6 text-left truncate max-w-xs">{track.album || '未知专辑'}</td>
          </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="text-center text-slate-400 my-4">播放队列为空。</p>
      {/if}
    </div>

    <div class="flex flex-col w-2/3 pl-2">
      <h2 class="text-2xl font-semibold mt-4 mb-2 text-blue-300">音乐库</h2>
      {#if tracks.length > 0}
        <div class="flex-1 overflow-y-auto">
          <table class="w-full table-auto border-collapse shadow-lg rounded-lg overflow-hidden">
            <thead>
              <tr class="bg-slate-700 text-slate-100 uppercase text-sm leading-normal">
                <th class="py-3 px-6 text-left">Title</th>
                <th class="py-3 px-6 text-left">Artist</th>
                <th class="py-3 px-6 text-left">Album</th>
                <th class="py-3 px-6 text-left">Duration</th>
                <th class="py-3 px-6 text-left">Operation</th>
              </tr>
            </thead>
            <tbody>
              {#each tracks as track (track.id)}
          <tr class="border-b border-slate-600 hover:bg-slate-700 even:bg-slate-800">
            <td class="py-3 px-6 text-left truncate max-w-xs">{track.title || '未知标题'}</td>
            <td class="py-3 px-6 text-left truncate max-w-xs">{track.artist || '未知艺术家'}</td>
            <td class="py-3 px-6 text-left truncate max-w-xs">{track.album || '未知专辑'}</td>
            <td class="py-3 px-6 text-left">{track.duration ? track.duration.toFixed(2) + 's' : 'N/A'}</td>
            <td class="py-3 px-6 text-left">
              <div class="flex items-center space-x-2">
                <button on:click={() => playTrack(track)} class="bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition-colors duration-200 flex items-center justify-center">
                  <Play size="16" />
                </button>
                <button on:click={() => addToQueue(track)} class="bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition-colors duration-200 flex items-center justify-center">
                  <Plus size="16" />
                </button>
              </div>
            </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="text-center text-slate-400 my-4">未找到音乐。扫描文件夹以开始。</p>
      {/if}
    </div>
  </div>
</div>
