import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

const matteHorariosTheme = {
  dark: false,
  colors: {
    background: '#FCF9F5',
    surface: '#FFFFFF',
    primary: '#8B5E3C',
    secondary: '#D4A373',
    'on-background': '#2D2622',
    'on-surface': '#2D2622',
    info: '#4A3B33',
  },
}

export default createVuetify({
  theme: {
    defaultTheme: 'matteHorarios',
    themes: {
      matteHorarios: matteHorariosTheme,
    },
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
})
