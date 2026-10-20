import './styles/main.css';
import { Game } from './game/Game.js';

let game = new Game();
game.start().catch((err) => {
  console.error(err);
  const el = document.getElementById('fatal');
  if (el) { el.textContent = 'Failed to start the game: ' + err.message; el.classList.add('on'); }
});

if (import.meta.env.DEV) import('./debug.js').then((m) => { window.__game = game; m.installDebug(game); });

// Clean teardown on hot reload so no second animation loop / duplicate listeners survive.
if (import.meta.hot) {
  import.meta.hot.dispose(() => { game.destroy(); game = null; });
}
