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
  month: number;
  week: number;
  dynamic_data: Record<string, any>;
  fotos_prl: boolean;
  inventario: boolean;
  comentarios: string;
  status: 'abierta' | 'cerrada' | 'incidencia';
  created_at?: string;
}
