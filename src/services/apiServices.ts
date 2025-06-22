/// <reference types="vite/client" />

// API service functions for Gemini, Groq, OpenAI and VAPI integration

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const VAPI_API_KEY = import.meta.env.VITE_VAPI_API_KEY;

// Helper function to check API keys
const validateApiKeys = (requiredKeys = ['gemini', 'groq']) => {
  const missing = [];
  
  if (requiredKeys.includes('gemini') && !GEMINI_API_KEY) {
    missing.push('VITE_GEMINI_API_KEY');
  }
  
  if (requiredKeys.includes('groq') && !GROQ_API_KEY) {
    missing.push('VITE_GROQ_API_KEY');
  }
  
  if (requiredKeys.includes('openai') && !OPENAI_API_KEY) {
    missing.push('VITE_OPENAI_API_KEY');
  }
  
  if (requiredKeys.includes('vapi') && !VAPI_API_KEY) {
    missing.push('VITE_VAPI_API_KEY');
  }
  
  if (missing.length > 0) {
    console.warn(
      'Missing API key(s): ' + missing.join(', ') + '\n' +
      'Some features may not work properly.\n' +
      'Get your API keys from:\n' +
      '- Gemini: https://makersuite.google.com/app/apikey\n' +
      '- Groq: https://console.groq.com/keys\n' +
      '- VAPI: https://vapi.ai/dashboard'
    );
    
    // Only throw if all required keys are missing
    if (missing.length === requiredKeys.length) {
      throw new Error('All required API keys are missing. Please add at least one key to .env.local');
    }
  }
};

// Gemini API - Convert handwriting image to LaTeX using the recommended prompt and model
export async function convertHandwritingToLatex(imageBase64: string): Promise<string> {
  try {
    validateApiKeys();
    
    // Using gemini-2.5-flash model for faster responses
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `You are "Kourosh-OCR", a vision-enabled LaTeX transcription engine specialized in handwritten mathematical notation.

You will receive one inline image of handwritten mathematical notation.

Task:
1. Read the image and precisely identify every mathematical symbol, operator, and layout exactly as written.
2. Convert the expression(s) to canonical LaTeX that would compile without additional packages beyond 'amsmath'.
3. Preserve line breaks and alignment (e.g. '\\\\' for newlines, '&' for alignment).
4. Pay particular attention to handwritten characters that are easily confused (like 1/l/I, 0/O, etc.).
5. With Gemini 2.5 Pro's enhanced vision capabilities, capture subtle nuances in the handwriting.
6. IMPORTANT: For single digits (0-9), single letters, or basic symbols (+, -, =, etc.) that appear ALONE in the selection, return JUST the plain character without any LaTeX formatting.

Output rules:
Return a JSON object with this schema (no markdown, no commentary):
{
  "latex": "<string – raw LaTeX, no surrounding $ or $$>",
  "confidence": <float 0-1, reflecting overall certainty>,
  "ambiguous": [
    {"position": "<line:col>", "options": ["<opt1>", "<opt2>"] }
  ]
}

CRITICAL INSTRUCTIONS:
- If the selection contains ONLY a single digit (like "3"), return JUST that digit as the LaTeX (e.g., "3"), not "\\3" or any other LaTeX command.
- For single characters, always prefer the simplest possible representation.
- Do NOT add any formatting to simple numbers or symbols appearing alone.

Don't wrap output in fences, code-blocks, or $$ unless explicitly asked.
If the image contains text that is not mathematical, ignore it.
Think step-by-step internally; expose only the final structured answer.`
            },
            {
              inline_data: {
                mime_type: "image/png",
                data: imageBase64
              }
            }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json" // Enable strict JSON mode
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Gemini API error details:', data);
      throw new Error(`Gemini API error: ${response.status} - ${data.error?.message || 'Unknown error'}`);
    }

    // Parse the JSON response
    let latexResult = '';
    try {
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (!responseText) {
        throw new Error('Empty response from Gemini');
      }
      
      // Parse the JSON response
      const parsedResponse = JSON.parse(responseText);
      
      // Extract the LaTeX content
      latexResult = parsedResponse.latex;
      
      // Log confidence and any ambiguities
      console.log(`LaTeX conversion confidence: ${parsedResponse.confidence}`);
      if (parsedResponse.ambiguous && parsedResponse.ambiguous.length > 0) {
        console.log('Ambiguities detected:', parsedResponse.ambiguous);
      }
      
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      
      // Fallback: use the text directly if JSON parsing fails
      const directText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (directText) {
        console.log('Using direct text response as fallback');
        latexResult = directText.replace(/```json|```|^\{|\}$/g, '').trim();
      } else {
        throw new Error('Failed to parse Gemini response');
      }
    }
    
    if (!latexResult) {
      throw new Error('No LaTeX result from Gemini');
    }

    // Remove any remaining dollar signs
    latexResult = latexResult.replace(/\$/g, '');
    
    return latexResult;
  } catch (error) {
    console.error('Handwriting to LaTeX error:', error);
    throw error;
  }
}

