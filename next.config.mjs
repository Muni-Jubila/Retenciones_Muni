/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV !== 'production'

const nextConfig = {
  images: {
    unoptimized: true,
  },
  // pdf.js (usado por unpdf) debe ejecutarse en Node: si se empaqueta, falla al
  // resolver sus assets y workers internos.
  serverExternalPackages: ['unpdf'],
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
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDevelopment ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self' blob: data:${isDevelopment ? ' ws: wss:' : ''}; worker-src 'self' blob:; child-src blob:; frame-src 'self' blob:`,
          },
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
