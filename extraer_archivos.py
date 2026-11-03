import os
import zipfile
from pathlib import Path

# Archivos específicos que deseas extraer
ARCHIVOS_OBJETIVO = [
    "src/entry-admin.ts",
    "src/host-admin.ts",
    "AGENTS.md",
    "CLAUDE_MIGRATION_GUIDE.md",
    "AUDIT_REPORT.md"
]

ARCHIVO_SALIDA = "documentos_extraidos.txt"

def extraer_desde_carpeta():
    encontrados = 0
    with open(ARCHIVO_SALIDA, "w", encoding="utf-8") as out:
        for root, _, files in os.walk("."):
            for file in files:
                rel_path = os.path.relpath(os.path.join(root, file), ".").replace("\\", "/")
                # Coincidencia con la lista objetivo
                if any(rel_path.endswith(target) for target in ARCHIVOS_OBJETIVO):
                    out.write(f"\n{'='*70}\n")
                    out.write(f"ARCHIVO: {rel_path}\n")
                    out.write(f"{'='*70}\n\n")
                    try:
                        with open(os.path.join(root, file), "r", encoding="utf-8", errors="ignore") as f:
                            out.write(f.read())
                            out.write("\n")
                        encontrados += 1
                        print(f"[OK] Extraído: {rel_path}")
                    except Exception as e:
                        print(f"[ERROR] No se pudo leer {rel_path}: {e}")

    return encontrados

def extraer_desde_zip(zip_path):
    encontrados = 0
    with zipfile.ZipFile(zip_path, 'r') as z, open(ARCHIVO_SALIDA, "w", encoding="utf-8") as out:
        for file_info in z.infolist():
            normalized_name = file_info.filename.replace("\\", "/")
            if any(normalized_name.endswith(target) for target in ARCHIVOS_OBJETIVO):
                out.write(f"\n{'='*70}\n")
                out.write(f"ARCHIVO: {normalized_name}\n")
                out.write(f"{'='*70}\n\n")
                try:
                    with z.open(file_info) as f:
                        contenido = f.read().decode("utf-8", errors="ignore")
                        out.write(contenido)
                        out.write("\n")
                    encontrados += 1
                    print(f"[OK] Extraído desde ZIP: {normalized_name}")
                except Exception as e:
                    print(f"[ERROR] Fallo al extraer {normalized_name}: {e}")

    return encontrados

if __name__ == "__main__":
    # Busca si existe algún archivo .zip en el directorio actual
    zips = list(Path(".").glob("*.zip"))
    
    if zips:
        print(f"Detectado archivo comprimido: {zips[0].name}")
        total = extraer_desde_zip(zips[0])
    else:
        print("Buscando en las carpetas locales del proyecto...")
        total = extraer_desde_carpeta()

    if total > 0:
        print(f"\nProceso finalizado: {total} archivos recopilados en '{ARCHIVO_SALIDA}'.")
    else:
        print("\nNo se encontraron los archivos objetivo. Verifica que el script esté en la raíz del proyecto.")