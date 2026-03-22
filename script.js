// --- VARIABLES GLOBALES ---
const startHour = 7, endHour = 23;
const totalMinutes = (endHour - startHour) * 60;
const paletaColores = ['#4A90E2', '#E74C3C', '#50E3C2', '#F5A623', '#9B59B6', '#34495E', '#16A085', '#D35400'];
let colorIndex = 0;
let coloresPorCurso = {};
let catalogoDisponible = false;
let catalogoCursos = [];
let origenDatosInd = 'ninguno';
let origenDatosGrp = 'ninguno';
const API_BASE_URL = 'http://localhost:5067';
const ADMIN_EMAIL = 'admin@horariospro.com';

// Estado del Calendario Actual
let schedulesList = [];
let currentCalendarOrigin = '';
let currentIndex = 0;
let isGroupMode = false;
let currentSubTab = 'Todos'; // 'Todos' o el nombre del alumno

// Datos Individuales
let cursosDataInd = {}; 
let sedesInd = new Set();
let horariosInd = [];
let favsInd = [];

// Datos Grupales
let groupStudents = []; // { name: "Juan", courses: ["Web"], data: {"Web": [...]} }
let horariosGrp = [];
let favsGrp = [];
let modoCargaGrupo = 'catalogo';

// Editor de cursos
let editorData = [];
let currentTargetSectionIndex = 0;
let builderCursosServidor = [];
let builderCursoActualId = null;

// --- NAVEGACIÓN ---
function switchTab(tab) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    if (tab === 'generator') document.getElementById('screen-setup').classList.add('active');
    else if (tab === 'group') {
        document.getElementById('screen-group').classList.add('active');
        if (groupStudents.length === 0) generarTarjetasAlumnos();
    }
    else if (tab === 'builder') document.getElementById('screen-builder').classList.add('active');
    else if (tab === 'favorites') {
        document.getElementById('screen-favorites').classList.add('active');
        document.getElementById('fav-ind-status').innerText = `${favsInd.length} guardados`;
        document.getElementById('fav-grp-status').innerText = `${favsGrp.length} guardados`;
    }
}
function cambiarPantalla(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}
function volverDeCalendario() { cambiarPantalla(currentCalendarOrigin); }

// --- UTILIDADES ---
function parseTime(timeStr) {
    const m = timeStr.trim().match(/(\d+):(\d+)\s*(am|pm)/i);
    if (!m) return 0;
    let h = parseInt(m[1]), min = parseInt(m[2]), p = m[3].toLowerCase();
    if (h === 12) h = 0;
    if (p === 'pm') h += 12;
    return h * 60 + min;
}
function hayColision(ses1, ses2) {
    if (ses1.dia !== ses2.dia) return false;
    return Math.max(parseTime(ses1.inicio), parseTime(ses2.inicio)) < Math.min(parseTime(ses1.fin), parseTime(ses2.fin));
}
function obtenerColorCurso(nombre) {
    if (!coloresPorCurso[nombre]) { coloresPorCurso[nombre] = paletaColores[colorIndex % paletaColores.length]; colorIndex++; }
    return coloresPorCurso[nombre];
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --- FILTROS AVANZADOS (BLOQUEOS POR DÍA) ---
const diasSemana = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

function renderFiltrosBloqueo(containerId, prefijo) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    diasSemana.forEach(dia => {
        container.innerHTML += `
            <div class="bloqueo-row" id="row-${prefijo}-${dia}">
                <div class="bloqueo-dia-label">
                    <span>${dia}</span>
                    <label style="font-size: 11px; font-weight: normal; cursor: pointer;">
                        <input type="checkbox" class="chk-dia-libre-${prefijo}" value="${dia}" onchange="toggleDiaLibre('${prefijo}', '${dia}')"> Libre
                    </label>
                </div>
                <div class="bloqueo-rangos" id="rangos-${prefijo}-${dia}"></div>
                <button class="btn-add-rango" id="btn-add-${prefijo}-${dia}" onclick="agregarRangoBloqueo('${prefijo}', '${dia}')">+ Rango</button>
            </div>
        `;
    });
}

function toggleDiaLibre(prefijo, dia) {
    const isLibre = document.querySelector(`#row-${prefijo}-${dia} .chk-dia-libre-${prefijo}`).checked;
    const btnAdd = document.getElementById(`btn-add-${prefijo}-${dia}`);
    const rangosContainer = document.getElementById(`rangos-${prefijo}-${dia}`);
    
    if (isLibre) {
        btnAdd.style.display = 'none';
        rangosContainer.style.opacity = '0.3';
        rangosContainer.style.pointerEvents = 'none';
    } else {
        btnAdd.style.display = 'block';
        rangosContainer.style.opacity = '1';
        rangosContainer.style.pointerEvents = 'auto';
    }
}

function agregarRangoBloqueo(prefijo, dia) {
    const container = document.getElementById(`rangos-${prefijo}-${dia}`);
    const div = document.createElement('div');
    div.className = 'rango-item';
    div.innerHTML = `
        De: <input type="time" class="modern-input-time start-time" value="08:00">
        A: <input type="time" class="modern-input-time end-time" value="10:00">
        <button class="btn-delete" onclick="this.parentElement.remove()" style="padding: 4px 8px;">X</button>
    `;
    container.appendChild(div);
}

function leerBloqueos(prefijo) {
    const bloqueos = {};
    diasSemana.forEach(dia => {
        const isLibre = document.querySelector(`#row-${prefijo}-${dia} .chk-dia-libre-${prefijo}`).checked;
        const rangosHtml = document.querySelectorAll(`#rangos-${prefijo}-${dia} .rango-item`);
        const rangos = [];
        
        rangosHtml.forEach(r => {
            const min = parseTimeInputToMinutes(r.querySelector('.start-time').value, 0);
            const max = parseTimeInputToMinutes(r.querySelector('.end-time').value, 0);
            if (min < max) rangos.push({ min, max });
        });

        bloqueos[dia] = { diaLibre: isLibre, rangos: rangos };
    });
    return bloqueos;
}

function parseTimeInputToMinutes(timeStr, defaultMinutes) {
    if (!timeStr) return defaultMinutes;
    const parts = timeStr.split(':');
    return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
}

