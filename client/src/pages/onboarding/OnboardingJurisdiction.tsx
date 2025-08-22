import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MapPin, ChevronRight } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

interface Jurisdiction {
  id: string;
  title: string;
  type: string;
}

export default function OnboardingJurisdiction() {
  const [, setLocation] = useLocation();
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>('');

  // Fetch available jurisdictions
  const { data: jurisdictions, isLoading: isLoadingJurisdictions } = useQuery({
    queryKey: ['/api/standards/jurisdictions'],
  });

  // Update user preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PUT', '/api/user/preferences', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setLocation('/onboarding/subject');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save preferences",
        variant: "destructive"
      });
    }
  });

  const handleNext = () => {
    if (!selectedJurisdiction) {
      toast({
        title: "Selection Required",
        description: "Please select a standards jurisdiction to continue",
        variant: "destructive"
      });
      return;
    }

    updatePreferencesMutation.mutate({
      preferredJurisdiction: selectedJurisdiction,
      onboardingStep: 'subject'
    });
  };

  // Filter to show most common/important jurisdictions first
  const priorityJurisdictions = [
    'ca', 'tx', 'fl', 'ny', 'il', 'pa', 'oh', 'ga', 'nc', 'mi', // Top 10 states by population/education systems
    'ccss' // Common Core State Standards
  ];

  const sortedJurisdictions = ((jurisdictions as Jurisdiction[]) || []).sort((a: Jurisdiction, b: Jurisdiction) => {
    const aIsPriority = priorityJurisdictions.some(p => a.id.toLowerCase().includes(p) || a.title.toLowerCase().includes(p));
    const bIsPriority = priorityJurisdictions.some(p => b.id.toLowerCase().includes(p) || b.title.toLowerCase().includes(p));
    
    if (aIsPriority && !bIsPriority) return -1;
    if (!aIsPriority && bIsPriority) return 1;
    
    return a.title.localeCompare(b.title);
  });

  if (isLoadingJurisdictions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading standards frameworks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Progress Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <MapPin className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Choose Your Standards Framework</h1>
          <p className="text-xl text-gray-600">Select the educational standards you work with</p>
          
          {/* Progress Indicator */}
          <div className="mt-6 mb-4">
            <Progress value={20} className="w-full max-w-md mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Step 1 of 5</p>
          </div>
        </div>

        {/* Jurisdictions Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {sortedJurisdictions.map((jurisdiction: Jurisdiction) => (
            <Card 
              key={jurisdiction.id}
              className={`cursor-pointer hover:shadow-lg transition-all duration-200 border-2 ${
                selectedJurisdiction === jurisdiction.id 
                  ? 'border-blue-500 bg-blue-50 shadow-md' 
                  : 'border-gray-200 hover:border-blue-300'
              }`}
              onClick={() => setSelectedJurisdiction(jurisdiction.id)}
              data-testid={`jurisdiction-${jurisdiction.id}`}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{jurisdiction.title}</CardTitle>
                <CardDescription className="text-sm capitalize">
                  {jurisdiction.type}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8">
          <Button 
            variant="outline" 
            onClick={() => setLocation('/auth/logout')}
            data-testid="button-back"
          >
            Sign Out
          </Button>
          
          <Button 
            onClick={handleNext}
            disabled={!selectedJurisdiction || updatePreferencesMutation.isPending}
            className="flex items-center gap-2"
            data-testid="button-next"
          >
            {updatePreferencesMutation.isPending ? 'Saving...' : 'Continue'}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}