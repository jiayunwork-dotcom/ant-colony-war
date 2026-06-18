import { v4 as uuidv4 } from 'uuid';
import { GameEvent, EventType, Player, HexCoord, HexCell, Predator } from '../../../shared/types';
import {
  EVENT_INTERVAL,
  EVENT_WARNING_TURNS,
  PREDATOR_STATS,
  RAIN_DURATION,
  RAIN_DAMAGE,
  FOOD_SPAWN_AMOUNT
} from '../../../shared/constants';
import { hexRange, hexDistance } from '../../../shared/utils/hex';

export class EventSystem {
  private map: HexCell[][];
  private offset: number;
  private mapSize: number;

  constructor(map: HexCell[][], mapSize: number) {
    this.map = map;
    this.mapSize = mapSize;
    this.offset = Math.floor(mapSize / 2);
  }

  private getCell(coord: HexCoord): HexCell | null {
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

  generateNextEvent(center?: HexCoord): GameEvent {
    const eventTypes: EventType[] = ['rain', 'predator', 'food_bloom', 'plague'];
    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    const event: GameEvent = {
      type,
      turnsRemaining: EVENT_WARNING_TURNS
    };

    if (type === 'rain' || type === 'predator' || type === 'food_bloom') {
      if (center) {
        event.center = { ...center };
      } else {
        event.center = this.getRandomCenter();
      }
      event.radius = 4 + Math.floor(Math.random() * 4);
    }

    if (type === 'plague') {
      event.affectedPlayer = undefined;
    }

    return event;
  }

  private getRandomCenter(): HexCoord {
    const halfSize = Math.floor(this.mapSize / 2) - 5;
    return {
      q: Math.floor(Math.random() * halfSize * 2) - halfSize,
      r: Math.floor(Math.random() * halfSize * 2) - halfSize
    };
  }

  shouldTriggerEvent(turn: number): boolean {
    return turn > 0 && turn % EVENT_INTERVAL === 0;
  }

  activateEvent(event: GameEvent, players: Player[]): {
    messages: string[];
    predator?: Predator;
    affectedPlayer?: string;
  } {
    const messages: string[] = [];

    switch (event.type) {
      case 'rain':
        messages.push(...this.activateRain(event));
        break;
      case 'predator':
        const predator = this.activatePredator(event);
        messages.push('天敌入侵！一只强力甲虫出现在地图中央附近');
        return { messages, predator };
      case 'food_bloom':
        const spawned = this.activateFoodBloom(event);
        messages.push(`食物爆发！${spawned} 个新食物源出现在地图上`);
        break;
      case 'plague':
        const affected = this.activatePlague(players);
        if (affected) {
          messages.push(`瘟疫爆发！玩家 ${affected.name} 的蚁巢中所有蚂蚁生命值减半`);
          return { messages, affectedPlayer: affected.id };
        }
        break;
    }

    return { messages };
  }

  private activateRain(event: GameEvent): string[] {
    const messages: string[] = [];
    if (!event.center || !event.radius) return messages;

    const area = hexRange(event.center, event.radius);
    let affectedCount = 0;

    for (const coord of area) {
      const cell = this.getCell(coord);
      if (cell && cell.terrain === 'ground') {
        cell.temporaryWater = RAIN_DURATION;
        affectedCount++;
      }
    }

    messages.push(`暴雨来袭！${affectedCount} 个格子被淹没，持续 ${RAIN_DURATION} 回合`);
    return messages;
  }

  private activatePredator(event: GameEvent): Predator {
    const position = event.center || { q: 0, r: 0 };
    return {
      id: uuidv4(),
      position,
      hp: PREDATOR_STATS.hp,
      maxHp: PREDATOR_STATS.hp,
      attack: PREDATOR_STATS.attack,
      foodDrop: PREDATOR_STATS.foodDrop
    };
  }

  private activateFoodBloom(event: GameEvent): number {
    if (!event.center || !event.radius) return 0;

    const area = hexRange(event.center, event.radius);
    let spawned = 0;

    const shuffled = [...area].sort(() => Math.random() - 0.5);

    for (const coord of shuffled) {
      if (spawned >= FOOD_SPAWN_AMOUNT) break;
      const cell = this.getCell(coord);
      if (cell && cell.terrain === 'ground' && !cell.foodSource) {
        const amount = 30 + Math.floor(Math.random() * 20);
        cell.foodSource = { amount, maxAmount: 50 };
        cell.terrain = 'food';
        spawned++;
      }
    }

    return spawned;
  }

  private activatePlague(players: Player[]): Player | null {
    const alivePlayers = players.filter(p => !p.isEliminated);
    if (alivePlayers.length === 0) return null;

    const targetPlayer = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];

    for (const ant of targetPlayer.ants) {
      if (ant.hp > 0) {
        const dist = hexDistance(ant.position, targetPlayer.nestPosition);
        if (dist <= 5) {
          ant.hp = Math.floor(ant.hp / 2);
          if (ant.hp < 1) ant.hp = 1;
        }
      }
    }

    return targetPlayer;
  }

