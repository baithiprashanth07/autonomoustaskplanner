import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Clock, AlertTriangle, Play, RotateCcw } from "lucide-react";
import { Streamdown } from "streamdown";

interface TaskStatus {
  taskId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "skipped";
  output?: string;
  error?: string;
}

interface ExecutionUpdate {
  type: string;
  taskId?: string;
  message: string;
  data?: any;
}

export default function TaskPlanner() {
  const { user, isAuthenticated } = useAuth();
  const [goal, setGoal] = useState("");
  const [executionId, setExecutionId] = useState<number | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, TaskStatus>>({});
  const [updates, setUpdates] = useState<ExecutionUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const updatesEndRef = useRef<HTMLDivElement>(null);

  const createExecutionMutation = trpc.planner.createExecution.useMutation();
  const startExecutionMutation = trpc.planner.startExecution.useMutation();
  const getExecutionQuery = trpc.planner.getExecution.useQuery(
    { executionId: executionId || 0 },
    { enabled: executionId !== null }
  );

  // Auto-scroll to latest updates
  useEffect(() => {
    updatesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [updates]);

  const handleCreatePlan = async () => {
    if (!goal.trim()) {
      setError("Please enter a goal");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const result = await createExecutionMutation.mutateAsync({ goal });
      setExecutionId(result.executionId);
      setPlan(result.plan);
      setTaskStatuses({});
      setUpdates([
        {
          type: "plan",
          message: `Plan created with ${result.plan.totalSteps} tasks`,
          data: result.plan,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create plan");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartExecution = async () => {
    if (!executionId) return;

    setIsExecuting(true);
    setError(null);
    setResults(null);
    setUpdates([]);

    try {
      // Start execution
      const result = await startExecutionMutation.mutateAsync({ executionId });

      if (result.success) {
        setResults(result.results);
        setUpdates((prev) => [
          ...prev,
          {
            type: "execution_complete",
            message: "Execution completed successfully",
            data: result.results,
          },
        ]);
      } else {
        setError(result.error || "Execution failed");
        setUpdates((prev) => [
          ...prev,
          {
            type: "execution_error",
            message: result.error || "Execution failed",
          },
        ]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to execute plan";
      setError(errorMessage);
      setUpdates((prev) => [
        ...prev,
        {
          type: "execution_error",
          message: errorMessage,
        },
      ]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReset = () => {
    setGoal("");
    setExecutionId(null);
    setPlan(null);
    setTaskStatuses({});
    setUpdates([]);
    setResults(null);
    setError(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "succeeded":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "failed":
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case "running":
        return <Clock className="w-4 h-4 text-blue-600 animate-spin" />;
      case "skipped":
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "succeeded":
        return "bg-green-50 border-green-200";
      case "failed":
        return "bg-red-50 border-red-200";
      case "running":
        return "bg-blue-50 border-blue-200";
      case "skipped":
        return "bg-gray-50 border-gray-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to use the Task Planner</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Autonomous Task Planner</h1>
          <p className="text-slate-600">Break down complex goals into actionable steps and execute them automatically</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Section */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Goal</CardTitle>
                <CardDescription>Describe what you want to accomplish</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="e.g., Research the top 5 AI startups funded in 2024, compare their funding amounts, and create a summary with key insights"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="min-h-32"
                  disabled={isLoading || isExecuting}
                />

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleCreatePlan}
                    disabled={isLoading || isExecuting || !goal.trim()}
                    className="flex-1"
                  >
                    {isLoading ? "Creating Plan..." : "Create Plan"}
                  </Button>
                  {executionId && (
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      disabled={isExecuting}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Plan and Execution Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Plan Display */}
            {plan && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Execution Plan</CardTitle>
                  <CardDescription>{plan.totalSteps} tasks identified</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {plan.tasks.map((task: any, index: number) => (
                    <div
                      key={task.id}
                      className={`p-3 border rounded-lg ${getStatusColor(taskStatuses[task.id]?.status || "queued")}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {getStatusIcon(taskStatuses[task.id]?.status || "queued")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-slate-700">Task {index + 1}</span>
                            <Badge variant="outline" className="text-xs">
                              {taskStatuses[task.id]?.status || "queued"}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                          <div className="flex gap-2 flex-wrap">
                            {task.tools.map((tool: string) => (
                              <Badge key={tool} variant="secondary" className="text-xs">
                                {tool}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    onClick={handleStartExecution}
                    disabled={isExecuting}
                    className="w-full mt-4"
                    size="lg"
                  >
                    {isExecuting ? "Executing..." : <Play className="w-4 h-4 mr-2" />}
                    {isExecuting ? "Executing Plan" : "Start Execution"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Real-time Updates */}
            {updates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Execution Progress</CardTitle>
                  <CardDescription>Real-time updates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {updates.map((update, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border text-sm ${
                          update.type === "execution_error" || update.type === "task_error"
                            ? "bg-red-50 border-red-200 text-red-700"
                            : update.type === "execution_complete"
                              ? "bg-green-50 border-green-200 text-green-700"
                              : "bg-blue-50 border-blue-200 text-blue-700"
                        }`}
                      >
                        <p className="font-medium">{update.message}</p>
                        {update.data && (
                          <div className="mt-2 text-xs opacity-75">
                            <Streamdown>{JSON.stringify(update.data, null, 2)}</Streamdown>
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={updatesEndRef} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {results && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Results & Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-slate-900 mb-2">Summary</h3>
                    <Streamdown>{results.analysis || "Analysis completed"}</Streamdown>
                  </div>

                  {results.taskResults && Object.keys(results.taskResults).length > 0 && (
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-2">Task Results</h3>
                      <div className="space-y-2">
                        {Object.entries(results.taskResults).map(([taskId, output]: [string, any]) => (
                          <div key={taskId} className="p-2 bg-slate-50 rounded text-sm">
                            <p className="font-medium text-slate-700">{taskId}</p>
                            <p className="text-slate-600 text-xs mt-1">{String(output).substring(0, 200)}...</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
