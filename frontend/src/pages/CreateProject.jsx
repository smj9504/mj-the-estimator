import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { createSession } from '../utils/api';
import { loadGoogleMapsAPI } from '../utils/googleMaps';
import logger from '../utils/logger';

// Google Places API를 위한 글로벌 변수
let autocompleteService = null;
let placesService = null;

const CreateProject = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    projectName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    companyId: '',
    notes: ''
  });
  
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const addressInputRef = useRef(null);

  // Supabase 클라이언트 초기화
  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co',
    import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'
  );

  useEffect(() => {
    // Google Places API 초기화
    const initializeGoogleMaps = async () => {
      try {
        const google = await loadGoogleMapsAPI();
        if (google && google.maps && google.maps.places) {
          // 현재는 기존 API를 계속 사용 (나중에 새로운 API로 마이그레이션 예정)
          autocompleteService = new google.maps.places.AutocompleteService();
          placesService = new google.maps.places.PlacesService(document.createElement('div'));
          logger.info('Google Places API initialized successfully');
        }
      } catch (error) {
        console.warn('Google Places API could not be loaded:', error);
        logger.warn('Google Places API initialization failed', { error: error.message });
      }
    };

    initializeGoogleMaps();
    
    // 회사 정보 로드
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setIsLoadingCompanies(true);
      const { data, error } = await supabase
        .from('companies') // 테이블명은 실제 테이블명으로 변경 필요
        .select('*')
        .order('name');

      if (error) {
        console.error('Error loading companies:', error);
        logger.error('Failed to load companies', { error: error.message });
        // 로컬 데이터로 폴백
        setCompanies([
          { id: 1, name: 'Sample Company 1' },
          { id: 2, name: 'Sample Company 2' }
        ]);
      } else {
        setCompanies(data);
        logger.info('Companies loaded successfully', { count: data.length });
      }
    } catch (error) {
      console.error('Error connecting to Supabase:', error);
      logger.error('Supabase connection error', { error: error.message });
      // 로컬 데이터로 폴백
      setCompanies([
        { id: 1, name: 'Sample Company 1' },
        { id: 2, name: 'Sample Company 2' }
      ]);
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // 주소 입력시 Google Places API 검색
    if (name === 'address' && value.length > 2) {
      searchAddresses(value);
    } else if (name === 'address' && value.length <= 2) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
    }
  };

  const searchAddresses = async (input) => {
    if (!autocompleteService) {
      console.warn('Google Places API not loaded');
      return;
    }

    try {
      const request = {
        input: input,
        types: ['address'],
        componentRestrictions: { country: 'us' }, // 미국으로 제한, 필요시 변경
        language: 'en' // 영어로 결과 반환
      };

      autocompleteService.getPlacePredictions(request, (predictions, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setAddressSuggestions(predictions.slice(0, 5)); // 상위 5개만 표시
          setShowAddressSuggestions(true);
        } else {
          setAddressSuggestions([]);
          setShowAddressSuggestions(false);
        }
      });
    } catch (error) {
      console.error('Error searching addresses:', error);
      logger.error('Address search error', { error: error.message });
    }
  };

  const handleAddressSelect = (prediction) => {
    if (!placesService) {
      setFormData(prev => ({
        ...prev,
        address: prediction.description
      }));
      setShowAddressSuggestions(false);
      return;
    }

    // Place details 가져오기 (영어로 요청)
    placesService.getDetails(
      { 
        placeId: prediction.place_id,
        language: 'en' // 영어로 결과 반환
      },
      (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          // 주소 구성요소 파싱
          const addressComponents = place.address_components;
          let streetNumber = '', streetName = '', city = '', state = '', zipCode = '';

          addressComponents.forEach(component => {
            const types = component.types;
            if (types.includes('street_number')) {
              streetNumber = component.long_name;
            } else if (types.includes('route')) {
              streetName = component.long_name;
            } else if (types.includes('locality')) {
              city = component.long_name;
            } else if (types.includes('administrative_area_level_1')) {
              state = component.short_name;
            } else if (types.includes('postal_code')) {
              zipCode = component.long_name;
            }
          });

          // 거리 주소만 조합 (번지 + 도로명)
          const streetAddress = `${streetNumber} ${streetName}`.trim();

          // 선택된 주소로 입력 필드 값을 완전히 교체
          setFormData(prev => ({
            ...prev,
            address: streetAddress, // 거리 주소만 사용
            city: city,
            state: state,
            zipCode: zipCode
          }));

          logger.info('Address selected and parsed', {
            streetAddress: streetAddress,
            city, state, zipCode
          });
        } else {
          setFormData(prev => ({
            ...prev,
            address: prediction.description
          }));
        }
        
        // 자동완성 목록 숨기기
        setShowAddressSuggestions(false);
        setAddressSuggestions([]);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.projectName.trim()) {
      alert('Project name is required');
      return;
    }

    try {
      setIsLoading(true);
      logger.info('Creating new project', formData);

      // 세션 생성
      const response = await createSession(formData.projectName);
      const sessionId = response.data.session_id;

      // 프로젝트 정보를 세션 스토리지에 저장
      sessionStorage.setItem(`projectInfo_${sessionId}`, JSON.stringify(formData));

      logger.info('Project created successfully', { sessionId, projectName: formData.projectName });

      // Measurement Data 페이지로 이동
      navigate(`/pre-estimate/measurement-data?session=${sessionId}`);

    } catch (error) {
      console.error('Error creating project:', error);
      logger.error('Project creation failed', { error: error.message });
      alert('Failed to create project. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/projects');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
          <p className="text-gray-600 mt-1">
            Set up a new estimation project with property and company information
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-6">
          <div className="space-y-6">
            
            {/* Project Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Project Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    name="projectName"
                    value={formData.projectName}
                    onChange={handleInputChange}
                    placeholder="e.g., Main Street Renovation"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Property Address */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Property Address</h3>
              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address
                  </label>
                  <input
                    ref={addressInputRef}
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Start typing address..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  
                  {/* Address Suggestions */}
                  {showAddressSuggestions && addressSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {addressSuggestions.map((prediction, index) => (
                        <div
                          key={prediction.place_id}
                          onClick={() => handleAddressSelect(prediction)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="text-sm text-gray-900">{prediction.structured_formatting.main_text}</div>
                          <div className="text-xs text-gray-500">{prediction.structured_formatting.secondary_text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="City"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      placeholder="State"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleInputChange}
                      placeholder="ZIP Code"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Company Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Company Information</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Company
                </label>
                {isLoadingCompanies ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-gray-500">Loading companies...</span>
                  </div>
                ) : (
                  <select
                    name="companyId"
                    value={formData.companyId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a company...</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Additional Notes */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Any additional notes about the project..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

          </div>

          {/* Form Actions */}
          <div className="flex justify-between pt-6 border-t border-gray-200 mt-8">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 border-2 border-gray-400 text-gray-700 bg-white rounded-md font-medium hover:bg-gray-100 shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.projectName.trim()}
              className={`px-6 py-2 rounded-md font-medium shadow-md transition-colors ${
                isLoading || !formData.projectName.trim()
                  ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating Project...</span>
                </span>
              ) : (
                '🚀 Create Project'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProject;