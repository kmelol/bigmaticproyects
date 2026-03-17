import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { 
  ArrowLeft, Plus, Download, Trash2, 
  ChevronDown, Search, Filter, MoreHorizontal,
  CheckCircle2, Circle, Clock, AlertCircle,
  X, Check, Settings, Eye, EyeOff
} from "lucide-react";
import { Project, Task } from "../types";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "motion/react";
import ConfirmDialog from "./ConfirmDialog";
import { getWeekRange, getMonthAndWeekFromDate, parseDate, findDateAndRelocate } from "../utils/dateUtils";

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

  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteInput, setPasteInput] = useState("");
  const [importing, setImporting] = useState(false);

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
        "Ticket cliente": "T-NEW",
        "Sitio": "",
        "Población": "",
        "Provincia": "",
        "Fecha SLA": ""
      },
      status: "abierta"
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
    
    const allowedFields = [
      'Ticket cliente', 'Fecha SLA', 'Sitio', 'Población', 'Provincia'
    ];

    let cleanDynamicData = task.dynamic_data;
    if (updates.dynamic_data) {
      cleanDynamicData = { ...task.dynamic_data };
      Object.keys(updates.dynamic_data).forEach(key => {
        if (allowedFields.includes(key)) {
          cleanDynamicData[key] = updates.dynamic_data[key];
        }
      });
    }

    const updatedTask = { 
      ...task, 
      ...updates,
      dynamic_data: cleanDynamicData
    };

    // Auto-relocation logic based on date detection in the FULL dynamic_data
    const relocation = findDateAndRelocate(updatedTask.dynamic_data);
    if (relocation && (relocation.month !== task.month || relocation.week !== task.week)) {
      updatedTask.month = relocation.month;
      updatedTask.week = relocation.week;
      console.log(`Tarea reubicada a Mes ${relocation.month}, Semana ${relocation.week}`);
    }

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

  const handlePasteImport = async () => {
    if (!pasteInput.trim()) return;
    if (!id) {
      alert("Error: No se ha podido identificar el proyecto.");
      return;
    }

    try {
      setImporting(true);
      
      // Normalización inicial
      const normalizedInput = pasteInput.trim().replace(/\r\n/g, '\n');
      const lines = normalizedInput.split('\n').map(l => l.trim()).filter(l => l !== "");
      
      if (lines.length === 0) return;

      // Mapeo de cabeceras conocidas
      const knownHeaders = {
        "Ticket cliente": ["ticket", "id", "incidencia", "nº", "numero", "ref", "inc"],
        "Fecha SLA": ["fecha", "sla", "vencimiento", "dia", "date", "vence", "vto"],
        "Sitio": ["sitio", "centro", "tienda", "local", "site", "nombre", "ubicacion", "ubicación"],
        "Población": ["población", "poblacion", "ciudad", "municipio", "town", "city", "pueblo"],
        "Provincia": ["provincia", "region", "province", "prov"]
      };

      const PROVINCIAS = [
        "Álava", "Albacete", "Alicante", "Almería", "Asturias", "Ávila", "Badajoz", "Barcelona", "Burgos", "Cáceres",
        "Cádiz", "Cantabria", "Castellón", "Ciudad Real", "Córdoba", "Cuenca", "Gerona", "Granada", "Guadalajara",
        "Guipúzcoa", "Huelva", "Huesca", "Islas Baleares", "Jaén", "La Coruña", "La Rioja", "Las Palmas", "León",
        "Lérida", "Lugo", "Madrid", "Málaga", "Murcia", "Navarra", "Orense", "Palencia", "Pontevedra", "Salamanca",
        "Santa Cruz de Tenerife", "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo", "Valencia",
        "Valladolid", "Vizcaya", "Zamora", "Zaragoza", "Ceuta", "Melilla"
      ].map(p => p.toLowerCase());

      let colMapping: Record<string, number> = {};
      let startLine = 0;

      // 1. Intentar detectar cabeceras en la primera línea
      const firstLineCols = lines[0].split(/\t| {2,}/).map(s => s.trim().toLowerCase());
      let headersFound = 0;

      Object.entries(knownHeaders).forEach(([field, variations]) => {
        const idx = firstLineCols.findIndex(col => 
          variations.some(v => col.includes(v))
        );
        if (idx !== -1) {
          colMapping[field] = idx;
          headersFound++;
        }
      });

      // 2. Si no hay suficientes cabeceras, analizar contenido de las primeras líneas
      if (headersFound < 3) {
        const sampleRows = lines.slice(0, 5).map(line => line.split(/\t| {2,}/).map(s => s.trim()));
        const numCols = sampleRows[0].length;
        const scores: Record<string, number[]> = {
          "Ticket cliente": Array(numCols).fill(0),
          "Fecha SLA": Array(numCols).fill(0),
          "Provincia": Array(numCols).fill(0),
          "Sitio": Array(numCols).fill(0),
          "Población": Array(numCols).fill(0)
        };

        sampleRows.forEach(cols => {
          cols.forEach((val, idx) => {
            if (!val) return;
            const lowerVal = val.toLowerCase();
            
            // Score Ticket
            if (/^(INC|T-|[A-Z]{2,}\d+)/i.test(val)) scores["Ticket cliente"][idx] += 5;
            else if (val.length > 4 && /^\d+$/.test(val)) scores["Ticket cliente"][idx] += 2;
            
            // Score Fecha
            if (parseDate(val) !== null) scores["Fecha SLA"][idx] += 5;
            
            // Score Provincia
            if (PROVINCIAS.some(p => lowerVal === p || lowerVal.includes(p))) scores["Provincia"][idx] += 5;

            // Score Sitio (Heurística: palabras comunes en centros)
            if (/(tienda|centro|local|site|hospital|oficina|nave|poligono|polígono|cc|c\.c\.)/i.test(val)) scores["Sitio"][idx] += 2;
          });
        });

        // Asignar columnas por puntuación más alta
        const assignedCols = new Set<number>();
        const fields = ["Fecha SLA", "Ticket cliente", "Provincia", "Sitio", "Población"];
        
        fields.forEach(field => {
          let bestIdx = -1;
          let maxScore = -1;
          scores[field].forEach((score, idx) => {
            if (!assignedCols.has(idx) && score > maxScore) {
              maxScore = score;
              bestIdx = idx;
            }
          });
          if (bestIdx !== -1 && maxScore > 0) {
            colMapping[field] = bestIdx;
            assignedCols.add(bestIdx);
          }
        });

        // Rellenar huecos por orden lógico si faltan
        const remainingFields = fields.filter(f => colMapping[f] === undefined);
        const remainingCols = Array.from({length: numCols}, (_, i) => i).filter(i => !assignedCols.has(i));
        
        remainingFields.forEach(field => {
          if (remainingCols.length > 0) {
            colMapping[field] = remainingCols.shift()!;
          }
        });

        // Comprobar si la primera línea es un header (contiene palabras clave de cabecera)
        const firstLineIsHeader = firstLineCols.some(col => 
          Object.values(knownHeaders).flat().some(v => col === v || col.includes(v))
        );
        if (firstLineIsHeader) startLine = 1;

      } else {
        startLine = 1;
      }

      // 1. Obtener todos los tickets existentes en el proyecto para evitar duplicados
      let existingTickets = new Set<string>();
      try {
        const res = await fetch(`/api/projects/${id}/tasks`);
        const allTasks = await res.json();
        if (Array.isArray(allTasks)) {
          allTasks.forEach((t: any) => {
            if (t.dynamic_data && t.dynamic_data["Ticket cliente"]) {
              existingTickets.add(t.dynamic_data["Ticket cliente"].toString().trim().toUpperCase());
            }
          });
        }
      } catch (error) {
        console.error("Error al verificar duplicados:", error);
      }

      const tasksToImport: any[] = [];
      let currentTask: any = null;
      const ticketsInBatch = new Set<string>();
      let discardedCount = 0;

      const IGNORE_REGEX = [
        /^(abierta|cerrada|incidencia|normal|baja|media|alta|asignada|en curso|pendiente|validar|validación|resuelta|reabierta|incidencia|usuario|operativo|máquina|maquina|equipo|avería|averia|fallo|error|problema)$/i,
        /^[A-Z]\d+(_\d+)?$/i, // IDs como I2026_042903 o T12345
        /^\d{5,}$/,           // Números largos
        /^[A-Z]{1,2}$/i,      // Códigos de 1-2 letras solos
        /^TF\s+/i             // Ignorar nombres que empiecen por TF (según petición usuario)
      ];

      const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const normalizedProvincias = PROVINCIAS.map(p => normalize(p));

      // Función para limpiar valores (quitar comillas, espacios extra, etc)
      const cleanValue = (val: string) => {
        if (!val) return "";
        return val.trim().replace(/^["']|["']$/g, '').trim();
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Split por tabuladores o múltiples espacios
        const cols = line.split(/\t| {2,}/).map(s => cleanValue(s)).filter(s => s !== "");
        
        // Detectar si esta línea inicia una nueva tarea (contiene un Ticket INC...)
        const ticketIdx = cols.findIndex(c => /^(INC|T-|[A-Z]{2,}\d+)/i.test(c));

        if (ticketIdx !== -1) {
          const ticketValue = cols[ticketIdx];
          const ticketUpper = ticketValue.toUpperCase();

          // Si el ticket ya existe en el proyecto o en este lote, ignoramos este bloque
          if (existingTickets.has(ticketUpper) || ticketsInBatch.has(ticketUpper)) {
            currentTask = null; // Reset para ignorar líneas siguientes de este ticket
            discardedCount++;
            continue;
          }

          if (currentTask) tasksToImport.push(currentTask);

          ticketsInBatch.add(ticketUpper);
          currentTask = {
            dynamic_data: {
              "Ticket cliente": ticketValue,
              "Fecha SLA": "",
              "Sitio": "",
              "Población": "",
              "Provincia": ""
            }
          };

          // Procesar el resto de la línea del ticket para buscar la fecha SLA (la más lejana)
          cols.forEach((val, idx) => {
            if (idx === ticketIdx) return;
            const date = parseDate(val);
            if (date) {
              const currentSLA = currentTask.dynamic_data["Fecha SLA"];
              if (!currentSLA) {
                currentTask.dynamic_data["Fecha SLA"] = val;
              } else {
                const existingDate = parseDate(currentSLA);
                if (existingDate && date > existingDate) {
                  currentTask.dynamic_data["Fecha SLA"] = val;
                }
              }
            }
          });
        } else if (currentTask) {
          // Rellenar campos en líneas subsiguientes
          cols.forEach(val => {
            const cleanVal = cleanValue(val);
            if (!cleanVal) return;

            // Filtro agresivo para descripciones: 
            // Si tiene muchas palabras y no tiene números ni paréntesis, es una descripción
            const words = cleanVal.split(/\s+/);
            if (words.length > 4 && !/\d/.test(cleanVal) && !cleanVal.includes('(')) return;
            
            // Filtro por palabras clave prohibidas
            if (IGNORE_REGEX.some(re => re.test(cleanVal))) return;
            // También comprobar si alguna palabra individual está en la lista de ignorados
            if (words.some(w => IGNORE_REGEX.some(re => re.test(w) && re.source.startsWith('^(')))) return;

            const norm = normalize(cleanVal);
            const date = parseDate(cleanVal);

            // 1. Provincia / Población (Detección geográfica)
            if (normalizedProvincias.includes(norm)) {
              if (!currentTask.dynamic_data["Provincia"]) {
                currentTask.dynamic_data["Provincia"] = cleanVal;
              } else if (!currentTask.dynamic_data["Población"]) {
                currentTask.dynamic_data["Población"] = cleanVal;
              }
              return;
            }

            // 2. Fecha SLA (Siempre preferimos la fecha más tardía del bloque)
            if (date) {
              const currentSLA = currentTask.dynamic_data["Fecha SLA"];
              if (!currentSLA) {
                currentTask.dynamic_data["Fecha SLA"] = val;
              } else {
                const existingDate = parseDate(currentSLA);
                if (existingDate && date > existingDate) {
                  currentTask.dynamic_data["Fecha SLA"] = val;
                }
              }
              return;
            }

            // 3. Sitio (Si tiene paréntesis es la dirección, que es lo que el usuario quiere priorizar)
            if (cleanVal.includes('(') || cleanVal.includes(')')) {
              currentTask.dynamic_data["Sitio"] = cleanVal;
              return;
            }

            // 4. Asignación por descarte (Sitio -> Población)
            if (!currentTask.dynamic_data["Sitio"]) {
              currentTask.dynamic_data["Sitio"] = cleanVal;
            } else if (!currentTask.dynamic_data["Población"]) {
              currentTask.dynamic_data["Población"] = cleanVal;
            }
          });
        }
      }

      if (currentTask) tasksToImport.push(currentTask);

      const finalTasks = tasksToImport.map(t => {
        let taskMonth = month;
        let taskWeek = week;
        const relocation = findDateAndRelocate(t.dynamic_data);
        if (relocation) {
          taskMonth = relocation.month;
          taskWeek = relocation.week;
        }
        return { ...t, status: "abierta", month: taskMonth, week: taskWeek };
      });

      if (finalTasks.length === 0) {
        if (discardedCount > 0) {
          alert(`No se han añadido nuevas tareas. Se detectaron ${discardedCount} tareas que ya existían en el proyecto.`);
        } else {
          alert("No se han detectado tareas válidas. Asegúrate de incluir el número de Ticket (INC...).");
        }
        setIsPasteModalOpen(false);
        setPasteInput("");
        setImporting(false);
        return;
      }

      const summary: Record<string, number> = {};
      finalTasks.forEach(t => {
        const key = `Mes ${t.month}, Sem ${t.week}`;
        summary[key] = (summary[key] || 0) + 1;
      });

      const res = await fetch(`/api/projects/${id}/tasks/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, week, tasks: finalTasks }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Error en el servidor");
      }

      await fetchTasks();
      setIsPasteModalOpen(false);
      setPasteInput("");
      
      const summaryText = Object.entries(summary)
        .map(([key, count]) => `${count} en ${key}`)
        .join("\n");
      
      let finalMsg = `¡Importación exitosa!\nTotal: ${finalTasks.length} tareas añadidas.`;
      if (discardedCount > 0) {
        finalMsg += `\n\nNota: Se han omitido ${discardedCount} tareas que ya existían en el proyecto (duplicadas).`;
      }
      finalMsg += `\n\nDistribución:\n${summaryText}`;
      
      alert(finalMsg);
      
    } catch (error: any) {
      alert("Error durante la importación: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  const exportToExcel = () => {
    const exportData = tasks.map((t, idx) => {
      const data = t.dynamic_data || {};
      
      // Campos del esquema estándar + campos de verificación
      const row: any = {
        '#': idx + 1,
        'Ticket cliente': data['Ticket cliente'] || '',
        'Sitio': data['Sitio'] || '',
        'Población': data['Población'] || '',
        'Provincia': data['Provincia'] || '',
        'Fecha SLA': data['Fecha SLA'] || '',
        'Fotos PRL': t.fotos_prl ? 'SÍ' : 'NO',
        'Inventario': t.inventario ? 'SÍ' : 'NO',
        'Comentarios': t.comentarios || '',
        'Estado': t.status === 'cerrada' ? 'CERRADA' : t.status === 'incidencia' ? 'INCIDENCIA' : 'ABIERTA'
      };

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tareas");
    
    // Formateo visual del Excel
    if (exportData.length > 0) {
      // Definir anchos de columna
      const colWidths = [
        { wch: 5 },   // #
        { wch: 20 },  // Ticket
        { wch: 35 },  // Sitio
        { wch: 20 },  // Población
        { wch: 15 },  // Provincia
        { wch: 15 },  // Fecha SLA
        { wch: 12 },  // Fotos PRL
        { wch: 12 },  // Inventario
        { wch: 40 },  // Comentarios
        { wch: 12 }   // Estado
      ];
      ws['!cols'] = colWidths;

      // Estilos básicos (aunque XLSX básico no soporta mucho sin plugins pesados, 
      // podemos asegurar que las cabeceras se vean bien en lectores modernos)
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + "1";
        if (!ws[address]) continue;
        // XLSX.utils.json_to_sheet ya pone las cabeceras en la fila 1
      }
    }

    XLSX.writeFile(wb, `${project?.name || 'Proyecto'}_${MONTH_NAMES[month-1]}_Semana${week}.xlsx`);
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

  const formatDateForDisplay = (val: any) => {
    if (!val) return "";
    // Check if it's a date string (YYYY-MM-DD or similar)
    const date = new Date(val);
    if (!isNaN(date.getTime()) && typeof val === 'string' && (val.includes('-') || val.includes('/'))) {
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    }
    return val;
  };

  const schemaOrder = [
    'Ticket cliente',
    'Sitio',
    'Población',
    'Provincia',
    'Fecha SLA'
  ];

  const allDynamicColumns = schemaOrder;
  
  const sortedDynamicColumns = [...allDynamicColumns];

  const dynamicColumns = sortedDynamicColumns.filter(col => !hiddenColumns.has(col));

  const gridTemplate = `40px ${dynamicColumns.length > 0 ? `repeat(${dynamicColumns.length}, minmax(150px, 1fr))` : '1fr'} 120px 60px`;

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
    // Client-side filter for month and week to handle optimistic updates correctly
    if (t.month !== month || t.week !== week) return false;

    const searchStr = search.toLowerCase();
    return Object.values(t.dynamic_data || {}).some(val => 
      String(val).toLowerCase().includes(searchStr)
    );
  }).sort((a, b) => {
    // Sort by Status (Closed tasks at the end)
    const statusA = a.status === 'cerrada' ? 1 : 0;
    const statusB = b.status === 'cerrada' ? 1 : 0;
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

  const currentPeriod = getMonthAndWeekFromDate(new Date());

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
              
              {/* Quick Week Navigation */}
              <div className="flex items-center gap-1 ml-4 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
                {[1, 2, 3, 4, 5].map(w => {
                  const isCurrentWeek = currentPeriod.month === month && currentPeriod.week === w;
                  return (
                    <button
                      key={w}
                      onClick={() => {
                        const params = new URLSearchParams(window.location.search);
                        params.set('week', w.toString());
                        window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
                        // Trigger re-render by updating state if we had it, but here we rely on URL
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all relative ${
                        week === w 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                          : isCurrentWeek
                            ? 'text-blue-400 bg-blue-900/20 border border-blue-500/30'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      S{w}
                      {isCurrentWeek && week !== w && (
                        <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
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

            <button 
              onClick={() => setIsPasteModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white transition-all text-[10px] font-bold uppercase tracking-widest rounded-lg shadow-lg shadow-emerald-900/20"
            >
              <Download size={14} className="rotate-180" /> Pegar Datos
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
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className="col-header">#</div>
            {dynamicColumns.length > 0 ? dynamicColumns.map(col => (
              <div key={col} className="col-header uppercase tracking-tighter flex items-center justify-between group/col px-2">
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
            )) : (
              <div className="col-header italic text-slate-600 px-2">Contenido de Tarea</div>
            )}
            <div className="col-header px-2">Estado</div>
            <div className="col-header text-right px-2">Acc.</div>
          </div>

          {/* Grid Body */}
          <AnimatePresence initial={false}>
            {filteredTasks.map((task, idx) => (
              <React.Fragment key={task.id}>
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`grid items-center border-b border-slate-800/50 p-3 transition-all cursor-pointer border-l-4 hover:brightness-125 ${
                    task.status === 'cerrada' 
                      ? 'bg-emerald-500/10 border-l-emerald-500 shadow-[inset_1px_0_0_0_rgba(16,185,129,0.1)]' 
                      : task.status === 'incidencia'
                        ? 'bg-rose-500/10 border-l-rose-500 shadow-[inset_1px_0_0_0_rgba(244,63,94,0.1)]'
                        : 'bg-slate-900/50 border-l-blue-500/50'
                  }`}
                  style={{ gridTemplateColumns: gridTemplate }}
                  onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                >
                  <div className={`text-[10px] font-bold ${
                    task.status === 'cerrada' ? 'text-emerald-500/50' : 
                    task.status === 'incidencia' ? 'text-rose-500/50' : 
                    'text-slate-600'
                  }`}>{idx + 1}</div>
                  {dynamicColumns.length > 0 ? dynamicColumns.map(col => (
                    <div key={col} className="px-2">
                      <input 
                        type="text"
                        value={formatDateForDisplay(task.dynamic_data[col] || "")}
                        onChange={(e) => updateTask(task.id, { dynamic_data: { [col]: e.target.value } })}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-full bg-transparent focus:bg-slate-800/50 focus:ring-1 focus:ring-blue-500/20 focus:outline-none p-1 text-xs rounded transition-all ${
                          task.status === 'cerrada' ? 'text-emerald-100/90' : 
                          task.status === 'incidencia' ? 'text-rose-100/90' : 
                          'text-slate-300'
                        }`}
                      />
                    </div>
                  )) : (
                    <div className="px-2 text-xs text-slate-500 italic">Sin datos dinámicos</div>
                  )}
                  
                  <div className="px-2" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={task.status}
                      onChange={(e) => updateTask(task.id, { status: e.target.value })}
                      className={`w-full bg-slate-950/50 border text-[10px] font-bold uppercase tracking-tighter rounded-md p-1 focus:outline-none transition-all cursor-pointer ${
                        task.status === 'cerrada' 
                          ? 'border-emerald-500/50 text-emerald-400' 
                          : task.status === 'incidencia'
                            ? 'border-rose-500/50 text-rose-400'
                            : 'border-blue-500/50 text-blue-400'
                      }`}
                    >
                      <option value="abierta" className="bg-slate-900 text-blue-400">Abierta</option>
                      <option value="cerrada" className="bg-slate-900 text-emerald-400">Cerrada</option>
                      <option value="incidencia" className="bg-slate-900 text-rose-400">Incidencia</option>
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
                    className="bg-slate-900/60 border-b border-slate-800 overflow-hidden"
                  >
                    <div className="py-3 px-6">
                      <div className="max-w-4xl mx-auto flex items-start gap-8">
                        {/* Left Side: Checkboxes */}
                        <div className="flex flex-col gap-3 pt-2 min-w-[140px]">
                          <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Verificaciones</p>
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div 
                              onClick={() => updateTask(task.id, { fotos_prl: !task.fotos_prl })}
                              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                task.fotos_prl 
                                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/20' 
                                  : 'bg-slate-800 border-slate-700 text-transparent group-hover:border-slate-500'
                              }`}
                            >
                              <Check size={12} strokeWidth={3} />
                            </div>
                            <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">Fotos PRL</span>
                          </label>

                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div 
                              onClick={() => updateTask(task.id, { inventario: !task.inventario })}
                              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                task.inventario 
                                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' 
                                  : 'bg-slate-800 border-slate-700 text-transparent group-hover:border-slate-500'
                              }`}
                            >
                              <Check size={12} strokeWidth={3} />
                            </div>
                            <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">Inventario</span>
                          </label>
                        </div>

                        {/* Right Side: Comments */}
                        <div className="flex-1 flex flex-col gap-1.5">
                          <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Comentarios Internos</span>
                          <textarea 
                            value={task.comentarios || ""}
                            onChange={(e) => updateTask(task.id, { comentarios: e.target.value })}
                            placeholder="Añadir notas sobre la intervención..."
                            className="w-full bg-slate-950/50 border border-slate-800/50 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30 min-h-[60px] transition-all placeholder:text-slate-800 custom-scrollbar shadow-inner"
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
        <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest text-slate-400">
          <div className="flex gap-6">
            <span>Total de Tareas: {Array.isArray(tasks) ? tasks.length : 0}</span>
          </div>
          <div>
            Última Sincronización: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isPasteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Importación Inteligente</h2>
                  <p className="text-xs text-slate-400 mt-1">Pega el contenido directamente desde tu portal o Excel.</p>
                </div>
                <button 
                  onClick={() => setIsPasteModalOpen(false)}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <textarea
                  value={pasteInput}
                  onChange={(e) => setPasteInput(e.target.value)}
                  placeholder={`Ejemplo de formato:\nINC000016203998\nI2026_042903\n17/03/2026 11:04\n18/03/2026 10:04\nAbierta\nTF Unicaja Micro\n(Av. de Madrid, 120)\nLeon\nLeón`}
                  className="w-full h-64 bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-700 custom-scrollbar"
                />

                <div className="bg-blue-900/10 border border-blue-900/30 rounded-xl p-4">
                  <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <AlertCircle size={12} /> Formato Inteligente
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    El sistema detectará automáticamente: <span className="text-blue-400 font-bold">Ticket, Sitio, Población, Provincia y Fecha SLA</span>. Puedes pegar bloques multi-línea.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setIsPasteModalOpen(false)}
                    className="px-4 py-2 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handlePasteImport}
                    disabled={!pasteInput.trim() || importing}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"
                  >
                    {importing ? <Clock size={14} className="animate-spin" /> : <Check size={14} />}
                    {importing ? 'Importando...' : 'Procesar e Importar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

    </div>
  );
}
