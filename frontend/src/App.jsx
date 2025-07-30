import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import OpeningVerification from './pages/PreEstimate/OpeningVerification'
import MeasurementData from './pages/PreEstimate/MeasurementData'
import MaterialScope from './pages/PreEstimate/MaterialScope'
import DemoScope from './pages/PreEstimate/DemoScope'
import WorkScope from './pages/PreEstimate/WorkScope'
import CreateProject from './pages/CreateProject'
import ProjectManagement from './pages/ProjectManagement'
import Dashboard from './pages/Dashboard'
import './App.css'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Default route redirects to project management */}
          <Route path="/" element={<Navigate to="/projects" replace />} />
          
          {/* Project management */}
          <Route path="/projects" element={<ProjectManagement />} />
          
          {/* Project creation */}
          <Route path="/create-project" element={<CreateProject />} />
          
          {/* Dashboard */}
          <Route path="/dashboard/:sessionId" element={<Dashboard />} />
          
          {/* Pre-estimate workflow routes */}
          <Route path="/pre-estimate/measurement-data" element={<MeasurementData />} />
          <Route path="/pre-estimate/opening-verification" element={<OpeningVerification />} />
          <Route path="/pre-estimate/material-scope" element={<MaterialScope />} />
          <Route path="/pre-estimate/demo-scope" element={<DemoScope />} />
          <Route path="/pre-estimate/work-scope" element={<WorkScope />} />
          
          {/* Main estimate screen (placeholder) */}
          <Route path="/main-estimate" element={
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                  Main Estimate Screen
                </h1>
                <p className="text-gray-600 mb-6">
                  This will be the main estimate generation screen
                </p>
                <button
                  onClick={() => window.location.href = '/projects'}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium shadow-md hover:bg-blue-700 transition-colors"
                >
                  Back to Projects
                </button>
              </div>
            </div>
          } />
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
