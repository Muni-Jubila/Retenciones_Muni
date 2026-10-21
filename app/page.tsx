'use client'

import { useEffect, useState } from 'react'
import LoginPage from '@/components/login-page'
import Sidebar, { type NavSection } from '@/components/sidebar'
import TopBar from '@/components/top-bar'
import PanelPrincipal from '@/components/panel-principal'
import GestionUsuarios from '@/components/gestion-usuarios'
import CambiarContrasena from '@/components/cambiar-contrasena'
import { getCurrentSession, logoutUsuario } from '@/app/actions/auth'

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [username, setUsername] = useState('')
  const [userId, setUserId] = useState<number>(1)
  const [role, setRole] = useState<string>('JUBILA')
  const [activeSection, setActiveSection] = useState<NavSection>('inicio')
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
    })
    return () => {
      active = false
    }
  }, [])

  const handleLogout = async () => {
    try {
      await logoutUsuario()
    } finally {
      setLoggedIn(false)
      setUsername('')
      setUserId(1)
      setRole('JUBILA')
      setActiveSection('inicio')
    }
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

  return (
    <div className="flex h-screen overflow-hidden bg-[#eef2f7]">
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
          {activeSection === 'inicio' && <PanelPrincipal />}
          {activeSection === 'informes' && <div />}
          {activeSection === 'usuarios' && role === 'ADMIN' && <GestionUsuarios />}
        </main>
      </div>
    </div>
  )
}
