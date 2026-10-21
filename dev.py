"""Dev server with live reload.

    python3 dev.py            # http://127.0.0.1:4321

Watches src/, data/, assets/ and build.py. On any change it rebuilds index.html
and every open tab reloads itself (Server-Sent Events on /__livereload).
"""
import subprocess, sys, threading, time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

R = Path(__file__).parent
PORT = 4321
WATCH = [R / "src", R / "data", R / "assets", R / "build.py"]
version = 0
lock = threading.Condition()


def snapshot():
    files = []
    for p in WATCH:
        files += [p] if p.is_file() else [f for f in p.rglob("*") if f.is_file()]
    return {f: f.stat().st_mtime for f in files}


def build():
    r = subprocess.run([sys.executable, "-I", str(R / "build.py")], capture_output=True, text=True)
    print((r.stdout or r.stderr).strip(), flush=True)
    return r.returncode == 0


def watch():
    global version
    seen = snapshot()
    while True:
        time.sleep(0.3)
        now = snapshot()
        if now != seen:
            seen = now
            time.sleep(0.1)  # let editors finish writing
            if build():
                with lock:
                    version += 1
                    lock.notify_all()


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path != "/__livereload":
            if self.path in ("/", "/index.html") or self.path.startswith(("/?", "/#")):
                self.path = "/index.html"
            return super().do_GET()
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        try:
            with lock:
                v = version
            self.wfile.write(f"data: {v}\n\n".encode()); self.wfile.flush()
            while True:
                with lock:
                    lock.wait(timeout=15)
                    changed = version != v
                    v = version
                self.wfile.write((f"data: {v}\n\n" if changed else ": ping\n\n").encode())
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass


if __name__ == "__main__":
    build()
    threading.Thread(target=watch, daemon=True).start()
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), partial(Handler, directory=str(R)))
    srv.daemon_threads = True
    print(f"Live reload on http://127.0.0.1:{PORT}", flush=True)
    srv.serve_forever()
