# Heartstring

一个现代的跨平台桌面音乐播放器，使用 Electron、SvelteKit、Vite 和 TypeScript 构建。

## 核心技术栈

*   **前端:** SvelteKit, TypeScript, Vite
*   **后端 (Electron 主进程):** Node.js, TypeScript, Vite
*   **数据库:** SQLite
*   **音频元数据:** music-metadata
*   **音频播放:** ffplay (通过 `child_process` 调用)

## 安装和运行 (面向用户)

要直接使用 Heartstring 音乐播放器，您需要完成以下步骤：

1.  **下载应用程序**:
    *   请从 [发布页面](https://github.com/sato-kenji-dby/Heartstring/releases) 下载最新版本的预构建应用程序包（例如 `.exe` for Windows, `.dmg` for macOS, `.AppImage` for Linux）。
    *   解压下载的文件到您选择的目录。

2.  **安装 FFmpeg (包含 ffplay)**:
    *   Heartstring 依赖 `ffplay` 进行音频播放，它是 FFmpeg 套件的一部分。您需要确保 `ffplay` 可执行文件在您的系统 PATH 环境变量中可访问。
    *   **Windows**:
        1.  访问 [FFmpeg 官方网站](https://ffmpeg.org/download.html) 下载 Windows 版本的 FFmpeg。
        2.  解压下载的 ZIP 文件到一个您选择的目录（例如 `C:\ffmpeg`）。
        3.  将 FFmpeg 的 `bin` 目录（例如 `C:\ffmpeg\bin`）添加到您的系统 PATH 环境变量中。
            *   右键点击“此电脑” -> “属性” -> “高级系统设置” -> “环境变量”。
            *   在“系统变量”下找到 `Path`，点击“编辑”。
            *   点击“新建”，然后添加 FFmpeg `bin` 目录的路径。
            *   点击“确定”保存更改。
        4.  打开一个新的命令提示符或 PowerShell 窗口，输入 `ffplay -version` 验证是否安装成功。
    *   **macOS**:
        *   使用 Homebrew 安装 FFmpeg: `brew install ffmpeg`
        *   验证安装: `ffplay -version`
    *   **Linux**:
        *   使用您的包管理器安装 FFmpeg (例如 Debian/Ubuntu: `sudo apt update && sudo apt install ffmpeg`)。
        *   验证安装: `ffplay -version`

3.  **运行应用程序**:
    *   在您解压应用程序的目录中，找到并双击 Heartstring 的可执行文件（例如 `Heartstring.exe`）。

## 架构概述

Heartstring 采用多进程模型，以实现健壮性和安全性：

*   **主进程 (Main Process):** 负责所有与操作系统交互的后端任务，如窗口管理、文件系统操作、数据库访问和外部进程调用。它运行在纯 Node.js 环境中。
*   **渲染进程 (Renderer Process):** 负责用户界面和交互，运行在 Chromium 沙箱中。所有需要系统权限的操作都通过 IPC (Inter-Process Communication) 与主进程通信。
*   **预加载脚本 (Preload Script):** 作为主进程和渲染进程之间安全的桥梁，通过 `contextBridge` 暴露定义明确的 API 接口。

### 模块间通信管理

Heartstring 的播放功能涉及主进程和渲染进程之间的复杂交互，通过 IPC (Inter-Process Communication) 进行管理：

*   **主进程 (`PlayerService` 和 `AudioService`):**
    *   `PlayerService` 负责核心音频播放逻辑（如 `ffplay` 进程管理、暂停/恢复、进度解析）。**为了解决“下一首”功能中可能存在的竞态条件和多进程问题，`PlayerService.stop()` 方法现在返回一个 `Promise`，确保 `ffplay` 进程完全终止后才解析。`PlayerService.play()` 方法在启动新进程前会 `await` `stop()` 的完成。**
    *   `AudioService` 封装了 `PlayerService`，并负责监听 `PlayerService` 的事件（如 `playback-progress`, `playback-ended` 等），然后通过 `ipcMain.emit` 将这些事件转发到渲染进程。**`AudioService.playNext()` 方法现在是异步的，并在播放下一首曲目之前显式地 `await playerService.stop()`，进一步确保在切换曲目时旧进程已完全清理。**
*   **渲染进程 (`playerStore`):**
    *   `playerStore` 是一个自定义 Svelte 存储，它封装了与主进程的 IPC 通信。
    *   它通过 `ipcRenderer.send` 向主进程发送播放控制命令（如 `play-track`, `pause-playback`, `resume-playback`, `stop-playback`, `add-to-queue`, `play-next-track`）。
    *   它通过 `ipcRenderer.on('player-store-update', ...)` 监听来自主进程的统一状态更新，并据此更新自身的播放状态。

这种分离确保了 UI 的响应性，同时将敏感的系统操作隔离在主进程中。

## 开发与构建

### 开发

1.  **安装依赖:**
    ```bash
    npm install
    ```
2.  **启动开发服务器和 Electron 应用:**
    ```bash
    npm run dev
    ```

### 构建

创建应用的生产版本：

```bash
npm run build
```

构建完成后，可以运行 Electron 应用：

```bash
npm start
```

## 构建工具链

项目统一使用 Vite 进行构建：

*   **前端构建:** `vite.config.ts` 配置 SvelteKit 应用。
*   **主进程/预加载脚本构建:** `vite.main.config.ts` 专门用于构建 Electron 主进程和预加载脚本，确保输出为 CommonJS 格式，并正确处理外部依赖和路径别名。

## 路径别名

项目使用路径别名 (`$api`, `$core`, `$services` 等) 来简化模块导入。这些别名在 `vite.config.ts`, `vite.main.config.ts` 和 `tsconfig.json` 中显式配置，以确保开发和构建过程中的一致性。

## TypeScript 配置

`tsconfig.json` 负责整个项目的 TypeScript 类型检查，包括前端和 Electron 主进程代码。它配置了 `types: ["node", "electron"]` 以确保正确的类型推断。
