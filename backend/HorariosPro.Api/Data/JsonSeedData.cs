using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using HorariosPro.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HorariosPro.Api.Data;

public static class JsonSeedData
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static async Task SeedAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        using var scope = services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<HorariosProDbContext>();
        var env = scope.ServiceProvider.GetRequiredService<IWebHostEnvironment>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("JsonSeedData");

        await dbContext.Database.EnsureCreatedAsync(cancellationToken);

        if (await dbContext.Cursos.AnyAsync(cancellationToken))
        {
            return;
        }

        var cursosPath = Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "..", "cursos"));

        if (!Directory.Exists(cursosPath))
        {
            logger.LogWarning("No se encontró el directorio de cursos en {CursosPath}", cursosPath);
            return;
        }

        var archivos = Directory.GetFiles(cursosPath, "*.json");

        foreach (var archivo in archivos)
        {
            var nombreCurso = Path.GetFileNameWithoutExtension(archivo)
                .Replace('_', ' ')
                .Trim();

            var contenido = await File.ReadAllTextAsync(archivo, cancellationToken);
            var secciones = JsonSerializer.Deserialize<List<SeccionJson>>(contenido, JsonOptions);

            if (secciones is null || secciones.Count == 0)
            {
                logger.LogWarning("El archivo {Archivo} no tiene secciones válidas.", archivo);
                continue;
            }

            var curso = new Curso
            {
                Nombre = string.IsNullOrWhiteSpace(nombreCurso) ? "Curso sin nombre" : nombreCurso,
                Secciones = new List<Seccion>()
            };

            foreach (var seccionJson in secciones)
            {
                var seccion = new Seccion
                {
                    Codigo = seccionJson.Seccion?.Trim() ?? string.Empty,
                    Sede = seccionJson.Sede?.Trim() ?? string.Empty,
                    Profesor = seccionJson.Profesor?.Trim() ?? string.Empty,
                    Sesiones = new List<Sesion>()
                };

                if (seccionJson.Sesiones is not null)
                {
                    foreach (var sesionJson in seccionJson.Sesiones)
                    {
                        if (sesionJson is null)
                        {
                            continue;
                        }

                        seccion.Sesiones.Add(new Sesion
                        {
                            Dia = sesionJson.Dia?.Trim() ?? string.Empty,
                            HoraInicio = ParseTime(sesionJson.Inicio),
                            HoraFin = ParseTime(sesionJson.Fin)
                        });
                    }
                }

                curso.Secciones.Add(seccion);
            }

            dbContext.Cursos.Add(curso);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static TimeSpan ParseTime(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor))
        {
            return TimeSpan.Zero;
        }

        var limpio = valor.Trim();
        var formatos = new[] { "h:mmtt", "hh:mmtt" };

        if (DateTime.TryParseExact(limpio, formatos, CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out var fecha))
        {
            return fecha.TimeOfDay;
        }

        throw new FormatException($"No se pudo interpretar la hora '{valor}'.");
    }

    private sealed class SeccionJson
    {
        [JsonPropertyName("seccion")]
        public string? Seccion { get; set; }

        [JsonPropertyName("sede")]
        public string? Sede { get; set; }

        [JsonPropertyName("profesor")]
        public string? Profesor { get; set; }

        [JsonPropertyName("sesiones")]
        public List<SesionJson>? Sesiones { get; set; }
    }

    private sealed class SesionJson
    {
        [JsonPropertyName("dia")]
        public string? Dia { get; set; }

        [JsonPropertyName("inicio")]
        public string? Inicio { get; set; }

        [JsonPropertyName("fin")]
        public string? Fin { get; set; }
    }
}