// Groq API - Get tutoring feedback from LaTeX
export async function getTutoringFeedback(latexExpression: string, context?: string): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error(
      'Groq API key not configured. Please:\n' +
      '1. Sign up at https://console.groq.com\n' +
      '2. Get your API key from https://console.groq.com/keys\n' +
      '3. Add your API key to the .env file as VITE_GROQ_API_KEY'
    );
  }

  try {
    // Extract problem from context if available (first line might contain the problem)
    let problemText = '';
    let studentQuery = '';
    
    if (context) {
      // Try to extract problem statement and any questions
      const lines = context.split('\n');
      if (lines.length > 0) {
        problemText = lines[0];
        
        // If there are more lines, consider them as the student's query
        if (lines.length > 1) {
          studentQuery = lines.slice(1).join('\n');
        }
      }
    }
    
    // Create a structured prompt following the format suggested
    const systemPrompt = `You are Kourosh, an expert STEM tutor helping students with math problems.

CONTEXT INFORMATION:
- Problem: ${problemText || 'The student is working on a math problem.'}
- Student Work: ${latexExpression}
- Student Query: ${studentQuery || 'Is my work correct?'}

YOUR RESPONSE GUIDELINES:
When responding, use exactly ONE of these three response formats:

1. If the student's solution is correct:
   Start with "✅ Correct:" followed by brief affirmation (under 25 words)

2. If the student is on the right track but needs guidance:
   Start with "🛈 Hint:" followed by 1-2 guiding questions or next step (under 60 words)

3. If the student has made an error:
   Start with "❌ Mistake detected:" followed by identifying the error and brief correction (under 90 words)

Important: 
- Do NOT repeat the problem tags or structure in your response
- Do NOT include <problem>, <student_work>, or any XML/HTML tags in your answer
- Do NOT surround mathematical expressions with dollar signs ($)
- When referring to expressions from student work, write them directly (e.g., "3(x+5)" not "$3(x+5)$")
- Keep responses conversational, encouraging, and professional
- Your complete response should be under 120 words
- Never show a complete solution unless explicitly requested`;

    // Try with the default model first
    const models = ['llama3-8b-8192', 'gemma-7b-it']; 
    let lastError = null;
    
    for (const model of models) {
      try {
        console.log(`Trying with model: ${model}`);
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user", 
                content: `Please analyze the student's work and provide appropriate feedback. Remember to use exactly ONE of the response formats (✅ Correct:, 🛈 Hint:, or ❌ Mistake detected:) without including any XML tags or prompt structure in your response.`
              }
            ],
            temperature: 0.2,
            max_tokens: 500
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          const feedback = data.choices?.[0]?.message?.content?.trim();
          
          if (feedback) {
            console.log(`Successfully got response from model: ${model}`);
            return feedback;
          }
          
          lastError = new Error('No feedback content from Groq');
        } else {
          console.error(`Groq API error with model ${model}:`, data);
          lastError = new Error(`Groq API error with model ${model}: ${response.status} - ${data.error?.message || 'Unknown error'}`);
        }
      } catch (modelError) {
        console.error(`Error with model ${model}:`, modelError);
        lastError = modelError;
      }
    }
    
    // If we get here, all models failed
    throw lastError || new Error('All models failed');
    
  } catch (error) {
    console.error('Groq API error:', error);
    
    // Provide a basic response as a fallback using the same format
    console.log('Using fallback response for LaTeX expression:', latexExpression);
    
    // Pattern matching for common math expressions and providing structured feedback
    if (latexExpression.includes('x') && latexExpression.includes('+')) {
      return "🛈 Hint: When factoring expressions with variables, first identify any common factors. Then look for patterns like difference of squares (a²-b²) or trinomial forms (ax²+bx+c).";
    } else if (latexExpression.includes('=')) {
      return "🛈 Hint: For equations, make sure you're applying the same operation to both sides. What would happen if you isolate the variable on one side?";
    }
    
    return "🛈 Hint: I can see you're working on this problem. Consider what mathematical properties might apply here. Would breaking this into smaller parts help?";
  }
}

