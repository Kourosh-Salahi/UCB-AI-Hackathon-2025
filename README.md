# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a `.env.local` file in the root directory with the following:
   ```
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```
   Replace `your_gemini_api_key_here` with your actual Gemini API key.
   
   To get a Gemini API key:
   1. Go to https://ai.google.dev/
   2. Sign in with your Google account
   3. Create a new API key in the Google AI Studio
   4. Copy and paste it into your `.env.local` file
3. Run the app:
   `npm run dev`
