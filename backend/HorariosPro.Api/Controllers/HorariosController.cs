using HorariosPro.Api.Contracts;
using HorariosPro.Api.Data;
using HorariosPro.Api.Models;
using HorariosPro.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HorariosPro.Api.Controllers;

[ApiController]
[Route("api/horarios")]
public class HorariosController : ControllerBase
{
    private readonly HorariosProDbContext _dbContext;
    private readonly HorarioGenerator _generator;

    public HorariosController(HorariosProDbContext dbContext, HorarioGenerator generator)
    {
        _dbContext = dbContext;
        _generator = generator;
    }

    [HttpPost("individual")]
    public async Task<ActionResult<List<HorarioResultadoDto>>> GenerarIndividual(
        [FromBody] HorarioIndividualRequest request,
        CancellationToken cancellationToken)
    {
        var filtros = BuildFilters(request.Sedes, request.DiasLibres, request.RangoHorario);
        if (filtros.Result is not null)
        {
            return filtros.Result;
        }

        var cursosSeleccionados = await ResolveCursosAsync(request.CursoIds, request.Cursos, cancellationToken);
        if (cursosSeleccionados.Result is not null)
        {
            return cursosSeleccionados.Result;
        }

        var resultados = _generator.GenerarIndividual(cursosSeleccionados.Value!, filtros.Value!);
        return Ok(resultados);
    }

    [HttpPost("grupal")]
    public async Task<ActionResult<List<HorarioResultadoDto>>> GenerarGrupal(
        [FromBody] HorarioGrupalRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Estudiantes.Count == 0)
        {
            return BadRequest("Se requiere al menos un estudiante.");
        }

        var filtros = BuildFilters(request.Sedes, request.DiasLibres, request.RangoHorario);
        if (filtros.Result is not null)
        {
            return filtros.Result;
        }

        var cursosIds = request.Estudiantes.SelectMany(e => e.CursoIds ?? new List<int>()).Distinct().ToList();
        var cursosNombres = request.Estudiantes.SelectMany(e => e.Cursos ?? new List<string>()).Distinct().ToList();

        var cursosSeleccionados = await ResolveCursosAsync(cursosIds, cursosNombres, cancellationToken);
        if (cursosSeleccionados.Result is not null)
        {
            return cursosSeleccionados.Result;
        }

        var cursosPorId = cursosSeleccionados.Value!.ToDictionary(c => c.Id);
        var cursosPorNombre = cursosSeleccionados.Value!.ToDictionary(c => c.Nombre, StringComparer.OrdinalIgnoreCase);

        var estudiantes = new List<HorarioGenerator.EstudiantePlan>();
        foreach (var estudiante in request.Estudiantes)
        {
            var cursosEstudiante = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            if (estudiante.CursoIds is { Count: > 0 })
            {
                foreach (var id in estudiante.CursoIds.Distinct())
                {
                    if (!cursosPorId.TryGetValue(id, out var curso))
                    {
                        return BadRequest($"CursoId inválido: {id}.");
                    }

                    cursosEstudiante.Add(curso.Nombre);
                }
            }

            if (estudiante.Cursos is { Count: > 0 })
            {
                foreach (var nombre in estudiante.Cursos.Distinct())
                {
                    if (!cursosPorNombre.TryGetValue(nombre, out var curso))
                    {
                        return BadRequest($"Curso inválido: {nombre}.");
                    }

                    cursosEstudiante.Add(curso.Nombre);
                }
            }

            if (cursosEstudiante.Count == 0)
            {
                return BadRequest($"El estudiante {estudiante.Nombre} no tiene cursos asignados.");
            }

            estudiantes.Add(new HorarioGenerator.EstudiantePlan(estudiante.Nombre, cursosEstudiante));
        }

