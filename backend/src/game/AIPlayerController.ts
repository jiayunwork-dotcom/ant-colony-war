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
  Ant,
  AntType,
  AIDifficulty,
  ThreatMatrix,
  AICache,
  FacilityType
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

  generateCommand(state: GameState): PlayerCommand {
    const player = state.players.find(p => p.id === this.playerId);
    if (!player || player.isEliminated) {
      return {
        playerId: this.playerId,
        moveCommands: [],
        buildCommands: [],
        produceCommands: [],
        upgradeCommands: []
      };
    }

    const moveCommands = this.generateMoveCommands(player, state);
    const produceCommands = this.generateProduceCommands(player, state);
    const upgradeCommands = this.generateUpgradeCommands(player, state);

    return {
      playerId: this.playerId,
      moveCommands: this.validateMoveCommands(moveCommands, player),
      buildCommands: [],
      produceCommands: this.validateProduceCommands(produceCommands, player),
      upgradeCommands: this.validateUpgradeCommands(upgradeCommands, player)
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
        const nearbyCells = hexRange(cell.coord, 2);
        for (const nearbyCoord of nearbyCells) {
          for (const enemy of enemyPlayers) {
            for (const ant of enemy.ants) {
              if (ant.hp > 0 && ant.type === 'soldier') {
                if (hexDistance(ant.position, nearbyCoord) <= 2) {
                  nearbyEnemySoldiers++;
                }
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

  private generateMoveCommands(player: Player, state: GameState): MoveCommand[] {
    const commands: MoveCommand[] = [];
    const threatMatrix = this.getThreatMatrix(player, state);

    for (const ant of player.ants) {
      if (ant.hp <= 0) continue;

      let target: HexCoord | null = null;

      if (ant.type === 'worker') {
        target = this.getWorkerTarget(ant, player, state);
      } else if (ant.type === 'soldier') {
        target = this.getSoldierTarget(ant, player, state, threatMatrix);
      } else if (ant.type === 'scout') {
        target = this.getScoutTarget(ant, player, state);
      }

      if (target) {
        const nextMove = this.findNextMove(ant.position, target, player);
        if (nextMove) {
          commands.push({
            antId: ant.id,
            target: nextMove
          });
        }
      }
    }

    return commands;
  }

  private getWorkerTarget(ant: Ant, player: Player, state: GameState): HexCoord | null {
    if (ant.carryingFood >= ant.carryCapacity || ant.isReturning) {
      return player.nestPosition;
    }

    let nearestFood: HexCoord | null = null;
    let nearestDist = Infinity;

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
          }
        }
      }
    }

    return nearestFood;
  }

  private getSoldierTarget(ant: Ant, player: Player, state: GameState, threatMatrix: ThreatMatrix): HexCoord | null {
    let bestTarget: HexCoord | null = null;
    let bestThreat = -Infinity;

    for (const [key, threat] of Object.entries(threatMatrix)) {
      const coord = parseCoordKey(key);
      const dist = hexDistance(ant.position, coord);

      if (dist <= 3 && threat > bestThreat) {
        bestThreat = threat;
        bestTarget = coord;
      }
    }

    if (bestTarget && bestThreat > 0) {
      return bestTarget;
    }

    const enemies = state.players.filter(p => p.id !== player.id && !p.isEliminated);
    let nearestBorder: HexCoord | null = null;
    let nearestBorderDist = Infinity;

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
              }
              break;
            }
          }
        }
      }
    }

    if (nearestBorder) {
      return nearestBorder;
    }

    const patrolCells = hexRange(player.nestPosition, 2);
    const validPatrolCells = patrolCells.filter(c => {
      const cell = this.getCell(c);
      return cell && cell.terrain !== 'rock';
    });

    if (validPatrolCells.length > 0) {
      const randomIndex = Math.floor(Math.random() * validPatrolCells.length);
      return validPatrolCells[randomIndex];
    }

    return player.nestPosition;
  }

  private getScoutTarget(ant: Ant, player: Player, state: GameState): HexCoord | null {
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

    let farthestUnexplored: HexCoord | null = null;
    let maxDistance = -1;

    for (const row of this.map) {
      for (const cell of row) {
        const key = coordKey(cell.coord);
        if (!exploredCells.has(key) && !territoryCells.has(key)) {
          const dist = hexDistance(ant.position, cell.coord);
          if (dist > maxDistance) {
            maxDistance = dist;
            farthestUnexplored = cell.coord;
          }
        }
      }
    }

    if (farthestUnexplored) {
      return farthestUnexplored;
    }

    let farthestFood: HexCoord | null = null;
    let maxFoodDist = -1;

    for (const row of this.map) {
      for (const cell of row) {
        if (cell.foodSource && cell.foodSource.amount > 0) {
          const dist = hexDistance(ant.position, cell.coord);
          if (dist > maxFoodDist) {
            maxFoodDist = dist;
            farthestFood = cell.coord;
          }
        }
      }
    }

    return farthestFood;
  }

  private generateProduceCommands(player: Player, state: GameState): ProduceCommand[] {
    const commands: ProduceCommand[] = [];
    const militaryRatio = this.calculateMilitaryRatio(player, state);

    const barracksLevel = player.facilities.barracks.level;
    const totalAnts = player.ants.filter(a => a.hp > 0).length;
    const soldierCount = player.ants.filter(a => a.type === 'soldier' && a.hp > 0).length;
    const workerCount = player.ants.filter(a => a.type === 'worker' && a.hp > 0).length;

    let antType: AntType;
    let maxProduce: number;

    if (workerCount < 3) {
      antType = 'worker';
      maxProduce = 3 - workerCount;
    } else if (barracksLevel >= 2 && soldierCount < totalAnts * 0.4) {
      antType = 'soldier';
      maxProduce = Math.floor(totalAnts * 0.4) - soldierCount + 1;
    } else if (Math.random() < militaryRatio) {
      antType = 'soldier';
      maxProduce = PlayerFactory.getProductionPerTurn(player);
    } else {
      antType = 'worker';
      maxProduce = PlayerFactory.getProductionPerTurn(player);
    }

    const costPerAnt = AntFactory.getCost(antType);
    const affordableCount = Math.floor(player.food / costPerAnt);
    const count = Math.min(maxProduce, affordableCount);

    if (count > 0 && PlayerFactory.canProduceAnt(player, antType, count)) {
      commands.push({ antType, count });
    }

    return commands;
  }

  private generateUpgradeCommands(player: Player, state: GameState): UpgradeCommand[] {
    const commands: UpgradeCommand[] = [];
    const threatMatrix = this.getThreatMatrix(player, state);

    const hasEmergency = Object.entries(threatMatrix).some(([key, threat]) => {
      const coord = parseCoordKey(key);
      const territoryCells = this.getPlayerTerritoryCells(player, state);
      return territoryCells.has(key) && threat > 5;
    });

    if (hasEmergency) {
      return commands;
    }

    const upgradePriority: FacilityType[] = [];

    const hatcheryLevel = player.facilities.hatchery.level;
    if (hatcheryLevel < 3) {
      upgradePriority.push('hatchery');
    }

    const storageLevel = player.facilities.storage.level;
    const foodRatio = player.food / player.maxFood;
    if (storageLevel < 3 && foodRatio > 0.7) {
      upgradePriority.push('storage');
    }

    const barracksLevel = player.facilities.barracks.level;
    if (barracksLevel < 3) {
      upgradePriority.push('barracks');
    }

    for (const facilityType of upgradePriority) {
      const facility = player.facilities[facilityType];
      if (facility.level >= FACILITY_STATS[facilityType].maxLevel) continue;

      const upgradeCost = PlayerFactory.getUpgradeCost(facilityType, facility.level);
      if (player.food >= upgradeCost * 1.5) {
        commands.push({ facilityType });
        break;
      }
    }

    return commands;
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
