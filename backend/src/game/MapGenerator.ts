import { HexCell, HexCoord, TerrainType, FoodSource } from '../../../shared/types';
import { MAP_SIZE, FOOD_SOURCE_MAX, INITIAL_FOOD_SOURCES } from '../../../shared/constants';
import { hexDistance, hexRange, isValidHex } from '../../../shared/utils/hex';

export class MapGenerator {
  private size: number;
  private map: HexCell[][];
  private offset: number;

  constructor(size: number = MAP_SIZE) {
    this.size = size;
    this.offset = Math.floor(size / 2);
    this.map = [];
  }

  generate(): HexCell[][] {
    this.initializeMap();
    this.generateTerrain();
    this.generateRocks();
    this.generateWater();
    this.generateFoodSources();
    return this.map;
  }

  private initializeMap(): void {
    this.map = [];
    for (let r = -this.offset; r < this.size - this.offset; r++) {
      const row: HexCell[] = [];
      for (let q = -this.offset; q < this.size - this.offset; q++) {
        const coord: HexCoord = { q, r };
        if (isValidHex(coord, this.size)) {
          row.push({
            coord,
            terrain: 'ground',
            infoPheromones: {},
            alarmPheromones: {},
            territoryMarkers: {}
          });
        }
      }
      this.map.push(row);
    }
  }

  private generateTerrain(): void {
    this.forEachCell((cell) => {
      cell.terrain = 'ground';
    });
  }

  private generateRocks(): void {
    const rockCount = Math.floor(this.size * this.size * 0.08);
    let placed = 0;

    while (placed < rockCount) {
      const coord = this.getRandomHex();
      const cell = this.getCell(coord);
      if (cell && cell.terrain === 'ground' && !this.isNearEdge(coord, 5)) {
        this.placeRockCluster(coord, 2 + Math.floor(Math.random() * 3));
        placed++;
      }
    }
  }

  private placeRockCluster(center: HexCoord, size: number): void {
    const cells = hexRange(center, size);
    cells.forEach(coord => {
      const cell = this.getCell(coord);
      if (cell && Math.random() > 0.3) {
        cell.terrain = 'rock';
      }
    });
  }

  private generateWater(): void {
    const waterCount = Math.floor(this.size * this.size * 0.05);
    let placed = 0;

    while (placed < waterCount) {
      const coord = this.getRandomHex();
      const cell = this.getCell(coord);
      if (cell && cell.terrain === 'ground' && !this.isNearEdge(coord, 8)) {
        this.placeWaterPool(coord, 2 + Math.floor(Math.random() * 4));
        placed++;
      }
    }
  }

  private placeWaterPool(center: HexCoord, size: number): void {
    const cells = hexRange(center, size);
    cells.forEach(coord => {
      const cell = this.getCell(coord);
      if (cell) {
        const dist = hexDistance(center, coord);
        if (dist <= size && Math.random() > 0.2) {
          cell.terrain = 'water';
        }
      }
    });
  }

  private generateFoodSources(): void {
    let placed = 0;

    while (placed < INITIAL_FOOD_SOURCES) {
      const coord = this.getRandomHex();
      const cell = this.getCell(coord);
      if (cell && cell.terrain === 'ground' && !cell.foodSource && !this.isNearEdge(coord, 6)) {
        const amount = 30 + Math.floor(Math.random() * (FOOD_SOURCE_MAX - 30));
        cell.foodSource = {
          amount,
          maxAmount: FOOD_SOURCE_MAX
        };
        cell.terrain = 'food';
        placed++;
      }
    }
  }

  public spawnFoodSource(amount: number = FOOD_SOURCE_MAX): HexCoord | null {
    let attempts = 0;
    while (attempts < 100) {
      const coord = this.getRandomHex();
      const cell = this.getCell(coord);
      if (cell && cell.terrain === 'ground' && !cell.foodSource && !this.isNearEdge(coord, 5)) {
        cell.foodSource = {
          amount,
          maxAmount: FOOD_SOURCE_MAX
        };
        cell.terrain = 'food';
        return coord;
      }
      attempts++;
    }
    return null;
  }

