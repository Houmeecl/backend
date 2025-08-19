"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilesModule = void 0;
const base_module_1 = require("./base_module");
const FILES_MODULE_CONFIG = {
    name: 'files_module',
    version: '1.0.0',
    enabled: true,
    dependencies: [],
    permissions: ['files:upload', 'files:download', 'files:delete'],
    routes: []
};
class FilesModule extends base_module_1.BaseModule {
    constructor(database) {
        super(database, FILES_MODULE_CONFIG);
    }
    async initialize() {
        this.initialized = true;
        console.log(`? ${this.getName()} v${this.getVersion()} initialized`);
    }
    async cleanup() {
        this.initialized = false;
    }
    async getHealth() {
        return { status: 'healthy', details: { module: 'files' } };
    }
    getRoutes() {
        return {};
    }
}
exports.FilesModule = FilesModule;
exports.default = FilesModule;
