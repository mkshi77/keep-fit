export interface DietItem {
  id: number;
  time: string;
  text: string;
  checked: boolean;
  required: boolean;
}

export interface WeightRecord {
  date: string;
  val: string;
}

export interface WorkoutSet {
  weight: string;
  reps: string;
  completed: boolean;
}

export interface HistoryRecord {
  type: 'workout' | 'rest';
  diet: DietItem[];
  workoutPlan: 'upper' | 'lower' | null;
  workoutSession?: Record<string, WorkoutSet[]>; // Captured snapshot of actual performance
}

export interface Exercise {
  id: string;
  name: string;
  englishName: string;
  gif: string; 
  steps: string[];
  tips: string;
  targetMuscles: string[];
}

export interface AppData {
  lastLogin: string;
  history: Record<string, HistoryRecord>;
  weightRecords: WeightRecord[];
  lastWeights: Record<string, string>;
  currentDiet: DietItem[];
  currentPlan: 'upper' | 'lower';
  currentSession: Record<string, WorkoutSet[]>;
}

export interface LevelConfig {
  days: number;
  title: string;
}

export type ModalType = 'none' | 'weight' | 'history' | 'actionSheet' | 'celebration' | 'exercise';

export interface ToastState {
  show: boolean;
  message: string;
  type: 'error' | 'success' | 'info';
}

export interface FeedbackItem {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}