using HorariosPro.Api.Contracts;
using HorariosPro.Api.Models;

namespace HorariosPro.Api.Services;

public static class DtoMapper
{
    public static CursoDto ToDto(Curso curso)
    {
        return new CursoDto(
            curso.Id,
            curso.Nombre,
            curso.Secciones.Select(ToDto).ToList());
    }

    public static SeccionDto ToDto(Seccion seccion)
    {
        return new SeccionDto(
            seccion.Id,
            seccion.Codigo,
            seccion.Sede,
            seccion.Profesor,
            seccion.Sesiones.Select(ToDto).ToList());
    }

    public static SesionDto ToDto(Sesion sesion)
    {
        return new SesionDto(
            sesion.Dia,
            TimeParser.ToDisplay(sesion.HoraInicio),
            TimeParser.ToDisplay(sesion.HoraFin));
    }
}
