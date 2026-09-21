import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ArrowRight,
  Compass,
  Maximize2,
  Move,
  Swords,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
const gameSource = `${import.meta.env.BASE_URL}game.html`;

type Surface = 'landing' | 'instructions' | 'game';

const instructions = [
  {
    title: 'Use W A S D or the arrow keys to move around.',
    copy: 'On a phone, use the joystick in the lower-left corner.',
    icon: Compass,
    keys: ['W', 'A', 'S', 'D'],
  },
  {
    title: 'Press SPACE to dash away from danger.',
    copy: 'Mushak can slip through narrow places. Gather offerings to increase your punya.',
    icon: Move,
    keys: ['SPACE'],
  },
  {
    title: 'Press J to strike when an enemy leaves an opening.',
    copy: 'Watch the ground and the attack indicators before moving in.',
    icon: Swords,
    keys: ['J'],
  },
  {
    title: 'Press K for divine light and L for Mushak Assist.',
    copy: 'The journey begins now. Stay close, help each other, and reach the arena.',
    icon: Compass,
    keys: ['K', 'L'],
  },
] as const;

function LandingSurface({ onStart }: { onStart: () => void }) {
  return (
    <main className="landing" data-testid="surface-landing">
      <header className="landing-header">
        <div className="brand-mark" data-testid="brand-mark">
          <span className="brand-seal" aria-hidden="true">श्री</span>
          <span className="brand-copy">
            <strong>Mushak &amp; Vinayaka</strong>
            <span>The Vahana&apos;s Journey</span>
          </span>
        </div>
        <span className="header-note">A festival adventure</span>
      </header>

      <section className="landing-main" aria-labelledby="game-title">
        <div className="hero-copy">
          <p className="eyebrow">A handcrafted browser journey</p>
          <h1 className="hero-title" id="game-title">
            Carry the light
            <br />
            <em>through the dark.</em>
          </h1>
          <p className="hero-description">
            Join Mushak and Vinayaka on the road to Gajamukhasura — a quiet
            festival passage that asks for nimble feet and a brave heart.
          </p>
          <div className="hero-actions">
            <button
              className="journey-button"
              type="button"
              onClick={onStart}
              data-testid="button-start-journey"
            >
              Start Journey
              <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <span className="quiet-button" aria-label="Playable on desktop and mobile">
              <Maximize2 size={15} strokeWidth={1.6} aria-hidden="true" />
              Desktop &amp; mobile
            </span>
          </div>
          <div className="journey-meta" aria-label="Journey details">
            <span>One continuous tale</span>
            <span>Play in landscape</span>
          </div>
        </div>

        <div className="mandala-stage" aria-hidden="true">
          <div className="mandala-rays" />
          <div className="glyph-ring" />
          <div className="mandala-glyph">श्री</div>
        </div>
      </section>

      <footer className="landing-footer">
        <span className="footer-note">For Ganesh Chaturthi</span>
        <span className="footer-note">A respectful adventure</span>
      </footer>
    </main>
  );
}

function InstructionSurface({
  index,
}: {
  index: number;
}) {
  const instruction = instructions[index];
  const Icon = instruction.icon;

  return (
    <main className="instruction-screen" data-testid="surface-instructions">
      <section className="instruction-inner" aria-live="polite">
        <div className="instruction-symbol" aria-hidden="true">
          <Icon size={26} strokeWidth={1.4} />
        </div>
        <h1 className="instruction-title">{instruction.title}</h1>
        <p className="instruction-copy">{instruction.copy}</p>
        {instruction.keys && (
          <div className="control-row" aria-label="Controls">
            {instruction.keys.map((key) => (
              <span className="key-cap" key={key}>{key}</span>
            ))}
          </div>
        )}
        <div className="progress-dots" aria-label={`Instruction ${index + 1} of ${instructions.length}`}>
          {instructions.map((item, itemIndex) => (
            <span
              className={itemIndex === index ? 'active' : ''}
              key={item.title}
              aria-hidden="true"
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function GameSurface({ onLeave }: { onLeave: () => void }) {
  return (
    <main className="game-shell" data-testid="surface-game">
      <iframe
        className="game-frame"
        src={gameSource}
        title="Mushak and Vinayaka: The Vahana's Journey"
        allow="fullscreen; gamepad"
        allowFullScreen
        data-testid="iframe-game"
      />
      <div className="game-toolbar">
        <span className="toolbar-label">Journey in progress</span>
        <button
          className="exit-button"
          type="button"
          onClick={onLeave}
          aria-label="Leave journey"
          title="Leave journey"
          data-testid="button-leave-game"
        >
          <X size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </main>
  );
}

function Home() {
  return <GameSurface onLeave={() => {}} />;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;