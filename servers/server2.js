const http = require('http');

const loadBalancer = http.createServer((req, res) => {
    res.end('server 1')
});

loadBalancer.listen(3032, () => {
  console.log('Load balancer running on port 3032');
});