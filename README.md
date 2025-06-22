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
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser** and navigate to `http://localhost:5173`

## 🎯 How to Use

### Basic PDF Annotation

1. **Upload a PDF**: Click "Upload PDF" button and select your file
2. **Choose a tool**: Select from pen, text, eraser, or select/move tools
3. **Annotate**: Draw, type, or markup your PDF as needed
4. **Navigate**: Use page controls and zoom to navigate your document

### AI Features

#### Convert Handwriting to LaTeX
1. Select the **LaTeX Select** tool (📐 icon)
2. Draw a rectangle around handwritten math
3. The AI will automatically convert it to properly formatted LaTeX

#### Get AI Tutoring Hints
1. Click the **Get Hint** button (💡 icon)
2. Optionally provide a specific question
3. The AI tutor will analyze your work and provide helpful guidance

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **PDF Processing**: PDF.js
- **Math Rendering**: KaTeX, react-katex
- **AI Integration**: Google Gemini AI
- **Build Tool**: Vite
- **Styling**: Tailwind CSS

## 📁 Project Structure

```
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
```

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Check TypeScript types
- `npm test` - Run tests

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini AI API key | Yes |
| `GROQ_API_KEY` | Groq AI API key | No |
| `GROK_API_KEY` | Grok AI API key | No |
| `VITE_APP_NAME` | Application name | No |
| `VITE_API_BASE_URL` | API base URL | No |

## 🚀 Deployment

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. Add your environment variables in Vercel dashboard
4. Deploy!

### Deploy to Netlify

1. Run `npm run build`
2. Upload the `dist/` folder to [Netlify](https://netlify.com)
3. Add environment variables in Netlify dashboard

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [PDF.js](https://mozilla.github.io/pdf.js/) for PDF rendering
- [Google Gemini AI](https://ai.google.dev/) for AI capabilities
- [KaTeX](https://katex.org/) for LaTeX rendering
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [React](https://react.dev/) for the UI framework

## 📞 Support

If you have any questions or run into issues:

1. Check the [Issues](https://github.com/yourusername/pdf-annotator-ai-tutor/issues) page
2. Create a new issue if your problem isn't already reported
3. Provide as much detail as possible including:
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser and OS information
   - Console error messages

---

**Happy Annotating! 🎉**
