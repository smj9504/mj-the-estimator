import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';

const ImageUploader = ({
  onImagesUploaded,
  maxImages = 10,
  acceptedFormats = ['image/jpeg', 'image/png', 'image/webp'],
  maxSizePerImage = 10 * 1024 * 1024 // 10MB
}) => {
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [uploadErrors, setUploadErrors] = useState([]);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      previewUrls.forEach(preview => {
        if (preview.url) {
          URL.revokeObjectURL(preview.url);
        }
      });
    };
  }, [previewUrls]);

  // Image preprocessing
  const preprocessImage = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              throw new Error('Failed to get canvas context');
            }
            
            // Calculate new dimensions (max 2048px)
            const maxDimension = 2048;
            let { width, height } = img;
            
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = (height / width) * maxDimension;
                width = maxDimension;
              } else {
                width = (width / height) * maxDimension;
                height = maxDimension;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Clear canvas and draw image
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve({
                    original: file,
                    processed: blob,
                    dimensions: { width: Math.round(width), height: Math.round(height) },
                    size: blob.size
                  });
                } else {
                  reject(new Error('Failed to create blob from canvas'));
                }
              },
              'image/jpeg',
              0.85
            );
          } catch (error) {
            reject(error);
          }
        };
        
        img.onerror = (error) => {
          reject(new Error('Failed to load image: ' + error.message));
        };
        
        img.src = e.target.result;
      };
      
      reader.onerror = (error) => {
        reject(new Error('Failed to read file: ' + error.message));
      };
      
      reader.readAsDataURL(file);
    });
  };

  // Handle file drop/selection - SIMPLIFIED VERSION
  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    console.log('🚀 SIMPLE: Processing', acceptedFiles.length, 'files');
    
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(({ file, errors }) => ({
        name: file.name,
        errors: errors.map(e => e.message).join(', ')
      }));
      setUploadErrors(errors);
      setTimeout(() => setUploadErrors([]), 5000);
    }

    // Check max images limit
    if (images.length + acceptedFiles.length > maxImages) {
      alert(`최대 ${maxImages}개의 이미지만 업로드할 수 있습니다.`);
      acceptedFiles = acceptedFiles.slice(0, maxImages - images.length);
    }

    // SIMPLE: Just use original files directly, no processing
    const newPreviewUrls = [];

    for (const file of acceptedFiles) {
      try {
        // Create URL directly from original file - NO PROCESSING
        const url = URL.createObjectURL(file);
        console.log('✅ SIMPLE: Created URL for', file.name, ':', url);
        
        newPreviewUrls.push({
          id: `${file.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          url,
          name: file.name,
          size: file.size,
          dimensions: { width: 'auto', height: 'auto' },
          isOriginal: true
        });
      } catch (error) {
        console.error('❌ SIMPLE: Failed to create URL for:', file.name, error);
        setUploadErrors(prev => [...prev, {
          name: file.name,
          errors: 'Failed to create image URL: ' + error.message
        }]);
      }
    }

    // Update state - use original files for processing too
    const updatedImages = [...images, ...acceptedFiles.map(file => ({ original: file, processed: file }))];
    const updatedPreviews = [...previewUrls, ...newPreviewUrls];
    
    setImages(updatedImages);
    setPreviewUrls(updatedPreviews);
    
    console.log('✅ SIMPLE: State updated, preview count:', updatedPreviews.length);
    
    // Notify parent
    if (onImagesUploaded) {
      onImagesUploaded(updatedImages);
    }
  }, [images, previewUrls, maxImages, onImagesUploaded]);

  // Remove image - SIMPLIFIED
  const removeImage = useCallback((index) => {
    const preview = previewUrls[index];
    console.log('🗑️ SIMPLE: Removing image:', preview.name);
    
    // Revoke URL to prevent memory leak
    if (preview.url) {
      URL.revokeObjectURL(preview.url);
    }
    
    const updatedImages = images.filter((_, i) => i !== index);
    const updatedPreviews = previewUrls.filter((_, i) => i !== index);
    
    setImages(updatedImages);
    setPreviewUrls(updatedPreviews);
    
    if (onImagesUploaded) {
      onImagesUploaded(updatedImages);
    }
  }, [images, previewUrls, onImagesUploaded]);

  // Dropzone configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFormats.reduce((acc, format) => {
      acc[format] = [];
      return acc;
    }, {}),
    maxSize: maxSizePerImage,
    multiple: true
  });

  return (
    <div className="image-uploader">
      {/* Upload area */}
      <div
        {...getRootProps()}
        className={`upload-dropzone border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        
        <div className="mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        
        {isDragActive ? (
          <p className="text-purple-600 font-medium">이미지를 여기에 놓으세요...</p>
        ) : (
          <div>
            <p className="text-gray-700 font-medium mb-1">
              클릭하거나 이미지를 드래그하여 업로드
            </p>
            <p className="text-sm text-gray-500">
              최대 {maxImages}개, 개당 {maxSizePerImage / 1024 / 1024}MB까지
            </p>
            <p className="text-xs text-gray-400 mt-1">
              지원 형식: JPEG, PNG, WebP
            </p>
          </div>
        )}
      </div>

      {/* Error messages */}
      {uploadErrors.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm font-medium text-red-800 mb-1">업로드 오류:</p>
          {uploadErrors.map((error, index) => (
            <p key={index} className="text-xs text-red-600">
              {error.name}: {error.errors}
            </p>
          ))}
        </div>
      )}

      {/* Image preview grid */}
      {previewUrls.length > 0 && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-medium text-gray-700">
              업로드된 이미지 ({previewUrls.length}/{maxImages})
            </h4>
            <button
              onClick={() => {
                previewUrls.forEach(preview => URL.revokeObjectURL(preview.url));
                setImages([]);
                setPreviewUrls([]);
                if (onImagesUploaded) {
                  onImagesUploaded([]);
                }
              }}
              className="text-sm text-red-600 hover:text-red-800"
            >
              모두 삭제
            </button>
          </div>
          
          {/* Horizontal scrollable container */}
          <div className="h-52 overflow-x-auto border border-gray-200 rounded-lg p-2">
            <div className="flex gap-3 min-w-max h-full items-center">
            {previewUrls.map((preview, index) => (
              <div key={preview.id} className="relative group flex-shrink-0">
                <div className="w-44 h-44 rounded-lg overflow-hidden bg-white border-2 border-gray-300">
                  {/* SIMPLE: Just show the image directly */}
                  <img
                    src={preview.url}
                    alt={preview.name}
                    className="w-full h-full object-cover"
                    onLoad={(e) => {
                      console.log('✅ SIMPLE: Image loaded successfully:', preview.name);
                    }}
                    onError={(e) => {
                      console.error('❌ SIMPLE: Image failed to load:', preview.name);
                      console.error('❌ SIMPLE: URL was:', preview.url);
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                  
                  {/* Simple error fallback */}
                  <div className="w-full h-full bg-red-100 border-2 border-red-300 flex items-center justify-center text-red-600" style={{ display: 'none' }}>
                    <div className="text-center">
                      <p className="text-sm font-medium">이미지 로드 실패</p>
                      <p className="text-xs mt-1">{preview.name}</p>
                    </div>
                  </div>
                  
                  {/* Simple remove button */}
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 bg-red-500 text-gray-900 hover:bg-red-600 flex items-center justify-center text-sm font-bold leading-none rounded"
                    style={{ 
                      width: '24px', 
                      height: '24px',
                      minWidth: '24px', 
                      minHeight: '24px',
                      maxWidth: '24px',
                      maxHeight: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0'
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;