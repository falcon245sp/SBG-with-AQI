import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { UserCheck, Settings, ArrowRight } from "lucide-react"
import { useLocation } from "wouter"

export default function RoleSelection() {
  const [, setLocation] = useLocation()

  const selectCustomerRole = () => {
    // Set customer context and redirect to onboarding check first
    sessionStorage.setItem('userRole', 'customer')
    setLocation('/onboarding')
  }

  const selectAdminRole = () => {
    // Set admin context and redirect to admin panel
    sessionStorage.setItem('userRole', 'admin')
    setLocation('/admin')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome to Standards Sherpa</h1>
          <p className="text-xl text-gray-600">Choose your access level to continue</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Customer Interface Option */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-300" onClick={selectCustomerRole}>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <UserCheck className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">Customer Dashboard</CardTitle>
              <CardDescription className="text-lg">
                Access your document processing and file management tools
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3 text-gray-600 mb-6">
                <li className="flex items-center">
                  <ArrowRight className="h-4 w-4 mr-2 text-blue-500" />
                  Upload and process documents
                </li>
                <li className="flex items-center">
                  <ArrowRight className="h-4 w-4 mr-2 text-blue-500" />
                  AI-powered standards analysis
                </li>
                <li className="flex items-center">
                  <ArrowRight className="h-4 w-4 mr-2 text-blue-500" />
                  Generate rubrics and cover sheets
                </li>
                <li className="flex items-center">
                  <ArrowRight className="h-4 w-4 mr-2 text-blue-500" />
                  File Cabinet document management
                </li>
              </ul>
              <Button className="w-full" onClick={selectCustomerRole}>
                Enter Customer Dashboard
              </Button>
            </CardContent>
          </Card>

          {/* Admin Interface Option */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-amber-300" onClick={selectAdminRole}>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <Settings className="h-8 w-8 text-amber-600" />
              </div>
              <CardTitle className="text-2xl">Admin Panel</CardTitle>
              <CardDescription className="text-lg">
                System administration and monitoring tools
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3 text-gray-600 mb-6">
                <li className="flex items-center">
                  <ArrowRight className="h-4 w-4 mr-2 text-amber-500" />
                  System diagnostics and monitoring
                </li>
                <li className="flex items-center">
                  <ArrowRight className="h-4 w-4 mr-2 text-amber-500" />
                  Production logging and debugging
                </li>
                <li className="flex items-center">
                  <ArrowRight className="h-4 w-4 mr-2 text-amber-500" />
                  User management and analytics
                </li>
                <li className="flex items-center">
                  <ArrowRight className="h-4 w-4 mr-2 text-amber-500" />
                  Export processing controls
                </li>
              </ul>
              <Button variant="outline" className="w-full border-amber-300 hover:bg-amber-50" onClick={selectAdminRole}>
                Enter Admin Panel
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8 text-gray-500">
          <p>You can switch between roles at any time from the user menu</p>
        </div>
      </div>
    </div>
  )
}