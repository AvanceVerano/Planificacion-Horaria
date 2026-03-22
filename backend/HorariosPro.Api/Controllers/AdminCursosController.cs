using HorariosPro.Api.Contracts;
using HorariosPro.Api.Data;
using HorariosPro.Api.Filters;
using HorariosPro.Api.Models;
using HorariosPro.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HorariosPro.Api.Controllers;

[ApiController]
[Route("api/admin/cursos")]
public class AdminCursosController : ControllerBase
{
    private readonly HorariosProDbContext _dbContext;

    public AdminCursosController(HorariosProDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<List<CursoDto>>> GetCursos(CancellationToken cancellationToken)
    {
        var cursos = await _dbContext.Cursos
            .AsNoTracking()
            .Include(curso => curso.Secciones)
            .ThenInclude(seccion => seccion.Sesiones)
            .ToListAsync(cancellationToken);

        return Ok(cursos.Select(DtoMapper.ToDto).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CursoDto>> GetCurso(int id, CancellationToken cancellationToken)
    {
        var curso = await _dbContext.Cursos
            .AsNoTracking()
            .Include(curso => curso.Secciones)
            .ThenInclude(seccion => seccion.Sesiones)
            .FirstOrDefaultAsync(curso => curso.Id == id, cancellationToken);

        if (curso is null)
        {
            return NotFound();
        }

        return Ok(DtoMapper.ToDto(curso));
    }

    [HttpPost]
    public async Task<ActionResult<CursoDto>> CreateCurso([FromBody] CursoUpsertRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Nombre))
        {
            return BadRequest("El nombre del curso es obligatorio.");
        }

        var curso = new Curso
        {
            Nombre = request.Nombre.Trim()
        };

        _dbContext.Cursos.Add(curso);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var dto = DtoMapper.ToDto(curso);
        return CreatedAtAction(nameof(GetCurso), new { id = curso.Id }, dto);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateCurso(int id, [FromBody] CursoUpsertRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Nombre))
        {
            return BadRequest("El nombre del curso es obligatorio.");
        }

        var curso = await _dbContext.Cursos.FindAsync(new object[] { id }, cancellationToken);
        if (curso is null)
        {
            return NotFound();
        }

        curso.Nombre = request.Nombre.Trim();
        await _dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteCurso(int id, CancellationToken cancellationToken)
    {
        var curso = await _dbContext.Cursos.FindAsync(new object[] { id }, cancellationToken);
        if (curso is null)
        {
            return NotFound();
        }

        _dbContext.Cursos.Remove(curso);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpGet("validate")]
    [AdminAuth]
    public IActionResult Validate() => Ok();

    [HttpPost("upload-json")]
    [AdminAuth]
    public async Task<ActionResult<CursoDto>> UploadJson([FromBody] CursoUploadRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Nombre))
        {
            return BadRequest("El nombre del curso es obligatorio.");
        }

        if (request.Secciones is null || request.Secciones.Count == 0)
        {
            return BadRequest("El curso debe tener al menos una sección.");
        }

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        var curso = new Curso { Nombre = request.Nombre.Trim() };
        _dbContext.Cursos.Add(curso);
        await _dbContext.SaveChangesAsync(cancellationToken);

        foreach (var seccionDto in request.Secciones)
        {
            if (string.IsNullOrWhiteSpace(seccionDto.Seccion))
            {
                return BadRequest("Todas las secciones deben tener un código.");
            }

            var seccion = new Seccion
            {
                CursoId = curso.Id,
                Codigo = seccionDto.Seccion.Trim(),
                Sede = (seccionDto.Sede ?? string.Empty).Trim(),
                Profesor = (seccionDto.Profesor ?? string.Empty).Trim()
            };
            _dbContext.Secciones.Add(seccion);
            await _dbContext.SaveChangesAsync(cancellationToken);

            foreach (var sesionDto in seccionDto.Sesiones ?? [])
            {
                if (!TimeParser.TryParse(sesionDto.Inicio, out var horaInicio) ||
                    !TimeParser.TryParse(sesionDto.Fin, out var horaFin))
                {
                    return BadRequest($"Formato de hora inválido en sección '{seccionDto.Seccion}': '{sesionDto.Inicio}' - '{sesionDto.Fin}'.");
                }

                _dbContext.Sesiones.Add(new Sesion
                {
                    SeccionId = seccion.Id,
                    Dia = sesionDto.Dia.Trim(),
                    HoraInicio = horaInicio,
                    HoraFin = horaFin
                });
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);

        var cursoConRelaciones = await _dbContext.Cursos
            .AsNoTracking()
            .Include(c => c.Secciones)
            .ThenInclude(s => s.Sesiones)
            .FirstAsync(c => c.Id == curso.Id, cancellationToken);

        return CreatedAtAction(nameof(GetCurso), new { id = curso.Id }, DtoMapper.ToDto(cursoConRelaciones));
    }
}

