'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import LoginPage from '@/components/login-page'
import Sidebar, { type NavSection } from '@/components/sidebar'
import TopBar from '@/components/top-bar'
import GestionEmbargos from '@/components/gestion-embargos'
import InformesEmbargos from '@/components/embargos/informes-embargos'
import GestionUsuarios from '@/components/gestion-usuarios'
import CambiarContrasena from '@/components/cambiar-contrasena'
import { getCurrentSession, logoutUsuario } from '@/app/actions/auth'
import { isAdminRole } from '@/lib/roles'

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [username, setUsername] = useState('')
  const [userId, setUserId] = useState<number>(1)
  const [role, setRole] = useState<string>('JUBILA')
  const [activeSection, setActiveSection] = useState<NavSection>('embargos')
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  const handleLogin = (name: string, id: number, mustChange = false, userRole: string = 'JUBILA') => {
    setUsername(name)
    setUserId(id)
    setRole(userRole)
    setLoggedIn(true)
    setMustChangePassword(mustChange)
  }

  useEffect(() => {
    let active = true
    getCurrentSession().then((session) => {
      if (!active) return
      if (session.ok && session.username && session.userId != null) {
        setUsername(session.username)
        setUserId(session.userId)
        setRole(session.role ?? 'JUBILA')
        setLoggedIn(true)
        setMustChangePassword(Boolean(session.mustChangePassword))
      } else {
        setLoggedIn(false)
      }
    }).catch(() => {
      if (active) setLoggedIn(false)
    }).finally(() => {
      if (active) setCheckingSession(false)
    })
    return () => {
      active = false
    }
  }, [])

  // Vuelve al login cuando la sesión vence, al recuperar el foco o cada minuto.
  useEffect(() => {
    if (!loggedIn) return
    let active = true

    const verificar = async () => {
      try {
        // No renueva la actividad: sólo comprueba si la sesión sigue vigente.
        const session = await getCurrentSession(false)
        if (active && !session.ok) {
          setLoggedIn(false)
          setUsername('')
          setRole('JUBILA')
          setActiveSection('embargos')
        }
      } catch {
        // Si falla la red, no cerramos la sesión por las dudas.
      }
    }

    const interval = window.setInterval(() => void verificar(), 60_000)
    const onFocus = () => void verificar()
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [loggedIn])

  const handleLogout = async () => {
    try {
      await logoutUsuario()
    } finally {
      setLoggedIn(false)
      setUsername('')
      setUserId(1)
      setRole('JUBILA')
      setActiveSection('embargos')
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#dce8f5]">
        <div className="flex flex-col items-center gap-4">
          <p className="text-xl font-black uppercase tracking-[0.3em] text-[#1e3a8a]">Retenciones</p>
          <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
            Municipalidad de Córdoba
          </p>
          <Loader2 className="mt-2 h-6 w-6 animate-spin text-[#1e3a8a]" />
          <p className="text-xs text-slate-500">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  if (!loggedIn) {
    return <LoginPage onLogin={handleLogin} />
  }

  if (mustChangePassword || showChangePassword) {
    return (
      <CambiarContrasena
        obligatorio={mustChangePassword}
        onBack={() => setShowChangePassword(false)}
        onDone={() => {
          setMustChangePassword(false)
          setShowChangePassword(false)
        }}
      />
    )
  }

  const temaRosa = username.trim().toLocaleLowerCase('es') === 'ferrando_m'

  return (
    <div className={`app-shell flex h-screen overflow-hidden bg-[#eef2f7]${temaRosa ? ' theme-pink' : ''}`}>
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        role={role}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar
          username={username}
          onLogout={handleLogout}
          onChangePassword={() => setShowChangePassword(true)}
        />

        <main className="flex-1 overflow-y-auto">
          {/* GestionEmbargos queda montado aunque se cambie de sección para que
              los procesos largos (Excel de retenciones y oficios PDF) sigan
              ejecutándose en segundo plano y conserven su progreso. */}
          <div className={activeSection === 'embargos' ? 'block' : 'hidden'}>
            <GestionEmbargos />
          </div>
          {activeSection === 'informes' && (
            <div className="p-6">
              <InformesEmbargos />
            </div>
          )}
          {activeSection === 'usuarios' && isAdminRole(role) && <GestionUsuarios />}
        </main>
      </div>
    </div>
  )
}
