import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Form validation schema
const formSchema = z.object({
  name: z.string().min(1, {
    message: "Provider name is required",
  }),
  type: z.enum(["google_drive", "dropbox", "s3", "ftp", "local"]),
  credentials: z.object({}).passthrough(),
  quota: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().nullable()
  ),
});

type FormValues = z.infer<typeof formSchema>;

interface AddStorageFormProps {
  onSuccess?: () => void;
}

const AddStorageForm = ({ onSuccess }: AddStorageFormProps) => {
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "google_drive",
      credentials: {},
      quota: null,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await apiRequest("POST", "/api/storage-providers", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-providers"] });
      toast({
        title: "Success!",
        description: "Storage provider has been added successfully",
      });
      form.reset();
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error adding storage provider",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    // Format credential fields based on provider type
    let credentials = {};
    
    switch (data.type) {
      case "google_drive":
        credentials = {
          token: form.watch("credentials.token") || "",
          refreshToken: form.watch("credentials.refreshToken") || "",
        };
        break;
      case "dropbox":
        credentials = {
          token: form.watch("credentials.token") || "",
        };
        break;
      case "s3":
        credentials = {
          accessKey: form.watch("credentials.accessKey") || "",
          secretKey: form.watch("credentials.secretKey") || "",
          bucket: form.watch("credentials.bucket") || "",
          region: form.watch("credentials.region") || "us-east-1",
        };
        break;
      case "ftp":
        credentials = {
          host: form.watch("credentials.host") || "",
          username: form.watch("credentials.username") || "",
          password: form.watch("credentials.password") || "",
          port: form.watch("credentials.port") || "21",
        };
        break;
      case "local":
        credentials = {
          path: form.watch("credentials.path") || "",
        };
        break;
    }

    mutation.mutate({
      ...data,
      credentials,
    });
  };

  // Render dynamic credential fields based on provider type
  const renderCredentialFields = () => {
    const providerType = form.watch("type");
    
    switch (providerType) {
      case "google_drive":
        return (
          <>
            <FormField
              control={form.control}
              name="credentials.token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Token</FormLabel>
                  <FormControl>
                    <Input placeholder="Google Drive Access Token" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.refreshToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Refresh Token</FormLabel>
                  <FormControl>
                    <Input placeholder="Google Drive Refresh Token" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
      
      case "dropbox":
        return (
          <FormField
            control={form.control}
            name="credentials.token"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Access Token</FormLabel>
                <FormControl>
                  <Input placeholder="Dropbox Access Token" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case "s3":
        return (
          <>
            <FormField
              control={form.control}
              name="credentials.accessKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Key</FormLabel>
                  <FormControl>
                    <Input placeholder="S3 Access Key" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.secretKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Secret Key</FormLabel>
                  <FormControl>
                    <Input placeholder="S3 Secret Key" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.bucket"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bucket Name</FormLabel>
                  <FormControl>
                    <Input placeholder="S3 Bucket Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region</FormLabel>
                  <FormControl>
                    <Input placeholder="us-east-1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
      
      case "ftp":
        return (
          <>
            <FormField
              control={form.control}
              name="credentials.host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>FTP Host</FormLabel>
                  <FormControl>
                    <Input placeholder="ftp.example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="FTP Username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input placeholder="FTP Password" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credentials.port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port</FormLabel>
                  <FormControl>
                    <Input placeholder="21" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
      
      case "local":
        return (
          <FormField
            control={form.control}
            name="credentials.path"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Local Path</FormLabel>
                <FormControl>
                  <Input placeholder="/path/to/backups" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Provider Name</FormLabel>
              <FormControl>
                <Input placeholder="My Storage Provider" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Provider Type</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="google_drive">Google Drive</SelectItem>
                  <SelectItem value="dropbox">Dropbox</SelectItem>
                  <SelectItem value="s3">Amazon S3</SelectItem>
                  <SelectItem value="ftp">FTP Server</SelectItem>
                  <SelectItem value="local">Local Storage</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {renderCredentialFields()}

        <FormField
          control={form.control}
          name="quota"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Storage Quota (GB)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder="Leave empty for unlimited" 
                  {...field}
                  value={field.value === null ? "" : field.value}
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value === "" ? null : parseInt(value) * 1024 * 1024 * 1024); // Convert GB to bytes
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          className="w-full mt-4" 
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding Storage Provider...
            </>
          ) : (
            "Add Storage Provider"
          )}
        </Button>
      </form>
    </Form>
  );
};

export default AddStorageForm;
