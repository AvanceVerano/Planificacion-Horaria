<script setup>
import { ref } from 'vue'
import PublicView from './components/PublicView.vue'
import AdminView from './components/AdminView.vue'

const tab = ref('public')
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable" dark>
      <v-app-bar-title>Horarios Pro</v-app-bar-title>
      <v-spacer />
      <v-btn icon="mdi-github" href="https://github.com/AvanceVerano/Planificacion-Horaria" target="_blank" />
    </v-app-bar>

    <v-main class="bg-surface pa-4">
      <v-container>
        <v-tabs
          v-model="tab"
          bg-color="surface"
          color="primary"
          class="mb-4"
        >
          <v-tab value="public" prepend-icon="mdi-school-outline">
            Vista pública
          </v-tab>
          <v-tab value="admin" prepend-icon="mdi-shield-crown-outline">
            Admin
          </v-tab>
        </v-tabs>

        <v-window v-model="tab">
          <v-window-item value="public">
            <PublicView />
          </v-window-item>
          <v-window-item value="admin">
            <AdminView />
          </v-window-item>
        </v-window>
      </v-container>
    </v-main>
  </v-app>
</template>
