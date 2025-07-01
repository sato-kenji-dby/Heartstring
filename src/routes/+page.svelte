<script lang="ts">
  import { onMount } from 'svelte';

  let tracks: Track[] = [];
  let currentPlayingTrack: Track | null = null;
  let playbackStatusMessage: string = '未选择歌曲';
  let currentTime: number = 0; // 新增：当前播放时间

  async function fetchTracks() {
    tracks = await window.electronAPI.getAllTracks();
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }

  async function playTrack(track: Track) {
    window.audio.play(track); // 传递整个 Track 对象
  }

  async function stopPlayback() {
    window.audio.stop();
    currentPlayingTrack = null;
    playbackStatusMessage = '已停止';
    currentTime = 0; // 停止时重置时间
  }

  onMount(async () => {
    await fetchTracks();

    // 新增：监听播放开始事件
    window.audio.onPlaybackStarted((track: Track) => {
      currentPlayingTrack = track;
      playbackStatusMessage = `正在播放: ${track.title || '未知标题'} - ${track.artist || '未知艺术家'}`;
      currentTime = 0; // 每次新歌播放时重置当前时间
    });

    window.audio.onPlaybackEnded(() => {
      playbackStatusMessage = '播放结束';
      currentPlayingTrack = null;
      currentTime = 0; // 播放结束时重置时间
      console.log('Main process reported that playback has ended.');
    });

    window.audio.onPlaybackError((errorMessage: string) => {
      playbackStatusMessage = `播放错误: ${errorMessage}`;
      currentPlayingTrack = null;
      currentTime = 0; // 播放错误时重置时间
      console.error('Playback Error:', errorMessage);
      alert(`播放错误: ${errorMessage}`);
    });

    // 新增：监听播放进度事件
    window.audio.onPlaybackProgress((data: { currentTime: number }) => {
      currentTime = data.currentTime;
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
  {:else}
    <p>{playbackStatusMessage}</p>
  {/if}
</div>

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
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{:else}
  <p>未找到音乐。扫描文件夹以开始。</p>
{/if}
