import { GameEngine } from '../game/GameEngine';
import { PlayerCommand, GameState } from '../../../shared/types';

export class GameRoomManager {
  private rooms: Map<string, GameEngine>;
  private turnTimers: Map<string, NodeJS.Timeout>;

  constructor() {
    this.rooms = new Map();
    this.turnTimers = new Map();
  }

  createRoom(gameId?: string): GameEngine {
    const game = new GameEngine(gameId);
    this.rooms.set(game.getState().id, game);
    return game;
  }

  getRoom(gameId: string): GameEngine | undefined {
    return this.rooms.get(gameId);
  }

  removeRoom(gameId: string): void {
    this.stopTurnTimer(gameId);
    this.rooms.delete(gameId);
  }

  hasRoom(gameId: string): boolean {
    return this.rooms.has(gameId);
  }

  getAllRooms(): GameEngine[] {
    return Array.from(this.rooms.values());
  }

  startTurnTimer(gameId: string, onTurnEnd: () => void, duration: number = 30000): void {
    this.stopTurnTimer(gameId);
    const timer = setTimeout(() => {
      onTurnEnd();
    }, duration);
    this.turnTimers.set(gameId, timer);
  }

  stopTurnTimer(gameId: string): void {
    const timer = this.turnTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(gameId);
    }
  }

  processCommand(gameId: string, command: PlayerCommand): boolean {
    const game = this.rooms.get(gameId);
    if (!game) return false;
    return game.submitCommand(command);
  }

  processTurn(gameId: string): GameState | null {
    const game = this.rooms.get(gameId);
    if (!game) return null;
    game.processTurn();
    return game.getState();
  }

  getGameState(gameId: string): GameState | null {
    const game = this.rooms.get(gameId);
    if (!game) return null;
    return game.getState();
  }
}

export const gameRoomManager = new GameRoomManager();
