import { createApp } from 'vue'
import '@mdi/font/css/materialdesignicons.css'
import './style.css'
import App from './App.vue'
import vuetify from './plugins/vuetify'

createApp(App).use(vuetify).mount('#app')
