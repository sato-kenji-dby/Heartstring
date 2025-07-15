### **《Heartstring开发实录：现代化桌面应用构建核心指南》**

**核心技术栈：** Node.js, Electron, SvelteKit, Vite, TypeScript, SQLite
**目标：** 构建一个健壮、可维护、体验优秀的跨平台桌面应用。

---

### **第一章：核心架构与设计原则 (Core Architecture & Design Principles)**

#### **1.1. 架构模式：Electron多进程模型**
- **主进程 (Main Process):** 作为应用后端。严格限定于Node.js环境，负责操作系统级交互（窗口、文件系统、子进程管理、IPC通信）和应用生命周期管理。**禁止直接依赖任何前端框架的运行时或状态管理（如Svelte Store）。**
- **渲染进程 (Renderer Process):** 作为应用前端。运行于Chromium沙箱环境，负责所有UI渲染和用户交互。使用SvelteKit构建。所有需要系统权限的操作，必须通过IPC委托给主进程。
- **预加载脚本 (Preload Script):** 作为主进程与渲染进程之间的安全通信桥梁。使用`contextBridge`暴露定义明确、参数和返回值可序列化的API接口。

#### **1.2. 模块系统规范：ESM优先，隔离CJS**
- **项目默认模块系统:** 在`package.json`中设置`"type": "module"`，确立ES Modules (ESM)为项目标准。
- **核心代码库 (`src/`):** 统一使用TypeScript和ESM语法 (`import/export`)，保证代码的现代化和工具链兼容性。
- **CJS入口文件 (`electron.cjs`):** Electron的主入口文件使用`.cjs`后缀，以CommonJS模式运行，从而兼容需要同步API（如`__dirname`）的初始化操作。其职责严格限定为引导程序，通过**异步动态`import()`**加载并启动用ESM编写的主进程核心逻辑。

#### **1.3. 代码组织：高内聚，低耦合**
- 按功能领域（如`player`, `library`, `database`）组织代码，封装为独立的、职责单一的服务类（`PlayerService`, `LibraryService`）。
- 模块间通过清晰的接口或事件进行交互，避免紧密耦合，以提高代码的可测试性和可维护性。

---

### **第二章：构建与工具链配置 (Build & Toolchain Configuration)**

#### **2.1. 构建策略：Vite统一构建**
- **核心原则:** 放弃`tsc`独立编译主进程的模式。统一使用Vite作为前端和Electron主进程的唯一构建工具。
- **前端构建 (`vite.config.ts`):** 使用`@sveltejs/kit/vite`插件构建SvelteKit应用。
- **主进程构建 (`vite.main.config.ts`):**
    - 创建独立的Vite配置，用于构建主进程和预加载脚本。
    - **关键配置:**
        - `build.lib.entry`: 指定`main.ts`和`preload.ts`为多入口。
        - `build.lib.formats`: 强制输出格式为`['cjs']`。
        - `build.rollupOptions.external`: 将`electron`、Node.js内置模块及所有原生依赖项标记为外部，防止被错误打包。

#### **2.2. 路径别名管理：显式声明，单一来源**
- **单一来源:** 将所有路径别名集中定义在一个独立的配置文件中（如`alias.config.js`）。
- **显式配置:** 在所有相关的配置文件（`svelte.config.js`, `vite.config.ts`, `vite.main.config.ts`, `vitest.config.ts`）中，导入并显式地设置`resolve.alias`。此举可消除由工具链“魔法注入”或配置继承导致的路径解析不确定性，保证构建的稳定性和可预测性。

#### **2.3. SvelteKit适配器选型 (`adapter-static`)**
- **目标:** 为Electron环境生成静态HTML入口。
- **配置:**
    - 使用`@sveltejs/adapter-static`。
    - **必须**设置`fallback: 'index.html'`，以将应用构建为单页面应用（SPA）模式，这是在Electron中运行SvelteKit应用的标准方式。

---

### **第三章：打包与部署问题解决方案 (Packaging & Deployment Solutions)**

#### **3.1. 核心问题：打包后白屏或资源加载失败 (`Not allowed to load local resource`)**
- **根本原因:**
    1.  Electron的`webSecurity`默认禁止`file://`协议加载本地资源。
    2.  `file://`协议无法正确解析`.asar`归档文件内的资源。
    3.  现代前端框架生成的绝对路径（`/assets/...`）与`file://`协议不兼容。
- **最终解决方案：自定义协议**
    1.  **注册协议:** 在主进程中，使用`protocol.registerFileProtocol`注册一个自定义协议（如`app://`）。
    2.  **实现处理器:** 编写协议处理器，使用`new URL()`解析请求，并通过`path.join(__dirname, '../[build_dir]', pathName)`将`app://`请求准确映射到`.asar`包内的物理资源路径。
    3.  **更新加载方式:** 在`createWindow`中，使用`win.loadURL('app:///')`加载应用根，为所有资源解析提供稳定的基准URL。
    4.  **恢复安全:** **必须**将`webSecurity`保持或设置回`true`。
    5.  **构建配置协同:** 确保Vite配置 (`vite.config.ts`) 中的`base`选项为`'/'`（或默认），以生成与自定义协议匹配的绝对路径资源。

