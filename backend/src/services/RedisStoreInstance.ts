import { RedisStore } from './RedisStore';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;

export const redisStore = new RedisStore(REDIS_HOST, REDIS_PORT);
