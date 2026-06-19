import { v4 as uuidv4 } from 'uuid';
import { GameEngine } from '../game/GameEngine';
import { AIPlayerController } from '../game/AIPlayerController';
import {
  AIDifficulty,
  GameState,
  PlayerCommand,
  AITurnDecision
} from '../../../shared/types';
import { AI_COMMAND_DELAY } from '../../../shared/constants';

export interface AIPlayerInfo {
  playerId: string;
  difficulty: AIDifficulty;
  controller: AIPlayerController;
  name: string;
}

export class AIManager {
  private aiPlayers: Map<string, AIPlayerInfo[]>;
  private aiCounters: Map<string, number>;

  constructor() {
    this.aiPlayers = new Map();
    this.aiCounters = new Map();
  }

  addAIPlayer(game: GameEngine, difficulty: AIDifficulty): boolean {
    const state = game.getState();
    if (state.phase !== 'waiting') return false;
    if (state.players.length >= 6) return false;

    const gameId = state.id;
    const counter = this.aiCounters.get(gameId) || 0;
    const aiNumber = counter + 1;

    const playerId = `ai-${uuidv4()}`;
    const difficultyName = this.getDifficultyDisplayName(difficulty);
    const name = `AI-${difficultyName}-${aiNumber}`;

    const success = game.addPlayer(playerId, name);
    if (!success) return false;

    const player = game.getPlayer(playerId);
    if (player) {
      player.lobbyReady = true;
    }

    const controller = new AIPlayerController(playerId, difficulty, state.map, state.mapSize);

    const aiInfo: AIPlayerInfo = {
      playerId,
      difficulty,
      controller,
      name
    };

    if (!this.aiPlayers.has(gameId)) {
      this.aiPlayers.set(gameId, []);
    }
    this.aiPlayers.get(gameId)!.push(aiInfo);
    this.aiCounters.set(gameId, aiNumber);

    console.log(`[AIManager] Added AI player ${name} to game ${gameId}`);
    return true;
  }

  private getDifficultyDisplayName(difficulty: AIDifficulty): string {
    const names: Record<AIDifficulty, string> = {
      easy: 'Easy',
      normal: 'Normal',
      hard: 'Hard'
    };
    return names[difficulty];
  }

  removeAIPlayer(gameId: string, playerId: string): boolean {
    const aiList = this.aiPlayers.get(gameId);
    if (!aiList) return false;

    const index = aiList.findIndex(ai => ai.playerId === playerId);
    if (index === -1) return false;

    aiList.splice(index, 1);

    if (aiList.length === 0) {
      this.aiPlayers.delete(gameId);
      this.aiCounters.delete(gameId);
    }

    return true;
  }

  getAIPlayers(gameId: string): AIPlayerInfo[] {
    return this.aiPlayers.get(gameId) || [];
  }

  isAIPlayer(gameId: string, playerId: string): boolean {
    const aiList = this.aiPlayers.get(gameId);
    if (!aiList) return false;
    return aiList.some(ai => ai.playerId === playerId);
  }

  processAITurns(
    game: GameEngine, 
    onCommandSubmitted: (command: PlayerCommand) => void,
    onDecisionRecorded?: (playerId: string, decision: AITurnDecision) => void
  ): void {
    const state = game.getState();
    if (state.phase !== 'command') return;

    const gameId = state.id;
    const aiList = this.aiPlayers.get(gameId);
    if (!aiList || aiList.length === 0) return;

    console.log(`[AIManager] Processing AI turns for game ${gameId}, turn ${state.turn}, AI count: ${aiList.length}`);

    for (const aiInfo of aiList) {
      const player = game.getPlayer(aiInfo.playerId);
      if (!player || player.isEliminated) continue;

      aiInfo.controller.updateMap(state.map);

      setTimeout(() => {
        const currentState = game.getState();
        if (currentState.phase !== 'command') {
          console.log(`[AIManager] Skip AI ${aiInfo.name} - phase is ${currentState.phase}`);
          return;
        }

        const player = game.getPlayer(aiInfo.playerId);
        if (!player || player.isEliminated) {
          console.log(`[AIManager] Skip AI ${aiInfo.name} - player eliminated`);
          return;
        }
        if (player.isReady) {
          console.log(`[AIManager] Skip AI ${aiInfo.name} - already ready`);
          return;
        }

        const result = aiInfo.controller.generateCommand(currentState);
        console.log(`[AIManager] AI ${aiInfo.name} generated command for turn ${currentState.turn}, hasDecision: ${!!result.decision}, antDecisions: ${result.decision?.antDecisions?.length || 0}`);

        if (result.decision && onDecisionRecorded) {
          try {
            onDecisionRecorded(aiInfo.playerId, result.decision);
            console.log(`[AIManager] AI ${aiInfo.name} decision recorded for turn ${currentState.turn}`);
          } catch (err) {
            console.error(`[AIManager] Failed to record decision for AI ${aiInfo.name}:`, err);
          }
        }

        const success = game.submitCommand(result.command);

        if (success) {
          onCommandSubmitted(result.command);
          console.log(`[AIManager] AI ${aiInfo.name} command submitted successfully for turn ${currentState.turn}`);
        } else {
          console.warn(`[AIManager] AI ${aiInfo.name} submitCommand failed for turn ${currentState.turn}`);
        }
      }, AI_COMMAND_DELAY);
    }
  }

  cleanupGame(gameId: string): void {
    this.aiPlayers.delete(gameId);
    this.aiCounters.delete(gameId);
    console.log(`[AIManager] Cleaned up AI players for game ${gameId}`);
  }
}

export const aiManager = new AIManager();