function seccionCumpleFiltros(sec, bloqueos) {
    for (const sesion of (sec.sesiones || [])) {
        const bloqueoDia = bloqueos[sesion.dia];
        if (!bloqueoDia) continue; // Si no hay reglas para este día, pasa

        if (bloqueoDia.diaLibre) return false; // El día completo está bloqueado

        const inicioSesion = parseTime(sesion.inicio);
        const finSesion = parseTime(sesion.fin);

        for (const rango of bloqueoDia.rangos) {
            // Lógica de colisión: Max de los inicios < Min de los fines
            if (Math.max(inicioSesion, rango.min) < Math.min(finSesion, rango.max)) {
                return false; // Choca con un rango de bloqueo
            }
        }
    }
    return true;
}

// Inicializar la UI al cargar
document.addEventListener('DOMContentLoaded', () => {
    renderFiltrosBloqueo('filtros-ind-container', 'ind');
    cargarCatalogoDesdeApi();
    cargarCursosServidor();
});

// --- CATALOGO API ---
async function cargarCatalogoDesdeApi() {
    const estado = document.getElementById('file-list-preview-ind');
    estado.style.color = '#27ae60';
    estado.innerText = 'Cargando catálogo del servidor...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/cursos`);
        if (!response.ok) {
            const mensaje = await response.text();
            throw new Error(mensaje || 'No se pudo cargar el catálogo.');
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error('El catálogo recibido no es válido.');
        }

        aplicarCatalogo(data);
        estado.style.color = '#27ae60';
        estado.innerText = `Catálogo cargado: ${catalogoCursos.length} cursos.`;
    } catch (error) {
        console.error(error);
        catalogoDisponible = false;
        if (origenDatosInd !== 'archivos') origenDatosInd = 'ninguno';
        if (origenDatosGrp !== 'archivos') origenDatosGrp = 'ninguno';
        estado.style.color = '#e74c3c';
        estado.innerText = 'No se pudo cargar el catálogo del servidor.';
    }
}

function aplicarCatalogo(data) {
    cursosDataInd = {};
    sedesInd.clear();
    sedesGrpGlobales.clear();
    catalogoCursos = [];

    data.forEach(curso => {
        if (!curso || !curso.nombre) return;
        const secciones = (curso.secciones || []).map(seccion => ({
            seccion: seccion.codigo || seccion.seccion || '',
            sede: seccion.sede || '',
            profesor: seccion.profesor || '',
            sesiones: (seccion.sesiones || []).map(sesion => ({
                dia: sesion.dia,
                inicio: sesion.horaInicio,
                fin: sesion.horaFin
            }))
        }));

        cursosDataInd[curso.nombre] = secciones;
        catalogoCursos.push(curso.nombre);
        secciones.forEach(sec => {
            if (sec.sede) {
                sedesInd.add(sec.sede);
                sedesGrpGlobales.add(sec.sede);
            }
        });
    });

    catalogoCursos.sort((a, b) => a.localeCompare(b));
    catalogoDisponible = true;
    origenDatosInd = 'api';
    origenDatosGrp = 'api';

    renderCatalogoIndividual();
    actualizarFiltrosGrupales();
}

function renderCatalogoIndividual() {
    const sedesCont = document.getElementById('sedes-container');
    if (sedesInd.size === 0) {
        sedesCont.innerHTML = '<em style="color:#999;">No hay sedes disponibles.</em>';
    } else {
        const sedesHtml = Array.from(sedesInd).sort().map(s =>
            `<label class="checkbox-item"><input type="checkbox" class="chk-sede" value="${escapeHtml(s)}" checked> ${escapeHtml(s)}</label>`
        ).join('');
        sedesCont.innerHTML = sedesHtml;
    }

    const cursosCont = document.getElementById('cursos-container');
    if (Object.keys(cursosDataInd).length === 0) {
        cursosCont.innerHTML = '<em style="color:#999;">No hay cursos disponibles.</em>';
    } else {
        const cursosHtml = Object.keys(cursosDataInd).sort().map(c =>
            `<label class="checkbox-item"><input type="checkbox" class="chk-curso" value="${escapeHtml(c)}" checked> ${escapeHtml(c)}</label>`
        ).join('');
        cursosCont.innerHTML = cursosHtml;
    }

    document.getElementById('btn-generar').disabled = Object.keys(cursosDataInd).length === 0;
}

// --- MODO INDIVIDUAL ---
async function procesarArchivosInd(event) {
    const archivos = event.target.files;
    if (archivos.length === 0) return;
    origenDatosInd = 'archivos';
    cursosDataInd = {}; sedesInd.clear();
    for (let f of archivos) {
        const nombre = f.name.replace('.json', '');
        const json = JSON.parse(await f.text());
        cursosDataInd[nombre] = json;
        json.forEach(s => sedesInd.add(s.sede));
    }
    const estado = document.getElementById('file-list-preview-ind');
    estado.style.color = '#27ae60';
    estado.innerText = `${archivos.length} archivos cargados.`;

    renderCatalogoIndividual();
}

async function iniciarGeneracionInd() {
    const cursosReq = Array.from(document.querySelectorAll('.chk-curso:checked')).map(cb => cb.value);
    const sedesReq = Array.from(document.querySelectorAll('.chk-sede:checked')).map(cb => cb.value);
    const bloqueosInd = leerBloqueos('ind');
    horariosInd = [];
    document.getElementById('error-msg').innerText = '';

    if (cursosReq.length === 0) {
        document.getElementById('error-msg').innerText = 'Selecciona al menos un curso.';
        return;
    }

    if (origenDatosInd === 'api' && catalogoDisponible) {
        const horariosApi = await solicitarHorariosIndividualApi(cursosReq, sedesReq);
        if (!horariosApi) return;

        horariosInd = horariosApi.filter(schedule =>
            schedule.every(sec => seccionCumpleFiltros(sec, bloqueosInd))
        );
        if (horariosInd.length === 0) {
            document.getElementById('error-msg').innerText = "No se encontró ninguna combinación posible. Intenta quitar cursos que se crucen o selecciona más sedes.";
            return;
        }

        isGroupMode = false;
        schedulesList = horariosInd;
        prepararCalendario('Individuales', 'screen-setup');
        cambiarPantalla('screen-calendar');
        return;
    }
    
    function choca(horario, nuevaSec) {
        return horario.some(sec => sec.sesiones.some(s1 => nuevaSec.sesiones.some(s2 => hayColision(s1, s2))));
    }

    function buscar(idx, actual) {
        if (idx === cursosReq.length) { horariosInd.push([...actual]); return; }
        let curso = cursosReq[idx];
        for (let sec of (cursosDataInd[curso] || [])) {
            if (!sedesReq.includes(sec.sede)) continue;
            if (!seccionCumpleFiltros(sec, bloqueosInd)) continue;
            if (!choca(actual, sec)) {
                actual.push({ ...sec, curso: curso });
                buscar(idx + 1, actual);
                actual.pop();
            }
        }
    }
    
    // 1. Ejecutar la búsqueda UNA SOLA VEZ
    buscar(0, []);
    
    // 2. Validar resultados vacíos
    if (horariosInd.length === 0) {
        document.getElementById('error-msg').innerText = "No se encontró ninguna combinación posible. Intenta quitar cursos que se crucen o selecciona más sedes.";
        return; // Detiene el código, no cambia de pantalla
    }

    // 3. Mostrar el calendario
    isGroupMode = false;
    schedulesList = horariosInd;
    prepararCalendario('Individuales', 'screen-setup');
    cambiarPantalla('screen-calendar');
}