#### **3.2. 打包选项`asar`的策略**
- **`asar: true` (默认/生产):** 提升启动性能，保持分发目录整洁。是最终发布给用户的推荐选项。
- **`asar: false` (调试):** 一个强大的调试工具。当遇到生产环境的路径问题时，可临时禁用`asar`以获得透明的文件系统结构，便于排查和验证。问题解决后应恢复为`true`。

---

### **第四章：关键技术问题攻坚录 (Key Technical Challenges)**

- **原生模块编译 (`better-sqlite3`):**
    - **问题:** Electron内置的Node.js版本与系统Node.js版本不匹配。
    - **标准方案:** 使用`electron-rebuild`，并配置`postinstall`脚本实现自动化重建。Windows环境需要预装Visual Studio Build Tools和Python。

- **CJS/ESM互操作 (`ERR_PACKAGE_PATH_NOT_EXPORTED`):**
    - **问题:** 从CJS环境加载纯ESM包。
    - **标准方案:** 遵循**边界隔离原则**。在CJS入口文件（`electron.cjs`）中使用**异步动态`import()`**来加载整个ESM业务逻辑模块。

- **进程间职责混淆 (主进程访问Svelte Store):**
    - **问题:** 根本性的架构错误，导致Node.js环境无法执行前端代码。
    - **标准方案:** **严格遵守IPC边界。** 主进程处理业务逻辑后，通过`webContents.send()`发送**可序列化的纯数据**。渲染进程监听事件，并在前端更新其状态（Store）。

- **异步竞态条件 (播放队列、多进程管理):**
    - **问题:** 异步事件（如子进程的`close`事件）的回调执行时机不确定，导致状态被过时的事件错误地修改。
    - **标准方案:** 在回调函数中，通过**检查事件来源的对象引用是否与当前持有的对象引用一致**来判断事件是否“过时”，并忽略过时事件。

- **测试环境配置 (Vitest路径别名):**
    - **问题:** TypeScript的新特性（`verbatimModuleSyntax`）与测试工具链的模块解析器不兼容。
    - **标准方案:** 在`tsconfig.json`中覆盖该选项（`"verbatimModuleSyntax": false`），或者通过在所有相关配置文件中显式声明别名来保证一致性。在测试中，使用`removeAllListeners()`清理事件监听器，避免测试用例间的状态污染。



---

# 问题记录
本文档记录了“Heartstring”项目在初始化过程中遇到的主要问题及其解决方案。

## 1. `npm install` 长时间卡住

- **问题描述**: 执行 `npm install` 命令时，进程长时间卡住没有响应，尤其是在安装 `electron` 包时。详细日志 (`--verbose`) 显示卡在 `electron` 的 `postinstall` 脚本。
- **根本原因**: `postinstall` 脚本需要下载 Electron 的二进制文件。由于网络问题，从官方源下载非常缓慢或失败。
- **解决方案**:
    1.  **尝试清理缓存**: `npm cache clean --force`，但未解决。
    2.  **尝试指定临时镜像**: 通过 `ELECTRON_MIRROR` 环境变量和 `--registry` 参数指定国内镜像源。这解决了下载问题，但引入了后续的命令执行问题。
    3.  **最终解决方案**: 在项目根目录创建 `.npmrc` 文件，永久为该项目配置镜像源。这是最稳定、最推荐的方法。
        ```.npmrc
        registry=https://registry.npmmirror.com
        electron_mirror=https://npmmirror.com/mirrors/electron/
        ```

## 2. Electron 启动时出现语法错误

- **问题描述**: 成功安装依赖后，运行 `npm run electron:dev` 启动应用时，弹窗提示 `electron.js` 文件第一行存在语法错误。
- **根本原因**: `package.json` 中设置了 `"type": "module"`，这使得 Node.js 默认将 `.js` 文件作为 ES 模块处理。但 `electron.js` 文件中使用了 CommonJS 的 `require` 语法，导致模块类型冲突。
- **解决方案**:
    1.  **尝试转换为 ES 模块**: 将 `electron.js` 中的 `require` 改为 `import`。此方法未成功，可能是因为其他未知的文件编码或加载问题。
    2.  **最终解决方案**: 明确模块类型。
        - 将 `electron.js` 重命名为 `electron.cjs`。`.cjs` 扩展名强制 Node.js 将其作为 CommonJS 模块加载。
        - 确保 `electron.cjs` 文件内部使用 `require` 语法。
        - 更新 `package.json` 中的 `"main"` 字段，指向 `"electron.cjs"`。

