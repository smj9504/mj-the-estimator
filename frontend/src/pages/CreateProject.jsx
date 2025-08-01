import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { createSession } from '../utils/api';
import { buildApiUrl, API_CONFIG } from '../config/api';
import { loadGoogleMapsAPI } from '../utils/googleMaps';
import logger from '../utils/logger';

// Google Places API를 위한 글로벌 변수
let autocompleteService = null;
let placesService = null;

const CreateProject = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    projectName: '',
    street: '',
    city: '',
    state: '',
    zipcode: '',
    occupancy: '',
    companyId: ''
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
    
    // 외부 클릭 시 자동완성 드롭다운 닫기
    const handleClickOutside = (event) => {
      if (addressInputRef.current && !addressInputRef.current.contains(event.target)) {
        setShowAddressSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
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

    // Street 주소 입력시 Google Places API 검색
    if (name === 'street' && value.length > 2) {
      searchAddresses(value);
    } else if (name === 'street' && value.length <= 2) {
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
      // If no Places service, just set the address in street field
      setFormData(prev => ({
        ...prev,
        street: prediction.description
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
            street: streetAddress, // 거리 주소를 street 필드에 저장
            city: city,
            state: state,
            zipcode: zipCode
          }));

          logger.info('Address selected and parsed', {
            fullAddress: place.formatted_address,
            streetAddress: streetAddress,
            city, state, zipCode
          });
        } else {
          setFormData(prev => ({
            ...prev,
            street: prediction.description
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

    if (!formData.companyId) {
      alert('Please select a company');
      return;
    }

    try {
      setIsLoading(true);
      logger.info('Creating new project', formData);

      // 선택된 회사 정보 가져오기
      const selectedCompany = companies.find(company => company.id === parseInt(formData.companyId));
      
      // 전체 주소 조합
      const fullAddress = [
        formData.street,
        formData.city,
        formData.state,
        formData.zipcode
      ].filter(Boolean).join(', ');

      // 프로젝트 생성 요청 데이터 준비
      const projectData = {
        project_name: formData.projectName,
        jobsite: {
          full_address: fullAddress,
          street: formData.street,
          city: formData.city,
          state: formData.state,
          zipcode: formData.zipcode
        },
        occupancy: formData.occupancy,
        company: selectedCompany ? {
          name: selectedCompany.name,
          address: selectedCompany.address,
          city: selectedCompany.city,
          state: selectedCompany.state,
          zip: selectedCompany.zip,
          phone: selectedCompany.phone,
          email: selectedCompany.email
        } : null
      };

      // 세션 생성 (회사 정보 포함)
      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.PRE_ESTIMATE.SESSION), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const sessionId = result.session_id;

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
                
                {/* Address Component Fields */}
                <div className="md:col-span-2">
                  <h4 className="text-md font-medium text-gray-800 mb-3">Address Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Street Address
                      </label>
                      <input
                        type="text"
                        name="street"
                        value={formData.street}
                        onChange={handleInputChange}
                        placeholder="e.g., 123 Main Street (start typing for suggestions)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoComplete="off"
                      />
                      
                      {/* Address Suggestions Dropdown for Street field */}
                      {showAddressSuggestions && addressSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {addressSuggestions.map((suggestion, index) => (
                            <div
                              key={suggestion.place_id}
                              className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                              onClick={() => handleAddressSelect(suggestion)}
                            >
                              <div className="font-medium">{suggestion.structured_formatting.main_text}</div>
                              <div className="text-gray-500 text-xs">{suggestion.structured_formatting.secondary_text}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
                        placeholder="CA"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        name="zipcode"
                        value={formData.zipcode}
                        onChange={handleInputChange}
                        placeholder="12345"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Occupancy Status
                    <span className="text-xs text-gray-500 block font-normal mt-1">
                      Current occupancy status of the property during reconstruction
                    </span>
                  </label>
                  <select
                    name="occupancy"
                    value={formData.occupancy}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select occupancy status...</option>
                    <option value="Vacant - Unoccupied">Vacant - Unoccupied</option>
                    <option value="Partially Occupied">Partially Occupied</option>
                    <option value="Fully Occupied">Fully Occupied</option>
                    <option value="Owner Occupied">Owner Occupied</option>
                    <option value="Tenant Occupied">Tenant Occupied</option>
                  </select>
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
                  value={formData.notes || ''}
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