async function solicitarHorariosIndividualApi(cursosReq, sedesReq, bloqueosReq) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/horarios/individual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cursos: cursosReq, sedes: sedesReq, bloqueos: bloqueosReq })
        });

        if (!response.ok) {
            const mensaje = await response.text();
            document.getElementById('error-msg').innerText = mensaje || 'No se pudo generar horarios.';
            return null;
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
            document.getElementById('error-msg').innerText = 'La respuesta del servidor es inválida.';
            return null;
        }

        return data.map(mapHorarioApiToLocal);
    } catch (error) {
        console.error(error);
        document.getElementById('error-msg').innerText = 'No se pudo conectar con el servidor.';
        return null;
    }
}

async function iniciarGeneracionInd() {
    const btn = document.getElementById('btn-generar');
    const errorMsg = document.getElementById('error-msg');
    
    const cursosReq = Array.from(document.querySelectorAll('.chk-curso:checked')).map(cb => cb.value);
    const sedesReq = Array.from(document.querySelectorAll('.chk-sede:checked')).map(cb => cb.value);
    const bloqueosInd = leerBloqueos('ind');
    horariosInd = [];
    errorMsg.innerText = '';

    if (cursosReq.length === 0) {
        errorMsg.innerText = 'Selecciona al menos un curso.';
        return;
    }

    // LÍMITE DE SEGURIDAD PARA EVITAR CONGELAMIENTOS
    if (cursosReq.length > 8) {
        errorMsg.innerText = 'Por favor, selecciona un máximo de 8 cursos para evitar sobrecargar el navegador.';
        return;
    }

    // ESTADO VISUAL DE CARGA
    btn.innerText = 'Generando... ⏳';
    btn.disabled = true;

    try {
        if (origenDatosInd === 'api' && catalogoDisponible) {
            // Pasamos los bloqueos a la API
            const horariosApi = await solicitarHorariosIndividualApi(cursosReq, sedesReq, bloqueosInd);
            if (!horariosApi) return;

            // El servidor ya filtró todo, solo asignamos los resultados
            horariosInd = horariosApi;
            
            if (horariosInd.length === 0) {
                errorMsg.innerText = "No se encontró ninguna combinación posible.";
                return;
            }

            isGroupMode = false;
            schedulesList = horariosInd;
            prepararCalendario('Individuales', 'screen-setup');
            cambiarPantalla('screen-calendar');
            return;
        }
        
        // --- BÚSQUEDA LOCAL (Si usas JSON directamente) ---
        function choca(horario, nuevaSec) {
            return horario.some(sec => sec.sesiones.some(s1 => nuevaSec.sesiones.some(s2 => hayColision(s1, s2))));
        }

        function buscar(idx, actual) {
            if (idx === cursosReq.length) { horariosInd.push([...actual]); return; }
            let curso = cursosReq[idx];
            for (let sec of (cursosDataInd[curso] || [])) {
                if (!sedesReq.includes(sec.sede)) continue;
                if (!seccionCumpleFiltros(sec, bloqueosInd)) continue;
                if (!choca(actual, sec)) {
                    actual.push({ ...sec, curso: curso });
                    buscar(idx + 1, actual);
                    actual.pop();
                }
            }
        }
        
        // Damos un respiro de 50ms para que el navegador dibuje el botón de "Generando..."
        await new Promise(resolve => setTimeout(resolve, 50));
        buscar(0, []);
        
        if (horariosInd.length === 0) {
            errorMsg.innerText = "No se encontró ninguna combinación posible.";
            return; 
        }

        isGroupMode = false;
        schedulesList = horariosInd;
        prepararCalendario('Individuales', 'screen-setup');
        cambiarPantalla('screen-calendar');

    } finally {
        // RESTAURAMOS EL BOTÓN PASE LO QUE PASE
        btn.innerText = 'Generar Horarios';
        btn.disabled = false;
    }
}

async function solicitarHorariosGrupalesApi(estudiantes, sedesPermitidas) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/horarios/grupal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estudiantes, sedes: sedesPermitidas })
        });

        if (!response.ok) {
            const mensaje = await response.text();
            document.getElementById('error-msg-group').innerText = mensaje || 'No se pudo generar horarios grupales.';
            return null;
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
            document.getElementById('error-msg-group').innerText = 'La respuesta del servidor es inválida.';
            return null;
        }

        return data.map(mapHorarioApiToLocal);
    } catch (error) {
        console.error(error);
        document.getElementById('error-msg-group').innerText = 'No se pudo conectar con el servidor.';
        return null;
    }
}

function mapHorarioApiToLocal(horarioApi) {
    if (!horarioApi || !Array.isArray(horarioApi.items)) return [];
    return horarioApi.items.map(item => ({
        curso: item.cursoNombre || '',
        seccion: item.seccion?.codigo || '',
        sede: item.seccion?.sede || '',
        profesor: item.seccion?.profesor || '',
        sesiones: (item.seccion?.sesiones || []).map(sesion => ({
            dia: sesion.dia,
            inicio: sesion.horaInicio,
            fin: sesion.horaFin
        }))
    }));
}

// --- MODO GRUPAL ---
let sedesGrpGlobales = new Set(); // Guarda las sedes de todos los JSON del grupo

function toggleModoGrupoJson(usarJson) {
    modoCargaGrupo = usarJson ? 'archivos' : 'catalogo';
    origenDatosGrp = usarJson ? 'archivos' : (catalogoDisponible ? 'api' : 'ninguno');
    generarTarjetasAlumnos();
}

