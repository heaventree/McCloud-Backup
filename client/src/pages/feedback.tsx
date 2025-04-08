import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { MessageSquare, Clock, CheckCircle, AlertTriangle, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Feedback } from '@shared/schema';

interface FeedbackStats {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  byPriority: {
    low: number;
    medium: number;
    high: number;
  };
}

const FeedbackDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('default');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  const { toast } = useToast();
  
  // Fetch feedback items
  const { data: feedbackItems, isLoading } = useQuery<Feedback[]>({
    queryKey: ['/api/feedback', selectedProject],
    queryFn: async () => {
      return apiRequest<Feedback[]>('GET', `/api/feedback?projectId=${selectedProject}`);
    },
  });
  
  // Fetch feedback stats
  const { data: stats } = useQuery<FeedbackStats>({
    queryKey: ['/api/feedback/stats', selectedProject],
    queryFn: async () => {
      return apiRequest<FeedbackStats>('GET', `/api/feedback/stats?projectId=${selectedProject}`);
    },
  });
  
  // Update feedback status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number, status: string }) => 
      apiRequest<Feedback>('PUT', `/api/feedback/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feedback'] });
      queryClient.invalidateQueries({ queryKey: ['/api/feedback/stats'] });
      toast({
        title: "Status updated",
        description: "Feedback status has been updated successfully."
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update feedback status. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Update feedback priority mutation
  const updatePriorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: number, priority: string }) => 
      apiRequest<Feedback>('PUT', `/api/feedback/${id}`, { priority }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feedback'] });
      queryClient.invalidateQueries({ queryKey: ['/api/feedback/stats'] });
      toast({
        title: "Priority updated",
        description: "Feedback priority has been updated successfully."
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update feedback priority. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Handle status update
  const handleStatusChange = (id: number, status: string) => {
    updateStatusMutation.mutate({ id, status });
  };
  
  // Handle priority update
  const handlePriorityChange = (id: number, priority: string) => {
    updatePriorityMutation.mutate({ id, priority });
  };
  
  // Filter feedback items based on status, priority and search
  const filteredItems = feedbackItems?.filter(item => {
    // Filter by status tab
    if (activeTab !== 'all' && item.status !== activeTab) {
      return false;
    }
    
    // Filter by priority
    if (filterPriority !== 'all' && item.priority !== filterPriority) {
      return false;
    }
    
    // Filter by search term
    if (searchTerm && !item.comment.toLowerCase().includes(searchTerm.toLowerCase()) && !item.pagePath.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    return true;
  });
  
  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };
  
  // Get priority badge color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feedback Management</h1>
          <p className="text-muted-foreground">View and manage feedback from your websites</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default Project</SelectItem>
              {/* Add more projects as needed */}
            </SelectContent>
          </Select>
          
          <Button variant="outline" asChild>
            <a href="/components/feedback/standalone.html" target="_blank" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Demo Widget
            </a>
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Total Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Open</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.open}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{stats.inProgress}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.completed}</div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Filters and Tabs */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-4 w-full md:w-[400px]">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="in-progress">In Progress</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Search comments or pages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-[300px]"
            />
            
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Feedback List */}
      <div className="space-y-4">
        {isLoading ? (
          // Loading state
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-9 w-20 mr-2" />
                <Skeleton className="h-9 w-20" />
              </CardFooter>
            </Card>
          ))
        ) : filteredItems && filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between">
                  <CardTitle className="text-lg font-medium">
                    {item.pagePath}
                  </CardTitle>
                  <div className="text-sm text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <CardDescription>
                  <span className="text-sm text-muted-foreground">
                    Position: {Math.round(item.x)}%, {Math.round(item.y)}%
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{item.comment}</p>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2 justify-between">
                <div className="flex flex-wrap gap-2">
                  <Badge className={getStatusColor(item.status)}>
                    {item.status === 'open' && <MessageSquare className="h-3 w-3 mr-1" />}
                    {item.status === 'in-progress' && <Clock className="h-3 w-3 mr-1" />}
                    {item.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1).replace('-', ' ')}
                  </Badge>
                  
                  <Badge className={getPriorityColor(item.priority)}>
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)} Priority
                  </Badge>
                </div>
                
                <div className="flex gap-2">
                  <Select 
                    value={item.status} 
                    onValueChange={(value) => handleStatusChange(item.id, value)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Set status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select 
                    value={item.priority} 
                    onValueChange={(value) => handlePriorityChange(item.id, value)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Set priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardFooter>
            </Card>
          ))
        ) : (
          <Card className="py-8">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">No feedback found</h3>
              <p className="text-muted-foreground">
                {searchTerm || filterPriority !== 'all' || activeTab !== 'all' ? 
                  'Try adjusting your filters to see more results.' : 
                  'Get started by adding the feedback widget to your website.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default FeedbackDashboard;