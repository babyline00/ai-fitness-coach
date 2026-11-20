"use client";

import * as React from "react";
import { Dumbbell, Activity, RefreshCw, Upload, Plus, ChevronRight, Flame, HeartPulse, Clock, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────
type Equipment = "bodyweight" | "dumbbells" | "barbell" | "kettlebell" | "bands" | "machine";

interface Profile {
  id: string;
  name: string;
  goals: string;
  equipment: string;
  timePerSessionMin: number;
  daysPerWeek: number;
  recoveryState: string;
  experienceLevel: string;
  createdAt: string;
}

interface WorkoutExercise {
  exerciseId: string;
  name: string;
  category: string;
  equipment: string;
  muscleGroups: string[];
  sets: number;
  reps: number;
  restSec: number;
  weightLb: number;
  estimatedTimeMin: number;
  cues: string[];
  instructions: string[];
}

interface WorkoutBlock {
  name: string;
  phase: "warmup" | "main" | "cooldown";
  exercises: WorkoutExercise[];
  durationMin: number;
}

interface Workout {
  id: string;
  profileId: string;
  date: string;
  blocksJson: string;
  totalVolumeLb: number;
  totalDurationMin: number;
  completed: boolean;
  rpe: number | null;
  blocks?: WorkoutBlock[];
}

interface ProgressionSuggestion {
  exerciseId: string;
  exerciseName: string;
  newSets: number;
  newReps: number;
  newWeightLb: number;
  reason: string;
  deltaWeightLb: number;
  deltaReps: number;
}

interface WeeklyReview {
  workoutCount: number;
  completedCount: number;
  totalVolumeLb: number;
  totalDurationMin: number;
  avgRpe: number;
  suggestedDeload: boolean;
  summary: string;
}

interface FormCheckResult {
  formDescription: string;
  errorsDetected: string[];
  cues: string[];
  rating: "good" | "needs_work" | "poor";
}

// ─── Constants ────────────────────────────────────────────────────────────
const GOAL_OPTIONS = [
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "endurance", label: "Endurance" },
  { value: "weight_loss", label: "Weight Loss" },
  { value: "general_fitness", label: "General Fitness" },
];

const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: "bodyweight", label: "Bodyweight" },
  { value: "dumbbells", label: "Dumbbells" },
  { value: "barbell", label: "Barbell" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "bands", label: "Bands" },
  { value: "machine", label: "Machine" },
];

const RECOVERY_OPTIONS = [
  { value: "fresh", label: "Fresh" },
  { value: "moderate", label: "Moderate" },
  { value: "fatigued", label: "Fatigued" },
];

const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────
function parseEquipmentList(s: string): Equipment[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter((x): x is Equipment =>
      ["bodyweight", "dumbbells", "barbell", "kettlebell", "bands", "machine"].includes(x),
    );
}

