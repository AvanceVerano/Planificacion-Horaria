// --- VARIABLES GLOBALES ---
const startHour = 7, endHour = 22;
const totalMinutes = (endHour - startHour) * 60;
const paletaColores = ['#4A90E2', '#E74C3C', '#50E3C2', '#F5A623', '#9B59B6', '#34495E', '#16A085', '#D35400'];
let colorIndex = 0;
let coloresPorCurso = {};

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

// --- MODO INDIVIDUAL ---
async function procesarArchivosInd(event) {
    const archivos = event.target.files;
    if (archivos.length === 0) return;
    cursosDataInd = {}; sedesInd.clear();
    for (let f of archivos) {
        const nombre = f.name.replace('.json', '');
        const json = JSON.parse(await f.text());
        cursosDataInd[nombre] = json;
        json.forEach(s => sedesInd.add(s.sede));
    }
    document.getElementById('file-list-preview-ind').innerText = `${archivos.length} archivos cargados.`;
    
    // Render Checkboxes
    const sedesCont = document.getElementById('sedes-container'); sedesCont.innerHTML = '';
    Array.from(sedesInd).forEach(s => sedesCont.innerHTML += `<label class="checkbox-item"><input type="checkbox" class="chk-sede" value="${s}" checked> ${s}</label>`);
    const cursosCont = document.getElementById('cursos-container'); cursosCont.innerHTML = '';
    Object.keys(cursosDataInd).forEach(c => cursosCont.innerHTML += `<label class="checkbox-item"><input type="checkbox" class="chk-curso" value="${c}" checked> ${c}</label>`);
    
    document.getElementById('btn-generar').disabled = false;
}

function iniciarGeneracionInd() {
    const cursosReq = Array.from(document.querySelectorAll('.chk-curso:checked')).map(cb => cb.value);
    const sedesReq = Array.from(document.querySelectorAll('.chk-sede:checked')).map(cb => cb.value);
    horariosInd = [];
    
    function choca(horario, nuevaSec) {
        return horario.some(sec => sec.sesiones.some(s1 => nuevaSec.sesiones.some(s2 => hayColision(s1, s2))));
    }

    function buscar(idx, actual) {
        if (idx === cursosReq.length) { horariosInd.push([...actual]); return; }
        let curso = cursosReq[idx];
        for (let sec of (cursosDataInd[curso] || [])) {
            if (!sedesReq.includes(sec.sede)) continue;
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

// --- MODO GRUPAL ---
let sedesGrpGlobales = new Set(); // Guarda las sedes de todos los JSON del grupo

function generarTarjetasAlumnos() {
    const n = document.getElementById('num-students').value;
    const cont = document.getElementById('students-container');
    cont.innerHTML = '';
    groupStudents = [];
    sedesGrpGlobales.clear(); // Limpiamos sedes previas
    document.getElementById('group-filters-section').style.display = 'none';

    for (let i = 0; i < n; i++) {
        groupStudents.push({ name: `Alumno ${i+1}`, courses: [], data: {} });
        cont.innerHTML += `
            <div class="student-card">
                <div class="student-info">
                    <label style="font-weight:bold; color: #2c3e50;">Nombre:</label>
                    <input type="text" value="Alumno ${i+1}" onchange="groupStudents[${i}].name = this.value" style="margin-bottom: 10px;">
                    <div id="stu-courses-${i}" class="student-courses-list">Cursos: 0 cargados</div>
                </div>
                <div class="student-drop" 
                     ondragover="allowDropGrp(event)" 
                     ondragleave="leaveDropGrp(event)" 
                     ondrop="dropStudentFiles(event, ${i})" 
                     onclick="document.getElementById('file-input-grp-${i}').click()">
                    
                    <p style="margin: 0; color: var(--primary); font-weight: bold;">📂 Clic o Arrastra JSONs</p>
                    <small style="color: #7f8c8d; margin-top: 5px;">Archivos de este alumno</small>
                    
                    <input type="file" id="file-input-grp-${i}" multiple accept=".json" style="display:none;" onchange="readStudentFiles(event, ${i})">
                </div>
            </div>`;
    }
    document.getElementById('btn-generar-grupo').style.display = 'block';
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

async function readStudentFiles(event, index) {
    const files = event.target.files || event.dataTransfer.files;
    let student = groupStudents[index];
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
    
    document.getElementById(`stu-courses-${index}`).innerText = `Cursos: ${student.courses.join(', ')}`;
    actualizarFiltrosGrupales();
}

function actualizarFiltrosGrupales() {
    const section = document.getElementById('group-filters-section');
    const container = document.getElementById('sedes-container-grp');
    container.innerHTML = '';
    
    if (sedesGrpGlobales.size > 0) {
        section.style.display = 'block';
        Array.from(sedesGrpGlobales).sort().forEach(sede => {
            container.innerHTML += `
                <label class="checkbox-item">
                    <input type="checkbox" class="chk-sede-grp" value="${sede}" checked> ${sede}
                </label>`;
        });
    }
}

function iniciarGeneracionGrupal() {
    let globalCoursesSet = new Set();
    let globalData = {};

    // Obtener filtros seleccionados
    const sedesPermitidas = Array.from(document.querySelectorAll('.chk-sede-grp:checked')).map(cb => cb.value);
    
    if (sedesPermitidas.length === 0) {
        alert("Debes seleccionar al menos una sede permitida en los filtros grupales.");
        return;
    }

    // Fusionar todos los cursos requeridos
    groupStudents.forEach(stu => {
        stu.courses.forEach(c => {
            globalCoursesSet.add(c);
            if (!globalData[c]) globalData[c] = stu.data[c]; 
        });
    });

    let globalCourses = Array.from(globalCoursesSet);
    horariosGrp = [];

    function buscarGrp(idx, actualSchedule) {
        if (idx === globalCourses.length) { horariosGrp.push([...actualSchedule]); return; }
        
        let courseName = globalCourses[idx];
        let sections = globalData[courseName] || [];

        for (let sec of sections) {
            // APLICAMOS EL FILTRO GRUPAL: Si la sede no está permitida, descartar
            if (!sedesPermitidas.includes(sec.sede)) continue;

            let isValidForAll = true;
            
            for (let stu of groupStudents) {
                if (stu.courses.includes(courseName)) {
                    let personalSchedule = actualSchedule.filter(s => stu.courses.includes(s.curso));
                    let choca = personalSchedule.some(existente => 
                        existente.sesiones.some(s1 => sec.sesiones.some(s2 => hayColision(s1, s2)))
                    );
                    
                    if (choca) { isValidForAll = false; break; }
                }
            }

            if (isValidForAll) {
                actualSchedule.push({...sec, curso: courseName});
                buscarGrp(idx + 1, actualSchedule);
                actualSchedule.pop();
            }
        }
    }
    
    buscarGrp(0, []);

    // --- NUEVA VALIDACIÓN DE RESULTADOS VACÍOS ---
    if (horariosGrp.length === 0) {
        document.getElementById('error-msg-group').innerText = "No se encontró ninguna combinación grupal sin cruces. Intenten flexibilizar las sedes o quitar algún curso conflictivo.";
        return; // Detiene el código, no cambia de pantalla
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

        document.getElementById('builder-course-name').value = file.name.replace('.json', '');
        renderBuilder();

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
}