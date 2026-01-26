
import { GoogleGenAI, Type } from "@google/genai";
import { MarketFile, AnalysisResult } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // Guidelines: Always use new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async analyzeMarketReports(files: MarketFile[]): Promise<AnalysisResult> {
    // Guidelines: Use 'gemini-3-pro-preview' for complex reasoning tasks.
    const model = 'gemini-3-pro-preview';
    
    const docMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];

    const parts = files.map(file => {
      // 如果是图片或已知的文档格式且有 base64 内容
      const isSupportedDoc = docMimeTypes.includes(file.type);
      const isImage = file.type.startsWith('image/');

      if ((isImage || isSupportedDoc) && file.content && file.content.includes(',')) {
        return {
          inlineData: {
            mimeType: file.type,
            data: file.content.split(',')[1] // 提取 base64 部分
          }
        };
      }
      // 如果是纯文本内容
      if (file.previewType === 'text' && file.content) {
        return { text: `文件名: ${file.name}\n文本内容: ${file.content}\n` };
      }
      // 兜底策略：仅发送文件名和类型
      return { text: `文件名: ${file.name}\n文件类型: ${file.type}\n注：该文件以元数据形式参与分析。` };
    });

    const prompt = `
      你是一名世界级的市场分析专家。请阅读并深度分析提供的所有文件（包括图像、PDF、Word文档、Excel表格、PPT幻灯片和文本）。
      请整合所有信息，生成一份深度市场分析报告。
      
      要求：
      1. 必须包含标题(title)、摘要(summary)、关键洞察(keyInsights)、建议(recommendations)、竞品分析(competitorAnalysis)和行业趋势(trends)。
      2. 语言必须使用专业且通顺的中文。
      3. 严格按照 JSON 格式输出。
      4. 即使文件格式复杂，也要尽力提取其中的核心数据或战略意义。
    `;

    // Guidelines: Use ai.models.generateContent directly.
    const response = await this.ai.models.generateContent({
      model,
      contents: { parts: [...parts, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            keyInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            competitorAnalysis: { type: Type.STRING },
            trends: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["title", "summary", "keyInsights", "recommendations", "competitorAnalysis", "trends"]
        }
      }
    });

    // Guidelines: response.text is a property, not a method.
    const text = response.text || '{}';
    return JSON.parse(text);
  }
}

export const geminiService = new GeminiService();
