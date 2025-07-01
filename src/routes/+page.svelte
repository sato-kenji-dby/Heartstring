<script>
  let selectedDirectory = '';

  async function handleSelectFolder() {
    const dir = await window.electronAPI.openDirectoryDialog();
    if (dir) {
      selectedDirectory = dir;
    }
  }
</script>

<h1>Heartstring Music Player</h1>

<button on:click={handleSelectFolder}>
  Select Music Folder
</button>

{#if selectedDirectory}
  <p>Selected folder: {selectedDirectory}</p>
{/if}