  processOngoingEvents(
    currentEvent: GameEvent | null,
    players: Player[]
  ): { messages: string[]; eventEnded: boolean } {
    const messages: string[] = [];
    let eventEnded = false;

    if (!currentEvent || currentEvent.turnsRemaining <= 0) {
      eventEnded = true;
      return { messages, eventEnded };
    }

    if (currentEvent.type === 'rain') {
      messages.push(...this.processRainDamage(players));
      this.decayTemporaryWater();
    }

    return { messages, eventEnded };
  }

  private processRainDamage(players: Player[]): string[] {
    const messages: string[] = [];
    let totalDamage = 0;
    let totalKills = 0;

    for (const player of players) {
      if (player.isEliminated) continue;
      for (const ant of player.ants) {
        if (ant.hp <= 0) continue;
        const cell = this.getCell(ant.position);
        if (cell && cell.temporaryWater !== undefined && cell.temporaryWater > 0) {
          ant.hp -= RAIN_DAMAGE;
          totalDamage += RAIN_DAMAGE;
          if (ant.hp <= 0) {
            totalKills++;
          }
        }
      }
    }

    if (totalKills > 0) {
      messages.push(`暴雨造成 ${totalKills} 只蚂蚁死亡`);
    }

    return messages;
  }

  private decayTemporaryWater(): void {
    for (const row of this.map) {
      for (const cell of row) {
        if (cell.temporaryWater !== undefined) {
          cell.temporaryWater--;
          if (cell.temporaryWater <= 0) {
            cell.temporaryWater = undefined;
          }
        }
      }
    }
  }

  getWarningMessage(event: GameEvent): string {
    switch (event.type) {
      case 'rain':
        return '警告：预计下一回合将有暴雨来袭！';
      case 'predator':
        return '警告：检测到天敌甲虫活动迹象！';
      case 'food_bloom':
        return '警告：即将出现食物爆发事件！';
      case 'plague':
        return '警告：瘟疫即将爆发！';
      default:
        return '';
    }
  }
}

export class EvolutionSystem {
  chooseMutation(player: Player, mutation: string): boolean {
    if (player.mutation !== null) return false;
    if (player.facilities.lab.level === 0) return false;

    player.mutation = mutation as any;
    this.applyMutationEffects(player);

    return true;
  }

  private applyMutationEffects(player: Player): void {
    for (const ant of player.ants) {
      if (ant.hp <= 0) continue;

      switch (player.mutation) {
        case 'speed':
          ant.moveSpeed += 1;
          ant.movePoints += 1;
          break;
        case 'strength':
          if (ant.type === 'soldier') {
            const oldAttack = ant.attack;
            ant.attack = Math.floor(oldAttack * 1.3);
          }
          break;
        case 'resistance':
          const oldMaxHp = ant.maxHp;
          ant.maxHp = Math.floor(oldMaxHp * 1.2);
          ant.hp = Math.floor(ant.hp * 1.2);
          break;
      }
    }
  }

  getMutations(): { type: string; name: string; description: string }[] {
    return [
      { type: 'speed', name: '速度突变', description: '所有蚂蚁移动力+1' },
      { type: 'strength', name: '力量突变', description: '兵蚁攻击力+30%' },
      { type: 'resistance', name: '抗性突变', description: '所有蚂蚁生命值+20%' },
      { type: 'breeding', name: '繁殖突变', description: '孵化室每回合额外+1产量' }
    ];
  }
}
