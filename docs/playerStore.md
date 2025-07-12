# playerStore 开发文档

## 概述

`playerStore` 是一个自定义 Svelte 存储，用于管理应用程序的全局播放器状态。它封装了与 Electron 主进程的 IPC（进程间通信）逻辑，负责发送播放控制命令并监听主进程发来的状态更新。通过订阅此存储，应用程序的各个组件可以实时响应播放状态的变化，并更新其 UI。

## 核心状态

`playerStore` 存储一个 `PlayerState` 类型的对象，其结构定义如下：

```typescript
export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number; // current playback time in seconds
  duration: number; // total duration of current track in seconds
  status: 'playing' | 'paused' | 'stopped' | 'error';
  queue: Track[]; // Add queue to player state
}

export interface Track {
  id: number;
  title: string;
  artist: string;
  album: string;
  path: string;
  duration: number; // in seconds
}
```

### 属性说明

*   **`currentTrack: Track | null`**
    *   **描述**: 当前正在播放的音轨对象。如果没有音轨正在播放，则为 `null`。
    *   **类型**: `Track` 或 `null`。
*   **`isPlaying: boolean`**
    *   **描述**: 指示播放器是否处于播放状态（即音频正在输出）。
    *   **类型**: `boolean`。
*   **`progress: number`**
    *   **描述**: 当前音轨的播放进度，单位为秒。
    *   **类型**: `number`。
*   **`duration: number`**
    *   **描述**: 当前音轨的总时长，单位为秒。
    *   **类型**: `number`。
*   **`status: 'playing' | 'paused' | 'stopped' | 'error'`**
    *   **描述**: 播放器的详细状态。
        *   `'playing'`: 正在播放。
        *   `'paused'`: 已暂停。
        *   `'stopped'`: 已停止或未开始播放。
        *   `'error'`: 播放过程中发生错误。
    *   **类型**: 联合类型字符串。
*   **`queue: Track[]`**
    *   **描述**: 播放队列，包含即将播放的音轨列表。
    *   **类型**: `Track[]`。

## 使用方法

### 1. 导入 `playerStore`

在 Svelte 组件或任何需要访问播放器状态的模块中，导入 `playerStore`：

```typescript
import { playerStore } from '$stores/playerStore';
```

### 2. 订阅状态变化

在 Svelte 组件中，可以使用 `$playerStore` 语法直接订阅和访问存储的值：

```svelte
<script lang="ts">
  import { playerStore } from '$stores/playerStore';

  $: currentTrack = $playerStore.currentTrack;
  $: isPlaying = $playerStore.isPlaying;
  $: progress = $playerStore.progress;
  $: duration = $playerStore.duration;
  $: status = $playerStore.status;
  $: queue = $playerStore.queue;
</script>

{#if currentTrack}
  <p>当前播放: {currentTrack.title} - {currentTrack.artist}</p>
  <p>进度: {progress.toFixed(0)}s / {duration.toFixed(0)}s</p>
  <p>状态: {status}</p>
{:else}
  <p>未在播放</p>
{/if}
```

### 3. 公共方法 (IPC 命令)

`playerStore` 暴露了一系列方法，用于向 Electron 主进程发送 IPC 命令，以控制播放器的行为。这些方法不直接修改存储的状态，而是通过 IPC 触发主进程的相应操作，主进程处理完成后会通过 `player-store-update` 事件将最新的状态发送回渲染进程，从而更新 `playerStore`。

#### `play(track: Track): void`

*   **描述**: 请求主进程播放指定的音轨。
*   **参数**:
    *   `track`: `Track` 类型，表示要播放的音轨对象。
*   **IPC 事件**: 发送 `play-track` 事件到主进程。

#### `pause(): void`

*   **描述**: 请求主进程暂停当前播放。
*   **IPC 事件**: 发送 `pause-playback` 事件到主进程。

#### `resume(): void`

*   **描述**: 请求主进程恢复当前暂停的播放。
*   **IPC 事件**: 发送 `resume-playback` 事件到主进程。

#### `stop(): void`

*   **描述**: 请求主进程停止当前播放。
*   **IPC 事件**: 发送 `stop-playback` 事件到主进程。

#### `addToQueue(track: Track): void`

*   **描述**: 请求主进程将指定的音轨添加到播放队列。
*   **参数**:
    *   `track`: `Track` 类型，表示要添加到队列的音轨对象。
*   **IPC 事件**: 发送 `add-to-queue` 事件到主进程。

#### `next(): void`

*   **描述**: 请求主进程播放队列中的下一首歌曲。
*   **IPC 事件**: 发送 `play-next-track` 事件到主进程。