function hydrateWorkout(w: Workout): Workout {
  if (w.blocks) return w;
  try {
    return { ...w, blocks: JSON.parse(w.blocksJson) as WorkoutBlock[] };
  } catch {
    return { ...w, blocks: [] };
  }
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

function ratingColor(r: FormCheckResult["rating"]): string {
  if (r === "good") return "text-emerald-600";
  if (r === "needs_work") return "text-amber-600";
  return "text-red-600";
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function Page() {
  const { toast } = useToast();
  const [profiles, setProfiles] = React.useState<Profile[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [workouts, setWorkouts] = React.useState<Workout[]>([]);
  const [currentWorkout, setCurrentWorkout] = React.useState<Workout | null>(null);
  const [weeklyReview, setWeeklyReview] = React.useState<WeeklyReview | null>(null);
  const [progression, setProgression] = React.useState<ProgressionSuggestion[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Form-check dialog state.
  const [formCheckOpen, setFormCheckOpen] = React.useState(false);
  const [formCheckExercise, setFormCheckExercise] = React.useState<WorkoutExercise | null>(null);
  const [formCheckResult, setFormCheckResult] = React.useState<FormCheckResult | null>(null);
  const [formCheckBusy, setFormCheckBusy] = React.useState(false);

  // Profile editor state (local form).
  const [editorOpen, setEditorOpen] = React.useState(false);

  // ─── Initial fetch: profiles ──────────────────────────────────────────────
  const fetchProfiles = React.useCallback(async () => {
    const res = await fetch("/api/profiles");
    const data = await res.json();
    setProfiles(data.profiles ?? []);
    if (data.profiles?.length && !selectedId) {
      setSelectedId(data.profiles[0].id);
    }
  }, [selectedId]);

  React.useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // ─── When selected profile changes: fetch history ─────────────────────────
  React.useEffect(() => {
    if (!selectedId) {
      setWorkouts([]);
      setCurrentWorkout(null);
      return;
    }
    void (async () => {
      const res = await fetch(`/api/workouts?profileId=${selectedId}`);
      const data = await res.json();
      const ws: Workout[] = (data.workouts ?? []).map(hydrateWorkout);
      setWorkouts(ws);
      // Pick the most recent non-completed workout as "current", else the most recent.
      const incomplete = ws.find((w) => !w.completed);
      setCurrentWorkout(incomplete ?? ws[0] ?? null);
    })();
  }, [selectedId]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  const selectProfile = (id: string) => {
    setSelectedId(id);
    setWeeklyReview(null);
    setProgression(null);
  };

  const handleGenerate = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/workouts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate workout");
      const w = hydrateWorkout(data.workout);
      setCurrentWorkout(w);
      setWorkouts((prev) => [w, ...prev.filter((x) => x.id !== w.id)]);
      toast({ title: "Workout generated", description: `${data.generated.totalDurationMin} min, ${data.generated.totalVolumeLb} lb volume` });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async (workoutId: string, rpe: number) => {
    try {
      const res = await fetch(`/api/workouts/${workoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true, rpe }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update workout");
      const updated = hydrateWorkout(data.workout);
      setWorkouts((prev) => prev.map((w) => (w.id === workoutId ? updated : w)));
      if (currentWorkout?.id === workoutId) setCurrentWorkout(updated);
      toast({ title: "Workout completed", description: `RPE ${rpe} recorded` });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleProgress = async () => {
    if (!currentWorkout?.completed) {
      toast({ title: "Mark the workout complete first", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/workouts/${currentWorkout.id}/progress`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to compute progression");
      setProgression(data.suggestions ?? []);
      const w = hydrateWorkout(data.newWorkout);
      setCurrentWorkout(w);
      setWorkouts((prev) => [w, ...prev.filter((x) => x.id !== w.id)]);
      toast({ title: "Next workout ready", description: "Progression applied" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleWeeklyReview = async () => {
    if (!selectedId) return;
    // weekStart = 7 days ago
    const start = new Date();
    start.setDate(start.getDate() - 7);
    try {
      const res = await fetch("/api/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: selectedId, weekStart: start.toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to build review");
      setWeeklyReview(data.review);
      toast({ title: "Weekly review built" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const openFormCheck = (ex: WorkoutExercise) => {
    setFormCheckExercise(ex);
    setFormCheckResult(null);
    setFormCheckOpen(true);
  };

  const submitFormCheck = async (formData: FormData) => {
    if (!formCheckExercise) return;
    setFormCheckBusy(true);
    try {
      const fd = new FormData();
      fd.append("exerciseName", formCheckExercise.name);
      if (currentWorkout) fd.append("workoutId", currentWorkout.id);
      const file = formData.get("file");
      if (file && (file as File).size > 0) fd.append("file", file);
      const desc = formData.get("mediaDescription");
      if (desc && String(desc)) fd.append("mediaDescription", String(desc));

      const res = await fetch("/api/form-check", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Form check failed");
      setFormCheckResult(data.result);
      toast({ title: "Form check complete", description: `Rating: ${data.result.rating}` });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setFormCheckBusy(false);
    }
  };

  const selectedProfile = profiles.find((p) => p.id === selectedId) ?? null;
  const completedCount = workouts.filter((w) => w.completed).length;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto max-w-7xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Dumbbell className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-none">AI-Powered Fitness Coach</h1>
              <p className="text-xs text-muted-foreground mt-1">Adaptive plans · Form check · Recovery-aware progression</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {profiles.length > 0 ? (
              <Select value={selectedId ?? undefined} onValueChange={selectProfile}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select profile" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
              <Plus className="size-4 mr-1" /> New profile
            </Button>
            <Button size="sm" onClick={handleGenerate} disabled={!selectedId || loading}>
              <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              New workout
            </Button>
          </div>
        </div>
      </header>

      {/* Body — 3-column responsive grid */}
      <main className="flex-1 container mx-auto max-w-7xl px-4 py-6">
        {profiles.length === 0 ? (
          <EmptyState onCreate={() => setEditorOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left column */}
            <aside className="lg:col-span-3 space-y-4">
              {selectedProfile ? (
                <ProfileEditor
                  profile={selectedProfile}
                  onSaved={() => fetchProfiles()}
                />
              ) : null}
              <WorkoutHistory
                workouts={workouts}
                currentId={currentWorkout?.id ?? null}
                onSelect={(w) => setCurrentWorkout(w)}
                onMarkComplete={handleMarkComplete}
              />
            </aside>

            {/* Center column */}
            <section className="lg:col-span-6 space-y-4">
              {currentWorkout ? (
                <CurrentWorkoutView
                  workout={currentWorkout}
                  onFormCheck={openFormCheck}
                  onMarkComplete={handleMarkComplete}
                  onProgress={handleProgress}
                />
              ) : (
                <Card>
                  <CardContent className="py-16 text-center text-muted-foreground">
                    <Dumbbell className="size-10 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No active workout</p>
                    <p className="text-sm mt-1">Click "New workout" to generate an adaptive plan.</p>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Right column */}
            <aside className="lg:col-span-3 space-y-4">
              <WeeklyReviewPanel
                review={weeklyReview}
                onBuild={handleWeeklyReview}
                completedCount={completedCount}
              />
              <ProgressionPanel progression={progression} />
            </aside>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto max-w-7xl px-4 py-4 text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>AI-Powered Fitness Coach · MVP build</span>
          <span className="hidden sm:inline">·</span>
          <span>Form check is mocked for MVP — real MediaPipe is a stretch goal.</span>
        </div>
      </footer>

      {/* Profile editor dialog */}
      <ProfileEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onCreated={(p) => {
          setProfiles((prev) => [p, ...prev]);
          setSelectedId(p.id);
        }}
      />

      {/* Form-check dialog */}
      <FormCheckDialog
        open={formCheckOpen}
        onOpenChange={setFormCheckOpen}
        exercise={formCheckExercise}
        result={formCheckResult}
        busy={formCheckBusy}
        onSubmit={submitFormCheck}
      />
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <Dumbbell className="size-12 mx-auto mb-4 opacity-40" />
        <h2 className="text-xl font-semibold">Welcome to your AI-Powered Fitness Coach</h2>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          Create a profile to generate adaptive, equipment-aware workouts with form-check,
          progression, and weekly reviews.
        </p>
        <Button className="mt-4" onClick={onCreate}>
          <Plus className="size-4 mr-1" /> Create your first profile
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Profile editor (read-only card with a dialog to edit) ───────────────────
function ProfileEditor({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const equipmentList = parseEquipmentList(profile.equipment);
  const [open, setOpen] = React.useState(false);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{profile.name}</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Edit</Button>
        </CardTitle>
        <CardDescription>Profile</CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <Row label="Goal" value={profile.goals} />
        <Row label="Experience" value={profile.experienceLevel} />
        <Row label="Recovery" value={profile.recoveryState} />
        <Row label="Time / session" value={`${profile.timePerSessionMin} min`} />
        <Row label="Days / week" value={`${profile.daysPerWeek}`} />
        <div>
          <p className="text-xs text-muted-foreground mb-1">Equipment</p>
          <div className="flex flex-wrap gap-1">
            {equipmentList.length === 0 ? (
              <Badge variant="outline">bodyweight only</Badge>
            ) : (
              equipmentList.map((e) => <Badge key={e} variant="secondary">{e}</Badge>)
            )}
          </div>
        </div>
      </CardContent>
      <EditProfileDialog
        open={open}
        onOpenChange={setOpen}
        profile={profile}
        onSaved={onSaved}
      />
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}

// ─── Workout history ────────────────────────────────────────────────────────
function WorkoutHistory({
  workouts,
  currentId,
  onSelect,
  onMarkComplete,
}: {
  workouts: Workout[];
  currentId: string | null;
  onSelect: (w: Workout) => void;
  onMarkComplete: (id: string, rpe: number) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="size-4" /> Workout History
        </CardTitle>
        <CardDescription>{workouts.length} session(s)</CardDescription>
      </CardHeader>
      <CardContent>
        {workouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workouts yet.</p>
        ) : (
          <ScrollArea className="max-h-72 pr-2">
            <ul className="space-y-2">
              {workouts.map((w) => (
                <li
                  key={w.id}
                  className={`rounded-md border p-2 text-sm cursor-pointer hover:bg-accent transition-colors ${
                    w.id === currentId ? "bg-accent/60 border-primary/40" : ""
                  }`}
                  onClick={() => onSelect(w)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{formatDate(w.date)}</span>
                    {w.completed ? (
                      <Badge variant="default" className="text-[10px]">done</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">active</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                    <span>{w.totalDurationMin} min</span>
                    <span>{w.totalVolumeLb.toLocaleString()} lb</span>
                    {w.rpe != null && <span>RPE {w.rpe}</span>}
                  </div>
                  {!w.completed && (
                    <div className="mt-2">
                      <RpeCompleteButton onSubmit={(rpe) => onMarkComplete(w.id, rpe)} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function RpeCompleteButton({ onSubmit }: { onSubmit: (rpe: number) => void }) {
  const [rpe, setRpe] = React.useState(7);
  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <Label className="text-xs">RPE</Label>
      <Select value={String(rpe)} onValueChange={(v) => setRpe(Number(v))}>
        <SelectTrigger className="h-7 w-16 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[5, 6, 7, 8, 9, 10].map((n) => (
            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="secondary"
        className="h-7 text-xs"
        onClick={() => onSubmit(rpe)}
      >
        Done
      </Button>
    </div>
  );
}

// ─── Current workout view ───────────────────────────────────────────────────
function CurrentWorkoutView({
  workout,
  onFormCheck,
  onMarkComplete,
  onProgress,
}: {
  workout: Workout;
  onFormCheck: (ex: WorkoutExercise) => void;
  onMarkComplete: (id: string, rpe: number) => void;
  onProgress: () => void;
}) {
  const blocks = workout.blocks ?? [];
  const [rpe, setRpe] = React.useState(7);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Current Workout</span>
          <Badge variant={workout.completed ? "default" : "outline"}>
            {workout.completed ? "Completed" : "In progress"}
          </Badge>
        </CardTitle>
        <CardDescription>
          {formatDate(workout.date)} · {workout.totalDurationMin} min ·{" "}
          {workout.totalVolumeLb.toLocaleString()} lb total volume
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No blocks — regenerate the workout.</p>
        ) : (
          blocks.map((block) => (
            <BlockView key={block.phase} block={block} onFormCheck={onFormCheck} />
          ))
        )}
        <Separator />
        {!workout.completed ? (
          <div className="flex items-center gap-3 flex-wrap">
            <Label className="text-sm">Final RPE</Label>
            <Select value={String(rpe)} onValueChange={(v) => setRpe(Number(v))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 6, 7, 8, 9, 10].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => onMarkComplete(workout.id, rpe)}>
              <HeartPulse className="size-4 mr-1" /> Mark completed
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <Badge>RPE {workout.rpe ?? "-"}</Badge>
            <Button variant="outline" onClick={onProgress}>
              <ChevronRight className="size-4 mr-1" /> Build next workout (progression)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BlockView({
  block,
  onFormCheck,
}: {
  block: WorkoutBlock;
  onFormCheck: (ex: WorkoutExercise) => void;
}) {
  const colorByPhase: Record<string, string> = {
    warmup: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
    main: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
    cooldown: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200",
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorByPhase[block.phase] ?? ""}`}>
            {block.name}
          </span>
          <span className="text-xs text-muted-foreground">~{block.durationMin} min</span>
        </div>
      </div>
      <div className="space-y-2">
        {block.exercises.map((ex) => (
          <ExerciseRow key={ex.exerciseId} ex={ex} onFormCheck={() => onFormCheck(ex)} />
        ))}
      </div>
    </div>
  );
}

function ExerciseRow({ ex, onFormCheck }: { ex: WorkoutExercise; onFormCheck: () => void }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">{ex.name}</div>
          <div className="text-xs text-muted-foreground capitalize">
            {ex.category} · {ex.equipment} · {ex.muscleGroups.join(", ")}
          </div>
        </div>
        <div className="text-right text-xs">
          <div className="font-medium">{ex.sets} × {ex.reps}</div>
          <div className="text-muted-foreground">
            {ex.weightLb > 0 ? `${ex.weightLb} lb · ` : ""}{ex.restSec}s rest
          </div>
        </div>
      </div>
      {ex.cues.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {ex.cues.map((c, i) => (
            <Badge key={i} variant="outline" className="text-[10px]">{c}</Badge>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex justify-end">
        <Button size="sm" variant="outline" onClick={onFormCheck}>
          <Upload className="size-3.5 mr-1" /> Form check
        </Button>
      </div>
    </div>
  );
}

// ─── Weekly review panel ─────────────────────────────────────────────────────
function WeeklyReviewPanel({
  review,
  onBuild,
  completedCount,
}: {
  review: WeeklyReview | null;
  onBuild: () => void;
  completedCount: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="size-4" /> Weekly Review
        </CardTitle>
        <CardDescription>Last 7 days · {completedCount} completed</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {review ? (
          <>
            <Stat label="Total volume" value={`${review.totalVolumeLb.toLocaleString()} lb`} />
            <Stat label="Total duration" value={`${review.totalDurationMin} min`} />
            <Stat label="Avg RPE" value={review.avgRpe ? String(review.avgRpe) : "—"} />
            {review.suggestedDeload ? (
              <Badge variant="destructive" className="w-full justify-center py-1">
                <Flame className="size-3 mr-1" /> Deload week suggested
              </Badge>
            ) : (
              <Badge variant="secondary" className="w-full justify-center py-1">No deload needed</Badge>
            )}
            <p className="text-xs text-muted-foreground">{review.summary}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Build a review of the last 7 days to see volume, average RPE, and a deload suggestion.
          </p>
        )}
        <Button variant="outline" size="sm" className="w-full" onClick={onBuild}>
          Build weekly review
        </Button>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ─── Progression panel ───────────────────────────────────────────────────────
function ProgressionPanel({ progression }: { progression: ProgressionSuggestion[] | null }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="size-4" /> Progression
        </CardTitle>
        <CardDescription>Next-session suggestions</CardDescription>
      </CardHeader>
      <CardContent>
        {!progression ? (
          <p className="text-sm text-muted-foreground">
            Complete the current workout and click "Build next workout" to compute adaptive
            progression per exercise.
          </p>
        ) : progression.length === 0 ? (
          <p className="text-sm text-muted-foreground">No main-block exercises to progress.</p>
        ) : (
          <ScrollArea className="max-h-72 pr-2">
            <ul className="space-y-2">
              {progression.map((s) => (
                <li key={s.exerciseId} className="rounded-md border p-2 text-xs">
                  <div className="font-medium">{s.exerciseName}</div>
                  <div className="flex gap-2 mt-1">
                    {s.deltaWeightLb > 0 ? (
                      <Badge variant="default">+{s.deltaWeightLb} lb</Badge>
                    ) : null}
                    {s.deltaReps > 0 ? <Badge variant="secondary">+{s.deltaReps} rep</Badge> : null}
                    {s.deltaWeightLb === 0 && s.deltaReps === 0 ? (
                      <Badge variant="outline">no change</Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-1">{s.reason}</p>
                  <div className="mt-1 text-[11px]">
                    Next: {s.newSets} × {s.newReps} @ {s.newWeightLb} lb
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Profile editor dialog (create + edit) ─────────────────────────────────
function ProfileEditorDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (p: Profile) => void;
}) {
  return (
    <ProfileForm
      open={open}
      onOpenChange={onOpenChange}
      title="Create profile"
      description="Tell the coach your goals, equipment, and availability."
      submitLabel="Create"
      onSubmit={async (data) => {
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to create profile");
        onCreated(json.profile);
      }}
    />
  );
}

function EditProfileDialog({
  open,
  onOpenChange,
  profile,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile: Profile;
  onSaved: () => void;
}) {
  return (
    <ProfileForm
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${profile.name}`}
      description="Update your goals, equipment, or availability."
      submitLabel="Save"
      initial={profile}
      onSubmit={async (data) => {
        const res = await fetch(`/api/profiles/${profile.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to update profile");
        onSaved();
      }}
    />
  );
}

function ProfileForm({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  initial?: Profile;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const { toast } = useToast();
  const [name, setName] = React.useState(initial?.name ?? "");
  const [goals, setGoals] = React.useState(initial?.goals ?? "general_fitness");
  const [equipment, setEquipment] = React.useState<Equipment[]>(parseEquipmentList(initial?.equipment ?? "bodyweight"));
  const [timePerSessionMin, setTimePerSessionMin] = React.useState(initial?.timePerSessionMin ?? 45);
  const [daysPerWeek, setDaysPerWeek] = React.useState(initial?.daysPerWeek ?? 3);
  const [recoveryState, setRecoveryState] = React.useState(initial?.recoveryState ?? "fresh");
  const [experienceLevel, setExperienceLevel] = React.useState(initial?.experienceLevel ?? "intermediate");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setGoals(initial?.goals ?? "general_fitness");
      setEquipment(parseEquipmentList(initial?.equipment ?? "bodyweight"));
      setTimePerSessionMin(initial?.timePerSessionMin ?? 45);
      setDaysPerWeek(initial?.daysPerWeek ?? 3);
      setRecoveryState(initial?.recoveryState ?? "fresh");
      setExperienceLevel(initial?.experienceLevel ?? "intermediate");
    }
  }, [open, initial]);

  const toggleEquipment = (e: Equipment) => {
    setEquipment((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e],
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (equipment.length === 0) {
      toast({ title: "Pick at least one equipment option", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        goals,
        equipment: equipment.join(","),
        timePerSessionMin,
        daysPerWeek,
        recoveryState,
        experienceLevel,
      });
      toast({ title: "Profile saved" });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" />
          </div>
          <div>
            <Label>Goal</Label>
            <Select value={goals} onValueChange={setGoals}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GOAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Experience level</Label>
            <Select value={experienceLevel} onValueChange={setExperienceLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPERIENCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Recovery state</Label>
            <Select value={recoveryState} onValueChange={setRecoveryState}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECOVERY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Equipment owned</Label>
            <div className="grid grid-cols-2 gap-2">
              {EQUIPMENT_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={equipment.includes(o.value)}
                    onCheckedChange={() => toggleEquipment(o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Time per session (min): {timePerSessionMin}</Label>
              <input
                type="range"
                min={15}
                max={120}
                step={5}
                value={timePerSessionMin}
                onChange={(e) => setTimePerSessionMin(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <Label>Days per week: {daysPerWeek}</Label>
              <input
                type="range"
                min={1}
                max={7}
                step={1}
                value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Form-check dialog ──────────────────────────────────────────────────────
function FormCheckDialog({
  open,
  onOpenChange,
  exercise,
  result,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  exercise: WorkoutExercise | null;
  result: FormCheckResult | null;
  busy: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Form check · {exercise?.name ?? ""}</DialogTitle>
          <DialogDescription>
            Upload a short video or image of your set. The AI coach will describe your form and
            flag common errors. (For MVP, the analysis is mocked when no vision model is configured.)
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onSubmit(fd);
          }}
          className="space-y-3"
        >
          <div>
            <Label htmlFor="file">Video / image</Label>
            <Input id="file" name="file" type="file" accept="image/*,video/*" />
          </div>
          <div>
            <Label htmlFor="mediaDescription">Notes (optional)</Label>
            <Textarea
              id="mediaDescription"
              name="mediaDescription"
              placeholder="e.g. rep 3 of 5, felt a bit wobbly on the way up"
              rows={3}
            />
          </div>
          {result ? (
            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Rating</span>
                <span className={`font-semibold capitalize ${ratingColor(result.rating)}`}>
                  {result.rating.replace("_", " ")}
                </span>
              </div>
              <p>{result.formDescription}</p>
              {result.errorsDetected.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Errors flagged:</p>
                  <ul className="list-disc list-inside text-xs">
                    {result.errorsDetected.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No errors flagged.</p>
              )}
              {result.cues.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Cues:</p>
                  <div className="flex flex-wrap gap-1">
                    {result.cues.map((c, i) => <Badge key={i} variant="outline" className="text-[10px]">{c}</Badge>)}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Analyzing..." : "Analyze form"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
