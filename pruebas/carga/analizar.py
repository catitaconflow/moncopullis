"""Analiza resultados.jtl de JMeter contra los criterios del informe.

Criterio de éxito: código HTTP esperado por cada muestra (403 en el webhook,
401 en /importar). Cualquier otra respuesta, incluidos los errores de socket,
cuenta como error. Umbrales: p95 < 500 ms y errores < 1 %.
"""

import csv
import sys

ESPERADO = {
    "Webhook sin secreto (espera 403)": "403",
    "Importar sin token (espera 401)": "401",
}
UMBRAL_P95_MS = 500
UMBRAL_ERRORES = 0.01


def p95(valores):
    orden = sorted(valores)
    return orden[max(0, int(round(0.95 * len(orden))) - 1)]


def main(ruta):
    with open(ruta, encoding="utf-8") as f:
        filas = list(csv.DictReader(f))
    tiempos = [int(r["elapsed"]) for r in filas]
    errores = [r for r in filas if r["responseCode"] != ESPERADO.get(r["label"])]
    tasa = len(errores) / len(filas)
    print(f"Muestras: {len(filas)}")
    print(f"Tiempo de respuesta: p95={p95(tiempos)} ms, máx={max(tiempos)} ms")
    print(f"Errores: {len(errores)} ({tasa:.2%})")
    for r in errores[:3]:
        print("  ejemplo:", r["label"], r["responseCode"], r["failureMessage"][:60])
    ok = p95(tiempos) < UMBRAL_P95_MS and tasa < UMBRAL_ERRORES
    print("Resultado:", "CUMPLE" if ok else "NO CUMPLE")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "resultados.jtl"))
