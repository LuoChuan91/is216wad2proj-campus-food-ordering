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
  // Wrap the slotted buttons in <div class="adm-actions d-flex gap-2">. The blocked row places
  // its single button directly, so it passes :actions="false".
  actions: { type: Boolean, default: true },
})
</script>

<template>
  <div class="adm-row d-flex align-items-center gap-3" :class="{ done }">
    <Avatar :name="profile.name" :size="40" :tone="tone || undefined" />
    <div class="adm-who d-flex flex-column flex-grow-1 overflow-hidden">
      <strong>{{ profile.name }}</strong>
      <small>{{ profile.email }}<template v-if="showStatus"> · {{ profile.status }}</template></small>
    </div>
    <StatusTag v-if="tagText" :tone="tagTone"><Icon v-if="tagCheck" name="check" :size="11" />{{ tagText }}</StatusTag>
    <div v-if="actions" class="adm-actions d-flex gap-2"><slot /></div>
    <slot v-else />
  </div>
</template>

<style scoped>
/* Admin student row (moved from the global prototype stylesheet). */
.adm-row {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 12px 14px;
  margin-bottom: 8px;
}
.adm-row.done {
  opacity: 0.85;
}
.adm-who strong {
  font-size: var(--fs-body);
}
.adm-who small {
  color: var(--muted);
}
@media (max-width: 720px) {
  .adm-row {
    flex-wrap: wrap;
  }
  .adm-who {
    flex-basis: calc(100% - 60px);
  }
  .adm-actions {
    margin-left: auto;
  }
}
</style>
