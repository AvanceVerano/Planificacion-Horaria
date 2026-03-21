import { defineStore } from 'pinia'

const API_BASE_URL = 'http://localhost:5067'

export const useCatalogStore = defineStore('catalog', {
  state: () => ({
    cursos: [],
    sedes: new Set(),
    cargado: false,
    loading: false,
    error: null,
  }),
  getters: {
    cursosOrdenados: (state) =>
      [...state.cursos].sort((a, b) => a.nombre.localeCompare(b.nombre)),
  },
  actions: {
    async fetchCatalog() {
      this.loading = true
      this.error = null

      try {
        const resp = await fetch(`${API_BASE_URL}/api/cursos`)
        if (!resp.ok) {
          const message = await resp.text()
          throw new Error(message || 'No se pudo obtener el catálogo')
        }
        const data = await resp.json()
        if (!Array.isArray(data)) {
          throw new Error('Formato de catálogo inválido')
        }

        this.cursos = data
        this.sedes = new Set(
          data.flatMap((c) =>
            (c.secciones || []).map((s) => s.sede).filter(Boolean),
          ),
        )
        this.cargado = true
      } catch (err) {
        this.error = err.message || 'Error inesperado al cargar el catálogo'
        this.cursos = []
        this.sedes = new Set()
        this.cargado = false
      } finally {
        this.loading = false
      }
    },
  },
})
