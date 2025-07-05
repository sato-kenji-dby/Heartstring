import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import MusicDatabase from '../database';
import { scanDirectory } from '../libraryService';

// Since MusicDatabase is a default export, we can't use named import for its type directly.
// We can use JSDoc for type hinting or create a separate .d.ts file if needed for stricter TS.
// For now, we'll rely on the runtime import and JSDoc for type inference.

describe('Library Service Unit Tests', () => {
  /** @type {MusicDatabase} */
  let db; // Revert to JSDoc for type hinting
  const TEST_DB_PATH = ':memory:'; // Use in-memory database for testing
  const TEST_DATA_DIR = path.join(process.cwd(), 'test-data'); // Use process.cwd() for project root

  beforeEach(async () => {
    db = new MusicDatabase(TEST_DB_PATH);
    // Assuming TEST_DATA_DIR exists and contains real audio files provided by the user.
    // No need to create dummy files or directory here.
  });

  afterEach(async () => {
    db.close();
    // No need to clean up test-data directory as per user's request.
  });

  it('should properly set up and tear down the database', () => {
    expect(db).toBeDefined();
    const tracks = db.getAllTracks();
    expect(tracks).toEqual([]); // Should be empty initially
  });

  it('should scan a directory and add tracks to the database', async () => {
    const scannedTracks = await scanDirectory(TEST_DATA_DIR);
    console.log('Scanned Tracks:', scannedTracks); // Debugging log
    db.insertTracks(scannedTracks);

    const allTracks = db.getAllTracks();
    console.log('All Tracks in DB after scan:', allTracks); // Debugging log
    expect(allTracks.length).toBeGreaterThan(0);
    expect(allTracks.length).toBe(scannedTracks.length); // All scanned tracks should be added
  });

  it('should correctly read metadata for at least one known track', async () => {
    const scannedTracks = await scanDirectory(TEST_DATA_DIR);
    db.insertTracks(scannedTracks);

    // Get the first scanned track to check its metadata
    expect(scannedTracks.length).toBeGreaterThan(0);
    const firstScannedTrack = scannedTracks[0];
    const trackFromDb = db.getTrackByPath(firstScannedTrack.path); // Use the actual path from scanned data
    
    console.log(`First Scanned Track:`, firstScannedTrack); // Debugging log
    console.log(`Track from DB for ${firstScannedTrack.path}:`, trackFromDb); // Debugging log

    expect(trackFromDb).toBeDefined();
    expect(trackFromDb.path).toBe(firstScannedTrack.path.replace(/\\/g, '/')); // Path in DB is standardized
    expect(typeof trackFromDb.title).toBe('string');
    expect(typeof trackFromDb.artist).toBe('string');
    expect(typeof trackFromDb.album).toBe('string');
  });

  it('should not add duplicate entries when scanning the same directory twice', async () => {
    // First scan
    let scannedTracks = await scanDirectory(TEST_DATA_DIR);
    db.insertTracks(scannedTracks);
    const firstScanCount = db.getAllTracks().length;

    // Second scan
    scannedTracks = await scanDirectory(TEST_DATA_DIR);
    db.insertTracks(scannedTracks); // Should use INSERT OR IGNORE

    const secondScanCount = db.getAllTracks().length;
    expect(secondScanCount).toBe(firstScanCount); // Count should remain the same
  });
});
