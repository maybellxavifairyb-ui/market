
import { GoogleGenAI, Type } from "@google/genai";
import { MarketFile, AnalysisResult } from "../types";

export class GeminiService {
  async analyzeMarketReports(files: MarketFile[]): Promise<AnalysisResult> {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key 未配置");

    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-3.1-pro-preview';
    
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

    const prompt = `
      你是一名资深的能源市场分析专家。请针对提供的能源市场报告进行深度解析。
      
      任务要求：
      1. 核心影响因素提取：自动提取地缘政治动态、炼厂供应情况及库存水平。
      2. 地缘政治深度分析：从报告中自动提取关键的地缘政治事件，并总结其对能源市场的具体影响及严重程度。
      3. 趋势预测：专门针对石脑油 (Naphtha)、柴油 (Diesel)、蜡油/气油 (Gas Oil/Wax Oil) 提供市场走势预判。
      4. 价格表提取：从非结构化文本中自动生成产品价格对比表（包含产品名、当前价格、上期价格、涨跌幅）。
      5. 销售建议：基于当前市场现状提供专业的销售操作策略。

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
            influencingFactors: {
              type: Type.OBJECT,
              properties: {
                geopolitics: { type: Type.STRING, description: "地缘政治动态概括" },
                refinerySupply: { type: Type.STRING, description: "炼厂供应情况" },
                inventoryLevels: { type: Type.STRING, description: "库存水平" }
              },
              required: ["geopolitics", "refinerySupply", "inventoryLevels"]
            },
            geopoliticalAnalysis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  event: { type: Type.STRING, description: "地缘政治事件名称" },
                  impact: { type: Type.STRING, description: "对市场的影响总结" },
                  severity: { type: Type.STRING, enum: ["low", "medium", "high"], description: "影响严重程度" }
                },
                required: ["event", "impact", "severity"]
              }
            },
            trendPredictions: {
              type: Type.OBJECT,
              properties: {
                naphtha: { type: Type.STRING, description: "石脑油走势预判" },
                diesel: { type: Type.STRING, description: "柴油走势预判" },
                gasOil: { type: Type.STRING, description: "蜡油/气油走势预判" }
              },
              required: ["naphtha", "diesel", "gasOil"]
            },
            priceComparisonTable: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  product: { type: Type.STRING },
                  currentPrice: { type: Type.STRING },
                  previousPrice: { type: Type.STRING },
                  change: { type: Type.STRING }
                },
                required: ["product", "currentPrice", "previousPrice", "change"]
              }
            },
            salesRecommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "summary", "influencingFactors", "geopoliticalAnalysis", "trendPredictions", "priceComparisonTable", "salesRecommendations"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  }
}

export const geminiService = new GeminiService();
