const path = require('path');
const fs = require('fs/promises');
/** @type {import('music-metadata') | undefined} */
let musicMetadata;

const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.m4a']);

/**
 * @typedef {Object} TrackMetadata
 * @property {string} path
 * @property {string} [title]
 * @property {string} [artist]
 * @property {string} [album]
 * @property {number} [duration]
 */

/**
 * Scans a directory for music files and extracts their metadata.
 * @param {string} dir - The directory path to scan.
 * @returns {Promise<TrackMetadata[]>} A promise that resolves to an array of track metadata objects.
 */
async function scanDirectory(dir) {
  if (!musicMetadata) {
    musicMetadata = await import('music-metadata');
  }
  /** @type {TrackMetadata[]} */
  let tracks = [];
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
      const filePath = path.join(dir, file.name);
      if (file.isDirectory()) {
        tracks = tracks.concat(await scanDirectory(filePath));
      } else if (SUPPORTED_EXTENSIONS.has(path.extname(file.name).toLowerCase())) {
        try {
          const metadata = await musicMetadata.parseFile(filePath);
          tracks.push({
            path: filePath,
            title: metadata.common.title,
            artist: metadata.common.artist,
            album: metadata.common.album,
            duration: metadata.format.duration,
          });
        } catch (error) {
          console.error(`Error reading metadata for ${filePath}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  return tracks;
}

module.exports = { scanDirectory };
