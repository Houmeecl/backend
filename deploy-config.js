module.exports = {
  // Configuración del servidor
  server: {
    host: 'your-server-ip-or-domain.com',
    user: 'your-username',
    port: 22,
    privateKey: '~/.ssh/id_rsa', // Ruta a tu clave SSH privada
    remotePath: '/var/www/notarypro-backend'
  },
  
  // Configuración de la aplicación
  app: {
    name: 'notarypro-backend',
    port: 3000,
    environment: 'production'
  },
  
  // Archivos y directorios a excluir del despliegue
  exclude: [
    'node_modules',
    '.git',
    'dist',
    'uploads',
    'temp',
    'logs',
    '*.log',
    '.env.local',
    'env.example',
    '*.md',
    '*.sql',
    '*.sh',
    '*.yaml',
    '*.conf',
    'check-typescript.sh',
    'deploy-config.js'
  ],
  
  // Comandos a ejecutar en el servidor después del despliegue
  postDeploy: [
    'cd /var/www/notarypro-backend',
    'npm install --production',
    'npm run build',
    'pm2 restart notarypro-backend || pm2 start ecosystem.config.js',
    'sudo systemctl reload nginx'
  ]
};
