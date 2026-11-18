/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // pdf.js (usado por unpdf) debe ejecutarse en Node: si se empaqueta, falla al
  // resolver sus assets y workers internos. ExcelJS también se usa sólo en el
  // servidor para leer la planilla de liquidación.
  serverExternalPackages: ['unpdf', 'exceljs'],
  experimental: {
    serverActions: {
      // Los oficios en PDF se envían como data URL; 6 MB de PDF equivalen a
      // ~8 MB en base64 más el overhead del formulario.
      bodySizeLimit: '12mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
