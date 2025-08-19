module.exports = {
  apps: [
    {
      name: 'notarypro-backend',
      script: 'dist/app.js',
      cwd: '/var/www/notarypro-backend',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/notarypro-backend/err.log',
      out_file: '/var/log/notarypro-backend/out.log',
      log_file: '/var/log/notarypro-backend/combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads'],
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 8000
    }
  ],

  // Configuración de despliegue simplificada para VPS
};
