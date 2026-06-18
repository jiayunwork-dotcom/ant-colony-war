<template>
  <div class="control-panel">
    <div v-if="!player" class="no-player">
      未加入游戏
    </div>

    <template v-else>
      <div class="panel-section">
        <h3 class="section-title">📊 资源状态</h3>
        <div class="resource-list">
          <div class="resource-item">
            <span class="resource-icon">🍯</span>
            <span class="resource-name">食物</span>
            <span class="resource-value">{{ player.food }} / {{ player.maxFood }}</span>
            <div class="resource-bar-bg">
              <div class="resource-bar-fill food" :style="{ width: `${(player.food / player.maxFood) * 100}%` }"></div>
            </div>
          </div>
          <div class="resource-item">
            <span class="resource-icon">🏠</span>
            <span class="resource-name">蚁巢</span>
            <span class="resource-value">{{ player.nestHp }} / {{ player.nestMaxHp }}</span>
            <div class="resource-bar-bg">
              <div class="resource-bar-fill hp" :style="{ width: `${(player.nestHp / player.nestMaxHp) * 100}%` }"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel-section">
        <h3 class="section-title">🐜 蚂蚁单位</h3>
        <div class="ant-stats">
          <div class="ant-stat">
            <span class="ant-icon">👷</span>
            <span class="ant-name">工蚁</span>
            <span class="ant-count">{{ workerCount }} / 20</span>
          </div>
          <div class="ant-stat">
            <span class="ant-icon">⚔️</span>
            <span class="ant-name">兵蚁</span>
            <span class="ant-count">{{ soldierCount }} / {{ soldierLimit }}</span>
          </div>
          <div class="ant-stat">
            <span class="ant-icon">👁️</span>
            <span class="ant-name">侦察蚁</span>
            <span class="ant-count">{{ scoutCount }} / 3</span>
          </div>
        </div>

        <div v-if="canProduce" class="produce-section">
          <h4 class="subsection-title">生产蚂蚁</h4>
          <div class="produce-buttons">
            <button class="btn produce-btn" @click="produceAnt('worker')" :disabled="!canProduceWorker">
              <span>🐜 工蚁</span>
              <span class="cost">🍯 3</span>
            </button>
            <button class="btn produce-btn" @click="produceAnt('soldier')" :disabled="!canProduceSoldier">
              <span>⚔️ 兵蚁</span>
              <span class="cost">🍯 8</span>
            </button>
            <button class="btn produce-btn" @click="produceAnt('scout')" :disabled="!canProduceScout">
              <span>👁️ 侦察</span>
              <span class="cost">🍯 5</span>
            </button>
          </div>
          <div class="production-info">
            本回合剩余产量: {{ remainingProduction }}
          </div>
        </div>
      </div>

      <div class="panel-section">
        <h3 class="section-title">🏗️ 设施</h3>
        <div class="facilities-list">
          <div v-for="facility in facilitiesArray" :key="facility.type" class="facility-item">
            <div class="facility-info">
              <span class="facility-icon">{{ getFacilityIcon(facility.type) }}</span>
              <div class="facility-details">
                <span class="facility-name">{{ getFacilityName(facility.type) }}</span>
                <div class="facility-level">
                  <span v-for="i in 3" :key="i" class="level-dot" :class="{ active: i <= facility.level }"></span>
                </div>
              </div>
            </div>
            <button
              v-if="facility.level < 3"
              class="btn upgrade-btn"
              :disabled="!canUpgrade(facility.type)"
              @click="upgradeFacility(facility.type)"
            >
              升级 🍯{{ getUpgradeCost(facility.type) }}
            </button>
            <span v-else class="max-level">满级</span>
          </div>
        </div>
      </div>

      <div class="panel-section" v-if="player.facilities.lab.level > 0 && !player.mutation">
        <h3 class="section-title">🧬 基因突变</h3>
        <p class="mutation-hint">选择一个突变方向（只能选一次）</p>
        <div class="mutations-list">
          <button
            v-for="mutation in mutations"
            :key="mutation.type"
            class="btn mutation-btn"
            @click="chooseMutation(mutation.type)"
          >
            <span class="mutation-name">{{ mutation.name }}</span>
            <span class="mutation-desc">{{ mutation.description }}</span>
          </button>
        </div>
      </div>

      <div v-else-if="player.mutation" class="panel-section">
        <h3 class="section-title">🧬 当前突变</h3>
        <div class="current-mutation">
          <span class="mutation-name">{{ getMutationName(player.mutation) }}</span>
        </div>
      </div>

      <div v-if="selectedAnts.length > 0" class="panel-section">
        <h3 class="section-title">🎯 选中单位 ({{ selectedAnts.length }})</h3>
        <div class="selected-info">
          <p>右键点击地图移动选中单位</p>
          <button class="btn btn-secondary" @click="$emit('clearSelection')">
            取消选择
          </button>
        </div>
      </div>

      <div class="panel-section">
        <h3 class="section-title">📖 操作说明</h3>
        <ul class="instructions">
          <li>左键点击：选中蚂蚁</li>
          <li>右键点击：移动选中蚂蚁</li>
          <li>滚轮：缩放地图</li>
          <li>拖拽：平移地图</li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Player, FacilityType, AntType, MutationType } from '@shared/types'
