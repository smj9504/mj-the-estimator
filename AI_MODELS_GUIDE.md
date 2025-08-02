# AI Models Configuration Guide

## Overview
The application supports multiple AI providers and models. Model selection is now managed through environment variables for better flexibility and maintenance.

## Environment Variables

### OpenAI Models
```env
# Text-based tasks (general LLM)
OPENAI_TEXT_MODEL=gpt-4o-mini

# Vision/Image analysis tasks
OPENAI_VISION_MODEL=gpt-4o

# Advanced/Complex tasks
OPENAI_ADVANCED_MODEL=gpt-4o
```

## Model Usage by Feature

### Demo Scope Analysis
- **Model Used**: `OPENAI_VISION_MODEL`
- **Purpose**: Analyze uploaded images to detect demolished areas
- **Recommended**: `gpt-4o` (latest vision model)

### Material Scope Analysis
- **Model Used**: `OPENAI_ADVANCED_MODEL`
- **Purpose**: Complex material analysis and calculations
- **Recommended**: `gpt-4o`

### General Text Processing
- **Model Used**: `OPENAI_TEXT_MODEL`
- **Purpose**: Text cleanup, parsing, general LLM tasks
- **Recommended**: `gpt-4o-mini` (cost-effective)

## Model Recommendations

### Current Recommended Models (January 2025)
- **Text Model**: `gpt-4o-mini` - Fast and cost-effective for text tasks
- **Vision Model**: `gpt-4o` - Best vision capabilities
- **Advanced Model**: `gpt-4o` - Latest and most capable model

### Deprecated Models (Do Not Use)
- `gpt-4-vision-preview` - Deprecated as of 2024
- `gpt-3.5-turbo-vision` - Limited vision capabilities

## Configuration Steps

1. **Update .env file**:
   ```env
   OPENAI_TEXT_MODEL=gpt-4o-mini
   OPENAI_VISION_MODEL=gpt-4o
   OPENAI_ADVANCED_MODEL=gpt-4o
   ```

2. **Restart the backend server**:
   ```bash
   cd backend
   python main.py
   ```

3. **Verify in logs**:
   Look for: `AI Models configured: {'text': 'gpt-4o-mini', 'vision': 'gpt-4o', 'advanced': 'gpt-4o'}`

## Troubleshooting

### Model Not Found Error
If you see "model not found" errors:
1. Check that the model name is correct in .env
2. Verify the model is available in your OpenAI account
3. Ensure you have access to the specific model

### Cost Optimization
- Use `gpt-4o-mini` for text tasks to reduce costs
- Use `gpt-4o` only for vision and complex tasks
- Monitor usage through OpenAI dashboard

## Future Updates
When new models are released:
1. Update the environment variables
2. Test with your specific use cases
3. Update this guide with recommendations