import Database from 'better-sqlite3';
import type { Track } from '$types';

class MusicDatabase {
  private db: Database.Database;

  constructor(dbPath: string = 'music.db') {
    this.db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined });
    this.init();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE,
        title TEXT,
        artist TEXT,
        album TEXT,
        duration REAL
      )
    `);
  }

  insertTracks(tracks: Track[]) {
    const insert = this.db.prepare('INSERT OR IGNORE INTO tracks (path, title, artist, album, duration) VALUES (?, ?, ?, ?, ?)');
    const transaction = this.db.transaction((tracksToInsert: Track[]) => {
      for (const track of tracksToInsert) {
        // Standardize path before inserting
        const standardizedPath = track.path.replace(/\\/g, '/');
        insert.run(standardizedPath, track.title, track.artist, track.album, track.duration);
      }
    });
    transaction(tracks);
  }

  getAllTracks(): Track[] {
    return this.db.prepare('SELECT * FROM tracks').all() as Track[];
  }

  getTrackByPath(path: string): Track | undefined {
    // Standardize path before querying
    const standardizedPath = path.replace(/\\/g, '/');
    return this.db.prepare('SELECT * FROM tracks WHERE path = ?').get(standardizedPath) as Track | undefined;
  }

  close() {
    this.db.close();
  }

  // For testing purposes, to clear the database
  clear() {
    this.db.exec('DELETE FROM tracks');
  }
}

export default MusicDatabase;
