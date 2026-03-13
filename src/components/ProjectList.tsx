import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Archive, Folder, ArrowRight, X } from "lucide-react";
import { Project } from "../types";
import { motion, AnimatePresence } from "motion/react";
import ConfirmDialog from "./ConfirmDialog";

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "", code: "" });
  const [dbStatus, setDbStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [dbError, setDbError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; projectId: number | null }>({
    isOpen: false,
    projectId: null
  });

  useEffect(() => {
    fetchProjects();
    checkDbHealth();
  }, []);

  const checkDbHealth = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch("/api/health", { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        setDbStatus('ok');
        setDbError(null);
      } else {
        const data = await res.json();
        setDbStatus('error');
        setDbError(data.message || 'Error de conexión');
      }
    } catch (e: any) {
      setDbStatus('error');
      setDbError(e.name === 'AbortError' ? 'Tiempo de espera agotado' : 'Error de red');
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(data);
      } else {
        console.error("Data is not an array:", data);
        setProjects([]);
      }
    } catch (e) {
      console.error("Failed to fetch projects:", e);
      setProjects([]);
    }
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProject),
      });
      if (res.ok) {
        fetchProjects();
        setIsModalOpen(false);
        setNewProject({ name: "", description: "", code: "" });
      } else {
        const errorData = await res.json();
        console.error("Error creating project:", errorData);
        alert("Error al crear el proyecto: " + (errorData.error || "Error desconocido"));
      }
    } catch (error) {
      console.error("Network error creating project:", error);
      alert("Error de red al crear el proyecto");
    }
  };

  const deleteProject = async (id: number) => {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    fetchProjects();
  };

  const archiveProject = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'archived' : 'active';
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchProjects();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto bg-slate-950 min-h-screen">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Gestión de Proyectos</h1>
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-400">Operaciones Activas y Archivos de Bigmatic</p>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
              dbStatus === 'ok' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50' : 
              dbStatus === 'error' ? 'bg-rose-900/30 text-rose-400 border-rose-800/50' : 
              'bg-slate-900 text-slate-500 border-slate-800'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                dbStatus === 'ok' ? 'bg-emerald-500 animate-pulse' : 
                dbStatus === 'error' ? 'bg-rose-500' : 
                'bg-slate-600'
              }`} />
              {dbStatus === 'ok' ? 'DB Online' : dbStatus === 'error' ? 'DB Offline' : 'Checking DB...'}
            </div>
            {dbStatus === 'error' && (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  setDbStatus('loading');
                  checkDbHealth();
                  fetchProjects();
                }}
                className="text-[9px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-tighter underline"
              >
                Reintentar
              </button>
            )}
            {dbStatus === 'error' && dbError && (
              <span className="text-[9px] text-rose-400/70 font-medium animate-fade-in truncate max-w-[200px]">
                {dbError}
              </span>
            )}
          </div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-all active:scale-95 text-xs font-bold tracking-widest shadow-lg shadow-blue-900/20"
        >
          <Plus size={16} /> Nuevo Proyecto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {Array.isArray(projects) && projects.map((project) => (
            <motion.div
              key={project.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`group relative bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between min-h-[220px] transition-all hover:shadow-2xl hover:border-blue-500/50 rounded-xl ${project.status === 'archived' ? 'opacity-40 grayscale bg-slate-900/50' : ''}`}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono font-bold text-slate-500 mb-1 tracking-widest uppercase">ID: {project.code || project.id.toString().padStart(3, '0')}</span>
                    <div className="bg-blue-900/30 p-2 rounded-lg w-fit text-blue-400 border border-blue-800/50">
                      <Folder size={20} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        archiveProject(project.id, project.status);
                      }}
                      className="p-2 transition-colors rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300"
                      title={project.status === 'active' ? 'Archivar' : 'Desarchivar'}
                    >
                      <Archive size={14} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        setConfirmDelete({ isOpen: true, projectId: project.id });
                      }}
                      className="p-2 transition-colors rounded-lg hover:bg-rose-900/30 text-slate-500 hover:text-rose-400"
                      title="Borrar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">{project.name}</h3>
                <p className="text-sm text-slate-400 line-clamp-2 mb-4">{project.description || "Sin descripción proporcionada."}</p>
              </div>
              
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 uppercase">
                  {new Date(project.created_at).toLocaleDateString()}
                </span>
                <Link 
                  to={`/project/${project.id}`}
                  className="flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-all"
                >
                  Abrir <ArrowRight size={14} />
                </Link>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* New Project Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative z-10 bg-slate-900 w-full max-w-md p-8 border border-slate-800 shadow-2xl rounded-2xl"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-500"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Crear Nuevo Proyecto</h2>
              
              <form onSubmit={createProject} className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Nombre del Proyecto</label>
                    <input 
                      autoFocus
                      required
                      type="text"
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-600"
                      placeholder="Ej. PROYECTO_ALPHA"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Código</label>
                    <input 
                      type="text"
                      value={newProject.code}
                      onChange={(e) => setNewProject({ ...newProject, code: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-600"
                      placeholder="ALPHA"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Descripción</label>
                  <textarea 
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[100px] placeholder:text-slate-600"
                    placeholder="Objetivos de la misión..."
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-lg font-bold uppercase tracking-widest text-xs transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
                >
                  Crear Proyecto
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, projectId: null })}
        onConfirm={() => {
          if (confirmDelete.projectId) {
            deleteProject(confirmDelete.projectId);
          }
        }}
        title="¿Borrar Proyecto?"
        message="Esta acción eliminará permanentemente el proyecto y todas sus tareas asociadas. Esta operación no se puede deshacer."
        confirmText="Borrar Proyecto"
        variant="danger"
      />
    </div>
  );
}
