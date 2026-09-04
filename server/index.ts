import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

if (!PROJECT) {
  throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required to call Vertex AI.');
}

// Uses Application Default Credentials (gcloud auth application-default login,
// or the service account attached to the runtime) — no API key involved.
const ai = new GoogleGenAI({ vertexai: true, project: PROJECT, location: LOCATION });

const ALLOWED_MODELS = new Set(['gemini-3.8-flash']);

const app = express();
app.use(express.json({ limit: '2mb' }));

app.post('/api/generate', async (req, res) => {
  const { sourceSystem, useCase, prompts, code, selectedModel } = req.body ?? {};

  if (typeof useCase !== 'string' || !useCase.trim()) {
    res.status(400).json({ error: 'useCase is required' });
    return;
  }
  if (!(typeof prompts === 'string' && prompts.trim()) && !(typeof code === 'string' && code.trim())) {
    res.status(400).json({ error: 'Either prompts or code is required' });
    return;
  }

  const model = ALLOWED_MODELS.has(selectedModel) ? selectedModel : 'gemini-3.8-flash';

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
      3. 'modelRecommendation': An object with 'model' (which Gemini model to use) and 'reasoning' (markdown string explaining why). CRITICAL: You MUST ONLY recommend gemini-3.8-flash. DO NOT recommend Gemini 1.5, Pro models, or any version below 3.8.
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
              model="gemini-3.8-flash",
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

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Source System: ${sourceSystem}\n\nUse Case:\n${useCase}\n\nPrompts:\n${prompts ?? ''}\n\nCode:\n${code ?? ''}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
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

    if (!response.text) {
      res.status(502).json({ error: 'Empty response from model' });
      return;
    }

    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error('Failed to generate migration plan:', error);
    res.status(500).json({ error: 'Failed to generate migration plan' });
  }
});

// Serve the built frontend (npm run build) so this single server can be
// deployed standalone, e.g. to Cloud Run.
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
