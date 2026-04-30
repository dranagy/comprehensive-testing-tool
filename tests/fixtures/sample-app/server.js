import http from "node:http";

const HTML_PAGE = `
<!DOCTYPE html>
<html>
<head><title>Vulnerable Test App</title></head>
<body>
  <h1>Login</h1>
  <form id="login-form">
    <input type="text" id="username" placeholder="Username" />
    <input type="password" id="password" placeholder="Password" />
    <button type="submit">Login</button>
  </form>
  <div id="message"></div>
  <div id="search-section" style="display:none">
    <h2>Search</h2>
    <input type="text" id="search" placeholder="Search..." />
    <button id="search-btn">Search</button>
    <div id="results"></div>
  </div>
  <script>
    document.getElementById('login-form').addEventListener('submit', function(e) {
      e.preventDefault();
      const u = document.getElementById('username').value;
      const p = document.getElementById('password').value;
      fetch('/login', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({username:u, password:p})
      }).then(r => r.json()).then(d => {
        if(d.success) {
          document.getElementById('search-section').style.display='block';
          document.getElementById('message').textContent='Logged in as '+d.user;
        } else {
          document.getElementById('message').textContent='Login failed';
        }
      });
    });
    document.getElementById('search-btn').addEventListener('click', function() {
      const q = document.getElementById('search').value;
      fetch('/search?q='+encodeURIComponent(q)).then(r=>r.text()).then(t=>{
        document.getElementById('results').innerHTML=t;
      });
    });
  </script>
</body>
</html>
`;

function handler(req, res) {
  if (req.url === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(HTML_PAGE);
  }

  if (req.url === "/login" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const { username, password } = JSON.parse(body || "{}");
      if (username === "admin" && password === "password") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, user: "admin" }));
      } else {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid credentials" }));
      }
    });
    return;
  }

  if (req.url?.startsWith("/search") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const q = url.searchParams.get("q") || "";
    // Intentionally vulnerable: reflects user input without sanitization (XSS)
    // Intentionally vulnerable: no auth check
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<p>You searched for: ${q}</p>`);
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
}

const PORT = parseInt(process.env.PORT || "3456", 10);
const server = http.createServer(handler);

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`Sample vulnerable app listening on http://localhost:${PORT}`);
  });
}

export { server, handler };
