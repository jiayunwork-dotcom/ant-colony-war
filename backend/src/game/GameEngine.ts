import { v4 as uuidv4 } from 'uuid';
import {
  GameState,
  Player,
  PlayerCommand,
  HexCoord,
  EventLogEntry,
  FacilityType,
  AntType,
  MutationType,
  Predator,
  PLAYER_COLORS,
  GameReplay,
  BattleEventRecord,
  EcoEventRecord,
  AITurnDecision,
  GameReplayWithAI
} from '../../../shared/types';
import {
  MAP_SIZE,
  MAX_TURNS,
  COMMAND_TIME_LIMIT,
  INITIAL_TERRITORY_RADIUS,
  FOOD_SPAWN_INTERVAL,
  FOOD_SPAWN_AMOUNT,
  SCORE_TERRITORY_MULTIPLIER,
  SCORE_FOOD_MULTIPLIER,
  SCORE_KILLS_MULTIPLIER,
  SCORE_SURVIVORS_MULTIPLIER,
  HATCHERY_PRODUCTION
} from '../../../shared/constants';
import { MapGenerator } from './MapGenerator';
import { PheromoneSystem } from './PheromoneSystem';
import { BattleSystem } from './BattleSystem';
import { EconomySystem, MovementSystem } from './EconomySystem';
import { EventSystem, EvolutionSystem } from './EventSystem';
import { PlayerFactory } from './factories';
import { hexRange } from '../../../shared/utils/hex';
import { ReplayCollector } from '../services/ReplayCollector';

export class GameEngine {
  private state: GameState;
  private mapGenerator: MapGenerator;
  private pheromoneSystem: PheromoneSystem;
  private battleSystem: BattleSystem;
  private economySystem: EconomySystem;
  private movementSystem: MovementSystem;
  private eventSystem: EventSystem;
  private evolutionSystem: EvolutionSystem;
  private commands: Map<string, PlayerCommand>;
  private replayCollector: ReplayCollector;
  private currentTurnBattles: BattleEventRecord[] = [];
  private currentTurnEcoEvents: EcoEventRecord[] = [];

  constructor(gameId?: string) {
    console.log('[GameEngine] Starting initialization...');
    this.commands = new Map();

    console.log('[GameEngine] Creating MapGenerator with size', MAP_SIZE);
    this.mapGenerator = new MapGenerator(MAP_SIZE);
    console.log('[GameEngine] Generating map...');
    const map = this.mapGenerator.generate();
    console.log('[GameEngine] Map generated, rows:', map.length, 'total cells:', map.reduce((acc, r) => acc + r.length, 0));

    this.state = {
      id: gameId || uuidv4(),
      turn: 0,
      maxTurns: MAX_TURNS,
      phase: 'waiting',
      phaseEndTime: 0,
      mapSize: MAP_SIZE,
      map,
      players: [],
      currentEvent: null,
      nextEvent: null,
      eventLog: [],
      winner: null,
      commandTimeLimit: COMMAND_TIME_LIMIT,
      predator: undefined,
      hostId: ''
    };

    console.log('[GameEngine] Initializing systems...');
    this.pheromoneSystem = new PheromoneSystem(map, MAP_SIZE);
    this.battleSystem = new BattleSystem(map, MAP_SIZE);
    this.economySystem = new EconomySystem(map, MAP_SIZE);
    this.movementSystem = new MovementSystem(map, MAP_SIZE, this.pheromoneSystem);
    this.eventSystem = new EventSystem(map, MAP_SIZE);
    this.evolutionSystem = new EvolutionSystem();
    this.replayCollector = new ReplayCollector(this.state.id);
    console.log('[GameEngine] Initialization complete, gameId:', this.state.id);
  }

  getState(): GameState {
    return this.state;
  }

  getPlayers(): Player[] {
    return this.state.players;
  }

  getPlayer(playerId: string): Player | undefined {
    return this.state.players.find(p => p.id === playerId);
  }

  addPlayer(playerId: string, name: string): boolean {
    if (this.state.phase !== 'waiting') return false;
    if (this.state.players.length >= 6) return false;
    if (this.state.players.some(p => p.id === playerId)) return false;

    const colorIndex = this.state.players.length;
    const color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];

    const nestPositions = this.mapGenerator.getNestPositions(this.state.players.length + 1);
    const nestPosition = nestPositions[nestPositions.length - 1];

