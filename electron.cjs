// file: electron.cjs

// --- 顶层捕获 ---
process.on('uncaughtException', (error, origin) => {
    console.error('!!!!!!!!!! UNCAUGHT EXCEPTION !!!!!!!!!');
    console.error('Origin:', origin);
    console.error(error);
    // 在开发时，你甚至可以加一个弹窗
    // const { dialog } = require('electron');
    // dialog.showErrorBox('Uncaught Exception', error.stack || error.message);
    process.exit(1); // 捕获到就退出，防止应用处于不稳定状态
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('!!!!!!!!!! UNHANDLED REJECTION !!!!!!!!!');
    console.error('Promise:', promise);
    console.error('Reason:', reason);
});

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process'); // 导入 spawn
let db; // 数据库实例将在异步导入完成后初始化
let mainWindow;
let currentPlayerProcess = null; // 用于存储 ffplay 进程的引用
let MusicDatabase; // 声明 MusicDatabase
let scanDirectory; // 声明 scanDirectory

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'dist-electron/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // IPC Handlers for Library and Database operations
  ipcMain.handle('get-all-tracks', async () => {
    try {
      return await db.getAllTracks();
    } catch (error) {
      console.error('Error getting all tracks:', error);
      throw new Error('Failed to retrieve tracks.');
    }
  });

  ipcMain.handle('open-directory-dialog', async () => {
    try {
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
    } catch (error) {
      console.error('Error opening directory dialog or scanning:', error);
      throw new Error('Failed to process directory selection.');
    }
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
              mainWindow.webContents.send('playback-error', { message: err.message, code: err.code });
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

app.on('ready', async () => {
  try {
    const databaseModule = await import('./dist-electron/services/database/database.cjs');
    MusicDatabase = databaseModule.default;
    const libraryModule = await import('./dist-electron/services/library/LibraryService.cjs');
    scanDirectory = libraryModule.scanDirectory;

    db = new MusicDatabase(); // 在模块加载完成后初始化数据库
    createWindow();
  } catch (error) {
    console.error('Failed to load modules or initialize database:', error);
    app.quit(); // 如果关键模块加载失败，则退出应用
  }
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