import { FACILITY_STATS, HATCHERY_PRODUCTION } from '@shared/constants'

const props = defineProps<{
  player: Player | null
  selectedAnts: string[]
  isMyTurn: boolean
}>()

const emit = defineEmits<{
  (e: 'produce', type: AntType): void
  (e: 'upgrade', facilityType: FacilityType): void
  (e: 'chooseMutation', mutation: MutationType): void
  (e: 'clearSelection'): void
}>()

const workerCount = computed(() => {
  if (!props.player) return 0
  return props.player.ants.filter(a => a.type === 'worker' && a.hp > 0).length
})

const soldierCount = computed(() => {
  if (!props.player) return 0
  return props.player.ants.filter(a => a.type === 'soldier' && a.hp > 0).length
})

const scoutCount = computed(() => {
  if (!props.player) return 0
  return props.player.ants.filter(a => a.type === 'scout' && a.hp > 0).length
})

const soldierLimit = computed(() => {
  if (!props.player) return 0
  const level = props.player.facilities.barracks.level
  if (level === 0) return 0
  return [5, 10, 15][level - 1] || 5
})

const remainingProduction = computed(() => {
  if (!props.player) return 0
  const level = props.player.facilities.hatchery.level
  const maxProduction = HATCHERY_PRODUCTION[level - 1] || 2
  return maxProduction
})

const canProduce = computed(() => props.isMyTurn && props.player && !props.player.isEliminated)

const canProduceWorker = computed(() => {
  if (!props.player || !canProduce.value) return false
  return props.player.food >= 3 && workerCount.value < 20 && remainingProduction.value > 0
})

const canProduceSoldier = computed(() => {
  if (!props.player || !canProduce.value) return false
  const barracksLevel = props.player.facilities.barracks.level
  if (barracksLevel === 0) return false
  return props.player.food >= 8 && soldierCount.value < soldierLimit.value && remainingProduction.value > 0
})

const canProduceScout = computed(() => {
  if (!props.player || !canProduce.value) return false
  return props.player.food >= 5 && scoutCount.value < 3 && remainingProduction.value > 0
})

const facilitiesArray = computed(() => {
  if (!props.player) return []
  return Object.values(props.player.facilities).sort((a, b) => {
    const order = ['hatchery', 'storage', 'barracks', 'lab']
    return order.indexOf(a.type) - order.indexOf(b.type)
  })
})

const mutations = [
  { type: 'speed', name: '速度突变', description: '所有蚂蚁移动力+1' },
  { type: 'strength', name: '力量突变', description: '兵蚁攻击力+30%' },
  { type: 'resistance', name: '抗性突变', description: '所有蚂蚁生命值+20%' },
  { type: 'breeding', name: '繁殖突变', description: '孵化室每回合额外+1产量' }
]

function getFacilityIcon(type: FacilityType): string {
  switch (type) {
    case 'hatchery': return '🥚'
    case 'storage': return '📦'
    case 'barracks': return '🏰'
    case 'lab': return '🔬'
    default: return '🏠'
  }
}

function getFacilityName(type: FacilityType): string {
  return FACILITY_STATS[type]?.name || type
}

function getUpgradeCost(type: FacilityType): number {
  if (!props.player) return 0
  const level = props.player.facilities[type].level
  if (level >= 3) return 0
  const costs = [30, 60]
  return costs[level] || 30
}

function canUpgrade(type: FacilityType): boolean {
  if (!props.player || !props.isMyTurn) return false
  const level = props.player.facilities[type].level
  if (level >= 3) return false
  const cost = getUpgradeCost(type)
  return props.player.food >= cost
}