    this.mapGenerator.clearAreaForNest(nestPosition, INITIAL_TERRITORY_RADIUS);

    const player = PlayerFactory.create(playerId, name, color, nestPosition);
    this.state.players.push(player);

    this.initializeTerritory(player);

    return true;
  }

  private initializeTerritory(player: Player): void {
    const cells = hexRange(player.nestPosition, INITIAL_TERRITORY_RADIUS);
    for (const coord of cells) {
      this.pheromoneSystem.depositTerritoryMarker(coord, player.id, 3);
    }
  }

  removePlayer(playerId: string): boolean {
    const index = this.state.players.findIndex(p => p.id === playerId);
    if (index === -1) return false;

    this.state.players.splice(index, 1);
    return true;
  }

  startGame(): boolean {
    if (this.state.phase !== 'waiting') return false;
    if (this.state.players.length < 4) return false;

    const nestPositions = this.mapGenerator.getNestPositions(this.state.players.length);
    for (let i = 0; i < this.state.players.length; i++) {
      const player = this.state.players[i];
      const nestPos = nestPositions[i];
      player.nestPosition = { ...nestPos };
      player.ants.forEach(ant => {
        ant.position = { ...nestPos };
      });
      this.mapGenerator.clearAreaForNest(nestPos, INITIAL_TERRITORY_RADIUS);
      this.initializeTerritory(player);
    }

    this.state.phase = 'command';
    this.state.phaseEndTime = Date.now() + COMMAND_TIME_LIMIT * 1000;
    this.state.turn = 1;

    this.addEventLog('游戏开始！', 'info');

    return true;
  }

  submitCommand(command: PlayerCommand): boolean {
    if (this.state.phase !== 'command') return false;

    const player = this.getPlayer(command.playerId);
    if (!player || player.isEliminated) return false;

    this.commands.set(command.playerId, command);
    player.isReady = true;

    return true;
  }

  allPlayersReady(): boolean {
    return this.state.players
      .filter(p => !p.isEliminated)
      .every(p => p.isReady);
  }

  processTurn(): void {
    if (this.state.phase !== 'command') return;

    this.state.phase = 'settling';
    this.addEventLog(`第 ${this.state.turn} 回合结算中...`, 'info');

    this.currentTurnBattles = [];
    this.currentTurnEcoEvents = [];

    this.executeCommands();

    for (const player of this.getAlivePlayers()) {
      this.economySystem.autoAssignWorkers(player);
    }

    this.movementSystem.processAllMovement(this.state.players);
    this.addEventLog('移动阶段完成', 'info');

    const collectResult = this.economySystem.collectFood(this.getAlivePlayers()[0] || this.state.players[0]);
    for (const player of this.getAlivePlayers()) {
      const result = this.economySystem.collectFood(player);
      if (result.collected > 0) {
        this.addEventLog(`${player.name} 采集了 ${result.collected} 食物`, 'economy');
      }
    }

    for (const player of this.getAlivePlayers()) {
      const result = this.economySystem.deliverFood(player);
    }
    this.addEventLog('采集阶段完成', 'info');

    const battleResult = this.battleSystem.resolveAllBattles(this.state.players);
    for (const msg of battleResult.messages) {
      this.addEventLog(msg, 'battle');
    }

    for (const playerId of Object.keys(battleResult.killCounts)) {
      const player = this.getPlayer(playerId);
      if (player) {
        player.totalKills += battleResult.killCounts[playerId];
      }
    }

    for (const detail of battleResult.battleDetails) {
      this.currentTurnBattles.push(detail);
    }

    this.processNestAttacks();
    this.addEventLog('战斗阶段完成', 'info');

    this.processPredator();

    this.pheromoneSystem.decayAll();
    this.addEventLog('信息素更新完成', 'info');

    this.processEvents();

    for (const player of this.getAlivePlayers()) {
      const maintenanceResult = this.economySystem.applyMaintenance(player);
      for (const msg of maintenanceResult.messages) {
        this.addEventLog(`${player.name}: ${msg}`, 'economy');
      }
    }
    this.addEventLog('维护消耗阶段完成', 'info');

    this.spawnFoodSources();

    this.processProduction();

    this.removeDeadAnts();
    this.checkEliminations();

    this.collectTurnSnapshot();

    this.checkVictory();

    this.movementSystem.resetMovePoints(this.state.players);

    const currentPhase = this.state.phase as string;
    if (currentPhase !== 'ended') {
      this.state.turn++;
      this.state.phase = 'command';
      this.state.phaseEndTime = Date.now() + COMMAND_TIME_LIMIT * 1000;
      this.state.players.forEach(p => p.isReady = false);
      this.commands.clear();
      this.addEventLog(`第 ${this.state.turn} 回合开始`, 'info');
    }
  }

  private executeCommands(): void {
    for (const player of this.getAlivePlayers()) {
      const command = this.commands.get(player.id);
      if (!command) continue;

      for (const moveCmd of command.moveCommands) {
        const ant = player.ants.find(a => a.id === moveCmd.antId);
        if (ant && ant.hp > 0) {
          ant.targetPosition = { ...moveCmd.target };
        }
      }

      for (const produceCmd of command.produceCommands) {
        const result = this.economySystem.produceAnts(player, produceCmd.antType, produceCmd.count);
        for (const msg of result.messages) {
          this.addEventLog(`${player.name}: ${msg}`, 'economy');
        }
      }

      for (const upgradeCmd of command.upgradeCommands) {
        this.upgradeFacility(player, upgradeCmd.facilityType);
      }

      if (command.chooseMutation) {
        this.evolutionSystem.chooseMutation(player, command.chooseMutation);
        this.addEventLog(`${player.name} 选择了基因突变：${command.chooseMutation}`, 'info');
      }
    }
  }

  private processNestAttacks(): void {
    for (const defender of this.state.players) {
      if (defender.isEliminated) continue;

      const attackersAtNest: { [playerId: string]: any[] } = {};

      for (const attacker of this.state.players) {
        if (attacker.isEliminated || attacker.id === defender.id) continue;

        const soldiersAtNest = attacker.ants.filter(
          a => a.type === 'soldier' &&
               a.hp > 0 &&
               a.position.q === defender.nestPosition.q &&
               a.position.r === defender.nestPosition.r
        );

        if (soldiersAtNest.length > 0) {
          attackersAtNest[attacker.id] = soldiersAtNest;
        }
      }

      for (const [attackerId, soldiers] of Object.entries(attackersAtNest)) {
        const attacker = this.getPlayer(attackerId);
        if (!attacker) continue;

        const result = this.battleSystem.attackNest(soldiers, defender);
        if (result.canAttack) {
          this.addEventLog(
            `${attacker.name} 对 ${defender.name} 的蚁巢造成了 ${result.damage} 点伤害（剩余 ${defender.nestHp} HP）`,
            'battle'
          );
        }
      }
    }
  }

  private processPredator(): void {
    if (!this.state.predator) return;

    const combatResult = this.battleSystem.resolvePredatorCombat(
      this.state.predator,
      this.state.players
    );

    for (const msg of combatResult.messages) {
      this.addEventLog(msg, 'event');
    }

    if (combatResult.predatorKilled) {
      const predatorPos = this.state.predator.position;
      const cell = this.mapGenerator.getCell(predatorPos);
      if (cell) {
        cell.foodSource = {
          amount: this.state.predator.foodDrop,
          maxAmount: this.state.predator.foodDrop
        };
        cell.terrain = 'food';
      }
      this.state.predator = undefined;
      return;
    }

    const newPos = this.battleSystem.movePredator(this.state.predator, this.state.players);
    if (newPos) {
      this.state.predator.position = newPos;
    }
  }

  private processEvents(): void {
    if (this.state.nextEvent && this.state.nextEvent.turnsRemaining > 0) {
      this.state.nextEvent.turnsRemaining--;
    }

    if (this.state.currentEvent) {
      const eventResult = this.eventSystem.processOngoingEvents(
        this.state.currentEvent,
        this.state.players
      );

      for (const msg of eventResult.messages) {
        this.addEventLog(msg, 'event');
      }

      if (this.state.currentEvent.type === 'rain') {
        const affectedCoords: HexCoord[] = [];
        for (const row of this.state.map) {
          for (const cell of row) {
            if (cell.temporaryWater !== undefined && cell.temporaryWater > 0) {
              affectedCoords.push({ ...cell.coord });
            }
          }
        }
        const affectedPlayerIds = this.state.players
          .filter(p => !p.isEliminated && p.ants.some(a => a.hp > 0))
          .map(p => p.id);
        this.currentTurnEcoEvents.push({
          eventType: this.state.currentEvent.type,
          affectedCoords,
          affectedPlayerIds
        });
      }

      if (this.state.currentEvent.turnsRemaining > 0) {
        this.state.currentEvent.turnsRemaining--;
      }

      if (this.state.currentEvent.turnsRemaining <= 0) {
        this.addEventLog('当前事件结束', 'event');
        this.state.currentEvent = null;
      }
    }

    if (this.eventSystem.shouldTriggerEvent(this.state.turn)) {
      if (this.state.nextEvent) {
        const activationResult = this.eventSystem.activateEvent(
          this.state.nextEvent,
          this.state.players
        );

        for (const msg of activationResult.messages) {
          this.addEventLog(msg, 'event');
        }

        if (activationResult.predator) {
          this.state.predator = activationResult.predator;
        }

        const ecoAffectedCoords: HexCoord[] = [];
        if (this.state.nextEvent.center) {
          ecoAffectedCoords.push(this.state.nextEvent.center);
        }
        const ecoAffectedPlayerIds: string[] = [];
        if (activationResult.affectedPlayer) {
          ecoAffectedPlayerIds.push(activationResult.affectedPlayer);
        } else {
          this.state.players.filter(p => !p.isEliminated).forEach(p => ecoAffectedPlayerIds.push(p.id));
        }
        this.currentTurnEcoEvents.push({
          eventType: this.state.nextEvent.type,
          affectedCoords: ecoAffectedCoords,
          affectedPlayerIds: ecoAffectedPlayerIds
        });

        this.state.currentEvent = {
          ...this.state.nextEvent,
          turnsRemaining: 3
        };

        this.state.nextEvent = null;
      }

      if (!this.state.nextEvent && this.state.turn < this.state.maxTurns - 5) {
        this.state.nextEvent = this.eventSystem.generateNextEvent();
        this.addEventLog(
          this.eventSystem.getWarningMessage(this.state.nextEvent),
          'warning'
        );
      }
    }
  }

  private spawnFoodSources(): void {
    if (this.state.turn % FOOD_SPAWN_INTERVAL !== 0) return;

    let spawned = 0;
    for (let i = 0; i < FOOD_SPAWN_AMOUNT; i++) {
      const pos = this.mapGenerator.spawnFoodSource();
      if (pos) spawned++;
    }

    if (spawned > 0) {
      this.addEventLog(`地图上刷新了 ${spawned} 个新食物源`, 'economy');
    }
  }

  private processProduction(): void {
    // 生产在命令阶段已经处理，这里不需要额外处理
  }

  private upgradeFacility(player: Player, facilityType: FacilityType): boolean {
    const facility = player.facilities[facilityType];
    if (!facility) return false;

    const currentLevel = facility.level;
    const maxLevel = 3;

    if (currentLevel >= maxLevel) return false;

    const upgradeCost = this.getUpgradeCost(facilityType, currentLevel);
    if (player.food < upgradeCost) return false;

    player.food -= upgradeCost;
    facility.level++;

    if (facilityType === 'storage') {
      player.maxFood = PlayerFactory.getMaxFood(player);
    }

    this.addEventLog(
      `${player.name} 升级了 ${facilityType} 到 ${facility.level} 级`,
      'economy'
    );

    return true;
  }

  private getUpgradeCost(facilityType: FacilityType, currentLevel: number): number {
    const costs = [30, 60];
    return costs[currentLevel] || 30;
  }

  private removeDeadAnts(): void {
    for (const player of this.state.players) {
      player.ants = player.ants.filter(ant => ant.hp > 0);
    }
  }

  private checkEliminations(): void {
    for (const player of this.state.players) {
      if (!player.isEliminated && player.nestHp <= 0) {
        player.isEliminated = true;
        this.pheromoneSystem.clearPlayerPheromones(player.id);
        this.addEventLog(`${player.name} 被淘汰了！`, 'battle');
      }
    }
  }

  private collectTurnSnapshot(): void {
    const territoryCounts = new Map<string, number>();
    for (const player of this.state.players) {
      territoryCounts.set(player.id, this.pheromoneSystem.getPlayerTerritoryCount(player.id));
    }
    this.replayCollector.clearTurnEvents();
    for (const battle of this.currentTurnBattles) {
      this.replayCollector.recordBattle(battle);
    }
    for (const ecoEvent of this.currentTurnEcoEvents) {
      this.replayCollector.recordEcoEvent(ecoEvent);
    }
    this.replayCollector.collectTurnSnapshot(
      this.state.turn,
      this.state.players,
      territoryCounts,
    );
  }

  recordAITurnDecision(playerId: string, decision: AITurnDecision): void {
    this.replayCollector.recordAITurnDecision(playerId, decision);
  }

  hasAIReplayData(): boolean {
    return this.replayCollector.hasAIReplayData();
  }

  buildGameReplay(): GameReplay {
    const scoreDetails = this.state.players.map(player => {
      const breakdown = this.getScoreBreakdown(player);
      return {
        playerId: player.id,
        playerName: player.name,
        territory: breakdown.territory,
        food: breakdown.food,
        kills: breakdown.kills,
        survivors: breakdown.survivors,
        total: breakdown.total
      };
    });

    return this.replayCollector.buildGameReplay(
      this.state.players,
      this.state.winner || '',
      scoreDetails,
      this.state.turn
    );
  }

  buildGameReplayWithAI(): GameReplayWithAI {
    const scoreDetails = this.state.players.map(player => {
      const breakdown = this.getScoreBreakdown(player);
      return {
        playerId: player.id,
        playerName: player.name,
        territory: breakdown.territory,
        food: breakdown.food,
        kills: breakdown.kills,
        survivors: breakdown.survivors,
        total: breakdown.total
      };
    });

    return this.replayCollector.buildGameReplayWithAI(
      this.state.players,
      this.state.winner || '',
      scoreDetails,
      this.state.turn
    );
  }

  private checkVictory(): void {
    const alivePlayers = this.getAlivePlayers();

    if (alivePlayers.length === 1) {
      this.state.winner = alivePlayers[0].id;
      this.state.phase = 'ended';
      this.addEventLog(`${alivePlayers[0].name} 获胜！所有对手已被淘汰`, 'info');
      return;
    }

    if (this.state.turn >= this.state.maxTurns) {
      this.state.phase = 'ended';
      this.state.winner = this.calculateWinnerByScore();
      this.addEventLog('游戏结束！根据最终分数判定胜负', 'info');
    }
  }

  private calculateWinnerByScore(): string {
    let maxScore = -Infinity;
    let winnerId = '';

    for (const player of this.getAlivePlayers()) {
      const score = this.calculateScore(player);
      if (score > maxScore) {
        maxScore = score;
        winnerId = player.id;
      }
    }

    return winnerId;
  }

  calculateScore(player: Player): number {
    const territoryCount = this.pheromoneSystem.getPlayerTerritoryCount(player.id);
    const survivorCount = player.ants.filter(a => a.hp > 0).length;

    const territoryScore = territoryCount * SCORE_TERRITORY_MULTIPLIER;
    const foodScore = player.totalFoodCollected * SCORE_FOOD_MULTIPLIER;
    const killsScore = player.totalKills * SCORE_KILLS_MULTIPLIER;
    const survivorScore = survivorCount * SCORE_SURVIVORS_MULTIPLIER;

    return territoryScore + foodScore + killsScore + survivorScore;
  }

  getScoreBreakdown(player: Player): {
    territory: number;
    food: number;
    kills: number;
    survivors: number;
    total: number;
  } {
    const territoryCount = this.pheromoneSystem.getPlayerTerritoryCount(player.id);
    const survivorCount = player.ants.filter(a => a.hp > 0).length;

    const territoryScore = territoryCount * SCORE_TERRITORY_MULTIPLIER;
    const foodScore = player.totalFoodCollected * SCORE_FOOD_MULTIPLIER;
    const killsScore = player.totalKills * SCORE_KILLS_MULTIPLIER;
    const survivorScore = survivorCount * SCORE_SURVIVORS_MULTIPLIER;

    return {
      territory: territoryScore,
      food: foodScore,
      kills: killsScore,
      survivors: survivorScore,
      total: territoryScore + foodScore + killsScore + survivorScore
    };
  }

  getAlivePlayers(): Player[] {
    return this.state.players.filter(p => !p.isEliminated);
  }

  private addEventLog(message: string, type: EventLogEntry['type']): void {
    this.state.eventLog.push({
      turn: this.state.turn,
      message,
      type
    });

    if (this.state.eventLog.length > 100) {
      this.state.eventLog.shift();
    }
  }

  getPhaseTimeRemaining(): number {
    return Math.max(0, this.state.phaseEndTime - Date.now());
  }

  getPlayerCount(): number {
    return this.state.players.length;
  }
}
