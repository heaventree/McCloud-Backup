import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Shield } from 'lucide-react';
import { secureFetch, getFetchOptions, fetchCsrfToken, getCsrfToken } from '@/lib/csrf';

const loginSchema = z.object({
  username: z.string().min(1, { message: 'Username is required' }),
  password: z.string().min(1, { message: 'Password is required' })
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Check if already authenticated
  const { data: authData } = useQuery({ 
    queryKey: ['auth-status'],
    queryFn: async () => {
      try {
        const response = await secureFetch('/api/status');
        if (!response.ok) {
          return { authenticated: false };
        }
        return response.json();
      } catch (error) {
        return { authenticated: false };
      }
    }
  });
  
  // Fetch CSRF token on mount and redirect if authenticated
  useEffect(() => {
    const initPage = async () => {
      // Make sure we have a CSRF token
      await fetchCsrfToken();
      
      // Redirect if authenticated
      if (authData?.authenticated) {
        window.location.href = '/dashboard';
      }
    };
    
    initPage();
  }, [authData]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: ''
    }
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    
    try {
      // Ensure we have a CSRF token before login
      await fetchCsrfToken();
      
      // Get the token - we've already ensured it exists above
      const token = getCsrfToken();
      console.log('Using CSRF token for login:', token);
      
      // Manual fetch with explicit token in header
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRF-Token': token
        },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        toast({
          title: 'Login Successful',
          description: 'Welcome to the WordPress Backup Dashboard',
        });
        
        // Force page reload to update auth state
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 500);
      } else {
        const errorData = await response.json();
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: errorData.error || 'Invalid username or password',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Login Error',
        description: 'An error occurred during login. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-3">
              <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Admin Login</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access the WordPress Backup Dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter admin username" 
                        {...field} 
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        {...field} 
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Protected area. Only authorized administrators can access this dashboard.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}