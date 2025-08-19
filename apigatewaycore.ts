import { Pool } from 'pg';
import NotaryProCoreManager from './core_manager';
import dotenv from 'dotenv';

// Tipos para AWS Lambda (definidos localmente para evitar dependencia)
interface APIGatewayProxyEvent {
  path: string;
  httpMethod: string;
  headers: { [name: string]: string };
  body: string | null;
  pathParameters: { [name: string]: string } | null;
  queryStringParameters: { [name: string]: string } | null;
}

interface APIGatewayProxyResult {
  statusCode: number;
  headers?: { [header: string]: string };
  body: string;
}

interface Context {
  requestId: string;
  functionName: string;
  remainingTimeInMillis: number;
}

// Cargar variables de entorno
dotenv.config();

// Configuración de la base de datos
const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Configuración de JWT
const jwtSecret = process.env.JWT_SECRET || 'default-secret';

// Configuración de email
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true' || false,
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASSWORD || ''
  },
  from: process.env.EMAIL_FROM || 'NotaryPro <noreply@notarypro.com>'
};

// Inicializar el Core Manager con la configuración de email
const manager = new NotaryProCoreManager(db, jwtSecret, emailConfig);

// Handler para AWS Lambda
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Inicializar el manager si no está inicializado
    await manager.initialize();
    
    // Procesar la solicitud
    const app = manager.getApp();
    
    // Simular una respuesta (en un entorno real, usarías serverless-http o similar)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({
        message: 'NotaryPro API Gateway Core funcionando correctamente',
        path: event.path,
        method: event.httpMethod,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error: any) {
    console.error('Error en API Gateway:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message || 'Error desconocido'
      })
    };
  }
};