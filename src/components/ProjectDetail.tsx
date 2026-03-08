import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ArrowLeft, Plus, Download, Upload, Trash2, 
  ChevronDown, Search, Filter, MoreHorizontal,
  CheckCircle2, Circle, Clock, AlertCircle
} from "lucide-react";
import { Project, Task } from "../types";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "motion/react";

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchProject();
    fetchTasks();
  }, [id]);

  const fetchProject = async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    const current = data.find((p: Project) => p.id === Number(id));
    setProject(current);
  };

  const fetchTasks = async () => {
    const res = await fetch(`/api/projects/${id}/tasks`);
    const data = await res.json();
    setTasks(data);
    setLoading(false);
  };

  const addTask = async () => {
    const newTask = {
      title: "Nueva Tarea",
      assignee: "",
      category: "",
      address: "",
      province: "",
      status: "Pendiente",
      priority: "Pendiente",
      prl: "Pendiente",
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      progress: 0,
      puestos_maquetados: 0,
      traslados_internos: 0,
      traslados_externos: 0,
      equipos_embalados: 0,
      comments: ""
    };
    const res = await fetch(`/api/projects/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTask),
    });
    if (res.ok) fetchTasks();
  };

  const updateTask = async (taskId: number, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updatedTask = { ...task, ...updates };
    await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedTask),
    });
    setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
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
    const findValue = (item: any, aliases: string[]) => {
      const key = Object.keys(item).find(k => 
        aliases.some(alias => k.toLowerCase().trim() === alias.toLowerCase().trim())
      );
      if (!key) return undefined;
      const val = item[key];
      if (val instanceof Date) {
        return val.toISOString().split('T')[0];
      }
      return val;
    };

    const formattedTasks = data.map(item => ({
      title: findValue(item, ['title', 'inc', 'nombre', 'name', 'titulo', 'tarea', 'asunto']) || "Tarea Importada",
      assignee: findValue(item, ['assignee', 'ofic', 'oficina', 'asignado', 'tecnico', 'técnico', 'responsable']) || "",
      category: findValue(item, ['category', 'localidad', 'ciudad', 'city', 'categoria', 'categoría', 'poblacion', 'población']) || "",
      address: findValue(item, ['address', 'direccion', 'dirección', 'ubicacion', 'ubicación', 'calle']) || "",
      province: findValue(item, ['province', 'provincia', 'region', 'región']) || "",
      status: findValue(item, ['status', 'estado', 'situacion', 'situación']) || "Pendiente",
      priority: findValue(item, ['priority', 'inventario', 'prioridad', 'importancia']) || "Pendiente",
      prl: findValue(item, ['prl', 'seguridad', 'prevencion', 'prevención']) || "Pendiente",
      start_date: findValue(item, ['start_date', 'fecha inicio', 'inicio', 'start', 'fecha']) || "",
      end_date: findValue(item, ['end_date', 'fecha fin', 'fin', 'end', 'finalizacion', 'finalización']) || "",
      progress: parseInt(findValue(item, ['progress', 'progreso', 'porcentaje', '%']) || "0"),
      puestos_maquetados: parseInt(findValue(item, ['puestos_maquetados', 'puestos', 'maquetados', 'maquetado']) || "0"),
      traslados_internos: parseInt(findValue(item, ['traslados_internos', 'internos', 'traslado interno']) || "0"),
      traslados_externos: parseInt(findValue(item, ['traslados_externos', 'externos', 'traslado externo']) || "0"),
      equipos_embalados: parseInt(findValue(item, ['equipos_embalados', 'embalados', 'embalaje']) || "0"),
      comments: findValue(item, ['comments', 'comentarios', 'notas', 'observaciones', 'detalle']) || ""
    }));

    try {
      setImporting(true);
      const res = await fetch(`/api/projects/${id}/tasks/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedTasks),
      });
      if (!res.ok) throw new Error("Error al importar datos");
      fetchTasks();
      alert(`Importación completada: ${formattedTasks.length} tareas añadidas.`);
    } catch (error) {
      console.error("Import error:", error);
      alert("Hubo un error al importar el archivo. Por favor, revisa el formato.");
    } finally {
      setImporting(false);
    }
  };

  const exportToCSV = () => {
    const csv = Papa.unparse(tasks);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${project?.name}_tasks.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.assignee.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="p-12 font-sans text-sm text-slate-500 animate-pulse">Cargando Datos de la Misión...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-slate-50">
      {/* Detail Header */}
      <div className="p-6 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="p-2 transition-colors rounded-md hover:bg-slate-100 text-slate-400">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono font-bold bg-blue-700 text-white px-2 py-0.5 tracking-widest rounded-sm">
                ID: {project?.code || project?.id.toString().padStart(3, '0')}
              </span>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{project?.name}</h1>
              <span className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-widest border rounded-full ${project?.status === 'active' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-slate-400 text-slate-500 bg-slate-50'}`}>
                {project?.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">{project?.description}</p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex gap-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar tareas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-50 border border-slate-200 pl-9 pr-4 py-2 text-xs rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 transition-all"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={deleteProject}
              className="flex items-center gap-2 px-4 py-2 border border-red-100 text-red-600 hover:bg-red-50 transition-all text-[10px] font-bold uppercase tracking-widest rounded-md"
            >
              <Trash2 size={14} /> Borrar Proyecto
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImport} 
              className="hidden" 
              accept=".csv,.xlsx,.xls"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className={`flex items-center gap-2 px-4 py-2 border border-slate-200 hover:border-blue-700 text-slate-700 transition-all text-[10px] font-bold uppercase tracking-widest rounded-md ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Upload size={14} className={importing ? 'animate-bounce' : ''} /> 
              {importing ? 'Importando...' : 'Importar'}
            </button>
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:border-blue-700 text-slate-700 transition-all text-[10px] font-bold uppercase tracking-widest rounded-md"
            >
              <Download size={14} /> Exportar
            </button>
            <button 
              onClick={addTask}
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white transition-all text-[10px] font-bold uppercase tracking-widest rounded-md shadow-sm"
            >
              <Plus size={14} /> Añadir Tarea
            </button>
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="min-w-[1000px] p-6">
          {/* Grid Header */}
          <div className="data-row bg-slate-200/50 sticky top-0 z-10 border-b border-slate-300 rounded-t-lg">
            <div className="col-header text-slate-500">#</div>
            <div className="col-header text-slate-500">INC</div>
            <div className="col-header text-slate-500">Ofic.</div>
            <div className="col-header text-slate-500">Localidad</div>
            <div className="col-header text-slate-500">Dirección</div>
            <div className="col-header text-slate-500">Provincia</div>
            <div className="col-header text-slate-500">Estado</div>
            <div className="col-header text-slate-500">Inventario</div>
            <div className="col-header text-slate-500">PRL</div>
            <div className="col-header text-slate-500">Fecha Cliente/Bigmatic</div>
            <div className="col-header text-slate-500"></div>
            <div className="col-header text-right text-slate-500">Acc.</div>
          </div>

          {/* Grid Body */}
          <AnimatePresence initial={false}>
            {filteredTasks.map((task, idx) => (
              <React.Fragment key={task.id}>
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className={`data-row group transition-colors hover:bg-white ${expandedTaskId === task.id ? 'bg-blue-50/30' : ''} border-b border-slate-100`}
                >
                  <div 
                    className="data-value text-slate-300 cursor-pointer hover:text-blue-600 transition-all font-bold"
                    onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                  >
                    {idx + 1}
                  </div>
                  <div className="pr-2">
                  <input 
                    type="text"
                    value={task.title}
                    disabled={task.status === 'Cerrado'}
                    onChange={(e) => updateTask(task.id, { title: e.target.value })}
                    className={`w-full bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500/20 focus:outline-none p-0.5 font-bold tracking-tight text-slate-900 ${task.status === 'Cerrado' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder="INC000000000000"
                  />
                </div>
                <div className="pr-2">
                  <input 
                    type="text"
                    value={task.assignee}
                    disabled={task.status === 'Cerrado'}
                    maxLength={4}
                    onChange={(e) => updateTask(task.id, { assignee: e.target.value })}
                    className={`w-full bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500/20 focus:outline-none p-0.5 data-value text-slate-600 ${task.status === 'Cerrado' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder="0000"
                  />
                </div>
                <div className="pr-2">
                  <input 
                    type="text"
                    value={task.category}
                    disabled={task.status === 'Cerrado'}
                    onChange={(e) => updateTask(task.id, { category: e.target.value })}
                    className={`w-full bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500/20 focus:outline-none p-0.5 data-value text-slate-600 ${task.status === 'Cerrado' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder="LOCALIDAD"
                  />
                </div>
                <div className="pr-2">
                  <input 
                    type="text"
                    value={task.address}
                    disabled={task.status === 'Cerrado'}
                    onChange={(e) => updateTask(task.id, { address: e.target.value })}
                    className={`w-full bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500/20 focus:outline-none p-0.5 data-value text-[10px] font-bold text-slate-500 ${task.status === 'Cerrado' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder="DIRECCIÓN"
                  />
                </div>
                <div className="pr-2">
                  <input 
                    type="text"
                    value={task.province}
                    disabled={task.status === 'Cerrado'}
                    onChange={(e) => updateTask(task.id, { province: e.target.value })}
                    className={`w-full bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500/20 focus:outline-none p-0.5 data-value text-[10px] font-bold text-slate-500 ${task.status === 'Cerrado' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder="PROVINCIA"
                  />
                </div>
                <div className="pr-2">
                  <select 
                    value={task.status}
                    onChange={(e) => updateTask(task.id, { status: e.target.value as any })}
                    className="bg-transparent focus:bg-white focus:outline-none p-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer w-full text-slate-700"
                  >
                    <option value="Pendiente">○ PENDIENTE</option>
                    <option value="Cerrado">● CERRADO</option>
                    <option value="Incidencia">✕ INCIDENCIA</option>
                  </select>
                </div>
                <div className="pr-2">
                  <select 
                    value={task.priority}
                    disabled={task.status === 'Cerrado'}
                    onChange={(e) => updateTask(task.id, { priority: e.target.value as any })}
                    className={`bg-transparent focus:bg-white focus:outline-none p-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer w-full ${
                      task.priority === 'Enviado' ? 'text-emerald-600' : 'text-slate-600'
                    } ${task.status === 'Cerrado' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <option value="Pendiente">PENDIENTE</option>
                    <option value="Enviado">ENVIADO</option>
                  </select>
                </div>
                <div className="pr-2">
                  <select 
                    value={task.prl}
                    disabled={task.status === 'Cerrado'}
                    onChange={(e) => updateTask(task.id, { prl: e.target.value as any })}
                    className={`bg-transparent focus:bg-white focus:outline-none p-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer w-full ${
                      task.prl === 'Enviado' ? 'text-emerald-600' : 'text-slate-600'
                    } ${task.status === 'Cerrado' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <option value="Pendiente">PENDIENTE</option>
                    <option value="Enviado">ENVIADO</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 data-value text-[10px] text-slate-500">
                  <input 
                    type="date" 
                    value={task.start_date}
                    disabled={task.status === 'Cerrado'}
                    onChange={(e) => updateTask(task.id, { start_date: e.target.value })}
                    className={`bg-transparent focus:outline-none ${task.status === 'Cerrado' ? 'cursor-not-allowed' : ''}`}
                  />
                  <span className="text-slate-300">→</span>
                  <input 
                    type="date" 
                    value={task.end_date}
                    disabled={task.status === 'Cerrado'}
                    onChange={(e) => updateTask(task.id, { end_date: e.target.value })}
                    className={`bg-transparent focus:outline-none ${task.status === 'Cerrado' ? 'cursor-not-allowed' : ''}`}
                  />
                </div>
                <div></div>
                <div className="flex justify-end pr-2">
                  <button 
                    onClick={() => deleteTask(task.id)}
                    disabled={task.status === 'Cerrado'}
                    className={`p-2 transition-all rounded-md hover:bg-red-50 text-slate-300 hover:text-red-600 ${task.status === 'Cerrado' ? 'opacity-20 cursor-not-allowed' : ''}`}
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
                  className="bg-blue-50/20 border-b border-slate-200 overflow-hidden"
                >
                  <div className="py-3 px-4 ml-12 flex flex-wrap items-center gap-x-8 gap-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Puestos Maquetados</label>
                      <input 
                        type="number"
                        min="0"
                        max="9"
                        value={task.puestos_maquetados}
                        disabled={task.status === 'Cerrado'}
                        onChange={(e) => updateTask(task.id, { puestos_maquetados: Math.min(9, parseInt(e.target.value) || 0) })}
                        className="w-10 bg-white border border-slate-200 rounded px-1 py-0.5 data-value text-center focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Traslados Internos</label>
                      <input 
                        type="number"
                        min="0"
                        max="9"
                        value={task.traslados_internos}
                        disabled={task.status === 'Cerrado'}
                        onChange={(e) => updateTask(task.id, { traslados_internos: Math.min(9, parseInt(e.target.value) || 0) })}
                        className="w-10 bg-white border border-slate-200 rounded px-1 py-0.5 data-value text-center focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Traslados Externos</label>
                      <input 
                        type="number"
                        min="0"
                        max="9"
                        value={task.traslados_externos}
                        disabled={task.status === 'Cerrado'}
                        onChange={(e) => updateTask(task.id, { traslados_externos: Math.min(9, parseInt(e.target.value) || 0) })}
                        className="w-10 bg-white border border-slate-200 rounded px-1 py-0.5 data-value text-center focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Equipos Embalados</label>
                      <input 
                        type="number"
                        min="0"
                        max="9"
                        value={task.equipos_embalados}
                        disabled={task.status === 'Cerrado'}
                        onChange={(e) => updateTask(task.id, { equipos_embalados: Math.min(9, parseInt(e.target.value) || 0) })}
                        className="w-10 bg-white border border-slate-200 rounded px-1 py-0.5 data-value text-center focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="flex-1 flex items-center gap-2 min-w-[200px]">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Comentarios</label>
                      <input 
                        type="text"
                        value={task.comments}
                        disabled={task.status === 'Cerrado'}
                        onChange={(e) => updateTask(task.id, { comments: e.target.value })}
                        className="flex-1 bg-white border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder="Notas..."
                      />
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
      <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center text-[10px] font-mono uppercase tracking-widest text-slate-400">
        <div className="flex gap-6">
          <span>Total de Tareas: {tasks.length}</span>
          <span className="text-slate-500">Cerradas: {tasks.filter(t => t.status === 'Cerrado').length}</span>
          <span className="text-red-400">Incidencias: {tasks.filter(t => t.status === 'Incidencia').length}</span>
        </div>
        <div>
          Última Sincronización: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
