using HorariosPro.Api.Contracts;
using HorariosPro.Api.Data;
using HorariosPro.Api.Filters;
using HorariosPro.Api.Models;
using HorariosPro.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HorariosPro.Api.Controllers;

[ApiController]
[Route("api/admin/secciones")]
[ValidarTokenAdmin]
public class AdminSeccionesController : ControllerBase
{
    private readonly HorariosProDbContext _dbContext;

    public AdminSeccionesController(HorariosProDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<List<SeccionDto>>> GetSecciones([FromQuery] int? cursoId, CancellationToken cancellationToken)
    {
        var query = _dbContext.Secciones
            .AsNoTracking()
            .Include(seccion => seccion.Sesiones)
            .AsQueryable();

        if (cursoId.HasValue)
        {
            query = query.Where(seccion => seccion.CursoId == cursoId.Value);
        }

        var secciones = await query.ToListAsync(cancellationToken);
        return Ok(secciones.Select(DtoMapper.ToDto).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<SeccionDto>> GetSeccion(int id, CancellationToken cancellationToken)
    {
        var seccion = await _dbContext.Secciones
            .AsNoTracking()
            .Include(seccion => seccion.Sesiones)
            .FirstOrDefaultAsync(seccion => seccion.Id == id, cancellationToken);

        if (seccion is null)
        {
            return NotFound();
        }

        return Ok(DtoMapper.ToDto(seccion));
    }

    [HttpPost]
    public async Task<ActionResult<SeccionDto>> CreateSeccion([FromBody] SeccionUpsertRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Codigo) || string.IsNullOrWhiteSpace(request.Sede))
        {
            return BadRequest("Código y sede son obligatorios.");
        }

        var cursoExiste = await _dbContext.Cursos.AnyAsync(curso => curso.Id == request.CursoId, cancellationToken);
        if (!cursoExiste)
        {
            return BadRequest("CursoId inválido.");
        }

        var seccion = new Seccion
        {
            CursoId = request.CursoId,
            Codigo = request.Codigo.Trim(),
            Sede = request.Sede.Trim(),
            Profesor = request.Profesor?.Trim() ?? string.Empty
        };

        _dbContext.Secciones.Add(seccion);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetSeccion), new { id = seccion.Id }, DtoMapper.ToDto(seccion));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateSeccion(int id, [FromBody] SeccionUpsertRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Codigo) || string.IsNullOrWhiteSpace(request.Sede))
        {
            return BadRequest("Código y sede son obligatorios.");
        }

        var seccion = await _dbContext.Secciones.FindAsync(new object[] { id }, cancellationToken);
        if (seccion is null)
        {
            return NotFound();
        }

        var cursoExiste = await _dbContext.Cursos.AnyAsync(curso => curso.Id == request.CursoId, cancellationToken);
        if (!cursoExiste)
        {
            return BadRequest("CursoId inválido.");
        }

        seccion.CursoId = request.CursoId;
        seccion.Codigo = request.Codigo.Trim();
        seccion.Sede = request.Sede.Trim();
        seccion.Profesor = request.Profesor?.Trim() ?? string.Empty;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteSeccion(int id, CancellationToken cancellationToken)
    {
        var seccion = await _dbContext.Secciones.FindAsync(new object[] { id }, cancellationToken);
        if (seccion is null)
        {
            return NotFound();
        }

        _dbContext.Secciones.Remove(seccion);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
