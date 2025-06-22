

import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import { GEMINI_MODEL_TEXT_IMAGE_INPUT } from '../constants';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // This error will be thrown at module load time if API_KEY is not set.
  // In a real app, you might want to handle this more gracefully,
  // e.g., by disabling API-dependent features and showing a message to the user.
  console.error("API_KEY environment variable not set for Gemini API. Gemini features will be disabled.");
  // throw new Error("API_KEY environment variable not set for Gemini API.");
}

// Initialize GoogleGenAI only if API_KEY is available
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const createTextPart = (text: string): Part => ({ text });
const createImagePart = (base64Data: string, mimeType: string = 'image/png'): Part => ({
  inlineData: {
    data: base64Data,
    mimeType,
  },
});

export const generateLatexFromImage = async (base64Image: string): Promise<string | null> => {
  if (!ai) {
    console.error("Gemini AI client not initialized. API_KEY might be missing.");
    throw new Error("Gemini AI client not initialized. Please ensure the API_KEY environment variable is correctly set.");
  }

  const prompt = `Transcribe the handwritten mathematical notation in this image into a raw LaTeX string.
Focus strictly on the mathematical symbols and structure.
CRITICAL: Your output MUST be ONLY the LaTeX code. Do NOT include:
- Any surrounding text or explanations.
- Markdown fences (like \`\`\`latex ... \`\`\` or \`\`\` ... \`\`\`).
- Any \\text{...} blocks that merely repeat, describe, or annotate the formula in plaintext unless it's an absolutely essential part of the mathematical expression itself (e.g., units like cm, or labels directly within the math structure). Avoid \\text{...} for simple repetition of symbols.
- Do not add any classification like 'This is addition'.
If there is no recognizable math, return the exact string: \\text{No math detected}`;
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_TEXT_IMAGE_INPUT,
      contents: {
        parts: [
          createTextPart(prompt),
          createImagePart(base64Image),
        ],
      },
      // config: {
      //  temperature: 0.2 // Lower temperature for more deterministic output for transcription
      // }
    });

    let latexText = response.text.trim();
    
    // Strip markdown fences (e.g., ```latex ... ``` or ``` ... ```)
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = latexText.match(fenceRegex);
    if (match && match[2]) {
      latexText = match[2].trim();
    }
    
    // Also handle cases where it might just be a single line fence, e.g. `latex ...` (less common for multiline)
    // This is a simpler check, might need refinement if other formats appear
    if (latexText.startsWith('latex\n')) {
        latexText = latexText.substring('latex\n'.length);
    }


    console.log("Gemini LaTeX response (cleaned):", latexText);
    // If after stripping, the string is empty and was expected to be math,
    // it could be that Gemini returned what was asked for (empty for no math).
    // Or, it could be an issue. The prompt asks for "\\text{No math detected}" in such cases.
    if (!latexText && !response.text.includes("\\text{No math detected}")) {
        console.warn("Cleaned LaTeX string is empty. Original response:", response.text);
    }

    return latexText;

  } catch (error) {
    console.error("Error generating LaTeX from image:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API error for LaTeX: ${error.message}`);
    }
    throw new Error("Unknown Gemini API error for LaTeX.");
  }
};

export const getTutoringHint = async (
  pageImageBase64: string,
  textAnnotations: string,
  userQuestion?: string
): Promise<string | null> => {
  if (!ai) {
    console.error("Gemini AI client not initialized. API_KEY might be missing.");
    throw new Error("Gemini AI client not initialized. Please ensure the API_KEY environment variable is correctly set.");
  }

  let prompt = `You are a helpful and encouraging math tutor.
A student is working on a problem. The relevant page from their document is provided as an image.
Their current handwritten and text annotations on this page are also included in the image (both PDF content and annotations are part of the single image provided).
Additional text notes from the student: "${textAnnotations || 'No additional text notes provided.'}"

The student's specific question is: "${userQuestion || 'Can you give me a hint or tell me if I am on the right track?'}"

Please review their work visible in the image and their text notes.
Provide a clear, concise, and constructive hint to help them proceed.
- If they made a mistake, gently point towards the concept they might need to revisit, without giving the direct answer or explicitly stating the mistake.
- If they are on theright track, affirm their progress and suggest a next step.
- If their question is vague, try to guide them based on common difficulties for such problems.
- Focus on conceptual understanding and problem-solving strategies.
- Keep your response friendly and supportive. Structure your response clearly, perhaps using bullet points for steps if appropriate.
- Do NOT provide the final answer to the problem.
- Do NOT use markdown for your response, just plain text.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_TEXT_IMAGE_INPUT,
      contents: {
        parts: [
          createTextPart(prompt),
          createImagePart(pageImageBase64, 'image/png'), // Assuming PNG from canvas
        ],
      },
      config: {
        temperature: 0.6, // Allow for some creativity in tutoring style
        // thinkingConfig: { thinkingBudget: 0 } // Faster, but potentially lower quality for complex tutoring
      }
    });
    
    const hintText = response.text.trim();
    console.log("Gemini Tutoring response:", hintText);
    return hintText;

  } catch (error) {
    console.error("Error getting tutoring hint:", error);
     if (error instanceof Error) {
        throw new Error(`Gemini API error for tutoring: ${error.message}`);
    }
    throw new Error("Unknown Gemini API error for tutoring.");
  }
};