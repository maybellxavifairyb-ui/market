
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  FileText, 
  Image as ImageIcon, 
  File, 
  Download, 
  FileSearch,
  CheckSquare,
  Square,
  Loader2,
  X,
  FileWarning,
  PieChart,
  FileDown,
  FileSpreadsheet,
  Presentation,
  Key
} from 'lucide-react';
import { MarketFile, SortField, SortOrder, AnalysisResult } from './types';
import { geminiService } from './services/geminiService';

const StatsCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm flex items-center space-x-4 transition-all hover:shadow-md hover:-translate-y-1">
    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [files, setFiles] = useState<MarketFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('uploadDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [previewFile, setPreviewFile] = useState<MarketFile | null>(null);
  const [hasKey, setHasKey] = useState<boolean>(true);

  useEffect(() => {
    // 检查 API KEY 是否可用
    if (!process.env.API_KEY) {
      setHasKey(false);
    }
    
    const saved = localStorage.getItem('market_reports_files_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFiles(parsed.map((f: any) => ({ ...f, blobUrl: undefined })));
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    const toSave = files.map(({ blobUrl, ...rest }) => rest);
    localStorage.setItem('market_reports_files_v2', JSON.stringify(toSave));
  }, [files]);

  const filteredFiles = useMemo(() => {
    return files
      .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        const factor = sortOrder === 'asc' ? 1 : -1;
        if (sortField === 'name') return a.name.localeCompare(b.name) * factor;
        if (sortField === 'size') return (a.size - b.size) * factor;
        return (a.uploadDate - b.uploadDate) * factor;
      });
  }, [files, searchQuery, sortField, sortOrder]);

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8'); 
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    const newFiles: MarketFile[] = [];
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      let previewType: MarketFile['previewType'] = 'unsupported';
      let content = '';
      let previewUrl = '';
      let blobUrl = '';

      const isText = file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md');
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      const isDoc = file.type === 'application/msword' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const isSheet = file.type === 'application/vnd.ms-excel' || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const isSlide = file.type === 'application/vnd.ms-powerpoint' || file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

      if (isImage) {
        previewType = 'image';
        content = await readFileAsDataURL(file);
        previewUrl = content;
      } else if (isPdf) {
        previewType = 'pdf';
        content = await readFileAsDataURL(file);
        blobUrl = URL.createObjectURL(file);
      } else if (isText) {
        previewType = 'text';
        content = await readFileAsText(file);
      } else {
        previewType = 'unsupported'; 
        content = await readFileAsDataURL(file);
      }

      newFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        uploadDate: Date.now(),
        content,
        previewUrl,
        blobUrl,
        previewType,
      });
    }

    setFiles(prev => [...prev, ...newFiles]);
    event.target.value = '';
  };

  const handleAnalysis = async () => {
    const filesToAnalyze = files.filter(f => selectedIds.has(f.id));
    if (filesToAnalyze.length === 0) return alert('请先勾选需要分析的报告');

    setIsAnalyzing(true);
    try {
      const result = await geminiService.analyzeMarketReports(filesToAnalyze);
      setAnalysisResult(result);
      setTimeout(() => {
        document.getElementById('analysis-view')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error: any) {
      console.error(error);
      const msg = error.message?.includes('API Key') 
        ? 'API Key 缺失或无效，请在部署环境中设置 process.env.API_KEY'
        : '分析失败，请稍后重试';
      alert(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!analysisResult) return;
    const dateStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    const mdContent = `# ${analysisResult.title}\n\n## 分析摘要\n${analysisResult.summary}\n\n## 核心洞察\n${analysisResult.keyInsights.map(i => `- ${i}`).join('\n')}\n\n## 战略建议\n${analysisResult.recommendations.map(r => `- ${r}`).join('\n')}\n\n## 竞品动态\n${analysisResult.competitorAnalysis}\n\n## 未来趋势\n${analysisResult.trends.map(t => `- ${t}`).join('\n')}\n\n---\n*报告生成日期: ${new Date().toLocaleString('zh-CN')}*`;
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `市场分析报告_${dateStr}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getFileIcon = (file: MarketFile) => {
    const type = file.type;
    if (type.startsWith('image/')) return <ImageIcon size={18} />;
    if (type === 'application/pdf') return <FileText size={18} />;
    if (type.includes('word')) return <FileText size={18} className="text-blue-500" />;
    if (type.includes('excel') || type.includes('spreadsheet')) return <FileSpreadsheet size={18} className="text-green-600" />;
    if (type.includes('powerpoint')) return <Presentation size={18} className="text-orange-500" />;
    return <File size={18} />;
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <PieChart size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">智能市场分析助手</h1>
          </div>
          <div className="flex items-center space-x-4">
             {!hasKey && (
               <div className="text-xs text-red-500 font-medium bg-red-50 px-3 py-1 rounded-full flex items-center gap-1">
                 <Key size={12} /> API Key 待配置
               </div>
             )}
             <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors shadow-sm">
              <Plus size={20} />
              <span className="font-medium">上传报告</span>
              <input type="file" multiple className="hidden" onChange={handleFileUpload} accept=".txt,.md,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*" />
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard label="已上传报告" value={files.length} icon={<FileText size={24} />} />
          <StatsCard label="已选分析项" value={selectedIds.size} icon={<CheckSquare size={24} />} />
          <StatsCard label="文件总计" value={(files.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2) + ' MB'} icon={<Download size={24} />} />
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="搜索报告..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-2 hover:bg-gray-100 rounded-lg text-sm text-gray-600"
            >
              排序: {sortOrder === 'asc' ? '正序' : '倒序'}
            </button>
            {selectedIds.size > 0 && (
              <button 
                onClick={() => {
                  setFiles(prev => prev.filter(f => !selectedIds.has(f.id)));
                  setSelectedIds(new Set());
                }}
                className="flex items-center space-x-1 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors font-medium"
              >
                <Trash2 size={18} />
                <span>删除</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 w-10">
                  <button onClick={() => {
                    if (selectedIds.size === filteredFiles.length) setSelectedIds(new Set());
                    else setSelectedIds(new Set(filteredFiles.map(f => f.id)));
                  }}>
                    {selectedIds.size === filteredFiles.length && filteredFiles.length > 0 ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                  </button>
                </th>
                <th className="p-4 text-sm font-semibold text-gray-600">文件名</th>
                <th className="p-4 text-sm font-semibold text-gray-600">日期</th>
                <th className="p-4 text-sm font-semibold text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredFiles.map(file => (
                <tr key={file.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="p-4">
                    <button onClick={() => {
                      const next = new Set(selectedIds);
                      if (next.has(file.id)) next.delete(file.id);
                      else next.add(file.id);
                      setSelectedIds(next);
                    }}>
                      {selectedIds.has(file.id) ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setPreviewFile(file)}>
                      <div className="p-2 bg-gray-100 rounded-lg text-gray-500">{getFileIcon(file)}</div>
                      <span className="font-medium text-gray-700 truncate">{file.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-500">{new Date(file.uploadDate).toLocaleDateString()}</td>
                  <td className="p-4">
                    <button onClick={() => setPreviewFile(file)} className="p-2 text-gray-400 hover:text-blue-600"><FileSearch size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-center mb-12">
          <button
            onClick={handleAnalysis}
            disabled={isAnalyzing || selectedIds.size === 0}
            className={`px-8 py-4 rounded-2xl flex items-center space-x-3 font-bold text-lg shadow-lg transition-all ${
              isAnalyzing || selectedIds.size === 0 ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isAnalyzing ? <Loader2 className="animate-spin" size={24} /> : <FileSearch size={24} />}
            <span>生成 AI 市场分析</span>
          </button>
        </div>

        {analysisResult && (
          <div id="analysis-view" className="bg-white rounded-3xl border border-blue-100 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white flex justify-between items-center">
              <h2 className="text-2xl font-bold">{analysisResult.title}</h2>
              <button onClick={handleExportMarkdown} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl flex items-center gap-2 backdrop-blur-sm"><FileDown size={18}/>导出报告</button>
            </div>
            <div className="p-8 space-y-8">
              <section><h3 className="font-bold mb-2">摘要</h3><p className="text-gray-600">{analysisResult.summary}</p></section>
              <div className="grid md:grid-cols-2 gap-8">
                <section><h3 className="font-bold mb-2">洞察</h3><ul className="list-disc list-inside text-gray-600">{analysisResult.keyInsights.map((i,idx)=><li key={idx}>{i}</li>)}</ul></section>
                <section><h3 className="font-bold mb-2">建议</h3><ul className="list-disc list-inside text-gray-600">{analysisResult.recommendations.map((r,idx)=><li key={idx}>{r}</li>)}</ul></section>
              </div>
            </div>
          </div>
        )}
      </main>

      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setPreviewFile(null)}></div>
          <div className="relative bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <span className="font-bold truncate">{previewFile.name}</span>
              <button onClick={() => setPreviewFile(null)}><X size={24} className="text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              {previewFile.previewType === 'image' && <img src={previewFile.previewUrl} className="mx-auto rounded-lg shadow" />}
              {previewFile.previewType === 'pdf' && <iframe src={previewFile.blobUrl} className="w-full h-[70vh] border-0" />}
              {previewFile.previewType === 'text' && <div className="bg-white p-6 rounded shadow whitespace-pre-wrap">{previewFile.content}</div>}
              {previewFile.previewType === 'unsupported' && <div className="py-20 text-center"><p className="mb-4">暂不支持预览该格式</p><a href={previewFile.content} download={previewFile.name} className="bg-gray-900 text-white px-6 py-2 rounded-lg inline-flex items-center gap-2"><Download size={18}/>下载查看</a></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
