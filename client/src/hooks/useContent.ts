import { trpc } from "@/lib/trpc";

/**
 * Hook to fetch dynamic content from the CMS
 * Use this to display editable text on the site
 */

/**
 * Get a single content item by key
 * @param key - The unique content key (e.g., "home.hero.title")
 * @param fallback - Optional fallback value if content not found
 */
export function useContent(key: string, fallback?: string) {
  const { data, isLoading, error } = trpc.content.getByKey.useQuery(
    { key },
    {
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      refetchOnWindowFocus: false,
    }
  );

  return {
    value: data?.value ?? fallback ?? "",
    isLoading,
    error,
    content: data,
  };
}

/**
 * Get all content for a specific page
 * @param page - The page name (e.g., "home", "about")
 */
export function usePageContent(page: string) {
  const { data, isLoading, error } = trpc.content.getByPage.useQuery(
    { page },
    {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    }
  );

  // Convert array to object keyed by content key for easier access
  const contentMap = data?.reduce(
    (acc, item) => {
      acc[item.key] = item.value;
      return acc;
    },
    {} as Record<string, string>
  );

  /**
   * Get content value by key with optional fallback
   */
  const get = (key: string, fallback?: string): string => {
    return contentMap?.[key] ?? fallback ?? "";
  };

  return {
    content: data ?? [],
    contentMap: contentMap ?? {},
    get,
    isLoading,
    error,
  };
}

/**
 * Get all site content (useful for preloading)
 */
export function useAllContent() {
  const { data, isLoading, error, refetch } = trpc.content.getAll.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Convert to nested object structure
  const contentTree = data?.reduce(
    (acc, item) => {
      if (!acc[item.page]) {
        acc[item.page] = {};
      }
      acc[item.page][item.key] = item.value;
      return acc;
    },
    {} as Record<string, Record<string, string>>
  );

  /**
   * Get content value by full key with optional fallback
   */
  const get = (key: string, fallback?: string): string => {
    const item = data?.find((c) => c.key === key);
    return item?.value ?? fallback ?? "";
  };

  return {
    content: data ?? [],
    contentTree: contentTree ?? {},
    get,
    isLoading,
    error,
    refetch,
  };
}
