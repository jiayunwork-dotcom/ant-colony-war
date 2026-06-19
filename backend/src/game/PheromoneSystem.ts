import { HexCell, HexCoord } from '../../../shared/types';
import {
  PHEROMONE_DECAY,
  PHEROMONE_MIN,
  PHEROMONE_DEPOSIT,
  TERRITORY_DECAY,
  TERRITORY_MIN,
  TERRITORY_DEPOSIT
} from '../../../shared/constants';
import { getCellFromMap } from './MapGenerator';

export class PheromoneSystem {
  private map: HexCell[][];
  private mapSize: number;

  constructor(map: HexCell[][], mapSize: number) {
    this.map = map;
    this.mapSize = mapSize;
  }

  private getCell(coord: HexCoord): HexCell | null {
    return getCellFromMap(this.map, coord, this.mapSize);
  }

  depositInfoPheromone(coord: HexCoord, playerId: string, amount: number = PHEROMONE_DEPOSIT): void {
    const cell = this.getCell(coord);
    if (cell) {
      cell.infoPheromones[playerId] = (cell.infoPheromones[playerId] || 0) + amount;
    }
  }

  depositAlarmPheromone(coord: HexCoord, playerId: string, amount: number = PHEROMONE_DEPOSIT * 2): void {
    const cell = this.getCell(coord);
    if (cell) {
      cell.alarmPheromones[playerId] = (cell.alarmPheromones[playerId] || 0) + amount;
    }
  }

  depositTerritoryMarker(coord: HexCoord, playerId: string, amount: number = TERRITORY_DEPOSIT): void {
    const cell = this.getCell(coord);
    if (cell) {
      cell.territoryMarkers[playerId] = (cell.territoryMarkers[playerId] || 0) + amount;
    }
  }

  getInfoPheromone(coord: HexCoord, playerId: string): number {
    const cell = this.getCell(coord);
    return cell?.infoPheromones[playerId] || 0;
  }

  getAlarmPheromone(coord: HexCoord, playerId: string): number {
    const cell = this.getCell(coord);
    return cell?.alarmPheromones[playerId] || 0;
  }

  getTerritoryMarker(coord: HexCoord, playerId: string): number {
    const cell = this.getCell(coord);
    return cell?.territoryMarkers[playerId] || 0;
  }

  getTerritoryOwner(coord: HexCoord): string | null {
    const cell = this.getCell(coord);
    if (!cell) return null;

    let maxPlayer: string | null = null;
    let maxValue = TERRITORY_MIN;

    for (const [playerId, value] of Object.entries(cell.territoryMarkers)) {
      if (value > maxValue) {
        maxValue = value;
        maxPlayer = playerId;
      }
    }

    return maxPlayer;
  }

  decayAll(): void {
    for (const row of this.map) {
      for (const cell of row) {
        this.decayCell(cell);
      }
    }
  }

  private decayCell(cell: HexCell): void {
    for (const playerId of Object.keys(cell.infoPheromones)) {
      cell.infoPheromones[playerId] *= PHEROMONE_DECAY;
      if (cell.infoPheromones[playerId] < PHEROMONE_MIN) {
        delete cell.infoPheromones[playerId];
      }
    }

    for (const playerId of Object.keys(cell.alarmPheromones)) {
      cell.alarmPheromones[playerId] *= PHEROMONE_DECAY;
      if (cell.alarmPheromones[playerId] < PHEROMONE_MIN) {
        delete cell.alarmPheromones[playerId];
      }
    }

    for (const playerId of Object.keys(cell.territoryMarkers)) {
      cell.territoryMarkers[playerId] *= TERRITORY_DECAY;
      if (cell.territoryMarkers[playerId] < TERRITORY_MIN) {
        delete cell.territoryMarkers[playerId];
      }
    }
  }

  getPlayerTerritoryCount(playerId: string): number {
    let count = 0;
    for (const row of this.map) {
      for (const cell of row) {
        const owner = this.getTerritoryOwner(cell.coord);
        if (owner === playerId) {
          count++;
        }
      }
    }
    return count;
  }

  clearPlayerPheromones(playerId: string): void {
    for (const row of this.map) {
      for (const cell of row) {
        delete cell.infoPheromones[playerId];
        delete cell.alarmPheromones[playerId];
        delete cell.territoryMarkers[playerId];
      }
    }
  }
}
