<script setup>
import { computed, onMounted } from 'vue'
import { useCatalogStore } from '../stores/catalog'

const catalog = useCatalogStore()

const cursos = computed(() => catalog.cursosOrdenados)
const sedes = computed(() => [...catalog.sedes].sort())

const resumen = computed(() =>
  cursos.value.map((c) => {
    const secciones = c.secciones || []
    return {
      nombre: c.nombre || 'Curso',
      secciones: secciones.length,
      sedes: [...new Set(secciones.map((s) => s.sede).filter(Boolean))],
    }
  }),
)

const handleReload = () => catalog.fetchCatalog()

onMounted(() => {
  if (!catalog.cargado && !catalog.loading) {
    catalog.fetchCatalog()
  }
})
</script>

<template>
  <v-card variant="outlined">
    <v-card-title class="d-flex align-center justify-space-between">
      <div>
        <div class="text-h6">Catálogo público</div>
        <div class="text-caption text-medium-emphasis">
          Consume los cursos expuestos por el backend y muéstralos en tiempo real.
        </div>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-refresh"
        :loading="catalog.loading"
        @click="handleReload"
      >
        Recargar
      </v-btn>
    </v-card-title>

    <v-card-text>
      <v-alert
        v-if="catalog.error"
        type="error"
        variant="tonal"
        :text="catalog.error"
        class="mb-4"
      />

      <v-skeleton-loader
        v-if="catalog.loading"
        type="list-item-three-line@3"
      />

      <div v-else>
        <div class="d-flex align-center mb-3" v-if="sedes.length">
          <div class="text-subtitle-2 text-medium-emphasis mr-2">Sedes:</div>
          <v-chip
            v-for="sede in sedes"
            :key="sede"
            size="small"
            color="primary"
            variant="tonal"
            class="mr-1 mb-1"
          >
            {{ sede }}
          </v-chip>
        </div>

        <v-list v-if="resumen.length" lines="three" density="comfortable">
          <v-list-item
            v-for="curso in resumen"
            :key="curso.nombre"
            :title="curso.nombre"
            :subtitle="`${curso.secciones} secciones`"
          >
            <template #append>
              <v-chip-group
                v-if="curso.sedes.length"
                column
                class="d-flex flex-wrap"
              >
                <v-chip
                  v-for="sede in curso.sedes"
                  :key="sede"
                  size="x-small"
                  color="secondary"
                  class="ma-1"
                  variant="tonal"
                >
                  {{ sede }}
                </v-chip>
              </v-chip-group>
            </template>
          </v-list-item>
        </v-list>

        <v-alert
          v-else
          type="info"
          variant="tonal"
          class="text-center"
          icon="mdi-school-outline"
          title="No hay cursos disponibles"
          text="Arranca el backend o agrega cursos para ver resultados aquí."
        />
      </div>
    </v-card-text>
  </v-card>
</template>
