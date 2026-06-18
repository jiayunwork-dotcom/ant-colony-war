"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MUTATION_EFFECTS = exports.BATTLE_NUM_ADVANTAGE_MAX = exports.BATTLE_WORKER_DAMAGE_MULTIPLIER = exports.BATTLE_TERRITORY_DEFENSE_BONUS = exports.BATTLE_SIEGE_BONUS = exports.BATTLE_SIEGE_DIRECTIONS = exports.NEST_ATTACK_MIN_SOLDIERS = exports.INITIAL_FOOD_SOURCES = exports.FOOD_SOURCE_MAX = exports.FOOD_SPAWN_AMOUNT = exports.FOOD_SPAWN_INTERVAL = exports.MAX_TURNS = exports.COMMAND_TIME_LIMIT = exports.SCORE_SURVIVORS_MULTIPLIER = exports.SCORE_KILLS_MULTIPLIER = exports.SCORE_FOOD_MULTIPLIER = exports.SCORE_TERRITORY_MULTIPLIER = exports.RAIN_DAMAGE = exports.RAIN_DURATION = exports.PREDATOR_STATS = exports.EVENT_WARNING_TURNS = exports.EVENT_INTERVAL = exports.SOLDIER_MAINTENANCE_COST = exports.SOLDIER_MAINTENANCE_THRESHOLD = exports.INITIAL_TERRITORY_RADIUS = exports.TERRITORY_DEPOSIT = exports.TERRITORY_MIN = exports.TERRITORY_DECAY = exports.PHEROMONE_DEPOSIT = exports.PHEROMONE_MIN = exports.PHEROMONE_DECAY = exports.INITIAL_FOOD = exports.NEST_HP = exports.FOOD_PER_WORKER = exports.BARRACKS_LIMIT = exports.STORAGE_CAPACITY = exports.HATCHERY_PRODUCTION = exports.FACILITY_STATS = exports.ANT_LIMITS = exports.SOLDIER_LEVEL_STATS = exports.ANT_STATS = exports.HEX_DIRECTIONS = exports.MAP_SIZE = void 0;
exports.MAP_SIZE = 40;
exports.HEX_DIRECTIONS = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 }
];
exports.ANT_STATS = {
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
exports.SOLDIER_LEVEL_STATS = [
    { attack: 3, hp: 15 },
    { attack: 5, hp: 25 },
    { attack: 8, hp: 40 }
];
exports.ANT_LIMITS = {
    worker: 20,
    scout: 3,
    soldierByLevel: [5, 10, 15]
};
exports.FACILITY_STATS = {
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
exports.HATCHERY_PRODUCTION = [2, 4, 6];
exports.STORAGE_CAPACITY = [100, 200, 400];
exports.BARRACKS_LIMIT = [5, 10, 15];
exports.FOOD_PER_WORKER = 2;
exports.NEST_HP = 100;
exports.INITIAL_FOOD = 50;
exports.PHEROMONE_DECAY = 0.9;
exports.PHEROMONE_MIN = 0.1;
exports.PHEROMONE_DEPOSIT = 1;
exports.TERRITORY_DECAY = 0.95;
exports.TERRITORY_MIN = 0.1;
exports.TERRITORY_DEPOSIT = 1;
exports.INITIAL_TERRITORY_RADIUS = 3;
exports.SOLDIER_MAINTENANCE_THRESHOLD = 10;
exports.SOLDIER_MAINTENANCE_COST = 2;
exports.EVENT_INTERVAL = 5;
exports.EVENT_WARNING_TURNS = 1;
exports.PREDATOR_STATS = {
    hp: 50,
    attack: 20,
    foodDrop: 30
};
exports.RAIN_DURATION = 3;
exports.RAIN_DAMAGE = 1;
exports.SCORE_TERRITORY_MULTIPLIER = 2;
exports.SCORE_FOOD_MULTIPLIER = 0.5;
exports.SCORE_KILLS_MULTIPLIER = 3;
exports.SCORE_SURVIVORS_MULTIPLIER = 1;
exports.COMMAND_TIME_LIMIT = 30;
exports.MAX_TURNS = 50;
exports.FOOD_SPAWN_INTERVAL = 5;
exports.FOOD_SPAWN_AMOUNT = 3;
exports.FOOD_SOURCE_MAX = 50;
exports.INITIAL_FOOD_SOURCES = 15;
exports.NEST_ATTACK_MIN_SOLDIERS = 5;
exports.BATTLE_SIEGE_DIRECTIONS = 3;
exports.BATTLE_SIEGE_BONUS = 0.5;
exports.BATTLE_TERRITORY_DEFENSE_BONUS = 0.2;
exports.BATTLE_WORKER_DAMAGE_MULTIPLIER = 2;
exports.BATTLE_NUM_ADVANTAGE_MAX = 3;
exports.MUTATION_EFFECTS = {
    speed: { moveBonus: 1 },
    strength: { attackBonus: 0.3 },
    resistance: { hpBonus: 0.2 },
    breeding: { productionBonus: 1 }
};
