export interface GameStartOptions {
  seed?: number;
  companionMode?: 'solo' | 'lunaris_companion' | 'lunaris_agent';
}

export interface GameAdapterResult<TState> {
  engineSessionId: string;
  text: string;
  state: TState;
}

export interface LunartideGameAdapter<TState> {
  readonly gameId: string;
  start(options?: GameStartOptions): Promise<GameAdapterResult<TState>>;
  command(engineSessionId: string, instruction: string): Promise<GameAdapterResult<TState>>;
  getState(engineSessionId: string): Promise<TState>;
  save(engineSessionId: string): Promise<void>;
  close(): void;
}
