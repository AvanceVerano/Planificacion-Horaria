<template>
  <div class="app-root">
    <nav class="navbar">
      <div class="nav-brand">
        <IconGraduationCap class="app-icon" style="color:white;" />
        Horarios Pro
      </div>
      <div class="nav-links">
        <button class="nav-btn active" id="tab-generator" onclick="switchTab('generator')">
          <IconUser class="app-icon" style="color:inherit;" /> Individual
        </button>
        <button class="nav-btn" id="tab-group" onclick="switchTab('group')">
          <IconUsers class="app-icon" style="color:inherit;" /> Grupal
        </button>
        <button class="nav-btn" id="tab-builder" onclick="switchTab('builder')">
          <IconPencil class="app-icon" style="color:inherit;" /> Creador
        </button>
        <button class="nav-btn" id="tab-favorites" onclick="switchTab('favorites')">
          <IconStar class="app-icon" style="color:inherit;" /> Favoritos
        </button>
      </div>
    </nav>

    <div id="screen-setup" class="screen active">
      <div class="setup-container">
        <h1>Horario Individual</h1>

        <div class="step">
          <h3>1. Carga el catálogo del servidor o sube tus archivos JSON de cursos</h3>
          <div style="display:flex; justify-content:center; margin-bottom: 10px;">
            <button class="btn-secondary" type="button" onclick="cargarCatalogoDesdeApi()">
              <IconRefreshCw class="app-icon" /> Cargar catálogo del servidor
            </button>
          </div>
          <div class="drop-zone" id="drop-zone-ind">
            <IconUploadCloud class="drop-icon" />
            <p>Arrastra y suelta tus archivos aquí<br><small>o presiona para seleccionarlos</small></p>
            <input type="file" id="file-input-ind" multiple accept=".json" class="hidden-file-input" onchange="procesarArchivosInd(event)">
          </div>
          <div id="file-list-preview-ind" class="file-list-preview"></div>
        </div>

        <div class="step">
          <h3>2. Selecciona las sedes permitidas</h3>
          <div id="sedes-container" class="checkbox-grid">
            <em style="color:var(--text-muted);">Carga el catálogo para ver las sedes.</em>
          </div>
        </div>

        <div class="step">
          <h3>3. Selecciona tus cursos (Máximo 7)</h3>
          <div id="cursos-container" class="checkbox-grid">
            <em style="color:var(--text-muted);">Carga el catálogo para ver los cursos.</em>
          </div>
        </div>

        <div class="step">
          <h3>4. Filtros Opcionales (Bloqueos)</h3>
          <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 10px;">Marca "Día Libre" si no quieres clases en todo el día, o agrega rangos de horas donde NO puedes estudiar.</p>
          <div id="filtros-ind-container" class="bloqueos-container"></div>
        </div>

        <button id="btn-generar" class="btn-main" onclick="iniciarGeneracionInd()" disabled>Generar Horarios</button>
        <div id="error-msg"></div>
      </div>
    </div>

    <div id="screen-group" class="screen">
      <div class="setup-container">
        <h1>Match Grupal</h1>
        <p style="text-align: center; color: var(--text-muted); margin-bottom: 25px;">Encuentra horarios para llevar cursos compartidos con tus amigos sin cruces individuales.</p>

        <div class="step" style="display: flex; gap: 15px; align-items: center; justify-content: center; background: var(--surface);">
          <label style="font-weight: bold; font-size: 16px; color: var(--text);">¿Cuántos alumnos son?</label>
          <input type="number" id="num-students" min="2" max="5" value="2" class="modern-input-num">
          <button class="btn-secondary" onclick="generarTarjetasAlumnos()" style="margin: 0; padding: 8px 20px;">Actualizar Tarjetas</button>
        </div>
        <div class="step" style="display: flex; gap: 15px; align-items: center; justify-content: center; background: var(--surface);">
          <label style="font-weight: bold; font-size: 16px; color: var(--text);">Fuente de cursos:</label>
          <label class="checkbox-item" style="margin: 0;">
            <input type="checkbox" id="group-use-json" onchange="toggleModoGrupoJson(this.checked)"> Usar JSON propios
          </label>
          <span style="font-size: 12px; color: var(--text-muted);">Si faltan cursos en la base, puedes subir JSON.</span>
        </div>

        <div id="group-filters-section" class="step" style="display: none;">
          <h3>Sedes Permitidas (Grupo)</h3>
          <div id="sedes-container-grp" class="checkbox-grid"></div>
        </div>

        <div id="students-container"></div>

        <button id="btn-generar-grupo" class="btn-main" onclick="iniciarGeneracionGrupal()" style="display: none; margin-top: 20px;">Generar Horarios Grupales</button>
        <div id="error-msg-group"></div>
      </div>
    </div>

    <div id="screen-calendar" class="screen">
      <div class="header" style="flex-direction: column; align-items: stretch; gap: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center;">
            <button class="btn-control btn-volver" onclick="volverDeCalendario()">
              <IconArrowLeft class="app-icon" style="color:inherit;" /> Volver
            </button>
            <h1 id="calendar-title">Resultados</h1>
          </div>
          <div class="controls">
            <button id="btn-fav" class="btn-control btn-fav" onclick="toggleFavorito()">
              <IconStar class="app-icon" style="color:inherit;" /> Favorito
            </button>
            <button id="btn-prev" class="btn-control" onclick="changeSchedule(-1)">
              <IconChevronLeft class="app-icon" style="color:inherit;" /> Anterior
            </button>
            <select id="schedule-selector" onchange="renderSchedule(parseInt(this.value))"></select>
            <button id="btn-next" class="btn-control" onclick="changeSchedule(1)">
              Siguiente <IconChevronRight class="app-icon" style="color:inherit;" />
            </button>
          </div>
        </div>
        <div id="sub-tabs-container" style="display: none; gap: 10px; justify-content: center;"></div>
      </div>

      <div id="interactive-builder-tray" style="display: none; padding: 15px; background: var(--bg); border-radius: var(--radius); margin-bottom: 15px; border: 1px solid var(--border);">
        <h3 style="margin-top: 0; font-size: 16px; color: var(--text);">Arma tu horario (Haz clic en un curso para ver opciones)</h3>

        <div id="tray-courses" style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px;"></div>

        <div id="preview-instructions" style="display: none; padding: 10px; border-radius: var(--radius-sm); margin-bottom: 10px;">
          <span id="preview-text"></span>
          <button class="btn-secondary" style="margin-left: 10px; padding: 3px 8px; font-size: 12px;" onclick="cancelarPreview()">
            <IconX class="app-icon" /> Cancelar Selección
          </button>
        </div>

        <div style="text-align: right; margin-top: 15px;">
          <button id="btn-save-interactive-fav" class="btn-main" style="display: none;" onclick="guardarHorarioInteractivoComoFav()">
            <IconStar class="app-icon" style="color:white;" /> Guardar Horario Completo
          </button>
        </div>
      </div>

      <div class="calendar-container">
        <div class="time-col">
          <div class="day-header">Hora</div>
          <div class="time-labels" id="time-labels"></div>
        </div>
        <div class="days-wrapper">
          <div class="day-col"><div class="day-header">Lunes</div><div class="day-grid" id="grid-Lun"></div></div>
          <div class="day-col"><div class="day-header">Martes</div><div class="day-grid" id="grid-Mar"></div></div>
          <div class="day-col"><div class="day-header">Miércoles</div><div class="day-grid" id="grid-Mie"></div></div>
          <div class="day-col"><div class="day-header">Jueves</div><div class="day-grid" id="grid-Jue"></div></div>
          <div class="day-col"><div class="day-header">Viernes</div><div class="day-grid" id="grid-Vie"></div></div>
          <div class="day-col"><div class="day-header">Sábado</div><div class="day-grid" id="grid-Sab"></div></div>
        </div>
      </div>
    </div>

    <div id="screen-favorites" class="screen">
      <div class="setup-container">
        <h1>Mis Favoritos</h1>
        <div style="display: flex; gap: 20px; justify-content: center; margin-bottom: 20px;">
          <div class="step" style="flex: 1; text-align: center; background: var(--surface);">
            <h3><IconUser class="app-icon" style="display:inline-block; vertical-align:middle;" /> Individuales</h3>
            <p id="fav-ind-status">0 guardados</p>
            <input type="file" id="file-fav-ind" accept=".json" style="display:none;" aria-label="Cargar favoritos individuales desde JSON" onchange="cargarFavs(event, 'ind')">
            <button class="btn-secondary btn-full" type="button" onclick="document.getElementById('file-fav-ind').click()">
              <IconFolderOpen class="app-icon" /> Cargar JSON
            </button>
            <button class="btn-main" style="margin-top: 10px;" onclick="verFavoritos('ind')"><IconEye class="app-icon" style="color:white;" /> Ver</button>
            <button class="btn-secondary btn-full" style="margin-top: 10px;" onclick="descargarFavs('ind')"><IconDownload class="app-icon" /> Descargar</button>
          </div>
          <div class="step" style="flex: 1; text-align: center; background: var(--surface);">
            <h3><IconUsers class="app-icon" style="display:inline-block; vertical-align:middle;" /> Grupales</h3>
            <p id="fav-grp-status">0 guardados</p>
            <input type="file" id="file-fav-grp" accept=".json" style="display:none;" aria-label="Cargar favoritos grupales desde JSON" onchange="cargarFavs(event, 'grp')">
            <button class="btn-secondary btn-full" type="button" onclick="document.getElementById('file-fav-grp').click()">
              <IconFolderOpen class="app-icon" /> Cargar JSON
            </button>
            <button class="btn-main" style="margin-top: 10px;" onclick="verFavoritos('grp')"><IconEye class="app-icon" style="color:white;" /> Ver</button>
            <button class="btn-secondary btn-full" style="margin-top: 10px;" onclick="descargarFavs('grp')"><IconDownload class="app-icon" /> Descargar</button>
          </div>
        </div>
      </div>
    </div>

    <div id="screen-builder" class="screen">
      <h2 style="text-align: center; color: var(--primary); margin-bottom: 20px;">Constructor de Cursos</h2>

      <div class="builder-controls" style="margin-bottom: 20px;">
        <div style="display: flex; gap: 10px; align-items: flex-end;">
          <div class="input-group" style="flex: 2; margin: 0;">
            <label>Nombre del Curso (Público):</label>
            <input ref="builderCourseNameInput" type="text" id="builder-course-name" placeholder="Ej. Arquitectura de Software">
          </div>
          <div class="input-group" style="flex: 1; margin: 0;">
            <label>O cargar JSON para editar:</label>
            <input type="file" id="builder-file-input" accept=".json" style="display:none;" onchange="cargarJsonParaEditar(event)">
            <button class="btn-secondary" style="width:100%;" type="button" onclick="document.getElementById('builder-file-input').click()">
              <IconFolderOpen class="app-icon" /> Cargar JSON
            </button>
          </div>
        </div>
      </div>

      <div id="sections-container" style="margin-bottom: 20px;"></div>
      <button class="btn-primary" style="width: 100%; margin-bottom: 20px;" onclick="agregarSeccionEnBlanco()">
        <IconPlus class="app-icon" style="color:white;" /> Agregar Nueva Sección
      </button>

      <div style="border: 1px solid var(--accent); padding: 15px; border-radius: var(--radius); margin-bottom: 20px; background-color: #fdf5eb;">
        <h4 style="margin-top: 0; color: var(--primary); display:flex; align-items:center; gap:8px;">
          <IconHandshake class="app-icon" /> Contribuidores (Alumnos)
        </h4>
        <p style="font-size: 13px; color: var(--text-muted);">Descarga tu curso armado y envíalo al administrador para que lo apruebe (fabrizioprogramador939@gmail.com).</p>
        <div style="display: flex; gap: 10px;">
          <button class="btn-primary" style="flex: 1;" onclick="descargarJSON()"><IconDownload class="app-icon" style="color:white;" /> Descargar JSON</button>
          <button class="btn-secondary" style="flex: 1;" onclick="enviarPorCorreo()"><IconMail class="app-icon" /> Enviar JSON por Correo</button>
        </div>
      </div>

      <div id="admin-login-section" style="border: 1px solid #f5c6c6; padding: 15px; border-radius: var(--radius); margin-bottom: 20px; background-color: #fdecea;">
        <h4 style="margin-top: 0; color: #c62828; display:flex; align-items:center; gap:8px;">
          <IconLock class="app-icon" style="color:#c62828;" /> Acceso Administradores
        </h4>
        <div style="display: flex; gap: 10px; align-items: center;">
          <input type="password" id="admin-password-input" placeholder="Clave de Admin" style="flex: 2; padding: 10px; border-radius: var(--radius-sm); border: 1.5px solid var(--border); font-family:'Public Sans',sans-serif; color:var(--text);">
          <button class="btn-primary" style="flex: 1; background-color: var(--accent);" onclick="validarYMostrarPanelAdmin()">
            <IconKey class="app-icon" style="color:white;" /> Validar Clave
          </button>
        </div>
        <div id="admin-upload-status" style="margin-top: 10px; font-weight: bold; font-size: 14px;"></div>
      </div>

      <div id="admin-panel" style="display: none; border: 1px dashed var(--primary); padding: 15px; border-radius: var(--radius); background-color: #f4f0eb;">
        <h4 style="margin-top: 0; color: var(--primary); display:flex; align-items:center; gap:8px;">
          <IconSettings class="app-icon" style="color:var(--primary);" /> Panel de Control de Base de Datos
        </h4>

        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
          <input
            ref="adminUploadInput"
            id="admin-upload-input"
            type="file"
            accept=".json"
            style="display:none;"
            aria-label="Subir nuevo curso en formato JSON"
            @change="handleAdminJsonUpload">
          <Button class="btn-secondary" style="flex: 1;" type="button" aria-controls="admin-upload-input" @click="triggerAdminUpload">
            <template #icon>
              <IconUpload class="app-icon" />
            </template>
            Subir Nuevo Curso (JSON)
          </Button>
        </div>
        <div v-if="statusMessage" :style="statusStyle">{{ statusMessage }}</div>

        <div style="margin-bottom: 15px;">
          <label>Cursos en el servidor:</label>
          <select id="builder-course-select" style="width: 100%; padding: 10px; border-radius: var(--radius-sm); border: 1.5px solid var(--border);">
            <option value="">-- Selecciona un curso --</option>
          </select>
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
          <button class="btn-secondary" style="flex: 1;" onclick="cargarCursosServidor()"><IconRefreshCw class="app-icon" /> Refrescar Lista</button>
          <button class="btn-secondary" style="flex: 1;" onclick="cargarCursoServidorSeleccionado()"><IconDownload class="app-icon" /> Cargar para Editar</button>
        </div>

        <div style="display: flex; gap: 10px;">
          <button class="btn-primary" style="flex: 2;" onclick="guardarCursoServidor()"><IconSave class="app-icon" style="color:white;" /> Guardar Cambios en BD</button>
          <button class="btn-delete" style="flex: 1;" onclick="eliminarCursoServidor()"><IconTrash2 class="app-icon" /> Eliminar de BD</button>
        </div>
        <div id="builder-status" style="margin-top: 10px; font-weight: bold; font-size: 13px; text-align: center;"></div>
      </div>
    </div>
  </div>

  <!-- Custom alert modal (replaces native alert()) -->
  <div id="modal-alert" class="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-alert-title">
    <div class="modal-content modal-alert-box">
      <div class="modal-alert-icon" id="modal-alert-icon"></div>
      <h3 id="modal-alert-title" class="modal-alert-title"></h3>
      <p id="modal-alert-msg" class="modal-alert-msg"></p>
      <div class="modal-actions" style="justify-content:center;">
        <button class="btn-main" onclick="closeAlert()">Aceptar</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import { useAdminStore } from './stores/admin'
