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
        // 1. Armar filtros globales (Ahora solo maneja Sedes)
        var filtros = BuildFilters(request.Sedes);

        // 2. Buscar los cursos en la base de datos
        var cursosSeleccionados = await ResolveCursosAsync(request.CursoIds, request.Cursos, cancellationToken);
        if (cursosSeleccionados.Result is not null)
        {
            return cursosSeleccionados.Result;
        }

        // 3. Generar pasando los Bloqueos específicos
        var resultados = _generator.GenerarIndividual(cursosSeleccionados.Value!, filtros, request.Bloqueos);
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

        var filtros = BuildFilters(request.Sedes);

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

            // INYECTAR LOS BLOQUEOS PERSONALES AL ESTUDIANTE AQUÍ
            estudiantes.Add(new HorarioGenerator.EstudiantePlan(estudiante.Nombre, cursosEstudiante, estudiante.Bloqueos));
        }

        var resultados = _generator.GenerarGrupal(cursosSeleccionados.Value!, estudiantes, filtros);
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

    // El constructor de filtros ahora es mucho más simple porque ya no parsea horas
    private static HorarioGenerator.ScheduleFilters BuildFilters(List<string>? sedes)
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

        return new HorarioGenerator.ScheduleFilters(sedesSet);
    }
}