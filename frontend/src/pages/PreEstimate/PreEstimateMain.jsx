import React, { useState } from 'react';
import MeasurementData from './MeasurementData';
import DemoScope from './DemoScope';
import WorkScope from './WorkScope';

const PreEstimateMain = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState({
    measurement: null,
    demoScope: null,
    workScope: null
  });

  const workflows = [
    { 
      name: 'measurement', 
      title: 'Measurement Data',
      description: 'Upload and process measurement data from images or CSV files',
      component: MeasurementData 
    },
    { 
      name: 'demo-scope', 
      title: "Demo'd Scope",
      description: 'Define areas that have already been demolished',
      component: DemoScope 
    },
    { 
      name: 'work-scope', 
      title: 'Work Scope',
      description: 'Define the scope of work for reconstruction',
      component: WorkScope 
    }
  ];

  const handleNext = (stepData) => {
    const stepName = workflows[currentStep].name;
    setData(prev => ({
      ...prev,
      [stepName]: stepData
    }));
    
    if (currentStep < workflows.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    console.log('Pre-estimate data completed:', data);
    // TODO: Save to backend
    if (onComplete) {
      onComplete(data);
    }
  };

  const CurrentComponent = workflows[currentStep].component;
  const currentWorkflow = workflows[currentStep];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Pre-Estimate Setup
          </h1>
          <p className="text-gray-600">
            Complete these steps before generating your estimate
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {workflows.map((workflow, index) => (
              <div key={workflow.name} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${index <= currentStep 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-500'}
                `}>
                  {index + 1}
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  index <= currentStep ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {workflow.title}
                </span>
                {index < workflows.length - 1 && (
                  <div className={`w-20 h-0.5 mx-4 ${
                    index < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Current Step Content */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {currentWorkflow.title}
            </h2>
            <p className="text-gray-600">
              {currentWorkflow.description}
            </p>
          </div>

          <CurrentComponent
            data={data[currentWorkflow.name]}
            onNext={handleNext}
            onPrevious={currentStep > 0 ? handlePrevious : null}
          />
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className={`px-4 py-2 rounded-md font-medium ${
              currentStep === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Previous
          </button>

          {currentStep === workflows.length - 1 ? (
            <button
              onClick={handleComplete}
              className="px-6 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700"
            >
              Complete Setup
            </button>
          ) : (
            <button
              onClick={() => handleNext(data[currentWorkflow.name])}
              className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreEstimateMain;