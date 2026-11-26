import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const out = {};
out.usuarios = await prisma.uSUARIO.count();
out.agentes = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.count();
out.carrera = await prisma.cARRERA_ADMINISTRATIVA.count();
out.embargos = await prisma.eMBARGO.count();
out.retenciones = await prisma.rETENCION_EMBARGO.count();
out.sesiones = await prisma.sESION.count();

const like = await prisma.$queryRaw`
  SELECT TOP 5 [ID_DATOS_PERSONALES_AGENTE_JUBILA] AS id
  FROM [dbo].[COMUN_DATOS_PERSONALES_AGENTE_JUBILA]
  WHERE ([APELLIDO_AGENTE] COLLATE Latin1_General_CI_AI LIKE '%' + ${'perez'} + '%'
     OR [NOMBRE_AGENTE] COLLATE Latin1_General_CI_AI LIKE '%' + ${'perez'} + '%')`;
out.busquedaUnaccent = like.length;

const emb = await prisma.eMBARGO.findFirst({
  include: { DATOS_PERSONALES_AGENTE_JUBILA: true, RETENCION_EMBARGO: true },
});
out.embargoConRelaciones = emb ? { id: emb.ID_EMBARGO, agente: emb.DATOS_PERSONALES_AGENTE_JUBILA.APELLIDO_AGENTE, retenciones: emb.RETENCION_EMBARGO.length } : null;

const u = await prisma.uSUARIO.findFirst({ select: { NOMBRE_USUARIO: true, ID_ROL_RETENCIONES: true } });
out.usuarioMuestra = u;

console.log(JSON.stringify(out, null, 2));
await prisma.$disconnect();
