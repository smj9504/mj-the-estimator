import logger from './logger';

// API wrapper with automatic logging
class API {
  constructor(baseURL = '') {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const method = options.method || 'GET';
    const startTime = performance.now();
    
    // Set default timeout to 3 minutes for file processing
    const timeout = options.timeout || 180000;
    
    logger.info(`API Request: ${method} ${endpoint}`, {
      method,
      endpoint,
      timeout,
      body: options.body instanceof FormData ? 'FormData' : options.body
    });

    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      );

      // Race between fetch and timeout
      const response = await Promise.race([
        fetch(url, {
          ...options,
          headers: {
            ...options.headers,
          }
        }),
        timeoutPromise
      ]);

      const duration = Math.round(performance.now() - startTime);
      
      // Log the response
      logger.apiRequest(method, endpoint, response.status, duration);

      // Parse response
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Handle errors
      if (!response.ok) {
        const error = new Error(`API Error: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.data = data;
        
        logger.error(`API Error: ${method} ${endpoint}`, {
          status: response.status,
          statusText: response.statusText,
          error: data,
          duration
        });
        
        throw error;
      }

      return {
        data,
        status: response.status,
        headers: response.headers
      };

    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      
      logger.apiRequest(method, endpoint, error.status || 0, duration, error);
      
      // Re-throw the error for the caller to handle
      throw error;
    }
  }

  // Convenience methods
  async get(endpoint, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'GET'
    });
  }

  async post(endpoint, data, options = {}) {
    const isFormData = data instanceof FormData;
    
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: isFormData ? data : JSON.stringify(data),
      headers: isFormData ? options.headers : {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }

  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'DELETE'
    });
  }
}

// Create and export API instance
const api = new API('http://localhost:8001');

// Pre-estimate API functions
export const createSession = (projectName = null) => {
  const data = projectName ? { project_name: projectName } : {};
  return api.post('/api/pre-estimate/session', data);
};

export const getSession = (sessionId) => {
  return api.get(`/api/pre-estimate/session/${sessionId}`);
};

export const uploadMeasurementFile = (file, fileType, sessionId = null) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('file_type', fileType);
  if (sessionId) {
    formData.append('session_id', sessionId);
  }
  
  return api.post('/api/pre-estimate/measurement', formData);
};

export const updateRoomOpenings = (data) => {
  return api.put('/api/pre-estimate/room-openings', data);
};

export const processDemoScope = (data) => {
  return api.post('/api/pre-estimate/demo-scope', data);
};

export const processWorkScope = (data) => {
  return api.post('/api/pre-estimate/work-scope', data);
};

export const getCompleteData = (sessionId) => {
  return api.get(`/api/pre-estimate/complete/${sessionId}`);
};

export default api;