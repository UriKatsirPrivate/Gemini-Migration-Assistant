# Gemini Migration Assistant

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-black?logo=github)](https://github.com/UriKatsirPrivate/Gemini-Migration-Assistant/)

The **Gemini Migration Assistant** is a comprehensive tool designed to help developers and AI engineers seamlessly migrate their existing AI workloads from platforms like OpenAI and Anthropic (via AWS Bedrock) to the Google Gemini ecosystem.

## 🚀 Key Features

- **Interactive Onboarding**: A built-in guided tour to help you get started quickly.
- **Migration Cheat Sheet**: A quick-reference guide comparing OpenAI, Bedrock, and Vertex AI/Gemini features (SDKs, Auth, RAG, etc.).
- **Live Code Samples**: Side-by-side code comparisons for common tasks like text generation, streaming, and structured output.
- **AI-Powered Migration Planner**:
    - **Customized Strategy**: Generates a step-by-step migration plan based on your specific use case.
    - **Prompt Optimization**: Automatically refines your existing prompts to leverage Gemini's long context and advanced reasoning.
    - **Code Conversion**: Provides production-ready Python code using both the native `google-genai` SDK and the OpenAI-compatible API.
    - **Integration Examples**: Generates a full FastAPI application structure for immediate deployment.
    - **Skill Generation**: Creates `SKILL.md` files to help you encapsulate your workload as a reusable AI Skill.

## 🛠️ Tech Stack

- **Frontend**: React 18+, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **AI Engine**: Google Gemini API (`@google/genai`)
- **Components**: 
    - `react-joyride` for the interactive tour
    - `react-syntax-highlighter` for beautiful code snippets
    - `react-markdown` for rendering AI-generated plans

## 🏁 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- A Google Gemini API Key

### Installation

1. Clone the repository (or download the source).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables. Create a `.env` file in the root directory:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

### Running the App

Start the development server:
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

## 📖 How to Use

1. **Select Source**: Choose whether you are migrating from OpenAI or Claude (Bedrock).
2. **Describe Use Case**: Briefly explain what your current application does.
3. **Input Prompts & Code**: Paste your existing system instructions and Python code snippets.
4. **Select Gemini Model**: Choose between Gemini 3.5 Flash (for speed) or Gemini 3.1 Pro (for complex reasoning).
5. **Generate**: Click "Generate Plan" to receive your customized migration package.
6. **Explore Tabs**:
    - **Overview**: Read your migration strategy.
    - **Cheat Sheet**: Compare architectural differences.
    - **Code Samples**: See how to implement common patterns.
    - **Prompts**: Get your optimized Gemini prompts.
    - **Your Code**: View your converted Python logic.
    - **Integration**: See a full FastAPI implementation.
    - **Skills**: Get a reusable `SKILL.md` definition.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an issue for any feature requests or bug reports.

## 📄 License

This project is licensed under the MIT License.
