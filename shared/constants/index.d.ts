import type { AntType, FacilityType } from '../types';
export declare const MAP_SIZE = 40;
export declare const HEX_DIRECTIONS: {
    q: number;
    r: number;
}[];
export declare const ANT_STATS: Record<AntType, {
    hp: number;
    attack: number;
    moveSpeed: number;
    carryCapacity: number;
    cost: number;
    visionRange: number;
}>;
export declare const SOLDIER_LEVEL_STATS: {
    attack: number;
    hp: number;
}[];
export declare const ANT_LIMITS: {
    worker: number;
    scout: number;
    soldierByLevel: number[];
};
export declare const FACILITY_STATS: Record<FacilityType, {
    name: string;
    maxLevel: number;
    upgradeCosts: number[];
    effects: string[];
}>;
export declare const HATCHERY_PRODUCTION: number[];
export declare const STORAGE_CAPACITY: number[];
export declare const BARRACKS_LIMIT: number[];
export declare const FOOD_PER_WORKER = 2;
export declare const NEST_HP = 100;
export declare const INITIAL_FOOD = 50;
export declare const PHEROMONE_DECAY = 0.9;
export declare const PHEROMONE_MIN = 0.1;
export declare const PHEROMONE_DEPOSIT = 1;
export declare const TERRITORY_DECAY = 0.95;
export declare const TERRITORY_MIN = 0.1;
export declare const TERRITORY_DEPOSIT = 1;
export declare const INITIAL_TERRITORY_RADIUS = 3;
export declare const SOLDIER_MAINTENANCE_THRESHOLD = 10;
export declare const SOLDIER_MAINTENANCE_COST = 2;
export declare const EVENT_INTERVAL = 5;
export declare const EVENT_WARNING_TURNS = 1;
export declare const PREDATOR_STATS: {
    hp: number;
    attack: number;
    foodDrop: number;
};
export declare const RAIN_DURATION = 3;
export declare const RAIN_DAMAGE = 1;
export declare const SCORE_TERRITORY_MULTIPLIER = 2;
export declare const SCORE_FOOD_MULTIPLIER = 0.5;
export declare const SCORE_KILLS_MULTIPLIER = 3;
export declare const SCORE_SURVIVORS_MULTIPLIER = 1;
export declare const COMMAND_TIME_LIMIT = 30;
export declare const MAX_TURNS = 50;
export declare const FOOD_SPAWN_INTERVAL = 5;
export declare const FOOD_SPAWN_AMOUNT = 3;
export declare const FOOD_SOURCE_MAX = 50;
export declare const INITIAL_FOOD_SOURCES = 15;
export declare const NEST_ATTACK_MIN_SOLDIERS = 5;
export declare const BATTLE_SIEGE_DIRECTIONS = 3;
export declare const BATTLE_SIEGE_BONUS = 0.5;
export declare const BATTLE_TERRITORY_DEFENSE_BONUS = 0.2;
export declare const BATTLE_WORKER_DAMAGE_MULTIPLIER = 2;
export declare const BATTLE_NUM_ADVANTAGE_MAX = 3;
export declare const MUTATION_EFFECTS: {
    speed: {
        moveBonus: number;
    };
    strength: {
        attackBonus: number;
    };
    resistance: {
        hpBonus: number;
    };
    breeding: {
        productionBonus: number;
    };
};
