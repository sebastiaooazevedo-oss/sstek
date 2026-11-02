/**
 * CPF — formatação e validação dos dígitos verificadores.
 *
 * Usado na identificação do consultante da ficha externa de fiscalização.
 * Validar aqui evita que uma solicitação de acesso seja registrada com um
 * documento digitado errado, o que tornaria a rastreabilidade inútil.
 */

export function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

/** Aplica a máscara `000.000.000-00` enquanto o usuário digita. */
export function formatCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function checkDigit(digits: string, length: number): number {
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    sum += Number(digits[index]) * (length + 1 - index);
  }
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

/** Validação real dos dois dígitos verificadores (não apenas o tamanho). */
export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  // Sequências repetidas (000.000.000-00, 111...) passam no cálculo, mas não existem.
  if (/^(\d)\1{10}$/.test(digits)) return false;
  return checkDigit(digits, 9) === Number(digits[9]) && checkDigit(digits, 10) === Number(digits[10]);
}

/** Mensagem exibida abaixo do campo, ou `null` quando está tudo certo. */
export function cpfErrorMessage(value: string): string | null {
  const digits = onlyDigits(value);
  if (digits.length === 0) return "Informe o CPF de quem está consultando a ficha.";
  if (digits.length < 11) return `CPF incompleto: faltam ${11 - digits.length} dígito(s).`;
  if (!isValidCpf(digits)) return "CPF inválido. Confira os números digitados e tente novamente.";
  return null;
}