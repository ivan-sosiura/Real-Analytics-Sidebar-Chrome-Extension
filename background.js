let statsInterval = null;
let lastCpuInfo = null;

// Функция расчета реальной загрузки CPU по разнице состояний ядер
function getCpuLoad(callback) {
    chrome.system.cpu.getInfo((cpuInfo) => {
        if (!lastCpuInfo) {
            lastCpuInfo = cpuInfo;
            return callback(0);
        }
        let totalDiff = 0;
        let idleDiff = 0;
        for (let i = 0; i < cpuInfo.numOfProcessors; i++) {
            const lastUsage = lastCpuInfo.processors[i].usage;
            const currentUsage = cpuInfo.processors[i].usage;
            const user = currentUsage.user - lastUsage.user;
            const kernel = currentUsage.kernel - lastUsage.kernel;
            const idle = currentUsage.idle - lastUsage.idle;
            totalDiff += user + kernel + idle;
            idleDiff += idle;
        }
        lastCpuInfo = cpuInfo;
        if (totalDiff === 0) return callback(0);
        callback(Math.round(((totalDiff - idleDiff) / totalDiff) * 100));
    });
}

// Функция получения процента занятой RAM
function getMemoryLoad(callback) {
    chrome.system.memory.getInfo((memInfo) => {
        callback(Math.round(((memInfo.capacity - memInfo.availableCapacity) / memInfo.capacity) * 100));
    });
}

// Постоянный мониторинг активной вкладки
function startStatsMonitoring() {
    if (statsInterval) clearInterval(statsInterval);

    statsInterval = setInterval(() => {
        getCpuLoad((cpuLoad) => {
            getMemoryLoad((ramLoad) => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs && tabs[0] && tabs[0].id) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: "updateStats",
                            cpu: cpuLoad,
                            ram: ramLoad
                        }).catch(() => { });
                    }
                });
            });
        });
    }, 1000);
}

// Слушатель нажатия на иконку расширения
chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('view-source:')) {
        return;
    }

    try {
        startStatsMonitoring();

        const [result] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => !!document.getElementById('custom-analytics-sidebar')
        });

        if (!result.result) {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
        } else {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const sidebar = document.getElementById('custom-analytics-sidebar');
                    if (sidebar) sidebar.classList.toggle('open');
                }
            });
        }
    } catch (err) {
        console.error(err);
    }
});
