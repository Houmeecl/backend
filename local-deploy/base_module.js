"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseModule = void 0;
class BaseModule {
    constructor(database, config) {
        this.initialized = false;
        this.db = database;
        this.config = config;
    }
    getName() {
        return this.config.name;
    }
    getVersion() {
        return this.config.version;
    }
    getConfig() {
        return this.config;
    }
    isInitialized() {
        return this.initialized;
    }
    isEnabled() {
        return this.config.enabled;
    }
    getDependencies() {
        return this.config.dependencies;
    }
    getPermissions() {
        return this.config.permissions;
    }
    async executeWithTransaction(callback) {
        const client = await this.db.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async query(text, params) {
        try {
            const result = await this.db.query(text, params);
            return result;
        }
        catch (error) {
            console.error(`Error en query del m�dulo ${this.getName()}:`, error);
            throw error;
        }
    }
    validateDependencies(availableModules) {
        const missingDependencies = [];
        for (const dependency of this.config.dependencies) {
            if (!availableModules.includes(dependency)) {
                missingDependencies.push(dependency);
            }
        }
        return missingDependencies;
    }
    async getStats() {
        return {
            name: this.getName(),
            version: this.getVersion(),
            initialized: this.isInitialized(),
            health: await this.getHealth()
        };
    }
}
exports.BaseModule = BaseModule;
