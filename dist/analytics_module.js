"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsModule = void 0;
const zod_1 = require("zod");
const base_module_1 = require("./base_module");
const ANALYTICS_MODULE_CONFIG = {
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
const getDashboardStatsSchema = zod_1.z.object({
    timeRange: zod_1.z.enum(['7d', '30d', '90d', 'all']).default('30d'),
});
const getUsageReportSchema = zod_1.z.object({
    startDate: zod_1.z.string().datetime("La fecha de inicio debe ser una fecha y hora válida."),
    endDate: zod_1.z.string().datetime("La fecha de fin debe ser una fecha y hora válida."),
    userId: zod_1.z.string().uuid("El userId debe ser un UUID válido.").optional(),
});
const getConversionMetricsSchema = zod_1.z.object({
    timeRange: zod_1.z.enum(['7d', '30d', '90d', 'all']).default('30d'),
});
class AnalyticsModel {
    constructor(db) {
        this.db = db;
    }
    async getDashboardStats(timeRange) {
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
    async getUsageReport(startDate, endDate, userId) {
        return {
            period: `${startDate} to ${endDate}`,
            totalDocumentsCreated: 50,
            totalSignaturesCompleted: 120,
            totalPaymentsProcessed: 30,
            usersActive: 75,
            details: userId ? `Reporte para el usuario ${userId}` : 'Reporte general',
        };
    }
    async getConversionMetrics(timeRange) {
        return {
            period: timeRange,
            draftToSignedConversion: 75.8,
            leadToCustomerConversion: 30.1,
            averageSigningTime: '1.2 days',
        };
    }
}
class AnalyticsModule extends base_module_1.BaseModule {
    constructor(database) {
        super(database, ANALYTICS_MODULE_CONFIG);
        this.analyticsModel = new AnalyticsModel(database);
    }
    async initialize() {
        this.initialized = true;
        console.log(`✅ ${this.getName()} v${this.getVersion()} initialized`);
    }
    async cleanup() {
        this.initialized = false;
    }
    async getHealth() {
        try {
            return { status: 'healthy', details: { analytics_service: 'active' } };
        }
        catch (error) {
            return { status: 'unhealthy', details: { analytics_service: error.message } };
        }
    }
    getRoutes() {
        return {
            'GET /analytics/dashboard': this.getDashboardStats.bind(this),
            'GET /analytics/usage': this.getUsageReport.bind(this),
            'GET /analytics/conversion': this.getConversionMetrics.bind(this)
        };
    }
    async getDashboardStats(data) {
        try {
            const validatedData = getDashboardStatsSchema.parse(data);
            const stats = await this.analyticsModel.getDashboardStats(validatedData.timeRange);
            return stats;
        }
        catch (error) {
            console.error('Error in getDashboardStats:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudieron obtener las estadísticas del dashboard.');
        }
    }
    async getUsageReport(data) {
        try {
            const validatedData = getUsageReportSchema.parse(data);
            const { startDate, endDate, userId } = validatedData;
            const report = await this.analyticsModel.getUsageReport(startDate, endDate, userId);
            return report;
        }
        catch (error) {
            console.error('Error in getUsageReport:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudo obtener el reporte de uso.');
        }
    }
    async getConversionMetrics(data) {
        try {
            const validatedData = getConversionMetricsSchema.parse(data);
            const metrics = await this.analyticsModel.getConversionMetrics(validatedData.timeRange);
            return metrics;
        }
        catch (error) {
            console.error('Error in getConversionMetrics:', error);
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Error de validación: ${error.errors.map(e => e.message).join(', ')}`);
            }
            throw new Error(error.message || 'No se pudieron obtener las métricas de conversión.');
        }
    }
}
exports.AnalyticsModule = AnalyticsModule;
exports.default = AnalyticsModule;
