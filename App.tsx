
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Search, Trash2, FileText, Image as ImageIcon, File, Download, 
  FileSearch, CheckSquare, Square, Loader2, X, FileWarning, PieChart, 
  FileDown, FileSpreadsheet, Presentation, Key, LayoutDashboard, 
  BarChart4, Save, Edit3, TrendingUp, AlertCircle, Activity, Target, 
  Zap, ChevronRight, Filter, Globe, Database, Eye, Clock, HardDrive,
  Braces, BookOpen
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { MarketFile, AnalysisResult, AppView } from './types';
import { geminiService } from './services/geminiService';

// --- 工具函数：格式化文件大小 ---
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// --- JSON 语法高亮组件 ---
const JsonHighlighter: React.FC<{ content: string }> = ({ content }) => {
  try {
    const obj = JSON.parse(content);
    const jsonStr = JSON.stringify(obj, null, 2);
    
    // 简单的正则表达式语法高亮
    const highlighted = jsonStr.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'text-slate-700'; // 默认颜色
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'text-blue-600 font-bold'; // Key
          } else {
            cls = 'text-emerald-600'; // String
          }
        } else if (/true|false/.test(match)) {
          cls = 'text-amber-600'; // Boolean
        } else if (/null/.test(match)) {
          cls = 'text-slate-400'; // Null
        } else {
          cls = 'text-orange-600'; // Number
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );

    return (
      <pre 
        className="font-mono text-sm leading-relaxed p-6 bg-slate-900 rounded-2xl text-slate-300 overflow-x-auto selection:bg-blue-500/30"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    );
  } catch (e) {
    return <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700">{content}</pre>;
  }
};

// --- 文本内容智能预览组件 ---
const SmartTextPreview: React.FC<{ file: MarketFile }> = ({ file }) => {
  const isJson = file.name.endsWith('.json') || (file.content?.trim().startsWith('{') || file.content?.trim().startsWith('['));
  const isMarkdown = file.name.endsWith('.md');

  return (
    <div className="bg-white p-8 md:p-12 rounded-[32px] shadow-sm border border-slate-100 max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      {isJson ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest mb-2">
            <Braces size={14} /> 检测到 JSON 格式
          </div>
          <JsonHighlighter content={file.content || ''} />
        </div>
      ) : isMarkdown ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest mb-2">
            <BookOpen size={14} /> Markdown 文档预览
          </div>
          <article className="prose prose-slate prose-blue max-w-none selection:bg-blue-100">
            <ReactMarkdown>{file.content || ''}</ReactMarkdown>
          </article>
        </div>
      ) : (
        <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700 selection:bg-blue-100">
          {file.content}
        </div>
      )}
    </div>
  );
};