function produceAnt(type: AntType) {
  emit('produce', type)
}

function upgradeFacility(type: FacilityType) {
  emit('upgrade', type)
}

function chooseMutation(type: MutationType) {
  emit('chooseMutation', type)
}

function getMutationName(type: MutationType): string {
  const m = mutations.find(m => m.type === type)
  return m?.name || type || '无'
}
</script>

<style scoped>
.control-panel {
  width: 280px;
  height: 100%;
  overflow-y: auto;
  padding: 12px;
  background: linear-gradient(180deg, #0f3460 0%, #16213e 100%);
  border-left: 2px solid #e94560;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.no-player {
  text-align: center;
  padding: 40px 20px;
  color: #888;
}

.panel-section {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #4ecdc4;
  border-bottom: 1px solid rgba(78, 205, 196, 0.3);
  padding-bottom: 6px;
}

.subsection-title {
  font-size: 12px;
  color: #aaa;
  margin-bottom: 8px;
  margin-top: 8px;
}

.resource-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.resource-item {
  display: grid;
  grid-template-columns: 24px 50px 1fr;
  grid-template-rows: auto auto;
  gap: 4px 8px;
  align-items: center;
}

.resource-icon {
  grid-row: 1 / 3;
  font-size: 20px;
}

.resource-name {
  font-size: 12px;
  color: #aaa;
}

.resource-value {
  font-size: 13px;
  font-weight: 600;
  text-align: right;
}

.resource-bar-bg {
  grid-column: 2 / 4;
  height: 6px;
  background: rgba(0,0,0,0.5);
  border-radius: 3px;
  overflow: hidden;
}

.resource-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.resource-bar-fill.food {
  background: linear-gradient(90deg, #FFD93D, #F9A825);
}

.resource-bar-fill.hp {
  background: linear-gradient(90deg, #e94560, #ff6b6b);
}

.ant-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ant-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
}

.ant-icon {
  font-size: 16px;
}

.ant-name {
  flex: 1;
  font-size: 13px;
}

.ant-count {
  font-size: 13px;
  font-weight: 600;
  color: #4ecdc4;
}

.produce-section {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255,255,255,0.1);
}

.produce-buttons {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.produce-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: 13px;
}

.produce-btn .cost {
  color: #FFD93D;
  font-size: 12px;
}

.production-info {
  margin-top: 8px;
  font-size: 11px;
  color: #888;
  text-align: center;
}

.facilities-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.facility-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
}

.facility-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.facility-icon {
  font-size: 20px;
}

.facility-details {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.facility-name {
  font-size: 13px;
  font-weight: 500;
}

.facility-level {
  display: flex;
  gap: 4px;
}

.level-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
}

.level-dot.active {
  background: #4ecdc4;
  box-shadow: 0 0 4px #4ecdc4;
}

.upgrade-btn {
  font-size: 11px;
  padding: 5px 10px;
}

.max-level {
  font-size: 11px;
  color: #FFD93D;
  font-weight: 500;
}

.mutation-hint {
  font-size: 12px;
  color: #aaa;
  margin-bottom: 10px;
}

.mutations-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mutation-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 12px;
  text-align: left;
  background: rgba(78, 205, 196, 0.1);
  border: 1px solid rgba(78, 205, 196, 0.3);
}

.mutation-btn:hover {
  background: rgba(78, 205, 196, 0.2);
  border-color: #4ecdc4;
}

.mutation-name {
  font-size: 13px;
  font-weight: 600;
  color: #4ecdc4;
}

.mutation-desc {
  font-size: 11px;
  color: #aaa;
}

.current-mutation {
  text-align: center;
  padding: 10px;
  background: rgba(78, 205, 196, 0.1);
  border-radius: 6px;
  border: 1px solid #4ecdc4;
}

.current-mutation .mutation-name {
  font-size: 14px;
  font-weight: 600;
  color: #4ecdc4;
}

.selected-info {
  text-align: center;
  font-size: 12px;
  color: #aaa;
}

.selected-info p {
  margin-bottom: 8px;
}

.btn-secondary {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  font-size: 12px;
  padding: 6px 12px;
}

.instructions {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 12px;
  color: #aaa;
  line-height: 1.8;
}

.instructions li {
  padding-left: 16px;
  position: relative;
}

.instructions li::before {
  content: '•';
  position: absolute;
  left: 4px;
  color: #e94560;
}
</style>
