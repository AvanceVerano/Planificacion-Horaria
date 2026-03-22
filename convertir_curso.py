import json, html, sys, unicodedata
from datetime import datetime
from pathlib import Path

# --- NUEVA FUNCIÓN PARA QUITAR TILDES ---
def quitar_tildes(texto):
    if not texto:
        return ""
    # Normaliza el texto separando las letras de sus tildes y luego filtra las tildes
    texto_normalizado = unicodedata.normalize('NFKD', texto)
    return "".join([c for c in texto_normalizado if not unicodedata.combining(c)])

def format_time(t):
    dt = datetime.strptime(t, "%H%M")
    return dt.strftime("%I:%M%p").lstrip("0").lower()

def get_days(meeting):
    # CORREGIDO: "Mié" -> "Mie" y "Sáb" -> "Sab" para coincidir con tu script.js
    days_map = {
        "monday": "Lun", "tuesday": "Mar", "wednesday": "Mie",
        "thursday": "Jue", "friday": "Vie", "saturday": "Sab", "sunday": "Dom"
    }
    return [label for key, label in days_map.items() if meeting.get(key)]

def convert(api_response):
    result = []
    
    # NUEVO: Detecta automáticamente si es una lista directa o si viene dentro de "data"
    secciones_brutas = api_response if isinstance(api_response, list) else api_response.get("data", [])
    
    for section in secciones_brutas:
        sede_raw = "Virtual" if section["instructionalMethod"] == "V" else section["campusDescription"]
        profesor_raw = html.unescape(section["faculty"][0]["displayName"]) if section["faculty"] else ""
        
        sede = quitar_tildes(sede_raw)
        profesor = quitar_tildes(profesor_raw)
        seccion_codigo = quitar_tildes(section["courseReferenceNumber"])
        
        seen = set()
        sesiones = []
        for mf in section["meetingsFaculty"]:
            mt = mf["meetingTime"]
            for dia in get_days(mt):
                key = (dia, mt["beginTime"], mt["endTime"])
                if key not in seen:
                    seen.add(key)
                    sesiones.append({
                        "dia": dia,
                        "inicio": format_time(mt["beginTime"]),
                        "fin": format_time(mt["endTime"])
                    })
                    
        result.append({
            "seccion": seccion_codigo,
            "sede": sede,
            "sesiones": sesiones,
            "profesor": profesor
        })
    return result

# USO: python convertir_curso.py <archivo_api.json> <nombre_curso>
# Ejemplo: python convertir_curso.py api_sistemas.json Sistemas_Operativos

if len(sys.argv) != 3:
    print("Uso: python convertir_curso.py <archivo_api.json> <nombre_curso>")
    sys.exit(1)

input_file = sys.argv[1]
course_name = sys.argv[2]

with open(input_file, encoding="utf-8") as f:
    data = json.load(f)

output = convert(data)
output_path = Path("cursos") / f"{course_name}.json"

# Me aseguro de que la carpeta 'cursos' exista antes de guardar
output_path.parent.mkdir(parents=True, exist_ok=True)

# Se guarda el JSON final
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"✅ {len(output)} secciones guardadas sin tildes en {output_path}")