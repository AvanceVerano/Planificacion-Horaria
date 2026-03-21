namespace HorariosPro.Api.Contracts;

public record SesionDto(string Dia, string HoraInicio, string HoraFin);

public record SeccionDto(int Id, string Codigo, string Sede, string Profesor, List<SesionDto> Sesiones);

public record CursoDto(int Id, string Nombre, List<SeccionDto> Secciones);

public record HorarioItemDto(int CursoId, string CursoNombre, SeccionDto Seccion);

public record HorarioResultadoDto(List<HorarioItemDto> Items);
