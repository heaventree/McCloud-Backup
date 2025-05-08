import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { isDefined, safeArray } from '@/utils/type-utils';
import { Feedback, FeedbackComment } from '@/lib/types';
import { MessageSquare, Activity, Filter, Search, RefreshCw } from 'lucide-react';

export default function FeedbackPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'open', 'in-progress', 'resolved'

  // Fetch feedback data with polling
  const { data: feedbacks, isLoading, isError } = useQuery({
    queryKey: ['/api/feedbacks'],
    refetchInterval: 2000, // Poll every 2 seconds for updates
  });

  // Handle comment submission
  const addCommentMutation = useMutation({
    mutationFn: async ({ feedbackId, content }: { feedbackId: number, content: string }) => {
      const response = await apiRequest('POST', `/api/feedbacks/${feedbackId}/comments`, {
        author: 'You', // Replace with actual user info
        content
      });
      return response.json();
    },
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['/api/feedbacks'] });
      toast({
        title: "Comment added",
        description: "Your comment has been added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error adding comment",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  });

  // Update feedback status
  const updateFeedbackMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<Feedback> }) => {
      const response = await apiRequest('PUT', `/api/feedbacks/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feedbacks'] });
      toast({
        title: "Feedback updated",
        description: "Feedback has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating feedback",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  });

  // Handle comment submission
  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeedback || !newComment.trim()) return;
    
    addCommentMutation.mutate({
      feedbackId: selectedFeedback.id,
      content: newComment
    });
  };

  // Status badge color mapping
  const getStatusBadgeColor = (status: string) => {
    switch(status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Priority badge color mapping
  const getPriorityBadgeColor = (priority: string) => {
    switch(priority) {
      case 'low': return 'bg-gray-100 text-gray-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Open feedback details dialog
  const openFeedbackDetails = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setIsDetailsOpen(true);
  };

  // Update feedback status
  const updateFeedbackStatus = (status: string) => {
    if (!selectedFeedback) return;
    
    updateFeedbackMutation.mutate({
      id: selectedFeedback.id,
      data: { status }
    });
    
    // Update local state for immediate UI update
    setSelectedFeedback({
      ...selectedFeedback,
      status
    });
  };

  // Filter feedbacks based on active tab, status, priority, and search term
  const filteredFeedbacks = React.useMemo(() => {
    if (!feedbacks || !Array.isArray(feedbacks)) return [];
    
    return feedbacks.filter((feedback: Feedback) => {
      // Filter by tab (status)
      if (activeTab !== 'all' && feedback.status !== activeTab) return false;
      
      // Filter by status dropdown
      if (statusFilter && feedback.status !== statusFilter) return false;
      
      // Filter by priority dropdown
      if (priorityFilter && feedback.priority !== priorityFilter) return false;
      
      // Filter by search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          feedback.title.toLowerCase().includes(term) ||
          feedback.description.toLowerCase().includes(term) ||
          feedback.pagePath.toLowerCase().includes(term)
        );
      }
      
      return true;
    });
  }, [feedbacks, activeTab, statusFilter, priorityFilter, searchTerm]);

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Feedback Dashboard</h1>
          <p className="text-gray-500">Manage and respond to user feedback</p>
        </div>
        <Button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/feedbacks'] })}
          variant="outline"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>
      </Tabs>
      
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search feedbacks..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={statusFilter || ''} onValueChange={(value) => setStatusFilter(value || null)}>
            <SelectTrigger className="w-[150px]">
              <div className="flex items-center">
                <Filter className="h-4 w-4 mr-2 text-gray-500" />
                <span>{statusFilter || 'Status'}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={priorityFilter || ''} onValueChange={(value) => setPriorityFilter(value || null)}>
            <SelectTrigger className="w-[150px]">
              <div className="flex items-center">
                <Activity className="h-4 w-4 mr-2 text-gray-500" />
                <span>{priorityFilter || 'Priority'}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-gray-500">Loading feedbacks...</p>
        </div>
      ) : isError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-center text-red-500">
            <p>Failed to load feedback data. Please try again.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/feedbacks'] })}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : filteredFeedbacks.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-300 mb-2" />
            <p>No feedback found matching your criteria.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden md:table-cell">Page</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="hidden md:table-cell">Comments</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFeedbacks.map((feedback: Feedback) => (
                <TableRow key={feedback.id}>
                  <TableCell className="font-medium">{feedback.title}</TableCell>
                  <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                    {feedback.pagePath}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusBadgeColor(feedback.status)}>
                      {feedback.status.charAt(0).toUpperCase() + feedback.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPriorityBadgeColor(feedback.priority)}>
                      {feedback.priority.charAt(0).toUpperCase() + feedback.priority.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {format(new Date(feedback.createdAt), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {safeArray(feedback.comments).length}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => openFeedbackDetails(feedback)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      
      {/* Feedback Details Dialog */}
      {selectedFeedback && (
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">{selectedFeedback.title}</DialogTitle>
              <DialogDescription>
                {selectedFeedback.pagePath}
                {selectedFeedback.elementPath && (
                  <span className="block text-xs bg-gray-100 p-1 rounded mt-1">
                    Element: {selectedFeedback.elementPath}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col md:flex-row gap-6 mt-4">
              <div className="flex-1">
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-2">Description</h3>
                  <div className="p-3 bg-gray-50 rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{selectedFeedback.description}</p>
                  </div>
                </div>
                
                {selectedFeedback.coordinates && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium mb-2">Coordinates</h3>
                    <div className="p-3 bg-gray-50 rounded-md">
                      <p className="text-sm">X: {selectedFeedback.coordinates.x}, Y: {selectedFeedback.coordinates.y}</p>
                    </div>
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-2">Comments</h3>
                  {safeArray(selectedFeedback.comments).length > 0 ? (
                    <div className="space-y-3">
                      {safeArray(selectedFeedback.comments).map((comment: FeedbackComment) => (
                        <div key={comment.id} className="p-3 bg-gray-50 rounded-md">
                          <div className="flex items-center mb-2">
                            <Avatar className="h-6 w-6 mr-2">
                              <AvatarFallback>{comment.author.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{comment.author}</span>
                            <span className="text-xs text-gray-500 ml-auto">
                              {format(new Date(comment.createdAt), 'MMM dd, yyyy HH:mm')}
                            </span>
                          </div>
                          <p className="text-sm">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-3">
                      No comments yet
                    </div>
                  )}
                </div>
                
                <form onSubmit={handleCommentSubmit}>
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="mb-2"
                  />
                  <Button 
                    type="submit" 
                    disabled={!newComment.trim() || addCommentMutation.isPending}
                  >
                    {addCommentMutation.isPending ? 'Adding...' : 'Add Comment'}
                  </Button>
                </form>
              </div>
              
              <div className="w-full md:w-64">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Status</h3>
                    <Select 
                      value={selectedFeedback.status} 
                      onValueChange={updateFeedbackStatus}
                      disabled={updateFeedbackMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Priority</h3>
                    <Select 
                      value={selectedFeedback.priority}
                      onValueChange={(value) => {
                        updateFeedbackMutation.mutate({
                          id: selectedFeedback.id,
                          data: { priority: value }
                        });
                        setSelectedFeedback({
                          ...selectedFeedback,
                          priority: value
                        });
                      }}
                      disabled={updateFeedbackMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Dates</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Created:</span>
                        <span>{format(new Date(selectedFeedback.createdAt), 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Updated:</span>
                        <span>{format(new Date(selectedFeedback.updatedAt), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                  
                  {isDefined(selectedFeedback.assignedTo) && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Assigned To</h3>
                      <div className="flex items-center">
                        <Avatar className="h-8 w-8 mr-2">
                          <AvatarFallback>{selectedFeedback.assignedTo.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{selectedFeedback.assignedTo}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}