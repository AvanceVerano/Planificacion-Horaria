import json, html, sys
from datetime import datetime
from pathlib import Path

def format_time(t):
    dt = datetime.strptime(t, "%H%M")
    return dt.strftime("%I:%M%p").lstrip("0").lower()

def get_days(meeting):
    days_map = {
        "monday": "Lun", "tuesday": "Mar", "wednesday": "Mié",
        "thursday": "Jue", "friday": "Vie", "saturday": "Sáb", "sunday": "Dom"
    }
    return [label for key, label in days_map.items() if meeting.get(key)]

def convert(api_response):
    result = []
    for section in api_response["data"]:
        sede = "Virtual" if section["instructionalMethod"] == "V" else section["campusDescription"]
        profesor = html.unescape(section["faculty"][0]["displayName"]) if section["faculty"] else ""
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
            "seccion": section["courseReferenceNumber"],
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

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"✅ {len(output)} secciones guardadas en {output_path}")