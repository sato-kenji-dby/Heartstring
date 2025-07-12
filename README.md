# Heartstring

一个现代的跨平台桌面音乐播放器，使用 Electron、SvelteKit、Vite 和 TypeScript 构建。

## 核心技术栈

*   **前端:** SvelteKit, TypeScript, Vite
*   **后端 (Electron 主进程):** Node.js, TypeScript, Vite
*   **数据库:** SQLite
*   **音频元数据:** music-metadata
*   **音频播放:** ffplay (通过 `child_process` 调用)

## 架构概述

Heartstring 采用多进程模型，以实现健壮性和安全性：

*   **主进程 (Main Process):** 负责所有与操作系统交互的后端任务，如窗口管理、文件系统操作、数据库访问和外部进程调用。它运行在纯 Node.js 环境中。
*   **渲染进程 (Renderer Process):** 负责用户界面和交互，运行在 Chromium 沙箱中。所有需要系统权限的操作都通过 IPC (Inter-Process Communication) 与主进程通信。
*   **预加载脚本 (Preload Script):** 作为主进程和渲染进程之间安全的桥梁，通过 `contextBridge` 暴露定义明确的 API 接口。

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
