<template>
  <div class="description-card" :class="{ editing: editingDescription }">
    <div class="description-heading">
      <span>{{ $t('todoDetails.notes') }}</span>
      <span v-if="editingDescription" class="description-hint">{{ $t('todoDetails.saveNotesHint') }}</span>
      <i v-else class="bi-pencil" aria-hidden="true"></i>
    </div>
    <div v-if="editingDescription" class="description-editor">
      <textarea ref="descriptionInput" v-model="desc" :placeholder="$t('todoDetails.notes')"
        @input="resizeTextArea" @blur="saveDescription" @keydown.ctrl.enter.prevent.stop="saveDescription"
        @keydown.esc.prevent.stop="cancelDescription"></textarea>
      <button type="button" class="description-markdown" :title="$t('todoDetails.markdown')"
        @mousedown.prevent="goToMarkDown"><i class="bi-markdown-fill"></i></button>
    </div>
    <div v-else class="description-preview" role="button" tabindex="0"
      :aria-label="$t('todoDetails.editNotes')" @click="openFromClick" @keydown.enter="openFromKey"
      @keydown.space="openFromKey">
      <div v-if="desc.trim()" class="todo-description" v-html="todoDescription()"></div>
      <div v-else class="description-empty">{{ $t('todoDetails.addNotes') }}</div>
    </div>
  </div>
</template>

<script>
import MarkdownIt from "markdown-it";
import markdownTargetBlankLinks from "../../helpers/markdownTargetBlankLinks";

export default {
  name: "descriptionTextArea",
  emits: ["updatedDescription"],
  props: { todoDesc: { required: true } },
  data() { return { desc: "", original: "", editingDescription: false, md: new MarkdownIt() }; },
  mounted() { markdownTargetBlankLinks.renderBlankLinks(this.md); },
  watch: {
    todoDesc: { immediate: true, handler(value) {
      this.desc = value || "";
      this.original = this.desc;
      this.editingDescription = false;
    } },
  },
  methods: {
    resizeTextArea() {
      const area = this.$refs.descriptionInput;
      if (!area) return;
      area.style.height = "auto";
      area.style.height = `${Math.max(112, area.scrollHeight)}px`;
    },
    openFromClick(event) {
      if (event.target.closest("a")) return;
      this.editDescription();
    },
    openFromKey(event) {
      if (event.target.closest("a")) return;
      event.preventDefault();
      this.editDescription();
    },
    editDescription() {
      this.original = this.desc;
      this.editingDescription = true;
      this.$nextTick(() => {
        this.resizeTextArea();
        this.$refs.descriptionInput.focus();
        this.$refs.descriptionInput.setSelectionRange(this.desc.length, this.desc.length);
      });
    },
    saveDescription() {
      if (!this.editingDescription) return;
      this.editingDescription = false;
      if (this.desc !== this.original) this.$emit("updatedDescription", this.desc);
      this.original = this.desc;
    },
    cancelDescription() {
      this.desc = this.original;
      this.editingDescription = false;
    },
    todoDescription() { return this.md.render(this.desc); },
    goToMarkDown() { window.open("https://commonmark.org/help/", "_blank"); },
  },
};
</script>

<style scoped>
.description-card { margin-top: 18px; padding: 12px 14px; border: 1px solid transparent; border-radius: 13px; background: var(--w-hover); transition: border-color .18s ease, background-color .18s ease, box-shadow .18s ease; }
.description-card:hover, .description-card:focus-within { border-color: var(--w-line); background: var(--w-surface); }
.description-card.editing { border-color: var(--w-soft); box-shadow: 0 5px 18px rgba(0,0,0,.06); }
.description-heading { display: flex; justify-content: space-between; align-items: center; gap: 8px; color: var(--w-muted); font-size: 12px; font-weight: 600; }
.description-heading i { opacity: 0; transition: opacity .18s ease; }
.description-card:hover .description-heading i, .description-card:focus-within .description-heading i { opacity: 1; }
.description-hint { color: var(--w-soft); font-weight: 400; font-size: 11px; }
.description-preview { min-height: 35px; padding-top: 7px; cursor: text; outline: none; }
.description-preview:focus-visible { outline: 2px solid var(--w-ink); outline-offset: 2px; border-radius: 4px; }
.todo-description { overflow-wrap: anywhere; font-size: 13px; line-height: 1.55; }
.description-empty { color: var(--w-soft); font-size: 13px; }
.description-editor { position: relative; margin-top: 8px; }
.description-editor textarea { width: 100%; min-height: 112px; padding: 10px 12px 30px; resize: vertical; border: 1px solid var(--w-line); border-radius: 9px; outline: none; background: var(--w-surface); color: var(--w-ink); line-height: 1.5; }
.description-editor textarea:focus { border-color: var(--w-soft); }
.description-markdown { position: absolute; right: 8px; bottom: 9px; border: 0; background: transparent; color: var(--w-soft); }
.description-markdown:hover { color: var(--w-ink); }
@media (prefers-reduced-motion: reduce) { .description-card, .description-heading i { transition: none; } }
</style>
