using System.Globalization;

namespace HorariosPro.Api.Services;

public static class TimeParser
{
    private static readonly string[] Formats =
    {
        "h:mmtt",
        "hh:mmtt",
        "h:mm tt",
        "hh:mm tt",
        "H:mm",
        "HH:mm"
    };

    public static bool TryParse(string? value, out TimeSpan result)
    {
        result = TimeSpan.Zero;

        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        if (DateTime.TryParseExact(value.Trim(), Formats, CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out var parsed))
        {
            result = parsed.TimeOfDay;
            return true;
        }

        return false;
    }

    public static string ToDisplay(TimeSpan value)
    {
        return value.ToString("h:mmtt", CultureInfo.InvariantCulture).ToLowerInvariant();
    }
}
