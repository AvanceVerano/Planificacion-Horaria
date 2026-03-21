namespace HorariosPro.Api.Models;

public class Sesion
{
    public int Id { get; set; }
    public string Dia { get; set; } = string.Empty;
    public TimeSpan HoraInicio { get; set; }
    public TimeSpan HoraFin { get; set; }

    public int SeccionId { get; set; }
    public Seccion? Seccion { get; set; }
}
