import Redis from 'ioredis';
import { GameState, PlayerCommand, GameReplay, GameReplaySummary, GameReplayWithAI } from '../../../shared/types';

export class RedisStore {
  private redis: Redis;
  private readonly KEY_PREFIX = 'ant_war:';
  private readonly REPLAY_PREFIX = 'replay:';
  private readonly REPLAY_WITH_AI_PREFIX = 'replay_with_ai:';
  private readonly RECENT_GAMES_KEY = 'recent_games';
  private readonly RECENT_AI_REPLAYS_KEY = 'recent_ai_replays';
  private readonly RECENT_GAMES_MAX = 20;
  private readonly RECENT_AI_REPLAYS_MAX = 5;
  private readonly REPLAY_EXPIRY = 86400;
  private readonly AI_REPLAY_EXPIRY = 86400 * 3;

  constructor(host: string = 'localhost', port: number = 6379) {
    this.redis = new Redis({ host, port });
  }

  async saveGame(gameId: string, state: GameState): Promise<void> {
    const key = `${this.KEY_PREFIX}game:${gameId}`;
    await this.redis.set(key, JSON.stringify(state));
  }

  async getGame(gameId: string): Promise<GameState | null> {
    const key = `${this.KEY_PREFIX}game:${gameId}`;
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
  }

  async deleteGame(gameId: string): Promise<void> {
    const key = `${this.KEY_PREFIX}game:${gameId}`;
    await this.redis.del(key);
  }

  async gameExists(gameId: string): Promise<boolean> {
    const key = `${this.KEY_PREFIX}game:${gameId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async saveCommand(gameId: string, command: PlayerCommand): Promise<void> {
    const key = `${this.KEY_PREFIX}commands:${gameId}:${command.playerId}`;
    await this.redis.set(key, JSON.stringify(command));
  }

  async getCommands(gameId: string): Promise<PlayerCommand[]> {
    const pattern = `${this.KEY_PREFIX}commands:${gameId}:*`;
    const keys = await this.redis.keys(pattern);
    const commands: PlayerCommand[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        commands.push(JSON.parse(data));
      }
    }

    return commands;
  }

  async clearCommands(gameId: string): Promise<void> {
    const pattern = `${this.KEY_PREFIX}commands:${gameId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async getActiveGames(): Promise<string[]> {
    const pattern = `${this.KEY_PREFIX}game:*`;
    const keys = await this.redis.keys(pattern);
    return keys.map(k => k.replace(`${this.KEY_PREFIX}game:`, ''));
  }

  async addPlayerToSocket(socketId: string, playerId: string, gameId: string): Promise<void> {
    const key = `${this.KEY_PREFIX}socket:${socketId}`;
    await this.redis.hset(key, 'playerId', playerId, 'gameId', gameId);
    await this.redis.expire(key, 3600);
  }

  async getPlayerFromSocket(socketId: string): Promise<{ playerId: string; gameId: string } | null> {
    const key = `${this.KEY_PREFIX}socket:${socketId}`;
    const data = await this.redis.hgetall(key);
    if (!data || !data.playerId || !data.gameId) return null;
    return { playerId: data.playerId, gameId: data.gameId };
  }

  async removePlayerFromSocket(socketId: string): Promise<void> {
    const key = `${this.KEY_PREFIX}socket:${socketId}`;
    await this.redis.del(key);
  }

  async saveReplay(replay: GameReplay): Promise<void> {
    const key = `${this.REPLAY_PREFIX}${replay.gameId}`;
    await this.redis.set(key, JSON.stringify(replay), 'EX', this.REPLAY_EXPIRY);
    await this.redis.lpush(this.RECENT_GAMES_KEY, replay.gameId);
    await this.redis.ltrim(this.RECENT_GAMES_KEY, 0, this.RECENT_GAMES_MAX - 1);
  }

  async getReplayById(gameId: string): Promise<GameReplay | null> {
    const key = `${this.REPLAY_PREFIX}${gameId}`;
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
  }

  async getRecentGames(): Promise<GameReplaySummary[]> {
    const gameIds = await this.redis.lrange(this.RECENT_GAMES_KEY, 0, -1);
    const summaries: GameReplaySummary[] = [];

    for (const gameId of gameIds) {
      const key = `${this.REPLAY_PREFIX}${gameId}`;
      const data = await this.redis.get(key);
      if (!data) continue;

      const replay: GameReplay = JSON.parse(data);
      const winnerName = replay.playerNames[replay.playerIds.indexOf(replay.winnerId)] || '未知';

      summaries.push({
        gameId: replay.gameId,
        startTime: replay.startTime,
        playerNames: replay.playerNames,
        playerColors: replay.playerColors,
        winnerId: replay.winnerId,
        winnerName,
        totalTurns: replay.totalTurns
      });
    }

    return summaries;
  }

  async saveReplayWithAI(replay: GameReplayWithAI): Promise<void> {
    const key = `${this.REPLAY_WITH_AI_PREFIX}${replay.gameId}`;
    await this.redis.set(key, JSON.stringify(replay), 'EX', this.AI_REPLAY_EXPIRY);
    
    await this.redis.lpush(this.RECENT_AI_REPLAYS_KEY, replay.gameId);
    await this.redis.ltrim(this.RECENT_AI_REPLAYS_KEY, 0, this.RECENT_AI_REPLAYS_MAX - 1);
    
    const remainingIds = await this.redis.lrange(this.RECENT_AI_REPLAYS_KEY, this.RECENT_AI_REPLAYS_MAX, -1);
    for (const oldGameId of remainingIds) {
      const oldKey = `${this.REPLAY_WITH_AI_PREFIX}${oldGameId}`;
      await this.redis.del(oldKey);
    }
    
    await this.saveReplay(replay);
  }

  async getReplayWithAIById(gameId: string): Promise<GameReplayWithAI | null> {
    const key = `${this.REPLAY_WITH_AI_PREFIX}${gameId}`;
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
  }

  async checkAIReplayValid(gameId: string): Promise<boolean> {
    const key = `${this.REPLAY_WITH_AI_PREFIX}${gameId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async getRecentAIReplays(): Promise<string[]> {
    return await this.redis.lrange(this.RECENT_AI_REPLAYS_KEY, 0, -1);
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  getRedisClient(): Redis {
    return this.redis;
  }
}
