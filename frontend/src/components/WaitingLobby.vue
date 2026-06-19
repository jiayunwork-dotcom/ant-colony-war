<template>
  <div class="waiting-lobby">
    <div class="waiting-container">
      <div class="waiting-header">
        <h2 class="waiting-title">🐜 等待大厅</h2>
        <div class="room-info-bar">
          <span class="room-id-label">房间号</span>
          <span class="room-id-value">{{ gameId }}</span>
        </div>
      </div>

      <div class="players-section">
        <div class="section-header">
          <h3 class="section-title">玩家列表</h3>
          <span class="player-count">{{ players.length }}/6</span>
        </div>

        <div class="players-list">
          <div
            v-for="player in players"
            :key="player.id"
            class="player-card"
            :class="{ 'is-self': player.id === playerId, 'is-host': player.id === hostId, 'is-ai': isAIPlayer(player.id) }"
          >
            <div class="player-identity">
              <div class="player-color-dot" :style="{ background: player.color }"></div>
              <span class="player-name">{{ player.name }}</span>
              <span v-if="player.id === hostId" class="host-badge">房主</span>
              <span v-if="player.id === playerId" class="self-badge">你</span>
              <span v-if="isAIPlayer(player.id)" class="ai-badge">🤖 AI</span>
            </div>
            <div class="player-actions">
              <div class="player-ready-status" :class="{ ready: player.lobbyReady }">
                {{ player.lobbyReady ? '已准备' : '未准备' }}
              </div>
              <button
                v-if="isHost && isAIPlayer(player.id)"
                class="btn-remove-ai"
                @click="handleRemoveAIClick(player.id)"
                title="移除AI"
                type="button"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="isHost && players.length < 6" class="ai-section">
        <div class="ai-controls">
          <select v-model="selectedDifficulty" class="ai-difficulty-select">
            <option value="easy">简单 AI</option>
            <option value="normal">普通 AI</option>
            <option value="hard">困难 AI</option>
          </select>
          <button
            class="btn btn-add-ai"
            @click="handleAddAIClick"
            :disabled="players.length >= 6"
          >
            ➕ 添加AI
          </button>
        </div>
      </div>

      <div class="ready-info" v-if="players.length < 4">
        <span class="info-icon">ℹ️</span>
        <span>需要至少 4 名玩家才能开始游戏（当前 {{ players.length }} 人）</span>
      </div>

      <div class="ready-info warning" v-else-if="!allReady">
        <span class="info-icon">⏳</span>
        <span>等待所有玩家准备（{{ readyCount }}/{{ players.length }} 已准备）</span>
      </div>

      <div class="ready-info success" v-else>
        <span class="info-icon">✅</span>
        <span>所有人已准备，房主可以开始游戏！</span>
      </div>

      <div class="action-bar">
        <button
          v-if="!isCurrentPlayerAI"
          class="btn btn-ready"
          :class="{ 'is-ready': currentPlayer?.lobbyReady }"
          @click="$emit('toggleReady')"
        >
          {{ currentPlayer?.lobbyReady ? '取消准备' : '准备' }}
        </button>

        <button
          v-if="isHost"
          class="btn btn-start"
          :disabled="!canStart"
          @click="$emit('startGame')"
        >
          开始游戏
        </button>

        <button
          class="btn btn-leave"
          @click="$emit('leaveRoom')"
        >
          离开房间
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Player, AIDifficulty } from '@shared/types'

const props = defineProps<{
  gameId: string
  playerId: string
  hostId: string
  players: Player[]
  isHost: boolean
  aiPlayerIds: string[]
}>()

const emit = defineEmits<{
  (e: 'toggleReady'): void
  (e: 'startGame'): void
  (e: 'leaveRoom'): void
  (e: 'add-ai', difficulty: AIDifficulty): void
  (e: 'remove-ai', playerId: string): void
}>()

const selectedDifficulty = ref<AIDifficulty>('normal')

const currentPlayer = computed(() => {
  return props.players.find(p => p.id === props.playerId) || null
})

const readyCount = computed(() => {
  return props.players.filter(p => p.lobbyReady).length
})

const allReady = computed(() => {
  return props.players.length > 0 && props.players.every(p => p.lobbyReady)
})

const canStart = computed(() => {
  return props.isHost && props.players.length >= 4 && allReady.value
})

const isCurrentPlayerAI = computed(() => {
  return props.aiPlayerIds.includes(props.playerId)
})

function isAIPlayer(playerId: string): boolean {
  return props.aiPlayerIds.includes(playerId)
}

function handleAddAIClick() {
  console.log('[WaitingLobby] handleAddAIClick called, difficulty:', selectedDifficulty.value)
  emit('add-ai', selectedDifficulty.value)
}

function handleRemoveAIClick(playerId: string) {
  console.log('[WaitingLobby] handleRemoveAIClick called, playerId:', playerId)
  emit('remove-ai', playerId)
}
</script>

<style scoped>
.waiting-lobby {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  position: relative;
  overflow: hidden;
}

.waiting-lobby::before {
  content: '';
  position: absolute;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(78, 205, 196, 0.12) 0%, transparent 70%);
  top: -150px;
  left: -150px;
  pointer-events: none;
}

.waiting-container {
  position: relative;
  z-index: 1;
  width: 480px;
  max-width: 90%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.waiting-header {
  text-align: center;
}

.waiting-title {
  font-size: 32px;
  font-weight: 800;
  color: #4ecdc4;
  margin-bottom: 12px;
}

.room-info-bar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.room-id-label {
  font-size: 12px;
  color: #888;
}

.room-id-value {
  font-size: 14px;
  font-weight: 700;
  color: #e0e0e0;
  font-family: monospace;
  letter-spacing: 1px;
}

.players-section {
  background: rgba(0, 0, 0, 0.4);
  border-radius: 16px;
  padding: 20px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.section-title {
  font-size: 14px;
  color: #aaa;
  margin: 0;
}

.player-count {
  font-size: 14px;
  font-weight: 700;
  color: #4ecdc4;
}

.players-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.player-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.2s ease;
}

.player-card.is-self {
  border-color: rgba(78, 205, 196, 0.3);
  background: rgba(78, 205, 196, 0.06);
}

.player-card.is-host {
  border-left: 3px solid #e94560;
}

.player-card.is-ai {
  background: rgba(155, 135, 245, 0.06);
  border-color: rgba(155, 135, 245, 0.2);
}

.player-identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.player-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.player-name {
  font-size: 15px;
  font-weight: 500;
  color: #e0e0e0;
}

.host-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(233, 69, 96, 0.2);
  color: #e94560;
  font-weight: 600;
}

.self-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(78, 205, 196, 0.2);
  color: #4ecdc4;
  font-weight: 600;
}

.ai-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(155, 135, 245, 0.2);
  color: #9b87f5;
  font-weight: 600;
}

.player-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-remove-ai {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: rgba(233, 69, 96, 0.2);
  color: #e94560;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  padding: 0;
  line-height: 1;
}

.btn-remove-ai:hover {
  background: rgba(233, 69, 96, 0.4);
}

.player-ready-status {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  color: #888;
  transition: all 0.2s ease;
}

.player-ready-status.ready {
  background: rgba(78, 205, 196, 0.15);
  color: #4ecdc4;
  font-weight: 600;
}

.ready-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 13px;
  color: #aaa;
}

.ready-info.warning {
  background: rgba(255, 217, 61, 0.08);
  color: #ffd93d;
}

.ready-info.success {
  background: rgba(78, 205, 196, 0.1);
  color: #4ecdc4;
}

.info-icon {
  font-size: 16px;
}

.ai-section {
  background: rgba(155, 135, 245, 0.08);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(155, 135, 245, 0.2);
}

.ai-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.ai-difficulty-select {
  flex: 1;
  padding: 10px 14px;
  border: 2px solid rgba(155, 135, 245, 0.3);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.3);
  color: #e0e0e0;
  font-size: 14px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.ai-difficulty-select:focus {
  border-color: #9b87f5;
}

.ai-difficulty-select option {
  background: #1a1a2e;
  color: #e0e0e0;
}

.btn-add-ai {
  padding: 10px 20px;
  background: rgba(155, 135, 245, 0.2);
  color: #9b87f5;
  border: 2px solid rgba(155, 135, 245, 0.3);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-add-ai:hover:not(:disabled) {
  background: rgba(155, 135, 245, 0.3);
  border-color: #9b87f5;
}

.btn-add-ai:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-bar {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-ready {
  flex: 1;
  background: rgba(78, 205, 196, 0.15);
  color: #4ecdc4;
  border: 2px solid rgba(78, 205, 196, 0.3);
}

.btn-ready:hover {
  background: rgba(78, 205, 196, 0.25);
}

.btn-ready.is-ready {
  background: rgba(233, 69, 96, 0.15);
  color: #e94560;
  border-color: rgba(233, 69, 96, 0.3);
}

.btn-ready.is-ready:hover {
  background: rgba(233, 69, 96, 0.25);
}

.btn-start {
  flex: 1;
  background: #4ecdc4;
  color: #1a1a2e;
}

.btn-start:hover:not(:disabled) {
  background: #3dbdb5;
  transform: translateY(-1px);
}

.btn-start:disabled {
  background: rgba(255, 255, 255, 0.1);
  color: #555;
  cursor: not-allowed;
}

.btn-leave {
  background: rgba(255, 255, 255, 0.06);
  color: #888;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-leave:hover {
  background: rgba(233, 69, 96, 0.1);
  color: #e94560;
  border-color: rgba(233, 69, 96, 0.3);
}
</style>
