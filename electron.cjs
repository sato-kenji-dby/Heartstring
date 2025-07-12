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

    const startUrl = process.env.ELECTRON_START_URL || url.format({
        pathname: path.join(__dirname, 'dist/index.html'),
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
app.on('ready', async () => {
    console.log('[Main Process] App is ready.');
    createWindow();
    try {
        // 动态导入并初始化主进程逻辑
        const { initializeMainProcess } = await import('./dist-electron/src/electron/main.cjs');
        await initializeMainProcess(mainWindow);
        console.log('[Main Process] Core services initialized and IPC handlers registered.');
    } catch (error) {
        console.error('Fatal: Failed to initialize main process logic.', error);
        dialog.showErrorBox('Fatal Application Error', error.stack || error.message);
        app.quit();
    }
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
