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
    window.audio.play(track);
  }

  async function addToQueue(track: Track) {
    window.audio.addToQueue(track);
  }

  onMount(async () => {
    await fetchTracks();
    console.log('Page mounted and tracks fetched.');
  });

  async function handleSelectFolder() {
    await window.electronAPI.openDirectoryDialog();
    await fetchTracks();
  }
</script>

<h1>Heartstring Music Player</h1>

<PlayerControls />

<button on:click={handleSelectFolder}>
  扫描音乐文件夹
</button>

<h2>播放队列</h2>
{#if queue.length > 0}
  <table>
    <thead>
      <tr>
        <th>Title</th>
        <th>Artist</th>
        <th>Album</th>
      </tr>
    </thead>
    <tbody>
      {#each queue as track (track.id)}
        <tr>
          <td>{track.title || '未知标题'}</td>
          <td>{track.artist || '未知艺术家'}</td>
          <td>{track.album || '未知专辑'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{:else}
  <p>播放队列为空。</p>
{/if}

<h2>音乐库</h2>
{#if tracks.length > 0}
  <table>
    <thead>
      <tr>
        <th>Title</th>
        <th>Artist</th>
        <th>Album</th>
        <th>Duration</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      {#each tracks as track (track.id)}
        <tr>
          <td>{track.title || '未知标题'}</td>
          <td>{track.artist || '未知艺术家'}</td>
          <td>{track.album || '未知专辑'}</td>
          <td>{track.duration ? track.duration.toFixed(2) + 's' : 'N/A'}</td>
          <td>
            <button on:click={() => playTrack(track)}>播放</button>
            <button on:click={() => addToQueue(track)}>添加到队列</button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{:else}
  <p>未找到音乐。扫描文件夹以开始。</p>
{/if}
