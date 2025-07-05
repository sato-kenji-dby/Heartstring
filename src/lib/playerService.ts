// src/lib/playerService.js
import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';

class PlayerService extends EventEmitter {
  playerProcess: ChildProcessWithoutNullStreams | null;

  constructor() {
    super();
    this.playerProcess = null;
  }

  play(filePath: string) {
    if (this.playerProcess) {
      this.stop();
    }

    this.playerProcess = spawn('ffplay', ['-nodisp', '-autoexit', '-i', filePath]);

    this.playerProcess.on('error', (err: Error) => {
      console.error('ffplay process error:', err);
      this.emit('playback-error', err);
      this.playerProcess = null;
    });

    this.playerProcess.on('close', (code: number) => {
      if (code === 0) {
           this.emit('playback-ended');
         } else {
           this.emit('playback-error', new Error(`ffplay exited with code ${code}`)); // 发出 Error 对象
         }
         this.playerProcess = null;
    });
  }

  stop() {
    if (this.playerProcess) {
      this.playerProcess.kill('SIGKILL');
      this.playerProcess = null;
    }
  }
}

export const playerService = new PlayerService();
