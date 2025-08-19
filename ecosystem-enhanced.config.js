// =============================================================================
// NOTARYPRO BACKEND - CONFIGURACIÓN PM2 MEJORADA PARA PRODUCCIÓN
// =============================================================================
// Configuración avanzada de PM2 con monitoreo, logs y gestión de procesos
// =============================================================================

module.exports = {
  apps: [{
    // Configuración básica
    name: 'notarypro-backend',
    script: 'dist/app.js',
    cwd: '/opt/notarypro-backend',
    
    // Gestión de instancias
    instances: 'max',                    // Usar todas las CPUs disponibles
    exec_mode: 'cluster',                // Modo cluster para balanceo de carga
    instance_var: 'INSTANCE_ID',         // Variable de entorno para identificar instancia
    
    // Configuración de memoria y CPU
    max_memory_restart: '512M',          // Reiniciar si excede 512MB
    node_args: '--max-old-space-size=512', // Límite de heap de Node.js
    
    // Configuración de reinicio
    restart_delay: 4000,                 // Delay entre reinicios (4 segundos)
    max_restarts: 10,                    // Máximo número de reinicios
    min_uptime: '10s',                   // Tiempo mínimo para considerar estable
    
    // Configuración de logs
    log_file: 'logs/combined.log',       // Archivo de log combinado
    out_file: 'logs/out.log',            // Log de stdout
    error_file: 'logs/error.log',        // Log de stderr
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Configuración de entorno
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      INSTANCE_ID: 0
    },
    
    // Configuración de monitoreo
    pmx: true,                           // Habilitar PMX para monitoreo
    monitoring: true,                    // Habilitar monitoreo PM2
    
    // Configuración de watch (deshabilitado en producción)
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads', 'temp'],
    
    // Configuración de kill timeout
    kill_timeout: 5000,                  // 5 segundos para shutdown graceful
    
    // Configuración de merge logs
    merge_logs: true,
    
    // Configuración de source map
    source_map_support: false,           // Deshabilitar en producción
    
    // Configuración de autorestart
    autorestart: true,
    
    // Configuración de cron
    cron_restart: '0 4 * * 0',          // Reinicio semanal el domingo a las 4 AM
    
    // Configuración de variables de entorno específicas
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      LOG_LEVEL: 'info',
      ENABLE_METRICS: true,
      ENABLE_HEALTH_CHECK: true,
      ENABLE_RATE_LIMITING: true,
      ENABLE_CORS: true,
      ENABLE_COMPRESSION: true,
      ENABLE_HELMET: true,
      DATABASE_SSL: true,
      JWT_EXPIRES_IN: '24h',
      SESSION_SECRET: 'your-super-secret-session-key-change-this',
      COOKIE_SECURE: true,
      COOKIE_HTTP_ONLY: true,
      COOKIE_SAME_SITE: 'strict'
    },
    
    // Configuración de variables de entorno para desarrollo
    env_development: {
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'debug',
      ENABLE_METRICS: false,
      ENABLE_HEALTH_CHECK: true,
      ENABLE_RATE_LIMITING: false,
      ENABLE_CORS: true,
      ENABLE_COMPRESSION: false,
      ENABLE_HELMET: false,
      DATABASE_SSL: false,
      JWT_EXPIRES_IN: '7d',
      SESSION_SECRET: 'dev-secret-key',
      COOKIE_SECURE: false,
      COOKIE_HTTP_ONLY: true,
      COOKIE_SAME_SITE: 'lax'
    }
  }],

  // Configuración de deploy
  deploy: {
    production: {
      user: 'tu-usuario',
      host: 'tu-servidor.com',
      ref: 'origin/main',
      repo: 'git@github.com:tu-usuario/notarypro-backend.git',
      path: '/opt/notarypro-backend',
      'pre-deploy-local': '',
      'post-deploy': 'npm install --production && npm run build && pm2 reload ecosystem-enhanced.config.js --env production',
      'pre-setup': ''
    },
    
    staging: {
      user: 'tu-usuario',
      host: 'staging.tu-servidor.com',
      ref: 'origin/develop',
      repo: 'git@github.com:tu-usuario/notarypro-backend.git',
      path: '/opt/notarypro-backend-staging',
      'pre-deploy-local': '',
      'post-deploy': 'npm install --production && npm run build && pm2 reload ecosystem-enhanced.config.js --env development',
      'pre-setup': ''
    }
  }
};
