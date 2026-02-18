import { createContext, useContext, useState, useEffect, ReactNode } from "react";

/*
 * Favorites Context - Kovka Dvorik
 * Manages favorites/wishlist state with localStorage persistence
 */

export interface FavoriteItem {
  id: number;
  name: string;
  price: number;
  image: string;
}

interface FavoritesContextType {
  items: FavoriteItem[];
  addItem: (item: FavoriteItem) => void;
  removeItem: (id: number) => void;
  toggleItem: (item: FavoriteItem) => void;
  clearFavorites: () => void;
  totalItems: number;
  isFavorite: (id: number) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

const FAVORITES_STORAGE_KEY = "kovka-dvorik-favorites";

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FavoriteItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
      } catch {
        // Clear corrupted data
        localStorage.removeItem(FAVORITES_STORAGE_KEY);
        return [];
      }
    }
    return [];
  });

  // Save to localStorage whenever items change
  useEffect(() => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (item: FavoriteItem) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === item.id)) {
        return prev; // Already in favorites
      }
      return [...prev, item];
    });
  };

  const removeItem = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleItem = (item: FavoriteItem) => {
    if (isFavorite(item.id)) {
      removeItem(item.id);
    } else {
      addItem(item);
    }
  };

  const clearFavorites = () => {
    setItems([]);
  };

  const totalItems = items.length;

  const isFavorite = (id: number) => items.some((item) => item.id === id);

  return (
    <FavoritesContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        toggleItem,
        clearFavorites,
        totalItems,
        isFavorite,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}
