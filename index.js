const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const os = require("os");
const osUtils = require('os-utils');
const axios = require("axios");
const prometheus = require("prom-client");

// Create a counter metric
const requestsCounter = new prometheus.Counter({
  name: "app_requests_total",
  help: "Total number of requests",
  labelNames: ["host", "name", "object"],
});

const cpuUsageGauge = new prometheus.Gauge({
  name: "node_cpu_usage",
  help: "Current CPU usage of the Node.js application",
  labelNames: ["host", "name", "object"],
});

// Create a gauge metric for memory usage
const memoryUsageGauge = new prometheus.Gauge({
  name: "node_memory_usage",
  help: "Current memory usage of the Node.js application",
  labelNames: ["host", "name", "object"],
});

const getCpuUsagePercentage = () => {
  return new Promise((resolve) => {
    osUtils.cpuUsage((cpuPercentage) => {
      resolve(cpuPercentage * 100);
    });
  });
};

// Update the metrics periodically
setInterval(async() => {
  const cpuUsage = Number((await getCpuUsagePercentage()).toFixed(2));
  const memoryUsage = process.memoryUsage().rss;
  console.log(cpuUsage, memoryUsage);
  cpuUsageGauge.set({ host: "111", name: "111", object: "111" }, cpuUsage);
  memoryUsageGauge.set(
    { host: "111", name: "111", object: "111" },
    memoryUsage
  );
}, 1000);
const servers = [
  { target: "http://localhost:3031", weight: 1 },
  { target: "http://localhost:3032", weight: 2 },
  { target: "http://localhost:3033", weight: 3 },
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

const app = express();

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

app.use(async (req, res, next) => {
  if (req.originalUrl === "/metrics") {
    next();
  } else {
    requestsCounter.inc({
      host: "111",
      name: "111",
      object: "111",
    });
    next();
  }
});
servers.forEach((server) => {
  server.proxy = createProxyMiddleware({
    target: server.target,
    changeOrigin: true,
    router: () => {
      currentServer = selectServer();
      return currentServer.target;
    },
  });

  app.use("/api", server.proxy);
});

app.use("/metrics", async (req, res) => {
  res.set("Content-Type", prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Load balancer running on port ${PORT}`);
});
