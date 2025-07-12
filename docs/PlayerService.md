# PlayerService 开发文档

## 概述

`PlayerService` 是一个核心服务，负责管理音频播放。它使用 `ffplay` 作为底层播放器，并提供了一系列方法来控制播放状态（播放、停止、暂停、恢复）以及查询当前播放信息。该服务还通过事件机制通知外部组件播放状态的变化。

## 核心功能

### 1. 播放控制

#### `play(track: Track, startTime: number = 0): Promise<void>`

- **描述**: 开始播放指定的音轨。如果当前有音轨正在播放，它会先异步停止当前播放，确保旧进程完全终止后，再开始新的播放。
- **参数**:
  - `track`: `Track` 类型，表示要播放的音轨对象，包含 `id`, `path`, `title`, `artist`, `album`, `duration` 等信息。
  - `startTime`: `number` (可选，默认为 `0`)，表示从音轨的哪个时间点开始播放（单位：秒）。
- **行为**:
  - **异步等待**: 如果 `ffplay` 进程存在，会 `await` `stop()` 方法的完成，确保旧进程完全终止并清理状态。
  - 启动一个 `ffplay` 子进程来播放音频。
  - 设置 `currentTrack` 为当前播放的音轨。
  - 重置 `isPaused` 为 `false`。
  - 设置 `pausedTime` 为 `startTime`。
  - 发射 `playback-started` 事件。

#### `stop(): Promise<void>`

- **描述**: 异步停止当前正在播放的音轨，并重置播放器状态。该方法返回一个 `Promise`，在 `ffplay` 进程实际关闭后解析。
- **行为**:
  - 如果 `ffplay` 进程存在，强制终止它 (`SIGKILL`)。
  - 监听 `ffplay` 进程的 `'close'` 事件，当进程真正关闭时，清理 `ffplayProcess`, `currentTrack`, `pausedTime`, `isPaused`, `isPlayingOrStarting` 等状态，并解析 `Promise`。
  - 如果 `ffplay` 进程不存在，则立即解析 `Promise`。

#### `pause(): void`

- **描述**: 暂停当前正在播放的音轨。
- **行为**:
  - 如果 `ffplay` 进程存在，强制终止它 (`SIGKILL`)。
  - 设置 `isPaused` 为 `true`。
  - 发射 `playback-paused` 事件，包含当前的 `currentTime`。
  - **注意**: 进程被杀死后，`currentTrack` 和 `pausedTime` 会被保留，以便后续恢复播放。

#### `resume(): void`

- **描述**: 恢复当前暂停的音轨。
- **行为**:
  - 如果 `currentTrack` 存在且播放器处于暂停状态，将 `isPaused` 设置为 `false`，并调用 `play()` 方法从 `pausedTime` 重新启动 `ffplay` 进程。
  - 发射 `playback-resumed` 事件，包含恢复时的 `currentTime`。
  - **注意**: 如果没有可恢复的音轨或播放器未处于暂停状态，将会在控制台输出日志。

### 2. 状态查询

#### `getCurrentTrack(): Track | null`

- **描述**: 获取当前正在播放的音轨对象。
- **返回值**: `Track` 对象或 `null`（如果没有音轨正在播放）。

#### `getPausedTime(): number`

- **描述**: 获取当前播放的音轨已播放的时间（或暂停时的时间）。
- **返回值**: `number`，单位为秒。

#### `getIsPaused(): boolean`

- **描述**: 查询播放器是否处于暂停状态。
- **返回值**: `boolean`，`true` 表示暂停，`false` 表示正在播放或未播放。

## 事件

`PlayerService` 通过 `on` 方法提供事件监听机制，允许外部组件响应播放状态的变化。

#### `on<K extends keyof PlayerServiceEvents>(eventName: K, listener: PlayerServiceEvents[K]): void`

- **描述**: 注册一个事件监听器。
- **参数**:
  - `eventName`: 事件名称，可以是以下之一。
  - `listener`: 事件发生时要调用的回调函数。

### 可用事件列表

- **`playback-started`**:
  - **触发时机**: 开始播放新音轨时。
  - **回调参数**: `(track: Track)`，当前播放的音轨对象。
- **`playback-progress`**:
  - **触发时机**: 播放过程中，`ffplay` 输出进度信息时。
  - **回调参数**: `(data: { currentTime: number; duration: number })`，包含当前播放时间（秒）和音轨总时长（秒）。
- **`playback-ended`**:
  - **触发时机**: 音轨正常播放结束时（`ffplay` 进程以代码 `0` 退出）。
  - **回调参数**: 无。
- **`playback-error`**:
  - **触发时机**: 播放过程中发生错误时（例如 `ffplay` 进程异常退出，或无法启动）。
  - **回调参数**: `(error: Error)`，包含错误信息的 `Error` 对象。
- **`playback-paused`**:
  - **触发时机**: 播放器进入暂停状态时。
  - **回调参数**: `(data: { currentTime: number })`，包含暂停时的当前播放时间（秒）。
- **`playback-resumed`**:
  - **触发时机**: 播放器从暂停状态恢复时。
  - **回调参数**: `(data: { currentTime: number })`，包含恢复时的当前播放时间（秒）。

## 内部实现细节

- **`ffplay`**: 依赖于系统上安装的 `ffplay` 可执行文件。
- **进程通信**: 通过监听 `ffplay` 进程的 `stderr` 输出解析播放进度。暂停和恢复功能通过杀死并重新启动 `ffplay` 进程实现。
- **`ffplay` 参数**: `ffplay` 启动时使用 `-stats` 参数来确保输出播放统计信息，以便 `PlayerService` 能够捕获并更新播放进度。
- **状态管理**: 内部维护 `currentTrack`, `pausedTime`, `isPaused` 等状态变量。在暂停时，`currentTrack` 和 `pausedTime` 会被保留。
- **错误处理**: 捕获 `ffplay` 进程的错误和非零退出码，并通过 `playback-error` 事件通知。