## 3. 本地安装的命令无法直接运行 (如 `cross-env`)

- **问题描述**: 直接在终端中运行 `cross-env` 命令时，提示“不是内部或外部命令”。
- **根本原因**: `cross-env` 是作为项目开发依赖安装在本地 `node_modules` 目录中的，其可执行文件并未添加到系统的 `PATH` 环境变量中。
- **解决方案**: 使用 `npx` 来执行本地安装的包。正确的命令是 `npx cross-env ...`。

## 4. Electron 启动时 `ERR_CONNECTION_REFUSED`

- **问题描述**: 运行 `npm run electron:dev` 时，Electron 应用界面空白，终端报错 `ERR_CONNECTION_REFUSED`。
- **根本原因**: `electron:dev` 脚本只启动了 Electron，但没有同时启动 SvelteKit 的开发服务器 (`vite dev`)，或者 Electron 启动过早，SvelteKit 服务器尚未完全就绪。
- **解决方案**:
    1.  安装 `concurrently` 和 `wait-on` 作为开发依赖：`npm install --save-dev concurrently wait-on`。
    2.  修改 `package.json` 中的 `scripts`，使用 `concurrently` 同时运行 `npm run dev` 和一个等待 SvelteKit 服务器就绪的 `electron:start` 脚本。
        ```json
        "electron:dev": "concurrently \"npm run dev\" \"npm run electron:start\"",
        "electron:start": "wait-on http://localhost:5173 && cross-env ELECTRON_START_URL=http://localhost:5173 electron ."
        ```

## 5. `better-sqlite3` 模块版本不匹配错误

- **问题描述**: 启动 Electron 应用时，终端报错 `Error: The module 'better_sqlite3.node' was compiled against a different Node.js version...`。
- **根本原因**: `better-sqlite3` 是一个包含原生 C++ 代码的 Node.js 模块。它在安装时会针对当前系统的 Node.js 版本进行编译。然而，Electron 内部使用的 Node.js 版本可能与系统安装的 Node.js 版本不同，导致编译后的模块不兼容。
- **解决方案**:
    1.  **动态导入 `music-metadata`**: 为了避免 `ERR_PACKAGE_PATH_NOT_EXPORTED` 错误，将 `music-metadata` 的 `require` 语句改为在 `scanMusicFiles` 函数内部进行动态 `import()`。
    2.  **安装编译工具**: `node-gyp` (Electron 重建原生模块的工具) 在 Windows 上需要 Python 和 Visual C++ Build Tools。
        *   **推荐安装 `windows-build-tools`**: 在管理员权限的 PowerShell/CMD 中运行 `npm install --global windows-build-tools`。
        *   **手动安装**: 如果自动安装失败，需要手动安装：
            *   Python 3.x (安装时勾选 "Add Python to PATH")。
            *   Visual Studio Build Tools (通过 Visual Studio Installer，勾选 "使用 C++ 的桌面开发" 工作负载)。
    3.  **安装 `@electron/rebuild`**: 这是一个专门用于针对 Electron 环境重新编译原生模块的工具：`npm install --save-dev @electron/rebuild`。
    4.  **配置 `package.json` 脚本**:
        ```json
        "rebuild": "electron-rebuild",
        "postinstall": "electron-rebuild"
        ```
    5.  **执行重建**: 运行 `npm run rebuild` 来重新编译 `better-sqlite3`。

## 6. 音频播放器集成问题 (`play-sound` 无法播放 / `playbackerror: undefined`)

- **问题描述**: 尝试使用 `play-sound` 库播放音乐时，前端弹窗提示 `playbackerror: undefined` 或 `unknown playback error`。即使 `ffplay` 已安装，`play-sound` 仍可能返回模糊的错误信息或退出码 `1`。
- **根本原因**: `play-sound` 库依赖于系统上安装的外部播放器（如 `ffplay`）。如果 `ffplay` 未安装、不在系统 PATH 中，或者 `play-sound` 在某些情况下无法正确处理 `ffplay` 的退出码或错误对象，就会出现此问题。`play-sound` 在错误回调中返回的 `err` 对象可能不是标准的 `Error` 实例，导致 `err.message` 为 `undefined`。
- **解决方案**:
    1.  **用户引导安装 FFmpeg**: 应用程序现在会在启动时检查 `ffplay` 是否可用。如果未找到，会通过前端弹窗提示用户安装 FFmpeg，并提供官网链接。这是为了解决许可证问题并让用户自行解决播放器依赖。
    2.  **自定义 `PlayerService`**: 放弃 `play-sound` 库，转而直接在 Electron 主进程中构建一个自定义的 `PlayerService` 类。这个服务直接使用 Node.js 的 `child_process.spawn` 来调用 `ffplay`。
        - **优势**:
            - **透明可控**: 精确控制传递给 `ffplay` 的命令行参数（例如 `-nodisp`, `-autoexit`, `-i`）。
            - **详细错误处理**: 直接捕获 `spawn` 进程的 `stdout`、`stderr` 和 `exit` 事件，从而获得最原始、最详细的错误信息。解决了 `play-sound` 返回模糊错误的问题。
            - **功能扩展**: 为未来实现更高级的播放控制（如进度条、跳转、暂停/恢复）和跨平台播放器选择奠定基础。
    3.  **处理 `ffplay` 退出码 `null`**: 当通过 `player.stop()` 强制终止 `ffplay` 进程时，`close` 事件的 `code` 参数可能为 `null`。在 `PlayerService` 中，当 `code` 为 `null` 时，不发送 `playback-error` 事件，因为这是预期的停止行为。

