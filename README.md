# UCB-AI-Hackathon-2025
Repo for Berkeley AI Hackathon

# PDF Annotator & AI Tutor 🎓📝

An intelligent PDF annotation application that allows you to markup PDFs with handwritten and text notes, convert handwriting to LaTeX using AI, and get personalized tutoring hints based on your work.

## ✨ Features

- **📄 PDF Viewer**: Upload and view PDF documents with zoom controls
- **✏️ Annotation Tools**: 
  - Pen tool for freehand drawing
  - Text tool for typed annotations
  - Eraser for removing annotations
  - Select/Move tool for repositioning annotations
- **🤖 AI-Powered Features**:
  - **Handwriting to LaTeX**: Convert handwritten math to LaTeX using Google's Gemini AI
  - **AI Tutoring**: Get personalized hints and guidance based on your work
- **📱 Responsive Design**: Works on desktop and mobile devices
- **💾 Real-time Editing**: All annotations are saved in real-time

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** 8.0.0 or higher
- **Gemini API Key** (Get yours from [Google AI Studio](https://aistudio.google.com/app/apikey))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/pdf-annotator-ai-tutor.git
   cd pdf-annotator-ai-tutor

Install dependencies
bashnpm install

Set up environment variables
bashcp .env.example .env
Edit .env and add your Gemini API key:
envGEMINI_API_KEY=your_actual_gemini_api_key_here

Start the development server
bashnpm run dev

Open your browser and navigate to http://localhost:5173

🎯 How to Use
Basic PDF Annotation

Upload a PDF: Click "Upload PDF" button and select your file
Choose a tool: Select from pen, text, eraser, or select/move tools
Annotate: Draw, type, or markup your PDF as needed
Navigate: Use page controls and zoom to navigate your document

AI Features
Convert Handwriting to LaTeX

Select the LaTeX Select tool (📐 icon)
Draw a rectangle around handwritten math
The AI will automatically convert it to properly formatted LaTeX

Get AI Tutoring Hints

Click the Get Hint button (💡 icon)
Optionally provide a specific question
The AI tutor will analyze your work and provide helpful guidance

🛠️ Technology Stack

Frontend: React 19, TypeScript, Tailwind CSS
PDF Processing: PDF.js
Math Rendering: KaTeX, react-katex
AI Integration: Google Gemini AI
Build Tool: Vite
Styling: Tailwind CSS

📁 Project Structure
pdf-annotator-ai-tutor/
├── components/           # React components
│   ├── FileUpload.tsx   # PDF file upload
│   ├── PdfAnnotator.tsx # Main PDF viewer & annotation canvas
│   ├── Toolbar.tsx      # Tool selection and controls
│   ├── Modal.tsx        # Modal dialogs
│   └── LoadingSpinner.tsx # Loading indicators
├── services/            # External service integrations
│   └── geminiService.ts # Google Gemini AI integration
├── App.tsx             # Main application component
├── types.ts            # TypeScript type definitions
├── constants.ts        # Application constants
├── index.tsx          # Application entry point
└── index.html         # HTML template
🔧 Development
Available Scripts

npm run dev - Start development server
npm run build - Build for production
npm run preview - Preview production build
npm run lint - Run ESLint
npm run lint:fix - Fix ESLint issues
npm run type-check - Check TypeScript types
npm test - Run tests

Environment Variables
VariableDescriptionRequiredGEMINI_API_KEYGoogle Gemini AI API keyYesVITE_APP_NAMEApplication nameNoVITE_API_BASE_URLAPI base URLNo
🚀 Deployment
Building for Production
bashnpm run build
The built files will be in the dist/ directory.
Deploy to Vercel

Push your code to GitHub
Connect your repository to Vercel
Add your environment variables in Vercel dashboard
Deploy!

Deploy to Netlify

Run npm run build
Upload the dist/ folder to Netlify
Add environment variables in Netlify dashboard

🤝 Contributing

Fork the repository
Create a feature branch: git checkout -b feature/amazing-feature
Commit your changes: git commit -m 'Add amazing feature'
Push to the branch: git push origin feature/amazing-feature
Open a Pull Request

📝 License
This project is licensed under the MIT License - see the LICENSE file for details.
🙏 Acknowledgments

PDF.js for PDF rendering
Google Gemini AI for AI capabilities
KaTeX for LaTeX rendering
Tailwind CSS for styling
React for the UI framework

📞 Support
If you have any questions or run into issues:

Check the Issues page
Create a new issue if your problem isn't already reported
Provide as much detail as possible including:

Steps to reproduce
Expected vs actual behavior
Browser and OS information
Console error messages




Happy Annotating! 🎉

## 🎯 **Next Steps After Creating These Files**

1. **Copy the files**: Create each file in your project root
2. **Install dependencies**: Run `npm install` to get the new dev dependencies
3. **Set up environment**: Add your actual Gemini API key to `.env`
4. **Test the setup**: Run `npm run dev` to make sure everything works
5. **Commit to git**: Initialize git repository and make your first commit

These files will give you a solid foundation for development, deployment, and collaboration!
