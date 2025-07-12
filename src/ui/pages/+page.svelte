<script lang="ts">
  import { onMount } from 'svelte';
  import { playerStore } from '$stores/playerStore'; // 导入 playerStore
  import type { Track } from '$types'; // 导入 Track 类型
  import PlayerControls from '../components/PlayerControls.svelte'; // 导入 PlayerControls 组件

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

<h1 class="text-4xl font-bold text-center my-8 text-blue-400">Heartstring Music Player</h1>

<PlayerControls />

<button on:click={handleSelectFolder} class="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors duration-200 block mx-auto my-4">
  扫描音乐文件夹
</button>

<h2 class="text-2xl font-semibold mt-8 mb-4 text-blue-300">播放队列</h2>
{#if queue.length > 0}
  <div class="max-h-64 overflow-y-auto">
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
            <td class="py-3 px-6 text-left">{track.title || '未知标题'}</td>
            <td class="py-3 px-6 text-left">{track.artist || '未知艺术家'}</td>
            <td class="py-3 px-6 text-left">{track.album || '未知专辑'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <p class="text-center text-slate-400 my-4">播放队列为空。</p>
{/if}

<h2 class="text-2xl font-semibold mt-8 mb-4 text-blue-300">音乐库</h2>
{#if tracks.length > 0}
  <div class="max-h-96 overflow-y-auto">
    <table class="w-full table-auto border-collapse shadow-lg rounded-lg overflow-hidden">
      <thead>
        <tr class="bg-slate-700 text-slate-100 uppercase text-sm leading-normal">
          <th class="py-3 px-6 text-left">Title</th>
          <th class="py-3 px-6 text-left">Artist</th>
          <th class="py-3 px-6 text-left">Album</th>
          <th class="py-3 px-6 text-left">Duration</th>
          <th class="py-3 px-6 text-left">操作</th>
        </tr>
      </thead>
      <tbody>
        {#each tracks as track (track.id)}
          <tr class="border-b border-slate-600 hover:bg-slate-700 even:bg-slate-800">
            <td class="py-3 px-6 text-left">{track.title || '未知标题'}</td>
            <td class="py-3 px-6 text-left">{track.artist || '未知艺术家'}</td>
            <td class="py-3 px-6 text-left">{track.album || '未知专辑'}</td>
            <td class="py-3 px-6 text-left">{track.duration ? track.duration.toFixed(2) + 's' : 'N/A'}</td>
            <td class="py-3 px-6 text-left">
              <button on:click={() => playTrack(track)} class="bg-blue-500 text-white py-1 px-3 rounded-md text-sm hover:bg-blue-600 transition-colors duration-200 mr-2">播放</button>
              <button on:click={() => addToQueue(track)} class="bg-blue-500 text-white py-1 px-3 rounded-md text-sm hover:bg-blue-600 transition-colors duration-200 mr-2">添加到队列</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <p class="text-center text-slate-400 my-4">未找到音乐。扫描文件夹以开始。</p>
{/if}
