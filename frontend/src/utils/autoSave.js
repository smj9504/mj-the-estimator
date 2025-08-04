// Auto-save utility for Pre-Estimate workflow
import { debounce } from './debounce';

class AutoSaveManager {
  constructor() {
    this.saveCallbacks = new Map();
    this.saveStatus = new Map();
    this.saveTimers = new Map();
  }

  // Register auto-save for a specific data type
  register(key, saveFunction, options = {}) {
    const { 
      debounceTime = 2000, // 2 seconds default
      periodicSaveInterval = 30000, // 30 seconds default
      onStatusChange = null 
    } = options;

    // Create debounced save function
    const debouncedSave = debounce(async (data) => {
      try {
        this.updateStatus(key, 'saving');
        await saveFunction(data);
        this.updateStatus(key, 'saved');
        
        // Clear saved status after 3 seconds
        setTimeout(() => {
          if (this.saveStatus.get(key) === 'saved') {
            this.updateStatus(key, 'idle');
          }
        }, 3000);
      } catch (error) {
        console.error(`Auto-save failed for ${key}:`, error);
        this.updateStatus(key, 'error');
      }
    }, debounceTime);

    // Store callback
    this.saveCallbacks.set(key, {
      debouncedSave,
      saveFunction,
      onStatusChange
    });

    // Setup periodic save if requested
    if (periodicSaveInterval > 0) {
      const timer = setInterval(() => {
        const lastData = this.lastData?.get(key);
        if (lastData) {
          saveFunction(lastData).catch(console.error);
        }
      }, periodicSaveInterval);
      
      this.saveTimers.set(key, timer);
    }

    return debouncedSave;
  }

  // Trigger auto-save
  save(key, data) {
    const callback = this.saveCallbacks.get(key);
    if (callback) {
      // Store last data for periodic saves
      if (!this.lastData) {
        this.lastData = new Map();
      }
      this.lastData.set(key, data);
      
      // Trigger debounced save
      callback.debouncedSave(data);
    }
  }

  // Update save status
  updateStatus(key, status) {
    this.saveStatus.set(key, status);
    const callback = this.saveCallbacks.get(key);
    if (callback?.onStatusChange) {
      callback.onStatusChange(status);
    }
  }

  // Get current save status
  getStatus(key) {
    return this.saveStatus.get(key) || 'idle';
  }

  // Force immediate save (bypass debounce)
  async forceSave(key, data) {
    const callback = this.saveCallbacks.get(key);
    if (callback) {
      try {
        this.updateStatus(key, 'saving');
        await callback.saveFunction(data);
        this.updateStatus(key, 'saved');
      } catch (error) {
        console.error(`Force save failed for ${key}:`, error);
        this.updateStatus(key, 'error');
        throw error;
      }
    }
  }

  // Cleanup
  unregister(key) {
    const timer = this.saveTimers.get(key);
    if (timer) {
      clearInterval(timer);
      this.saveTimers.delete(key);
    }
    
    this.saveCallbacks.delete(key);
    this.saveStatus.delete(key);
    this.lastData?.delete(key);
  }

  // Cleanup all
  cleanup() {
    for (const [key] of this.saveCallbacks) {
      this.unregister(key);
    }
  }
}

// Create singleton instance
export const autoSaveManager = new AutoSaveManager();

// Auto-save API functions
const API_BASE = 'http://localhost:8001/api/pre-estimate/auto-save';

export const autoSaveAPI = {
  // Save material scope data
  async saveMaterialScope(sessionId, data) {
    const response = await fetch(`${API_BASE}/material-scope/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save material scope');
    }
    
    return response.json();
  },

  // Get saved material scope data
  async getMaterialScope(sessionId) {
    const response = await fetch(`${API_BASE}/material-scope/${sessionId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get saved material scope');
    }
    
    return response.json();
  },

  // Save progress data
  async saveProgress(sessionId, data) {
    const response = await fetch(`${API_BASE}/progress/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save progress');
    }
    
    return response.json();
  },

  // Get saved progress data
  async getProgress(sessionId) {
    const response = await fetch(`${API_BASE}/progress/${sessionId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get saved progress');
    }
    
    return response.json();
  },

  // Save measurement edits
  async saveMeasurementEdits(sessionId, data) {
    const response = await fetch(`${API_BASE}/measurement/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save measurement edits');
    }
    
    return response.json();
  },

  // Save demo scope data
  async saveDemoScope(sessionId, data) {
    const response = await fetch(`${API_BASE}/demo-scope/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save demo scope');
    }
    
    return response.json();
  },

  // Get saved demo scope data
  async getDemoScope(sessionId) {
    const response = await fetch(`${API_BASE}/demo-scope/${sessionId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get saved demo scope');
    }
    
    return response.json();
  },

  // Save kitchen cabinetry data
  async saveKitchenCabinetry(sessionId, data) {
    const response = await fetch(`${API_BASE}/kitchen-cabinetry/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save kitchen cabinetry');
    }
    
    return response.json();
  },

  // Get saved kitchen cabinetry data
  async getKitchenCabinetry(sessionId) {
    const response = await fetch(`${API_BASE}/kitchen-cabinetry/${sessionId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get saved kitchen cabinetry');
    }
    
    return response.json();
  },

  // Analyze kitchen images with AI
  async analyzeKitchenImages(sessionId, images) {
    const formData = new FormData();
    formData.append('session_id', sessionId);
    
    // Add images to FormData
    images.forEach((image, index) => {
      if (image.file) {
        formData.append(`images`, image.file);
      }
    });
    
    const response = await fetch(`${API_BASE}/kitchen-cabinetry/analyze`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('Failed to analyze kitchen images');
    }
    
    return response.json();
  }
};

// Helper to setup auto-save for a component
export function useAutoSave(key, saveFunction, options = {}) {
  const debouncedSave = autoSaveManager.register(key, saveFunction, options);
  
  return {
    save: (data) => autoSaveManager.save(key, data),
    forceSave: (data) => autoSaveManager.forceSave(key, data),
    getStatus: () => autoSaveManager.getStatus(key),
    cleanup: () => autoSaveManager.unregister(key)
  };
}