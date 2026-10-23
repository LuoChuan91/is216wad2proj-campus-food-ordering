<script setup>
// One student row in the admin approvals screen (avatar, name/email, a status tag
// and the action buttons in the default slot).
//
// Extracted from views/admin/AdminApprovalsView.vue. The three row kinds (pending,
// verified, blocked) differ only in the `done` modifier, the status tag and which
// buttons appear, so those are left to props/slots; the row shell is shared.
import Avatar from '@/components/icons/Avatar.vue'
import Icon from '@/components/icons/Icon.vue'
import StatusTag from '@/components/StatusTag.vue'

defineProps({
  profile: { type: Object, required: true },
  // Adds the "done" modifier (verified / blocked rows).
  done: { type: Boolean, default: false },
  // Avatar tone (brand for pending, default otherwise).
  tone: { type: String, default: '' },
  // Status tag tone + text; when both empty, no tag is shown.
  tagTone: { type: String, default: '' },
  tagText: { type: String, default: '' },
  // Shows a check icon inside the tag (verified row).
  tagCheck: { type: Boolean, default: false },
  // Appends " · <status>" to the email (blocked row).
  showStatus: { type: Boolean, default: false },
  // Wrap the slotted buttons in <div class="adm-actions">. The blocked row places
  // its single button directly, so it passes :actions="false".
  actions: { type: Boolean, default: true },
})
</script>

<template>
  <div class="adm-row" :class="{ done }">
    <Avatar :name="profile.name" :size="40" :tone="tone || undefined" />
    <div class="adm-who">
      <strong>{{ profile.name }}</strong>
      <small>{{ profile.email }}<template v-if="showStatus"> · {{ profile.status }}</template></small>
    </div>
    <StatusTag v-if="tagText" :tone="tagTone"><Icon v-if="tagCheck" name="check" :size="11" />{{ tagText }}</StatusTag>
    <div v-if="actions" class="adm-actions"><slot /></div>
    <slot v-else />
  </div>
</template>

<style scoped>
/* Admin student row (moved from the global prototype stylesheet). */
.adm-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 12px 14px;
  margin-bottom: 8px;
}
.adm-row.done {
  opacity: 0.85;
}
.adm-who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.adm-who strong {
  font-size: 14.5px;
}
.adm-who small {
  color: var(--muted);
}
.adm-actions {
  display: flex;
  gap: 6px;
}
</style>
