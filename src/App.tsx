import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import Markdown from 'react-markdown';
import { Loader2, ArrowRight, Code, FileText, CheckCircle, Zap, Table as TableIcon, Lightbulb, Play, RotateCcw, Wrench, Terminal, Github } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Joyride, Step } from 'react-joyride';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface MigrationPlan {
  overview: string;
  suggestedSteps: {
    googleGenAi: string[];
    openAiCompatible: string[];
  };
  modelRecommendation: {
    model: string;
    reasoning: string;
  };
  optimizedPrompt: {
    systemPrompt: string;
    userPrompt: string;
    reasoning: string;
  };
  convertedCode: {
    googleGenAi: string;
    openAiCompatible: string;
  };
  skillFiles: {
    skillMd: string;
    optionalComponents: string;
  };
  hasOriginalPrompt?: boolean;
  hasOriginalCode?: boolean;
}

const CHEAT_SHEET = [
  { category: "SDK / Client", openai: "openai (Python/JS)", bedrock: "boto3 (Runtime)", vertex: "google-genai" },
  { category: "System Prompt", openai: '{"role": "system"}', bedrock: "system (in message)", vertex: "system_instruction" },
  { category: "Orchestration", openai: "Assistants API", bedrock: "Bedrock Agents", vertex: "Reasoning Engine (Agent Engine)" },
  { category: "RAG / Search", openai: "File Search (Assistants)", bedrock: "Knowledge Bases", vertex: "Vertex AI Search & Conversation" },
  { category: "Vector DB", openai: "Managed Vector Store", bedrock: "Vector Engine (OpenSearch)", vertex: "Vertex AI Vector Search" },
  { category: "Authentication", openai: "API Keys", bedrock: "IAM Roles / Policies", vertex: "IAM (Service Accounts / ADC)" },
  { category: "Throughput", openai: "TPM / RPM (Tiered)", bedrock: "Provisioned Throughput", vertex: "QPM (Queries Per Minute)" },
  { category: "Reliability", openai: '"Thinking" models', bedrock: "-", vertex: "Controlled Generation (JSON Schema)" },
];

const getCodeSamples = (model: string) => [
  {
    title: "Initialize the client",
    openai: `from openai import OpenAI\nclient = OpenAI()`,
    bedrock: `import boto3\nclient = boto3.client("bedrock-runtime", region_name="us-east-1")`,
    gemini: `from google import genai\n\n# For Gemini API\nclient = genai.Client()\n\n# For Vertex AI\nclient = genai.Client(vertexai=True, project="your-project-id", location="us-central1")`
  },
  {
    title: "Text generation",
    openai: `response = client.chat.completions.create(\n    model="gpt-4o",\n    messages=[{"role": "user", "content": "Tell me a story."}]\n)\nprint(response.choices[0].message.content)`,
    bedrock: `import json\n\nresponse = client.invoke_model(\n    modelId="anthropic.claude-3-sonnet-20240229-v1:0",\n    body=json.dumps({\n        "anthropic_version": "bedrock-2023-05-31",\n        "max_tokens": 1024,\n        "messages": [{"role": "user", "content": "Tell me a story."}]\n    })\n)\nresult = json.loads(response.get("body").read())\nprint(result["content"][0]["text"])`,
    gemini: `response = client.models.generate_content(\n    model="${model}",\n    contents="Tell me a story."\n)\nprint(response.text)`
  },
  {
    title: "System instructions",
    openai: `response = client.chat.completions.create(\n    model="gpt-4o",\n    messages=[\n        {"role": "system", "content": "You are a helpful assistant."},\n        {"role": "user", "content": "Hello."}\n    ]\n)`,
    bedrock: `import json\n\nresponse = client.invoke_model(\n    modelId="anthropic.claude-3-sonnet-20240229-v1:0",\n    body=json.dumps({\n        "anthropic_version": "bedrock-2023-05-31",\n        "max_tokens": 1024,\n        "system": "You are a helpful assistant.",\n        "messages": [{"role": "user", "content": "Hello."}]\n    })\n)`,
    gemini: `from google.genai import types\n\nresponse = client.models.generate_content(\n    model="${model}",\n    contents="Hello.",\n    config=types.GenerateContentConfig(\n        system_instruction="You are a helpful assistant.",\n    ),\n)`
  },
  {
    title: "Streaming",
    openai: `response = client.chat.completions.create(\n    model="gpt-4o",\n    messages=[{"role": "user", "content": "Tell me a story."}],\n    stream=True\n)\nfor chunk in response:\n    print(chunk.choices[0].delta.content, end="")`,
    bedrock: `import json\n\nresponse = client.invoke_model_with_response_stream(\n    modelId="anthropic.claude-3-sonnet-20240229-v1:0",\n    body=json.dumps({\n        "anthropic_version": "bedrock-2023-05-31",\n        "max_tokens": 1024,\n        "messages": [{"role": "user", "content": "Tell me a story."}]\n    })\n)\nfor event in response.get("body"):\n    chunk = json.loads(event["chunk"]["bytes"])\n    if chunk["type"] == "content_block_delta":\n        print(chunk["delta"]["text"], end="")`,
    gemini: `response = client.models.generate_content_stream(\n    model="${model}",\n    contents="Tell me a story."\n)\nfor chunk in response:\n    print(chunk.text, end="")`
  },
  {
    title: "JSON / Structured Output",
    openai: `response = client.chat.completions.create(\n    model="gpt-4o",\n    response_format={ "type": "json_object" },\n    messages=[{"role": "user", "content": "Return JSON."}]\n)`,
    bedrock: `import json\n\nresponse = client.invoke_model(\n    modelId="anthropic.claude-3-sonnet-20240229-v1:0",\n    body=json.dumps({\n        "anthropic_version": "bedrock-2023-05-31",\n        "max_tokens": 1024,\n        "messages": [{"role": "user", "content": "Return JSON."}]\n    })\n)`,
    gemini: `from google.genai import types\n\nresponse = client.models.generate_content(\n    model="${model}",\n    contents="Return JSON.",\n    config=types.GenerateContentConfig(\n        response_mime_type="application/json",\n    ),\n)`
  }
];

