const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process'); // 导入 spawn
const MusicDatabase = require('./src/lib/database'); // 导入重构后的数据库模块
const { scanDirectory } = require('./src/lib/libraryService'); // 导入重构后的扫描服务

const db = new MusicDatabase(); // 使用新的数据库类
let mainWindow;

class PlayerService {
    constructor(win) {
        this.currentPlayer = null;
        this.mainWindow = win;
        this.currentTrack = null;
        this.queue = [];
        this.pausedTime = 0; // 记录暂停时的播放时间
        this.isPaused = false; // 标记是否处于暂停状态
    }

    play(track, startTime = 0) { // 增加 startTime 参数
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

        if (startTime > 0) {
            args.splice(1, 0, '-ss', startTime.toString()); // 在 -nodisp 之后插入 -ss 参数
            console.log(`Resuming ffplay from ${startTime} seconds.`);
        }

        console.log(`Spawning ffplay with args: ${args.join(' ')}`);
        const newPlayerProcess = spawn('ffplay', args); // 捕获新进程的引用
        this.currentPlayer = newPlayerProcess; // 更新实例变量

        this.isPaused = false; // 开始播放时重置暂停状态
        this.mainWindow.webContents.send('playback-started', this.currentTrack);

        newPlayerProcess.stderr.on('data', (data) => { // 监听新进程的 stderr
            const line = data.toString();
            const match = line.match(/^\s*(\d+\.\d+)/);
            if (match && match[1]) {
                const currentTime = parseFloat(match[1]);
                this.pausedTime = currentTime;
                this.mainWindow.webContents.send('playback-progress', { currentTime });
            }
        });

        newPlayerProcess.on('close', (code) => { // 监听新进程的 close 事件
            // 只有当关闭的进程是当前活跃的播放器进程时才处理
            if (newPlayerProcess !== this.currentPlayer) {
                console.log(`Ignoring close event from old ffplay process (PID: ${newPlayerProcess.pid}).`);
                return;
            }

            console.log(`ffplay process exited with code ${code}`);
            if (code === 0) {
                this.mainWindow.webContents.send('playback-ended');
                this.playNext();
            } else if (code !== null && !this.isPaused) {
                this.mainWindow.webContents.send('playback-error', `FFplay exited with code ${code}.`);
                this.currentPlayer = null; // 错误时才清理
                this.currentTrack = null;
                this.pausedTime = 0;
            } else {
                console.log('FFplay process killed by SIGKILL or paused.');
                // 如果是暂停或被强制终止，并且不是错误，则不清理 currentPlayer
                if (this.isPaused) {
                    // 暂停时，currentPlayer 应该保持指向当前进程，以便恢复
                } else {
                    this.currentPlayer = null; // 否则清理
                    this.currentTrack = null;
                    this.pausedTime = 0;
                }
            }
        });

        newPlayerProcess.on('error', (err) => { // 监听新进程的 error 事件
            // 只有当错误来自当前活跃的播放器进程时才处理
            if (newPlayerProcess !== this.currentPlayer) {
                console.log(`Ignoring error event from old ffplay process (PID: ${newPlayerProcess.pid}).`);
                return;
            }

            console.error('Failed to start ffplay process.', err);
            this.mainWindow.webContents.send('playback-error', err.message);
            this.currentPlayer = null;
            this.currentTrack = null;
            this.pausedTime = 0;
        });
    }

    stop() {
        if (this.currentPlayer) {
            console.log(`Attempting to kill ffplay process with PID: ${this.currentPlayer.pid}`);
            this.currentPlayer.kill('SIGKILL');
            console.log('Killed previous ffplay process.');
            this.currentPlayer = null;
            this.currentTrack = null;
            this.pausedTime = 0; // 停止时重置暂停时间
            this.isPaused = false; // 停止时重置暂停状态
        } else {
            console.log('No active player to stop.');
        }
    }

    pause() {
        if (this.currentPlayer && this.currentTrack) {
            this.isPaused = true; // 标记为暂停状态
            this.currentPlayer.kill('SIGKILL'); // 杀死进程
            console.log(`Paused playback at ${this.pausedTime} seconds.`);
            this.mainWindow.webContents.send('playback-paused', { currentTime: this.pausedTime }); // 通知前端暂停
        }
    }

    resume() {
        if (this.currentTrack && this.pausedTime > 0) {
            console.log(`Resuming playback of ${this.currentTrack.title} from ${this.pausedTime} seconds.`);
            this.play(this.currentTrack, this.pausedTime); // 从暂停时间开始播放
            this.mainWindow.webContents.send('playback-resumed', { currentTime: this.pausedTime }); // 通知前端恢复
        } else {
            console.log('No track to resume or no paused time recorded.');
        }
    }

    addToQueue(track) {
        this.queue.push(track);
        this.mainWindow.webContents.send('queue-updated', this.queue);
        console.log('Added to queue:', track.title, 'Current queue length:', this.queue.length);
    }

    getQueue() {
        return this.queue;
    }

    playNext() {
        if (this.queue.length > 0) {
            const nextTrack = this.queue.shift();
            this.currentTrack = null; // 在播放下一首之前清除当前轨道
            this.play(nextTrack);
            this.mainWindow.webContents.send('queue-updated', this.queue);
        } else {
            console.log('Queue is empty. No next track to play.');
            this.currentTrack = null; // 队列为空时也清除当前轨道
            this.currentPlayer = null; // 队列为空时也清除播放器
            this.pausedTime = 0;
            this.isPaused = false;
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
      console.log('Received stop-playback IPC event in main process.');
      playerService.stop();
  });

  ipcMain.on('add-to-queue', (event, track) => {
      playerService.addToQueue(track);
  });

  ipcMain.handle('get-queue', () => {
      return playerService.getQueue();
  });

  ipcMain.on('pause-playback', () => {
      playerService.pause();
  });

  ipcMain.on('resume-playback', () => {
      playerService.resume();
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