function generarTarjetasAlumnos() {
    const n = document.getElementById('num-students').value;
    const cont = document.getElementById('students-container');
    groupStudents = [];
    const usarCatalogo = catalogoDisponible && modoCargaGrupo !== 'archivos';
    if (!usarCatalogo) {
        sedesGrpGlobales.clear(); 
    }
    document.getElementById('group-filters-section').style.display = 'none';
    const cards = [];
    origenDatosGrp = usarCatalogo ? 'api' : 'archivos';

    for (let i = 0; i < n; i++) {
        groupStudents.push({ name: `Alumno ${i+1}`, courses: [], data: {}, bloqueos: {} });
        const cursosHtml = usarCatalogo
            ? (catalogoCursos.length === 0
                ? '<div style="flex:2; color:#999; font-size:12px;">No hay cursos disponibles.</div>'
                : `<div style="flex:2;">` +
                  `<div class="checkbox-grid">` + catalogoCursos.map(curso => {
                    const safeLabel = escapeHtml(curso);
                    const encodedCurso = encodeURIComponent(curso);
                    return `<label class="checkbox-item"><input type="checkbox" class="chk-curso-grp" data-student="${i}" data-curso="${encodedCurso}" value="${safeLabel}"> ${safeLabel}</label>`;
                }).join('') + `</div></div>`)
            : `
                <div class="student-drop" 
                     ondragover="allowDropGrp(event)" 
                     ondragleave="leaveDropGrp(event)" 
                     ondrop="dropStudentFiles(event, ${i})" 
                     onclick="document.getElementById('file-input-grp-${i}').click()">
                    
                    <p style="margin: 0; color: var(--primary); font-weight: bold;">📂 Clic o Arrastra JSONs</p>
                    <small style="color: #7f8c8d; margin-top: 5px;">Archivos de este alumno</small>
                    <input type="file" id="file-input-grp-${i}" multiple accept=".json" style="display:none;" onchange="readStudentFiles(event, ${i})">
                </div>`;

        // Modificamos el diseño de la tarjeta para que incluya los bloqueos debajo
        cards.push(`
            <div class="student-card" style="flex-direction: column;">
                <div style="display: flex; gap: 20px; width: 100%; align-items: flex-start;">
                    <div class="student-info">
                        <label style="font-weight:bold; color: #2c3e50;">Nombre:</label>
                        <input type="text" value="Alumno ${i+1}" onchange="groupStudents[${i}].name = this.value; document.getElementById('label-bloqueo-${i}').innerText = 'Bloqueos de ' + this.value;" style="margin-bottom: 10px;">
                        <div id="stu-courses-${i}" class="student-courses-list">Cursos: 0 seleccionados</div>
                    </div>
                    ${cursosHtml}
                </div>
                <div style="width: 100%; margin-top: 15px; border-top: 1px solid #e1e8ed; padding-top: 15px;">
                    <strong id="label-bloqueo-${i}" style="font-size: 13px; color: #2c3e50;">Bloqueos de Alumno ${i+1}:</strong>
                    <div id="filtros-grp-stu-${i}" class="bloqueos-container" style="margin-top: 10px;"></div>
                </div>
            </div>`);
    }
    cont.innerHTML = cards.join('');
    document.getElementById('btn-generar-grupo').style.display = 'block';
    
    // Renderizamos los filtros dinámicos para cada alumno
    for (let i = 0; i < n; i++) {
        renderFiltrosBloqueo(`filtros-grp-stu-${i}`, `grp-stu-${i}`);
    }

    if (usarCatalogo) {
        actualizarFiltrosGrupales();
        cont.querySelectorAll('.chk-curso-grp').forEach(input => {
            input.addEventListener('change', event => {
                const index = Number(event.target.dataset.student);
                const curso = decodeURIComponent(event.target.dataset.curso || '');
                toggleCursoAlumno(index, curso, event.target.checked);
            });
        });
    }
}

// Controladores seguros de Drag & Drop
function allowDropGrp(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}
function leaveDropGrp(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
}
function dropStudentFiles(event, index) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        // Simulamos el evento de input de archivo
        readStudentFiles({ target: { files: event.dataTransfer.files } }, index);
    }
}

function toggleCursoAlumno(index, curso, seleccionado) {
    const student = groupStudents[index];
    if (!student) return;

    if (seleccionado) {
        if (!student.courses.includes(curso)) {
            student.courses.push(curso);
        }
    } else {
        student.courses = student.courses.filter(c => c !== curso);
    }

    actualizarCursosAlumno(index);
}

function actualizarCursosAlumno(index) {
    const student = groupStudents[index];
    const label = document.getElementById(`stu-courses-${index}`);
    if (!student || !label) return;

    label.innerText = student.courses.length > 0
        ? `Cursos: ${student.courses.join(', ')}`
        : 'Cursos: 0 seleccionados';
}

async function readStudentFiles(event, index) {
    const files = event.target.files || event.dataTransfer.files;
    let student = groupStudents[index];
    origenDatosGrp = 'archivos';
    modoCargaGrupo = 'archivos';
    const toggle = document.getElementById('group-use-json');
    if (toggle && !toggle.checked) toggle.checked = true;
    student.courses = [];
    student.data = {};

    for (let f of files) {
        let cName = f.name.replace('.json', '');
        try {
            let json = JSON.parse(await f.text());
            student.courses.push(cName);
            student.data[cName] = json;
            
            // Recopilamos las sedes globalmente
            json.forEach(sec => sedesGrpGlobales.add(sec.sede));
        } catch (e) {
            alert(`Error al leer ${f.name} en el alumno ${index + 1}.`);
        }
    }
    
    actualizarCursosAlumno(index);
    actualizarFiltrosGrupales();
}

function actualizarFiltrosGrupales() {
    const section = document.getElementById('group-filters-section');
    const container = document.getElementById('sedes-container-grp');
    container.innerHTML = '';
    
    if (sedesGrpGlobales.size > 0) {
        section.style.display = 'block';
        const sedesHtml = Array.from(sedesGrpGlobales).sort().map(sede => `
                <label class="checkbox-item">
                    <input type="checkbox" class="chk-sede-grp" value="${escapeHtml(sede)}" checked> ${escapeHtml(sede)}
                </label>`).join('');
        container.innerHTML = sedesHtml;
    }
}

