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
    // 库中点播时清空队列
    playerStore.playSingleTrack(track);
  }

  async function addToQueue(track: Track) {
    playerStore.addToQueue(track);
  }

  onMount(async () => {
    // 等待 window.electronAPI 可用
    await new Promise<void>((resolve) => {
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

<div class="flex h-screen flex-col bg-slate-900 p-4 text-slate-100">
  <h1 class="my-4 text-center text-4xl font-bold text-blue-400">
    Heartstring Music Player
  </h1>

  <PlayerControls />

  <button
    on:click={handleSelectFolder}
    class="mx-auto my-4 block rounded-lg bg-green-600 px-4 py-2 text-white transition-colors duration-200 hover:bg-green-700"
  >
    扫描音乐文件夹
  </button>

  <div class="flex flex-1 overflow-hidden">
    <div class="flex w-1/3 flex-col pr-2">
      <h2 class="mb-2 mt-4 text-2xl font-semibold text-blue-300">播放队列</h2>
      {#if queue.length > 0}
        <div class="flex-1 overflow-y-auto">
          <table
            class="w-full table-auto border-collapse overflow-hidden rounded-lg shadow-lg"
          >
            <thead>
              <tr
                class="bg-slate-700 text-sm uppercase leading-normal text-slate-100"
              >
                <th class="px-6 py-3 text-left">Title</th>
                <th class="px-6 py-3 text-left">Artist</th>
                <th class="px-6 py-3 text-left">Album</th>
              </tr>
            </thead>
            <tbody>
              {#each queue as track (track.id)}
                <tr
                  class="border-b border-slate-600 even:bg-slate-800 hover:bg-slate-700"
                >
                  <td class="max-w-xs truncate px-6 py-3 text-left"
                    >{track.title || '未知标题'}</td
                  >
                  <td class="max-w-xs truncate px-6 py-3 text-left"
                    >{track.artist || '未知艺术家'}</td
                  >
                  <td class="max-w-xs truncate px-6 py-3 text-left"
                    >{track.album || '未知专辑'}</td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="my-4 text-center text-slate-400">播放队列为空。</p>
      {/if}
    </div>

    <div class="flex w-2/3 flex-col pl-2">
      <h2 class="mb-2 mt-4 text-2xl font-semibold text-blue-300">音乐库</h2>
      {#if tracks.length > 0}
        <div class="flex-1 overflow-y-auto">
          <table
            class="w-full table-auto border-collapse overflow-hidden rounded-lg shadow-lg"
          >
            <thead>
              <tr
                class="bg-slate-700 text-sm uppercase leading-normal text-slate-100"
              >
                <th class="px-6 py-3 text-left">Title</th>
                <th class="px-6 py-3 text-left">Artist</th>
                <th class="px-6 py-3 text-left">Album</th>
                <th class="px-6 py-3 text-left">Duration</th>
                <th class="px-6 py-3 text-left">Operation</th>
              </tr>
            </thead>
            <tbody>
              {#each tracks as track (track.id)}
                <tr
                  class="border-b border-slate-600 even:bg-slate-800 hover:bg-slate-700"
                >
                  <td class="max-w-xs truncate px-6 py-3 text-left"
                    >{track.title || '未知标题'}</td
                  >
                  <td class="max-w-xs truncate px-6 py-3 text-left"
                    >{track.artist || '未知艺术家'}</td
                  >
                  <td class="max-w-xs truncate px-6 py-3 text-left"
                    >{track.album || '未知专辑'}</td
                  >
                  <td class="px-6 py-3 text-left"
                    >{track.duration
                      ? track.duration.toFixed(2) + 's'
                      : 'N/A'}</td
                  >
                  <td class="px-6 py-3 text-left">
                    <div class="flex items-center space-x-2">
                      <button
                        on:click={() => playTrack(track)}
                        class="flex items-center justify-center rounded-md bg-blue-500 p-2 text-white transition-colors duration-200 hover:bg-blue-600"
                      >
                        <Play size="16" />
                      </button>
                      <button
                        on:click={() => addToQueue(track)}
                        class="flex items-center justify-center rounded-md bg-blue-500 p-2 text-white transition-colors duration-200 hover:bg-blue-600"
                      >
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
        <p class="my-4 text-center text-slate-400">
          未找到音乐。扫描文件夹以开始。
        </p>
      {/if}
    </div>
  </div>
</div>
