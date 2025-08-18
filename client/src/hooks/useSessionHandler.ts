/**
 * Session Handler Hook
 * Provides elegant client-side handling of session expiration
 */

import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

interface SessionError {
  error: string;
  message: string;
  shouldRedirect: boolean;
  redirectUrl?: string;
}

export function useSessionHandler() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSessionError = useCallback((error: SessionError) => {
    // Show user-friendly error message
    toast({
      title: "Session Issue",
      description: error.message,
      variant: "destructive",
    });

    // Redirect to login if needed
    if (error.shouldRedirect && error.redirectUrl) {
      setTimeout(() => {
        setLocation(error.redirectUrl!);
      }, 2000); // Give user time to read the message
    }
  }, [toast, setLocation]);

  const handleApiResponse = useCallback(async (response: Response) => {
    if (response.status === 401 || response.status === 403) {
      try {
        const errorData = await response.json();
        if (errorData.error && errorData.message) {
          handleSessionError(errorData);
          return null; // Signal that this was a session error
        }
      } catch {
        // If we can't parse the error, handle it generically
        handleSessionError({
          error: 'SessionExpired',
          message: 'Your session has expired. Please sign in again.',
          shouldRedirect: true,
          redirectUrl: '/auth/login'
        });
        return null;
      }
    }
    return response; // Return the response if no session error
  }, [handleSessionError]);

  const fetchWithSessionHandling = useCallback(async (
    url: string, 
    options?: RequestInit
  ): Promise<Response | null> => {
    try {
      const response = await fetch(url, {
        credentials: 'include',
        ...options,
      });
      
      return await handleApiResponse(response);
    } catch (error) {
      // Handle network errors
      toast({
        title: "Network Error",
        description: "Unable to connect to the server. Please check your connection.",
        variant: "destructive",
      });
      throw error;
    }
  }, [handleApiResponse, toast]);

  const checkSession = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetchWithSessionHandling('/api/auth/user');
      if (response === null) {
        // Session error was handled
        return false;
      }
      
      return response.ok;
    } catch {
      return false;
    }
  }, [fetchWithSessionHandling]);

  return {
    handleSessionError,
    handleApiResponse,
    fetchWithSessionHandling,
    checkSession,
  };
}

export default useSessionHandler;