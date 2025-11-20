import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Brain, Workflow, Sparkles } from "lucide-react";
import { APP_TITLE, getLoginUrl } from "@/const";
import { useLocation } from "wouter";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Planning",
      description: "Automatically break down complex goals into actionable steps using advanced AI",
    },
    {
      icon: Workflow,
      title: "Intelligent Execution",
      description: "Execute tasks with smart tool selection and dependency management",
    },
    {
      icon: Zap,
      title: "Real-Time Updates",
      description: "Stream progress updates as your tasks execute in real-time",
    },
    {
      icon: Sparkles,
      title: "Self-Correcting",
      description: "Automatically handle errors and adjust plans dynamically",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">{APP_TITLE}</h1>
          </div>
          <div>
            {isAuthenticated ? (
              <Button onClick={() => navigate("/planner")} className="bg-blue-600 hover:bg-blue-700">
                Go to Planner
              </Button>
            ) : (
              <Button onClick={() => window.location.href = getLoginUrl()} className="bg-blue-600 hover:bg-blue-700">
                Sign In
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
          Autonomous Task Planner & Executor
        </h2>
        <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
          Break down complex goals into steps, execute them with AI-powered tools, and get real-time progress updates.
        </p>
        {isAuthenticated ? (
          <Button
            size="lg"
            onClick={() => navigate("/planner")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg"
          >
            Start Planning
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={() => window.location.href = getLoginUrl()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg"
          >
            Sign In to Get Started
          </Button>
        )}
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h3 className="text-3xl font-bold text-slate-900 text-center mb-12">Key Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Icon className="w-8 h-8 text-blue-600 mb-2" />
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Example Goals Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h3 className="text-3xl font-bold text-slate-900 text-center mb-12">Example Goals</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Research & Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                "Research the top 5 AI startups funded in 2024, compare their funding amounts, and create a summary with key insights"
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                "Find the weather in Tokyo tomorrow, convert the temperature to Fahrenheit, and suggest 3 outdoor activities"
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Financial Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                "Calculate the compound annual growth rate of Apple stock over the last 5 years and compare it with Microsoft"
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50 backdrop-blur-sm mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-slate-600 text-sm">
          <p>Autonomous Task Planner & Executor © 2024. Powered by AI.</p>
        </div>
      </footer>
    </div>
  );
}
