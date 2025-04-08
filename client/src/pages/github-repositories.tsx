import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import GitHubRepoList from "@/components/github/github-repo-list";
import { Search, Loader2 } from "lucide-react";

export default function GitHubRepositories() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Example query that we'll replace later with actual GitHub repositories data
  const { data: repos, isLoading, isError } = useQuery({
    queryKey: ["/api/github/repos"],
    enabled: false, // Disable until we have the API endpoint
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-100">GitHub Repositories</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your GitHub repositories for backup and version control</p>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
          <input
            placeholder="Search repositories..."
            className="pl-8 w-full h-10 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-400 dark:focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Repository List */}
      <GitHubRepoList />
    </div>
  );
}