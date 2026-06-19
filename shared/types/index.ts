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
  lobbyReady: boolean;
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
  hostId: string;
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

export const PLAYER_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD'
];

export interface PlayerSnapshot {
  playerId: string;
  playerName: string;
  food: number;
  workerCount: number;
  soldierCount: number;
  scoutCount: number;
  territoryCount: number;
  hatcheryLevel: number;
  storageLevel: number;
  barracksLevel: number;
  labLevel: number;
}

export interface BattleEventRecord {
  attackerId: string;
  defenderId: string;
  attackerAntCount: number;
  defenderAntCount: number;
  attackerKills: number;
  defenderKills: number;
  position: HexCoord;
}

export interface EcoEventRecord {
  eventType: EventType;
  affectedCoords: HexCoord[];
  affectedPlayerIds: string[];
}

export interface TurnRecord {
  turn: number;
  timestamp: number;
  playerSnapshots: PlayerSnapshot[];
  battleEvents: BattleEventRecord[];
  ecoEvents: EcoEventRecord[];
}

export interface ScoreDetail {
  playerId: string;
  playerName: string;
  territory: number;
  food: number;
  kills: number;
  survivors: number;
  total: number;
}

export interface GameReplay {
  gameId: string;
  startTime: number;
  endTime: number;
  playerIds: string[];
  playerNames: string[];
  playerColors: string[];
  winnerId: string;
  scoreDetails: ScoreDetail[];
  totalTurns: number;
  turns: TurnRecord[];
}

export interface GameReplaySummary {
  gameId: string;
  startTime: number;
  playerNames: string[];
  playerColors: string[];
  winnerId: string;
  winnerName: string;
  totalTurns: number;
}

export interface RoomInfo {
  gameId: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  phase: GamePhase;
}

export type AIDifficulty = 'easy' | 'normal' | 'hard';

export interface AIPlayerConfig {
  difficulty: AIDifficulty;
  playerId: string;
  name: string;
}

export interface ThreatMatrix {
  [key: string]: number;
}

export interface AICache {
  threatMatrix: ThreatMatrix | null;
  threatMatrixTurn: number;
  visibleCells: Set<string> | null;
  visibleCellsTurn: number;
}

export type AntDecisionReason = 'patrol' | 'chase' | 'collect' | 'return' | 'explore' | 'defend';

export interface AntDecision {
  antId: string;
  antType: AntType;
  startPosition: HexCoord;
  targetPosition: HexCoord;
  path: HexCoord[];
  reason: AntDecisionReason;
  reasonDetail: string;
}

export interface ProduceDecision {
  antType: AntType;
  count: number;
  triggerCondition: string;
  cost: number;
}

export interface UpgradeDecision {
  facilityType: FacilityType;
  fromLevel: number;
  toLevel: number;
  cost: number;
  triggerCondition: string;
}

export interface MilitaryRatioCalc {
  threatIndex: number;
  neighborAggression: number;
  highThreatCount: number;
  totalTerritoryCount: number;
  maintenanceCost: number;
  foodLevel: number;
  finalRatio: number;
}

export interface AITurnDecision {
  turn: number;
  playerId: string;
  playerName: string;
  threatMatrix: ThreatMatrix;
  militaryRatioCalc: MilitaryRatioCalc;
  militaryRatio: number;
  economicRatio: number;
  antDecisions: AntDecision[];
  produceDecisions: ProduceDecision[];
  upgradeDecisions: UpgradeDecision[];
  totalFood: number;
  mapSnapshot: HexCell[][];
  playerSnapshot: PlayerSnapshot;
}

export interface AIReplayData {
  gameId: string;
  playerId: string;
  playerName: string;
  playerColor: string;
  totalTurns: number;
  decisions: AITurnDecision[];
  startTime: number;
  endTime: number;
}

export interface GameReplayWithAI extends GameReplay {
  aiReplayData: AIReplayData[];
}
