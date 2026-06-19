import { Ant, HexCoord, Player, HexCell, Predator, BattleEventRecord } from '../../../shared/types';
import {
  BATTLE_NUM_ADVANTAGE_MAX,
  BATTLE_WORKER_DAMAGE_MULTIPLIER,
  BATTLE_TERRITORY_DEFENSE_BONUS,
  BATTLE_SIEGE_DIRECTIONS,
  BATTLE_SIEGE_BONUS,
  NEST_ATTACK_MIN_SOLDIERS
} from '../../../shared/constants';
import { hexNeighbors, hexDistance } from '../../../shared/utils/hex';
import { getCellFromMap } from './MapGenerator';

interface BattleResult {
  attackerKills: number;
  defenderKills: number;
  messages: string[];
}

export class BattleSystem {
  private map: HexCell[][];
  private mapSize: number;

  constructor(map: HexCell[][], mapSize: number) {
    this.map = map;
    this.mapSize = mapSize;
  }

  private getCell(coord: HexCoord): HexCell | null {
    return getCellFromMap(this.map, coord, this.mapSize);
  }

  private getTerritoryOwner(coord: HexCoord): string | null {
    const cell = this.getCell(coord);
    if (!cell) return null;

    let maxPlayer: string | null = null;
    let maxValue = 0.1;

    for (const [playerId, value] of Object.entries(cell.territoryMarkers)) {
      if (value > maxValue) {
        maxValue = value;
        maxPlayer = playerId;
      }
    }

    return maxPlayer;
  }

  resolveBattle(
    attackers: Ant[],
    defenders: Ant[],
    position: HexCoord
  ): BattleResult {
    const result: BattleResult = {
      attackerKills: 0,
      defenderKills: 0,
      messages: []
    };

    if (attackers.length === 0 || defenders.length === 0) {
      return result;
    }

    const attackerPlayerId = attackers[0].playerId;
    const defenderPlayerId = defenders[0].playerId;

    const territoryOwner = this.getTerritoryOwner(position);
    const defenderIsOnOwnTerritory = territoryOwner === defenderPlayerId;
    const attackerIsOnOwnTerritory = territoryOwner === attackerPlayerId;

    const siegeBonus = this.calculateSiegeBonus(attackers, position);

    let attackerTotalAttack = 0;
    let defenderTotalAttack = 0;

    for (const ant of attackers) {
      let attack = ant.attack;
      if (defenders.some(d => d.type === 'worker' && d.hp > 0)) {
        attack *= BATTLE_WORKER_DAMAGE_MULTIPLIER;
      }
      if (siegeBonus > 0) {
        attack *= (1 + siegeBonus);
      }
      if (attackerIsOnOwnTerritory) {
        attack *= (1 + BATTLE_TERRITORY_DEFENSE_BONUS);
      }
      attackerTotalAttack += attack;
    }

    const numAdvantage = Math.min(
      attackers.length / Math.max(defenders.length, 1),
      BATTLE_NUM_ADVANTAGE_MAX
    );
    attackerTotalAttack *= numAdvantage;

    for (const ant of defenders) {
      let attack = ant.attack;
      if (attackers.some(a => a.type === 'worker' && a.hp > 0)) {
        attack *= BATTLE_WORKER_DAMAGE_MULTIPLIER;
      }
      if (defenderIsOnOwnTerritory) {
        attack *= (1 + BATTLE_TERRITORY_DEFENSE_BONUS);
      }
      defenderTotalAttack += attack;
    }

    const defenderNumAdvantage = Math.min(
      defenders.length / Math.max(attackers.length, 1),
      BATTLE_NUM_ADVANTAGE_MAX
    );
    defenderTotalAttack *= defenderNumAdvantage;

    result.attackerKills = this.distributeDamage(defenders, attackerTotalAttack);
    result.defenderKills = this.distributeDamage(attackers, defenderTotalAttack);

    if (result.attackerKills > 0 || result.defenderKills > 0) {
      result.messages.push(
        `在 (${position.q},${position.r}) 发生战斗: 攻击方击杀 ${result.attackerKills}，防守方击杀 ${result.defenderKills}`
      );
    }

    return result;
  }

  private calculateSiegeBonus(attackers: Ant[], position: HexCoord): number {
    const soldierAttackers = attackers.filter(a => a.type === 'soldier' && a.hp > 0);
    if (soldierAttackers.length < BATTLE_SIEGE_DIRECTIONS) return 0;

    const neighbors = hexNeighbors(position);
    const occupiedDirections = new Set<number>();

    for (let i = 0; i < neighbors.length; i++) {
      const neighbor = neighbors[i];
      const hasSoldier = soldierAttackers.some(
        a => a.position.q === neighbor.q && a.position.r === neighbor.r
      );
      if (hasSoldier) {
        occupiedDirections.add(i);
      }
    }

    if (occupiedDirections.size >= BATTLE_SIEGE_DIRECTIONS) {
      return BATTLE_SIEGE_BONUS;
    }

    return 0;
  }

  private distributeDamage(ants: Ant[], totalDamage: number): number {
    let kills = 0;
    let remainingDamage = totalDamage;

    const sortedAnts = [...ants].sort((a, b) => {
      const aIsWorker = a.type === 'worker' ? 0 : 1;
      const bIsWorker = b.type === 'worker' ? 0 : 1;
      if (aIsWorker !== bIsWorker) return aIsWorker - bIsWorker;
      return a.hp - b.hp;
    });

    for (const ant of sortedAnts) {
      if (ant.hp <= 0) continue;
      if (remainingDamage <= 0) break;

      const damage = Math.min(ant.hp, remainingDamage);
      ant.hp -= damage;
      remainingDamage -= damage;

      if (ant.hp <= 0) {
        kills++;
      }
    }

    return kills;
  }