## 7. `electron.cjs` 中 `ipcMain` 重复声明错误

- **问题描述**: 引入 `PlayerService` 后，运行 `npm run electron:dev` 报错 `SyntaxError: Identifier 'ipcMain' has already been declared`。
- **根本原因**: 在 `electron.cjs` 文件顶部已经通过 `const { app, BrowserWindow, ipcMain, dialog } = require('electron');` 声明了 `ipcMain`，但在引入 `PlayerService` 时，又在文件顶部添加了 `const { ipcMain, BrowserWindow } = require('electron');` 导致重复声明。
- **解决方案**: 移除重复的 `const { ipcMain, BrowserWindow } = require('electron');` 导入语句，确保 `ipcMain` 和 `BrowserWindow` 只被声明一次。

## 10. 暂停/恢复功能

- **问题描述**: `ffplay` 不直接支持暂停/恢复功能，需要通过模拟实现。
- **解决方案**: 在 `PlayerService` 中实现 `pause()` 和 `resume()` 方法。`pause()` 方法会记录当前的 `pausedTime` 并强制终止 `ffplay` 进程 (`kill('SIGKILL')`)，同时设置 `isPaused` 状态为 `true`。`resume()` 方法则利用记录的 `pausedTime`，通过调用 `play(currentTrack, pausedTime)` 并向 `ffplay` 传递 `-ss` 参数，使其从暂停位置继续播放。相关的 IPC 事件 (`playback-paused`, `playback-resumed`) 用于通知前端更新 UI 状态。

## 11. 播放队列歌曲停止控制问题及暂停后不能恢复的 bug

- **问题描述**: 在自动播放下一首歌曲时，旧 `ffplay` 进程的 `close` 事件可能在新的进程启动后才触发，导致 `PlayerService` 中的 `this.currentPlayer` 被错误地重置为 `null`，从而使停止和暂停/恢复按钮无法控制当前正在播放的歌曲。
- **根本原因**: 异步事件处理中的竞态条件。旧进程的 `close` 事件回调在 `this.currentPlayer` 已经指向新进程时执行了清理逻辑。
- **解决方案**:
    1.  在 `PlayerService.play()` 方法中，当 `spawn` 创建新的 `ffplay` 进程时，将该新进程的引用 (`newPlayerProcess`) 传递给其 `stderr.on`, `on('close')`, `on('error')` 事件监听器。
    2.  在这些事件回调内部，添加一个条件检查 `if (newPlayerProcess !== this.currentPlayer)`。如果条件为真，则表示这是旧进程的事件，应忽略其对 `this.currentPlayer` 的清理操作，避免干扰当前活跃的播放器状态。
    3.  调整 `newPlayerProcess.on('close')` 逻辑：只有在 `code !== null && !this.isPaused` (即非正常退出且非暂停) 的错误情况下才清理 `this.currentPlayer` 和 `this.currentTrack`。正常播放结束时，由 `playNext()` 负责状态流转。
    4.  在 `PlayerService.playNext()` 中，在调用 `this.play(nextTrack)` 之前，明确将 `this.currentTrack` 设置为 `null`，以确保状态的正确传递。同时，在队列为空时，也清理 `this.currentTrack`, `this.currentPlayer`, `pausedTime`, `isPaused` 等状态。

## 12. 音量控制功能中的 `write EOF` 和 `TypeError: Cannot read properties of null (reading 'pid')` 错误

- **问题描述**: 实现音量控制功能时，通过 `ffmpeg` 管道流将音频数据传递给 `ffplay`，在调整音量（导致进程重启）时，频繁出现 `Uncaught Exception: Error: write EOF` 和 `TypeError: Cannot read properties of null (reading 'pid')` 错误。
- **根本原因**:
    *   `write EOF` (或 `EPIPE`) 错误：通常发生在写入已关闭的管道时。这意味着 `ffmpeg` 尝试向 `ffplay` 的标准输入写入数据，但 `ffplay` 进程已经关闭了其输入流，或者 `ffplay` 进程在 `ffmpeg` 写入完成之前就意外退出。
    *   `TypeError: Cannot read properties of null (reading 'pid')` 错误：发生在 `PlayerService` 的 `cleanup` 方法或进程的 `on('close')` 回调中，尝试访问已设置为 `null` 的 `ffmpegProcess` 或 `ffplayProcess` 的 `pid` 属性。这表明存在竞态条件，即旧进程的 `close` 事件在 `this.ffmpegProcess` 或 `this.ffplayProcess` 已经被新进程覆盖或设置为 `null` 后才触发。
