<template>
  <div class="game-over-overlay" v-if="show">
    <div class="game-over-modal">
      <div class="modal-header">
        <h2 class="modal-title">🏆 游戏结束</h2>
      </div>

      <div class="modal-body">
        <div class="winner-section" v-if="winner">
          <div class="winner-crown">👑</div>
          <div class="winner-name" :style="{ color: winner.color }">{{ winner.name }}</div>
          <div class="winner-title">胜利者</div>
        </div>

        <div class="scoreboard">
          <h3 class="scoreboard-title">最终排名</h3>
          <div class="score-list">
            <div
              v-for="(player, index) in rankedPlayers"
              :key="player.id"
              class="score-item"
              :class="{ 'is-winner': index === 0 }"
            >
              <span class="rank">{{ index + 1 }}</span>
              <span class="player-dot" :style="{ background: player.color }"></span>
              <span class="player-name">{{ player.name }}</span>
              <span class="player-score">{{ getTotalScore(player) }}</span>
            </div>
          </div>
        </div>

        <div class="score-details" v-if="currentPlayer">
          <h3 class="details-title">你的得分明细</h3>
          <div class="detail-list">
            <div class="detail-item">
              <span class="detail-label">领地格子数</span>
              <span class="detail-value">{{ getTerritoryCount(currentPlayer) }} × 2 = {{ getTerritoryCount(currentPlayer) * 2 }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">采集食物总量</span>
              <span class="detail-value">{{ currentPlayer.totalFoodCollected }} × 0.5 = {{ (currentPlayer.totalFoodCollected * 0.5).toFixed(1) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">击杀敌方蚂蚁</span>
              <span class="detail-value">{{ currentPlayer.totalKills }} × 3 = {{ currentPlayer.totalKills * 3 }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">存活蚂蚁数量</span>
              <span class="detail-value">{{ getSurvivorCount(currentPlayer) }} × 1 = {{ getSurvivorCount(currentPlayer) }}</span>
            </div>
            <div class="detail-item total">
              <span class="detail-label">总分</span>
              <span class="detail-value">{{ getTotalScore(currentPlayer) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-primary" @click="$emit('restart')">
          返回大厅
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Player } from '@shared/types'

const props = defineProps<{
  show: boolean
  players: Player[]
  winnerId: string | null
  currentPlayerId: string
}>()

defineEmits<{
  (e: 'restart'): void
}>()

const rankedPlayers = computed(() => {
  return [...props.players].sort((a, b) => getTotalScore(b) - getTotalScore(a))
})

const winner = computed(() => {
  if (!props.winnerId) return null
  return props.players.find(p => p.id === props.winnerId)
})

const currentPlayer = computed(() => {
  return props.players.find(p => p.id === props.currentPlayerId)
})

function getTotalScore(player: Player): number {
  const territory = getTerritoryCount(player) * 2
  const food = player.totalFoodCollected * 0.5
  const kills = player.totalKills * 3
  const survivors = getSurvivorCount(player) * 1
  return Math.floor(territory + food + kills + survivors)
}

function getTerritoryCount(_player: Player): number {
  return 0
}

function getSurvivorCount(player: Player): number {
  return player.ants.filter(a => a.hp > 0).length
}
</script>

<style scoped>
.game-over-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
}

.game-over-modal {
  background: linear-gradient(180deg, #16213e 0%, #0f3460 100%);
  border-radius: 16px;
  width: 480px;
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  border: 2px solid #e94560;
  box-shadow: 0 0 40px rgba(233, 69, 96, 0.3);
  animation: modalIn 0.3s ease;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.modal-title {
  font-size: 24px;
  color: #e94560;
  margin: 0;
}

.modal-body {
  padding: 24px;
}

.winner-section {
  text-align: center;
  margin-bottom: 24px;
  padding: 20px;
  background: linear-gradient(180deg, rgba(255, 217, 61, 0.1) 0%, transparent 100%);
  border-radius: 12px;
  border: 1px solid rgba(255, 217, 61, 0.3);
}

.winner-crown {
  font-size: 48px;
  margin-bottom: 8px;
}

.winner-name {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 4px;
}

.winner-title {
  font-size: 14px;
  color: #ffd93d;
  letter-spacing: 4px;
}

.scoreboard {
  margin-bottom: 24px;
}

.scoreboard-title {
  font-size: 16px;
  color: #4ecdc4;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(78, 205, 196, 0.3);
}

.score-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.score-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.score-item.is-winner {
  background: rgba(255, 217, 61, 0.15);
  border: 1px solid rgba(255, 217, 61, 0.4);
}

.rank {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  font-size: 13px;
  font-weight: bold;
}

.is-winner .rank {
  background: #ffd93d;
  color: #1a1a2e;
}

.player-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.player-name {
  flex: 1;
  font-size: 14px;
}

.player-score {
  font-size: 18px;
  font-weight: bold;
  color: #4ecdc4;
}

.score-details {
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.details-title {
  font-size: 14px;
  color: #aaa;
  margin-bottom: 12px;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  font-size: 13px;
}

.detail-item.total {
  background: rgba(78, 205, 196, 0.1);
  border: 1px solid rgba(78, 205, 196, 0.3);
  font-size: 15px;
  font-weight: bold;
}

.detail-label {
  color: #aaa;
}

.detail-value {
  color: #e0e0e0;
}

.detail-item.total .detail-value {
  color: #4ecdc4;
}

.modal-footer {
  padding: 20px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: center;
}

.btn-primary {
  min-width: 160px;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
}
</style>
