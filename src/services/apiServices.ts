/// <reference types="vite/client" />

// API service functions for Gemini, Groq, and VAPI integration

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const VAPI_API_KEY = import.meta.env.VITE_VAPI_API_KEY;

// Gemini API - Convert handwriting image to LaTeX
export async function convertHandwritingToLatex(imageBase64: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: "Convert the handwritten mathematical expression in this image to LaTeX format. Only return the LaTeX code, nothing else."
            },
            {
              inline_data: {
                mime_type: "image/png",
                data: imageBase64
              }
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const latexResult = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (!latexResult) {
      throw new Error('No LaTeX result from Gemini');
    }

    return latexResult;
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error('Failed to convert handwriting to LaTeX');
  }
}

// Groq API - Get tutoring feedback from LaTeX
export async function getTutoringFeedback(latexExpression: string, context?: string): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key not configured');
  }

  try {
    const prompt = `You are a gentle, encouraging math tutor. A student has written this mathematical expression: ${latexExpression}

${context ? `Additional context: ${context}` : ''}

Provide helpful, constructive feedback about this mathematical expression. Be encouraging and explain concepts clearly. Focus on:
1. What the expression represents
2. Any potential improvements or corrections needed
3. Helpful hints for solving or understanding it
4. Encouraging words

Keep your response conversational and supportive, as if speaking directly to the student.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const feedback = data.choices?.[0]?.message?.content?.trim();
    
    if (!feedback) {
      throw new Error('No feedback from Groq');
    }

    return feedback;
  } catch (error) {
    console.error('Groq API error:', error);
    throw new Error('Failed to get tutoring feedback');
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

// Combined pipeline function
export async function processWithAITutor(imageBase64: string, context?: string): Promise<string> {
  try {
    // Step 1: Convert handwriting to LaTeX with Gemini
    console.log('Converting handwriting to LaTeX...');
    const latexExpression = await convertHandwritingToLatex(imageBase64);
    console.log('LaTeX result:', latexExpression);

    // Step 2: Get tutoring feedback with Groq
    console.log('Getting tutoring feedback...');
    const feedback = await getTutoringFeedback(latexExpression, context);
    console.log('Feedback received');

    // Step 3: Speak the feedback with VAPI (non-blocking)
    speakText(feedback).catch(console.warn);

    return feedback;
  } catch (error) {
    console.error('AI Tutor pipeline error:', error);
    throw error;
  }
}