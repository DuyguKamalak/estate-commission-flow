import { defineStore } from 'pinia';

/**
 * Top-level UI state. Keeps things Pinia-grown from the start so feature
 * stores (`transactions`, `agents`, `dashboard`) can be added in later
 * sprints following the same pattern.
 */
export const useAppStore = defineStore('app', {
  state: () => ({
    appName: 'Estate Commission Flow',
    ready: true as boolean,
    globalError: null as string | null,
  }),
  actions: {
    setGlobalError(message: string | null) {
      this.globalError = message;
    },
  },
});
