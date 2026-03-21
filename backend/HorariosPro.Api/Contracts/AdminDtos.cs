namespace HorariosPro.Api.Contracts;

public record CursoUpsertRequest(string Nombre);

public record SeccionUpsertRequest(int CursoId, string Codigo, string Sede, string? Profesor);

public record SesionUpsertRequest(int SeccionId, string Dia, string HoraInicio, string HoraFin);
