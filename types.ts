
export interface MarketFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadDate: number;
  content?: string;
  previewUrl?: string;
  blobUrl?: string;
  previewType: 'image' | 'pdf' | 'text' | 'unsupported';
}

export interface Customer {
  id: string;
  name: string;
  equipment: string;    // 装置
  capacity: string;     // 产能
  rawMaterials: string; // 需求原料
  products: string;     // 产成品
  grossMargin: number;  // 毛利 (%)
}

export interface AnalysisResult {
  title: string;
  summary: string;
  keyInsights: string[];
  recommendations: string[];
  competitorAnalysis: string;
  trends: string[];
  customerStrategies?: { name: string; strategy: string; opportunity: string }[];
}

export type SortField = 'name' | 'size' | 'uploadDate';
export type SortOrder = 'asc' | 'desc';
export type AppView = 'reports' | 'customers' | 'analysis';
