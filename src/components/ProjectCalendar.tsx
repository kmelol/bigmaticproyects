import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, ChevronRight } from "lucide-react";
import { Project } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { getWeekRange } from "../utils/dateUtils";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const WEEKS = [
  { id: 1, name: "1ª Semana" },
  { id: 2, name: "2ª Semana" },
  { id: 3, name: "3ª Semana" },
  { id: 4, name: "4ª Semana" },
  { id: 5, name: "5ª Semana" }
];

export default function ProjectCalendar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  useEffect(() => {
    fetchProject();
  }, [id]);

  const fetchProject = async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    const current = data.find((p: Project) => p.id === Number(id));
    setProject(current);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto bg-slate-950 min-h-screen">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/" className="p-2 transition-colors rounded-md hover:bg-slate-800 text-slate-500">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{project?.name}</h1>
          <p className="text-sm text-slate-400">Selecciona el periodo de tiempo para gestionar las tareas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {MONTHS.map((month, index) => (
          <div key={month} className="flex flex-col gap-2">
            <button
              onClick={() => setSelectedMonth(selectedMonth === index + 1 ? null : index + 1)}
              className={`p-6 rounded-xl border transition-all flex flex-col items-center justify-center gap-3 group ${
                selectedMonth === index + 1 
                  ? "bg-blue-600 border-blue-600 text-white shadow-lg scale-105" 
                  : "bg-slate-900 border-slate-800 text-slate-300 hover:border-blue-500/50 hover:shadow-2xl"
              }`}
            >
              <Calendar size={24} className={selectedMonth === index + 1 ? "text-white" : "text-blue-400 group-hover:scale-110 transition-transform"} />
              <span className="font-bold uppercase tracking-widest text-xs">{month}</span>
            </button>

            <AnimatePresence>
              {selectedMonth === index + 1 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden flex flex-col gap-1 mt-1"
                >
                  {WEEKS.map((week) => (
                    <button
                      key={week.id}
                      onClick={() => navigate(`/project/${id}/tasks?month=${index + 1}&week=${week.id}`)}
                      className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-800 hover:border-blue-500/50 hover:text-blue-400 transition-all group"
                    >
                      <div className="flex flex-col items-start gap-0.5">
                        <span>{week.name}</span>
                        <span className="text-[9px] text-slate-500 font-mono lowercase tracking-normal">({getWeekRange(index, week.id)})</span>
                      </div>
                      <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
