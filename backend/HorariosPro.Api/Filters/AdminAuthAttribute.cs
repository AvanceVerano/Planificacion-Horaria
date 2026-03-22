using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace HorariosPro.Api.Filters;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class AdminAuthAttribute : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var configuration = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var expectedHash = configuration["AdminAuth:TokenHash"];

        if (string.IsNullOrWhiteSpace(expectedHash))
        {
            context.Result = new StatusCodeResult(StatusCodes.Status500InternalServerError);
            return;
        }

        if (!context.HttpContext.Request.Headers.TryGetValue("X-Admin-Token", out var receivedToken)
            || !string.Equals(receivedToken.ToString(), expectedHash, StringComparison.Ordinal))
        {
            context.Result = new UnauthorizedResult();
        }
    }
}
