using HorariosPro.Api.Contracts;
using HorariosPro.Api.Models;

namespace HorariosPro.Api.Services;

public class HorarioGenerator
{
    /// <summary>
    /// Generates all valid individual schedules using Backtracking + Bitmask collision detection.
    ///
    /// Strategy:
    ///   1. Pre-compute int[6] bitmasks for each candidate section and for the user's blocks.
    ///   2. Pre-filter sections that conflict with sede rules or user blocks (O(1) via bitmask AND).
    ///   3. Order courses by fewest valid sections (fail-fast heuristic).
    ///   4. DFS with a running mascaraActual[6] accumulator:
    ///        - Push : mascaraActual[d] |= seccion.Mascaras[d]          (Bitwise OR)
    ///        - Check: (mascaraActual[d] AND seccion.Mascaras[d]) != 0  → colisión
    ///        - Pop  : mascaraActual[d] = mascaraActual[d] AND NOT seccion.Mascaras[d]
    /// </summary>
    public List<HorarioResultadoDto> GenerarIndividual(
        IEnumerable<Curso> cursos,
        ScheduleFilters filters,
        Dictionary<string, BloqueoDiaDto>? bloqueos)
    {
        var cursosList = cursos.ToList();

        // Pre-compute the block bitmask once for all candidate evaluations.
        var mascaraBloqueos = BitmaskHelper.BloqueosToBitmasks(bloqueos);

        // Pre-compute section bitmasks and filter out invalid sections.
        var cursoSecciones = cursosList.ToDictionary(
            curso => curso.Nombre,
            curso => curso.Secciones
                .Select(sec => new SectionWithMask(curso.Nombre, sec, BitmaskHelper.SeccionToBitmasks(sec)))
                .Where(sw => filters.Permite(sw.Seccion)
                          && !BitmaskHelper.ChocaConMascara(sw.Mascaras, mascaraBloqueos))
                .ToList(),
            StringComparer.OrdinalIgnoreCase);

        // Order by fewest options first (fail-fast).
        var ordenCursos = cursosList
            .OrderBy(curso => cursoSecciones.TryGetValue(curso.Nombre, out var s) ? s.Count : 0)
            .Select(curso => curso.Nombre)
            .ToList();

        var resultados = new List<HorarioResultadoDto>();
        var actual     = new List<SectionWithMask>();

        // mascaraActual[d] accumulates the bits of all sections added so far on day d.
        var mascaraActual = new int[6];

        BuscarIndividual(ordenCursos, cursoSecciones, mascaraBloqueos, 0, actual, mascaraActual, resultados);

        return resultados;
    }

    /// <summary>
    /// Generates all valid group schedules ensuring each student's personal blocks and
    /// cross-student section compatibility are respected, using Bitmask collision detection.
    /// </summary>
    public List<HorarioResultadoDto> GenerarGrupal(
        IEnumerable<Curso> cursos,
        List<EstudiantePlan> estudiantes,
        ScheduleFilters filters)
    {
        var cursosList = cursos.ToList();

        // Pre-compute per-student block bitmasks.
        var mascarasBloqueosPorEstudiante = estudiantes
            .Select(e => BitmaskHelper.BloqueosToBitmasks(e.Bloqueos))
            .ToArray();

        // Pre-compute section bitmasks, filtering by sede and every student's blocks.
        var cursoSecciones = new Dictionary<string, List<SectionWithMask>>(StringComparer.OrdinalIgnoreCase);
        foreach (var curso in cursosList)
        {
            // Indices of students who share this course.
            var idxEstudiantesDelCurso = estudiantes
                .Select((e, i) => (Estudiante: e, Indice: i))
                .Where(x => x.Estudiante.Cursos.Contains(curso.Nombre))
                .Select(x => x.Indice)
                .ToArray();

            cursoSecciones[curso.Nombre] = curso.Secciones
                .Select(sec => new SectionWithMask(curso.Nombre, sec, BitmaskHelper.SeccionToBitmasks(sec)))
                .Where(sw =>
                {
                    if (!filters.Permite(sw.Seccion)) return false;
                    // Discard if any student who shares this course has a block conflict.
                    foreach (var idx in idxEstudiantesDelCurso)
                        if (BitmaskHelper.ChocaConMascara(sw.Mascaras, mascarasBloqueosPorEstudiante[idx]))
                            return false;
                    return true;
                })
                .ToList();
        }

        var cursosOrdenados = cursosList
            .OrderBy(curso => cursoSecciones.TryGetValue(curso.Nombre, out var s) ? s.Count : 0)
            .Select(curso => curso.Nombre)
            .ToList();

        var resultados = new List<HorarioResultadoDto>();
        var actual     = new List<SectionWithMask>();

        // mascarasPorEstudiante[i][d] = accumulated bitmask for student i on day d.
        var mascarasPorEstudiante = estudiantes.Select(_ => new int[6]).ToArray();

        BuscarGrupal(cursosOrdenados, cursoSecciones, estudiantes, mascarasBloqueosPorEstudiante,
                     0, actual, mascarasPorEstudiante, resultados);

        return resultados;
    }

    // -------------------------------------------------------------------------
    //  DFS — Individual
    // -------------------------------------------------------------------------

