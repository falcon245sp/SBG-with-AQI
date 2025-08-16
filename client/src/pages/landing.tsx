import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Brain, BarChart3, Zap, Shield, Clock, BookOpen, GraduationCap } from "lucide-react";
import scholarImage from "@assets/0224610c-557c-40f4-8e83-145ab9891ae5_1755384997064.jpg";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <GraduationCap className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-semibold text-foreground">Standards Sherpa</h1>
            </div>
            <Button 
              onClick={() => window.location.href = '/api/login'}
              className="bg-primary hover:bg-primary/90"
            >
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section with Educational Imagery */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={scholarImage} 
            alt="Educational scholar with books"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-background/90"></div>
        </div>
        
        <div className="relative py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h1 className="text-4xl font-bold text-foreground sm:text-5xl lg:text-6xl">
                  Your Educational
                  <span className="text-primary block mt-2">Standards Sherpa</span>
                </h1>
                <p className="mt-6 text-xl text-muted-foreground max-w-lg">
                  Navigate the complex terrain of educational standards with your trusted guide. 
                  Automatically analyze documents for standards alignment and cognitive rigor using advanced AI.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <Button 
                    onClick={() => window.location.href = '/api/login'}
                    size="lg"
                    className="bg-primary hover:bg-primary/90 text-lg px-8 py-4"
                  >
                    <BookOpen className="h-5 w-5 mr-2" />
                    Start Your Journey
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="text-lg px-8 py-4 border-primary/20 hover:bg-primary/5"
                  >
                    Learn More
                  </Button>
                </div>
              </div>
              
              <div className="relative">
                <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-border">
                  <div className="flex items-center mb-4">
                    <div className="bg-primary/10 p-3 rounded-xl">
                      <GraduationCap className="h-8 w-8 text-primary" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-foreground">Expert Analysis</h3>
                      <p className="text-sm text-muted-foreground">Multi-AI consensus for accuracy</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                      <span className="text-sm font-medium">Standards Alignment</span>
                      <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full">98% Accuracy</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                      <span className="text-sm font-medium">Rigor Assessment</span>
                      <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full">DOK 1-4</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                      <span className="text-sm font-medium">Teacher Override</span>
                      <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full">Full Control</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground">Your Guide Through Educational Standards</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Like a trusted sherpa navigating mountain paths, Standards Sherpa guides you through the complex terrain of educational analysis
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="bg-primary/10 w-fit p-3 rounded-xl">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-foreground">Multi-AI Consensus</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Three expert AI engines (ChatGPT, Grok, Claude) work together to provide the most reliable analysis, like having multiple guides confirm the best path forward.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="bg-chart-4/20 w-fit p-3 rounded-xl">
                  <BarChart3 className="h-8 w-8 text-chart-4" />
                </div>
                <CardTitle className="text-foreground">Cognitive Rigor Mapping</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  DOK-based cognitive rigor analysis with intuitive mild 🍃, medium 🌶️, and spicy 🔥 classifications that teachers understand at a glance.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="bg-chart-2/20 w-fit p-3 rounded-xl">
                  <FileText className="h-8 w-8 text-chart-2" />
                </div>
                <CardTitle className="text-foreground">Standards Navigation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Expert identification of Common Core, state standards, and more - your Sherpa knows all the educational terrain.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="bg-chart-3/20 w-fit p-3 rounded-xl">
                  <Zap className="h-8 w-8 text-chart-3" />
                </div>
                <CardTitle className="text-foreground">Swift Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  No waiting at base camp - efficient processing with real-time updates gets you to your destination quickly.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="bg-destructive/10 w-fit p-3 rounded-xl">
                  <Shield className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle className="text-foreground">Teacher Override</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  You're always in control. Override Sherpa's analysis with your expert judgment and maintain full edit history.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="bg-chart-5/20 w-fit p-3 rounded-xl">
                  <Clock className="h-8 w-8 text-chart-5" />
                </div>
                <CardTitle className="text-foreground">Journey History</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Complete trail log of every analysis, override, and revert - never lose track of your educational journey.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground">Your Journey with Standards Sherpa</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Four simple steps to reach the summit of educational analysis
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-4">
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-primary/10 rounded-full">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">Upload Your Documents</h3>
              <p className="mt-2 text-muted-foreground">
                Share your educational materials - PDFs, Word docs, or Google Docs. Your Sherpa is ready for any terrain.
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-chart-4/20 rounded-full">
                <span className="text-2xl font-bold text-chart-4">2</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">Expert Multi-AI Analysis</h3>
              <p className="mt-2 text-muted-foreground">
                Three AI experts work together to map standards and assess cognitive rigor with expert precision.
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-chart-2/20 rounded-full">
                <span className="text-2xl font-bold text-chart-2">3</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Consensus Voting</h3>
              <p className="mt-2 text-slate-600">
                Results are consolidated using voting methodology for accuracy
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-amber-100 rounded-full">
                <span className="text-2xl font-bold text-amber-600">4</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Get Results</h3>
              <p className="mt-2 text-slate-600">
                Receive detailed analysis with standards identification and rigor assessment
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-blue-400 mr-3" />
              <span className="text-xl font-semibold">Document Processing Service</span>
            </div>
            <p className="text-slate-400">
              Standards Sherpa-powered educational standards analysis and rigor assessment
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