const getOpenAiCompatibleSamples = (model: string) => [
  {
    title: "Initialize the client",
    openai: `from openai import OpenAI\nclient = OpenAI()`,
    gemini: `from openai import OpenAI\n\nclient = OpenAI(\n    api_key="gemini_api_key",\n    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"\n)`
  },
  {
    title: "Text generation",
    openai: `response = client.chat.completions.create(\n    model="gpt-4o",\n    messages=[{"role": "user", "content": "Tell me a story."}]\n)\nprint(response.choices[0].message.content)`,
    gemini: `response = client.chat.completions.create(\n    model="${model}",\n    messages=[{"role": "user", "content": "Tell me a story."}]\n)\nprint(response.choices[0].message.content)`
  },
  {
    title: "System instructions",
    openai: `response = client.chat.completions.create(\n    model="gpt-4o",\n    messages=[\n        {"role": "system", "content": "You are a helpful assistant."},\n        {"role": "user", "content": "Hello."}\n    ]\n)`,
    gemini: `response = client.chat.completions.create(\n    model="${model}",\n    messages=[\n        {"role": "system", "content": "You are a helpful assistant."},\n        {"role": "user", "content": "Hello."}\n    ]\n)`
  },
  {
    title: "Streaming",
    openai: `response = client.chat.completions.create(\n    model="gpt-4o",\n    messages=[{"role": "user", "content": "Tell me a story."}],\n    stream=True\n)\nfor chunk in response:\n    print(chunk.choices[0].delta.content, end="")`,
    gemini: `response = client.chat.completions.create(\n    model="${model}",\n    messages=[{"role": "user", "content": "Tell me a story."}],\n    stream=True\n)\nfor chunk in response:\n    print(chunk.choices[0].delta.content, end="")`
  },
  {
    title: "JSON / Structured Output",
    openai: `response = client.chat.completions.create(\n    model="gpt-4o",\n    response_format={ "type": "json_object" },\n    messages=[{"role": "user", "content": "Return JSON."}]\n)`,
    gemini: `response = client.chat.completions.create(\n    model="${model}",\n    response_format={ "type": "json_object" },\n    messages=[{"role": "user", "content": "Return JSON."}]\n)`
  }
];

