const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs/promises');
const Database = require('better-sqlite3');
const { exec, spawn } = require('child_process'); // 导入 spawn
// const { ipcMain, BrowserWindow } = require('electron'); // 导入 BrowserWindow - 这一行是重复的，删除

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

class PlayerService {
    constructor(win) {
        this.currentPlayer = null;
        this.mainWindow = win; // Reference to the main browser window
        this.currentTrack = null;
    }

    play(track) {
        if (this.currentPlayer) {
            this.stop();
        }

        this.currentTrack = track;
        const filePath = track.path;

        const args = [
            '-nodisp',
            '-autoexit',
            '-i',
            filePath
        ];

        console.log(`Spawning ffplay with args: ${args.join(' ')}`);
        this.currentPlayer = spawn('ffplay', args);

        // 通知前端播放已开始，并传递整个轨道信息（包含总时长）
        this.mainWindow.webContents.send('playback-started', this.currentTrack);

        this.currentPlayer.stderr.on('data', (data) => {
            const line = data.toString();
            // ffplay 的进度输出格式大致是: "  4.5 M-V: ... "
            // 我们尝试从中提取时间（以秒为单位）
            const match = line.match(/^\s*(\d+\.\d+)/);
            if (match && match[1]) {
                const currentTime = parseFloat(match[1]);
                // 发送进度更新
                this.mainWindow.webContents.send('playback-progress', { currentTime });
            }
        });

        this.currentPlayer.on('close', (code) => {
            console.log(`ffplay process exited with code ${code}`);
            // 如果 code 为 null，通常表示进程被强制终止 (e.g., SIGKILL)
            if (code === 0) {
                // 正常播放结束
                this.mainWindow.webContents.send('playback-ended');
            } else if (code !== null) { // 只有当 code 不为 0 且不为 null 时才视为错误
                this.mainWindow.webContents.send('playback-error', `FFplay exited with code ${code}.`);
            } else {
                // code 为 null，表示进程被强制终止，不发送错误
                console.log('FFplay process killed by SIGKILL.');
            }
            this.currentPlayer = null;
            this.currentTrack = null;
        });

        this.currentPlayer.on('error', (err) => {
            console.error('Failed to start ffplay process.', err);
            this.mainWindow.webContents.send('playback-error', err.message);
            this.currentPlayer = null;
            this.currentTrack = null;
        });
    }

    stop() {
        if (this.currentPlayer) {
            this.currentPlayer.kill('SIGKILL');
            console.log('Killed previous ffplay process.');
            this.currentPlayer = null;
            this.currentTrack = null;
        }
    }
}

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

  // 创建播放器服务实例
  const playerService = new PlayerService(mainWindow);

  // --- 设置IPC监听器 ---
  ipcMain.on('play-track', (event, track) => {
      playerService.play(track);
  });

  ipcMain.on('stop-playback', () => {
      playerService.stop();
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
