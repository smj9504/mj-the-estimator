import { useState } from 'react'
import PreEstimateMain from './pages/PreEstimate/PreEstimateMain'
import './App.css'

function App() {
  const [currentView, setCurrentView] = useState('pre-estimate') // 'pre-estimate' or 'main-estimate'

  return (
    <div className="min-h-screen bg-gray-50">
      {currentView === 'pre-estimate' && (
        <PreEstimateMain 
          onComplete={() => setCurrentView('main-estimate')}
        />
      )}
      
      {currentView === 'main-estimate' && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Main Estimate Screen
            </h1>
            <p className="text-gray-600 mb-6">
              This will be the main estimate generation screen
            </p>
            <button
              onClick={() => setCurrentView('pre-estimate')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Back to Pre-Estimate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
