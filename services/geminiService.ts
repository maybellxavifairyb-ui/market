
import { GoogleGenAI, Type } from "@google/genai";
import { MarketFile, Customer, AnalysisResult } from "../types";

export class GeminiService {
  async analyzeMarketReports(files: MarketFile[], customers: Customer[] = []): Promise<AnalysisResult> {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key 未配置");

    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-3-pro-preview';
    
    const docMimeTypes = [
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    const fileParts = files.map(file => {
      if ((file.type.startsWith('image/') || docMimeTypes.includes(file.type)) && file.content?.includes(',')) {
        return { inlineData: { mimeType: file.type, data: file.content.split(',')[1] } };
      }
      return { text: `文件[${file.name}]: ${file.content || '无内容'}` };
    });

    const customerContext = customers.length > 0 
      ? `\n以下是目标客户群信息：\n${customers.map(c => `- 客户:${c.name}, 装置:${c.equipment}, 产能:${c.capacity}, 原料:${c.rawMaterials}, 产成品:${c.products}, 当前毛利:${c.grossMargin}%`).join('\n')}`
      : "";

    const prompt = `
      你是一名资深市场战略顾问。请结合提供的市场周报文件${customers.length > 0 ? "和客户数据库" : ""}进行深度分析。
      
      ${customerContext}

      任务要求：
      1. 宏观分析：总结市场最新趋势、价格波动和竞品动态。
      2. 策略建议：给出宏观经营建议。
      ${customers.length > 0 ? "3. 客户精准匹配：针对提供的每一位客户，结合市场周报中的原料价格和产品趋势，给出具体的采购/生产策略和潜在机会。" : ""}

      必须返回严格的 JSON 格式数据。
    `;

    const response = await ai.models.generateContent({
      model,
      contents: { parts: [...fileParts, { text: prompt }] },
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
            customerStrategies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  strategy: { type: Type.STRING },
                  opportunity: { type: Type.STRING }
                }
              }
            }
          },
          required: ["title", "summary", "keyInsights", "recommendations", "competitorAnalysis", "trends"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  }
}

export const geminiService = new GeminiService();
