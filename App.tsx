
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
  ExternalLink
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

  useEffect(() => {
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
      } else if (isDoc || isSheet || isSlide) {
        // Office docs are read as data URL so they can be sent to Gemini
        previewType = 'unsupported'; 
        content = await readFileAsDataURL(file);
      } else {
        // Generic binary fallback
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

  const deleteFiles = (ids: string[]) => {
    setFiles(prev => {
      prev.forEach(f => { if (ids.includes(f.id) && f.blobUrl) URL.revokeObjectURL(f.blobUrl); });
      return prev.filter(f => !ids.includes(f.id));
    });
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredFiles.length && filteredFiles.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFiles.map(f => f.id)));
    }
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
    } catch (error) {
      console.error(error);
      alert('分析请求失败，请检查 API 配置或网络连接');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!analysisResult) return;

    const dateStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    const mdContent = `
# ${analysisResult.title}

## 分析摘要
${analysisResult.summary}

## 核心洞察
${analysisResult.keyInsights.map(insight => `- ${insight}`).join('\n')}

## 战略建议
${analysisResult.recommendations.map(rec => `- ${rec}`).join('\n')}

## 竞品动态
${analysisResult.competitorAnalysis}

## 未来趋势
${analysisResult.trends.map(trend => `- ${trend}`).join('\n')}

---
*报告生成日期: ${new Date().toLocaleString('zh-CN')}*
    `.trim();

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `市场分析报告_${dateStr}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: MarketFile) => {
    const type = file.type;
    if (type.startsWith('image/')) return <ImageIcon size={18} />;
    if (type === 'application/pdf') return <FileText size={18} />;
    if (type.includes('word') || type.includes('msword')) return <FileText size={18} className="text-blue-500" />;
    if (type.includes('excel') || type.includes('spreadsheet')) return <FileSpreadsheet size={18} className="text-green-600" />;
    if (type.includes('powerpoint') || type.includes('presentation')) return <Presentation size={18} className="text-orange-500" />;
    return <File size={18} />;
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <PieChart size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">智能市场分析助手</h1>
          </div>
          <div className="flex items-center space-x-4">
             <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors shadow-sm">
              <Plus size={20} />
              <span className="font-medium">上传报告</span>
              <input type="file" multiple className="hidden" onChange={handleFileUpload} accept=".txt,.md,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*" />
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard label="已上传报告" value={files.length} icon={<FileText size={24} />} />
          <StatsCard label="已选分析项" value={selectedIds.size} icon={<CheckSquare size={24} />} />
          <StatsCard label="存储总量" value={formatSize(files.reduce((acc, f) => acc + f.size, 0))} icon={<Download size={24} />} />
        </div>

        {/* Search & Sorting Controls */}
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
            <select 
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={sortField}
              onChange={e => setSortField(e.target.value as SortField)}
            >
              <option value="uploadDate">日期</option>
              <option value="name">名称</option>
              <option value="size">大小</option>
            </select>
            <button 
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 font-medium text-sm"
            >
              {sortOrder === 'asc' ? '正序' : '倒序'}
            </button>
            {selectedIds.size > 0 && (
              <button 
                onClick={() => deleteFiles(Array.from(selectedIds))}
                className="flex items-center space-x-1 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors font-medium"
              >
                <Trash2 size={18} />
                <span>删除</span>
              </button>
            )}
          </div>
        </div>

        {/* Files View */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-4 w-10">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600 transition-colors">
                      {selectedIds.size === filteredFiles.length && filteredFiles.length > 0 ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                    </button>
                  </th>
                  <th className="p-4 text-sm font-semibold text-gray-600">文件名</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">类型</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">大小</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">日期</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredFiles.map(file => (
                  <tr key={file.id} className={`hover:bg-blue-50/30 transition-colors ${selectedIds.has(file.id) ? 'bg-blue-50/50' : ''}`}>
                    <td className="p-4">
                      <button onClick={() => toggleSelect(file.id)} className="text-gray-400 hover:text-blue-600 transition-colors">
                        {selectedIds.has(file.id) ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setPreviewFile(file)}>
                        <div className="p-2 bg-gray-100 rounded-lg text-gray-500">
                          {getFileIcon(file)}
                        </div>
                        <span className="font-medium text-gray-700 truncate max-w-xs">{file.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-500 capitalize">{file.type.split('/')[1] || 'Unknown'}</td>
                    <td className="p-4 text-sm text-gray-500">{formatSize(file.size)}</td>
                    <td className="p-4 text-sm text-gray-500">{new Date(file.uploadDate).toLocaleDateString()}</td>
                    <td className="p-4">
                      <button onClick={() => setPreviewFile(file)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                        <FileSearch size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredFiles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-gray-400">
                      <div className="flex flex-col items-center">
                        <FileWarning size={48} strokeWidth={1.5} className="mb-4" />
                        <p>暂无相关报告</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Primary Action */}
        <div className="flex justify-center mb-12">
          <button
            onClick={handleAnalysis}
            disabled={isAnalyzing || selectedIds.size === 0}
            className={`px-8 py-4 rounded-2xl flex items-center space-x-3 font-bold text-lg shadow-lg transition-all ${
              isAnalyzing || selectedIds.size === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 active:scale-95'
            }`}
          >
            {isAnalyzing ? <Loader2 className="animate-spin" size={24} /> : <FileSearch size={24} />}
            <span>{isAnalyzing ? '分析中...' : '生成 AI 市场分析'}</span>
          </button>
        </div>

        {/* AI Result View */}
        {analysisResult && (
          <div id="analysis-view" className="bg-white rounded-3xl border border-blue-100 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center space-x-3 mb-2 opacity-80 uppercase tracking-widest text-xs font-bold">
                  <PieChart size={16} />
                  <span>AI Market Analysis Report</span>
                </div>
                <h2 className="text-3xl font-bold">{analysisResult.title}</h2>
              </div>
              <button
                onClick={handleExportMarkdown}
                className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-2xl transition-all font-bold backdrop-blur-md"
              >
                <FileDown size={22} />
                <span>导出报告 (Markdown)</span>
              </button>
            </div>
            
            <div className="p-8 space-y-10">
              <section>
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                  <span>分析摘要</span>
                </h3>
                <p className="text-gray-600 leading-relaxed text-lg">{analysisResult.summary}</p>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <section>
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                    <span className="w-1 h-6 bg-indigo-600 rounded-full"></span>
                    <span>核心洞察</span>
                  </h3>
                  <ul className="space-y-3">
                    {analysisResult.keyInsights.map((insight, i) => (
                      <li key={i} className="flex items-start space-x-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                        <div className="mt-1.5 w-2 h-2 rounded-full bg-indigo-600 shrink-0"></div>
                        <span className="text-gray-700 font-medium">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                    <span className="w-1 h-6 bg-emerald-600 rounded-full"></span>
                    <span>战略建议</span>
                  </h3>
                  <ul className="space-y-3">
                    {analysisResult.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start space-x-3 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                        <CheckSquare className="mt-1 text-emerald-600 shrink-0" size={18} />
                        <span className="text-gray-700 font-medium">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <section>
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <span className="w-1 h-6 bg-amber-600 rounded-full"></span>
                  <span>竞品动态</span>
                </h3>
                <div className="bg-amber-50/30 p-6 rounded-2xl border border-amber-100 text-gray-700 leading-relaxed">
                  {analysisResult.competitorAnalysis}
                </div>
              </section>

              <section>
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <span className="w-1 h-6 bg-purple-600 rounded-full"></span>
                  <span>未来趋势</span>
                </h3>
                <div className="flex flex-wrap gap-3">
                  {analysisResult.trends.map((trend, i) => (
                    <span key={i} className="px-4 py-2 bg-purple-50 text-purple-700 rounded-full border border-purple-100 font-semibold text-sm">
                      # {trend}
                    </span>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Modal Preview */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setPreviewFile(null)}></div>
          <div className="relative bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  {getFileIcon(previewFile)}
                </div>
                <h3 className="font-bold text-gray-800 truncate max-w-md">{previewFile.name}</h3>
              </div>
              <button onClick={() => setPreviewFile(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} className="text-gray-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              {previewFile.previewType === 'image' && (
                <div className="flex justify-center">
                  <img src={previewFile.previewUrl} alt={previewFile.name} className="max-w-full h-auto rounded-xl shadow-lg" />
                </div>
              )}
              {previewFile.previewType === 'pdf' && (
                <iframe src={previewFile.blobUrl} className="w-full h-[70vh] rounded-xl border-0 shadow-lg" title="PDF Preview" />
              )}
              {previewFile.previewType === 'text' && (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-700">
                  {previewFile.content}
                </div>
              )}
              {previewFile.previewType === 'unsupported' && (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                  <div className="p-6 bg-gray-50 rounded-full mb-6">
                    {getFileIcon(previewFile)}
                  </div>
                  <h4 className="text-xl font-bold text-gray-800 mb-2">暂不支持直接预览</h4>
                  <p className="text-gray-500 mb-8 max-w-xs text-center">
                    该文件格式（{previewFile.type.split('/')[1] || '未知'}）目前无法在浏览器中直接展示，但您可以发送给 AI 进行深度分析。
                  </p>
                  <a 
                    href={previewFile.content} 
                    download={previewFile.name}
                    className="flex items-center space-x-2 bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-colors"
                  >
                    <Download size={20} />
                    <span>下载原始文件</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