import IconGraduationCap from '~icons/lucide/graduation-cap'
import IconUser          from '~icons/lucide/user'
import IconUsers         from '~icons/lucide/users'
import IconPencil        from '~icons/lucide/pencil'
import IconStar          from '~icons/lucide/star'
import IconRefreshCw     from '~icons/lucide/refresh-cw'
import IconUploadCloud   from '~icons/lucide/upload-cloud'
import IconUpload        from '~icons/lucide/upload'
import IconArrowLeft     from '~icons/lucide/arrow-left'
import IconChevronLeft   from '~icons/lucide/chevron-left'
import IconChevronRight  from '~icons/lucide/chevron-right'
import IconX             from '~icons/lucide/x'
import IconFolderOpen    from '~icons/lucide/folder-open'
import IconEye           from '~icons/lucide/eye'
import IconDownload      from '~icons/lucide/download'
import IconPlus          from '~icons/lucide/plus'
import IconHandshake     from '~icons/lucide/handshake'
import IconMail          from '~icons/lucide/mail'
import IconLock          from '~icons/lucide/lock'
import IconKey           from '~icons/lucide/key'
import IconSettings      from '~icons/lucide/settings'
import IconSave          from '~icons/lucide/save'
import IconTrash2        from '~icons/lucide/trash-2'