- **尝试的解决方案 (均未完全解决问题)**:
    1.  **调整 `ffmpeg` 和 `ffplay` 的 `-ss` 参数位置**: 确保 `-ss` 参数在输入和输出寻道时的正确性。
        *   `ffmpeg`: `-ss` 放在 `-i` 之前用于快速寻道。
        *   `ffplay`: `-ss` 放在 `-i -` 之前用于输出寻道。
    2.  **在 `cleanup` 方法中添加延迟并使用 `async/await`**:
        *   修改 `cleanup` 方法，使其返回一个 Promise，并在杀死进程后添加 100ms 的 `setTimeout` 延迟，然后解决 Promise。
        *   将所有调用 `cleanup` 或 `play` 的方法（如 `stop`, `resume`, `setVolume`, `playNext`）都改为 `async/await`，以确保操作的顺序性，等待清理完成后再启动新进程。
    3.  **移除 `ffplay` 的 `-autoexit` 参数，并在 `ffplay` 退出时显式终止 `ffmpeg`**:
        *   从 `ffplayArgs` 中移除了 `-autoexit`，以防止 `ffplay` 过早退出。
        *   在 `newFfplayProcess.on('close')` 回调中，如果 `ffplay` 进程退出，则显式地调用 `this.ffmpegProcess.kill('SIGKILL')` 来终止关联的 `ffmpeg` 进程。
    4.  **优化 `cleanup` 中 `Promise.all` 的等待逻辑，并处理 `pid` 为 `null` 的情况**:
        *   修改 `cleanup` 方法，使其等待所有被杀死的进程的 `close` 事件真正触发，而不是简单的 `setTimeout`。通过为每个被杀死的进程创建一个 Promise，并在其 `close` 事件中解决该 Promise，然后使用 `Promise.all` 等待所有这些 Promise。
        *   在 `cleanup` 中，在调用 `kill` 之后立即将 `this.ffmpegProcess` 和 `this.ffplayProcess` 设置为 `null`。
        *   在 `newFfplayProcess.on('close')` 和 `newFfmpegProcess.on('close')` 回调中，调整了 `if (newProcess !== this.currentProcess)` 检查，增加了 `&& this.currentProcess !== null`，以避免在引用为 `null` 时尝试访问 `pid`。

- **结论**: 尽管进行了多轮尝试和优化，`write EOF` 错误仍然在音量调整时出现。这表明 `ffmpeg` 和 `ffplay` 之间的管道通信在 Electron 环境中，特别是在快速重启或音量调整时，仍然存在深层次的竞态条件或同步问题，这超出了简单的参数调整和进程生命周期管理所能解决的范围。可能需要更深入地调试 `ffmpeg` 和 `ffplay` 进程的底层行为，或者重新考虑在 Electron 中管理音频流的其他方法。

## 13. 新架构问题：初始进度跳动，无音频播放

- **问题描述**: 应用程序启动后，选择歌曲播放，进度条会跳动（初始可能在 30-50s 左右），但没有听到任何音频。命令行输出显示 `ffmpeg` 进程成功退出（`code 0`），表明解码完成。
- **根本原因分析**: `ScriptProcessorNode` 在主 UI 线程上运行，容易受到阻塞，导致音频卡顿或无声。PCM 数据格式转换是关键，但即使转换正确，`ScriptProcessorNode` 的性能瓶颈也可能导致问题。
- **已尝试的解决方案**:
    1.  确保 `electron.cjs` 中 `PlayerService.play` 方法的 `pausedTime` 在每次新播放时重置为 0。
    2.  修正 `ffmpeg` 命令中 `-ss` 参数的位置，确保其在 `-i` 之前。
    3.  在 `src/routes/+page.svelte` 的 `playTrack` 中，确保 `audioQueue` 清空，`audioQueuePlaying` 设置为 `true`。
    4.  优化 `src/routes/+page.svelte` 中 `scriptProcessorNode.onaudioprocess` 回调的 `audioQueuePlaying` 状态管理，确保在有数据时设置为 `true`，无数据时设置为 `false`。
    5.  在 `scriptProcessorNode.onaudioprocess` 中实现了 16 位整数到 32 位浮点数的 PCM 数据格式转换（除以 32768）。
    6.  调整了背压机制的阈值，放宽了队列长度限制（`audioQueue.length > 200` 和 `queueSizeInSeconds < 1.0`）。
    7.  修正了 `onaudioprocess` 中 `audioQueue` 的 `slice` 逻辑，确保数据块被正确消耗。
