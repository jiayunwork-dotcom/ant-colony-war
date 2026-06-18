<template>
  <div class="top-bar">
    <div class="game-info">
      <div class="turn-info">
        <span class="label">回合</span>
        <span class="value">{{ turn }} / {{ maxTurns }}</span>
      </div>
      <div class="phase-info" :class="phase">
        <span class="phase-icon">{{ phaseIcon }}</span>
        <span class="phase-text">{{ phaseText }}</span>
      </div>
      <div v-if="phase === 'command'" class="timer" :class="{ warning: timeRemaining <= 10 }">
        <span class="timer-icon">⏱</span>
        <span class="timer-value">{{ timeRemaining }}s</span>
      </div>
    </div>

    <div class="players-bar">
      <div
        v-for="player in players"
        :key="player.id"
        class="player-chip"
        :class="{
          'is-current': player.id === currentPlayerId,
          'is-eliminated': player.isEliminated,
          'is-ready': player.isReady
        }"
        :style="{ '--player-color': player.color }"
      >
        <div class="player-dot"></div>
        <span class="player-name">{{ player.name }}</span>
        <span v-if="player.isReady && phase === 'command'" class="ready-mark">✓</span>
        <span v-if="player.isEliminated" class="eliminated-mark">☠</span>
        <div v-if="!player.isEliminated" class="player-score">
          <span class="score-label">分</span>
          <span class="score-value">{{ getPlayerScore(player) }}</span>
        </div>
      </div>
    </div>

    <div class="top-actions">
      <button v-if="isHost && phase === 'waiting'" class="btn btn-primary" @click="$emit('startGame')">
        开始游戏
      </button>
      <button v-if="phase === 'command' && isMyTurn" class="btn btn-success" @click="$emit('ready')">
        结束回合
      </button>
      <span v-if="phase === 'ended'" class="game-ended-text">游戏结束</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Player } from '@shared/types'

const props = defineProps<{
  turn: number
  maxTurns: number
  phase: string
  timeRemaining: number
  players: Player[]
  currentPlayerId: string
  isHost: boolean
  isMyTurn: boolean
}>()

defineEmits<{
  (e: 'startGame'): void
  (e: 'ready'): void
}>()

const phaseText = computed(() => {
  switch (props.phase) {
    case 'waiting': return '等待玩家'
    case 'command': return '命令阶段'
    case 'settling': return '结算中...'
    case 'result': return '结果展示'
    case 'ended': return '游戏结束'
    default: return props.phase
  }
})

const phaseIcon = computed(() => {
  switch (props.phase) {
    case 'waiting': return '👥'
    case 'command': return '🎯'
    case 'settling': return '⚙️'
    case 'result': return '📊'
    case 'ended': return '🏆'
    default: return '❓'
  }
})

function getPlayerScore(player: Player): number {
  return 0
}
</script>

<style scoped>
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: linear-gradient(180deg, #16213e 0%, #0f3460 100%);
  border-bottom: 2px solid #e94560;
  gap: 20px;
}

.game-info {
  display: flex;
  align-items: center;
  gap: 24px;
}

.turn-info {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.turn-info .label {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
}

.turn-info .value {
  font-size: 20px;
  font-weight: bold;
  color: #e94560;
}

.phase-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 20px;
  background: rgba(255,255,255,0.1);
}

.phase-icon {
  font-size: 18px;
}

.phase-text {
  font-size: 14px;
  font-weight: 600;
}

.phase-info.command {
  background: rgba(78, 205, 196, 0.2);
  color: #4ecdc4;
}

.phase-info.settling {
  background: rgba(255, 217, 61, 0.2);
  color: #ffd93d;
  animation: pulse 1s infinite;
}

.phase-info.ended {
  background: rgba(233, 69, 96, 0.2);
  color: #e94560;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.timer {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 18px;
  font-weight: bold;
  color: #4ecdc4;
}

.timer.warning {
  color: #e94560;
  animation: timerWarning 0.5s infinite alternate;
}

@keyframes timerWarning {
  from { transform: scale(1); }
  to { transform: scale(1.1); }
}

.timer-icon {
  font-size: 16px;
}

.players-bar {
  display: flex;
  gap: 10px;
  flex: 1;
  justify-content: center;
  flex-wrap: wrap;
}

.player-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 20px;
  background: rgba(0,0,0,0.3);
  border: 2px solid var(--player-color);
  transition: all 0.2s ease;
}

.player-chip.is-current {
  box-shadow: 0 0 10px var(--player-color);
}

.player-chip.is-eliminated {
  opacity: 0.4;
  filter: grayscale(0.8);
}

.player-chip.is-ready {
  border-color: #4ecdc4;
}

.player-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--player-color);
}

.player-name {
  font-size: 13px;
  font-weight: 500;
}

.ready-mark {
  color: #4ecdc4;
  font-size: 14px;
  font-weight: bold;
}

.eliminated-mark {
  color: #e94560;
  font-size: 14px;
}

.player-score {
  display: flex;
  align-items: baseline;
  gap: 3px;
  margin-left: 8px;
  padding-left: 8px;
  border-left: 1px solid rgba(255,255,255,0.2);
}

.score-label {
  font-size: 10px;
  color: #888;
}

.score-value {
  font-size: 14px;
  font-weight: bold;
  color: var(--player-color);
}

.top-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.game-ended-text {
  font-size: 18px;
  font-weight: bold;
  color: #e94560;
}
</style>
