<script lang="ts">
  import { playerStore } from '$stores/playerStore';
  import type { Track } from '$types'; // 导入 Track 类型
  // 导入 window.audio 类型声明，虽然这里不需要显式导入，但为了清晰性可以保留

  // Subscribe to the playerStore
  $: playerState = $playerStore;

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }

  function togglePlayPause() {
    if (playerState.isPlaying) {
      playerStore.pause();
    } else {
      playerStore.resume();
    }
  }

  function playNextTrack() {
    playerStore.next();
  }
</script>

<div class="player-controls">
  {#if playerState.currentTrack}
    <div class="track-info">
      <span>{playerState.currentTrack.title}</span> - <span>{playerState.currentTrack.artist}</span>
    </div>
  {:else}
    <div class="track-info">
      <span>没有正在播放的歌曲</span>
    </div>
  {/if}

  <div class="playback-bar">
    <button on:click={togglePlayPause}>
      {#if playerState.isPlaying}
        暂停
      {:else}
        播放
      {/if}
    </button>
    <button on:click={playNextTrack}>下一首</button>
    <span class="time-display">{formatTime(playerState.progress)} / {formatTime(playerState.duration)}</span>
    <progress value={playerState.progress} max={playerState.duration}></progress>
  </div>

  {#if playerState.status === 'error'}
    <div class="error-message">播放错误！</div>
  {/if}
</div>

<style>
  .player-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px;
    border-top: 1px solid #eee;
    background-color: #f9f9f9;
    width: 100%;
    box-sizing: border-box;
  }

  .track-info {
    margin-bottom: 10px;
    font-weight: bold;
  }

  .playback-bar {
    display: flex;
    align-items: center;
    width: 80%;
  }

  .playback-bar button {
    margin-right: 10px;
    padding: 5px 10px;
    cursor: pointer;
  }

  .time-display {
    margin-right: 10px;
    font-size: 0.9em;
    min-width: 80px; /* Prevent jumping when time changes */
    text-align: right;
  }

  .playback-bar progress {
    flex-grow: 1;
    height: 8px;
    -webkit-appearance: none;
    appearance: none;
  }

  .playback-bar progress::-webkit-progress-bar {
    background-color: #e0e0e0;
    border-radius: 5px;
  }

  .playback-bar progress::-webkit-progress-value {
    background-color: #007bff;
    border-radius: 5px;
  }

  .error-message {
    color: red;
    margin-top: 10px;
  }
</style>