- **当前状态**: 尽管进行了上述所有修改，问题仍然存在。这强烈暗示 `ScriptProcessorNode` 的固有缺陷是主要障碍。
- **下一步建议**: 鉴于 `ScriptProcessorNode` 的固有问题，继续在其上调试解决“无声”问题的胜算不高。下一步的建议是进行架构重构，将音频处理逻辑迁移到更现代、性能更好的 `AudioWorklet`。`AudioWorklet` 在独立的音频线程中运行，可以避免主 UI 线程的阻塞，是处理实时音频流的“标准答案”。

## 14. `PlayerService` 单元测试中 `playback-error` 事件断言失败

- **问题描述**: `src/lib/__tests__/playerService.spec.ts` 中的一个测试 (`should emit "playback-error" when the spawned process "close"s with a non-zero code`) 失败，因为它期望 `playback-error` 事件发出 `Error` 对象，但实际发出的是字符串。在后续修复中，又出现了断言期望 `Error` 对象的 `message` 与 `mockError` 的 `message` 不匹配的问题，以及测试之间状态污染导致偶发失败。
- **根本原因**:
    1.  `src/lib/playerService.ts` 在 `child_process.spawn` 进程的 `close` 事件中，当退出码非零时，发出的是一个字符串错误消息 (`ffplay exited with code ${code}`)，而不是一个 `Error` 对象。这导致测试中 `expect(err).toBe(mockError)` 失败，因为类型不匹配。
    2.  在将 `playerService.ts` 修改为发出 `Error` 对象后，`playerService.spec.ts` 中针对 `error` 事件的测试 (`should emit "playback-error" when the spawned process emits an "error" event`) 仍然使用 `expect(err).toBe(mockError)` 进行断言。`toBe` 进行的是严格相等比较，对于不同的 `Error` 实例，即使内容相同也会失败。
    3.  `beforeEach` 钩子中没有清除 `playerService` 的事件监听器，导致前一个测试中注册的监听器可能影响到后续测试，造成测试之间的状态污染和偶发失败。
- **解决方案**:
    1.  **修改 `src/lib/playerService.ts`**: 在 `playerProcess.on('close')` 回调中，当 `code` 非零时，将发出的错误从字符串改为 `Error` 对象：
        ```typescript
        this.emit('playback-error', new Error(`ffplay exited with code ${code}`));
        ```
    2.  **修改 `src/lib/__tests__/playerService.spec.ts`**:
        -   更新 `should emit "playback-error" when the spawned process "close"s with a non-zero code` 测试中的断言，使其检查接收到的错误是否为 `Error` 实例，并且其 `message` 属性与预期的错误消息匹配：
            ```typescript
            expect(err).toBeInstanceOf(Error);
            expect((err as Error).message).toBe(`ffplay exited with code ${errorCode}`);
            ```
        -   更新 `should emit "playback-error" when the spawned process emits an "error" event` 测试中的断言，使其检查接收到的错误是否为 `Error` 实例，并且其 `message` 属性与 `mockError` 的消息匹配：
            ```typescript
            expect(err).toBeInstanceOf(Error);
            expect((err as Error).message).toBe(mockError.message);
            ```
        -   在 `beforeEach` 钩子中添加 `playerService.removeAllListeners();`，以确保在每个测试运行前清除所有事件监听器，避免测试之间的状态污染：
            ```typescript
            beforeEach(() => {
              vi.clearAllMocks();
              playerService.removeAllListeners(); // 添加此行以清除事件监听器
              mockSpawnProcess = mockProcess;
              (mockSpawnProcess.kill as unknown as MockInstance).mockClear();
            });
            ```

# Vitest 在 SvelteKit 项目中解析 TypeScript 路径别名问题

## 问题描述
在 SvelteKit 项目中使用 Vitest 运行测试时，无法解析 `tsconfig.json` 中定义的路径别名（例如 `$types`），即使尝试了多种常见的配置方法，如使用 `vite-tsconfig-paths` 插件或手动配置 `resolve.alias`。

## 根本原因
`tsconfig.json` 中继承自 `./.svelte-kit/tsconfig.json` 的 `"verbatimModuleSyntax": true` 选项是导致此问题的关键。当此选项启用时，TypeScript 会严格执行模块语法，导致 Vitest 在处理类型导入时无法正确解析别名。

## 解决方案

1.  **禁用 `verbatimModuleSyntax`**：
    在项目根目录的 `tsconfig.json` 文件的 `compilerOptions` 中明确设置 `"verbatimModuleSyntax": false`。这会覆盖 `.svelte-kit/tsconfig.json` 中的设置，并允许 Vitest 正确解析别名。

    ```json
    // tsconfig.json
    {
      "extends": "./.svelte-kit/tsconfig.json",
      "compilerOptions": {
        // ...其他选项
        "verbatimModuleSyntax": false // 禁用 verbatimModuleSyntax
      },
      // ...
    }
    ```

