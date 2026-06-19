import { Ant, Player, HexCoord, HexCell, AntType } from '../../../shared/types';
import {
  FOOD_PER_WORKER,
  SOLDIER_MAINTENANCE_THRESHOLD,
  SOLDIER_MAINTENANCE_COST,
  HATCHERY_PRODUCTION
} from '../../../shared/constants';
import { hexDistance, hexNeighbors, hexLine } from '../../../shared/utils/hex';
import { AntFactory, PlayerFactory } from './factories';
import { getCellFromMap } from './MapGenerator';

export class EconomySystem {
  private map: HexCell[][];
  private mapSize: number;

  constructor(map: HexCell[][], mapSize: number) {
    this.map = map;
    this.mapSize = mapSize;
  }

  private getCell(coord: HexCoord): HexCell | null {
    return getCellFromMap(this.map, coord, this.mapSize);
  }

  collectFood(player: Player): { collected: number; messages: string[] } {
    const messages: string[] = [];
    let totalCollected = 0;

    for (const ant of player.ants) {
      if (ant.type !== 'worker' || ant.hp <= 0) continue;

      const cell = this.getCell(ant.position);
      if (!cell || !cell.foodSource || cell.foodSource.amount <= 0) continue;
      if (ant.carryingFood >= ant.carryCapacity) continue;

      const collectAmount = Math.min(
        FOOD_PER_WORKER,
        ant.carryCapacity - ant.carryingFood,
        cell.foodSource.amount
      );

      cell.foodSource.amount -= collectAmount;
      ant.carryingFood += collectAmount;
      totalCollected += collectAmount;

      if (cell.foodSource.amount <= 0) {
        cell.foodSource = undefined;
        if (cell.terrain === 'food') {
          cell.terrain = 'ground';
        }
      }
    }

    if (totalCollected > 0) {
      player.totalFoodCollected += totalCollected;
    }

    return { collected: totalCollected, messages };
  }

  deliverFood(player: Player): { delivered: number; messages: string[] } {
    const messages: string[] = [];
    let totalDelivered = 0;

    for (const ant of player.ants) {
      if (ant.type !== 'worker' || ant.hp <= 0) continue;
      if (ant.carryingFood <= 0) continue;

      const atNest = ant.position.q === player.nestPosition.q &&
                      ant.position.r === player.nestPosition.r;

      if (atNest) {
        const maxCanStore = player.maxFood - player.food;
        const deliverAmount = Math.min(ant.carryingFood, maxCanStore);

        player.food += deliverAmount;
        totalDelivered += deliverAmount;

        const spoilage = ant.carryingFood - deliverAmount;
        if (spoilage > 0) {
        }

        ant.carryingFood = 0;
        ant.isReturning = false;
      }
    }

    return { delivered: totalDelivered, messages };
  }

  produceAnts(player: Player, antType: AntType, count: number): { produced: number; cost: number; messages: string[] } {
    const messages: string[] = [];
    let produced = 0;

    const canProduce = PlayerFactory.canProduceAnt(player, antType, count);
    if (!canProduce) {
      return { produced: 0, cost: 0, messages: ['无法生产蚂蚁：食物不足或已达上限'] };
    }

    const cost = AntFactory.getCost(antType) * count;
    player.food -= cost;

    for (let i = 0; i < count; i++) {
      const ant = AntFactory.create(antType, player.id, player.nestPosition, 1, player.mutation);
      player.ants.push(ant);
      produced++;
    }

    if (produced > 0) {
      messages.push(`生产了 ${produced} 只${antType === 'worker' ? '工蚁' : antType === 'soldier' ? '兵蚁' : '侦察蚁'}`);
    }

    return { produced, cost, messages };
  }

