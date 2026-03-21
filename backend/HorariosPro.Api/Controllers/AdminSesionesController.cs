using HorariosPro.Api.Contracts;
using HorariosPro.Api.Data;
using HorariosPro.Api.Models;
using HorariosPro.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HorariosPro.Api.Controllers;

[ApiController]
[Route("api/admin/sesiones")]
public class AdminSesionesController : ControllerBase
{
    private readonly HorariosProDbContext _dbContext;

    public AdminSesionesController(HorariosProDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<List<SesionDto>>> GetSesiones([FromQuery] int? seccionId, CancellationToken cancellationToken)
    {
        var query = _dbContext.Sesiones
            .AsNoTracking()
            .AsQueryable();

        if (seccionId.HasValue)
        {
            query = query.Where(sesion => sesion.SeccionId == seccionId.Value);
        }

        var sesiones = await query.ToListAsync(cancellationToken);
        return Ok(sesiones.Select(DtoMapper.ToDto).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<SesionDto>> GetSesion(int id, CancellationToken cancellationToken)
    {
        var sesion = await _dbContext.Sesiones
            .AsNoTracking()
            .FirstOrDefaultAsync(sesion => sesion.Id == id, cancellationToken);

        if (sesion is null)
        {
            return NotFound();
        }

        return Ok(DtoMapper.ToDto(sesion));
    }

    [HttpPost]
    public async Task<ActionResult<SesionDto>> CreateSesion([FromBody] SesionUpsertRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Dia))
        {
            return BadRequest("El día es obligatorio.");
        }

        if (!TimeParser.TryParse(request.HoraInicio, out var horaInicio) ||
            !TimeParser.TryParse(request.HoraFin, out var horaFin) ||
            horaInicio >= horaFin)
        {
            return BadRequest("El rango horario de la sesión es inválido.");
        }

        var seccionExiste = await _dbContext.Secciones.AnyAsync(seccion => seccion.Id == request.SeccionId, cancellationToken);
        if (!seccionExiste)
        {
            return BadRequest("SeccionId inválido.");
        }

        var sesion = new Sesion
        {
            SeccionId = request.SeccionId,
            Dia = request.Dia.Trim(),
            HoraInicio = horaInicio,
            HoraFin = horaFin
        };

        _dbContext.Sesiones.Add(sesion);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetSesion), new { id = sesion.Id }, DtoMapper.ToDto(sesion));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateSesion(int id, [FromBody] SesionUpsertRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Dia))
        {
            return BadRequest("El día es obligatorio.");
        }

        if (!TimeParser.TryParse(request.HoraInicio, out var horaInicio) ||
            !TimeParser.TryParse(request.HoraFin, out var horaFin) ||
            horaInicio >= horaFin)
        {
            return BadRequest("El rango horario de la sesión es inválido.");
        }

        var sesion = await _dbContext.Sesiones.FindAsync(new object[] { id }, cancellationToken);
        if (sesion is null)
        {
            return NotFound();
        }

        var seccionExiste = await _dbContext.Secciones.AnyAsync(seccion => seccion.Id == request.SeccionId, cancellationToken);
        if (!seccionExiste)
        {
            return BadRequest("SeccionId inválido.");
        }

        sesion.SeccionId = request.SeccionId;
        sesion.Dia = request.Dia.Trim();
        sesion.HoraInicio = horaInicio;
        sesion.HoraFin = horaFin;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteSesion(int id, CancellationToken cancellationToken)
    {
        var sesion = await _dbContext.Sesiones.FindAsync(new object[] { id }, cancellationToken);
        if (sesion is null)
        {
            return NotFound();
        }

        _dbContext.Sesiones.Remove(sesion);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
