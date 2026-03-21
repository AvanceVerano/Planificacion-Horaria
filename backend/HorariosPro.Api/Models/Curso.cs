namespace HorariosPro.Api.Models;

public class Curso
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;

    public ICollection<Seccion> Secciones { get; set; } = new List<Seccion>();
}
