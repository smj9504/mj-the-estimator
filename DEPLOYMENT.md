# Deployment Configuration Guide

## Frontend API URL Configuration

The frontend application now supports environment-based API URL configuration for different deployment scenarios.

### How it works

1. **Development Environment**: Uses Vite proxy configuration (see `vite.config.js`)
   - All `/api/*` requests are automatically proxied to `http://localhost:8001`
   - No additional configuration needed for local development

2. **Production Environment**: Uses environment variables or auto-detection
   - Set `VITE_API_BASE_URL` environment variable for custom API endpoints
   - If not set, automatically detects based on current domain

### Configuration Options

#### Option 1: Environment Variable (Recommended for Production)
```bash
# Set environment variable before building
export VITE_API_BASE_URL=https://your-api-domain.com
npm run build
```

#### Option 2: .env file
Create a `.env` file in the frontend directory:
```env
VITE_API_BASE_URL=https://your-api-domain.com
```

#### Option 3: Auto-detection (Fallback)
If no environment variable is set, the app will attempt to auto-detect:
- Same domain: `https://yourdomain.com/api`
- Same domain with port: `https://yourdomain.com:8001`

### Deployment Examples

#### Docker Deployment
```dockerfile
# Build stage
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

#### Vercel Deployment
Add environment variable in Vercel dashboard:
- Name: `VITE_API_BASE_URL`
- Value: `https://your-api-domain.com`

#### Netlify Deployment
Add environment variable in Netlify dashboard:
- Name: `VITE_API_BASE_URL`
- Value: `https://your-api-domain.com`

### Development vs Production

#### Development (localhost:5173)
- Uses Vite proxy configuration
- Backend runs on localhost:8001
- No additional configuration needed

#### Production
- Uses environment variable or auto-detection
- Can be deployed to any domain
- API can be on same or different domain

### Testing Configuration

To test the configuration, you can check the environment info in the browser console:

```javascript
import { getEnvironmentInfo } from './src/config/api.js';
console.log(getEnvironmentInfo());
```

This will show:
- Current environment mode
- Detected base URL
- Custom API URL (if set)
- Current hostname and origin

### Troubleshooting

1. **CORS Issues**: Ensure your backend API is configured to accept requests from your frontend domain
2. **SSL Issues**: Use HTTPS for both frontend and backend in production
3. **Path Issues**: Ensure API endpoints start with `/api/` prefix
4. **Network Issues**: Check that the API server is accessible from the frontend domain

### Configuration Files Changed

The following files implement the new configuration system:

- `frontend/src/config/api.js` - Main API configuration
- `frontend/src/utils/api.js` - Updated to use configuration
- `frontend/src/pages/PreEstimate/MeasurementData.jsx` - Updated API calls
- `frontend/src/pages/Dashboard.jsx` - Updated API calls  
- `frontend/src/pages/ProjectManagement.jsx` - Updated API calls
- `frontend/src/pages/CreateProject.jsx` - Updated API calls
- `frontend/.env.example` - Environment variable examples