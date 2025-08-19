"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetModule = void 0;
const base_module_1 = require("./base_module");
const PASSWORD_RESET_MODULE_CONFIG = {
    name: 'password_reset_module',
    version: '1.0.0',
    enabled: true,
    dependencies: [],
    permissions: [],
    routes: []
};
class PasswordResetModule extends base_module_1.BaseModule {
    constructor(database) {
        super(database, PASSWORD_RESET_MODULE_CONFIG);
    }
    async initialize() {
        this.initialized = true;
        console.log(`? ${this.getName()} v${this.getVersion()} initialized`);
    }
    async cleanup() {
        this.initialized = false;
    }
    async getHealth() {
        return { status: 'healthy', details: { module: 'password_reset' } };
    }
    getRoutes() {
        return {};
    }
}
exports.PasswordResetModule = PasswordResetModule;
exports.default = PasswordResetModule;
