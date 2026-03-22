using HorariosPro.Api.Contracts;
using HorariosPro.Api.Models;

namespace HorariosPro.Api.Services;

/// <summary>
/// Converts schedule sessions and user-defined time blocks into bitmasks for O(1) collision detection.
///
/// Bit layout (16 bits per day):
///   Bit 0  = 7:00–8:00
///   Bit 1  = 8:00–9:00
///   ...
///   Bit 15 = 22:00–23:00
///
/// A session from 8:00 to 10:00 lights up bits 1 and 2
/// (startBit = floor(8) - 7 = 1, endBit = ceil(10) - 7 = 3 → bits [1, 3) = 1 and 2).
///
/// Each Seccion or block set is represented as int[6]:
///   index 0 = Lunes, 1 = Martes, 2 = Miércoles, 3 = Jueves, 4 = Viernes, 5 = Sábado.
/// </summary>
public static class BitmaskHelper
{
    /// <summary>Hour at which the bitmask day starts (Bit 0 = this hour).</summary>
    private const int HoraInicioDia = 7;

    /// <summary>Total number of hourly slots covered (bits 0–15).</summary>
    private const int TotalBits = 16;

    /// <summary>Bitmask with all 16 hourly slots set (used to block an entire day).</summary>
    public const int MascaraDiaCompleto = (1 << TotalBits) - 1; // 0xFFFF

    private static readonly Dictionary<string, int> DiaAIndice =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["Lun"] = 0, ["Mar"] = 1, ["Mie"] = 2,
            ["Jue"] = 3, ["Vie"] = 4, ["Sab"] = 5
        };

    /// <summary>
    /// Converts a Seccion's sessions into a 6-element bitmask array (one int per day).
    /// Sessions outside the 7:00–23:00 window are clamped to [0, 16).
    /// </summary>
    public static int[] SeccionToBitmasks(Seccion seccion)
    {
        var mascaras = new int[6];
        foreach (var sesion in seccion.Sesiones)
        {
            if (!DiaAIndice.TryGetValue(sesion.Dia, out int diaIdx)) continue;
            mascaras[diaIdx] |= RangoAMascara(sesion.HoraInicio, sesion.HoraFin);
        }
        return mascaras;
    }

    /// <summary>
    /// Pre-computes user block rules into a 6-element bitmask array.
    ///   - DiaLibre = true  → all 16 bits set for that day (0xFFFF).
    ///   - Explicit Rangos  → bits for each blocked time range are set.
    /// Rangos use minutes from midnight (same unit as RangoBloqueoDto.Min/Max).
    /// </summary>
    public static int[] BloqueosToBitmasks(Dictionary<string, BloqueoDiaDto>? bloqueos)
    {
        var mascaras = new int[6];
        if (bloqueos == null || bloqueos.Count == 0) return mascaras;

        foreach (var (dia, bloqueoDia) in bloqueos)
        {
            if (!DiaAIndice.TryGetValue(dia, out int diaIdx)) continue;

            if (bloqueoDia.DiaLibre)
            {
                // Block all hourly slots on this day.
                mascaras[diaIdx] = MascaraDiaCompleto;
                continue;
            }

            if (bloqueoDia.Rangos != null)
            {
                foreach (var rango in bloqueoDia.Rangos)
                {
                    mascaras[diaIdx] |= RangoAMascara(
                        TimeSpan.FromMinutes(rango.Min),
                        TimeSpan.FromMinutes(rango.Max));
                }
            }
        }
        return mascaras;
    }

    /// <summary>
    /// Returns true if mascarasA and mascarasB share at least one bit on any day
    /// (i.e., there is a scheduling conflict on at least one day).
    /// </summary>
    public static bool ChocaConMascara(int[] mascarasSeccion, int[] mascarasBase)
    {
        for (int d = 0; d < 6; d++)
            if ((mascarasSeccion[d] & mascarasBase[d]) != 0) return true;
        return false;
    }

    /// <summary>
    /// Converts a time range [inicio, fin) to a bitmask.
    ///
    /// Formula:
    ///   startBit = floor(inicio.TotalHours) - 7  (first fully-covered slot)
    ///   endBit   = ceil(fin.TotalHours)    - 7  (one past the last touched slot)
    ///   bits set = [startBit, endBit)
    ///
    /// Example: 8:00–10:00 → startBit=1, endBit=3 → bits 1 and 2.
    /// Example: 8:00–9:30  → startBit=1, endBit=3 → bits 1 and 2 (conservative rounding).
    /// </summary>
    public static int RangoAMascara(TimeSpan inicio, TimeSpan fin)
    {
        int startBit = (int)Math.Floor(inicio.TotalHours) - HoraInicioDia;
        int endBit   = (int)Math.Ceiling(fin.TotalHours)  - HoraInicioDia;

        startBit = Math.Max(0, startBit);
        endBit   = Math.Min(TotalBits, endBit);

        if (startBit >= endBit) return 0;

        // Set bits [startBit, endBit): shift a run of (endBit-startBit) ones to startBit.
        return ((1 << (endBit - startBit)) - 1) << startBit;
    }
}
