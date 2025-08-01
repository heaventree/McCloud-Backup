import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Clock } from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Define the form schema using zod
const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  url: z
    .string()
    .min(3, { message: "URL must be at least 3 characters" })
    .refine(
      (val) => {
        // Simple URL validation, can be more complex if needed
        return !val.includes(" ") && val.includes(".");
      },
      { message: "Please enter a valid URL" }
    ),
  apiKey: z.string().min(5, { message: "API Key must be at least 5 characters" }),
  backupFrequency: z.enum(["ondemand", "daily", "weekly", "monthly", "yearly"], {
    required_error: "Please select a backup frequency",
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface AddSiteFormProps {
  onSuccess?: () => void;
}

export default function AddSiteForm({ onSuccess }: AddSiteFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Define the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      url: "",
      apiKey: "",
      backupFrequency: "ondemand",
    },
  });

  // Add site mutation
  const addSiteMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // Format URL if necessary (remove https:// or http://)
      const formattedUrl = data.url.replace(/^https?:\/\//i, "");

      const siteData = {
        name: data.name,
        url: formattedUrl,
        apiKey: data.apiKey,
        backupFrequency: data.backupFrequency,
      };

      const result = await apiRequest("POST", "/api/sites", siteData);
      return { ...siteData, ...result };
    },
    onMutate: async (data) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ["/api/sites"] });

      // Snapshot the previous value for rollback if needed
      const previousSites = queryClient.getQueryData(["/api/sites"]);

      // Don't do optimistic update for add - let the server response handle it
      // This ensures the UI refreshes with actual server state

      return { previousSites };
    },
    onSuccess: (result) => {
      // Force immediate invalidation and refetch
      queryClient.invalidateQueries({
        queryKey: ["/api/sites"],
        exact: false,
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/backups/recent"],
        exact: false,
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/backups"],
        exact: false,
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/stats"],
        exact: false,
        refetchType: "active",
      });

      // Force refetch with a small delay to ensure DB has settled
      setTimeout(() => {
        queryClient.refetchQueries({
          queryKey: ["/api/sites"],
          exact: false,
        });
      }, 100);

      toast({
        title: "Site added successfully",
        description: `${result.name} has been added to your sites.`,
      });

      // Reset form
      form.reset();

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousSites) {
        queryClient.setQueryData(["/api/sites"], context.previousSites);
      }

      toast({
        title: "Error adding site",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: FormValues) => {
    addSiteMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-700 dark:text-gray-300">Site Name</FormLabel>
              <FormControl>
                <Input 
                  placeholder="My WordPress Site" 
                  {...field} 
                  className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </FormControl>
              <FormMessage className="text-red-500" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-700 dark:text-gray-300">Site URL</FormLabel>
              <FormControl>
                <Input 
                  placeholder="mysite.com" 
                  {...field} 
                  className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </FormControl>
              <FormMessage className="text-red-500" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="apiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-700 dark:text-gray-300">API Key</FormLabel>
              <FormControl>
                <Input 
                  placeholder="WordPress Site API Key" 
                  {...field} 
                  className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </FormControl>
              <FormDescription className="text-xs text-gray-500">
                This key connects with the WordPress plugin on your site
              </FormDescription>
              <FormMessage className="text-red-500" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="backupFrequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Backup Frequency
              </FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="Select backup frequency" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <SelectItem value="ondemand" className="text-gray-900 dark:text-gray-100">
                    On Demand - Manual backups only
                  </SelectItem>
                  <SelectItem value="daily" className="text-gray-900 dark:text-gray-100">
                    Daily - Backup every day
                  </SelectItem>
                  <SelectItem value="weekly" className="text-gray-900 dark:text-gray-100">
                    Weekly - Backup once per week
                  </SelectItem>
                  <SelectItem value="monthly" className="text-gray-900 dark:text-gray-100">
                    Monthly - Backup once per month
                  </SelectItem>
                  <SelectItem value="yearly" className="text-gray-900 dark:text-gray-100">
                    Yearly - Backup once per year
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription className="text-xs text-gray-500">
                Choose how often you want automatic backups to run
              </FormDescription>
              <FormMessage className="text-red-500" />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            disabled={addSiteMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {addSiteMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Site"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}