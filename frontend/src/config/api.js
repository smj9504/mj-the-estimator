/**
 * API Configuration
 * Manages API URLs based on environment
 */

// Get the base URL based on environment
const getBaseURL = () => {
  // In development with Vite proxy, use relative URLs
  if (import.meta.env.DEV) {
    return ''; // Use Vite proxy - requests to /api/* will be proxied to backend
  }
  
  // In production, check for environment variables first
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Fallback: try to determine from current location
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // Common production patterns
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:8001`;
  }
  
  // For deployed applications, assume API is on same domain with different port or path
  return `${protocol}//${hostname}/api` || `${protocol}//${hostname}:8001`;
};

const BASE_URL = getBaseURL();

// API endpoints configuration
export const API_CONFIG = {
  BASE_URL,
  ENDPOINTS: {
    // Pre-estimate endpoints
    PRE_ESTIMATE: {
      SESSION: '/api/pre-estimate/session',
      MEASUREMENT: '/api/pre-estimate/measurement',
      MEASUREMENT_PROGRESS: '/api/pre-estimate/measurement/progress',
      DEMO_SCOPE: '/api/pre-estimate/demo-scope',
      WORK_SCOPE: '/api/pre-estimate/work-scope',
      COMPLETE: '/api/pre-estimate/complete',
      ROOM_OPENINGS: '/api/pre-estimate/room-openings',
      PROJECTS: '/api/pre-estimate/projects',
      FINAL_ESTIMATE: '/api/pre-estimate/final-estimate',
      DEMOLITION_SCOPE: '/api/pre-estimate/demolition-scope',
      DOWNLOAD: '/api/pre-estimate/download'
    }
  }
};

// Helper function to build full URL
export const buildApiUrl = (endpoint, params = {}) => {
  let url = `${BASE_URL}${endpoint}`;
  
  // Replace path parameters (e.g., :id with actual id)
  Object.keys(params).forEach(key => {
    url = url.replace(`:${key}`, params[key]);
  });
  
  return url;
};

// Helper function for API calls with consistent error handling
export const apiCall = async (endpoint, options = {}) => {
  const url = typeof endpoint === 'string' ? buildApiUrl(endpoint) : endpoint;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  // Don't set Content-Type for FormData
  if (options.body instanceof FormData) {
    delete defaultOptions.headers['Content-Type'];
  }

  try {
    const response = await fetch(url, {
      ...defaultOptions,
      ...options
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Handle different response types
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  } catch (error) {
    console.error(`API call failed for ${url}:`, error);
    throw error;
  }
};

// Environment info for debugging
export const getEnvironmentInfo = () => {
  return {
    isDev: import.meta.env.DEV,
    mode: import.meta.env.MODE,
    baseUrl: BASE_URL,
    hostname: window.location.hostname,
    origin: window.location.origin,
    customApiUrl: import.meta.env.VITE_API_BASE_URL || 'Not set'
  };
};