export function GameSwitcher({ game, personal = false }: { game: 'efl' | 'fpl'; personal?: boolean }) {
  return <div className="game-switcher" role="group" aria-label="切换 Fantasy 系统">
    <a href={personal ? './personal.html' : './index.html'} aria-current={game === 'efl' ? 'page' : undefined}>EFL</a>
    <a href={personal ? './fpl-personal.html' : './fpl.html'} aria-current={game === 'fpl' ? 'page' : undefined}>FPL</a>
  </div>;
}
