export type TrainingDay = 'A' | 'B' | 'C';

export interface LegacyDietItem {
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

export interface ExercisePlan {
  exerciseId: string;
  notionPageId?: string;
  name: string;
  planSets: number;
  planReps: string;
  planWeight?: string;
  baseline?: string;
  youtube?: string;
  video?: string;
  cover?: string;
}

export interface WorkoutSet {
  weight: string;
  reps: string;
  completed: boolean;
}

export interface ExerciseFeedback {
  rir?: number;
  asymmetry?: 0 | 1 | 2 | 3;
  discomfort?: number;
}

export interface TodayExercise extends ExercisePlan {
  submissionId?: string;
  completed?: boolean;
  savedSets?: WorkoutSet[];
  savedFeedback?: ExerciseFeedback;
}

export interface TodayWorkout {
  date: string;
  trainingDay: TrainingDay | null;
  isRecoveryDay: boolean;
  source: 'notion' | 'fallback';
  exercises: TodayExercise[];
  warning?: string;
}

export interface HistoryRecord {
  type: 'workout' | 'rest';
  diet?: LegacyDietItem[];
  workoutPlan: TrainingDay | null;
  workoutSession?: Record<string, WorkoutSet[]>;
  workoutFeedback?: Record<string, ExerciseFeedback>;
  syncedToNotion?: boolean;
}

export interface AppData {
  lastLogin: string;
  history: Record<string, HistoryRecord>;
  weightRecords: WeightRecord[];
  lastWeights: Record<string, string>;
  currentSession: Record<string, WorkoutSet[]>;
  currentFeedback: Record<string, ExerciseFeedback>;
  workoutCache?: TodayWorkout;
}

export type WorkoutCompletionStatus = 'completed' | 'partial' | 'skipped';

export interface WorkoutCompletionExercise {
  exerciseId: string;
  notionPageId: string;
  sets: WorkoutSet[];
  feedback: ExerciseFeedback;
}

export interface WorkoutCompletionPayload {
  submissionId?: string;
  date: string;
  trainingDay: TrainingDay;
  exercises: WorkoutCompletionExercise[];
}

export interface LevelConfig {
  days: number;
  title: string;
}

export type ModalType = 'none' | 'weight' | 'history' | 'actionSheet' | 'celebration' | 'exercise' | 'data';

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

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIWorkoutContext {
  workout: TodayWorkout | null;
  session: Record<string, WorkoutSet[]>;
  feedback: Record<string, ExerciseFeedback>;
}



