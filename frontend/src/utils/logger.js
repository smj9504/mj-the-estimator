// Frontend Logger Utility
class Logger {
  constructor(config = {}) {
    this.config = {
      enableConsole: true,
      enableRemote: false,
      remoteEndpoint: '/api/logs',
      logLevel: 'info',
      appName: 'mj-estimator-frontend',
      ...config
    };
    
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      critical: 4
    };
    
    this.logs = [];
    this.maxLocalLogs = 1000;
  }

  // Format log entry
  formatLog(level, message, data = {}) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data,
      userAgent: navigator.userAgent,
      url: window.location.href,
      appName: this.config.appName
    };
  }

  // Check if should log based on level
  shouldLog(level) {
    return this.levels[level] >= this.levels[this.config.logLevel];
  }

  // Log to console
  logToConsole(level, message, data) {
    if (!this.config.enableConsole) return;
    
    const logEntry = this.formatLog(level, message, data);
    const consoleMethod = level === 'error' || level === 'critical' ? 'error' : 
                         level === 'warn' ? 'warn' : 'log';
    
    console[consoleMethod](`[${level.toUpperCase()}] ${message}`, logEntry);
  }

  // Store log locally
  storeLog(logEntry) {
    this.logs.push(logEntry);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLocalLogs) {
      this.logs = this.logs.slice(-this.maxLocalLogs);
    }
    
    // Store in localStorage for persistence
    try {
      localStorage.setItem('app_logs', JSON.stringify(this.logs.slice(-100)));
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  // Send logs to remote server
  async sendToRemote(logEntry) {
    if (!this.config.enableRemote) return;
    
    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry)
      });
    } catch (error) {
      console.error('Failed to send log to remote:', error);
    }
  }

  // Main logging method
  log(level, message, data = {}) {
    if (!this.shouldLog(level)) return;
    
    const logEntry = this.formatLog(level, message, data);
    
    // Log to console
    this.logToConsole(level, message, data);
    
    // Store locally
    this.storeLog(logEntry);
    
    // Send to remote if enabled
    if (this.config.enableRemote && (level === 'error' || level === 'critical')) {
      this.sendToRemote(logEntry);
    }
  }

  // Convenience methods
  debug(message, data = {}) {
    this.log('debug', message, data);
  }

  info(message, data = {}) {
    this.log('info', message, data);
  }

  warn(message, data = {}) {
    this.log('warn', message, data);
  }

  error(message, data = {}) {
    this.log('error', message, data);
  }

  critical(message, data = {}) {
    this.log('critical', message, data);
  }

  // API request logging
  apiRequest(method, endpoint, status = null, duration = null, error = null) {
    const message = `${method} ${endpoint}${status ? ` - ${status}` : ''}${duration ? ` - ${duration}ms` : ''}`;
    const data = {
      method,
      endpoint,
      status,
      duration,
      error: error ? error.message : null
    };
    
    if (error || (status && status >= 400)) {
      this.error(message, data);
    } else {
      this.info(message, data);
    }
  }

  // User action logging
  userAction(action, category = 'interaction', data = {}) {
    this.info(`User action: ${action}`, {
      action,
      category,
      ...data
    });
  }

  // Performance logging
  performance(metric, value, unit = 'ms', data = {}) {
    this.info(`Performance: ${metric} - ${value}${unit}`, {
      metric,
      value,
      unit,
      ...data
    });
  }

  // Get stored logs
  getLogs(level = null) {
    if (!level) return this.logs;
    return this.logs.filter(log => log.level === level);
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
    localStorage.removeItem('app_logs');
  }

  // Export logs
  exportLogs() {
    const dataStr = JSON.stringify(this.logs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `logs_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  // Error boundary integration
  logError(error, errorInfo) {
    this.error('React Error Boundary', {
      error: error.toString(),
      errorInfo: errorInfo,
      stack: error.stack
    });
  }
}

// Create and export singleton instance
const logger = new Logger({
  enableConsole: import.meta.env.MODE !== 'production',
  logLevel: import.meta.env.MODE === 'production' ? 'warn' : 'debug'
});

// Global error handler
window.addEventListener('error', (event) => {
  logger.error('Global error', {
    message: event.message,
    source: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error ? event.error.stack : null
  });
});

// Unhandled promise rejection
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', {
    reason: event.reason,
    promise: event.promise
  });
});

export default logger;