async function iniciarGeneracionGrupal() {
    document.getElementById('error-msg-group').innerText = '';

    const sedesPermitidas = Array.from(document.querySelectorAll('.chk-sede-grp:checked')).map(cb => cb.value);
    
    // 1. Leer los bloqueos de cada alumno individualmente
    groupStudents.forEach((stu, i) => {
        stu.bloqueos = leerBloqueos(`grp-stu-${i}`);
    });

    if (sedesPermitidas.length === 0) {
        document.getElementById('error-msg-group').innerText = "Debes seleccionar al menos una sede permitida en los filtros grupales.";
        return;
    }

    const estudiantesSinCursos = groupStudents.filter(stu => !stu.courses || stu.courses.length === 0);
    if (estudiantesSinCursos.length > 0) {
        document.getElementById('error-msg-group').innerText = "Todos los alumnos deben tener al menos un curso seleccionado.";
        return;
    }

    const usarApi = catalogoDisponible && modoCargaGrupo !== 'archivos';
    horariosGrp = [];

    if (usarApi) {
        const payloadEstudiantes = groupStudents.map(stu => ({
            nombre: stu.name,
            cursos: stu.courses,
            bloqueos: stu.bloqueos // Ahora el API recibirá los bloqueos personales
        }));

        const horariosApi = await solicitarHorariosGrupalesApi(payloadEstudiantes, sedesPermitidas);
        if (!horariosApi) return;
        
        // Filtrar respuesta de la API usando reglas individuales
        horariosGrp = horariosApi.filter(schedule =>
            schedule.every(sec => {
                for (let stu of groupStudents) {
                    if (stu.courses.includes(sec.curso)) {
                        if (!seccionCumpleFiltros(sec, stu.bloqueos)) return false;
                    }
                }
                return true;
            })
        );
    } else {
        let globalCoursesSet = new Set();
        let globalData = {};

        groupStudents.forEach(stu => {
            stu.courses.forEach(c => {
                globalCoursesSet.add(c);
                if (!globalData[c]) globalData[c] = stu.data[c];
            });
        });

        let globalCourses = Array.from(globalCoursesSet);

        function buscarGrp(idx, actualSchedule) {
            if (idx === globalCourses.length) { horariosGrp.push([...actualSchedule]); return; }

            let courseName = globalCourses[idx];
            let sections = globalData[courseName] || [];

            for (let sec of sections) {
                if (!sedesPermitidas.includes(sec.sede)) continue;
                
                // 2. APLICAMOS EL FILTRO INDIVIDUAL: ¿Le sirve esta sección a todos los que llevan el curso?
                let cumpleBloqueos = true;
                let isValidForAll = true;

                for (let stu of groupStudents) {
                    if (stu.courses.includes(courseName)) {
                        // Verifica los bloqueos de tiempo del alumno
                        if (!seccionCumpleFiltros(sec, stu.bloqueos)) {
                            cumpleBloqueos = false;
                            break;
                        }

                        // Verifica cruces con su horario ya armado
                        let personalSchedule = actualSchedule.filter(s => stu.courses.includes(s.curso));
                        let choca = personalSchedule.some(existente =>
                            existente.sesiones.some(s1 => sec.sesiones.some(s2 => hayColision(s1, s2)))
                        );

                        if (choca) { isValidForAll = false; break; }
                    }
                }

                if (cumpleBloqueos && isValidForAll) {
                    actualSchedule.push({ ...sec, curso: courseName });
                    buscarGrp(idx + 1, actualSchedule);
                    actualSchedule.pop();
                }
            }
        }

        buscarGrp(0, []);
    }

    if (horariosGrp.length === 0) {
        document.getElementById('error-msg-group').innerText = "No se encontró ninguna combinación grupal sin cruces. Intenten flexibilizar las sedes, los bloqueos de horas o quitar cursos conflictivos.";
        return;
    }

    horariosGrp.forEach(schedule => {
        schedule.forEach(sec => {
            sec.alumnos = groupStudents.filter(stu => stu.courses.includes(sec.curso)).map(stu => stu.name);
        });
    });

    isGroupMode = true;
    schedulesList = horariosGrp;
    prepararCalendario('Combinaciones Grupales', 'screen-group');
    cambiarPantalla('screen-calendar');
}

// --- SISTEMA DE FAVORITOS ---
function toggleFavorito() {
    if (schedulesList.length === 0) return;
    const current = schedulesList[currentIndex];
    const strCurrent = JSON.stringify(current);
    
    let targetArr = isGroupMode ? favsGrp : favsInd;
    const favIndex = targetArr.findIndex(f => JSON.stringify(f) === strCurrent);

    if (favIndex >= 0) targetArr.splice(favIndex, 1);
    else targetArr.push(current);
    
    actualizarBotonFavorito();
    document.getElementById(`fav-${isGroupMode?'grp':'ind'}-status`).innerText = `${targetArr.length} guardados`;
}

function actualizarBotonFavorito() {
    const targetArr = isGroupMode ? favsGrp : favsInd;
    const isFav = targetArr.some(f => JSON.stringify(f) === JSON.stringify(schedulesList[currentIndex]));
    const btn = document.getElementById('btn-fav');
    if (isFav) { btn.innerHTML = '⭐ Guardado'; btn.classList.add('active'); } 
    else { btn.innerHTML = '☆ Favorito'; btn.classList.remove('active'); }
}

function descargarFavs(tipo) {
    const arr = tipo === 'ind' ? favsInd : favsGrp;
    if (arr.length === 0) return alert("Nada que descargar.");
    const url = URL.createObjectURL(new Blob([JSON.stringify(arr, null, 4)], {type:"application/json"}));
    const a = document.createElement("a"); a.href = url; a.download = `favoritos_${tipo}.json`; a.click();
}

async function cargarFavs(event, tipo) {
    try {
        const json = JSON.parse(await event.target.files[0].text());
        if (tipo === 'ind') { favsInd = json; document.getElementById('fav-ind-status').innerText = `${json.length} guardados`; }
        else { favsGrp = json; document.getElementById('fav-grp-status').innerText = `${json.length} guardados`; }
    } catch(e) { alert("Error al cargar JSON."); }
}

function verFavoritos(tipo) {
    isGroupMode = (tipo === 'grp');
    schedulesList = isGroupMode ? favsGrp : favsInd;
    
    // Si es grupal, reconstruir la lista de alumnos a partir del primer horario (si existe)
    if (isGroupMode && schedulesList.length > 0) {
        let allStudents = new Set();
        schedulesList[0].forEach(c => c.alumnos.forEach(a => allStudents.add(a)));
        groupStudents = Array.from(allStudents).map(name => ({name})); 
    }

    prepararCalendario(`Favoritos ${tipo === 'ind' ? 'Individuales' : 'Grupales'}`, 'screen-favorites');
    cambiarPantalla('screen-calendar');
}