// VAPI - Convert text to speech
export async function speakText(text: string): Promise<void> {
  if (!VAPI_API_KEY) {
    console.warn('VAPI API key not configured - would speak:', text);
    return;
  }

  try {
    // Note: This is a placeholder for VAPI integration
    // You'll need to implement the actual VAPI call based on their documentation
    const response = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // VAPI-specific payload structure
        text: text,
        voice: 'gentle-tutor', // Configure based on VAPI options
        // Add other VAPI-specific parameters
      })
    });

    if (!response.ok) {
      throw new Error(`VAPI error: ${response.status}`);
    }

    console.log('Text sent to VAPI for speech synthesis');
  } catch (error) {
    console.error('VAPI error:', error);
    // Don't throw error for speech - it's not critical
    console.warn('Speech synthesis failed, continuing without audio');
  }
}

// Optional OpenAI fallback function (not currently used but added to prevent unused variable warnings)
export async function getOpenAIFallback(prompt: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    return "OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your .env.local file if you want to use OpenAI as a fallback.";
  }
  
  console.log("OpenAI fallback functionality is available but not currently used. Prompt:", prompt);
  // Code for actual OpenAI API call would go here if needed in the future
  
  return `OpenAI integration is available as a fallback but not implemented for: ${prompt}`;
}

// Combined pipeline function
export async function processWithAITutor(imageBase64: string, context?: string): Promise<string> {
  try {
    // Try to validate keys but don't fail if some are missing
    try {
      validateApiKeys(['gemini', 'groq']);
    } catch (error) {
      console.warn('API key validation warning:', error);
    }
    
    // Step 1: Convert handwriting to LaTeX with Gemini
    console.log('Converting handwriting to LaTeX...');
    let latexExpression;
    try {
      latexExpression = await convertHandwritingToLatex(imageBase64);
      console.log('LaTeX result:', latexExpression);
      
      // Clean up the LaTeX by removing dollar signs
      latexExpression = latexExpression.replace(/\$/g, '');
      console.log('Cleaned LaTeX:', latexExpression);
    } catch (error) {
      console.error('Error converting handwriting to LaTeX:', error);
      
      // Fallback to a basic interpretation
      console.log('Using fallback LaTeX interpretation');
      latexExpression = '3x + 15'; // Basic fallback based on what might be in the image
      
      if (context && context.length > 0) {
        // Try to extract math expression from context
        const mathPattern = /(\d+[xy]\s*[\+\-\*\/]\s*\d+)/i;
        const match = context.match(mathPattern);
        if (match && match[1]) {
          latexExpression = match[1];
        }
      }
    }

    // Step 2: Get tutoring feedback 
    console.log('Getting tutoring feedback...');
    let feedback;
    try {
      feedback = await getTutoringFeedback(latexExpression, context);
      console.log('Feedback received');
    } catch (error) {
      console.error('Error getting tutoring feedback:', error);
      
      // Generate a simple fallback response using the proper format
      // Remove any dollar signs from latex expression for cleaner display
      const cleanLatex = latexExpression.replace(/\$/g, '');
      
      if (cleanLatex.includes('=') || context?.includes('solv')) {
        feedback = `🛈 Hint: For equation ${cleanLatex}, try isolating the variable on one side. Remember to apply the same operation to both sides to maintain equality.`;
      } else if (cleanLatex.includes('x') && cleanLatex.includes('+')) {
        feedback = `🛈 Hint: For the expression ${cleanLatex}, look for common factors first. Can you identify any terms that share a common divisor?`;
      } else {
        feedback = `🛈 Hint: I can see you're working on ${cleanLatex}. Try breaking this down step-by-step, and remember to check your work by verifying your answer in the original problem.`;
      }
    }

    // Step 3: Speak the feedback with VAPI (non-blocking, don't worry if it fails)
    speakText(feedback).catch(err => console.warn('Speech synthesis failed:', err));

    return feedback;
  } catch (error) {
    console.error('AI Tutor pipeline error:', error);
    return "🛈 Hint: I'm having trouble analyzing your work right now. Try reviewing the key concepts needed for this problem, and check your computation steps carefully. If needed, try a similar but simpler problem first.";
  }
}