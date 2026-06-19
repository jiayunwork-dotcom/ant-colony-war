import {
  Player,
  PlayerSnapshot,
  BattleEventRecord,
  EcoEventRecord,
  TurnRecord,
  GameReplay,
  ScoreDetail,
  EventType,
  HexCoord,
  AntType,
  AITurnDecision,
  AIReplayData,
  GameReplayWithAI
} from '../../../shared/types';

export class ReplayCollector {
  private turnRecords: TurnRecord[] = [];
  private currentTurnBattles: BattleEventRecord[] = [];
  private currentTurnEcoEvents: EcoEventRecord[] = [];
  private aiDecisions: Map<string, AITurnDecision[]> = new Map();
  private startTime: number;
  private gameId: string;

  constructor(gameId: string) {
    this.gameId = gameId;
    this.startTime = Date.now();
  }

  recordAITurnDecision(playerId: string, decision: AITurnDecision): void {
    if (!this.aiDecisions.has(playerId)) {
      this.aiDecisions.set(playerId, []);
      console.log(`[ReplayCollector] Initialized AI decision storage for player ${playerId} in game ${this.gameId}`);
    }
    this.aiDecisions.get(playerId)!.push(decision);
    console.log(`[ReplayCollector] Recorded AI decision for player ${playerId}, turn ${decision.turn}, total decisions for this player: ${this.aiDecisions.get(playerId)!.length}`);
  }

  clearTurnEvents(): void {
    this.currentTurnBattles = [];
    this.currentTurnEcoEvents = [];
  }

  recordBattle(battle: BattleEventRecord): void {
    this.currentTurnBattles.push(battle);
  }

  recordEcoEvent(event: EcoEventRecord): void {
    this.currentTurnEcoEvents.push(event);
  }

  collectTurnSnapshot(
    turn: number,
    players: Player[],
    territoryCounts: Map<string, number>
  ): void {
    const playerSnapshots: PlayerSnapshot[] = players.map(player => {
      const antCounts = this.countAntsByType(player);
      return {
        playerId: player.id,
        playerName: player.name,
        food: player.food,
        workerCount: antCounts.worker,
        soldierCount: antCounts.soldier,
        scoutCount: antCounts.scout,
        territoryCount: territoryCounts.get(player.id) || 0,
        hatcheryLevel: player.facilities.hatchery.level,
        storageLevel: player.facilities.storage.level,
        barracksLevel: player.facilities.barracks.level,
        labLevel: player.facilities.lab.level
      };
    });

    const turnRecord: TurnRecord = {
      turn,
      timestamp: Date.now(),
      playerSnapshots,
      battleEvents: [...this.currentTurnBattles],
      ecoEvents: [...this.currentTurnEcoEvents]
    };

    this.turnRecords.push(turnRecord);
    this.currentTurnBattles = [];
    this.currentTurnEcoEvents = [];
  }

  buildGameReplay(
    players: Player[],
    winnerId: string,
    scoreDetails: ScoreDetail[],
    totalTurns: number
  ): GameReplay {
    return {
      gameId: this.gameId,
      startTime: this.startTime,
      endTime: Date.now(),
      playerIds: players.map(p => p.id),
      playerNames: players.map(p => p.name),
      playerColors: players.map(p => p.color),
      winnerId,
      scoreDetails,
      totalTurns,
      turns: [...this.turnRecords]
    };
  }

  buildGameReplayWithAI(
    players: Player[],
    winnerId: string,
    scoreDetails: ScoreDetail[],
    totalTurns: number
  ): GameReplayWithAI {
    const baseReplay = this.buildGameReplay(players, winnerId, scoreDetails, totalTurns);
    
    const aiReplayData: AIReplayData[] = [];
    const endTime = Date.now();

    console.log(`[ReplayCollector] Building AI replay for game ${this.gameId}, AI players with decisions: ${this.aiDecisions.size}`);

    for (const [playerId, decisions] of this.aiDecisions.entries()) {
      const player = players.find(p => p.id === playerId);
      if (!player) {
        console.warn(`[ReplayCollector] Player ${playerId} not found in players list, skipping`);
        continue;
      }

      const sortedDecisions = [...decisions].sort((a, b) => a.turn - b.turn);
      console.log(`[ReplayCollector] Player ${player.name} (${playerId}) has ${sortedDecisions.length} AI decisions`);
      
      aiReplayData.push({
        gameId: this.gameId,
        playerId,
        playerName: player.name,
        playerColor: player.color,
        totalTurns,
        decisions: sortedDecisions,
        startTime: this.startTime,
        endTime
      });
    }

    console.log(`[ReplayCollector] AI replay built, total AI players: ${aiReplayData.length}`);

    return {
      ...baseReplay,
      aiReplayData
    };
  }

  getAIReplayData(playerId: string): AITurnDecision[] | undefined {
    return this.aiDecisions.get(playerId);
  }

  hasAIReplayData(): boolean {
    return this.aiDecisions.size > 0;
  }

  getStartTime(): number {
    return this.startTime;
  }

  private countAntsByType(player: Player): Record<AntType, number> {
    const counts: Record<AntType, number> = { worker: 0, soldier: 0, scout: 0 };
    for (const ant of player.ants) {
      if (ant.hp > 0) {
        counts[ant.type]++;
      }
    }
    return counts;
  }
}
