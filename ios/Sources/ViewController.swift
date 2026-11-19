import UIKit
import WebKit
import AVFoundation

final class ViewController: UIViewController, WKUIDelegate, WKNavigationDelegate {
    private var web: WKWebView!
    private var server: LocalServer?
    private let port: UInt16 = 38219                     // porta fixa: o localStorage (ajustes e recordes) fica sempre no mesmo endereço

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }

    override func loadView() {
        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        web = WKWebView(frame: .zero, configuration: cfg)
        web.uiDelegate = self
        web.navigationDelegate = self
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.backgroundColor = .black
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { web.isInspectable = true }
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])   // som mesmo com o modo silencioso ligado
        try? AVAudioSession.sharedInstance().setActive(true)
        guard let www = Bundle.main.url(forResource: "www", withExtension: nil) else { show("Pasta www não encontrada no app."); return }
        let s = LocalServer(root: www, port: port)
        server = s
        s.start(onReady: { [weak self] in
            DispatchQueue.main.async {
                guard let self = self, let url = URL(string: "http://localhost:\(self.port)/index.html") else { return }
                self.web.load(URLRequest(url: url))
            }
        }, onFail: { [weak self] msg in
            DispatchQueue.main.async { self?.show("Não foi possível iniciar o servidor local: \(msg)") }
        })
    }

    private func show(_ msg: String) {
        web.loadHTMLString("<body style='background:#000;color:#fff;font:20px -apple-system;padding:30px'>\(msg)</body>", baseURL: nil)
    }

    // a câmera do app é liberada sem perguntar de novo (o iOS já pediu a permissão do app)
    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) { decisionHandler(.grant) }

    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) { decisionHandler(.grant) }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}
