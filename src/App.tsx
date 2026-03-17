import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import ProjectList from "./components/ProjectList";
import ProjectCalendar from "./components/ProjectCalendar";
import ProjectDetail from "./components/ProjectDetail";
import Login from "./components/Login";
import { Layout, LogOut } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [user, setUser] = useState<string>("");

  useEffect(() => {
    const status = localStorage.getItem("isLoggedIn") === "true";
    setIsLoggedIn(status);
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      const storedUser = localStorage.getItem("username") || "";
      setUser(storedUser);
    }
  }, [isLoggedIn]);

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("username");
    setIsLoggedIn(false);
  };

  if (isLoggedIn === null) return null;

  if (!isLoggedIn) {
    return (
      <ErrorBoundary>
        <Login onLogin={() => setIsLoggedIn(true)} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-slate-950">
        <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-900 sticky top-0 z-50 shadow-xl">
          <div className="flex items-center gap-12">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-blue-600 text-white p-1.5 rounded-lg transition-transform group-hover:scale-105">
                <Layout size={18} />
              </div>
              <span className="font-bold tracking-tight text-xl text-white">Bigmatic <span className="text-blue-500">ProjectFlow</span></span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-8">
              <Link to="/" className="text-[10px] font-bold uppercase tracking-widest text-blue-400 border-b-2 border-blue-500 pb-1">Proyectos</Link>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 cursor-not-allowed pb-1 border-b-2 border-transparent">Analíticas</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 cursor-not-allowed pb-1 border-b-2 border-transparent">Configuración</span>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                {user === 'Carlos' || user === 'cstinformaticas' ? 'Carlos Sarmiento' : user}
              </span>
              <span className="text-[9px] text-slate-500 font-medium">Administrador</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-rose-400 transition-colors rounded-full hover:bg-rose-900/20"
              title="Cerrar Sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<ProjectList />} />
            <Route path="/project/:id" element={<ProjectCalendar />} />
            <Route path="/project/:id/tasks" element={<ProjectDetail />} />
          </Routes>
        </main>
        
        <footer className="border-t border-slate-800 p-6 text-[10px] uppercase tracking-widest text-slate-600 flex justify-between bg-slate-900">
          <span className="font-semibold">Bigmatic Projectflow por {user === 'Carlos' || user === 'cstinformaticas' ? 'Carlos Sarmiento' : user} / Tecnico informatico</span>
          <span>Sistemas de Gestión v1.1.0</span>
        </footer>
      </div>
    </BrowserRouter>
  </ErrorBoundary>
  );
}
