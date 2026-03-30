(() => {
  // Настройки поля
  const ROWS = 20;
  const COLS = 20;
  const INITIAL_PERIM = 2 * (ROWS + COLS) - 4;
  const INITIAL_LEN = 2 * (ROWS + COLS) - 4 - 2;

  // Получаем DOM элементы
  const gameEl = document.getElementById('game');
  const lengthEl = document.getElementById('length');
  const statusEl = document.getElementById('status');
  const padButtons = Array.from(document.querySelectorAll('.btn'));
  const restartBtn = document.getElementById('restartButton');
  
  // Проверяем, что элементы найдены
  if (!gameEl || !lengthEl || !statusEl) {
    console.error('Ошибка: не найдены необходимые DOM элементы!', {
      gameEl: !!gameEl,
      lengthEl: !!lengthEl,
      statusEl: !!statusEl
    });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM загружен, повторная попытка инициализации...');
        location.reload();
      });
    }
    return;
  }

  // Игровой state
  let grid = [];
  let snake = [];
  let dir = {dr:0, dc:1};
  let nextDir = null;
  let apple = null;
  let tickMs = 300; // Увеличили интервал в 2 раза (было 150)
  let timer = null;
  let alive = true;
  let won = false;

  // Инициализация сетки DOM-пометка
  function initGrid() {
    gameEl.innerHTML = '';
    gameEl.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        const div = document.createElement('div');
        div.className = 'grid-cell cell-empty';
        gameEl.appendChild(div);
        row.push(div);
      }
      grid.push(row);
    }
  }

  function setCell(r, c, type) {
    const cell = grid[r][c];
    cell.className = 'grid-cell';
    if (type === 'snake') cell.classList.add('cell-snake');
    else if (type === 'apple') cell.classList.add('cell-apple');
    else cell.classList.add('cell-empty');
  }

  function clearGrid() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        grid[r][c].className = 'grid-cell cell-empty';
      }
    }
  }

  function initSnakePerimeter() {
    snake = [];
    const perim = [];
    for (let c = 0; c < COLS; c++) perim.push({r:0, c});
    for (let r = 1; r < ROWS; r++) perim.push({r, c: COLS-1});
    for (let c = COLS-2; c >= 0; c--) perim.push({r: ROWS-1, c});
    for (let r = ROWS-2; r >= 1; r--) perim.push({r, c: 0});

    const startLen = Math.max(2, INITIAL_LEN);
    for (let i = 0; i < startLen; i++) {
      const p = perim[i];
      snake.push({r: p.r, c: p.c});
    }

    // Улучшенный алгоритм выбора безопасного направления
    const head = snake[0];
    const second = snake[1];
    
    const possibleDirs = [
      {dr: 0, dc: 1},
      {dr: 1, dc: 0},
      {dr: 0, dc: -1},
      {dr: -1, dc: 0}
    ];
    
    let safeDir = null;
    
    for (const testDir of possibleDirs) {
      const nextR = head.r + testDir.dr;
      const nextC = head.c + testDir.dc;
      
      if (!isInside(nextR, nextC)) continue;
      
      let collisionWithBody = false;
      for (let i = 1; i < snake.length - 1; i++) {
        if (snake[i].r === nextR && snake[i].c === nextC) {
          collisionWithBody = true;
          break;
        }
      }
      
      if (!collisionWithBody) {
        safeDir = testDir;
        break;
      }
    }
    
    if (!safeDir) {
      for (const testDir of possibleDirs) {
        const nextR = head.r + testDir.dr;
        const nextC = head.c + testDir.dc;
        if (isInside(nextR, nextC)) {
          safeDir = testDir;
          break;
        }
      }
    }
    
    dir = safeDir || {dr: 0, dc: 1};
  }

  function spawnApple() {
    const empty = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!snake.some(s => s.r === r && s.c === c)) {
          empty.push({r, c});
        }
      }
    }
    if (empty.length === 0) return null;
    const idx = Math.floor(Math.random() * empty.length);
    return empty[idx];
  }

  function updateGridVisual() {
    clearGrid();
    if (apple) setCell(apple.r, apple.c, 'apple');
    for (const seg of snake) setCell(seg.r, seg.c, 'snake');
  }

  function lengthDisplay() {
    lengthEl.textContent = snake.length;
  }

  function isInside(r,c){
    return r>=0 && r<ROWS && c>=0 && c<COLS;
  }

  function step() {
    if (!alive || won) return;

    if (nextDir) {
      const head = snake[0];
      const nx = head.r + nextDir.dr;
      const ny = head.c + nextDir.dc;
      const second = snake[1];
      if (!(second && second.r === nx && second.c === ny)) {
        dir = nextDir;
      }
      nextDir = null;
    }

    const head = snake[0];
    const nr = head.r + dir.dr;
    const nc = head.c + dir.dc;

    if (!isInside(nr,nc)) {
      console.log('Столкновение со стеной!', {nr, nc, head, dir});
      endGame(false);
      return;
    }
    
    for (let i = 1; i < snake.length; i++) {
      if (snake[i].r === nr && snake[i].c === nc) {
        console.log('Столкновение с собой!', {
          новаяПозиция: {r: nr, c: nc},
          сегмент: snake[i],
          индекс: i
        });
        endGame(false);
        return;
      }
    }

    // Добавляем новую голову
    snake.unshift({r: nr, c: nc});
    
    let ate = false;
    if (apple && nr === apple.r && nc === apple.c) {
      ate = true;
      apple = null;
      // При съедании яблока увеличиваем длину на 5
      for (let i = 0; i < 4; i++) {
        const tail = snake[snake.length - 1];
        snake.push({r: tail.r, c: tail.c});
      }
    } else {
      // УДАЛЯЕМ ДВА СЕГМЕНТА ВМЕСТО ОДНОГО для уменьшения длины
      if (snake.length > 1) {
        snake.pop(); // Первый сегмент
      }
      if (snake.length > 1) {
        snake.pop(); // Второй сегмент - змейка уменьшается
      }
    }

    if (!apple) {
      apple = spawnApple();
    }

    // Проверка победы: длина <= 2
    if (snake.length <= 2) {
      endGame(true);
      return;
    }

    updateGridVisual();
    lengthDisplay();
  }

  function endGame(wonFlag) {
    alive = false;
    won = !!wonFlag;
    statusEl.textContent = won ? 'Вы выиграли!' : 'Проиграли';
    statusEl.style.color = won ? 'var(--green)' : 'var(--red)';
    if (timer) clearInterval(timer);
  }

  function resetGame() {
    alive = true;
    won = false;
    statusEl.textContent = 'Играйте!';
    statusEl.style.color = '#fff';
    nextDir = null;
    initSnakePerimeter();
    apple = spawnApple();
    if (timer) clearInterval(timer);
    timer = setInterval(step, tickMs);
    updateGridVisual();
    lengthDisplay();
  }

  // Обработка клавиатуры
  window.addEventListener('keydown', (e) => {
    if (!alive) return;
    const key = e.key;
    let nd = null;
    if (key === 'ArrowUp') nd = {dr:-1, dc:0};
    else if (key === 'ArrowDown') nd = {dr:1, dc:0};
    else if (key === 'ArrowLeft') nd = {dr:0, dc:-1};
    else if (key === 'ArrowRight') nd = {dr:0, dc:1};
    if (nd) {
      e.preventDefault();
      nextDir = nd;
    }
  });

  // Ввод через геймпад (мобильная кнопка)
  padButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const d = btn.getAttribute('data-dir');
      if (d) {
        let nd = null;
        if (d === 'up') nd = {dr:-1, dc:0};
        else if (d === 'down') nd = {dr:1, dc:0};
        else if (d === 'left') nd = {dr:0, dc:-1};
        else if (d === 'right') nd = {dr:0, dc:1};
        if (nd) nextDir = nd;
      }
    });
  });

  // Инициализация поля и игры
  function init() {
    console.log('=== ИНИЦИАЛИЗАЦИЯ ИГРЫ ===');
    initGrid();
    console.log('Сетка создана');
    
    initSnakePerimeter();
    console.log('Змейка инициализирована:', {
      длина: snake.length,
      голова: snake[0],
      хвост: snake[snake.length - 1],
      направление: dir
    });
    
    apple = spawnApple();
    console.log('Яблоко создано:', apple);
    
    updateGridVisual();
    lengthDisplay();
    console.log('Визуализация обновлена');

    if (timer) clearInterval(timer);
    timer = setInterval(step, tickMs);
    console.log('Игра запущена! Таймер:', tickMs, 'мс');
    console.log('========================');
  }

  // Запуск
  init();

  // Возможность рестарта по двойному клику на поле
  gameEl.addEventListener('dblclick', () => {
    resetGame();
  });
  restartBtn.addEventListener('click', () => {
  resetGame();
});
})();