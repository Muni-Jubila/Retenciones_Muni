'use server'

import { prisma } from '@/lib/prisma'
import { requireAuthenticatedSession } from '@/lib/auth-session'
import bcrypt from 'bcryptjs'
import { logServerError } from '@/lib/safe-error'
import { isAdminRole } from '@/lib/roles'

export interface RolRetenciones {
  id: number
  nombre: string
}

export interface UsuarioListado {
  id: number
  nombreUsuario: string
  rol: string
  rolId: number | null
  debeCambiarContrasena: boolean
}

export interface RespuestaAccion {
  ok: boolean
  error?: string
}

/** Verifica que la sesión activa pertenezca a un ADMIN. */
async function requireAdmin(): Promise<{ userId: number; username: string }> {
  const session = await requireAuthenticatedSession()
  if (!isAdminRole(session.role)) {
    throw new Error('No autorizado. Esta función requiere rol ADMIN.')
  }
  return { userId: session.userId, username: session.username }
}

async function adminRoleIds(): Promise<number[]> {
  const roles = await prisma.rOL_RETENCIONES.findMany({ select: { ID_ROL_RETENCIONES: true, NOMBRE_ROL: true } })
  return roles.filter((role) => isAdminRole(role.NOMBRE_ROL)).map((role) => role.ID_ROL_RETENCIONES)
}

export async function listRolesRetenciones(): Promise<RolRetenciones[]> {
  try {
    await requireAdmin()
    const roles = await prisma.rOL_RETENCIONES.findMany({
      orderBy: { NOMBRE_ROL: 'asc' },
      select: { ID_ROL_RETENCIONES: true, NOMBRE_ROL: true },
    })
    return roles.map((role) => ({ id: role.ID_ROL_RETENCIONES, nombre: role.NOMBRE_ROL }))
  } catch (error) {
    logServerError('[listRolesRetenciones] Error:', error)
    return []
  }
}

export async function listUsuarios(): Promise<UsuarioListado[]> {
  try {
    await requireAdmin()
    const usuarios = await prisma.uSUARIO.findMany({
      where: { ES_RETENCIONES: true },
      orderBy: { NOMBRE_USUARIO: 'asc' },
      select: {
        ID_USUARIO: true,
        NOMBRE_USUARIO: true,
        ID_ROL_RETENCIONES: true,
        ROL_RETENCIONES: { select: { NOMBRE_ROL: true } },
        DEBE_CAMBIAR_CONTRASENA: true,
      },
    })
    return usuarios.map((u) => ({
      id: u.ID_USUARIO,
      nombreUsuario: u.NOMBRE_USUARIO,
      rol: u.ROL_RETENCIONES?.NOMBRE_ROL ?? 'Sin rol',
      rolId: u.ID_ROL_RETENCIONES,
      debeCambiarContrasena: u.DEBE_CAMBIAR_CONTRASENA,
    }))
  } catch (error) {
    logServerError('[listUsuarios] Error:', error)
    return []
  }
}

export async function crearUsuario(
  nombreUsuario: string,
  rolId: number,
  contrasenaInicial: string,
): Promise<RespuestaAccion> {
  try {
    await requireAdmin()
    const nombre = nombreUsuario.trim()
    if (!nombre || nombre.length > 100) {
      return { ok: false, error: 'El nombre de usuario debe tener entre 1 y 100 caracteres.' }
    }
    if (!Number.isSafeInteger(rolId) || !(await prisma.rOL_RETENCIONES.findUnique({ where: { ID_ROL_RETENCIONES: rolId } })))
      return { ok: false, error: 'Seleccione un rol válido para Retenciones.' }
    if (contrasenaInicial.length < 5 || contrasenaInicial.length > 25) {
      return { ok: false, error: 'La contraseña inicial debe tener entre 5 y 25 caracteres.' }
    }

    const existe = await prisma.uSUARIO.findUnique({ where: { NOMBRE_USUARIO: nombre } })
    if (existe) {
      return { ok: false, error: 'Ya existe un usuario con ese nombre.' }
    }

    const hash = await bcrypt.hash(contrasenaInicial, 12)
    await prisma.uSUARIO.create({
      data: {
        NOMBRE_USUARIO: nombre,
        CONTRASENA_USUARIO: hash,
        DEBE_CAMBIAR_CONTRASENA: true,
        ID_ROL_RETENCIONES: rolId,
        ES_JUBILA: false,
        ES_RETENCIONES: true,
      },
    })
    return { ok: true }
  } catch (error) {
    logServerError('[crearUsuario] Error:', error)
    return { ok: false, error: 'No se pudo crear el usuario. Verificá el formulario.' }
  }
}

