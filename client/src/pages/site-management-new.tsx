import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Site } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import AddSiteForm from "@/components/sites/add-site-form";
import GitHubRepoList from "@/components/github/github-repo-list";
import { 
  Plus, 
  Search, 
  Loader2, 
  Globe,
  Github
} from "lucide-react";

const SiteManagementNew = () => {
  const { toast } = useToast();
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch sites data
  const { data: sites, isLoading: sitesLoading, isError: sitesError } = useQuery({
    queryKey: ["/api/sites"],
  });

  // Filter sites based on search term
  const filteredSites = sites && Array.isArray(sites) 
    ? sites.filter((site: Site) => 
        site.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        site.url.toLowerCase().includes(searchTerm.toLowerCase())
      ) 
    : [];

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-100">Site Management</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your WordPress sites and GitHub repositories</p>
        </div>
        <Dialog open={isAddingSite} onOpenChange={setIsAddingSite}>
          <DialogTrigger asChild>
            <Button className="mt-4 sm:mt-0 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="mr-1 h-4 w-4" />
              Add Site
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
            <DialogHeader>
              <DialogTitle className="text-gray-800 dark:text-gray-100">Add a new site</DialogTitle>
              <DialogDescription className="text-gray-500 dark:text-gray-400">
                Enter the details of the WordPress site you want to backup.
              </DialogDescription>
            </DialogHeader>
            <AddSiteForm onSuccess={() => setIsAddingSite(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
          <input
            placeholder="Search sites..."
            className="pl-8 w-full h-10 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-400 dark:focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="wordpress">
        <TabsList className="mb-6">
          <TabsTrigger value="wordpress" className="flex items-center">
            <Globe className="h-4 w-4 mr-2" />
            WordPress Sites
          </TabsTrigger>
          <TabsTrigger value="github" className="flex items-center">
            <Github className="h-4 w-4 mr-2" />
            GitHub Repositories
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="wordpress">
          {sitesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          ) : sitesError ? (
            <div className="text-center py-12 text-red-400">
              Failed to load sites
            </div>
          ) : filteredSites.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              {searchTerm ? "No sites match your search" : "No sites added yet"}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSites.map((site: Site) => (
                <Card key={site.id} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <CardTitle>{site.name}</CardTitle>
                    <CardDescription className="flex items-center">
                      <Globe className="h-3.5 w-3.5 mr-1" />
                      {site.url}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between">
                      <Button 
                        variant="outline" 
                        onClick={() => window.open(`https://${site.url}`, '_blank')}
                      >
                        Visit Site
                      </Button>
                      <Button>Manage Backups</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="github">
          <GitHubRepoList />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SiteManagementNew;