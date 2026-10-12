(function () {
  const existingWrapper = document.getElementById('analytics-sidebar-root');
  if (existingWrapper) {
    const sidebar = existingWrapper.shadowRoot.getElementById('custom-analytics-sidebar');
    if (sidebar) sidebar.classList.toggle('open');
    return;
  }

  // Рекордер истории: храним последние 30 точек для отрисовки красивой ломаной линии
  const history = {
    cpu: Array(30).fill(0),
    ram: Array(30).fill(0)
  };

  let activeSensor = 'cpu';

  const wrapper = document.createElement('div');
  wrapper.id = 'analytics-sidebar-root';
  wrapper.style.position = 'fixed';
  wrapper.style.zIndex = '9999999';
  document.body.appendChild(wrapper);

  const shadow = wrapper.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    #custom-analytics-sidebar {
      position: fixed;
      top: 0;
      right: -50vw;
      width: 50vw;
      height: 100vh;
      background: #1e1e24;
      color: #fff;
      box-shadow: -5px 0 25px rgba(0,0,0,0.5);
      transition: right 0.4s ease-in-out;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
    }
    #custom-analytics-sidebar * {
      box-sizing: border-box;
    }
    #custom-analytics-sidebar.open {
      right: 0;
    }
    #sidebar-toggle-handle {
      position: absolute;
      left: -15px;
      top: 0;
      width: 15px;
      height: 100%;
      background: #2a2a35;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-left: 1px solid #3a3a4a;
    }
    #sidebar-toggle-handle:hover {
      background: #007bff;
    }
    #sidebar-toggle-handle::after {
      content: '‹';
      color: #888;
      font-size: 20px;
      font-weight: bold;
    }
    #custom-analytics-sidebar.open #sidebar-toggle-handle::after {
      content: '›';
    }
    .sidebar-header {
      padding: 20px;
      background: #16161a;
      font-size: 18px;
      font-weight: bold;
      border-bottom: 1px solid #2a2a35;
    }
    .sidebar-body {
      padding: 20px 0;
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 30px;
    }
    .gauges-container {
      display: flex;
      justify-content: space-around;
      align-items: center;
      gap: 20px;
      margin: 0 14px;
    }
    .gauge-box {
      text-align: center;
      cursor: pointer;
      padding: 15px 10px;
      border-radius: 12px;
      transition: background 0.2s, border-color 0.2s;
      border: 2px solid #2a2a35;
      background: #16161a;
      flex: 1;
    }
    .gauge-box:hover {
      background: #25252e;
    }
    .gauge-box.active[data-sensor="cpu"] {
      border-color: #007bff;
    }
    .gauge-box.active[data-sensor="ram"] {
      border-color: #28a745;
    }
    .circle-gauge {
      position: relative;
      width: 120px;
      height: 120px;
      margin: 0 auto;
    }
    .circle-gauge svg {
      width: 120px;
      height: 120px;
      transform: rotate(-90deg);
    }
    .circle-bg {
      fill: none;
      stroke: #2a2a35;
      stroke-width: 8;
    }
    .circle-progress {
      fill: none;
      stroke: #007bff;
      stroke-width: 8;
      stroke-linecap: round;
      stroke-dasharray: 339.29;
      stroke-dashoffset: 339.29;
      transition: stroke-dashoffset 0.4s ease;
    }
    .circle-ram {
      stroke: #28a745;
    }
    .gauge-value {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 20px;
      font-weight: bold;
    }
    .gauge-label {
      margin-top: 10px;
      font-size: 14px;
      color: #aaa;
    }
    
    /* Контейнер графика с жесткими отступами по 14px */
    .chart-container {
      background: #16161a;
      margin: 0 14px;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #2a2a35;
      position: relative;
      height: 250px;
    }
    #realtimeChart {
      display: block;
      width: 100%;
      height: 100%;
      background: #16161a;
    }
  `;
  shadow.appendChild(style);

  const sidebar = document.createElement('div');
  sidebar.id = 'custom-analytics-sidebar';
  sidebar.innerHTML = `
    <div id="sidebar-toggle-handle"></div>
    <div class="sidebar-header">Мониторинг Системы</div>
    <div class="sidebar-body">
      <div class="gauges-container">
        
        <div class="gauge-box active" id="btn-cpu" data-sensor="cpu">
          <div class="circle-gauge">
            <svg>
              <circle class="circle-bg" cx="60" cy="60" r="54"></circle>
              <circle id="cpu-progress" class="circle-progress" cx="60" cy="60" r="54"></circle>
            </svg>
            <div id="cpu-text" class="gauge-value">0%</div>
          </div>
          <div class="gauge-label">Загрузка ЦП</div>
        </div>
        
        <div class="gauge-box" id="btn-ram" data-sensor="ram">
          <div class="circle-gauge">
            <svg>
              <circle class="circle-bg" cx="60" cy="60" r="54"></circle>
              <circle id="ram-progress" class="circle-progress circle-ram" cx="60" cy="60" r="54"></circle>
            </svg>
            <div id="ram-text" class="gauge-value">0%</div>
          </div>
          <div class="gauge-label">Память ОЗУ</div>
        </div>
        
      </div>
      <div class="chart-container">
        <canvas id="realtimeChart"></canvas>
      </div>
    </div>
  `;
  shadow.appendChild(sidebar);

  const cpuBtn = shadow.getElementById('btn-cpu');
  const ramBtn = shadow.getElementById('btn-ram');
  const handle = shadow.getElementById('sidebar-toggle-handle');
  const canvas = shadow.getElementById('realtimeChart');

  handle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (sidebar.classList.contains('open')) {
      setTimeout(drawChart, 100);
    }
  });

  cpuBtn.addEventListener('click', () => {
    activeSensor = 'cpu';
    cpuBtn.classList.add('active');
    ramBtn.classList.remove('active');
    drawChart();
  });

  ramBtn.addEventListener('click', () => {
    activeSensor = 'ram';
    ramBtn.classList.add('active');
    cpuBtn.classList.remove('active');
    drawChart();
  });

  const updateGauge = (progressId, textId, value) => {
    const circle = shadow.getElementById(progressId);
    const text = shadow.getElementById(textId);
    if (!circle || !text) return;
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    circle.style.strokeDashoffset = circumference - (value / 100) * circumference;
    text.innerText = `${Math.round(value)}%`;
  };

  // СОБСТВЕННЫЙ ДВИЖОК ОТРИСОВКИ ГРАФИКА НА CANVAS API
  function drawChart() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Установка реального пиксельного разрешения холста под размеры контейнера
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width;
    canvas.height = rect.height;

    const width = canvas.width;
    const height = canvas.height;
    const data = history[activeSensor];

    // Очистка холста
    ctx.clearRect(0, 0, width, height);

    // Рисуем сетку (горизонтальные линии уровней 25%, 50%, 75%)
    ctx.strokeStyle = '#2a2a35';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = height - (height * (i * 0.25));
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Определяем цвет линии в зависимости от выбранного датчика
    const lineColor = activeSensor === 'cpu' ? '#007bff' : '#28a745';
    const fillColor = activeSensor === 'cpu' ? 'rgba(0, 123, 255, 0.08)' : 'rgba(40, 167, 69, 0.08)';

    // Формируем точки ломаной линии
    const points = [];
    const stepX = width / (data.length - 1);

    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      // Инвертируем Y, так как в Canvas 0 находится вверху
      const y = height - (data[i] / 100) * height;
      points.push({ x, y });
    }

    // Отрисовка области заливки под графиком
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(points[0].x, height);
    for (const p of points) {
      ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(points[points.length - 1].x, height);
    ctx.closePath();
    ctx.fill();

    // Отрисовка основной ломаной жесткой линии
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Текстовая плашка легенды в углу графика
    ctx.fillStyle = '#aaa';
    ctx.font = '12px Segoe UI';
    ctx.fillText(activeSensor === 'cpu' ? 'История CPU (%)' : 'История RAM (%)', 10, 20);
  }

  // Принимаем системные данные
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "updateStats") {
      updateGauge('cpu-progress', 'cpu-text', message.cpu);
      updateGauge('ram-progress', 'ram-text', message.ram);

      // Пишем данные в рекордер
      history.cpu.push(message.cpu);
      history.cpu.shift();

      history.ram.push(message.ram);
      history.ram.shift();

      // Перерисовываем наш независимый Canvas
      drawChart();
    }
  });

  // Запуск первой отрисовки
  setTimeout(drawChart, 200);
  setTimeout(() => sidebar.classList.add('open'), 50);
})();
