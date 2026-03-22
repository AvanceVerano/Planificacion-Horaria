using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Cryptography;
using System.Text;

namespace HorariosPro.Api.Filters;

/// <summary>
/// Protege endpoints de administrador verificando el header <c>X-Admin-Token</c>
/// contra la variable de entorno <c>ADMIN_TOKEN_HASH</c> (hash SHA-256 de la contraseña).
/// Devuelve 401 Unauthorized si el token falta, está vacío o no coincide.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class ValidarTokenAdminAttribute : Attribute, IAuthorizationFilter
{
    private const string HeaderName = "X-Admin-Token";
    private const string EnvVarName = "ADMIN_TOKEN_HASH";

    // Leído una sola vez al inicio de la aplicación; el proceso debe reiniciarse
    // para que los cambios de la variable de entorno surtan efecto.
    private static readonly string? ExpectedHash =
        Environment.GetEnvironmentVariable(EnvVarName);

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var logger = context.HttpContext.RequestServices
            .GetRequiredService<ILogger<ValidarTokenAdminAttribute>>();

        if (string.IsNullOrWhiteSpace(ExpectedHash))
        {
            logger.LogWarning(
                "La variable de entorno '{EnvVar}' no está configurada. " +
                "Las rutas de administrador están bloqueadas hasta que se defina.",
                EnvVarName);
            context.Result = new StatusCodeResult(StatusCodes.Status500InternalServerError);
            return;
        }

        if (!context.HttpContext.Request.Headers.TryGetValue(HeaderName, out var receivedToken)
            || string.IsNullOrEmpty(receivedToken))
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        // Comparación en tiempo constante para evitar timing attacks
        var expectedBytes = Encoding.UTF8.GetBytes(ExpectedHash);
        var receivedBytes = Encoding.UTF8.GetBytes(receivedToken.ToString());

        if (expectedBytes.Length != receivedBytes.Length
            || !CryptographicOperations.FixedTimeEquals(expectedBytes, receivedBytes))
        {
            context.Result = new UnauthorizedResult();
        }
    }
}