2.  **确保 `src/types/index.d.ts` 是类型声明文件**：
    如果之前为了解决问题将其改为了 `.ts` 文件，请将其改回 `.d.ts`。
    `mv src/types/index.ts src/types/index.d.ts` (如果之前有修改)

3.  **清理 `vitest.config.js` 和 `setupTests.js`**：
    *   移除 `vitest.config.js` 中所有手动添加的 `resolve.alias` 和 `tsconfigPaths()` 插件。
    *   移除 `setupTests.js` 文件，或将其内容清空，因为在禁用 `verbatimModuleSyntax` 后，这些额外的别名注册机制不再需要。

## 后续步骤
在解决别名解析问题后，还需要解决 `PlayerService.spec.ts` 中报告的逻辑错误，即在播放结束或错误时 `playerServiceInstance.getCurrentTrack()` 没有被设置为 `null`。

### 失败的尝试 (供参考)

在找到上述解决方案之前，我们尝试了以下方法，但均未能解决别名解析问题：

*   **在 `vitest.config.js` 中手动添加 `resolve.alias`**：
    尝试在 Vite/Vitest 配置中直接映射 `tsconfig.json` 中定义的路径别名。
*   **依赖 `vite-tsconfig-paths` 插件**：
    该插件旨在自动处理 `tsconfig.json` 中的 `paths`，但在 `extends` 存在且 `verbatimModuleSyntax` 为 `true` 的复杂场景下未能生效。
*   **将 `paths` 直接复制到主 `tsconfig.json` 中**：
    尝试将继承的 `paths` 直接复制到根 `tsconfig.json`，以避免 `extends` 带来的潜在问题。
*   **为 `tsconfigPaths` 插件添加 `root: './'` 选项**：
    尝试明确指定 `tsconfig.json` 的根目录，以帮助插件正确解析。
*   **使用 `module-alias` 库在运行时注册别名**：
    在 Vitest 的 `setupFiles` 中使用 `module-alias` 动态注册别名，但未能解决问题。
*   **将 `index.d.ts` 文件改为 `.ts` 文件**：
    尝试将类型声明文件转换为普通 TypeScript 文件，以改变其模块解析行为。
*   **在 `setupTests.js` 中使用 `tsconfig-paths` 的 `loadConfig` 函数**：
    尝试使用 `tsconfig-paths` 库的更高级功能来加载 `tsconfig.json` 并注册别名，但仍然未能解决根本问题。

## 15. `PlayerService` 状态重置问题

- **问题描述**: `src/core/player/__tests__/PlayerService.spec.ts` 中报告的断言错误，即在播放结束或错误时 `playerServiceInstance.getCurrentTrack()` 没有被设置为 `null`。尽管 `PlayerService.ts` 中有重置逻辑，但测试仍然失败。
- **根本原因**: `PlayerService.ts` 中 `playback-closed` 和 `playback-error` IPC 监听器内部，`emit` 事件的调用发生在 `currentTrack`、`pausedTime` 和 `isPaused` 等状态被重置之前。这意味着当测试中 `playerServiceInstance.on('playback-ended', ...)` 或 `playerServiceInstance.on('playback-error', ...)` 的回调被触发时，`PlayerService` 的内部状态尚未更新，导致断言失败。
- **解决方案**:
    修改 `src/core/player/PlayerService.ts`，将 `currentTrack`、`pausedTime` 和 `isPaused` 的重置逻辑移动到 `emit` 事件调用之前。
    *   对于 `playback-closed` 监听器，需要先记录 `isPaused` 的原始状态，因为重置后 `this.isPaused` 会变为 `false`，这会影响 `else if (code !== null && !this.isPaused)` 的判断。
- **验证**: 运行 `npm test src/core/player/__tests__/PlayerService.spec.ts`，所有测试均已通过。

## 16. `AudioService.spec.ts` 中的模块导入和模拟问题

### 问题描述

在将 Heartstring 项目迁移到 TypeScript + ES Modules 的过程中，`AudioService` 的测试文件 `src/services/audio/__tests__/AudioService.spec.ts` 遇到了复杂的模块导入和 Vitest 模拟问题。

1.  **`ReferenceError: Cannot access 'mockIpcRenderer' before initialization`**:
    *   **原因**: `vi.mock` 的工厂函数中使用了顶层变量 `mockIpcRenderer`。Vitest 会提升 `vi.mock` 的调用，导致 `mockIpcRenderer` 在其定义之前就被访问。
    *   **失败尝试**: 尝试将 `mockIpcRenderer` 定义在文件顶部，但由于 `vi.mock` 的提升行为，问题依然存在。

