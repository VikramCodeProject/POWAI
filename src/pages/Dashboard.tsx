import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import PageTransition from '@/components/PageTransition';
import useStore, { Assignment } from '@/store/useStore';
import { apiDeleteAssignment, apiGetAssignments, apiGetSubmissions } from '@/lib/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const ITEMS_PER_PAGE = 10;

const Dashboard = () => {
  const navigate = useNavigate();
  const submissions = useStore((s) => s.submissions);
  const user = useStore(s => s.user);
  const logout = useStore(s => s.logout);
  const setUser = useStore(s => s.setUser);
  const loadSubmissions = useStore(s => s.loadSubmissions);

  const [activeTab, setActiveTab] = useState<'submissions' | 'assignments'>('submissions');
  const [dbAssignments, setDbAssignments] = useState<Assignment[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [deletingAssignments, setDeletingAssignments] = useState(false);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState(user?.name || '');

  // Search, filter, pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'genuine' | 'suspicious' | 'review'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshingSubmissions, setIsRefreshingSubmissions] = useState(false);

  const refreshSubmissions = useCallback(async () => {
    try {
      setIsRefreshingSubmissions(true);
      const subs = await apiGetSubmissions();
      loadSubmissions(subs);
    } catch (err) {
      console.error('Failed to refresh submissions from API:', err);
    } finally {
      setIsRefreshingSubmissions(false);
    }
  }, [loadSubmissions]);
  
  const handleSaveSettings = () => {
    if (user) {
      setUser({ ...user, name: settingsName });
    }
    setIsSettingsOpen(false);
  };

  const loadAssignments = async () => {
    try {
      setLoadingDb(true);
      const data = await apiGetAssignments();
      const assignments = data as unknown as Assignment[];
      setDbAssignments(assignments);
      setSelectedAssignmentIds((prev) => {
        const validIds = new Set(assignments.map((a) => a.id));
        return prev.filter((id) => validIds.has(id));
      });
    } catch (error) {
       console.error('Load assignments error:', error);
    } finally {
      setLoadingDb(false);
    }
  };

  const handleToggleAssignmentSelection = (id: string) => {
    setSelectedAssignmentIds((prev) =>
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]
    );
  };

  const handleToggleAllAssignments = () => {
    if (dbAssignments.length > 0 && selectedAssignmentIds.length === dbAssignments.length) {
      setSelectedAssignmentIds([]);
      return;
    }
    setSelectedAssignmentIds(dbAssignments.map((a) => a.id));
  };

  const handleDeleteSelectedAssignments = async () => {
    if (selectedAssignmentIds.length === 0 || deletingAssignments) return;

    const confirmed = window.confirm(
      `Delete ${selectedAssignmentIds.length} selected assignment(s)? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setDeletingAssignments(true);
      await Promise.all(selectedAssignmentIds.map((id) => apiDeleteAssignment(id)));
      setDbAssignments((prev) => prev.filter((assignment) => !selectedAssignmentIds.includes(assignment.id)));
      setSelectedAssignmentIds([]);
    } catch (error) {
      console.error('Delete assignments error:', error);
      window.alert('Failed to delete selected assignments. Please try again.');
    } finally {
      setDeletingAssignments(false);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("POWAI - Recent Submissions", 14, 22);
    
    const tableColumn = ["Student", "Assignment", "Authenticity Score", "Status", "Date"];
    const tableRows = filteredSubmissions.map(s => [
      s.studentName,
      s.assignmentTitle,
      `${s.score}%`,
      s.status.toUpperCase(),
      s.submittedAt
    ]);
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [84, 95, 115] }
    });
    
    doc.save("powai-submissions.pdf");
  };

  useEffect(() => {
    if (activeTab === 'assignments') {
       loadAssignments();
    }
  }, [activeTab]);

  // Keep submissions fresh on dashboard open, tab focus, and short polling.
  useEffect(() => {
    if (activeTab !== 'submissions') return;

    void refreshSubmissions();

    const intervalId = window.setInterval(() => {
      void refreshSubmissions();
    }, 3000);

    const handleFocus = () => {
      void refreshSubmissions();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshSubmissions();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeTab, refreshSubmissions]);

  // Stats (always computed from ALL submissions)
  const total = submissions.length;
  const genuine = submissions.filter((s) => s.status === 'genuine').length;
  const suspicious = submissions.filter((s) => s.status === 'suspicious').length;
  const genuinePercent = total > 0 ? ((genuine / total) * 100).toFixed(1) : '0.0';

  // Filtering & pagination
  const filteredSubmissions = submissions.filter(s => {
    const matchesSearch = searchQuery === '' ||
      s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.assignmentTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesFilter;
  });
  const totalPages = Math.max(1, Math.ceil(filteredSubmissions.length / ITEMS_PER_PAGE));
  const paginatedSubmissions = filteredSubmissions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const userInitial = user?.name ? user.name[0].toUpperCase() : 'T';

  return (
    <PageTransition 
      className="min-h-screen text-on-surface selection:bg-primary-fixed-dim selection:text-on-primary-fixed dash-bg font-sans"
    >
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 border-b border-border bg-[#f8f9fa] dark:bg-slate-950 backdrop-blur-md">
        <div className="flex justify-between items-center px-4 sm:px-6 md:px-8 lg:px-12 py-3 sm:py-4 max-w-full">
          <div className="flex items-center gap-12">
            <button onClick={() => navigate('/')} className="text-xl font-bold tracking-tighter text-[#1E293B] dark:text-white uppercase font-headline">
              POWAI
            </button>
            <div className="hidden md:flex items-center gap-8 font-body text-sm tracking-tight">
              <span className="text-[#1E293B] font-semibold border-b-2 border-[#545f73] pb-1">Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 bg-surface-container-low rounded-full">
              <span className="material-symbols-outlined text-outline text-sm">search</span>
              <input
                className="bg-transparent border-none focus:outline-none text-xs sm:text-sm w-32 sm:w-48 font-body dark:text-white"
                placeholder="Search submissions..."
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 outline-none ml-2 group">
                  <div
                    className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-surface-container-high bg-primary/10 group-hover:bg-primary/20 transition-colors flex items-center justify-center text-sm font-bold text-primary"
                  >
                    {userInitial}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px] mt-2 p-2 font-body rounded-xl border-border/50 shadow-card bg-card text-foreground">
                  <DropdownMenuLabel className="mb-1">
                    <div className="flex flex-col space-y-1.5 focus:outline-none">
                      <p className="text-sm font-bold text-foreground truncate">{user?.name || 'User'}</p>
                      <p className="text-xs font-medium text-muted-foreground truncate">{user?.email || 'user@example.com'}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border/30 my-1" />
                  <DropdownMenuItem onClick={() => setIsSettingsOpen(true)} className="cursor-pointer font-bold mt-1 text-foreground transition-colors hover:bg-surface-container-highest !rounded-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">settings</span>
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleLogout} 
                    className="text-error cursor-pointer font-bold mt-1 hover:bg-error-container/20 hover:text-error transition-colors !rounded-lg flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-24 sm:pt-28 md:pt-32 pb-16 sm:pb-20 md:pb-24 px-4 sm:px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        {/* Header Section */}
        <header className="relative flex flex-col md:flex-row justify-between items-start md:items-end mb-8 sm:mb-12 md:mb-16 gap-4 sm:gap-6 z-10 py-4 sm:py-6 md:py-8">
          <div 
            className="absolute inset-[-2rem] md:inset-[-4rem] z-[-1] opacity-30 dark:opacity-[0.15] mix-blend-darken dark:mix-blend-lighten pointer-events-none mask-image-gradient"
            style={{ 
              backgroundImage: 'url(/dashimg.jpeg)', 
              backgroundSize: 'cover', 
              backgroundPosition: 'center',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)'
            }}
          ></div>

          <div className="space-y-1 sm:space-y-2">
            <span className="label-sm text-[10px] sm:text-[11px] uppercase tracking-[0.15em] sm:tracking-[0.2em] text-primary font-bold font-label">Institutional Overview</span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tighter text-on-background font-headline">Dashboard</h1>
            <p className="text-xs sm:text-sm text-on-surface-variant font-medium max-w-md font-body">Monitor submissions and authenticity with precision.</p>
          </div>
          <button
            onClick={() => navigate('/create-assignment')}
            className="group flex items-center gap-2 sm:gap-3 bg-[#1E293B] text-white px-4 sm:px-6 md:px-8 py-3 sm:py-4 rounded-md font-semibold text-sm sm:text-base tracking-tight transition-all hover:shadow-xl hover:translate-y-[-2px] active:scale-95 font-body flex-shrink-0 touch-target"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Create Assignment
          </button>
        </header>

        {/* Stat Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-12 sm:mb-16 md:mb-20 font-body">
          {/* Volume */}
          <div className="bg-surface-container-lowest p-5 sm:p-6 md:p-8 rounded-lg sm:rounded-xl shadow-[0_24px_48px_-12px_rgba(30,41,59,0.04)] border border-outline-variant/10 relative overflow-hidden group hover:bg-surface-bright transition-colors">
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div className="p-2 sm:p-3 bg-secondary-container/30 rounded-lg">
                <span className="material-symbols-outlined text-secondary text-xl sm:text-2xl">description</span>
              </div>
              <span className="text-[8px] sm:text-[10px] font-bold tracking-widest text-secondary-dim uppercase bg-secondary-fixed/30 px-2 py-1 rounded">Volume</span>
            </div>
            <div className="relative z-10">
              <p className="text-on-surface-variant text-xs sm:text-sm font-medium mb-1">Total Submissions</p>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-on-background tracking-tighter font-headline">{total}</h3>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] scale-150 transition-transform group-hover:scale-125">
              <span className="material-symbols-outlined text-[120px]">analytics</span>
            </div>
          </div>

          {/* Integrity */}
          <div className="bg-surface-container-lowest p-5 sm:p-6 md:p-8 rounded-lg sm:rounded-xl shadow-[0_24px_48px_-12px_rgba(30,41,59,0.04)] border border-outline-variant/10 relative overflow-hidden group hover:bg-surface-bright transition-colors">
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div className="p-2 sm:p-3 bg-primary-container/30 rounded-lg">
                <span className="material-symbols-outlined text-primary text-xl sm:text-2xl">verified_user</span>
              </div>
              <span className="text-[8px] sm:text-[10px] font-bold tracking-widest text-on-primary-fixed-variant uppercase bg-primary-fixed/30 px-2 py-1 rounded">Integrity</span>
            </div>
            <div className="relative z-10">
              <p className="text-on-surface-variant text-xs sm:text-sm font-medium mb-1">High Authenticity</p>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-on-background tracking-tighter font-headline">{genuinePercent}%</h3>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] scale-150 transition-transform group-hover:scale-125">
              <span className="material-symbols-outlined text-[120px]">task_alt</span>
            </div>
          </div>

          {/* Suspicious */}
          <div className="bg-surface-container-lowest p-5 sm:p-6 md:p-8 rounded-lg sm:rounded-xl shadow-[0_24px_48px_-12px_rgba(30,41,59,0.04)] border border-outline-variant/10 relative overflow-hidden group hover:bg-surface-bright transition-colors sm:col-span-2 lg:col-span-1">
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div className="p-2 sm:p-3 bg-error-container/20 rounded-lg">
                <span className="material-symbols-outlined text-error text-xl sm:text-2xl">warning</span>
              </div>
              <span className="text-[8px] sm:text-[10px] font-bold tracking-widest text-error uppercase bg-error-container/40 px-2 py-1 rounded">Alert</span>
            </div>
            <div className="relative z-10">
              <p className="text-on-surface-variant text-xs sm:text-sm font-medium mb-1">Suspicious</p>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-on-background tracking-tighter font-headline">{suspicious}</h3>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] scale-150 transition-transform group-hover:scale-125">
              <span className="material-symbols-outlined text-[120px]">policy</span>
            </div>
          </div>
        </section>

        {/* Tabs for Table View */}
        <div className="flex gap-2 sm:gap-4 md:gap-6 lg:gap-8 mb-4 sm:mb-6 border-b border-outline-variant/10 font-headline overflow-x-auto">
          <button 
            onClick={() => setActiveTab('submissions')} 
            className={`text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl font-bold pb-2.5 sm:pb-3 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'submissions' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-background'}`}>
            Recent Submissions
          </button>
          <button 
            onClick={() => setActiveTab('assignments')} 
            className={`text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl font-bold pb-2.5 sm:pb-3 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'assignments' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-background'}`}>
            Assignments
          </button>
        </div>

        {activeTab === 'submissions' ? (
        <section className="bg-surface-container-lowest rounded-lg sm:rounded-xl shadow-[0_24px_48px_-12px_rgba(30,41,59,0.06)] overflow-hidden border border-outline-variant/5">
          <div className="px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 border-b border-outline-variant/10">
            <h2 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-on-background font-headline">Submissions</h2>
            <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4 font-body">
              <button
                onClick={() => void refreshSubmissions()}
                disabled={isRefreshingSubmissions}
                className="text-[9px] sm:text-xs font-bold tracking-widest uppercase text-on-surface-variant hover:text-primary transition-colors border border-outline-variant/10 px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-1.5 rounded bg-surface-container hover:bg-surface-bright touch-target text-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={`material-symbols-outlined text-[14px] ${isRefreshingSubmissions ? 'animate-spin' : ''}`}>refresh</span>
                <span className="hidden sm:inline">Refresh</span>
                <span className="sm:hidden text-[11px]">Sync</span>
              </button>
              <button onClick={exportToPDF} className="text-[9px] sm:text-xs font-bold tracking-widest uppercase text-on-surface-variant hover:text-primary transition-colors border border-outline-variant/10 px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-1.5 rounded bg-surface-container hover:bg-surface-bright touch-target text-nowrap"><span className="material-symbols-outlined text-[14px] hidden sm:inline">download</span> <span className="sm:hidden text-[11px]">Export</span><span className="hidden sm:inline">PDF</span></button>
              {/* Working filter dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-[9px] sm:text-xs font-bold tracking-widest uppercase text-on-surface-variant hover:text-primary transition-colors border border-outline-variant/10 px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-1.5 rounded bg-surface-container hover:bg-surface-bright touch-target text-nowrap">
                    <span className="material-symbols-outlined text-[14px]">filter_list</span>
                    <span className="hidden sm:inline">{statusFilter === 'all' ? 'Filter' : statusFilter}</span><span className="sm:hidden text-[11px]">{statusFilter === 'all' ? 'All' : statusFilter}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[160px] font-body rounded-xl border-border/50 shadow-card bg-surface">
                  <DropdownMenuItem onClick={() => { setStatusFilter('all'); setCurrentPage(1); }} className={`cursor-pointer font-bold !rounded-lg ${statusFilter === 'all' ? 'text-primary' : ''}`}>All Status</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setStatusFilter('genuine'); setCurrentPage(1); }} className={`cursor-pointer font-bold !rounded-lg ${statusFilter === 'genuine' ? 'text-primary' : ''}`}>Genuine</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setStatusFilter('review'); setCurrentPage(1); }} className={`cursor-pointer font-bold !rounded-lg ${statusFilter === 'review' ? 'text-primary' : ''}`}>Review</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setStatusFilter('suspicious'); setCurrentPage(1); }} className={`cursor-pointer font-bold !rounded-lg ${statusFilter === 'suspicious' ? 'text-primary' : ''}`}>Suspicious</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-body text-xs sm:text-sm">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 text-[8px] sm:text-[10px] font-bold tracking-widest uppercase text-outline">Student</th>
                  <th className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 text-[8px] sm:text-[10px] font-bold tracking-widest uppercase text-outline hidden sm:table-cell">Assignment</th>
                  <th className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 text-[8px] sm:text-[10px] font-bold tracking-widest uppercase text-outline">Score</th>
                  <th className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 text-[8px] sm:text-[10px] font-bold tracking-widest uppercase text-outline hidden md:table-cell">Status</th>
                  <th className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 text-[8px] sm:text-[10px] font-bold tracking-widest uppercase text-outline hidden lg:table-cell">Date</th>
                  <th className="px-2 sm:px-3 md:px-4 lg:px-8 py-3 sm:py-4 text-[8px] sm:text-[10px] font-bold tracking-widest uppercase text-outline text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {paginatedSubmissions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-outline text-sm">
                      {submissions.length === 0 ? 'No submissions yet.' : 'No submissions match your search/filter.'}
                    </td>
                  </tr>
                )}
                {paginatedSubmissions.map((s) => {
                  let statusColor = '';
                  let statusBg = '';
                  let progressBg = '';
                  let scoreText = '';

                  if (s.status === 'genuine' || s.score >= 80) {
                    statusColor = 'text-emerald-700 dark:text-emerald-300';
                    statusBg = 'border border-emerald-200/80 bg-emerald-100/90 dark:border-emerald-400/30 dark:bg-emerald-500/20';
                    progressBg = 'bg-emerald-500';
                    scoreText = 'text-emerald-600 dark:text-emerald-300';
                  } else if (s.status === 'suspicious' || s.score < 50) {
                    statusColor = 'text-red-700 dark:text-red-300';
                    statusBg = 'border border-red-200/80 bg-red-100/90 dark:border-red-400/30 dark:bg-red-500/20';
                    progressBg = 'bg-red-500';
                    scoreText = 'text-red-600 dark:text-red-300';
                  } else {
                    statusColor = 'text-sky-700 dark:text-sky-300';
                    statusBg = 'border border-sky-200/80 bg-sky-100/90 dark:border-sky-400/30 dark:bg-sky-500/20';
                    progressBg = 'bg-sky-500';
                    scoreText = 'text-sky-600 dark:text-sky-300';
                  }

                  const initials = s.studentName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();

                  return (
                    <tr key={s.id} className="group hover:bg-surface-bright transition-colors">
                      <td className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-5">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed font-bold text-[10px] sm:text-xs">
                            {initials}
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-on-background line-clamp-1">{s.studentName}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-5 text-xs sm:text-sm text-on-surface-variant font-medium hidden sm:table-cell line-clamp-1">{s.assignmentTitle}</td>
                      <td className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-5">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <div className="w-16 sm:w-24 h-1 sm:h-1.5 bg-surface-container-high rounded-full overflow-hidden flex-shrink-0">
                            <div className={`h-full ${progressBg} rounded-full`} style={{ width: `${s.score}%` }}></div>
                          </div>
                          <span className={`text-xs sm:text-sm font-bold ${scoreText} flex-shrink-0`}>{s.score}%</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-5 hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-bold tracking-widest uppercase ${statusBg} ${statusColor}`}>
                          <span className={`w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full ${progressBg}`}></span>
                          <span className="hidden sm:inline">{s.status}</span><span className="sm:hidden">{s.status.substring(0, 3)}</span>
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-5 text-[10px] sm:text-xs text-outline font-medium hidden lg:table-cell">{s.submittedAt}</td>
                      <td className="px-2 sm:px-3 md:px-4 lg:px-8 py-4 sm:py-5 text-right">
                        <button onClick={() => navigate(`/analysis/${s.id}`)} className="p-1.5 sm:p-2 text-outline hover:text-on-background transition-colors hover:bg-surface-container-high rounded">
                          <span className="material-symbols-outlined text-[18px] sm:text-[20px]">open_in_new</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 bg-surface-container-low/30 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 font-body">
            <p className="text-[10px] sm:text-[11px] font-bold tracking-widest uppercase text-outline line-clamp-2">
              Showing {paginatedSubmissions.length} of {filteredSubmissions.length} {statusFilter !== 'all' && `(${statusFilter})`}
            </p>
            <div className="flex gap-2 items-center justify-between sm:justify-end">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold tracking-widest uppercase border border-outline-variant/20 rounded hover:bg-surface-container-high transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="hidden sm:inline">Previous</span><span className="sm:hidden">←</span>
              </button>
              <span className="text-xs font-bold text-on-surface-variant px-2 flex-shrink-0">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold tracking-widest uppercase border border-outline-variant/20 rounded bg-[#1E293B] text-white shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="hidden sm:inline">Next</span><span className="sm:hidden">→</span>
              </button>
            </div>
          </div>
        </section>
        ) : (
        <section className="bg-surface-container-lowest rounded-xl shadow-[0_24px_48px_-12px_rgba(30,41,59,0.06)] overflow-hidden border border-outline-variant/5 transform transition-all duration-300">
          <div className="px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 border-b border-outline-variant/10">
            <h2 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-on-background font-headline">Assignments Database</h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                onClick={handleDeleteSelectedAssignments}
                disabled={selectedAssignmentIds.length === 0 || deletingAssignments}
                className="flex gap-1 sm:gap-1.5 items-center text-[9px] sm:text-xs font-bold tracking-widest uppercase text-error hover:text-error/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-nowrap"
              >
                <span className={`material-symbols-outlined text-[14px] sm:text-[16px] ${deletingAssignments ? 'animate-spin' : ''}`}>delete</span>
                <span className="hidden sm:inline">Delete</span> ({selectedAssignmentIds.length})
              </button>
              <button onClick={loadAssignments} className="flex gap-1 sm:gap-1.5 items-center text-[9px] sm:text-xs font-bold tracking-widest uppercase text-on-surface-variant hover:text-primary transition-colors text-nowrap">
                <span className={`material-symbols-outlined text-[14px] sm:text-[16px] ${loadingDb ? 'animate-spin' : ''}`}>refresh</span>
                <span className="hidden sm:inline">Refresh</span> DB
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-body">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 text-[8px] sm:text-[10px] font-bold tracking-widest uppercase text-outline w-10 sm:w-12">
                    <input
                      type="checkbox"
                      checked={dbAssignments.length > 0 && selectedAssignmentIds.length === dbAssignments.length}
                      onChange={handleToggleAllAssignments}
                      aria-label="Select all assignments"
                      className="h-3.5 sm:h-4 w-3.5 sm:w-4 accent-[#1E293B] cursor-pointer"
                    />
                  </th>
                  <th className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 text-[8px] sm:text-[10px] font-bold tracking-widest uppercase text-outline">Code</th>
                  <th className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 text-[8px] sm:text-[10px] font-bold tracking-widest uppercase text-outline hidden sm:table-cell">Title</th>
                  <th className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 text-[8px] sm:text-[10px] font-bold tracking-widest uppercase text-outline hidden md:table-cell">Deadline</th>
                  <th className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 text-[8px] sm:text-[10px] font-bold tracking-widest uppercase text-outline text-right hidden lg:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {dbAssignments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 sm:py-10 text-outline text-xs sm:text-sm">No assignments found.</td>
                  </tr>
                )}
                {dbAssignments.map((a) => (
                  <tr key={a.id} className="group hover:bg-surface-bright transition-colors">
                     <td className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-5">
                       <input
                         type="checkbox"
                         checked={selectedAssignmentIds.includes(a.id)}
                         onChange={() => handleToggleAssignmentSelection(a.id)}
                         aria-label={`Select assignment ${a.title}`}
                         className="h-3.5 sm:h-4 w-3.5 sm:w-4 accent-[#1E293B] cursor-pointer"
                       />
                     </td>
                     <td className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-5">
                       <span className="font-mono bg-primary/10 text-primary px-2 sm:px-3 py-1 sm:py-1.5 rounded-md font-extrabold tracking-widest shadow-sm text-[10px] sm:text-xs">{a.code}</span>
                     </td>
                     <td className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-5 text-xs sm:text-sm font-semibold text-on-background hidden sm:table-cell line-clamp-1">{a.title}</td>
                     <td className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-5 text-[10px] sm:text-xs font-medium text-on-surface-variant hidden md:table-cell">{a.deadline}</td>
                     <td className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-5 text-[10px] sm:text-xs text-outline text-right hidden lg:table-cell">{a.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 sm:px-6 md:px-8 py-3 sm:py-4 bg-surface-container-low/30 border-t border-outline-variant/10 text-right">
             <span className="text-[9px] sm:text-[10px] tracking-widest uppercase text-outline font-bold flex justify-end gap-2 items-center">
               <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-green-500 animate-pulse"></div>
               <span className="hidden sm:inline">Connected to</span> Neon <span className="hidden sm:inline">Database</span>
             </span>
          </div>
        </section>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full mt-auto border-t border-[#abb3b7]/15 bg-[#f1f4f6] dark:bg-slate-900 font-body">
        <div className="flex flex-col md:flex-row justify-between items-center px-24 py-12 w-full gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <span className="text-[11px] uppercase tracking-widest text-[#545f73] dark:text-slate-400">© 2026 POWAI Institutional Integrity. Architected for Academic Excellence.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <span className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[#545f73] dark:text-slate-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              Systems Operational
            </span>
            <span className="text-[10px] text-[#545f73] dark:text-slate-500 opacity-40">•</span>
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-[#545f73] dark:text-slate-400 font-bold">
              <span className="material-symbols-outlined text-[13px]">verified_user</span>
              End-to-End Encrypted
            </span>
            <span className="text-[10px] text-[#545f73] dark:text-slate-500 opacity-40">•</span>
            <span className="text-[11px] uppercase tracking-widest text-[#545f73] dark:text-slate-400 font-bold">
              Version 1.0.3
            </span>
          </div>
        </div>
      </footer>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[425px] font-body bg-surface rounded-2xl border border-outline-variant/10 shadow-[0_24px_48px_-12px_rgba(30,41,59,0.15)]">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-bold font-headline text-foreground tracking-tight">Profile Settings</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm font-medium">
              Manage your core institutional credentials below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2 flex flex-col">
              <label className="text-xs font-bold uppercase tracking-widest text-[#545f73] dark:text-slate-400">Full Name</label>
              <Input
                value={settingsName}
                onChange={(e) => setSettingsName(e.target.value)}
                className="bg-surface-container-lowest border-outline-variant/10 h-10 px-3 shadow-sm focus-visible:ring-1 focus-visible:ring-primary rounded-lg font-medium"
              />
            </div>
            <div className="space-y-2 flex flex-col">
              <label className="text-xs font-bold uppercase tracking-widest text-[#545f73] dark:text-slate-400">Email Address</label>
              <Input
                disabled
                value={user?.email}
                className="bg-surface-container-low/50 border-outline-variant/10 h-10 px-3 shadow-none rounded-lg text-muted-foreground font-medium opacity-70"
              />
            </div>
            <div className="space-y-2 flex flex-col">
              <label className="text-xs font-bold uppercase tracking-widest text-[#545f73] dark:text-slate-400">Institutional Role</label>
              <Input
                disabled
                value="Teacher / Administrator"
                className="bg-surface-container-low/50 border-outline-variant/10 h-10 px-3 shadow-none rounded-lg text-muted-foreground font-medium opacity-70 cursor-not-allowed"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)} className="rounded-lg font-bold border-outline-variant/10 text-muted-foreground hover:bg-surface-container-highest cursor-pointer">
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} className="rounded-lg font-bold px-6 bg-[#1E293B] text-white hover:bg-[#1E293B]/90 shadow-sm transition-all hover:-translate-y-px cursor-pointer">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
};

export default Dashboard;
