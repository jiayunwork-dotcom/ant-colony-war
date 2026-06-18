import Redis from 'ioredis';
import { GameState, PlayerCommand } from '../../../shared/types';

export class RedisStore {
  private redis: Redis;
  private readonly KEY_PREFIX = 'ant_war:';

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

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  getRedisClient(): Redis {
    return this.redis;
  }
}
