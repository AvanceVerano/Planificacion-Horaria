\# 🎓 Horarios Pro - Generador de Horarios Universitarios



Una aplicación web pura (HTML/CSS/JS) diseñada para resolver el problema de satisfacción de restricciones (CSP) al momento de armar horarios universitarios. Permite a los estudiantes generar todas las combinaciones posibles de sus clases, detectar cruces y hacer "match" grupal para compartir cursos con amigos.



\## ✨ Características Principales



\* \*\*Generador Individual:\*\* Sube los archivos JSON de tus cursos, filtra por sedes (ej. Villa, Virtual) y el algoritmo calculará todas las combinaciones viables sin cruces de horario.

\* \*\*Match Grupal (Multi-Agente):\*\* Diseñado para grupos de estudio. Ingresa los cursos de varios alumnos y el sistema priorizará que compartan la misma sección en las materias comunes, resolviendo los horarios individuales restantes sin conflictos.

\* \*\*Constructor de Cursos Integrado:\*\* Una interfaz visual para crear o editar los archivos JSON de las materias (secciones, sedes, profesores y sesiones) sin tocar código.

\* \*\*Gestión de Favoritos:\*\* Guarda tus combinaciones preferidas y expórtalas/impórtalas localmente.

\* \*\*100% Client-Side:\*\* Todo el procesamiento ocurre en la memoria del navegador. No requiere backend, bases de datos ni instalación de dependencias.



\## 🛠️ Tecnologías Utilizadas



\* \*\*Frontend:\*\* HTML5, CSS3, Vanilla JavaScript (ES6+).

\* \*\*Algoritmia:\*\* Búsqueda en Profundidad (DFS) y Backtracking para la evaluación de colisiones temporales y filtrado de ramas inválidas.

\* \*\*Formatos:\*\* JSON para la persistencia y transferencia de datos de los cursos.



\## 🚀 Cómo Usarlo



1\.  Clona el repositorio o descarga los archivos.

2\.  Abre `index.html` en cualquier navegador web moderno.

3\.  Dirígete a la pestaña \*\*Creador\*\* para estructurar tus cursos, o utiliza archivos JSON existentes.

4\.  En la pestaña \*\*Individual\*\* o \*\*Grupal\*\*, arrastra tus archivos `.json` a la zona de carga.

5\.  Aplica tus filtros de sede y presiona \*\*Generar\*\*.

6\.  Navega entre las opciones generadas y guarda tus favoritas.

7\.  Usa `Ctrl + P` (o `Cmd + P`) en la vista del calendario para exportar tu horario a PDF.



\## 📂 Estructura del JSON (Ejemplo)



El sistema espera que cada curso sea un archivo separado (ej. `Estructura de Datos.json`) con la siguiente estructura:



\\`\\`\\`json

\[

&#x20;   {

&#x20;       "seccion": "SW41",

&#x20;       "sede": "Villa",

&#x20;       "profesor": "Nombre del Docente",

&#x20;       "sesiones": \[

&#x20;           { "dia": "Lun", "inicio": "8:00am", "fin": "11:20am" }

&#x20;       ]

&#x20;   }

]

\\`\\`\\`



\## 👨‍💻 Autor



\*\*Fabrizio Santi\*\*

Estudiante de Ingeniería de Software.



\---

\*Si encuentras útil esta herramienta, ¡no dudes en darle una ⭐ al repositorio!\*

