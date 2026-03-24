import { defineStore } from 'pinia'

const STORAGE_KEY = 'admin_token'

export const useAdminStore = defineStore('admin', {
  state: () => ({
    token: ''
  }),
  actions: {
    syncToken() {
      this.token = sessionStorage.getItem(STORAGE_KEY) || ''
    },
    setToken(token) {
      this.token = token || ''
      if (this.token) {
        sessionStorage.setItem(STORAGE_KEY, this.token)
        return
      }
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }
})
