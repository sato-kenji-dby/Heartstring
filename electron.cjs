// file: electron.cjs

// --- 1. 全局错误捕获 (保持不变，非常好) ---
process.on('uncaughtException', (error, origin) => {
    console.error('!!!!!!!!!! UNCAUGHT EXCEPTION !!!!!!!!!');
    console.error('Origin:', origin);
    console.error(error);
    const { dialog } = require('electron');
    dialog.showErrorBox('Fatal Error', error.stack || error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('!!!!!!!!!! UNHANDLED REJECTION !!!!!!!!!');
    console.error('Promise:', promise);
    console.error('Reason:', reason);
});


// --- 2. 导入与全局变量声明 ---
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');

let mainWindow; // 主窗口引用
let db;         // 数据库实例
let playerService; // 播放器服务实例

// --- 3. 核心功能函数 ---

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

    // 根据环境变量判断是加载开发服务器URL还是本地文件
    const startUrl = process.env.ELECTRON_START_URL || url.format({
        pathname: path.join(__dirname, '../dist/index.html'), // 生产环境指向前端构建产物
        protocol: 'file:',
        slashes: true,
    });
    
    console.log(`Loading URL: ${startUrl}`);
    mainWindow.loadURL(startUrl);

    // 在开发时可以默认打开开发者工具
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

/**
 * 注册所有IPC事件监听器
 * 将逻辑委托给相应的服务
 */
function registerIpcHandlers(db, playerService) {
    // 数据库和文件库相关
    ipcMain.handle('get-all-tracks', () => db.getAllTracks());
    ipcMain.handle('open-directory-dialog', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
        });
        if (canceled || filePaths.length === 0) return [];

        const tracks = await playerService.scanDirectory(filePaths[0]); // 扫描逻辑可以放在PlayerService里
        db.insertTracks(tracks);
        return tracks;
    });

    // 播放控制相关
    ipcMain.on('play-track', (event, { filePath, startTime = 0 }) => {
        playerService.play(filePath, startTime);
    });
    ipcMain.on('stop-playback', () => playerService.stop());
    ipcMain.on('pause-playback', () => playerService.pause()); // 假设PlayerService有pause方法
    ipcMain.on('resume-playback', () => playerService.resume()); // 假设PlayerService有resume方法
}

// --- 4. 主启动流程 ---

/**
 * 应用的主入口函数
 */
async function main() {
    // 确保app已经准备好，这是Electron的最佳实践
    await app.whenReady();

    try {
        // 异步加载所有需要的模块
        const { default: MusicDatabase } = await import('./dist-electron/src/services/database/database.cjs');
        const { PlayerService } = await import('./dist-electron/src/core/player/PlayerService.cjs'); // 假设PlayerService在这里

        // 初始化服务
        db = new MusicDatabase();
        playerService = new PlayerService(mainWindow); // 理想情况下PlayerService也应通过构造函数接收win

        // 注册IPC处理器
        registerIpcHandlers(db, playerService);
        
        // 创建主窗口
        createWindow();
        
        // 更新PlayerService中的窗口引用
        // 因为createWindow后mainWindow才被赋值
        playerService.setWindow(mainWindow); 

    } catch (error) {
        console.error('Failed to initialize main process:', error);
        // 如果初始化失败，可以用dialog报告错误，然后退出
        dialog.showErrorBox('Initialization Error', `Failed to start the application:\n\n${error.stack || error.message}`);
        app.quit();
    }
}

// --- 5. 应用生命周期事件绑定 ---

// 将主流程的执行绑定到'ready'事件是旧方法，
// 直接调用一个包含 app.whenReady() 的async函数是更现代和可靠的方法。

// 监听窗口全部关闭事件
app.on('window-all-closed', () => {
    // 在macOS上，除非用户明确退出，否则应用和菜单栏会保持激活
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 监听应用被激活事件（主要用于macOS）
app.on('activate', () => {
    // 如果没有窗口打开，则创建一个
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});


// --- 启动应用 ---
main();