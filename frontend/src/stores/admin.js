import { defineStore } from 'pinia'

const STORAGE_KEY = 'admin_token'

export const useAdminStore = defineStore('admin', {
  state: () => ({
    token: ''
  }),
  actions: {
    syncToken() {
      this.token = localStorage.getItem(STORAGE_KEY) || ''
    },
    setToken(token) {
      this.token = token || ''
      if (this.token) {
        localStorage.setItem(STORAGE_KEY, this.token)
        return
      }
      localStorage.removeItem(STORAGE_KEY)
    }
  }
})