  public spawnFoodSourcesInArea(center: HexCoord, radius: number, count: number): HexCoord[] {
    const spawned: HexCoord[] = [];
    const areaCells = hexRange(center, radius);
    const shuffled = areaCells.sort(() => Math.random() - 0.5);

    for (const coord of shuffled) {
      if (spawned.length >= count) break;
      const cell = this.getCell(coord);
      if (cell && cell.terrain === 'ground' && !cell.foodSource) {
        const amount = 30 + Math.floor(Math.random() * (FOOD_SOURCE_MAX - 30));
        cell.foodSource = { amount, maxAmount: FOOD_SOURCE_MAX };
        cell.terrain = 'food';
        spawned.push(coord);
      }
    }

    return spawned;
  }

  private isNearEdge(coord: HexCoord, distance: number): boolean {
    return (
      coord.q <= -this.offset + distance ||
      coord.q >= this.size - this.offset - 1 - distance ||
      coord.r <= -this.offset + distance ||
      coord.r >= this.size - this.offset - 1 - distance
    );
  }

  private getRandomHex(): HexCoord {
    const q = -this.offset + Math.floor(Math.random() * this.size);
    const r = -this.offset + Math.floor(Math.random() * this.size);
    return { q, r };
  }

  public getCell(coord: HexCoord): HexCell | null {
    const rowIdx = coord.r + this.offset;
    const colIdx = coord.q + this.offset - Math.floor(coord.r / 2);
    if (rowIdx >= 0 && rowIdx < this.map.length) {
      const row = this.map[rowIdx];
      if (colIdx >= 0 && colIdx < row.length) {
        return row[colIdx];
      }
    }
    return null;
  }

  public setCell(coord: HexCoord, cell: HexCell): void {
    const rowIdx = coord.r + this.offset;
    const colIdx = coord.q + this.offset - Math.floor(coord.r / 2);
    if (rowIdx >= 0 && rowIdx < this.map.length) {
      const row = this.map[rowIdx];
      if (colIdx >= 0 && colIdx < row.length) {
        this.map[rowIdx][colIdx] = cell;
      }
    }
  }

  private forEachCell(callback: (cell: HexCell) => void): void {
    for (const row of this.map) {
      for (const cell of row) {
        callback(cell);
      }
    }
  }

  public getAllCells(): HexCell[] {
    const cells: HexCell[] = [];
    this.forEachCell(cell => cells.push(cell));
    return cells;
  }

  public getNestPositions(playerCount: number): HexCoord[] {
    const positions: HexCoord[] = [];
    const halfSize = Math.floor(this.size / 2) - 3;

    if (playerCount === 4) {
      positions.push({ q: -halfSize, r: 0 });
      positions.push({ q: halfSize, r: 0 });
      positions.push({ q: 0, r: -halfSize });
      positions.push({ q: 0, r: halfSize });
    } else if (playerCount === 5) {
      positions.push({ q: -halfSize, r: 0 });
      positions.push({ q: halfSize, r: 0 });
      positions.push({ q: 0, r: -halfSize });
      positions.push({ q: Math.floor(halfSize * 0.5), r: Math.floor(halfSize * 0.8) });
      positions.push({ q: -Math.floor(halfSize * 0.5), r: Math.floor(halfSize * 0.8) });
    } else if (playerCount === 6) {
      positions.push({ q: -halfSize, r: 0 });
      positions.push({ q: halfSize, r: 0 });
      positions.push({ q: 0, r: -halfSize });
      positions.push({ q: 0, r: halfSize });
      positions.push({ q: Math.floor(halfSize * 0.8), r: -Math.floor(halfSize * 0.4) });
      positions.push({ q: -Math.floor(halfSize * 0.8), r: Math.floor(halfSize * 0.4) });
    }

    return positions.map(pos => this.findValidNestPosition(pos));
  }

  private findValidNestPosition(target: HexCoord): HexCoord {
    const cell = this.getCell(target);
    if (cell && cell.terrain !== 'rock' && cell.terrain !== 'water') {
      return target;
    }

    for (let radius = 1; radius < 10; radius++) {
      const ring = hexRange(target, radius);
      for (const coord of ring) {
        const c = this.getCell(coord);
        if (c && c.terrain !== 'rock' && c.terrain !== 'water') {
          return coord;
        }
      }
    }

    return target;
  }

  public clearAreaForNest(center: HexCoord, radius: number = 2): void {
    const cells = hexRange(center, radius);
    cells.forEach(coord => {
      const cell = this.getCell(coord);
      if (cell) {
        cell.terrain = 'ground';
        cell.foodSource = undefined;
      }
    });
  }
}
