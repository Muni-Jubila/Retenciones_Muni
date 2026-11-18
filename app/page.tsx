import { connection } from 'next/server'
import AppShell from '@/components/app-shell'

// La CSP con nonce requiere renderizado dinámico: Next inyecta el nonce en los
// scripts durante el render de cada request.
export const dynamic = 'force-dynamic'

export default async function Page() {
  await connection()
  return <AppShell />
}
