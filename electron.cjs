const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process'); // 导入 spawn
const MusicDatabase = require('./src/services/database/database'); // 导入重构后的数据库模块
const { scanDirectory } = require('./src/services/library/LibraryService'); // 导入重构后的扫描服务

const db = new MusicDatabase(); // 使用新的数据库类
let mainWindow;
let currentPlayerProcess = null; // 用于存储 ffplay 进程的引用

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

  // IPC Handlers for Library and Database operations
  ipcMain.handle('get-all-tracks', async () => {
    return db.getAllTracks();
  });

  ipcMain.handle('open-directory-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (!canceled && filePaths.length > 0) {
      const selectedDirectory = filePaths[0];
      console.log('Selected directory:', selectedDirectory);
      const tracks = await scanDirectory(selectedDirectory);
      db.insertTracks(tracks);
      return tracks;
    }
    return [];
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

  // --- 设置IPC监听器 ---
  ipcMain.on('play-track', (event, { filePath, startTime = 0 }) => {
      if (currentPlayerProcess) {
          currentPlayerProcess.kill('SIGKILL');
          currentPlayerProcess = null;
      }

      const args = [
          '-nodisp',
          '-autoexit',
          '-i',
          filePath
      ];

      if (startTime > 0) {
          args.splice(1, 0, '-ss', startTime.toString());
      }

      console.log(`Spawning ffplay with args: ${args.join(' ')}`);
      const newPlayerProcess = spawn('ffplay', args);
      currentPlayerProcess = newPlayerProcess;

      newPlayerProcess.stderr.on('data', (data) => {
          // 将 ffplay 的 stderr 数据转发给渲染进程
          mainWindow.webContents.send('ffplay-stderr', data.toString());
      });

      newPlayerProcess.on('close', (code) => {
          if (newPlayerProcess === currentPlayerProcess) { // 确保是当前活跃的进程
              console.log(`ffplay process exited with code ${code}`);
              mainWindow.webContents.send('playback-closed', { code });
              currentPlayerProcess = null;
          }
      });

      newPlayerProcess.on('error', (err) => {
          if (newPlayerProcess === currentPlayerProcess) { // 确保是当前活跃的进程
              console.error('Failed to start ffplay process.', err);
              mainWindow.webContents.send('playback-error', err.message);
              currentPlayerProcess = null;
          }
      });
  });

  ipcMain.on('stop-playback', () => {
      console.log('Received stop-playback IPC event in main process.');
      if (currentPlayerProcess) {
          currentPlayerProcess.kill('SIGKILL');
          currentPlayerProcess = null;
          console.log('Killed ffplay process.');
      } else {
          console.log('No active player to stop.');
      }
  });

  ipcMain.on('pause-playback', () => {
      // 在主进程中，暂停实际上是杀死进程，并由渲染进程记录暂停时间
      console.log('Received pause-playback IPC event in main process.');
      if (currentPlayerProcess) {
          currentPlayerProcess.kill('SIGKILL');
          currentPlayerProcess = null;
          console.log('Killed ffplay process for pause.');
      }
  });

}

app.on('ready', createWindow);

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
