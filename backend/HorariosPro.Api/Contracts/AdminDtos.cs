namespace HorariosPro.Api.Contracts;

public record CursoUpsertRequest(string Nombre);

public record SeccionUpsertRequest(int CursoId, string Codigo, string Sede, string? Profesor);

public record SesionUpsertRequest(int SeccionId, string Dia, string HoraInicio, string HoraFin);

public record SesionUploadDto(string Dia, string Inicio, string Fin);

public record SeccionUploadDto(string Seccion, string Sede, string? Profesor, List<SesionUploadDto> Sesiones);

public record CursoUploadRequest(string Nombre, List<SeccionUploadDto> Secciones);

