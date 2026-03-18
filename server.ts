import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || "https://xduqxyazymqvxdeqtazy.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdXF4eWF6eW1xdnhkZXF0YXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjAwODksImV4cCI6MjA4ODUzNjA4OX0.lE8gd0whhwPhEmXuBSnxZeuKXGbg9oe1-nU1LsEAYuo";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing Supabase configuration. Please check environment variables.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API routes go here
  app.get("/api/health", async (req, res) => {
    try {
      // Simple health check using Supabase client
      const { data, error } = await supabase.from('projects').select('count', { count: 'exact', head: true });
      if (error) {
        console.error("Supabase connection error in health check:", error);
        return res.status(500).json({ status: "error", message: `Supabase error: ${error.message}`, code: error.code });
      }
      res.json({ status: "ok", message: "Connected to Supabase via API" });
    } catch (error: any) {
      console.error("Health check failed:", error);
      res.status(500).json({ status: "error", message: error.message });
    }
  });

  // Auth API
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        return res.status(401).json({ error: "Credenciales incorrectas" });
      }

      res.json({ success: true, username: data.username });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Projects API
  app.get("/api/projects", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const { name, description, code } = req.body;
      const projectCode = code || name.substring(0, 4).toUpperCase().replace(/\s/g, '_');
      
      const { data, error } = await supabase
        .from('projects')
        .insert([{ name, code: projectCode, description }])
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      console.error("Error creating project:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, name, description } = req.body;
      
      let updateData: any = {};
      if (status) updateData.status = status;
      if (name) updateData.name = name;
      if (description) updateData.description = description;

      const { error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Tasks API
  app.get("/api/projects/:projectId/tasks", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { month, week } = req.query;
      
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId);
      
      if (month) query = query.eq('month', month);
      if (week) query = query.eq('week', week);

      const { data, error } = await query.order('id', { ascending: true });

      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:projectId/tasks", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { month, week, dynamic_data, fotos_prl, inventario, prioritario, comentarios } = req.body;
      
      const allowedFields = [
        'Ticket cliente', 'Fecha SLA', 'Sitio', 'Población', 'Provincia'
      ];
      const cleanData: any = {};
      if (dynamic_data) {
        Object.keys(dynamic_data).forEach(key => {
          if (allowedFields.includes(key)) {
            cleanData[key] = dynamic_data[key];
          }
        });
      }

      const title = cleanData['Ticket cliente'] || cleanData['Sitio'] || 'Nueva Tarea';
      const taskData = { 
        project_id: projectId, 
        month, 
        week, 
        dynamic_data: cleanData, 
        title,
        fotos_prl: fotos_prl || false,
        inventario: inventario || false,
        prioritario: prioritario || false,
        comentarios: comentarios || ''
      };
      
      const { data, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = { ...req.body };

      // Limpieza de dynamic_data si está presente en la actualización
      if (updates.dynamic_data) {
        const allowedFields = [
          'Ticket cliente', 'Fecha SLA', 'Sitio', 'Población', 'Provincia'
        ];
        const cleanData: any = {};
        Object.keys(updates.dynamic_data).forEach(key => {
          if (allowedFields.includes(key)) {
            cleanData[key] = updates.dynamic_data[key];
          }
        });
        updates.dynamic_data = cleanData;
        
        // Actualizar título si es necesario
        if (cleanData['Ticket cliente'] || cleanData['Sitio']) {
          updates.title = cleanData['Ticket cliente'] || cleanData['Sitio'];
        }
      }

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tasks/bulk-delete", async (req, res) => {
    try {
      const { ids } = req.body;
      const { error } = await supabase
        .from('tasks')
        .delete()
        .in('id', ids);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/projects/:projectId/tasks", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('project_id', projectId);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk Import Tasks
  app.post("/api/projects/:projectId/tasks/bulk", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { month: defaultMonth, week: defaultWeek, tasks: taskList } = req.body;
      
      console.log(`Recibida solicitud de importación masiva para proyecto ${projectId}. Tareas: ${taskList?.length}`);

      if (!taskList || !Array.isArray(taskList)) {
        return res.status(400).json({ error: "Formato de tareas inválido" });
      }

      const allowedFields = [
        'Ticket cliente', 'Fecha SLA', 'Sitio', 'Población', 'Provincia'
      ];

      const tasks = taskList.map((t: any) => {
        const rawData = t.dynamic_data || t;
        
        // Filtro estricto: solo permitimos los campos del estándar
        const dynamicData: any = {};
        allowedFields.forEach(field => {
          if (rawData[field] !== undefined) {
            dynamicData[field] = rawData[field];
          }
        });
        
        // Título basado en Ticket o Sitio
        const title = dynamicData['Ticket cliente'] || dynamicData['Sitio'] || 'Tarea Importada';
        
        return { 
          project_id: projectId,
          month: t.month || defaultMonth,
          week: t.week || defaultWeek,
          title: title,
          dynamic_data: dynamicData,
          status: t.status || dynamicData['Estado'] || 'abierta',
          fotos_prl: t.fotos_prl || false,
          inventario: t.inventario || false,
          prioritario: t.prioritario || false,
          comentarios: t.comentarios || ''
        };
      });

      console.log(`Procesando ${tasks.length} tareas para inserción.`);
      
      const { data, error } = await supabase
        .from('tasks')
        .insert(tasks);

      if (error) {
        console.error("Error en inserción masiva:", error);
        throw error;
      }
      
      res.json({ success: true, count: tasks.length });
    } catch (error: any) {
      console.error("Error en importación masiva:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
