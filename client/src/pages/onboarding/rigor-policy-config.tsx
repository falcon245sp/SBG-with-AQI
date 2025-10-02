import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Sliders, Loader2, AlertCircle } from 'lucide-react';

interface RigorDistribution {
  low: number;
  medium: number;
  high: number;
}

export default function RigorPolicyConfig() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [selectedJurisdiction, setSelectedJurisdiction] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [rigorValues, setRigorValues] = useState<RigorDistribution>({ low: 30, medium: 50, high: 20 });

  const { data: jurisdictionsData } = useQuery<{ data: any[] }>({
    queryKey: ['/api/common-standards-project/jurisdictions'],
  });

  const { data: coursesData } = useQuery<{ data: any[] }>({
    queryKey: ['/api/common-standards-project/courses', selectedJurisdiction],
    enabled: !!selectedJurisdiction,
  });

  const savePolicyMutation = useMutation({
    mutationFn: async (policyData: any) => {
      const response = await fetch('/api/admin/rigor-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyData),
      });
      if (!response.ok) throw new Error('Failed to save policy');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rigor-policies'] });
      setLocation('/dashboard');
    },
    onError: (error: any) => {
      console.error('Failed to save rigor policy:', error);
      alert(error.message || "Failed to save rigor policy");
    },
  });

  const handleRigorChange = (key: keyof RigorDistribution, value: string) => {
    const numValue = parseInt(value) || 0;
    setRigorValues(prev => ({ ...prev, [key]: numValue }));
  };

  const handleSave = () => {
    const total = rigorValues.low + rigorValues.medium + rigorValues.high;
    if (total !== 100) {
      alert(`Percentages must sum to 100% (currently ${total}%)`);
      return;
    }

    if (!selectedCourse) {
      alert("Please select a course to configure");
      return;
    }

    const policyData = {
      name: `${selectedCourse.title} - Rigor Policy`,
      description: `Rigor expectations for ${selectedCourse.title}`,
      scopeType: 'course',
      scopeId: selectedCourseId,
      subject: selectedCourse.subject,
      gradeLevel: selectedCourse.gradeLevel,
      rigorExpectations: rigorValues,
      isActive: true,
    };

    savePolicyMutation.mutate(policyData);
  };

  const jurisdictions = jurisdictionsData?.data ?? [];
  const courses = coursesData?.data ?? [];
  const total = rigorValues.low + rigorValues.medium + rigorValues.high;
  const isValid = total === 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="p-6 text-center border-b">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <Sliders className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold">Configure Rigor Policies</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Set expected rigor distribution for your courses
          </p>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Educational Jurisdiction</label>
            <select 
              value={selectedJurisdiction} 
              onChange={(e) => setSelectedJurisdiction(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select your state or organization...</option>
              {jurisdictions.map((jurisdiction: any) => (
                <option key={jurisdiction.id} value={jurisdiction.id}>
                  {jurisdiction.title}
                </option>
              ))}
            </select>
          </div>

          {selectedJurisdiction && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Course</label>
              <select
                value={selectedCourseId}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value);
                  setSelectedCourse(courses.find((c: any) => c.id === e.target.value));
                }}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a course...</option>
                {courses.map((course: any) => (
                  <option key={course.id} value={course.id}>
                    {course.title} - {course.subject}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedCourse && (
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
              <h3 className="font-semibold">Expected Rigor Distribution</h3>
              <p className="text-sm text-gray-600">
                Set the target percentages for each rigor level. Total must equal 100%.
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Low</span>
                    Low (DOK 1)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={rigorValues.low}
                      onChange={(e) => handleRigorChange('low', e.target.value)}
                      className="w-20 text-right px-2 py-1 border rounded"
                    />
                    <span className="text-sm text-gray-600">%</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${rigorValues.low}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">Med</span>
                    Medium (DOK 2-3)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={rigorValues.medium}
                      onChange={(e) => handleRigorChange('medium', e.target.value)}
                      className="w-20 text-right px-2 py-1 border rounded"
                    />
                    <span className="text-sm text-gray-600">%</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: `${rigorValues.medium}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">High</span>
                    High (DOK 4)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={rigorValues.high}
                      onChange={(e) => handleRigorChange('high', e.target.value)}
                      className="w-20 text-right px-2 py-1 border rounded"
                    />
                    <span className="text-sm text-gray-600">%</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full transition-all"
                    style={{ width: `${rigorValues.high}%` }}
                  />
                </div>
              </div>

              <div className={`p-4 rounded-md border flex items-start gap-2 ${isValid ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                <AlertCircle className={`h-5 w-5 mt-0.5 ${isValid ? "text-green-600" : "text-amber-600"}`} />
                <p className={`text-sm ${isValid ? "text-green-800" : "text-amber-800"}`}>
                  Total: <strong>{total}%</strong> {isValid ? "✓" : `(must equal 100%)`}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setLocation('/onboarding/district-setup')}
              disabled={savePolicyMutation.isPending}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid || !selectedCourse || savePolicyMutation.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
            >
              {savePolicyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save & Continue'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
