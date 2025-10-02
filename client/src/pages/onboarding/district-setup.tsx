import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Building2, Loader2, CheckCircle } from 'lucide-react';

export default function DistrictSetup() {
  const [, setLocation] = useLocation();
  const [districtName, setDistrictName] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [districtExists, setDistrictExists] = useState<boolean | null>(null);
  const [existingDistrict, setExistingDistrict] = useState<any>(null);

  useEffect(() => {
    if (districtName.trim().length < 3) {
      setDistrictExists(null);
      setExistingDistrict(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      try {
        const response = await fetch(`/api/districts/search?name=${encodeURIComponent(districtName)}`);
        const data = await response.json();
        setDistrictExists(data.exists);
        setExistingDistrict(data.district);
      } catch (error) {
        console.error('Error checking district:', error);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [districtName]);

  const handleContinue = async () => {
    if (!districtName.trim()) {
      alert("Please enter your district name");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/districts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: districtName.trim() }),
      });

      if (!response.ok) throw new Error('Failed to save district');

      const userData = await fetch('/api/auth/user').then(r => r.json());
      const userRole = userData?.selectedRole;
      
      if (userRole === 'district_admin' || userRole === 'curriculum_lead') {
        setLocation('/onboarding/rigor-policy-config');
      } else {
        setLocation('/onboarding/jurisdiction');
      }
    } catch (error) {
      console.error('Error saving district:', error);
      alert("Failed to save district. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="p-6 text-center border-b">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold">District Setup</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Enter your district name to configure rigor policies
          </p>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label htmlFor="districtName" className="block text-sm font-medium">District Name</label>
            <div className="relative">
              <input
                id="districtName"
                type="text"
                placeholder="Enter your school district name"
                value={districtName}
                onChange={(e) => setDistrictName(e.target.value)}
                disabled={isSaving}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {isChecking && (
                <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-gray-400" />
              )}
            </div>
          </div>

          {districtExists === true && existingDistrict && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <p className="text-sm text-green-800">
                <strong>{existingDistrict.name}</strong> found in our system. You'll be associated with this district.
              </p>
            </div>
          )}

          {districtExists === false && districtName.trim().length >= 3 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>{districtName}</strong> will be created as a new district.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setLocation('/auth/google')}
              disabled={isSaving}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleContinue}
              disabled={!districtName.trim() || isSaving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Continue'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
