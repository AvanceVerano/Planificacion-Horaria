using HorariosPro.Api.Contracts;
using HorariosPro.Api.Data;
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
}
