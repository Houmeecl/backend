// =============================================================================
// NOTARYPRO BACKEND - CONFIGURACIÓN DE MONITOREO PARA PRODUCCIÓN
// =============================================================================
// Configuración completa de monitoreo, alertas y métricas
// =============================================================================

module.exports = {
  // =============================================================================
  // CONFIGURACIÓN DE MONITOREO BÁSICO
  // =============================================================================
  basic: {
    enabled: true,
    interval: 30000, // 30 segundos
    timeout: 5000,   // 5 segundos
    
    // Health checks
    healthChecks: {
      database: {
        enabled: true,
        query: 'SELECT 1',
        timeout: 3000
      },
      redis: {
        enabled: false,
        command: 'PING',
        timeout: 2000
      },
      external: {
        enabled: true,
        endpoints: [
          'https://httpbin.org/status/200',
          'https://api.github.com/zen'
        ],
        timeout: 5000
      }
    },
    
    // Métricas del sistema
    systemMetrics: {
      enabled: true,
      cpu: true,
      memory: true,
      disk: true,
      network: true,
      process: true
    }
  },

  // =============================================================================
  // CONFIGURACIÓN DE MÉTRICAS DE APLICACIÓN
  // =============================================================================
  application: {
    enabled: true,
    
    // Métricas de HTTP
    http: {
      enabled: true,
      requests: true,
      responses: true,
      errors: true,
      latency: true,
      throughput: true
    },
    
    // Métricas de base de datos
    database: {
      enabled: true,
      connections: true,
      queries: true,
      slowQueries: true,
      errors: true,
      pool: true
    },
    
    // Métricas de negocio
    business: {
      enabled: true,
      users: true,
      documents: true,
      signatures: true,
      verifications: true,
      apiTokens: true,
      saasUsers: true
    },
    
    // Métricas de demo
    demo: {
      enabled: true,
      logins: true,
      simulations: true,
      playgroundSessions: true,
      userActivity: true
    }
  },

  // =============================================================================
  // CONFIGURACIÓN DE LOGS
  // =============================================================================
  logging: {
    enabled: true,
    level: 'info',
    format: 'json',
    
    // Transports
    transports: {
      console: {
        enabled: true,
        level: 'info'
      },
      file: {
        enabled: true,
        level: 'info',
        filename: 'logs/app.log',
        maxSize: '20m',
        maxFiles: 5
      },
      error: {
        enabled: true,
        level: 'error',
        filename: 'logs/error.log',
        maxSize: '20m',
        maxFiles: 10
      }
    },
    
    // Filtros
    filters: {
      sensitive: true,    // Filtrar datos sensibles
      pii: true,         // Filtrar información personal
      passwords: true,    // Filtrar contraseñas
      tokens: true        // Filtrar tokens
    },
    
    // Rotación
    rotation: {
      enabled: true,
      interval: 'daily',
      compress: true,
      maxFiles: 30
    }
  },

  // =============================================================================
  // CONFIGURACIÓN DE ALERTAS
  // =============================================================================
  alerts: {
    enabled: true,
    
    // Canales de alerta
    channels: {
      email: {
        enabled: true,
        recipients: ['admin@tu-servidor.com'],
        smtp: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false
        }
      },
      slack: {
        enabled: false,
        webhook: '',
        channel: '#notarypro-alerts',
        username: 'NotaryPro Monitor'
      },
      webhook: {
        enabled: false,
        url: '',
        method: 'POST',
        headers: {}
      }
    },
    
    // Reglas de alerta
    rules: {
      // Sistema
      highCpu: {
        enabled: true,
        threshold: 80,
        duration: '5m',
        severity: 'warning'
      },
      highMemory: {
        enabled: true,
        threshold: 85,
        duration: '5m',
        severity: 'warning'
      },
      diskSpace: {
        enabled: true,
        threshold: 90,
        duration: '1m',
        severity: 'critical'
      },
      
      // Aplicación
      highErrorRate: {
        enabled: true,
        threshold: 5,
        duration: '5m',
        severity: 'critical'
      },
      highLatency: {
        enabled: true,
        threshold: 2000,
        duration: '5m',
        severity: 'warning'
      },
      databaseDown: {
        enabled: true,
        duration: '1m',
        severity: 'critical'
      },
      
      // Negocio
      userRegistrationSpike: {
        enabled: true,
        threshold: 100,
        duration: '1h',
        severity: 'info'
      },
      apiTokenAbuse: {
        enabled: true,
        threshold: 1000,
        duration: '1h',
        severity: 'warning'
      }
    }
  },

  // =============================================================================
  // CONFIGURACIÓN DE DASHBOARDS
  // =============================================================================
  dashboards: {
    enabled: true,
    
    // Métricas en tiempo real
    realtime: {
      enabled: true,
      interval: 5000,
      metrics: ['requests', 'errors', 'latency', 'users']
    },
    
    // Reportes históricos
    historical: {
      enabled: true,
      retention: '90d',
      aggregation: '1h',
      metrics: ['all']
    },
    
    // KPIs de negocio
    business: {
      enabled: true,
      metrics: [
        'total_users',
        'active_users',
        'documents_processed',
        'signatures_completed',
        'verifications_successful',
        'api_usage',
        'revenue'
      ]
    }
  },

  // =============================================================================
  // CONFIGURACIÓN DE INTEGRACIONES EXTERNAS
  // =============================================================================
  integrations: {
    // Prometheus
    prometheus: {
      enabled: false,
      port: 9090,
      path: '/metrics',
      collectDefaultMetrics: true
    },
    
    // Grafana
    grafana: {
      enabled: false,
      url: '',
      apiKey: '',
      dashboards: []
    },
    
    // DataDog
    datadog: {
      enabled: false,
      apiKey: '',
      appKey: '',
      host: '',
      tags: []
    },
    
    // New Relic
    newRelic: {
      enabled: false,
      licenseKey: '',
      appName: 'NotaryPro Backend',
      distributedTracing: true
    },
    
    // Sentry
    sentry: {
      enabled: false,
      dsn: '',
      environment: 'production',
      release: '2.3.0',
      tracesSampleRate: 0.1
    }
  },

  // =============================================================================
  // CONFIGURACIÓN DE PERFORMANCE
  // =============================================================================
  performance: {
    enabled: true,
    
    // Profiling
    profiling: {
      enabled: false,
      interval: 60000,
      duration: 30000
    },
    
    // Memory leaks
    memoryLeaks: {
      enabled: true,
      interval: 300000,
      threshold: 100
    },
    
    // Slow queries
    slowQueries: {
      enabled: true,
      threshold: 1000,
      log: true,
      alert: true
    },
    
    // API performance
    apiPerformance: {
      enabled: true,
      slowEndpointThreshold: 2000,
      errorThreshold: 5
    }
  },

  // =============================================================================
  // CONFIGURACIÓN DE SEGURIDAD
  // =============================================================================
  security: {
    enabled: true,
    
    // Intrusion detection
    intrusionDetection: {
      enabled: true,
      failedLogins: {
        threshold: 5,
        window: '15m',
        action: 'block'
      },
      suspiciousIPs: {
        enabled: true,
        blacklist: [],
        whitelist: []
      }
    },
    
    // Audit logging
    audit: {
      enabled: true,
      events: [
        'user.login',
        'user.logout',
        'user.create',
        'user.update',
        'user.delete',
        'document.create',
        'document.update',
        'document.delete',
        'signature.create',
        'verification.create',
        'apiToken.create',
        'apiToken.delete'
      ]
    },
    
    // Rate limiting monitoring
    rateLimiting: {
      enabled: true,
      trackViolations: true,
      alertThreshold: 100
    }
  },

  // =============================================================================
  // CONFIGURACIÓN DE BACKUP Y RECUPERACIÓN
  // =============================================================================
  backup: {
    enabled: true,
    
    // Database backup
    database: {
      enabled: true,
      schedule: '0 2 * * *',
      retention: '30d',
      compress: true,
      verify: true
    },
    
    // File backup
    files: {
      enabled: true,
      schedule: '0 3 * * *',
      retention: '90d',
      include: ['uploads', 'logs'],
      exclude: ['temp', 'node_modules']
    },
    
    // Backup verification
    verification: {
      enabled: true,
      testRestore: false,
      integrityCheck: true
    }
  },

  // =============================================================================
  // CONFIGURACIÓN DE MANTENIMIENTO
  // =============================================================================
  maintenance: {
    enabled: true,
    
    // Scheduled maintenance
    scheduled: {
      enabled: true,
      schedule: '0 4 * * 0', // Domingo a las 4 AM
      duration: '2h',
      tasks: [
        'database.vacuum',
        'database.analyze',
        'logs.cleanup',
        'temp.cleanup',
        'cache.clear'
      ]
    },
    
    // Maintenance mode
    mode: {
      enabled: false,
      message: 'El sistema está en mantenimiento programado',
      allowedIPs: ['127.0.0.1', '::1']
    }
  }
};
