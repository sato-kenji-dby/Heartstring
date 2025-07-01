<script>
  import { onMount } from 'svelte';

  let tracks = [];

  async function fetchTracks() {
    tracks = await window.electronAPI.getAllTracks();
  }

  onMount(async () => {
    await fetchTracks();
  });

  async function handleSelectFolder() {
    await window.electronAPI.openDirectoryDialog();
    await fetchTracks();
  }
</script>

<h1>Heartstring Music Player</h1>

<button on:click={handleSelectFolder}>
  Scan Music Folder
</button>

<h2>Music Library</h2>
{#if tracks.length > 0}
  <table>
    <thead>
      <tr>
        <th>Title</th>
        <th>Artist</th>
        <th>Album</th>
        <th>Duration</th>
      </tr>
    </thead>
    <tbody>
      {#each tracks as track (track.id)}
        <tr>
          <td>{track.title || 'Unknown Title'}</td>
          <td>{track.artist || 'Unknown Artist'}</td>
          <td>{track.album || 'Unknown Album'}</td>
          <td>{track.duration ? track.duration.toFixed(2) + 's' : 'N/A'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{:else}
  <p>No music found. Scan a folder to begin.</p>
{/if}
