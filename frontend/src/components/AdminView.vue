<script setup>
import { ref, computed } from 'vue'
import { useCatalogStore } from '../stores/catalog'

const catalog = useCatalogStore()

const curso = ref({
  nombre: '',
  sede: '',
  seccion: '',
  profesor: '',
})
const guardado = ref(false)

const resumenCatalogo = computed(() => ({
  cursos: catalog.cursos.length,
  sedes: catalog.sedes.size,
}))

const limpiar = () => {
  curso.value = {
    nombre: '',
    sede: '',
    seccion: '',
    profesor: '',
  }
}

const guardarPlaceholder = () => {
  // Punto de extensión: aquí se puede llamar a /api/admin/cursos|secciones|sesiones
  // Por ahora solo mostramos una confirmación visual.
  guardado.value = true
  setTimeout(() => (guardado.value = false), 1800)
}
</script>

<template>
  <v-card variant="outlined">
    <v-card-title class="d-flex align-center justify-space-between">
      <div>
        <div class="text-h6">Shell de administración</div>
        <div class="text-caption text-medium-emphasis">
          Listo para conectar con los endpoints /api/admin/* ya disponibles.
        </div>
      </div>
      <div class="d-flex align-center flex-wrap" style="gap: 8px;">
        <v-chip color="primary" variant="tonal">
          {{ resumenCatalogo.cursos }} cursos
        </v-chip>
        <v-chip color="secondary" variant="tonal">
          {{ resumenCatalogo.sedes }} sedes
        </v-chip>
      </div>
    </v-card-title>

    <v-card-text class="pt-0">
      <v-alert
        type="info"
        variant="tonal"
        class="mb-4"
        text="Usa este formulario como punto de partida para crear/editar cursos desde el backend."
      />
      <v-form @submit.prevent="guardarPlaceholder">
        <v-row dense>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="curso.nombre"
              label="Nombre del curso"
              prepend-inner-icon="mdi-book-open-page-variant"
              required
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="curso.profesor"
              label="Profesor"
              prepend-inner-icon="mdi-account-tie"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="curso.seccion"
              label="Código de sección"
              prepend-inner-icon="mdi-tag-text-outline"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="curso.sede"
              label="Sede"
              prepend-inner-icon="mdi-map-marker"
            />
          </v-col>
        </v-row>

        <div class="d-flex align-center flex-wrap mt-2" style="gap: 8px;">
          <v-btn color="primary" type="submit" :loading="guardado">
            Guardar
          </v-btn>
          <v-btn variant="tonal" color="secondary" @click="limpiar">
            Limpiar
          </v-btn>
        </div>
      </v-form>
    </v-card-text>
  </v-card>
</template>
