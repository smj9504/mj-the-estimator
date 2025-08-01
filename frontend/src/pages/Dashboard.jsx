import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import { buildApiUrl, API_CONFIG } from '../config/api';
import logger from '../utils/logger';

const Dashboard = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editProjectName, setEditProjectName] = useState('');
  const [estimates, setEstimates] = useState([]);

  useEffect(() => {
    if (sessionId) {
      sessionStorage.setItem('currentSessionId', sessionId);
      loadProject();
      loadEstimates();
    }
  }, [sessionId]);

  const loadProject = async () => {
    try {
      setIsLoading(true);
      const response = await api.request(`/api/pre-estimate/session/${sessionId}`);
      
      if (response && response.data) {
        setProject(response.data);
        logger.info('Project loaded successfully', { sessionId, project: response.data });
      } else {
        throw new Error('Project not found');
      }
    } catch (error) {
      console.error('Error loading project:', error);
      logger.error('Failed to load project', { error: error.message, sessionId });
      
      // 실제 네트워크 에러나 서버 에러일 때만 alert 표시
      if (error.message !== 'Project not found' && error.status !== 404) {
        alert('프로젝트를 불러오는데 실패했습니다.');
      }
      navigate('/projects');
    } finally {
      setIsLoading(false);
    }
  };

  const loadEstimates = () => {
    // Load completion status from sessionStorage
    const completionStatus = JSON.parse(sessionStorage.getItem(`completionStatus_${sessionId}`) || '{}');
    
    // Also check if data exists for each step
    const measurementData = sessionStorage.getItem(`measurementData_${sessionId}`);
    const workScopeData = sessionStorage.getItem(`workScopeData_${sessionId}`);
    
    const preEstimateSteps = [
      { 
        name: 'Measurement Data', 
        completed: completionStatus.measurementData || !!measurementData, 
        path: '/pre-estimate/measurement-data' 
      },
      { 
        name: 'Opening Verification', 
        completed: completionStatus.openingVerification || false, 
        path: '/pre-estimate/opening-verification' 
      },
      { 
        name: 'Material Scope', 
        completed: completionStatus.materialScope || !!sessionStorage.getItem(`materialScope_${sessionId}`), 
        path: '/pre-estimate/material-scope' 
      },
      { 
        name: 'Demo Scope', 
        completed: completionStatus.demoScope || !!sessionStorage.getItem(`demoScope_${sessionId}`), 
        path: '/pre-estimate/demo-scope' 
      },
      { 
        name: 'Work Scope', 
        completed: completionStatus.workScope || !!workScopeData, 
        path: '/pre-estimate/work-scope' 
      }
    ];

    const completedSteps = preEstimateSteps.filter(step => step.completed).length;
    const status = completedSteps === preEstimateSteps.length ? 'completed' : 'in_progress';

    // Check if Material Scope and Demo Scope are completed for demolition JSON
    const materialScopeCompleted = preEstimateSteps.find(step => step.name === 'Material Scope')?.completed || false;
    const demoScopeCompleted = preEstimateSteps.find(step => step.name === 'Demo Scope')?.completed || false;
    const demolitionScopeReady = materialScopeCompleted && demoScopeCompleted;

    setEstimates([{
      id: 1,
      name: 'Pre-Estimate',
      status: status,
      lastModified: new Date().toISOString(),
      steps: preEstimateSteps,
      demolitionScopeReady: demolitionScopeReady
    }]);
  };

  const handleEstimateClick = (estimate, step) => {
    // sessionId를 URL 파라미터로 전달
    const pathWithSession = `${step.path}?session=${sessionId}`;
    navigate(pathWithSession);
  };

  const handleEditNameClick = () => {
    setEditProjectName(project?.project_name || '');
    setIsEditingName(true);
  };

  const handleSaveNameEdit = async () => {
    if (!editProjectName.trim()) {
      alert('프로젝트 이름을 입력해주세요.');
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.PRE_ESTIMATE.PROJECTS}/${sessionId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_name: editProjectName.trim()
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      // 프로젝트 정보 다시 로드
      await loadProject();
      loadEstimates(); // estimates도 다시 로드
      setIsEditingName(false);
      setEditProjectName('');
      logger.info('Project name updated successfully', { sessionId, newName: editProjectName });
    } catch (error) {
      logger.error('Failed to update project name', error);
      alert('프로젝트 이름 수정에 실패했습니다.');
    }
  };

  const handleCancelNameEdit = () => {
    setIsEditingName(false);
    setEditProjectName('');
  };

  const getStepStatusIcon = (completed) => {
    if (completed) {
      return (
        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    } else {
      return (
        <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
        </svg>
      );
    }
  };

  const getEstimateStatusBadge = (status) => {
    const statusColors = {
      'in_progress': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-green-100 text-green-800',
      'draft': 'bg-gray-100 text-gray-800'
    };

    const statusLabels = {
      'in_progress': '진행중',
      'completed': '완료',
      'draft': '초안'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {statusLabels[status] || status}
      </span>
    );
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString('ko-KR');
    } catch {
      return dateString;
    }
  };

  const handleDownloadFinalJSON = async () => {
    try {
      const response = await api.request(`/api/pre-estimate/final-estimate/${sessionId}`);
      
      if (response && response.data && response.data.success) {
        // Download the file
        const downloadUrl = buildApiUrl(response.data.download_url);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `final_estimate_${sessionId}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        logger.info('Final JSON downloaded successfully', { sessionId });
      } else {
        throw new Error('Failed to generate final JSON');
      }
    } catch (error) {
      console.error('Error downloading final JSON:', error);
      logger.error('Failed to download final JSON', { error: error.message, sessionId });
      alert('최종 JSON 다운로드에 실패했습니다. 모든 단계가 완료되었는지 확인해주세요.');
    }
  };

  const handleDownloadDemolitionJSON = async () => {
    try {
      const response = await api.request(`/api/pre-estimate/demolition-scope/${sessionId}`);
      
      if (response && response.data && response.data.success) {
        // Download the file
        const downloadUrl = buildApiUrl(response.data.download_url);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `demolition_scope_${sessionId}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        logger.info('Demolition JSON downloaded successfully', { sessionId });
      } else {
        throw new Error('Failed to generate demolition JSON');
      }
    } catch (error) {
      console.error('Error downloading demolition JSON:', error);
      logger.error('Failed to download demolition JSON', { error: error.message, sessionId });
      alert('Demolition JSON 다운로드에 실패했습니다. Material Scope와 Demo Scope가 완료되었는지 확인해주세요.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">프로젝트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <button
                onClick={() => navigate('/projects')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>프로젝트 목록으로</span>
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <div className="flex items-center justify-between mb-2">
                {isEditingName ? (
                  <div className="flex items-center space-x-3 flex-1">
                    <input
                      type="text"
                      value={editProjectName}
                      onChange={(e) => setEditProjectName(e.target.value)}
                      className="flex-1 text-3xl font-bold px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="프로젝트 이름을 입력하세요"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveNameEdit();
                        }
                      }}
                      autoFocus
                    />
                    <button
                      onClick={handleSaveNameEdit}
                      className="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors border border-green-600"
                    >
                      저장
                    </button>
                    <button
                      onClick={handleCancelNameEdit}
                      className="px-3 py-2 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400 transition-colors border border-gray-300"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-3xl font-bold text-gray-900">
                      {project?.project_name || 'Untitled Project'}
                    </h1>
                    <button
                      onClick={handleEditNameClick}
                      className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors border border-blue-600 flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>이름 수정</span>
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center space-x-6 text-sm text-gray-500">
                <span>세션 ID: {sessionId}</span>
                <span>생성일: {formatDate(project?.created_at)}</span>
                {project?.updated_at !== project?.created_at && (
                  <span>수정일: {formatDate(project?.updated_at)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Estimates Section */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">견적서 목록</h2>
                <p className="mt-2 text-gray-600">현재 진행중인 견적서들을 관리하고 편집할 수 있습니다.</p>
              </div>
            </div>

            {estimates.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
                <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">견적서가 없습니다</h3>
                <p className="text-gray-600 mb-6">새 견적서를 생성하여 작업을 시작해보세요.</p>
                <button
                  onClick={() => navigate(`/pre-estimate/measurement-data?session=${sessionId}`)}
                  className="px-4 py-2 bg-blue-600 text-black rounded-md font-medium shadow-md hover:bg-blue-700 transition-colors border border-blue-600"
                  style={{ color: 'black' }}
                >
                  첫 번째 견적서 생성
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {estimates.map((estimate) => (
                  <div key={estimate.id} className="bg-white rounded-lg shadow-sm border">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-xl font-semibold text-gray-900">{estimate.name}</h3>
                          {getEstimateStatusBadge(estimate.status)}
                        </div>
                        <div className="text-sm text-gray-500">
                          최종 수정: {formatDate(estimate.lastModified)}
                        </div>
                      </div>

                      {/* Progress Steps */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium text-gray-900">
                            Progress: {estimate.steps.filter(s => s.completed).length} of {estimate.steps.length} steps completed
                          </h4>
                          <div className="text-sm text-gray-500">
                            {Math.round((estimate.steps.filter(s => s.completed).length / estimate.steps.length) * 100)}% Complete
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          {estimate.steps.map((step, index) => (
                            <div key={step.name} className="flex items-center">
                              <div className="flex flex-col items-center cursor-pointer" onClick={() => handleEstimateClick(estimate, step)}>
                                <div className={`
                                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium mb-2
                                  ${step.completed 
                                    ? 'bg-green-100 border-2 border-green-500' 
                                    : 'bg-gray-100 border-2 border-gray-300'}
                                  hover:bg-opacity-80 transition-colors
                                `}>
                                  {getStepStatusIcon(step.completed)}
                                </div>
                                <span className={`text-xs font-medium text-center max-w-20 ${
                                  step.completed ? 'text-green-600' : 'text-gray-500'
                                }`}>
                                  {step.name}
                                </span>
                              </div>
                              {index < estimate.steps.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-4 ${
                                  step.completed ? 'bg-green-500' : 'bg-gray-200'
                                }`} />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => navigate(`/pre-estimate/measurement-data?session=${sessionId}`)}
                          className="px-4 py-2 bg-blue-600 text-black text-sm rounded-md hover:bg-blue-700 transition-colors border border-blue-600"
                          style={{ color: 'black' }}
                        >
                          계속 작업
                        </button>
                        {estimate.demolitionScopeReady && (
                          <button
                            onClick={handleDownloadDemolitionJSON}
                            className="px-4 py-2 bg-orange-600 text-black text-sm rounded-md hover:bg-orange-700 transition-colors border border-orange-600 flex items-center space-x-2"
                            style={{ color: 'black' }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Demolition JSON 다운로드</span>
                          </button>
                        )}
                        {estimate.status === 'completed' && (
                          <button
                            onClick={handleDownloadFinalJSON}
                            className="px-4 py-2 bg-green-600 text-black text-sm rounded-md hover:bg-green-700 transition-colors border border-green-600 flex items-center space-x-2"
                            style={{ color: 'black' }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>최종 JSON 다운로드</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Future Features Placeholder */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">추후 기능</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Invoice 관리</h4>
                <p className="text-sm text-gray-600">견적서를 바탕으로 인보이스 생성 및 관리</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">진행상태 관리</h4>
                <p className="text-sm text-gray-600">프로젝트 진행상태 추적 및 알림</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">보고서 생성</h4>
                <p className="text-sm text-gray-600">자동화된 보고서 및 분석 기능</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;