import { GameEngine } from '../game/GameEngine';
import { PlayerCommand, GameState, RoomInfo } from '../../../shared/types';

export class GameRoomManager {
  private rooms: Map<string, GameEngine>;
  private turnTimers: Map<string, NodeJS.Timeout>;

  constructor() {
    this.rooms = new Map();
    this.turnTimers = new Map();
  }

  createRoom(gameId?: string): GameEngine {
    console.log('[GameRoomManager] Creating new room...');
    const game = new GameEngine(gameId);
    console.log('[GameRoomManager] GameEngine instantiated, gameId:', game.getState().id, 'players:', game.getState().players.length, 'mapSize:', game.getState().mapSize);
    this.rooms.set(game.getState().id, game);
    console.log('[GameRoomManager] Room added to manager, total rooms:', this.rooms.size);
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

  getAvailableRooms(): RoomInfo[] {
    const rooms: RoomInfo[] = [];
    for (const game of this.rooms.values()) {
      const state = game.getState();
      if (state.phase === 'waiting' && state.players.length < 6) {
        const host = state.players.length > 0 ? state.players[0] : null;
        rooms.push({
          gameId: state.id,
          hostName: host ? host.name : '未知',
          playerCount: state.players.length,
          maxPlayers: 6,
          phase: state.phase
        });
      }
    }
    return rooms;
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
