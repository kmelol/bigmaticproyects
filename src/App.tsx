import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import ProjectList from "./components/ProjectList";
import ProjectDetail from "./components/ProjectDetail";
import { Layout } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
        <header className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-white sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-12">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-blue-700 text-white p-1.5 rounded-md transition-transform group-hover:scale-105">
                <Layout size={18} />
              </div>
              <span className="font-bold tracking-tight text-xl text-slate-900">Bigmatic <span className="text-blue-700">ProjectFlow</span></span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-8">
              <Link to="/" className="text-[10px] font-bold uppercase tracking-widest text-blue-700 border-b-2 border-blue-700 pb-1">Proyectos</Link>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 cursor-not-allowed pb-1 border-b-2 border-transparent">Analíticas</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 cursor-not-allowed pb-1 border-b-2 border-transparent">Configuración</span>
            </nav>
          </div>
        </header>

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<ProjectList />} />
            <Route path="/project/:id" element={<ProjectDetail />} />
          </Routes>
        </main>
        
        <footer className="border-t border-slate-200 p-6 text-[10px] uppercase tracking-widest text-slate-500 flex justify-between bg-slate-50">
          <span className="font-semibold">Bigmatic Projectflow por Carlos Sarmiento / Tecnico informatico</span>
          <span>Sistemas de Gestión v1.1.0</span>
        </footer>
      </div>
    </BrowserRouter>
  </ErrorBoundary>
  );
}
