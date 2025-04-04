import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Form validation schema
const formSchema = z.object({
  name: z.string().min(1, {
    message: "Site name is required",
  }),
  url: z.string().url({
    message: "Please enter a valid URL",
  }),
  apiKey: z.string().min(8, {
    message: "API key must be at least 8 characters",
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface AddSiteFormProps {
  onSuccess?: () => void;
}

const AddSiteForm = ({ onSuccess }: AddSiteFormProps) => {
  const { toast } = useToast();
  const [isGeneratingApiKey, setIsGeneratingApiKey] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      url: "",
      apiKey: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await apiRequest("POST", "/api/sites", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({
        title: "Success!",
        description: "Site has been added successfully",
      });
      form.reset();
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error adding site",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    mutation.mutate(data);
  };

  // Generate a random API key
  const generateApiKey = () => {
    setIsGeneratingApiKey(true);
    
    // Simulate API key generation with a short delay
    setTimeout(() => {
      const randomKey = Array.from(
        { length: 24 },
        () => "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"[
          Math.floor(Math.random() * 62)
        ]
      ).join("");
      
      form.setValue("apiKey", randomKey);
      setIsGeneratingApiKey(false);
    }, 500);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Site Name</FormLabel>
              <FormControl>
                <Input placeholder="My WordPress Site" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Site URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="apiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Key</FormLabel>
              <div className="flex space-x-2">
                <FormControl>
                  <Input placeholder="API Key for site authentication" {...field} />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateApiKey}
                  disabled={isGeneratingApiKey}
                >
                  {isGeneratingApiKey ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Generate"
                  )}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          className="w-full" 
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding Site...
            </>
          ) : (
            "Add Site"
          )}
        </Button>
      </form>
    </Form>
  );
};

export default AddSiteForm;
