const http = require("http");
const httpProxy = require("http-proxy-middleware");
const os = require("os");
const axios = require("axios");

const servers = [
  { target: "http://46.102.140.42:3031", weight: 1 },
  { target: "http://localhost:3031", weight: 2 },
  { target: "http://localhost:3032", weight: 3 },
  { target: "http://localhost:3033", weight: 4 },
];

let currentServer = null;

function selectServer() {
  const availableServers = servers.filter((server) => server.available);
  if (availableServers.length === 0) {
    return servers[0];
  }

  const sortedServers = availableServers.sort((a, b) => a.weight - b.weight);
  return sortedServers.reduce((prev, current) => {
    return current.resourceUtilization.cpu < prev.resourceUtilization.cpu
      ? current
      : prev;
  });
}

const loadBalancer = http.createServer((req, res) => {
  if (!currentServer) {
    currentServer = selectServer();
  }
  currentServer.proxy(req, res);
});

function monitorServerResources() {
  servers.forEach(async (server) => {
    const targetUrl = new URL(server.target);
    let data = null;
    try {
      data = await axios(targetUrl.href);
      if (typeof data.data === "object") {
        server.available = true;
      } else {
        server.available = false;
      }
    } catch (error) {
      console.log(error);
      server.available = false;
    }
    let cpuUsage;
    let memoryUsage;
    let core;
    if (data?.data) {
      cpuUsage = data.data.cpu
        ? data.data.cpu
        : os.loadavg()[0] / os.cpus().length;
      memoryUsage = data.data.memory
        ? data.data.memory
        : process.memoryUsage().rss;
      core = data.data.core ? data.data.core : os.cpus().length;
    } else {
      cpuUsage = os.loadavg()[0] / os.cpus().length;
      memoryUsage = process.memoryUsage().rss;
      core = os.cpus().length;
    }

    server.resourceUtilization = {
      cpu: cpuUsage,
      memory: memoryUsage,
      core,
    };
  });
}
setTimeout(monitorServerResources, 5000); 

monitorServerResources();

servers.forEach((server) => {
  server.proxy = httpProxy.createProxyMiddleware({
    target: server.target,
    changeOrigin: true,
  });
});

const PORT = 8080;
loadBalancer.listen(PORT, () => {
  console.log(`Load balancer running on port ${PORT}`);
});
