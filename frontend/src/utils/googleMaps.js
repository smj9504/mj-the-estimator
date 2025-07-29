import { Loader } from '@googlemaps/js-api-loader';

// Google Maps API 유틸리티
export const loadGoogleMapsAPI = async () => {
  try {
    // 이미 로드되어 있는 경우
    if (window.google && window.google.maps && window.google.maps.places) {
      return window.google;
    }

    // API 키 확인
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('Google Maps API key not found. Address autocomplete will not work.');
      return null;
    }

    // Google Maps API 로더 설정
    const loader = new Loader({
      apiKey: apiKey,
      version: 'weekly',
      libraries: ['places']
    });

    // API 로드
    await loader.load();
    return window.google;
  } catch (error) {
    console.error('Failed to load Google Maps API:', error);
    throw error;
  }
};

export default loadGoogleMapsAPI;