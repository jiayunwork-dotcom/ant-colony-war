<template>
  <div class="lobby">
    <div class="lobby-container">
      <div class="lobby-header">
        <h1 class="game-title">
          <span class="title-icon">🐜</span>
          蚁群战争
          <span class="title-sub">Ant Colony War</span>
        </h1>
        <p class="game-desc">多人回合制策略游戏 · 控制你的蚁群 · 争夺资源和领地</p>
      </div>

      <div class="lobby-content">
        <div class="lobby-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'create' }"
            @click="activeTab = 'create'"
          >
            创建房间
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'join' }"
            @click="activeTab = 'join'"
          >
            加入房间
          </button>
        </div>

        <div v-if="activeTab === 'create'" class="tab-content">
          <div class="form-group">
            <label class="form-label">你的名字</label>
            <input
              type="text"
              v-model="playerName"
              class="form-input"
              placeholder="输入你的名字"
              maxlength="12"
              @keyup.enter="createRoom"
            />
          </div>

          <div class="form-info">
            <p>游戏支持 4-6 名玩家</p>
            <p>创建房间后分享房间号给好友即可加入</p>
          </div>

          <button
            class="btn btn-primary btn-large"
            @click="createRoom"
            :disabled="!playerName.trim() || isCreating"
          >
            {{ isCreating ? '创建中...' : '创建房间' }}
          </button>
        </div>

        <div v-else class="tab-content">
          <div class="form-group">
            <label class="form-label">房间号</label>
            <input
              type="text"
              v-model="roomId"
              class="form-input"
              placeholder="输入房间号"
              maxlength="20"
            />
          </div>

          <div class="form-group">
            <label class="form-label">你的名字</label>
            <input
              type="text"
              v-model="joinPlayerName"
              class="form-input"
              placeholder="输入你的名字"
              maxlength="12"
              @keyup.enter="joinRoom"
            />
          </div>

          <button
            class="btn btn-success btn-large"
            @click="joinRoom"
            :disabled="!roomId.trim() || !joinPlayerName.trim() || isJoining"
          >
            {{ isJoining ? '加入中...' : '加入房间' }}
          </button>
        </div>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
      </div>

      <div class="game-rules">
        <h3 class="rules-title">🎮 游戏简介</h3>
        <div class="rules-grid">
          <div class="rule-item">
            <span class="rule-icon">🗺️</span>
            <span class="rule-text">六角格地图</span>
          </div>
          <div class="rule-item">
            <span class="rule-icon">🐜</span>
            <span class="rule-text">多种蚂蚁</span>
          </div>
          <div class="rule-item">
            <span class="rule-icon">⚔️</span>
            <span class="rule-text">回合制战斗</span>
          </div>
          <div class="rule-item">
            <span class="rule-icon">🧬</span>
            <span class="rule-text">进化系统</span>
          </div>
          <div class="rule-item">
            <span class="rule-icon">🌊</span>
            <span class="rule-text">随机事件</span>
          </div>
          <div class="rule-item">
            <span class="rule-icon">🏆</span>
            <span class="rule-text">领地争夺</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  (e: 'roomCreated', gameId: string, playerId: string): void
  (e: 'roomJoined', gameId: string, playerId: string): void
  (e: 'error', message: string): void
}>()

const props = defineProps<{
  onCreateRoom: (name: string) => Promise<{ success: boolean; error?: string; gameId?: string; playerId?: string }>
  onJoinRoom: (roomId: string, name: string) => Promise<{ success: boolean; error?: string; gameId?: string; playerId?: string }>
}>()

const activeTab = ref<'create' | 'join'>('create')
const playerName = ref('')
const joinPlayerName = ref('')
const roomId = ref('')
const isCreating = ref(false)
const isJoining = ref(false)
const errorMessage = ref('')

async function createRoom() {
  if (!playerName.value.trim()) return

  isCreating.value = true
  errorMessage.value = ''

  try {
    const result = await props.onCreateRoom(playerName.value.trim())
    if (result.success && result.gameId && result.playerId) {
      emit('roomCreated', result.gameId, result.playerId)
    } else {
      errorMessage.value = result.error || '创建房间失败'
    }
  } catch (e) {
    errorMessage.value = '创建房间时出错'
  } finally {
    isCreating.value = false
  }
}

async function joinRoom() {
  if (!roomId.value.trim() || !joinPlayerName.value.trim()) return

  isJoining.value = true
  errorMessage.value = ''

  try {
    const result = await props.onJoinRoom(roomId.value.trim(), joinPlayerName.value.trim())
    if (result.success && result.gameId && result.playerId) {
      emit('roomJoined', result.gameId, result.playerId)
    } else {
      errorMessage.value = result.error || '加入房间失败'
    }
  } catch (e) {
    errorMessage.value = '加入房间时出错'
  } finally {
    isJoining.value = false
  }
}
</script>

<style scoped>
.lobby {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  position: relative;
  overflow: hidden;
}

.lobby::before {
  content: '';
  position: absolute;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(233, 69, 96, 0.15) 0%, transparent 70%);
  top: -200px;
  right: -200px;
  pointer-events: none;
}

.lobby::after {
  content: '';
  position: absolute;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(78, 205, 196, 0.1) 0%, transparent 70%);
  bottom: -150px;
  left: -150px;
  pointer-events: none;
}

.lobby-container {
  position: relative;
  z-index: 1;
  width: 420px;
  max-width: 90%;
}

.lobby-header {
  text-align: center;
  margin-bottom: 30px;
}

.game-title {
  font-size: 42px;
  font-weight: 800;
  color: #e94560;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.title-icon {
  font-size: 48px;
}

.title-sub {
  display: block;
  font-size: 16px;
  font-weight: 400;
  color: #4ecdc4;
  letter-spacing: 3px;
  margin-top: 4px;
}

.game-desc {
  font-size: 14px;
  color: #888;
  margin-top: 12px;
}

.lobby-content {
  background: rgba(0, 0, 0, 0.4);
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.lobby-tabs {
  display: flex;
  margin-bottom: 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 4px;
}

.tab-btn {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  color: #888;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: #e94560;
  color: #fff;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  color: #aaa;
  font-weight: 500;
}

.form-input {
  padding: 12px 16px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.3);
  color: #e0e0e0;
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  border-color: #4ecdc4;
}

.form-input::placeholder {
  color: #555;
}

.form-info {
  padding: 12px;
  background: rgba(78, 205, 196, 0.05);
  border-radius: 8px;
  font-size: 12px;
  color: #888;
  line-height: 1.6;
}

.form-info p {
  margin: 0;
}

.btn-large {
  width: 100%;
  padding: 14px;
  font-size: 16px;
  font-weight: 600;
}

.error-message {
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(233, 69, 96, 0.1);
  border: 1px solid rgba(233, 69, 96, 0.3);
  border-radius: 8px;
  color: #ff8a8a;
  font-size: 13px;
  text-align: center;
}

.game-rules {
  margin-top: 30px;
  padding: 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.rules-title {
  font-size: 14px;
  color: #4ecdc4;
  margin-bottom: 14px;
  text-align: center;
}

.rules-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.rule-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.rule-icon {
  font-size: 24px;
}

.rule-text {
  font-size: 12px;
  color: #aaa;
}
</style>
