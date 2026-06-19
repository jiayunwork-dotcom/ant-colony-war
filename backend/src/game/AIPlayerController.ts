import { v4 as uuidv4 } from 'uuid';
import {
  Player,
  GameState,
  PlayerCommand,
  MoveCommand,
  ProduceCommand,
  UpgradeCommand,
  HexCoord,
  HexCell,
  SlimHexCell,
  Ant,
  AntType,
  AIDifficulty,
  ThreatMatrix,
  AICache,
  FacilityType,
  AITurnDecision,
  AntDecision,
  AntDecisionReason,
  ProduceDecision,
  UpgradeDecision,
  MilitaryRatioCalc,
  PlayerSnapshot
} from '../../../shared/types';
import {
  MAP_SIZE,
  ANT_STATS,
  FACILITY_STATS,
  SOLDIER_MAINTENANCE_THRESHOLD,
  SOLDIER_MAINTENANCE_COST,
  AI_THREAT_THRESHOLD,
  AI_MAINTENANCE_MULTIPLIER,
  AI_DIFFICULTY_CONFIG
} from '../../../shared/constants';
import {
  hexDistance,
  hexRange,
  hexNeighbors,
  isValidHex
} from '../../../shared/utils/hex';
import { getCellFromMap } from './MapGenerator';
import { PlayerFactory, AntFactory } from './factories';

function coordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

