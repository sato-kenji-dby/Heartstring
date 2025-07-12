# AudioService

`AudioService` 负责管理音乐播放的核心逻辑，包括与 `PlayerService` 的交互、维护播放队列以及与渲染进程进行通信，以确保播放状态的同步和用户界面的响应。它旨在提供一个清晰的接口，将播放控制与底层播放器实现解耦。

## 职责

- 管理 `PlayerService` 实例，作为播放器的高级控制器。
- 维护一个播放队列，支持顺序播放。
- 监听 `PlayerService` 发出的播放事件，并通过 IPC 机制向渲染进程发送 `player-store-update` 消息以同步播放状态。
- 通过 IPC 机制向渲染进程发送播放状态更新和事件通知。
- 处理播放错误，并尝试自动播放队列中的下一首歌曲。

## 构造函数

`AudioService` 的构造函数接收一个 `PlayerService` 实例，并设置事件监听器。

```typescript
constructor(playerService: PlayerService)
```

### 参数

- `playerService`: `PlayerService` - 用于实际播放音频的底层服务实例。

## 方法

### `setMainWindowSender(sender: (channel: string, ...args: any[]) => void)`

设置一个函数，用于向 Electron 主进程的渲染进程发送消息。这允许 `AudioService`（通常运行在主进程）与 UI 进行通信。

### `playTrack(track: Track)`

开始播放指定的曲目。如果当前有歌曲正在播放，它将被停止。

### `stopPlayback()`

停止当前播放的曲目，并清空播放队列。播放器状态将被重置，并通过 `player-store-update` 消息通知渲染进程队列已清空。

### `pausePlayback()`

暂停当前播放的曲目。

### `resumePlayback()`

恢复当前暂停的曲目。

### `addToQueue(track: Track)`

将指定的曲目添加到播放队列的末尾，并通过 `player-store-update` 消息通知渲染进程队列已更新。

### `getQueue(): Track[]`

返回当前播放队列中的所有曲目。

### `playNext(): Promise<void>`

尝试播放队列中的下一首歌曲。此方法是异步的，在播放下一首之前，它会确保当前播放已完全停止。如果队列为空，播放将停止，并通过 `player-store-update` 消息通知渲染进程状态变化。在播放错误发生后，此方法也会被调用以尝试播放下一首。此方法也可以通过渲染进程的 `playerStore.next()` 触发 IPC 事件 `play-next-track` 来手动调用。

## 事件监听

`AudioService` 监听来自 `PlayerService` 的以下事件，并执行相应的状态更新和渲染进程通信：

- **`playback-started`**: 当一首新歌曲开始播放时触发。通过 `player-store-update` 消息发送 `currentTrack`、`isPlaying`、`status`、`progress` 和 `duration` 的更新。同时发送 `playback-started` 事件。
- **`playback-progress`**: 当歌曲播放进度更新时触发。通过 `player-store-update` 消息发送 `progress` 和 `duration` 的更新。同时发送 `playback-progress` 事件。
- **`playback-paused`**: 当歌曲暂停时触发。通过 `player-store-update` 消息发送 `isPlaying`、`status` 和 `progress` 的更新。同时发送 `playback-paused` 事件。
- **`playback-resumed`**: 当歌曲从暂停状态恢复播放时触发。通过 `player-store-update` 消息发送 `isPlaying`、`status` 和 `progress` 的更新。同时发送 `playback-resumed` 事件。
- **`playback-ended`**: 当一首歌曲播放结束时触发。通过 `player-store-update` 消息发送 `isPlaying`、`progress` 和 `currentTrack` 的更新。同时发送 `playback-ended` 事件。之后调用 `playNext()` 尝试播放队列中的下一首。
- **`playback-error`**: 当播放过程中发生错误时触发。通过 `player-store-update` 消息发送 `isPlaying` 和 `status` 为 `error` 的更新。同时发送 `playback-error` 事件。之后调用 `playNext()` 尝试播放队列中的下一首。错误信息会被记录到控制台。