2.  **`Type 'PlayerService' is missing the following properties from type 'MockPlayerServiceType'`**:
    *   **原因**: `PlayerService` 是一个继承自 `EventEmitter` 的类，并且有自己的属性和方法。最初的模拟方式未能完全匹配 `PlayerService` 的类型签名，特别是 `EventEmitter` 的方法没有被正确地模拟或代理。
    *   **失败尝试**:
        *   尝试通过 `Object.assign` 将 `EventEmitter` 的方法添加到模拟实例上，但 `EventEmitter` 的方法是不可枚举的，导致 `Object.assign` 无法复制它们。
        *   尝试在 `MockPlayerService` 类中显式地使用 `vi.fn(super.on)` 等方式包装 `EventEmitter` 的方法，但这在 TypeScript 中导致了类型推断问题，因为 `vi.fn()` 返回的类型与 `EventEmitter` 方法的预期类型不匹配。

3.  **`Property 'emit' is private and only accessible within class 'PlayerService'.`**:
    *   **原因**: `PlayerService` 内部的 `emit` 方法被声明为 `private`，但在测试中尝试直接通过 `mockedPlayerService.emit` 触发事件。
    *   **失败尝试**: 直接调用 `mockedPlayerService.emit`。

### 成功解决方案

为了解决上述问题，采取了以下综合策略：

1.  **`mockIpcRenderer` 的定义位置**:
    *   **方案**: 将 `mockIpcRenderer` 的定义完全移入 `vi.mock('$api/ipc', ...)` 的工厂函数内部。这样，`mockIpcRenderer` 就在其被使用的作用域内被定义和初始化，避免了提升问题。

    ```typescript
    // src/services/audio/__tests__/AudioService.spec.ts
    vi.mock('$api/ipc', () => {
      const mockIpcRenderer = {
        invoke: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        send: vi.fn(),
      };
      return {
        ipcRenderer: mockIpcRenderer,
      };
    });
    ```

2.  **`PlayerService` 的模拟和事件代理**:
    *   **方案**:
        *   创建一个全局可访问的 `EventEmitter` 实例 `playerEventEmitter`。这个实例将作为所有模拟 `PlayerService` 实例的事件中心。
        *   在 `vi.mock('$core/player/PlayerService', ...)` 的工厂函数中，返回一个模拟的 `PlayerService` 构造函数。这个模拟构造函数会返回一个对象，该对象包含 `PlayerService` 的核心方法（`play`, `stop`, `pause`, `resume`）以及代理到 `playerEventEmitter` 的 `EventEmitter` 方法（`on`, `off`, `emit` 等）。
        *   在 `beforeEach` 钩子中，通过 `playerEventEmitter.removeAllListeners()` 清除所有事件监听器，确保测试之间的隔离。
        *   在测试用例中，通过 `playerEventEmitter.emit()` 来触发 `PlayerService` 应该发出的事件，而不是直接调用 `mockedPlayerService.emit`。

    ```typescript
    // src/services/audio/__tests__/AudioService.spec.ts
    // 创建一个全局可访问的 EventEmitter 实例，用于模拟 PlayerService 的事件
    const playerEventEmitter = new EventEmitter();

    // Mock the PlayerService class itself
    vi.mock('$core/player/PlayerService', () => {
      // 模拟 PlayerService 的构造函数
      const MockPlayerService = vi.fn((ipcRenderer: any) => {
        // 返回一个模拟对象，它具有 PlayerService 的方法和 EventEmitter 的行为
        const instance = {
          play: vi.fn(),
          stop: vi.fn(),
          pause: vi.fn(),
          resume: vi.fn(),
          // 代理 EventEmitter 的方法到全局的 playerEventEmitter
          on: vi.fn(playerEventEmitter.on.bind(playerEventEmitter)),
          off: vi.fn(playerEventEmitter.off.bind(playerEventEmitter)),
          addListener: vi.fn(playerEventEmitter.addListener.bind(playerEventEmitter)),
          removeListener: vi.fn(playerEventEmitter.removeListener.bind(playerEventEmitter)),
          removeAllListeners: vi.fn(playerEventEmitter.removeAllListeners.bind(playerEventEmitter)),
          emit: vi.fn(playerEventEmitter.emit.bind(playerEventEmitter)), // 确保 emit 也被代理
        };
        return instance;
      });

      return {
        PlayerService: MockPlayerService,
      };
    });

    // 在 beforeEach 中使用
    beforeEach(async () => {
      vi.clearAllMocks();
      playerStore.set(initialPlayerState);

      const { PlayerService } = await import('$core/player/PlayerService');
      mockedPlayerService = new PlayerService(mockIpcRenderer);
      playerEventEmitter.removeAllListeners(); // 清除监听器
    });

    // 在测试用例中触发事件
    it('should update playerStore on "playback-started" event', () => {
      playerEventEmitter.emit('playback-started', mockTrack);
      // ... 断言
    });