function parseCoordKey(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

export class AIPlayerController {
  private playerId: string;
  private difficulty: AIDifficulty;
  private cache: AICache;
  private map: HexCell[][];
  private mapSize: number;

  constructor(playerId: string, difficulty: AIDifficulty, map: HexCell[][], mapSize: number = MAP_SIZE) {
    this.playerId = playerId;
    this.difficulty = difficulty;
    this.map = map;
    this.mapSize = mapSize;
    this.cache = {
      threatMatrix: null,
      threatMatrixTurn: -1,
      visibleCells: null,
      visibleCellsTurn: -1
    };
  }

  updateMap(map: HexCell[][]): void {
    this.map = map;
  }

  generateCommand(state: GameState): { command: PlayerCommand; decision: AITurnDecision | null } {
    const player = state.players.find(p => p.id === this.playerId);
    if (!player || player.isEliminated) {
      return {
        command: {
          playerId: this.playerId,
          moveCommands: [],
          buildCommands: [],
          produceCommands: [],
          upgradeCommands: []
        },
        decision: null
      };
    }

    const threatMatrix = this.getThreatMatrix(player, state);
    const militaryRatioCalc = this.calculateMilitaryRatioWithDetails(player, state);
    const militaryRatio = militaryRatioCalc.finalRatio;
    const economicRatio = 1 - militaryRatio;

    const { moveCommands, antDecisions } = this.generateMoveCommandsWithDecisions(player, state, threatMatrix);
    const { produceCommands, produceDecisions } = this.generateProduceCommandsWithDecisions(player, state, militaryRatio);
    const { upgradeCommands, upgradeDecisions } = this.generateUpgradeCommandsWithDecisions(player, state, threatMatrix);

    const validatedMove = this.validateMoveCommands(moveCommands, player);
    const validatedProduce = this.validateProduceCommands(produceCommands, player);
    const validatedUpgrade = this.validateUpgradeCommands(upgradeCommands, player);

    const playerSnapshot = this.createPlayerSnapshot(player, state);
    const mapSnapshot = this.createSlimMapSnapshot(state.map, state.players);

    const decision: AITurnDecision = {
      turn: state.turn,
      playerId: this.playerId,
      playerName: player.name,
      threatMatrix: { ...threatMatrix },
      militaryRatioCalc,
      militaryRatio,
      economicRatio,
      antDecisions,
      produceDecisions,
      upgradeDecisions,
      totalFood: player.food,
      mapSnapshot,
      playerSnapshot
    };

    return {
      command: {
        playerId: this.playerId,
        moveCommands: validatedMove,
        buildCommands: [],
        produceCommands: validatedProduce,
        upgradeCommands: validatedUpgrade
      },
      decision
    };
  }

  private createSlimMapSnapshot(map: HexCell[][], players: Player[]): SlimHexCell[][] {
    const territoryOwnerMap: Record<string, string> = {};
    for (const player of players) {
      for (let r = 0; r < map.length; r++) {
        for (let q = 0; q < map[r].length; q++) {
          const cell = map[r][q];
          const key = `${q},${r}`;
          const marker = cell.territoryMarkers[player.id] || 0;
          if (marker > 0 && (!territoryOwnerMap[key] || (cell.territoryMarkers[territoryOwnerMap[key]] || 0) < marker)) {
            territoryOwnerMap[key] = player.id;
          }
        }
      }
    }

    return map.map((row, r) =>
      row.map((cell, q): SlimHexCell => {
        const key = `${q},${r}`;
        return {
          coord: cell.coord,
          terrain: cell.terrain,
          foodAmount: cell.foodSource?.amount,
          nest: cell.nest,
          owner: territoryOwnerMap[key]
        };
      })
    );
  }

  private createPlayerSnapshot(player: Player, state: GameState): PlayerSnapshot {
    const territoryCells = this.getPlayerTerritoryCells(player, state);
    const antCounts: Record<AntType, number> = { worker: 0, soldier: 0, scout: 0 };
    for (const ant of player.ants) {
      if (ant.hp > 0) {
        antCounts[ant.type]++;
      }
    }
    return {
      playerId: player.id,
      playerName: player.name,
      food: player.food,
      workerCount: antCounts.worker,
      soldierCount: antCounts.soldier,
      scoutCount: antCounts.scout,
      territoryCount: territoryCells.size,
      hatcheryLevel: player.facilities.hatchery.level,
      storageLevel: player.facilities.storage.level,
      barracksLevel: player.facilities.barracks.level,
      labLevel: player.facilities.lab.level
    };
  }

  private calculateMilitaryRatioWithDetails(player: Player, state: GameState): MilitaryRatioCalc {
    const threatMatrix = this.getThreatMatrix(player, state);
    const territoryCells = this.getPlayerTerritoryCells(player, state);

    let highThreatCount = 0;
    for (const key of territoryCells) {
      const threat = threatMatrix[key] || 0;
      if (threat > AI_THREAT_THRESHOLD) {
        highThreatCount++;
      }
    }

    const threatIndex = territoryCells.size > 0 ? highThreatCount / territoryCells.size : 0;

    const enemies = state.players.filter(p => p.id !== player.id && !p.isEliminated);
    let maxNeighborAggression = 0;

    const playerSoldiers = player.ants.filter(a => a.type === 'soldier' && a.hp > 0).length;

    for (const enemy of enemies) {
      const dist = hexDistance(player.nestPosition, enemy.nestPosition);
      if (dist <= 15) {
        const enemySoldiers = enemy.ants.filter(a => a.type === 'soldier' && a.hp > 0).length;
        const aggression = playerSoldiers > 0 ? Math.min(2.0, enemySoldiers / playerSoldiers) : 2.0;
        if (aggression > maxNeighborAggression) {
          maxNeighborAggression = aggression;
        }
      }
    }

    let militaryRatio = Math.min(0.7, Math.max(0.2, threatIndex * 0.5 + maxNeighborAggression * 0.3));

    const maintenanceCost = this.calculateMaintenanceCost(player);
    const foodLevel = player.food;
    if (player.food < maintenanceCost * AI_MAINTENANCE_MULTIPLIER) {
      militaryRatio = 0.1;
    }

    return {
      threatIndex,
      neighborAggression: maxNeighborAggression,
      highThreatCount,
      totalTerritoryCount: territoryCells.size,
      maintenanceCost,
      foodLevel,
      finalRatio: militaryRatio
    };
  }

  private getCell(coord: HexCoord): HexCell | null {
    return getCellFromMap(this.map, coord, this.mapSize);
  }

  private isCellVisible(coord: HexCoord, player: Player, state: GameState): boolean {
    const config = AI_DIFFICULTY_CONFIG[this.difficulty];
    if (config.visionRange === Infinity) return true;

    const territoryCells = this.getPlayerTerritoryCells(player, state);

    if (config.visionRange === 0) {
      return territoryCells.has(coordKey(coord));
    }

    for (const tKey of territoryCells) {
      const tCoord = parseCoordKey(tKey);
      if (hexDistance(coord, tCoord) <= config.visionRange) {
        return true;
      }
    }

    return false;
  }

  private getPlayerTerritoryCells(player: Player, state: GameState): Set<string> {
    const cells = new Set<string>();
    for (const row of this.map) {
      for (const cell of row) {
        const marker = cell.territoryMarkers[player.id];
        if (marker && marker > 0) {
          cells.add(coordKey(cell.coord));
        }
      }
    }
    return cells;
  }

  private getThreatMatrix(player: Player, state: GameState): ThreatMatrix {
    if (this.cache.threatMatrix && this.cache.threatMatrixTurn === state.turn) {
      return this.cache.threatMatrix;
    }

    const threatMatrix: ThreatMatrix = {};
    const enemyPlayers = state.players.filter(p => p.id !== player.id && !p.isEliminated);

    for (const row of this.map) {
      for (const cell of row) {
        if (!this.isCellVisible(cell.coord, player, state)) {
          continue;
        }

        let threat = 0;

        let minEnemyDistance = Infinity;
        for (const enemy of enemyPlayers) {
          for (const ant of enemy.ants) {
            if (ant.hp <= 0) continue;
            const dist = hexDistance(cell.coord, ant.position);
            if (dist < minEnemyDistance) {
              minEnemyDistance = dist;
            }
          }
        }

        if (minEnemyDistance === 0) {
          threat += 10;
        } else if (minEnemyDistance < Infinity) {
          threat += 1 / minEnemyDistance;
        }

        let nearbyEnemySoldiers = 0;
        for (const enemy of enemyPlayers) {
          for (const ant of enemy.ants) {
            if (ant.hp > 0 && ant.type === 'soldier') {
              if (hexDistance(ant.position, cell.coord) <= 2) {
                nearbyEnemySoldiers++;
              }
            }
          }
        }
        threat += nearbyEnemySoldiers * 0.3;

        const isEnemyTerritoryBorder = this.isEnemyTerritoryBorder(cell.coord, player, enemyPlayers);
        if (isEnemyTerritoryBorder) {
          threat += 0.5;
        }

        threatMatrix[coordKey(cell.coord)] = threat;
      }
    }

    this.cache.threatMatrix = threatMatrix;
    this.cache.threatMatrixTurn = state.turn;

    return threatMatrix;
  }

  private isEnemyTerritoryBorder(coord: HexCoord, player: Player, enemies: Player[]): boolean {
    const cell = this.getCell(coord);
    if (!cell) return false;

    const isPlayerTerritory = (cell.territoryMarkers[player.id] || 0) > 0;
    if (!isPlayerTerritory) return false;

    const neighbors = hexNeighbors(coord);
    for (const neighborCoord of neighbors) {
      const neighborCell = this.getCell(neighborCoord);
      if (!neighborCell) continue;

      for (const enemy of enemies) {
        if ((neighborCell.territoryMarkers[enemy.id] || 0) > 0) {
          return true;
        }
      }
    }

    return false;
  }

  private calculateMilitaryRatio(player: Player, state: GameState): number {
    const threatMatrix = this.getThreatMatrix(player, state);
    const territoryCells = this.getPlayerTerritoryCells(player, state);

    let highThreatCount = 0;
    for (const key of territoryCells) {
      const threat = threatMatrix[key] || 0;
      if (threat > AI_THREAT_THRESHOLD) {
        highThreatCount++;
      }
    }

    const threatIndex = territoryCells.size > 0 ? highThreatCount / territoryCells.size : 0;

    const enemies = state.players.filter(p => p.id !== player.id && !p.isEliminated);
    let maxNeighborAggression = 0;

    const playerSoldiers = player.ants.filter(a => a.type === 'soldier' && a.hp > 0).length;

    for (const enemy of enemies) {
      const dist = hexDistance(player.nestPosition, enemy.nestPosition);
      if (dist <= 15) {
        const enemySoldiers = enemy.ants.filter(a => a.type === 'soldier' && a.hp > 0).length;
        const aggression = playerSoldiers > 0 ? Math.min(2.0, enemySoldiers / playerSoldiers) : 2.0;
        if (aggression > maxNeighborAggression) {
          maxNeighborAggression = aggression;
        }
      }
    }

    let militaryRatio = Math.min(0.7, Math.max(0.2, threatIndex * 0.5 + maxNeighborAggression * 0.3));

    const maintenanceCost = this.calculateMaintenanceCost(player);
    if (player.food < maintenanceCost * AI_MAINTENANCE_MULTIPLIER) {
      militaryRatio = 0.1;
    }

    return militaryRatio;
  }

  private calculateMaintenanceCost(player: Player): number {
    const soldierCount = player.ants.filter(a => a.type === 'soldier' && a.hp > 0).length;
    if (soldierCount > SOLDIER_MAINTENANCE_THRESHOLD) {
      return (soldierCount - SOLDIER_MAINTENANCE_THRESHOLD) * SOLDIER_MAINTENANCE_COST;
    }
    return 0;
  }

  private findPathBFS(start: HexCoord, goal: HexCoord, player: Player): HexCoord[] {
    const visited = new Set<string>();
    const queue: { coord: HexCoord; path: HexCoord[] }[] = [{ coord: start, path: [start] }];
    visited.add(coordKey(start));

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.coord.q === goal.q && current.coord.r === goal.r) {
        return current.path;
      }

      const neighbors = hexNeighbors(current.coord);
      for (const neighbor of neighbors) {
        const key = coordKey(neighbor);
        if (visited.has(key)) continue;
        if (!isValidHex(neighbor, this.mapSize)) continue;

        const cell = this.getCell(neighbor);
        if (!cell) continue;
        if (cell.terrain === 'rock') continue;

        if (cell.terrain === 'water' && player.mutation !== 'speed') continue;
        if (cell.temporaryWater !== undefined && cell.temporaryWater > 0 && player.mutation !== 'speed') continue;

        visited.add(key);
        queue.push({ coord: neighbor, path: [...current.path, neighbor] });
      }
    }

    return [];
  }

  private findNextMove(start: HexCoord, goal: HexCoord, player: Player): HexCoord | null {
    const path = this.findPathBFS(start, goal, player);
    if (path.length > 1) {
      return path[1];
    }
    return null;
  }

  private generateMoveCommandsWithDecisions(
    player: Player, 
    state: GameState,
    threatMatrix: ThreatMatrix
  ): { moveCommands: MoveCommand[]; antDecisions: AntDecision[] } {
    const commands: MoveCommand[] = [];
    const antDecisions: AntDecision[] = [];

    for (const ant of player.ants) {
      if (ant.hp <= 0) continue;

      let target: HexCoord | null = null;
      let reason: AntDecisionReason = 'patrol';
      let reasonDetail = '';

      if (ant.type === 'worker') {
        const result = this.getWorkerTargetWithReason(ant, player, state);
        target = result.target;
        reason = result.reason;
        reasonDetail = result.reasonDetail;
      } else if (ant.type === 'soldier') {
        const result = this.getSoldierTargetWithReason(ant, player, state, threatMatrix);
        target = result.target;
        reason = result.reason;
        reasonDetail = result.reasonDetail;
      } else if (ant.type === 'scout') {
        const result = this.getScoutTargetWithReason(ant, player, state);
        target = result.target;
        reason = result.reason;
        reasonDetail = result.reasonDetail;
      }

      if (target) {
        const path = this.findPathBFS(ant.position, target, player);
        const nextMove = path.length > 1 ? path[1] : null;
        if (nextMove) {
          commands.push({
            antId: ant.id,
            target: nextMove
          });
          antDecisions.push({
            antId: ant.id,
            antType: ant.type,
            startPosition: { ...ant.position },
            targetPosition: { ...target },
            path: path.map(p => ({ ...p })),
            reason,
            reasonDetail
          });
        }
      }
    }

    return { moveCommands: commands, antDecisions };
  }

  private getWorkerTargetWithReason(ant: Ant, player: Player, state: GameState): { target: HexCoord | null; reason: AntDecisionReason; reasonDetail: string } {
    if (ant.carryingFood >= ant.carryCapacity || ant.isReturning) {
      return {
        target: player.nestPosition,
        reason: 'return',
        reasonDetail: `携带食物 ${ant.carryingFood}/${ant.carryCapacity}，返回蚁巢`
      };
    }

    let nearestFood: HexCoord | null = null;
    let nearestDist = Infinity;
    let foodAmount = 0;

    for (const row of this.map) {
      for (const cell of row) {
        if (cell.foodSource && cell.foodSource.amount > 0) {
          if (!this.isCellVisible(cell.coord, player, state) && this.difficulty !== 'hard') continue;

          const isOccupied = state.players.some(p =>
            p.ants.some(a =>
              a.hp > 0 &&
              a.type === 'worker' &&
              a.id !== ant.id &&
              a.position.q === cell.coord.q &&
              a.position.r === cell.coord.r
            )
          );
          if (isOccupied) continue;

          const dist = hexDistance(ant.position, cell.coord);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestFood = cell.coord;
            foodAmount = cell.foodSource.amount;
          }
        }
      }
    }

    if (nearestFood) {
      return {
        target: nearestFood,
        reason: 'collect',
        reasonDetail: `前往采集食物，距离 ${nearestDist.toFixed(1)}，食物量 ${foodAmount}`
      };
    }

    return {
      target: player.nestPosition,
      reason: 'patrol',
      reasonDetail: '未发现食物源，在蚁巢附近巡逻'
    };
  }

  private getSoldierTargetWithReason(ant: Ant, player: Player, state: GameState, threatMatrix: ThreatMatrix): { target: HexCoord | null; reason: AntDecisionReason; reasonDetail: string } {
    let bestTarget: HexCoord | null = null;
    let bestThreat = -Infinity;
    let bestThreatKey = '';

    for (const [key, threat] of Object.entries(threatMatrix)) {
      const coord = parseCoordKey(key);
      const dist = hexDistance(ant.position, coord);

      if (dist <= 3 && threat > bestThreat) {
        bestThreat = threat;
        bestTarget = coord;
        bestThreatKey = key;
      }
    }

    if (bestTarget && bestThreat > 0) {
      return {
        target: bestTarget,
        reason: 'chase',
        reasonDetail: `追击威胁区域 (${bestThreatKey})，威胁值 ${bestThreat.toFixed(2)}`
      };
    }

    const enemies = state.players.filter(p => p.id !== player.id && !p.isEliminated);
    let nearestBorder: HexCoord | null = null;
    let nearestBorderDist = Infinity;
    let nearestEnemy = '';

    for (const row of this.map) {
      for (const cell of row) {
        if (!this.isCellVisible(cell.coord, player, state) && this.difficulty !== 'hard') continue;

        const isPlayerTerritory = (cell.territoryMarkers[player.id] || 0) > 0;
        if (!isPlayerTerritory) continue;

        const neighbors = hexNeighbors(cell.coord);
        for (const neighborCoord of neighbors) {
          const neighborCell = this.getCell(neighborCoord);
          if (!neighborCell) continue;

          for (const enemy of enemies) {
            if ((neighborCell.territoryMarkers[enemy.id] || 0) > 0) {
              const dist = hexDistance(player.nestPosition, cell.coord);
              if (dist < nearestBorderDist) {
                nearestBorderDist = dist;
                nearestBorder = cell.coord;
                nearestEnemy = enemy.name;
              }
              break;
            }
          }
        }
      }
    }

    if (nearestBorder) {
      return {
        target: nearestBorder,
        reason: 'defend',
        reasonDetail: `前往与 ${nearestEnemy} 的边境防御，距离蚁巢 ${nearestBorderDist.toFixed(1)}`
      };
    }

    const patrolCells = hexRange(player.nestPosition, 2);
    const validPatrolCells = patrolCells.filter(c => {
      const cell = this.getCell(c);
      return cell && cell.terrain !== 'rock';
    });

    if (validPatrolCells.length > 0) {
      const randomIndex = Math.floor(Math.random() * validPatrolCells.length);
      const patrolTarget = validPatrolCells[randomIndex];
      return {
        target: patrolTarget,
        reason: 'patrol',
        reasonDetail: `在蚁巢附近巡逻，随机目标点 (${patrolTarget.q},${patrolTarget.r})`
      };
    }

    return {
      target: player.nestPosition,
      reason: 'patrol',
      reasonDetail: '驻守蚁巢'
    };
  }

  private getScoutTargetWithReason(ant: Ant, player: Player, state: GameState): { target: HexCoord | null; reason: AntDecisionReason; reasonDetail: string } {
    const territoryCells = this.getPlayerTerritoryCells(player, state);
    const exploredCells = new Set<string>();

    const allAnts = player.ants.filter(a => a.hp > 0);
    for (const a of allAnts) {
      const visionRange = ANT_STATS[a.type].visionRange;
      const visibleRange = hexRange(a.position, visionRange);
      for (const coord of visibleRange) {
        exploredCells.add(coordKey(coord));
      }
    }

    let nearestUnexplored: HexCoord | null = null;
    let minDistance = Infinity;

    for (const row of this.map) {
      for (const cell of row) {
        const key = coordKey(cell.coord);
        if (!exploredCells.has(key) && !territoryCells.has(key)) {
          const dist = hexDistance(ant.position, cell.coord);
          if (dist < minDistance) {
            minDistance = dist;
            nearestUnexplored = cell.coord;
          }
        }
      }
    }

    if (nearestUnexplored) {
      return {
        target: nearestUnexplored,
        reason: 'explore',
        reasonDetail: `前往未探索区域 (${nearestUnexplored.q},${nearestUnexplored.r})，距离 ${minDistance.toFixed(1)}`
      };
    }

    let nearestFood: HexCoord | null = null;
    let minFoodDist = Infinity;
    let foodAmount = 0;

    for (const row of this.map) {
      for (const cell of row) {
        if (cell.foodSource && cell.foodSource.amount > 0) {
          const dist = hexDistance(ant.position, cell.coord);
          if (dist < minFoodDist) {
            minFoodDist = dist;
            nearestFood = cell.coord;
            foodAmount = cell.foodSource.amount;
          }
        }
      }
    }

    if (nearestFood) {
      return {
        target: nearestFood,
        reason: 'patrol',
        reasonDetail: `无未探索区域，前往食物源 (${nearestFood.q},${nearestFood.r}) 巡逻，食物量 ${foodAmount}`
      };
    }

    return {
      target: player.nestPosition,
      reason: 'patrol',
      reasonDetail: '无探索目标和食物源，在蚁巢附近巡逻'
    };
  }

  private generateProduceCommandsWithDecisions(
    player: Player, 
    state: GameState,
    militaryRatio: number
  ): { produceCommands: ProduceCommand[]; produceDecisions: ProduceDecision[] } {
    const commands: ProduceCommand[] = [];
    const decisions: ProduceDecision[] = [];

    const barracksLevel = player.facilities.barracks.level;
    const totalAnts = player.ants.filter(a => a.hp > 0).length;
    const soldierCount = player.ants.filter(a => a.type === 'soldier' && a.hp > 0).length;
    const workerCount = player.ants.filter(a => a.type === 'worker' && a.hp > 0).length;

    let antType: AntType;
    let maxProduce: number;
    let triggerCondition: string;

    if (workerCount < 3) {
      antType = 'worker';
      maxProduce = 3 - workerCount;
      triggerCondition = `工蚁数量不足 (${workerCount}/3)，优先生产工蚁`;
    } else if (barracksLevel >= 2 && soldierCount < totalAnts * 0.4) {
      antType = 'soldier';
      maxProduce = Math.floor(totalAnts * 0.4) - soldierCount + 1;
      triggerCondition = `兵营等级 ${barracksLevel} >= 2 且士兵占比 ${(soldierCount/totalAnts).toFixed(2)} < 40%，需要补充士兵`;
    } else if (Math.random() < militaryRatio) {
      antType = 'soldier';
      maxProduce = PlayerFactory.getProductionPerTurn(player);
      triggerCondition = `军事比例 ${militaryRatio.toFixed(2)} 较高，随机决定生产士兵`;
    } else {
      antType = 'worker';
      maxProduce = PlayerFactory.getProductionPerTurn(player);
      triggerCondition = `经济比例 ${(1-militaryRatio).toFixed(2)} 较高，随机决定生产工蚁`;
    }

    const costPerAnt = AntFactory.getCost(antType);
    const affordableCount = Math.floor(player.food / costPerAnt);
    const count = Math.min(maxProduce, affordableCount);

    if (count > 0 && PlayerFactory.canProduceAnt(player, antType, count)) {
      commands.push({ antType, count });
      decisions.push({
        antType,
        count,
        triggerCondition,
        cost: costPerAnt * count
      });
    }

    return { produceCommands: commands, produceDecisions: decisions };
  }

  private generateUpgradeCommandsWithDecisions(
    player: Player, 
    state: GameState,
    threatMatrix: ThreatMatrix
  ): { upgradeCommands: UpgradeCommand[]; upgradeDecisions: UpgradeDecision[] } {
    const commands: UpgradeCommand[] = [];
    const decisions: UpgradeDecision[] = [];

    const hasEmergency = Object.entries(threatMatrix).some(([key, threat]) => {
      const coord = parseCoordKey(key);
      const territoryCells = this.getPlayerTerritoryCells(player, state);
      return territoryCells.has(key) && threat > 5;
    });

    if (hasEmergency) {
      return { upgradeCommands: [], upgradeDecisions: [] };
    }

    const upgradePriority: { type: FacilityType; condition: string }[] = [];

    const hatcheryLevel = player.facilities.hatchery.level;
    if (hatcheryLevel < 3) {
      upgradePriority.push({ type: 'hatchery', condition: `孵化场等级 ${hatcheryLevel} < 3，优先升级` });
    }

    const storageLevel = player.facilities.storage.level;
    const foodRatio = player.food / player.maxFood;
    if (storageLevel < 3 && foodRatio > 0.7) {
      upgradePriority.push({ type: 'storage', condition: `仓库等级 ${storageLevel} < 3 且食物储量 ${(foodRatio*100).toFixed(0)}% > 70%，需要升级` });
    }

    const barracksLevel = player.facilities.barracks.level;
    if (barracksLevel < 3) {
      upgradePriority.push({ type: 'barracks', condition: `兵营等级 ${barracksLevel} < 3，需要升级` });
    }

    for (const { type: facilityType, condition } of upgradePriority) {
      const facility = player.facilities[facilityType];
      if (facility.level >= FACILITY_STATS[facilityType].maxLevel) continue;

      const upgradeCost = PlayerFactory.getUpgradeCost(facilityType, facility.level);
      if (player.food >= upgradeCost * 1.5) {
        commands.push({ facilityType });
        decisions.push({
          facilityType,
          fromLevel: facility.level,
          toLevel: facility.level + 1,
          cost: upgradeCost,
          triggerCondition: condition + `，食物 ${player.food} >= ${(upgradeCost * 1.5).toFixed(0)}`
        });
        break;
      }
    }

    return { upgradeCommands: commands, upgradeDecisions: decisions };
  }

  private validateMoveCommands(commands: MoveCommand[], player: Player): MoveCommand[] {
    return commands.filter(cmd => {
      const ant = player.ants.find(a => a.id === cmd.antId);
      if (!ant || ant.hp <= 0) return false;

      if (!isValidHex(cmd.target, this.mapSize)) return false;

      const cell = this.getCell(cmd.target);
      if (!cell) return false;
      if (cell.terrain === 'rock') return false;

      return true;
    });
  }

  private validateProduceCommands(commands: ProduceCommand[], player: Player): ProduceCommand[] {
    return commands.filter(cmd => {
      if (cmd.count <= 0) return false;

      const cost = AntFactory.getCost(cmd.antType) * cmd.count;
      if (player.food < cost) return false;

      return PlayerFactory.canProduceAnt(player, cmd.antType, cmd.count);
    });
  }

  private validateUpgradeCommands(commands: UpgradeCommand[], player: Player): UpgradeCommand[] {
    return commands.filter(cmd => {
      const facility = player.facilities[cmd.facilityType];
      if (!facility) return false;

      if (facility.level >= FACILITY_STATS[cmd.facilityType].maxLevel) return false;

      const cost = PlayerFactory.getUpgradeCost(cmd.facilityType, facility.level);
      if (player.food < cost) return false;

      return true;
    });
  }
}