    private static void BuscarIndividual(
        IReadOnlyList<string> cursos,
        IReadOnlyDictionary<string, List<SectionWithMask>> cursoSecciones,
        int[] mascaraBloqueos,
        int indice,
        List<SectionWithMask> actual,
        int[] mascaraActual,
        List<HorarioResultadoDto> resultados)
    {
        if (indice == cursos.Count)
        {
            resultados.Add(BuildResultado(actual));
            return;
        }

        var curso = cursos[indice];
        if (!cursoSecciones.TryGetValue(curso, out var secciones) || secciones.Count == 0) return;

        foreach (var sw in secciones)
        {
            // Validación 1 — ¿Choca con el horario ya armado? (O(1) Bitwise AND)
            if (BitmaskHelper.ChocaConMascara(sw.Mascaras, mascaraActual)) continue;

            // Validación 2 — ¿Choca con los bloqueos del usuario? (O(1) Bitwise AND)
            // Note: sections were already pre-filtered above; this is a safety guard.
            if (BitmaskHelper.ChocaConMascara(sw.Mascaras, mascaraBloqueos)) continue;

            // Push: add the section's bits to the running accumulator with Bitwise OR.
            for (int d = 0; d < 6; d++) mascaraActual[d] |= sw.Mascaras[d];
            actual.Add(sw);

            BuscarIndividual(cursos, cursoSecciones, mascaraBloqueos, indice + 1, actual, mascaraActual, resultados);

            // Pop: undo the OR by clearing only the section's bits with Bitwise AND NOT.
            actual.RemoveAt(actual.Count - 1);
            for (int d = 0; d < 6; d++) mascaraActual[d] &= ~sw.Mascaras[d];
        }
    }

    // -------------------------------------------------------------------------
    //  DFS — Grupal
    // -------------------------------------------------------------------------

    private static void BuscarGrupal(
        IReadOnlyList<string> cursos,
        IReadOnlyDictionary<string, List<SectionWithMask>> cursoSecciones,
        IReadOnlyList<EstudiantePlan> estudiantes,
        int[][] mascarasBloqueosPorEstudiante,
        int indice,
        List<SectionWithMask> actual,
        int[][] mascarasPorEstudiante,
        List<HorarioResultadoDto> resultados)
    {
        if (indice == cursos.Count)
        {
            resultados.Add(BuildResultado(actual));
            return;
        }

        var curso = cursos[indice];
        if (!cursoSecciones.TryGetValue(curso, out var secciones) || secciones.Count == 0) return;

        // Pre-compute the student indices that share this course (avoids repeated LINQ in the loop).
        var idxEstudiantesDelCurso = estudiantes
            .Select((e, i) => (Estudiante: e, Indice: i))
            .Where(x => x.Estudiante.Cursos.Contains(curso))
            .Select(x => x.Indice)
            .ToArray();

        foreach (var sw in secciones)
        {
            // Check each student who shares this course for collisions in their personal schedule.
            bool esValida = true;
            foreach (var idx in idxEstudiantesDelCurso)
            {
                // Validación 1 — ¿Choca con el horario ya armado del alumno? (O(1))
                if (BitmaskHelper.ChocaConMascara(sw.Mascaras, mascarasPorEstudiante[idx]))
                {
                    esValida = false;
                    break;
                }

                // Validación 2 — ¿Choca con los bloqueos personales del alumno? (O(1))
                // Safety guard; sections were pre-filtered but this makes intent explicit.
                if (BitmaskHelper.ChocaConMascara(sw.Mascaras, mascarasBloqueosPorEstudiante[idx]))
                {
                    esValida = false;
                    break;
                }
            }
            if (!esValida) continue;

            // Push: Bitwise OR into every sharing student's accumulator.
            foreach (var idx in idxEstudiantesDelCurso)
                for (int d = 0; d < 6; d++) mascarasPorEstudiante[idx][d] |= sw.Mascaras[d];
            actual.Add(sw);

            BuscarGrupal(cursos, cursoSecciones, estudiantes, mascarasBloqueosPorEstudiante,
                         indice + 1, actual, mascarasPorEstudiante, resultados);

            // Pop: Bitwise AND NOT to undo the OR for each sharing student.
            actual.RemoveAt(actual.Count - 1);
            foreach (var idx in idxEstudiantesDelCurso)
                for (int d = 0; d < 6; d++) mascarasPorEstudiante[idx][d] &= ~sw.Mascaras[d];
        }
    }

    // -------------------------------------------------------------------------
    //  Result builder
    // -------------------------------------------------------------------------

    private static HorarioResultadoDto BuildResultado(List<SectionWithMask> actual)
    {
        var items = actual.Select(sw => new HorarioItemDto(
                sw.Seccion.CursoId,
                sw.Curso,
                new SeccionDto(
                    sw.Seccion.Id,
                    sw.Seccion.Codigo,
                    sw.Seccion.Sede,
                    sw.Seccion.Profesor,
                    sw.Seccion.Sesiones
                        .Select(sesion => new SesionDto(
                            sesion.Dia,
                            TimeParser.ToDisplay(sesion.HoraInicio),
                            TimeParser.ToDisplay(sesion.HoraFin)))
                        .ToList())))
            .ToList();

        return new HorarioResultadoDto(items);
    }

    // -------------------------------------------------------------------------
    //  Supporting types
    // -------------------------------------------------------------------------

    /// <summary>Filters schedule candidates by allowed campus locations.</summary>
    public sealed record ScheduleFilters(HashSet<string> Sedes)
    {
        public bool Permite(Seccion seccion)
        {
            if (Sedes.Count > 0 && !Sedes.Contains(seccion.Sede)) return false;
            return true;
        }
    }

    /// <summary>A student's name, course set, and personal time blocks.</summary>
    public sealed record EstudiantePlan(
        string Nombre,
        HashSet<string> Cursos,
        Dictionary<string, BloqueoDiaDto>? Bloqueos);

    /// <summary>A section together with its pre-computed bitmask (one int per day).</summary>
    private sealed record SectionWithMask(string Curso, Seccion Seccion, int[] Mascaras);
}