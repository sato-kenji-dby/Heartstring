<script lang="ts">
  import { playerStore } from '$stores/playerStore';
  import { Play, Pause, SkipForward } from 'lucide-svelte';

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

<div
  class="player-controls box-border flex w-full flex-col items-center border-t border-slate-700 bg-slate-800 p-4"
>
  {#if playerState.currentTrack}
    <div class="track-info mb-4 text-lg font-bold">
      <span>{playerState.currentTrack.title}</span> -
      <span>{playerState.currentTrack.artist}</span>
    </div>
  {:else}
    <div class="track-info mb-4 text-lg font-bold">
      <span>没有正在播放的歌曲</span>
    </div>
  {/if}

  <div class="playback-bar flex w-4/5 items-center">
    <button
      on:click={togglePlayPause}
      class="mr-4 flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors duration-200 hover:bg-blue-700"
    >
      {#if playerState.isPlaying}
        <Pause size={20} />
      {:else}
        <Play size={20} />
      {/if}
    </button>
    <button
      on:click={playNextTrack}
      class="mr-4 flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors duration-200 hover:bg-blue-700"
    >
      <SkipForward size={20} />
    </button>
    <span class="time-display mr-4 min-w-[80px] text-right text-sm"
      >{formatTime(playerState.progress)} / {formatTime(
        playerState.duration
      )}</span
    >
    <progress
      value={playerState.progress}
      max={playerState.duration}
      class="h-2 flex-grow rounded-full bg-slate-700 [&::-webkit-progress-bar]:bg-slate-700 [&::-webkit-progress-value]:bg-blue-600"
    ></progress>
  </div>

  {#if playerState.status === 'error'}
    <div class="error-message mt-4 text-red-500">播放错误！</div>
  {/if}
</div>
