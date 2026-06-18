<template>
  <div class="event-log">
    <div class="log-header">
      <span class="log-title">📜 事件日志</span>
    </div>
    <div class="log-content" ref="logContentRef">
      <div
        v-for="(entry, index) in events"
        :key="index"
        class="log-entry"
        :class="`log-${entry.type}`"
      >
        <span class="log-turn">[回合{{ entry.turn }}]</span>
        <span class="log-message">{{ entry.message }}</span>
      </div>
      <div v-if="events.length === 0" class="log-empty">
        暂无事件记录
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { EventLogEntry } from '@shared/types'

const props = defineProps<{
  events: EventLogEntry[]
}>()

const logContentRef = ref<HTMLDivElement | null>(null)

watch(() => props.events.length, () => {
  nextTick(() => {
    if (logContentRef.value) {
      logContentRef.value.scrollTop = 0
    }
  })
})
</script>

<style scoped>
.event-log {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(0deg, #0f3460 0%, #16213e 100%);
  border-top: 2px solid #e94560;
}

.log-header {
  padding: 8px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  background: rgba(0,0,0,0.2);
}

.log-title {
  font-size: 13px;
  font-weight: 600;
  color: #4ecdc4;
}

.log-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}

.log-entry {
  padding: 4px 8px;
  margin-bottom: 4px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.4;
  border-left: 3px solid transparent;
}

.log-turn {
  color: #888;
  font-size: 11px;
  margin-right: 6px;
  font-family: monospace;
}

.log-message {
  color: #ccc;
}

.log-info {
  background: rgba(78, 205, 196, 0.1);
  border-left-color: #4ecdc4;
}

.log-battle {
  background: rgba(233, 69, 96, 0.1);
  border-left-color: #e94560;
}

.log-battle .log-message {
  color: #ff8a8a;
}

.log-event {
  background: rgba(255, 217, 61, 0.1);
  border-left-color: #ffd93d;
}

.log-event .log-message {
  color: #ffe066;
}

.log-economy {
  background: rgba(150, 206, 180, 0.1);
  border-left-color: #96ceb4;
}

.log-economy .log-message {
  color: #b8e0c9;
}

.log-warning {
  background: rgba(255, 107, 107, 0.15);
  border-left-color: #ff6b6b;
}

.log-warning .log-message {
  color: #ff8a8a;
  font-weight: 500;
}

.log-empty {
  text-align: center;
  color: #555;
  padding: 20px;
  font-size: 12px;
}
</style>
