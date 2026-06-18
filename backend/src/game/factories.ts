import { v4 as uuidv4 } from 'uuid';
import { Ant, AntType, HexCoord, Player, MutationType, FacilityType } from '../../../shared/types';
import {
  ANT_STATS,
  SOLDIER_LEVEL_STATS,
  INITIAL_FOOD,
  NEST_HP,
  STORAGE_CAPACITY,
  FACILITY_STATS,
  MUTATION_EFFECTS
} from '../../../shared/constants';

export class AntFactory {
  static create(type: AntType, playerId: string, position: HexCoord, level: number = 1, mutation: MutationType = null): Ant {
    const baseStats = ANT_STATS[type];
    let attack = baseStats.attack;
    let hp = baseStats.hp;
    let moveSpeed = baseStats.moveSpeed;

    if (type === 'soldier') {
      const levelStats = SOLDIER_LEVEL_STATS[level - 1] || SOLDIER_LEVEL_STATS[0];
      attack = levelStats.attack;
      hp = levelStats.hp;
    }

    if (mutation === 'strength' && type === 'soldier') {
      attack = Math.floor(attack * (1 + MUTATION_EFFECTS.strength.attackBonus));
    }

    if (mutation === 'resistance') {
      hp = Math.floor(hp * (1 + MUTATION_EFFECTS.resistance.hpBonus));
    }

    if (mutation === 'speed') {
      moveSpeed += MUTATION_EFFECTS.speed.moveBonus;
    }

    return {
      id: uuidv4(),
      type,
      playerId,
      position: { ...position },
      hp,
      maxHp: hp,
      attack,
      moveSpeed,
      movePoints: moveSpeed,
      carryCapacity: baseStats.carryCapacity,
      carryingFood: 0,
      level,
      isReturning: false,
      targetPosition: undefined
    };
  }

  static createWorker(playerId: string, position: HexCoord, mutation: MutationType = null): Ant {
    return this.create('worker', playerId, position, 1, mutation);
  }

  static createSoldier(playerId: string, position: HexCoord, level: number = 1, mutation: MutationType = null): Ant {
    return this.create('soldier', playerId, position, level, mutation);
  }

  static createScout(playerId: string, position: HexCoord, mutation: MutationType = null): Ant {
    return this.create('scout', playerId, position, 1, mutation);
  }

  static getCost(type: AntType): number {
    return ANT_STATS[type].cost;
  }
}

export class PlayerFactory {
  static create(id: string, name: string, color: string, nestPosition: HexCoord): Player {
    const facilities = {
      hatchery: { type: 'hatchery' as FacilityType, level: 1 },
      storage: { type: 'storage' as FacilityType, level: 1 },
      barracks: { type: 'barracks' as FacilityType, level: 0 },
      lab: { type: 'lab' as FacilityType, level: 0 }
    };

    const player: Player = {
      id,
      name,
      color,
      food: INITIAL_FOOD,
      maxFood: STORAGE_CAPACITY[0],
      nestPosition: { ...nestPosition },
      nestHp: NEST_HP,
      nestMaxHp: NEST_HP,
      facilities,
      ants: [],
      mutation: null,
      totalFoodCollected: 0,
      totalKills: 0,
      isEliminated: false,
      isReady: false
    };

    for (let i = 0; i < 3; i++) {
      player.ants.push(AntFactory.createWorker(id, nestPosition));
    }
    player.ants.push(AntFactory.createScout(id, nestPosition));

    return player;
  }

  static getUpgradeCost(facilityType: FacilityType, currentLevel: number): number {
    const stats = FACILITY_STATS[facilityType];
    if (currentLevel >= stats.maxLevel) return Infinity;
    return stats.upgradeCosts[currentLevel - 1] || stats.upgradeCosts[0];
  }

  static canProduceAnt(player: Player, type: AntType, count: number = 1): boolean {
    if (player.isEliminated) return false;

    const cost = AntFactory.getCost(type) * count;
    if (player.food < cost) return false;

    const currentCount = player.ants.filter(a => a.type === type && a.hp > 0).length;

    if (type === 'worker') {
      const workerLimit = 20;
      return currentCount + count <= workerLimit;
    }

    if (type === 'scout') {
      const scoutLimit = 3;
      return currentCount + count <= scoutLimit;
    }

    if (type === 'soldier') {
      const barracksLevel = player.facilities.barracks.level;
      if (barracksLevel === 0) return false;
      const soldierLimit = [5, 10, 15][barracksLevel - 1] || 5;
      return currentCount + count <= soldierLimit;
    }

    return false;
  }

  static getProductionPerTurn(player: Player): number {
    const hatcheryLevel = player.facilities.hatchery.level;
    let production = [2, 4, 6][hatcheryLevel - 1] || 2;

    if (player.mutation === 'breeding') {
      production += MUTATION_EFFECTS.breeding.productionBonus;
    }

    return production;
  }

  static getMaxFood(player: Player): number {
    const storageLevel = player.facilities.storage.level;
    return STORAGE_CAPACITY[storageLevel - 1] || STORAGE_CAPACITY[0];
  }
}
