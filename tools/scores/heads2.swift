// Noteheads by shape: dark pixels that are thick both ways (staff lines, ledger lines and stems are thin in one direction,
// so they drop out), grouped into blobs; a blob about a head in size is a head. Names each head's pitch from the staff's top
// line. Works above and below the staff, where heads sit on ledger lines. Usage:
// swift heads2.swift page.png topLineY spacing clef(G|F) x0 x1
import Foundation
import AppKit
let a = CommandLine.arguments
guard a.count >= 7, let img = NSImage(contentsOfFile: a[1]), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("usage"); exit(1) }
let top = Double(a[2])!, sp = Double(a[3])!, clef = a[4], X0 = Int(a[5])!, X1 = Int(a[6])!
let w = cg.width, h = cg.height
var px = [UInt8](repeating: 0, count: w * h)
let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
let y0 = max(0, Int(top - 8 * sp)), y1 = min(h - 1, Int(top + 12 * sp)), x0 = max(0, X0), x1 = min(w - 1, X1)
let W = x1 - x0 + 1, H = y1 - y0 + 1
var d = [Bool](repeating: false, count: W * H)
for y in 0..<H { for x in 0..<W { d[y * W + x] = px[(y + y0) * w + (x + x0)] < 120 } }
let thin = Int(sp * 0.42)
var keep = [Bool](repeating: false, count: W * H)
for y in 0..<H { for x in 0..<W where d[y * W + x] {
    var u = y; while u > 0 && d[(u - 1) * W + x] { u -= 1 }
    var v = y; while v < H - 1 && d[(v + 1) * W + x] { v += 1 }
    if v - u + 1 < thin { continue }
    var l = x; while l > 0 && d[y * W + l - 1] { l -= 1 }
    var r = x; while r < W - 1 && d[y * W + r + 1] { r += 1 }
    if r - l + 1 < thin { continue }
    keep[y * W + x] = true
} }
var seen = [Bool](repeating: false, count: W * H)
var out: [(Double, Double, String)] = []
let names = ["C", "D", "E", "F", "G", "A", "B"]
let (ts, to) = clef == "G" ? (3, 5) : (5, 3)
for s in 0..<(W * H) where keep[s] && !seen[s] {
    var st = [s]; seen[s] = true; var mnx = W, mxx = 0, mny = H, mxy = 0, n = 0, sy = 0.0
    while let p = st.popLast() {
        let x = p % W, y = p / W; n += 1; sy += Double(y)
        mnx = min(mnx, x); mxx = max(mxx, x); mny = min(mny, y); mxy = max(mxy, y)
        for (dx, dy) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
            let nx = x + dx, ny = y + dy
            if nx < 0 || ny < 0 || nx >= W || ny >= H { continue }
            let q = ny * W + nx; if keep[q] && !seen[q] { seen[q] = true; st.append(q) }
        }
    }
    let bw = Double(mxx - mnx + 1), bh = Double(mxy - mny + 1)
    if bw < 0.75 * sp || bw > 1.9 * sp || bh < 0.55 * sp || bh > 1.35 * sp || Double(n) < 0.35 * bw * bh { continue }
    let cy = Double(mny + mxy) / 2 + Double(y0)
    let k = Int(((top - cy) / (sp / 2)).rounded()), idx = ts + k
    let nm = names[((idx % 7) + 7) % 7] + String(to + Int(floor(Double(idx) / 7)))
    out.append((Double(mnx + x0), cy, nm + (bw < 1.05 * sp ? " (small)" : "")))
}
for o in out.sorted(by: { $0.0 < $1.0 }) { print(String(format: "x %5.0f  y %6.1f  ", o.0, o.1) + o.2) }
