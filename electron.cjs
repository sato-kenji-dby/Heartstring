const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs/promises');
const Database = require('better-sqlite3');

const db = new Database('music.db', { verbose: console.log });
db.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE,
    title TEXT,
    artist TEXT,
    album TEXT,
    duration REAL
  )
`);

let musicMetadata;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const startUrl = process.env.ELECTRON_START_URL || url.format({
    pathname: path.join(__dirname, 'build/index.html'),
    protocol: 'file:',
    slashes: true,
  });

  mainWindow.loadURL(startUrl);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.m4a']);

async function scanMusicFiles(dir) {
  if (!musicMetadata) {
    musicMetadata = await import('music-metadata');
  }
  let tracks = [];
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
      const filePath = path.join(dir, file.name);
      if (file.isDirectory()) {
        tracks = tracks.concat(await scanMusicFiles(filePath));
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

ipcMain.handle('open-directory-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (canceled || filePaths.length === 0) {
    return null;
  }

  const dirPath = filePaths[0];
  const tracks = await scanMusicFiles(dirPath);

  const insert = db.prepare('INSERT OR IGNORE INTO tracks (path, title, artist, album, duration) VALUES (?, ?, ?, ?, ?)');
  const transaction = db.transaction((tracks) => {
    for (const track of tracks) {
      insert.run(track.path, track.title, track.artist, track.album, track.duration);
    }
  });
  transaction(tracks);

  const allTracks = db.prepare('SELECT * FROM tracks').all();
  console.log('All tracks in DB:', allTracks);

  return dirPath;
});

ipcMain.handle('get-all-tracks', async () => {
  const allTracks = db.prepare('SELECT * FROM tracks').all();
  return allTracks;
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
