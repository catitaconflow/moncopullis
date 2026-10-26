/** Dígito verificador chileno (módulo 11) del cuerpo numérico del RUT. */
export function digitoVerificador(cuerpo: string): string {
  let suma = 0
  let factor = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const r = 11 - (suma % 11)
  if (r === 11) return '0'
  return r === 10 ? 'K' : String(r)
}

/** Quita puntos y espacios y pasa a mayúsculas: "12.345.678-k" -> "12345678-K". */
export function normalizarRut(valor: string): string {
  return valor.trim().replace(/\./g, '').toUpperCase()
}

/** Devuelve un mensaje de error, o null si el RUT es válido. */
export function validarRut(valor: string): string | null {
  const m = /^(\d{1,8})-([0-9K])$/.exec(normalizarRut(valor))
  if (!m) return 'El RUT debe tener el formato 12345678-9.'
  return digitoVerificador(m[1]) === m[2] ? null : 'El dígito verificador del RUT no es correcto.'
}
