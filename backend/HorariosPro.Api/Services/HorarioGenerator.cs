using HorariosPro.Api.Contracts;
using HorariosPro.Api.Models;

namespace HorariosPro.Api.Services;

public class HorarioGenerator
{
    public List<HorarioResultadoDto> GenerarIndividual(IEnumerable<Curso> cursos, ScheduleFilters filters)
    {
        var cursosList = cursos.ToList();
        var cursoSecciones = cursosList.ToDictionary(
            curso => curso.Nombre,
            curso => curso.Secciones.Where(seccion => filters.Permite(seccion)).ToList(),
            StringComparer.OrdinalIgnoreCase);

        var ordenCursos = cursosList
            .OrderBy(curso => cursoSecciones[curso.Nombre].Count)
            .Select(curso => curso.Nombre)
            .ToList();

        var resultados = new List<HorarioResultadoDto>();
        var actual = new List<SectionCandidate>();

        BuscarIndividual(ordenCursos, cursoSecciones, 0, actual, resultados);

        return resultados;
    }

    public List<HorarioResultadoDto> GenerarGrupal(IEnumerable<Curso> cursos, List<EstudiantePlan> estudiantes, ScheduleFilters filters)
    {
        var cursosList = cursos.ToList();
        var cursoSecciones = cursosList.ToDictionary(
            curso => curso.Nombre,
            curso => curso.Secciones.Where(seccion => filters.Permite(seccion)).ToList(),
            StringComparer.OrdinalIgnoreCase);

        var cursosOrdenados = cursosList
            .OrderBy(curso => cursoSecciones[curso.Nombre].Count)
            .Select(curso => curso.Nombre)
            .ToList();

        var resultados = new List<HorarioResultadoDto>();
        var actual = new List<SectionCandidate>();

        BuscarGrupal(cursosOrdenados, cursoSecciones, estudiantes, 0, actual, resultados);

        return resultados;
    }

    private static void BuscarIndividual(
        IReadOnlyList<string> cursos,
        IReadOnlyDictionary<string, List<Seccion>> cursoSecciones,
        int indice,
        List<SectionCandidate> actual,
        List<HorarioResultadoDto> resultados)
    {
        if (indice == cursos.Count)
        {
            resultados.Add(BuildResultado(actual));
            return;
        }

        var curso = cursos[indice];
        if (!cursoSecciones.TryGetValue(curso, out var secciones) || secciones.Count == 0)
        {
            return;
        }

        foreach (var seccion in secciones)
        {
            var candidato = new SectionCandidate(curso, seccion);
            if (TieneColision(candidato, actual))
            {
                continue;
            }

            actual.Add(candidato);
            BuscarIndividual(cursos, cursoSecciones, indice + 1, actual, resultados);
            actual.RemoveAt(actual.Count - 1);
        }
    }

    private static void BuscarGrupal(
        IReadOnlyList<string> cursos,
        IReadOnlyDictionary<string, List<Seccion>> cursoSecciones,
        IReadOnlyList<EstudiantePlan> estudiantes,
        int indice,
        List<SectionCandidate> actual,
        List<HorarioResultadoDto> resultados)
    {
        if (indice == cursos.Count)
        {
            resultados.Add(BuildResultado(actual));
            return;
        }

        var curso = cursos[indice];
        if (!cursoSecciones.TryGetValue(curso, out var secciones) || secciones.Count == 0)
        {
            return;
        }

        foreach (var seccion in secciones)
        {
            var candidato = new SectionCandidate(curso, seccion);
            if (!EsCompatibleConEstudiantes(candidato, actual, estudiantes))
            {
                continue;
            }

            actual.Add(candidato);
            BuscarGrupal(cursos, cursoSecciones, estudiantes, indice + 1, actual, resultados);
            actual.RemoveAt(actual.Count - 1);
        }
    }

    private static bool EsCompatibleConEstudiantes(SectionCandidate candidato, List<SectionCandidate> actual, IReadOnlyList<EstudiantePlan> estudiantes)
    {
        foreach (var estudiante in estudiantes)
        {
            if (!estudiante.Cursos.Contains(candidato.Curso))
            {
                continue;
            }

            var personal = actual
                .Where(item => estudiante.Cursos.Contains(item.Curso))
                .ToList();

            if (TieneColision(candidato, personal))
            {
                return false;
            }
        }

        return true;
    }

    private static bool TieneColision(SectionCandidate candidato, List<SectionCandidate> actual)
    {
        foreach (var existente in actual)
        {
            foreach (var sesionActual in existente.Seccion.Sesiones)
            {
                foreach (var sesionNueva in candidato.Seccion.Sesiones)
                {
                    if (EsColision(sesionActual, sesionNueva))
                    {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private static bool EsColision(Sesion a, Sesion b)
    {
        if (!string.Equals(a.Dia, b.Dia, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var inicio = a.HoraInicio > b.HoraInicio ? a.HoraInicio : b.HoraInicio;
        var fin = a.HoraFin < b.HoraFin ? a.HoraFin : b.HoraFin;
        return inicio < fin;
    }

    private static HorarioResultadoDto BuildResultado(List<SectionCandidate> actual)
    {
        var items = actual.Select(item => new HorarioItemDto(
                item.Seccion.CursoId,
                item.Curso,
                new SeccionDto(
                    item.Seccion.Id,
                    item.Seccion.Codigo,
                    item.Seccion.Sede,
                    item.Seccion.Profesor,
                    item.Seccion.Sesiones
                        .Select(sesion => new SesionDto(
                            sesion.Dia,
                            TimeParser.ToDisplay(sesion.HoraInicio),
                            TimeParser.ToDisplay(sesion.HoraFin)))
                        .ToList())))
            .ToList();

        return new HorarioResultadoDto(items);
    }

    public sealed record ScheduleFilters(
        HashSet<string> Sedes,
        HashSet<string> DiasLibres,
        TimeSpan? RangoInicio,
        TimeSpan? RangoFin)
    {
        public bool Permite(Seccion seccion)
        {
            if (Sedes.Count > 0 && !Sedes.Contains(seccion.Sede))
            {
                return false;
            }

            foreach (var sesion in seccion.Sesiones)
            {
                if (DiasLibres.Count > 0 && DiasLibres.Contains(sesion.Dia))
                {
                    return false;
                }

                if (RangoInicio.HasValue && sesion.HoraInicio < RangoInicio.Value)
                {
                    return false;
                }

                if (RangoFin.HasValue && sesion.HoraFin > RangoFin.Value)
                {
                    return false;
                }
            }

            return true;
        }
    }

    public sealed record EstudiantePlan(string Nombre, HashSet<string> Cursos);

    private sealed record SectionCandidate(string Curso, Seccion Seccion);
}
