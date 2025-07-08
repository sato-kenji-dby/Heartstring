# playerStore 开发文档

## 概述

`playerStore` 是一个 Svelte 可写存储（writable store），用于管理应用程序的全局播放器状态。它封装了当前播放的音轨、播放状态（播放中、暂停、停止、错误）、播放进度、总时长以及播放队列等信息。通过订阅此存储，应用程序的各个组件可以实时响应播放状态的变化，并更新其 UI。

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

### 3. 更新状态

`playerStore` 是一个可写存储，因此可以通过其 `set` 或 `update` 方法来修改状态。通常，状态的更新会由 `PlayerService` 或其他核心逻辑服务负责，以确保状态的一致性。

#### 使用 `set` (直接设置整个状态对象)

```typescript
import { playerStore } from '$stores/playerStore';
import type { PlayerState } from '$types';

// 假设 PlayerService 触发了播放开始事件
function handlePlaybackStarted(track: Track) {
  playerStore.set({
    currentTrack: track,
    isPlaying: true,
    progress: 0,
    duration: track.duration,
    status: 'playing',
    queue: [], // 根据实际情况更新队列
  });
}
```

#### 使用 `update` (基于当前状态进行修改)

```typescript
import { playerStore } from '$stores/playerStore';

// 假设 PlayerService 触发了播放进度更新事件
function handlePlaybackProgress(currentTime: number) {
  playerStore.update(state => ({
    ...state,
    progress: currentTime,
  }));
}

// 假设 PlayerService 触发了暂停事件
function handlePlaybackPaused(currentTime: number) {
  playerStore.update(state => ({
    ...state,
    isPlaying: false,
    status: 'paused',
    progress: currentTime,
  }));
}
```
