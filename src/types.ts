export interface Project {
  id: number;
  name: string;
  code: string;
  description: string;
  status: 'active' | 'archived';
  created_at: string;
}

export interface Task {
  id: number;
  project_id: number;
  title: string;
  assignee: string;
  category: string;
  address: string;
  province: string;
  status: 'Pendiente' | 'Cerrado' | 'Incidencia';
  priority: 'Pendiente' | 'Enviado';
  prl: 'Pendiente' | 'Enviado';
  start_date: string;
  end_date: string;
  progress: number;
  puestos_maquetados: number;
  traslados_internos: number;
  traslados_externos: number;
  equipos_embalados: number;
  comments: string;
  cgp_2: string;
  visita_fallida: number;
  segunda_visita: number;
}