export async function actualizarRolUsuario(id: number, rolId: number): Promise<RespuestaAccion> {
  try {
    const admin = await requireAdmin()
    const rolNuevo = Number.isSafeInteger(rolId)
      ? await prisma.rOL_RETENCIONES.findUnique({ where: { ID_ROL_RETENCIONES: rolId } })
      : null
    if (!rolNuevo) return { ok: false, error: 'Seleccione un rol válido para Retenciones.' }

    const target = await prisma.uSUARIO.findFirst({
      where: { ID_USUARIO: id, ES_RETENCIONES: true },
    })
    if (!target) {
      return { ok: false, error: 'El usuario no existe o no pertenece a Retenciones.' }
    }

    if (id === admin.userId && !isAdminRole(rolNuevo.NOMBRE_ROL)) {
      return { ok: false, error: 'No podés quitarte tu propio rol ADMIN.' }
    }
    const roleIds = await adminRoleIds()
    if (!isAdminRole(rolNuevo.NOMBRE_ROL) && target.ID_ROL_RETENCIONES != null && roleIds.includes(target.ID_ROL_RETENCIONES)) {
      const adminsRestantes = await prisma.uSUARIO.count({
        where: { ID_ROL_RETENCIONES: { in: roleIds }, ES_RETENCIONES: true },
      })
      if (adminsRestantes <= 1) {
        return { ok: false, error: 'Debe existir al menos un usuario ADMIN en el sistema.' }
      }
    }

    await prisma.uSUARIO.update({
      where: { ID_USUARIO: id },
      data: { ID_ROL_RETENCIONES: rolId },
    })
    return { ok: true }
  } catch (error) {
    logServerError('[actualizarRolUsuario] Error:', error)
    return { ok: false, error: 'No se pudo actualizar el rol.' }
  }
}

export async function resetearContrasenaUsuario(id: number, contrasenaTemporal: string): Promise<RespuestaAccion> {
  try {
    await requireAdmin()
    const target = await prisma.uSUARIO.findFirst({
      where: { ID_USUARIO: id, ES_RETENCIONES: true },
    })
    if (!target) {
      return { ok: false, error: 'El usuario no existe o no pertenece a Retenciones.' }
    }
    if (contrasenaTemporal.length < 5 || contrasenaTemporal.length > 25) {
      return { ok: false, error: 'La contraseña temporal debe tener entre 5 y 25 caracteres.' }
    }

    const hash = await bcrypt.hash(contrasenaTemporal, 12)
    await prisma.uSUARIO.update({
      where: { ID_USUARIO: id },
      data: { CONTRASENA_USUARIO: hash, DEBE_CAMBIAR_CONTRASENA: true },
    })
    return { ok: true }
  } catch (error) {
    logServerError('[resetearContrasenaUsuario] Error:', error)
    return { ok: false, error: 'No se pudo resetear la contraseña.' }
  }
}

export async function eliminarUsuario(id: number): Promise<RespuestaAccion> {
  try {
    const admin = await requireAdmin()
    const target = await prisma.uSUARIO.findFirst({
      where: { ID_USUARIO: id, ES_RETENCIONES: true },
    })
    if (!target) {
      return { ok: false, error: 'El usuario no existe o no pertenece a Retenciones.' }
    }
    if (id === admin.userId) {
      return { ok: false, error: 'No podés eliminar tu propia cuenta.' }
    }
    const roleIds = await adminRoleIds()
    if (target.ID_ROL_RETENCIONES != null && roleIds.includes(target.ID_ROL_RETENCIONES)) {
      const adminsRestantes = await prisma.uSUARIO.count({
        where: { ID_ROL_RETENCIONES: { in: roleIds }, ES_RETENCIONES: true },
      })
      if (adminsRestantes <= 1) {
        return { ok: false, error: 'Debe existir al menos un usuario ADMIN en el sistema.' }
      }
    }

    await prisma.sESION.updateMany({
      where: { ID_USUARIO: id, FECHA_HORA_FIN: null },
      data: { FECHA_HORA_FIN: new Date() },
    })

    // Si la cuenta también pertenece a Jubilaciones, solo se le quita el acceso
    // a Retenciones para no afectar al otro sistema.
    if (target.ES_JUBILA) {
      await prisma.uSUARIO.update({
        where: { ID_USUARIO: id },
        data: { ES_RETENCIONES: false },
      })
    } else {
      await prisma.uSUARIO.delete({ where: { ID_USUARIO: id } })
    }

    return { ok: true }
  } catch (error) {
    logServerError('[eliminarUsuario] Error:', error)
    return { ok: false, error: 'No se pudo quitar el usuario de Retenciones (puede tener registros asociados).' }
  }
}