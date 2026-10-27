import { Auth } from './auth.js';

// Cliente base para consumir la API Serverless en Vercel
class ApiClient {
  private get baseUrl(): string {
    return (import.meta as any).env?.VITE_VERCEL_API_URL || '';
  }

  get isConfigured(): boolean {
    return !!this.baseUrl;
  }

  async post<T>(endpoint: string, body: any): Promise<T> {
    if (!this.isConfigured) {
      throw new Error('VITE_VERCEL_API_URL no está configurada.');
    }

    const token = await Auth.getIdToken();
    if (!token) {
      throw new Error('Usuario no autenticado (falta idToken).');
    }

    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        // Timeout de 4s: evita que peticiones colgadas/frías hacia Vercel
        // congelen la UI antes de activar el fallback local.
        signal: AbortSignal.timeout(4000),
        body: JSON.stringify(body)
      });

      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { message: responseText };
      }

      if (!response.ok) {
        throw new Error(responseData.error?.message || responseData.error || responseData.message || `HTTP error! status: ${response.status}`);
      }

      return responseData as T;
    } catch (error) {
      console.error(`[ApiClient] Error en POST ${endpoint}:`, error);
      throw error;
    }
  }
}

export const API = new ApiClient();
