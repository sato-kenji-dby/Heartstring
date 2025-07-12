import * as path from 'path';
import * as fs from 'fs/promises';
import type { Track } from '$types'; // 导入 Track 接口
// import * as musicMetadata from 'music-metadata'; // 直接导入 music-metadata

const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.m4a']);

/**
 * Scans a directory for music files and extracts their metadata.
 * @param {string} dir - The directory path to scan.
 * @returns {Promise<Track[]>} A promise that resolves to an array of track metadata objects.
 */
export async function scanDirectory(dir: string): Promise<Track[]> {
  const musicMetadata = await import('music-metadata');
  let tracks: Track[] = [];
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
      const filePath = path.join(dir, file.name);
      console.log(`Scanning: ${filePath}`); // 添加日志
      if (file.isDirectory()) {
        tracks = tracks.concat(await scanDirectory(filePath));
      } else if (SUPPORTED_EXTENSIONS.has(path.extname(file.name).toLowerCase())) {
        try {
          const metadata = await musicMetadata.parseFile(filePath);
          tracks.push({
            id: 0, // ID will be assigned by the database
            path: filePath,
            title: metadata.common.title || path.basename(file.name),
            artist: metadata.common.artist || 'Unknown Artist',
            album: metadata.common.album || 'Unknown Album',
            duration: metadata.format.duration || 0,
          });
          console.log(`Successfully processed: ${filePath}`); // 添加成功日志
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
