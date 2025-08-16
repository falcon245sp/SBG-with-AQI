import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Brain, BarChart3, Zap, Shield, Clock } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-slate-900">Document Processing Service</h1>
            </div>
            <Button 
              onClick={() => window.location.href = '/api/login'}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl md:text-6xl">
            Standards Sherpa
            <span className="text-blue-600"> Educational Analysis</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-xl text-slate-600">
            Automatically analyze educational documents to identify standards alignment and determine cognitive rigor levels using multiple AI engines.
          </p>
          <div className="mt-10">
            <Button 
              onClick={() => window.location.href = '/api/login'}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3"
            >
              Get Started
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900">Powerful Features</h2>
            <p className="mt-4 text-lg text-slate-600">
              Everything you need for comprehensive educational document analysis
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <Brain className="h-8 w-8 text-blue-600 mb-2" />
                <CardTitle>Sherpa Multi-AI Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Leverage ChatGPT, Grok, and Claude for comprehensive analysis with consensus voting for accurate results.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-8 w-8 text-green-600 mb-2" />
                <CardTitle>Rigor Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  DOK-based cognitive rigor analysis with easy-to-understand mild, medium, and spicy classifications.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <FileText className="h-8 w-8 text-purple-600 mb-2" />
                <CardTitle>Standards Identification</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Automatic identification of educational standards including Common Core, state standards, and more.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="h-8 w-8 text-amber-600 mb-2" />
                <CardTitle>Fast Processing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Efficient processing pipeline with real-time status updates and queue management.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 text-red-600 mb-2" />
                <CardTitle>Secure & Reliable</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Enterprise-grade security with user authentication and API key management.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Clock className="h-8 w-8 text-indigo-600 mb-2" />
                <CardTitle>Historical Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Complete audit trail with searchable historical results and detailed analytics.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900">How It Works</h2>
            <p className="mt-4 text-lg text-slate-600">
              Simple process to get comprehensive educational analysis
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-4">
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-blue-100 rounded-full">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Upload Document</h3>
              <p className="mt-2 text-slate-600">
                Upload your PDF, Word, or Google Doc file with educational content
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-green-100 rounded-full">
                <span className="text-2xl font-bold text-green-600">2</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Sherpa Analysis</h3>
              <p className="mt-2 text-slate-600">
                Sherpa uses three AI engines to analyze your content for standards and rigor levels
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-purple-100 rounded-full">
                <span className="text-2xl font-bold text-purple-600">3</span>
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