        var resultados = _generator.GenerarGrupal(cursosSeleccionados.Value!, estudiantes, filtros.Value!);
        return Ok(resultados);
    }

    private async Task<(List<Curso>? Value, ActionResult<List<HorarioResultadoDto>>? Result)> ResolveCursosAsync(
        List<int>? cursoIds,
        List<string>? cursos,
        CancellationToken cancellationToken)
    {
        var ids = cursoIds?.Distinct().ToList() ?? new List<int>();
        var nombres = cursos?.Where(nombre => !string.IsNullOrWhiteSpace(nombre))
            .Select(nombre => nombre.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList() ?? new List<string>();

        if (ids.Count == 0 && nombres.Count == 0)
        {
            return (null, BadRequest("Debes indicar cursos para generar horarios."));
        }

        var query = _dbContext.Cursos
            .AsNoTracking()
            .Include(curso => curso.Secciones)
            .ThenInclude(seccion => seccion.Sesiones)
            .AsQueryable();

        if (ids.Count > 0 && nombres.Count > 0)
        {
            query = query.Where(curso => ids.Contains(curso.Id) || nombres.Contains(curso.Nombre));
        }
        else if (ids.Count > 0)
        {
            query = query.Where(curso => ids.Contains(curso.Id));
        }
        else if (nombres.Count > 0)
        {
            query = query.Where(curso => nombres.Contains(curso.Nombre));
        }

        var cursosSeleccionados = await query.ToListAsync(cancellationToken);

        if (ids.Count > 0)
        {
            var faltantes = ids.Except(cursosSeleccionados.Select(c => c.Id)).ToList();
            if (faltantes.Count > 0)
            {
                return (null, BadRequest($"Cursos no encontrados: {string.Join(", ", faltantes)}."));
            }
        }

        if (nombres.Count > 0)
        {
            var encontrados = new HashSet<string>(cursosSeleccionados.Select(c => c.Nombre), StringComparer.OrdinalIgnoreCase);
            var faltantes = nombres.Where(nombre => !encontrados.Contains(nombre)).ToList();
            if (faltantes.Count > 0)
            {
                return (null, BadRequest($"Cursos no encontrados: {string.Join(", ", faltantes)}."));
            }
        }

        return (cursosSeleccionados, null);
    }

    private static (HorarioGenerator.ScheduleFilters? Value, ActionResult<List<HorarioResultadoDto>>? Result) BuildFilters(
        List<string>? sedes,
        List<string>? diasLibres,
        RangoHorarioDto? rangoHorario)
    {
        var sedesSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (sedes is not null)
        {
            foreach (var sede in sedes)
            {
                if (!string.IsNullOrWhiteSpace(sede))
                {
                    sedesSet.Add(sede.Trim());
                }
            }
        }

        var diasSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (diasLibres is not null)
        {
            foreach (var dia in diasLibres)
            {
                if (!string.IsNullOrWhiteSpace(dia))
                {
                    diasSet.Add(dia.Trim());
                }
            }
        }

        TimeSpan? inicio = null;
        TimeSpan? fin = null;

        if (rangoHorario is not null)
        {
            if (!string.IsNullOrWhiteSpace(rangoHorario.Inicio))
            {
                if (!TimeParser.TryParse(rangoHorario.Inicio, out var parsed))
                {
                    return (null, new BadRequestObjectResult($"Hora de inicio inválida: {rangoHorario.Inicio}"));
                }

                inicio = parsed;
            }

            if (!string.IsNullOrWhiteSpace(rangoHorario.Fin))
            {
                if (!TimeParser.TryParse(rangoHorario.Fin, out var parsed))
                {
                    return (null, new BadRequestObjectResult($"Hora de fin inválida: {rangoHorario.Fin}"));
                }

                fin = parsed;
            }

            if (inicio.HasValue && fin.HasValue && inicio >= fin)
            {
                return (null, new BadRequestObjectResult("El rango horario es inválido."));
            }
        }

        return (new HorarioGenerator.ScheduleFilters(sedesSet, diasSet, inicio, fin), null);
    }
}
