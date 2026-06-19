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
  AntType
} from '../../../shared/types';

export class ReplayCollector {
  private turnRecords: TurnRecord[] = [];
  private currentTurnBattles: BattleEventRecord[] = [];
  private currentTurnEcoEvents: EcoEventRecord[] = [];
  private startTime: number;
  private gameId: string;

  constructor(gameId: string) {
    this.gameId = gameId;
    this.startTime = Date.now();
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
