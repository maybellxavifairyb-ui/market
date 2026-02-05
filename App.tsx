
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Search, Trash2, FileText, Image as ImageIcon, File, Download, 
  FileSearch, CheckSquare, Square, Loader2, X, FileWarning, PieChart, 
  FileDown, FileSpreadsheet, Presentation, Key, Users, LayoutDashboard, 
  BarChart4, Save, Edit3, TrendingUp, AlertCircle, Activity, Target, 
  Zap, ChevronRight, Filter, Globe, Database, Eye, Clock, HardDrive
} from 'lucide-react';
import { MarketFile, Customer, AnalysisResult, AppView } from './types';
import { geminiService } from './services/geminiService';

// --- 工具函数：格式化文件大小 ---
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// --- 可视化组件：毛利分布图 ---
const ProfitChart: React.FC<{ customers: Customer[] }> = ({ customers }) => {
  const bins = [0, 5, 10, 15, 20, 25];
  const data = bins.map(bin => customers.filter(c => c.grossMargin >= bin && c.grossMargin < bin + 5).length);
  const max = Math.max(...data, 1);

  return (
    <div className="flex items-end gap-2 h-32 px-2">
      {data.map((val, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
          <div 
            className="w-full bg-blue-500/20 group-hover:bg-blue-500/40 transition-all rounded-t-lg relative"
            style={{ height: `${(val / max) * 100}%` }}
          >
            {val > 0 && <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-blue-600">{val}</span>}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">{bins[i]}%</span>
        </div>
      ))}
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [previewFile, setPreviewFile] = useState<MarketFile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCust, setNewCust] = useState<Omit<Customer, 'id'>>({
    name: '', equipment: '', capacity: '', rawMaterials: '', products: '', grossMargin: 0
  });

  useEffect(() => {
    const savedFiles = localStorage.getItem('market_files_v3');
    const savedCusts = localStorage.getItem('market_customers_v3');
    if (savedFiles) setFiles(JSON.parse(savedFiles).map((f: any) => ({ ...f, blobUrl: undefined })));
    if (savedCusts) setCustomers(JSON.parse(savedCusts));
  }, []);

  useEffect(() => {
    localStorage.setItem('market_files_v3', JSON.stringify(files.map(({blobUrl, ...rest}) => rest)));
    localStorage.setItem('market_customers_v3', JSON.stringify(customers));
  }, [files, customers]);

  useEffect(() => { setSearchQuery(''); }, [activeView]);

  const filteredFiles = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return files.filter(f => f.name.toLowerCase().includes(q));
  }, [files, searchQuery]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.equipment.toLowerCase().includes(q) || 
      c.products.toLowerCase().includes(q) ||
      c.rawMaterials.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files;
    if (!uploaded) return;
    const newFiles: MarketFile[] = [];
    for (let i = 0; i < uploaded.length; i++) {
      const f = uploaded[i];
      const isImage = f.type.startsWith('image/');
      const isPdf = f.type === 'application/pdf';
      const isText = f.name.endsWith('.txt') || f.name.endsWith('.md');
      
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
    const selCusts = customers.filter(c => selectedCustomerIds.has(c.id));
    if (selFiles.length === 0) return alert('请至少选择一份周报进行分析');
    setIsAnalyzing(true);
    try {
      const res = await geminiService.analyzeMarketReports(selFiles, selCusts);
      setAnalysisResult(res);
      setActiveView('analysis');
      setTimeout(() => document.getElementById('res-top')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e: any) { alert('分析失败: ' + e.message); }
    finally { setIsAnalyzing(false); }
  };

  const deleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
    setSelectedCustomerIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
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
            { id: 'customers', label: '客户智库', icon: Users, desc: '客户画像与产能' },
            { id: 'analysis', label: 'AI 分析终端', icon: Zap, desc: '深度协同洞察' }
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
                  <div className="text-sm font-bold opacity-70 italic">支持 PDF, 图片, TXT 自动分类预览</div>
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

        {/* 视图 2: 客户智库 (逻辑保持不变) */}
        {activeView === 'customers' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-10">
              <div className="lg:col-span-3 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">客户信息矩阵</h2>
                    <p className="text-slate-500 mt-1 font-medium">客户情报与生产基地概览</p>
                  </div>
                  <button 
                    onClick={() => setIsAddingCustomer(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all font-bold active:scale-95"
                  >
                    <Plus size={20} /> <span>录入客户</span>
                  </button>
                </div>
                
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="按名称、装置或产品全域搜索..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none w-full text-sm font-medium transition-all"
                  />
                </div>
              </div>

              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">毛利分布概览</div>
                <ProfitChart customers={customers} />
              </div>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-slate-400 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="p-6 w-12 text-center">选</th>
                    <th className="p-6">企业名称</th>
                    <th className="p-6">装置 / 产能</th>
                    <th className="p-6">原料链</th>
                    <th className="p-6 text-center">毛利率</th>
                    <th className="p-6 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredCustomers.map(c => (
                    <tr key={c.id} className="group hover:bg-slate-50/80 transition-all">
                      <td className="p-6 text-center">
                        <button onClick={() => {
                          const next = new Set(selectedCustomerIds);
                          next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                          setSelectedCustomerIds(next);
                        }}>
                          {selectedCustomerIds.has(c.id) ? <CheckSquare className="text-emerald-600 mx-auto" /> : <Square className="text-slate-200 group-hover:text-slate-400 mx-auto transition-colors" />}
                        </button>
                      </td>
                      <td className="p-6"><span className="font-black text-slate-700 leading-tight">{c.name}</span></td>
                      <td className="p-6">
                        <div className="text-xs font-bold text-slate-700">{c.equipment}</div>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">产能: {c.capacity}</div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black rounded uppercase w-fit">入: {c.rawMaterials}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded uppercase w-fit">出: {c.products}</span>
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <div className={`text-sm font-black ${c.grossMargin > 15 ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {c.grossMargin}%
                        </div>
                      </td>
                      <td className="p-6 text-right opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => deleteCustomer(c.id)} className="p-3 bg-white hover:bg-red-50 text-red-600 rounded-xl shadow-sm border border-slate-100"><Trash2 size={18}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 视图 3: 智能分析 (保持不变) */}
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
                  <h2 className="text-5xl font-black text-slate-900 tracking-tighter">AI 协同深度洞察终端</h2>
                  <p className="text-slate-500 text-xl font-medium max-w-2xl mx-auto">
                    自动交叉比对 <span className="text-blue-600 font-black">{selectedFileIds.size}</span> 份报告与 <span className="text-emerald-500 font-black">{selectedCustomerIds.size}</span> 家客户数据。
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
                    <span>{isAnalyzing ? '正在重构市场逻辑...' : '启动深度协同分析'}</span>
                  </button>
                  
                  {selectedFileIds.size === 0 && (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-full text-xs font-bold border border-amber-100">
                      <AlertCircle size={14} /> 需要至少选择一份周报作为分析底稿
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
                    <ChevronRight size={18} className="rotate-180" /> 重新设定参数
                  </button>
                  <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-lg shadow-blue-500/30">
                    智能置信度: 98.4%
                  </div>
                </div>

                <div className="bg-white rounded-[48px] border border-slate-200 shadow-2xl overflow-hidden">
                  <div className="bg-slate-950 p-16 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[120px] -mr-48 -mt-48"></div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 text-blue-500 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
                        <Activity size={14}/> 综合市场情报分析
                      </div>
                      <h1 className="text-6xl font-black mb-6 tracking-tight leading-none max-w-4xl">{analysisResult.title}</h1>
                      <div className="h-1 w-24 bg-blue-600 mb-8 rounded-full"></div>
                      <p className="text-slate-400 text-xl leading-relaxed max-w-3xl font-medium italic">“{analysisResult.summary}”</p>
                    </div>
                  </div>

                  <div className="p-16 grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <div className="lg:col-span-2 space-y-12">
                      <section>
                        <h4 className="text-xs font-black mb-8 flex items-center gap-3 text-slate-400 uppercase tracking-[0.3em]">
                          <TrendingUp className="text-blue-500" size={18}/> 核心宏观洞察
                        </h4>
                        <div className="grid gap-4">
                          {analysisResult.keyInsights.map((i, idx) => (
                            <div key={idx} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-start gap-5 group hover:border-blue-200 transition-all">
                              <span className="bg-white w-10 h-10 rounded-2xl flex items-center justify-center text-blue-600 font-black shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">{idx+1}</span>
                              <p className="flex-1 text-slate-700 font-bold leading-relaxed">{i}</p>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section>
                        <h4 className="text-xs font-black mb-8 flex items-center gap-3 text-slate-400 uppercase tracking-[0.3em]">
                          <AlertCircle className="text-emerald-500" size={18}/> 盈利优化与战略建议
                        </h4>
                        <div className="grid gap-4">
                          {analysisResult.recommendations.map((r, idx) => (
                            <div key={idx} className="bg-emerald-50/30 p-6 rounded-3xl border border-emerald-100 flex items-start gap-4">
                              <div className="mt-1 bg-emerald-500 rounded-full p-1"><X size={12} className="text-white rotate-45"/></div>
                              <p className="text-emerald-900 font-bold">{r}</p>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>

                    <div className="space-y-12">
                      <section>
                        <h4 className="text-xs font-black mb-8 flex items-center gap-3 text-slate-400 uppercase tracking-[0.3em]">
                          <Users className="text-blue-500" size={18}/> 客户针对性画像策略
                        </h4>
                        <div className="space-y-4">
                          {analysisResult.customerStrategies?.map((s, idx) => (
                            <div key={idx} className="bg-white border border-slate-100 p-8 rounded-[32px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
                              <div className="flex justify-between items-start mb-6">
                                <h5 className="text-xl font-black text-slate-900">{s.name}</h5>
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Target size={16}/></div>
                              </div>
                              <div className="space-y-4">
                                <div className="p-4 bg-slate-50 rounded-2xl">
                                  <div className="text-[10px] font-black text-slate-400 uppercase mb-2">执行路线图</div>
                                  <div className="text-sm font-bold text-slate-700">{s.strategy}</div>
                                </div>
                                <div className="p-4 bg-blue-50/50 rounded-2xl">
                                  <div className="text-[10px] font-black text-blue-400 uppercase mb-2">核心增长点</div>
                                  <div className="text-sm font-bold text-blue-800">{s.opportunity}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                      <button className="w-full py-5 bg-slate-900 text-white rounded-[32px] font-black text-lg flex items-center justify-center gap-3 shadow-xl hover:bg-blue-600 transition-all">
                        <FileDown size={24}/> 导出报告 (PDF/MD)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 录入客户模态框 (保持不变) */}
      {isAddingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={() => setIsAddingCustomer(false)}></div>
          <div className="relative bg-white w-full max-w-xl rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-3xl font-black text-slate-900">录入新客户数据</h3>
                <p className="text-slate-400 text-xs font-bold uppercase mt-1">企业信息采集</p>
              </div>
              <button onClick={() => setIsAddingCustomer(false)} className="p-3 hover:bg-white rounded-2xl shadow-sm transition-all"><X/></button>
            </div>
            <div className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">企业名称</label>
                  <input value={newCust.name} onChange={e=>setNewCust({...newCust, name: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" placeholder="例如: 某某实业控股"/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">装置类型</label>
                  <input value={newCust.equipment} onChange={e=>setNewCust({...newCust, equipment: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" placeholder="例如: 裂解装置"/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">年产能 (万吨/年)</label>
                  <input value={newCust.capacity} onChange={e=>setNewCust({...newCust, capacity: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" placeholder="例如: 50.0"/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">所需原料</label>
                  <input value={newCust.rawMaterials} onChange={e=>setNewCust({...newCust, rawMaterials: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" placeholder="石脑油/乙烷"/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">关键产出</label>
                  <input value={newCust.products} onChange={e=>setNewCust({...newCust, products: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" placeholder="聚合级丙烯"/>
                </div>
                <div className="col-span-2">
                  <div className="flex justify-between mb-2 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">预测毛利率 (%)</label>
                    <span className="text-xs font-black text-blue-600">{newCust.grossMargin}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="50" step="1"
                    value={newCust.grossMargin} 
                    onChange={e=>setNewCust({...newCust, grossMargin: Number(e.target.value)})} 
                    className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
              <button onClick={() => {
                if (!newCust.name) return;
                setCustomers(prev => [...prev, { ...newCust, id: Math.random().toString(36).substr(2, 9) }]);
                setNewCust({ name: '', equipment: '', capacity: '', rawMaterials: '', products: '', grossMargin: 0 });
                setIsAddingCustomer(false);
              }} className="w-full py-5 bg-slate-900 hover:bg-blue-600 text-white rounded-3xl font-black text-lg shadow-xl transition-all mt-4">确认录入</button>
            </div>
          </div>
        </div>
      )}

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
                <div className="bg-white p-12 rounded-[32px] shadow-sm border border-slate-100 max-w-4xl mx-auto">
                  <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700 selection:bg-blue-100">
                    {previewFile.content}
                  </div>
                </div>
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