  resolveAllBattles(players: Player[]): { messages: string[]; killCounts: Record<string, number>; battleDetails: BattleEventRecord[] } {
    const messages: string[] = [];
    const killCounts: Record<string, number> = {};
    const battleDetails: BattleEventRecord[] = [];

    for (const player of players) {
      killCounts[player.id] = 0;
    }

    const positionMap = new Map<string, Ant[]>();

    for (const player of players) {
      if (player.isEliminated) continue;
      for (const ant of player.ants) {
        if (ant.hp <= 0) continue;
        const key = `${ant.position.q},${ant.position.r}`;
        if (!positionMap.has(key)) {
          positionMap.set(key, []);
        }
        positionMap.get(key)!.push(ant);
      }
    }

    const processedPairs = new Set<string>();

    for (const [posKey, ants] of positionMap) {
      const playerGroups = new Map<string, Ant[]>();
      for (const ant of ants) {
        if (!playerGroups.has(ant.playerId)) {
          playerGroups.set(ant.playerId, []);
        }
        playerGroups.get(ant.playerId)!.push(ant);
      }

      const playerIds = Array.from(playerGroups.keys());
      if (playerIds.length < 2) continue;

      for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
          const pairKey = `${playerIds[i]}_${playerIds[j]}_${posKey}`;
          if (processedPairs.has(pairKey)) continue;
          processedPairs.add(pairKey);

          const [q, r] = posKey.split(',').map(Number);
          const position: HexCoord = { q, r };

          const attackers = playerGroups.get(playerIds[i])!;
          const defenders = playerGroups.get(playerIds[j])!;

          const hasCombatants = (ants: Ant[]) => ants.some(a => a.attack > 0);
          if (!hasCombatants(attackers) && !hasCombatants(defenders)) continue;

          const result = this.resolveBattle(attackers, defenders, position);

          killCounts[playerIds[i]] += result.attackerKills;
          killCounts[playerIds[j]] += result.defenderKills;

          messages.push(...result.messages);

          battleDetails.push({
            attackerId: playerIds[i],
            defenderId: playerIds[j],
            attackerAntCount: attackers.length,
            defenderAntCount: defenders.length,
            attackerKills: result.attackerKills,
            defenderKills: result.defenderKills,
            position
          });
        }
      }
    }

    return { messages, killCounts, battleDetails };
  }

  attackNest(attackers: Ant[], player: Player): { damage: number; canAttack: boolean } {
    const soldierCount = attackers.filter(
      a => a.type === 'soldier' && a.hp > 0
    ).length;

    if (soldierCount < NEST_ATTACK_MIN_SOLDIERS) {
      return { damage: 0, canAttack: false };
    }

    let totalAttack = 0;
    for (const ant of attackers) {
      if (ant.type === 'soldier' && ant.hp > 0) {
        totalAttack += ant.attack;
      }
    }

    const damage = Math.floor(totalAttack);
    player.nestHp -= damage;

    return { damage, canAttack: true };
  }

  resolvePredatorCombat(predator: Predator, players: Player[]): { messages: string[]; predatorKilled: boolean } {
    const messages: string[] = [];
    let predatorKilled = false;

    const nearbyAnts: Ant[] = [];
    const neighbors = hexNeighbors(predator.position);
    const allPositions = [predator.position, ...neighbors];

    for (const player of players) {
      if (player.isEliminated) continue;
      for (const ant of player.ants) {
        if (ant.hp <= 0) continue;
        if (allPositions.some(p => p.q === ant.position.q && p.r === ant.position.r)) {
          nearbyAnts.push(ant);
        }
      }
    }

    if (nearbyAnts.length === 0) {
      return { messages, predatorKilled: false };
    }

    let totalPlayerDamage = 0;
    for (const ant of nearbyAnts) {
      if (ant.type === 'soldier') {
        totalPlayerDamage += ant.attack;
      }
    }

    predator.hp -= totalPlayerDamage;

    if (predator.hp <= 0) {
      predatorKilled = true;
      messages.push(`天敌甲虫被击败！掉落 ${predator.foodDrop} 食物`);
      return { messages, predatorKilled: true };
    }

    const sortedAnts = [...nearbyAnts].sort((a, b) => b.hp - a.hp);
    let remainingDamage = predator.attack;
    let kills = 0;

    for (const ant of sortedAnts) {
      if (remainingDamage <= 0) break;
      const damage = Math.min(ant.hp, remainingDamage);
      ant.hp -= damage;
      remainingDamage -= damage;
      if (ant.hp <= 0) kills++;
    }

    messages.push(`天敌甲虫发动攻击，击杀 ${kills} 只蚂蚁`);

    return { messages, predatorKilled: false };
  }

  movePredator(predator: Predator, players: Player[]): HexCoord | null {
    let nearestAnt: Ant | null = null;
    let nearestDist = Infinity;

    for (const player of players) {
      if (player.isEliminated) continue;
      for (const ant of player.ants) {
        if (ant.hp <= 0) continue;
        const dist = hexDistance(predator.position, ant.position);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestAnt = ant;
        }
      }
    }

    if (!nearestAnt || nearestDist <= 1) {
      return null;
    }

    const neighbors = hexNeighbors(predator.position);
    let bestMove: HexCoord | null = null;
    let bestDist = nearestDist;

    for (const neighbor of neighbors) {
      const cell = this.getCell(neighbor);
      if (!cell || cell.terrain === 'rock' || cell.terrain === 'water') continue;

      const dist = hexDistance(neighbor, nearestAnt.position);
      if (dist < bestDist) {
        bestDist = dist;
        bestMove = neighbor;
      }
    }

    return bestMove;
  }
}
