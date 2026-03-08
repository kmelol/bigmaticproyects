import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = "https://xduqxyazymqvxdeqtazy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdXF4eWF6eW1xdnhkZXF0YXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjAwODksImV4cCI6MjA4ODUzNjA4OX0.lE8gd0whhwPhEmXuBSnxZeuKXGbg9oe1-nU1LsEAYuo";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes go here
  app.get("/api/health", async (req, res) => {
    try {
      // Simple health check using Supabase client
      const { data, error } = await supabase.from('projects').select('count', { count: 'exact', head: true });
      if (error) throw error;
      res.json({ status: "ok", message: "Connected to Supabase via API" });
    } catch (error: any) {
      console.error("Health check failed:", error);
      res.status(500).json({ status: "error", message: error.message });
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
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('id', { ascending: true });

      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:projectId/tasks", async (req, res) => {
    try {
      const { projectId } = req.params;
      const taskData = { ...req.body, project_id: projectId };
      
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
      const { error } = await supabase
        .from('tasks')
        .update(req.body)
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

  // Bulk Import Tasks
  app.post("/api/projects/:projectId/tasks/bulk", async (req, res) => {
    try {
      const { projectId } = req.params;
      const tasks = req.body.map((t: any) => ({ ...t, project_id: projectId }));
      
      const { data, error } = await supabase
        .from('tasks')
        .insert(tasks);

      if (error) throw error;
      res.json({ success: true, count: tasks.length });
    } catch (error: any) {
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
