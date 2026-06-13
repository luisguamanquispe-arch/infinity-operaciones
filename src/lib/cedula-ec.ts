/** Normaliza cédula ecuatoriana: solo dígitos. */
export function normalizarCedula(cedula: string): string {
  return cedula.replace(/\D/g, "");
}

/**
 * Valida cédula de persona natural ecuatoriana (módulo 10, dígito verificador).
 * @see https://www.ecuadorencifras.gob.ec/documentos/web-inec/Codigo_de_estadisticas/Codigo_estadisticas.pdf
 */
export function validarCedulaEcuatoriana(cedula: string): boolean {
  const c = normalizarCedula(cedula);
  if (c.length !== 10 || !/^\d{10}$/.test(c)) return false;

  const provincia = parseInt(c.slice(0, 2), 10);
  if (provincia < 1 || (provincia > 24 && provincia !== 30)) return false;

  const tercerDigito = parseInt(c[2], 10);
  if (tercerDigito > 5) return false;

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let producto = parseInt(c[i], 10) * coeficientes[i];
    if (producto >= 10) producto -= 9;
    suma += producto;
  }

  const verificador = (10 - (suma % 10)) % 10;
  return verificador === parseInt(c[9], 10);
}

export function mensajeCedulaInvalida(): string {
  return "Cédula ecuatoriana inválida (revise los 10 dígitos y el dígito verificador).";
}
