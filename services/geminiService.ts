
import { GoogleGenAI, Type } from "@google/genai";
import { MarketFile, AnalysisResult } from "../types";

export class GeminiService {
  /**
   * 深度分析市场报告
   * 规范：不在构造函数或全局初始化 GoogleGenAI，而是在调用时实时创建。
   */
  async analyzeMarketReports(files: MarketFile[]): Promise<AnalysisResult> {
    // 确保在调用时获取最新的 API Key
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key 未配置，请检查环境设置");
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-3-pro-preview'; // 使用 Pro 模型处理复杂分析任务
    
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
      const isSupportedDoc = docMimeTypes.includes(file.type);
      const isImage = file.type.startsWith('image/');

      if ((isImage || isSupportedDoc) && file.content && file.content.includes(',')) {
        return {
          inlineData: {
            mimeType: file.type,
            data: file.content.split(',')[1]
          }
        };
      }
      if (file.previewType === 'text' && file.content) {
        return { text: `文件名: ${file.name}\n内容: ${file.content}\n` };
      }
      return { text: `文件名: ${file.name}\n类型: ${file.type}\n` };
    });

    const prompt = `
      你是一名世界级的市场分析专家。请阅读并深度分析提供的所有文件（图像、PDF、Word、Excel、PPT、文本）。
      请整合所有信息，生成一份深度市场分析报告。
      
      要求：
      1. 语言：专业中文。
      2. 格式：严格 JSON 格式。
      3. 结构：包含 title, summary, keyInsights, recommendations, competitorAnalysis, trends。
    `;

    const response = await ai.models.generateContent({
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

    return JSON.parse(response.text || '{}');
  }
}

export const geminiService = new GeminiService();
