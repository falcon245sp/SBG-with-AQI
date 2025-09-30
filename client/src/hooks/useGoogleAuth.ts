import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  classroomConnected: boolean;
}

interface Classroom {
  id: string;
  name: string;
  section?: string;
  students: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    photoUrl?: string;
  }>;
}

export function useGoogleAuth() {
  // For development, we'll store the googleId in localStorage after OAuth
  const googleId = localStorage.getItem('googleId');
  
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['/api/auth/user', googleId],
    queryFn: async () => {
      if (!googleId) return null;
      const response = await fetch(`/api/auth/user?googleId=${googleId}`);
      if (!response.ok) return null;
      return response.json();
    },
    retry: false,
    enabled: !!googleId,
  });

  return {
    user: user as User | undefined,
    isLoading: isLoading && !!googleId,
    isAuthenticated: !!user && !error && !!googleId,
    isClassroomConnected: (user as User)?.classroomConnected || false,
  };
}

export function useClassrooms() {
  const googleId = localStorage.getItem('googleId');
  
  const { data: classrooms, isLoading } = useQuery({
    queryKey: ['/api/classrooms', googleId],
    queryFn: async () => {
      if (!googleId) return [];
      const response = await fetch(`/api/classrooms?googleId=${googleId}`);
      if (!response.ok) return [];
      return response.json();
    },
    retry: false,
    enabled: !!googleId,
  });

  return {
    classrooms: classrooms as Classroom[] | undefined,
    isLoading: isLoading && !!googleId,
  };
}

export function useSyncClassroom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const googleId = localStorage.getItem('googleId');
      if (!googleId) {
        throw new Error('User not authenticated');
      }
      
      const response = await fetch('/api/auth/sync-classroom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ googleId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to sync classroom data');
      }
      
      return response.json();
    },
    onSuccess: () => {
      const googleId = localStorage.getItem('googleId');
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user', googleId] });
      queryClient.invalidateQueries({ queryKey: ['/api/classrooms', googleId] });
    },
  });
}