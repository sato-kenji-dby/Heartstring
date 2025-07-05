/**
 * @typedef {Object} Track
 * @property {string} path
 * @property {string} [title]
 * @property {string} [artist]
 * @property {string} [album]
 * @property {number} [duration]
 */

const Database = require('better-sqlite3');

class MusicDatabase {
  /**
   * @param {string} dbPath
   */
  constructor(dbPath = 'music.db') {
    this.db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'test' ? undefined : console.log });
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

  /**
   * @param {Track[]} tracks
   */
  insertTracks(tracks) {
    const insert = this.db.prepare('INSERT OR IGNORE INTO tracks (path, title, artist, album, duration) VALUES (?, ?, ?, ?, ?)');
    const transaction = this.db.transaction((tracksToInsert) => {
      for (const track of tracksToInsert) {
        // Standardize path before inserting
        const standardizedPath = track.path.replace(/\\/g, '/');
        insert.run(standardizedPath, track.title, track.artist, track.album, track.duration);
      }
    });
    transaction(tracks);
  }

  /**
   * @returns {Track[]}
   */
  getAllTracks() {
    return /** @type {Track[]} */ (this.db.prepare('SELECT * FROM tracks').all());
  }

  /**
   * @param {string} path
   * @returns {Track | undefined}
   */
  getTrackByPath(path) {
    // Standardize path before querying
    const standardizedPath = path.replace(/\\/g, '/');
    return /** @type {Track | undefined} */ (this.db.prepare('SELECT * FROM tracks WHERE path = ?').get(standardizedPath));
  }

  close() {
    this.db.close();
  }

  // For testing purposes, to clear the database
  clear() {
    this.db.exec('DELETE FROM tracks');
  }
}

module.exports = MusicDatabase;
