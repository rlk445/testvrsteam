import Foundation
import Network

/// Servidor HTTP mínimo dentro do app: serve a pasta "www" em http://localhost:PORTA.
/// Assim a página roda em contexto seguro (câmera, sensores, WebAssembly e localStorage funcionam).
final class LocalServer {
    private let root: URL
    private let port: UInt16
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "localserver", attributes: .concurrent)

    private static let mime: [String: String] = [
        "html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8",
        "json": "application/json", "webmanifest": "application/manifest+json", "wasm": "application/wasm",
        "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "svg": "image/svg+xml", "ico": "image/x-icon",
        "txt": "text/plain; charset=utf-8", "tflite": "application/octet-stream", "binarypb": "application/octet-stream",
        "data": "application/octet-stream", "mp3": "audio/mpeg", "wav": "audio/wav", "woff2": "font/woff2"
    ]

    init(root: URL, port: UInt16) { self.root = root; self.port = port }

    func start(onReady: @escaping () -> Void, onFail: @escaping (String) -> Void) {
        do {
            let l = try NWListener(using: .tcp, on: NWEndpoint.Port(rawValue: port)!)
            l.stateUpdateHandler = { state in
                switch state {
                case .ready: onReady()
                case .failed(let e): onFail("\(e)")
                default: break
                }
            }
            l.newConnectionHandler = { [weak self] c in self?.accept(c) }
            l.start(queue: queue)
            listener = l
        } catch { onFail("\(error)") }
    }

    private func accept(_ c: NWConnection) { c.start(queue: queue); read(c, Data()) }

    private func read(_ c: NWConnection, _ acc: Data) {
        c.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, done, err in
            guard let self = self else { return }
            var buf = acc; if let d = data { buf.append(d) }
            if buf.range(of: Data("\r\n\r\n".utf8)) != nil { self.respond(c, buf); return }
            if done || err != nil || buf.count > 200_000 { c.cancel(); return }
            self.read(c, buf)
        }
    }

    private func send(_ c: NWConnection, status: String, type: String, body: Data, head: Bool) {
        var h = "HTTP/1.1 \(status)\r\nContent-Type: \(type)\r\nContent-Length: \(body.count)\r\n"
        h += "Cache-Control: no-cache\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n"
        var out = Data(h.utf8); if !head { out.append(body) }
        c.send(content: out, completion: .contentProcessed { _ in c.cancel() })
    }

    private func respond(_ c: NWConnection, _ req: Data) {
        let text = String(decoding: req, as: UTF8.self)
        let parts = (text.components(separatedBy: "\r\n").first ?? "").split(separator: " ")
        guard parts.count >= 2 else { c.cancel(); return }
        let method = String(parts[0]), head = method == "HEAD"
        var path = String(parts[1])
        if let q = path.firstIndex(of: "?") { path = String(path[..<q]) }
        path = path.removingPercentEncoding ?? path
        if path.hasSuffix("/") { path += "index.html" }
        let comps = path.split(separator: "/").map(String.init)
        if comps.contains("..") { send(c, status: "403 Forbidden", type: "text/plain", body: Data("403".utf8), head: head); return }
        let file = comps.reduce(root) { $0.appendingPathComponent($1) }
        guard method == "GET" || head, let body = try? Data(contentsOf: file, options: .mappedIfSafe) else {
            send(c, status: "404 Not Found", type: "text/plain", body: Data("404".utf8), head: head); return
        }
        let type = LocalServer.mime[file.pathExtension.lowercased()] ?? "application/octet-stream"
        send(c, status: "200 OK", type: type, body: body, head: head)
    }
}