  applyMaintenance(player: Player): { starved: number; messages: string[] } {
    const messages: string[] = [];
    let starved = 0;

    const soldierCount = player.ants.filter(a => a.type === 'soldier' && a.hp > 0).length;

    if (soldierCount > SOLDIER_MAINTENANCE_THRESHOLD) {
      const excessSoldiers = soldierCount - SOLDIER_MAINTENANCE_THRESHOLD;
      const maintenanceCost = excessSoldiers * SOLDIER_MAINTENANCE_COST;

      if (player.food >= maintenanceCost) {
        player.food -= maintenanceCost;
      } else {
        const foodDeficit = maintenanceCost - player.food;
        player.food = 0;

        const soldiersToStarve = Math.ceil(foodDeficit / SOLDIER_MAINTENANCE_COST);
        const soldiers = player.ants.filter(a => a.type === 'soldier' && a.hp > 0);
        soldiers.sort(() => Math.random() - 0.5);

        for (let i = 0; i < Math.min(soldiersToStarve, soldiers.length); i++) {
          soldiers[i].hp = 0;
          starved++;
        }

        if (starved > 0) {
          messages.push(`${starved} 只兵蚁因食物不足饿死`);
        }
      }
    }

    return { starved, messages };
  }

  autoAssignWorkers(player: Player): void {
    for (const ant of player.ants) {
      if (ant.type !== 'worker' || ant.hp <= 0) continue;
      if (ant.targetPosition) continue;

      if (ant.carryingFood >= ant.carryCapacity) {
        ant.isReturning = true;
        ant.targetPosition = { ...player.nestPosition };
      } else if (ant.carryingFood > 0 && ant.isReturning) {
        ant.targetPosition = { ...player.nestPosition };
      } else {
        const nearestFood = this.findNearestFood(ant.position, player);
        if (nearestFood) {
          ant.targetPosition = { ...nearestFood };
          ant.isReturning = false;
        }
      }
    }
  }

  private findNearestFood(position: HexCoord, player: Player): HexCoord | null {
    let nearest: HexCoord | null = null;
    let nearestDist = Infinity;

    for (const row of this.map) {
      for (const cell of row) {
        if (cell.foodSource && cell.foodSource.amount > 0) {
          const dist = hexDistance(position, cell.coord);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = cell.coord;
          }
        }
      }
    }

    return nearest;
  }
}

export class MovementSystem {
  private map: HexCell[][];
  private mapSize: number;
  private pheromoneSystem: any;

  constructor(map: HexCell[][], mapSize: number, pheromoneSystem: any) {
    this.map = map;
    this.mapSize = mapSize;
    this.pheromoneSystem = pheromoneSystem;
  }

  private getCell(coord: HexCoord): HexCell | null {
    return getCellFromMap(this.map, coord, this.mapSize);
  }

  moveAnt(ant: Ant, target: HexCoord, player: Player): boolean {
    if (ant.hp <= 0 || ant.movePoints <= 0) return false;

    const distance = hexDistance(ant.position, target);
    if (distance === 0) return false;

    const path = hexLine(ant.position, target);
    let moved = false;

    for (let i = 1; i < path.length; i++) {
      if (ant.movePoints <= 0) break;

      const nextPos = path[i];
      const cell = this.getCell(nextPos);

      if (!cell) continue;
      if (cell.terrain === 'rock') continue;

      if (cell.terrain === 'water') {
        if (player.mutation !== 'speed') continue;
      }

      if (cell.temporaryWater !== undefined && cell.temporaryWater > 0) {
        if (player.mutation !== 'speed') continue;
      }

      ant.position = { ...nextPos };
      ant.movePoints--;
      moved = true;

      if (ant.type === 'worker') {
        if (ant.isReturning && ant.carryingFood > 0) {
          this.pheromoneSystem.depositInfoPheromone(nextPos, player.id);
        }
      }

      this.pheromoneSystem.depositTerritoryMarker(nextPos, player.id);

      if (nextPos.q === target.q && nextPos.r === target.r) {
        break;
      }
    }

    return moved;
  }

  processAllMovement(players: Player[]): void {
    for (const player of players) {
      if (player.isEliminated) continue;

      for (const ant of player.ants) {
        if (ant.hp <= 0) continue;
        ant.movePoints = ant.moveSpeed;

        if (ant.targetPosition) {
          this.moveAnt(ant, ant.targetPosition, player);

          const reached = ant.position.q === ant.targetPosition.q &&
                          ant.position.r === ant.targetPosition.r;

          if (reached) {
            if (ant.type === 'worker' && ant.isReturning) {
            }
            ant.targetPosition = undefined;
          }
        }
      }
    }
  }

  resetMovePoints(players: Player[]): void {
    for (const player of players) {
      if (player.isEliminated) continue;
      for (const ant of player.ants) {
        if (ant.hp > 0) {
          ant.movePoints = ant.moveSpeed;
        }
      }
    }
  }
}
