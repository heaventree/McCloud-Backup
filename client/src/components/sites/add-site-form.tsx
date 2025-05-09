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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { secureFetch } from "@/lib/csrf";

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
});

type FormValues = z.infer<typeof formSchema>;

interface AddSiteFormProps {
  onSuccess?: () => void;
}

export default function AddSiteForm({ onSuccess }: AddSiteFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Define the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      url: "",
      apiKey: "",
    },
  });

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      // Format URL if necessary (remove https:// or http://)
      const formattedUrl = data.url.replace(/^https?:\/\//i, "");

      const response = await secureFetch("/api/sites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.name,
          url: formattedUrl,
          apiKey: data.apiKey,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add site");
      }

      // Show success toast
      toast({
        title: "Site added successfully",
        description: `${data.name} has been added to your sites.`,
      });

      // Invalidate the sites query to refetch the data
      queryClient.invalidateQueries({
        queryKey: ["/api/sites"], 
      });

      // Reset form
      form.reset();

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast({
        title: "Error adding site",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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

        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting ? (
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