const adminStore = useAdminStore()
adminStore.syncToken()

const adminUploadInput = ref(null)
const builderCourseNameInput = ref(null)
const statusMessage = ref('')
const isError = ref(false)

const statusStyle = computed(() => ({
  marginBottom: '15px',
  fontWeight: '700',
  fontSize: '13px',
  fontFamily: "'Public Sans', sans-serif",
  color: isError.value ? '#e74c3c' : '#27ae60'
}))

const apiBaseUrl = window.API_BASE_URL || 'https://planificacion-horaria-production.up.railway.app'

const setStatus = (message, error = false) => {
  statusMessage.value = message
  isError.value = error
}

const triggerAdminUpload = () => {
  adminUploadInput.value?.click()
}

const getFriendlyError = async (response) => {
  const contentType = response.headers.get('content-type') || ''
  const rawText = await response.text()
  if (!rawText) {
    return 'No se pudo subir el curso.'
  }
  if (contentType.includes('application/json')) {
    try {
      const data = JSON.parse(rawText)
      const message = data?.message || data?.error || data?.title
      if (typeof message === 'string' && message.trim()) {
        return message
      }
    } catch (error) {
      return 'No se pudo subir el curso.'
    }
    return 'No se pudo subir el curso.'
  }
  const trimmed = rawText.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'No se pudo subir el curso.'
  }
  return trimmed
}

