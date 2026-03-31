import { Link, useNavigate } from 'react-router-dom';
import useStore from '@/store/useStore';
import { LogOut, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import powLogo from '../../insipiration/pow.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Navbar = () => {
  const { user, logout, theme, toggleTheme } = useStore();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/70 backdrop-blur-xl">
      <div className="max-w-full flex h-14 items-center justify-between px-4 sm:px-6">
        <Link to={user ? (user.role === 'teacher' ? '/dashboard' : '/workspace') : '/'} className="flex items-center gap-2.5 font-semibold tracking-tight text-foreground transition-colors hover:text-primary">
          <img src={powLogo} alt="POWAI logo" className="h-8 w-8 rounded-lg object-contain" />
          POWAI
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="h-9 w-9"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {user ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 outline-none ml-1 group">
                  <span className="hidden text-sm uppercase tracking-wide font-bold text-muted-foreground sm:inline group-hover:text-foreground transition-colors">{user.name}</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary group-hover:bg-primary/20 transition-colors">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px] mt-1 p-2 font-body rounded-xl border-border/50 shadow-card">
                  <DropdownMenuLabel className="mb-1">
                    <div className="flex flex-col space-y-1.5 focus:outline-none">
                      <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
                      <p className="text-xs font-medium text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border/30 my-1" />
                  <DropdownMenuItem 
                    onClick={() => { logout(); navigate('/'); }} 
                    className="text-error cursor-pointer font-bold mt-1 hover:bg-error-container/20 hover:text-error transition-colors !rounded-lg"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/auth', { state: { mode: 'signup' } })}>Sign Up</Button>
              <Button size="sm" onClick={() => navigate('/auth', { state: { mode: 'login' } })}>Get Started</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
