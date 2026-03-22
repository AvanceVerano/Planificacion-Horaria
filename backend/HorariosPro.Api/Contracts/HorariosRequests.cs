namespace HorariosPro.Api.Contracts;

// Nuevos modelos para los bloqueos
public record RangoBloqueoDto(int Min, int Max);
public record BloqueoDiaDto(bool DiaLibre, List<RangoBloqueoDto>? Rangos);

public record HorarioIndividualRequest
{
    public List<int>? CursoIds { get; init; }
    public List<string>? Cursos { get; init; }
    public List<string>? Sedes { get; init; }
    
    // Aquí recibimos los bloqueos del frontend
    public Dictionary<string, BloqueoDiaDto>? Bloqueos { get; init; } 
}

public record EstudianteRequest
{
    public string Nombre { get; init; } = string.Empty;
    public List<int>? CursoIds { get; init; }
    public List<string>? Cursos { get; init; }
    
    // Bloqueos personales del estudiante
    public Dictionary<string, BloqueoDiaDto>? Bloqueos { get; init; } 
}

public record HorarioGrupalRequest
{
    public List<EstudianteRequest> Estudiantes { get; init; } = new();
    public List<string>? Sedes { get; init; }
}