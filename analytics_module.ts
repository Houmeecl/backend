import { Pool } from 'pg';
import { z } from 'zod';
import { BaseModule, ModuleConfig, UserRole } from './base_module';

const ANALYTICS_MODULE_CONFIG: ModuleConfig = {
  name: 'analytics_module',
  version: '1.0.1',
  enabled: true,
  dependencies: [],
  permissions: ['analytics:read', 'analytics:export'],
  routes: [
    'GET /analytics/dashboard',
    'GET /analytics/usage',
    'GET /analytics/conversion'
  ]
};

// Esquemas de validación para los query parameters
const getDashboardStatsSchema = z.object({
    timeRange: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
});

const getUsageReportSchema = z.object({
    startDate: z.string().datetime("La fecha de inicio debe ser una fecha y hora válida."),
    endDate: z.string().datetime("La fecha de fin debe ser una fecha y hora válida."),
    userId: z.string().uuid("El userId debe ser un UUID válido.").optional(),
});

const getConversionMetricsSchema = z.object({
    timeRange: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
});

// Clase para modelos o métodos de consulta de datos agregados
class AnalyticsModel {
    private db: Pool;

    constructor(db: Pool) {
        this.db = db;
    }

    async getDashboardStats(timeRange: string): Promise<any> {
        return {
            tramitesIngreso: 80,
            tramitesRevision: 50,
            tramitesFirmas: 20,
            notariaEntrega: 15,
            tramitesPagos: 40,
            ingresosMensuales: 2800000, 
            conversionRate: 85.2,
            tiempoPromedioFirma: '1.5 días',
            usersCount: 120,
            activeCoupons: 12,
            period: timeRange
        };
    }

    async getUsageReport(startDate: string, endDate: string, userId?: string): Promise<any> {
        return {
            period: `${startDate} to ${endDate}`,
            totalDocumentsCreated: 50,
            totalSignaturesCompleted: 120,
            totalPaymentsProcessed: 30,
            usersActive: 75,
            details: userId ? `Reporte para el usuario ${userId}` : 'Reporte general',
        };
    }

    async getConversionMetrics(timeRange: string): Promise<any> {
        return {
            period: timeRange,
            draftToSignedConversion: 75.8,
            leadToCustomerConversion: 30.1,
            averageSigningTime: '1.2 days',
        };
    }
}

export class AnalyticsModule extends BaseModule {
  private analyticsModel: AnalyticsModel;

  constructor(database: Pool) {
    super(database, ANALYTICS_MODULE_CONFIG);
    this.analyticsModel = new AnalyticsModel(database);
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    console.log(`✅ ${this.getName()} v${this.getVersion()} initialized`);
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  async getHealth(): Promise<{ status: string; details?: any; }> {
    try {
      return { status: 'healthy', details: { analytics_service: 'active' } };
    } catch (error: any) {
      return { status: 'unhealthy', details: { analytics_service: error.message } };
    }
  }

  getRoutes(): Record<string, Function> {
    return {
      'GET /analytics/dashboard': this.getDashboardStats.bind(this),
      'GET /analytics/usage': this.getUsageReport.bind(this),
      'GET /analytics/conversion': this.getConversionMetrics.bind(this)
    };
  }

  async getDashboardStats(data: z.infer<typeof getDashboardStatsSchema> & { user: { role: UserRole } }): Promise<any> {
    try {
      const validatedData = getDashboardStatsSchema.parse(data); 
      const stats = await this.analyticsModel.getDashboardStats(validatedData.timeRange);
      return stats;
    } catch (error: any) {
      console.error('Error in getDashboardStats:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudieron obtener las estadísticas del dashboard.');
    }
  }

  async getUsageReport(data: z.infer<typeof getUsageReportSchema> & { user: { role: UserRole } }): Promise<any> {
    try {
      const validatedData = getUsageReportSchema.parse(data);
      const { startDate, endDate, userId } = validatedData;
      const report = await this.analyticsModel.getUsageReport(startDate, endDate, userId);
      return report;
    } catch (error: any) {
      console.error('Error in getUsageReport:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudo obtener el reporte de uso.');
    }
  }

  async getConversionMetrics(data: z.infer<typeof getConversionMetricsSchema> & { user: { role: UserRole } }): Promise<any> {
    try {
      const validatedData = getConversionMetricsSchema.parse(data); 
      const metrics = await this.analyticsModel.getConversionMetrics(validatedData.timeRange);
      return metrics;
    } catch (error: any) {
      console.error('Error in getConversionMetrics:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(error.message || 'No se pudieron obtener las métricas de conversión.');
    }
  }
}

export default AnalyticsModule;
