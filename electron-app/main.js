const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let uiProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'turing-doctor-icon.png'),
    title: '图灵博士',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 加载本地服务
  mainWindow.loadURL('http://localhost:3000');

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('页面加载失败:', errorCode, errorDescription);
    // 如果加载失败，3秒后重试
    setTimeout(() => {
      mainWindow.loadURL('http://localhost:3000');
    }, 3000);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('应用加载成功！');
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
    if (uiProcess) {
      uiProcess.kill();
    }
  });
}

async function startUI() {
  console.log('启动图灵博士...');
  const uiPath = path.resolve(__dirname, '../deep-research-ui');

  // 启动前端服务
  uiProcess = spawn('npm', ['run', 'dev'], {
    cwd: uiPath,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // 只在有错误时输出日志
  uiProcess.stderr.on('data', (data) => {
    const errorMsg = data.toString();
    if (!errorMsg.includes('webpack') && !errorMsg.includes('compiled')) {
      console.error('前端服务错误:', errorMsg);
    }
  });

  uiProcess.on('error', (error) => {
    console.error('启动前端服务失败:', error);
  });

  // 等待8秒让服务启动，然后创建窗口
  setTimeout(() => {
    console.log('创建应用窗口...');
    createWindow();
  }, 8000);
}

app.on('ready', () => {
  startUI();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (uiProcess) {
    uiProcess.kill();
  }
}); 