
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

export interface GeopoliticalEvent {
  event: string;
  impact: string;
  severity: 'low' | 'medium' | 'high';
}

export interface AnalysisResult {
  title: string;
  summary: string;
  influencingFactors: {
    geopolitics: string;
    refinerySupply: string;
    inventoryLevels: string;
  };
  geopoliticalAnalysis?: GeopoliticalEvent[];
  trendPredictions: {
    naphtha: string;
    diesel: string;
    gasOil: string;
  };
  priceComparisonTable: {
    product: string;
    currentPrice: string;
    previousPrice: string;
    change: string;
  }[];
  salesRecommendations: string[];
}

export type SortField = 'name' | 'size' | 'uploadDate';
export type SortOrder = 'asc' | 'desc';
export type AppView = 'reports' | 'analysis' | 'geopolitics';
