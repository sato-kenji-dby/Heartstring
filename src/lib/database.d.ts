import { Database as BetterSqlite3Database } from 'better-sqlite3';

export interface MusicTrack {
  id?: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
}

declare class MusicDatabase {
  private db: BetterSqlite3Database;
  constructor(dbPath?: string);
  init(): void;
  insertTracks(tracks: MusicTrack[]): void;
  getAllTracks(): MusicTrack[];
  getTrackByPath(path: string): MusicTrack | undefined;
  close(): void;
  clear(): void;
}

export default MusicDatabase;
