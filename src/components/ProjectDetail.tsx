import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { 
  ArrowLeft, Plus, Download, Upload, Trash2, 
  ChevronDown, Search, Filter, MoreHorizontal,
  CheckCircle2, Circle, Clock, AlertCircle,
  Image as ImageIcon, X, Check, Settings, Eye, EyeOff
} from "lucide-react";
import { Project, Task } from "../types";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "motion/react";
import ConfirmDialog from "./ConfirmDialog";
import { GoogleGenAI, Type } from "@google/genai";
import { getWeekRange, getMonthAndWeekFromDate } from "../utils/dateUtils";

export default function ProjectDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const month = parseInt(searchParams.get("month") || "1");
  const week = parseInt(searchParams.get("week") || "1");

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState<{ isOpen: boolean; type: 'selected' | 'all' }>({ isOpen: false, type: 'selected' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  const [importing, setImporting] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnToggle, setShowColumnToggle] = useState(false);

  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<{ isOpen: boolean; taskId: number | null }>({
    isOpen: false,
    taskId: null
  });

  const prevValues = useRef<Record<number, string>>({});

  useEffect(() => {
    fetchProject();
    fetchTasks();
  }, [id, month, week]);

  const toggleSelectTask = (taskId: number) => {
    const newSelected = new Set(selectedTaskIds);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTaskIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const deleteSelectedTasks = async () => {
    try {
      const ids = Array.from(selectedTaskIds);
      await fetch("/api/tasks/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      setTasks(tasks.filter(t => !selectedTaskIds.has(t.id)));
      setSelectedTaskIds(new Set());
      setConfirmBulkDelete({ ...confirmBulkDelete, isOpen: false });
    } catch (error) {
      console.error("Error deleting selected tasks:", error);
    }
  };

  const deleteAllTasks = async () => {
    try {
      await fetch(`/api/projects/${id}/tasks`, { method: "DELETE" });
      setTasks([]);
      setSelectedTaskIds(new Set());
      setConfirmBulkDelete({ ...confirmBulkDelete, isOpen: false });
    } catch (error) {
      console.error("Error deleting all tasks:", error);
    }
  };

  const fetchProject = async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    const current = data.find((p: Project) => p.id === Number(id));
    setProject(current);
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/projects/${id}/tasks?month=${month}&week=${week}`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const addTask = async () => {
    const newTask = {
      month,
      week,
      dynamic_data: {
        "Título": "Nueva Tarea",
        "Estado": "Pendiente"
      }
    };
    const res = await fetch(`/api/projects/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTask),
    });
    if (res.ok) fetchTasks();
  };

  const updateTask = async (taskId: number, updates: any) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const updatedTask = { 
      ...task, 
      ...updates,
      dynamic_data: updates.dynamic_data ? { ...task.dynamic_data, ...updates.dynamic_data } : task.dynamic_data
    };

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
    
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTask),
      });
    } catch (error) {
      console.error("Error updating task:", error);
      // Rollback on error
      fetchTasks();
    }
  };

  const deleteTask = async (taskId: number) => {
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    fetchTasks();
  };

  const deleteProject = async () => {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    window.location.href = "/";
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          processImportedData(results.data);
        }
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        processImportedData(data);
      };
      reader.readAsBinaryString(file);
    }
  };

  const processImportedData = async (data: any[]) => {
    try {
      setImporting(true);
      
      const processedTasks = data.map((t: any) => {
        let taskMonth = month;
        let taskWeek = week;
        
        // Buscar campo de fecha para reubicación
        const dateKey = Object.keys(t).find(key => 
          key.toLowerCase().includes('fecha') || 
          key.toLowerCase().includes('día') || 
          key.toLowerCase().includes('date')
        );
        
        if (dateKey && t[dateKey]) {
          const date = new Date(t[dateKey]);
          if (!isNaN(date.getTime())) {
            const relocation = getMonthAndWeekFromDate(date);
            if (relocation) {
              taskMonth = relocation.month;
              taskWeek = relocation.week;
            }
          }
        }
        
        return {
          dynamic_data: t,
          month: taskMonth,
          week: taskWeek
        };
      });

      // Get all unique columns from the imported data
      const allCols = new Set<string>();
      data.forEach(t => {
        Object.keys(t).forEach(k => allCols.add(k));
      });
      
      const columns = Array.from(allCols);
      setAvailableColumns(columns);
      setSelectedColumns(columns); // Default all selected
      setPendingTasks(processedTasks);
      setShowReviewModal(true);
    } catch (error: any) {
      console.error("Import error:", error);
      alert("Error en la importación: " + error.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleScreenshotImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: "Analiza esta captura de pantalla de una tabla de tareas. REGLAS CRÍTICAS:\n1. Identifica todas las columnas y extrae los datos.\n2. Busca cualquier columna que parezca una FECHA (ej: 'Fecha', 'Día', '01/03').\n3. El resultado debe ser un array JSON de objetos donde las llaves sean los nombres de las columnas.\n4. Si encuentras una fecha, inclúyela en un campo llamado 'fecha_detectada' en formato YYYY-MM-DD.\nDevuelve SOLO el JSON, sin markdown." },
              { inlineData: { mimeType: file.type, data: base64Data } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const rawTasks = JSON.parse(response.text);
      
      // Filtrar campos vacíos y columnas ignoradas (Motivo, Estado, Proyecto)
      const ignoredKeys = ['motivo', 'estado', 'proyecto'];
      const extractedTasks = (Array.isArray(rawTasks) ? rawTasks : []).map((task: any) => {
        const filteredTask: any = {};
        let taskMonth = month;
        let taskWeek = week;

        // Procesar fecha detectada para reubicación
        if (task.fecha_detectada) {
          const date = new Date(task.fecha_detectada);
          const relocation = getMonthAndWeekFromDate(date);
          if (relocation) {
            taskMonth = relocation.month;
            taskWeek = relocation.week;
          }
        }

        Object.keys(task).forEach(key => {
          const normalizedKey = key.toLowerCase().trim();
          if (normalizedKey === 'fecha_detectada') return;

          const value = task[key];
          const isEmpty = value === null || value === undefined || String(value).trim() === '';
          
          if (!isEmpty && !ignoredKeys.includes(normalizedKey)) {
            filteredTask[key] = value;
          }
        });

        return {
          dynamic_data: filteredTask,
          month: taskMonth,
          week: taskWeek
        };
      }).filter(t => Object.keys(t.dynamic_data).length > 0);

      // Get all unique columns from the extracted tasks
      const allCols = new Set<string>();
      extractedTasks.forEach(t => {
        Object.keys(t.dynamic_data).forEach(k => allCols.add(k));
      });
      
      const columns = Array.from(allCols);
      setAvailableColumns(columns);
      setSelectedColumns(columns);
      setPendingTasks(extractedTasks);
      setShowReviewModal(true);
    } catch (error: any) {
      console.error("Screenshot import error:", error);
      alert("Error en la importación desde captura: " + error.message);
    } finally {
      setImporting(false);
      if (screenshotInputRef.current) screenshotInputRef.current.value = "";
    }
  };

  const confirmBulkImport = async () => {
    try {
      setImporting(true);
      
      // Filter dynamic_data based on selected columns
      const finalTasks = pendingTasks.map(t => {
        const filteredData: any = {};
        selectedColumns.forEach(col => {
          if (t.dynamic_data[col] !== undefined) {
            filteredData[col] = t.dynamic_data[col];
          }
        });
        return {
          ...t,
          dynamic_data: filteredData
        };
      }).filter(t => Object.keys(t.dynamic_data).length > 0);

      const res = await fetch(`/api/projects/${id}/tasks/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          week,
          tasks: finalTasks
        }),
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al importar tareas");
      }
      
      await fetchTasks();
      setShowReviewModal(false);
      setPendingTasks([]);
      alert(`Importación completada: ${finalTasks.length} tareas añadidas.`);
    } catch (error: any) {
      console.error("Bulk import confirm error:", error);
      alert("Error al confirmar la importación: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  const exportToExcel = () => {
    const exportData = tasks.map((t, idx) => ({
      '#': idx + 1,
      ...t.dynamic_data,
      'Fotos PRL': t.fotos_prl ? 'SÍ' : 'NO',
      'Inventario': t.inventario ? 'SÍ' : 'NO',
      'Incidencia': t.incidencia ? 'SÍ' : 'NO',
      'Comentarios Internos': t.comentarios,
      'Estado': t.status === 'pendiente' ? 'Pendiente de valorar' : t.status === 'cerrada' ? 'Cerrada' : 'Sin Estado'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tareas");
    
    // Auto-size columns
    if (exportData.length > 0) {
      const colWidths = Object.keys(exportData[0]).map(key => {
        const headerLen = key.length;
        const maxContentLen = Math.max(...exportData.map(row => String(row[key as any] || "").length));
        return { wch: Math.max(headerLen, maxContentLen) + 2 };
      });
      ws['!cols'] = colWidths;
    }

    XLSX.writeFile(wb, `${project?.name || 'Proyecto'}_Bigmatic_ProjectFlow.xlsx`);
  };

  const isOneDayAway = (dateStr: string) => {
    if (!dateStr) return false;
    const deadline = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1;
  };

  const allDynamicColumns = Array.from(new Set((Array.isArray(tasks) ? tasks : []).flatMap(t => Object.keys(t.dynamic_data || {}))));
  const dynamicColumns = allDynamicColumns.filter(col => !hiddenColumns.has(col));

  const toggleColumnVisibility = (col: string) => {
    const newHidden = new Set(hiddenColumns);
    if (newHidden.has(col)) {
      newHidden.delete(col);
    } else {
      newHidden.add(col);
    }
    setHiddenColumns(newHidden);
  };

  const filteredTasks = (Array.isArray(tasks) ? tasks : []).filter(t => {
    const searchStr = search.toLowerCase();
    return Object.values(t.dynamic_data || {}).some(val => 
      String(val).toLowerCase().includes(searchStr)
    );
  }).sort((a, b) => {
    // Sort by Status (Closed tasks at the end)
    const statusA = a.dynamic_data?.['Estado'] === 'Cerrado' ? 1 : 0;
    const statusB = b.dynamic_data?.['Estado'] === 'Cerrado' ? 1 : 0;
    if (statusA !== statusB) return statusA - statusB;

    // Sort by SLA date (closest first)
    const slaA = a.dynamic_data?.['SLA'] || a.dynamic_data?.['Fecha SLA'] || '9999-12-31';
    const slaB = b.dynamic_data?.['SLA'] || b.dynamic_data?.['Fecha SLA'] || '9999-12-31';
    
    if (slaA < slaB) return -1;
    if (slaA > slaB) return 1;
    
    // Then by Priority
    const priorityMap: Record<string, number> = { 'Alta': 0, 'Media': 1, 'Baja': 2 };
    const prioA = priorityMap[a.dynamic_data?.['Prioridad']] ?? 9;
    const prioB = priorityMap[b.dynamic_data?.['Prioridad']] ?? 9;
    
    return prioA - prioB;
  });

  if (loading) return <div className="p-12 font-sans text-sm text-slate-500 animate-pulse">Cargando Datos de la Misión...</div>;

  const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Detail Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-900 shadow-xl z-20">
        <div className="flex items-center gap-4 mb-6">
          <Link to={`/project/${id}`} className="p-2 transition-colors rounded-md hover:bg-slate-800 text-slate-500">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono font-bold bg-blue-600 text-white px-2 py-0.5 tracking-widest rounded-sm">
                ID: {project?.code || project?.id.toString().padStart(3, '0')}
              </span>
              <h1 className="text-3xl font-bold text-white tracking-tight">{project?.name}</h1>
              <span className="text-xs font-bold text-blue-400 bg-blue-900/30 border border-blue-800/50 px-3 py-1 rounded-lg flex flex-col items-center">
                <span>{MONTH_NAMES[month - 1]} - Semana {week}</span>
                <span className="text-[9px] text-blue-500 font-mono lowercase tracking-normal">({getWeekRange(month - 1, week)})</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">{project?.description}</p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex gap-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Buscar tareas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 pl-9 pr-4 py-2 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <button 
                onClick={() => setShowColumnToggle(!showColumnToggle)}
                className={`flex items-center gap-2 px-3 py-2 border border-slate-700 hover:border-blue-500 text-slate-300 hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest rounded-lg ${showColumnToggle ? 'bg-slate-800 border-blue-500' : ''} ${hiddenColumns.size > 0 ? 'border-blue-500/50 text-blue-400' : ''}`}
                title="Gestionar Columnas Ocultas"
              >
                <Eye size={14} />
                {hiddenColumns.size > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full border border-slate-950 shadow-lg">
                    {hiddenColumns.size}
                  </span>
                )}
              </button>
              
              <AnimatePresence>
                {showColumnToggle && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Columnas</h3>
                      {hiddenColumns.size > 0 && (
                        <button 
                          onClick={() => setHiddenColumns(new Set())}
                          className="text-[9px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-tighter underline"
                        >
                          Mostrar Todas
                        </button>
                      )}
                    </div>
                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                      {allDynamicColumns.map(col => (
                        <label 
                          key={col} 
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer group transition-colors ${hiddenColumns.has(col) ? 'bg-slate-800/30' : 'hover:bg-slate-800'}`}
                          onClick={(e) => {
                            e.preventDefault();
                            toggleColumnVisibility(col);
                          }}
                        >
                          <span className={`text-xs ${hiddenColumns.has(col) ? 'text-slate-500' : 'text-slate-300 group-hover:text-white'}`}>{col}</span>
                          <div className={`p-1 rounded ${hiddenColumns.has(col) ? 'text-slate-600' : 'text-blue-400'}`}>
                            {hiddenColumns.has(col) ? <EyeOff size={14} /> : <Eye size={14} />}
                          </div>
                        </label>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImport} 
              className="hidden" 
              accept=".csv,.xlsx,.xls"
            />
            <button 
              onClick={() => screenshotInputRef.current?.click()}
              disabled={importing}
              className={`flex items-center gap-2 px-4 py-2 border border-slate-700 hover:border-blue-500 text-slate-300 hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest rounded-lg ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ImageIcon size={14} className={importing ? 'animate-pulse' : ''} /> 
              {importing ? 'Procesando...' : 'Captura'}
            </button>
            <input 
              type="file" 
              ref={screenshotInputRef} 
              onChange={handleScreenshotImport} 
              className="hidden" 
              accept="image/*"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className={`flex items-center gap-2 px-4 py-2 border border-slate-700 hover:border-blue-500 text-slate-300 hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest rounded-lg ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Upload size={14} className={importing ? 'animate-bounce' : ''} /> 
              {importing ? 'Importando...' : 'Importar'}
            </button>
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 border border-slate-700 hover:border-blue-500 text-slate-300 hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest rounded-lg"
            >
              <Download size={14} /> Exportar
            </button>
            <button 
              onClick={addTask}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white transition-all text-[10px] font-bold uppercase tracking-widest rounded-lg shadow-lg shadow-blue-900/20"
            >
              <Plus size={14} /> Añadir Tarea
            </button>
            <button 
              onClick={() => setConfirmBulkDelete({ isOpen: true, type: 'all' })}
              className="flex items-center gap-2 px-4 py-2 border border-rose-900/50 hover:border-rose-500 text-rose-500 hover:bg-rose-500/10 transition-all text-[10px] font-bold uppercase tracking-widest rounded-lg"
            >
              <Trash2 size={14} /> Borrar Todo
            </button>
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-auto bg-slate-950">
        <div className="min-w-full p-6">
          {/* Grid Header */}
          <div 
            className="grid bg-slate-900 sticky top-0 z-10 border-b border-slate-800 rounded-t-xl p-3"
            style={{ gridTemplateColumns: `40px repeat(${dynamicColumns.length}, 1fr) 140px 60px` }}
          >
            <div className="col-header">#</div>
            {dynamicColumns.map(col => (
              <div key={col} className="col-header uppercase tracking-tighter flex items-center justify-between group/col">
                <span className="truncate">{col}</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleColumnVisibility(col);
                  }}
                  className="opacity-0 group-hover/col:opacity-100 p-1 hover:bg-slate-800 rounded transition-all text-slate-500 hover:text-rose-400 ml-1"
                  title="Ocultar columna"
                >
                  <EyeOff size={12} />
                </button>
              </div>
            ))}
            <div className="col-header">Estado</div>
            <div className="col-header text-right">Acc.</div>
          </div>

          {/* Grid Body */}
          <AnimatePresence initial={false}>
            {filteredTasks.map((task, idx) => (
              <React.Fragment key={task.id}>
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`grid items-center border-b border-slate-800/50 p-3 transition-all cursor-pointer ${
                    task.incidencia ? 'bg-rose-950/40 border-l-4 border-l-rose-500' :
                    task.status === 'pendiente' ? 'bg-blue-950/40 border-l-4 border-l-blue-500' : 
                    task.status === 'cerrada' ? 'bg-emerald-950/40 border-l-4 border-l-emerald-500' : 
                    'bg-slate-900/50 border-l-4 border-l-transparent'
                  } hover:brightness-125`}
                  style={{ gridTemplateColumns: `40px repeat(${dynamicColumns.length}, 1fr) 140px 60px` }}
                  onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                >
                  <div className="text-[10px] font-bold text-slate-600">{idx + 1}</div>
                  {dynamicColumns.map(col => (
                    <div key={col} className="px-2">
                      <input 
                        type="text"
                        value={task.dynamic_data[col] || ""}
                        onChange={(e) => updateTask(task.id, { dynamic_data: { [col]: e.target.value } })}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-transparent focus:bg-slate-800 focus:ring-1 focus:ring-blue-500/20 focus:outline-none p-1 text-xs text-slate-300 rounded transition-all"
                      />
                    </div>
                  ))}
                  <div className="px-2">
                    <select
                      value={task.status || 'ninguno'}
                      onChange={(e) => updateTask(task.id, { status: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      className={`w-full text-[10px] font-bold uppercase tracking-wider p-1 rounded border focus:outline-none transition-all ${
                        task.status === 'pendiente' ? 'bg-blue-900/50 border-blue-800 text-blue-300' :
                        task.status === 'cerrada' ? 'bg-emerald-900/50 border-emerald-800 text-emerald-300' :
                        'bg-slate-800 border-slate-700 text-slate-500'
                      }`}
                    >
                      <option value="ninguno">Sin Estado</option>
                      <option value="pendiente">Pendiente de valorar</option>
                      <option value="cerrada">Cerrada</option>
                    </select>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <input 
                      type="checkbox"
                      checked={selectedTaskIds.has(task.id)}
                      onChange={() => toggleSelectTask(task.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-3 h-3 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                      className="p-1 text-slate-600 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>

                {/* Sub-menu */}
                {expandedTaskId === task.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-slate-900/80 border-b border-slate-800 overflow-hidden"
                  >
                    <div className="py-6 px-8">
                      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Checkboxes Section */}
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Estado de Tarea</h4>
                          <div className="grid grid-cols-1 gap-3">
                            {[
                              { id: 'fotos_prl', label: 'Fotos PRL' },
                              { id: 'inventario', label: 'Inventario' },
                              { id: 'incidencia', label: 'Incidencia' }
                            ].map((item) => (
                              <label key={item.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700 cursor-pointer hover:border-blue-500/50 transition-all group">
                                <input 
                                  type="checkbox"
                                  checked={!!(task as any)[item.id]}
                                  onChange={(e) => updateTask(task.id, { [item.id]: e.target.checked })}
                                  className="w-4 h-4 text-blue-600 rounded bg-slate-900 border-slate-700 focus:ring-blue-500 focus:ring-offset-slate-900"
                                />
                                <span className="text-xs font-semibold text-slate-300 group-hover:text-blue-400 transition-colors">
                                  {item.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Comments Section */}
                        <div className="flex flex-col">
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Comentarios Internos</h4>
                          <textarea 
                            value={task.comentarios || ""}
                            onChange={(e) => updateTask(task.id, { comentarios: e.target.value })}
                            placeholder="Escribe aquí cualquier observación..."
                            className="flex-1 min-h-[120px] p-4 bg-slate-800/50 border border-slate-700 rounded-xl text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none shadow-inner placeholder:text-slate-600"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </React.Fragment>
            ))}
          </AnimatePresence>

          {filteredTasks.length === 0 && (
            <div className="p-20 text-center border-b border-black/10">
              <div className="inline-block p-4 bg-black/5 rounded-full mb-4">
                <AlertCircle size={32} className="opacity-20" />
              </div>
              <p className="text-xs font-mono uppercase opacity-40">No se encontraron tareas en este sector.</p>
            </div>
          )}
        </div>
      </div>

      {/* Grid Footer / Stats */}
      <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-4">
        {/* Color Legend */}
        <div className="flex justify-center items-center gap-6 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-rose-900/50 border border-rose-500/50 rounded-sm"></div>
            <span>Incidencia</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-900/50 border border-blue-500/50 rounded-sm"></div>
            <span>Pendiente de valorar</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-900/50 border border-emerald-500/50 rounded-sm"></div>
            <span>Cerrada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-slate-800 border border-slate-700 rounded-sm"></div>
            <span>Sin Estado</span>
          </div>
        </div>

        <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest text-slate-400">
          <div className="flex gap-6">
            <span>Total de Tareas: {Array.isArray(tasks) ? tasks.length : 0}</span>
            <span className="text-emerald-500">Cerradas: {(Array.isArray(tasks) ? tasks : []).filter(t => t.status === 'cerrada').length}</span>
            <span className="text-blue-500">Pendientes: {(Array.isArray(tasks) ? tasks : []).filter(t => t.status === 'pendiente').length}</span>
          </div>
          <div>
            Última Sincronización: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDeleteProject}
        onClose={() => setConfirmDeleteProject(false)}
        onConfirm={deleteProject}
        title="¿Borrar Proyecto?"
        message="Esta acción eliminará permanentemente el proyecto y todas sus tareas asociadas. Esta operación no se puede deshacer."
        confirmText="Borrar Proyecto"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={confirmDeleteTask.isOpen}
        onClose={() => setConfirmDeleteTask({ isOpen: false, taskId: null })}
        onConfirm={() => {
          if (confirmDeleteTask.taskId) {
            deleteTask(confirmDeleteTask.taskId);
          }
        }}
        title="¿Borrar Tarea?"
        message="¿Estás seguro de que deseas eliminar esta tarea? Esta acción no se puede deshacer."
        confirmText="Borrar Tarea"
        variant="danger"
      />

      <ConfirmDialog 
        isOpen={confirmBulkDelete.isOpen}
        onClose={() => setConfirmBulkDelete({ ...confirmBulkDelete, isOpen: false })}
        onConfirm={confirmBulkDelete.type === 'all' ? deleteAllTasks : deleteSelectedTasks}
        title={confirmBulkDelete.type === 'all' ? "Borrar todas las tareas" : "Borrar tareas seleccionadas"}
        message={confirmBulkDelete.type === 'all' 
          ? "¿Estás seguro de que quieres borrar TODAS las tareas de este proyecto? Esta acción no se puede deshacer."
          : `¿Estás seguro de que quieres borrar las ${selectedTaskIds.size} tareas seleccionadas?`
        }
        confirmText="Confirmar Borrado"
        variant="danger"
      />

      {/* Review Import Modal */}
      <AnimatePresence>
        {showReviewModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-[95vw] xl:max-w-7xl max-h-[92vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Revisar Importación</h2>
                  <p className="text-slate-400 text-sm mt-1">Personaliza las columnas y verifica los datos antes de añadirlos al proyecto.</p>
                </div>
                <button 
                  onClick={() => setShowReviewModal(false)}
                  className="p-2.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-all duration-200"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 md:p-8 flex-1 overflow-auto space-y-8 custom-scrollbar">
                {/* Column Selection Section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Columnas Detectadas</h3>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setSelectedColumns(availableColumns)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                      >
                        Seleccionar Todas
                      </button>
                      <button 
                        onClick={() => setSelectedColumns([])}
                        className="text-xs text-slate-500 hover:text-slate-400 font-medium transition-colors"
                      >
                        Desmarcar Todas
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {availableColumns.map(col => (
                      <label 
                        key={col}
                        className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                          selectedColumns.includes(col) 
                            ? 'bg-blue-500/10 border-blue-500/50 text-blue-100 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-800'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          className="hidden"
                          checked={selectedColumns.includes(col)}
                          onChange={() => {
                            if (selectedColumns.includes(col)) {
                              setSelectedColumns(selectedColumns.filter(c => c !== col));
                            } else {
                              setSelectedColumns([...selectedColumns, col]);
                            }
                          }}
                        />
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                          selectedColumns.includes(col) ? 'bg-blue-500 border-blue-500' : 'border-slate-600 group-hover:border-slate-500'
                        }`}>
                          {selectedColumns.includes(col) && <Check size={14} className="text-white stroke-[3px]" />}
                        </div>
                        <span className="text-sm font-semibold">{col}</span>
                      </label>
                    ))}
                  </div>
                </section>

                {/* Preview Section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Vista Previa Ampliada ({pendingTasks.length} filas)</h3>
                    <span className="text-xs text-slate-500 italic">Mostrando las primeras 10 filas</span>
                  </div>
                  <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/50">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800/80 text-slate-200 font-bold border-b border-slate-700">
                            <th className="px-6 py-4 whitespace-nowrap sticky left-0 bg-slate-800 z-10">Ubicación</th>
                            {selectedColumns.map(col => (
                              <th key={col} className="px-6 py-4 whitespace-nowrap min-w-[150px]">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {pendingTasks.slice(0, 10).map((task, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/30 transition-colors group">
                              <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-slate-900/90 group-hover:bg-slate-800/90 z-10">
                                <span className="px-2 py-1 rounded bg-slate-700 text-[10px] font-bold text-slate-300">
                                  M{task.month} S{task.week}
                                </span>
                              </td>
                              {selectedColumns.map(col => (
                                <td key={col} className="px-6 py-4 text-slate-400 font-medium">
                                  {task.dynamic_data[col] || <span className="text-slate-700 italic">vacío</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {pendingTasks.length > 10 && (
                      <div className="p-4 text-center text-xs font-medium text-slate-500 bg-slate-900/50 border-t border-slate-800">
                        + {pendingTasks.length - 10} filas adicionales detectadas
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-800 bg-slate-900/80 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-slate-500 text-xs font-medium">
                  {selectedColumns.length} columnas seleccionadas para importar
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => setShowReviewModal(false)}
                    className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold text-slate-300 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:text-white transition-all duration-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmBulkImport}
                    disabled={importing || selectedColumns.length === 0}
                    className="flex-1 sm:flex-none px-8 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {importing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        Confirmar Importación
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
