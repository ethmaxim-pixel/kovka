import { useEffect } from "react";
import { useLocation } from "wouter";

/*
 * ScrollToTop Component - Kovka Dvorik
 * Automatically scrolls to top of page when route changes
 */

export default function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "instant"
    });
  }, [location]);

  return null;
}