// --- RENDERIZADO DEL CALENDARIO ---
function prepararCalendario(titulo, origen) {
    currentCalendarOrigin = origen;
    
    // Generar horas en el eje Y
    const timeLabels = document.getElementById('time-labels');
    if (timeLabels.children.length === 0) {
        for (let i = startHour; i <= endHour; i++) {
            let div = document.createElement('div'); div.className = 'time-label';
            div.style.top = `${((i - startHour) / (endHour - startHour)) * 100}%`;
            div.textContent = `${i}:00`; timeLabels.appendChild(div);
        }
    }

    // Configurar Selector
    const sel = document.getElementById('schedule-selector'); sel.innerHTML = '';
    document.getElementById('calendar-title').innerText = `${titulo}: ${schedulesList.length}`;

    if (schedulesList.length === 0) {
        sel.innerHTML = '<option>Vacio</option>'; sel.disabled = true;
        document.querySelectorAll('.day-grid').forEach(g => g.innerHTML = '');
        return;
    }

    sel.disabled = false;
    schedulesList.forEach((_, i) => sel.innerHTML += `<option value="${i}">Opción ${i + 1} de ${schedulesList.length}</option>`);

    // Configurar Sub-Pestañas Grupales
    const subTabs = document.getElementById('sub-tabs-container');
    subTabs.style.display = isGroupMode ? 'flex' : 'none';
    if (isGroupMode) {
        subTabs.innerHTML = `<button class="sub-tab-btn active" onclick="setSubTab('Todos')">Mapa General</button>`;
        groupStudents.forEach(stu => {
            subTabs.innerHTML += `<button class="sub-tab-btn" onclick="setSubTab('${stu.name}')">${stu.name}</button>`;
        });
        currentSubTab = 'Todos';
    }

    renderSchedule(0);
}

function setSubTab(tabName) {
    currentSubTab = tabName;
    document.querySelectorAll('.sub-tab-btn').forEach(b => {
        if(b.innerText === (tabName === 'Todos' ? 'Mapa General' : tabName)) b.classList.add('active');
        else b.classList.remove('active');
    });
    renderSchedule(currentIndex);
}

function changeSchedule(step) {
    let newI = currentIndex + step;
    if (newI >= 0 && newI < schedulesList.length) {
        document.getElementById('schedule-selector').value = newI;
        renderSchedule(newI);
    }
}

function renderSchedule(index) {
    currentIndex = index;
    document.getElementById('btn-prev').disabled = (index === 0);
    document.getElementById('btn-next').disabled = (index === schedulesList.length - 1);
    document.querySelectorAll('.day-grid').forEach(g => g.innerHTML = '');
    
    if (!schedulesList[index]) return;
    actualizarBotonFavorito();

    let scheduleToRender = schedulesList[index];

    // Si estamos en modo grupal y seleccionamos a un alumno, filtrar
    if (isGroupMode && currentSubTab !== 'Todos') {
        scheduleToRender = scheduleToRender.filter(c => c.alumnos.includes(currentSubTab));
    }

    scheduleToRender.forEach((curso, idx) => {
        const color = obtenerColorCurso(curso.curso);
        const icon = curso.sede.toLowerCase().includes('virtual') ? '💻' : '🏫';
        const prof = curso.profesor || 'Sin profesor';

        // Badges de alumnos (solo en Mapa General)
        let badgesHtml = '';
        if (isGroupMode && currentSubTab === 'Todos' && curso.alumnos) {
            badgesHtml = `<div class="student-badge-container">` + 
                         curso.alumnos.map(a => `<span class="student-badge">${a}</span>`).join('') + 
                         `</div>`;
        }

        curso.sesiones.forEach(sesion => {
            const grid = document.getElementById(`grid-${sesion.dia}`);
            if (!grid) return;
            const topP = ((parseTime(sesion.inicio) - startHour * 60) / totalMinutes) * 100;
            const hP = ((parseTime(sesion.fin) - parseTime(sesion.inicio)) / totalMinutes) * 100;

            grid.innerHTML += `
                <div class="class-block" style="top:${topP}%; height:${hP}%; background-color:${color}; z-index:${idx};">
                    <div class="class-title"><span>${curso.curso}</span><span class="icon" title="${curso.sede}">${icon}</span></div>
                    <div class="class-prof">👨‍🏫 ${prof}</div>
                    ${badgesHtml}
                    <div class="class-details"><strong>${curso.seccion}</strong> - ${curso.sede}<br>${sesion.inicio} a ${sesion.fin}</div>
                </div>`;
        });
    });
}

// ==========================================
// --- CRUD DEL CATÁLOGO (ADMIN) ---
// ==========================================

function setBuilderStatus(message, isError = false) {
    const status = document.getElementById('builder-status');
    if (!status) return;
    status.style.color = isError ? '#e74c3c' : '#27ae60';
    status.innerText = message;
}

function actualizarSelectorCursosServidor() {
    const select = document.getElementById('builder-course-select');
    if (!select) return;
    const selectedValue = select.value;
    select.innerHTML = '<option value="">-- Selecciona un curso --</option>';
    builderCursosServidor.forEach(curso => {
        const option = document.createElement('option');
        option.value = String(curso.id);
        option.textContent = curso.nombre || `Curso ${curso.id}`;
        select.appendChild(option);
    });

    if (builderCursoActualId) {
        select.value = String(builderCursoActualId);
    } else if (selectedValue) {
        select.value = selectedValue;
    }
}

