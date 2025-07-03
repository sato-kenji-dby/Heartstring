<script lang="ts">
  import { onMount } from 'svelte';

  let tracks: Track[] = [];
  let currentPlayingTrack: Track | null = null;
  let playbackStatusMessage: string = '未选择歌曲';
  let currentTime: number = 0;
  let queue: Track[] = [];
  let isPaused: boolean = false; // 新增：暂停状态

  async function fetchTracks() {
    tracks = await window.electronAPI.getAllTracks();
  }

  async function fetchQueue() {
    queue = await window.audio.getQueue();
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }

  async function playTrack(track: Track) {
    window.audio.play(track);
    isPaused = false; // 开始播放时重置暂停状态
  }

  async function addToQueue(track: Track) {
    window.audio.addToQueue(track);
  }

  async function stopPlayback() {
    console.log('Attempting to stop playback...');
    window.audio.stop();
    currentPlayingTrack = null;
    playbackStatusMessage = '已停止';
    currentTime = 0;
    isPaused = false; // 停止时重置暂停状态
  }

  async function togglePauseResume() {
    if (currentPlayingTrack) {
      if (isPaused) {
        window.audio.resume();
      } else {
        window.audio.pause();
      }
    }
  }

  onMount(async () => {
    await fetchTracks();
    await fetchQueue();

    window.audio.onPlaybackStarted((track: Track) => {
      currentPlayingTrack = track;
      playbackStatusMessage = `正在播放: ${track.title || '未知标题'} - ${track.artist || '未知艺术家'}`;
      currentTime = 0;
      isPaused = false; // 播放开始时确保不是暂停状态
    });

    window.audio.onPlaybackEnded(() => {
      playbackStatusMessage = '播放结束';
      currentPlayingTrack = null;
      currentTime = 0;
      isPaused = false; // 播放结束时重置暂停状态
      console.log('Main process reported that playback has ended.');
    });

    window.audio.onPlaybackError((errorMessage: string) => {
      playbackStatusMessage = `播放错误: ${errorMessage}`;
      currentPlayingTrack = null;
      currentTime = 0;
      isPaused = false; // 播放错误时重置暂停状态
      console.error('Playback Error:', errorMessage);
      alert(`播放错误: ${errorMessage}`);
    });

    window.audio.onPlaybackProgress((data: { currentTime: number }) => {
      currentTime = data.currentTime;
    });

    window.audio.onQueueUpdated((updatedQueue: Track[]) => {
      queue = updatedQueue;
      console.log('Queue updated:', queue);
    });

    // 新增：监听播放暂停事件
    window.audio.onPlaybackPaused((data: { currentTime: number }) => {
      isPaused = true;
      playbackStatusMessage = `已暂停: ${currentPlayingTrack?.title || '未知标题'}`;
      currentTime = data.currentTime;
      console.log('Playback paused at:', data.currentTime);
    });

    // 新增：监听播放恢复事件
    window.audio.onPlaybackResumed((data: { currentTime: number }) => {
      isPaused = false;
      playbackStatusMessage = `正在播放: ${currentPlayingTrack?.title || '未知标题'} - ${currentPlayingTrack?.artist || '未知艺术家'}`;
      currentTime = data.currentTime;
      console.log('Playback resumed from:', data.currentTime);
    });
  });

  async function handleSelectFolder() {
    await window.electronAPI.openDirectoryDialog();
    await fetchTracks();
  }
</script>

<h1>Heartstring Music Player</h1>

<div class="player-controls">
  {#if currentPlayingTrack}
    <h3>{playbackStatusMessage}</h3>
    <div class="progress-bar-container">
      <span>{formatTime(currentTime)}</span>
      <input
        type="range"
        min="0"
        max={currentPlayingTrack.duration || 0}
        value={currentTime}
        class="progress-bar"
        disabled
      />
      <span>{formatTime(currentPlayingTrack.duration || 0)}</span>
    </div>
    <button on:click={stopPlayback}>停止</button>
    <button on:click={togglePauseResume}>
      {#if isPaused}恢复{:else}暂停{/if}
    </button>
  {:else}
    <p>{playbackStatusMessage}</p>
  {/if}
</div>

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

<button on:click={handleSelectFolder}>
  扫描音乐文件夹
</button>

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
