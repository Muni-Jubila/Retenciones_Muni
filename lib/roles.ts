export function isAdminRole(roleName: string | null | undefined): boolean {
  const normalized = (roleName ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleUpperCase('es')
  return normalized.includes('ADMIN')
}