export default function App() {
  const [useCase, setUseCase] = useState('');
  const [sourceSystem, setSourceSystem] = useState('OpenAI');
  const [prompts, setPrompts] = useState('');
  const [code, setCode] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'cheatsheet' | 'samples' | 'prompt' | 'code' | 'skills' | 'integration'>('overview');
  const [sampleApproach, setSampleApproach] = useState<'google-genai' | 'openai-compatible'>('openai-compatible');
  const [sdkApproach, setSdkApproach] = useState<'google-genai' | 'openai-compatible'>('openai-compatible');

  const [runTour, setRunTour] = useState(false);
  const [tourSteps] = useState<Step[]>([
    {
      target: '.tour-step-1',
      content: 'Welcome to the Gemini Migration Assistant! This tool helps you migrate your existing AI workloads to Gemini.',
      skipBeacon: true,
    },
    {
      target: '.tour-step-source',
      content: 'Select the source system you are migrating from (e.g., OpenAI or Claude on Bedrock).',
    },
    {
      target: '.tour-step-2',
      content: 'Describe your current use case here. What is your application doing?',
    },
    {
      target: '.tour-step-3',
      content: 'Paste your current system prompt or instructions here.',
    },
    {
      target: '.tour-step-4',
      content: 'Paste your current Python code here (e.g., OpenAI or Bedrock API calls).',
    },
    {
      target: '.tour-step-5',
      content: 'Click here to generate a customized migration plan!',
    },
    {
      target: '.tour-step-6',
      content: 'Once generated, your migration plan, optimized prompts, and converted code will appear in these tabs.',
    }
  ]);

  const handleReset = () => {
    setUseCase('');
    setPrompts('');
    setCode('');
    setPlan(null);
    setActiveTab('overview');
    setSourceSystem('OpenAI');
    setSdkApproach('openai-compatible');
    setSampleApproach('openai-compatible');
  };

  const handleGenerate = async () => {
    if (!useCase) {
      alert("Please provide a use case description.");
      return;
    }
    if (!prompts && !code) {
      alert("Please provide either current prompts or current Python code.");
      return;
    }

    setLoading(true);
    try {
      const systemInstruction = `You are an expert AI migration consultant specializing in migrating workloads from OpenAI and AWS Bedrock (Claude/Llama) to Google's Gemini models using the new google-genai SDK.
      
      The user will provide:
      1. A description of their current use case.
      2. Their current prompts (optional).
      3. Their current Python code (optional).
      
      You need to provide a structured JSON response containing:
      1. 'overview': A markdown string explaining the general migration process and steps tailored to their use case.
      2. 'suggestedSteps': An object containing two arrays of strings, representing concrete, actionable steps for the migration process:
         - 'googleGenAi': Steps if the user chooses the google-genai SDK.
         - 'openAiCompatible': Steps if the user chooses the OpenAI-compatible API.
      3. 'modelRecommendation': An object with 'model' (which Gemini 3.0 or 3.1 model to use) and 'reasoning' (markdown string explaining why). CRITICAL: You MUST ONLY recommend Gemini 3.0 or 3.1 models (e.g., Gemini 3.1 Pro, Gemini 3.0 Flash, or Gemini 3.1 Flash-Lite). DO NOT recommend Gemini 1.5 or any version below 3.0.
      4. 'optimizedPrompt': An object with 'systemPrompt' (the improved system instructions/context), 'userPrompt' (the improved user query, incorporating best practices like clear structure, XML tags, etc.), and 'reasoning' (markdown string explaining the improvements). CRITICAL: You MUST include at least 2-3 few-shot examples within the 'systemPrompt' or 'userPrompt' to demonstrate the expected input and output format. (If no prompt provided, create brand new optimized prompts based on the use case).
      5. 'convertedCode': An object containing two versions of the Python code (either converted from the user's code, or generated from scratch if no code was provided). The code MUST use the optimized system and user prompts generated in step 4.
         - 'googleGenAi': The code using the new \`google-genai\` SDK.
         - 'openAiCompatible': The code using the \`openai\` SDK with the Gemini base URL (\`https://generativelanguage.googleapis.com/v1beta/openai/\`).
      6. 'skillFiles': An object containing 'skillMd' (a markdown string representing a SKILL.md file that defines this workload as a reusable AI Skill/Tool, including its description, inputs, and outputs. CRITICAL: Follow the structure and best practices outlined in https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf when creating this file. Below is an example of a valid SKILL.md file. Always use it as guidance:

###SKILL.md
---
name: prompt-optimizer
description: Optimizes and refines AI prompts using prompt engineering best practices. Trigger this when a user asks to improve a prompt, write a prompt, act as a prompt engineer, or structure instructions for an LLM.
version: 1.1.0
category: utility
tags: [prompt-engineering, optimization, instructions, llm-ops]
---

# Prompt Optimizer Skill

You are an expert prompt engineer. Your goal is to take a user's initial prompt, rough idea, or basic instructions, and upgrade them into a highly effective, robust, and clear prompt ready for a Large Language Model (LLM).

## Workflow

1. **Analyze Intent**: Read the user's original request. Identify the core task, any missing context, potential ambiguities, and the desired output format.
2. **Apply Best Practices**: Consult \`references/prompt-guidelines.md\` to ensure the prompt includes necessary elements like a clear persona, constraints, step-by-step thinking, and proper formatting techniques.
3. **Draft the Prompt**: Use the structure provided in \`references/prompt-template.md\` to build the optimized prompt. Utilize formatting markers (like pseudo-XML or markdown) to separate instructions from variables.
4. **Output**: Present the optimized prompt clearly in a copyable markdown code block.
5. **Explain**: Briefly summarize the specific improvements made (e.g., "Added a persona to set the tone," "Included chain-of-thought to prevent logic errors") so the user understands the value added.

## Guidelines
Always prioritize clarity and specificity over brevity. If the user's initial prompt is completely missing crucial context, ask them 1-2 clarifying questions before generating the final optimized prompt. Check \`references/metadata.md\` for version history and technical specifications.
) and 'optionalComponents' (a markdown string containing any other relevant files for this skill, formatted strictly as *.md or *.py files, such as a Python tool definition or markdown documentation).
      
      CRITICAL for 'convertedCode':
      1) You MUST include the EXACT, FULL text of the 'systemPrompt' and 'userPrompt' you generated in step 4 as variables in the Python code. Do NOT use placeholders like "your system prompt here" or "insert prompt".
      2) Structure the code to separate the system and user prompt into variables (e.g., \`SYSTEM_INSTRUCTION\` and \`USER_PROMPT\`).
      3) Define these variables at the top level of the script, OUTSIDE of any functions.
      4) Use these variables in the API call.
      
      Example for googleGenAi:
      from google import genai
      from google.genai import types
      
      SYSTEM_INSTRUCTION = """[INSERT FULL SYSTEM PROMPT HERE]"""
      USER_PROMPT = """[INSERT FULL USER PROMPT HERE]"""
      
      def generate_response():
          client = genai.Client()
          response = client.models.generate_content(
              model="gemini-3.1-pro-preview",
              contents=USER_PROMPT,
              config=types.GenerateContentConfig(
                  system_instruction=SYSTEM_INSTRUCTION,
              )
          )
          return response.text
      
      Ensure the Python code uses the correct \`google-genai\` SDK syntax.
      For Vertex AI initialization: \`client = genai.Client(vertexai=True, project="your-project-id", location="us-central1")\`
      For Gemini API initialization: \`client = genai.Client()\`
      For generation: \`client.models.generate_content(model=..., contents=...)\`
      For system instructions or JSON output, use \`config=types.GenerateContentConfig(system_instruction=..., response_mime_type="application/json")\` and import \`from google.genai import types\`.
      `;

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: `Source System: ${sourceSystem}\n\nUse Case:\n${useCase}\n\nPrompts:\n${prompts}\n\nCode:\n${code}`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overview: { type: Type.STRING },
              suggestedSteps: {
                type: Type.OBJECT,
                properties: {
                  googleGenAi: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  openAiCompatible: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["googleGenAi", "openAiCompatible"]
              },
              modelRecommendation: {
                type: Type.OBJECT,
                properties: {
                  model: { type: Type.STRING },
                  reasoning: { type: Type.STRING }
                },
                required: ["model", "reasoning"]
              },
              optimizedPrompt: {
                type: Type.OBJECT,
                properties: {
                  systemPrompt: { type: Type.STRING },
                  userPrompt: { type: Type.STRING },
                  reasoning: { type: Type.STRING }
                },
                required: ["systemPrompt", "userPrompt", "reasoning"]
              },
              convertedCode: {
                type: Type.OBJECT,
                properties: {
                  googleGenAi: { type: Type.STRING },
                  openAiCompatible: { type: Type.STRING }
                },
                required: ["googleGenAi", "openAiCompatible"]
              },
              skillFiles: {
                type: Type.OBJECT,
                properties: {
                  skillMd: { type: Type.STRING },
                  optionalComponents: { type: Type.STRING }
                },
                required: ["skillMd", "optionalComponents"]
              }
            },
            required: ["overview", "suggestedSteps", "modelRecommendation", "optimizedPrompt", "convertedCode", "skillFiles"]
          }
        }
      });
      
      if (response.text) {
        const parsedPlan = JSON.parse(response.text);
        setPlan({ ...parsedPlan, hasOriginalPrompt: prompts.trim() !== '', hasOriginalCode: code.trim() !== '' });
        setActiveTab('overview');
      }
    } catch (error) {
      console.error("Failed to generate plan:", error);
      alert("Failed to generate migration plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'cheatsheet', label: 'Cheat Sheet', icon: TableIcon },
    { id: 'samples', label: 'Code Samples', icon: Code },
    { id: 'prompt', label: 'Prompts', icon: Lightbulb },
    { id: 'code', label: 'Your Code', icon: Code },
    { id: 'integration', label: 'Integration', icon: Terminal },
    { id: 'skills', label: 'Skills', icon: Wrench },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous={true}
        options={{
          primaryColor: '#3b82f6',
          backgroundColor: '#1f2937',
          textColor: '#f3f4f6',
          arrowColor: '#1f2937',
          showProgress: true,
          buttons: ['back', 'close', 'primary', 'skip']
        }}
        onEvent={(data) => {
          const { status } = data;
          if (['finished', 'skipped'].includes(status)) {
            setRunTour(false);
          }
        }}
      />
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight tour-step-1">Gemini Migration Assistant</h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/UriKatsirPrivate/Gemini-Migration-Assistant/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors border border-transparent hover:border-gray-700 flex items-center justify-center"
              title="View on GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
            <button
              onClick={() => setRunTour(true)}
              className="px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700"
            >
              Take Tour
            </button>
            <label className="text-sm font-medium text-gray-400 hidden sm:block">Model:</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-100"
            >
              <option value="gemini-3-flash-preview">Gemini 3.0 Flash (Fast & Capable)</option>
              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Best Reasoning)</option>
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Input Column */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-6 lg:sticky lg:top-24 self-start">
            <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-400" />
                  Current Workload
                </h2>
                <button
                  onClick={handleReset}
                  className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-md transition-colors"
                  title="Clear All / Start Over"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="tour-step-source">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Source System
                  </label>
                  <select
                    value={sourceSystem}
                    onChange={(e) => {
                      setSourceSystem(e.target.value);
                      if (e.target.value === 'Claude on Bedrock') {
                        setSdkApproach('google-genai');
                        setSampleApproach('google-genai');
                      } else if (e.target.value === 'OpenAI') {
                        setSdkApproach('openai-compatible');
                        setSampleApproach('openai-compatible');
                      }
                    }}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-100 mb-2"
                  >
                    <option value="OpenAI">OpenAI</option>
                    <option value="Claude on Bedrock">Claude on Bedrock</option>
                  </select>
                </div>

                <div className="tour-step-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    1. Use Case Description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value)}
                    placeholder="e.g., A customer support chatbot that answers questions based on our knowledge base..."
                    className="w-full h-32 px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-gray-100 placeholder-gray-600"
                  />
                </div>

                <div className="tour-step-3">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    2. Current Prompts (OpenAI/Claude) {!code && <span className="text-red-400">*</span>} {code && <span className="text-gray-500 font-normal">(Optional)</span>}
                  </label>
                  <textarea
                    value={prompts}
                    onChange={(e) => setPrompts(e.target.value)}
                    placeholder="e.g., You are a helpful assistant. Answer the user's question concisely..."
                    className="w-full h-32 px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm text-gray-100 placeholder-gray-600"
                  />
                </div>

                <div className="tour-step-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    3. Current Python Code {!prompts && <span className="text-red-400">*</span>} {prompts && <span className="text-gray-500 font-normal">(Optional)</span>}
                  </label>
                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g., import openai\nclient = openai.OpenAI()\n..."
                    className="w-full h-48 px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm text-gray-100 placeholder-gray-600"
                  />
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="tour-step-5 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating Migration Plan...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Generate Plan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Output Column */}
          <div className="lg:col-span-8 xl:col-span-9">
            {plan ? (
              <div className="tour-step-6 bg-gray-900 rounded-xl shadow-sm border border-gray-800 overflow-hidden flex flex-col h-full min-h-[800px] lg:h-[calc(100vh-8rem)]">
                <div className="border-b border-gray-800 bg-gray-900/50 px-2 flex overflow-x-auto hide-scrollbar shrink-0">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-400 bg-gray-800/50'
                          : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                  {activeTab === 'overview' && (
                    <div className="space-y-8">
                      <div className="prose prose-invert prose-blue max-w-none">
                        <Markdown>{plan.overview}</Markdown>
                      </div>

                      <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 flex items-start gap-4">
                        <div className="bg-blue-900/50 p-2 rounded-full mt-1">
                          <CheckCircle className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-blue-300 uppercase tracking-wider mb-1">Recommended Model</h3>
                          <p className="text-xl font-semibold text-blue-100">{plan.modelRecommendation.model}</p>
                          <div className="prose prose-invert prose-blue max-w-none mt-2 text-sm">
                            <Markdown>{plan.modelRecommendation.reasoning}</Markdown>
                          </div>
                        </div>
                      </div>
                      
                      {plan.suggestedSteps && (
                        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <h3 className="text-lg font-medium text-gray-100 flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-blue-400" />
                              Suggested Steps
                            </h3>
                            <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-1">
                              <button
                                onClick={() => setSdkApproach('google-genai')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                  sdkApproach === 'google-genai'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-gray-200'
                                }`}
                              >
                                Google Gen AI SDK
                              </button>
                              {sourceSystem !== 'Claude on Bedrock' && (
                                <button
                                  onClick={() => setSdkApproach('openai-compatible')}
                                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                    sdkApproach === 'openai-compatible'
                                      ? 'bg-blue-600 text-white'
                                      : 'text-gray-400 hover:text-gray-200'
                                  }`}
                                >
                                  OpenAI-Compatible API
                                </button>
                              )}
                            </div>
                          </div>
                          <ul className="space-y-3">
                            {(sdkApproach === 'google-genai' ? plan.suggestedSteps.googleGenAi : plan.suggestedSteps.openAiCompatible).map((step, index) => (
                              <li key={index} className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center text-sm font-medium mt-0.5">
                                  {index + 1}
                                </div>
                                <div className="text-gray-300">
                                  <Markdown>{step}</Markdown>
                                </div>
                              </li>
                            ))}
                          </ul>
                          
                          {sourceSystem === 'OpenAI' && (
                            <div className="mt-6 pt-4 border-t border-gray-700/50">
                              <a
                                href={
                                  sdkApproach === 'google-genai'
                                    ? 'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/migrate/openai/migrate-code'
                                    : 'https://ai.google.dev/gemini-api/docs/openai'
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium"
                              >
                                View Official Migration Guide <ArrowRight className="w-4 h-4" />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'cheatsheet' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-100">Migration Cheat Sheet</h3>
                      <div className="overflow-x-auto rounded-lg border border-gray-800">
                        <table className="min-w-full divide-y divide-gray-800 text-sm">
                          <thead className="bg-gray-800/50">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium text-gray-200">Feature Category</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-200">OpenAI</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-200">AWS Bedrock</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-200">Vertex AI (GCP)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800 bg-transparent">
                            {CHEAT_SHEET.map((row, i) => (
                              <tr key={i} className="hover:bg-gray-800/50">
                                <td className="px-4 py-3 font-medium text-gray-200">{row.category}</td>
                                <td className="px-4 py-3 text-gray-400">{row.openai}</td>
                                <td className="px-4 py-3 text-gray-400">{row.bedrock}</td>
                                <td className="px-4 py-3 text-blue-400 font-medium">{row.vertex}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === 'samples' && (
                    <div className="space-y-8">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h3 className="text-lg font-medium text-gray-100">Code Samples</h3>
                        <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-1">
                          <button
                            onClick={() => setSampleApproach('google-genai')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                              sampleApproach === 'google-genai'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            Google Gen AI SDK
                          </button>
                          {sourceSystem !== 'Claude on Bedrock' && (
                            <button
                              onClick={() => setSampleApproach('openai-compatible')}
                              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                sampleApproach === 'openai-compatible'
                                  ? 'bg-blue-600 text-white'
                                  : 'text-gray-400 hover:text-gray-200'
                              }`}
                            >
                              OpenAI-Compatible API
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-8">
                        {(sampleApproach === 'google-genai' ? getCodeSamples(selectedModel) : getOpenAiCompatibleSamples(selectedModel)).map((sample, i) => (
                          <div key={i} className="space-y-3">
                            <h4 className="text-md font-medium text-gray-300 border-b border-gray-800 pb-2">{sample.title}</h4>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">
                                  {sourceSystem === 'Claude on Bedrock' ? 'Claude on Bedrock' : 'OpenAI'}
                                </div>
                                <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden h-full">
                                  <SyntaxHighlighter
                                    language="python"
                                    style={vscDarkPlus}
                                    customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.875rem' }}
                                  >
                                    {sourceSystem === 'Claude on Bedrock' && 'bedrock' in sample ? (sample as any).bedrock : sample.openai}
                                  </SyntaxHighlighter>
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-blue-400 uppercase tracking-wider mb-2 font-semibold">Gemini / Vertex AI</div>
                                <div className="bg-blue-950/20 border border-blue-900/50 rounded-lg overflow-hidden h-full">
                                  <SyntaxHighlighter
                                    language="python"
                                    style={vscDarkPlus}
                                    customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.875rem' }}
                                  >
                                    {sample.gemini}
                                  </SyntaxHighlighter>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'prompt' && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-lg font-medium mb-4 flex items-center gap-2 text-green-400">
                          <Zap className="w-5 h-5" />
                          {plan.hasOriginalPrompt ? "Optimized Prompts" : "Generated Prompts"}
                        </h3>
                        
                        <div className="space-y-6 mb-6">
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">System Prompt</h4>
                            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap text-blue-300">
                              {plan.optimizedPrompt.systemPrompt.replace(/\\n/g, '\n')}
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">User Prompt</h4>
                            <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap text-green-300">
                              {plan.optimizedPrompt.userPrompt.replace(/\\n/g, '\n')}
                            </div>
                          </div>
                        </div>

                        <div className="prose prose-invert prose-green max-w-none border-t border-gray-800 pt-6">
                          <Markdown>{plan.optimizedPrompt.reasoning}</Markdown>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'code' && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h3 className="text-lg font-medium flex items-center gap-2 text-gray-100">
                          <Code className="w-5 h-5 text-gray-500" />
                          {plan.hasOriginalCode ? "Converted Python Code" : "Generated Python Code"}
                        </h3>
                        <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-1">
                          <button
                            onClick={() => setSdkApproach('google-genai')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                              sdkApproach === 'google-genai'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            Google Gen AI SDK
                          </button>
                          {sourceSystem !== 'Claude on Bedrock' && (
                            <button
                              onClick={() => setSdkApproach('openai-compatible')}
                              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                sdkApproach === 'openai-compatible'
                                  ? 'bg-blue-600 text-white'
                                  : 'text-gray-400 hover:text-gray-200'
                              }`}
                            >
                              OpenAI-Compatible API
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
                        <SyntaxHighlighter
                          language="python"
                          style={vscDarkPlus}
                          customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.875rem' }}
                        >
                          {(sdkApproach === 'google-genai' ? plan.convertedCode.googleGenAi : plan.convertedCode.openAiCompatible).replace(/\\n/g, '\n')}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  )}

                  {activeTab === 'integration' && plan && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-200 flex items-center gap-2">
                          <Terminal className="w-5 h-5 text-blue-400" />
                          Integration Example
                        </h3>
                      </div>
                      <p className="text-gray-400 text-sm">
                        This example demonstrates how to integrate your optimized prompt and Gemini API code into a production-ready FastAPI application.
                      </p>
                      
                      <div className="space-y-4">
                        <h4 className="text-md font-medium text-gray-300">1. Project Setup</h4>
                        <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
                          <div className="bg-gray-900 px-4 py-2 border-b border-gray-800 text-xs text-gray-400 font-mono">requirements.txt</div>
                          <SyntaxHighlighter language="text" style={vscDarkPlus} customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.875rem' }}>
                            {`fastapi\nuvicorn\npython-dotenv\n${sdkApproach === 'google-genai' ? 'google-genai' : 'openai'}`}
                          </SyntaxHighlighter>
                        </div>

                        <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
                          <div className="bg-gray-900 px-4 py-2 border-b border-gray-800 text-xs text-gray-400 font-mono">.env</div>
                          <SyntaxHighlighter language="text" style={vscDarkPlus} customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.875rem' }}>
                            {`GEMINI_API_KEY=your_api_key_here`}
                          </SyntaxHighlighter>
                        </div>

                        <h4 className="text-md font-medium text-gray-300 mt-6">2. Application Code</h4>
                        <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
                          <div className="bg-gray-900 px-4 py-2 border-b border-gray-800 text-xs text-gray-400 font-mono">main.py</div>
                          <SyntaxHighlighter language="python" style={vscDarkPlus} customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.875rem' }}>
                            {sdkApproach === 'google-genai' ? `import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Gemini Integration Example")

# Initialize the client
# The client automatically picks up GEMINI_API_KEY from the environment
client = genai.Client()

SYSTEM_INSTRUCTION = """${plan.optimizedPrompt.systemPrompt.replace(/`/g, '\\`')}"""

class RequestModel(BaseModel):
    user_input: str

@app.post("/generate")
async def generate_response(request: RequestModel):
    try:
        response = client.models.generate_content(
            model="${selectedModel}",
            contents=request.user_input,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.7,
            )
        )
        return {"response": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
` : `import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Gemini Integration Example")

# Initialize the OpenAI-compatible client
client = OpenAI(
    api_key=os.environ.get("GEMINI_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)

SYSTEM_INSTRUCTION = """${plan.optimizedPrompt.systemPrompt.replace(/`/g, '\\`')}"""

class RequestModel(BaseModel):
    user_input: str

@app.post("/generate")
async def generate_response(request: RequestModel):
    try:
        response = client.chat.completions.create(
            model="${selectedModel}",
            messages=[
                {"role": "system", "content": SYSTEM_INSTRUCTION},
                {"role": "user", "content": request.user_input}
            ],
            temperature=0.7,
        )
        return {"response": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
`}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'skills' && plan.skillFiles && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-lg font-medium mb-4 flex items-center gap-2 text-purple-400">
                          <Wrench className="w-5 h-5" />
                          Generated Skill Files
                        </h3>
                        
                        <p className="text-sm text-gray-400 mb-6">
                          For more advanced Skill creation, visit <a href="https://skill.genaitools.cloud/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">https://skill.genaitools.cloud/</a>
                        </p>
                        
                        <div className="space-y-6 mb-6">
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">SKILL.md</h4>
                            <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
                              <SyntaxHighlighter
                                language="markdown"
                                style={vscDarkPlus}
                                customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.875rem' }}
                              >
                                {plan.skillFiles.skillMd.replace(/\\n/g, '\n')}
                              </SyntaxHighlighter>
                            </div>
                          </div>
                          
                          {plan.skillFiles.optionalComponents && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Optional Components</h4>
                              <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
                                <SyntaxHighlighter
                                  language="markdown"
                                  style={vscDarkPlus}
                                  customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.875rem' }}
                                >
                                  {plan.skillFiles.optionalComponents.replace(/\\n/g, '\n')}
                                </SyntaxHighlighter>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="tour-step-6 bg-gray-900 rounded-xl shadow-sm border border-gray-800 h-full min-h-[600px] lg:h-[calc(100vh-8rem)] flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                  <ArrowRight className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-medium text-gray-100 mb-2">Ready to Migrate</h3>
                <p className="text-gray-400 max-w-md">
                  Fill in your current use case, prompts, and Python code on the left, then click "Generate Plan" to get your customized Gemini migration strategy.
                </p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
