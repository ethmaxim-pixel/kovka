import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import Home from "./pages/Home";
import Catalog from "./pages/Catalog";
import Examples from "./pages/Examples";
import Partners from "./pages/Partners";
import Delivery from "./pages/Delivery";
import Contacts from "./pages/Contacts";
import Blog from "./pages/Blog";
import Sales from "./pages/Sales";
import Product from "./pages/Product";
import ScrollToTop from "./components/ScrollToTop";
import Cart from "./pages/Cart";
import Admin from "./pages/Admin";
import { OrganizationSchema, LocalBusinessSchema } from "./components/SEO";
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/catalog" component={Catalog} />
      <Route path="/examples" component={Examples} />
      <Route path="/partners" component={Partners} />
      <Route path="/delivery" component={Delivery} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/blog" component={Blog} />
      <Route path="/sales" component={Sales} />
      <Route path="/product/:id" component={Product} />
      <Route path="/cart" component={Cart} />
      {/* TODO: Re-enable ProtectedRoute when OAuth is configured */}
      <Route path="/admin" component={Admin} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <TooltipProvider>
          <CartProvider>
            <FavoritesProvider>
              <Toaster />
              <ScrollToTop />
              <OrganizationSchema />
              <LocalBusinessSchema />
              <Router />
            </FavoritesProvider>
          </CartProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
