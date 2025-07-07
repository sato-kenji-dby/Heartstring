// file: electron.cjs
// Heartstring Main Process Entry Point

// --- 1. 模块导入 ---
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');

// --- 2. 全局错误捕获 (在任何其他代码之前) ---
process.on('uncaughtException', (error, origin) => {
    console.error('!!!!!!!!!! FATAL: UNCAUGHT EXCEPTION !!!!!!!!!');
    console.error('Origin:', origin);
    console.error(error);
    // 在app ready之前dialog可能不可用，因此只在控制台输出
    if (app.isReady()) {
        dialog.showErrorBox('Fatal Application Error', error.stack || error.message);
    }
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('!!!!!!!!!! FATAL: UNHANDLED REJECTION !!!!!!!!!');
    console.error('Promise:', promise);
    console.error('Reason:', reason);
    process.exit(1);
});

// --- 3. 全局变量与服务初始化 ---

// 这是一个IIFE(立即调用函数表达式)，用于在顶层作用域使用await
// 但为了简单，我们还是用更传统的require()
let mainWindow; // 主窗口引用
let db;         // 数据库服务实例
let playerService; // 播放器服务实例
let libraryService; // 文件库服务实例

try {
    // **核心: 使用 require() 并正确处理 export default**
    // 这种方式在CJS入口文件中最直接、最可靠
    const MusicDatabase = require('./dist-electron/src/services/database/database.cjs').default;
    const { scanDirectory } = require('./dist-electron/src/services/library/LibraryService.cjs');
    const { PlayerService } = require('./dist-electron/src/core/player/PlayerService.cjs');

    // 实例化所有服务
    db = new MusicDatabase();
    // libraryService = new LibraryService();
    playerService = new PlayerService(); // 稍后注入mainWindow

} catch (error) {
    console.error('Fatal: Failed to load and initialize core services.', error);
    // 此时app可能还没ready，弹窗会失败，所以只在console报错并退出
    process.exit(1);
}

// --- 4. 核心功能函数 ---

/**
 * 注册所有IPC事件监听器
 */
function registerIpcHandlers() {
    // 数据库和文件库相关
    ipcMain.handle('get-all-tracks', () => db.getAllTracks());
    ipcMain.handle('open-directory-dialog', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
        });
        if (canceled || !filePaths || filePaths.length === 0) {
            return [];
        }

        const tracks = await scanDirectory(filePaths[0]);
        db.insertTracks(tracks);
        return tracks;
    });

    // 播放控制相关 (将事件直接代理到playerService)
    ipcMain.on('play-track', (_, trackData) => playerService.play(trackData.filePath, trackData.startTime));
    ipcMain.on('stop-playback', () => playerService.stop());
    ipcMain.on('pause-playback', () => playerService.pause());
    ipcMain.on('resume-playback', () => playerService.resume());
    ipcMain.on('set-volume', (_, volume) => playerService.setVolume(volume));
}

/**
 * 创建和管理主窗口
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'dist-electron/preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // 将mainWindow实例注入需要它的服务
    playerService.setWindow(mainWindow);

    // 根据环境变量判断是加载开发服务器URL还是本地文件
    const startUrl = process.env.ELECTRON_START_URL || url.format({
        pathname: path.join(__dirname, 'dist/index.html'), // **重要**: 修正了生产路径
        protocol: 'file:',
        slashes: true,
    });
    
    console.log(`[Main Process] Loading URL: ${startUrl}`);
    mainWindow.loadURL(startUrl).catch(err => {
        console.error(`[Main Process] Failed to load URL: ${startUrl}`, err);
    });

    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// --- 5. 应用生命周期事件绑定 ---

// 只有当app准备好后，我们才创建窗口和注册IPC
app.on('ready', () => {
    console.log('[Main Process] App is ready.');
    registerIpcHandlers();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});