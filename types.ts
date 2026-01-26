
export interface MarketFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadDate: number;
  content?: string; // Base64 数据，供 Gemini API 使用
  previewUrl?: string; // 图片的 DataURL
  blobUrl?: string; // PDF 等文件的 session Blob URL
  previewType: 'image' | 'pdf' | 'text' | 'unsupported';
}

export interface AnalysisResult {
  title: string;
  summary: string;
  keyInsights: string[];
  recommendations: string[];
  competitorAnalysis: string;
  trends: string[];
}

export type SortField = 'name' | 'size' | 'uploadDate';
export type SortOrder = 'asc' | 'desc';