// --- 可视化组件：活跃度迷你线图 ---
const Sparkline: React.FC = () => (
  <svg viewBox="0 0 100 30" className="w-24 h-8 stroke-blue-500 fill-none stroke-[2]">
    <path d="M0,25 L10,20 L20,28 L30,15 L40,18 L50,5 L60,22 L70,10 L80,15 L90,5 L100,12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>('reports');
  const [files, setFiles] = useState<MarketFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [previewFile, setPreviewFile] = useState<MarketFile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    const savedFiles = localStorage.getItem('market_files_v3');
    if (savedFiles) setFiles(JSON.parse(savedFiles).map((f: any) => ({ ...f, blobUrl: undefined })));
  }, []);

  useEffect(() => {
    localStorage.setItem('market_files_v3', JSON.stringify(files.map(({blobUrl, ...rest}) => rest)));
  }, [files]);

  useEffect(() => { setSearchQuery(''); }, [activeView]);

  const filteredFiles = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return files.filter(f => f.name.toLowerCase().includes(q));
  }, [files, searchQuery]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files;
    if (!uploaded) return;
    const newFiles: MarketFile[] = [];
    for (let i = 0; i < uploaded.length; i++) {
      const f = uploaded[i];
      const isImage = f.type.startsWith('image/');
      const isPdf = f.type === 'application/pdf';
      const isText = f.name.endsWith('.txt') || f.name.endsWith('.md') || f.name.endsWith('.json');
      
      let content = '';
      const reader = new FileReader();
      content = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        if (isText) reader.readAsText(f);
        else reader.readAsDataURL(f);
      });

      newFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        name: f.name, size: f.size, type: f.type, uploadDate: Date.now(),
        content, previewType: isImage ? 'image' : isPdf ? 'pdf' : isText ? 'text' : 'unsupported',
        blobUrl: isPdf ? URL.createObjectURL(f) : undefined,
        previewUrl: isImage ? content : undefined
      });
    }
    setFiles(prev => [...prev, ...newFiles]);
  };

  const runAnalysis = async () => {
    const selFiles = files.filter(f => selectedFileIds.has(f.id));
    if (selFiles.length === 0) return alert('请至少选择一份周报进行分析');
    setIsAnalyzing(true);
    try {
      const res = await geminiService.analyzeMarketReports(selFiles);
      setAnalysisResult(res);
      setActiveView('analysis');
      setTimeout(() => document.getElementById('res-top')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e: any) { alert('分析失败: ' + e.message); }
    finally { setIsAnalyzing(false); }
  };

  const downloadAnalysisReport = async (viewId: string) => {
    if (!analysisResult) return;

    const element = document.getElementById(viewId);
    if (!element) return;

    setIsAnalyzing(true); // Reuse loading state for export
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${analysisResult.title}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF 导出失败:', error);
      alert('PDF 导出失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 根据预览类型获取对应的图标
  const getFileIcon = (type: MarketFile['previewType']) => {
    switch (type) {
      case 'image': return <ImageIcon size={18} />;
      case 'pdf': return <FileText size={18} />;
      case 'text': return <File size={18} />;
      case 'unsupported': return <FileWarning size={18} />;
      default: return <FileSearch size={18} />;
    }
  };

  // 根据预览类型获取图标背景颜色
  const getIconColorClass = (type: MarketFile['previewType'], isSelected: boolean) => {
    if (isSelected) return 'bg-blue-600 text-white shadow-blue-500/20';
    switch (type) {
      case 'image': return 'bg-blue-100 text-blue-600';
      case 'pdf': return 'bg-rose-100 text-rose-600';
      case 'text': return 'bg-emerald-100 text-emerald-600';
      case 'unsupported': return 'bg-amber-100 text-amber-600';
      default: return 'bg-slate-100 text-slate-400';
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      {/* --- 侧边栏导航 --- */}
      <aside className="w-72 bg-slate-950 text-slate-400 flex flex-col fixed h-full z-40 border-r border-slate-800">
        <div className="p-8 flex items-center gap-3 text-white">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
            <Globe className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="font-black text-xl tracking-tighter block leading-none">市场智谱</span>
            <span className="text-[10px] text-blue-500 font-bold tracking-[0.2em] uppercase">智能情报系统</span>
          </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-2">
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4 px-2">主菜单</div>
          {[
            { id: 'reports', label: '周报管理', icon: LayoutDashboard, desc: '文档存储与存档' },
            { id: 'analysis', label: 'AI 分析终端', icon: Zap, desc: '能源市场深度解析' },
            { id: 'geopolitics', label: '地缘政治分析', icon: Globe, desc: '关键事件与市场影响' }
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveView(item.id as AppView)}
              className={`w-full group flex items-start gap-4 px-4 py-4 rounded-2xl transition-all duration-300 ${
                activeView === item.id 
                ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20 translate-x-1' 
                : 'hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <item.icon size={22} className={activeView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'} />
              <div className="text-left">
                <div className="font-bold text-sm">{item.label}</div>
                <div className={`text-[10px] ${activeView === item.id ? 'text-blue-200' : 'text-slate-600'}`}>{item.desc}</div>
              </div>
            </button>
          ))}
        </nav>

        <div className="p-6">
          <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-slate-500">存储负载</span>
              <span className="text-xs font-black text-blue-500">24%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 w-1/4"></div>
            </div>
          </div>
        </div>
      </aside>

      {/* --- 主内容区域 --- */}
      <main className="flex-1 ml-72 p-10">
        
        {/* 视图 1: 周报管理 */}
        {activeView === 'reports' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
              <div className="lg:col-span-2 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">周报管理中心</h2>
                  <p className="text-slate-500 mt-1 font-medium">存档市场情报与行业报告</p>
                  <div className="flex gap-4 mt-6">
                    <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                      <div className="text-[10px] font-black text-blue-400 uppercase">总周报数</div>
                      <div className="text-xl font-black text-blue-700">{files.length}</div>
                    </div>
                    <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                      <div className="text-[10px] font-black text-slate-400 uppercase">文件总体积</div>
                      <div className="text-xl font-black text-slate-700">{formatFileSize(files.reduce((acc, f) => acc + f.size, 0))}</div>
                    </div>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <Sparkline />
                  <div className="text-[10px] font-bold text-slate-400 mt-2 text-center uppercase tracking-tighter">活跃度趋势</div>
                </div>
              </div>
              
              <div className="bg-blue-600 p-8 rounded-[32px] text-white flex flex-col justify-between shadow-xl shadow-blue-600/20">
                <div className="flex justify-between items-start">
                  <Activity size={32} className="opacity-50" />
                  <label className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl cursor-pointer transition-all shadow-inner">
                    <Plus size={24} />
                    <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
                <div>
                  <div className="text-4xl font-black mb-1">导入文档</div>
                  <div className="text-sm font-bold opacity-70 italic">支持 PDF, 图片, JSON, MD 预览</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="按文件名搜索或过滤..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 pr-6 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none w-80 text-sm font-medium transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  <button className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Filter size={20}/></button>
                  <button className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Database size={20}/></button>
                </div>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-slate-400 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="p-6 w-12 text-center">选择</th>
                    <th className="p-6">文档概览</th>
                    <th className="p-6">存储详情</th>
                    <th className="p-6">上传周期</th>
                    <th className="p-6 text-right">操作交互</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredFiles.map(f => {
                    const isSelected = selectedFileIds.has(f.id);
                    return (
                      <tr key={f.id} className={`group hover:bg-slate-50/80 transition-all ${isSelected ? 'bg-blue-50/30' : ''}`}>
                        <td className="p-6 text-center">
                          <button onClick={() => {
                            const next = new Set(selectedFileIds);
                            next.has(f.id) ? next.delete(f.id) : next.add(f.id);
                            setSelectedFileIds(next);
                          }}>
                            {isSelected ? <CheckSquare className="text-blue-600 mx-auto" /> : <Square className="text-slate-200 group-hover:text-slate-400 mx-auto transition-colors" />}
                          </button>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <div className={`p-3.5 rounded-2xl transition-all shadow-sm ${getIconColorClass(f.previewType, isSelected)}`}>
                              {getFileIcon(f.previewType)}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-slate-700 truncate max-w-[200px] leading-tight">{f.name}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{f.type.split('/')[1] || 'BINARY'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-2 text-slate-500">
                            <HardDrive size={14} className="text-slate-300" />
                            <span className="text-xs font-bold">{formatFileSize(f.size)}</span>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Clock size={14} className="text-slate-300" />
                            <span className="text-xs font-bold">{new Date(f.uploadDate).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="p-6 text-right space-x-2">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <button 
                              onClick={() => setPreviewFile(f)} 
                              title="立即预览内容"
                              className="p-3 bg-white hover:bg-blue-600 hover:text-white text-blue-600 rounded-xl shadow-sm border border-slate-100 transition-all active:scale-90"
                            >
                              <Eye size={18}/>
                            </button>
                            <button 
                              onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))} 
                              title="移至回收站"
                              className="p-3 bg-white hover:bg-red-600 hover:text-white text-red-600 rounded-xl shadow-sm border border-slate-100 transition-all active:scale-90"
                            >
                              <Trash2 size={18}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredFiles.length === 0 && (
                <div className="p-32 text-center">
                  <div className="inline-block p-10 bg-slate-50 rounded-[40px] mb-6 text-slate-200 shadow-inner">
                    <Database size={64}/>
                  </div>
                  <div className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm">仓库空空如也</div>
                  <p className="text-slate-300 text-xs mt-2 font-medium">请点击右上角上传第一份市场报告</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 视图 3: 智能分析 */}
        {activeView === 'analysis' && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            {!analysisResult ? (
              <div className="max-w-4xl mx-auto py-20 text-center space-y-10">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 animate-pulse"></div>
                  <div className="relative bg-white p-10 rounded-[48px] border border-slate-200 shadow-2xl">
                    <Zap size={64} className="text-blue-600 mx-auto" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h2 className="text-5xl font-black text-slate-900 tracking-tighter">能源市场 AI 分析终端</h2>
                  <p className="text-slate-500 text-xl font-medium max-w-2xl mx-auto">
                    利用 Gemini 3.1 Pro 深度解析 <span className="text-blue-600 font-black">{selectedFileIds.size}</span> 份能源报告。
                  </p>
                </div>

                <div className="flex flex-col items-center gap-6 mt-12">
                  <button 
                    onClick={runAnalysis}
                    disabled={isAnalyzing || selectedFileIds.size === 0}
                    className={`group relative px-12 py-6 rounded-[32px] font-black text-2xl flex items-center gap-4 transition-all shadow-2xl ${
                      isAnalyzing || selectedFileIds.size === 0 
                      ? 'bg-slate-100 text-slate-300' 
                      : 'bg-slate-900 text-white hover:bg-blue-600 active:scale-95'
                    }`}
                  >
                    {isAnalyzing && <Loader2 className="animate-spin" size={28} />}
                    {!isAnalyzing && <Target size={28} className="group-hover:rotate-45 transition-transform" />}
                    <span>{isAnalyzing ? '正在解析能源逻辑...' : '启动深度市场分析'}</span>
                  </button>
                  
                  {selectedFileIds.size === 0 && (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-full text-xs font-bold border border-amber-100">
                      <AlertCircle size={14} /> 需要至少选择一份报告作为分析底稿
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div id="res-top" className="max-w-6xl mx-auto space-y-10 pb-20">
                <div className="flex justify-between items-center">
                  <button 
                    onClick={() => setAnalysisResult(null)} 
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-black text-xs uppercase tracking-widest transition-all"
                  >
                    <ChevronRight size={18} className="rotate-180" /> 重新选择报告
                  </button>
                  <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-lg shadow-blue-500/30">
                    Gemini 3.1 Pro 强力驱动
                  </div>
                </div>

                <div id="full-report-content" className="bg-white rounded-[48px] border border-slate-200 shadow-2xl overflow-hidden">
                  <div className="bg-slate-950 p-16 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[120px] -mr-48 -mt-48"></div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 text-blue-500 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
                        <Activity size={14}/> 能源市场深度解析报告
                      </div>
                      <h1 className="text-6xl font-black mb-6 tracking-tight leading-none max-w-4xl">{analysisResult.title}</h1>
                      <div className="h-1 w-24 bg-blue-600 mb-8 rounded-full"></div>
                      <p className="text-slate-400 text-xl leading-relaxed max-w-3xl font-medium italic">“{analysisResult.summary}”</p>
                    </div>
                  </div>

                  <div className="p-16 space-y-16">
                    {/* 地缘政治深度分析 */}
                    {analysisResult.geopoliticalAnalysis && analysisResult.geopoliticalAnalysis.length > 0 && (
                      <section>
                        <h4 className="text-xs font-black mb-8 flex items-center gap-3 text-slate-400 uppercase tracking-[0.3em]">
                          <Globe className="text-blue-500" size={18}/> 地缘政治深度分析
                        </h4>
                        <div className="space-y-4">
                          {analysisResult.geopoliticalAnalysis.map((item, idx) => (
                            <div key={idx} className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 flex flex-col md:flex-row gap-6 items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                                    item.severity === 'high' ? 'bg-rose-100 text-rose-600' :
                                    item.severity === 'medium' ? 'bg-amber-100 text-amber-600' :
                                    'bg-blue-100 text-blue-600'
                                  }`}>
                                    {item.severity === 'high' ? '高风险' : item.severity === 'medium' ? '中等风险' : '低风险'}
                                  </span>
                                  <h5 className="text-xl font-black text-slate-900">{item.event}</h5>
                                </div>
                                <p className="text-slate-600 font-medium leading-relaxed">{item.impact}</p>
                              </div>
                              <div className="md:w-48 shrink-0">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">风险评估</div>
                                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${
                                    item.severity === 'high' ? 'bg-rose-500 w-full' :
                                    item.severity === 'medium' ? 'bg-amber-500 w-2/3' :
                                    'bg-blue-500 w-1/3'
                                  }`}></div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* 核心影响因素 */}
                    <section>
                      <h4 className="text-xs font-black mb-8 flex items-center gap-3 text-slate-400 uppercase tracking-[0.3em]">
                        <Globe className="text-blue-500" size={18}/> 核心影响因素
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100">
                          <div className="text-[10px] font-black text-blue-500 uppercase mb-4 tracking-widest">地缘政治动态</div>
                          <p className="text-slate-700 font-bold leading-relaxed">{analysisResult.influencingFactors.geopolitics}</p>
                        </div>
                        <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100">
                          <div className="text-[10px] font-black text-emerald-500 uppercase mb-4 tracking-widest">炼厂供应情况</div>
                          <p className="text-slate-700 font-bold leading-relaxed">{analysisResult.influencingFactors.refinerySupply}</p>
                        </div>
                        <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100">
                          <div className="text-[10px] font-black text-amber-500 uppercase mb-4 tracking-widest">库存水平</div>
                          <p className="text-slate-700 font-bold leading-relaxed">{analysisResult.influencingFactors.inventoryLevels}</p>
                        </div>
                      </div>
                    </section>

                    {/* 趋势预测 */}
                    <section>
                      <h4 className="text-xs font-black mb-8 flex items-center gap-3 text-slate-400 uppercase tracking-[0.3em]">
                        <TrendingUp className="text-blue-500" size={18}/> 重点产品趋势预测
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                          <div className="flex justify-between items-center mb-6">
                            <h5 className="text-xl font-black text-slate-900">石脑油</h5>
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Zap size={16}/></div>
                          </div>
                          <p className="text-slate-600 font-medium leading-relaxed">{analysisResult.trendPredictions.naphtha}</p>
                        </div>
                        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                          <div className="flex justify-between items-center mb-6">
                            <h5 className="text-xl font-black text-slate-900">柴油</h5>
                            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><Zap size={16}/></div>
                          </div>
                          <p className="text-slate-600 font-medium leading-relaxed">{analysisResult.trendPredictions.diesel}</p>
                        </div>
                        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                          <div className="flex justify-between items-center mb-6">
                            <h5 className="text-xl font-black text-slate-900">蜡油/气油</h5>
                            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Zap size={16}/></div>
                          </div>
                          <p className="text-slate-600 font-medium leading-relaxed">{analysisResult.trendPredictions.gasOil}</p>
                        </div>
                      </div>
                    </section>

                    {/* 价格对比表 */}
                    <section>
                      <h4 className="text-xs font-black mb-8 flex items-center gap-3 text-slate-400 uppercase tracking-[0.3em]">
                        <FileSpreadsheet className="text-blue-500" size={18}/> 产品价格对比表
                      </h4>
                      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                            <tr>
                              <th className="p-6">产品名称</th>
                              <th className="p-6">当前价格</th>
                              <th className="p-6">上期价格</th>
                              <th className="p-6">涨跌幅</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {analysisResult.priceComparisonTable.map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-all">
                                <td className="p-6 font-black text-slate-700">{row.product}</td>
                                <td className="p-6 font-mono text-sm font-bold text-slate-600">{row.currentPrice}</td>
                                <td className="p-6 font-mono text-sm text-slate-400">{row.previousPrice}</td>
                                <td className={`p-6 font-bold ${row.change.includes('+') || row.change.includes('涨') ? 'text-rose-500' : row.change.includes('-') || row.change.includes('跌') ? 'text-emerald-500' : 'text-slate-400'}`}>
                                  {row.change}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    {/* 销售建议 */}
                    <section>
                      <h4 className="text-xs font-black mb-8 flex items-center gap-3 text-slate-400 uppercase tracking-[0.3em]">
                        <Target className="text-emerald-500" size={18}/> 专业销售操作建议
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {analysisResult.salesRecommendations.map((rec, idx) => (
                          <div key={idx} className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 flex items-start gap-4">
                            <div className="mt-1 bg-emerald-500 rounded-full p-1"><CheckSquare size={12} className="text-white"/></div>
                            <p className="text-emerald-900 font-bold leading-relaxed">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <div className="flex justify-center pt-8">
                      <button 
                        onClick={() => downloadAnalysisReport('full-report-content')}
                        disabled={isAnalyzing}
                        className="px-12 py-5 bg-slate-900 text-white rounded-[32px] font-black text-lg flex items-center justify-center gap-3 shadow-xl hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isAnalyzing ? <Loader2 className="animate-spin" size={24} /> : <FileDown size={24}/>}
                        导出分析报告 (PDF)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {/* 视图 4: 地缘政治分析专用模块 */}
        {activeView === 'geopolitics' && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="max-w-6xl mx-auto space-y-10">
              <div className="bg-white p-12 rounded-[48px] border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] -mr-32 -mt-32"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 text-blue-600 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
                    <Globe size={16}/> Geopolitical Intelligence
                  </div>
                  <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-6">地缘政治动态分析模块</h2>
                  <p className="text-slate-500 text-xl font-medium max-w-2xl">
                    专门提取全球范围内的关键政治事件，深度解析其对原油供应、炼厂运行及能源价格链条的连锁反应。
                  </p>
                </div>
              </div>

              {analysisResult?.geopoliticalAnalysis ? (
                <div className="space-y-8">
                  <div className="flex justify-between items-center px-4">
                    <h3 className="text-2xl font-black text-slate-900">最新提取的事件 ({analysisResult.geopoliticalAnalysis.length})</h3>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => downloadAnalysisReport('geopolitics-report-content')}
                        disabled={isAnalyzing}
                        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-900 px-6 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                      >
                        {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <FileDown size={18} />}
                        导出报告 (PDF)
                      </button>
                      <button 
                        onClick={runAnalysis}
                        disabled={isAnalyzing || selectedFileIds.size === 0}
                        className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50"
                      >
                        {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                        重新分析
                      </button>
                    </div>
                  </div>
                  
                  <div id="geopolitics-report-content" className="grid grid-cols-1 gap-6">
                    {analysisResult.geopoliticalAnalysis.map((item, idx) => (
                      <div key={idx} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 group">
                        <div className="flex flex-col md:flex-row gap-8">
                          <div className="flex-1">
                            <div className="flex items-center gap-4 mb-6">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                item.severity === 'high' ? 'bg-rose-100 text-rose-600' :
                                item.severity === 'medium' ? 'bg-amber-100 text-amber-600' :
                                'bg-blue-100 text-blue-600'
                              }`}>
                                <AlertCircle size={24} />
                              </div>
                              <div>
                                <div className="flex items-center gap-3">
                                  <h4 className="text-2xl font-black text-slate-900">{item.event}</h4>
                                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                    item.severity === 'high' ? 'bg-rose-600 text-white' :
                                    item.severity === 'medium' ? 'bg-amber-500 text-white' :
                                    'bg-blue-500 text-white'
                                  }`}>
                                    {item.severity === 'high' ? '高风险' : item.severity === 'medium' ? '中等风险' : '低风险'}
                                  </span>
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">事件性质: 地缘政治冲突 / 政策变动</div>
                              </div>
                            </div>
                            <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">市场影响深度解析</div>
                              <p className="text-slate-700 text-lg font-bold leading-relaxed">{item.impact}</p>
                            </div>
                          </div>
                          <div className="md:w-64 space-y-6">
                            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">风险指数</div>
                              <div className="flex items-end gap-1 mb-2">
                                <span className="text-4xl font-black text-slate-900">
                                  {item.severity === 'high' ? '9.2' : item.severity === 'medium' ? '6.5' : '3.8'}
                                </span>
                                <span className="text-slate-400 font-bold mb-1">/ 10</span>
                              </div>
                              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-1000 ${
                                  item.severity === 'high' ? 'bg-rose-500 w-[92%]' :
                                  item.severity === 'medium' ? 'bg-amber-500 w-[65%]' :
                                  'bg-blue-500 w-[38%]'
                                }`}></div>
                              </div>
                            </div>
                            <button className="w-full py-4 bg-white border border-slate-200 rounded-2xl text-slate-600 font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                              <Edit3 size={16}/> 添加备注
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white p-20 rounded-[48px] border border-slate-200 text-center space-y-8">
                  <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto text-slate-300">
                    <Globe size={48}/>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-900">尚未生成地缘政治报告</h3>
                    <p className="text-slate-500 font-medium max-w-md mx-auto">请先在“周报管理”中选择报告，然后点击下方按钮启动地缘政治专项分析。</p>
                  </div>
                  <button 
                    onClick={runAnalysis}
                    disabled={isAnalyzing || selectedFileIds.size === 0}
                    className="bg-slate-900 text-white px-10 py-5 rounded-[32px] font-black text-xl hover:bg-blue-600 transition-all shadow-xl disabled:opacity-50"
                  >
                    {isAnalyzing ? '正在深度扫描全球动态...' : '启动地缘政治专项分析'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 文件预览模态框 */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" onClick={() => setPreviewFile(null)}></div>
          <div className="relative bg-white w-full max-w-6xl max-h-[92vh] rounded-[48px] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl shadow-lg shadow-black/5 ${getIconColorClass(previewFile.previewType, true)}`}>
                  {getFileIcon(previewFile.previewType)}
                </div>
                <div>
                  <span className="font-black text-2xl text-slate-900 block leading-tight">{previewFile.name}</span>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 py-0.5 bg-slate-100 rounded">{previewFile.type}</span>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{formatFileSize(previewFile.size)}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setPreviewFile(null)} 
                className="p-4 hover:bg-white rounded-full shadow-sm border border-transparent hover:border-slate-100 transition-all active:scale-90"
              >
                <X size={28}/>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-12 bg-slate-50/80 custom-scrollbar">
              {previewFile.previewType === 'image' && (
                <div className="flex flex-col items-center">
                  <img 
                    src={previewFile.previewUrl} 
                    className="max-w-full max-h-[70vh] rounded-[32px] shadow-2xl ring-1 ring-black/5 object-contain" 
                    alt={previewFile.name}
                  />
                  <div className="mt-8 flex gap-4">
                    <a 
                      href={previewFile.previewUrl} 
                      download={previewFile.name}
                      className="bg-slate-900 text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-bold hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10"
                    >
                      <Download size={20}/> 另存为图片
                    </a>
                  </div>
                </div>
              )}
              {previewFile.previewType === 'pdf' && (
                <div className="w-full h-full min-h-[75vh] bg-slate-200 rounded-[32px] overflow-hidden shadow-inner flex items-center justify-center">
                  <iframe 
                    src={previewFile.blobUrl} 
                    className="w-full h-full border-none" 
                    title="PDF 内容预览" 
                  />
                </div>
              )}
              {previewFile.previewType === 'text' && (
                <SmartTextPreview file={previewFile} />
              )}
              {previewFile.previewType === 'unsupported' && (
                <div className="py-24 text-center max-w-lg mx-auto">
                  <div className="p-12 bg-white rounded-[40px] inline-block mb-10 text-slate-200 shadow-xl border border-slate-50 ring-1 ring-black/5">
                    <FileWarning size={80} className="text-amber-400"/>
                  </div>
                  <h4 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">无法直接预览</h4>
                  <p className="text-slate-500 font-medium mb-10 leading-relaxed">
                    当前文件格式 ({previewFile.type}) 暂时不提供在线实时预览功能。您可以点击下方按钮下载至本地进行查阅。
                  </p>
                  <a 
                    href={previewFile.content} 
                    download={previewFile.name} 
                    className="bg-slate-900 text-white px-12 py-5 rounded-[32px] inline-flex items-center gap-3 font-black text-xl hover:bg-blue-600 transition-all shadow-2xl shadow-blue-500/10 active:scale-95"
                  >
                    <Download size={24}/> 下载原始文档
                  </a>
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-slate-50/50 flex justify-end gap-3">
               <button 
                 onClick={() => setPreviewFile(null)}
                 className="px-8 py-3 text-slate-600 font-bold hover:bg-white rounded-2xl transition-all border border-transparent hover:border-slate-100"
               >
                 关闭窗口
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
