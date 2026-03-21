using HorariosPro.Api.Contracts;
using HorariosPro.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HorariosPro.Api.Controllers;

[ApiController]
[Route("api/cursos")]
public class CursosController : ControllerBase
{
    private readonly HorariosProDbContext _dbContext;

    public CursosController(HorariosProDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<List<CursoDto>>> GetCatalogo(CancellationToken cancellationToken)
    {
        var cursos = await _dbContext.Cursos
            .AsNoTracking()
            .Include(curso => curso.Secciones)
            .ThenInclude(seccion => seccion.Sesiones)
            .ToListAsync(cancellationToken);

        var resultado = cursos.Select(Services.DtoMapper.ToDto).ToList();

        return Ok(resultado);
    }
}
