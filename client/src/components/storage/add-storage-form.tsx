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
import OAuthPopup from "./oauth-popup";

// Create nested credential schema
// NOTE: This is named configSchema to match the database field name (config, not credentials)
const configSchema = z.object({
  token: z.string().optional(),
  refreshToken: z.string().optional(),
  accessKey: z.string().optional(),
  secretKey: z.string().optional(),
  bucket: z.string().optional(),
  region: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  host: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  port: z.string().optional(),
  path: z.string().optional(),
});

// Form validation schema
const formSchema = z.object({
  name: z.string().min(1, {
    message: "Provider name is required",
  }),
  type: z.enum(["google", "dropbox", "s3", "ftp", "local", "onedrive", "github"]),
  config: configSchema,
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
      type: "google",
      config: {
        token: "",
        refreshToken: "",
        accessKey: "",
        secretKey: "",
        bucket: "",
        region: "",
        clientId: "",
        clientSecret: "",
        host: "",
        username: "",
        password: "",
        port: "",
        path: "",
      },
      quota: null,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return await apiRequest("POST", "/api/storage-providers", data);
    },
    onSuccess: () => {
      // Invalidate both storage providers list and any other related queries
      queryClient.invalidateQueries({ queryKey: ["/api/storage-providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
      
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
    // Format config fields based on provider type
    let configObj = {};
    
    switch (data.type) {
      case "google":
        configObj = {
          token: form.watch("config.token") || "",
          refreshToken: form.watch("config.refreshToken") || "",
        };
        break;
      case "dropbox":
        configObj = {
          token: form.watch("config.token") || "",
        };
        break;
      case "s3":
        configObj = {
          accessKey: form.watch("config.accessKey") || "",
          secretKey: form.watch("config.secretKey") || "",
          bucket: form.watch("config.bucket") || "",
          region: form.watch("config.region") || "us-east-1",
        };
        break;
      case "onedrive":
        configObj = {
          token: form.watch("config.token") || "",
          refreshToken: form.watch("config.refreshToken") || "",
          clientId: form.watch("config.clientId") || "",
          clientSecret: form.watch("config.clientSecret") || "",
        };
        break;
      case "ftp":
        configObj = {
          host: form.watch("config.host") || "",
          username: form.watch("config.username") || "",
          password: form.watch("config.password") || "",
          port: form.watch("config.port") || "21",
        };
        break;
      case "github":
        configObj = {
          token: form.watch("config.token") || "",
          owner: form.watch("config.username") || "",
          repo: form.watch("config.path") || "",
        };
        break;
      case "local":
        configObj = {
          path: form.watch("config.path") || "",
        };
        break;
    }

    mutation.mutate({
      ...data,
      config: configObj,
    });
  };

  // Render dynamic credential fields based on provider type
  const renderCredentialFields = () => {
    const providerType = form.watch("type");
    
    switch (providerType) {
      case "google":
        return (
          <div className="space-y-4">
            <div className="flex flex-col items-center p-4 border rounded-md border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <p className="mb-4 text-center text-sm text-gray-600 dark:text-gray-400">
                Connect your Google Drive account to back up your files
              </p>
              
              {form.watch("config.token") ? (
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-100 dark:border-green-900">
                    <span className="text-green-700 dark:text-green-400 text-sm flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      Google Drive connected
                    </span>
                    <Button 
                      variant="ghost" 
                      className="h-7 text-xs" 
                      onClick={() => {
                        form.setValue("config.token", "");
                        form.setValue("config.refreshToken", "");
                      }}
                    >
                      Disconnect
                    </Button>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Token available (saved securely)
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  <OAuthPopup 
                    providerType="google"
                    className="w-full"
                    hasExistingToken={Boolean(form.watch("config.token"))}
                    onSuccess={(credentials) => {
                      form.setValue("config.token", credentials.token);
                      form.setValue("config.refreshToken", credentials.refreshToken || "");
                    }}
                  />
                </div>
              )}
            </div>
            
            {/* Hidden fields to store the tokens */}
            <input type="hidden" {...form.register("config.token")} />
            <input type="hidden" {...form.register("config.refreshToken")} />
          </div>
        );
      
      case "dropbox":
        return (
          <div className="space-y-4">
            <div className="flex flex-col items-center p-4 border rounded-md border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <p className="mb-4 text-center text-sm text-gray-600 dark:text-gray-400">
                Connect your Dropbox account to back up your files
              </p>
              
              {form.watch("config.token") ? (
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-100 dark:border-green-900">
                    <span className="text-green-700 dark:text-green-400 text-sm flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      Dropbox connected
                    </span>
                    <Button 
                      variant="ghost" 
                      className="h-7 text-xs" 
                      onClick={() => {
                        form.setValue("config.token", "");
                      }}
                    >
                      Disconnect
                    </Button>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Token available (saved securely)
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  <OAuthPopup 
                    providerType="dropbox"
                    className="w-full"
                    hasExistingToken={Boolean(form.watch("config.token"))}
                    onSuccess={(credentials) => {
                      form.setValue("config.token", credentials.token);
                    }}
                  />
                </div>
              )}
            </div>
            
            {/* Hidden fields to store the tokens */}
            <input type="hidden" {...form.register("config.token")} />
          </div>
        );
      
      case "s3":
        return (
          <>
            <FormField
              control={form.control}
              name="config.accessKey"
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
              name="config.secretKey"
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
              name="config.bucket"
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
              name="config.region"
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
      
      case "github":
        return (
          <>
            <FormField
              control={form.control}
              name="config.token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GitHub Personal Access Token</FormLabel>
                  <FormControl>
                    <Input placeholder="ghp_xxxxxxxxxxxx" type="password" {...field} />
                  </FormControl>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Create a token with 'repo' scope at{" "}
                    <a 
                      href="https://github.com/settings/tokens" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      github.com/settings/tokens
                    </a>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="config.username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GitHub Username or Organization</FormLabel>
                  <FormControl>
                    <Input placeholder="username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="config.path"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repository Name</FormLabel>
                  <FormControl>
                    <Input placeholder="backup-repository" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
      
      case "onedrive":
        return (
          <div className="space-y-4">
            <div className="flex flex-col items-center p-4 border rounded-md border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <p className="mb-4 text-center text-sm text-gray-600 dark:text-gray-400">
                Connect your OneDrive account to back up your files
              </p>
              
              {form.watch("config.token") ? (
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-100 dark:border-green-900">
                    <span className="text-green-700 dark:text-green-400 text-sm flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      OneDrive connected
                    </span>
                    <Button 
                      variant="ghost" 
                      className="h-7 text-xs" 
                      onClick={() => {
                        form.setValue("config.token", "");
                        form.setValue("config.refreshToken", "");
                      }}
                    >
                      Disconnect
                    </Button>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Token available (saved securely)
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  <OAuthPopup 
                    providerType="onedrive"
                    className="w-full"
                    hasExistingToken={Boolean(form.watch("config.token"))}
                    onSuccess={(credentials) => {
                      form.setValue("config.token", credentials.token);
                      form.setValue("config.refreshToken", credentials.refreshToken || "");
                    }}
                  />
                </div>
              )}
            </div>
            
            {/* Hidden fields to store the tokens */}
            <input type="hidden" {...form.register("config.token")} />
            <input type="hidden" {...form.register("config.refreshToken")} />
          </div>
        );
      
      case "ftp":
        return (
          <>
            <FormField
              control={form.control}
              name="config.host"
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
              name="config.username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>FTP Username</FormLabel>
                  <FormControl>
                    <Input placeholder="username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="config.password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>FTP Password</FormLabel>
                  <FormControl>
                    <Input placeholder="password" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="config.port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>FTP Port</FormLabel>
                  <FormControl>
                    <Input placeholder="21" type="number" {...field} />
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
            name="config.path"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Local Path</FormLabel>
                <FormControl>
                  <Input placeholder="/path/to/backup/directory" {...field} />
                </FormControl>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This should be an absolute path on the server
                </div>
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Storage Provider Name</FormLabel>
              <FormControl>
                <Input placeholder="My Google Drive Backup" {...field} />
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="google">Google Drive</SelectItem>
                  <SelectItem value="dropbox">Dropbox</SelectItem>
                  <SelectItem value="s3">Amazon S3</SelectItem>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="onedrive">OneDrive</SelectItem>
                  <SelectItem value="ftp">FTP Server</SelectItem>
                  <SelectItem value="local">Local Storage</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Provider Settings</h3>
          {renderCredentialFields()}
        </div>
        
        <FormField
          control={form.control}
          name="quota"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Storage Quota (MB)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder="Leave empty for unlimited" 
                  {...field} 
                  value={field.value === null ? "" : field.value} 
                  onChange={e => field.onChange(e.target.value)}
                />
              </FormControl>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Optional: Limit the amount of storage space this provider can use
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" disabled={mutation.isPending} className="w-full">
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding Provider...
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