const handleAdminJsonUpload = async (event) => {
  const input = event.target
  const file = input?.files?.[0]
  if (!file) {
    return
  }

  adminStore.syncToken()
  const token = adminStore.token

  if (!token) {
    setStatus('❌ Acceso denegado: Token inválido o expirado', true)
    input.value = ''
    return
  }

  const defaultName = file.name.replace(/\.json$/i, '')
  const courseNameInput = builderCourseNameInput.value
  const nombre = courseNameInput?.value.trim() || defaultName

  if (courseNameInput && !courseNameInput.value.trim()) {
    courseNameInput.value = defaultName
  }

  try {
    setStatus('⏳ Subiendo curso al servidor...')
    const contenido = await file.text()
    const parsed = JSON.parse(contenido)
    const secciones = Array.isArray(parsed) ? parsed : parsed?.secciones

    if (!Array.isArray(secciones) || secciones.length === 0) {
      setStatus('❌ El JSON no contiene secciones válidas.', true)
      return
    }

    const respuesta = await fetch(`${apiBaseUrl}/api/admin/cursos/upload-json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': token
      },
      body: JSON.stringify({ nombre, secciones })
    })

    if (respuesta.status === 401) {
      setStatus('❌ Acceso denegado: Token inválido o expirado', true)
      return
    }

    if (!respuesta.ok) {
      const errorMessage = await getFriendlyError(respuesta)
      setStatus(`❌ ${errorMessage}`, true)
      return
    }

    const resultado = await respuesta.json().catch(() => ({}))
    const nombreResultado = resultado?.nombre || nombre
    setStatus(`✅ Curso "${nombreResultado}" subido correctamente.`)

    if (typeof window.cargarCursosServidor === 'function') {
      await window.cargarCursosServidor()
    }
  } catch (error) {
    setStatus('❌ No se pudo procesar el archivo JSON.', true)
  } finally {
    input.value = ''
  }
}
</script>

<style>
/* Global icon defaults: stroke-width 1.5 for all Lucide SVGs */
.app-root svg {
  stroke-width: 1.5;
  flex-shrink: 0;
}
</style>
