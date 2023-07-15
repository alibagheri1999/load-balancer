const http = require('http');
const os = require('os');
const loadBalancer = http.createServer((req, res) => {
    // for (let index = 0; index < 50000000; index++) {
    //     console.log(index);
    // }
const cpuUsage = os.loadavg()[0] / os.cpus().length;
    const memoryUsage = process.memoryUsage().rss;
const a = resourceUtilization = {
      cpu: cpuUsage,
      memory: memoryUsage,
      core: os.cpus().length
    };
    res.end(JSON.stringify(a))
});

loadBalancer.listen(3031, () => {
  console.log('Load balancer running on port 3031');
});