async function cargarCursosServidor() {
    setBuilderStatus('Cargando cursos del servidor...');
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/cursos`);
        if (!response.ok) {
            const mensaje = await response.text();
            throw new Error(mensaje || 'No se pudo cargar el catálogo admin.');
        }
        const data = await response.json();
        builderCursosServidor = Array.isArray(data) ? data : [];
        actualizarSelectorCursosServidor();
        if (builderCursosServidor.length === 0) {
            setBuilderStatus('No hay cursos guardados en el servidor.');
        } else {
            setBuilderStatus(`Cursos disponibles en el servidor: ${builderCursosServidor.length}.`);
        }
    } catch (error) {
        console.error(error);
        setBuilderStatus('No se pudo cargar el catálogo del servidor.', true);
    }
}

function aplicarCursoServidor(curso) {
    if (!curso) return;
    builderCursoActualId = curso.id;
    document.getElementById('builder-course-name').value = curso.nombre || '';
    editorData = (curso.secciones || []).map(seccion => ({
        seccion: seccion.codigo || '',
        sede: seccion.sede || '',
        profesor: seccion.profesor || '',
        sesiones: (seccion.sesiones || []).map(sesion => ({
            dia: sesion.dia,
            inicio: sesion.horaInicio,
            fin: sesion.horaFin
        }))
    }));
    renderBuilder();
    setBuilderStatus(`Curso "${curso.nombre}" cargado desde el servidor.`);
    actualizarSelectorCursosServidor();
}

function cargarCursoServidorSeleccionado() {
    const select = document.getElementById('builder-course-select');
    if (!select || !select.value) {
        setBuilderStatus('Selecciona un curso del servidor para cargar.', true);
        return;
    }
    const cursoId = Number(select.value);
    const curso = builderCursosServidor.find(item => item.id === cursoId);
    if (!curso) {
        setBuilderStatus('Curso no encontrado. Actualiza la lista.', true);
        return;
    }
    aplicarCursoServidor(curso);
}

async function eliminarSeccionesCursoServidor(cursoId) {
    const response = await fetch(`${API_BASE_URL}/api/admin/secciones?cursoId=${encodeURIComponent(cursoId)}`);
    if (!response.ok) {
        const mensaje = await response.text();
        throw new Error(mensaje || 'No se pudieron cargar las secciones.');
    }
    const secciones = await response.json();
    if (!Array.isArray(secciones)) return;
    for (const seccion of secciones) {
        const deleteResponse = await fetch(`${API_BASE_URL}/api/admin/secciones/${seccion.id}`, { method: 'DELETE' });
        if (!deleteResponse.ok) {
            const mensaje = await deleteResponse.text();
            throw new Error(mensaje || 'No se pudo eliminar una sección.');
        }
    }
}

async function guardarCursoServidor() {
    const nombreCurso = document.getElementById('builder-course-name').value.trim();
    if (!nombreCurso) {
        setBuilderStatus('El nombre del curso es obligatorio.', true);
        return;
    }
    if (!Array.isArray(editorData) || editorData.length === 0) {
        setBuilderStatus('Agrega al menos una sección antes de guardar.', true);
        return;
    }

    for (const sec of editorData) {
        if (!sec.seccion || !sec.sede) {
            setBuilderStatus('Todas las secciones necesitan código y sede.', true);
            return;
        }
        if (!Array.isArray(sec.sesiones) || sec.sesiones.length === 0) {
            setBuilderStatus(`La sección ${sec.seccion || '(sin código)'} no tiene horarios.`, true);
            return;
        }
        for (const sesion of sec.sesiones) {
            if (!sesion.dia || !sesion.inicio || !sesion.fin) {
                setBuilderStatus('Completa día y horas de cada sesión.', true);
                return;
            }
        }
    }

    setBuilderStatus('Guardando curso en el servidor...');

    try {
        let cursoId = builderCursoActualId;
        if (!cursoId) {
            const response = await fetch(`${API_BASE_URL}/api/admin/cursos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: nombreCurso })
            });
            if (!response.ok) {
                const mensaje = await response.text();
                throw new Error(mensaje || 'No se pudo crear el curso.');
            }
            const created = await response.json();
            cursoId = created.id;
        } else {
            const response = await fetch(`${API_BASE_URL}/api/admin/cursos/${cursoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: nombreCurso })
            });
            if (!response.ok) {
                const mensaje = await response.text();
                throw new Error(mensaje || 'No se pudo actualizar el curso.');
            }
            await eliminarSeccionesCursoServidor(cursoId);
        }

        for (const sec of editorData) {
            const response = await fetch(`${API_BASE_URL}/api/admin/secciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cursoId,
                    codigo: sec.seccion.trim(),
                    sede: sec.sede.trim(),
                    profesor: (sec.profesor || '').trim()
                })
            });
            if (!response.ok) {
                const mensaje = await response.text();
                throw new Error(mensaje || 'No se pudo crear una sección.');
            }
            const seccionCreada = await response.json();
            const seccionId = seccionCreada.id;

            for (const sesion of sec.sesiones) {
                const sesionResponse = await fetch(`${API_BASE_URL}/api/admin/sesiones`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        seccionId,
                        dia: sesion.dia,
                        horaInicio: sesion.inicio,
                        horaFin: sesion.fin
                    })
                });
                if (!sesionResponse.ok) {
                    const mensaje = await sesionResponse.text();
                    throw new Error(mensaje || 'No se pudo crear una sesión.');
                }
            }
        }

        builderCursoActualId = cursoId;
        await cargarCursosServidor();
        setBuilderStatus('Curso guardado correctamente en el servidor.');
    } catch (error) {
        console.error(error);
        setBuilderStatus(error.message || 'No se pudo guardar el curso en el servidor.', true);
    }
}

async function eliminarCursoServidor() {
    const select = document.getElementById('builder-course-select');
    const cursoId = builderCursoActualId || (select && select.value ? Number(select.value) : null);
    if (!cursoId) {
        setBuilderStatus('Selecciona un curso cargado para eliminar.', true);
        return;
    }

    setBuilderStatus('Eliminando curso del servidor...');
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/cursos/${cursoId}`, { method: 'DELETE' });
        if (!response.ok) {
            const mensaje = await response.text();
            throw new Error(mensaje || 'No se pudo eliminar el curso.');
        }
        builderCursoActualId = null;
        editorData = [];
        document.getElementById('builder-course-name').value = '';
        renderBuilder();
        await cargarCursosServidor();
        setBuilderStatus('Curso eliminado del servidor.');
    } catch (error) {
        console.error(error);
        setBuilderStatus(error.message || 'No se pudo eliminar el curso.', true);
    }
}

// ==========================================
// --- LÓGICA DEL EDITOR DE CURSOS (JSON) ---
// ==========================================

async function cargarJsonParaEditar(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const json = JSON.parse(text);
        
        // Validar que el archivo sea una lista (array)
        if (!Array.isArray(json)) {
            alert("El archivo no tiene el formato correcto. Debe ser una lista de secciones.");
            event.target.value = ''; 
            return;
        }

        // Normalizar los datos para evitar errores con JSON viejos
        editorData = json.map(sec => ({
            seccion: sec.seccion || "",
            sede: sec.sede || "Villa",
            profesor: sec.profesor || "",
            sesiones: Array.isArray(sec.sesiones) ? sec.sesiones : []
        }));

        builderCursoActualId = null;
        document.getElementById('builder-course-name').value = file.name.replace('.json', '');
        renderBuilder();
        actualizarSelectorCursosServidor();
        setBuilderStatus(`JSON cargado: ${file.name}. Puedes guardar en el servidor si quieres.`);

    } catch (e) {
        console.error(e);
        alert("Error al leer el archivo JSON. Verifica que no esté corrupto.");
    }
    
    event.target.value = ''; // Resetear el input
}

function agregarSeccionEnBlanco() {
    editorData.push({ seccion: "", sede: "Villa", profesor: "", sesiones: [] });
    renderBuilder();
}

function eliminarSeccion(index) {
    editorData.splice(index, 1);
    renderBuilder();
}

function eliminarSesion(secIndex, sesIndex) {
    editorData[secIndex].sesiones.splice(sesIndex, 1);
    renderBuilder();
}

function actualizarDatoSeccion(index, campo, valor) {
    editorData[index][campo] = valor;
}

function renderBuilder() {
    const container = document.getElementById('sections-container');
    container.innerHTML = '';

    editorData.forEach((sec, i) => {
        let sesionesHtml = '';
        if (sec.sesiones.length === 0) {
            sesionesHtml = '<div style="color:#999; font-size:12px; margin-bottom:10px;">Sin horarios asignados.</div>';
        } else {
            sec.sesiones.forEach((ses, j) => {
                sesionesHtml += `
                    <div class="session-item">
                        <span><strong>${ses.dia}</strong>: ${ses.inicio} - ${ses.fin}</span>
                        <button class="btn-delete" onclick="eliminarSesion(${i}, ${j})">X</button>
                    </div>`;
            });
        }

        container.innerHTML += `
            <div class="section-card">
                <div class="section-card-header">
                    <h4>Sección ${i + 1}</h4>
                    <button class="btn-delete" onclick="eliminarSeccion(${i})">Eliminar Sección</button>
                </div>
                <div class="section-grid">
                    <div class="input-group">
                        <label>Código de Sección</label>
                        <input type="text" value="${sec.seccion}" onchange="actualizarDatoSeccion(${i}, 'seccion', this.value)" placeholder="Ej. SW41">
                    </div>
                    <div class="input-group">
                        <label>Sede</label>
                        <input type="text" value="${sec.sede}" onchange="actualizarDatoSeccion(${i}, 'sede', this.value)" placeholder="Ej. Villa o Virtual">
                    </div>
                    <div class="input-group">
                        <label>Profesor</label>
                        <input type="text" value="${sec.profesor || ''}" onchange="actualizarDatoSeccion(${i}, 'profesor', this.value)" placeholder="Nombre del Profesor">
                    </div>
                </div>
                <div class="session-list">
                    <h5 style="margin:0 0 10px 0; color:#2c3e50;">Horarios de la Sección:</h5>
                    ${sesionesHtml}
                    <button class="btn-secondary" onclick="abrirModal(${i})" style="font-size:12px; padding: 5px 10px;">+ Añadir Horario</button>
                </div>
            </div>
        `;
    });
}

function abrirModal(sectionIndex) {
    currentTargetSectionIndex = sectionIndex;
    document.getElementById('modal-inicio').value = "";
    document.getElementById('modal-fin').value = "";
    document.getElementById('session-modal').classList.add('active');
}

function cerrarModal() {
    document.getElementById('session-modal').classList.remove('active');
}

function guardarSesion() {
    const dia = document.getElementById('modal-dia').value;
    const inicio = document.getElementById('modal-inicio').value;
    const fin = document.getElementById('modal-fin').value;

    if (!inicio || !fin) { alert("Llena las horas de inicio y fin."); return; }

    editorData[currentTargetSectionIndex].sesiones.push({ dia, inicio, fin });
    cerrarModal();
    renderBuilder();
}

function descargarJSON() {
    const nombreCurso = document.getElementById('builder-course-name').value.trim() || "Nuevo Curso";
    
    // Validar secciones vacías
    for (let sec of editorData) {
        if (!sec.seccion) { alert("Asegúrate de que todas las secciones tengan un Código."); return; }
        if (sec.sesiones.length === 0) { alert(`La sección ${sec.seccion} no tiene horarios.`); return; }
    }

    const dataStr = JSON.stringify(editorData, null, 4);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nombreCurso}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    return nombreCurso;
}

function enviarPorCorreo() {
    const nombreCurso = descargarJSON();
    if (!nombreCurso) return;
    const asunto = encodeURIComponent('Nuevo Curso para Horarios Pro');
    const cuerpo = encodeURIComponent('Adjunto el JSON de mi curso. Pruebas de que funciona: [Escribe aquí]');
    window.location.href = `mailto:${ADMIN_EMAIL}?subject=${asunto}&body=${cuerpo}`;
}

async function hashSHA256(texto) {
    const encoder = new TextEncoder();
    const data = encoder.encode(texto);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function validarYMostrarPanelAdmin() {
    const password = document.getElementById('admin-password-input').value;
    if (!password) { alert('Ingresa la clave de administrador.'); return; }

    const statusEl = document.getElementById('admin-upload-status');
    statusEl.textContent = '⏳ Validando clave...';

    try {
        const token = await hashSHA256(password);
        const respuesta = await fetch(`${API_BASE_URL}/api/admin/cursos/validate`, {
            method: 'GET',
            headers: { 'X-Admin-Token': token }
        });

        if (respuesta.status === 401) {
            statusEl.textContent = '❌ Clave incorrecta.';
            document.getElementById('admin-panel').style.display = 'none';
            return;
        }
        if (!respuesta.ok) {
            statusEl.textContent = '❌ Error al validar la clave.';
            return;
        }

        document.getElementById('admin-panel').style.display = 'block';
        statusEl.textContent = '✅ Clave válida. Puedes subir el JSON oficial.';
    } catch (err) {
        statusEl.textContent = `❌ Error de conexión: ${err.message}`;
    }
}

async function subirJsonOficial(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('admin-upload-status');
    const password = document.getElementById('admin-password-input').value;
    if (!password) { alert('Ingresa la clave de administrador antes de subir.'); return; }

    const nombreCurso = document.getElementById('builder-course-name').value.trim() || file.name.replace('.json', '');

    try {
        statusEl.textContent = '⏳ Procesando...';
        const token = await hashSHA256(password);
        const contenido = await file.text();
        const secciones = JSON.parse(contenido);

        const payload = { nombre: nombreCurso, secciones };

        const respuesta = await fetch(`${API_BASE_URL}/api/admin/cursos/upload-json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Token': token
            },
            body: JSON.stringify(payload)
        });

        if (respuesta.status === 401) {
            statusEl.textContent = '❌ Acceso denegado: clave incorrecta.';
            return;
        }
        if (!respuesta.ok) {
            const error = await respuesta.text();
            statusEl.textContent = `❌ Error del servidor: ${error}`;
            return;
        }

        const resultado = await respuesta.json();
        statusEl.textContent = `✅ Curso "${resultado.nombre}" subido correctamente (ID: ${resultado.id}).`;
        await cargarCursosServidor();
    } catch (err) {
        statusEl.textContent = `❌ Error: ${err.message}`;
    } finally {
        event.target.value = '';
    }
}