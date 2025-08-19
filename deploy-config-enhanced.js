// =============================================================================
// NOTARYPRO BACKEND - CONFIGURACIÓN DE DESPLIEGUE COMPLETO
// =============================================================================
// Configuración para el script de despliegue mejorado
// =============================================================================

module.exports = {
  // Configuración del servidor
  server: {
    host: 'tu-servidor.com',           // Cambiar por tu dominio o IP
    user: 'tu-usuario',                // Usuario SSH del servidor
    path: '/opt/notarypro-backend',    // Directorio de instalación
    sshKey: '~/.ssh/id_rsa'           // Ruta a tu clave SSH privada
  },

  // Configuración de la aplicación
  app: {
    name: 'notarypro-backend',
    port: 3000,
    instances: 'max',                  // PM2: usar todas las CPUs disponibles
    memory: '512M',                    // Límite de memoria por instancia
    restartDelay: 4000,               // Delay entre reinicios
    maxRestarts: 10                   // Máximo número de reinicios
  },

  // Configuración de Nginx
  nginx: {
    enabled: true,
    ssl: false,                        // Habilitar SSL/HTTPS
    sslCert: '/etc/letsencrypt/live/tu-servidor.com/fullchain.pem',
    sslKey: '/etc/letsencrypt/live/tu-servidor.com/privkey.pem',
    upstream: 'http://localhost:3000'
  },

  // Configuración de base de datos
  database: {
    host: 'localhost',
    port: 5432,
    name: 'notarypro_prod',
    user: 'notarypro_user',
    ssl: true
  },

  // Configuración de monitoreo
  monitoring: {
    enabled: true,
    healthCheck: '/health',
    metrics: '/metrics',
    logs: {
      maxSize: '100M',
      maxFiles: 10
    }
  },

  // Configuración de seguridad
  security: {
    rateLimit: {
      windowMs: 15 * 60 * 1000,      // 15 minutos
      max: 100                        // Máximo 100 requests por ventana
    },
    cors: {
      origin: ['https://tu-servidor.com'],
      credentials: true
    },
    helmet: true,                      // Habilitar headers de seguridad
    compression: true                  // Habilitar compresión gzip
  },

  // Configuración de archivos
  files: {
    uploads: {
      maxSize: '50MB',
      allowedTypes: ['pdf', 'doc', 'docx', 'jpg', 'png', 'txt']
    },
    temp: {
      cleanupInterval: 3600000,        // 1 hora
      maxAge: 86400000                 // 24 horas
    }
  },

  // Configuración de notificaciones
  notifications: {
    email: {
      enabled: true,
      provider: 'smtp',               // 'smtp', 'sendgrid', 'mailgun'
      from: 'noreply@tu-servidor.com'
    },
    webhooks: {
      enabled: false,
      endpoints: []
    }
  },

  // Configuración de backup
  backup: {
    enabled: true,
    schedule: '0 2 * * *',            // Diario a las 2 AM
    retention: 30,                    // Mantener 30 días
    storage: {
      type: 'local',                  // 'local', 's3', 'gcs'
      path: '/var/backups/notarypro'
    }
  },

  // Configuración de logs
  logging: {
    level: 'info',                     // 'error', 'warn', 'info', 'debug'
    format: 'json',                    // 'json', 'simple'
    transports: ['file', 'console'],
    file: {
      filename: 'logs/app.log',
      maxSize: '20m',
      maxFiles: 5
    }
  },

  // Configuración de cache
  cache: {
    enabled: true,
    type: 'memory',                    // 'memory', 'redis'
    ttl: 300,                         // 5 minutos
    maxSize: 100                      // Máximo 100 items
  },

  // Configuración de jobs
  jobs: {
    cleanup: {
      enabled: true,
      schedule: '0 3 * * *',          // Diario a las 3 AM
      tasks: ['temp-files', 'old-logs', 'expired-sessions']
    },
    maintenance: {
      enabled: true,
      schedule: '0 4 * * 0',          // Semanal el domingo a las 4 AM
      tasks: ['database-vacuum', 'index-rebuild', 'stats-update']
    }
  },

  // Configuración de desarrollo
  development: {
    hotReload: false,                  // Solo en desarrollo
    debug: false,                      // Solo en desarrollo
    profiling: false                   // Solo en desarrollo
  }
};
