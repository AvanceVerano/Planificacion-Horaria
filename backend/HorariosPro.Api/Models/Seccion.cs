namespace HorariosPro.Api.Models;

public class Seccion
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Sede { get; set; } = string.Empty;
    public string Profesor { get; set; } = string.Empty;

    public int CursoId { get; set; }
    public Curso? Curso { get; set; }

    public ICollection<Sesion> Sesiones { get; set; } = new List<Sesion>();
}
