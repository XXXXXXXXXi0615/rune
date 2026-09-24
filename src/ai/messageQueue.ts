export type QueuedMessageType = 'text' | 'voice' | 'image' | 'notification' | 'memory';

export interface QueuedMessage {
  id: string;
  type: QueuedMessageType;
  content: string;
  metadata?: Record<string, unknown>;
  delayMs: number;
}

export interface QueueEvents {
  onTypingStart: (msg: QueuedMessage) => void;
  onTypingEnd: (msg: QueuedMessage) => void;
  onDeliver: (msg: QueuedMessage) => void;
  onQueueFinish: () => void;
  onInterrupted: () => void;
}

export function calculateHumanDelay(content: string): number {
  const len = content.length;
  if (len < 15) return 800 + Math.random() * 1200;
  if (len < 40) return 2000 + Math.random() * 2000;
  return 4000 + Math.random() * 4000;
}

export class MessageQueueEngine {
  private queue: QueuedMessage[] = [];
  private running = false;
  private aborted = false;
  private currentTimer: ReturnType<typeof setTimeout> | null = null;
  private events: QueueEvents;

  constructor(events: QueueEvents) {
    this.events = events;
  }

  enqueue(messages: QueuedMessage[]): void {
    this.queue.push(...messages);
    if (!this.running) {
      void this.process();
    }
  }

  clear(): void {
    this.aborted = true;
    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }
    this.queue = [];
    this.running = false;
    this.events.onInterrupted();
  }

  get isRunning(): boolean {
    return this.running;
  }

  get remaining(): number {
    return this.queue.length;
  }

  private async process(): Promise<void> {
    this.running = true;
    this.aborted = false;

    while (this.queue.length > 0 && !this.aborted) {
      const msg = this.queue[0];

      this.events.onTypingStart(msg);

      await this.wait(msg.delayMs);

      if (this.aborted) return;

      this.queue.shift();
      this.events.onTypingEnd(msg);
      this.events.onDeliver(msg);
    }

    this.running = false;
    if (!this.aborted) {
      this.events.onQueueFinish();
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.currentTimer = setTimeout(resolve, ms);
    });
  }
}
