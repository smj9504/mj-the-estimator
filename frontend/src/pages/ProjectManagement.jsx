import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { buildApiUrl, API_CONFIG } from '../config/api';
import logger from '../utils/logger';

const ProjectManagement = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      console.log('Loading projects from API...');
      
      // Use direct fetch for simplicity
      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.PRE_ESTIMATE.PROJECTS));
      const data = await response.json();
      
      if (response.ok && data) {
        // data.projects가 없거나 빈 배열이어도 정상적인 상황
        setProjects(data.projects || []);
        logger.info('Projects loaded successfully', { count: (data.projects || []).length });
      } else {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      logger.error('Failed to load projects', { 
        error: error.message, 
        status: error.status
      });
      
      // 실제 네트워크 에러나 서버 에러일 때만 alert 표시
      // 빈 데이터나 데이터 없음은 정상적인 상황이므로 alert 표시하지 않음
      if (error.status !== 404 && !error.message.includes('projects')) {
        alert(`프로젝트 목록을 불러오는데 실패했습니다: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };


  const handleDelete = async (project) => {
    if (!confirm(`"${project.project_name || 'Untitled Project'}" 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      setIsDeleting(project.session_id);
      const response = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.PRE_ESTIMATE.PROJECTS}/${project.session_id}`), {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      await loadProjects();
      logger.info('Project deleted successfully', { sessionId: project.session_id });
    } catch (error) {
      logger.error('Failed to delete project', error);
      alert('프로젝트 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleProjectClick = (project) => {
    sessionStorage.setItem('currentSessionId', project.session_id);
    navigate(`/dashboard/${project.session_id}`);
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString('ko-KR');
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status) => {
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">프로젝트 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">프로젝트 관리</h1>
              <p className="mt-2 text-gray-600">생성된 프로젝트들을 관리하고 계속 작업할 수 있습니다.</p>
            </div>
            <button
              onClick={() => navigate('/create-project')}
              className="px-4 py-2 bg-blue-600 text-black rounded-md font-medium shadow-md hover:bg-blue-700 transition-colors border border-blue-600"
              style={{ color: 'black' }}
            >
              새 프로젝트 생성
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">프로젝트가 없습니다</h3>
              <p className="text-gray-600 mb-6">새 프로젝트를 생성하여 견적 작업을 시작해보세요.</p>
              <button
                onClick={() => navigate('/create-project')}
                className="px-4 py-2 bg-blue-600 text-black rounded-md font-medium shadow-md hover:bg-blue-700 transition-colors border border-blue-600"
                style={{ color: 'black' }}
              >
                첫 번째 프로젝트 생성
              </button>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {projects.map((project) => (
                  <li key={project.session_id} className="hover:bg-gray-50">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            <h3 
                              className="text-lg font-medium text-blue-600 hover:text-blue-800 truncate cursor-pointer transition-colors"
                              onClick={() => handleProjectClick(project)}
                            >
                              {project.project_name || 'Untitled Project'}
                            </h3>
                            {getStatusBadge(project.status)}
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500">
                            <span>생성일: {formatDate(project.created_at)}</span>
                            {project.updated_at !== project.created_at && (
                              <span className="ml-4">수정일: {formatDate(project.updated_at)}</span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-gray-400">
                            Session ID: {project.session_id}
                          </div>
                        </div>
                        <div className="flex items-center">
                          <button
                            onClick={() => handleDelete(project)}
                            disabled={isDeleting === project.session_id}
                            className="px-3 py-1 bg-red-600 text-black text-sm rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 border border-red-600"
                            style={{ color: 'black' }}
                          >
                            {isDeleting === project.session_id ? '삭제중...' : '삭제'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectManagement;