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
    
    // Remove the data URL prefix if it exists
    const base64Data = imageBase64.startsWith('data:')
      ? imageBase64.split(',')[1]
      : imageBase64;
    
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
- For single letters (like "W"), return just the letter in the latex field to ensure proper math-mode formatting.
- For matrices, always use the pmatrix environment, e.g., \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}.
- For capital letters like W, X, Y, Z, make sure they're correctly identified and not confused with shapes.

Don't wrap output in fences, code-blocks, or $$ unless explicitly asked.
If the image contains text that is not mathematical, ignore it.
Think step-by-step internally; expose only the final structured answer.`
            },
            {
              inline_data: {
                mime_type: "image/png",
                data: base64Data
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
export async function getTutoringFeedback(
  latexExpression: string, 
  context?: string, 
  screenshot?: string, 
  isSelectedRegion: boolean = false
): Promise<string> {
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
    const systemPrompt = `You are Kourosh, an expert STEM tutor helping students with STEM problems.

${isSelectedRegion ? 
  'The student has selected a specific region of the page containing the problem they need help with. Focus on this region.' : 
  'Their current handwritten and text annotations on this page are included in the image (both PDF content and annotations are part of the single image provided).'
}

CONTEXT INFORMATION:
- Problem: ${problemText || 'The student is working on a STEM problem.'}
- Student Work: ${latexExpression}
- Student Query: ${studentQuery || 'Is my work correct?'}
${isSelectedRegion ? '- Note: The student has specifically selected this region to ask about.' : ''}

YOUR RESPONSE GUIDELINES:
When responding try to understand the problem that the student is referring to and determine how it can be solved, use exactly ONE of these three response formats:

1. If the student's solution is correct:
   Start with "✅ Correct:" followed by brief affirmation (under 25 words)

2. If the student needs guidance:
   Start with "🛈 Hint:" followed by 1-2 guiding questions or next step (under 60 words)

3. If the student has made an error:
   Start with "❌ Mistake detected:" followed by identifying the error and brief correction (under 90 words)

Please review their work visible in the image and their text notes.
Provide a clear, concise, and constructive hint to help them proceed.
Important: 
- Do NOT repeat the problem tags or structure in your response
- Do NOT include <problem>, <student_work>, or any XML/HTML tags in your answer
- Do NOT surround mathematical expressions with dollar signs ($)
- When referring to expressions from student work, write them directly (e.g., "3(x+5)" not "$3(x+5)$")
- If they made a mistake, gently point towards the concept they might need to revisit, without giving the direct answer or explicitly stating the mistake.
- If they are on theright track, affirm their progress and suggest a next step.
- If their question is vague, try to guide them based on common difficulties for such problems.
- Focus on conceptual understanding and problem-solving strategies.
- Keep your response friendly and supportive. Structure your response clearly, perhaps using bullet points for steps if appropriate.
- Do NOT provide the final answer to the problem.
- Do NOT use markdown for your response, just plain text.;
- Keep responses conversational, encouraging, and professional
- Your complete response should be under 120 words
- Never show a complete solution unless explicitly requested`;

    // Try with the default model first
    const models = ['llama3-8b-8192', 'gemma-7b-it']; 
    let lastError = null;
    
    for (const model of models) {
      try {
        console.log(`Trying with model: ${model}`);
        
        // Prepare the messages array
        const messages = [
          {
            role: "system",
            content: systemPrompt
          }
        ];
        
        // For standard Groq models that don't support multimodal, we'll just use text
        messages.push({
          role: "user", 
          content: `Please analyze the student's work and provide appropriate feedback. Remember to use exactly ONE of the response formats (✅ Correct:, 🛈 Hint:, or ❌ Mistake detected:) without including any XML tags or prompt structure in your response.${screenshot ? ' (Note: A screenshot is available but this model does not support image input)' : ''}`
        });
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
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
  
  console.log("OpenAI fallback functionality is available but not currently used. Prompt:" , prompt);
  // Code for actual OpenAI API call would go here if needed in the future
  
  return `OpenAI integration is available as a fallback but not implemented for: ${prompt}`;
}

// Combined pipeline function
export async function processWithAITutor(
  imageBase64: string, 
  context?: string, 
  pageScreenshot?: string,
  selectedRegionScreenshot?: string,
  selectionRect?: { x: number; y: number; width: number; height: number; },
  allLatexAnnotations: Array<any> = [] // Pass all existing LaTeX annotations
): Promise<string> {
  try {
    // Try to validate keys but don't fail if some are missing
    try {
      validateApiKeys(['gemini', 'groq']);
    } catch (error) {
      console.warn('API key validation warning:', error);
    }
    
    // If no page screenshot was provided, try to capture one
    let currentPageScreenshot = pageScreenshot;
    if (!currentPageScreenshot) {
      try {
        console.log('Capturing page screenshot for context...');
        currentPageScreenshot = await capturePageScreenshot();
        if (currentPageScreenshot) {
          console.log('Page screenshot captured successfully');
        } else {
          console.log('Page screenshot capture returned empty result');
        }
      } catch (screenshotError) {
        console.error('Failed to capture page screenshot:', screenshotError);
      }
    }
    
    // If there's a selection rectangle but no selected region screenshot, try to capture one
    if (selectionRect && !selectedRegionScreenshot) {
      try {
        console.log('Capturing selected region screenshot...');
        selectedRegionScreenshot = await captureSelectedRegionScreenshot(selectionRect);
        if (selectedRegionScreenshot) {
          console.log('Selected region screenshot captured successfully');
        } else {
          console.log('Selected region screenshot capture failed');
        }
      } catch (regionError) {
        console.error('Failed to capture selected region:', regionError);
      }
    }
    
    // Find nearby LaTeX annotations if we have a selection rectangle
    let nearbyLatexAnnotations: Array<any> = [];
    if (selectionRect && allLatexAnnotations && allLatexAnnotations.length > 0) {
      nearbyLatexAnnotations = findNearbyLatexAnnotations(selectionRect, allLatexAnnotations);
      console.log(`Found ${nearbyLatexAnnotations.length} nearby LaTeX annotations`);
    }
    
    // Analyze context to determine problem area and content
    const problemInfo = extractProblemInfo(context || '');
    console.log('Extracted problem info:', problemInfo);
    
    // For image processing, we'll focus on the most relevant area if we can identify it
    let processedImage = imageBase64;
    let latexExpression = '';
    
    // Step 1: Extract key mathematical content from the image
    try {
      console.log('Converting relevant handwriting to LaTeX...');
      latexExpression = await convertHandwritingToLatex(processedImage);
      console.log('LaTeX result:', latexExpression);
      
      // Clean up the LaTeX by removing dollar signs
      latexExpression = latexExpression.replace(/\$/g, '');
      console.log('Cleaned LaTeX:', latexExpression);
    } catch (error) {
      console.error('Error converting handwriting to LaTeX:', error);
      
      // Use information from context to infer a likely mathematical expression
      latexExpression = inferMathFromContext(context || '');
      console.log('Inferred LaTeX from context:', latexExpression);
    }

    // Step 2: Get tutoring feedback using enhanced context
    console.log('Getting tutoring feedback with enriched context...');
    const enhancedContext = enrichContextWithProblemInfo(
      context || '', 
      problemInfo, 
      latexExpression,
      nearbyLatexAnnotations
    );
    
    let feedback;
    try {
      // Use the selected region screenshot if available, otherwise use the full page screenshot
      // This creates our hybrid approach
      const screenshotToUse = selectedRegionScreenshot || currentPageScreenshot;
      
      // Add logging about which screenshot is being used
      if (selectedRegionScreenshot) {
        console.log('Using student-selected region for tutoring feedback');
      } else if (currentPageScreenshot) {
        console.log('Using full page screenshot for tutoring feedback');
      } else {
        console.log('No screenshot available, proceeding with text-only feedback');
      }
      
      // Pass along the appropriate screenshot along with the context and LaTeX
      // Also indicate whether this is a selected region or full page
      feedback = await getTutoringFeedback(
        latexExpression, 
        enhancedContext, 
        screenshotToUse, 
        !!selectedRegionScreenshot
      );
      console.log('Feedback received');
    } catch (error) {
      console.error('Error getting tutoring feedback:', error);
      
      // Generate a contextually relevant fallback response
      feedback = generateFallbackFeedback(latexExpression, problemInfo);
    }

    // Step 3: Speak the feedback with VAPI (non-blocking, don't worry if it fails)
    speakText(feedback).catch(err => console.warn('Speech synthesis failed:', err));

    return feedback;
  } catch (error) {
    console.error('AI Tutor pipeline error:', error);
    return "🛈 Hint: I'm having trouble analyzing your work right now. Try reviewing the key concepts needed for this problem, and check your computation steps carefully. If needed, try a similar but simpler problem first.";
  }
}

// Helper function to extract problem information from context
function extractProblemInfo(context: string): { 
  topic?: string; 
  questionNumber?: string;
  problemType?: string;
  relevantKeywords: string[];
} {
  const info = {
    relevantKeywords: []
  } as { topic?: string; questionNumber?: string; problemType?: string; relevantKeywords: string[] };
  
  // Extract question number if present (e.g., "problem 1-a", "question 3.2")
  const questionMatch = context.match(/(?:problem|question|exercise|prob\.?|q\.?)\s*([0-9]+[a-z]?(?:[.-][0-9]+[a-z]?)?)/i);
  if (questionMatch) {
    info.questionNumber = info.questionNumber = questionMatch[1];
    info.relevantKeywords.push(questionMatch[0]);
  }
  
  // Detect topic area
  const topicKeywords = [
    { keywords: ['derivative', 'differentiate', 'calculus', 'rate of change', 'slope'], topic: 'calculus-derivatives' },
    { keywords: ['integral', 'integrate', 'area under', 'antiderivative'], topic: 'calculus-integration' },
    { keywords: ['matrix', 'matrices', 'determinant', 'eigenvalue', 'eigenvector'], topic: 'linear-algebra' },
    { keywords: ['probability', 'random variable', 'distribution', 'expectation'], topic: 'probability' },
    { keywords: ['equation', 'solve for', 'find x', 'system of'], topic: 'algebra' },
    { keywords: ['triangle', 'circle', 'angle', 'geometric', 'degrees'], topic: 'geometry' },
    { keywords: ['vector', 'scalar', 'dot product', 'cross product'], topic: 'vectors' },
    { keywords: ['limit', 'approaches', 'tends to', 'converges'], topic: 'calculus-limits' },
    { keywords: ['differential', 'ODE', 'dy/dx', 'initial value'], topic: 'differential-equations' },
    { keywords: ['function', 'domain', 'range', 'mapping', 'graph of'], topic: 'functions' },
    { keywords: ['sequence', 'series', 'convergence', 'sum of', 'infinite'], topic: 'sequences-series' },
    { keywords: ['statistics', 'mean', 'median', 'standard deviation', 'normal distribution'], topic: 'statistics' }
  ];
  
  for (const topicSet of topicKeywords) {
    for (const keyword of topicSet.keywords) {
      if (context.toLowerCase().includes(keyword.toLowerCase())) {
        info.topic = topicSet.topic;
        info.relevantKeywords.push(keyword);
        break;
      }
    }
    if (info.topic) break;
  }
  
  // Detect problem type
  const problemTypes = [
    { keywords: ['prove', 'proof', 'show that', 'demonstrate'], type: 'proof' },
    { keywords: ['calculate', 'compute', 'evaluate', 'find the value'], type: 'calculation' },
    { keywords: ['simplify', 'expand', 'factor', 'rewrite'], type: 'simplification' },
    { keywords: ['graph', 'plot', 'sketch', 'draw'], type: 'graphing' },
    { keywords: ['solve', 'find', 'determine'], type: 'solving' },
    { keywords: ['derive', 'obtain', 'find an expression'], type: 'derivation' },
    { keywords: ['explain', 'describe', 'interpret'], type: 'conceptual' }
  ];
  
  for (const problemSet of problemTypes) {
    for (const keyword of problemSet.keywords) {
      if (context.toLowerCase().includes(keyword.toLowerCase())) {
        info.problemType = problemSet.type;
        if (!info.relevantKeywords.includes(keyword)) {
          info.relevantKeywords.push(keyword);
        }
        break;
      }
    }
    if (info.problemType) break;
  }
  
  // Extract other potentially relevant keywords (equations, variables, numbers)
  const equationMatch = context.match(/[a-z0-9]+\s*[=<>+\-*/]\s*[a-z0-9]+/ig);
  if (equationMatch) {
    info.relevantKeywords.push(...equationMatch);
  }
  
  return info;
}

// Helper function to infer math expressions from context
function inferMathFromContext(context: string): string {
  // Try to extract mathematical expressions from the context
  const patterns = [
    /\b([a-z])\s*=\s*([\d.]+)/i,                      // Variable assignment: x = 5
    /\b([a-z])\s*([+\-*/])\s*([\d.]+)/i,              // Simple operation: x + 3
    /\b([\d.]+)\s*([+\-*/])\s*([a-z])/i,              // Simple operation reversed: 3 + x
    /\b([a-z])\s*=\s*([a-z])\s*([+\-*/])\s*([\d.]+)/i, // Equation: y = x + 2
    /\b([a-z])(?:\^|²)\s*([+\-])\s*([\d.]+)/i,        // Quadratic form: x² + 1
    /\b([a-z])\s*([+\-*/])\s*([a-z])/i,               // Two variables: x + y
    /\b\(([^)]+)\)\s*([+\-*/])\s*\(([^)]+)\)/i,       // Parenthesized expressions: (x+1) + (y-2)
    /\b([\d.]+)([a-z])/i,                             // Coefficient: 3x
    /\b([a-z])_([a-z0-9])/i,                          // Subscript: a_n
    /\bsin\(([^)]+)\)/i,                              // Trig function: sin(x)
    /\bcos\(([^)]+)\)/i,                              // Trig function: cos(x)
    /\btan\(([^)]+)\)/i,                              // Trig function: tan(x)
    /\b\\?sqrt\{?([^}]+)\}?/i,                        // Square root: sqrt(x)
    /\b\\?frac\{([^}]+)\}\{([^}]+)\}/i,               // Fraction: frac{a}{b}
    /\b([a-z])\s*=\s*\\?frac\{([^}]+)\}\{([^}]+)\}/i  // Equation with fraction: y = frac{a}{b}
  ];
  
  for (const pattern of patterns) {
    const match = context.match(pattern);
    if (match) {
      const fullMatch = match[0];
      return fullMatch
        .replace(/\\?frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
        .replace(/\\?sqrt\{?([^}]+)\}?/g, "√($1)")
        .replace(/([a-z])(?:\^|²)/gi, "$1^2");
    }
  }
  
  // If no match found, check if there's a number mentioned
  const numberMatch = context.match(/([+\-]?\d+(?:\.\d+)?)/);
  if (numberMatch) {
    return numberMatch[1];
  }
  
  // Default fallback
  return "expression";
}

// Helper function to enrich context with problem information
function enrichContextWithProblemInfo(
  originalContext: string, 
  problemInfo: ReturnType<typeof extractProblemInfo>,
  latexExpression: string,
  nearbyLatexAnnotations: Array<any> = [] // Add nearby annotations
): string {
  let enrichedContext = originalContext;
  
  // Add inferred topic if available
  if (problemInfo.topic) {
    enrichedContext = `Topic: ${problemInfo.topic.replace(/-/g, ' ')}\n${enrichedContext}`;
  }
  
  // Add question number if available
  if (problemInfo.questionNumber) {
    enrichedContext = `Problem number: ${problemInfo.questionNumber}\n${enrichedContext}`;
  }
  
  // Add inferred problem type if available
  if (problemInfo.problemType) {
    enrichedContext += `\nProblem type: ${problemInfo.problemType}`;
  }
  
  // Add the extracted LaTeX expression
  if (latexExpression && latexExpression !== "expression") {
    enrichedContext += `\nDetected mathematical expression: ${latexExpression}`;
  }
  
  // Add nearby LaTeX annotations if available
  if (nearbyLatexAnnotations && nearbyLatexAnnotations.length > 0) {
    enrichedContext += `\n\nNearby student work:`;
    nearbyLatexAnnotations.forEach((annotation, index) => {
      // You'll need to adjust this to match your annotation structure
      const latex = annotation.latex || annotation.content || '';
      if (latex && latex !== latexExpression) {
        enrichedContext += `\n- Expression ${index + 1}: ${latex}`;
      }
    });
  }
  
  return enrichedContext;
}

// Generate fallback feedback based on problem info
function generateFallbackFeedback(
  latexExpression: string, 
  problemInfo: ReturnType<typeof extractProblemInfo>
): string {
  // Provide feedback based on topic if available
  if (problemInfo.topic) {
    switch (problemInfo.topic) {
      case 'calculus-derivatives':
        return "🛈 Hint: When working with derivatives, remember the key rules: power rule, product rule, quotient rule, and chain rule. Which one applies to your expression?";
      
      case 'calculus-integration':
        return "🛈 Hint: For integration problems, consider substitution, integration by parts, or partial fractions depending on the form. What's the structure of your integrand?";
      
      case 'linear-algebra':
        return "🛈 Hint: In matrix operations, pay attention to dimensions for multiplication and special properties for determinants and eigenvalues.";
      
      case 'algebra':
        return "🛈 Hint: When solving equations, make sure to apply the same operation to both sides, and check your solution in the original equation.";
        
      default:
        return `🛈 Hint: For ${problemInfo.topic.replace(/-/g, ' ')} problems, start by identifying the key concepts involved and write down the relevant formulas or theorems.`;
    }
  }
  
  // If no topic but we have LaTeX expression
  if (latexExpression && latexExpression !== "expression") {
    const cleanLatex = latexExpression.replace(/\$/g, '');
      
    if (cleanLatex.includes('=')) {
      return `🛈 Hint: For equation ${cleanLatex}, try isolating the variable on one side. Remember to apply the same operation to both sides.`;
    } else if (cleanLatex.includes('+') || cleanLatex.includes('-')) {
      return `🛈 Hint: When working with ${cleanLatex}, try grouping similar terms together first, then look for common factors.`;
    }
  }
  
  // Most generic fallback
  return "🛈 Hint: Break this problem down step-by-step. What information are you given, what are you asked to find, and what mathematical principles connect them?";
}

// Helper function to capture a screenshot of the current page
export async function capturePageScreenshot(): Promise<string> {
  return new Promise<string>((resolve) => {
    try {
      // Create a canvas element to capture the entire page
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Could not get canvas context');
      }
      
      // Set canvas dimensions to match the visible viewport
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Draw the current page content to the canvas
      const html = document.documentElement;
      
      // Attempt to capture screenshot using a simple approach
      // Note: This is a basic implementation with limitations
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      try {
        // Simple approach to capture visible content
        const svg = new XMLSerializer().serializeToString(html);
        const img = new Image();
        img.onload = function() {
          context.drawImage(img, 0, 0);
          const imageData = canvas.toDataURL('image/png');
          resolve(imageData);
        };
        img.onerror = function() {
          console.error('Error in screenshot capture');
          // Just resolve with an empty string if it fails
          resolve('');
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
      } catch (captureError) {
        console.error('Error in screenshot capture:', captureError);
        // Try a very basic fallback
        try {
          const imageData = canvas.toDataURL('image/png');
          resolve(imageData);
        } catch {
          resolve(''); // Empty if all fails
        }
      }
    } catch (error) {
      console.error('Error capturing page screenshot:', error);
      // Don't reject, return empty string as fallback
      resolve('');
    }
  });
}

// Helper function to capture a screenshot of a selected region
export async function captureSelectedRegionScreenshot(
  selectionRect: { x: number; y: number; width: number; height: number; }
): Promise<string> {
  return new Promise<string>((resolve) => {
    try {
      // Validate selection rectangle
      if (!selectionRect || selectionRect.width <= 0 || selectionRect.height <= 0) {
        console.error('Invalid selection rectangle:', selectionRect);
        resolve('');
        return;
      }
      
      // First capture the full page
      capturePageScreenshot().then(fullPageImage => {
        if (!fullPageImage) {
          console.error('Failed to capture full page image');
          resolve('');
          return;
        }
        
        try {
          // Create a canvas to crop the image
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          if (!context) {
            throw new Error('Could not get canvas context');
          }
          
          // Set the canvas size to the selection size
          canvas.width = selectionRect.width;
          canvas.height = selectionRect.height;
          
          // Load the full page image
          const img = new Image();
          img.onload = function() {
            // Crop the image to the selection rectangle
            context.drawImage(
              img, 
              selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height,
              0, 0, selectionRect.width, selectionRect.height
            );
            
            // Convert to data URL
            const croppedImageData = canvas.toDataURL('image/png');
            console.log('Successfully captured selected region');
            resolve(croppedImageData);
          };
          
          img.onerror = function() {
            console.error('Error loading full page image for cropping');
            resolve('');
          };
          
          img.src = fullPageImage;
        } catch (cropError) {
          console.error('Error cropping image:', cropError);
          resolve('');
        }
      }).catch(err => {
        console.error('Error in page capture:', err);
        resolve('');
      });
    } catch (error) {
      console.error('Error capturing selected region screenshot:', error);
      resolve('');
    }
  });
}

// Helper function to find nearby LaTeX annotations to a selection
export function findNearbyLatexAnnotations(
  selectionRect: { x: number; y: number; width: number; height: number; },
  latexAnnotations: Array<any>, // Use the appropriate type from your application
  proximityThreshold = 100 // Pixels distance to consider "nearby"
): Array<any> {
  if (!latexAnnotations || !selectionRect) {
    return [];
  }
  
  return latexAnnotations.filter(annotation => {
    // Get the center points of both rectangles
    const selectionCenterX = selectionRect.x + selectionRect.width / 2;
    const selectionCenterY = selectionRect.y + selectionRect.height / 2;
    
    // You'll need to adjust this to match your annotation structure
    const annotationCenterX = annotation.position.x + (annotation.position.width || 0) / 2;
    const annotationCenterY = annotation.position.y + (annotation.position.height || 0) / 2;
    
    // Calculate Euclidean distance between centers
    const distance = Math.sqrt(
      Math.pow(selectionCenterX - annotationCenterX, 2) + 
      Math.pow(selectionCenterY - annotationCenterY, 2)
    );
    
    // Return true if annotation is within the proximity threshold
    return distance <= proximityThreshold;
  });
}