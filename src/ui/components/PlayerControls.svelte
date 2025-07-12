<script lang="ts">
  import { playerStore } from '$stores/playerStore';
  import type { Track } from '$types'; // 导入 Track 类型
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

<div class="player-controls flex flex-col items-center p-4 border-t border-slate-700 bg-slate-800 w-full box-border">
  {#if playerState.currentTrack}
    <div class="track-info mb-4 font-bold text-lg">
      <span>{playerState.currentTrack.title}</span> - <span>{playerState.currentTrack.artist}</span>
    </div>
  {:else}
    <div class="track-info mb-4 font-bold text-lg">
      <span>没有正在播放的歌曲</span>
    </div>
  {/if}

  <div class="playback-bar flex items-center w-4/5">
    <button on:click={togglePlayPause} class="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center mr-4">
      {#if playerState.isPlaying}
        <Pause size={20} />
      {:else}
        <Play size={20} />
      {/if}
    </button>
    <button on:click={playNextTrack} class="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center mr-4">
      <SkipForward size={20} />
    </button>
    <span class="time-display mr-4 text-sm min-w-[80px] text-right">{formatTime(playerState.progress)} / {formatTime(playerState.duration)}</span>
    <progress value={playerState.progress} max={playerState.duration} class="flex-grow h-2 rounded-full bg-slate-700 [&::-webkit-progress-bar]:bg-slate-700 [&::-webkit-progress-value]:bg-blue-600"></progress>
  </div>

  {#if playerState.status === 'error'}
    <div class="error-message text-red-500 mt-4">播放错误！</div>
  {/if}
</div>
