export interface HexCoord {
    q: number;
    r: number;
}
export interface HexCell {
    coord: HexCoord;
    terrain: TerrainType;
    foodSource?: FoodSource;
    infoPheromones: Record<string, number>;
    alarmPheromones: Record<string, number>;
    territoryMarkers: Record<string, number>;
    nest?: string;
    temporaryWater?: number;
}
export type TerrainType = 'ground' | 'rock' | 'water' | 'food';
export interface FoodSource {
    amount: number;
    maxAmount: number;
}
export type AntType = 'worker' | 'soldier' | 'scout';
export interface Ant {
    id: string;
    type: AntType;
    playerId: string;
    position: HexCoord;
    hp: number;
    maxHp: number;
    attack: number;
    moveSpeed: number;
    movePoints: number;
    carryCapacity: number;
    carryingFood: number;
    level: number;
    isReturning: boolean;
    targetPosition?: HexCoord;
}
export type FacilityType = 'hatchery' | 'storage' | 'barracks' | 'lab';
export interface Facility {
    type: FacilityType;
    level: number;
}
export type MutationType = 'speed' | 'strength' | 'resistance' | 'breeding' | null;
export interface Player {
    id: string;
    name: string;
    color: string;
    food: number;
    maxFood: number;
    nestPosition: HexCoord;
    nestHp: number;
    nestMaxHp: number;
    facilities: Record<FacilityType, Facility>;
    ants: Ant[];
    mutation: MutationType;
    totalFoodCollected: number;
    totalKills: number;
    isEliminated: boolean;
    isReady: boolean;
}
export type GamePhase = 'waiting' | 'command' | 'settling' | 'result' | 'ended';
export type EventType = 'rain' | 'predator' | 'food_bloom' | 'plague' | null;
export interface GameEvent {
    type: EventType;
    turnsRemaining: number;
    center?: HexCoord;
    radius?: number;
    affectedPlayer?: string;
}
export interface GameState {
    id: string;
    turn: number;
    maxTurns: number;
    phase: GamePhase;
    phaseEndTime: number;
    mapSize: number;
    map: HexCell[][];
    players: Player[];
    currentEvent: GameEvent | null;
    nextEvent: GameEvent | null;
    eventLog: EventLogEntry[];
    winner: string | null;
    commandTimeLimit: number;
    predator?: Predator;
}
export interface Predator {
    id: string;
    position: HexCoord;
    hp: number;
    maxHp: number;
    attack: number;
    foodDrop: number;
}
export interface EventLogEntry {
    turn: number;
    message: string;
    type: 'info' | 'battle' | 'event' | 'economy' | 'warning';
}
export interface PlayerCommand {
    playerId: string;
    moveCommands: MoveCommand[];
    buildCommands: BuildCommand[];
    produceCommands: ProduceCommand[];
    upgradeCommands: UpgradeCommand[];
    chooseMutation?: MutationType;
}
export interface MoveCommand {
    antId: string;
    target: HexCoord;
}
export interface BuildCommand {
    facilityType: FacilityType;
}
export interface ProduceCommand {
    antType: AntType;
    count: number;
}
export interface UpgradeCommand {
    facilityType: FacilityType;
}
export declare const PLAYER_COLORS: string[];
