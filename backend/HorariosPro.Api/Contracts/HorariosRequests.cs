namespace HorariosPro.Api.Contracts;

public record RangoHorarioDto(string? Inicio, string? Fin);

public record HorarioIndividualRequest
{
    public List<int>? CursoIds { get; init; }
    public List<string>? Cursos { get; init; }
    public List<string>? Sedes { get; init; }
    public List<string>? DiasLibres { get; init; }
    public RangoHorarioDto? RangoHorario { get; init; }
}

public record EstudianteRequest
{
    public string Nombre { get; init; } = string.Empty;
    public List<int>? CursoIds { get; init; }
    public List<string>? Cursos { get; init; }
}

public record HorarioGrupalRequest
{
    public List<EstudianteRequest> Estudiantes { get; init; } = new();
    public List<string>? Sedes { get; init; }
    public List<string>? DiasLibres { get; init; }
    public RangoHorarioDto? RangoHorario { get; init; }
}
