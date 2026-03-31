import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import useStore from "@/store/useStore";
import { apiGetMe, setAuthToken, getAuthToken } from "@/lib/api";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CreateAssignment from "./pages/CreateAssignment";
import Workspace from "./pages/Workspace";
import Analysis from "./pages/Analysis";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, allowedRole }: { children: React.ReactNode, allowedRole?: 'teacher' | 'student' }) => {
  const user = useStore(state => state.user);
  if (!user) return <Navigate to="/auth" replace />;
  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'teacher' ? '/dashboard' : '/workspace'} replace />;
  }
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useStore(state => state.user);
  if (user) {
    return <Navigate to={user.role === 'teacher' ? '/dashboard' : '/workspace'} replace />;
  }
  return <>{children}</>;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const { user, theme } = useStore();

  // Validate JWT token on app load
  useEffect(() => {
    const token = getAuthToken();
    if (token && !user) {
      apiGetMe()
        .then(res => useStore.getState().setUser(res.user))
        .catch(() => { setAuthToken(null); useStore.getState().logout(); });
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Ensure each route starts at the top to avoid carrying scroll offsets
  // that can make the next page appear blank until manual scrolling.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  // Sync auth state instantly across all browser tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'powai-storage') {
        useStore.persist.rehydrate();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        {/* Public Only Routes */}
        <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><Auth /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Auth /></PublicRoute>} />
        <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
        
        {/* Protected Teacher Routes */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRole="teacher"><Dashboard /></ProtectedRoute>} />
        <Route path="/create-assignment" element={<ProtectedRoute allowedRole="teacher"><CreateAssignment /></ProtectedRoute>} />
        <Route path="/analysis/:id" element={<ProtectedRoute allowedRole="teacher"><Analysis /></ProtectedRoute>} />
        
        {/* Protected Student Routes */}
        <Route path="/workspace" element={<ProtectedRoute allowedRole="student"><Workspace /></ProtectedRoute>} />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
