import type { AntType, FacilityType } from '../types';

export const MAP_SIZE = 40;

export const HEX_DIRECTIONS: { q: number; r: number }[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];

export const ANT_STATS: Record<AntType, {
  hp: number;
  attack: number;
  moveSpeed: number;
  carryCapacity: number;
  cost: number;
  visionRange: number;
}> = {
  worker: {
    hp: 10,
    attack: 0,
    moveSpeed: 3,
    carryCapacity: 5,
    cost: 3,
    visionRange: 2
  },
  soldier: {
    hp: 15,
    attack: 3,
    moveSpeed: 2,
    carryCapacity: 0,
    cost: 8,
    visionRange: 2
  },
  scout: {
    hp: 5,
    attack: 0,
    moveSpeed: 5,
    carryCapacity: 0,
    cost: 5,
    visionRange: 4
  }
};

export const SOLDIER_LEVEL_STATS = [
  { attack: 3, hp: 15 },
  { attack: 5, hp: 25 },
  { attack: 8, hp: 40 }
];

export const ANT_LIMITS = {
  worker: 20,
  scout: 3,
  soldierByLevel: [5, 10, 15]
};

export const FACILITY_STATS: Record<FacilityType, {
  name: string;
  maxLevel: number;
  upgradeCosts: number[];
  effects: string[];
}> = {
  hatchery: {
    name: '孵化室',
    maxLevel: 3,
    upgradeCosts: [30, 60],
    effects: ['每回合生产2只蚂蚁', '每回合生产4只蚂蚁', '每回合生产6只蚂蚁']
  },
  storage: {
    name: '储粮室',
    maxLevel: 3,
    upgradeCosts: [30, 60],
    effects: ['食物上限100', '食物上限200', '食物上限400']
  },
  barracks: {
    name: '兵蚁营房',
    maxLevel: 3,
    upgradeCosts: [30, 60],
    effects: ['解锁兵蚁，上限5只', '兵蚁上限10只', '兵蚁上限15只，攻击力+1']
  },
  lab: {
    name: '进化实验室',
    maxLevel: 3,
    upgradeCosts: [40, 80],
    effects: ['解锁基因突变', '提升突变效果', '进一步提升突变效果']
  }
};

export const HATCHERY_PRODUCTION = [2, 4, 6];
export const STORAGE_CAPACITY = [100, 200, 400];
export const BARRACKS_LIMIT = [5, 10, 15];

export const FOOD_PER_WORKER = 2;
export const NEST_HP = 100;
export const INITIAL_FOOD = 50;

export const PHEROMONE_DECAY = 0.9;
export const PHEROMONE_MIN = 0.1;
export const PHEROMONE_DEPOSIT = 1;
export const TERRITORY_DECAY = 0.95;
export const TERRITORY_MIN = 0.1;
export const TERRITORY_DEPOSIT = 1;

export const INITIAL_TERRITORY_RADIUS = 3;

export const SOLDIER_MAINTENANCE_THRESHOLD = 10;
export const SOLDIER_MAINTENANCE_COST = 2;

export const EVENT_INTERVAL = 5;
export const EVENT_WARNING_TURNS = 1;

export const PREDATOR_STATS = {
  hp: 50,
  attack: 20,
  foodDrop: 30
};

export const RAIN_DURATION = 3;
export const RAIN_DAMAGE = 1;

export const SCORE_TERRITORY_MULTIPLIER = 2;
export const SCORE_FOOD_MULTIPLIER = 0.5;
export const SCORE_KILLS_MULTIPLIER = 3;
export const SCORE_SURVIVORS_MULTIPLIER = 1;

export const COMMAND_TIME_LIMIT = 30;
export const MAX_TURNS = 50;

export const FOOD_SPAWN_INTERVAL = 5;
export const FOOD_SPAWN_AMOUNT = 3;
export const FOOD_SOURCE_MAX = 50;
export const INITIAL_FOOD_SOURCES = 15;

export const NEST_ATTACK_MIN_SOLDIERS = 5;

export const BATTLE_SIEGE_DIRECTIONS = 3;
export const BATTLE_SIEGE_BONUS = 0.5;
export const BATTLE_TERRITORY_DEFENSE_BONUS = 0.2;
export const BATTLE_WORKER_DAMAGE_MULTIPLIER = 2;
export const BATTLE_NUM_ADVANTAGE_MAX = 3;

export const MUTATION_EFFECTS = {
  speed: { moveBonus: 1 },
  strength: { attackBonus: 0.3 },
  resistance: { hpBonus: 0.2 },
  breeding: { productionBonus: 1 }
};

export const AI_THREAT_THRESHOLD = 3;
export const AI_MAINTENANCE_MULTIPLIER = 2;
export const AI_COMMAND_DELAY = 200;

export const AI_DIFFICULTY_CONFIG = {
  easy: {
    visionRange: 0,
    decisionWeight: 0.5,
    name: 'AI-Easy'
  },
  normal: {
    visionRange: 3,
    decisionWeight: 0.8,
    name: 'AI-Normal'
  },
  hard: {
    visionRange: Infinity,
    decisionWeight: 1.0,
    name: 'AI-Hard'
  }
};
